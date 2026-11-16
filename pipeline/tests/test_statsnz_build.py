"""registrations_cars_long_run: a dataset built straight from the published series of a supplied source of kind series.

The store is made from the invented export (fixtures/statsnz_tpt.csv) by `supply` itself, so these tests also cover the
hand-off between the two. No series id, label or value is written here (design invariant 1): they are found through the
configuration, the reference files and the structure of the export.
"""

from __future__ import annotations

import copy
import csv
import json
import shutil

import duckdb
import pytest

from pipeline import build, derive, reference, series, supplied
from pipeline.contract import SLICE_COLUMNS, UNDEFINED
from pipeline.errors import GuardrailError

from .conftest import FIXTURES, NOW, load_rows, make_cfg, source_for, write_pages
from .test_statsnz_supply import EXPORT, FIRST_DATA_LINE, MONTHS, TAKEN, cell, edited, set_cell

SOURCE = "statsnz_tpt"
DATASET = "registrations_cars_long_run"
SURVIVING = "registrations_surviving"


def supply(cfg, path, **kwargs):
    kwargs.setdefault("taken", TAKEN)
    return series.supply(cfg, SOURCE, path, echo=lambda *_: None, **kwargs)


def run(tmp_path, cfg, state=None, name="pages", publish=True):
    rows = load_rows()
    return build.build(cfg, source_for(rows), write_pages(tmp_path / name, rows), state, NOW, publish=publish)


def expect_abort(fn, fragment):
    with pytest.raises(GuardrailError) as info:
        fn()
    assert fragment in str(info.value), str(info.value)


def catalogue_of(cfg):
    return series.catalogue(cfg, cfg.supplied(SOURCE))


def export_lines():
    with EXPORT.open(encoding="utf-8", newline="") as fh:
        return list(csv.reader(fh))[FIRST_DATA_LINE:FIRST_DATA_LINE + len(MONTHS)]


def fixture_figures(cfg):
    """{(month, series id): figure} read from the export, for the months that have one."""
    ids = [s.id for s in catalogue_of(cfg)]
    return {(row[0][:4] + "-" + row[0][-2:], sid): int(v) for row in export_lines() for sid, v in zip(ids, row[1:]) if v != ".."}


def slice_rows(public, dim):
    con = duckdb.connect()
    path = (public / "cube" / DATASET / f"{dim}.parquet").as_posix()
    return con.execute(f"SELECT strftime(month, '%Y-%m'), dim_value, n, denominator FROM read_parquet('{path}') ORDER BY ALL").fetchall()


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("cars_long_run")
    workspace = {"staging": tmp / "staging", "public": tmp / "public", "state": tmp / "state" / "last_good.json",
                 "snapshots": tmp / "snapshots", "supplied": tmp / "supplied"}
    cfg = make_cfg(workspace)
    supply(cfg, EXPORT)
    manifest = run(tmp, cfg)
    return {"cfg": cfg, "manifest": manifest, "public": workspace["public"], "state": workspace["state"], "tmp": tmp}


@pytest.fixture
def workspace_with_store(tmp_path, workspace):
    cfg = make_cfg(workspace)
    supply(cfg, EXPORT)
    return cfg


def total_id(cfg):
    return cfg.pipeline["datasets"][DATASET]["total"]


def dimension_ids(cfg):
    return [d["id"] for d in cfg.dimensions["dimensions"] if d.get("applies_to") == [DATASET]]


def test_the_dataset_is_in_the_manifest_with_its_attribution_and_its_exports(built):
    cfg, entry = built["cfg"], built["manifest"]["datasets"][DATASET]
    figures = fixture_figures(cfg)
    totals = {m: v for (m, sid), v in figures.items() if sid == total_id(cfg)}
    assert entry["definition"].startswith("Cars and station wagons registered in New Zealand for the first time in month M")
    assert entry["rows"] == sum(totals.values()) and entry["months"] == len(MONTHS) and entry["latest_month"] == MONTHS[-1]
    assert entry["live_dimensions"] == dimension_ids(cfg) and len(entry["live_dimensions"]) == 2
    assert entry["facts"] is None and entry["live_pairs"] == [] and entry["not_live_pairs"] == {}
    supplied_block = entry["supplied"]
    assert supplied_block["source"] == SOURCE and supplied_block["months"] == {"first": MONTHS[0], "last": MONTHS[-1], "count": len(MONTHS)}
    assert supplied_block["taken"] == [TAKEN] and supplied_block["revisions"] == []
    assert supplied_block["exports"] == [{"taken": TAKEN, "last_updated": "19 September 2026 10:45am", "table_reference": cfg.supplied(SOURCE)["table_reference"]}]
    assert supplied_block["attribution"] == cfg.supplied(SOURCE)["attribution"]
    assert supplied_block["attribution"].startswith("This work is based on/includes Stats NZ's data which are licensed by Stats NZ")
    assert "Creative Commons Attribution 4.0 International licence." in supplied_block["attribution"]


def test_no_register_dimension_is_live_because_the_source_carries_none_of_their_fields(built):
    cfg, entry = built["cfg"], built["manifest"]["datasets"][DATASET]
    register = [d["id"] for d in cfg.dimensions["dimensions"] if d["id"] not in entry["live_dimensions"]]
    assert register and set(entry["not_live"]) == set(register)
    # A dimension that names its datasets and leaves this one out says so; every other one lacks the fields it reads.
    assert all(reason == "does not apply to this dataset" or reason.startswith("the source does not carry ")
               for reason in entry["not_live"].values())
    assert any(reason.startswith("the source does not carry ") for reason in entry["not_live"].values())


def test_the_vehicle_type_is_not_live_because_a_series_carries_no_vehicle_type(built):
    cfg, entry = built["cfg"], built["manifest"]["datasets"][DATASET]
    dim = next(d for d in cfg.dimensions["dimensions"] if d["id"] == "vehicle_type")
    assert dim["id"] not in entry["live_dimensions"]
    assert entry["not_live"][dim["id"]] == "the source does not carry " + cfg.source_field(dim["derive"]["field"])
    assert not (built["public"] / "cube" / DATASET / f"{dim['id']}.parquet").exists()


def test_only_slices_are_written_for_it_and_they_have_the_cube_schema(built):
    cfg, public = built["cfg"], built["public"]
    assert sorted(p.stem for p in (public / "cube" / DATASET).glob("*.parquet")) == sorted(dimension_ids(cfg))
    assert not (public / "pairs" / DATASET).exists() and not (public / "facts" / DATASET).exists()
    con = duckdb.connect()
    for dim in dimension_ids(cfg):
        path = (public / "cube" / DATASET / f"{dim}.parquet").as_posix()
        described = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{path}')").fetchall()
        assert [(n, t) for n, t, *_ in described] == [tuple(c) for c in SLICE_COLUMNS], dim
        fc = con.execute(f"SELECT count(fc_sum), sum(fc_n), sum(fc_eligible_n) FROM read_parquet('{path}')").fetchone()
        assert fc == (0, 0, 0), "the source has no fuel consumption"
        rows = con.execute(f"SELECT month, dim_value, n, denominator FROM read_parquet('{path}')").fetchall()
        assert rows == sorted(rows, key=lambda r: (r[0], r[1]))


def test_each_months_values_add_up_to_the_total_and_the_denominator_is_the_total(built):
    cfg, public = built["cfg"], built["public"]
    figures = fixture_figures(cfg)
    totals = {m: v for (m, sid), v in figures.items() if sid == total_id(cfg)}
    for dim in dimension_ids(cfg):
        by_month = {}
        for month, value, n, denominator in slice_rows(public, dim):
            by_month.setdefault(month, []).append((value, n))
            assert denominator == totals[month]
        for month, values in by_month.items():
            assert sum(n for _, n in values) == totals[month], (dim, month)


def test_new_and_used_carry_the_labels_the_import_status_map_gives_and_new_is_the_total_less_the_ex_overseas(built):
    cfg, public = built["cfg"], built["public"]
    status = cfg.pipeline["scope"]["status"]
    labels = {r[status["label"]] for r in reference.read(cfg.reference(status["file"]))}
    origin = next(d for d in cfg.dimensions["dimensions"]
                  if d.get("applies_to") == [DATASET] and any("minus" in v for v in d["derive"]["values"]))
    new_spec = next(v for v in origin["derive"]["values"] if "minus" in v)
    used_spec = next(v for v in origin["derive"]["values"] if "minus" not in v)
    new_label, used_label = (series.resolve_label(cfg, v["label"]) for v in (new_spec, used_spec))
    assert {new_label, used_label} <= labels and new_label != used_label
    figures = fixture_figures(cfg)
    rows = {(m, v): n for m, v, n, _ in slice_rows(public, origin["id"])}
    assert {v for _, v in rows} == {new_label, used_label, UNDEFINED}
    for month in MONTHS[2:]:
        used = figures[(month, used_spec["series"])]
        assert rows[(month, used_label)] == used == sum(figures[(month, s)] for s in new_spec["minus"])
        assert rows[(month, new_label)] == figures[(month, new_spec["series"])] - used


def test_the_bands_carry_the_labels_of_the_reference_file(built):
    cfg, public = built["cfg"], built["public"]
    figures = fixture_figures(cfg)
    total = next(s for s in catalogue_of(cfg) if s.id == total_id(cfg))
    labels = {s.id: s.label for s in catalogue_of(cfg)}
    bands = {labels[p]: p for p in total.total_of}
    for dim in dimension_ids(cfg):
        values = {v for _, v, _, _ in slice_rows(public, dim)} - {UNDEFINED}
        if values == set(bands):
            for month, value, n, _ in slice_rows(public, dim):
                if value != UNDEFINED:
                    assert n == figures[(month, bands[value])]
            return
    pytest.fail("no dimension carries the band labels")


def test_months_before_the_split_exist_are_not_recorded_whole_and_the_manifest_counts_them(built):
    cfg, public, entry = built["cfg"], built["public"], built["manifest"]["datasets"][DATASET]
    figures = fixture_figures(cfg)
    total = total_id(cfg)
    early = MONTHS[:2]
    for dim in dimension_ids(cfg):
        rows = slice_rows(public, dim)
        for month in early:
            assert [(v, n) for m, v, n, _ in rows if m == month] == [(UNDEFINED, figures[(month, total)])], (dim, month)
        assert entry["undefined"][dim] == {"months": 2, "vehicles": sum(figures[(m, total)] for m in early)}
        assert entry["exceeds_total"][dim] == []


def test_the_dataset_goes_into_the_state_with_the_stores_own_totals(built):
    cfg, entry = built["cfg"], built["manifest"]["datasets"][DATASET]
    state = json.loads(built["state"].read_text(encoding="utf-8"))
    figures = fixture_figures(cfg)
    totals = {m: v for (m, sid), v in figures.items() if sid == total_id(cfg)}
    assert state["live_dimensions"][DATASET] == entry["live_dimensions"]
    assert state["month_counts"][DATASET] == totals == state["supplied_totals"][DATASET]


def test_the_register_datasets_are_untouched_by_a_second_supplied_source(built):
    manifest = built["manifest"]
    assert list(manifest["datasets"]) == [SURVIVING, "registrations_flow", "registrations_flow_wider", DATASET]
    assert all("not_built" in manifest["datasets"][d] for d in ("registrations_flow", "registrations_flow_wider"))
    assert "not_built" not in manifest["datasets"][SURVIVING]


def band_dimension(cfg):
    """The dimension with the most values: the engine-size bands."""
    return max((d for d in cfg.dimensions["dimensions"] if d.get("applies_to") == [DATASET]), key=lambda d: len(d["derive"]["values"]))


def test_the_bands_leave_the_difference_as_not_recorded_and_the_origin_split_does_not(tmp_path, workspace):
    cfg = configured(tmp_path, workspace)
    catalogue = catalogue_of(cfg)
    total = next(s for s in catalogue if s.id == total_id(cfg))
    band = next(s for s in catalogue if s.id == total.total_of[0])
    line, column = cell(catalogue, band, 3)

    def less(lines):
        lines[line][column] = str(int(lines[line][column]) - 7)

    supply(cfg, edited(tmp_path, less))
    entry = run(tmp_path, cfg)["datasets"][DATASET]
    totals = {m: v for (m, sid), v in fixture_figures(cfg).items() if sid == total_id(cfg)}
    early = sum(totals[m] for m in MONTHS[:2])
    band_id = band_dimension(cfg)["id"]
    assert entry["undefined"][band_id] == {"months": 3, "vehicles": early + 7}
    assert [(v, n) for m, v, n, _ in slice_rows(workspace["public"], band_id) if m == MONTHS[3] and v == UNDEFINED] == [(UNDEFINED, 7)]
    for dim in set(dimension_ids(cfg)) - {band_id}:
        assert entry["undefined"][dim] == {"months": 2, "vehicles": early}


def exceeding_export(tmp_path, cfg, by=1):
    catalogue = catalogue_of(cfg)
    band = catalogue[0]
    line, column = cell(catalogue, band, 3)

    def more(lines):
        lines[line][column] = str(int(lines[line][column]) + by)

    return edited(tmp_path, more)


def configured(tmp_path, workspace, name="other"):
    """A config whose export is not held to the arithmetic, so a test can hand the build bands that do not add up."""
    cfg = make_cfg({**workspace, "supplied": tmp_path / name})
    cfg.pipeline["supplied"][SOURCE]["arithmetic_from"] = "2100-01"
    return cfg


def test_bands_above_the_total_abort_unless_the_month_is_a_listed_exception(tmp_path, workspace):
    cfg = configured(tmp_path, workspace)
    supply(cfg, exceeding_export(tmp_path, cfg))
    expect_abort(lambda: run(tmp_path, cfg), "1 above the total")

    exempt = configured(tmp_path, workspace, name="exempt")
    band_dim = band_dimension(exempt)
    band_dim["derive"]["exceeds_total_allowed"] = [MONTHS[3]]
    supply(exempt, exceeding_export(tmp_path, exempt))
    manifest = run(tmp_path, exempt, name="pages2")
    entry = manifest["datasets"][DATASET]
    assert entry["exceeds_total"][band_dim["id"]] == [MONTHS[3]]
    rows = slice_rows(workspace["public"], band_dim["id"])
    month = [n for m, v, n, d in rows if m == MONTHS[3]]
    denominators = {d for m, v, n, d in rows if m == MONTHS[3]}
    assert sum(month) == denominators.pop() + 1 and UNDEFINED not in {v for m, v, _, _ in rows if m == MONTHS[3]}


def test_a_value_below_zero_aborts(tmp_path, workspace):
    cfg = configured(tmp_path, workspace)
    catalogue = catalogue_of(cfg)
    exo = next(s for s in catalogue if s.role == "subset")
    total = next(s for s in catalogue if s.id == total_id(cfg))
    line, column = cell(catalogue, exo, 3)
    total_line, total_column = cell(catalogue, total, 3)

    def too_many(lines):
        lines[line][column] = str(int(lines[total_line][total_column]) + 1)

    supply(cfg, edited(tmp_path, too_many))
    expect_abort(lambda: run(tmp_path, cfg), "below zero")


def test_a_month_where_only_some_of_the_series_have_a_figure_aborts(tmp_path, workspace):
    cfg = configured(tmp_path, workspace)
    catalogue = catalogue_of(cfg)
    total = next(s for s in catalogue if s.id == total_id(cfg))
    band = next(s for s in catalogue if s.id == total.total_of[0])
    supply(cfg, edited(tmp_path, set_cell(catalogue, band, 2, "..")))
    expect_abort(lambda: run(tmp_path, cfg), "though the others have one")


def test_without_a_store_the_build_succeeds_and_says_so(tmp_path, workspace):
    cfg = make_cfg(workspace)
    manifest = run(tmp_path, cfg)
    entry = manifest["datasets"][DATASET]
    assert set(entry) == {"definition", "not_built"} and "absent" in entry["not_built"] and SOURCE in entry["not_built"]
    assert any(w.startswith(f"{DATASET} was not built") for w in manifest["warnings"])
    assert not (workspace["public"] / "cube" / DATASET).exists()
    state = json.loads(workspace["state"].read_text(encoding="utf-8"))
    assert DATASET not in state["month_counts"] and DATASET not in state["live_dimensions"]


def test_a_dataset_built_before_cannot_quietly_vanish(tmp_path, workspace_with_store, workspace):
    run(tmp_path, workspace_with_store, name="first")
    state = json.loads(workspace["state"].read_text(encoding="utf-8"))
    bare = make_cfg({**workspace, "supplied": tmp_path / "nowhere"})
    expect_abort(lambda: run(tmp_path, bare, state=state, name="second"), "it was built in the last good run")


def test_a_dimension_that_was_live_cannot_quietly_drop_out(tmp_path, workspace_with_store, workspace):
    cfg = workspace_with_store
    run(tmp_path, cfg, name="first")
    state = json.loads(workspace["state"].read_text(encoding="utf-8"))
    assert state["live_dimensions"][DATASET]
    hidden = tmp_path / "reference"
    shutil.copytree(cfg.reference("x").parent, hidden)
    (hidden / cfg.supplied(SOURCE)["catalogue"]["file"]).unlink()
    expect_abort(lambda: run(tmp_path, make_cfg(workspace, reference_dir=hidden), state=state, name="second"),
                 cfg.supplied(SOURCE)["catalogue"]["file"])


def write_ledger(cfg, change):
    ledger_path = supplied.store_paths(cfg, SOURCE)[1]
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    change(ledger)
    ledger_path.write_text(json.dumps(ledger), encoding="utf-8", newline="\n")


def test_a_store_that_disagrees_with_its_ledger_aborts(tmp_path, workspace_with_store):
    write_ledger(workspace_with_store, lambda l: l["months"]["2026-07"].update(sum=l["months"]["2026-07"]["sum"] + 1))
    expect_abort(lambda: run(tmp_path, workspace_with_store), "2026-07")


def test_a_store_that_does_not_belong_to_its_ledger_aborts_even_when_the_month_sums_agree(tmp_path, workspace_with_store):
    cfg = workspace_with_store
    registrations = supplied.store_paths(cfg, SOURCE)[0]
    path = registrations.as_posix()
    duckdb.connect().execute(f"""COPY (SELECT * EXCLUDE (rn) REPLACE (CASE WHEN rn = 1 THEN (SELECT max(series_id) FROM read_parquet('{path}'))
                                                          ELSE series_id END AS series_id)
                          FROM (SELECT *, row_number() OVER () AS rn FROM read_parquet('{path}')))
                TO '{path}.moved' (FORMAT PARQUET)""")
    registrations.with_name(registrations.name + ".moved").replace(registrations)
    expect_abort(lambda: run(tmp_path, cfg), "store_sha256")


def test_a_gap_in_the_store_aborts(tmp_path, workspace_with_store):
    cfg = workspace_with_store
    registrations, ledger_path = supplied.store_paths(cfg, SOURCE)
    con = duckdb.connect()
    con.execute(f"COPY (SELECT * FROM read_parquet('{registrations.as_posix()}') WHERE month <> DATE '2026-06-01') "
                f"TO '{registrations.as_posix()}.gap' (FORMAT PARQUET)")
    registrations.with_name(registrations.name + ".gap").replace(registrations)
    write_ledger(cfg, lambda l: l["months"].pop("2026-06"))
    expect_abort(lambda: run(tmp_path, cfg), "no rows for 2026-06")


@pytest.mark.parametrize("keep", ["series_file", "ledger_file"])
def test_a_store_with_only_one_of_its_two_files_aborts_and_is_not_reported_as_not_built(tmp_path, workspace_with_store, keep):
    cfg = workspace_with_store
    source = cfg.supplied(SOURCE)
    (cfg.supplied_store(SOURCE) / source["ledger_file" if keep == "series_file" else "series_file"]).unlink()
    expect_abort(lambda: run(tmp_path, cfg), "only one of")


def test_a_store_with_other_columns_than_the_layout_aborts(tmp_path, workspace_with_store):
    cfg = workspace_with_store
    registrations = supplied.store_paths(cfg, SOURCE)[0]
    duckdb.connect().execute(f"COPY (SELECT *, 1 AS surprise FROM read_parquet('{registrations.as_posix()}')) "
                             f"TO '{registrations.as_posix()}.wide' (FORMAT PARQUET)")
    registrations.with_name(registrations.name + ".wide").replace(registrations)
    digest = supplied.sha256_of(registrations)
    write_ledger(cfg, lambda l: l.update(store_sha256=digest))
    expect_abort(lambda: run(tmp_path, cfg), "the store's columns are")


def test_a_store_newer_than_the_register_aborts_and_an_older_one_warns_and_uses_its_own_latest_month(tmp_path, workspace_with_store, workspace):
    cfg = workspace_with_store

    def one_more(lines):
        last = lines[FIRST_DATA_LINE + len(MONTHS) - 1]
        lines.insert(FIRST_DATA_LINE + len(MONTHS), ["2026M09", *last[1:]])

    supply(cfg, edited(tmp_path, one_more), taken="2026-10-25")
    expect_abort(lambda: run(tmp_path, cfg), "the register is the clock")

    older = make_cfg({**workspace, "supplied": tmp_path / "older"})
    supply(older, edited(tmp_path, lambda lines: lines.__delitem__(FIRST_DATA_LINE + len(MONTHS) - 1), name="older.csv"))
    manifest = run(tmp_path, older, name="pages2")
    assert manifest["datasets"][DATASET]["latest_month"] == MONTHS[-2] and manifest["datasets"][SURVIVING]["latest_month"] == MONTHS[-1]
    assert any(f"the export is missing {MONTHS[-1]}" in w for w in manifest["warnings"])


def test_a_months_total_that_moved_aborts_unless_a_revision_since_the_last_build_is_recorded(tmp_path, workspace_with_store, workspace):
    cfg = workspace_with_store
    run(tmp_path, cfg, name="first")
    state = json.loads(workspace["state"].read_text(encoding="utf-8"))
    assert state["supplied_totals"][DATASET]["2026-07"] > 0
    state["supplied_totals"][DATASET]["2026-07"] += 1
    expect_abort(lambda: run(tmp_path, cfg, state=copy.deepcopy(state), name="second"), "2026-07")

    # A revision whose file was taken before the last good build was part of that build: it excuses nothing now.
    revision = {"month": "2026-07", "old": {}, "new": {"taken": "2026-09-05"}, "cells": []}
    write_ledger(cfg, lambda l: l["revisions"].append(revision))
    expect_abort(lambda: run(tmp_path, cfg, state=copy.deepcopy(state), name="stale"), "no replacement recorded")

    write_ledger(cfg, lambda l: l["revisions"][0]["new"].update(taken="2026-10-02"))
    manifest = run(tmp_path, cfg, state=copy.deepcopy(state), name="third")
    assert manifest["datasets"][DATASET]["supplied"]["revisions"][0]["month"] == "2026-07"


def test_an_accepted_revision_flows_through_to_the_slices_and_the_manifest(tmp_path, workspace_with_store, workspace):
    cfg = workspace_with_store
    catalogue = catalogue_of(cfg)
    total = next(s for s in catalogue if s.id == total_id(cfg))
    band = next(s for s in catalogue if s.id == total.total_of[0])
    first = run(tmp_path, cfg, name="first")
    state = json.loads(workspace["state"].read_text(encoding="utf-8"))
    before = {(m, v): n for m, v, n, _ in slice_rows(workspace["public"], dimension_ids(cfg)[1])}

    def revise(lines):
        for target in (total, band):
            line, column = cell(catalogue, target, 3)
            lines[line][column] = str(int(lines[line][column]) + 5)

    supply(cfg, edited(tmp_path, revise), accept_revisions=True, taken="2026-10-25")
    manifest = run(tmp_path, cfg, state=state, name="second")
    entry = manifest["datasets"][DATASET]
    assert entry["supplied"]["revisions"][0]["month"] == MONTHS[3] and len(entry["supplied"]["revisions"][0]["cells"]) == 2
    assert entry["rows"] == first["datasets"][DATASET]["rows"] + 5
    after = {(m, v): n for m, v, n, _ in slice_rows(workspace["public"], dimension_ids(cfg)[1])}
    assert sum(after.values()) == sum(before.values()) + 5


def test_dimensions_of_the_series_kind_apply_to_series_datasets_only_and_nothing_else_does(workspace):
    cfg = make_cfg(workspace)
    for dataset, spec in cfg.pipeline["datasets"].items():
        is_series = "source" in spec and cfg.supplied(spec["source"]).get("kind") == supplied.SERIES
        applicable, not_live = derive.applicable(cfg, dataset)
        kinds = {d["derive"]["kind"] for d in applicable}
        if is_series:
            assert kinds == {series.DERIVE_KIND}, dataset
        else:
            assert series.DERIVE_KIND not in kinds, dataset
            assert all(not_live[d["id"]] == "does not apply to this dataset" for d in cfg.dimensions["dimensions"]
                       if d["derive"]["kind"] == series.DERIVE_KIND), dataset
    assert any(cfg.supplied(s["source"]).get("kind") == supplied.SERIES for s in cfg.pipeline["datasets"].values() if "source" in s)


def test_the_series_dimensions_name_series_and_reference_rows_that_exist(workspace):
    cfg = make_cfg(workspace)
    known = {s.id for s in catalogue_of(cfg)}
    for dim in cfg.dimensions["dimensions"]:
        if dim["derive"]["kind"] != series.DERIVE_KIND:
            continue
        for value in dim["derive"]["values"]:
            assert {value["series"], *value.get("minus", [])} <= known
            assert series.resolve_label(cfg, value["label"])
        for referenced in derive.references_for(cfg, dim["derive"]):
            assert cfg.reference(referenced).exists()


def test_no_private_or_register_field_reaches_the_new_files(built):
    public = built["public"]
    con = duckdb.connect()
    names = set()
    for path in (public / "cube" / DATASET).glob("*.parquet"):
        names |= {d[0] for d in con.execute(f"SELECT * FROM read_parquet('{path.as_posix()}') LIMIT 0").description}
    assert names == {c[0] for c in SLICE_COLUMNS}


@pytest.mark.parametrize("applies_to", [None, [], ["registrations_surviving"]], ids=["no list", "an empty list", "a register dataset"])
def test_a_series_dimension_must_name_the_series_datasets_it_is_for(tmp_path, workspace, applies_to):
    cfg = make_cfg(workspace)
    origin = next(d for d in cfg.dimensions["dimensions"] if d.get("applies_to") == [DATASET])
    if applies_to is None:
        del origin["applies_to"]
    else:
        origin["applies_to"] = applies_to
    expect_abort(lambda: run(tmp_path, cfg), f"dimension {origin['id']} derives from a published series")


def test_the_real_configuration_has_no_series_dimension_problem(workspace):
    assert derive.series_dimension_problems(make_cfg(workspace)) == []
