"""The reconciliation step (pipeline/reconcile.py, docs/CUBE_SCHEMA.md `reconciliation.json`, D-149).

Every source, measure and value below is a fixture and obviously one (`source_a`, `Measure one`, `fixture_new`): the real
figures are rows of data/reference/published_figures.csv, which this file never reads for a figure. The tables are written as
the build writes them (one Parquet file for each column of a fact table, one file for a slice), in a temporary folder.
"""

from __future__ import annotations

import copy
import csv
import json
import shutil
from datetime import date

import duckdb
import pytest

from pipeline import build, config, reconcile
from pipeline.contract import NOT_BROKEN_DOWN
from pipeline.errors import GuardrailError

from .conftest import NOW, load_rows, make_cfg, source_for, write_pages

FLOW, FLEET, SERIES, SURVIVING = "registrations_flow", "fleet", "registrations_cars_long_run", "registrations_surviving"
STATUS, TYPE = "import_status", "vehicle_type"

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
    {"id": "source_a", "name": "Source A", "home_url": "https://a.example", "independent": "true", "definition": "", "definition_date_read": ""},
    {"id": "source_b", "name": "Source B", "home_url": "https://b.example", "independent": "true", "definition": "B counts what B counts.",
     "definition_date_read": "2026-11-01"},
    {"id": "source_c", "name": "Source C", "home_url": "https://c.example", "independent": "true", "definition": "", "definition_date_read": ""},
    {"id": "source_d", "name": "Source D", "home_url": "https://d.example", "independent": "false", "definition": "", "definition_date_read": ""},
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
           "known_difference": ""}
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


def cfg_for(tmp_path, figures, sources=SOURCES, **hard_limit):
    cfg = config.load(overrides={"reference_dir": str(write_reference(tmp_path, figures, sources))})
    cfg.pipeline = copy.deepcopy(cfg.pipeline)
    cfg.pipeline["reconciliation"]["hard_limit"].update(hard_limit)
    return cfg


def reconcile_figures(tmp_path, figures, sources=SOURCES, datasets=None, **hard_limit):
    staging, staged = stage(tmp_path)
    cfg = cfg_for(tmp_path, figures, sources, **hard_limit)
    prepared, problems = reconcile.prepare(cfg)
    assert problems == []
    return reconcile.run(duckdb.connect(), cfg, prepared, datasets or staged, staging, "2026-03-31")


def only_row(result) -> dict:
    assert len(result.document["rows"]) == 1
    return result.document["rows"][0]


def problems_of(tmp_path, figures, sources=SOURCES) -> list[str]:
    return reconcile.prepare(cfg_for(tmp_path, figures, sources))[1]


# --- the two files: parsing and strict checks ------------------------------------------------------------------------------

def test_the_committed_files_are_valid_and_the_step_runs_with_no_rows(tmp_path):
    cfg = config.load()
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
    cfg = cfg_for(tmp_path, [], min_sources=0, source_row_share=0, tolerance_multiple=0.5)
    problems = reconcile.prepare(cfg)[1]
    assert len(problems) == 3 and all(p.startswith("reconciliation.hard_limit.") for p in problems)


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
def test_a_value_the_files_do_not_hold_aborts_naming_the_row_and_is_never_a_zero(tmp_path, figures, fragment):
    result = reconcile_figures(tmp_path, figures)
    assert len(result.aborts) == 1 and fragment in result.aborts[0]
    assert "published_figures.csv line 2 (source_a, 2026-02, 'Measure one')" in result.aborts[0]
    assert result.document["rows"] == []


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
# Ours for 2026-02 is 1040 and each row's tolerance is 2%, so its hard bound is 4%: 1000 is exactly on it (inside), 999 is past it.

def figures_from(sources, theirs, month="2026-02", **given):
    return [figure_row(source=s, figure=str(t), month=month, **given) for s, t in zip(sources, theirs)]


def fails(tmp_path, figures, sources=SOURCES, **hard_limit):
    return reconcile_figures(tmp_path, figures, sources, **hard_limit)


def test_three_independent_sources_past_the_hard_bound_the_same_way_in_one_month_fail_the_build(tmp_path):
    result = fails(tmp_path, figures_from(["source_a", "source_b", "source_c"], [950, 960, 970]))
    assert len(result.aborts) == 1
    abort = result.aborts[0]
    assert abort.startswith("reconciliation: 2026-02: 3 independent sources each differ from our figures by more than 2 times their tolerance")
    assert "ours is above theirs in every one" in abort and "Source A (1 of 1 figures, the largest +9.47%)" in abort
    assert {r["status"] for r in result.document["rows"]} == {"fail"}
    assert result.document["summary"]["by_status"] == {"pass": 0, "warn": 0, "fail": 3, "not_compared": 0}


def test_the_same_in_the_other_direction_fails_too(tmp_path):
    result = fails(tmp_path, figures_from(["source_a", "source_b", "source_c"], [1100, 1110, 1120]))
    assert len(result.aborts) == 1 and "ours is below theirs in every one" in result.aborts[0]


def test_a_fourth_source_the_other_way_does_not_save_the_build(tmp_path):
    sources = SOURCES + [{**SOURCES[0], "id": "source_e", "name": "Source E"}]
    figures = figures_from(["source_a", "source_b", "source_c", "source_e"], [950, 960, 970, 1200])
    result = fails(tmp_path, figures, sources)
    assert len(result.aborts) == 1 and "ours is above theirs in every one" in result.aborts[0]
    # The source that disagrees the other way is one source on its own side: it warns and does not fail.
    assert {r["source"]: r["status"] for r in result.document["rows"]} == {
        "source_a": "fail", "source_b": "fail", "source_c": "fail", "source_e": "warn"}


@pytest.mark.parametrize("name, figures, sources, hard_limit", [
    ("two sources are not enough", figures_from(["source_a", "source_b"], [950, 960]), SOURCES, {}),
    ("three sources, one the other way", figures_from(["source_a", "source_b", "source_c"], [950, 960, 1100]), SOURCES, {}),
    ("three sources, each exactly on the hard bound", figures_from(["source_a", "source_b", "source_c"], [1000, 1000, 1000]), SOURCES, {}),
    ("three sources, each just inside the bound", figures_from(["source_a", "source_b", "source_c"], [1001, 1002, 1003]), SOURCES, {}),
    ("three sources, three different months",
     [figure_row(source="source_a", figure="950", month="2026-02"), figure_row(source="source_b", figure="1400", month="2026-03"),
      figure_row(source="source_c", figure="480", month="2026-01")], SOURCES, {}),
    ("the third source is a copy of our own export",
     figures_from(["source_a", "source_b", "source_d"], [950, 960, 970]), SOURCES, {}),
    ("one source past the bound in every month of its history",
     [figure_row(source="source_a", figure=str(t), month=m) for m, t in (("2026-01", 400), ("2026-02", 800), ("2026-03", 1200))], SOURCES, {}),
    ("one source restating many figures at once",
     [figure_row(source="source_a", figure="950", measure_as_published=f"Measure {i}") for i in range(6)], SOURCES, {}),
])
def test_cases_that_must_not_fail_the_build(tmp_path, name, figures, sources, hard_limit):
    result = fails(tmp_path, figures, sources, **hard_limit)
    assert result.aborts == [], name
    assert "fail" not in {r["status"] for r in result.document["rows"]}, name


def test_a_month_our_data_does_not_hold_cannot_count_towards_the_limit(tmp_path):
    held = figures_from(["source_a", "source_b"], [950, 960])
    unheld = figures_from(["source_c"], [970], month="2026-06")
    result = fails(tmp_path, held + unheld)
    assert result.aborts == []
    assert [r["status"] for r in result.document["rows"] if r["month"] == "2026-06"] == ["not_compared"]


def test_an_unreadable_source_is_simply_missing_and_the_others_alone_do_not_fail(tmp_path):
    # Source C has no rows (it could not be read this month): two sources past the bound are not enough.
    assert fails(tmp_path, figures_from(["source_a", "source_b"], [950, 960])).aborts == []


def test_a_hidden_cell_is_not_a_breach(tmp_path):
    hidden = [figure_row(source=s, dataset=FLEET, month="2026-03", figure="1", filters='{"vehicle_usage": ["fixture_y"]}')
              for s in ("source_a", "source_b", "source_c")]
    result = fails(tmp_path, hidden)
    assert result.aborts == [] and {r["status"] for r in result.document["rows"]} == {"not_compared"}


def test_a_source_counts_when_most_of_its_rows_breach_and_not_when_few_do(tmp_path):
    def rows(source, theirs):
        return [figure_row(source=source, figure=str(t), measure_as_published=f"Measure {i}") for i, t in enumerate(theirs)]
    # Source C: 1 of 3 rows past the bound, so it is not breaching and the three do not make the limit.
    few = rows("source_a", [950]) + rows("source_b", [960]) + rows("source_c", [950, 1040, 1040])
    assert fails(tmp_path, few).aborts == []
    # Source C: 2 of 3 rows past the bound, so it is.
    many = rows("source_a", [950]) + rows("source_b", [960]) + rows("source_c", [950, 960, 1040])
    result = fails(tmp_path, many)
    assert len(result.aborts) == 1
    # Only the rows past the bound are marked fail; the row that matched stays a pass.
    assert sorted(r["status"] for r in result.document["rows"] if r["source"] == "source_c") == ["fail", "fail", "pass"]


def test_the_numbers_of_the_rule_are_config(tmp_path):
    figures = figures_from(["source_a", "source_b", "source_c"], [950, 960, 970])
    assert len(fails(tmp_path, figures).aborts) == 1
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


# --- the document ----------------------------------------------------------------------------------------------------------

def test_the_document_gives_the_site_everything_it_needs(tmp_path):
    figures = [figure_row(source="source_b", month="2026-03", figure="1500", filters='{"import_status": ["fixture_new"]}'),
               figure_row(source="source_a", month="2026-02", figure="1040"), figure_row(source="source_a", month="2027-01")]
    result = reconcile_figures(tmp_path, figures)
    doc = json.loads(json.dumps(result.document))
    assert list(doc) == ["latest_snapshot", "sources", "summary", "rows"]
    assert doc["latest_snapshot"] == "2026-03-31"
    assert doc["sources"]["source_b"] == {"name": "Source B", "home_url": "https://b.example", "independent": True,
                                          "definition": "B counts what B counts.", "definition_date_read": "2026-11-01"}
    assert doc["sources"]["source_a"]["definition"] is None and doc["sources"]["source_d"]["independent"] is False
    summary = doc["summary"]
    assert summary["rows"] == 3 and summary["months"] == {"first": "2026-02", "last": "2027-01"}
    assert summary["by_status"] == {"pass": 1, "warn": 1, "fail": 0, "not_compared": 1}
    assert summary["by_source"]["source_a"] == {"rows": 2, "pass": 1, "warn": 0, "fail": 0, "not_compared": 1}
    assert summary["by_source"]["source_c"] == {"rows": 0, "pass": 0, "warn": 0, "fail": 0, "not_compared": 0}
    assert summary["thresholds"] == {"max_tolerance_pct": 20, "hard_limit_tolerance_multiple": 2, "hard_limit_floor_pct": 2,
                                     "hard_limit_min_sources": 3, "hard_limit_source_row_share": 0.5}
    assert [(r["month"], r["source"]) for r in doc["rows"]] == [("2026-02", "source_a"), ("2026-03", "source_b"), ("2027-01", "source_a")]
    assert set(doc["rows"][0]) == {"source", "month", "measure_as_published", "dataset", "filters", "ours", "theirs", "gap", "gap_pct",
                                   "tolerance_pct", "hard_bound_pct", "known_difference", "status", "reason_kind", "reason",
                                   "source_url", "date_read"}
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
    assert "reconciliation: 2026-08: 3 independent sources" in str(stopped.value)
    assert not (workspace["public"] / "manifest.json").exists(), "nothing is published"


def test_a_row_that_cannot_be_answered_stops_the_build_naming_it(tmp_path, workspace):
    figures = [figure_row(dataset=SURVIVING, month="2026-08", figure="1", filters='{"import_status": ["fixture_new"]}')]
    with pytest.raises(GuardrailError, match=r"published_figures.csv line 2 \(source_a, 2026-08, 'Measure one'\): import_status has no value 'fixture_new'"):
        build_with(tmp_path, workspace, figures, SOURCES)


def test_a_malformed_row_stops_a_build_before_it_reads_anything(tmp_path, workspace):
    with pytest.raises(GuardrailError, match=r"published_figures.csv line 2 .*month must be YYYY-MM"):
        build_with(tmp_path, workspace, [figure_row(month="August")], SOURCES)
    assert not workspace["staging"].exists() or not (workspace["staging"] / "build").exists()
