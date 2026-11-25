"""A dataset that is a stock: every vehicle of the register as at the snapshot, with one period (D-135).

The tests give the build a stock dataset made up for the purpose, over a probe dimension and a data map that marks the field
the probe reads as describing the vehicle as at the snapshot (`stock_only`), so they hold the mechanism and name no real
dimension, field value or dataset (design invariant 1). The real dataset and its dimensions are tested in test_fleet.py.
"""

from __future__ import annotations

import copy
import json

import duckdb
import pytest

from pipeline import build, config, derive, privacy
from pipeline.contract import PAIR_COLUMNS, SLICE_COLUMNS
from pipeline.errors import GuardrailError

from .conftest import NOW, load_rows, make_cfg, source_for, write_pages
from .test_guardrails import expect_abort, run

STOCK = "stock_probe"
PROBE = "probe_now"
HELD_FIELD = "alternative_motive_power"
NEVER_BY = ["registration_year", "registration_month"]


def dimension_reading(cfg, field: str, value: str | None = None) -> str:
    """The one dimension that looks up the field in a reference file (and returns `value`, when given)."""
    found = [d["id"] for d in cfg.dimensions["dimensions"]
             if d.get("derive", {}).get("kind") == "lookup" and d["derive"].get("field") == field
             and (value is None or d["derive"]["value"] == value)]
    assert len(found) >= 1, field
    return found[0]


def other_dimension(cfg) -> str:
    return dimension_reading(cfg, cfg.pipeline["scope"]["vehicle"]["field"], "label")


def rows_with_values() -> list[dict]:
    """The fixture, with a recorded value of the held field on some of the rows."""
    column = config.load().pipeline["fields"][HELD_FIELD]
    rows = load_rows()
    for index, row in enumerate(rows):
        row[column] = "FIRST" if index % 3 == 0 else "SECOND" if index % 3 == 1 else None
    return rows


def configured(tmp_path, workspace, stock_changes=None, dimension_changes=None, map_changes=None):
    """Config with a stock dataset over the probe dimension and the other dimension, and the field the probe reads marked
    as describing the vehicle as at the snapshot."""
    live = config.load()
    dmap = privacy.load_map(live)
    name = live.pipeline["fields"][HELD_FIELD]
    next(e for e in dmap["fields"] if e["name"] == name)["stock_only"] = True
    if map_changes:
        map_changes(dmap)
    custom = tmp_path / "data_map.json"
    custom.write_text(json.dumps(dmap), encoding="utf-8")
    cfg = make_cfg(workspace, data_map=custom)
    cfg.dimensions = copy.deepcopy(cfg.dimensions)
    probe = {"id": PROBE, "label": "Probe", "derive": {"kind": "raw", "field": HELD_FIELD}, "kind": "category",
             "cardinality": "low", "applies_to": [STOCK]}
    probe.update(dimension_changes or {})
    cfg.dimensions["dimensions"].append(probe)
    other = other_dimension(cfg)
    cfg.pipeline = copy.deepcopy(cfg.pipeline)
    cfg.pipeline["datasets"][STOCK] = {"stock": True, "require": [], "dimensions": [PROBE, other], "pairs": [[PROBE, other]],
                                       "not_by": NEVER_BY, **(stock_changes or {})}
    return cfg


def slice_path(workspace, dimension: str, dataset: str = STOCK):
    return workspace["public"] / "cube" / dataset / f"{dimension}.parquet"


def read(path) -> list[tuple]:
    return duckdb.connect().execute(f"SELECT * FROM read_parquet('{path.as_posix()}') ORDER BY ALL").fetchall()


# --- what the build makes of a stock ------------------------------------------------------------------------------------


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    root = tmp_path_factory.mktemp("stock")
    workspace = {"staging": root / "staging", "public": root / "public", "state": root / "state" / "last_good.json",
                 "snapshots": root / "snapshots", "supplied": root / "supplied"}
    cfg = configured(root, workspace)
    rows = rows_with_values()
    manifest = run(root, cfg, rows)
    return manifest, workspace, cfg, rows


def test_a_stock_counts_every_vehicle_of_the_register_in_the_one_period(built):
    manifest, workspace, cfg, rows = built
    entry = manifest["datasets"][STOCK]
    assert entry["rows"] == len(rows)
    assert entry["months"] == 1 and entry["latest_month"] == "2026-08"
    # Every vehicle: the ones outside the default scope, the ones that are not fleet entries, the one with no registration
    # month and the one dated after the snapshot are all in it.
    for dimension in (PROBE, other_dimension(cfg)):
        rows_ = read(slice_path(workspace, dimension))
        assert {r[0].isoformat() for r in rows_} == {"2026-08-01"}
        assert sum(r[2] for r in rows_) == len(rows)
        assert {r[3] for r in rows_} == {len(rows)}


def test_no_file_of_a_stock_has_a_column_of_first_registration(built):
    _, workspace, _, _ = built
    con = duckdb.connect()
    for path in (workspace["public"] / "cube" / STOCK).glob("*.parquet"):
        assert [r[0] for r in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{path.as_posix()}')").fetchall()] == [n for n, _ in SLICE_COLUMNS]
    for path in (workspace["public"] / "pairs" / STOCK).glob("*.parquet"):
        assert [r[0] for r in con.execute(f"DESCRIBE SELECT * FROM read_parquet('{path.as_posix()}')").fetchall()] == [n for n, _ in PAIR_COLUMNS]
    assert not (workspace["public"] / "facts" / STOCK).exists()


def test_a_stock_holds_only_the_dimensions_it_lists_and_says_why_for_the_rest(built):
    manifest, _, cfg, _ = built
    entry = manifest["datasets"][STOCK]
    assert sorted(entry["live_dimensions"]) == sorted([PROBE, other_dimension(cfg)])
    assert entry["live_pairs"] == [f"{PROBE}__{other_dimension(cfg)}"]
    assert entry["facts"] is None
    assert "mild_hybrid_identification_coverage" not in entry
    assert entry["not_live"] and all(isinstance(v, str) and v for v in entry["not_live"].values())
    others = [d["id"] for d in cfg.dimensions["dimensions"] if d["id"] not in (PROBE, other_dimension(cfg)) and "derive" in d]
    assert set(others) <= set(entry["not_live"])


def test_a_dimension_that_describes_the_vehicle_now_is_not_live_in_any_other_dataset(built):
    manifest, workspace, _, _ = built
    for dataset, entry in manifest["datasets"].items():
        if dataset != STOCK:
            assert PROBE not in entry.get("live_dimensions", []), dataset
            assert not (workspace["public"] / "cube" / dataset / f"{PROBE}.parquet").exists()
    assert "stock" in manifest["datasets"]["registrations_surviving"]["not_live"][PROBE] or "apply" in manifest["datasets"]["registrations_surviving"]["not_live"][PROBE]


def test_a_stock_is_kept_apart_from_the_series_of_months_in_the_state(built):
    _, workspace, _, rows = built
    state = json.loads(workspace["state"].read_text(encoding="utf-8"))
    assert STOCK not in state["month_counts"]
    assert state["stock_totals"][STOCK] == {"snapshot": "2026-08-31", "vehicles": len(rows)}
    assert STOCK in state["live_dimensions"]


def test_a_build_with_no_last_good_state_says_so_once_and_not_for_the_stock_as_well(built):
    manifest, *_ = built
    assert any("no last good state" in w for w in manifest["warnings"])
    assert not any(w.startswith(f"{STOCK}: the last good build holds no total") for w in manifest["warnings"])


# --- the next build ------------------------------------------------------------------------------------------------------


def last_good(tmp_path, workspace):
    cfg = configured(tmp_path, workspace)
    rows = rows_with_values()
    run(tmp_path, cfg, rows, name="first")
    return cfg, rows, json.loads(workspace["state"].read_text(encoding="utf-8"))


def test_the_next_month_is_compared_by_its_total_and_does_not_look_for_months_it_lacks(tmp_path, workspace):
    cfg, rows, state = last_good(tmp_path, workspace)
    source = source_for(rows)
    source["change_key"]["snapshot"] = "2026-09-30"
    manifest = run(tmp_path, cfg, rows, state=state, source=source, name="next")
    assert manifest["datasets"][STOCK]["latest_month"] == "2026-09"
    assert not any(w.startswith(f"{STOCK}: the last good build holds no total") for w in manifest["warnings"])
    assert json.loads(workspace["state"].read_text(encoding="utf-8"))["stock_totals"][STOCK]["snapshot"] == "2026-09-30"


def test_a_stock_that_moves_more_than_the_limit_aborts_and_one_that_moves_less_does_not(tmp_path, workspace):
    cfg, rows, state = last_good(tmp_path, workspace)
    limit = cfg.pipeline["guardrails"]["max_stock_change"]
    near = copy.deepcopy(state)
    near["stock_totals"][STOCK]["vehicles"] = round(len(rows) / (1 + limit / 2))
    run(tmp_path, cfg, rows, state=near, name="near")
    far = copy.deepcopy(state)
    far["stock_totals"][STOCK]["vehicles"] = round(len(rows) / (1 + limit * 3))
    expect_abort(lambda: run(tmp_path, cfg, rows, state=far, name="far", publish=False), f"{STOCK}: its vehicles moved")


@pytest.mark.parametrize("damage", [None, {}, {"vehicles": "many"}, {"vehicles": 0}, {"vehicles": True}, [1, 2]])
def test_a_state_record_that_is_not_in_the_shape_written_is_ignored_with_the_same_warning(tmp_path, workspace, damage):
    cfg, rows, state = last_good(tmp_path, workspace)
    state["stock_totals"][STOCK] = damage
    manifest = run(tmp_path, cfg, rows, state=state, name="second")
    assert any(w.startswith(f"{STOCK}: the last good build holds no total") for w in manifest["warnings"])


def test_a_state_written_before_stock_totals_existed_is_compared_with_nothing(tmp_path, workspace):
    cfg, rows, state = last_good(tmp_path, workspace)
    del state["stock_totals"]
    manifest = run(tmp_path, cfg, rows, state=state, name="second")
    assert any(w.startswith(f"{STOCK}: the last good build holds no total") for w in manifest["warnings"])


def test_a_populous_month_emptied_in_another_dataset_still_aborts_beside_a_stock(tmp_path, workspace):
    cfg, rows, state = last_good(tmp_path, workspace)
    floor = cfg.pipeline["guardrails"]["zero_row_min_previous_rows"]
    state["month_counts"]["registrations_surviving"]["2010-01"] = floor
    expect_abort(lambda: run(tmp_path, cfg, rows, state=state, name="second", publish=False), "now have none")


# --- what the build refuses -----------------------------------------------------------------------------------------------


def test_a_stock_with_a_scope_flag_to_require_is_refused(tmp_path, workspace):
    cfg = configured(tmp_path, workspace, stock_changes={"require": ["in_scope"]})
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), "a stock counts every vehicle, so its require must be empty")


def test_a_stock_that_names_another_source_is_refused(tmp_path, workspace):
    cfg = configured(tmp_path, workspace, stock_changes={"source": next(iter(config.load().pipeline["supplied"]))})
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), "names no other source")


def test_a_stock_that_does_not_list_its_dimensions_is_refused(tmp_path, workspace):
    cfg = configured(tmp_path, workspace)
    del cfg.pipeline["datasets"][STOCK]["dimensions"]
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), "a stock lists the dimensions it is offered")


def test_a_stock_with_a_pair_of_a_dimension_it_is_not_offered_is_refused(tmp_path, workspace):
    cfg = configured(tmp_path, workspace, stock_changes={"pairs": [[PROBE, "no_such_dimension"]]})
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), "name a dimension the dataset is not offered")


def test_a_stock_is_never_broken_down_by_what_its_not_by_names(tmp_path, workspace):
    cfg = configured(tmp_path, workspace, dimension_changes={"derive": {"kind": "raw", "field": "registration_year"}})
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), "which a stock is never broken down by")


def test_a_not_by_that_names_no_field_is_refused(tmp_path, workspace):
    cfg = configured(tmp_path, workspace, stock_changes={"not_by": ["no_such_field"]})
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), "which are not fields of config/pipeline.json")


def test_a_dimension_describing_the_vehicle_now_must_name_the_datasets_it_is_for(tmp_path, workspace):
    cfg = configured(tmp_path, workspace)
    del next(d for d in cfg.dimensions["dimensions"] if d["id"] == PROBE)["applies_to"]
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), "must name the stock datasets it is for in applies_to")


def test_a_dimension_describing_the_vehicle_now_may_not_apply_to_a_dataset_that_is_not_a_stock(tmp_path, workspace):
    cfg = configured(tmp_path, workspace, dimension_changes={"applies_to": [STOCK, "registrations_surviving"]})
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), "which are not stock datasets")


@pytest.mark.parametrize("where", ["pairs", "facts", "dimensions"])
def test_no_dataset_that_is_not_a_stock_may_list_a_dimension_describing_the_vehicle_now(tmp_path, workspace, where):
    cfg = configured(tmp_path, workspace)
    other = cfg.pipeline["datasets"]["registrations_surviving"]
    if where == "pairs":
        other["pairs"] = other["pairs"] + [[PROBE, other_dimension(cfg)]]
    else:
        other[where] = list(other.get(where) or []) + [PROBE]
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), f"lists {PROBE}")


def test_a_dimension_that_describes_the_vehicle_now_is_held_even_if_its_applies_to_is_widened_after_the_check(tmp_path, workspace):
    """The second layer: the build offers it to a stock dataset and to no other, whatever applies_to says."""
    cfg = configured(tmp_path, workspace)
    candidates, not_live = derive.applicable(cfg, "registrations_surviving")
    assert PROBE not in [d["id"] for d in candidates] and PROBE in not_live
    next(d for d in cfg.dimensions["dimensions"] if d["id"] == PROBE)["applies_to"].append("registrations_surviving")
    candidates, not_live = derive.applicable(cfg, "registrations_surviving")
    assert PROBE not in [d["id"] for d in candidates]
    assert "only a stock dataset counts" in not_live[PROBE]


def test_a_map_that_marks_no_field_leaves_the_dimension_open_to_every_dataset(tmp_path, workspace):
    """The rule is read from the data map, not from the dimension's name."""
    cfg = configured(tmp_path, workspace, map_changes=lambda dmap: [e.pop("stock_only", None) for e in dmap["fields"]])
    assert privacy.stock_only_dimensions(cfg) == {}


def test_a_stock_that_counts_other_months_than_the_snapshots_aborts_and_publishes_nothing(tmp_path, workspace, monkeypatch):
    """The stock's period is the snapshot's month; a fault that lets a vehicle's own month through is caught by the files."""
    real = derive.build_dims

    def with_first_registration_months(con, cfg, derived, scope=None, stock_month=None):
        return real(con, cfg, derived, scope or "in_scope", None)

    monkeypatch.setattr(derive, "build_dims", with_first_registration_months)
    cfg = configured(tmp_path, workspace)
    with pytest.raises(GuardrailError) as info:
        run(tmp_path, cfg, rows_with_values())
    message = str(info.value)
    assert f"{STOCK}: counts" in message and "has the periods" in message and "has the months" in message, message
    assert not workspace["public"].exists() and not workspace["state"].exists()


def test_the_same_fault_publishes_a_stock_with_first_registration_months_when_the_guard_is_off(tmp_path, workspace, monkeypatch):
    real = derive.build_dims
    monkeypatch.setattr(derive, "build_dims", lambda con, cfg, derived, scope=None, stock_month=None: real(con, cfg, derived, scope or "in_scope", None))
    monkeypatch.setattr(build, "stock_problems", lambda *args, **kwargs: [])
    cfg = configured(tmp_path, workspace)
    run(tmp_path, cfg, rows_with_values())
    months = {r[0] for r in read(slice_path(workspace, PROBE))}
    assert len(months) > 1, "so the guard above is what stops it"


def rewrite_slices(monkeypatch, select: str):
    """Make the slice writer write its file and then rewrite it with `select` over month, dim_value, n, ... as a fault would."""
    from pipeline import outputs, small_cells

    real_plain, real_protected = outputs.write_slice, small_cells.write_protected_slice

    def reselect(path):
        con = duckdb.connect()
        out = path.with_name(path.stem + ".rewritten")
        con.execute(f"COPY (SELECT {select} FROM read_parquet('{path.as_posix()}')) TO '{out.as_posix()}' (FORMAT PARQUET)")
        con.close()
        path.unlink()
        out.rename(path)

    def plain(con, cfg, derived, ds, path, **kw):
        real_plain(con, cfg, derived, ds, path, **kw)
        if path.parent.name == STOCK:
            reselect(path)

    def protected(con, cfg, derived, ds, path, rule, **kw):
        figures = real_protected(con, cfg, derived, ds, path, rule, **kw)
        if path.parent.name == STOCK:
            reselect(path)
        return figures

    monkeypatch.setattr(outputs, "write_slice", plain)
    monkeypatch.setattr(small_cells, "write_protected_slice", protected)


def test_a_stock_slice_with_a_column_the_contract_does_not_have_aborts_the_build(tmp_path, workspace, monkeypatch):
    rewrite_slices(monkeypatch, "*, 2024 AS first_registration_year")
    cfg = configured(tmp_path, workspace)
    with pytest.raises(GuardrailError) as info:
        run(tmp_path, cfg, rows_with_values())
    assert f"{STOCK}: cube/" in str(info.value) and "not the contract's" in str(info.value), str(info.value)
    assert not workspace["public"].exists()


def test_a_stock_slice_in_a_month_other_than_the_snapshots_aborts_the_build(tmp_path, workspace, monkeypatch):
    rewrite_slices(monkeypatch, "month + INTERVAL 1 MONTH AS month, dim_value, n, denominator, fc_sum, fc_n, fc_eligible_n")
    cfg = configured(tmp_path, workspace)
    with pytest.raises(GuardrailError) as info:
        run(tmp_path, cfg, rows_with_values())
    assert f"{STOCK}: cube/" in str(info.value) and "but a stock has one, the snapshot's" in str(info.value), str(info.value)
    assert not workspace["public"].exists()
