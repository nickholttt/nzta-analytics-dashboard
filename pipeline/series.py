"""A source supplied as a published table of monthly series: `python -m pipeline supply <id> <csv>` for a source of kind
`series` (config/pipeline.json, `supplied`). Its first user is Stats NZ's table of motor vehicles registered by type.

The command checks one export of the table and adds its months to a local store: one Parquet file of the figures, one row
for each month and series that has a figure, and a ledger that says which file each month came from and what was checked
about it. It never fetches anything and the Action never runs it. The build reads the store (build.py) and checks it
against the ledger before it trusts it. Nothing in this file names a series, a column or a value: the table's title, its
columns and what each one means are in config/pipeline.json and in the reference file it names.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

import duckdb

from . import metrics, reference, supplied
from .normalise import lit
from .supplied import MONTH_KEY, STORE_MONTH, STORE_SERIES, STORE_VALUE, abort, month_key, span

INT32_MAX = 2**31 - 1
# How many individual problems a message spells out before it gives a count.
LISTED = 12


@dataclass
class Series:
    id: str
    header: str
    label: str
    role: str
    total_of: list[str]


@dataclass
class Table:
    """One checked export: the months it covers and a figure for each month and series that has one."""
    series: list[Series]
    months: list[date]
    cells: dict[tuple[date, str], int]
    last_updated: str
    table_reference: str
    arithmetic: dict
    warnings: list[str]


def catalogue(cfg, source: dict) -> list[Series]:
    """The table's columns, in the order the export has them, from the reference file. A file that contradicts itself
    aborts: a total with no parts, a total that names a series the file lacks, a role the config does not know."""
    c = source["catalogue"]
    rows = reference.read(cfg.reference(c["file"]))
    needed = [c[k] for k in ("header", "id", "label", "role", "total_of")]
    absent = [name for name in needed if rows and name not in rows[0]]
    if absent or not rows:
        raise abort(f"{c['file']} must have the columns {needed}; missing {absent or needed}")
    reference.require_unique([r[c["id"]] for r in rows], f"{c['file']} {c['id']}")
    reference.require_unique([r[c["header"]] for r in rows], f"{c['file']} {c['header']}")
    ids = {r[c["id"]] for r in rows}
    out, problems = [], []
    for r in rows:
        parts = reference.split(r[c["total_of"]], c["separator"])
        if r[c["role"]] not in c["roles"]:
            problems.append(f"{r[c['id']]}: role {r[c['role']]!r} is not one of {c['roles']}")
        if bool(parts) != (r[c["role"]] == c["total_role"]):
            problems.append(f"{r[c['id']]}: a total names the series it sums in {c['total_of']}, and nothing else does")
        unknown = [p for p in parts if p not in ids or p == r[c["id"]]]
        if unknown:
            problems.append(f"{r[c['id']]}: {c['total_of']} names {unknown}, which are not other series in the file")
        out.append(Series(r[c["id"]], r[c["header"]], r[c["label"]], r[c["role"]], parts))
    if problems:
        raise abort(f"{c['file']} contradicts itself: " + "; ".join(problems))
    return out


def month_from(text: str, fmt: str) -> date | None:
    try:
        return datetime.strptime(text, fmt).date().replace(day=1)
    except (TypeError, ValueError):
        return None


def listed(items: list[str], most: int = LISTED) -> str:
    return ", ".join(items[:most]) + (f" and {len(items) - most} more" if len(items) > most else "")


def read_table(cfg, source: dict, path: Path) -> Table:
    """Read one export and run every check on its content. Aborts, naming the cause and the fix, on the first kind of
    problem it finds in the title, the header, the months, the figures, the footer or the arithmetic."""
    series = catalogue(cfg, source)
    try:
        with path.open(encoding="utf-8-sig", newline="") as fh:
            lines = list(csv.reader(fh))
    except (UnicodeDecodeError, csv.Error) as exc:
        raise abort(f"{path.name} could not be read as a CSV of text: {exc}. Export the table as 'Comma delimited (.csv)'.") from exc
    width = 1 + len(series)
    title = source["title"]

    if not lines or not lines[0] or lines[0][0] != title:
        found = lines[0][0] if lines and lines[0] else None
        raise abort(f"the table's title is {found!r}, but config/pipeline.json expects {title!r}. This is a different table, "
                    f"or Stats NZ renamed it. Export {title!r}, or change `title` if the new name is the same table.")
    if len(lines) < 2:
        raise abort("the file has a title and no header line")
    headers = [s.header for s in series]
    given = lines[1][1:]
    if lines[1][:1] != [""] or given != headers:
        missing, extra = [h for h in headers if h not in given], [h for h in given if h not in headers]
        if not missing and not extra and len(given) == len(headers):
            what = "the same columns in a different order"
        else:
            what = "; ".join(x for x in (f"missing {missing}" if missing else "", f"not expected {extra}" if extra else "") if x) \
                or "a different number of columns"
        raise abort(f"the table's header is not the configured columns ({what}). Stats NZ changed the table: export the "
                    f"same {len(headers)} series, or update the header column of the reference file {source['catalogue']['file']}.")
    for number, label in ((1, "title"), (2, "header")):
        if len(lines[number - 1]) != width:
            raise abort(f"line {number}, the {label}, has {len(lines[number - 1])} fields, not {width}")

    pattern, fmt = re.compile(source["month"]["pattern"]), source["month"]["format"]
    months, cells = [], {}
    unreadable, repeated, unordered, bad_values = [], [], [], []
    index = 2
    while index < len(lines) and lines[index] and pattern.match(lines[index][0]):
        row, line = lines[index], index + 1
        index += 1
        if len(row) != width:
            raise abort(f"line {line} has {len(row)} fields, not {width}")
        month = month_from(row[0], fmt)
        if month is None:
            unreadable.append(f"{row[0]!r} (line {line})")
            continue
        if month in months:
            repeated.append(month_key(month))
        elif months and month < months[-1]:
            unordered.append(month_key(month))
        months.append(month)
        for s, text in zip(series, row[1:]):
            text = text.strip()
            if text == source["missing"]:
                continue
            if not (re.fullmatch(r"[0-9]+", text) and int(text) <= INT32_MAX):
                bad_values.append(f"{text!r} for {s.label} in {month_key(month)}")
            elif (month, s.id) not in cells:
                cells[(month, s.id)] = int(text)
    if not months and not unreadable:
        raise abort("the file has no month rows after the header")
    if unreadable:
        raise abort(f"{len(unreadable)} month(s) do not read as {fmt!r}: {listed(unreadable)}")
    if repeated:
        raise abort(f"the file lists {listed(repeated)} more than once. One export lists each month once.")
    if unordered:
        raise abort(f"months run oldest first, but {listed(unordered)} come after a later month")
    holes = supplied.gaps(months)
    if holes:
        raise abort(f"the file has no row for {listed(holes)}, between its first and last month. Export every month in the range.")
    if bad_values:
        raise abort(f"{len(bad_values)} figure(s) are not a whole number with no sign, comma or decimal point, or `{source['missing']}`"
                    f" for not available: {listed(bad_values)}. Re-export the file; do not edit it by hand.")

    inside = []
    for s in series:
        have = [m for m in months if (m, s.id) in cells]
        lost = [month_key(m) for m in months if have and m > have[0] and (m, s.id) not in cells]
        if lost:
            inside.append(f"{s.label} has no figure in {listed(lost)} after it starts in {month_key(have[0])}")
    if inside:
        raise abort("a series has a gap inside its range (`" + source["missing"] + "` is only for the months before a series "
                    "starts): " + "; ".join(inside) + ". Export the table again.")

    reference_found, updated = footer(lines[index:], source["footer"])
    if reference_found is None:
        raise abort(f"the file has no {source['footer']['table_reference']!r} line, so the table is unknown. "
                    "The export looks cut short: export it again.")
    if reference_found != source["table_reference"]:
        raise abort(f"the table reference is {reference_found!r}, but config/pipeline.json expects {source['table_reference']!r}. "
                    "This is another table: export the right one.")
    if not updated:
        raise abort(f"the file has no {source['footer']['last_updated']!r} line, so the vintage of the figures is unknown. "
                    "The export looks cut short: export it again.")

    arithmetic, warnings = check_arithmetic(source, series, months, cells)
    return Table(series, months, cells, updated, reference_found, arithmetic, warnings)


def footer(lines: list[list[str]], labels: dict) -> tuple[str | None, str | None]:
    """The line after each footer label, or None where the label is missing or nothing follows it."""
    found = {}
    for key in ("table_reference", "last_updated"):
        for position, row in enumerate(lines[:-1]):
            if len(row) == 1 and row[0].strip() == labels[key]:
                found[key] = lines[position + 1][0].strip() if lines[position + 1] else ""
                break
    return found.get("table_reference"), found.get("last_updated") or None


def differences(found: dict) -> list[str]:
    return [f"{month_key(m)} ({d:+,})" for m, d in sorted(found.items())]


def check_arithmetic(source: dict, series: list[Series], months: list[date], cells: dict) -> tuple[dict, list[str]]:
    """Each total against the sum of its parts, in every month that has all of them. From the configured month a
    disagreement aborts; before it, it is a warning (Stats NZ's earlier figures disagree by a few vehicles)."""
    from_month = month_from(source["arithmetic_from"], MONTH_KEY)
    if from_month is None:
        raise abort(f"arithmetic_from {source['arithmetic_from']!r} in config/pipeline.json is not YYYY-MM")
    labels = {s.id: s.label for s in series}
    facts, warnings, problems = {}, [], []
    for s in series:
        if not s.total_of:
            continue
        checked, differs = 0, {}
        for m in months:
            if (m, s.id) in cells and all((m, p) in cells for p in s.total_of):
                checked += 1
                difference = sum(cells[(m, p)] for p in s.total_of) - cells[(m, s.id)]
                if difference:
                    differs[m] = difference
        late = {m: d for m, d in differs.items() if m >= from_month}
        early = {m: d for m, d in differs.items() if m < from_month}
        if late:
            problems.append(f"{s.label} differs from the sum of {', '.join(labels[p] for p in s.total_of)} in "
                            f"{listed(differences(late))} (the parts minus the total)")
        if early:
            warnings.append(f"{s.label} differs from the sum of its parts in {len(early)} of {checked} month(s) before "
                            f"{month_key(from_month)}: {listed(differences(early))} (the parts minus the total)")
        facts[s.id] = {"months_checked": checked, "differs_before": {month_key(m): d for m, d in sorted(early.items())}}
    if problems:
        raise abort(f"a total no longer equals its parts from {month_key(from_month)}, where Stats NZ's figures agreed: "
                    + "; ".join(problems) + ". Part of the table may have been revised or cut short. Export it again; if "
                    "Stats NZ now publishes it this way, move arithmetic_from in config/pipeline.json after deciding what it means.")
    return facts, warnings


def read_store(con, cfg, source_id: str, source: dict) -> tuple[dict, dict]:
    """The ledger of an existing store (or a new one), with `stored` made a table of the store's rows."""
    registrations, ledger_path = supplied.store_paths(cfg, source_id)
    lay = supplied.layout(source)
    ledger = {"store_sha256": None, "files": {}, "months": {}, lay.replaced_key: []}
    con.execute("CREATE TABLE stored (month DATE, series_id VARCHAR, value INTEGER)")
    if registrations.exists() or ledger_path.exists():
        if not (registrations.exists() and ledger_path.exists()):
            raise abort("the store has one of its two files; restore the other or remove both and supply again")
        ledger = supplied.read_ledger(ledger_path)
        con.execute(f"INSERT INTO stored SELECT {STORE_MONTH}, {STORE_SERIES}, {STORE_VALUE} FROM read_parquet({lit(registrations.as_posix())})")
        problems = supplied.hash_problems(registrations, ledger) + supplied.store_problems(con, "stored", ledger, lay.count, lay.total_key)
        if problems:
            raise abort("the store disagrees with its ledger: " + "; ".join(problems))
    return ledger, {(m, sid): v for m, sid, v in con.execute("SELECT month, series_id, value FROM stored").fetchall()}


def supply(cfg, source_id: str, csv_path: Path, taken: str | None = None, accept_revisions: bool = False, echo=print) -> dict:
    """Check one export and add its months to the store. Writes nothing unless every check passes."""
    if source_id not in cfg.pipeline.get("supplied", {}):
        raise abort(f"{source_id!r} is not a supplied source in config/pipeline.json ({sorted(cfg.pipeline.get('supplied', {}))})")
    source = cfg.supplied(source_id)
    if source.get("kind") != supplied.SERIES:
        raise abort(f"{source_id!r} is not a source of kind {supplied.SERIES!r}")
    if not csv_path.is_file():
        raise abort(f"{csv_path.name} is not a file")
    table = read_table(cfg, source, csv_path)
    try:
        taken_on = date.fromisoformat(taken) if taken else date.fromtimestamp(csv_path.stat().st_mtime)
    except ValueError:
        raise abort(f"--taken {taken!r} is not YYYY-MM-DD") from None
    ends = metrics.month_add(table.months[-1], 1) - timedelta(days=1)
    if taken_on < ends:
        raise abort(f"--taken {taken_on} is before {month_key(table.months[-1])} ends ({ends}). Give the day the export was taken.")

    labels = {s.id: s.label for s in table.series}
    lay = supplied.layout(source)
    con = duckdb.connect()
    ledger, stored = read_store(con, cfg, source_id, source)
    con.execute("CREATE TABLE incoming_rows (month DATE, series_id VARCHAR, value INTEGER)")
    ordered = sorted(table.cells.items())
    # One statement of literals: DuckDB converts each Python value it is handed on its own, which takes a minute for the
    # full table's sixteen thousand figures.
    values = ", ".join(f"(DATE {lit(month_key(m) + '-01')}, {lit(sid)}, {v})" for (m, sid), v in ordered)
    con.execute(f"INSERT INTO incoming_rows VALUES {values}")

    stored_months = {m for m, _ in stored}
    incoming_months = set(table.months)
    added = sorted(incoming_months - stored_months)
    both = incoming_months & stored_months
    changed: dict[date, list[dict]] = {}
    for month, sid in sorted({k for k in {*stored, *table.cells} if k[0] in both}):
        old, new = stored.get((month, sid)), table.cells.get((month, sid))
        if old != new:
            changed.setdefault(month, []).append({"series_id": sid, "old": old, "new": new})
    revised = sorted(changed)
    unchanged = sorted(both - set(revised))
    if revised and not accept_revisions:
        cells = [f"{month_key(m)} {labels[c['series_id']]}: {fmt_figure(c['old'])} in the store, {fmt_figure(c['new'])} in the file"
                 for m in revised for c in changed[m]]
        raise abort(f"{len(cells)} figure(s) in {len(revised)} month(s) already in the store differ from this file:\n  - "
                    + "\n  - ".join(cells) + "\nStats NZ revises past months. If this file is right, run again with "
                    "--accept-revisions; the change is recorded in the ledger. If you did not expect it, keep the old data and ask.")
    wanted = sorted(stored_months | set(added))
    holes = supplied.gaps(wanted)
    if holes:
        raise abort(f"adding these months would leave the store with no rows for {listed(holes)}. Supply a file that "
                    "covers them, or the months between.")

    result = {"added": [month_key(m) for m in added], "unchanged": [month_key(m) for m in unchanged],
              "revised": [month_key(m) for m in revised], "warnings": list(table.warnings), "written": bool(added or revised)}
    registrations, ledger_path = supplied.store_paths(cfg, source_id)
    if result["written"]:
        digest = supplied.sha256_of(csv_path)
        ledger["files"][digest] = {
            "source_file": csv_path.name, "taken": taken_on.isoformat(), "last_updated": table.last_updated,
            "table_reference": table.table_reference,
            "months": {"first": month_key(table.months[0]), "last": month_key(table.months[-1]), "count": len(table.months)},
            "arithmetic": table.arithmetic,
        }
        per_month = {}
        for (m, _), v in table.cells.items():
            n, total = per_month.get(m, (0, 0))
            per_month[m] = (n + 1, total + v)
        for m in revised:
            old = ledger["months"][month_key(m)]
            ledger[lay.replaced_key].append({
                "month": month_key(m),
                "old": {"taken": old["taken"], "sha256": old["sha256"], "source_file": old["source_file"],
                        "last_updated": ledger["files"].get(old["sha256"], {}).get("last_updated")},
                "new": {"taken": taken_on.isoformat(), "sha256": digest, "source_file": csv_path.name,
                        "last_updated": table.last_updated},
                "cells": changed[m],
            })
        for m in added + revised:
            n, total = per_month[m]
            ledger["months"][month_key(m)] = {"source_file": csv_path.name, "sha256": digest, "taken": taken_on.isoformat(),
                                              "rows": n, lay.total_key: total}
        ledger["months"] = dict(sorted(ledger["months"].items()))
        ledger["files"] = dict(sorted(ledger["files"].items()))
        out = ", ".join(f"DATE {lit(month_key(m) + '-01')}" for m in revised)
        drop = f"WHERE {STORE_MONTH} NOT IN ({out})" if out else ""
        take = ", ".join(f"DATE {lit(month_key(m) + '-01')}" for m in added + revised)
        con.execute(f"""
            CREATE TABLE merged AS
            SELECT {STORE_MONTH}, {STORE_SERIES}, {STORE_VALUE} FROM (
                SELECT * FROM stored {drop}
                UNION ALL
                SELECT * FROM incoming_rows WHERE {STORE_MONTH} IN ({take})
            ) ORDER BY {STORE_MONTH}, {STORE_SERIES}""")
        supplied.commit_store(con, "merged", registrations, ledger_path, ledger, lay)
    table_name = "merged" if result["written"] else "stored"
    held_months, held_figures = con.execute(f"SELECT count(DISTINCT {STORE_MONTH}), count(*) FROM {table_name}").fetchone()
    first, last = con.execute(f"SELECT min({STORE_MONTH}), max({STORE_MONTH}) FROM {table_name}").fetchone()

    echo(f"Months added: {span(result['added'])}")
    echo(f"Months unchanged: {span(result['unchanged'])}")
    echo(f"Months revised: {span(result['revised'])}")
    echo(f"The export says it was last updated {table.last_updated}.")
    for warning in result["warnings"]:
        echo(f"WARNING: {warning}")
    echo(("The store now holds" if result["written"] else "Nothing to write. The store holds")
         + f" {held_months:,} months, {month_key(first)} to {month_key(last)}, and {held_figures:,} figures.")
    con.close()
    return result


def fmt_figure(value: int | None) -> str:
    return "no figure" if value is None else f"{value:,}"
