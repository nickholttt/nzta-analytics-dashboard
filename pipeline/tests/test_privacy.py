"""Which dimensions are owner dimensions, and the numbers of the small-cell rule, are read from config (D-127).

No dimension id, field or number is written here: every one is read from config/data_map.json, config/dimensions.json
and config/pipeline.json (design invariant 1).
"""

from __future__ import annotations

import copy

import pytest

from pipeline import config, privacy

from .test_data_map import load_map


def test_the_dimensions_with_a_recorded_exception_are_owner_dimensions_and_no_others_read_an_owner_field():
    cfg, dmap = config.load(), load_map()
    found = privacy.owner_dimensions(cfg, dmap)
    excepted = {x["dimension"] for e in dmap["fields"] for x in e.get("published_exceptions", [])}
    assert excepted, "no recorded exception, so the check would prove nothing"
    assert excepted <= set(found), f"a recorded exception is on a dimension that reads no owner field: {excepted - set(found)}"
    owners = privacy.owner_fields(dmap)
    for dim in cfg.dimensions["dimensions"]:
        if "derive" in dim and dim["id"] not in found:
            assert not privacy.fields_read(dim, cfg.pipeline, dmap["derive_reads"]) & owners, dim["id"]
    for dim_id, read in found.items():
        assert set(read) <= owners


def test_a_new_dimension_over_an_owner_field_is_found_and_one_over_a_vehicle_field_is_not():
    cfg, dmap = config.load(), load_map()
    owner = next(e for e in dmap["fields"] if e["source"] == privacy.REGISTER and e["group"] in dmap["owner_groups"] and e["bound"])
    vehicle = next(e for e in dmap["fields"] if e["source"] == privacy.REGISTER and e["group"] not in dmap["owner_groups"] and e["bound"])
    cfg.dimensions = copy.deepcopy(cfg.dimensions)
    cfg.dimensions["dimensions"] += [
        {"id": "probe_owner", "derive": {"kind": "raw", "field": owner["bound"]}},
        {"id": "probe_vehicle", "derive": {"kind": "raw", "field": vehicle["bound"]}},
    ]
    found = privacy.owner_dimensions(cfg, dmap)
    assert found["probe_owner"] == [owner["name"]]
    assert "probe_vehicle" not in found


def test_the_rule_is_read_from_the_map():
    dmap = load_map()
    rule = privacy.small_cell_rule(dmap)
    assert rule.minimum == dmap["owner_rule"]["minimum_count"]
    assert rule.hidden_cells == dmap["owner_rule"]["second_rule"]["minimum_hidden_cells"]
    assert rule.hidden_vehicles == dmap["owner_rule"]["second_rule"]["minimum_hidden_vehicles"]


@pytest.mark.parametrize("change", [
    lambda r: r.pop("second_rule"),
    lambda r: r["second_rule"].pop("minimum_hidden_cells"),
    lambda r: r["second_rule"].update(minimum_hidden_cells=1),
    lambda r: r["second_rule"].update(minimum_hidden_vehicles=r["minimum_count"] - 1),
    lambda r: r["second_rule"].update(minimum_hidden_vehicles="many"),
    lambda r: r.update(minimum_count=1),
])
def test_a_rule_too_weak_to_protect_a_cell_is_refused(change):
    dmap = copy.deepcopy(load_map())
    change(dmap["owner_rule"])
    with pytest.raises(privacy.DataMapError):
        privacy.small_cell_rule(dmap)


def test_the_pair_rule_is_read_from_the_map():
    dmap = load_map()
    rule = privacy.pair_cell_rule(dmap)
    pair = dmap["owner_rule"]["pair_rule"]
    assert rule.minimum == dmap["owner_rule"]["minimum_count"]
    assert rule.hidden_cells == pair["minimum_hidden_cells_per_line"]
    assert rule.hidden_vehicles == pair["minimum_hidden_vehicles_per_line"]


@pytest.mark.parametrize("change", [
    lambda r: r.pop("pair_rule"),
    lambda r: r["pair_rule"].pop("minimum_hidden_cells_per_line"),
    lambda r: r["pair_rule"].update(minimum_hidden_cells_per_line=1),
    lambda r: r["pair_rule"].update(minimum_hidden_vehicles_per_line=r["minimum_count"] - 1),
    lambda r: r["pair_rule"].update(minimum_hidden_vehicles_per_line="many"),
    lambda r: r.update(minimum_count=1),
])
def test_a_pair_rule_too_weak_to_protect_a_cell_is_refused(change):
    dmap = copy.deepcopy(load_map())
    change(dmap["owner_rule"])
    with pytest.raises(privacy.DataMapError):
        privacy.pair_cell_rule(dmap)
