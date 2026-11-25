"""The floor under a field that says what kind of owner registered a vehicle (config/data_map.json, `kind_of_owner_groups`).

The user directed that buyer type be published in full, where owner fields are otherwise held to the small-cell rule
(`owner_rule`). The floor under that direction: a field of a `kind_of_owner` group is never put in one table with a field that
says where the owner lives or describes the owner (a field of an `owner_groups` group), and the owner fields still never reach a
fact table. pipeline/privacy.py works out from the map and the derive blocks which dimensions are on which side, and the build
(build.kind_of_owner_floor_problems) aborts before it reads anything when config/pipeline.json breaks the floor.

No dimension, field, column or group name is written here (invariant 1): each is read from config, and a probe dimension is
added to a copy of the config for each case.
"""

from __future__ import annotations

import copy
import json

import pytest

from pipeline import build, config, privacy
from pipeline.errors import GuardrailError

from .conftest import load_rows, make_cfg
from .test_data_map import load_map
from .test_guardrails import expect_abort, run

KIND, WHERE, OWNER_REGISTER, VEHICLE = "probe_kind", "probe_where", "probe_owner_register", "probe_vehicle"


def dashboard_column(dmap: dict, groups: set[str]) -> str:
    return next(e["name"] for e in dmap["fields"] if e["source"] == privacy.DASHBOARD and e["group"] in groups)


def register_field(dmap: dict, in_groups: set[str], want: bool) -> str:
    return next(e["bound"] for e in dmap["fields"]
                if e["source"] == privacy.REGISTER and e["bound"] and (e["group"] in in_groups) is want)


def with_probes(cfg, **where):
    """A copy of the config with four probe dimensions: one that reads a column of the export whose group says what kind of owner,
    one that reads a column of the export whose group locates or describes the owner, one that reads a register owner field and
    one that reads a register vehicle field. `where` sets the tables that name them, as {dataset key: value} on the first dataset
    that has a fact table."""
    dmap = load_map()
    kind_groups, owner_groups = set(dmap["kind_of_owner_groups"]), set(dmap["owner_groups"])
    cfg.pipeline, cfg.dimensions = copy.deepcopy(cfg.pipeline), copy.deepcopy(cfg.dimensions)
    source = next(s for s in cfg.pipeline["supplied"].values() if isinstance(s, dict) and "extra_fields" in s)
    source["extra_fields"][KIND] = dashboard_column(dmap, kind_groups)
    source["extra_fields"][WHERE] = dashboard_column(dmap, owner_groups)
    cfg.dimensions["dimensions"] += [
        {"id": KIND, "derive": {"kind": "raw", "field": KIND}},
        {"id": WHERE, "derive": {"kind": "raw", "field": WHERE}},
        {"id": OWNER_REGISTER, "derive": {"kind": "raw", "field": register_field(dmap, owner_groups, True)}},
        {"id": VEHICLE, "derive": {"kind": "raw", "field": register_field(dmap, owner_groups, False)}},
    ]
    dataset = next(spec for spec in cfg.pipeline["datasets"].values() if "facts" in spec)
    for key, value in where.items():
        dataset[key] = dataset.get(key, []) + value
    return cfg


# --- the map ----------------------------------------------------------------------------------------------------------


def test_the_map_names_a_group_for_what_kind_of_owner_and_it_is_not_an_owner_group():
    dmap = load_map()
    kind, owner = set(dmap["kind_of_owner_groups"]), set(dmap["owner_groups"])
    assert kind and kind <= set(dmap["enums"]["group"])
    assert not kind & owner, "a group cannot both say what kind of owner and describe or locate the owner"
    entries = [e for e in dmap["fields"] if e["group"] in kind]
    assert entries, "no field is in the group, so the floor would protect nothing"
    for entry in entries:
        assert not entry.get("published_exceptions"), f"{entry['name']}: a field of this group is public, not an exception"


def test_the_committed_config_keeps_every_table_from_putting_the_two_together():
    cfg = config.load()
    assert privacy.floor_problems(cfg) == []
    assert build.kind_of_owner_floor_problems(cfg) == []


# --- the probes: the floor sees a crossing wherever the config puts one ----------------------------------------------------


def test_the_probes_are_on_the_sides_the_map_gives_them():
    cfg, dmap = with_probes(config.load()), load_map()
    kind = privacy.dimensions_in_groups(cfg, dmap, set(dmap["kind_of_owner_groups"]))
    owner = privacy.dimensions_in_groups(cfg, dmap, set(dmap["owner_groups"]))
    assert KIND in kind and WHERE in owner and OWNER_REGISTER in owner
    assert KIND not in owner and VEHICLE not in kind and VEHICLE not in owner
    assert WHERE not in kind and OWNER_REGISTER not in kind


@pytest.mark.parametrize("owner", [WHERE, OWNER_REGISTER])
@pytest.mark.parametrize("table", ["pairs", "facts"])
def test_a_table_that_puts_what_kind_of_owner_beside_an_owner_field_is_a_problem(owner, table):
    listed = [[KIND, owner]] if table == "pairs" else [KIND, owner]
    found = privacy.floor_problems(with_probes(config.load(), **{table: listed}))
    assert len(found) == 1 and KIND in found[0] and owner in found[0], found


@pytest.mark.parametrize("owner", [WHERE, OWNER_REGISTER])
def test_a_narrow_fact_table_that_does_it_is_a_problem(owner):
    cfg = config.load()
    found = privacy.floor_problems(with_probes(cfg, narrow_facts=[{"id": "probe", "dimensions": [KIND, VEHICLE, owner]}]))
    assert len(found) == 1 and "narrow_facts 'probe'" in found[0] and KIND in found[0] and owner in found[0], found


@pytest.mark.parametrize("owner", [WHERE, OWNER_REGISTER])
def test_the_committed_snapshot_aggregate_may_not_do_it(owner):
    cfg = with_probes(config.load())
    dmap = load_map()
    cfg.pipeline["snapshot_archive"]["group_by"] = [*cfg.pipeline["snapshot_archive"]["group_by"], KIND]
    assert privacy.floor_problems(cfg) == [], "a kind of owner alone is allowed in the snapshot aggregate's table"
    logical = {WHERE: WHERE, OWNER_REGISTER: register_field(dmap, set(dmap["owner_groups"]), True)}[owner]
    cfg.pipeline["snapshot_archive"]["group_by"].append(logical)
    found = privacy.floor_problems(cfg)
    assert len(found) == 1 and "snapshot_archive" in found[0], found


@pytest.mark.parametrize("listed", [
    {"pairs": [[KIND, VEHICLE]]},
    {"pairs": [[WHERE, VEHICLE]]},
    {"facts": [KIND, VEHICLE]},
    {"narrow_facts": [{"id": "probe", "dimensions": [KIND, VEHICLE]}]},
    {"pairs": [[KIND, WHERE]], "facts": []},
])
def test_what_kind_of_owner_beside_a_vehicle_field_and_an_owner_field_beside_a_vehicle_field_are_not_the_floors_concern(listed):
    cfg = with_probes(config.load(), **{k: v for k, v in listed.items() if v})
    expected = 1 if listed.get("pairs") == [[KIND, WHERE]] else 0
    assert len(privacy.floor_problems(cfg)) == expected


def test_each_crossing_is_reported_once_for_its_pair():
    cfg = with_probes(config.load(), pairs=[[KIND, WHERE], [KIND, OWNER_REGISTER]])
    assert len(privacy.floor_problems(cfg)) == 2


# --- a map the floor cannot be held to ---------------------------------------------------------------------------------


@pytest.mark.parametrize("damage", [
    lambda m: m.pop("kind_of_owner_groups"),
    lambda m: m.update(kind_of_owner_groups="a group"),
    lambda m: m.update(kind_of_owner_groups=["a group the map does not define"]),
    lambda m: m.update(kind_of_owner_groups=m["owner_groups"]),
])
def test_a_map_that_leaves_the_floor_undefined_is_refused(damage):
    dmap = copy.deepcopy(load_map())
    damage(dmap)
    with pytest.raises(privacy.DataMapError):
        privacy.floor_problems(config.load(), dmap)


# --- the build holds it ----------------------------------------------------------------------------------------------------


@pytest.mark.parametrize("owner", [WHERE, OWNER_REGISTER])
def test_a_build_whose_config_breaks_the_floor_aborts_before_anything_is_written(tmp_path, workspace, owner):
    cfg = with_probes(make_cfg(workspace), pairs=[[KIND, owner]])
    with pytest.raises(GuardrailError) as info:
        run(tmp_path, cfg, load_rows(), publish=False)
    message = str(info.value)
    assert KIND in message and owner in message and "never published beside where the owner lives" in message, message
    assert not (workspace["staging"] / "build").exists(), "the abort comes before the build writes a file"
    assert not workspace["public"].exists() and not workspace["state"].exists()


def test_a_data_map_without_the_floor_aborts_the_build(tmp_path, workspace):
    dmap = copy.deepcopy(load_map())
    dmap.pop("kind_of_owner_groups")
    custom = tmp_path / "data_map.json"
    custom.write_text(json.dumps(dmap), encoding="utf-8")
    cfg = make_cfg(workspace, data_map=custom)
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), "config/data_map.json cannot be used to protect owner fields")
