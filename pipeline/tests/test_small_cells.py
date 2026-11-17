"""The small-cell rule on small synthetic tables (D-127): the rule itself, the slice it writes, and the read-back check.

The values here are neutral names and the numbers are the rule's own, passed in; nothing is read from the reference files
(design invariant 1). The same rule built into a whole fixture build is tested in test_small_cells_build.py.
"""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace

import duckdb
import pytest

from pipeline import config, outputs, small_cells
from pipeline.contract import NOT_BROKEN_DOWN, SLICE_COLUMNS
from pipeline.privacy import SmallCellRule
from pipeline.small_cells import Hidden, check_slice, decide_month, write_protected_slice

RULE = SmallCellRule(minimum=10, hidden_cells=2, hidden_vehicles=10)


# --- the rule on one month ------------------------------------------------------------------------------------------


def cells(**counts: int) -> list[tuple[str, int]]:
    return list(counts.items())


def test_a_cell_of_nine_is_hidden_and_a_cell_of_ten_is_not():
    # Two cells under the minimum already meet the second rule, so the cell of ten stays.
    assert decide_month(cells(a=9, b=5, c=10, d=200), RULE) == Hidden(("a", "b"), ())


def test_exactly_one_cell_under_the_minimum_hides_the_smallest_visible_cell_too():
    assert decide_month(cells(a=3, b=50, c=60), RULE) == Hidden(("a",), ("b",))
    assert decide_month(cells(a=9, b=10, c=200), RULE) == Hidden(("a",), ("b",))


def test_two_hidden_cells_that_count_under_the_minimum_together_hide_a_third():
    assert decide_month(cells(a=2, b=3, c=40, d=50), RULE) == Hidden(("a", "b"), ("c",))


def test_the_second_rule_hides_a_second_cell_only_when_the_first_rule_left_too_few_or_too_little():
    assert decide_month(cells(a=6, b=6, c=10, d=10, e=500), RULE) == Hidden(("a", "b"), ())
    assert decide_month(cells(a=1, b=1, c=10, d=10, e=500), RULE) == Hidden(("a", "b"), ("c",))
    assert decide_month(cells(a=1, c=10, d=10, e=500), RULE) == Hidden(("a",), ("c",))


def test_the_second_rule_goes_on_until_the_hidden_cells_count_what_the_rule_asks():
    # A rule that asks for three cells holding 40 vehicles: 2, then 15 (17), 15 (32) and 15 (47) in value order.
    strict = SmallCellRule(minimum=10, hidden_cells=3, hidden_vehicles=40)
    assert decide_month(cells(a=2, b=15, c=15, d=15, e=500), strict) == Hidden(("a",), ("b", "c", "d"))
    assert decide_month(cells(a=2, b=15, c=15, d=15), strict) == Hidden(("a",), ("b", "c", "d"))
    assert decide_month(cells(a=2, b=15, c=15), strict) is None


def test_two_cells_are_hidden_even_when_one_hidden_cell_would_already_count_enough():
    # Not a rule the map accepts (privacy.small_cell_rule refuses it), so the two halves of the second rule are told apart.
    lenient = SmallCellRule(minimum=10, hidden_cells=2, hidden_vehicles=5)
    assert decide_month(cells(a=9, b=50, c=60), lenient) == Hidden(("a",), ("b",))


def test_a_tie_among_the_smallest_visible_cells_is_broken_by_value_order_not_input_order():
    assert decide_month(cells(z=20, y=20, x=20, a=3), RULE) == Hidden(("a",), ("x",))
    assert decide_month(cells(x=20, y=20, z=20, a=3), RULE) == Hidden(("a",), ("x",))


def test_a_month_with_no_small_cell_hides_nothing():
    assert decide_month(cells(a=10, b=11, c=900), RULE) == Hidden((), ())


def test_a_single_cell_month_is_shown_when_it_is_large_and_not_broken_down_when_it_is_small():
    assert decide_month(cells(a=50), RULE) == Hidden((), ())
    assert decide_month(cells(a=9), RULE) is None


def test_a_month_whose_total_is_under_the_minimum_is_not_broken_down():
    assert decide_month(cells(a=3, b=4, c=2), RULE) is None


def test_a_month_where_everything_is_hidden_and_the_rule_is_not_met_is_not_broken_down():
    assert decide_month(cells(a=4, b=5), RULE) is None
    assert decide_month(cells(a=9, b=9), RULE) == Hidden(("a", "b"), ()), "18 vehicles in two cells meet the rule"


def test_a_month_where_everything_is_hidden_and_the_rule_is_met_hides_every_cell():
    assert decide_month(cells(a=4, b=5, c=6), RULE) == Hidden(("a", "b", "c"), ())


def test_a_total_minus_the_visible_cells_is_never_one_cell_or_fewer_than_the_minimum():
    """Over every month of up to four small cells and one large one, what is hidden meets both parts of the rule."""
    for a in range(1, 12):
        for b in range(1, 12):
            for c in (0, 4, 10, 25):
                month = [("a", a), ("b", b)] + ([("c", c)] if c else []) + [("z", 300)]
                decision = decide_month(month, RULE)
                if decision is None:
                    continue
                hidden = decision.first + decision.second
                if hidden:
                    counted = dict(month)
                    assert len(hidden) >= RULE.hidden_cells
                    assert sum(counted[v] for v in hidden) >= RULE.hidden_vehicles
                    assert all(counted[v] >= RULE.minimum for v in decision.second)
                    assert all(counted[v] < RULE.minimum for v in decision.first)


# --- the slice it writes ---------------------------------------------------------------------------------------------


def month(n: int) -> date:
    return date(2024, n, 1)


def synthetic(con, spec: dict[date, dict[str, int]]) -> None:
    """The `dims` table the slice writer reads: one row per vehicle, each with a valid fuel figure of 5.0."""
    con.execute("CREATE TABLE dims (reg_month DATE, d__probe VARCHAR, has_engine BOOLEAN, fc_status VARCHAR, fc_value DOUBLE, ds BOOLEAN)")
    for when, counts in spec.items():
        for value, n in counts.items():
            con.execute("INSERT INTO dims SELECT ?, ?, true, 'valid', 5.0, true FROM range(?)", [when, value, n])


SPEC = {
    month(1): {"a": 9, "b": 10, "c": 200},      # the cell of 9 is hidden, the cell of 10 is hidden by the second rule
    month(2): {"a": 3, "b": 4},                 # 7 vehicles: nothing to say about either
    month(3): {"a": 50, "b": 60},               # nothing under the minimum
    month(4): {"a": 2, "b": 50, "c": 60},       # exactly one small cell
    month(5): {"a": 4, "b": 5, "c": 6},         # everything hidden, the rule met
}


@pytest.fixture
def written(tmp_path):
    cfg = config.load()
    con = duckdb.connect()
    synthetic(con, SPEC)
    derived = SimpleNamespace(column="d__probe")
    path = tmp_path / "probe.parquet"
    stats = write_protected_slice(con, cfg, derived, "ds", path, RULE)
    rows = con.execute(f"SELECT * FROM read_parquet('{path.as_posix()}')").fetchall()
    return SimpleNamespace(con=con, cfg=cfg, path=path, stats=stats, rows=rows, derived=derived)


def by_key(rows) -> dict:
    return {(r[0].month, r[1]): r[2:] for r in rows}


def test_the_written_slice_has_the_contract_columns_and_order(written):
    described = [[name, typ] for name, typ, *_ in written.con.execute(f"DESCRIBE SELECT * FROM read_parquet('{written.path.as_posix()}')").fetchall()]
    assert described == [list(c) for c in SLICE_COLUMNS]
    keys = [(r[0], r[1]) for r in written.rows]
    assert keys == sorted(keys)


def test_a_hidden_cell_keeps_its_row_and_its_denominator_and_loses_every_count(written):
    rows = by_key(written.rows)
    assert rows[(1, "a")] == (None, 219, None, None, None)
    assert rows[(1, "b")] == (None, 219, None, None, None)
    assert rows[(1, "c")] == (200, 219, 1000.0, 200, 200)
    assert rows[(4, "a")] == (None, 112, None, None, None)
    assert rows[(4, "b")] == (None, 112, None, None, None)
    assert rows[(4, "c")][0] == 60
    assert {k: v for k, v in rows.items() if k[0] == 5} == {(5, v): (None, 15, None, None, None) for v in "abc"}


def test_a_month_with_nothing_under_the_minimum_is_written_as_counted(written):
    rows = by_key(written.rows)
    assert rows[(3, "a")] == (50, 110, 250.0, 50, 50)
    assert rows[(3, "b")] == (60, 110, 300.0, 60, 60)


def test_a_month_that_is_not_broken_down_is_one_row_with_the_reserved_value_and_the_total(written):
    rows = by_key(written.rows)
    assert {k: v for k, v in rows.items() if k[0] == 2} == {(2, NOT_BROKEN_DOWN): (7, 7, None, None, None)}


def test_the_manifest_figures_say_what_was_hidden(written):
    assert written.stats == {
        "minimum": 10, "minimum_hidden_cells": 2, "minimum_hidden_vehicles": 10, "months": 5,
        # month 1: a (9); month 4: a (2); month 5: a, b, c
        "cells_hidden_first_rule": 5,
        # month 1: b; month 4: b
        "cells_hidden_second_rule": 2,
        "vehicles_in_hidden_cells": 9 + 10 + 2 + 50 + 4 + 5 + 6,
        "months_not_broken_down": 1,
        "vehicles_in_months_not_broken_down": 7,
    }


def test_the_written_slice_passes_its_own_read_back_check(written):
    assert check_slice(written.con, written.path, RULE, written.stats) == []


def test_the_working_tables_are_dropped(written):
    tables = {r[0] for r in written.con.execute("SHOW TABLES").fetchall()}
    assert tables == {"dims"}


# --- the read-back check fails when the rule is bypassed --------------------------------------------------------------


def values(path, rows) -> None:
    """A slice file from (month number, value, n, denominator, fc_sum, fc_n, fc_eligible_n) written as given."""
    con = duckdb.connect()
    con.execute("CREATE TABLE t (month DATE, dim_value VARCHAR, n INTEGER, denominator INTEGER, fc_sum DOUBLE, fc_n INTEGER, fc_eligible_n INTEGER)")
    con.executemany("INSERT INTO t VALUES (?, ?, ?, ?, ?, ?, ?)", [(month(m), *rest) for m, *rest in rows])
    con.execute(f"COPY (SELECT * FROM t ORDER BY month, dim_value) TO '{path.as_posix()}' (FORMAT PARQUET)")
    con.close()


GOOD = [
    (1, "a", None, 219, None, None, None),
    (1, "b", None, 219, None, None, None),
    (1, "c", 200, 219, 1000.0, 200, 200),
    (2, NOT_BROKEN_DOWN, 7, 7, None, None, None),
    (3, "a", 50, 110, 250.0, 50, 50),
    (3, "b", 60, 110, 300.0, 60, 60),
]


def broken(tmp_path, rows) -> list[str]:
    path = tmp_path / "x.parquet"
    values(path, rows)
    return check_slice(duckdb.connect(), path, RULE)


def test_the_check_accepts_a_slice_that_keeps_the_rule(tmp_path):
    assert broken(tmp_path, GOOD) == []


def test_the_check_names_a_visible_count_under_the_minimum(tmp_path):
    rows = [(1, "a", 9, 219, 45.0, 9, 9), (1, "b", None, 219, None, None, None), (1, "c", 200, 219, 1000.0, 200, 200),
            (1, "d", None, 219, None, None, None)]
    problems = broken(tmp_path, rows)
    assert any("a visible count is under the minimum of 10" in p and "2024-01" in p for p in problems), problems


def test_the_check_names_a_month_with_one_hidden_cell(tmp_path):
    rows = [(1, "a", None, 219, None, None, None), (1, "c", 209, 219, 1000.0, 200, 200)]
    problems = broken(tmp_path, rows)
    assert any("fewer than 2 cells are hidden" in p for p in problems), problems


def test_the_check_names_hidden_cells_that_count_under_the_minimum_together(tmp_path):
    rows = [(1, "a", None, 60, None, None, None), (1, "b", None, 60, None, None, None), (1, "c", 51, 60, 255.0, 51, 51)]
    problems = broken(tmp_path, rows)
    assert any("the hidden cells together count fewer than 10" in p for p in problems), problems


def test_the_check_names_a_month_that_was_neither_hidden_nor_added_up(tmp_path):
    rows = [(1, "a", 50, 110, 250.0, 50, 50), (1, "b", 50, 110, 250.0, 50, 50)]
    problems = broken(tmp_path, rows)
    assert any("do not add up to the month's denominator" in p for p in problems), problems


@pytest.mark.parametrize("reserved", [
    [(2, NOT_BROKEN_DOWN, 6, 7, None, None, None)],
    [(2, NOT_BROKEN_DOWN, None, 7, None, None, None)],
    [(2, NOT_BROKEN_DOWN, 7, 7, None, None, None), (2, "a", 7, 7, 35.0, 7, 7)],
    [(2, NOT_BROKEN_DOWN, 4, 7, None, None, None), (2, NOT_BROKEN_DOWN, 3, 7, None, None, None)],
])
def test_the_check_names_a_reserved_row_that_is_not_alone_or_not_the_total(tmp_path, reserved):
    problems = broken(tmp_path, reserved)
    assert any("a reserved row is not alone in its month or does not carry the month's total" in p for p in problems), problems


@pytest.mark.parametrize("row", [
    (1, "a", None, 219, 5.0, None, None),
    (1, "a", None, 219, None, 3, None),
    (1, "a", None, 219, None, None, 3),
])
def test_the_check_names_a_fuel_figure_on_a_hidden_row(tmp_path, row):
    rows = [row, (1, "b", None, 219, None, None, None), (1, "c", 200, 219, 1000.0, 200, 200)]
    problems = broken(tmp_path, rows)
    assert any("carries a fuel figure" in p for p in problems), problems


def test_the_check_names_a_denominator_that_changes_within_a_month(tmp_path):
    rows = [(3, "a", 50, 110, 250.0, 50, 50), (3, "b", 60, 111, 300.0, 60, 60)]
    assert any("denominator is not the same" in p for p in broken(tmp_path, rows))


def test_the_check_compares_the_file_with_what_the_writer_meant_to_write(written):
    wrong = dict(written.stats, cells_hidden_first_rule=written.stats["cells_hidden_first_rule"] + 1)
    problems = check_slice(written.con, written.path, RULE, wrong)
    assert any("were written" in p for p in problems), problems


def test_an_unprotected_slice_of_the_same_counts_fails_the_check(written, tmp_path):
    """The rule bypassed: the counts as `write_slice` writes them have small cells showing, and the check says so."""
    path = tmp_path / "unprotected.parquet"
    outputs.write_slice(written.con, written.cfg, written.derived, "ds", path)
    problems = check_slice(written.con, path, RULE)
    assert any("a visible count is under the minimum" in p for p in problems), problems


def test_many_offending_months_are_counted_in_full_and_named_in_part(tmp_path):
    rows = [(m, "a", 3, 200, 15.0, 3, 3) for m in range(1, 13)] + [(m, "b", 197, 200, 985.0, 197, 197) for m in range(1, 13)]
    problems = broken(tmp_path, rows)
    assert any("12 months, first 2024-01, 2024-02, 2024-03, 2024-04, 2024-05" in p for p in problems), problems
    assert small_cells.EXAMPLES == 5
