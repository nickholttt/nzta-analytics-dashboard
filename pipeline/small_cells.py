"""The small-cell rule for a slice of an owner dimension (D-096, D-120, D-127).

A cell is one value of the dimension in one month. The first rule hides a cell under `minimum` vehicles. The second rule
limits what a total gives away of a hidden cell: in a month with any hidden cell, the smallest visible cells are hidden too
until at least `hidden_cells` cells are hidden and together they count at least `hidden_vehicles` (and more than the
number of cells, which would be one vehicle in each). A month in which no cell would stay visible has no per-value row at
all, only one row with the reserved value that carries the month's total: with every cell hidden, a count of hidden
cells as large as the vehicles they hold would give every cell away.

`decide_month` is the rule on its own. `write_protected_slice` applies it to a dimension's counts and writes the slice.
`check_slice` reads a written file back and says what breaks the rule, so a slice that should be protected and is not
fails the build instead of reaching `public/data` (design invariant 5).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from . import outputs
from .contract import NOT_BROKEN_DOWN
from .normalise import lit
from .privacy import SmallCellRule

# How many offending months a message names; the count is always given in full.
EXAMPLES = 5


@dataclass(frozen=True)
class Hidden:
    """The cells of one month that are hidden: by the first rule, and by the second."""

    first: tuple[str, ...]
    second: tuple[str, ...]


def decide_month(cells: list[tuple[str, int]], rule: SmallCellRule) -> Hidden | None:
    """The cells to hide in one month, given (value, n) for every cell, or None when the month cannot be broken down.

    Cells under the minimum are hidden. If there are any, the smallest visible cells are hidden one at a time, the value
    that sorts first breaking a tie, until the hidden cells are at least `hidden_cells`, count at least `hidden_vehicles`
    together, and hold more vehicles than there are of them (else each is exactly one). If that leaves no cell visible,
    the month is not broken down: nothing in it would have been shown, and which values had vehicles is not shown either.
    """
    first = sorted(value for value, n in cells if n < rule.minimum)
    if not first:
        return Hidden((), ())
    counted = dict(cells)
    hidden_vehicles = sum(counted[v] for v in first)
    visible = sorted((n, value) for value, n in cells if n >= rule.minimum)
    second: list[str] = []
    while (len(first) + len(second) < rule.hidden_cells or hidden_vehicles < rule.hidden_vehicles
           or hidden_vehicles <= len(first) + len(second)):
        if len(second) == len(visible):
            return None
        n, value = visible[len(second)]
        second.append(value)
        hidden_vehicles += n
    if len(second) == len(visible):
        return None
    return Hidden(tuple(first), tuple(second))


def write_protected_slice(con, cfg, derived, ds: str, path: Path, rule: SmallCellRule, fuel: bool = True) -> dict:
    """The dimension's 1-D slice with the rule applied, written to `path`; returns what was hidden, for the manifest.

    A hidden cell keeps its row, with `n` and the three fuel columns null (they bound `n`) and the month's
    `denominator`, which every slice publishes. A month that is not broken down is one row with the reserved value,
    `n` and `denominator` both the month's total, and null fuel columns. `fuel` False nulls them on every row, as a slice that
    a protected pair stands on is written (pair_cells.py): its fuel-eligible counts would bound the pair's hidden cells."""
    path.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"CREATE OR REPLACE TEMP TABLE cells_raw AS {outputs.counts_sql(cfg, [(derived.column, 'dim_value')], ds)}")
    by_month: dict = {}
    for month, value, n in con.execute("SELECT month, dim_value, n FROM cells_raw ORDER BY month, dim_value").fetchall():
        by_month.setdefault(month, []).append((value, n))

    hidden_cells, not_broken_down = [], []
    stats = {
        "minimum": rule.minimum,
        "minimum_hidden_cells": rule.hidden_cells,
        "minimum_hidden_vehicles": rule.hidden_vehicles,
        "months": len(by_month),
        "cells_hidden_first_rule": 0,
        "cells_hidden_second_rule": 0,
        "vehicles_in_hidden_cells": 0,
        "months_not_broken_down": 0,
        "vehicles_in_months_not_broken_down": 0,
    }
    for month, cells in by_month.items():
        decision = decide_month(cells, rule)
        if decision is None:
            not_broken_down.append((month,))
            stats["months_not_broken_down"] += 1
            stats["vehicles_in_months_not_broken_down"] += sum(n for _, n in cells)
            continue
        counted = dict(cells)
        for value in decision.first + decision.second:
            hidden_cells.append((month, value))
            stats["vehicles_in_hidden_cells"] += counted[value]
        stats["cells_hidden_first_rule"] += len(decision.first)
        stats["cells_hidden_second_rule"] += len(decision.second)

    con.execute("CREATE OR REPLACE TEMP TABLE cells_hidden (month DATE, dim_value VARCHAR)")
    con.execute("CREATE OR REPLACE TEMP TABLE cells_unbroken (month DATE)")
    if hidden_cells:
        con.executemany("INSERT INTO cells_hidden VALUES (?, ?)", hidden_cells)
    if not_broken_down:
        con.executemany("INSERT INTO cells_unbroken VALUES (?)", not_broken_down)
    keep = "TRUE" if fuel else "FALSE"
    con.execute(f"""
        COPY (
            SELECT * FROM (
                SELECT r.month AS month, r.dim_value AS dim_value,
                       CASE WHEN h.month IS NULL THEN r.n END AS n,
                       r.denominator AS denominator,
                       CASE WHEN h.month IS NULL AND {keep} THEN r.fc_sum END AS fc_sum,
                       CASE WHEN h.month IS NULL AND {keep} THEN r.fc_n END AS fc_n,
                       CASE WHEN h.month IS NULL AND {keep} THEN r.fc_eligible_n END AS fc_eligible_n
                FROM cells_raw r LEFT JOIN cells_hidden h ON r.month = h.month AND r.dim_value = h.dim_value
                WHERE r.month NOT IN (SELECT month FROM cells_unbroken)
                UNION ALL
                SELECT month, {lit(NOT_BROKEN_DOWN)}, CAST(any_value(denominator) AS INTEGER), any_value(denominator),
                       CAST(NULL AS DOUBLE), CAST(NULL AS INTEGER), CAST(NULL AS INTEGER)
                FROM cells_raw WHERE month IN (SELECT month FROM cells_unbroken) GROUP BY month
            ) ORDER BY month, dim_value
        ) TO {lit(path.as_posix())} (FORMAT PARQUET, COMPRESSION ZSTD)
    """)
    for table in ("cells_raw", "cells_hidden", "cells_unbroken"):
        con.execute(f"DROP TABLE {table}")
    return stats


def _examples(months: list) -> str:
    named = ", ".join(m.strftime("%Y-%m") for m in months[:EXAMPLES])
    return f"{len(months):,} months, first {named}" if len(months) > EXAMPLES else f"{len(months):,} months: {named}"


def check_slice(con, path: Path, rule: SmallCellRule, expected: dict | None = None) -> list[str]:
    """What the written file breaks, read back from the file itself. Empty when it keeps the rule in every month:

    - no visible count is under the minimum;
    - a month with no hidden cell and no reserved row has its visible counts add up to its denominator;
    - a month with hidden cells has at least `hidden_cells` of them, and its denominator minus its visible counts, which
      is what they hold together, is at least `hidden_vehicles` and more than the number of them (else each holds exactly
      one vehicle); and it has at least one visible cell (else it should be one reserved row);
    - a hidden row carries no fuel figure;
    - a month with a reserved row has that row alone, and its `n` is the month's denominator.

    `expected` (the writer's own figures) adds a comparison of the file's months and hidden rows with what the writer
    meant to write."""
    reserved = lit(NOT_BROKEN_DOWN)
    rows = con.execute(f"""
        SELECT month,
               count(*) FILTER (WHERE dim_value = {reserved}) AS reserved_rows,
               count(*) FILTER (WHERE dim_value IS DISTINCT FROM {reserved} AND n IS NULL) AS hidden_rows,
               count(*) FILTER (WHERE dim_value IS DISTINCT FROM {reserved} AND n IS NOT NULL) AS visible_rows,
               count(*) AS all_rows,
               count(*) FILTER (WHERE dim_value IS DISTINCT FROM {reserved} AND n < {int(rule.minimum)}) AS small_visible,
               coalesce(sum(n) FILTER (WHERE dim_value IS DISTINCT FROM {reserved}), 0) AS visible_sum,
               min(denominator) AS low_denominator, max(denominator) AS high_denominator,
               max(n) FILTER (WHERE dim_value = {reserved}) AS reserved_n,
               count(*) FILTER (WHERE (n IS NULL OR dim_value = {reserved})
                                AND (fc_sum IS NOT NULL OR fc_n IS NOT NULL OR fc_eligible_n IS NOT NULL)) AS fuel_on_hidden
        FROM read_parquet({lit(path.as_posix())}) GROUP BY month ORDER BY month
    """).fetchall()
    found: dict[str, list] = {}

    def flag(problem: str, month) -> None:
        found.setdefault(problem, []).append(month)

    for (month, reserved_rows, hidden_rows, visible_rows, all_rows, small_visible, visible_sum, low, high, reserved_n, fuel) in rows:
        if low != high:
            flag("the month's denominator is not the same on every row", month)
        if small_visible:
            flag(f"a visible count is under the minimum of {rule.minimum}", month)
        if fuel:
            flag("a hidden or reserved row carries a fuel figure", month)
        if reserved_rows:
            if not (reserved_rows == 1 and all_rows == 1 and reserved_n == high):
                flag("a reserved row is not alone in its month or does not carry the month's total", month)
        elif hidden_rows:
            if hidden_rows < rule.hidden_cells:
                flag(f"fewer than {rule.hidden_cells} cells are hidden", month)
            elif high - visible_sum < rule.hidden_vehicles:
                flag(f"the hidden cells together count fewer than {rule.hidden_vehicles}", month)
            if not visible_rows:
                flag("a month has hidden cells and no visible cell (it should be one reserved row)", month)
            if hidden_rows >= high - visible_sum:
                flag("the hidden cells hold no more vehicles than there are of them, so each is exactly one", month)
        elif visible_sum != high:
            flag("the visible counts do not add up to the month's denominator", month)
    problems = [f"{problem} in {_examples(months)}" for problem, months in found.items()]
    if expected is not None:
        hidden = sum(r[2] for r in rows)
        reserved_total = sum(r[1] for r in rows)
        wanted = (expected["months"], expected["cells_hidden_first_rule"] + expected["cells_hidden_second_rule"],
                  expected["months_not_broken_down"])
        if (len(rows), hidden, reserved_total) != wanted:
            problems.append(f"the file holds {len(rows):,} months, {hidden:,} hidden cells and {reserved_total:,} months not "
                            f"broken down, but {wanted[0]:,}, {wanted[1]:,} and {wanted[2]:,} were written")
    return problems
