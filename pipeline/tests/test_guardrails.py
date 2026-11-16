"""Every abort condition in docs/CUBE_SCHEMA.md, and that an abort leaves the last good build untouched."""

from __future__ import annotations

import copy
import csv
import json
import shutil
from collections import Counter
from datetime import date
from fractions import Fraction

import duckdb
import pytest

from pipeline import build, derive, fetch, guardrails, metrics, reference, schema
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


def test_a_new_snapshot_month_is_archived_and_earlier_months_are_untouched(tmp_path, workspace):
    cfg, rows, state = good_state(tmp_path, workspace)
    august = workspace["snapshots"] / "2026-08.parquet"
    before = august.read_bytes()
    source = source_for(rows)
    source["change_key"]["snapshot"] = "2026-09-30"
    manifest = run(tmp_path, cfg, rows, state=state, source=source, name="next_month")
    assert manifest["snapshot_archive"] == {"path": f"{cfg.pipeline['snapshot_archive']['dir']}/2026-09.parquet", "status": "new"}
    assert (workspace["snapshots"] / "2026-09.parquet").exists()
    assert august.read_bytes() == before
    assert json.loads(workspace["state"].read_text(encoding="utf-8"))["latest_snapshot"] == "2026-09-30"


def test_changed_content_for_an_archived_month_keeps_the_first_observation(tmp_path, workspace):
    cfg, rows, state = good_state(tmp_path, workspace)
    august = workspace["snapshots"] / "2026-08.parquet"
    before = august.read_bytes()
    restated = rows + [dict(next(r for r in rows if r["OBJECTID"] == 62), OBJECTID=9000)]
    manifest = run(tmp_path, cfg, restated, state=state, name="restated")
    assert manifest["snapshot_archive"]["status"] == "kept_first_observation"
    assert any("the first observation is kept" in w for w in manifest["warnings"]), manifest["warnings"]
    assert august.read_bytes() == before


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


def test_a_pair_waits_while_one_of_its_dimensions_is_not_live(tmp_path, workspace):
    rows = load_rows()
    template = next(r for r in rows if r["OBJECTID"] == 62)
    extra = [dict(template, OBJECTID=2000 + i, TLA=f"UNKNOWN DISTRICT {i}") for i in range(5)]
    cfg = make_cfg(workspace)
    cfg.pipeline["datasets"]["registrations_surviving"]["pairs"] = [["import_status", "region"]]
    manifest = run(tmp_path, cfg, rows + extra, publish=False)
    info = manifest["datasets"]["registrations_surviving"]
    assert "region" in info["not_live"]
    assert info["live_pairs"] == []
    assert info["not_live_pairs"] == {"import_status__region": "dimensions not live: region"}
    assert any("import_status__region is not live" in w for w in manifest["warnings"]), manifest["warnings"]
    assert not (workspace["staging"] / "build" / "pairs").exists()


@pytest.mark.parametrize("pairs, fragment", [
    ([["import_status", "import_status"]], "must name two different dimensions"),
    ([["import_status"]], "must name two different dimensions"),
    ([["import_status", None]], "must name two different dimensions"),
    (["import_status"], "must name two different dimensions"),
    ([["import_status", "age_at_registration_band"]] * 2, "is listed twice"),
    ([["import_status", "age_at_registration_band"], ["age_at_registration_band", "import_status"]], "is listed twice"),
    ([["import_status", "imported_from"]], "imported_from is not a derivable dimension of this dataset"),
    ([["import_status", "no_such_dimension"]], "no_such_dimension is not a derivable dimension of this dataset"),
    ([["import_status", "age__band"]], "names a dimension id containing '__'"),
    ([["a__b", "import_status"]], "names a dimension id containing '__'"),
])
def test_a_misconfigured_pair_aborts(tmp_path, workspace, pairs, fragment):
    cfg = make_cfg(workspace)
    cfg.pipeline["datasets"]["registrations_surviving"]["pairs"] = pairs
    expect_abort(lambda: run(tmp_path, cfg, load_rows()), fragment)


def test_the_fact_table_is_written_without_a_dimension_that_is_not_live(tmp_path, workspace):
    rows = load_rows()
    template = next(r for r in rows if r["OBJECTID"] == 62)
    extra = [dict(template, OBJECTID=2000 + i, TLA=f"UNKNOWN DISTRICT {i}") for i in range(5)]
    cfg = make_cfg(workspace)
    cfg.pipeline["datasets"]["registrations_surviving"]["facts"] = ["import_status", "region"]
    manifest = run(tmp_path, cfg, rows + extra, publish=False)
    facts = manifest["datasets"]["registrations_surviving"]["facts"]
    assert facts["dimensions"] == ["import_status"]
    assert facts["not_live"] == {"region": "dimension not live"}
    assert any("fact table is written without region" in w for w in manifest["warnings"]), manifest["warnings"]
    written = sorted(p.name for p in (workspace["staging"] / "build" / "facts" / "registrations_surviving").iterdir())
    assert written == ["import_status.parquet", "month.parquet", "n.parquet"]


def test_the_fact_table_counts_vehicles_that_share_every_value_in_one_row(tmp_path, workspace):
    # The fixture's vehicles all differ somewhere, so add copies of one: the table must group them, not list them.
    rows = load_rows()
    template = next(r for r in rows if r["OBJECTID"] == 62)
    copies = [dict(template, OBJECTID=4000 + i) for i in range(3)]
    cfg = make_cfg(workspace)
    manifest = run(tmp_path, cfg, rows + copies, publish=False)
    info = manifest["datasets"]["registrations_surviving"]
    folder = workspace["staging"] / "build" / "facts" / "registrations_surviving"
    con = duckdb.connect()
    counts = [r[0] for r in con.execute(f"SELECT n FROM read_parquet('{(folder / 'n.parquet').as_posix()}')").fetchall()]
    assert max(counts) >= 4, counts
    assert sum(counts) == info["rows"] and len(counts) == info["facts"]["rows"]


def test_a_fact_table_whose_dimensions_are_all_waiting_holds_the_month_totals(tmp_path, workspace):
    rows = load_rows()
    template = next(r for r in rows if r["OBJECTID"] == 62)
    extra = [dict(template, OBJECTID=2000 + i, TLA=f"UNKNOWN DISTRICT {i}") for i in range(5)]
    cfg = make_cfg(workspace)
    cfg.pipeline["datasets"]["registrations_surviving"]["facts"] = ["region"]
    manifest = run(tmp_path, cfg, rows + extra, publish=False)
    facts = manifest["datasets"]["registrations_surviving"]["facts"]
    assert facts["dimensions"] == [] and facts["not_live"] == {"region": "dimension not live"}
    written = sorted(p.name for p in (workspace["staging"] / "build" / "facts" / "registrations_surviving").iterdir())
    assert written == ["month.parquet", "n.parquet"]
    assert facts["rows"] == manifest["datasets"]["registrations_surviving"]["months"]


def test_a_dataset_with_no_facts_configured_builds_without_a_fact_table(tmp_path, workspace):
    cfg = make_cfg(workspace)
    datasets = cfg.pipeline["datasets"]
    datasets["without_facts"] = {"require": ["in_scope"]}
    manifest = run(tmp_path, cfg, load_rows(), publish=False)
    assert manifest["datasets"]["without_facts"]["facts"] is None
    assert manifest["datasets"]["without_facts"]["live_dimensions"]
    assert manifest["datasets"]["registrations_surviving"]["facts"] is not None
    facts = workspace["staging"] / "build" / "facts"
    assert [p.name for p in facts.iterdir()] == ["registrations_surviving"]
    assert (workspace["staging"] / "build" / "cube" / "without_facts").is_dir()


def test_a_fact_table_that_counts_a_vehicle_twice_aborts(tmp_path, workspace, monkeypatch):
    # A lookup that matched a vehicle twice would repeat it in dims, and in every count taken from dims with it.
    build_dims = derive.build_dims

    def repeating_one_vehicle(con, cfg, derived):
        build_dims(con, cfg, derived)
        con.execute("INSERT INTO dims SELECT * FROM dims WHERE fleet_entry AND reg_month IS NOT NULL ORDER BY reg_month LIMIT 1")

    monkeypatch.setattr(derive, "build_dims", repeating_one_vehicle)
    expect_abort(lambda: run(tmp_path, make_cfg(workspace), load_rows(), publish=False), "the fact table counts")


@pytest.mark.parametrize("facts, fragment", [
    ("import_status", "facts must list distinct dimension ids"),
    ([], "facts must list distinct dimension ids, at least one"),
    (["import_status", "import_status"], "facts must list distinct dimension ids"),
    (["import_status", None], "facts must list distinct dimension ids"),
    (["imported_from"], "facts names imported_from, not a derivable dimension"),
    (["no_such_dimension"], "facts names no_such_dimension, not a derivable dimension"),
])
def test_a_misconfigured_fact_table_aborts(tmp_path, workspace, facts, fragment):
    cfg = make_cfg(workspace)
    cfg.pipeline["datasets"]["registrations_surviving"]["facts"] = facts
    expect_abort(lambda: run(tmp_path, cfg, load_rows()), fragment)


@pytest.mark.parametrize("name", ["month", "n", "rid"])
def test_a_dimension_named_for_a_reserved_fact_column_is_blamed_for_its_name(tmp_path, workspace, name):
    # The abort must name the real cause (the id is taken), not say the dimension cannot be derived.
    cfg = make_cfg(workspace)
    cfg.pipeline["datasets"]["registrations_surviving"]["facts"] = ["import_status", name]
    with pytest.raises(GuardrailError) as info:
        run(tmp_path, cfg, load_rows())
    message = str(info.value)
    assert f"facts names {name}, a name the fact table reserves" in message, message
    assert "rename its id in dimensions.json" in message, message
    assert "not a derivable dimension" not in message, message


@pytest.mark.parametrize("lookup", ["vehicle", "status"])
def test_a_scope_key_listed_twice_aborts(tmp_path, workspace, lookup):
    # Both scope files are joined to every vehicle, so a repeated key would double its vehicles in every count.
    cfg = make_cfg(workspace)
    ref = tmp_path / "reference"
    shutil.copytree(cfg.reference("x").parent, ref)
    file = ref / cfg.pipeline["scope"][lookup]["file"]
    lines = file.read_text(encoding="utf-8").splitlines()
    file.write_text("\n".join(lines + [lines[1]]) + "\n", encoding="utf-8", newline="\n")
    expect_abort(lambda: run(tmp_path, make_cfg(workspace, reference_dir=ref), load_rows()), "keys defined more than once")


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


@pytest.mark.parametrize("changes, fragment", [
    ({"mechanism": "measurment"}, "test-schema: mechanism 'measurment' is not in the enum"),
    ({"category": "polcy"}, "test-schema: category 'polcy' is not in the enum"),
    ({"expected_effect": "sideways"}, "test-schema: expected_effect 'sideways' is not in the enum"),
    ({"confidence": "rumoured"}, "test-schema: confidence 'rumoured' is not in the enum"),
    ({"title": "x" * 61}, "test-schema: title is 61 characters, over the 60 allowed"),
])
def test_a_verified_event_outside_the_schema_table_aborts(tmp_path, workspace, changes, fragment):
    cfg = make_cfg(workspace)
    ref = tmp_path / "reference"
    shutil.copytree(cfg.reference("x").parent, ref)
    events_file = ref / cfg.pipeline["events"]["file"]
    header = events_file.read_text(encoding="utf-8").splitlines()[0].split(",")
    row = {c: "" for c in header}
    row.update(id="test-schema", date_start="2026-01-01", category="policy", mechanism="demand", scope="market",
               title="t", summary="s", expected_effect="none", confidence="documented",
               verified=cfg.pipeline["boolean_true"], source_url="https://example.invalid")
    row.update(changes)
    with events_file.open("a", encoding="utf-8", newline="") as fh:
        fh.write(",".join(row[c] for c in header) + "\n")
    cfg = make_cfg(workspace, reference_dir=ref)
    expect_abort(lambda: run(tmp_path, cfg, load_rows()), fragment)


@pytest.mark.parametrize("before, after, fragment", [
    ("| `mechanism` | enum |", "| `mechanism` | enum, required |", "could not find the enum table rows for ['mechanism']"),
    ("| `title` | short | ≤60 chars", "| `title` | short | at most 60 chars", "could not find the title length"),
    ("| `mechanism` | enum | `demand` `supply` `measurement` `mix` ", "| `mechanism` | enum | demand, supply, measurement, mix ",
     "the enum table rows for ['mechanism']"),
])
def test_a_schema_table_row_that_stops_parsing_aborts(tmp_path, workspace, before, after, fragment):
    cfg = make_cfg(workspace)
    doc = tmp_path / "EVENTS_LAYER.md"
    text = cfg.path("events_doc").read_text(encoding="utf-8")
    assert before in text
    doc.write_text(text.replace(before, after), encoding="utf-8", newline="\n")
    cfg = make_cfg(workspace, events_doc=doc)
    expect_abort(lambda: run(tmp_path, cfg, load_rows()), fragment)


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
    return slice_totals(workspace, "make")


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


def slice_totals(workspace, dimension: str) -> Counter:
    con = duckdb.connect()
    path = (workspace["public"] / "cube" / "registrations_surviving" / f"{dimension}.parquet").as_posix()
    totals = Counter(dict(con.execute(f"SELECT dim_value, sum(n) FROM read_parquet('{path}') GROUP BY 1").fetchall()))
    con.close()
    return totals


def hybrid_rows(cfg) -> list[dict]:
    return reference.read(cfg.reference(cfg.pipeline["hybrid_classification"]["file"]))


def reference_with_hybrids(directory, cfg, rows):
    """A copy of the reference directory whose mild_hybrid_models.csv holds exactly these rows."""
    shutil.copytree(cfg.reference("x").parent, directory)
    with (directory / cfg.pipeline["hybrid_classification"]["file"]).open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    return directory


def test_mild_hybrid_classification_moves_only_matching_vehicles(tmp_path, workspace):
    cfg = make_cfg(workspace)
    p = cfg.pipeline
    # The invented register identifies too few of its mild hybrids to publish the split; this test is about the rows.
    p["hybrid_classification"]["publish_split_at_trailing_high_confidence_coverage"] = 0.0
    h, status = p["hybrid_classification"], p["scope"]["status"]
    conditions = p["brand"]["model_registry_conditions"]
    rule = next(r for r in hybrid_rows(cfg)
                if r[h["type"]] == h["types"]["mild"] and r[h["override"]] and r[conditions["import_status"]])
    dimension = next(d for d in cfg.dimensions["dimensions"]
                     if d.get("derive", {}).get("reference") == p["engine"]["reference"])
    spec = dimension["derive"]
    labels = {r[spec["key"]]: r[spec["value"]] for r in reference.read(cfg.reference(spec["reference"]))}
    replaced, replacement = labels[rule[conditions["motive_power"]]], labels[rule[h["override"]]]
    assert replaced != replacement
    entries = [r for r in reference.read(cfg.reference(status["file"]))
               if r[status["in_scope"]] == p["boolean_true"] and r[status["fleet_entry"]] == p["boolean_true"]]
    wanted = rule[conditions["import_status"]]
    rows = load_rows()
    snapshot = date.fromisoformat(source_for(rows)["change_key"]["snapshot"])
    template = next(r for r in rows if r["OBJECTID"] == 62)
    model = rule[h["models"]].split(p["brand"]["alias_separator"])[0]
    matching = dict(template, OBJECTID=7000, MAKE=rule[h["make"]], MODEL=model, MOTIVE_POWER=rule[conditions["motive_power"]],
                    IMPORT_STATUS=next(r[status["key"]] for r in entries if r[status["label"]] == wanted),
                    FIRST_NZ_REGISTRATION_YEAR=snapshot.year, FIRST_NZ_REGISTRATION_MONTH=snapshot.month)
    not_matching = dict(matching, OBJECTID=7001,
                        IMPORT_STATUS=next(r[status["key"]] for r in entries if r[status["label"]] != wanted))
    run(tmp_path, cfg, rows, name="baseline")
    before = slice_totals(workspace, dimension["id"])
    manifest = run(tmp_path, cfg, rows + [matching, not_matching], name="classified")
    after = slice_totals(workspace, dimension["id"])
    assert after[replacement] - before[replacement] == 1
    assert after[replaced] - before[replaced] == 1
    assert manifest["datasets"]["registrations_surviving"]["unmapped_rates"][dimension["id"]] == 0


def test_hybrid_override_must_name_the_motive_power_it_replaces(tmp_path, workspace):
    cfg = make_cfg(workspace)
    h = cfg.pipeline["hybrid_classification"]
    column = cfg.pipeline["brand"]["model_registry_conditions"]["motive_power"]
    rows = [dict(r, **{column: ""}) if r[h["override"]] else r for r in hybrid_rows(cfg)]
    ref = reference_with_hybrids(tmp_path / "reference", cfg, rows)
    expect_abort(lambda: run(tmp_path, make_cfg(workspace, reference_dir=ref), load_rows()), f"must set {column}")


def test_hybrid_classifications_that_overlap_or_contradict_abort(tmp_path, workspace):
    cfg = make_cfg(workspace)
    h = cfg.pipeline["hybrid_classification"]
    column = cfg.pipeline["brand"]["model_registry_conditions"]["motive_power"]
    rows = hybrid_rows(cfg)
    ref = reference_with_hybrids(tmp_path / "overlap", cfg, rows + [dict(rows[0])])
    expect_abort(lambda: run(tmp_path, make_cfg(workspace, reference_dir=ref), load_rows(), name="a"), "both match")
    rule = next(r for r in rows if r[h["type"]] == h["types"]["mild"] and r[h["override"]])
    contradicted = [dict(r, **{h["override"]: r[column]}) if r is rule else r for r in rows]
    ref = reference_with_hybrids(tmp_path / "contradiction", cfg, contradicted)
    expect_abort(lambda: run(tmp_path, make_cfg(workspace, reference_dir=ref), load_rows(), name="b"), "but its powertrain would be")


def test_mild_hybrid_coverage_is_published_and_adds_up(tmp_path, workspace):
    cfg = make_cfg(workspace)
    h = cfg.pipeline["hybrid_classification"]
    manifest = run(tmp_path, cfg, load_rows(), publish=False)
    published = manifest["datasets"]["registrations_surviving"]["mild_hybrid_identification_coverage"]
    assert published["label"] in h["labels"].values()
    assert published["complete_at_coverage"] == h["complete_at_coverage"]
    assert published["all_time"]["source_hybrids"] > 0
    for basis in (published["all_time"], published["trailing"]):
        assert basis["identified_mild"] + basis["identified_full"] + basis["unknown"] == basis["source_hybrids"]
        by_confidence = basis["identified_mild_by_confidence"]
        assert sum(by_confidence.values()) == basis["identified_mild"]
        denominator = basis["identified_mild"] + basis["unknown"]
        assert basis["coverage_stated_confidence"] == round(basis["identified_mild"] / denominator, 4)
        high = by_confidence[h["high_confidence_level"]] + by_confidence["code_default"]
        # Full rows below the high level stay in the denominator at high confidence, so it lies between the figure over
        # the stated denominator and the one over every hybrid; the exact counts are held in the tests built from counts.
        assert round(high / (denominator + basis["identified_full"]), 4) <= basis["coverage_high_confidence_only"] <= round(high / denominator, 4)
        assert basis["coverage_high_confidence_only"] <= basis["coverage_stated_confidence"]


def test_low_trailing_high_confidence_coverage_warns(tmp_path, workspace):
    cfg = make_cfg(workspace)
    h = cfg.pipeline["hybrid_classification"]
    # The split is published here, so that only the warning level is under test; withholding has its own warning.
    h["publish_split_at_trailing_high_confidence_coverage"] = 0.0
    h["warn_below_trailing_high_confidence_coverage"] = 0.0
    quiet = run(tmp_path, cfg, load_rows(), name="quiet", publish=False)
    assert not any("high-confidence" in w for w in quiet["warnings"])
    h["warn_below_trailing_high_confidence_coverage"] = 1.0
    loud = run(tmp_path, cfg, load_rows(), name="loud", publish=False)
    assert any("high-confidence" in w for w in loud["warnings"]), loud["warnings"]


def split_values(workspace, dataset: str = "registrations_surviving") -> dict[str, set]:
    """Every powertrain value in the dimension's slice, its fact-table column and its pair with another dimension."""
    con = duckdb.connect()
    public = (workspace["public"]).as_posix()
    out = {
        "slice": con.execute(f"SELECT DISTINCT dim_value FROM read_parquet('{public}/cube/{dataset}/powertrain.parquet')").fetchall(),
        "facts": con.execute(f"SELECT DISTINCT powertrain FROM read_parquet('{public}/facts/{dataset}/powertrain.parquet')").fetchall(),
        "pair": con.execute(f"SELECT DISTINCT a_value FROM read_parquet('{public}/pairs/{dataset}/powertrain__segment_group.parquet')").fetchall(),
    }
    con.close()
    return {k: {v for (v,) in rows} for k, rows in out.items()}


def test_a_dataset_under_the_threshold_does_not_publish_the_mild_split_and_one_above_it_does(tmp_path, workspace):
    cfg = make_cfg(workspace)
    h = cfg.pipeline["hybrid_classification"]
    mild, undivided = h["mild_powertrain"], h["undivided_powertrain"]
    dataset = "registrations_surviving"

    h["publish_split_at_trailing_high_confidence_coverage"] = 0.0
    above = run(tmp_path, cfg, load_rows(), name="above")
    coverage = above["datasets"][dataset]["mild_hybrid_identification_coverage"]
    assert coverage["mild_split_published"] is True
    assert coverage["trailing"]["coverage_high_confidence_only"] is not None
    assert all(mild in values for values in split_values(workspace).values())
    published = slice_totals(workspace, "powertrain")
    assert not any("not published" in w for w in above["warnings"])

    # The same register against a threshold its trailing coverage does not reach.
    h["publish_split_at_trailing_high_confidence_coverage"] = 1.0
    below = run(tmp_path, cfg, load_rows(), name="below")
    coverage = below["datasets"][dataset]["mild_hybrid_identification_coverage"]
    assert coverage["mild_split_published"] is False
    assert coverage["publish_split_at_trailing_high_confidence_coverage"] == 1.0
    assert coverage["trailing"]["identified_mild"] > 0, "nothing was mild, so nothing is proved"
    for name, values in split_values(workspace).items():
        assert mild not in values and undivided in values, name
    withheld = slice_totals(workspace, "powertrain")
    # Every mild hybrid is counted as the undivided value, and no other count moves.
    assert withheld[undivided] == published[undivided] + published[mild]
    assert {k: v for k, v in withheld.items() if k != undivided} == {k: v for k, v in published.items() if k not in (undivided, mild)}
    assert sum(withheld.values()) == sum(published.values())
    assert any(w.startswith(f"{dataset}: ") and "the mild hybrid split is not published" in w for w in below["warnings"]), below["warnings"]
    # It says it once: the warning level does not add a second line for the same dataset.
    assert sum("mild hybrid identification coverage" in w and w.startswith(f"{dataset}: ") for w in below["warnings"]) == 1


SPLIT_DATASET = "registrations_surviving"


def split_flips(manifest: dict) -> list[str]:
    return [w for w in manifest["warnings"] if w.startswith(f"{SPLIT_DATASET}: the mild hybrid split was ")]


def built_with_threshold(tmp_path, workspace, threshold: float, state, name: str):
    """One build of the fixture register with the split's threshold at `threshold`: 0 publishes it, 1 withholds it."""
    cfg = make_cfg(workspace)
    cfg.pipeline["hybrid_classification"]["publish_split_at_trailing_high_confidence_coverage"] = threshold
    manifest = run(tmp_path, cfg, load_rows(), state=state, name=name)
    return cfg, manifest, json.loads(workspace["state"].read_text(encoding="utf-8"))


def test_a_build_that_withholds_a_split_the_last_good_state_published_says_so_and_still_publishes(tmp_path, workspace):
    cfg, _, state = built_with_threshold(tmp_path, workspace, 0.0, None, "published")
    h = cfg.pipeline["hybrid_classification"]
    assert state["mild_split"][SPLIT_DATASET]["published"] is True
    before = state["mild_split"][SPLIT_DATASET]["trailing_high_confidence_coverage"]
    assert before is not None
    assert h["mild_powertrain"] in split_values(workspace)["slice"]

    _, manifest, new_state = built_with_threshold(tmp_path, workspace, 1.0, state, "withheld")
    (warning,) = split_flips(manifest)
    # It names the dataset, the direction, both figures and what changes for a reader; the standing warning is still there.
    assert "was published in the last good build and is withheld now" in warning
    assert warning.count(f"{before:.2%}") == 2, "both coverage figures are named (the same here: only the threshold moved)"
    assert f"against {1.0:.0%}" in warning
    assert f"{h['mild_powertrain']} disappears" in warning and f"{h['undivided_powertrain']} rises" in warning
    assert any("the mild hybrid split is not published" in w for w in manifest["warnings"])
    # Withholding is the safe direction, so the run publishes: the cube and the state both move to the withheld split.
    assert h["mild_powertrain"] not in split_values(workspace)["slice"]
    assert new_state["mild_split"][SPLIT_DATASET]["published"] is False


def test_a_build_that_publishes_a_split_the_last_good_state_withheld_says_so(tmp_path, workspace):
    cfg, _, state = built_with_threshold(tmp_path, workspace, 1.0, None, "withheld")
    h = cfg.pipeline["hybrid_classification"]
    assert state["mild_split"][SPLIT_DATASET]["published"] is False

    _, manifest, new_state = built_with_threshold(tmp_path, workspace, 0.0, state, "published")
    (warning,) = split_flips(manifest)
    assert "was withheld in the last good build and is published now" in warning
    assert f"{h['mild_powertrain']} reappears" in warning and f"{h['undivided_powertrain']} falls" in warning
    assert h["mild_powertrain"] in split_values(workspace)["slice"]
    assert new_state["mild_split"][SPLIT_DATASET]["published"] is True


@pytest.mark.parametrize("threshold", [0.0, 1.0])
def test_a_build_that_keeps_the_split_as_it_was_adds_no_flip_warning(tmp_path, workspace, threshold):
    _, _, state = built_with_threshold(tmp_path, workspace, threshold, None, "first")
    _, manifest, _ = built_with_threshold(tmp_path, workspace, threshold, state, "second")
    assert split_flips(manifest) == []


def test_the_first_build_has_nothing_to_compare_and_records_the_split(tmp_path, workspace):
    _, manifest, state = built_with_threshold(tmp_path, workspace, 1.0, None, "first")
    assert split_flips(manifest) == []
    assert state["mild_split"] == {SPLIT_DATASET: {
        "published": False,
        "trailing_high_confidence_coverage": manifest["datasets"][SPLIT_DATASET]["mild_hybrid_identification_coverage"]
        ["trailing"]["coverage_high_confidence_only"]}}


@pytest.mark.parametrize("old", ["absent", "not_a_record", "no_flag"])
def test_a_state_written_before_the_record_is_read_safely_and_the_next_one_has_it(tmp_path, workspace, old):
    _, _, state = built_with_threshold(tmp_path, workspace, 0.0, None, "first")
    if old == "absent":
        del state["mild_split"]
    elif old == "not_a_record":
        state["mild_split"] = {SPLIT_DATASET: "published"}
    else:
        state["mild_split"] = {SPLIT_DATASET: {"trailing_high_confidence_coverage": 0.5}}
    _, manifest, new_state = built_with_threshold(tmp_path, workspace, 1.0, state, "second")
    assert split_flips(manifest) == []
    assert new_state["mild_split"][SPLIT_DATASET]["published"] is False


def test_a_flip_names_both_figures_and_a_window_with_no_hybrid():
    cfg = make_cfg({})
    h = cfg.pipeline["hybrid_classification"]
    record = lambda published, coverage: {"published": published, "trailing_high_confidence_coverage": coverage}
    previous = {"mild_split": {"a": record(True, 0.7312), "b": record(False, None), "c": record(True, 0.8)}}
    current = {"a": record(False, 0.6901), "b": record(True, 0.7), "c": record(True, 0.8), "d": record(False, 0.1)}
    found = {w.split(":")[0]: w for w in guardrails.split_flips(cfg, current, previous)}
    assert sorted(found) == ["a", "b"], "c did not change and d is new"
    assert "73.12%" in found["a"] and "69.01%" in found["a"] and "disappears" in found["a"]
    assert "no hybrid in the window" in found["b"] and "70.00%" in found["b"] and "reappears" in found["b"]
    assert guardrails.split_flips(cfg, current, None) == []
    assert f"against {h['publish_split_at_trailing_high_confidence_coverage']:.0%}" in found["a"]


def test_only_datasets_with_a_hybrid_coverage_block_have_a_split_to_remember():
    block = {"mild_split_published": True, "trailing": {"coverage_high_confidence_only": 0.8}}
    datasets = {"built": {"mild_hybrid_identification_coverage": block}, "waiting": {"not_built": "no store"}, "series": {"rows": 3}}
    assert guardrails.split_record(datasets) == {"built": {"published": True, "trailing_high_confidence_coverage": 0.8}}


def test_a_window_with_no_hybrid_to_divide_is_not_withheld():
    from pipeline import metrics as m
    cfg = make_cfg({})
    con = duckdb.connect()
    h = cfg.pipeline["hybrid_classification"]
    con.execute("CREATE TABLE rows AS SELECT TRUE AS in_scope, TRUE AS fleet_entry, DATE '2026-08-01' AS reg_month, "
                f"'X' AS {cfg.pipeline['engine']['field']}, 'X' AS {cfg.pipeline['engine']['field']}__source, "
                "CAST(NULL AS VARCHAR) AS hybrid_class, CAST(NULL AS VARCHAR) AS hybrid_confidence")
    out, _ = m.hybrid_coverage(con, cfg, "fleet_entry", date(2025, 9, 1), date(2026, 8, 1), 12)
    assert out["trailing"]["source_hybrids"] == 0 and out["trailing"]["coverage_high_confidence_only"] is None
    assert out["mild_split_published"] is True
    con.close()


def coverage_from_counts(cfg, identified_high: int, unknown: int, full_below_high: int = 0, full_high: int = 0,
                         below_high: str | None = None) -> dict:
    """hybrid_coverage over a table of exactly these counts: vehicles recorded under a hybrid code, `identified_high` of them
    classified mild at high confidence, `full_high` classified full at high confidence, `full_below_high` classified full at
    the level `below_high` (the first level under the high one by default) and `unknown` not classified at all, all in the
    trailing window."""
    h, engine = cfg.pipeline["hybrid_classification"], cfg.pipeline["engine"]
    keys = reference.hybrid_keys(cfg)
    code = sorted(keys["source_hybrid"] - keys["mild"])[0]
    con = duckdb.connect()
    con.execute(f"CREATE TABLE rows (in_scope BOOLEAN, fleet_entry BOOLEAN, reg_month DATE, {engine['field']} VARCHAR, "
                f"{engine['field']}__source VARCHAR, hybrid_class VARCHAR, hybrid_confidence VARCHAR)")
    high = h["high_confidence_level"]
    below = below_high or next(level for level in h["confidence_levels"] if level != high)
    for kind, level, n in ((h["types"]["mild"], high, identified_high), (None, None, unknown),
                           (h["types"]["full"], high, full_high), (h["types"]["full"], below, full_below_high)):
        con.execute(f"INSERT INTO rows SELECT TRUE, TRUE, DATE '2026-08-01', ?, ?, ?, ? FROM range({n})", [code, code, kind, level])
    out, counts = metrics.hybrid_coverage(con, cfg, "fleet_entry", date(2025, 9, 1), date(2026, 8, 1), 12)
    con.close()
    assert out["trailing"]["identified_mild"] == identified_high and out["trailing"]["unknown"] == unknown
    assert out["trailing"]["identified_full"] == full_high + full_below_high
    assert counts["trailing"] == (identified_high, identified_high + unknown + full_below_high)
    return out


@pytest.mark.parametrize("level", [None, "low"])
def test_a_nameplate_called_full_below_high_confidence_stays_in_the_denominator_at_high_confidence_only(level):
    """docs/METRICS.md: at high confidence only, a classification below the high level counts as none, whichever way it
    points. The two figures differ by exactly those vehicles; a full call at the high level leaves both denominators."""
    cfg = make_cfg({})
    without = coverage_from_counts(cfg, 60, 20)["trailing"]
    below = coverage_from_counts(cfg, 60, 20, full_below_high=500, below_high=level)["trailing"]
    assert below["identified_full"] == 500 and below["source_hybrids"] == 580
    assert without["coverage_stated_confidence"] == without["coverage_high_confidence_only"] == 0.75
    assert below["coverage_stated_confidence"] == 0.75, "the stated figure is unchanged by a full call at any confidence"
    assert below["coverage_high_confidence_only"] == round(60 / (80 + 500), 4)
    at_high = coverage_from_counts(cfg, 60, 20, full_high=500)["trailing"]
    assert at_high["coverage_stated_confidence"] == at_high["coverage_high_confidence_only"] == 0.75


def threshold_counts(cfg) -> tuple[int, int, int]:
    """Whole counts (numerator, denominator, scale) whose ratio is exactly the configured threshold, so the test follows the
    config: the numerator and denominator of the threshold as a fraction, times a scale that leaves room to step by one."""
    threshold = cfg.pipeline["hybrid_classification"]["publish_split_at_trailing_high_confidence_coverage"]
    fraction = Fraction(str(threshold))
    scale = 200_000 // fraction.denominator
    return fraction.numerator * scale, fraction.denominator * scale, scale


def test_a_dataset_exactly_at_the_threshold_publishes_and_one_vehicle_under_it_does_not():
    cfg = make_cfg({})
    at, total, _ = threshold_counts(cfg)
    exactly = coverage_from_counts(cfg, at, total - at)
    assert exactly["trailing"]["coverage_high_confidence_only"] == exactly["publish_split_at_trailing_high_confidence_coverage"]
    assert exactly["mild_split_published"] is True
    assert coverage_from_counts(cfg, at - 1, total - at + 1)["mild_split_published"] is False
    assert coverage_from_counts(cfg, at + 1, total - at - 1)["mild_split_published"] is True


def test_a_dataset_that_publishes_on_its_mild_calls_alone_is_withheld_once_full_calls_below_high_confidence_count_as_unknown():
    cfg = make_cfg({})
    at, total, _ = threshold_counts(cfg)
    assert coverage_from_counts(cfg, at, total - at)["mild_split_published"] is True
    # The same vehicles and one more, called full at a level under high: the stated figure is untouched, the split is not.
    out = coverage_from_counts(cfg, at, total - at, full_below_high=1)
    assert out["trailing"]["coverage_stated_confidence"] == coverage_from_counts(cfg, at, total - at)["trailing"]["coverage_stated_confidence"]
    assert out["mild_split_published"] is False
    # And exactly at the threshold with the full calls counted: the denominator is the unknown and the full vehicles together.
    full = total // 10
    assert coverage_from_counts(cfg, at, total - at - full, full_below_high=full)["mild_split_published"] is True
    assert coverage_from_counts(cfg, at, total - at - full + 1, full_below_high=full)["mild_split_published"] is False


def test_a_figure_that_rounds_up_to_the_threshold_but_is_under_it_does_not_publish():
    """The manifest's figure has four decimals. Judged on that figure, a ratio of 69.9995% would read 70% and publish;
    judged on the counts it is under the threshold, and the manifest still shows the rounded figure."""
    cfg = make_cfg({})
    at, total, _ = threshold_counts(cfg)
    out = coverage_from_counts(cfg, at - 1, total - at + 1)
    assert (at - 1) / total < out["publish_split_at_trailing_high_confidence_coverage"]
    assert out["trailing"]["coverage_high_confidence_only"] == out["publish_split_at_trailing_high_confidence_coverage"], (
        "the case proves nothing unless the rounded figure reaches the threshold")
    assert out["mild_split_published"] is False


def test_brand_registry_as_at_must_be_an_iso_date(tmp_path, workspace):
    cfg = make_cfg(workspace)
    b = cfg.pipeline["brand"]
    rows = reference.read(cfg.reference(b["registry"]))
    rows[0] = dict(rows[0], **{b["as_at"]: "LAST WEEK"})
    ref = tmp_path / "reference"
    shutil.copytree(cfg.reference("x").parent, ref)
    with (ref / b["registry"]).open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    expect_abort(lambda: run(tmp_path, make_cfg(workspace, reference_dir=ref), load_rows()), "not an ISO date")


def test_year_bounded_promotion_leaves_older_vehicles_with_the_parent(tmp_path, workspace):
    cfg = make_cfg(workspace)
    b = cfg.pipeline["brand"]
    conditions = b["model_registry_conditions"]
    start = conditions["vehicle_year_min"]
    rule = next(r for r in registry_rows(cfg) if r[b["model_registry_type"]] == b["make_promotion_type"] and r[start]
                and not any(r[column] for column in conditions.values() if column != start))
    first = int(rule[start])
    rows = load_rows()
    snapshot = date.fromisoformat(source_for(rows)["change_key"]["snapshot"])
    template = next(r for r in rows if r["OBJECTID"] == 62)
    from_first = dict(template, OBJECTID=8000, MAKE=rule[b["model_registry_make"]], MODEL=rule[b["model_registry_model"]],
                      VEHICLE_YEAR=first, FIRST_NZ_REGISTRATION_YEAR=snapshot.year, FIRST_NZ_REGISTRATION_MONTH=snapshot.month)
    before_first = dict(from_first, OBJECTID=8001, VEHICLE_YEAR=first - 1)
    run(tmp_path, cfg, rows, name="baseline")
    before = make_totals(workspace)
    run(tmp_path, cfg, rows + [from_first, before_first], name="split")
    after = make_totals(workspace)
    assert after[rule[b["model_registry_value"]]] - before[rule[b["model_registry_value"]]] == 1
    assert after[rule[b["model_registry_make"]]] - before[rule[b["model_registry_make"]]] == 1


def test_registry_year_columns_are_validated(tmp_path, workspace):
    cfg = make_cfg(workspace)
    conditions = cfg.pipeline["brand"]["model_registry_conditions"]
    start, end = conditions["vehicle_year_min"], conditions["vehicle_year_max"]
    rows = registry_rows(cfg)
    bounded = next(r for r in rows if r[start])
    not_a_year = [dict(r, **{start: "SOON"}) if r is bounded else r for r in rows]
    ref = reference_with_registry(tmp_path / "not_a_year", cfg, not_a_year)
    expect_abort(lambda: run(tmp_path, make_cfg(workspace, reference_dir=ref), load_rows(), name="a"), "is not a year")
    inverted = [dict(r, **{end: str(int(r[start]) - 1)}) if r is bounded else r for r in rows]
    ref = reference_with_registry(tmp_path / "inverted", cfg, inverted)
    expect_abort(lambda: run(tmp_path, make_cfg(workspace, reference_dir=ref), load_rows(), name="b"), f"{start} is after {end}")


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


@pytest.mark.parametrize("reverse", [False, True])
def test_the_model_cap_keeps_the_key_that_sorts_first_when_models_tie_at_the_boundary(reverse):
    """The cap keeps the `cap` models with the most vehicles in the trailing window. Where several tie at the last place,
    the one whose key sorts first in byte order is kept, whatever order the rows arrive in (docs/CUBE_SCHEMA.md)."""
    counts = {"K|BIG": 5, "K|2": 2, "K|1": 2, "K|3": 2, "K|0": 1}
    rows = [key for key, n in counts.items() for _ in range(n)]
    con = duckdb.connect()
    con.execute('CREATE TABLE dims ("d__model" VARCHAR, reg_month DATE)')
    for key in reversed(rows) if reverse else rows:
        con.execute("INSERT INTO dims VALUES (?, DATE '2026-08-01')", [key])
    dim = derive.Derived("model", "model", "", "", [], None, cap=2)
    cap = derive.apply_model_cap(con, dim, "TRUE", date(2025, 9, 1), date(2026, 8, 1))
    kept = {k for (k,) in con.execute('SELECT DISTINCT "d__model" FROM dims').fetchall()}
    assert kept == {"K|BIG", "K|1", "__OTHER__"}
    assert cap["cap"] == 2 and cap["coverage_trailing"] == round(7 / 12, 4)
    con.close()


# Tied keys that a locale's collation puts in another order than their bytes: upper before lower case, a digit before the
# separator, either case of the same letter, and all of them with a space. The first group of the cap's ranking is the
# byte order of the keys, whatever DuckDB's default collation is configured to be (docs/CUBE_SCHEMA.md).
COLLATION_CASES = {
    "case": (["Ka|X", "KB|X"], 1),
    "digit_before_separator": (["K1|X", "K|X"], 1),
    "upper_before_lower_of_one_letter": (["k|X", "K|X"], 1),
    "all_together": (["KA|X", "Ka|X", "K1|X", "K|X", "K a|X", "k|X"], 3),
}


@pytest.mark.parametrize("reverse", [False, True])
@pytest.mark.parametrize("name", COLLATION_CASES)
def test_the_model_cap_breaks_a_tie_in_byte_order_not_in_a_locales_order(name, reverse):
    tied, room = COLLATION_CASES[name]
    expected = set(sorted(tied, key=lambda key: key.encode("utf-8"))[:room])
    con = duckdb.connect()
    # The keys must tell the two orders apart, or the test proves nothing: DuckDB's own en_US collation picks others.
    in_locale_order = [k for (k,) in con.execute("SELECT k FROM (SELECT unnest(?) AS k) ORDER BY k COLLATE en_US", [tied]).fetchall()]
    assert set(in_locale_order[:room]) != expected, f"{name}: byte order and a locale's order agree"
    # One vehicle more than every tied key, so the leader is always kept and `room` places remain for the tied keys.
    rows = ["K|LEAD"] * (len(tied) + 1) + [key for key in tied for _ in range(2)]
    con.execute('CREATE TABLE dims ("d__model" VARCHAR, reg_month DATE)')
    for key in reversed(rows) if reverse else rows:
        con.execute("INSERT INTO dims VALUES (?, DATE '2026-08-01')", [key])
    assert con.execute("SELECT current_setting('default_collation')").fetchone()[0] == "", "the default is not binary"
    dim = derive.Derived("model", "model", "", "", [], None, cap=1 + room)
    derive.apply_model_cap(con, dim, "TRUE", date(2025, 9, 1), date(2026, 8, 1))
    kept = {k for (k,) in con.execute('SELECT DISTINCT "d__model" FROM dims').fetchall()} - {"K|LEAD", "__OTHER__"}
    assert kept == expected
    con.close()


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
