"""The small-cell rule for a table of two fields, one of them an owner field (D-135).

A table of two fields is a grid: one value of the first field down the side (a row), one value of the second across the top
(a column), and the count in each cell. A *line* is a row or a column. Both one-field tables are published, so each line's
total is public (a value hidden in its one-field slice has no public total). The rule has to protect a cell against both
margins at once, which the rule for one field (small_cells.py) does not do.

In each period:

1. A cell under `minimum` vehicles is hidden.
2. A cell on a line whose value is hidden in that field's one-field slice is hidden too: the line's total is not public, and
   nothing may stand in for it.
3. Then, until nothing changes: every other line that holds a hidden cell must hold at least `hidden_cells` of them, and
   they must together count at least `hidden_vehicles` and more vehicles than there are of them (else each is exactly one).
   Where a line does not, its smallest visible cell is hidden, preferring a cell whose other line already holds a hidden
   cell (that closes a rectangle and hides least), then the smaller count, then the cell that sorts first (value order,
   first field first).
4. A period in which a line cannot meet that rule, or in which a line with hidden cells would keep no visible cell, or in
   which the totals would still pin a hidden cell to one value (`bounds`), is not broken down: one row, the reserved value in
   both value columns, carrying the period's total. So is a period in which either one-field slice is not broken down.

`decide_period` is the rule on its own. `write_protected_pair` applies it and writes the pair. `check_pair` reads a written
file back and says what breaks the rule, so a pair that should be protected and is not fails the build instead of reaching
`public/data` (design invariant 5). `bounds` is the audit both use: for every hidden cell, the smallest and largest value that
every line total and every visible cell leave it.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path

from . import outputs
from .contract import NOT_BROKEN_DOWN
from .errors import GuardrailError
from .normalise import lit
from .privacy import SmallCellRule

EXAMPLES = 5

Cell = tuple[str, str]


@dataclass(frozen=True)
class Hidden:
    """The cells of one period that are hidden, by the rule that hid them, and the audit's narrowest range for them."""

    first: tuple[Cell, ...]
    by_slice: tuple[Cell, ...]
    by_line: tuple[Cell, ...]
    narrowest: int | None

    @property
    def all(self) -> tuple[Cell, ...]:
        return self.first + self.by_slice + self.by_line


@dataclass(frozen=True)
class SliceMonth:
    """One period of a one-field slice as published: the visible values with their counts, the hidden values, whether the
    period is not broken down, and the period's total."""

    visible: dict[str, int]
    hidden: frozenset[str]
    reserved: bool
    denominator: int


# --- the audit: what the totals leave of a hidden cell -----------------------------------------------------------------


def _max_flow(capacity: dict, source, sink) -> tuple[int, dict]:
    """Edmonds-Karp on a dict of dicts of capacities; returns the flow value and the flow on each edge."""
    residual = {u: dict(edges) for u, edges in capacity.items()}
    for u, edges in capacity.items():
        for v in edges:
            residual.setdefault(v, {}).setdefault(u, 0)
    flow_value = 0
    while True:
        parent = {source: None}
        queue = deque([source])
        while queue and sink not in parent:
            u = queue.popleft()
            for v, room in residual[u].items():
                if room > 0 and v not in parent:
                    parent[v] = u
                    queue.append(v)
        if sink not in parent:
            break
        path, v = [], sink
        while parent[v] is not None:
            path.append((parent[v], v))
            v = parent[v]
        push = min(residual[u][v] for u, v in path)
        for u, v in path:
            residual[u][v] -= push
            residual[v][u] += push
        flow_value += push
    flows = {(u, v): capacity[u][v] - residual[u][v] for u in capacity for v in capacity[u]}
    return flow_value, flows


def bounds(cells: dict[Cell, int | None], row_totals: dict[str, int | None], col_totals: dict[str, int | None],
           total: int) -> dict[Cell, tuple[int, int]] | None:
    """For every hidden cell (a key with a null count), the smallest and largest value consistent with every known line
    total, the period's total and every visible cell, each hidden cell holding at least one vehicle. None when no values
    are consistent at all.

    `row_totals` and `col_totals` give a value's line total, or None where the value is hidden in its one-field slice. The
    unknown lines of a field share one known sum: the period's total less the known lines, so that sum is used.

    The hidden cells and the lines form a transportation problem, whose integer solutions are the flows through a small
    network. A hidden cell's range is an interval of integers (the constraint matrix is totally unimodular), so its ends are
    found by testing whether a given value is possible, by max-flow, and searching the interval from one value that is."""
    hidden = sorted(c for c, n in cells.items() if n is None)
    if not hidden:
        return {}
    rows = sorted({a for a, _ in cells})
    cols = sorted({b for _, b in cells})
    visible_row = {a: sum(n for (x, _), n in cells.items() if x == a and n is not None) for a in rows}
    visible_col = {b: sum(n for (_, y), n in cells.items() if y == b and n is not None) for b in cols}
    hidden_row = {a: sum(1 for (x, _) in hidden if x == a) for a in rows}
    hidden_col = {b: sum(1 for (_, y) in hidden if y == b) for b in cols}

    def side(lines, totals, visible, count):
        """What each known line still has to give to its hidden cells beyond the one vehicle each holds at least, and what
        the unknown lines of the field give together."""
        known = {v: totals[v] - visible[v] - count[v] for v in lines if totals.get(v) is not None}
        unknown = [v for v in lines if totals.get(v) is None]
        pool = total - sum(totals[v] for v in lines if totals.get(v) is not None) - sum(visible[v] + count[v] for v in unknown)
        return known, unknown, pool

    supply, unknown_rows, pool_rows = side(rows, row_totals, visible_row, hidden_row)
    demand, unknown_cols, pool_cols = side(cols, col_totals, visible_col, hidden_col)
    if (any(v < 0 for v in supply.values()) or any(v < 0 for v in demand.values()) or pool_rows < 0 or pool_cols < 0
            or sum(supply.values()) + pool_rows != sum(demand.values()) + pool_cols
            or (not unknown_rows and pool_rows) or (not unknown_cols and pool_cols)):
        return None
    infinite = sum(supply.values()) + pool_rows + 1

    def network(forced: Cell | None, value: int):
        """The capacities with `forced` removed and `value` vehicles above its one taken from its two lines."""
        give, take = dict(supply), dict(demand)
        pool_give, pool_take = pool_rows, pool_cols
        if forced is not None:
            a, b = forced
            if a in give:
                give[a] -= value
            else:
                pool_give -= value
            if b in take:
                take[b] -= value
            else:
                pool_take -= value
            if min(give.values(), default=0) < 0 or min(take.values(), default=0) < 0 or pool_give < 0 or pool_take < 0:
                return None, 0
        capacity: dict = {"source": {}, "sink": {}}
        for a, room in give.items():
            capacity["source"][("row", a)] = room
        if unknown_rows:
            capacity["source"]["pool_rows"] = pool_give
            capacity["pool_rows"] = {("row", a): infinite for a in unknown_rows}
        for b, room in take.items():
            capacity.setdefault(("col", b), {})["sink"] = room
        if unknown_cols:
            capacity["pool_cols"] = {"sink": pool_take}
            for b in unknown_cols:
                capacity.setdefault(("col", b), {})["pool_cols"] = infinite
        for a, b in hidden:
            if (a, b) != forced:
                capacity.setdefault(("row", a), {})[("col", b)] = infinite
        return capacity, sum(give.values()) + pool_give

    def possible(forced: Cell, value: int) -> bool:
        capacity, wanted = network(forced, value)
        return capacity is not None and _max_flow(capacity, "source", "sink")[0] == wanted

    capacity, wanted = network(None, 0)
    reached, flows = _max_flow(capacity, "source", "sink")
    if reached != wanted:
        return None
    found: dict[Cell, tuple[int, int]] = {}
    for a, b in hidden:
        cell = (a, b)
        seed = flows[(("row", a), ("col", b))]
        low, high = 0, seed
        while low < high:
            middle = (low + high) // 2
            if possible(cell, middle):
                high = middle
            else:
                low = middle + 1
        smallest = low
        low, high = seed, min(supply.get(a, pool_rows), demand.get(b, pool_cols))
        while low < high:
            middle = (low + high + 1) // 2
            if possible(cell, middle):
                low = middle
            else:
                high = middle - 1
        found[cell] = (smallest + 1, low + 1)
    return found


def narrowest(ranges: dict[Cell, tuple[int, int]]) -> int | None:
    """The smallest spread (largest less smallest) among the ranges: 0 means a cell is pinned to one value."""
    return min((hi - lo for lo, hi in ranges.values()), default=None)


# --- the rule ---------------------------------------------------------------------------------------------------------


def _lines(cells: dict[Cell, int]) -> list[tuple[str, str, list[Cell]]]:
    """Every line as (kind, value, its cells in order): rows first, then columns, each in value order."""
    out = []
    for kind, index in (("row", 0), ("col", 1)):
        by_value: dict[str, list[Cell]] = {}
        for cell in sorted(cells):
            by_value.setdefault(cell[index], []).append(cell)
        out += [(kind, value, members) for value, members in sorted(by_value.items())]
    return out


def decide_period(cells: dict[Cell, int], rule: SmallCellRule, row_totals: dict[str, int | None],
                  col_totals: dict[str, int | None], total: int) -> Hidden | None:
    """The cells to hide in one period, given (first value, second value) -> count for every cell with a vehicle, each
    value's line total (None where the value is hidden in its one-field slice) and the period's total; or None when the
    period cannot be broken down. See the module doc for the rule."""
    first = sorted(c for c, n in cells.items() if n < rule.minimum)
    forced_rows = {a for a, t in row_totals.items() if t is None}
    forced_cols = {b for b, t in col_totals.items() if t is None}
    by_slice = sorted(c for c in cells if c not in set(first) and (c[0] in forced_rows or c[1] in forced_cols))
    hidden = set(first) | set(by_slice)
    if not hidden:
        return Hidden((), (), (), None)
    by_line: list[Cell] = []
    lines = _lines(cells)
    exempt = {("row", a) for a in forced_rows} | {("col", b) for b in forced_cols}

    def held(kind: str, value: str) -> list[Cell]:
        return next(members for k, v, members in lines if (k, v) == (kind, value))

    while True:
        violated = None
        for kind, value, members in lines:
            if (kind, value) in exempt:
                continue
            hid = [c for c in members if c in hidden]
            if hid and (len(hid) < rule.hidden_cells or sum(cells[c] for c in hid) < rule.hidden_vehicles
                        or sum(cells[c] for c in hid) <= len(hid)):
                violated = (kind, value, members)
                break
        if violated is None:
            break
        kind, value, members = violated
        other = 1 if kind == "row" else 0

        def rank(cell: Cell):
            across = held("col" if kind == "row" else "row", cell[other])
            closes = any(c in hidden for c in across)
            return (0 if closes else 1, cells[cell], cell)

        candidates = [c for c in members if c not in hidden]
        if not candidates:
            return None
        chosen = min(candidates, key=rank)
        hidden.add(chosen)
        by_line.append(chosen)
    for kind, value, members in lines:
        if (kind, value) not in exempt and any(c in hidden for c in members) and all(c in hidden for c in members):
            return None
    if len(hidden) == len(cells):
        return None
    audited = bounds({c: (None if c in hidden else n) for c, n in cells.items()}, row_totals, col_totals, total)
    if audited is None or narrowest(audited) == 0:
        return None
    return Hidden(tuple(first), tuple(by_slice), tuple(by_line), narrowest(audited))


# --- reading the one-field slices a pair stands on ---------------------------------------------------------------------


def read_slice(con, path: Path) -> dict:
    """A written one-field slice as the public sees it: for each period, a SliceMonth."""
    reserved = lit(NOT_BROKEN_DOWN)
    out: dict = {}
    for month, value, n, denominator in con.execute(
            f"SELECT month, dim_value, n, denominator FROM read_parquet({lit(path.as_posix())}) ORDER BY month, dim_value").fetchall():
        entry = out.setdefault(month, {"visible": {}, "hidden": set(), "reserved": False, "denominator": denominator})
        if value == NOT_BROKEN_DOWN:
            entry["reserved"] = True
        elif n is None:
            entry["hidden"].add(value)
        else:
            entry["visible"][value] = n
    return {m: SliceMonth(e["visible"], frozenset(e["hidden"]), e["reserved"], e["denominator"]) for m, e in out.items()}


def _line_totals(values: set[str], published: SliceMonth) -> dict[str, int | None]:
    return {v: published.visible.get(v) for v in values}


# --- writing ---------------------------------------------------------------------------------------------------------


def write_protected_pair(con, cfg, a, b, ds: str, path: Path, rule: SmallCellRule, slice_a: Path, slice_b: Path) -> dict:
    """The pair of two dimensions with the rule applied, written to `path`; returns what was hidden, for the manifest.

    `slice_a` and `slice_b` are the written one-field slices of the two dimensions: their hidden values and their line totals
    are what the public can read, and what the pair is held to.

    A hidden cell keeps its row, with `n` null and the period's `denominator`. The three fuel columns are null on every row of
    a protected pair, not only on a hidden one: the fuel-eligible count of a visible cell is a lower bound on the count of the
    cells in its line, and set beside the one-field slices' fuel counts it narrows what the totals leave a hidden cell (measured
    on the first real table, D-135). A period that is not broken down is one row with the reserved value in both value columns,
    `n` and `denominator` both the period's total."""
    path.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"CREATE OR REPLACE TEMP TABLE pair_raw AS {outputs.counts_sql(cfg, [(a.column, 'a_value'), (b.column, 'b_value')], ds)}")
    by_month: dict = {}
    for month, a_value, b_value, n in con.execute("SELECT month, a_value, b_value, n FROM pair_raw ORDER BY month, a_value, b_value").fetchall():
        by_month.setdefault(month, {})[(a_value, b_value)] = n
    first_slice, second_slice = read_slice(con, slice_a), read_slice(con, slice_b)
    absent = sorted(m for m in by_month if m not in first_slice or m not in second_slice)
    if absent:
        raise GuardrailError("pair", f"{path.name}: {len(absent):,} periods, first {absent[0].strftime('%Y-%m')}, are not in the written "
                                     f"one-field slices it stands on ({slice_a.name}, {slice_b.name})")

    hidden_cells, unbroken = [], []
    stats = {
        "minimum": rule.minimum,
        "minimum_hidden_cells": rule.hidden_cells,
        "minimum_hidden_vehicles": rule.hidden_vehicles,
        "months": len(by_month),
        "cells_hidden_first_rule": 0,
        "cells_hidden_by_slice": 0,
        "cells_hidden_second_rule": 0,
        "vehicles_in_hidden_cells": 0,
        "months_not_broken_down": 0,
        "vehicles_in_months_not_broken_down": 0,
        "narrowest_range": None,
    }
    for month, cells in by_month.items():
        sa, sb = first_slice[month], second_slice[month]
        total = sa.denominator
        decision = None
        if not (sa.reserved or sb.reserved):
            decision = decide_period(cells, rule, _line_totals({c[0] for c in cells}, sa), _line_totals({c[1] for c in cells}, sb), total)
        if decision is None:
            unbroken.append((month,))
            stats["months_not_broken_down"] += 1
            stats["vehicles_in_months_not_broken_down"] += sum(cells.values())
            continue
        for cell in decision.all:
            hidden_cells.append((month, *cell))
            stats["vehicles_in_hidden_cells"] += cells[cell]
        stats["cells_hidden_first_rule"] += len(decision.first)
        stats["cells_hidden_by_slice"] += len(decision.by_slice)
        stats["cells_hidden_second_rule"] += len(decision.by_line)
        if decision.narrowest is not None:
            stats["narrowest_range"] = decision.narrowest if stats["narrowest_range"] is None else min(stats["narrowest_range"], decision.narrowest)

    con.execute("CREATE OR REPLACE TEMP TABLE pair_hidden (month DATE, a_value VARCHAR, b_value VARCHAR)")
    con.execute("CREATE OR REPLACE TEMP TABLE pair_unbroken (month DATE)")
    if hidden_cells:
        con.executemany("INSERT INTO pair_hidden VALUES (?, ?, ?)", hidden_cells)
    if unbroken:
        con.executemany("INSERT INTO pair_unbroken VALUES (?)", unbroken)
    reserved = lit(NOT_BROKEN_DOWN)
    con.execute(f"""
        COPY (
            SELECT * FROM (
                SELECT r.month AS month, r.a_value AS a_value, r.b_value AS b_value,
                       CASE WHEN h.month IS NULL THEN r.n END AS n,
                       r.denominator AS denominator,
                       CAST(NULL AS DOUBLE) AS fc_sum, CAST(NULL AS INTEGER) AS fc_n, CAST(NULL AS INTEGER) AS fc_eligible_n
                FROM pair_raw r LEFT JOIN pair_hidden h ON r.month = h.month AND r.a_value = h.a_value AND r.b_value = h.b_value
                WHERE r.month NOT IN (SELECT month FROM pair_unbroken)
                UNION ALL
                SELECT month, {reserved}, {reserved}, CAST(any_value(denominator) AS INTEGER), any_value(denominator),
                       CAST(NULL AS DOUBLE), CAST(NULL AS INTEGER), CAST(NULL AS INTEGER)
                FROM pair_raw WHERE month IN (SELECT month FROM pair_unbroken) GROUP BY month
            ) ORDER BY month, a_value, b_value
        ) TO {lit(path.as_posix())} (FORMAT PARQUET, COMPRESSION ZSTD)
    """)
    for table in ("pair_raw", "pair_hidden", "pair_unbroken"):
        con.execute(f"DROP TABLE {table}")
    return stats


# --- reading back ------------------------------------------------------------------------------------------------------


def _examples(months: list) -> str:
    named = ", ".join(m.strftime("%Y-%m") for m in months[:EXAMPLES])
    return f"{len(months):,} months, first {named}" if len(months) > EXAMPLES else f"{len(months):,} months: {named}"


def check_pair(con, path: Path, rule: SmallCellRule, slice_a: Path, slice_b: Path, expected: dict | None = None) -> list[str]:
    """What the written file breaks, read back from the file itself against the written one-field slices. Empty when it
    keeps the rule in every period:

    - no visible count is under the minimum;
    - a period that either one-field slice does not break down is one reserved row, and so is any period that has one: alone,
      the reserved value in both value columns, `n` the period's total, no fuel figure;
    - every value in the file is a value of its one-field slice, and a value hidden there has every cell hidden here;
    - the period's total is the same on every row and is the slice's;
    - a line whose value is visible in its slice and holds no hidden cell has visible counts that add up to the slice's count;
    - a line holding a hidden cell holds at least `hidden_cells` of them, which together count (the slice's count less the
      line's visible cells) at least `hidden_vehicles` and more than there are of them, and keeps a visible cell;
    - no hidden cell is pinned to one value by the totals (`bounds`), and the totals are consistent;
    - no row carries a fuel figure.

    `expected` (the writer's own figures) adds a comparison of the file's months, hidden rows and reserved rows with what the
    writer meant to write."""
    reserved = NOT_BROKEN_DOWN
    first_slice, second_slice = read_slice(con, slice_a), read_slice(con, slice_b)
    by_month: dict = {}
    for month, a_value, b_value, n, denominator, fc_sum, fc_n, fc_eligible_n in con.execute(
            f"SELECT month, a_value, b_value, n, denominator, fc_sum, fc_n, fc_eligible_n FROM read_parquet({lit(path.as_posix())}) "
            f"ORDER BY month, a_value, b_value").fetchall():
        by_month.setdefault(month, []).append((a_value, b_value, n, denominator, fc_sum is not None or fc_n is not None or fc_eligible_n is not None))
    found: dict[str, list] = {}

    def flag(problem: str, month) -> None:
        found.setdefault(problem, []).append(month)

    hidden_total = reserved_total = 0
    for month, rows in by_month.items():
        sa, sb = first_slice.get(month), second_slice.get(month)
        if sa is None or sb is None:
            flag("a period is not in both one-field slices", month)
            continue
        if len({r[3] for r in rows}) != 1:
            flag("the period's total is not the same on every row", month)
        total = rows[0][3]
        if total != sa.denominator or total != sb.denominator:
            flag("the period's total is not the one-field slices' total", month)
        reserved_rows = [r for r in rows if reserved in (r[0], r[1])]
        if reserved_rows or sa.reserved or sb.reserved:
            only = len(rows) == 1 and rows[0][0] == reserved and rows[0][1] == reserved
            if not (only and rows[0][2] == total and not rows[0][4]):
                flag("a period that is not broken down is not one reserved row carrying the period's total", month)
            reserved_total += 1
            continue
        if any(r[2] is not None and r[2] < rule.minimum for r in rows):
            flag(f"a visible count is under the minimum of {rule.minimum}", month)
        if any(r[4] for r in rows):
            flag("a row of a protected pair carries a fuel figure", month)
        hidden_total += sum(1 for r in rows if r[2] is None)
        cells = {(r[0], r[1]): r[2] for r in rows}
        if len(cells) != len(rows):
            flag("a cell is listed twice", month)
        row_totals = {v: sa.visible.get(v) for v in {r[0] for r in rows}}
        col_totals = {v: sb.visible.get(v) for v in {r[1] for r in rows}}
        stray = [v for v in row_totals if v not in sa.visible and v not in sa.hidden] + [
            v for v in col_totals if v not in sb.visible and v not in sb.hidden]
        if stray:
            flag("a value is not in its one-field slice", month)
            continue
        consistent = True
        for kind, index, totals in (("row", 0, row_totals), ("col", 1, col_totals)):
            for value, line_total in totals.items():
                line = [(c, n) for c, n in cells.items() if c[index] == value]
                hid = [n for _, n in line if n is None]
                shown = sum(n for _, n in line if n is not None)
                if line_total is None:
                    if len(hid) != len(line):
                        flag("a value hidden in its one-field slice has a visible cell", month)
                elif not hid:
                    if shown != line_total:
                        flag("a line's visible counts do not add up to its one-field slice's count", month)
                        consistent = False
                else:
                    held = line_total - shown
                    if len(hid) < rule.hidden_cells:
                        flag(f"a line holds fewer than {rule.hidden_cells} hidden cells", month)
                    elif held < rule.hidden_vehicles:
                        flag(f"a line's hidden cells together count fewer than {rule.hidden_vehicles}", month)
                    if held <= len(hid):
                        flag("a line's hidden cells hold no more vehicles than there are of them, so each is exactly one", month)
                    if len(hid) == len(line):
                        flag("a line has hidden cells and no visible cell", month)
        if consistent and any(n is None for n in cells.values()):
            audited = bounds(cells, row_totals, col_totals, total)
            if audited is None:
                flag("the line totals leave no values for the hidden cells", month)
            elif narrowest(audited) == 0:
                flag("the totals pin a hidden cell to one value", month)
    problems = [f"{problem} in {_examples(months)}" for problem, months in found.items()]
    if expected is not None:
        wanted = (expected["months"], expected["cells_hidden_first_rule"] + expected["cells_hidden_by_slice"] + expected["cells_hidden_second_rule"],
                  expected["months_not_broken_down"])
        if (len(by_month), hidden_total, reserved_total) != wanted:
            problems.append(f"the file holds {len(by_month):,} months, {hidden_total:,} hidden cells and {reserved_total:,} months not "
                            f"broken down, but {wanted[0]:,}, {wanted[1]:,} and {wanted[2]:,} were written")
    return problems
