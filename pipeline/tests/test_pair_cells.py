"""The rule for a table of two fields with an owner field (pipeline/pair_cells.py, D-135), on small made-up tables.

A table is a dict of (row, column) -> count, with the rows and columns written r1.. and c1..: no value of the register is
named here (design invariant 1). `decide` takes the line totals from the table itself, as the public one-field tables
publish them, and lets a test hide a row or a column in its one-field slice. The postconditions are checked by `broken_by`,
written here from the rule's statement and not from the module, so a module that changes its rule is caught by a test that
does not change with it.
"""

from __future__ import annotations

import itertools
import random

import duckdb
import pytest

from pipeline import pair_cells
from pipeline.contract import NOT_BROKEN_DOWN
from pipeline.pair_cells import Hidden, bounds, decide_period, narrowest
from pipeline.privacy import SmallCellRule

RULE = SmallCellRule(minimum=10, hidden_cells=2, hidden_vehicles=10)


def totals(counts, hide_rows=(), hide_cols=()):
    rows = {a: (None if a in hide_rows else sum(n for (x, _), n in counts.items() if x == a)) for a in {a for a, _ in counts}}
    cols = {b: (None if b in hide_cols else sum(n for (_, y), n in counts.items() if y == b)) for b in {b for _, b in counts}}
    return rows, cols, sum(counts.values())


def decide(counts, rule=RULE, hide_rows=(), hide_cols=()):
    rows, cols, total = totals(counts, hide_rows, hide_cols)
    return decide_period(counts, rule, rows, cols, total)


def grid(*lines):
    """grid([5, 30, 60], [20, 25, 70]) -> {("r1","c1"): 5, ...}; None leaves a cell out (no vehicles)."""
    return {(f"r{i}", f"c{j}"): n for i, line in enumerate(lines, 1) for j, n in enumerate(line, 1) if n is not None}


def hidden_set(result: Hidden) -> set:
    return set(result.all)


def broken_by(counts, result: Hidden, rule=RULE, hide_rows=(), hide_cols=()) -> list[str]:
    """What a result breaks, from the statement of the rule alone."""
    found = []
    hidden = hidden_set(result)
    for cell, n in counts.items():
        if n < rule.minimum and cell not in hidden:
            found.append(f"{cell} holds {n}, under the minimum, and is visible")
    if hidden and len(hidden) == len(counts):
        found.append("no cell is visible")
    for kind, index, forced in (("row", 0, hide_rows), ("col", 1, hide_cols)):
        for value in {c[index] for c in counts}:
            line = [c for c in counts if c[index] == value]
            hid = [c for c in line if c in hidden]
            if value in forced:
                found += [f"{c} is visible on a line hidden in its slice" for c in line if c not in hidden]
                continue
            if not hid:
                continue
            held = sum(counts[c] for c in hid)
            if len(hid) < rule.hidden_cells or held < rule.hidden_vehicles or held <= len(hid) or len(hid) == len(line):
                found.append(f"{kind} {value} holds {len(hid)} hidden cells with {held} vehicles of {len(line)} cells")
    return found


# --- the rule ---------------------------------------------------------------------------------------------------------


def test_a_table_with_no_cell_under_the_minimum_hides_nothing():
    assert decide(grid([10, 30, 60], [20, 25, 70], [40, 50, 80])) == Hidden((), (), (), None)


def test_a_cell_of_exactly_the_minimum_is_visible_and_one_under_it_is_not():
    counts = grid([9, 30, 60], [20, 25, 70], [40, 50, 80])
    assert ("r1", "c1") in decide(counts).first
    assert decide(grid([10, 30, 60], [20, 25, 70], [40, 50, 80])).first == ()


def test_one_small_cell_hides_the_rectangle_that_closes_it():
    counts = grid([5, 30, 60], [20, 25, 70], [40, 50, 80])
    result = decide(counts)
    assert result.first == (("r1", "c1"),)
    # The row needs a second hidden cell (its smaller, c2); the column then needs one (r2, the smaller); that row's
    # second hidden cell is the one whose column already holds a hidden cell (c2), which closes the rectangle.
    assert result.by_line == (("r1", "c2"), ("r2", "c1"), ("r2", "c2"))
    assert hidden_set(result) == {(a, b) for a in ("r1", "r2") for b in ("c1", "c2")}
    assert broken_by(counts, result) == []
    assert result.narrowest and result.narrowest > 0


def test_a_cell_that_closes_a_rectangle_is_preferred_to_a_smaller_one():
    counts = grid([5, 30, 20], [60, 4, 70], [40, 50, 80])
    result = decide(counts)
    assert set(result.first) == {("r1", "c1"), ("r2", "c2")}
    # r1 needs a second cell: c3 is smaller (20) but c2 (30) sits in a column that already holds a hidden cell.
    assert ("r1", "c2") in result.by_line and ("r1", "c3") not in result.by_line
    assert broken_by(counts, result) == []


def test_a_small_cell_in_a_line_with_one_other_cell_cannot_be_protected():
    # Hiding the 300 would leave r1 with no visible cell, which its total would then give away.
    assert decide(grid([5, 300, None], [30, 40, 50])) is None


def test_a_small_cell_alone_in_its_line_cannot_be_protected():
    assert decide(grid([5, None, None], [30, 40, 50], [35, 45, 55])) is None


def test_two_small_cells_in_one_row_that_together_are_under_the_floor_pull_in_the_next_smallest():
    counts = grid([3, 4, 40, 50], [20, 30, 60, 70], [25, 35, 45, 55])
    result = decide(counts)
    assert result.first == (("r1", "c1"), ("r1", "c2"))
    assert hidden_set(result) == {(a, b) for a in ("r1", "r2") for b in ("c1", "c2", "c3")}
    assert broken_by(counts, result) == []


def test_two_small_cells_in_one_row_that_reach_the_floor_need_no_more_in_that_row():
    counts = grid([6, 7, 40, 50], [20, 30, 60, 70], [25, 35, 45, 55])
    result = decide(counts)
    # r1 holds 13 in two cells: it is met. Each column then needs a second cell.
    assert result.first == (("r1", "c1"), ("r1", "c2"))
    assert {c for c in hidden_set(result) if c[0] == "r1"} == {("r1", "c1"), ("r1", "c2")}
    assert broken_by(counts, result) == []


def test_a_tie_goes_to_the_cell_that_sorts_first():
    counts = grid([5, 30, 30], [20, 40, 50], [25, 45, 55])
    result = decide(counts)
    assert result.by_line[0] == ("r1", "c2")
    again = decide(dict(reversed(list(counts.items()))))
    assert again == result, "the order the cells arrive in does not matter"


def test_a_value_hidden_in_its_one_field_slice_has_every_cell_of_its_line_hidden():
    counts = grid([30, 40, 50, None], [20, 25, 70, 33], [15, 60, 90, 44], [22, 33, 44, 55])
    result = decide(counts, hide_rows=("r1",))
    assert {("r1", "c1"), ("r1", "c2"), ("r1", "c3")} <= hidden_set(result)
    assert set(result.by_slice) == {("r1", "c1"), ("r1", "c2"), ("r1", "c3")}
    assert result.first == ()
    assert broken_by(counts, result, hide_rows=("r1",)) == []
    # Each of those columns now holds a hidden cell, so each must hold a second.
    for column in ("c1", "c2", "c3"):
        assert sum(1 for c in hidden_set(result) if c[1] == column) >= 2


def test_a_column_hidden_in_its_one_field_slice_is_treated_the_same_way():
    counts = grid([30, 40, 50], [20, 25, 70], [15, None, 90], [22, None, 44])
    result = decide(counts, hide_cols=("c2",))
    assert set(result.by_slice) == {("r1", "c2"), ("r2", "c2")}
    assert broken_by(counts, result, hide_cols=("c2",)) == []


def test_a_cell_both_small_and_on_a_hidden_line_counts_once_as_small():
    counts = grid([5, 40, 50, None], [20, 25, 70, 33], [15, 60, 90, 44], [22, 33, 44, 55])
    result = decide(counts, hide_rows=("r1",))
    assert ("r1", "c1") in result.first and ("r1", "c1") not in result.by_slice
    assert len(hidden_set(result)) == len(result.all)


def test_a_single_value_hidden_in_its_slice_is_given_away_by_the_others_and_the_period_is_not_broken_down():
    """The other rows' totals are public and so is the period's, so the one row whose total is hidden has a total that
    can be worked out; its single hidden cell is then that total. The audit finds it."""
    counts = grid([40, None, None], [20, 25, 70], [15, 60, 90], [22, 33, 44])
    assert decide(counts, hide_rows=("r1",)) is None


def test_two_values_hidden_in_their_slice_are_held_only_to_the_columns_they_cross():
    counts = grid([40, 30, None], [20, 25, 70], [15, 60, 90], [22, 33, 44], [18, 35, 55])
    result = decide(counts, hide_rows=("r1", "r2"))
    assert result is not None
    assert {("r1", "c1"), ("r1", "c2"), ("r2", "c1"), ("r2", "c2"), ("r2", "c3")} == set(result.by_slice)
    assert broken_by(counts, result, hide_rows=("r1", "r2")) == []


def test_a_table_of_a_single_cell_under_the_minimum_cannot_be_protected():
    assert decide({("r1", "c1"): 3}) is None


def test_a_table_where_every_value_is_hidden_in_its_slices_cannot_be_protected():
    counts = grid([30, 40], [20, 25])
    assert decide(counts, hide_rows=("r1", "r2"), hide_cols=("c1", "c2")) is None


def test_the_numbers_are_the_rules_not_the_codes():
    counts = grid([5, 30, 60, 90], [20, 25, 70, 80], [40, 50, 80, 95], [45, 55, 85, 99])
    stricter = SmallCellRule(minimum=30, hidden_cells=2, hidden_vehicles=30)
    result = decide(counts, stricter)
    assert result.first == (("r1", "c1"), ("r2", "c1"), ("r2", "c2"))
    assert broken_by(counts, result, stricter) == []
    assert decide(counts, SmallCellRule(minimum=5, hidden_cells=2, hidden_vehicles=5)) == Hidden((), (), (), None)
    assert decide(counts).first == (("r1", "c1"),)


def test_the_result_does_not_depend_on_the_rules_order_of_arrival_or_on_a_second_run():
    counts = grid([5, 30, 60, 11], [20, 4, 70, 12], [40, 50, 80, 13], [8, 9, 14, 15])
    result = decide(counts)
    assert result is not None
    assert decide(counts) == result
    shuffled = list(counts.items())
    random.Random(7).shuffle(shuffled)
    assert decide(dict(shuffled)) == result


def test_every_table_the_rule_accepts_keeps_the_rule_and_pins_no_cell():
    """Many small random tables, the postconditions checked from the statement of the rule and the audit repeated."""
    rng = random.Random(20261118)
    accepted = refused = 0
    for _ in range(700):
        rows, cols = rng.randint(2, 5), rng.randint(2, 5)
        counts = {(f"r{i}", f"c{j}"): rng.choice([3, 9, 10, 12, 14, 20, 30, 45, 60, 90, 120])
                  for i in range(1, rows + 1) for j in range(1, cols + 1) if rng.random() < 0.85}
        if len(counts) < 2:
            continue
        hide_rows = tuple(sorted({a for a, _ in counts} & {"r1"})) if rng.random() < 0.2 else ()
        result = decide(counts, hide_rows=hide_rows)
        if result is None:
            refused += 1
            continue
        accepted += 1
        assert broken_by(counts, result, hide_rows=hide_rows) == [], counts
        rows_t, cols_t, total = totals(counts, hide_rows)
        ranges = bounds({c: (None if c in hidden_set(result) else n) for c, n in counts.items()}, rows_t, cols_t, total)
        assert ranges is not None and (not ranges or narrowest(ranges) > 0), (counts, ranges)
        for cell, (low, high) in ranges.items():
            assert low <= counts[cell] <= high, "the real value is among the values the totals leave"
    assert accepted > 100 and refused > 20, (accepted, refused)


# --- the audit --------------------------------------------------------------------------------------------------------

# A table whose every line keeps the rule's counts and whose every small cell is hidden, and in which the totals still pin
# one hidden cell (r2, c3) to 5. Found by a search over random tables (the scratch script is not kept).
PINNED = grid([5, 13, 13, None], [8, 8, 5, 90], [13, 20, 8, 5], [None, 20, 8, 13])
PINNED_HIDDEN = {("r1", "c1"), ("r1", "c2"), ("r2", "c1"), ("r2", "c2"), ("r2", "c3"), ("r3", "c3"), ("r3", "c4"), ("r4", "c3"), ("r4", "c4")}


def pinned_cells():
    return {c: (None if c in PINNED_HIDDEN else n) for c, n in PINNED.items()}


def test_the_pinned_table_keeps_every_count_of_the_rule():
    assert broken_by(PINNED, Hidden(tuple(sorted(PINNED_HIDDEN)), (), (), None)) == []


def test_the_audit_finds_the_cell_the_totals_pin():
    rows, cols, total = totals(PINNED)
    ranges = bounds(pinned_cells(), rows, cols, total)
    assert ranges[("r2", "c3")] == (5, 5)
    assert narrowest(ranges) == 0
    assert all(low <= PINNED[c] <= high for c, (low, high) in ranges.items())


def test_the_rule_refuses_a_period_whose_counts_hold_but_whose_totals_pin_a_cell():
    assert decide(PINNED) is None


def test_without_the_audit_the_rule_would_hide_exactly_the_pinned_set(monkeypatch):
    """The audit, and nothing else, is what refuses the period: with its verdict ignored the same cells are chosen."""
    monkeypatch.setattr(pair_cells, "narrowest", lambda ranges: 1)
    result = decide(PINNED)
    assert result is not None and hidden_set(result) == PINNED_HIDDEN
    assert broken_by(PINNED, result) == []


def test_the_audit_on_a_rectangle_gives_the_ranges_worked_out_by_hand():
    cells = {("r1", "c1"): None, ("r1", "c2"): None, ("r1", "c3"): 50,
             ("r2", "c1"): None, ("r2", "c2"): None, ("r2", "c3"): 60,
             ("r3", "c1"): 40, ("r3", "c2"): 45, ("r3", "c3"): 80}
    truth = {("r1", "c1"): 6, ("r1", "c2"): 9, ("r2", "c1"): 7, ("r2", "c2"): 12}
    full = {c: truth.get(c, n) for c, n in cells.items()}
    rows, cols, total = totals(full)
    # Row sums of the hidden cells 15 and 19, column sums 13 and 21: the top-left cell t runs from 1 to 12 (the column
    # leaves 13 - 1), its row neighbour 15 - t from 3 to 14, and so on.
    assert bounds(cells, rows, cols, total) == {
        ("r1", "c1"): (1, 12), ("r1", "c2"): (3, 14), ("r2", "c1"): (1, 12), ("r2", "c2"): (7, 18)}


def test_the_audit_agrees_with_every_assignment_on_small_tables():
    """Brute force: list every set of values for the hidden cells that the totals allow, and take the extremes."""
    rng = random.Random(11)
    checked = 0
    for _ in range(250):
        rows, cols = rng.randint(2, 3), rng.randint(2, 3)
        counts = {(f"r{i}", f"c{j}"): rng.randint(1, 4) for i in range(1, rows + 1) for j in range(1, cols + 1) if rng.random() < 0.9}
        hidden = [c for c in counts if rng.random() < 0.55]
        if not hidden or len(hidden) > 4:
            continue
        hide_rows = ("r1",) if rng.random() < 0.25 else ()
        row_t, col_t, total = totals(counts, hide_rows)
        cells = {c: (None if c in hidden else n) for c, n in counts.items()}
        known_rows = {a: t for a, t in row_t.items() if t is not None}
        unknown_rows = [a for a, t in row_t.items() if t is None]
        feasible = []
        for values in itertools.product(range(1, 13), repeat=len(hidden)):
            filled = {c: (dict(zip(hidden, values))[c] if c in hidden else n) for c, n in cells.items()}
            if any(sum(v for (x, _), v in filled.items() if x == a) != t for a, t in known_rows.items()):
                continue
            if any(sum(v for (_, y), v in filled.items() if y == b) != t for b, t in col_t.items()):
                continue
            if unknown_rows and sum(v for (x, _), v in filled.items() if x in unknown_rows) != total - sum(known_rows.values()):
                continue
            feasible.append(dict(zip(hidden, values)))
        got = bounds(cells, row_t, col_t, total)
        if not feasible:
            assert got is None
            continue
        checked += 1
        assert got == {c: (min(f[c] for f in feasible), max(f[c] for f in feasible)) for c in hidden}, (counts, hidden, hide_rows)
    assert checked > 60, checked


def test_the_audit_says_none_when_no_values_are_consistent():
    cells = {("r1", "c1"): None, ("r1", "c2"): 10, ("r2", "c1"): 10, ("r2", "c2"): None}
    assert bounds(cells, {"r1": 11, "r2": 25}, {"c1": 11, "c2": 25}, 36) is not None
    assert bounds(cells, {"r1": 10, "r2": 25}, {"c1": 11, "c2": 24}, 35) is None, "a hidden cell cannot be zero"
    assert bounds(cells, {"r1": 11, "r2": 25}, {"c1": 11, "c2": 26}, 36) is None, "the columns do not add up to the rows"


def test_two_values_hidden_in_the_slice_share_one_known_sum():
    # Truth: r1 holds 10 and 12, r2 holds 8 and 15 (45 together); r3 is public (70). The columns' totals are public.
    cells = {("r1", "c1"): None, ("r1", "c2"): None, ("r2", "c1"): None, ("r2", "c2"): None, ("r3", "c1"): 30, ("r3", "c2"): 40}
    ranges = bounds(cells, {"r1": None, "r2": None, "r3": 70}, {"c1": 48, "c2": 67}, 115)
    # c1 leaves 18 for its two hidden cells and c2 leaves 27; no row total is public, only that the two rows hold 45.
    assert ranges == {("r1", "c1"): (1, 17), ("r2", "c1"): (1, 17), ("r1", "c2"): (1, 26), ("r2", "c2"): (1, 26)}
    # With one of the two rows' totals made public the cells are tied to it.
    tied = bounds(cells, {"r1": 22, "r2": None, "r3": 70}, {"c1": 48, "c2": 67}, 115)
    assert tied[("r1", "c1")] == (1, 17) and tied[("r1", "c2")] == (5, 21)


# --- reading a written pair back --------------------------------------------------------------------------------------


def write_slice(tmp_path, name, rows):
    """A one-field slice file: rows of (value, n) for the month 2026-10-01; n None is a hidden cell."""
    path = tmp_path / f"{name}.parquet"
    con = duckdb.connect()
    total = sum(n for _, n in rows if n is not None)
    con.execute("CREATE TABLE s (month DATE, dim_value VARCHAR, n INTEGER, denominator INTEGER, fc_sum DOUBLE, fc_n INTEGER, fc_eligible_n INTEGER)")
    for value, n in rows:
        con.execute("INSERT INTO s VALUES (DATE '2026-10-01', ?, ?, ?, NULL, NULL, NULL)", [value, n, total])
    con.execute(f"COPY s TO '{path.as_posix()}' (FORMAT PARQUET)")
    return path


def write_pair(tmp_path, cells, denominator=None, name="pair"):
    path = tmp_path / f"{name}.parquet"
    con = duckdb.connect()
    con.execute("CREATE TABLE p (month DATE, a_value VARCHAR, b_value VARCHAR, n INTEGER, denominator INTEGER, fc_sum DOUBLE, fc_n INTEGER, fc_eligible_n INTEGER)")
    total = denominator if denominator is not None else sum(n for n in cells.values() if n is not None)
    for (a, b), n in sorted(cells.items()):
        con.execute("INSERT INTO p VALUES (DATE '2026-10-01', ?, ?, ?, ?, NULL, NULL, NULL)", [a, b, n, total])
    con.execute(f"COPY p TO '{path.as_posix()}' (FORMAT PARQUET)")
    return path


def slices_of(tmp_path, counts, hidden=(), hide_rows=(), hide_cols=()):
    rows, cols, _ = totals(counts)
    a = write_slice(tmp_path, "a", [(v, None if v in hide_rows else t) for v, t in sorted(rows.items())])
    b = write_slice(tmp_path, "b", [(v, None if v in hide_cols else t) for v, t in sorted(cols.items())])
    return a, b


def check(tmp_path, cells, counts, **kw):
    a, b = slices_of(tmp_path, counts, **kw)
    path = write_pair(tmp_path, cells, denominator=sum(counts.values()))
    return pair_cells.check_pair(duckdb.connect(), path, RULE, a, b)


def hide(counts, hidden):
    return {c: (None if c in hidden else n) for c, n in counts.items()}


def test_a_pair_that_keeps_the_rule_reads_back_clean(tmp_path):
    counts = grid([5, 30, 60], [20, 25, 70], [40, 50, 80])
    result = decide(counts)
    assert check(tmp_path, hide(counts, hidden_set(result)), counts) == []


def test_a_table_with_nothing_hidden_must_add_up_to_its_slices(tmp_path):
    counts = grid([15, 30, 60], [20, 25, 70], [40, 50, 80])
    assert check(tmp_path, dict(counts), counts) == []
    short = dict(counts)
    short[("r1", "c1")] = 14
    assert any("do not add up" in p for p in check(tmp_path, short, counts))


def test_a_visible_count_under_the_minimum_is_found(tmp_path):
    counts = grid([5, 30, 60], [20, 25, 70], [40, 50, 80])
    assert any("under the minimum" in p for p in check(tmp_path, dict(counts), counts))


def test_a_single_hidden_cell_in_a_line_is_found(tmp_path):
    counts = grid([5, 30, 60], [20, 25, 70], [40, 50, 80])
    problems = check(tmp_path, hide(counts, {("r1", "c1")}), counts)
    assert any("fewer than 2 hidden cells" in p for p in problems)


def test_hidden_cells_that_together_count_too_few_are_found(tmp_path):
    counts = grid([2, 3, 60, 70], [20, 25, 70, 90], [40, 50, 80, 60])
    hidden = {("r1", "c1"), ("r1", "c2"), ("r2", "c1"), ("r2", "c2")}
    problems = check(tmp_path, hide(counts, hidden), counts)
    assert any("together count fewer than 10" in p for p in problems)


def test_hidden_cells_that_are_each_exactly_one_are_found(tmp_path):
    counts = grid([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 100], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 100], [30] * 11)
    hidden = {(a, f"c{j}") for a in ("r1", "r2") for j in range(1, 11)}
    problems = check(tmp_path, hide(counts, hidden), counts)
    assert any("exactly one" in p for p in problems)


def test_a_line_with_hidden_cells_and_no_visible_cell_is_found(tmp_path):
    counts = grid([6, 7, None], [20, 25, 70], [40, 50, 80])
    hidden = {("r1", "c1"), ("r1", "c2"), ("r2", "c1"), ("r2", "c2")}
    problems = check(tmp_path, hide(counts, hidden), counts)
    assert any("no visible cell" in p for p in problems)


def test_a_value_hidden_in_its_slice_with_a_visible_cell_is_found(tmp_path):
    counts = grid([30, 40, 50], [20, 25, 70], [15, 60, 90], [22, 33, 44])
    hidden = {("r1", "c1"), ("r1", "c2"), ("r3", "c1"), ("r3", "c2")}
    problems = check(tmp_path, hide(counts, hidden), counts, hide_rows=("r1",))
    assert any("has a visible cell" in p for p in problems)


def test_a_table_that_keeps_every_count_and_pins_a_cell_is_found_by_the_audit(tmp_path):
    problems = check(tmp_path, pinned_cells(), PINNED)
    assert problems == ["the totals pin a hidden cell to one value in 1 months: 2026-10"]


def test_without_the_audit_the_pinned_table_reads_back_clean(tmp_path, monkeypatch):
    """The audit, and nothing else, is what finds the pinned table: with it ignored the file passes every count."""
    monkeypatch.setattr(pair_cells, "narrowest", lambda ranges: 1)
    assert check(tmp_path, pinned_cells(), PINNED) == []


def test_a_period_that_is_not_broken_down_is_one_reserved_row(tmp_path):
    counts = grid([5, 300, None], [30, 40, 50])
    whole = {(NOT_BROKEN_DOWN, NOT_BROKEN_DOWN): sum(counts.values())}
    assert check(tmp_path, whole, counts) == []
    bad = {(NOT_BROKEN_DOWN, NOT_BROKEN_DOWN): sum(counts.values()) - 1}
    assert any("reserved row" in p for p in check(tmp_path, bad, counts))
    mixed = {**whole, ("r1", "c1"): 5}
    assert any("reserved row" in p for p in check(tmp_path, mixed, counts))


def test_a_period_either_slice_does_not_break_down_must_be_one_reserved_row(tmp_path):
    counts = grid([30, 40], [20, 25])
    a = write_slice(tmp_path, "a", [(NOT_BROKEN_DOWN, 115)])
    b = write_slice(tmp_path, "b", [("c1", 50), ("c2", 65)])
    path = write_pair(tmp_path, dict(counts), denominator=115)
    assert any("reserved row" in p for p in pair_cells.check_pair(duckdb.connect(), path, RULE, a, b))


def test_a_value_the_slice_does_not_have_is_found(tmp_path):
    counts = grid([30, 40], [20, 25])
    a, b = slices_of(tmp_path, counts)
    extra = dict(counts)
    extra[("r9", "c1")] = 50
    path = write_pair(tmp_path, extra, denominator=sum(counts.values()))
    assert any("not in its one-field slice" in p for p in pair_cells.check_pair(duckdb.connect(), path, RULE, a, b))


@pytest.mark.parametrize("where", ["n IS NULL", "n IS NOT NULL"])
def test_a_fuel_figure_on_any_row_of_a_protected_pair_is_found(tmp_path, where):
    """On a hidden row and on a visible one: the fuel-eligible count of a visible cell narrows what the totals leave a hidden
    cell, so the pair carries none."""
    counts = grid([5, 30, 60], [20, 25, 70], [40, 50, 80])
    result = decide(counts)
    a, b = slices_of(tmp_path, counts)
    path = write_pair(tmp_path, hide(counts, hidden_set(result)), denominator=sum(counts.values()))
    con = duckdb.connect()
    leaked = tmp_path / "leaked.parquet"
    con.execute(f"COPY (SELECT month, a_value, b_value, n, denominator, CASE WHEN {where} THEN 1.5 END AS fc_sum, fc_n, fc_eligible_n "
                f"FROM read_parquet('{path.as_posix()}')) TO '{leaked.as_posix()}' (FORMAT PARQUET)")
    assert any("fuel figure" in p for p in pair_cells.check_pair(con, leaked, RULE, a, b))


@pytest.mark.parametrize("side", ["a", "b"])
def test_a_fuel_figure_on_a_row_of_either_one_field_slice_is_found(tmp_path, side):
    """The slices' fuel-eligible counts bound the pair's hidden cells and the audit does not use them, so a slice that
    carries one fails the read-back of the pair."""
    counts = grid([5, 30, 60], [20, 25, 70], [40, 50, 80])
    result = decide(counts)
    a, b = slices_of(tmp_path, counts)
    path = write_pair(tmp_path, hide(counts, hidden_set(result)), denominator=sum(counts.values()))
    assert pair_cells.check_pair(duckdb.connect(), path, RULE, a, b) == []
    target = a if side == "a" else b
    leaked = tmp_path / "leaked.parquet"
    duckdb.connect().execute(
        f"COPY (SELECT month, dim_value, n, denominator, fc_sum, fc_n, CASE WHEN dim_value = (SELECT min(dim_value) FROM read_parquet('{target.as_posix()}')) THEN 3 END AS fc_eligible_n "
        f"FROM read_parquet('{target.as_posix()}')) TO '{leaked.as_posix()}' (FORMAT PARQUET)")
    problems = pair_cells.check_pair(duckdb.connect(), path, RULE, leaked if side == "a" else a, leaked if side == "b" else b)
    assert any("one-field slice leaked carries a fuel figure" in p for p in problems), problems


def test_the_writers_figures_are_compared_with_the_file(tmp_path):
    counts = grid([5, 30, 60], [20, 25, 70], [40, 50, 80])
    result = decide(counts)
    a, b = slices_of(tmp_path, counts)
    path = write_pair(tmp_path, hide(counts, hidden_set(result)), denominator=sum(counts.values()))
    honest = {"months": 1, "cells_hidden_first_rule": 1, "cells_hidden_by_slice": 0, "cells_hidden_second_rule": 3, "months_not_broken_down": 0}
    assert pair_cells.check_pair(duckdb.connect(), path, RULE, a, b, honest) == []
    wrong = dict(honest, cells_hidden_second_rule=2)
    assert any("were written" in p for p in pair_cells.check_pair(duckdb.connect(), path, RULE, a, b, wrong))


# --- guards that only a corrupt or inconsistent file reaches -------------------------------------------------------------


def rewritten(tmp_path, path, select):
    """The file with its columns re-selected (`select` is a SELECT list over month, a_value, b_value, n, denominator, fc_*)."""
    out = tmp_path / "rewritten.parquet"
    duckdb.connect().execute(f"COPY (SELECT {select} FROM read_parquet('{path.as_posix()}')) TO '{out.as_posix()}' (FORMAT PARQUET)")
    return out


def test_lines_that_each_keep_the_counts_but_leave_no_values_for_the_hidden_cells_are_found(tmp_path):
    """Two blocks of four hidden cells: block one's rows hold 30 together and its columns 20, block two's the reverse. Every
    line holds enough, and no values fit the totals."""
    visible = {("r1", "c3"): 20, ("r1", "c4"): 20, ("r2", "c3"): 20, ("r2", "c4"): 20,
               ("r3", "c1"): 20, ("r3", "c2"): 20, ("r4", "c1"): 20, ("r4", "c2"): 20}
    hidden = [(a, b) for a in ("r1", "r2") for b in ("c1", "c2")] + [(a, b) for a in ("r3", "r4") for b in ("c3", "c4")]
    cells = {**visible, **{c: None for c in hidden}}
    a = write_slice(tmp_path, "a", [("r1", 55), ("r2", 55), ("r3", 50), ("r4", 50)])
    b = write_slice(tmp_path, "b", [("c1", 50), ("c2", 50), ("c3", 55), ("c4", 55)])
    path = write_pair(tmp_path, cells, denominator=210)
    problems = pair_cells.check_pair(duckdb.connect(), path, RULE, a, b)
    assert problems == ["the line totals leave no values for the hidden cells in 1 months: 2026-10"]


def test_a_total_that_changes_from_row_to_row_is_found(tmp_path):
    counts = grid([30, 40], [20, 25])
    a, b = slices_of(tmp_path, counts)
    path = write_pair(tmp_path, dict(counts), denominator=sum(counts.values()))
    odd = rewritten(tmp_path, path, "month, a_value, b_value, n, CASE WHEN a_value = 'r1' AND b_value = 'c1' THEN denominator + 1 ELSE denominator END AS denominator, fc_sum, fc_n, fc_eligible_n")
    assert any("not the same on every row" in p for p in pair_cells.check_pair(duckdb.connect(), odd, RULE, a, b))


def test_a_total_that_is_not_the_one_field_slices_is_found(tmp_path):
    counts = grid([30, 40], [20, 25])
    a, b = slices_of(tmp_path, counts)
    path = write_pair(tmp_path, dict(counts), denominator=sum(counts.values()) + 1)
    assert any("not the one-field slices' total" in p for p in pair_cells.check_pair(duckdb.connect(), path, RULE, a, b))


def test_a_period_that_is_not_in_both_slices_is_found(tmp_path):
    counts = grid([30, 40], [20, 25])
    a, b = slices_of(tmp_path, counts)
    path = write_pair(tmp_path, dict(counts), denominator=sum(counts.values()))
    later = rewritten(tmp_path, path, "month + INTERVAL 1 MONTH AS month, a_value, b_value, n, denominator, fc_sum, fc_n, fc_eligible_n")
    assert any("not in both one-field slices" in p for p in pair_cells.check_pair(duckdb.connect(), later, RULE, a, b))


def test_a_value_hidden_in_its_slice_whose_line_has_one_cell_is_not_held_to_the_line_count():
    """Two rows hidden in their slice, each with a single cell: the line count would refuse both, but their totals are not
    public. The columns they cross each get a second hidden cell, and the shared total of the two rows ties them."""
    counts = grid([40, None, None], [None, 35, None], [20, 25, 70], [15, 60, 90], [22, 33, 44])
    result = decide(counts, hide_rows=("r1", "r2"))
    assert result is not None and set(result.by_slice) == {("r1", "c1"), ("r2", "c2")}
    assert broken_by(counts, result, hide_rows=("r1", "r2")) == []
