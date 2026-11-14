"""registrations_flow: a dataset built from a supplied store through the register's own normalise, derive and output code.

The store is made from the invented fixture CSV by `supply` itself (fixtures/dashboard_history.csv), so these tests also
cover the hand-off between the two. Column names come from config and the reference files, not from this file.
"""

from __future__ import annotations

import copy
import csv
import json

import duckdb
import pytest

from pipeline import build, derive, reference, supplied
from pipeline.errors import GuardrailError

from .conftest import FIXTURES, NOW, load_rows, make_cfg, source_for, write_pages

SOURCE = "nzta_dashboard"
DATASET = "registrations_flow"
SURVIVING = "registrations_surviving"
HISTORY, MONTH = FIXTURES / "dashboard_history.csv", FIXTURES / "dashboard_month.csv"


def supply(cfg, path, **kwargs):
    kwargs.setdefault("taken", "2026-09-05")
    return supplied.supply(cfg, SOURCE, path, echo=lambda *_: None, **kwargs)


def run(tmp_path, cfg, state=None, source=None, name="pages", publish=True):
    rows = load_rows()
    return build.build(cfg, source or source_for(rows), write_pages(tmp_path / name, rows), state, NOW, publish=publish)


def expect_abort(fn, fragment):
    with pytest.raises(GuardrailError) as info:
        fn()
    assert fragment in str(info.value), str(info.value)


def fleet_entry_vehicles(cfg) -> int:
    """Vehicles in the fixture file that are in scope and enter the fleet, decided from the reference files and config."""
    p, s = cfg.pipeline, cfg.supplied(SOURCE)
    vehicle, status = p["scope"]["vehicle"], p["scope"]["status"]
    true = p["boolean_true"]
    types = {r[vehicle["key"]] for r in reference.read(cfg.reference(vehicle["file"])) if r[vehicle["in_scope"]] == true}
    statuses = {r[status["key"]] for r in reference.read(cfg.reference(status["file"]))
                if r[status["in_scope"]] == true and r[status["fleet_entry"]] == true}
    with HISTORY.open(encoding="utf-8", newline="") as fh:
        return sum(int(r[s["count_column"]]) for r in csv.DictReader(fh)
                   if r[s["fields"]["vehicle_type"]] in types and r[s["fields"]["import_status"]] in statuses)


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("flow")
    workspace = {"staging": tmp / "staging", "public": tmp / "public", "state": tmp / "state" / "last_good.json",
                 "snapshots": tmp / "snapshots", "supplied": tmp / "supplied"}
    cfg = make_cfg(workspace)
    supply(cfg, HISTORY)
    manifest = run(tmp, cfg)
    return {"cfg": cfg, "manifest": manifest, "public": workspace["public"], "state": workspace["state"], "tmp": tmp}


@pytest.fixture
def workspace_with_store(tmp_path, workspace):
    cfg = make_cfg(workspace)
    supply(cfg, HISTORY)
    return cfg


def test_the_dataset_is_written_like_a_register_dataset(built):
    cfg, entry, public = built["cfg"], built["manifest"]["datasets"][DATASET], built["public"]
    assert set(entry) == set(built["manifest"]["datasets"][SURVIVING]) | {"supplied"}
    assert entry["latest_month"] == "2026-08" and entry["months"] == 3
    assert entry["supplied"]["source"] == SOURCE
    assert entry["supplied"]["months"] == {"first": "2026-06", "last": "2026-08", "count": 3}
    assert entry["supplied"]["taken"] == ["2026-09-05"] and entry["supplied"]["replaced"] == []
    assert entry["rows"] == fleet_entry_vehicles(cfg)
    for dim in entry["live_dimensions"]:
        assert (public / "cube" / DATASET / f"{dim}.parquet").exists()
    assert not (public / "pairs" / DATASET).exists()


def test_the_fact_table_totals_the_datasets_vehicles(built):
    entry, public = built["manifest"]["datasets"][DATASET], built["public"]
    con = duckdb.connect()
    total = con.execute(f"SELECT sum(n) FROM read_parquet('{(public / 'facts' / DATASET / 'n.parquet').as_posix()}')").fetchone()[0]
    assert total == entry["rows"] == fleet_entry_vehicles(built["cfg"])
    assert entry["facts"]["dimensions"] and not entry["facts"]["not_live"]


def test_a_dimension_that_needs_a_field_the_source_lacks_is_not_live_and_says_why(built):
    cfg, entry = built["cfg"], built["manifest"]["datasets"][DATASET]
    carried = derive.carried_fields(cfg, DATASET)
    lacking = {}
    for dim in cfg.dimensions["dimensions"]:
        missing = sorted(derive.needed_fields(cfg, dim["derive"]) - carried)
        if missing and dim.get("applies_to") is None:
            lacking[dim["id"]] = missing
    assert lacking and entry["live_dimensions"], "the test would prove nothing"
    for dim_id, fields in lacking.items():
        assert dim_id not in entry["live_dimensions"]
        assert entry["not_live"][dim_id] == "the source does not carry " + ", ".join(cfg.source_field(f) for f in fields)
    assert entry["coverage_trailing"]["fuel_consumption"] == 0


def test_fuel_consumption_is_all_missing(built):
    public = built["public"]
    con = duckdb.connect()
    for path in (public / "cube" / DATASET).glob("*.parquet"):
        fc_sum, fc_n = con.execute(f"SELECT count(fc_sum), sum(fc_n) FROM read_parquet('{path.as_posix()}')").fetchone()
        assert fc_sum == 0 and fc_n == 0, path.name


def test_no_owner_field_is_in_any_output(built):
    cfg, public = built["cfg"], built["public"]
    private = cfg.supplied(SOURCE)["private_columns"]
    con = duckdb.connect()
    for path in list(public.rglob("*.parquet")):
        names = {d[0] for d in con.execute(f"SELECT * FROM read_parquet('{path.as_posix()}') LIMIT 0").description}
        assert not names & set(private), path
    text = (public / "manifest.json").read_text(encoding="utf-8")
    assert not any(column in text for column in private)


def test_the_flow_dataset_goes_into_the_state(built):
    state = json.loads(built["state"].read_text(encoding="utf-8"))
    assert state["live_dimensions"][DATASET] == built["manifest"]["datasets"][DATASET]["live_dimensions"]
    assert sum(state["month_counts"][DATASET].values()) == built["manifest"]["datasets"][DATASET]["rows"]


def test_without_a_store_the_build_succeeds_and_says_so(tmp_path, workspace):
    cfg = make_cfg(workspace)
    manifest = run(tmp_path, cfg)
    entry = manifest["datasets"][DATASET]
    assert set(entry) == {"definition", "not_built"} and "absent" in entry["not_built"]
    assert any(w.startswith(f"{DATASET} was not built") for w in manifest["warnings"])
    assert not (workspace["public"] / "cube" / DATASET).exists() and not (workspace["public"] / "facts" / DATASET).exists()
    assert list(manifest["datasets"]) == [SURVIVING, DATASET]
    state = json.loads(workspace["state"].read_text(encoding="utf-8"))
    assert DATASET not in state["month_counts"] and DATASET not in state["live_dimensions"]


def test_a_dataset_built_before_cannot_quietly_vanish(tmp_path, workspace_with_store, workspace):
    cfg = workspace_with_store
    run(tmp_path, cfg, name="first")
    state = json.loads(workspace["state"].read_text(encoding="utf-8"))
    bare = make_cfg({**workspace, "supplied": tmp_path / "nowhere"})
    expect_abort(lambda: run(tmp_path, bare, state=state, name="second"), "it was built in the last good run")


def test_a_store_that_disagrees_with_its_ledger_aborts(tmp_path, workspace_with_store):
    cfg = workspace_with_store
    ledger_path = supplied.store_paths(cfg, SOURCE)[1]
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    ledger["months"]["2026-07"]["vehicles"] += 1
    ledger_path.write_text(json.dumps(ledger), encoding="utf-8", newline="\n")
    expect_abort(lambda: run(tmp_path, cfg), "2026-07")


def test_a_gap_in_the_store_aborts(tmp_path, workspace_with_store):
    cfg = workspace_with_store
    registrations, ledger_path = supplied.store_paths(cfg, SOURCE)
    con = duckdb.connect()
    con.execute(f"COPY (SELECT * FROM read_parquet('{registrations.as_posix()}') WHERE month <> DATE '2026-07-01') "
                f"TO '{registrations.as_posix()}.gap' (FORMAT PARQUET)")
    registrations.with_name(registrations.name + ".gap").replace(registrations)
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    del ledger["months"]["2026-07"]
    ledger_path.write_text(json.dumps(ledger), encoding="utf-8", newline="\n")
    expect_abort(lambda: run(tmp_path, cfg), "no rows for 2026-07")


def test_a_store_newer_than_the_register_aborts(tmp_path, workspace_with_store):
    cfg = workspace_with_store
    supply(cfg, MONTH, month="2026-09", taken="2026-10-02")
    expect_abort(lambda: run(tmp_path, cfg), "the register is the clock")


def test_a_store_older_than_the_register_warns_and_uses_its_own_latest_month(tmp_path, workspace):
    cfg = make_cfg(workspace)
    with HISTORY.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        header, rows = reader.fieldnames, list(reader)
    column, fmt = cfg.supplied(SOURCE)["month"]["column"], "Aug 2026"
    older = tmp_path / "older.csv"
    with older.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=header, lineterminator="\n")
        writer.writeheader()
        writer.writerows(r for r in rows if r[column] != fmt)
    supply(cfg, older)
    manifest = run(tmp_path, cfg)
    entry = manifest["datasets"][DATASET]
    assert entry["latest_month"] == "2026-07" and manifest["datasets"][SURVIVING]["latest_month"] == "2026-08"
    assert any("the export is missing 2026-08" in w for w in manifest["warnings"])


def test_a_month_that_moved_without_a_ledger_entry_aborts(tmp_path, workspace_with_store, workspace):
    cfg = workspace_with_store
    run(tmp_path, cfg, name="first")
    state = json.loads(workspace["state"].read_text(encoding="utf-8"))
    state["month_counts"][DATASET]["2026-07"] *= 2
    expect_abort(lambda: run(tmp_path, cfg, state=copy.deepcopy(state), name="second"), "not in the ledger's replaced list")

    ledger_path = supplied.store_paths(cfg, SOURCE)[1]
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    ledger["replaced"].append({"month": "2026-07", "old": {}, "new": {}})
    ledger_path.write_text(json.dumps(ledger), encoding="utf-8", newline="\n")
    manifest = run(tmp_path, cfg, state=copy.deepcopy(state), name="third")
    assert manifest["datasets"][DATASET]["supplied"]["replaced"][0]["month"] == "2026-07"
