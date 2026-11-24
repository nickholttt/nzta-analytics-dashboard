"""Our figures beside the figures other organisations publish, checked in every build (docs/CUBE_SCHEMA.md,
`reconciliation.json`; D-149).

What is compared, and against whom, is data (design invariant 1): `published_figures.csv` has one row for each published
figure, with the question to put to our own files (a dataset and a set of dimension filters), and `published_sources.csv`
one row for each organisation. This module names no source, measure, dimension or value. Both files are read and checked at
the start of the build (`prepare`), before the register is read, so a row that cannot be answered stops the run early. The
step itself (`run`) answers each row from the files the build has just staged for publication, the fact table or a slice a
visitor's browser would read, not from an internal table, and writes `reconciliation.json` beside the manifest.

A row ends as one of:

- `pass`: ours is within the row's tolerance of theirs;
- `warn`: past the tolerance (one warning line for each source, not for each row);
- `fail`: one of the rows that make the build stop (below): past the hard bound, or a single figure of a kind the single-figure
  limit covers that is five percent or more (the number is config) from ours;
- `not_compared`, with a reason: our data does not hold that month, the dataset was not built in this run, a filter value is not one
  this build's files hold (the model dimension keeps only the largest models, so a value can drop out), or the answer rests on a
  cell the small-cell rule hides. A row that cannot be compared is said, never dropped and never counted as a pass.

The hard limit (numbers in config/pipeline.json, `reconciliation.hard_limit`). A row is past its hard bound when ours is further
from theirs than `max(tolerance_multiple x the row's tolerance, floor_pct)`. A source is judged for a month by vehicles, not rows:
a compared row weighs its published figure, and the source breaches on one side (ours below theirs, or above) when its rows past
the bound on that side hold at least `source_vehicle_share` of the weight of all its compared rows that month; rows on the other
side do not cancel it. The build stops when, in one month, at least `min_sources` independent sources breach on the same side and
they are more than half of the independent sources with any compared row that month. A source that restates its history, one
that cannot be read, a month we do not hold, or a month with compared rows from fewer than two independent sources, never stop it.

The single-figure limit (`reconciliation.single_figure_limit`, D-150) is added to that, and the hard limit is unchanged. A figure
has a `figure_kind` (an id; the code names none), and the config lists the kinds the limit covers. A compared row of a listed kind,
of an independent source, stops the build alone when ours is `gap_pct` percent or more from theirs (exactly that stops it), on
either side, however few other sources or rows there are. A row whose own tolerance is `gap_pct` or more is exempt, because the row
itself says ours cannot come that close; `parse_figures` refuses such a row of a listed kind unless it states why in
`known_difference`.

A source can restate a figure it published earlier (D-153). The row then holds the new figure in `figure` and the old one in
`restated_from`, and `reconciliation.restatement_warn_pct` says how large a restatement is worth a warning (inclusive, as a share
of the earlier figure). A restatement that size or larger makes the build print a warning and the row never better than `warn`;
it does not stop the build. On such a row the single-figure limit stops the build only when ours is `gap_pct` or more from both
the current figure and the earlier one: a build never reads a source's page, so a restatement is known only from the file, and a
row whose ours still sits at the earlier figure is a source restating, not our data wrong. The hard limit judges the current figure
alone, as before. A gap between a source's figure and ours stops the build as it always did.
"""

from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from datetime import date
from fractions import Fraction
from decimal import Decimal
from pathlib import Path
from typing import NamedTuple

from . import derive, privacy
from .contract import FACT_COUNT, FACT_MONTH, FACTS_DIR, NOT_BROKEN_DOWN
from .errors import GuardrailError
from .normalise import lit
from .reference import quote

CUBE_DIR = "cube"

FIGURE_COLUMNS = ["source", "source_url", "date_read", "month", "measure_as_published", "figure", "dataset", "filters",
                  "tolerance_pct", "known_difference", "added_up_from", "figure_kind", "restated_from"]
SOURCE_COLUMNS = ["id", "name", "home_url", "independent", "definition", "definition_date_read", "data_basis"]

PASS, WARN, FAIL, NOT_COMPARED = "pass", "warn", "fail", "not_compared"
STATUSES = (PASS, WARN, FAIL, NOT_COMPARED)

# Why a row was not compared: a code the site can group by, and a sentence for a reader.
MONTH_NOT_HELD, DATASET_NOT_BUILT, HIDDEN_CELL, NO_TABLE = "month_not_held", "dataset_not_built", "hidden_cell", "no_published_table"
VALUE_NOT_HELD = "value_not_held"

ID = re.compile(r"[a-z][a-z0-9_]*")
MONTH = re.compile(r"[0-9]{4}-(0[1-9]|1[0-2])")
DAY = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
WHOLE = re.compile(r"[0-9]+")
DECIMAL = re.compile(r"[0-9]+(\.[0-9]+)?")
WORDS = re.compile(r"[a-z]+( [a-z]+)*")
TRUE, FALSE = "true", "false"

Filters = tuple[tuple[str, tuple[str, ...]], ...]


class Figure(NamedTuple):
    line: int
    source: str
    source_url: str
    date_read: str
    month: str
    measure: str
    figure: int
    dataset: str
    filters: Filters
    tolerance: Decimal
    known_difference: str
    added_up_from: str
    figure_kind: str
    restated_from: int | None

    @property
    def label(self) -> str:
        return f"line {self.line} ({self.source}, {self.month}, {self.measure!r})"

    @property
    def key(self) -> tuple:
        return (self.source, self.month, self.measure, self.filters)


class Source(NamedTuple):
    id: str
    name: str
    home_url: str
    independent: bool
    definition: str
    definition_date_read: str
    data_basis: str


class Prepared(NamedTuple):
    figures: tuple[Figure, ...]
    sources: dict[str, Source]


class Result(NamedTuple):
    """The document written as reconciliation.json, the manifest's entry for it, and what the build adds to its warnings
    and its aborts."""
    document: dict
    entry: dict
    warnings: list[str]
    aborts: list[str]


class Unanswerable(Exception):
    """A row that the files about to be published cannot answer: the build aborts, and the message names why."""


# --- reading and checking the two files ------------------------------------------------------------------------------------

def read_table(path: Path, columns: list[str]) -> tuple[list[tuple[int, list[str]]], list[str]]:
    """The rows of a reference file with their line numbers, and the problems with its header and row widths. A header that is
    not exactly the columns, in order, leaves no rows: nothing below it can be trusted."""
    if not path.exists():
        raise GuardrailError("reference", f"{path.name} is missing")
    rows, problems = [], []
    try:
        # utf-8-sig: a spreadsheet saves a CSV with a byte-order mark, which is not part of the first column's name.
        with path.open(encoding="utf-8-sig", newline="") as fh:
            reader = csv.reader(fh)
            header = next(reader, None)
            if header != columns:
                if header is None:
                    return [], [f"{path.name} is empty: its first line must be the header {','.join(columns)}"]
                return [], [f"{path.name}: the header must be exactly {','.join(columns)}"]
            for row in reader:
                if not row:
                    continue
                if len(row) != len(columns):
                    problems.append(f"{path.name} line {reader.line_num}: {len(row)} cells, but the header has {len(columns)}")
                else:
                    rows.append((reader.line_num, row))
    except UnicodeDecodeError as exc:
        return [], [f"{path.name} is not UTF-8 text ({exc.reason} at byte {exc.start}); save it as CSV UTF-8"]
    except csv.Error as exc:
        return [], [f"{path.name} cannot be read as CSV: {exc}"]
    return rows, problems


def settings(cfg) -> tuple[dict, list[str]]:
    """The configuration of the step, with what is wrong with it. Read before anything else, since the numbers decide what a
    row may say."""
    c, problems = cfg.pipeline.get("reconciliation"), []
    if not isinstance(c, dict):
        return {}, ["config/pipeline.json has no reconciliation block"]
    h = c.get("hard_limit") if isinstance(c.get("hard_limit"), dict) else {}
    for key in ("figures_file", "sources_file", "output_file"):
        if not isinstance(c.get(key), str) or not c[key]:
            problems.append(f"reconciliation.{key} must be a file name")
    for key, low in (("max_tolerance_pct", 0), ("pct_decimals", 0)):
        if isinstance(c.get(key), bool) or not isinstance(c.get(key), (int, float)) or c[key] < low:
            problems.append(f"reconciliation.{key} must be a number of at least {low}")
    for key, low in (("tolerance_multiple", 1), ("floor_pct", 0)):
        if isinstance(h.get(key), bool) or not isinstance(h.get(key), (int, float)) or h[key] < low:
            problems.append(f"reconciliation.hard_limit.{key} must be a number of at least {low}")
    if isinstance(h.get("min_sources"), bool) or not isinstance(h.get("min_sources"), int) or h["min_sources"] < 2:
        problems.append("reconciliation.hard_limit.min_sources must be a whole number of at least 2: one source is never enough")
    share = h.get("source_vehicle_share")
    if isinstance(share, bool) or not isinstance(share, (int, float)) or not 0 < share <= 1:
        problems.append("reconciliation.hard_limit.source_vehicle_share must be above 0 and at most 1")
    def ids(value) -> bool:
        return isinstance(value, list) and all(isinstance(k, str) and ID.fullmatch(k) for k in value) and len(set(value)) == len(value)

    known = c.get("figure_kinds")
    if not ids(known) or not known:
        problems.append("reconciliation.figure_kinds must be a list of distinct ids (lower case letters, digits and underscores, "
                        "starting with a letter): every kind a row of figures_file may state")
    warn = c.get("restatement_warn_pct")
    if isinstance(warn, bool) or not isinstance(warn, (int, float)) or not 0 < warn <= 100:
        problems.append("reconciliation.restatement_warn_pct must be a number above 0 and at most 100: the size, as a percentage of the "
                        "figure a source published earlier, from which a restatement of it is warned about")
    s = c.get("single_figure_limit")
    if not isinstance(s, dict):
        problems.append("reconciliation.single_figure_limit must be an object with gap_pct and kinds")
    else:
        gap = s.get("gap_pct")
        # The range also refuses what is not finite, and a whole number too long for a float, without converting it.
        if isinstance(gap, bool) or not isinstance(gap, (int, float)) or not 0 < gap <= 100:
            problems.append("reconciliation.single_figure_limit.gap_pct must be a number above 0 and at most 100")
        kinds = s.get("kinds")
        if not ids(kinds):
            problems.append("reconciliation.single_figure_limit.kinds must be a list of distinct ids (lower case letters, digits and "
                            "underscores, starting with a letter); an empty list switches the rule off")
        elif ids(known) and set(kinds) - set(known):
            problems.append(f"reconciliation.single_figure_limit.kinds names {sorted(set(kinds) - set(known))}, which "
                            "reconciliation.figure_kinds does not list: a kind no row may state would cover nothing")
    return c, problems


def reject_repeated_keys(pairs):
    keys = [k for k, _ in pairs]
    repeated = sorted({k for k in keys if keys.count(k) > 1})
    if repeated:
        raise ValueError(f"names {repeated} more than once")
    return dict(pairs)


def parse_filters(text: str) -> tuple[Filters, str | None]:
    """The filters cell: blank for none, otherwise one JSON object of dimension id to a list of the values wanted. Returned in
    one canonical order (dimensions sorted, each one's values sorted), so that two spellings of one question are equal."""
    if not text.strip():
        return (), None
    try:
        parsed = json.loads(text, object_pairs_hook=reject_repeated_keys)
    except ValueError as exc:
        return (), f"filters is not a JSON object ({exc}); write {{\"dimension\": [\"value\", ...]}}, or leave the cell blank for no filter"
    if not isinstance(parsed, dict):
        return (), "filters must be a JSON object of dimension to a list of values, or blank for no filter"
    if not parsed:
        return (), "filters is {}: leave the cell blank for no filter"
    out = []
    for dimension, values in parsed.items():
        if not dimension.strip():
            return (), "filters names a dimension with an empty name"
        if (not isinstance(values, list) or not values or not all(isinstance(v, str) and v.strip() for v in values)
                or len(set(values)) != len(values)):
            return (), f"filters: {dimension} must be a list of distinct, non-empty values, written as the published files hold them"
        out.append((dimension, tuple(sorted(values))))
    return tuple(sorted(out)), None


def parse_sources(cfg, c: dict) -> tuple[dict[str, Source], list[str]]:
    rows, problems = read_table(cfg.reference(c["sources_file"]), SOURCE_COLUMNS)
    sources: dict[str, Source] = {}
    for line, cells in rows:
        row = dict(zip(SOURCE_COLUMNS, (x.strip() for x in cells)))
        where = f"{c['sources_file']} line {line} ({row['id'] or 'no id'})"
        bad = []
        if not ID.fullmatch(row["id"]):
            bad.append("id must be lower case letters, digits and underscores, starting with a letter")
        elif row["id"] in sources:
            bad.append("id is listed twice")
        if not row["name"]:
            bad.append("name is empty")
        if not row["home_url"].startswith("https://") or " " in row["home_url"]:
            bad.append("home_url must be an https:// address")
        if row["independent"] not in (TRUE, FALSE):
            bad.append(f"independent must be {TRUE} or {FALSE}")
        if bool(row["definition"]) != bool(row["definition_date_read"]):
            bad.append("definition and definition_date_read must both be set, or both blank")
        if row["definition_date_read"]:
            try:
                if not DAY.fullmatch(row["definition_date_read"]):
                    raise ValueError
                date.fromisoformat(row["definition_date_read"])
            except ValueError:
                bad.append("definition_date_read must be a date, YYYY-MM-DD")
        problems += [f"{where}: {b}" for b in bad]
        if not bad:
            sources[row["id"]] = Source(row["id"], row["name"], row["home_url"], row["independent"] == TRUE, row["definition"],
                                        row["definition_date_read"], row["data_basis"])
    return sources, problems


def parse_figures(cfg, c: dict, sources: dict[str, Source]) -> tuple[list[Figure], list[str]]:
    rows, problems = read_table(cfg.reference(c["figures_file"]), FIGURE_COLUMNS)
    datasets = cfg.pipeline["datasets"]
    derivable: dict[str, set[str]] = {}
    figures: list[Figure] = []
    seen: dict[tuple, int] = {}
    maximum = Decimal(str(c["max_tolerance_pct"]))
    limit, kinds = Decimal(str(c["single_figure_limit"]["gap_pct"])), set(c["single_figure_limit"]["kinds"])
    known = set(c["figure_kinds"])
    for line, cells in rows:
        row = dict(zip(FIGURE_COLUMNS, (x.strip() for x in cells)))
        where = f"{c['figures_file']} line {line} ({row['source'] or 'no source'}, {row['month'] or 'no month'}, {row['measure_as_published']!r})"
        bad = []
        if row["source"] not in sources:
            bad.append(f"source {row['source']!r} is not an id in {c['sources_file']}")
        if not row["source_url"].startswith("https://") or " " in row["source_url"]:
            bad.append("source_url must be an https:// address")
        try:
            if not DAY.fullmatch(row["date_read"]):
                raise ValueError
            date.fromisoformat(row["date_read"])
        except ValueError:
            bad.append("date_read must be a date, YYYY-MM-DD")
        if not MONTH.fullmatch(row["month"]):
            bad.append("month must be YYYY-MM")
        if not row["measure_as_published"]:
            bad.append("measure_as_published is empty")
        figure = None
        if not WHOLE.fullmatch(row["figure"]):
            bad.append("figure must be a whole number, with no separators or units")
        elif int(row["figure"]) == 0:
            bad.append("figure is 0, which a gap cannot be shown against as a percentage; leave the figure out")
        else:
            figure = int(row["figure"])
        restated = None
        if row["restated_from"]:
            if not WHOLE.fullmatch(row["restated_from"]) or int(row["restated_from"]) == 0:
                bad.append("restated_from must be blank, or a positive whole number: the figure the same source published earlier for "
                           "this month and measure, with no separators or units")
            elif figure is not None and int(row["restated_from"]) == figure:
                bad.append("restated_from is the same as figure: a figure the source has not changed is not a restatement, so leave it blank")
            else:
                restated = int(row["restated_from"])
        tolerance = None
        if not DECIMAL.fullmatch(row["tolerance_pct"]):
            bad.append("tolerance_pct must be a number, as a percentage of the published figure")
        elif Decimal(row["tolerance_pct"]) > maximum:
            bad.append(f"tolerance_pct {row['tolerance_pct']} is above reconciliation.max_tolerance_pct ({c['max_tolerance_pct']})")
        else:
            tolerance = Decimal(row["tolerance_pct"])
        filters, filters_problem = parse_filters(row["filters"])
        if filters_problem:
            bad.append(filters_problem)
        dataset = row["dataset"]
        if dataset not in datasets:
            bad.append(f"dataset {dataset!r} is not a dataset of config/pipeline.json")
        else:
            if dataset not in derivable:
                try:
                    derivable[dataset] = {d["id"] for d in derive.applicable(cfg, dataset)[0]}
                except (privacy.DataMapError, OSError, KeyError) as exc:
                    raise GuardrailError("data map", f"config/data_map.json cannot be used to protect owner fields: {exc!r}") from exc
            unknown = [d for d, _ in filters if d not in derivable[dataset]]
            if unknown:
                bad.append(f"{dataset} cannot be filtered by {', '.join(unknown)}: not a dimension it can derive "
                           f"(config/dimensions.json, and its dimensions in config/pipeline.json)")
            elif len(filters) > 1 and not {d for d, _ in filters} <= set(datasets[dataset].get("facts") or []):
                held = set(datasets[dataset].get("facts") or [])
                why = (f"its fact table (facts in config/pipeline.json) lacks {', '.join(d for d, _ in filters if d not in held)}"
                       if held else "it has no fact table")
                bad.append(f"{dataset} has no published table holding {', '.join(d for d, _ in filters)} together: {why}, and a slice "
                           "holds one dimension only")
        if not ID.fullmatch(row["figure_kind"]):
            bad.append("figure_kind must be lower case letters, digits and underscores, starting with a letter")
        elif row["figure_kind"] not in known:
            # A kind nobody listed would fall out of the single-figure limit without a word: a misspelling must stop the build.
            bad.append(f"figure_kind {row['figure_kind']!r} is not one of reconciliation.figure_kinds ({', '.join(sorted(known))})")
        elif tolerance is not None and not row["known_difference"] and published(tolerance) >= limit and row["figure_kind"] in kinds:
            bad.append(f"figure_kind {row['figure_kind']!r} is covered by reconciliation.single_figure_limit and tolerance_pct "
                       f"{row['tolerance_pct']} is {c['single_figure_limit']['gap_pct']} or more, which exempts the row from it: "
                       "known_difference must say why ours cannot come that close")
        if row["added_up_from"] and not WORDS.fullmatch(row["added_up_from"]):
            bad.append("added_up_from must be blank, or lower case words saying what of the source's the figure was added up from")
        problems += [f"{where}: {b}" for b in bad]
        if bad:
            continue
        figure_row = Figure(line, row["source"], row["source_url"], row["date_read"], row["month"], row["measure_as_published"],
                            figure, dataset, filters, tolerance, row["known_difference"], row["added_up_from"],
                            row["figure_kind"], restated)
        if figure_row.key in seen:
            problems.append(f"{where}: the same source, month, measure and filters as line {seen[figure_row.key]}")
            continue
        seen[figure_row.key] = line
        figures.append(figure_row)
    return figures, problems


def prepare(cfg) -> tuple[Prepared, list[str]]:
    """Both files, read and checked against the configuration and the datasets, and everything wrong with them, each problem
    naming its file and line. Called before the register is read."""
    c, problems = settings(cfg)
    if problems and not c:
        return Prepared((), {}), problems
    sources, more = parse_sources(cfg, c) if not problems else ({}, [])
    figures, extra = parse_figures(cfg, c, sources) if not problems else ([], [])
    return Prepared(tuple(figures), sources), problems + more + extra


# --- answering the rows from the staged files ------------------------------------------------------------------------------

class Answer(NamedTuple):
    ours: int | None
    kind: str | None = None
    reason: str | None = None


def sql_list(values) -> str:
    return ", ".join(lit(v) for v in values)


class Staged:
    """The files this build is about to publish, read back through DuckDB: the fact table of a dataset (its columns are one
    file each, joined on their position in the file) and a dimension's one-field slice. Each is loaded once into a temporary
    table, and dropped by `close`."""

    def __init__(self, con, datasets: dict, staging: Path):
        self.con, self.datasets, self.staging = con, datasets, staging
        self.tables: dict[tuple, str] = {}
        self.values: dict[tuple, set[str]] = {}

    def close(self) -> None:
        for name in self.tables.values():
            self.con.execute(f"DROP TABLE IF EXISTS {name}")

    def route(self, fig: Figure) -> tuple:
        """How a figure is answered: from the fact table, from one dimension's slice, or from a slice's month total; or why it
        cannot be (Unanswerable). Decided from the manifest entry the build has made for the dataset."""
        entry = self.datasets[fig.dataset]
        dims = [d for d, _ in fig.filters]
        not_live = [d for d in dims if d not in entry.get("live_dimensions", [])]
        if not_live:
            raise Unanswerable(f"{', '.join(not_live)} is not a live dimension of {fig.dataset} in this build, so it publishes no file to answer from")
        facts = entry.get("facts")
        if facts and set(dims) <= set(facts["dimensions"]):
            return ("facts", tuple(dims))
        if len(dims) == 1:
            return ("slice", dims[0])
        if not dims:
            return ("total",)
        raise Unanswerable(f"{', '.join(dims)} cannot be crossed: {fig.dataset} has no published table holding all of them")

    def load_facts(self, dataset: str, dims: set[str]) -> str:
        key = ("facts", dataset, tuple(sorted(dims)))
        if key in self.tables:
            return self.tables[key]
        directory = self.staging / FACTS_DIR / dataset
        columns = [FACT_MONTH[0], FACT_COUNT[0], *sorted(dims)]
        missing = [c for c in columns if not (directory / f"{c}.parquet").exists()]
        if missing:
            raise Unanswerable(f"the staged fact table of {dataset} has no file for {', '.join(missing)}")
        name = f"reconciliation_facts_{len(self.tables)}"
        parts = " ".join(
            f"{'JOIN' if i else 'FROM'} (SELECT file_row_number AS r, {quote(c)} AS c{i} FROM read_parquet("
            f"{lit((directory / f'{c}.parquet').as_posix())}, file_row_number = true)) t{i} {'USING (r)' if i else ''}"
            for i, c in enumerate(columns))
        selected = ", ".join(f"t{i}.c{i} AS {quote(c)}" for i, c in enumerate(columns))
        self.con.execute(f"CREATE TEMP TABLE {name} AS SELECT {selected} {parts}")
        rows = self.con.execute(f"SELECT count(*) FROM {name}").fetchone()[0]
        expected = self.datasets[dataset]["facts"]["rows"]
        if rows != expected:
            self.con.execute(f"DROP TABLE {name}")
            raise Unanswerable(f"the staged fact table of {dataset} reads back as {rows:,} rows, but the manifest says {expected:,}")
        self.tables[key] = name
        return name

    def load_slice(self, dataset: str, dim: str) -> str:
        key = ("slice", dataset, dim)
        if key in self.tables:
            return self.tables[key]
        path = self.staging / CUBE_DIR / dataset / f"{dim}.parquet"
        if not path.exists():
            raise Unanswerable(f"the staged slice of {dataset} by {dim} is not in the staged files")
        name = f"reconciliation_slice_{len(self.tables)}"
        self.con.execute(f"CREATE TEMP TABLE {name} AS SELECT month, dim_value, n, denominator FROM read_parquet({lit(path.as_posix())})")
        self.tables[key] = name
        return name

    def known_values(self, table: str, column: str) -> set[str]:
        key = (table, column)
        if key not in self.values:
            self.values[key] = {r[0] for r in self.con.execute(f"SELECT DISTINCT {quote(column)} FROM {table}").fetchall()}
        return self.values[key]

    def missing_values(self, fig: Figure, table: str, column_of) -> Answer | None:
        """None when every value a row names is a value of its dimension in this build's published files. Otherwise the answer
        that says it is not compared, naming the dimension and the values: which values a build holds depends on the month (the
        model dimension keeps only the largest models of the trailing year), so a row about a value that has dropped out is said,
        not answered with zero and not allowed to stop the build."""
        for dimension, wanted in fig.filters:
            held = self.known_values(table, column_of(dimension)) - {NOT_BROKEN_DOWN}
            unknown = [v for v in wanted if v not in held]
            if unknown:
                names = ", ".join(repr(v) for v in unknown)
                return Answer(None, VALUE_NOT_HELD, f"{dimension} has no value {names} in the published files of {fig.dataset} in this build, "
                                                    "so it is not compared.")
        return None

    def held(self, fig: Figure, table: str) -> Answer | None:
        """None when the table holds the row's month, otherwise the answer that says it does not."""
        first, last = self.con.execute(f"SELECT min(month), max(month) FROM {table}").fetchone()
        year, month = (int(x) for x in fig.month.split("-"))
        wanted = date(year, month, 1)
        if first is None or not first <= wanted <= last:
            span = "no months" if first is None else f"{first:%Y-%m} to {last:%Y-%m}"
            return Answer(None, MONTH_NOT_HELD, f"Our {fig.dataset} data holds {span} in this build, so {fig.month} is outside it and is not compared.")
        return None

    def empty_month(self, fig: Figure) -> Answer:
        """The answer for a month inside the table's range in which the table has no row at all."""
        return Answer(None, MONTH_NOT_HELD, f"Our {fig.dataset} data has no vehicles in {fig.month} in this build, so it is not compared.")

    def answer(self, fig: Figure, route: tuple) -> Answer:
        year, month = (int(x) for x in fig.month.split("-"))
        wanted = date(year, month, 1)
        if route[0] == "facts":
            table = self.load_facts(fig.dataset, set(route[1]))
            missing = self.missing_values(fig, table, lambda d: d) or self.held(fig, table)
            if missing:
                return missing
            clauses = [f"{quote(dimension)} IN ({sql_list(wanted_values)})" for dimension, wanted_values in fig.filters] or ["TRUE"]
            rows, total = self.con.execute(
                f"SELECT count(*), coalesce(sum(n) FILTER (WHERE {' AND '.join(clauses)}), 0) FROM {table} WHERE month = ?", [wanted]).fetchone()
            return Answer(int(total)) if rows else self.empty_month(fig)
        if route[0] == "slice":
            table = self.load_slice(fig.dataset, route[1])
            missing = self.missing_values(fig, table, lambda d: "dim_value") or self.held(fig, table)
            if missing:
                return missing
            cells = dict(self.con.execute(f"SELECT dim_value, n FROM {table} WHERE month = ?", [wanted]).fetchall())
            if not cells:
                return self.empty_month(fig)
            wanted_values = fig.filters[0][1]
            if NOT_BROKEN_DOWN in cells or any(v in cells and cells[v] is None for v in wanted_values):
                return Answer(None, HIDDEN_CELL, "The answer rests on a small count that the published slice hides, so it is not compared.")
            return Answer(sum(int(cells.get(v) or 0) for v in wanted_values))
        # No filter and no fact table: the month's total, which every slice of the dataset repeats as its denominator.
        live = sorted(self.datasets[fig.dataset].get("live_dimensions", []))
        if not live:
            return Answer(None, NO_TABLE, f"{fig.dataset} published no table in this build, so there is no total to compare.")
        table = self.load_slice(fig.dataset, live[0])
        missing = self.held(fig, table)
        if missing:
            return missing
        total = self.con.execute(f"SELECT any_value(denominator) FROM {table} WHERE month = ?", [wanted]).fetchone()[0]
        return self.empty_month(fig) if total is None else Answer(int(total))


# --- judging the answers ---------------------------------------------------------------------------------------------------

def percent(gap: int, theirs: int, decimals: int) -> float:
    return float((Decimal(gap) * 100 / Decimal(theirs)).quantize(Decimal(1).scaleb(-decimals)))


def published(tolerance: Decimal) -> Decimal:
    """A row's tolerance as reconciliation.json states it (a float), which is the number the single-figure limit reads: the check
    made when the file is read and the rule itself must not disagree about a tolerance with more digits than a float holds."""
    return Decimal(str(float(tolerance)))


def outside(gap: int, theirs: int, pct: Decimal) -> bool:
    """Whether a gap is further than `pct` percent of the published figure. Exact: a gap of exactly the tolerance is inside."""
    return Decimal(abs(gap)) * 100 > pct * theirs


def span(months: list[str]) -> str:
    return months[0] if months[0] == months[-1] else f"{months[0]} to {months[-1]}"


def run(con, cfg, prepared: Prepared, datasets: dict, staging: Path, latest_snapshot: str) -> Result:
    """Answer every row from the staged files, judge it, apply the hard limit, and return the document, the manifest's entry,
    the warnings and the aborts. Reads only what is in `staging`; writes nothing there (the caller writes the document)."""
    c, _ = settings(cfg)
    h = c["hard_limit"]
    decimals = int(c["pct_decimals"])
    multiple, floor = Decimal(str(h["tolerance_multiple"])), Decimal(str(h["floor_pct"]))
    aborts: list[str] = []
    staged = Staged(con, datasets, staging)
    judged: list[dict] = []
    try:
        plans: list[tuple[Figure, tuple | None]] = []
        for fig in prepared.figures:
            entry = datasets.get(fig.dataset)
            if entry is None or "not_built" in entry:
                plans.append((fig, None))
                continue
            try:
                plans.append((fig, staged.route(fig)))
            except Unanswerable as exc:
                aborts.append(f"reconciliation: {c['figures_file']} {fig.label}: {exc}")
        # A dataset's fact table is read once, with every column its rows need.
        needed: dict[str, set[str]] = defaultdict(set)
        for fig, route in plans:
            if route and route[0] == "facts":
                needed[fig.dataset].update(route[1])
        for fig, route in plans:
            if route is None:
                answer = Answer(None, DATASET_NOT_BUILT, f"{fig.dataset} was not built in this run.")
            else:
                if route[0] == "facts":
                    route = ("facts", tuple(sorted(needed[fig.dataset])))
                try:
                    answer = staged.answer(fig, route)
                except Unanswerable as exc:
                    aborts.append(f"reconciliation: {c['figures_file']} {fig.label}: {exc}")
                    continue
            judged.append(judge(fig, answer, multiple, floor, decimals))
    finally:
        staged.close()
    return finish(prepared, judged, c, aborts, latest_snapshot)


def judge(fig: Figure, answer: Answer, multiple: Decimal, floor: Decimal, decimals: int) -> dict:
    bound = max(multiple * fig.tolerance, floor)
    row = {
        "source": fig.source,
        "month": fig.month,
        "measure_as_published": fig.measure,
        "dataset": fig.dataset,
        "filters": {d: list(v) for d, v in fig.filters},
        "ours": answer.ours,
        "theirs": fig.figure,
        "gap": None,
        "gap_pct": None,
        "tolerance_pct": float(fig.tolerance),
        "hard_bound_pct": float(bound),
        "known_difference": fig.known_difference or None,
        "added_up_from": fig.added_up_from or None,
        "figure_kind": fig.figure_kind,
        # Filled in by single_figure_limit: the limit as a number when the rule applies to this row, otherwise null.
        "stops_alone_pct": None,
        "restated_from": fig.restated_from,
        "restated_pct": percent(fig.figure - fig.restated_from, fig.restated_from, decimals) if fig.restated_from else None,
        # Filled in by finish: whether the restatement is the size config says to warn about.
        "restated_past_warning": False,
        "status": NOT_COMPARED,
        "reason_kind": answer.kind,
        "reason": answer.reason,
        "source_url": fig.source_url,
        "date_read": fig.date_read,
    }
    if answer.ours is not None:
        gap = answer.ours - fig.figure
        row["gap"], row["gap_pct"] = gap, percent(gap, fig.figure, decimals)
        row["status"] = WARN if outside(gap, fig.figure, fig.tolerance) else PASS
        # Kept for the hard limit and not published: whether the gap is past the hard bound.
        row["_hard"] = outside(gap, fig.figure, bound)
    return row


def finish(prepared: Prepared, judged: list[dict], c: dict, aborts: list[str], latest_snapshot: str) -> Result:
    h = c["hard_limit"]
    sources = prepared.sources
    warn = Decimal(str(c["restatement_warn_pct"]))
    for r in judged:
        r["restated_past_warning"] = restated_past_warning(r, warn)
    warnings = hard_limit(sources, judged, c, aborts)
    single_figure_limit(sources, judged, c, aborts)
    warnings += restatement_warnings(sources, judged, c)
    for source in sources.values():
        unheld = sorted(r["month"] for r in judged if r["source"] == source.id and r["reason_kind"] == VALUE_NOT_HELD)
        if unheld:
            one = len(unheld) == 1
            warnings.append(f"reconciliation: {source.name}: {len(unheld)} {'figure names' if one else 'figures name'} a value the published "
                            f"files do not hold, in {span(unheld)}, so {'it was' if one else 'they were'} not compared")
    warnings += renamed_label_warnings(sources, judged)
    for row in judged:
        row.pop("_hard", None)
        row.pop("_excused", None)
    judged.sort(key=lambda r: (r["month"], r["source"], r["measure_as_published"], json.dumps(r["filters"], sort_keys=True)))

    by_status = {s: sum(1 for r in judged if r["status"] == s) for s in STATUSES}
    by_source = {i: {"rows": 0, **{s: 0 for s in STATUSES}} for i in sources}
    for r in judged:
        by_source[r["source"]]["rows"] += 1
        by_source[r["source"]][r["status"]] += 1
    months = sorted({r["month"] for r in judged})
    span_of = {"first": months[0] if months else None, "last": months[-1] if months else None}
    if judged and not by_status[PASS] + by_status[WARN] + by_status[FAIL]:
        reasons = sorted({r["reason_kind"] for r in judged})
        warnings.append(f"reconciliation: none of the {len(judged)} published figures could be compared ({', '.join(reasons)}), "
                        "so nothing was checked against them")

    document = {
        "latest_snapshot": latest_snapshot,
        "sources": {s.id: {"name": s.name, "home_url": s.home_url, "independent": s.independent,
                           "definition": s.definition or None, "definition_date_read": s.definition_date_read or None,
                           "data_basis": s.data_basis or None}
                    for s in sources.values()},
        "summary": {
            "rows": len(judged),
            "by_status": by_status,
            "by_source": by_source,
            "months": span_of,
            "thresholds": {
                "max_tolerance_pct": c["max_tolerance_pct"],
                "hard_limit_tolerance_multiple": h["tolerance_multiple"],
                "hard_limit_floor_pct": h["floor_pct"],
                "hard_limit_min_sources": h["min_sources"],
                "hard_limit_source_vehicle_share": h["source_vehicle_share"],
                "single_figure_gap_pct": c["single_figure_limit"]["gap_pct"],
                "single_figure_kinds": list(c["single_figure_limit"]["kinds"]),
                "restatement_warn_pct": c["restatement_warn_pct"],
            },
        },
        "rows": judged,
    }
    entry = {"file": c["output_file"], "rows": len(judged), "by_status": by_status, "months": span_of}
    return Result(document, entry, warnings, aborts)


def renamed_label_warnings(sources: dict[str, Source], judged: list[dict]) -> list[str]:
    """One line for each source all of whose rows name a value the published files do not hold, and one when more than half of
    all the rows do: a label in a reference file (a renamed status or vehicle type) turns every row that names it into
    value_not_held, which is a warning and not an abort, so it must not pass as the ordinary drift of a capped dimension."""
    lines = []
    for source in sources.values():
        mine = [r for r in judged if r["source"] == source.id]
        if mine and all(r["reason_kind"] == VALUE_NOT_HELD for r in mine):
            lines.append(f"reconciliation: every one of the {len(mine)} figures of {source.name} names a value the published files do not "
                         "hold: a label in a reference file may have been renamed, so nothing of this source was checked")
    held = sum(1 for r in judged if r["reason_kind"] == VALUE_NOT_HELD)
    if judged and 2 * held > len(judged):
        lines.append(f"reconciliation: {held} of the {len(judged)} published figures name a value the published files do not hold: a label "
                     "in a reference file may have been renamed, so most of the figures were not checked")
    return lines


def hard_limit(sources: dict[str, Source], judged: list[dict], c: dict, aborts: list[str]) -> list[str]:
    """Marks the rows that stop the build `fail`, adds the abort for each month and side that does, and returns the warning line
    for each source with rows past their tolerance. The rule is in the module's docstring; its numbers are config."""
    h = c["hard_limit"]
    share = Fraction(str(h["source_vehicle_share"]))
    groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    compared: dict[str, set[str]] = defaultdict(set)
    for r in judged:
        if r["status"] != NOT_COMPARED and sources[r["source"]].independent:
            groups[(r["month"], r["source"])].append(r)
            compared[r["month"]].add(r["source"])
    breaching: dict[str, dict[str, list[tuple[str, list[dict], int, Fraction]]]] = defaultdict(lambda: {"above": [], "below": []})
    for (month, source), rows in sorted(groups.items()):
        weight = sum(r["theirs"] for r in rows)
        for side in ("above", "below"):
            past = [r for r in rows if r["_hard"] and (r["gap"] > 0) == (side == "above")]
            held = sum(r["theirs"] for r in past)
            if past and held >= share * weight:
                breaching[month][side].append((source, past, len(rows), Fraction(held, weight)))
    for month in sorted(breaching):
        counted = len(compared[month])
        for side, entries in breaching[month].items():
            # Enough sources, and more than half of the independent sources that have anything to say about this month.
            if len(entries) < h["min_sources"] or 2 * len(entries) <= counted:
                continue
            for _, past, _, _ in entries:
                for r in past:
                    r["status"] = FAIL
            named = "; ".join(
                f"{sources[s].name} ({len(past)} of {total} figures, {float(held):.0%} of what it published for the month, "
                f"the largest {max(past, key=lambda r: abs(r['gap_pct']))['gap_pct']:+.2f}%)"
                for s, past, total, held in entries)
            aborts.append(
                f"reconciliation: {month}: {len(entries)} of the {counted} independent sources compared each have at least "
                f"{float(share):.0%} of what they published for the month in figures more than {h['tolerance_multiple']} times their "
                f"tolerance (at least {h['floor_pct']}%) from ours, and ours is {side} theirs in every one: {named}. Separate counts "
                f"agreeing with each other and not with ours means our data is wrong, so the build stops; reconciliation.json in the "
                f"staged files has every row")
    warnings = []
    for source in sources.values():
        rows = [r for r in judged if r["source"] == source.id and r["status"] != NOT_COMPARED]
        late = [r for r in rows if r["status"] in (WARN, FAIL)]
        if not late:
            continue
        worst = max(late, key=lambda r: (abs(r["gap_pct"]), r["month"]))
        warnings.append(
            f"reconciliation: {source.name}: {len(late)} of {len(rows)} compared figures are past their tolerance, "
            f"in {span(sorted({r['month'] for r in late}))}; the largest gap is {worst['gap_pct']:+.2f}% ({worst['month']})")
    return warnings


def single_figure_limit(sources: dict[str, Source], judged: list[dict], c: dict, aborts: list[str]) -> None:
    """Sets `stops_alone_pct` on every row the single-figure limit applies to (a listed kind, an independent source, a tolerance below
    the limit), marks `fail` each compared one of them that is `gap_pct` percent or more from theirs, and adds one abort line for each.
    Exact, and inclusive: a gap of exactly the limit stops the build. Its numbers and kinds are config."""
    s = c["single_figure_limit"]
    limit, kinds = Decimal(str(s["gap_pct"])), set(s["kinds"])
    for r in judged:
        if r["figure_kind"] in kinds and sources[r["source"]].independent and Decimal(str(r["tolerance_pct"])) < limit:
            r["stops_alone_pct"] = s["gap_pct"]
    stopping = []
    for r in judged:
        if r["stops_alone_pct"] is None or r["status"] == NOT_COMPARED or Decimal(abs(r["gap"])) * 100 < limit * r["theirs"]:
            continue
        # A source that restated this figure by the warning size or more: ours near the figure it published before is a source
        # changing its count, which is warned about and not a fault in our data. Ours that far from both stops the build.
        if r["restated_past_warning"] and Decimal(abs(r["ours"] - r["restated_from"])) * 100 < limit * r["restated_from"]:
            r["_excused"] = True
            continue
        stopping.append(r)
    for r in sorted(stopping, key=lambda r: (r["month"], r["source"], r["measure_as_published"], json.dumps(r["filters"], sort_keys=True))):
        r["status"] = FAIL
        aborts.append(
            f"reconciliation: {r['month']}: {sources[r['source']].name}: {r['measure_as_published']!r}: ours is {r['ours']:,} and theirs "
            f"{r['theirs']:,}, a gap of {r['gap_pct']:+.2f}%, which is {float(limit):g}% or more on a figure of kind {r['figure_kind']!r}: "
            f"one such figure from an independent source stops the build, whatever else is compared; reconciliation.json in the staged "
            f"files has every row")


def restated_past_warning(r: dict, warn: Decimal) -> bool:
    """Whether the source's restatement of this figure is `warn` percent or more of the figure it published earlier. Exact, and
    inclusive: exactly the warning size counts."""
    earlier = r["restated_from"]
    return earlier is not None and Decimal(abs(r["theirs"] - earlier)) * 100 >= warn * earlier


def restatement_warnings(sources: dict[str, Source], judged: list[dict], c: dict) -> list[str]:
    """One warning line for each figure a source restated by the warning size or more, and the row never better than `warn` (a row
    that was not compared stays so: there is nothing of ours to set beside it). Run after the two limits, so that the source's
    line for figures past their tolerance counts only figures that are."""
    decimals = int(c["pct_decimals"])
    lines = []
    for r in sorted((r for r in judged if r["restated_past_warning"]),
                    key=lambda r: (r["month"], r["source"], r["measure_as_published"], json.dumps(r["filters"], sort_keys=True))):
        if r["status"] == PASS:
            r["status"] = WARN
        line = (f"reconciliation: {r['month']}: {sources[r['source']].name}: {r['measure_as_published']!r}: the source restated this figure "
                f"from {r['restated_from']:,} to {r['theirs']:,}, {r['restated_pct']:+.2f}% (a restatement of {c['restatement_warn_pct']:g}% "
                "or more is warned about and does not stop the build)")
        if r.get("_excused"):
            line += (f"; ours is {r['ours']:,}, {r['gap_pct']:+.2f}% from the new figure and "
                     f"{percent(r['ours'] - r['restated_from'], r['restated_from'], decimals):+.2f}% from the earlier one, so the "
                     "single-figure limit did not stop the build")
        lines.append(line)
    return lines
