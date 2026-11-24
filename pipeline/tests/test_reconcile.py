"""The reconciliation step (pipeline/reconcile.py, docs/CUBE_SCHEMA.md `reconciliation.json`, D-149).

Every source, measure and value below is a fixture and obviously one (`source_a`, `Measure one`, `fixture_new`): the real
figures are rows of data/reference/published_figures.csv, which this file never reads for a figure. The tables are written as
the build writes them (one Parquet file for each column of a fact table, one file for a slice), in a temporary folder.
"""

from __future__ import annotations

import copy
import csv
import itertools
import json
import shutil
from datetime import date
from decimal import Decimal

import duckdb
import pytest

from pipeline import build, config, reconcile, reference
from pipeline.contract import NOT_BROKEN_DOWN
from pipeline.errors import GuardrailError

from .conftest import NOW, load_rows, make_cfg, source_for, write_pages

FLOW, FLEET, SERIES, SURVIVING = "registrations_flow", "fleet", "registrations_cars_long_run", "registrations_surviving"
STATUS, TYPE = "import_status", "vehicle_type"
LISTED, SECOND_LISTED = "fixture_listed", "fixture_second_listed"
# Every kind a fixture row may state (reconciliation.figure_kinds in these tests).
KNOWN_KINDS = (LISTED, SECOND_LISTED, "fixture_other", "fixture_unlisted")

# (month, import status, vehicle type, vehicles). The month totals are 520, 1040 and 1560.
FACT_ROWS = [
    ("2026-01", "fixture_new", "fixture_car", 300), ("2026-01", "fixture_new", "fixture_truck", 100),
    ("2026-01", "fixture_used", "fixture_car", 80), ("2026-01", "fixture_used", "fixture_truck", 40),
    ("2026-02", "fixture_new", "fixture_car", 600), ("2026-02", "fixture_new", "fixture_truck", 200),
    ("2026-02", "fixture_used", "fixture_car", 160), ("2026-02", "fixture_used", "fixture_truck", 80),
    ("2026-03", "fixture_new", "fixture_car", 900), ("2026-03", "fixture_new", "fixture_truck", 300),
    ("2026-03", "fixture_used", "fixture_car", 240), ("2026-03", "fixture_used", "fixture_truck", 120),
]
TOTAL = {"2026-01": 520, "2026-02": 1040, "2026-03": 1560}

SOURCES = [
    {"id": "source_a", "name": "Source A", "home_url": "https://a.example", "independent": "true", "definition": "", "definition_date_read": "",
     "data_basis": ""},
    {"id": "source_b", "name": "Source B", "home_url": "https://b.example", "independent": "true", "definition": "B counts what B counts.",
     "definition_date_read": "2026-11-01", "data_basis": "its own count"},
    {"id": "source_c", "name": "Source C", "home_url": "https://c.example", "independent": "true", "definition": "", "definition_date_read": "",
     "data_basis": ""},
    {"id": "source_d", "name": "Source D", "home_url": "https://d.example", "independent": "false", "definition": "", "definition_date_read": "",
     "data_basis": ""},
]


def write_parquet(con, path, type_name, values) -> None:
    """One column of a fact table, named as its file is."""
    path.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f'CREATE OR REPLACE TABLE one ("{path.stem}" {type_name})')
    con.executemany("INSERT INTO one VALUES (?)", [(v,) for v in values])
    con.execute(f"COPY one TO '{path.as_posix()}' (FORMAT PARQUET)")


def write_slice(con, path, rows) -> None:
    """rows are (month, value, n or None, denominator)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    con.execute("CREATE OR REPLACE TABLE one (month DATE, dim_value VARCHAR, n INTEGER, denominator INTEGER)")
    con.executemany("INSERT INTO one VALUES (?, ?, ?, ?)", [(date.fromisoformat(f"{m}-01"), v, n, d) for m, v, n, d in rows])
    con.execute(f"COPY one TO '{path.as_posix()}' (FORMAT PARQUET)")


def stage(tmp_path):
    """A staged tree with a fact table (flow), a slice-only dataset with hidden cells (fleet), a series dataset with a month
    total in its denominators (series) and a dataset that was not built (surviving)."""
    staging = tmp_path / "staging"
    con = duckdb.connect()
    facts = staging / "facts" / FLOW
    write_parquet(con, facts / "month.parquet", "DATE", [date.fromisoformat(f"{m}-01") for m, *_ in FACT_ROWS])
    write_parquet(con, facts / f"{STATUS}.parquet", "VARCHAR", [s for _, s, _, _ in FACT_ROWS])
    write_parquet(con, facts / f"{TYPE}.parquet", "VARCHAR", [t for _, _, t, _ in FACT_ROWS])
    write_parquet(con, facts / "n.parquet", "INTEGER", [n for *_, n in FACT_ROWS])
    write_slice(con, staging / "cube" / FLEET / "vehicle_usage.parquet", [
        ("2026-03", "fixture_x", 50, 60), ("2026-03", "fixture_y", None, 60), ("2026-03", "fixture_z", None, 60),
        ("2026-02", NOT_BROKEN_DOWN, 40, 40),
        ("2026-01", "fixture_x", 25, 35), ("2026-01", "fixture_y", 10, 35),
    ])
    write_slice(con, staging / "cube" / SERIES / "car_origin.parquet", [
        ("2026-01", "fixture_x", 70, 700), ("2026-01", "fixture_y", 630, 700), ("2026-02", "fixture_x", 80, 800),
    ])
    con.close()
    datasets = {
        FLOW: {"live_dimensions": [STATUS, TYPE], "facts": {"rows": len(FACT_ROWS), "dimensions": [STATUS, TYPE]}},
        FLEET: {"live_dimensions": ["vehicle_usage"], "facts": None},
        SERIES: {"live_dimensions": ["car_origin"], "facts": None},
        SURVIVING: {"definition": "fixture", "not_built": "fixture"},
    }
    return staging, datasets


def figure_row(**given) -> dict:
    row = {"source": "source_a", "source_url": "https://a.example/page", "date_read": "2026-11-20", "month": "2026-02",
           "measure_as_published": "Measure one", "figure": "1040", "dataset": FLOW, "filters": "", "tolerance_pct": "2",
           "known_difference": "", "added_up_from": "", "figure_kind": "fixture_other", "restated_from": ""}
    row.update(given)
    return row


def write_reference(tmp_path, figures, sources=SOURCES):
    reference = tmp_path / "reference"
    reference.mkdir(parents=True, exist_ok=True)
    for name, columns, rows in (("published_figures.csv", reconcile.FIGURE_COLUMNS, figures),
                                ("published_sources.csv", reconcile.SOURCE_COLUMNS, sources)):
        with (reference / name).open("w", encoding="utf-8", newline="") as fh:
            writer = csv.writer(fh, lineterminator="\n")
            writer.writerow(columns)
            writer.writerows([[row[c] for c in columns] for row in rows])
    return reference


def cfg_for(tmp_path, figures, sources=SOURCES, single=None, known=None, **hard_limit):
    """The live configuration with the hard limit's numbers changed by `hard_limit`, and the single-figure limit set to the
    fixture's own (5%, two fixture kinds) unless `single` gives other numbers: the live kinds are real ones, which no test names."""
    cfg = config.load(overrides={"reference_dir": str(write_reference(tmp_path, figures, sources))})
    cfg.pipeline = copy.deepcopy(cfg.pipeline)
    cfg.pipeline["reconciliation"]["hard_limit"].update(hard_limit)
    cfg.pipeline["reconciliation"]["single_figure_limit"] = {"gap_pct": 5, "kinds": [LISTED, SECOND_LISTED], **(single or {})}
    cfg.pipeline["reconciliation"]["figure_kinds"] = list(KNOWN_KINDS if known is None else known)
    return cfg


def reconcile_figures(tmp_path, figures, sources=SOURCES, datasets=None, single=None, **hard_limit):
    staging, staged = stage(tmp_path)
    cfg = cfg_for(tmp_path, figures, sources, single, **hard_limit)
    prepared, problems = reconcile.prepare(cfg)
    assert problems == []
    return reconcile.run(duckdb.connect(), cfg, prepared, datasets or staged, staging, "2026-03-31")


def only_row(result) -> dict:
    assert len(result.document["rows"]) == 1
    return result.document["rows"][0]


def problems_of(tmp_path, figures, sources=SOURCES) -> list[str]:
    return reconcile.prepare(cfg_for(tmp_path, figures, sources))[1]


# --- the two files: parsing and strict checks ------------------------------------------------------------------------------

def test_the_committed_files_are_valid():
    # Whatever rows the live files hold, every cell, source, dataset and filter dimension must pass the build's early checks.
    assert reconcile.prepare(config.load())[1] == []


def test_the_step_runs_with_no_rows(tmp_path):
    cfg = cfg_for(tmp_path, [])
    prepared, problems = reconcile.prepare(cfg)
    assert problems == []
    staging, datasets = stage(tmp_path)
    result = reconcile.run(duckdb.connect(), cfg, prepared, datasets, staging, "2026-03-31")
    assert (result.aborts, result.warnings) == ([], [])
    assert result.document["rows"] == []
    assert result.entry == {"file": "reconciliation.json", "rows": 0, "by_status": {"pass": 0, "warn": 0, "fail": 0, "not_compared": 0},
                            "months": {"first": None, "last": None}}


@pytest.mark.parametrize("name", ["published_figures.csv", "published_sources.csv"])
def test_a_header_that_is_not_exactly_the_columns_is_refused(tmp_path, name):
    cfg = cfg_for(tmp_path, [figure_row()])
    path = cfg.reference(name)
    path.write_text(path.read_text(encoding="utf-8").replace(",", ";", 1), encoding="utf-8", newline="")
    assert any("the header must be exactly" in p and name in p for p in reconcile.prepare(cfg)[1])


def test_a_file_a_spreadsheet_saved_is_read_and_one_that_cannot_be_read_is_a_problem_not_a_crash(tmp_path):
    cfg = cfg_for(tmp_path, [figure_row()])
    figures, sources = (cfg.reference(n) for n in ("published_figures.csv", "published_sources.csv"))
    # A byte-order mark, as Excel writes at the start of a CSV, is not part of the first column's name.
    figures.write_bytes(b"\xef\xbb\xbf" + figures.read_bytes())
    assert reconcile.prepare(cfg)[1] == []
    figures.write_bytes(b"")
    problems = reconcile.prepare(cfg)[1]
    assert problems == ["published_figures.csv is empty: its first line must be the header " + ",".join(reconcile.FIGURE_COLUMNS)]
    sources.write_bytes(b"id,name\n\xff\xfe broken\n")
    problems = reconcile.prepare(cfg)[1]
    assert any("published_sources.csv" in p and ("is not UTF-8 text" in p or "header must be exactly" in p) for p in problems), problems
    sources.write_bytes(b"\xff\xfe not text at all\n")
    assert any("is not UTF-8 text" in p for p in reconcile.prepare(cfg)[1])


def test_a_missing_file_aborts_loudly(tmp_path):
    cfg = cfg_for(tmp_path, [])
    cfg.reference("published_sources.csv").unlink()
    with pytest.raises(GuardrailError, match="published_sources.csv is missing"):
        reconcile.prepare(cfg)


@pytest.mark.parametrize("change, fragment", [
    ({"source": "source_z"}, "is not an id in published_sources.csv"),
    ({"source_url": "http://a.example"}, "source_url must be an https:// address"),
    ({"date_read": "20/11/2026"}, "date_read must be a date"),
    ({"date_read": "2026-02-31"}, "date_read must be a date"),
    ({"month": "2026-13"}, "month must be YYYY-MM"),
    ({"month": "Feb 2026"}, "month must be YYYY-MM"),
    ({"measure_as_published": ""}, "measure_as_published is empty"),
    ({"figure": "1,040"}, "figure must be a whole number"),
    ({"figure": "10.5"}, "figure must be a whole number"),
    ({"figure": "-3"}, "figure must be a whole number"),
    ({"figure": "0"}, "figure is 0"),
    ({"dataset": "no_such_dataset"}, "is not a dataset of config/pipeline.json"),
    ({"tolerance_pct": "two"}, "tolerance_pct must be a number"),
    ({"tolerance_pct": "-1"}, "tolerance_pct must be a number"),
    ({"tolerance_pct": "20.5"}, "is above reconciliation.max_tolerance_pct"),
    ({"filters": "{not json"}, "filters is not a JSON object"),
    ({"filters": "[1]"}, "filters must be a JSON object"),
    ({"filters": "{}"}, "leave the cell blank"),
    ({"filters": '{"import_status": "fixture_new"}'}, "must be a list of distinct, non-empty values"),
    ({"filters": '{"import_status": []}'}, "must be a list of distinct, non-empty values"),
    ({"filters": '{"import_status": ["a", "a"]}'}, "must be a list of distinct, non-empty values"),
    ({"filters": '{"import_status": ["a"], "import_status": ["b"]}'}, "names ['import_status'] more than once"),
    ({"filters": '{"no_such_dimension": ["a"]}'}, "cannot be filtered by no_such_dimension"),
    ({"dataset": SERIES, "filters": '{"import_status": ["a"]}'}, "cannot be filtered by import_status"),
    ({"figure_kind": ""}, "figure_kind must be lower case letters, digits and underscores"),
    ({"figure_kind": "Fixture Kind"}, "figure_kind must be lower case letters, digits and underscores"),
    ({"figure_kind": "1kind"}, "figure_kind must be lower case letters, digits and underscores"),
    ({"added_up_from": "Chart"}, "added_up_from must be blank, or lower case words"),
    ({"added_up_from": "chart_data"}, "added_up_from must be blank, or lower case words"),
    ({"added_up_from": "two  words"}, "added_up_from must be blank, or lower case words"),
    ({"added_up_from": "page 2"}, "added_up_from must be blank, or lower case words"),
    ({"restated_from": "0"}, "restated_from must be blank, or a positive whole number"),
    ({"restated_from": "-900"}, "restated_from must be blank, or a positive whole number"),
    ({"restated_from": "1,000"}, "restated_from must be blank, or a positive whole number"),
    ({"restated_from": "1000.5"}, "restated_from must be blank, or a positive whole number"),
    ({"restated_from": "about 1000"}, "restated_from must be blank, or a positive whole number"),
    ({"restated_from": "1040"}, "restated_from is the same as figure"),
    ({"restated_from": "01040"}, "restated_from is the same as figure"),
])
def test_a_bad_figure_row_is_refused_and_named(tmp_path, change, fragment):
    problems = problems_of(tmp_path, [figure_row(), figure_row(**{"measure_as_published": "Measure two", **change})])
    assert len(problems) == 1, problems
    assert fragment in problems[0]
    assert "published_figures.csv line 3 (" in problems[0], problems[0]


def test_a_repeated_figure_is_refused_however_its_filters_are_spelled(tmp_path):
    one = figure_row(filters='{"import_status": ["a", "b"], "vehicle_type": ["c"]}')
    again = figure_row(filters='{ "vehicle_type": ["c"], "import_status": ["b", "a"] }')
    problems = problems_of(tmp_path, [one, again])
    assert len(problems) == 1 and "the same source, month, measure and filters as line 2" in problems[0]
    # Another month, measure, source or filter is another figure.
    assert problems_of(tmp_path, [one, figure_row(month="2026-03", filters=one["filters"]), figure_row(source="source_b", filters=one["filters"]),
                                  figure_row(measure_as_published="Measure two", filters=one["filters"]), figure_row(filters="")]) == []


def test_two_dimensions_that_no_published_table_holds_are_found_before_the_build_reads_anything(tmp_path):
    # registrations_surviving's fact table (config/pipeline.json) does not carry the owner's region, and a slice holds one dimension.
    problems = problems_of(tmp_path, [figure_row(dataset=SURVIVING, filters='{"import_status": ["a"], "region": ["b"]}')])
    assert len(problems) == 1 and "registrations_surviving has no published table holding import_status, region together" in problems[0]
    assert "its fact table (facts in config/pipeline.json) lacks region" in problems[0] and "published_figures.csv line 2" in problems[0]
    # A dataset with no fact table holds no pair of dimensions at all.
    stock = problems_of(tmp_path, [figure_row(dataset=FLEET, filters='{"vehicle_usage": ["a"], "vehicle_type": ["b"]}')])
    assert len(stock) == 1 and "fleet has no published table holding vehicle_type, vehicle_usage together: it has no fact table" in stock[0]
    # Two dimensions the fact table does carry, and one dimension a slice answers, are fine.
    assert problems_of(tmp_path, [figure_row(dataset=SURVIVING, filters='{"import_status": ["a"], "make": ["b"]}'),
                                  figure_row(dataset=SURVIVING, measure_as_published="Two", filters='{"region": ["b"]}')]) == []


def test_what_a_figure_was_added_up_from_is_one_or_more_lower_case_words_or_blank(tmp_path):
    ok = [figure_row(added_up_from=words, measure_as_published=words or "blank") for words in ("", "chart", "made up table")]
    assert problems_of(tmp_path, ok) == []


def test_every_problem_is_reported_at_once(tmp_path):
    problems = problems_of(tmp_path, [figure_row(month="x"), figure_row(measure_as_published="two", figure="x")])
    assert len(problems) == 2


@pytest.mark.parametrize("change, fragment", [
    ({"id": "Source-B"}, "id must be lower case"),
    ({"id": "source_a"}, "id is listed twice"),
    ({"name": ""}, "name is empty"),
    ({"home_url": "b.example"}, "home_url must be an https:// address"),
    ({"independent": "yes"}, "independent must be true or false"),
    ({"definition": "words", "definition_date_read": ""}, "both be set, or both blank"),
    ({"definition": "", "definition_date_read": "2026-11-01"}, "both be set, or both blank"),
    ({"definition": "words", "definition_date_read": "1 Nov"}, "definition_date_read must be a date"),
])
def test_a_bad_source_row_is_refused_and_named(tmp_path, change, fragment):
    sources = [SOURCES[0], {**SOURCES[1], **change}]
    problems = problems_of(tmp_path, [], sources)
    assert len(problems) == 1 and fragment in problems[0] and "published_sources.csv line 3" in problems[0], problems


def test_config_numbers_are_checked(tmp_path):
    cfg = cfg_for(tmp_path, [], min_sources=1, source_vehicle_share=0, tolerance_multiple=0.5)
    problems = reconcile.prepare(cfg)[1]
    assert len(problems) == 3 and all(p.startswith("reconciliation.hard_limit.") for p in problems)


@pytest.mark.parametrize("single, fragment", [
    ({"gap_pct": 0}, "gap_pct must be a number above 0"),
    ({"gap_pct": -5}, "gap_pct must be a number above 0"),
    ({"gap_pct": True}, "gap_pct must be a number above 0"),
    ({"gap_pct": "5"}, "gap_pct must be a number above 0"),
    ({"gap_pct": float("inf")}, "gap_pct must be a number above 0 and at most 100"),
    ({"gap_pct": float("nan")}, "gap_pct must be a number above 0 and at most 100"),
    ({"gap_pct": 1e308}, "gap_pct must be a number above 0 and at most 100"),
    ({"gap_pct": 10 ** 400}, "gap_pct must be a number above 0 and at most 100"),
    ({"kinds": ["fixture_nobody_listed"]}, "which reconciliation.figure_kinds does not list"),
    ({"kinds": LISTED}, "kinds must be a list of distinct ids"),
    ({"kinds": [LISTED, LISTED]}, "kinds must be a list of distinct ids"),
    ({"kinds": ["Fixture Kind"]}, "kinds must be a list of distinct ids"),
    ({"kinds": [1]}, "kinds must be a list of distinct ids"),
])
def test_the_single_figure_limits_numbers_are_checked(tmp_path, single, fragment):
    problems = reconcile.prepare(cfg_for(tmp_path, [], single=single))[1]
    assert len(problems) == 1 and problems[0].startswith("reconciliation.single_figure_limit.") and fragment in problems[0], problems


def test_a_configuration_with_no_single_figure_limit_is_refused_and_an_empty_list_of_kinds_is_not(tmp_path):
    cfg = cfg_for(tmp_path, [])
    del cfg.pipeline["reconciliation"]["single_figure_limit"]
    assert reconcile.prepare(cfg)[1] == ["reconciliation.single_figure_limit must be an object with gap_pct and kinds"]
    assert reconcile.prepare(cfg_for(tmp_path, [], single={"kinds": []}))[1] == []


# --- answering from the staged files ---------------------------------------------------------------------------------------

def test_a_figure_within_tolerance_passes_and_the_gap_is_ours_less_theirs(tmp_path):
    row = only_row(reconcile_figures(tmp_path, [figure_row(figure="1020", known_difference="Counts differently.")]))
    assert (row["status"], row["ours"], row["theirs"], row["gap"], row["gap_pct"]) == ("pass", 1040, 1020, 20, 1.9608)
    assert (row["tolerance_pct"], row["hard_bound_pct"], row["known_difference"]) == (2.0, 4.0, "Counts differently.")
    assert (row["reason_kind"], row["reason"]) == (None, None)


def test_a_gap_of_exactly_the_tolerance_passes_and_one_vehicle_more_warns(tmp_path):
    # 40 is 4% of 1000: inside a 4% tolerance. 41 is 4.1% of 1000 vehicles less one, and past it.
    inside = only_row(reconcile_figures(tmp_path, [figure_row(figure="1000", tolerance_pct="4")]))
    past = only_row(reconcile_figures(tmp_path, [figure_row(figure="999", tolerance_pct="4")]))
    assert (inside["status"], inside["gap_pct"]) == ("pass", 4.0)
    assert past["status"] == "warn"


def test_ours_below_theirs_is_a_negative_gap(tmp_path):
    row = only_row(reconcile_figures(tmp_path, [figure_row(figure="1100")]))
    assert (row["status"], row["gap"], row["gap_pct"]) == ("warn", -60, -5.4545)


def test_filters_narrow_the_answer_and_values_are_alternatives(tmp_path):
    new = only_row(reconcile_figures(tmp_path, [figure_row(filters='{"import_status": ["fixture_new"]}', figure="800")]))
    both = only_row(reconcile_figures(tmp_path, [figure_row(filters='{"import_status": ["fixture_new", "fixture_used"]}', figure="1040")]))
    crossed = only_row(reconcile_figures(tmp_path, [figure_row(
        filters='{"import_status": ["fixture_used"], "vehicle_type": ["fixture_truck"]}', figure="80")]))
    assert [(r["ours"], r["status"]) for r in (new, both, crossed)] == [(800, "pass"), (1040, "pass"), (80, "pass")]
    assert crossed["filters"] == {"import_status": ["fixture_used"], "vehicle_type": ["fixture_truck"]}


def test_a_dataset_with_no_fact_table_answers_from_its_slice_and_its_denominator(tmp_path):
    one = only_row(reconcile_figures(tmp_path, [figure_row(dataset=FLEET, month="2026-01", figure="25", filters='{"vehicle_usage": ["fixture_x"]}')]))
    two = only_row(reconcile_figures(tmp_path, [figure_row(dataset=FLEET, month="2026-01", figure="35",
                                                           filters='{"vehicle_usage": ["fixture_x", "fixture_y"]}')]))
    total = only_row(reconcile_figures(tmp_path, [figure_row(dataset=SERIES, month="2026-01", figure="700")]))
    assert [(r["ours"], r["status"]) for r in (one, two, total)] == [(25, "pass"), (35, "pass"), (700, "pass")]


def test_a_value_with_no_vehicles_in_a_month_inside_the_data_is_zero_not_missing(tmp_path):
    # fixture_y has no row in 2026-02 of the series' slice, but the month is held: the answer is 0 and the row is compared.
    row = only_row(reconcile_figures(tmp_path, [figure_row(dataset=SERIES, figure="5", filters='{"car_origin": ["fixture_y"]}')]))
    assert (row["ours"], row["status"]) == (0, "warn")


@pytest.mark.parametrize("month, span", [("2026-04", "2026-01 to 2026-03"), ("2025-12", "2026-01 to 2026-03")])
def test_a_month_the_data_does_not_hold_is_said_not_compared(tmp_path, month, span):
    result = reconcile_figures(tmp_path, [figure_row(month=month)])
    row = only_row(result)
    assert (row["status"], row["ours"], row["gap"], row["gap_pct"], row["reason_kind"]) == ("not_compared", None, None, None, "month_not_held")
    assert span in row["reason"] and month in row["reason"]
    assert result.document["summary"]["by_status"]["not_compared"] == 1


def test_a_month_inside_the_range_with_no_row_at_all_is_not_a_zero(tmp_path):
    staging, datasets = stage(tmp_path)
    con = duckdb.connect()
    write_slice(con, staging / "cube" / SERIES / "car_origin.parquet", [("2026-01", "fixture_x", 70, 700), ("2026-03", "fixture_x", 90, 900)])
    con.close()
    cfg = cfg_for(tmp_path, [figure_row(dataset=SERIES), figure_row(dataset=SERIES, measure_as_published="Measure two", filters='{"car_origin": ["fixture_x"]}')])
    prepared, _ = reconcile.prepare(cfg)
    result = reconcile.run(duckdb.connect(), cfg, prepared, datasets, staging, "2026-03-31")
    assert [(r["status"], r["ours"], r["reason_kind"]) for r in result.document["rows"]] == [("not_compared", None, "month_not_held")] * 2
    assert "no vehicles in 2026-02" in result.document["rows"][0]["reason"]


def test_a_dataset_that_was_not_built_is_not_compared(tmp_path):
    row = only_row(reconcile_figures(tmp_path, [figure_row(dataset=SURVIVING)]))
    assert (row["status"], row["reason_kind"]) == ("not_compared", "dataset_not_built")


def test_an_answer_that_rests_on_a_hidden_cell_is_not_compared_and_ours_is_not_published(tmp_path):
    hidden = only_row(reconcile_figures(tmp_path, [figure_row(dataset=FLEET, month="2026-03", figure="10", filters='{"vehicle_usage": ["fixture_y"]}')]))
    # One visible and one hidden value: the sum would show the hidden cell, so it is not compared either.
    mixed = only_row(reconcile_figures(tmp_path, [figure_row(dataset=FLEET, month="2026-03", figure="60",
                                                             filters='{"vehicle_usage": ["fixture_x", "fixture_y"]}')]))
    not_broken_down = only_row(reconcile_figures(tmp_path, [figure_row(dataset=FLEET, month="2026-02", figure="40", filters='{"vehicle_usage": ["fixture_x"]}')]))
    visible = only_row(reconcile_figures(tmp_path, [figure_row(dataset=FLEET, month="2026-03", figure="50", filters='{"vehicle_usage": ["fixture_x"]}')]))
    for row in (hidden, mixed, not_broken_down):
        assert (row["status"], row["ours"], row["gap"], row["reason_kind"]) == ("not_compared", None, None, "hidden_cell")
    assert (visible["status"], visible["ours"]) == ("pass", 50)


@pytest.mark.parametrize("figures, fragment", [
    ([figure_row(filters='{"import_status": ["fixture_new", "fixture_old"]}')], "import_status has no value 'fixture_old' in the published files of registrations_flow"),
    ([figure_row(filters='{"vehicle_type": ["fixture_x"]}')], "vehicle_type has no value 'fixture_x'"),
    ([figure_row(dataset=FLEET, filters='{"vehicle_usage": ["fixture_none"]}')], "vehicle_usage has no value 'fixture_none'"),
    ([figure_row(dataset=FLEET, filters='{"vehicle_usage": ["__NOT_BROKEN_DOWN__"]}')], "has no value '__NOT_BROKEN_DOWN__'"),
])
def test_a_value_the_files_do_not_hold_is_said_not_compared_never_a_zero_and_never_an_abort(tmp_path, figures, fragment):
    result = reconcile_figures(tmp_path, figures)
    assert result.aborts == []
    row = only_row(result)
    assert (row["status"], row["ours"], row["gap"], row["gap_pct"], row["reason_kind"]) == ("not_compared", None, None, None, "value_not_held")
    assert fragment in row["reason"] and "so it is not compared" in row["reason"]


def test_a_value_that_dropped_out_of_a_later_build_names_the_dimension_and_value_in_one_warning_per_source(tmp_path):
    figures = [figure_row(month=m, measure_as_published=f"Measure {m}", filters='{"vehicle_type": ["fixture_gone"]}') for m in ("2026-01", "2026-03")]
    figures += [figure_row(source="source_b", filters='{"vehicle_type": ["fixture_gone"]}'), figure_row(source="source_c")]
    # Each source also has a row that is answered, so that this is the drift of one value and not a renamed label.
    figures += [figure_row(source="source_a", measure_as_published="Measure ok"), figure_row(source="source_b", month="2026-03", figure="1560"),
                figure_row(source="source_c", month="2026-03", figure="1560"), figure_row(source="source_c", month="2026-01", figure="520")]
    result = reconcile_figures(tmp_path, figures)
    assert result.aborts == []
    assert result.warnings == [
        "reconciliation: Source A: 2 figures name a value the published files do not hold, in 2026-01 to 2026-03, so they were not compared",
        "reconciliation: Source B: 1 figure names a value the published files do not hold, in 2026-02, so it was not compared",
    ]
    assert result.document["summary"]["by_status"] == {"pass": 5, "warn": 0, "fail": 0, "not_compared": 3}


def test_a_renamed_label_that_turns_every_row_of_a_source_or_most_rows_into_value_not_held_has_a_line_of_its_own(tmp_path):
    gone = '{"vehicle_type": ["fixture_gone"]}'
    # Every row of Source A, and one of Source B's two: A has the line, and so has the build, since 3 of 4 rows is more than half.
    figures = [figure_row(filters=gone), figure_row(month="2026-03", filters=gone, measure_as_published="Two"),
               figure_row(source="source_b", filters=gone), figure_row(source="source_b", month="2026-03")]
    lines = [w for w in reconcile_figures(tmp_path, figures).warnings if "renamed" in w]
    assert lines == [
        "reconciliation: every one of the 2 figures of Source A names a value the published files do not hold: a label in a reference "
        "file may have been renamed, so nothing of this source was checked",
        "reconciliation: 3 of the 4 published figures name a value the published files do not hold: a label in a reference file may "
        "have been renamed, so most of the figures were not checked",
    ]
    # Half is not more than half, and a source with one good row has no line: only the per-figure warning is raised.
    half = [figure_row(filters=gone), figure_row(month="2026-03")]
    assert [w for w in reconcile_figures(tmp_path / "half", half).warnings if "renamed" in w] == []
    # It is a warning and not an abort.
    assert reconcile_figures(tmp_path / "all", [figure_row(filters=gone)]).aborts == []


def test_a_value_not_held_never_counts_towards_the_hard_limit(tmp_path):
    # Three independent sources whose every row for the month names a value that is gone: nothing is compared, nobody breaches.
    gone = figures_from(["source_a", "source_b", "source_c"], [1, 1, 1], filters='{"vehicle_type": ["fixture_gone"]}')
    result = fails(tmp_path, gone)
    assert result.aborts == []
    assert {r["status"] for r in result.document["rows"]} == {"not_compared"}
    # Two sources past the bound, and a third whose rows for the month are all not compared: the third is not counted, so it is
    # two of the two sources that have anything to say, and the build stops on them.
    mixed = figures_from(["source_a", "source_b"], [950, 960]) + figures_from(["source_c"], [1], filters='{"vehicle_type": ["fixture_gone"]}')
    assert "2 of the 2 independent sources compared" in fails(tmp_path, mixed).aborts[0]
    # One source past the bound, and the other two only value-not-held: one compared source cannot stop a build.
    alone = figures_from(["source_a"], [950]) + figures_from(["source_b", "source_c"], [1, 1], filters='{"vehicle_type": ["fixture_gone"]}')
    assert fails(tmp_path, alone).aborts == []
    # A third source with one row past the bound and others not compared is judged on the compared rows alone, like the others.
    third = figures_from(["source_a", "source_b", "source_c"], [950, 960, 970]) + [
        figure_row(source="source_c", measure_as_published="Measure two", filters='{"vehicle_type": ["fixture_gone"]}')]
    assert len(fails(tmp_path, third).aborts) == 1


def test_a_dimension_the_dataset_publishes_no_file_for_aborts(tmp_path):
    staging, datasets = stage(tmp_path)
    datasets[FLOW]["live_dimensions"] = [TYPE]
    result = reconcile_figures(tmp_path, [figure_row(filters='{"import_status": ["fixture_new"]}')], datasets=datasets)
    assert len(result.aborts) == 1 and "import_status is not a live dimension of registrations_flow in this build" in result.aborts[0]


def test_two_dimensions_that_no_one_table_holds_abort_but_one_alone_uses_its_slice(tmp_path):
    staging, datasets = stage(tmp_path)
    # A dimension that is live but not in the fact table, with a slice of its own.
    datasets[FLOW]["live_dimensions"] = [STATUS, TYPE, "make"]
    con = duckdb.connect()
    write_slice(con, staging / "cube" / FLOW / "make.parquet", [("2026-02", "fixture_m", 7, 1040)])
    con.close()
    cfg = cfg_for(tmp_path, [figure_row(filters='{"make": ["fixture_m"]}', figure="7"),
                             figure_row(measure_as_published="Measure two", filters='{"make": ["fixture_m"], "import_status": ["fixture_new"]}')])
    prepared, problems = reconcile.prepare(cfg)
    assert problems == []
    result = reconcile.run(duckdb.connect(), cfg, prepared, datasets, staging, "2026-03-31")
    assert [r["ours"] for r in result.document["rows"]] == [7]
    assert len(result.aborts) == 1 and "import_status, make cannot be crossed" in result.aborts[0]


def test_a_fact_table_that_reads_back_with_the_wrong_row_count_aborts(tmp_path):
    staging, datasets = stage(tmp_path)
    datasets[FLOW]["facts"]["rows"] += 1
    result = reconcile_figures(tmp_path, [figure_row()], datasets=datasets)
    assert len(result.aborts) == 1 and "reads back as 12 rows, but the manifest says 13" in result.aborts[0]


# --- the warnings ----------------------------------------------------------------------------------------------------------

def test_rows_past_tolerance_add_one_warning_line_for_each_source(tmp_path):
    figures = [figure_row(figure="1100", month="2026-02"), figure_row(figure="1500", month="2026-03", measure_as_published="Measure two"),
               figure_row(figure="1560", month="2026-03", measure_as_published="Measure three"),
               figure_row(source="source_b", figure="1000", month="2026-02"), figure_row(source="source_c", figure="1040")]
    result = reconcile_figures(tmp_path, figures)
    assert result.aborts == []
    assert result.warnings == [
        "reconciliation: Source A: 2 of 3 compared figures are past their tolerance, in 2026-02 to 2026-03; the largest gap is -5.45% (2026-02)",
        "reconciliation: Source B: 1 of 1 compared figures are past their tolerance, in 2026-02; the largest gap is +4.00% (2026-02)",
    ]


def test_a_build_where_nothing_could_be_compared_says_so(tmp_path):
    result = reconcile_figures(tmp_path, [figure_row(month="2027-01"), figure_row(dataset=SURVIVING, measure_as_published="Measure two")])
    assert len(result.warnings) == 1
    assert result.warnings[0].startswith("reconciliation: none of the 2 published figures could be compared (dataset_not_built, month_not_held)")


# --- the hard limit --------------------------------------------------------------------------------------------------------
# Ours for 2026-02 is 1040 (new 800: car 600, truck 200; used 240: car 160, truck 80) and each row's tolerance is 2%, so its hard
# bound is 4%: 1000 is exactly on it (inside), 999 is past it. A source is judged by the weight of its rows, which is their figure.

def figures_from(sources, theirs, month="2026-02", **given):
    return [figure_row(source=s, figure=str(t), month=month, **given) for s, t in zip(sources, theirs)]


def fails(tmp_path, figures, sources=SOURCES, single=None, **hard_limit):
    return reconcile_figures(tmp_path, figures, sources, single=single, **hard_limit)


def by_source(result) -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for r in result.document["rows"]:
        found.setdefault(r["source"], []).append(r["status"])
    return found


E_SOURCES = SOURCES + [{**SOURCES[0], "id": "source_e", "name": "Source E"}]
CARS, TRUCKS, USED = '{"vehicle_type": ["fixture_car"]}', '{"vehicle_type": ["fixture_truck"]}', '{"import_status": ["fixture_used"]}'


def test_two_sources_past_the_hard_bound_the_same_way_fail_the_build_when_only_two_are_compared(tmp_path):
    result = fails(tmp_path, figures_from(["source_a", "source_b"], [950, 960]))
    assert len(result.aborts) == 1
    abort = result.aborts[0]
    assert abort.startswith("reconciliation: 2026-02: 2 of the 2 independent sources compared each have at least 50% of what they published")
    assert "more than 2 times their tolerance (at least 2%) from ours, and ours is above theirs in every one" in abort
    assert "Source A (1 of 1 figures, 100% of what it published for the month, the largest +9.47%)" in abort
    assert {r["status"] for r in result.document["rows"]} == {"fail"}
    assert result.document["summary"]["by_status"] == {"pass": 0, "warn": 0, "fail": 2, "not_compared": 0}


def test_three_sources_past_the_bound_below_theirs_fail_too(tmp_path):
    result = fails(tmp_path, figures_from(["source_a", "source_b", "source_c"], [1100, 1110, 1120]))
    assert len(result.aborts) == 1 and "ours is below theirs in every one" in result.aborts[0]
    assert result.aborts[0].startswith("reconciliation: 2026-02: 3 of the 3 independent sources compared")


def test_two_of_three_compared_sources_are_enough_and_the_third_stays_a_pass(tmp_path):
    result = fails(tmp_path, figures_from(["source_a", "source_b", "source_c"], [950, 960, 1040]))
    assert len(result.aborts) == 1 and result.aborts[0].startswith("reconciliation: 2026-02: 2 of the 3 independent sources compared")
    assert by_source(result) == {"source_a": ["fail"], "source_b": ["fail"], "source_c": ["pass"]}


def test_three_of_four_compared_sources_are_enough_and_two_of_four_are_not(tmp_path):
    three = fails(tmp_path, figures_from(["source_a", "source_b", "source_c", "source_e"], [950, 960, 970, 1040]), E_SOURCES)
    assert len(three.aborts) == 1 and "3 of the 4 independent sources" in three.aborts[0]
    two = fails(tmp_path, figures_from(["source_a", "source_b", "source_c", "source_e"], [950, 960, 1040, 1040]), E_SOURCES)
    assert two.aborts == [], "half of the sources compared is not more than half"


def test_a_row_past_the_bound_on_the_other_side_does_not_cancel_a_source(tmp_path):
    # Source A: its total is 9.5% over (weight 900) and its used-vehicles row 20% under (weight 300), so 75% of what it published
    # is past the bound on the high side. The old rule needed every past row on one side and so lost the source.
    figures = [figure_row(source="source_a", figure="900"), figure_row(source="source_a", figure="300", filters=USED, measure_as_published="Measure two"),
               figure_row(source="source_b", figure="950")]
    result = fails(tmp_path, figures)
    assert len(result.aborts) == 1 and "ours is above theirs in every one" in result.aborts[0]
    assert by_source(result) == {"source_a": ["fail", "warn"], "source_b": ["fail"]}


def test_a_fault_that_moves_vehicles_between_two_rows_is_caught_on_the_side_that_holds_most_of_the_weight(tmp_path):
    # A fifth of the cars counted as trucks: ours is 5% under the published car figure and 12% over the truck figure. Cars hold 76%
    # of what each source published, so each source breaches on the low side, and the trucks do not cancel it.
    figures = [figure_row(source=s, figure=f, filters=filt, measure_as_published=m)
               for s in ("source_a", "source_b") for f, filt, m in (("800", CARS, "Cars"), ("250", TRUCKS, "Trucks"))]
    result = fails(tmp_path, figures)
    assert len(result.aborts) == 1 and "ours is below theirs in every one" in result.aborts[0]
    assert by_source(result) == {"source_a": ["fail", "warn"], "source_b": ["fail", "warn"]}


def test_a_source_is_judged_by_the_weight_of_its_rows_not_their_number(tmp_path):
    exact = [("600", '{"import_status": ["fixture_new"], "vehicle_type": ["fixture_car"]}'), ("200", '{"import_status": ["fixture_new"], "vehicle_type": ["fixture_truck"]}')]
    rest = [("160", '{"import_status": ["fixture_used"], "vehicle_type": ["fixture_car"]}'), ("80", '{"import_status": ["fixture_used"], "vehicle_type": ["fixture_truck"]}')]

    def parts(source, pairs):
        return [figure_row(source=source, figure=f, filters=filt, measure_as_published=f"Part {i}") for i, (f, filt) in enumerate(pairs)]

    other = figures_from(["source_b"], [960])
    # One total past the bound (950) and two exact parts: 950 of 1,750 is 54%, so Source A breaches although two of its rows pass.
    heavy = figures_from(["source_a"], [950]) + parts("source_a", exact) + other
    assert len(fails(tmp_path, heavy).aborts) == 1
    # With the other two parts as well, 950 of 1,990 is 48%: it does not.
    light = figures_from(["source_a"], [950]) + parts("source_a", exact + rest) + other
    assert fails(tmp_path, light).aborts == []
    # The share is config.
    assert fails(tmp_path, heavy, source_vehicle_share=0.6).aborts == []


@pytest.mark.parametrize("name, figures, sources", [
    ("one source on its own is never enough", figures_from(["source_a"], [950]), SOURCES),
    ("one source past the bound and two exact", figures_from(["source_a", "source_b", "source_c"], [950, 1040, 1040]), SOURCES),
    ("two sources the opposite way", figures_from(["source_a", "source_b"], [950, 1100]), SOURCES),
    ("each exactly on the hard bound", figures_from(["source_a", "source_b", "source_c"], [1000, 1000, 1000]), SOURCES),
    ("each just inside the bound", figures_from(["source_a", "source_b", "source_c"], [1001, 1002, 1003]), SOURCES),
    ("different months",
     [figure_row(source="source_a", figure="950", month="2026-02"), figure_row(source="source_b", figure="1400", month="2026-03"),
      figure_row(source="source_c", figure="480", month="2026-01")], SOURCES),
    ("a copy of our own export is not counted", figures_from(["source_a", "source_d"], [950, 970]), SOURCES),
    ("one source restating every month of its history, the others exact",
     [figure_row(source="source_a", figure=str(t), month=m) for m, t in (("2026-01", 400), ("2026-02", 800), ("2026-03", 1200))]
     + [figure_row(source=s, figure=str(TOTAL[m]), month=m) for s in ("source_b", "source_c") for m in TOTAL], SOURCES),
    ("one source restating many figures at once", [figure_row(source="source_a", figure="950", measure_as_published=f"Measure {i}") for i in range(6)], SOURCES),
])
def test_cases_that_must_not_fail_the_build(tmp_path, name, figures, sources):
    result = fails(tmp_path, figures, sources)
    assert result.aborts == [], name
    assert "fail" not in {r["status"] for r in result.document["rows"]}, name


def test_a_month_with_compared_rows_from_fewer_than_two_independent_sources_cannot_stop_a_build(tmp_path):
    # Source B's row for the month is a hidden cell, and Source C's names a month we do not hold: only Source A is compared.
    figures = [figure_row(source="source_a", month="2026-03", figure="1000"),
               figure_row(source="source_b", month="2026-03", dataset=FLEET, figure="1", filters='{"vehicle_usage": ["fixture_y"]}'),
               figure_row(source="source_c", month="2026-06", figure="970")]
    result = fails(tmp_path, figures)
    assert result.aborts == []
    assert by_source(result) == {"source_a": ["warn"], "source_b": ["not_compared"], "source_c": ["not_compared"]}


def test_sources_that_are_not_compared_do_not_count_either_way(tmp_path):
    # Two sources past the bound and a third that is not compared: the third is not one of the sources that have anything to say.
    held = figures_from(["source_a", "source_b"], [950, 960])
    unheld = figures_from(["source_c"], [970], month="2026-06")
    result = fails(tmp_path, held + unheld)
    assert len(result.aborts) == 1 and "2 of the 2 independent sources compared" in result.aborts[0]
    assert [r["status"] for r in result.document["rows"] if r["month"] == "2026-06"] == ["not_compared"]


def test_a_hidden_cell_is_not_a_breach(tmp_path):
    hidden = [figure_row(source=s, dataset=FLEET, month="2026-03", figure="1", filters='{"vehicle_usage": ["fixture_y"]}')
              for s in ("source_a", "source_b", "source_c")]
    result = fails(tmp_path, hidden)
    assert result.aborts == [] and {r["status"] for r in result.document["rows"]} == {"not_compared"}


def test_the_numbers_of_the_rule_are_config(tmp_path):
    figures = figures_from(["source_a", "source_b", "source_c"], [950, 960, 970])
    assert len(fails(tmp_path, figures).aborts) == 1
    assert len(fails(tmp_path, figures, min_sources=3).aborts) == 1
    assert fails(tmp_path, figures, min_sources=4).aborts == []
    assert fails(tmp_path, figures, tolerance_multiple=5).aborts == []
    assert fails(tmp_path, figures, floor_pct=15).aborts == []


def test_a_tight_tolerance_cannot_make_a_small_gap_a_breach(tmp_path):
    # With a tolerance of 0.1% the hard bound would be 0.2%; the floor holds it at 2%, and ours is 1040 against 1030 (0.97%).
    figures = figures_from(["source_a", "source_b", "source_c"], [1030, 1030, 1030], tolerance_pct="0.1")
    result = fails(tmp_path, figures)
    assert result.aborts == []
    assert {r["status"] for r in result.document["rows"]} == {"warn"}
    assert result.document["rows"][0]["hard_bound_pct"] == 2.0


# --- the single-figure limit -----------------------------------------------------------------------------------------------
# One compared row of a listed kind, of an independent source, stops the build when ours is 5% or more from theirs (config:
# single_figure_limit). The fixtures' own kinds are listed in cfg_for, so no test names a real one.

def exact(tmp_path, ours, figures, sources=SOURCES, single=None):
    """Our figure for one value of the series in 2026-02 is `ours`, so a test can put the gap exactly where it wants it."""
    staging, datasets = stage(tmp_path)
    con = duckdb.connect()
    write_slice(con, staging / "cube" / SERIES / "car_origin.parquet", [("2026-02", "fixture_x", ours, ours + 100)])
    con.close()
    cfg = cfg_for(tmp_path, figures, sources, single)
    prepared, problems = reconcile.prepare(cfg)
    assert problems == []
    return reconcile.run(duckdb.connect(), cfg, prepared, datasets, staging, "2026-03-31")


def one_value(theirs, **given):
    return figure_row(dataset=SERIES, filters='{"car_origin": ["fixture_x"]}', figure=str(theirs), figure_kind=LISTED, **given)


@pytest.mark.parametrize("ours, theirs, stops", [
    (1050, 1000, True),     # exactly 5% above theirs: the limit is inclusive
    (1049, 1000, False),    # one vehicle less
    (950, 1000, True),      # exactly 5% below theirs
    (951, 1000, False),
])
def test_exactly_the_limit_stops_the_build_and_one_vehicle_less_does_not_either_side(tmp_path, ours, theirs, stops):
    result = exact(tmp_path, ours, [one_value(theirs)])
    row = only_row(result)
    assert row["stops_alone_pct"] == 5
    assert (row["status"], len(result.aborts)) == (("fail", 1) if stops else ("warn", 0))
    if stops:
        side = "+" if ours > theirs else "-"
        assert result.aborts[0].startswith(
            f"reconciliation: 2026-02: Source A: 'Measure one': ours is {ours:,} and theirs {theirs:,}, a gap of {side}5.00%, which is 5% or "
            f"more on a figure of kind 'fixture_listed':")
        assert result.aborts[0].endswith("reconciliation.json in the staged files has every row")
        # The source's warning line counts a failed row as past its tolerance, as it counts a warned one.
        assert result.warnings == [f"reconciliation: Source A: 1 of 1 compared figures are past their tolerance, in 2026-02; "
                                   f"the largest gap is {side}5.00% (2026-02)"]


def test_one_source_alone_in_a_month_is_enough_whatever_the_others_say(tmp_path):
    # Source A is 5.05% under ours, on its own; Sources B and C are exact. The hard limit would need two of the three.
    result = fails(tmp_path, [figure_row(source="source_a", figure="990", figure_kind=LISTED),
                              figure_row(source="source_b", figure="1040", figure_kind=LISTED),
                              figure_row(source="source_c", figure="1040", figure_kind=LISTED)])
    assert len(result.aborts) == 1 and "Source A" in result.aborts[0] and "independent sources compared" not in result.aborts[0]
    assert by_source(result) == {"source_a": ["fail"], "source_b": ["pass"], "source_c": ["pass"]}
    # The same on its own in its month, and with nothing else in the file.
    assert len(fails(tmp_path / "alone", [figure_row(figure="990", figure_kind=LISTED)]).aborts) == 1
    # Each of two rows of one source is a line of its own; the second kind the config lists counts as well.
    two = fails(tmp_path / "two", [figure_row(figure="990", figure_kind=LISTED),
                                   figure_row(figure="800", figure_kind=SECOND_LISTED, measure_as_published="Measure two",
                                              filters='{"import_status": ["fixture_new"]}', month="2026-02")])
    assert len(two.aborts) == 1, "800 is ours, exactly: only the first row is 5% or more out"
    both = fails(tmp_path / "both", [figure_row(figure="990", figure_kind=LISTED),
                                     figure_row(figure="700", figure_kind=SECOND_LISTED, measure_as_published="Measure two",
                                                filters='{"import_status": ["fixture_new"]}')])
    assert len(both.aborts) == 2 and "Measure one" in both.aborts[0] and "Measure two" in both.aborts[1]
    assert by_source(both) == {"source_a": ["fail", "fail"]}


def test_a_kind_the_config_does_not_list_never_stops_a_build_at_any_gap(tmp_path):
    for theirs in ("990", "100", "100000"):
        result = fails(tmp_path / theirs, [figure_row(figure=theirs, figure_kind="fixture_unlisted")])
        assert result.aborts == []
        row = only_row(result)
        assert (row["status"], row["stops_alone_pct"], row["figure_kind"]) == ("warn", None, "fixture_unlisted")


@pytest.mark.parametrize("tolerance", ["5", "5.0", "12", "15"])
def test_a_row_whose_own_tolerance_is_the_limit_or_more_is_exempt_and_must_say_why(tmp_path, tolerance):
    exempt = figure_row(figure="900", figure_kind=LISTED, tolerance_pct=tolerance, known_difference="Counts a van differently.")
    result = fails(tmp_path, [exempt])
    assert result.aborts == []
    row = only_row(result)
    assert (row["status"], row["stops_alone_pct"], row["gap_pct"]) == ("warn", None, 15.5556)
    # The same row with no known difference is refused before the register is read, and the message says what to add.
    problems = problems_of(tmp_path, [{**exempt, "known_difference": ""}])
    assert len(problems) == 1 and "published_figures.csv line 2 (" in problems[0], problems
    assert "single_figure_limit" in problems[0] and "known_difference must say why" in problems[0]
    # A kind the limit does not cover is not asked to say why.
    assert problems_of(tmp_path, [{**exempt, "known_difference": "", "figure_kind": "fixture_unlisted"}]) == []


def test_a_tolerance_just_under_the_limit_is_not_exempt(tmp_path):
    result = fails(tmp_path, [figure_row(figure="990", figure_kind=LISTED, tolerance_pct="4.99")])
    assert len(result.aborts) == 1 and only_row(result)["stops_alone_pct"] == 5


def test_a_source_that_is_not_independent_never_stops_a_build_alone(tmp_path):
    result = fails(tmp_path, [figure_row(source="source_d", figure="990", figure_kind=LISTED)])
    assert result.aborts == []
    row = only_row(result)
    assert (row["status"], row["stops_alone_pct"]) == ("warn", None)


def test_a_row_that_was_not_compared_never_stops_a_build_but_the_rule_still_applies_to_it(tmp_path):
    result = fails(tmp_path, [figure_row(month="2026-06", figure="1", figure_kind=LISTED),
                              figure_row(dataset=SURVIVING, measure_as_published="Measure two", figure="1", figure_kind=LISTED),
                              figure_row(dataset=FLEET, month="2026-03", figure="1", measure_as_published="Measure three",
                                         filters='{"vehicle_usage": ["fixture_y"]}', figure_kind=LISTED)])
    assert result.aborts == []
    assert [(r["status"], r["stops_alone_pct"], r["gap"]) for r in result.document["rows"]] == [("not_compared", 5, None)] * 3


def test_a_kind_nobody_listed_is_refused_so_a_misspelling_cannot_fall_out_of_the_limit(tmp_path):
    # One letter off a covered kind, on a row the limit would cover: before this check it was read, and never stopped a build.
    misspelt = [figure_row(figure="900", figure_kind=LISTED + "s")]
    problems = problems_of(tmp_path / "a", misspelt)
    assert len(problems) == 1 and "is not one of reconciliation.figure_kinds" in problems[0] and "line 2" in problems[0]
    assert reconcile.prepare(cfg_for(tmp_path / "b", misspelt, known=[*KNOWN_KINDS, LISTED + "s"]))[1] == []
    for n, known in enumerate(([], "fixture_other", [LISTED, LISTED], ["Fixture Kind"], None)):
        cfg = cfg_for(tmp_path / f"c{n}", [])
        cfg.pipeline["reconciliation"]["figure_kinds"] = known
        assert any("reconciliation.figure_kinds must be a list of distinct ids" in p for p in reconcile.prepare(cfg)[1]), known


def test_a_tolerance_with_more_digits_than_the_file_states_is_read_the_same_way_by_the_check_and_the_rule(tmp_path):
    # 4.99...9 is below 5 exactly and is 5.0 as reconciliation.json states it, where the row is exempt: so it needs a known difference.
    row = figure_row(figure="900", figure_kind=LISTED, tolerance_pct="4.9999999999999999999")
    assert len(problems_of(tmp_path / "a", [row])) == 1
    assert problems_of(tmp_path / "b", [{**row, "known_difference": "A made-up known difference."}]) == []


def test_the_numbers_of_the_single_figure_limit_are_config(tmp_path):
    figures = [figure_row(figure="990", figure_kind=LISTED)]                      # 5.05% under
    wide = [figure_row(figure="900", figure_kind=LISTED)]                         # 15.6% under
    assert len(fails(tmp_path / "a", figures).aborts) == 1
    assert fails(tmp_path / "b", figures, single={"gap_pct": 6}).aborts == []
    assert len(fails(tmp_path / "c", wide, single={"gap_pct": 6}).aborts) == 1
    assert fails(tmp_path / "d", wide, single={"gap_pct": 16}).aborts == []
    assert len(fails(tmp_path / "e", figures, single={"gap_pct": 5.05}).aborts) == 1, "5.05% of 990 is 49.995 vehicles: 50 is more"
    # The limit is also the tolerance at which a row is exempt: 5 is exempt at 5 and not at 6.
    five = [figure_row(figure="900", figure_kind=LISTED, tolerance_pct="5")]
    assert problems_of(tmp_path / "f", five)[0].startswith("published_figures.csv line 2")
    assert reconcile.prepare(cfg_for(tmp_path / "g", five, single={"gap_pct": 6}))[1] == []
    assert len(fails(tmp_path / "h", five, single={"gap_pct": 6}).aborts) == 1
    # Which kinds are covered is config: another kind, and none (an empty list switches the rule off).
    assert fails(tmp_path / "i", figures, single={"kinds": ["fixture_other"]}).aborts == []
    other = [figure_row(figure="990", figure_kind="fixture_other")]
    assert len(fails(tmp_path / "j", other, single={"kinds": ["fixture_other"]}).aborts) == 1
    off = fails(tmp_path / "k", figures, single={"kinds": []})
    assert off.aborts == [] and only_row(off)["stops_alone_pct"] is None
    assert problems_of(tmp_path / "l", [figure_row(figure="900", figure_kind=LISTED, tolerance_pct="12")]) != []
    assert reconcile.prepare(cfg_for(tmp_path / "m", [figure_row(figure="900", figure_kind=LISTED, tolerance_pct="12")], single={"kinds": []}))[1] == []


def test_the_hard_limit_is_unchanged_by_the_single_figure_limit(tmp_path):
    # Two sources 9.5% and 8.3% over, of an unlisted kind: the hard limit stops the build exactly as before.
    result = fails(tmp_path, figures_from(["source_a", "source_b"], [950, 960]))
    assert len(result.aborts) == 1 and "2 of the 2 independent sources compared" in result.aborts[0]
    # And a listed kind past both limits has the month's line and its own.
    both = fails(tmp_path / "both", figures_from(["source_a", "source_b"], [950, 960], figure_kind=LISTED))
    assert len(both.aborts) == 3 and "2 of the 2 independent sources compared" in both.aborts[0]
    assert {r["status"] for r in both.document["rows"]} == {"fail"}


# --- a source restating its own figure (D-153) ------------------------------------------------------------------------------
# The row holds the new figure in `figure` and the figure the same source published earlier in `restated_from`. A restatement of
# `reconciliation.restatement_warn_pct` percent (of the earlier figure) or more warns and never stops the build; a gap between a
# source's figure and ours still does, except that on such a row ours must be `gap_pct` or more from both figures of the source.

def restated_run(tmp_path, ours, figures, warn=None, single=None):
    """As `exact`, with the size of restatement that warns set to `warn` when given."""
    staging, datasets = stage(tmp_path)
    con = duckdb.connect()
    write_slice(con, staging / "cube" / SERIES / "car_origin.parquet", [("2026-02", "fixture_x", ours, ours + 100)])
    con.close()
    cfg = cfg_for(tmp_path, figures, SOURCES, single)
    if warn is not None:
        cfg.pipeline["reconciliation"]["restatement_warn_pct"] = warn
    prepared, problems = reconcile.prepare(cfg)
    assert problems == []
    return reconcile.run(duckdb.connect(), cfg, prepared, datasets, staging, "2026-03-31")


@pytest.mark.parametrize("theirs, earlier, pct, flagged", [
    (1050, 1000, 5.0, True),      # exactly 5% of the earlier figure: the size is inclusive
    (950, 1000, -5.0, True),      # and either way
    (1049, 1000, 4.9, False),     # one vehicle less is recorded and not flagged
    (951, 1000, -4.9, False),
    (1000, 1100, -9.0909, True),  # a share of the earlier figure, not the new one: 100 of 1,100 is 9.09%, and of 1,000 would be 10%
])
def test_a_restatement_of_the_warning_size_warns_and_is_flagged_and_a_smaller_one_is_only_recorded(tmp_path, theirs, earlier, pct, flagged):
    # Ours equals the source's current figure, so nothing else is wrong: only the restatement can be said.
    result = restated_run(tmp_path, theirs, [one_value(theirs, restated_from=str(earlier))])
    row = only_row(result)
    assert (row["restated_from"], row["restated_pct"], row["restated_past_warning"]) == (earlier, pct, flagged)
    assert result.aborts == []
    if flagged:
        # A row that is within its tolerance is still never better than a warning.
        assert row["gap"] == 0 and row["status"] == "warn"
        assert len(result.warnings) == 1
        line = result.warnings[0]
        assert line.startswith("reconciliation: 2026-02: Source A: 'Measure one': the source restated this figure ")
        assert f"from {earlier:,} to {theirs:,}, {pct:+.2f}%" in line and "does not stop the build" in line
    else:
        assert (row["status"], result.warnings) == ("pass", [])


def test_the_size_that_warns_is_config_and_a_blank_restated_from_claims_nothing(tmp_path):
    figures = [one_value(1050, restated_from="1000")]
    assert only_row(restated_run(tmp_path / "a", 1050, figures))["restated_past_warning"] is True
    wide = restated_run(tmp_path / "b", 1050, figures, warn=5.01)
    assert (only_row(wide)["restated_past_warning"], wide.warnings) == (False, [])
    assert only_row(wide)["restated_pct"] == 5.0, "the percentage is recorded whatever the size"
    assert only_row(restated_run(tmp_path / "c", 1050, figures, warn=5))["restated_past_warning"] is True
    assert wide.document["summary"]["thresholds"]["restatement_warn_pct"] == 5.01
    blank = only_row(restated_run(tmp_path / "d", 1050, [one_value(1050)]))
    assert (blank["restated_from"], blank["restated_pct"], blank["restated_past_warning"], blank["status"]) == (None, None, False, "pass")


@pytest.mark.parametrize("value", [0, -5, 101, True, "5", None, float("nan"), 10 ** 400])
def test_the_size_of_restatement_that_warns_is_checked_with_a_message_not_a_traceback(tmp_path, value):
    cfg = cfg_for(tmp_path, [])
    cfg.pipeline["reconciliation"]["restatement_warn_pct"] = value
    problems = reconcile.prepare(cfg)[1]
    assert len(problems) == 1 and problems[0].startswith("reconciliation.restatement_warn_pct must be a number above 0 and at most 100"), problems
    del cfg.pipeline["reconciliation"]["restatement_warn_pct"]
    assert len(reconcile.prepare(cfg)[1]) == 1


def test_a_restated_row_with_ours_near_the_earlier_figure_does_not_stop_the_build_and_without_the_earlier_figure_it_does(tmp_path):
    # The source now says 1,060 and said 1,000 before; ours is 1,000: 5.66% under the new figure, and exactly the old one.
    restated = restated_run(tmp_path / "a", 1000, [one_value(1060, restated_from="1000")])
    row = only_row(restated)
    assert (row["gap_pct"], row["restated_pct"], row["stops_alone_pct"]) == (-5.6604, 6.0, 5)
    assert restated.aborts == [] and row["status"] == "warn"
    line = next(w for w in restated.warnings if "restated" in w)
    assert "from 1,000 to 1,060, +6.00%" in line
    assert "ours is 1,000, -5.66% from the new figure and +0.00% from the earlier one, so the single-figure limit did not stop the build" in line
    # The same row with the earlier figure blank is judged as it always was.
    plain = restated_run(tmp_path / "b", 1000, [one_value(1060)])
    assert len(plain.aborts) == 1 and only_row(plain)["status"] == "fail" and plain.warnings[0].startswith("reconciliation: Source A: 1 of 1")
    assert not any("restated" in w for w in plain.warnings)


@pytest.mark.parametrize("ours, stops, excused", [
    (1176, True, False),    # exactly 5% over the new figure (inclusive), and 17.6% over the earlier one
    (900, True, False),     # under both
    (1050, True, False),    # exactly 5% over the earlier figure (inclusive), and 6.25% under the new one
    (950, True, False),     # exactly 5% under the earlier figure
    (1049, False, True),    # one vehicle less: within the limit of the earlier figure
    (1000, False, True),    # exactly the earlier figure
    (960, False, True),     # 4% under the earlier figure, 14.3% under the new one
    (951, False, True),
    (1130, False, False),   # within the limit of the new figure: nothing to excuse
])
def test_a_restated_row_stops_the_build_only_when_ours_is_the_limit_or_more_from_both_figures(tmp_path, ours, stops, excused):
    result = restated_run(tmp_path, ours, [one_value(1120, restated_from="1000")])
    row = only_row(result)
    assert row["restated_past_warning"] is True
    assert (row["status"], len(result.aborts)) == (("fail", 1) if stops else ("warn", 0)), (ours, result.aborts)
    # The restatement is warned about either way.
    assert any("the source restated this figure from 1,000 to 1,120, +12.00%" in w for w in result.warnings)
    assert any("so the single-figure limit did not stop the build" in w for w in result.warnings) == excused
    if stops:
        assert "one such figure from an independent source stops the build" in result.aborts[0]


def test_a_restatement_smaller_than_the_warning_size_does_not_excuse_the_row(tmp_path):
    # 4.31% of the earlier figure: recorded and not flagged, so ours (1,000, 6.02% under the new figure) is judged as before.
    result = restated_run(tmp_path, 1000, [one_value(1064, restated_from="1020")])
    row = only_row(result)
    assert (row["restated_pct"], row["restated_past_warning"], row["status"], len(result.aborts)) == (4.3137, False, "fail", 1)


def test_a_restated_row_of_a_kind_the_limit_does_not_cover_is_still_only_a_warning(tmp_path):
    result = restated_run(tmp_path, 1000, [figure_row(dataset=SERIES, filters='{"car_origin": ["fixture_x"]}', figure="1064",
                                                      restated_from="1000", tolerance_pct="2")])
    row = only_row(result)
    assert (row["stops_alone_pct"], row["status"], result.aborts) == (None, "warn", [])
    assert len(result.warnings) == 2, "its tolerance warning and its restatement"


def test_a_restated_figure_that_was_not_compared_is_warned_about_and_stays_not_compared(tmp_path):
    result = fails(tmp_path, [one_value(1064, month="2026-06", restated_from="1000")])
    row = only_row(result)
    assert (row["status"], row["restated_past_warning"], result.aborts) == ("not_compared", True, [])
    lines = [w for w in result.warnings if "restated" in w]
    assert len(lines) == 1 and "from 1,000 to 1,064" in lines[0] and "ours is" not in lines[0]


def test_the_hard_limit_still_counts_a_restated_row_against_its_current_figure(tmp_path):
    # Two sources 9.5% and 8.3% under ours, each having restated to that figure from ours: the hard limit stops the build as before,
    # and the single-figure limit is excused on both rows (ours is exactly the earlier figure), so the month's line is the only one.
    both = figures_from(["source_a", "source_b"], [950, 960], figure_kind=LISTED, restated_from="1040")
    result = fails(tmp_path, both)
    assert len(result.aborts) == 1 and "2 of the 2 independent sources compared" in result.aborts[0]
    assert {r["status"] for r in result.document["rows"]} == {"fail"}
    assert sum("the source restated this figure" in w for w in result.warnings) == 2
    # Without the earlier figures the same rows give the month's line and one for each figure.
    plain = fails(tmp_path / "plain", figures_from(["source_a", "source_b"], [950, 960], figure_kind=LISTED))
    assert len(plain.aborts) == 3


def test_the_restatement_and_the_source_s_own_warning_line_are_kept_apart(tmp_path):
    # Within its tolerance, a restated row is a warn status but not one of the figures "past their tolerance".
    result = restated_run(tmp_path, 1050, [one_value(1050, restated_from="1000", tolerance_pct="2")])
    assert only_row(result)["status"] == "warn"
    assert len(result.warnings) == 1 and "restated" in result.warnings[0] and "past their tolerance" not in result.warnings[0]
    assert result.document["summary"]["by_status"] == {"pass": 0, "warn": 1, "fail": 0, "not_compared": 0}


def test_a_build_prints_the_restatement_and_goes_on(tmp_path, workspace):
    figures = [figure_row(dataset=SURVIVING, month="2026-08", figure="9", restated_from="10", tolerance_pct="20")]
    cfg, manifest = build_with(tmp_path, workspace, figures, SOURCES)
    assert any("the source restated this figure from 10 to 9, -10.00%" in w for w in manifest["warnings"]), manifest["warnings"]


# --- the hard limit over the live published figures -------------------------------------------------------------------------
# These read the real data/reference/published_figures.csv and put our figure beside each row's, scaled, through the real judge,
# finish and hard_limit, to show what size of error stops a build on the rows that are committed. No source is named here:
# the sources are whatever published_sources.csv holds. A month's sources are the sources that have a row for it. Two rules stop a
# build and each writes its own kind of line: the hard limit one line for a month, the single-figure limit one for a figure.

def live_setup():
    cfg = config.load()
    prepared, problems = reconcile.prepare(cfg)
    assert problems == []
    c, _ = reconcile.settings(cfg)
    h = c["hard_limit"]
    months: dict[str, set[str]] = {}
    for f in prepared.figures:
        months.setdefault(f.month, set()).add(f.source)
    return cfg, prepared, c, (Decimal(str(h["tolerance_multiple"])), Decimal(str(h["floor_pct"])), int(c["pct_decimals"])), months


def live_aborts(ours, kinds=None, left_out=None) -> list[str]:
    """The aborts the real step raises when our figure for each live row is ours(figure). `kinds` replaces the kinds the
    single-figure limit covers: [] shows what the hard limit alone does. A row `left_out` picks is not compared, as if the
    source had published nothing our data can answer."""
    cfg, prepared, c, (multiple, floor, decimals), _ = live_setup()
    if kinds is not None:
        c = copy.deepcopy(c)
        c["single_figure_limit"]["kinds"] = kinds

    def answer(f):
        if left_out is not None and left_out(f):
            return reconcile.Answer(None, reconcile.DATASET_NOT_BUILT, "left out of this test")
        return reconcile.Answer(int(round(ours(f))))
    judged = [reconcile.judge(f, answer(f), multiple, floor, decimals) for f in prepared.figures]
    return reconcile.finish(prepared, judged, c, [], "fixture").aborts


def month_lines(aborts) -> list[str]:
    """The lines of the hard limit: one for each month and side."""
    return [a for a in aborts if "independent sources compared" in a]


def figure_lines(aborts) -> list[str]:
    """The lines of the single-figure limit: one for each figure."""
    return [a for a in aborts if "one such figure from an independent source" in a]


def stopped_months(aborts) -> set[str]:
    return {a.split(": ")[1] for a in aborts}


def rows_the_single_figure_limit_covers(source=None) -> list:
    """The live rows it applies to: a listed kind, an independent source, a tolerance below the limit."""
    _, prepared, c, _, _ = live_setup()
    limit, kinds = Decimal(str(c["single_figure_limit"]["gap_pct"])), set(c["single_figure_limit"]["kinds"])
    return [f for f in prepared.figures if f.figure_kind in kinds and prepared.sources[f.source].independent and f.tolerance < limit
            and source in (None, f.source)]


def live_month_with(count: int) -> str:
    months = live_setup()[4]
    found = sorted(m for m, sources in months.items() if len(sources) == count)
    assert found, f"no month of the live rows has exactly {count} sources, so this test proves nothing"
    return found[0]


@pytest.mark.parametrize("count", [3, 2])
@pytest.mark.parametrize("scale", [1.05, 0.94, 1.03, 0.97])
def test_live_rows_a_few_percent_error_in_a_month_stops_the_build_when_two_or_three_sources_have_rows(count, scale):
    # Every month of the live rows has three sources, so a month of two is made from one of three: each choice of `count` of
    # its sources is compared, and the rows of the rest are not.
    month = live_month_with(3)
    sources = sorted(live_setup()[4][month])
    for kept in itertools.combinations(sources, count):
        aborts = live_aborts(lambda f: f.figure * scale if f.month == month else f.figure,
                             left_out=lambda f: f.month == month and f.source not in kept)
        # The hard limit's line for the month is one, at 5% as at 3%; at 5% some figures also stop the build alone.
        assert len(month_lines(aborts)) == 1, kept


def test_live_rows_the_smallest_uniform_error_that_stops_every_month_is_about_two_percent_either_way():
    months = live_setup()[4]
    assert len(months) >= 20
    for scale in (1.021, 0.979):
        assert len(month_lines(live_aborts(lambda f: f.figure * scale))) == len(months), scale
    for scale in (1.015, 0.985):
        assert live_aborts(lambda f: f.figure * scale) == [], scale


def test_live_rows_an_error_in_every_figure_stops_figures_alone_from_five_percent_and_all_of_them_by_six():
    months = live_setup()[4]
    covered = rows_the_single_figure_limit_covers()
    assert len(covered) > 50
    for scale in (1.049, 0.96):
        assert figure_lines(live_aborts(lambda f: f.figure * scale)) == [], scale
    for scale in (1.05, 0.95):
        # On the edge, our figure's rounding decides which figures are 5% or more away.
        lines = figure_lines(live_aborts(lambda f: f.figure * scale))
        assert 0 < len(lines) < len(covered) and stopped_months(lines) == set(months), scale
    for scale in (1.06, 0.94):
        lines = figure_lines(live_aborts(lambda f: f.figure * scale))
        assert len(lines) == len(covered) and stopped_months(lines) == set(months), scale


def test_live_rows_a_source_restated_ten_percent_either_way_in_every_month_does_not_stop_a_build_by_the_hard_limit():
    sources = live_setup()[1].sources
    assert len(sources) >= 3
    for source in sources:
        for restated in (1.10, 0.90):
            # Their figure is 10% higher (or lower) than before and ours is what it was.
            assert live_aborts(lambda f: f.figure / restated if f.source == source else f.figure, kinds=[]) == [], (source, restated)
            assert month_lines(live_aborts(lambda f: f.figure / restated if f.source == source else f.figure)) == [], (source, restated)


def test_live_rows_a_source_restated_ten_percent_either_way_stops_a_build_through_the_single_figure_limit_in_each_month_it_has_a_row_it_covers():
    # Before D-150 this did not stop a build: one source is never enough for the hard limit. Now each of its figures of a covered kind
    # stops the build alone, so the months stopped are exactly the months in which the source has such a row.
    sources = live_setup()[1].sources
    for source in sources:
        covered = rows_the_single_figure_limit_covers(source)
        assert covered, f"{source} has no row the limit covers, so this proves nothing about it"
        for restated in (1.10, 0.90):
            aborts = live_aborts(lambda f: f.figure / restated if f.source == source else f.figure)
            assert len(figure_lines(aborts)) == len(covered) == len(aborts), (source, restated)
            assert stopped_months(aborts) == {f.month for f in covered}, (source, restated)


def test_live_rows_five_percent_of_the_passenger_vehicles_counted_as_commercial_stops_a_build_in_every_month():
    cfg, prepared, _, _, months = live_setup()
    scope = cfg.pipeline["scope"]["vehicle"]
    true = cfg.pipeline["boolean_true"]
    types = [r for r in reference.read(cfg.reference(scope["file"])) if r[scope["in_scope"]] == true]
    # The first two in-scope types of the scope file: the register's passenger vehicles, and the goods vehicles they are mistaken for.
    passenger, commercial = types[0], types[1]
    assert passenger["trade_group"] != commercial["trade_group"]

    def kind(f):
        held = dict(f.filters)
        if held.get("vehicle_type") == (passenger["label"],):
            return "first"
        if held.get("vehicle_type") == (commercial["label"],) or held.get("trade_group") == (commercial["trade_group"],):
            return "second"
        return None

    weight: dict[tuple[str, str], int] = {}
    for f in prepared.figures:
        if kind(f) == "first":
            weight[(f.source, f.month)] = weight.get((f.source, f.month), 0) + f.figure
    assert {k for k in map(kind, prepared.figures)} == {"first", "second", None}, "the live rows must hold both kinds"

    def moved(f):
        k = kind(f)
        if k == "first":
            return f.figure * 0.95
        if k == "second":
            return f.figure + 0.05 * weight.get((f.source, f.month), 0)
        return f.figure

    three = live_month_with(3)
    assert len(month_lines(live_aborts(lambda f: moved(f) if f.month == three else f.figure))) == 1
    assert "ours is below theirs" in month_lines(live_aborts(lambda f: moved(f) if f.month == three else f.figure))[0]
    assert len(month_lines(live_aborts(moved))) == len(months)
    # The same fault is also 5% of a passenger figure, so it stops the build alone wherever rounding leaves it at 5% or more.
    assert stopped_months(live_aborts(moved)) == set(months)


def live_new_vehicles_only(share):
    """Our figure for each live row when `share` of the first import status's passenger vehicles are counted as commercial, and the
    other import statuses are right. How many that is in a month is the figure of the first live row of that month that asks for
    exactly those vehicles. A row that does not ask for the first status (or any status) is not moved."""
    cfg, prepared, _, _, months = live_setup()
    scope, status = cfg.pipeline["scope"]["vehicle"], cfg.pipeline["scope"]["status"]
    true = cfg.pipeline["boolean_true"]
    types = [r for r in reference.read(cfg.reference(scope["file"])) if r[scope["in_scope"]] == true]
    passenger, commercial = types[0], types[1]
    first = reference.read(cfg.reference(status["file"]))[0][status["field"]]
    wanted = {"import_status": (first,), "vehicle_type": (passenger["label"],)}
    moved_in: dict[str, int] = {}
    for f in prepared.figures:
        if dict(f.filters) == wanted:
            moved_in.setdefault(f.month, f.figure)
    assert set(moved_in) == set(months), "every live month needs a row for the first status's passenger vehicles"

    def ours(f):
        held = dict(f.filters)
        if "import_status" in held and first not in held["import_status"]:
            return f.figure
        if held.get("vehicle_type") == (passenger["label"],):
            return f.figure - share * moved_in[f.month]
        if held.get("vehicle_type") == (commercial["label"],) or held.get("trade_group") == (commercial["trade_group"],):
            return f.figure + share * moved_in[f.month]
        return f.figure
    return ours


def test_live_rows_a_fault_among_new_vehicles_only_is_stopped_by_the_hard_limit_in_few_months_and_alone_from_five_percent_up():
    # The review of 2026-11-23 found that this fault only warned: one source's figure that takes in the new vehicles breached,
    # and one source is never enough for the hard limit. The hard limit still misses it in most months: it stops only a month
    # in which a second source published so little else that these vehicles are half of what it published. The single-figure
    # limit (D-150) stops it wherever a figure of a covered kind is 5% or more from ours.
    _, prepared, c, _, months = live_setup()
    h = c["hard_limit"]

    def exposed(ours) -> set[str]:
        """The months in which enough sources for the hard limit each have their share of what they published in figures this
        fault lowers: there the fault looks, to the hard limit, like separate counts agreeing against ours."""
        lowered: dict[tuple[str, str], int] = {}
        published: dict[tuple[str, str], int] = {}
        for f in prepared.figures:
            published[(f.month, f.source)] = published.get((f.month, f.source), 0) + f.figure
            if ours(f) < f.figure:
                lowered[(f.month, f.source)] = lowered.get((f.month, f.source), 0) + f.figure
        sources: dict[str, set[str]] = {}
        for (month, source), weight in lowered.items():
            if weight >= h["source_vehicle_share"] * published[(month, source)]:
                sources.setdefault(month, set()).add(source)
        return {month for month, found in sources.items() if len(found) >= h["min_sources"]}

    by_hard, alone = {}, {}
    for share in (0.02, 0.05, 0.10, 0.20):
        ours = live_new_vehicles_only(share)
        by_hard[share] = stopped_months(live_aborts(ours, kinds=[]))
        if share >= 0.05:
            # From 5% every lowered figure is past its hard bound, so the hard limit stops exactly the exposed months.
            assert by_hard[share] == exposed(ours) != set(), share
        aborts = live_aborts(ours)
        assert stopped_months(month_lines(aborts)) == by_hard[share], "the hard limit is the same with the single-figure limit on"
        assert len(month_lines(aborts)) + len(figure_lines(aborts)) == len(aborts), share
        alone[share] = stopped_months(figure_lines(aborts))
    assert by_hard[0.02] == set()
    assert all(len(by_hard[share]) < len(months) / 2 for share in by_hard), "the hard limit alone misses this fault in most months"
    assert alone[0.10] == alone[0.20] == set(months)
    assert by_hard[0.05] < alone[0.05] and len(alone[0.05]) > len(months) / 2
    assert alone[0.02] < alone[0.05]


STAGED = config.ROOT / "data" / "staging" / "build" / "reconciliation.json"


@pytest.mark.skipif(not STAGED.exists(), reason="needs the reconciliation.json of a dry-run build of the saved pull (data/staging, not committed)")
def test_live_rows_against_the_figures_of_a_dry_run_build_do_not_stop_it():
    cfg, prepared, c, (multiple, floor, decimals), _ = live_setup()
    staged = {(r["source"], r["month"], r["measure_as_published"], json.dumps(r["filters"], sort_keys=True)): r
              for r in json.loads(STAGED.read_text(encoding="utf-8"))["rows"]}
    judged = []
    for f in prepared.figures:
        row = staged.get((f.source, f.month, f.measure, json.dumps({d: list(v) for d, v in f.filters}, sort_keys=True)))
        if row is None or row["ours"] is None:
            continue
        judged.append(reconcile.judge(f, reconcile.Answer(row["ours"]), multiple, floor, decimals))
    assert len(judged) > 300, "the staged file does not hold the live rows"
    again = reconcile.finish(prepared, judged, c, [], "fixture")
    assert again.aborts == []
    # Run again over the answers the build read, the step judges every compared row as the build did.
    built = json.loads(STAGED.read_text(encoding="utf-8"))["summary"]["by_status"]
    assert {k: again.entry["by_status"][k] for k in ("pass", "warn", "fail")} == {k: built[k] for k in ("pass", "warn", "fail")}


# --- the document ----------------------------------------------------------------------------------------------------------

def test_the_document_gives_the_site_everything_it_needs(tmp_path):
    figures = [figure_row(source="source_b", month="2026-03", figure="1250", filters='{"import_status": ["fixture_new"]}',
                          added_up_from="made up table", figure_kind=LISTED),
               figure_row(source="source_a", month="2026-02", figure="1040"), figure_row(source="source_a", month="2027-01")]
    result = reconcile_figures(tmp_path, figures)
    doc = json.loads(json.dumps(result.document))
    assert list(doc) == ["latest_snapshot", "sources", "summary", "rows"]
    assert doc["latest_snapshot"] == "2026-03-31"
    assert doc["sources"]["source_b"] == {"name": "Source B", "home_url": "https://b.example", "independent": True,
                                          "definition": "B counts what B counts.", "definition_date_read": "2026-11-01",
                                          "data_basis": "its own count"}
    assert doc["sources"]["source_a"]["definition"] is None and doc["sources"]["source_d"]["independent"] is False
    # A basis nobody stated is null, not an empty string.
    assert doc["sources"]["source_a"]["data_basis"] is None
    # What a figure was added up from is a string, or null for a figure the source prints itself.
    assert [r["added_up_from"] for r in doc["rows"]] == [None, "made up table", None]
    summary = doc["summary"]
    assert summary["rows"] == 3 and summary["months"] == {"first": "2026-02", "last": "2027-01"}
    assert summary["by_status"] == {"pass": 1, "warn": 1, "fail": 0, "not_compared": 1}
    assert summary["by_source"]["source_a"] == {"rows": 2, "pass": 1, "warn": 0, "fail": 0, "not_compared": 1}
    assert summary["by_source"]["source_c"] == {"rows": 0, "pass": 0, "warn": 0, "fail": 0, "not_compared": 0}
    assert summary["thresholds"] == {"max_tolerance_pct": 20, "hard_limit_tolerance_multiple": 2, "hard_limit_floor_pct": 2,
                                     "hard_limit_min_sources": 2, "hard_limit_source_vehicle_share": 0.5,
                                     "single_figure_gap_pct": 5, "single_figure_kinds": [LISTED, SECOND_LISTED],
                                     "restatement_warn_pct": 5}
    # The kind is on every row, and the limit on the rows it applies to: a listed kind of an independent source.
    assert [(r["figure_kind"], r["stops_alone_pct"]) for r in doc["rows"]] == [("fixture_other", None), (LISTED, 5), ("fixture_other", None)]
    assert [(r["month"], r["source"]) for r in doc["rows"]] == [("2026-02", "source_a"), ("2026-03", "source_b"), ("2027-01", "source_a")]
    assert set(doc["rows"][0]) == {"source", "month", "measure_as_published", "dataset", "filters", "ours", "theirs", "gap", "gap_pct",
                                   "tolerance_pct", "hard_bound_pct", "known_difference", "added_up_from", "figure_kind", "stops_alone_pct",
                                   "restated_from", "restated_pct", "restated_past_warning", "status", "reason_kind", "reason", "source_url",
                                   "date_read"}
    # No figure was restated: nothing is claimed about one.
    assert [(r["restated_from"], r["restated_pct"], r["restated_past_warning"]) for r in doc["rows"]] == [(None, None, False)] * 3
    assert not any(k.startswith("_") for r in doc["rows"] for k in r)
    assert result.entry == {"file": "reconciliation.json", "rows": 3, "by_status": summary["by_status"], "months": summary["months"]}


def test_the_order_of_the_rows_does_not_depend_on_the_order_of_the_file(tmp_path):
    figures = [figure_row(month="2026-03", figure="1560"), figure_row(month="2026-01", figure="520"), figure_row(month="2026-02")]
    forward = reconcile_figures(tmp_path / "f", figures).document
    backward = reconcile_figures(tmp_path / "b", figures[::-1]).document
    assert forward == backward


# --- in a build ------------------------------------------------------------------------------------------------------------

def build_with(tmp_path, workspace, figures, sources):
    """A fixture build whose reference folder has the given published rows."""
    reference = tmp_path / "reference"
    shutil.copytree(config.load().reference("x").parent, reference)
    write_reference(tmp_path, figures, sources)
    rows = load_rows()
    cfg = make_cfg(workspace, reference_dir=reference)
    # The fixture rows state fixture kinds, as in cfg_for.
    cfg.pipeline = copy.deepcopy(cfg.pipeline)
    cfg.pipeline["reconciliation"]["single_figure_limit"]["kinds"] = [LISTED, SECOND_LISTED]
    cfg.pipeline["reconciliation"]["figure_kinds"] = list(KNOWN_KINDS)
    return cfg, build.build(cfg, source_for(rows), write_pages(tmp_path / "pages", rows), None, NOW)


def test_a_build_checks_what_it_is_about_to_publish_and_lists_the_file_in_the_manifest(tmp_path, workspace):
    figures = [figure_row(dataset=SURVIVING, month="2026-08", figure="1", source="source_a"),
               figure_row(dataset=SURVIVING, month="2026-09", figure="1", source="source_a", measure_as_published="Measure two"),
               figure_row(dataset=FLOW, month="2026-08", figure="1", source="source_b")]
    cfg, manifest = build_with(tmp_path, workspace, figures, SOURCES)
    public = workspace["public"]
    doc = json.loads((public / "reconciliation.json").read_text(encoding="utf-8"))
    assert manifest["reconciliation"] == {"file": "reconciliation.json", "rows": 3, "by_status": {"pass": 0, "warn": 1, "fail": 0, "not_compared": 2},
                                          "months": {"first": "2026-08", "last": "2026-09"}}
    assert doc["latest_snapshot"] == manifest["latest_snapshot"]
    by_measure = {(r["dataset"], r["month"]): r for r in doc["rows"]}
    # Ours is read back from the published fact table.
    con = duckdb.connect()
    facts = (public / "facts" / SURVIVING).as_posix()
    published = con.execute(f"SELECT sum(a.n) FROM read_parquet('{facts}/n.parquet', file_row_number = true) a JOIN "
                            f"read_parquet('{facts}/month.parquet', file_row_number = true) b USING (file_row_number) "
                            "WHERE b.month = DATE '2026-08-01'").fetchone()[0]
    assert by_measure[(SURVIVING, "2026-08")]["ours"] == published > 1
    assert by_measure[(SURVIVING, "2026-09")]["reason_kind"] == "month_not_held"
    assert by_measure[(FLOW, "2026-08")]["reason_kind"] == "dataset_not_built"
    assert [w for w in manifest["warnings"] if w.startswith("reconciliation:")] == [
        f"reconciliation: Source A: 1 of 1 compared figures are past their tolerance, in 2026-08; the largest gap is "
        f"{by_measure[(SURVIVING, '2026-08')]['gap_pct']:+.2f}% (2026-08)"]


def test_a_build_stops_when_three_independent_sources_disagree_with_it_the_same_way(tmp_path, workspace):
    figures = [figure_row(dataset=SURVIVING, month="2026-08", figure="1", source=s) for s in ("source_a", "source_b", "source_c")]
    with pytest.raises(GuardrailError) as stopped:
        build_with(tmp_path, workspace, figures, SOURCES)
    assert "reconciliation: 2026-08: 3 of the 3 independent sources compared" in str(stopped.value)
    assert not (workspace["public"] / "manifest.json").exists(), "nothing is published"


def test_a_build_stops_on_one_figure_of_a_kind_the_single_figure_limit_covers(tmp_path, workspace):
    kind = LISTED
    figures = [figure_row(dataset=SURVIVING, month="2026-08", figure="1", figure_kind=kind)]
    with pytest.raises(GuardrailError) as stopped:
        build_with(tmp_path, workspace, figures, SOURCES)
    assert "reconciliation: 2026-08: Source A: 'Measure one': ours is" in str(stopped.value)
    assert f"or more on a figure of kind {kind!r}: one such figure from an independent source stops the build" in str(stopped.value)
    assert not (workspace["public"] / "manifest.json").exists(), "nothing is published"


def test_a_value_the_build_does_not_hold_does_not_stop_it(tmp_path, workspace):
    figures = [figure_row(dataset=SURVIVING, month="2026-08", figure="1", filters='{"import_status": ["fixture_new"]}')]
    cfg, manifest = build_with(tmp_path, workspace, figures, SOURCES)
    assert manifest["reconciliation"]["by_status"] == {"pass": 0, "warn": 0, "fail": 0, "not_compared": 1}
    assert "reconciliation: Source A: 1 figure names a value the published files do not hold, in 2026-08, so it was not compared" in manifest["warnings"]


def test_a_row_the_configuration_cannot_answer_stops_the_build_naming_it(tmp_path, workspace):
    figures = [figure_row(dataset=SURVIVING, month="2026-08", figure="1", filters='{"no_such_dimension": ["fixture_new"]}')]
    with pytest.raises(GuardrailError, match=r"published_figures.csv line 2 \(source_a, 2026-08, 'Measure one'\): .*cannot be filtered by no_such_dimension"):
        build_with(tmp_path, workspace, figures, SOURCES)


def test_a_malformed_row_stops_a_build_before_it_reads_anything(tmp_path, workspace):
    with pytest.raises(GuardrailError, match=r"published_figures.csv line 2 .*month must be YYYY-MM"):
        build_with(tmp_path, workspace, [figure_row(month="August")], SOURCES)
    assert not workspace["staging"].exists() or not (workspace["staging"] / "build").exists()
