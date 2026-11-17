"""The rule for a table of two fields with an owner field, inside a whole build (D-135): which pair files it writes, what the
manifest says, and that a pair that should be protected and is not never reaches public/data.

Regions are read from the reference file and powertrains from theirs; no region, powertrain or dimension id is written in this
module except as the config names it (design invariant 1).
"""

from __future__ import annotations

import json

import duckdb
import pytest

from pipeline import config, derive, outputs, pair_cells, privacy, reference
from pipeline.contract import NOT_BROKEN_DOWN
from pipeline.errors import GuardrailError

from .conftest import load_rows, make_cfg
from .test_guardrails import expect_abort, run
from .test_pair_cells import PINNED, PINNED_HIDDEN
from .test_small_cells_build import DATASET, districts_by_value, extra_rows, vehicles  # noqa: F401

PAIR_MONTH = (2023, 3)
PINNED_MONTH = (2023, 4)
RESERVED = (NOT_BROKEN_DOWN, NOT_BROKEN_DOWN)


def owner_dimension() -> str:
    cfg = config.load()
    here = {d["id"] for d in derive.applicable(cfg, DATASET)[0]}
    found = [d for d in privacy.owner_dimensions(cfg) if d in here]
    assert len(found) == 1, f"this module is written for one owner dimension of {DATASET}, the map has {found}"
    return found[0]


def other_dimension() -> str:
    """The dimension that looks up the motive power in the powertrain reference and returns the powertrain column: it reads
    no owner field and takes as many values as the columns of the tables below need. Found from config, not named."""
    cfg = config.load()
    h, engine = cfg.pipeline["hybrid_classification"], cfg.pipeline["engine"]
    found = [d["id"] for d in cfg.dimensions["dimensions"]
             if d.get("derive", {}).get("kind") == "lookup" and d["derive"]["field"] == engine["field"]
             and d["derive"]["reference"] == engine["reference"] and d["derive"]["value"] == h["powertrain_column"]]
    assert len(found) == 1, found
    return found[0]


def powertrain_keys(count: int) -> list[str]:
    """`count` motive power codes that map to distinct powertrains and are no hybrid code (a hybrid is reclassified by
    nameplate, which the fixture does not intend)."""
    cfg = config.load()
    engine = cfg.pipeline["engine"]
    keys = reference.hybrid_keys(cfg)
    chosen, seen = [], set()
    for row in reference.read(cfg.reference(engine["reference"])):
        key = row[engine["key"]]
        label = keys["labels"][key]
        if key not in keys["source_hybrid"] and label not in seen and row["occurs_in_source"] == cfg.pipeline["boolean_true"]:
            chosen.append(key)
            seen.add(label)
    assert len(chosen) >= count
    return chosen[:count]


def names() -> tuple[list[str], list[str]]:
    """The region value of each row index and the powertrain value of each column index, as the pair file names them."""
    labels = reference.hybrid_keys(config.load())["labels"]
    return [v for v, _ in districts_by_value()][:4], [labels[k] for k in powertrain_keys(4)]


def table_rows(template: dict, month: tuple[int, int], counts: dict, first_id: int) -> list[dict]:
    """The vehicles of a table: `counts` maps (row index, column index) to a count; rows are districts of distinct regions
    and columns are motive power codes."""
    districts = [d for _, d in districts_by_value()]
    keys = powertrain_keys(4)
    rows, next_id = [], first_id
    for (i, j), n in sorted(counts.items()):
        for _ in range(n):
            rows.append(dict(template, OBJECTID=next_id, TLA=districts[i], MOTIVE_POWER=keys[j],
                             FIRST_NZ_REGISTRATION_YEAR=month[0], FIRST_NZ_REGISTRATION_MONTH=month[1]))
            next_id += 1
    return rows


# The first test's table, by row and column index. (0, 0) is the one cell under the minimum.
RECTANGLE = {(0, 0): 9, (0, 1): 30, (0, 2): 20, (1, 0): 40, (1, 1): 12, (1, 2): 35,
             (2, 0): 25, (2, 1): 50, (2, 2): 15, (3, 0): 60, (3, 1): 11, (3, 2): 45}
# test_pair_cells's table whose totals pin a cell, as indexes: r1..r4 are rows 0..3 and c1..c4 columns 0..3.
PINNED_INDEXES = {(int(a[1]) - 1, int(b[1]) - 1): n for (a, b), n in PINNED.items()}
PINNED_HIDDEN_INDEXES = {(int(a[1]) - 1, int(b[1]) - 1) for a, b in PINNED_HIDDEN}


def fixture_rows(with_extra: bool = True) -> list[dict]:
    template = next(r for r in load_rows() if r["OBJECTID"] == 62)
    rows = extra_rows(load_rows())[0] if with_extra else load_rows()
    return rows + table_rows(template, PAIR_MONTH, RECTANGLE, 20000) + table_rows(template, PINNED_MONTH, PINNED_INDEXES, 30000)


def with_pair(cfg, reverse: bool = False):
    """Config whose dataset builds one pair, the other dimension first or second; returns it and the pair's file name."""
    pair = [other_dimension(), owner_dimension()]
    pair = pair[::-1] if reverse else pair
    cfg.pipeline["datasets"][DATASET]["pairs"] = [pair]
    return cfg, "__".join(pair)


def at(table: dict, regions, powertrains, i: int, j: int, reverse: bool = False):
    """The cell of row index i and column index j in a pair file's period, whichever order the pair is in."""
    return table[(regions[i], powertrains[j]) if reverse else (powertrains[j], regions[i])]


def read_pair(workspace, key) -> dict:
    path = workspace["public"] / "pairs" / DATASET / f"{key}.parquet"
    out: dict = {}
    for month, a, b, n, denominator, fc_sum, fc_n, fc_eligible_n in duckdb.connect().execute(
            f"SELECT * FROM read_parquet('{path.as_posix()}') ORDER BY month, a_value, b_value").fetchall():
        out.setdefault((month.year, month.month), {})[(a, b)] = (n, denominator, fc_sum, fc_n, fc_eligible_n)
    return out


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    root = tmp_path_factory.mktemp("pair_cells")
    workspace = {"staging": root / "staging", "public": root / "public", "state": root / "state" / "last_good.json",
                 "snapshots": root / "snapshots", "supplied": root / "supplied"}
    cfg, key = with_pair(make_cfg(workspace))
    manifest = run(root, cfg, fixture_rows())
    return manifest, read_pair(workspace, key), key, cfg


# --- what is written --------------------------------------------------------------------------------------------------


def test_a_small_cell_is_hidden_with_the_rectangle_that_closes_it(built):
    _, pair, _, _ = built
    regions, powertrains = names()
    # 9 sits at (0, 0). Its row hides the smaller of its other cells (20, column 2), its column the smaller of the others
    # (25, row 2), and row 2 then closes the rectangle in the column that already holds a hidden cell (15, column 2).
    hidden = {(0, 0), (0, 2), (2, 0), (2, 2)}
    table = pair[PAIR_MONTH]
    for (i, j), n in RECTANGLE.items():
        cell = at(table, regions, powertrains, i, j)
        assert (cell[0] is None) == ((i, j) in hidden), (i, j)
        assert cell[0] in (None, n)
        assert cell[1] == sum(RECTANGLE.values()), "the period's total stays on every row"
        assert cell[2:] == (None, None, None), "no row of a protected pair carries a fuel figure"
    assert len(table) == len(RECTANGLE), "a hidden cell keeps its row"


def test_a_table_whose_totals_pin_a_cell_although_every_line_keeps_the_counts_is_not_broken_down(built):
    _, pair, _, _ = built
    assert pair[PINNED_MONTH] == {RESERVED: (sum(PINNED.values()),) * 2 + (None, None, None)}


def test_the_other_dimension_may_come_first_or_second(tmp_path, workspace):
    cfg, key = with_pair(make_cfg(workspace), reverse=True)
    run(tmp_path, cfg, fixture_rows(with_extra=False))
    regions, powertrains = names()
    table = read_pair(workspace, key)[PAIR_MONTH]
    assert {(i, j) for (i, j) in RECTANGLE if at(table, regions, powertrains, i, j, reverse=True)[0] is None} == {(0, 0), (0, 2), (2, 0), (2, 2)}


def test_a_period_either_slice_does_not_break_down_is_one_reserved_row_and_a_hidden_value_hides_its_line(tmp_path, workspace):
    rows, names_ = extra_rows(load_rows())
    cfg, key = with_pair(make_cfg(workspace))
    run(tmp_path, cfg, rows)
    pair = read_pair(workspace, key)
    # 2023-06 and 2023-09 are not broken down in the region slice (test_small_cells_build), so their pair is not either.
    assert pair[(2023, 6)] == {RESERVED: (5, 5, None, None, None)}
    assert pair[(2023, 9)] == {RESERVED: (45, 45, None, None, None)}
    # 2023-05 hides two regions in the slice (9 and 10): both lines are hidden whole in the pair, and the rest stand.
    may = pair[(2023, 5)]
    hidden = {ab for ab, (n, *_r) in may.items() if n is None}
    assert hidden == {ab for ab in may if names_["v1"] in ab or names_["v2"] in ab} and len(hidden) == 2 and len(may) == 4
    # 2023-07 has nothing under the minimum: shown whole.
    assert all(n is not None for n, *_ in pair[(2023, 7)].values())


def test_the_manifest_says_what_was_hidden_in_the_pair_and_agrees_with_the_file(built):
    manifest, pair, key, cfg = built
    block = manifest["datasets"][DATASET]["small_cell_pairs"][key]
    rule = privacy.pair_cell_rule(privacy.load_map(cfg))
    assert (block["minimum"], block["minimum_hidden_cells"], block["minimum_hidden_vehicles"]) == (
        rule.minimum, rule.hidden_cells, rule.hidden_vehicles)
    hidden = sum(1 for cells in pair.values() for ab, (n, *_r) in cells.items() if n is None and ab != RESERVED)
    assert block["cells_hidden_first_rule"] + block["cells_hidden_by_slice"] + block["cells_hidden_second_rule"] == hidden
    assert block["months"] == len(pair)
    assert block["months_not_broken_down"] == sum(1 for cells in pair.values() if RESERVED in cells)
    reserved = sum(c[RESERVED][0] for c in pair.values() if RESERVED in c)
    assert block["vehicles_in_months_not_broken_down"] == reserved
    held = sum(next(iter(c.values()))[1] - sum(n or 0 for n, *_r in c.values()) for c in pair.values() if RESERVED not in c)
    assert block["vehicles_in_hidden_cells"] == held
    assert isinstance(block["narrowest_range"], int) and block["narrowest_range"] > 0


def test_the_block_is_there_only_for_the_pair_held_to_the_rule(built):
    """So a reader tells a protected pair from a plain one by it."""
    manifest, _, key, _ = built
    assert set(manifest["datasets"][DATASET]["small_cell_pairs"]) == {key}


def test_a_plain_pair_of_a_dataset_has_no_block_and_is_written_as_before(tmp_path, workspace):
    cfg = make_cfg(workspace)
    manifest = run(tmp_path, cfg, load_rows())
    assert "small_cell_pairs" not in manifest["datasets"][DATASET]
    assert manifest["datasets"][DATASET]["live_pairs"]


def test_a_map_that_groups_no_field_as_the_owner_writes_the_pair_as_counted(tmp_path, workspace):
    dmap = privacy.load_map(config.load())
    dmap["owner_groups"] = []
    custom = tmp_path / "data_map.json"
    custom.write_text(json.dumps(dmap), encoding="utf-8")
    cfg, key = with_pair(make_cfg(workspace, data_map=custom))
    manifest = run(tmp_path, cfg, fixture_rows())
    assert "small_cell_pairs" not in manifest["datasets"][DATASET]
    regions, powertrains = names()
    assert all(at(read_pair(workspace, key)[PAIR_MONTH], regions, powertrains, i, j)[0] is not None for (i, j) in RECTANGLE)


def test_a_pair_naming_a_dimension_the_dataset_cannot_derive_still_aborts(tmp_path, workspace):
    cfg, _ = with_pair(make_cfg(workspace))
    cfg.pipeline["datasets"][DATASET]["pairs"].append([owner_dimension(), "no_such_dimension"])
    expect_abort(lambda: run(tmp_path, cfg, load_rows(), publish=False), "not a derivable dimension")


# --- a pair that should be protected and is not never reaches public/data -------------------------------------------------


def aborts_with(tmp_path, workspace, fragment):
    cfg, _ = with_pair(make_cfg(workspace))
    with pytest.raises(GuardrailError) as info:
        run(tmp_path, cfg, fixture_rows())
    assert fragment in str(info.value), str(info.value)
    assert not workspace["public"].exists()
    assert not workspace["state"].exists()


def force_the_pinned_table(monkeypatch):
    """The writer decides the pinned table's hidden cells as if it had no audit, as a writer with a fault would."""
    real = pair_cells.decide_period
    regions, powertrains = names()

    def decide(cells, rule, row_totals, col_totals, total):
        if total == sum(PINNED.values()):
            hidden = {(powertrains[j], regions[i]) for i, j in PINNED_HIDDEN_INDEXES}
            return pair_cells.Hidden(tuple(sorted(hidden)), (), (), 1)
        return real(cells, rule, row_totals, col_totals, total)

    monkeypatch.setattr(pair_cells, "decide_period", decide)


def test_a_pair_written_without_the_rule_aborts_the_build_and_publishes_nothing(tmp_path, workspace, monkeypatch):
    def unprotected(con, cfg, a, b, ds, path, rule, slice_a, slice_b):
        outputs.write_pair(con, cfg, a, b, ds, path)
        return {"minimum": rule.minimum, "minimum_hidden_cells": rule.hidden_cells, "minimum_hidden_vehicles": rule.hidden_vehicles,
                "months": 0, "cells_hidden_first_rule": 0, "cells_hidden_by_slice": 0, "cells_hidden_second_rule": 0,
                "vehicles_in_hidden_cells": 0, "months_not_broken_down": 0, "vehicles_in_months_not_broken_down": 0,
                "narrowest_range": None}

    monkeypatch.setattr(pair_cells, "write_protected_pair", unprotected)
    aborts_with(tmp_path, workspace, "a visible count is under the minimum")


def test_a_pair_whose_lines_hide_too_few_cells_aborts_the_build(tmp_path, workspace, monkeypatch):
    """The first rule applied and the line rule left out: one hidden cell in a line is what the line's total gives away."""
    def first_rule_only(cells, rule, row_totals, col_totals, total):
        small = tuple(sorted(c for c, n in cells.items() if n < rule.minimum))
        return pair_cells.Hidden(small, (), (), None)

    monkeypatch.setattr(pair_cells, "decide_period", first_rule_only)
    aborts_with(tmp_path, workspace, "fewer than 2 hidden cells")


def test_a_pair_whose_hidden_cell_the_totals_pin_aborts_the_build(tmp_path, workspace, monkeypatch):
    """Every line keeps the rule's counts and the totals still give one hidden cell away: only the audit finds it."""
    force_the_pinned_table(monkeypatch)
    aborts_with(tmp_path, workspace, "the totals pin a hidden cell to one value")


def test_the_same_build_publishes_the_pinned_table_when_the_audit_is_ignored(tmp_path, workspace, monkeypatch):
    """So the test above fails because of the audit and of nothing else."""
    force_the_pinned_table(monkeypatch)
    monkeypatch.setattr(pair_cells, "narrowest", lambda ranges: 1)
    cfg, key = with_pair(make_cfg(workspace))
    run(tmp_path, cfg, fixture_rows())
    regions, powertrains = names()
    table = read_pair(workspace, key)[PINNED_MONTH]
    assert {(i, j) for (i, j) in PINNED_INDEXES if at(table, regions, powertrains, i, j)[0] is None} == PINNED_HIDDEN_INDEXES


def test_a_hidden_value_whose_pair_line_is_left_visible_aborts_the_build(tmp_path, workspace, monkeypatch):
    """The first rule only, so a region hidden in the slice by the second rule is visible in the pair."""
    def small_only(cells, rule, row_totals, col_totals, total):
        small = tuple(sorted(c for c, n in cells.items() if n < rule.minimum))
        return pair_cells.Hidden(small, (), (), None)

    monkeypatch.setattr(pair_cells, "decide_period", small_only)
    cfg, _ = with_pair(make_cfg(workspace))
    rows, _names = extra_rows(load_rows())
    with pytest.raises(GuardrailError) as info:
        run(tmp_path, cfg, rows)
    assert "has a visible cell" in str(info.value) or "fewer than 2 hidden cells" in str(info.value), str(info.value)


def test_a_pair_whose_one_field_slice_lacks_one_of_its_periods_aborts_the_build_with_a_message(tmp_path, workspace, monkeypatch):
    """A fault that leaves a period out of a written slice is named, not left to fail as a missing key."""
    from pipeline import small_cells

    real = small_cells.write_protected_slice

    def without_the_first_period(con, cfg, derived, ds, path, rule):
        figures = real(con, cfg, derived, ds, path, rule)
        con.execute(f"COPY (SELECT * FROM read_parquet('{path.as_posix()}') WHERE month > (SELECT min(month) FROM read_parquet('{path.as_posix()}'))) "
                    f"TO '{path.with_name('shortened.parquet').as_posix()}' (FORMAT PARQUET)")
        path.unlink()
        path.with_name("shortened.parquet").rename(path)
        return figures

    monkeypatch.setattr(small_cells, "write_protected_slice", without_the_first_period)
    aborts_with(tmp_path, workspace, "are not in the written one-field slices it stands on")
