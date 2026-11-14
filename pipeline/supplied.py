"""Sources a maintainer supplies by hand as a CSV: `python -m pipeline supply <id> <csv>`.

The command checks one file and adds its months to a local store (config/pipeline.json, `supplied`). It never fetches
anything and the Action never runs it. The store is one Parquet file of counts, one row per combination of the public
fields, and a ledger that says which file each month came from. The build reads the store (build.py) and checks it
against the ledger before it trusts it.
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import re
from datetime import date, datetime, timedelta
from pathlib import Path

import duckdb

from . import metrics, outputs, schema
from .errors import GuardrailError
from .normalise import lit
from .reference import quote

CHECK = "supply"
MONTH_KEY = "%Y-%m"
PERIOD = re.compile(r"^\d{4}(-\d{2})?$")
STORE_MONTH, STORE_COUNT = "month", "vehicles"


def abort(message: str) -> GuardrailError:
    return GuardrailError(CHECK, message)


def store_columns(source: dict) -> list[str]:
    """The store's columns, in order: the month, the public fields under their logical names, the count."""
    return [STORE_MONTH, *source["fields"], *source["extra_fields"], STORE_COUNT]


def store_paths(cfg, source_id: str) -> tuple[Path, Path]:
    source, directory = cfg.supplied(source_id), cfg.supplied_store(source_id)
    return directory / source["registrations_file"], directory / source["ledger_file"]


def read_ledger(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def month_key(value: date) -> str:
    return value.strftime(MONTH_KEY)


def month_range(first: date, last: date) -> list[date]:
    out, month = [], first
    while month <= last:
        out.append(month)
        month = metrics.month_add(month, 1)
    return out


def gaps(months: list[date]) -> list[str]:
    if not months:
        return []
    present = set(months)
    return [month_key(m) for m in month_range(min(months), max(months)) if m not in present]


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def store_problems(con, table: str, ledger: dict) -> list[str]:
    """What is wrong with a store table against its ledger: months, rows or vehicles that differ, or a gap."""
    found = {month_key(m): (int(n), int(v)) for m, n, v in con.execute(
        f"SELECT {STORE_MONTH}, count(*), sum({STORE_COUNT}) FROM {table} GROUP BY 1").fetchall()}
    recorded = {k: (int(e["rows"]), int(e["vehicles"])) for k, e in ledger["months"].items()}
    problems = []
    for month in sorted(set(found) | set(recorded)):
        if month not in recorded:
            problems.append(f"{month} is in the store but not in the ledger")
        elif month not in found:
            problems.append(f"{month} is in the ledger but has no rows in the store")
        elif found[month] != recorded[month]:
            problems.append(f"{month} has {found[month][0]:,} rows and {found[month][1]:,} vehicles in the store, but the "
                            f"ledger says {recorded[month][0]:,} and {recorded[month][1]:,}")
    missing = gaps([date.fromisoformat(m + "-01") for m in found])
    if missing:
        problems.append(f"the store has no rows for {', '.join(missing)}, between its first and last month")
    return problems


def read_header(path: Path) -> list[str]:
    with path.open(encoding="utf-8-sig", newline="") as fh:
        return next(csv.reader(fh), [])


def check_header(source: dict, header: list[str]) -> bool:
    """Returns whether the file carries the month column. Aborts unless the header is exactly the configured columns."""
    month_column = source["month"]["column"]
    wanted = [*source["fields"].values(), *source["extra_fields"].values(), *source["private_columns"], source["count_column"]]
    has_month = month_column in header
    expected = ([month_column] if has_month else []) + wanted
    repeated = sorted({c for c in header if header.count(c) > 1})
    missing = [c for c in expected if c not in header]
    extra = [c for c in header if c not in expected]
    if repeated or missing or extra:
        parts = []
        if missing:
            parts.append(f"missing {missing}")
        if extra:
            parts.append(f"not expected {extra}")
        if repeated:
            parts.append(f"repeated {repeated}")
        raise abort(f"the header is not the configured columns ({'; '.join(parts)}). The owner columns "
                    f"{source['private_columns']} must be present: they are checked and then dropped. Export the "
                    "same dimensions as the earlier files, or change config/pipeline.json if NZTA changed the report.")
    return has_month


def parse_totals(source: dict, path: Path) -> dict[str, int]:
    t = source["totals"]
    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        if not reader.fieldnames or t["period_column"] not in reader.fieldnames or t["count_column"] not in reader.fieldnames:
            raise abort(f"the totals file needs the columns {t['period_column']} and {t['count_column']}")
        out: dict[str, int] = {}
        for row in reader:
            period, count = row[t["period_column"]].strip(), row[t["count_column"]].strip()
            if not PERIOD.match(period) or not count.isdigit():
                raise abort(f"totals row {period!r}, {count!r}: a period is YYYY-MM or YYYY and a count is a whole number "
                            "with no commas")
            if period in out:
                raise abort(f"the totals file lists {period} twice")
            out[period] = int(count)
    return out


def load_incoming(con, cfg, source: dict, csv_path: Path, has_month: bool, month: date | None) -> None:
    """The file as `typed`: month, the public fields under their logical names (typed as the register types them), the
    private columns untouched for the duplicate check, and the count. Every check on the file's content runs here."""
    count_column = quote(source["count_column"])
    try:
        con.execute(f"CREATE TABLE incoming AS SELECT * FROM read_csv({lit(csv_path.as_posix())}, header = true, "
                    "all_varchar = true, delim = ',', quote = '\"')")
    except duckdb.Error as exc:
        raise abort(f"the file could not be read as a CSV: {exc}") from exc
    rows = con.execute("SELECT count(*) FROM incoming").fetchone()[0]
    if not rows:
        raise abort("the file has a header and no rows")

    bad_counts = con.execute(f"""
        SELECT {count_column}, count(*) FROM incoming
        WHERE NOT coalesce(regexp_matches(trim({count_column}), '^[0-9]+$'), FALSE)
           OR coalesce(TRY_CAST(trim({count_column}) AS BIGINT), 0) <= 0
        GROUP BY 1 ORDER BY 2 DESC LIMIT 5""").fetchall()
    if bad_counts:
        raise abort(f"{source['count_column']} must be a whole number above zero in every row; found {bad_counts} "
                    "(value, rows). Re-export the file; do not edit it by hand.")

    keys = [c for c in read_header(csv_path) if c != source["count_column"]]
    key_list = ", ".join(quote(c) for c in keys)
    repeated, example = con.execute(f"""
        SELECT count(*), any_value(row({key_list})) FROM (SELECT {key_list} FROM incoming GROUP BY ALL HAVING count(*) > 1)
    """).fetchone()
    if repeated:
        raise abort(f"{repeated:,} combinations of the key columns appear in more than one row, for example {example}. "
                    "One export lists each combination once; the file may be two exports joined together.")

    if has_month:
        column, fmt = quote(source["month"]["column"]), source["month"]["format"]
        texts = [t for (t,) in con.execute(f"SELECT DISTINCT trim({column}) FROM incoming").fetchall()]
        parsed, unreadable = {}, []
        for text in texts:
            try:
                parsed[text] = datetime.strptime(text, fmt).date().replace(day=1)
            except (TypeError, ValueError):
                unreadable.append(text)
        if unreadable:
            raise abort(f"{source['month']['column']} values that do not read as {fmt!r}: {sorted(unreadable, key=str)[:5]}")
        con.execute("CREATE TABLE month_map (text VARCHAR, month DATE)")
        con.executemany("INSERT INTO month_map VALUES (?, ?)", sorted(parsed.items()))
        month_from, month_expr = f"JOIN month_map m ON trim(i.{column}) = m.text", "m.month"
    else:
        month_from, month_expr = "", f"CAST({lit(month.isoformat())} AS DATE)"

    types = schema.pull_types(read_schema(cfg), [cfg.source_field(f) for f in source["fields"]])
    selected, checks = [f"{month_expr} AS {STORE_MONTH}"], []
    for logical, column in {**source["fields"], **source["extra_fields"]}.items():
        text = f"nullif(trim(i.{quote(column)}), '')"
        kind = types[cfg.source_field(logical)] if logical in source["fields"] else "VARCHAR"
        if kind == "VARCHAR":
            selected.append(f"{text} AS {quote(logical)}")
        else:
            selected.append(f"TRY_CAST({text} AS {kind}) AS {quote(logical)}")
            checks.append((column, f"{text} IS NOT NULL AND TRY_CAST({text} AS {kind}) IS NULL"))
    selected.append(f"CAST(trim(i.{count_column}) AS BIGINT) AS {STORE_COUNT}")
    for column, condition in checks:
        n = con.execute(f"SELECT count(*) FROM incoming i WHERE {condition}").fetchone()[0]
        if n:
            raise abort(f"{n:,} rows have a {column} that is not a number. Re-export the file; do not edit it by hand.")
    con.execute(f"CREATE TABLE typed AS SELECT {', '.join(selected)} FROM incoming i {month_from}")


def read_schema(cfg) -> dict:
    return json.loads(cfg.path("expected_schema").read_text(encoding="utf-8"))


def check_totals(con, totals: dict[str, int]) -> list[str]:
    problems = []
    for period, shown in sorted(totals.items()):
        if len(period) == 4:
            where = f"year({STORE_MONTH}) = {int(period)}"
        else:
            where = f"{STORE_MONTH} = DATE {lit(period + '-01')}"
        found = int(con.execute(f"SELECT coalesce(sum({STORE_COUNT}), 0) FROM typed WHERE {where}").fetchone()[0])
        if found != shown:
            problems.append(f"{period}: the dashboard showed {shown:,} but the file sums to {found:,}")
    return problems


def span(months: list[str], most: int = 6) -> str:
    """A list of months for the summary: all of them when few, else the count and the range."""
    if not months:
        return "none"
    return ", ".join(months) if len(months) <= most else f"{len(months)} months, {months[0]} to {months[-1]}"


def figures(con, table: str) -> dict[str, tuple[int, int]]:
    return {month_key(m): (int(n), int(v)) for m, n, v in con.execute(
        f"SELECT {STORE_MONTH}, count(*), sum({STORE_COUNT}) FROM {table} GROUP BY 1 ORDER BY 1").fetchall()}


def per_year(con, table: str) -> dict[int, tuple[int, int]]:
    return {int(y): (int(n), int(v)) for y, n, v in con.execute(
        f"SELECT year({STORE_MONTH}), count(*), sum({STORE_COUNT}) FROM {table} GROUP BY 1 ORDER BY 1").fetchall()}


def supply(cfg, source_id: str, csv_path: Path, month: str | None = None, taken: str | None = None,
           totals: Path | None = None, replace: list[str] | None = None, echo=print) -> dict:
    """Check one file and add its months to the store. Writes nothing unless every check passes."""
    if source_id not in cfg.pipeline.get("supplied", {}):
        raise abort(f"{source_id!r} is not a supplied source in config/pipeline.json ({sorted(cfg.pipeline.get('supplied', {}))})")
    source = cfg.supplied(source_id)
    if not csv_path.is_file():
        raise abort(f"{csv_path.name} is not a file")
    has_month = check_header(source, read_header(csv_path))
    only_month = None
    if has_month and month:
        raise abort("--month is refused: the file has its own month column. Leave it out.")
    if not has_month:
        if not month:
            raise abort("the file has no month column, so --month YYYY-MM is required")
        try:
            only_month = datetime.strptime(month, MONTH_KEY).date()
        except ValueError:
            raise abort(f"--month {month!r} is not YYYY-MM") from None
    try:
        taken_on = date.fromisoformat(taken) if taken else date.fromtimestamp(csv_path.stat().st_mtime)
    except ValueError:
        raise abort(f"--taken {taken!r} is not YYYY-MM-DD") from None
    replacing = []
    for text in replace or []:
        try:
            replacing.append(month_key(datetime.strptime(text, MONTH_KEY).date()))
        except ValueError:
            raise abort(f"--replace {text!r} is not YYYY-MM") from None

    con = duckdb.connect()
    load_incoming(con, cfg, source, csv_path, has_month, only_month)
    months = [m for (m,) in con.execute(f"SELECT DISTINCT {STORE_MONTH} FROM typed ORDER BY 1").fetchall()]
    missing = gaps(months)
    if missing:
        raise abort(f"the file has no rows for {', '.join(missing)}, between its first and last month. Export every "
                    "month in the range, or supply the file one month at a time.")
    ends = metrics.month_add(months[-1], 1) - timedelta(days=1)
    if taken_on < ends:
        raise abort(f"--taken {taken_on} is before {month_key(months[-1])} ends ({ends}). Give the day the export was taken.")

    warnings = []
    if totals:
        problems = check_totals(con, parse_totals(source, totals))
        if problems:
            raise abort("the file does not match the dashboard's own totals:\n  - " + "\n  - ".join(problems)
                        + "\nThe export may be incomplete. Export it again.")
    else:
        warnings.append("the totals were not checked against the dashboard: give --totals with the figures it showed")

    columns = ", ".join(quote(c) for c in store_columns(source)[:-1])
    con.execute(f"CREATE TABLE incoming_rows AS SELECT {columns}, CAST(sum({STORE_COUNT}) AS INTEGER) AS {STORE_COUNT} "
                "FROM typed GROUP BY ALL")
    registrations, ledger_path = store_paths(cfg, source_id)
    ledger = {"months": {}, "replaced": []}
    have = bool(registrations.exists() or ledger_path.exists())
    if have:
        if not (registrations.exists() and ledger_path.exists()):
            raise abort("the store has one of its two files; restore the other or remove both and supply again")
        ledger = read_ledger(ledger_path)
        con.execute(f"CREATE TABLE stored AS SELECT {', '.join(quote(c) for c in store_columns(source))} "
                    f"FROM read_parquet({lit(registrations.as_posix())})")
        problems = store_problems(con, "stored", ledger)
        if problems:
            raise abort("the store disagrees with its ledger: " + "; ".join(problems))
    else:
        con.execute("CREATE TABLE stored AS SELECT * FROM incoming_rows WHERE FALSE")

    incoming, existing = figures(con, "incoming_rows"), figures(con, "stored")
    columns_all = ", ".join(quote(c) for c in store_columns(source))
    differing = {month_key(m) for (m,) in con.execute(f"""
        SELECT DISTINCT {STORE_MONTH} FROM (
            (SELECT * FROM incoming_rows WHERE {STORE_MONTH} IN (SELECT {STORE_MONTH} FROM stored)
             EXCEPT ALL SELECT {columns_all} FROM stored WHERE {STORE_MONTH} IN (SELECT {STORE_MONTH} FROM incoming_rows))
            UNION ALL
            (SELECT {columns_all} FROM stored WHERE {STORE_MONTH} IN (SELECT {STORE_MONTH} FROM incoming_rows)
             EXCEPT ALL SELECT * FROM incoming_rows WHERE {STORE_MONTH} IN (SELECT {STORE_MONTH} FROM stored))
        )""").fetchall()}
    added = sorted(set(incoming) - set(existing))
    unchanged = sorted((set(incoming) & set(existing)) - differing)
    stray = [m for m in replacing if m not in incoming or m not in existing]
    if stray:
        raise abort(f"--replace names {stray}, which is not both in the file and already in the store")
    refused = sorted(differing - set(replacing))
    if refused:
        detail = "; ".join(f"{m}: the store has {existing[m][1]:,} vehicles in {existing[m][0]:,} rows, the file has "
                           f"{incoming[m][1]:,} in {incoming[m][0]:,}" for m in refused)
        raise abort(f"{len(refused)} month(s) already in the store differ from this file ({detail}). The dashboard restates "
                    "past months. If this file is right, name each month in --replace to replace it; the change is "
                    "recorded in the ledger.")
    replaced = sorted(differing)

    wanted = sorted(set(existing) | set(added))
    missing = gaps([date.fromisoformat(m + "-01") for m in wanted])
    if missing:
        raise abort(f"adding these months would leave the store with no rows for {', '.join(missing)}. Supply those "
                    "months first, or supply a file that covers them.")

    result = {"added": added, "unchanged": unchanged, "replaced": replaced, "warnings": warnings,
              "written": bool(added or replaced)}
    if result["written"]:
        digest = sha256_of(csv_path)
        for m in replaced:
            old = ledger["months"][m]
            ledger["replaced"].append({
                "month": m,
                "old": {"vehicles": old["vehicles"], "rows": old["rows"], "taken": old["taken"], "sha256": old["sha256"],
                        "source_file": old["source_file"]},
                "new": {"vehicles": incoming[m][1], "rows": incoming[m][0], "taken": taken_on.isoformat(),
                        "sha256": digest, "source_file": csv_path.name},
            })
        for m in added + replaced:
            ledger["months"][m] = {"source_file": csv_path.name, "sha256": digest, "taken": taken_on.isoformat(),
                                   "rows": incoming[m][0], "vehicles": incoming[m][1]}
        ledger["months"] = dict(sorted(ledger["months"].items()))
        out = [f"DATE {lit(m + '-01')}" for m in replaced]
        drop = f"WHERE {STORE_MONTH} NOT IN ({', '.join(out)})" if out else ""
        incoming_months = [f"DATE {lit(m + '-01')}" for m in added + replaced]
        con.execute(f"""
            CREATE TABLE merged AS
            SELECT {columns_all} FROM (
                SELECT {columns_all} FROM stored {drop}
                UNION ALL
                SELECT {columns_all} FROM incoming_rows WHERE {STORE_MONTH} IN ({', '.join(incoming_months)})
            ) ORDER BY ALL""")
        problems = store_problems(con, "merged", ledger)
        if problems:
            raise abort("internal check failed, nothing was written: " + "; ".join(problems))
        registrations.parent.mkdir(parents=True, exist_ok=True)
        staged = registrations.with_name(registrations.name + ".new")
        con.execute(f"COPY merged TO {lit(staged.as_posix())} (FORMAT PARQUET, COMPRESSION ZSTD)")
        staged_ledger = ledger_path.with_name(ledger_path.name + ".new")
        outputs.write_json(staged_ledger, ledger)
        os.replace(staged, registrations)
        os.replace(staged_ledger, ledger_path)
    final = per_year(con, "merged") if result["written"] else per_year(con, "stored")
    result["per_year"] = final

    echo(f"Months added: {span(added)}")
    echo(f"Months unchanged: {span(unchanged)}")
    echo(f"Months replaced: {span(replaced)}")
    for warning in warnings:
        echo(f"WARNING: {warning}")
    echo("The store now holds, by year:" if result["written"] else "Nothing to write. The store holds, by year:")
    for year, (n, v) in final.items():
        echo(f"  {year}: {n:,} rows, {v:,} vehicles")
    con.close()
    return result
