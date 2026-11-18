"""The small-cell rule inside a whole build (D-127): which slices it holds, what the manifest says, and that a slice that
should be protected and is not never reaches public/data.

Regions are read from the reference file and districts from the same file; no region, district or dimension id is written
in this module except as the config names it (design invariant 1).
"""

from __future__ import annotations

import json

import duckdb
import pytest

from pipeline import config, derive, outputs, privacy, reference, small_cells
from pipeline.contract import NOT_BROKEN_DOWN
from pipeline.errors import GuardrailError

from .conftest import load_rows, make_cfg
from .test_guardrails import expect_abort, run

DATASET = "registrations_surviving"


def owner_dimensions_of_the_register_dataset(cfg) -> list[str]:
    """The dimensions of the register dataset that read an owner field, from the data map. The map may name others, which
    belong to a dataset that is not this one (a stock, D-135) and are tested in test_fleet.py."""
    here = {d["id"] for d in derive.applicable(cfg, DATASET)[0]}
    return sorted(d for d in privacy.owner_dimensions(cfg) if d in here)


def owner_dimension() -> str:
    """The one dimension of the register dataset that reads an owner field, from the data map."""
    found = owner_dimensions_of_the_register_dataset(config.load())
    assert len(found) == 1, f"this module is written for one owner dimension, the map has {found}"
    return found[0]


def districts_by_value() -> list[str]:
    """One district per value of the owner dimension, in file order: the dimension is a lookup from a district."""
    cfg = config.load()
    dim = next(d for d in cfg.dimensions["dimensions"] if d["id"] == owner_dimension())
    chosen: dict[str, str] = {}
    for row in reference.read(cfg.reference(dim["derive"]["reference"])):
        chosen.setdefault(row[dim["derive"]["value"]], row[dim["derive"]["key"]])
    return list(chosen.items())


def vehicles(template: dict, month: tuple[int, int], district: str, count: int, first_id: int) -> list[dict]:
    year, number = month
    return [dict(template, OBJECTID=first_id + i, TLA=district, FIRST_NZ_REGISTRATION_YEAR=year, FIRST_NZ_REGISTRATION_MONTH=number)
            for i in range(count)]


def extra_rows(rows: list[dict]) -> tuple[list[dict], dict]:
    """The fixture plus months built to exercise the rule; returns the rows and the region each district stands for."""
    template = next(r for r in rows if r["OBJECTID"] == 62)
    pairs = districts_by_value()
    assert len(pairs) >= 4
    (v1, d1), (v2, d2), (v3, d3), (v4, d4) = pairs[:4]
    extra, next_id = [], 5000
    plan = {
        (2023, 5): [(d1, 9), (d2, 10), (d3, 25), (d4, 40)],    # 9 hidden, 10 hidden by the second rule
        (2023, 6): [(d1, 3), (d2, 2)],                         # 5 vehicles: not broken down
        (2023, 7): [(d1, 12), (d2, 15)],                       # nothing under the minimum
        (2023, 8): [(d1, 4), (d2, 4), (d3, 4)],                # 12 vehicles, every cell under the minimum: not broken down
        (2023, 9): [(d1, 5), (d2, 40)],                        # the second rule hides the 40, and then no cell is visible
    }
    for month, cells in plan.items():
        for district, count in cells:
            extra += vehicles(template, month, district, count, next_id)
            next_id += count
    return rows + extra, {"v1": v1, "v2": v2, "v3": v3, "v4": v4}


def read_region(workspace, staged: bool = False) -> dict:
    folder = (workspace["staging"] / "build") if staged else workspace["public"]
    con = duckdb.connect()
    path = folder / "cube" / DATASET / f"{owner_dimension()}.parquet"
    rows = con.execute(f"SELECT * FROM read_parquet('{path.as_posix()}') ORDER BY month, dim_value").fetchall()
    out: dict = {}
    for month, value, n, denominator, fc_sum, fc_n, fc_eligible_n in rows:
        out.setdefault((month.year, month.month), {})[value] = (n, denominator, fc_sum, fc_n, fc_eligible_n)
    return out


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    """One build of the fixture plus the months above, shared by the tests that only read its output."""
    root = tmp_path_factory.mktemp("small_cells")
    workspace = {"staging": root / "staging", "public": root / "public", "state": root / "state" / "last_good.json",
                 "snapshots": root / "snapshots", "supplied": root / "supplied"}
    rows, names = extra_rows(load_rows())
    cfg = make_cfg(workspace)
    manifest = run(root, cfg, rows)
    return manifest, read_region(workspace), names, cfg


def test_the_owner_slice_is_written_under_the_rule(built):
    _, region, names, _ = built
    # 9, 10, 25, 40: the nine is hidden, the smallest visible cell (10) is hidden with it, 25 and 40 stand.
    may = region[(2023, 5)]
    assert may[names["v1"]][0] is None and may[names["v2"]][0] is None
    assert may[names["v3"]][0] == 25 and may[names["v4"]][0] == 40
    assert {d for _, d, *_ in may.values()} == {84}
    assert may[names["v1"]][2:] == (None, None, None)


def test_a_month_that_cannot_be_broken_down_is_one_reserved_row_with_its_total(built):
    _, region, *_ = built
    assert region[(2023, 6)] == {NOT_BROKEN_DOWN: (5, 5, None, None, None)}


def test_a_month_whose_second_rule_would_hide_the_last_visible_cell_is_not_broken_down(built):
    _, region, *_ = built
    # 5 and 40: the small cell is hidden, the second rule hides the 40 as the smallest visible cell, and none is left
    assert region[(2023, 9)] == {NOT_BROKEN_DOWN: (45, 45, None, None, None)}


def test_a_month_with_nothing_under_the_minimum_is_shown_whole(built):
    _, region, names, _ = built
    assert [region[(2023, 7)][names[k]][0] for k in ("v1", "v2")] == [12, 15]


def test_a_month_where_every_cell_is_under_the_minimum_is_one_reserved_row_even_with_twelve_vehicles(built):
    _, region, *_ = built
    assert region[(2023, 8)] == {NOT_BROKEN_DOWN: (12, 12, None, None, None)}


def test_no_month_of_the_built_slice_has_hidden_rows_and_no_visible_row(built):
    _, region, *_ = built
    hidden_months = 0
    for cells in region.values():
        rows = {v: c for v, c in cells.items() if v != NOT_BROKEN_DOWN}
        if any(n is None for n, *_r in rows.values()):
            hidden_months += 1
            assert any(n is not None for n, *_r in rows.values())
    assert hidden_months >= 1, "the fixture holds a month with real hidden rows, built end to end"


def test_the_manifest_says_what_was_hidden_and_agrees_with_the_file(built):
    manifest, region, _, cfg = built
    figures = manifest["datasets"][DATASET]["small_cells"][owner_dimension()]
    rule = privacy.small_cell_rule(privacy.load_map(cfg))
    assert (figures["minimum"], figures["minimum_hidden_cells"], figures["minimum_hidden_vehicles"]) == (
        rule.minimum, rule.hidden_cells, rule.hidden_vehicles)
    hidden_rows = sum(1 for cells in region.values() for v, (n, *_rest) in cells.items() if n is None and v != NOT_BROKEN_DOWN)
    assert figures["cells_hidden_first_rule"] + figures["cells_hidden_second_rule"] == hidden_rows
    assert figures["months"] == len(region)
    assert figures["months_not_broken_down"] == sum(1 for cells in region.values() if NOT_BROKEN_DOWN in cells)
    reserved_vehicles = sum(c[NOT_BROKEN_DOWN][0] for c in region.values() if NOT_BROKEN_DOWN in c)
    assert figures["vehicles_in_months_not_broken_down"] == reserved_vehicles
    # What the hidden cells held together: each broken-down month's total less what is visible.
    held = sum(next(iter(cells.values()))[1] - sum(n or 0 for n, *_r in cells.values())
               for cells in region.values() if NOT_BROKEN_DOWN not in cells)
    assert figures["vehicles_in_hidden_cells"] == held


def test_a_dimension_that_reads_no_owner_field_is_written_as_counted_and_has_no_figures(built):
    manifest, _, _, cfg = built
    entry = manifest["datasets"][DATASET]
    assert sorted(entry["small_cells"]) == owner_dimensions_of_the_register_dataset(cfg)
    other = next(d for d in entry["live_dimensions"] if d not in entry["small_cells"])
    con = duckdb.connect()
    path = cfg.path("public") / "cube" / DATASET / f"{other}.parquet"
    assert con.execute(f"SELECT count(*) FROM read_parquet('{path.as_posix()}') WHERE n IS NULL OR dim_value = '{NOT_BROKEN_DOWN}'").fetchone()[0] == 0


def test_no_owner_dimension_is_in_the_fact_table_or_a_pair(built):
    manifest, *_ = built
    entry = manifest["datasets"][DATASET]
    owners = set(privacy.owner_dimensions(config.load()))
    assert not owners & set(entry["facts"]["dimensions"])
    assert not any(owners & set(pair.split("__")) for pair in entry["live_pairs"])


# --- a slice that should be protected and is not never reaches public/data ----------------------------------------------


def test_a_protected_slice_written_without_the_rule_aborts_the_build_and_publishes_nothing(tmp_path, workspace, monkeypatch):
    def unprotected(con, cfg, derived, ds, path, rule, fuel=True):
        outputs.write_slice(con, cfg, derived, ds, path)
        return {"minimum": rule.minimum, "minimum_hidden_cells": rule.hidden_cells, "minimum_hidden_vehicles": rule.hidden_vehicles,
                "months": 0, "cells_hidden_first_rule": 0, "cells_hidden_second_rule": 0, "vehicles_in_hidden_cells": 0,
                "months_not_broken_down": 0, "vehicles_in_months_not_broken_down": 0}

    monkeypatch.setattr(small_cells, "write_protected_slice", unprotected)
    cfg = make_cfg(workspace)
    with pytest.raises(GuardrailError) as info:
        run(tmp_path, cfg, load_rows())
    message = str(info.value)
    assert f"{DATASET}.{owner_dimension()}: a visible count is under the minimum" in message, message
    assert not workspace["public"].exists()
    assert not workspace["state"].exists()


def test_a_slice_whose_hidden_cells_are_too_few_aborts_the_build(tmp_path, workspace, monkeypatch):
    """The first rule applied and the second left out: one hidden cell is what a total gives away."""
    def first_rule_only(cells, rule):
        return small_cells.Hidden(tuple(sorted(v for v, n in cells if n < rule.minimum)), ())

    monkeypatch.setattr(small_cells, "decide_month", first_rule_only)
    rows, _ = extra_rows(load_rows())
    cfg = make_cfg(workspace)
    with pytest.raises(GuardrailError) as info:
        run(tmp_path, cfg, rows)
    assert "cells are hidden" in str(info.value) or "together count fewer than" in str(info.value), str(info.value)
    assert not workspace["public"].exists()


def test_a_slice_with_a_month_of_hidden_rows_and_no_visible_row_aborts_the_build(tmp_path, workspace, monkeypatch):
    """The old choice: every cell hidden when the counts of the rule are met, instead of one reserved row."""
    real = small_cells.decide_month

    def every_cell_hidden(cells, rule):
        if all(n < rule.minimum for _, n in cells) and sum(n for _, n in cells) >= rule.hidden_vehicles and len(cells) >= rule.hidden_cells:
            return small_cells.Hidden(tuple(sorted(v for v, _ in cells)), ())
        return real(cells, rule)

    monkeypatch.setattr(small_cells, "decide_month", every_cell_hidden)
    rows, _ = extra_rows(load_rows())
    cfg = make_cfg(workspace)
    with pytest.raises(GuardrailError) as info:
        run(tmp_path, cfg, rows)
    assert "hidden cells and no visible cell" in str(info.value), str(info.value)
    assert not workspace["public"].exists()


# --- the rule is data --------------------------------------------------------------------------------------------------


def test_a_different_minimum_in_the_map_changes_what_is_hidden(tmp_path, workspace):
    dmap = privacy.load_map(config.load())
    dmap["owner_rule"]["minimum_count"] = 30
    dmap["owner_rule"]["second_rule"]["minimum_hidden_vehicles"] = 30
    dmap["owner_rule"]["pair_rule"]["minimum_hidden_vehicles_per_line"] = 30
    custom = tmp_path / "data_map.json"
    custom.write_text(json.dumps(dmap), encoding="utf-8")
    rows, names = extra_rows(load_rows())
    cfg = make_cfg(workspace, data_map=custom)
    run(tmp_path, cfg, rows)
    may = read_region(workspace)[(2023, 5)]
    # 9, 10 and 25 are under 30; the 40 stays.
    assert [may[names[k]][0] for k in ("v1", "v2", "v3", "v4")] == [None, None, None, 40]


def test_a_map_that_groups_no_field_as_the_owner_leaves_a_slice_unprotected(tmp_path, workspace):
    """The slice is protected because the map says its field is the owner's, not because code names it."""
    dmap = privacy.load_map(config.load())
    dmap["owner_groups"] = []
    custom = tmp_path / "data_map.json"
    custom.write_text(json.dumps(dmap), encoding="utf-8")
    rows, names = extra_rows(load_rows())
    cfg = make_cfg(workspace, data_map=custom)
    manifest = run(tmp_path, cfg, rows)
    assert manifest["datasets"][DATASET]["small_cells"] == {}
    assert read_region(workspace)[(2023, 6)][names["v1"]][0] == 3


@pytest.mark.parametrize("damage", [
    lambda m: m["owner_rule"].pop("second_rule"),
    lambda m: m["owner_rule"]["second_rule"].update(minimum_hidden_vehicles=1),
    lambda m: m["owner_rule"].pop("pair_rule"),
    lambda m: m["owner_rule"]["pair_rule"].update(minimum_hidden_cells_per_line=1),
    lambda m: m["owner_rule"]["pair_rule"].update(minimum_hidden_vehicles_per_line=9),
    lambda m: m.pop("derive_reads"),
])
def test_a_data_map_the_build_cannot_use_aborts_before_anything_is_written(tmp_path, workspace, damage):
    dmap = privacy.load_map(config.load())
    damage(dmap)
    custom = tmp_path / "data_map.json"
    custom.write_text(json.dumps(dmap), encoding="utf-8")
    cfg = make_cfg(workspace, data_map=custom)
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), "config/data_map.json cannot be used to protect owner fields")


def test_a_missing_data_map_aborts(tmp_path, workspace):
    cfg = make_cfg(workspace, data_map=tmp_path / "absent.json")
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), "config/data_map.json cannot be used")
