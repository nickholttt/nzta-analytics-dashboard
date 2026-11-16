"""Sources a maintainer supplies by hand as a CSV: `python -m pipeline supply <id> <csv>`.

The command checks one file and adds its months to a store (config/pipeline.json, `supplied`). It never fetches
anything and the Action never runs it. The store is one Parquet file of counts, one row per combination of the public
fields, and a ledger that says which file each month came from and under what terms the source is used. Both are
committed to the repository (D-097), so a build on GitHub and a build here read the same files. The build reads the
store (build.py) and checks it against the ledger before it trusts it.
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import NamedTuple

import duckdb

from . import metrics, normalise, outputs, reference, schema
from .errors import GuardrailError
from .normalise import lit
from .reference import quote

CHECK = "supply"
MONTH_KEY = "%Y-%m"
PERIOD = re.compile(r"^\d{4}(-\d{2})?$")
PERIOD_MONTH_FORMAT = "%Y-%m"
STORE_MONTH, STORE_COUNT = "month", "vehicles"
COUNTED_ROWS, SERIES = "counted_rows", "series"
# A store of kind series: one row for each month and series that has a figure.
STORE_SERIES, STORE_VALUE = "series_id", "value"


class Layout(NamedTuple):
    """What differs between kinds of supplied source in how the store is kept and checked."""
    file_key: str  # the key in config/pipeline.json that names the store's data file
    columns: list[str]
    count: str  # the column that is summed
    total_key: str  # the ledger key that holds a month's summed count
    replaced_key: str  # the ledger key that lists the months a later file restated


def abort(message: str) -> GuardrailError:
    return GuardrailError(CHECK, message)


def store_columns(source: dict) -> list[str]:
    """The store's columns, in order: the month, the public fields under their logical names, the count."""
    return [STORE_MONTH, *source["fields"], *source["extra_fields"], STORE_COUNT]


def layout(source: dict) -> Layout:
    kind = source.get("kind", COUNTED_ROWS)
    if kind == COUNTED_ROWS:
        return Layout("registrations_file", store_columns(source), STORE_COUNT, "vehicles", "replaced")
    if kind == SERIES:
        return Layout("series_file", [STORE_MONTH, STORE_SERIES, STORE_VALUE], STORE_VALUE, "sum", "revisions")
    raise abort(f"supplied source kind {kind!r} is not one this pipeline reads ({COUNTED_ROWS!r}, {SERIES!r})")


def check_config(source: dict) -> list[str]:
    """No column the file carries for the owner may also be a public field: it would be stored."""
    mapped = {*source.get("fields", {}).values(), *source.get("extra_fields", {}).values()}
    return [f"{c} is listed in private_columns and also mapped to a public field in config/pipeline.json; "
            "a private column is dropped, never stored" for c in source.get("private_columns", []) if c in mapped]


def store_paths(cfg, source_id: str) -> tuple[Path, Path]:
    source, directory = cfg.supplied(source_id), cfg.supplied_store(source_id)
    return directory / source[layout(source).file_key], directory / source["ledger_file"]


def read_ledger(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


# What a committed ledger says about the source's terms, copied from config/pipeline.json so the file carries them.
SOURCE_BLOCK_KEYS = ("publisher", "licence", "attribution", "origin")


def source_block(source: dict) -> dict:
    return {k: source[k] for k in SOURCE_BLOCK_KEYS if k in source}


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


def hash_problems(registrations: Path, ledger: dict) -> list[str]:
    """The ledger names the store file it was written with. A different file means the pair does not belong together."""
    if sha256_of(registrations) != ledger.get("store_sha256"):
        return [f"{registrations.name} is not the file this ledger was written with (its SHA-256 differs from the "
                "ledger's store_sha256). The two may come from different runs or one was edited."]
    return []


def store_problems(con, table: str, ledger: dict, count: str = STORE_COUNT, total_key: str = "vehicles") -> list[str]:
    """What is wrong with a store table against its ledger: months, rows or counts that differ, or a gap."""
    found = {month_key(m): (int(n), int(v)) for m, n, v in con.execute(
        f"SELECT {STORE_MONTH}, count(*), sum({count}) FROM {table} GROUP BY 1").fetchall()}
    recorded = {k: (int(e["rows"]), int(e[total_key])) for k, e in ledger["months"].items()}
    problems = []
    for month in sorted(set(found) | set(recorded)):
        if month not in recorded:
            problems.append(f"{month} is in the store but not in the ledger")
        elif month not in found:
            problems.append(f"{month} is in the ledger but has no rows in the store")
        elif found[month] != recorded[month]:
            problems.append(f"{month} has {found[month][0]:,} rows and {found[month][1]:,} {total_key} in the store, but the "
                            f"ledger says {recorded[month][0]:,} and {recorded[month][1]:,}")
    missing = gaps([date.fromisoformat(m + "-01") for m in found])
    if missing:
        problems.append(f"the store has no rows for {', '.join(missing)}, between its first and last month")
    return problems


def load_store(con, cfg, source_id: str, aborts: list[str], warnings: list[str] | None = None) -> tuple[dict, date, date] | None:
    """The build's view of a store that has both its files: it becomes the table `supplied_store`, after it is checked
    against its ledger. Returns the ledger and the store's first and last month, or None after adding to `aborts`. What
    the scope check finds that leaves the store correct is added to `warnings`."""
    source = cfg.supplied(source_id)
    registrations, ledger_path = store_paths(cfg, source_id)
    bad = check_config(source)
    if bad:
        aborts.extend(f"{source_id}: {problem}" for problem in bad)
        return None
    lay = layout(source)
    con.execute(f"CREATE OR REPLACE TABLE supplied_store AS SELECT * FROM read_parquet({lit(registrations.as_posix())})")
    found = [c for c, *_ in con.execute("DESCRIBE supplied_store").fetchall()]
    if found != lay.columns:
        aborts.append(f"{source_id}: the store's columns are {found}, but config/pipeline.json expects {lay.columns}")
        return None
    ledger = read_ledger(ledger_path)
    scope = scope_problems(cfg, source, ledger)
    problems = (hash_problems(registrations, ledger) + store_problems(con, "supplied_store", ledger, lay.count, lay.total_key)
                + scope.refusals)
    if problems:
        aborts.extend(f"{source_id}: the store disagrees with its ledger: {problem}" for problem in problems)
        return None
    if warnings is not None:
        warnings.extend(f"{source_id}: {w}" for w in scope.warnings)
    first, latest = con.execute(f"SELECT min({STORE_MONTH}), max({STORE_MONTH}) FROM supplied_store").fetchone()
    return ledger, first, latest


def check_clock(source_id: str, latest: date, register_month: date, aborts: list[str], warnings: list[str]) -> bool:
    """The register is the clock: a store newer than it aborts, an older one warns and names what is missing."""
    if latest > register_month:
        aborts.append(f"{source_id}: the store's latest month {month_key(latest)} is after the register's "
                      f"{month_key(register_month)}; the register is the clock, so the store cannot be ahead of it")
        return False
    if latest < register_month:
        missing = [month_key(m) for m in month_range(metrics.month_add(latest, 1), register_month)]
        warnings.append(f"{source_id}: the export is missing {span(missing)}: the store ends at "
                        f"{month_key(latest)} and the register at {month_key(register_month)}")
    return True


def outside_scope(cfg, source: dict) -> dict | None:
    """What a store is trimmed to, from config and the reference files the build itself reads: for the dataset that
    reads the source, the (vehicle type, import status) pairs it counts, and every value of each field the scope files
    know. A row whose pair is known and not counted never reaches that dataset, so the fields named in the rule
    (`supplied.<id>.outside_scope.fields`) are not kept for it. None when the source has no such rule."""
    rule = source.get("outside_scope")
    if not rule:
        return None
    p = cfg.pipeline
    vehicle, status = p["scope"]["vehicle"], p["scope"]["status"]
    vehicles = {r[vehicle["key"]]: r for r in reference.read(cfg.reference(vehicle["file"]))}
    statuses = {r[status["key"]]: r for r in reference.read(cfg.reference(status["file"]))}
    flags = normalise.scope_flags(cfg)
    # A vehicle type the dataset does not count can still keep its fields: those the vehicle scope file marks in this
    # column (the types a wider total counts). Its rows are then judged as if the type were in scope.
    column, true = rule.get("also_kept_column"), p["boolean_true"]
    if column and any(column not in r for r in vehicles.values()):
        raise abort(f"outside_scope names the column {column!r}, which {vehicle['file']} does not have")
    also = sorted(k for k, r in vehicles.items() if column and r[column] == true)
    require = p["datasets"][rule["dataset"]]["require"]
    unknown = [f for f in require if f not in flags]
    if unknown:
        raise abort(f"dataset {rule['dataset']} requires {unknown}, which do not come from the scope files, so the rows "
                    "it counts cannot be told from the source's values alone")
    missing = [f for f in rule["fields"] if f not in source["fields"]]
    if missing:
        raise abort(f"outside_scope names {missing}, which are not fields of the source")
    counted = sorted([vk, sk] for vk, vr in vehicles.items() for sk, sr in statuses.items()
                     if all(flags[f]({**vr, vehicle["in_scope"]: true} if vk in also else vr, sr) for f in require))
    return {"dataset": rule["dataset"], "fields": list(rule["fields"]),
            "also_kept": {"column": column, "types": also} if column else None,
            "known": {vehicle["field"]: sorted(vehicles), status["field"]: sorted(statuses)}, "counted": counted}


def counted_pairs(cfg, dataset: str) -> set[tuple[str, str]]:
    """The (vehicle type, import status) pairs a dataset counts, from its `require` flags and the two scope files."""
    p = cfg.pipeline
    vehicle, status = p["scope"]["vehicle"], p["scope"]["status"]
    flags, require = normalise.scope_flags(cfg), p["datasets"][dataset]["require"]
    unknown = [f for f in require if f not in flags]
    if unknown:
        raise abort(f"dataset {dataset} requires {unknown}, which do not come from the scope files, so the rows it counts "
                    "cannot be told from the source's values alone")
    vehicles = {r[vehicle["key"]]: r for r in reference.read(cfg.reference(vehicle["file"]))}
    statuses = {r[status["key"]]: r for r in reference.read(cfg.reference(status["file"]))}
    return {(vk, sk) for vk, vr in vehicles.items() for sk, sr in statuses.items() if all(flags[f](vr, sr) for f in require)}


def readers_of(cfg, source: dict) -> list[str]:
    """The datasets that read this supplied source."""
    return [d for d, c in cfg.pipeline["datasets"].items() if "source" in c and cfg.supplied(c["source"]) is source]


def beyond_the_trim(cfg, source: dict, recorded: dict | None, again: str) -> list[str]:
    """A refusal for each dataset, other than the one the trim was written for, that counts a (vehicle type, import status)
    pair whose model the store did not keep. Its model dimension would be not recorded for those vehicles, with no
    warning, so the store is refused as it is for the dataset the trim names."""
    if not recorded:
        return []
    kept = {tuple(pair) for pair in recorded["counted"]}
    out = []
    for dataset in readers_of(cfg, source):
        if dataset == recorded["dataset"]:
            continue
        missing = sorted(counted_pairs(cfg, dataset) - kept)
        if missing:
            out.append(f"the store did not keep the model of {len(missing)} (vehicle type, import status) pairs that "
                       f"{dataset} counts ({pairs_text(missing)}). {again}")
    return out


class ScopeCheck(NamedTuple):
    """What differs between the scope a store was trimmed to and the scope config and the scope files give today.
    `refusals` make the store wrong (a model it blanked would now be read); `warnings` leave it correct but larger than
    it needs to be."""
    refusals: list[str]
    warnings: list[str]


def blanked_pairs(scope: dict) -> set[tuple[str, str]]:
    """The (vehicle type, import status) pairs a scope trims: both values known, and the pair not counted."""
    (_, known_v), (_, known_s) = scope["known"].items()
    return {(v, s) for v in known_v for s in known_s} - {(v, s) for v, s in scope["counted"]}


def pairs_text(pairs, most: int = 6) -> str:
    shown = [f"{v} / {s}" for v, s in sorted(pairs)]
    return "; ".join(shown[:most]) + (f"; and {len(shown) - most} more" if len(shown) > most else "")


def scope_problems(cfg, source: dict, ledger: dict) -> ScopeCheck:
    """The store against the scope today. The trim blanks a field for the pairs the dataset does not count, so the store
    is wrong only if a model it blanked would now be read: a blanked pair that is counted now, or a field the ledger says
    was blanked that config no longer lists. A pair that stops being counted, a value the scope files did not know when
    the store was written, or a field added to the rule leaves the store holding more than it needs: a warning. A ledger
    that does not say what the store was trimmed to, or a rule config no longer has, cannot be judged: a refusal."""
    wanted, recorded = outside_scope(cfg, source), ledger.get("outside_scope")
    again = ("Supply the whole history again from the raw exports: remove both store files and run `supply` "
             "(docs/playbooks/supply-dashboard-month.md, Replacing the whole history)")
    # Judged first and whether or not the trim changed: a second dataset can count what the first never did.
    beyond = beyond_the_trim(cfg, source, recorded, again)
    if wanted == recorded:
        return ScopeCheck(beyond, [])
    if wanted is None:
        return ScopeCheck(["the ledger records a scope the store was trimmed to, but config/pipeline.json has no outside_scope rule now"], [])
    if recorded is None:
        return ScopeCheck(["the ledger does not say what the store was trimmed to, but config/pipeline.json has an outside_scope rule"], [])
    refusals, warnings = list(beyond), []
    blanked_then = blanked_pairs(recorded)
    now_read = sorted(blanked_then & {(v, s) for v, s in wanted["counted"]})
    if now_read:
        refusals.append(f"the store did not keep the model of {len(now_read)} (vehicle type, import status) pairs that "
                        f"{wanted['dataset']} counts now ({pairs_text(now_read)}). {again}")
    dropped = sorted(set(recorded["fields"]) - set(wanted["fields"]))
    if dropped and blanked_then:
        refusals.append(f"the store has no value of {dropped} for {len(blanked_then)} pairs, but config no longer trims "
                        f"{'it' if len(dropped) == 1 else 'them'}. {again}")
    no_longer = sorted({(v, s) for v, s in recorded["counted"]} - {(v, s) for v, s in wanted["counted"]})
    if no_longer:
        warnings.append(f"the store keeps the model of {len(no_longer)} (vehicle type, import status) pairs that "
                        f"{wanted['dataset']} no longer counts ({pairs_text(no_longer)}); it holds more than it needs, and "
                        "nothing published changes. New months are trimmed as the ledger records")
    for field, then in recorded["known"].items():
        new = sorted(set(wanted["known"][field]) - set(then))
        if new:
            warnings.append(f"the scope files now know {field} values the store was written without ({', '.join(new)}); "
                            "their rows keep their model, which the dataset may not need")
    added = sorted(set(wanted["fields"]) - set(recorded["fields"]))
    if added:
        warnings.append(f"config now also trims {added}; the store keeps it for every row, which is more than it needs")
    return ScopeCheck(refusals, warnings)


def blanked(source: dict, scope: dict | None, column: str) -> str:
    """The select item for one store column: the column itself, or NULL (not recorded) for a row outside the scope."""
    name = quote(column)
    if not scope or column not in scope["fields"]:
        return name
    (vf, known_v), (sf, known_s) = scope["known"].items()
    counted = " OR ".join(f"({quote(vf)} = {lit(v)} AND {quote(sf)} = {lit(s)})" for v, s in scope["counted"]) or "FALSE"
    known = f"{quote(vf)} IN ({', '.join(lit(v) for v in known_v)}) AND {quote(sf)} IN ({', '.join(lit(s) for s in known_s)})"
    return f"CASE WHEN {known} AND NOT ({counted}) THEN NULL ELSE {name} END AS {name}"


def commit_store(con, table: str, registrations: Path, ledger_path: Path, ledger: dict, lay: Layout, source: dict) -> None:
    """Write the merged store and its ledger. The table is checked against the ledger first, and nothing is written if
    they disagree. The ledger leads with the source's terms (`source`), as config/pipeline.json states them today."""
    problems = store_problems(con, table, ledger, lay.count, lay.total_key)
    if problems:
        raise abort("internal check failed, nothing was written: " + "; ".join(problems))
    head = {k: ledger[k] for k in ("outside_scope",) if k in ledger}
    ledger = {"source": source_block(source), **head, **{k: v for k, v in ledger.items() if k not in ("source", *head)}}
    registrations.parent.mkdir(parents=True, exist_ok=True)
    staged = registrations.with_name(registrations.name + ".new")
    con.execute(f"COPY {table} TO {lit(staged.as_posix())} (FORMAT PARQUET, COMPRESSION ZSTD)")
    # Both files are written under temporary names first and the ledger is renamed last. An interruption between the
    # two renames leaves a store the old ledger does not describe, and the hash in the ledger catches that.
    ledger["store_sha256"] = sha256_of(staged)
    staged_ledger = ledger_path.with_name(ledger_path.name + ".new")
    outputs.write_json(staged_ledger, ledger)
    os.replace(staged, registrations)
    os.replace(staged_ledger, ledger_path)


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
            period, count = (row[t["period_column"]] or "").strip(), (row[t["count_column"]] or "").strip()
            line = f"totals line {reader.line_num}"
            if not PERIOD.match(period):
                raise abort(f"{line}: {period!r} is not a period. A period is YYYY-MM or YYYY.")
            if len(period) == 7:
                try:
                    datetime.strptime(period, PERIOD_MONTH_FORMAT)
                except ValueError:
                    raise abort(f"{line}: {period!r} is not a real month. A period is YYYY-MM or YYYY.") from None
            if not count.isdigit():
                raise abort(f"{line}: {count!r} is not a whole number with no commas.")
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
    bad = check_config(source)
    if bad:
        raise abort("; ".join(bad))
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
    checked = None
    if totals:
        checked = parse_totals(source, totals)
        problems = check_totals(con, checked)
        if problems:
            raise abort("the file does not match the dashboard's own totals:\n  - " + "\n  - ".join(problems)
                        + "\nThe export may be incomplete. Export it again.")
    else:
        warnings.append("the totals were not checked against the dashboard: give --totals with the figures it showed")

    registrations, ledger_path = store_paths(cfg, source_id)
    have = bool(registrations.exists() or ledger_path.exists())
    if have and not (registrations.exists() and ledger_path.exists()):
        raise abort("the store has one of its two files; restore the other or remove both and supply again")
    if have:
        ledger = read_ledger(ledger_path)
        check = scope_problems(cfg, source, ledger)
        if check.refusals:
            raise abort("; ".join(check.refusals))
        warnings.extend(check.warnings)
        # New months are trimmed to the scope the store was written under, not today's, so every month in the store
        # is trimmed alike and a month supplied again compares equal to the one held.
        scope = ledger.get("outside_scope")
    else:
        scope = outside_scope(cfg, source)
        ledger = {"store_sha256": None, "files": {}, "months": {}, "replaced": []}
        if scope:
            ledger["outside_scope"] = scope
    columns = ", ".join(blanked(source, scope, c) for c in store_columns(source)[:-1])
    # Rows that differ only in a field not kept outside the scope become one row; the vehicles are summed.
    con.execute(f"CREATE TABLE incoming_rows AS SELECT {columns}, CAST(sum({STORE_COUNT}) AS INTEGER) AS {STORE_COUNT} "
                "FROM typed GROUP BY ALL")
    if have:
        held = [c for c, *_ in con.execute(f"DESCRIBE SELECT * FROM read_parquet({lit(registrations.as_posix())})").fetchall()]
        if held != store_columns(source):
            raise abort(f"the store's columns are {held}, but config/pipeline.json expects {store_columns(source)}. A file "
                        "with other columns replaces the whole history: remove both store files and supply the new history "
                        "in the same commit as the config change (docs/playbooks/supply-dashboard-month.md, Replacing the whole history).")
        con.execute(f"CREATE TABLE stored AS SELECT {', '.join(quote(c) for c in store_columns(source))} "
                    f"FROM read_parquet({lit(registrations.as_posix())})")
        problems = hash_problems(registrations, ledger) + store_problems(con, "stored", ledger)
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
        ledger["files"][digest] = {"source_file": csv_path.name, "taken": taken_on.isoformat(),
                                   "totals_checked": dict(sorted(checked.items())) if checked is not None else None}
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
        ledger["files"] = dict(sorted(ledger["files"].items()))
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
        commit_store(con, "merged", registrations, ledger_path, ledger, layout(source), source)
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
