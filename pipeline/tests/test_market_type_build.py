"""Market type is a dimension of the register's datasets (D-161): live on the vehicles still registered and on the vehicles registered
today, not offered to the dashboard's dataset, published with its coverage, held to a coverage threshold, and a vehicle no rule takes
stops the build.

The expected figures are worked out here from the published files of the fixture cube (the fact table and the slice) and from the
rule file's own words, not from the pipeline's derivation. No vehicle type, body, class or market type is written in this file
(invariant 1): each is read from config and the reference files.
"""

from __future__ import annotations

import copy
import json

import duckdb
import pytest

from pipeline import build, config, derive, privacy, reference
from pipeline.contract import FACTS_DIR, UNMAPPED
from pipeline.errors import GuardrailError

from .conftest import NOW, load_rows, make_cfg, source_for, write_pages
from .test_golden import frozen_reference

SURVIVORS, STOCK, DASHBOARD = "registrations_surviving", "fleet", "new_registrations"


def frozen_cfg(tmp_path, workspace):
    """The config the golden builds from: the model class file frozen, so a nameplate added to the live file (a data edit) cannot make a
    test of the coverage guard's thresholds hold or fail by what the fixture's vehicles happen to be classed as."""
    return make_cfg(workspace, reference_dir=tmp_path / "reference" if (tmp_path / "reference").exists() else frozen_reference(tmp_path))


def dimension(cfg) -> dict:
    return next(d for d in cfg.dimensions["dimensions"] if d["derive"]["kind"] == derive.ORDERED_RULES)


def run(tmp_path, workspace, rows=None, cfg=None, state=None, name="pages", publish=True):
    rows = rows if rows is not None else load_rows()
    cfg = cfg or frozen_cfg(tmp_path, workspace)
    return cfg, build.build(cfg, source_for(rows), write_pages(tmp_path / name, rows), state, NOW, publish=publish)


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    root = tmp_path_factory.mktemp("market")
    workspace = {"staging": root / "staging", "public": root / "public", "state": root / "state" / "last_good.json",
                 "snapshots": root / "snapshots", "supplied": root / "supplied"}
    cfg, manifest = run(root, workspace)
    return cfg, manifest, workspace


def read(path, sql: str):
    return duckdb.connect().execute(sql.replace("$f", f"read_parquet('{path.as_posix()}')")).fetchall()


def test_it_is_live_on_the_two_register_datasets_and_has_a_slice_and_a_fact_column_on_the_vehicles_still_registered(built):
    cfg, manifest, workspace = built
    dim_id = dimension(cfg)["id"]
    datasets = manifest["datasets"]
    assert dim_id in datasets[SURVIVORS]["live_dimensions"] and dim_id in datasets[SURVIVORS]["facts"]["dimensions"]
    assert dim_id in datasets[STOCK]["live_dimensions"] and datasets[STOCK]["facts"] is None
    public = workspace["public"]
    assert (public / "cube" / SURVIVORS / f"{dim_id}.parquet").exists()
    assert (public / FACTS_DIR / SURVIVORS / f"{dim_id}.parquet").exists()
    assert (public / "cube" / STOCK / f"{dim_id}.parquet").exists()
    assert not (public / FACTS_DIR / STOCK).exists()


def test_the_dashboards_dataset_does_not_get_it_and_the_manifest_says_what_its_source_lacks():
    cfg = config.load()
    dim = dimension(cfg)
    dims, not_live = derive.applicable(cfg, DASHBOARD)
    assert dim["id"] not in [d["id"] for d in dims]
    lacking = sorted(derive.needed_fields(cfg, dim["derive"]) - derive.carried_fields(cfg, DASHBOARD))
    assert lacking and not_live[dim["id"]] == "the source does not carry " + ", ".join(cfg.pipeline["fields"].get(f, f) for f in lacking)


def test_every_vehicle_is_counted_once_in_the_slice_and_the_fact_table_and_every_value_is_one_the_file_gives(built):
    cfg, manifest, workspace = built
    dim = dimension(cfg)
    public = workspace["public"]
    values = {r[dim["derive"]["value"]] for r in reference.ordered_rules(cfg, dim["derive"], dim["id"])}
    months = manifest["datasets"][SURVIVORS]["rows"]
    in_slice = read(public / "cube" / SURVIVORS / f"{dim['id']}.parquet", "SELECT dim_value, sum(n) FROM $f GROUP BY 1")
    assert {v for v, _ in in_slice} <= values and sum(n for _, n in in_slice) == months
    facts = public / FACTS_DIR / SURVIVORS
    in_facts = duckdb.connect().execute(
        f"SELECT m.\"{dim['id']}\", sum(n.n) FROM (SELECT row_number() OVER () AS i, * FROM read_parquet('{(facts / (dim['id'] + '.parquet')).as_posix()}')) m "
        f"JOIN (SELECT row_number() OVER () AS i, * FROM read_parquet('{(facts / 'n.parquet').as_posix()}')) n USING (i) GROUP BY 1").fetchall()
    assert dict(in_facts) == dict(in_slice)
    stock = read(public / "cube" / STOCK / f"{dim['id']}.parquet", "SELECT dim_value, sum(n) FROM $f GROUP BY 1")
    assert {v for v, _ in stock} <= values and sum(n for _, n in stock) == manifest["datasets"][STOCK]["rows"]


def test_the_fleet_has_no_vehicle_of_a_type_outside_the_five_left_unplaced(built):
    """The fleet counts every type: the fixture holds a motorcycle and a trailer, and neither reads as unmapped."""
    cfg, manifest, workspace = built
    dim_id = dimension(cfg)["id"]
    assert manifest["datasets"][STOCK]["unmapped_rates"][dim_id] == 0
    assert read(workspace["public"] / "cube" / STOCK / f"{dim_id}.parquet", f"SELECT count(*) FROM $f WHERE dim_value = '{UNMAPPED}'") == [(0,)]


def test_the_manifest_publishes_the_coverage_and_it_agrees_with_the_fact_table(built):
    cfg, manifest, workspace = built
    dim = dimension(cfg)
    spec = dim["coverage"]
    for dataset in (SURVIVORS, STOCK):
        block = manifest["datasets"][dataset]["dimension_coverage"][dim["id"]]
        assert block["not_known"] == spec["not_known"] and block["pool"] == spec["pool"] and block["status_labels"] == spec["over"]["status_labels"]
        assert (block["warn_below_coverage"], block["live_at_coverage"]) == (spec["warn_below"], spec["live_at"])
        assert block["trailing"]["window_months"] == cfg.pipeline["trailing_window_months"]
        assert block["live"] is True and dim["id"] in manifest["datasets"][dataset]["live_dimensions"]
    # The same figure counted from the published fact table of the vehicles still registered: its rows by month, market type and
    # new or used. The window is the trailing months to the snapshot.
    block = manifest["datasets"][SURVIVORS]["dimension_coverage"][dim["id"]]
    facts = workspace["public"] / FACTS_DIR / SURVIVORS
    con = duckdb.connect()
    for name in ("month", dim["id"], "import_status", "n"):
        con.execute(f"CREATE TABLE f_{name} AS SELECT row_number() OVER () AS i, * FROM read_parquet('{(facts / (name + '.parquet')).as_posix()}')")
    window_start = f"{manifest['datasets'][SURVIVORS]['latest_month']}-01"
    labels = ", ".join(f"'{x}'" for x in spec["over"]["status_labels"])
    pool = ", ".join(f"'{x}'" for x in spec["pool"])
    got = con.execute(f"""
        SELECT sum(n) FILTER (WHERE v IN ({pool})), sum(n) FILTER (WHERE v = '{spec['not_known']}') FROM (
            SELECT mt."{dim['id']}" AS v, f_n.n AS n, f_month.month AS m FROM f_{dim['id']} mt JOIN f_import_status s USING (i) JOIN f_n USING (i) JOIN f_month USING (i)
            WHERE s.import_status IN ({labels}) AND f_month.month > CAST('{window_start}' AS DATE) - INTERVAL {cfg.pipeline['trailing_window_months']} MONTH)""").fetchone()
    assert (block["trailing"]["vehicles"], block["trailing"]["not_known"]) == (got[0] or 0, got[1] or 0)
    if got[0]:
        assert block["trailing"]["coverage"] == round((got[0] - (got[1] or 0)) / got[0], 4)
    assert block["all_time"]["vehicles"] >= block["trailing"]["vehicles"]


def test_it_reads_no_owner_field_and_is_public():
    cfg = config.load()
    dmap = privacy.load_map(cfg)
    dim = dimension(cfg)
    assert dim["id"] not in privacy.owner_dimensions(cfg, dmap)
    read_fields = privacy.fields_read(dim, cfg.pipeline, dmap["derive_reads"])
    assert read_fields and not read_fields & privacy.owner_fields(dmap)
    by_name = {e["name"]: e for e in dmap["fields"] if e["source"] == privacy.REGISTER}
    assert {by_name[f]["privacy"] for f in read_fields} == {"public"}


def with_coverage(cfg, **changes):
    cfg = copy.deepcopy(cfg)
    next(d for d in cfg.dimensions["dimensions"] if d["id"] == dimension(cfg)["id"])["coverage"].update(changes)
    return cfg


def test_a_coverage_below_the_warning_level_warns_and_the_dimension_stays_live(tmp_path, workspace):
    cfg = with_coverage(frozen_cfg(tmp_path, workspace), warn_below=1.0, live_at=0.0)
    cfg, manifest = run(tmp_path, workspace, cfg=cfg, publish=False)
    dim_id = dimension(cfg)["id"]
    block = manifest["datasets"][SURVIVORS]["dimension_coverage"][dim_id]
    if block["trailing"]["coverage"] == 1.0:
        pytest.skip("the fixture's pool is wholly placed, so no warning is due")
    assert any(f"{SURVIVORS}.{dim_id}" in w and "below 100%" in w for w in manifest["warnings"])
    assert dim_id in manifest["datasets"][SURVIVORS]["live_dimensions"]


def test_a_coverage_below_the_live_level_leaves_the_dimension_not_live_and_says_why(tmp_path, workspace):
    cfg = with_coverage(frozen_cfg(tmp_path, workspace), warn_below=1.0, live_at=1.0)
    dim_id = dimension(cfg)["id"]
    cfg, manifest = run(tmp_path, workspace, cfg=cfg, publish=False)
    entry = manifest["datasets"][SURVIVORS]
    block = entry["dimension_coverage"][dim_id]
    assert block["trailing"]["coverage"] is not None and block["trailing"]["coverage"] < 1.0, "the fixture must leave some vehicle unplaced"
    assert dim_id not in entry["live_dimensions"] and dim_id not in entry["facts"]["dimensions"]
    assert "is below 100% of the vehicles in its pool" in entry["not_live"][dim_id] and block["live"] is False
    assert not (workspace["staging"] / "build" / "cube" / SURVIVORS / f"{dim_id}.parquet").exists()
    assert any("so the dimension is not live" in w for w in manifest["warnings"])


def test_a_dimension_that_was_live_in_the_last_good_build_aborts_instead_of_dropping_out(tmp_path, workspace):
    cfg, _ = run(tmp_path, workspace, name="first")
    state = json.loads(workspace["state"].read_text(encoding="utf-8"))
    dim_id = dimension(cfg)["id"]
    assert dim_id in state["live_dimensions"][SURVIVORS]
    thin = with_coverage(frozen_cfg(tmp_path, workspace), warn_below=1.0, live_at=1.0)
    with pytest.raises(GuardrailError, match="it was live in the last good build, so the run aborts"):
        run(tmp_path, workspace, cfg=thin, state=state, name="second", publish=False)


@pytest.mark.parametrize("change, said", [
    ({"not_known": "no such value"}, "which the dimension never produces"),
    ({"pool": ["no such value"]}, "which the dimension never produces"),
    ({"over": {"require": ["no_such_flag"], "status_labels": ["x"]}}, "which are not flags of rows"),
    ({"over": {"require": [], "status_labels": ["no such status"]}}, "which import_status_map.csv does not hold"),
    ({"warn_below": 0.5, "live_at": 0.9}, "0 <= live_at <= warn_below <= 1"),
])
def test_a_coverage_block_that_names_what_does_not_exist_aborts_before_anything_is_counted(tmp_path, workspace, change, said):
    cfg = with_coverage(frozen_cfg(tmp_path, workspace), **change)
    with pytest.raises(GuardrailError, match=said):
        run(tmp_path, workspace, cfg=cfg, publish=False)


def test_a_vehicle_no_rule_takes_stops_the_build_however_few_there_are(tmp_path, workspace):
    """A passenger-registered vehicle of a body no rule names: one such vehicle in the whole run aborts, not only a share above 2%."""
    rows = load_rows()
    cfg = make_cfg(workspace)
    dim = dimension(cfg)
    f = cfg.pipeline["fields"]
    # A row of the type the rules that read the nameplate's class are for.
    reading = next(x for x in reference.ordered_rules(cfg, dim["derive"], dim["id"]) if x["model_class"])
    passenger = next(r for r in rows if r[f["vehicle_type"]] == reference.split(reading["vehicle_types"], "|")[0])
    odd = copy.deepcopy(passenger)
    odd[f["object_id"]] = max(r[f["object_id"]] for r in rows) + 1
    odd[f["body_type"]] = "NO SUCH BODY"
    guards = cfg.pipeline["guardrails"]
    assert dim["id"] in guards["abort_on_unmapped"] and dim["id"] in guards["abort_on_any_unmapped"]
    with pytest.raises(GuardrailError, match=rf"{dim['id']}: 1 of [\d,]+ in-scope rows read unmapped"):
        run(tmp_path, workspace, rows=rows + [odd], publish=False)


def test_the_guard_judges_the_trailing_window_and_not_the_whole_history(tmp_path, workspace):
    """Old months full of vehicles the SUV file does not know, which is what the register looks like (the file places a small share of
    the older vehicles), must not switch the dimension off or warn: the guard judges new vehicles of the trailing window. The thresholds
    sit between the two figures, so a guard that read the whole history would warn at the first and leave the dimension not live at the
    second."""
    cfg = frozen_cfg(tmp_path, workspace)
    dim = dimension(cfg)
    f = cfg.pipeline["fields"]
    rows = load_rows()
    reading = next(x for x in reference.ordered_rules(cfg, dim["derive"], dim["id"]) if x["model_class"])
    statuses = cfg.pipeline["scope"]["status"]
    new = next(r["nzta"] for r in [{"nzta": s[statuses["key"]], "label": s[statuses["label"]]} for s in reference.read(cfg.reference(statuses["file"]))]
               if r["label"] in dim["coverage"]["over"]["status_labels"])
    template = next(r for r in rows if r[f["vehicle_type"]] == reference.split(reading["vehicle_types"], "|")[0] and r[f["import_status"]] == new)
    first_id = max(r[f["object_id"]] for r in rows) + 1
    # 120 vehicles of a nameplate the file has no row for, first registered years before the window and still registered.
    old = [dict(template, **{f["object_id"]: first_id + i, f["registration_year"]: 2012, f["registration_month"]: 6, f["vehicle_year"]: 2012,
                             f["model"]: f"UNLISTED NAMEPLATE {i}"}) for i in range(120)]
    cfg = with_coverage(cfg, warn_below=0.9, live_at=0.8)
    cfg, manifest = run(tmp_path, workspace, rows=rows + old, cfg=cfg, publish=False)
    entry = manifest["datasets"][SURVIVORS]
    block = entry["dimension_coverage"][dim["id"]]
    assert block["all_time"]["coverage"] < 0.8 < 0.9 < block["trailing"]["coverage"], block
    assert block["live"] is True and dim["id"] in entry["live_dimensions"] and dim["id"] not in entry["not_live"]
    assert not any(dim["id"] in w and ("is not live" in w or "stops being live" in w) for w in manifest["warnings"]), manifest["warnings"]


def without_the_pool(cfg, rows):
    """The fixture without any new vehicle of the type the rules that read the nameplate's class are for: the coverage pool is empty."""
    dim = dimension(cfg)
    f = cfg.pipeline["fields"]
    reading = next(x for x in reference.ordered_rules(cfg, dim["derive"], dim["id"]) if x["model_class"])
    statuses = cfg.pipeline["scope"]["status"]
    new = {s[statuses["key"]] for s in reference.read(cfg.reference(statuses["file"])) if s[statuses["label"]] in dim["coverage"]["over"]["status_labels"]}
    kept = [r for r in rows if not (r[f["vehicle_type"]] in reference.split(reading["vehicle_types"], "|") and r[f["import_status"]] in new)]
    assert 0 < len(kept) < len(rows)
    return kept


def test_a_pool_with_no_vehicle_cannot_be_judged_so_the_dimension_stays_as_it_was(tmp_path, workspace):
    """No evidence is neither a pass nor a fail. A dimension that was not live is not made live by it, and one that was live is not
    taken away by it (the run does not abort on what it cannot measure); both say so in a warning."""
    cfg = frozen_cfg(tmp_path, workspace)
    dim_id = dimension(cfg)["id"]
    rows = without_the_pool(cfg, load_rows())
    _, first = run(tmp_path, workspace, rows=rows, cfg=cfg, name="first")
    for dataset in (SURVIVORS, STOCK):
        entry = first["datasets"][dataset]
        assert entry["dimension_coverage"][dim_id]["trailing"]["coverage"] is None
        assert dim_id not in entry["live_dimensions"] and "cannot be judged" in entry["not_live"][dim_id]
        assert entry["dimension_coverage"][dim_id]["live"] is False
    assert any("so its coverage cannot be judged" in w and SURVIVORS in w for w in first["warnings"])
    state = json.loads(workspace["state"].read_text(encoding="utf-8"))
    for dataset in (SURVIVORS, STOCK):
        state["live_dimensions"][dataset].append(dim_id)
    _, second = run(tmp_path, workspace, rows=rows, cfg=cfg, state=state, name="second", publish=False)
    for dataset in (SURVIVORS, STOCK):
        entry = second["datasets"][dataset]
        assert dim_id in entry["live_dimensions"] and entry["dimension_coverage"][dim_id]["live"] is True
    assert any("cannot be judged" in w for w in second["warnings"])
