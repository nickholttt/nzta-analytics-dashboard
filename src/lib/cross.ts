// Two dimensions crossed: each value of one with each value of the other, as the rows of a 1-D slice. Pure, with no
// imports, so tests/site/ runs it with Node's own test runner. data.ts reads the cube and hands the rows here.

// What joins the two values of a crossed row. A plain string of words, so a chart can show it as it is.
export const CROSS_SEPARATOR = " · ";

// The value of a crossed row: the breakdown's value, then the other dimension's. Every crossed view builds it here, so a
// numerator from a pair slice and a denominator from the fact table name a combination alike and can be divided.
export const crossValue = (value: string, other: string) => `${value}${CROSS_SEPARATOR}${other}`;

type PairRow = { month: string; a: string; b: string; n: number };
type CrossedRow = { month: string; value: string; n: number; denominator: number };

// A pair slice with every value of both dimensions kept. side says which of the pair's two dimensions is the view's
// breakdown, which comes first in the value. The pair's own denominator is the whole dataset's month, so a crossed month's
// denominator is the sum of its cells: the same whole where nothing is narrowed, and a share of what is kept where it is.
export function crossPair(rows: readonly PairRow[], side: "a" | "b"): CrossedRow[] {
  const cells = new Map<string, CrossedRow>();
  const totals = new Map<string, number>();
  for (const r of rows) {
    const [value, other] = side === "a" ? [r.a, r.b] : [r.b, r.a];
    const crossed = crossValue(value, other);
    const key = `${r.month}|${crossed}`;
    const cell = cells.get(key) ?? { month: r.month, value: crossed, n: 0, denominator: 0 };
    cell.n += r.n;
    cells.set(key, cell);
    totals.set(r.month, (totals.get(r.month) ?? 0) + r.n);
  }
  return [...cells.values()]
    .map((c) => ({ ...c, denominator: totals.get(c.month) as number }))
    .sort((x, y) => x.month.localeCompare(y.month) || x.value.localeCompare(y.value));
}
