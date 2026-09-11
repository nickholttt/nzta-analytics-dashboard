"""Every abort condition in docs/CUBE_SCHEMA.md, and that an abort leaves the last good build untouched."""

from __future__ import annotations

import copy
import csv
import json
import shutil
from collections import Counter
from datetime import date

import duckdb
import pytest

from pipeline import build, fetch, metrics, reference, schema
from pipeline.errors import GuardrailError

from .conftest import NOW, load_rows, make_cfg, source_for, with_dimension_change, write_pages


def run(tmp_path, cfg, rows, state=None, source=None, name="pages", publish=True):
    return build.build(cfg, source or source_for(rows), write_pages(tmp_path / name, rows), state, NOW, publish=publish)


def good_state(tmp_path, workspace):
    rows = load_rows()
    cfg = make_cfg(workspace)
    run(tmp_path, cfg, rows, name="first")
    return cfg, rows, json.loads(workspace["state"].read_text(encoding="utf-8"))


def expect_abort(fn, fragment):
    with pytest.raises(GuardrailError) as info:
        fn()
    assert fragment in str(info.value), str(info.value)


def test_first_run_publishes_state_and_archive(tmp_path, workspace):
    cfg, rows, state = good_state(tmp_path, workspace)
    assert (workspace["public"] / "manifest.json").exists()
    assert (workspace["snapshots"] / "2026-08.parquet").exists()
    assert state["latest_snapshot"] == "2026-08-31"
    manifest = json.loads((workspace["public"] / "manifest.json").read_text(encoding="utf-8"))
    assert any("first run" in w for w in manifest["warnings"])


def test_identical_rerun_passes_and_keeps_archive(tmp_path, workspace):
    cfg, rows, state = good_state(tmp_path, workspace)
    manifest = run(tmp_path, cfg, rows, state=state, name="second")
    assert manifest["snapshot_archive"]["status"] == "unchanged"


def test_rows_pulled_must_match_service_count(tmp_path, workspace):
    rows = load_rows()
    cfg = make_cfg(workspace)
    source = source_for(rows)
    source["row_count"] += 1
    expect_abort(lambda: run(tmp_path, cfg, rows, source=source), "rows pulled")


def test_in_scope_rows_moving_more_than_limit_aborts(tmp_path, workspace):
    cfg, rows, state = good_state(tmp_path, workspace)
    state["in_scope_row_count"] = int(state["in_scope_row_count"] * 1.5)
    expect_abort(lambda: run(tmp_path, cfg, rows, state=state, name="second"), "in-scope source rows moved")


def test_populous_month_emptied_aborts_but_sparse_month_does_not(tmp_path, workspace):
    cfg, rows, state = good_state(tmp_path, workspace)
    floor = cfg.pipeline["guardrails"]["zero_row_min_previous_rows"]
    sparse = copy.deepcopy(state)
    sparse["month_counts"]["registrations_surviving"]["1930-01"] = floor - 1
    run(tmp_path, cfg, rows, state=sparse, name="sparse")
    populous = copy.deepcopy(state)
    populous["month_counts"]["registrations_surviving"]["2010-01"] = floor
    expect_abort(lambda: run(tmp_path, cfg, rows, state=populous, name="populous"), "now have none")


def test_snapshot_month_with_no_rows_aborts(tmp_path, workspace):
    rows = [r for r in load_rows() if (r["FIRST_NZ_REGISTRATION_YEAR"], r["FIRST_NZ_REGISTRATION_MONTH"]) != (2026, 8)]
    cfg = make_cfg(workspace)
    expect_abort(lambda: run(tmp_path, cfg, rows), "has no rows")


def test_older_snapshot_aborts(tmp_path, workspace):
    cfg, rows, state = good_state(tmp_path, workspace)
    state["latest_snapshot"] = "2026-09-30"
    expect_abort(lambda: run(tmp_path, cfg, rows, state=state, name="second"), "is older than")


def test_unchanged_snapshot_and_count_with_different_key_aborts(tmp_path, workspace):
    cfg, rows, state = good_state(tmp_path, workspace)
    state["change_key"] = dict(state["change_key"], stats_sha256="something-else")
    expect_abort(lambda: run(tmp_path, cfg, rows, state=state, name="second"), "without advancing")


def test_unmapped_make_over_threshold_aborts(tmp_path, workspace):
    rows = load_rows()
    template = next(r for r in rows if r["OBJECTID"] == 62)
    extra = [dict(template, OBJECTID=1000 + i, MAKE=f"UNKNOWN MAKE {i}") for i in range(5)]
    cfg = make_cfg(workspace)
    expect_abort(lambda: run(tmp_path, cfg, rows + extra), "registrations_surviving.make: unmapped rate")


def unknown_makes_in_snapshot_month(rows, count, first_id):
    template = next(r for r in rows if r["OBJECTID"] == 62)
    snapshot = date.fromisoformat(source_for(rows)["change_key"]["snapshot"])
    return [dict(template, OBJECTID=first_id + i, MAKE=f"UNKNOWN MAKE {i}",
                 FIRST_NZ_REGISTRATION_YEAR=snapshot.year, FIRST_NZ_REGISTRATION_MONTH=snapshot.month) for i in range(count)]


def test_trailing_unmapped_guard_aborts_when_the_whole_run_passes(tmp_path, workspace):
    rows = load_rows()
    cfg = make_cfg(workspace)
    cfg.pipeline["guardrails"]["max_unmapped_rate"] = 0.5  # the whole-run basis passes; only the trailing basis can abort
    expect_abort(lambda: run(tmp_path, cfg, rows + unknown_makes_in_snapshot_month(rows, 3, 4000)),
                 "registrations_surviving.make: unmapped rate over the trailing 12 months")


def test_trailing_unmapped_warning_and_published_headroom(tmp_path, workspace):
    rows = load_rows()
    cfg = make_cfg(workspace)
    g = cfg.pipeline["guardrails"]
    g.update(max_unmapped_rate=0.5, max_unmapped_rate_trailing=0.5, warn_unmapped_rate_trailing=0.0)
    manifest = run(tmp_path, cfg, rows + unknown_makes_in_snapshot_month(rows, 1, 5000), publish=False)
    assert any("warning level" in w for w in manifest["warnings"]), manifest["warnings"]
    guard = manifest["datasets"]["registrations_surviving"]["unmapped_guard"]
    assert sorted(guard) == sorted(g["abort_on_unmapped"])
    for figures in guard.values():
        assert 0 < figures["trailing"]["rows"] < figures["whole_run"]["rows"]
        for basis in (figures["whole_run"], figures["trailing"]):
            assert basis["headroom_rows"] == int(basis["abort_above"] * basis["rows"]) - basis["unmapped"]
    assert guard["make"]["trailing"]["unmapped"] >= 1


def test_live_dimension_cannot_silently_drop_out(tmp_path, workspace):
    cfg, rows, state = good_state(tmp_path, workspace)
    template = next(r for r in rows if r["OBJECTID"] == 62)
    extra = [dict(template, OBJECTID=2000 + i, TLA=f"UNKNOWN DISTRICT {i}") for i in range(5)]
    grown = rows + extra
    state["in_scope_row_count"] = state["in_scope_row_count"] + len(extra)
    expect_abort(lambda: run(tmp_path, cfg, grown, state=state, name="second"), "registrations_surviving.region: unmapped rate")

    fresh = make_cfg({k: v.parent / "fresh" / v.name for k, v in workspace.items()})
    manifest = run(tmp_path, fresh, grown, name="fresh")
    assert "region" in manifest["datasets"]["registrations_surviving"]["not_live"]


def test_unknown_vehicle_type_aborts(tmp_path, workspace):
    rows = load_rows() + [dict(load_rows()[0], OBJECTID=3000, VEHICLE_TYPE="NOT A REAL TYPE")]
    cfg = make_cfg(workspace)
    expect_abort(lambda: run(tmp_path, cfg, rows), "scope cannot be decided")


def test_unresolvable_event_scope_value_aborts(tmp_path, workspace):
    cfg = make_cfg(workspace)
    ref = tmp_path / "reference"
    shutil.copytree(cfg.reference("x").parent, ref)
    events_file = ref / cfg.pipeline["events"]["file"]
    header = events_file.read_text(encoding="utf-8").splitlines()[0].split(",")
    row = {c: "" for c in header}
    row.update(id="test-unresolvable", date_start="2026-01-01", category="policy", mechanism="demand", scope="powertrain",
               scope_values="NOT A POWERTRAIN", title="t", summary="s", expected_effect="none", confidence="documented",
               verified=cfg.pipeline["boolean_true"], source_url="https://example.invalid")
    with events_file.open("a", encoding="utf-8", newline="") as fh:
        fh.write(",".join(row[c] for c in header) + "\n")
    cfg = make_cfg(workspace, reference_dir=ref)
    expect_abort(lambda: run(tmp_path, cfg, load_rows()), "do not resolve")


def test_abort_leaves_last_good_build_untouched(tmp_path, workspace):
    cfg, rows, state = good_state(tmp_path, workspace)
    before = (workspace["public"] / "manifest.json").read_text(encoding="utf-8")
    state_before = workspace["state"].read_text(encoding="utf-8")
    state["latest_snapshot"] = "2026-09-30"
    with pytest.raises(GuardrailError):
        run(tmp_path, cfg, rows, state=state, name="second")
    assert (workspace["public"] / "manifest.json").read_text(encoding="utf-8") == before
    assert workspace["state"].read_text(encoding="utf-8") == state_before


def registry_rows(cfg) -> list[dict]:
    return reference.read(cfg.reference(cfg.pipeline["brand"]["model_registry"]))


def reference_with_registry(directory, cfg, rows):
    """A copy of the reference directory whose model_registry.csv holds exactly these rows."""
    shutil.copytree(cfg.reference("x").parent, directory)
    with (directory / cfg.pipeline["brand"]["model_registry"]).open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    return directory


def make_totals(workspace) -> Counter:
    con = duckdb.connect()
    path = (workspace["public"] / "cube" / "registrations_surviving" / "make.parquet").as_posix()
    totals = Counter(dict(con.execute(f"SELECT dim_value, sum(n) FROM read_parquet('{path}') GROUP BY 1").fetchall()))
    con.close()
    return totals


def test_a_promotion_forbidden_by_a_not_promoted_row_aborts(tmp_path, workspace):
    cfg = make_cfg(workspace)
    b = cfg.pipeline["brand"]
    makes = {r[b["canonical"]] for r in reference.read(cfg.reference(b["registry"]))}
    rows = registry_rows(cfg)
    exclusion = next(r for r in rows if r[b["model_registry_type"]] == b["not_promoted_type"]
                     and r[b["model_registry_make"]] in makes and r[b["model_registry_value"]] in makes)
    promotion = dict(exclusion, **{b["model_registry_model"]: "A NEW MODEL STRING", b["model_registry_aliases"]: "",
                                   b["model_registry_type"]: b["make_promotion_type"]})
    ref = reference_with_registry(tmp_path / "reference", cfg, rows + [promotion])
    expect_abort(lambda: run(tmp_path, make_cfg(workspace, reference_dir=ref), load_rows()), b["not_promoted_type"])


def test_registry_match_columns_are_validated(tmp_path, workspace):
    cfg = make_cfg(workspace)
    b = cfg.pipeline["brand"]
    column = b["model_registry_conditions"]["vehicle_type"]
    rows = registry_rows(cfg)
    alias = next(r for r in rows if r[b["model_registry_type"]] in b["model_alias_types"])
    conditioned = next(r for r in rows if r[column])
    on_alias = [dict(r, **{column: conditioned[column]}) if r is alias else r for r in rows]
    ref = reference_with_registry(tmp_path / "on_alias", cfg, on_alias)
    expect_abort(lambda: run(tmp_path, make_cfg(workspace, reference_dir=ref), load_rows(), name="a"), "match columns apply only")
    unknown = [dict(r, **{column: "NOT A VEHICLE TYPE"}) if r is conditioned else r for r in rows]
    ref = reference_with_registry(tmp_path / "unknown", cfg, unknown)
    expect_abort(lambda: run(tmp_path, make_cfg(workspace, reference_dir=ref), load_rows(), name="b"), "is not a known")


def test_conditional_promotion_moves_only_matching_vehicles(tmp_path, workspace):
    cfg = make_cfg(workspace)
    b, vehicle = cfg.pipeline["brand"], cfg.pipeline["scope"]["vehicle"]
    column = b["model_registry_conditions"]["vehicle_type"]
    rule = next(r for r in registry_rows(cfg) if r[b["model_registry_type"]] == b["make_promotion_type"] and r[column])
    other_type = next(r[vehicle["key"]] for r in reference.read(cfg.reference(vehicle["file"]))
                      if r[vehicle["in_scope"]] == cfg.pipeline["boolean_true"] and r[vehicle["key"]] != rule[column])
    rows = load_rows()
    snapshot = date.fromisoformat(source_for(rows)["change_key"]["snapshot"])
    template = next(r for r in rows if r["OBJECTID"] == 62)
    matching = dict(template, OBJECTID=6000, MAKE=rule[b["model_registry_make"]], MODEL=rule[b["model_registry_model"]],
                    VEHICLE_TYPE=rule[column], FIRST_NZ_REGISTRATION_YEAR=snapshot.year, FIRST_NZ_REGISTRATION_MONTH=snapshot.month)
    not_matching = dict(matching, OBJECTID=6001, VEHICLE_TYPE=other_type)
    run(tmp_path, cfg, rows, name="baseline")
    before = make_totals(workspace)
    run(tmp_path, cfg, rows + [matching, not_matching], name="promoted")
    after = make_totals(workspace)
    assert after[rule[b["model_registry_value"]]] - before[rule[b["model_registry_value"]]] == 1
    assert after[rule[b["model_registry_make"]]] - before[rule[b["model_registry_make"]]] == 1


def test_schema_drift_aborts_and_new_columns_warn():
    expected = {"fields": [{"name": "A", "type": "esriFieldTypeString"}, {"name": "B", "type": "esriFieldTypeInteger"}]}
    with pytest.raises(GuardrailError, match="missing"):
        schema.check(expected, {"fields": [{"name": "A", "type": "esriFieldTypeString"}]}, ["A"])
    with pytest.raises(GuardrailError, match="changed type"):
        schema.check(expected, {"fields": [{"name": "A", "type": "esriFieldTypeString"}, {"name": "B", "type": "esriFieldTypeString"}]}, ["A"])
    warnings = schema.check(expected, {"fields": expected["fields"] + [{"name": "C", "type": "esriFieldTypeString"}]}, ["A", "B"])
    assert warnings and "C" in warnings[0]


def test_overlapping_reference_ranges_abort():
    rows = [{"k": "x", "lo": "1", "hi": "10"}, {"k": "x", "lo": "5", "hi": "20"}]
    with pytest.raises(GuardrailError, match="overlapping"):
        reference.validate_ranges(rows, ["k"], "lo", "hi", "test")


def test_model_cap_collapses_to_other(tmp_path, workspace):
    cfg = with_dimension_change(make_cfg(workspace), "model", cap=2)
    manifest = run(tmp_path, cfg, load_rows(), publish=False)
    cap = manifest["datasets"]["registrations_surviving"]["model_cap"]["model"]
    assert cap["cap"] == 2 and cap["basis"] == "trailing_12_months" and 0 < cap["coverage_trailing"] < 1


def test_moving_cutoff_detection():
    cfg = make_cfg({})
    by_year = Counter({2014: 50, 2013: 120, 2012: 110, 2011: 1, 2006: 4})
    assert metrics.moving_cutoff(by_year, 2026, cfg) == (2012, 14)
    tapering_tail = Counter({2013: 100, 2012: 90, 2011: 60, 2010: 40, 2009: 25, 2008: 15, 2007: 9, 2006: 5})
    assert metrics.moving_cutoff(tapering_tail, 2026, cfg) == (None, None)


def test_snapshot_is_capped_at_month_before_fetch_and_key_ignores_row_order():
    cfg = make_cfg({})
    f = cfg.pipeline["fields"]
    stats = [
        {f["registration_year"]: 2026, f["registration_month"]: 8, f["import_status"]: "a", f["vehicle_type"]: "b", "n": 10},
        {f["registration_year"]: 2026, f["registration_month"]: 9, f["import_status"]: "a", f["vehicle_type"]: "b", "n": 2},
    ]
    key, after = fetch.snapshot_and_key(cfg, stats, 12, date(2026, 9, 11))
    assert key["snapshot"] == "2026-08-31" and after == 2
    reordered, _ = fetch.snapshot_and_key(cfg, list(reversed(stats)), 12, date(2026, 9, 11))
    assert reordered == key
