// The grid of a table written under the small-cell rule (src/lib/matrix.ts, hiddenGridOf; D-139): a hidden cell has no count and is neither zero nor blank
// (it is the word, with a reason, and blank in the file); the row and column totals are the published ones, not the sums of the cells; every value stands on the
// grid and none is folded into a rest line; a share of a hidden cell is hidden; a leader is named only where no hidden cell could match it.
// Synthetic cells with made-up values that add up as the fixture tests/site/fixtures/protected-cube does. Nothing here is a figure of the register.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { gridOf, gridTable, hiddenGridOf, tableFigures } = await import("../../src/lib/matrix.ts");
const { figuresCsv } = await import("../../src/lib/figures.ts");
const { matrixSentences } = await import("../../src/lib/sentences.ts");
const { phrases } = await import("../../src/lib/config.ts");
const { pct } = await import("../../src/lib/measures.ts");

const M = "2026-10";
type Cell = { value: string; other: string; n: number | undefined; row: number | null; column: number | null };
// alpha 600, beta 300, gamma and delta hidden in their own table (their totals are hidden), x 710, y 210, 920 in all.
const cell = ({ value, other, n, row, column }: Cell) => ({ month: M, value, other, n: n ?? Number.NaN, denominator: 920, totals: { row, column }, ...(n === undefined ? { hidden: true } : {}) });
const cells = [
  cell({ value: "alpha", other: "x", n: 500, row: 600, column: 710 }),
  cell({ value: "alpha", other: "y", n: 100, row: 600, column: 210 }),
  cell({ value: "beta", other: "x", n: 200, row: 300, column: 710 }),
  cell({ value: "beta", other: "y", n: 100, row: 300, column: 210 }),
  cell({ value: "gamma", other: "x", n: undefined, row: null, column: 710 }),
  cell({ value: "gamma", other: "y", n: undefined, row: null, column: 210 }),
  cell({ value: "delta", other: "x", n: undefined, row: null, column: 710 }),
  cell({ value: "delta", other: "y", n: undefined, row: null, column: 210 }),
];
const side = (nameOf = (v: string) => v) => ({ limit: 10, nameOf });
const input = (rows = cells, basis: "count" | "all" | "row" | "column" = "count") => ({
  rows, from: M, to: M, rowSide: side(), columnSide: side(), basis, floor: 200, stepFractions: [0.02, 0.06, 0.15, 0.35, 0.65, 1],
});
const words = {
  rowHead: "Field", totalCount: "All", totalShare: "Vehicles", format: { count: (n: number) => n.toLocaleString("en-NZ"), pct }, thin: "thin",
  noBase: { row: "no row", column: "no column" },
  hidden: { text: "hidden", reason: "Counts under 10 are not shown.", noShare: { row: "row total hidden", column: "column total hidden" } },
};

test("every value stands on the grid, ranked by its published total, a value whose total is hidden after them; nothing is folded into a rest line", () => {
  const g = hiddenGridOf(input());
  assert.deepEqual(g.rows.lines.map((l) => l.key), ["alpha", "beta", "delta", "gamma"]);
  assert.deepEqual(g.columns.lines.map((l) => l.key), ["x", "y"]);
  assert.ok(![...g.rows.lines, ...g.columns.lines].some((l) => l.kind === "rest"));
  assert.equal(g.protected, true);
});

test("the totals are the published ones, a hidden total is null, and the cells do not add up to them", () => {
  const g = hiddenGridOf(input());
  assert.deepEqual(g.rowTotals, [600, 300, null, null]);
  assert.deepEqual(g.columnTotals, [710, 210]);
  assert.equal(g.total, 920);
  const shown = g.cells.flat().filter((c) => !c.hidden).reduce((sum, c) => sum + c.n, 0);
  assert.equal(shown, 900, "the cells shown are fewer than the total: the hidden ones hold the difference");
});

test("a hidden cell has no count, no figure and no shade, and is not zero; a combination the table holds no row for is a true zero", () => {
  const g = hiddenGridOf(input());
  const hidden = g.cells[2][0];
  assert.equal(hidden.hidden, true);
  assert.ok(Number.isNaN(hidden.n));
  assert.equal(hidden.figure, null);
  assert.equal(hidden.step, 0);
  assert.equal(g.cells.flat().filter((c) => c.hidden).length, 4);
  const sparse = hiddenGridOf(input(cells.filter((c) => !(c.value === "beta" && c.other === "y"))));
  assert.equal(sparse.cells[1][1].n, 0);
  assert.equal(sparse.cells[1][1].hidden, undefined, "no vehicles is not hidden");
});

test("a share of a hidden cell is hidden whichever the basis; the shares of the others use the complete totals", () => {
  for (const basis of ["all", "row", "column"] as const) {
    const g = hiddenGridOf(input(cells, basis));
    assert.equal(g.cells[2][0].figure, null, basis);
    assert.equal(g.cells[2][0].hidden, true);
  }
  const row = hiddenGridOf(input(cells, "row"));
  assert.ok(Math.abs((row.cells[0][0].figure as number) - 500 / 600) < 1e-12, "a share of its row is of the published row total");
  const all = hiddenGridOf(input(cells, "all"));
  assert.ok(Math.abs((all.cells[0][0].figure as number) - 500 / 920) < 1e-12, "a share of all is of the whole, hidden vehicles included");
});

test("the table writes a hidden cell and a hidden total as the word, marked hidden, blank in the file, and never 0", () => {
  const t = gridTable(hiddenGridOf(input()), words);
  const delta = t.rows.find((r) => r.head === "delta")!;
  for (const c of delta.cells) {
    assert.equal(c.mark, "hidden");
    assert.equal(c.text, "hidden");
    assert.equal(c.csv, null);
    assert.equal(c.reason, words.hidden.reason);
  }
  assert.equal(delta.cells.length, 3, "two columns and the row total, which is hidden too");
  const alpha = t.rows.find((r) => r.head === "alpha")!;
  assert.deepEqual(alpha.cells.map((c) => c.text), ["500", "100", "600"]);
  const last = t.rows[t.rows.length - 1];
  assert.deepEqual(last.cells.map((c) => c.text), ["710", "210", "920"], "the bottom row holds the complete column totals and the whole");
  const figures = tableFigures(t, "count", "Oct 2026", []);
  const header = { question: "Q", datasets: ["D"], snapshot: "2026-10-31", sources: [], attributions: [], address: "a" };
  const csv = figuresCsv(header, figures, phrases).trim().split("\r\n");
  const line = csv.find((l) => l.startsWith("delta,")) as string;
  assert.match(line, /^delta,,,,/, "blank counts, not 0");
  assert.doesNotMatch(line, /\b0\b/);
  assert.match(line, /hidden/);
});

test("a grid with hidden counts refuses to be written without the words for a hidden cell", () => {
  assert.throws(() => gridTable(hiddenGridOf(input()), { ...words, hidden: undefined }));
});

test("a grid with nothing hidden is the sum of its cells, as before", () => {
  const plain = [
    { month: M, value: "a", other: "x", n: 5 },
    { month: M, value: "a", other: "y", n: 3 },
  ];
  const g = gridOf({ ...input(), rows: plain });
  assert.deepEqual(g.rowTotals, [8]);
  assert.equal(g.protected, undefined);
  assert.equal(g.cells.flat().some((c) => c.hidden), false);
});

test("the largest combination is named when no hidden cell can match it, and dropped when one could", () => {
  assert.equal(hiddenGridOf(input()).leaders[0]?.n, 500, "a hidden cell here holds at most 20");
  // The same table with a large hidden cell: the column x total leaves gamma-x up to 700 less what is shown.
  const big = [
    cell({ value: "alpha", other: "x", n: 40, row: 100, column: 800 }),
    cell({ value: "alpha", other: "y", n: 30, row: 100, column: 30 }),
    cell({ value: "beta", other: "x", n: undefined, row: 760, column: 800 }),
    cell({ value: "beta", other: "y", n: undefined, row: 760, column: 30 }),
  ].map((c) => ({ ...c, denominator: 860 }));
  const g = hiddenGridOf({ ...input(big) });
  assert.deepEqual(g.leaders, [], "a hidden cell could hold more than 40, so no combination is named");
});

test("the sentence about hidden cells is filled from the count and the least count, said once, and dropped if it cannot be filled", () => {
  const facts = (hidden: { cells: number; minimum?: number } | undefined) => ({
    basis: "count" as const, rowField: "a", columnField: "b", window: "in Oct 2026", total: 920, conditions: false, floor: 200, rest: "", leaders: [], among: { rows: false, columns: false },
    counted: () => "", rows: { field: "a", mode: "all" as const, shown: 4, tiedBeyond: 0 }, columns: { field: "b", mode: "all" as const, shown: 2, tiedBeyond: 0 },
    thin: { whole: false, rows: 0, columns: 0 }, tiny: false, hidden,
  });
  assert.match(matrixSentences(phrases, facts({ cells: 4, minimum: 10 })).hidden as string, /^4 cells are hidden\. Counts under 10, and a few more beside them/);
  assert.match(matrixSentences(phrases, facts({ cells: 1, minimum: 10 })).hidden as string, /^One cell is hidden\./);
  assert.equal(matrixSentences(phrases, facts({ cells: 4 })).hidden, undefined, "no least count to say: dropped");
  assert.equal(matrixSentences(phrases, facts({ cells: 0, minimum: 10 })).hidden, undefined);
  assert.equal(matrixSentences(phrases, facts(undefined)).hidden, undefined);
});

// A line's total can be hidden while some of its cells are shown (a few counts beside the small ones are hidden too). A share of that line has no base:
// it is not a share of a line that holds no vehicles.
const hiddenRowTotal = cells.map((c) => (c.value === "alpha" ? { ...c, totals: { ...c.totals, row: null } } : c));
const hiddenColumnTotal = cells.map((c) => (c.other === "x" ? { ...c, totals: { ...c.totals, column: null } } : c));

test("a share of a line whose total is hidden is withheld because the total is hidden, never as a line of no vehicles", () => {
  for (const [basis, rows, reason, noBase] of [["row", hiddenRowTotal, "row total hidden", "no row"], ["column", hiddenColumnTotal, "column total hidden", "no column"]] as const) {
    const withheld = gridTable(hiddenGridOf(input(rows, basis)), words).rows.flatMap((r) => r.cells).filter((c) => c.mark === "withheld");
    assert.ok(withheld.length > 0, `${basis}: a share of a hidden total is withheld`);
    for (const c of withheld) {
      assert.equal(c.csv, null);
      assert.equal(c.reason, reason, `${basis}: the reason is that the total is hidden`);
      assert.notEqual(c.reason, noBase);
    }
    // A published total of nothing still says the line holds no vehicles: that one is true.
    const empty = rows.map((c) => ({ ...c, totals: { row: c.value === "beta" ? 0 : c.totals.row, column: c.other === "y" ? 0 : c.totals.column } }));
    const zeroBase = gridTable(hiddenGridOf(input(empty, basis)), words).rows.flatMap((r) => r.cells).filter((c) => c.reason === noBase);
    assert.ok(zeroBase.length > 0, `${basis}: a total of nothing keeps its reason`);
  }
});

test("the file writes those shares blank with the hidden-total reason, and not the no-vehicles one", () => {
  const t = gridTable(hiddenGridOf(input(hiddenRowTotal, "row")), words);
  const header = { question: "Q", datasets: ["D"], snapshot: "2026-10-31", sources: [], attributions: [], address: "a" };
  const csv = figuresCsv(header, tableFigures(t, "row", "Oct 2026", []), phrases);
  const alpha = csv.trim().split("\r\n").find((l) => l.startsWith("alpha,")) as string;
  assert.match(alpha, /row total hidden/);
  assert.doesNotMatch(csv, /no row/);
});
