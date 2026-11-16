// The grid of two fields crossed (src/lib/matrix.ts, docs/METRICS.md "A grid of two fields", D-114): which values stand on each side, what each cell
// holds, what is greyed or has no figure, how dark each cell is, and the totals.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CellSource, GridInput, SideSpec } from "../../src/lib/matrix.ts";

const { gridOf, gridTable, chooseSide, tableFigures, REST_NAME } = await import("../../src/lib/matrix.ts");
const { figuresCsv } = await import("../../src/lib/figures.ts");

const nameOf = (v: string) => (v === "__UNDEFINED__" ? "Not recorded" : v === "__UNMAPPED__" ? "No match" : v === "__OTHER__" ? "Beyond cap" : v);
const side = (over: Partial<SideSpec> = {}): SideSpec => ({ limit: 10, nameOf, ...over });
const fractions = [0.02, 0.06, 0.15, 0.35, 0.65, 1];
const MONTH = "2026-10";
const src = (value: string, other: string, n: number, month = MONTH): CellSource => ({ month, value, other, n });
const grid = (rows: CellSource[], over: Partial<GridInput> = {}) =>
  gridOf({ rows, from: MONTH, to: MONTH, rowSide: side(), columnSide: side(), basis: "count", floor: 200, stepFractions: fractions, ...over });

const SMALL = [src("A", "x", 600), src("A", "y", 300), src("B", "x", 90), src("B", "y", 10), src("C", "x", 1000)];

test("the cells add up to the total, and the totals are the totals of the vehicles counted", () => {
  const g = grid(SMALL);
  assert.equal(g.total, 2000);
  assert.deepEqual(g.rows.lines.map((l) => l.key), ["C", "A", "B"], "ordered by vehicles");
  assert.deepEqual(g.columns.lines.map((l) => l.key), ["x", "y"]);
  assert.deepEqual(g.rowTotals, [1000, 900, 100]);
  assert.deepEqual(g.columnTotals, [1690, 310]);
  assert.equal(g.cells.flat().reduce((s, c) => s + c.n, 0), g.total);
});

test("only months in the window are counted", () => {
  const g = grid([...SMALL, src("A", "x", 5000, "2026-09"), src("A", "x", 7000, "2025-10")]);
  assert.equal(g.total, 2000);
  const wide = grid([...SMALL, src("A", "x", 5000, "2026-09")], { from: "2026-09" });
  assert.equal(wide.total, 7000);
});

test("values past the limit stand together in one line, so nothing is left out of the totals", () => {
  const rows = ["A", "B", "C", "D", "E"].flatMap((v, i) => [src(v, "x", 100 - i)]);
  const g = grid(rows, { rowSide: side({ limit: 3 }) });
  assert.deepEqual(g.rows.lines.map((l) => [l.name, l.kind]), [["A", "value"], ["B", "value"], ["C", "value"], [REST_NAME, "rest"]]);
  assert.equal(g.rows.lines[3].total, 97 + 96);
  assert.equal(g.total, 100 + 99 + 98 + 97 + 96);
  assert.equal(g.rows.mode, "largest");
  assert.deepEqual(g.rows.rest, { values: 2, notRecorded: false, unmatched: false, beyondCap: false });
});

test("a tie at the cut shows the alphabetically first value, and says how many are level with the last one shown", () => {
  const rows = [src("Z", "x", 50), src("M", "x", 40), src("D", "x", 40), src("A", "x", 40), src("B", "x", 10)];
  const g = grid(rows, { rowSide: side({ limit: 2 }) });
  assert.deepEqual(g.rows.lines.map((l) => l.key).slice(0, 2), ["Z", "A"]);
  assert.equal(g.rows.tiedBeyond, 2);
  // The same whatever order the rows arrive in.
  const again = grid([...rows].reverse(), { rowSide: side({ limit: 2 }) });
  assert.deepEqual(again.rows.lines.map((l) => l.key), g.rows.lines.map((l) => l.key));
});

test("reserved values: not recorded and no match are lines of their own, after the named values; beyond the cap is always in the rest", () => {
  const rows = [src("A", "x", 10), src("B", "x", 5), src("__UNDEFINED__", "x", 500), src("__UNMAPPED__", "x", 400), src("__OTHER__", "x", 300)];
  const g = grid(rows);
  assert.deepEqual(g.rows.lines.map((l) => [l.name, l.kind]), [["A", "value"], ["B", "value"], ["Not recorded", "reserved"], ["No match", "reserved"], [REST_NAME, "rest"]]);
  assert.equal(g.rows.lines[4].total, 300);
  assert.equal(g.rows.rest?.beyondCap, true);
  assert.equal(g.total, 1215);
  // They take no place and are never the largest combination, though they hold the most vehicles.
  assert.deepEqual(g.leaders.map((l) => l.row.key), ["A"]);
});

test("values the visitor picked are the lines, in order of size, and a picked value with no vehicles is a line of zeros", () => {
  const g = grid(SMALL, { rowSide: side({ picked: ["B", "Q"] }) });
  assert.deepEqual(g.rows.lines.map((l) => l.key), ["B", "Q", ""], "the rest holds A and C");
  assert.equal(g.rows.mode, "picked");
  assert.deepEqual(g.cells[1].map((c) => c.n), [0, 0]);
  assert.equal(g.total, 2000);
});

test("an ordered band is shown whole in its own order, not cut and not ranked", () => {
  const order = ["0", "1", "2", "3"];
  const rows = [src("3", "x", 900), src("1", "x", 5), src("0", "x", 70), src("2", "x", 1)];
  const g = grid(rows, { rowSide: side({ order, limit: 2 }) });
  assert.deepEqual(g.rows.lines.map((l) => l.key), ["0", "1", "2", "3"]);
  assert.equal(g.rows.mode, "all");
  assert.equal(g.rows.lines.some((l) => l.kind === "rest"), false);
});

test("a cell of no vehicles is zero, and is not shaded", () => {
  const g = grid(SMALL);
  const bRow = g.rows.lines.findIndex((l) => l.key === "C");
  const y = g.columns.lines.findIndex((l) => l.key === "y");
  assert.deepEqual(g.cells[bRow][y], { n: 0, figure: 0, step: 0, greyed: false });
});

test("a share of all is the cell over everything counted, of a row over its row, of a column over its column", () => {
  const all = grid(SMALL, { basis: "all" });
  const row = grid(SMALL, { basis: "row" });
  const column = grid(SMALL, { basis: "column" });
  const at = (g: ReturnType<typeof grid>, r: string, c: string) => g.cells[g.rows.lines.findIndex((l) => l.key === r)][g.columns.lines.findIndex((l) => l.key === c)].figure;
  assert.equal(at(all, "A", "x"), 600 / 2000);
  assert.equal(at(row, "A", "x"), 600 / 900);
  assert.equal(at(column, "A", "x"), 600 / 1690);
  // Along a row the shares add up to one, in a row grid; down a column, in a column grid; across the grid, in a grid of all.
  assert.ok(Math.abs(row.cells[0].reduce((s, c) => s + (c.figure ?? 0), 0) - 1) < 1e-12);
  assert.ok(Math.abs(column.cells.reduce((s, line) => s + (line[0].figure ?? 0), 0) - 1) < 1e-12);
  assert.ok(Math.abs(all.cells.flat().reduce((s, c) => s + (c.figure ?? 0), 0) - 1) < 1e-12);
});

test("a share is greyed where its own base is under the floor, and the count never is", () => {
  const all = grid(SMALL, { basis: "all", floor: 5000 });
  assert.equal(all.wholeGreyed, true);
  assert.ok(all.cells.flat().every((c) => c.greyed && c.step === 0));
  const row = grid(SMALL, { basis: "row", floor: 200 });
  const bRow = row.rows.lines.findIndex((l) => l.key === "B");
  assert.deepEqual(row.greyedRows, [bRow]);
  assert.ok(row.cells[bRow].every((c) => c.greyed));
  assert.ok(row.cells.filter((_, i) => i !== bRow).flat().every((c) => !c.greyed));
  const count = grid(SMALL, { basis: "count", floor: 5000 });
  assert.equal(count.cells.flat().some((c) => c.greyed), false);
});

test("a share of nothing has no value: a picked row with no vehicles has no figure, and is not zero", () => {
  const row = grid(SMALL, { basis: "row", rowSide: side({ picked: ["Q", "A"] }) });
  assert.ok(row.cells[row.rows.lines.findIndex((l) => l.key === "Q")].every((c) => c.figure === null && !c.greyed));
});

test("one shade means one figure everywhere: the steps are fractions of the largest among the cells that are shaded", () => {
  const g = grid([src("A", "x", 1000), src("A", "y", 500), src("B", "x", 100), src("B", "y", 10), src("C", "x", 1)]);
  const steps = new Map(g.rows.lines.flatMap((r, i) => g.columns.lines.map((c, j) => [`${r.key}${c.key}`, g.cells[i][j].step] as const)));
  assert.equal(steps.get("Ax"), 6, "the largest takes the darkest step");
  assert.equal(steps.get("Ay"), 5, "half of it");
  assert.equal(steps.get("Bx"), 3, "a tenth");
  assert.equal(steps.get("By"), 1, "a hundredth");
  assert.equal(steps.get("Cx"), 1, "one vehicle is never no shade");
  assert.equal(steps.get("Cy"), 0, "no vehicles");
  // The legend lists each step, with the range it covers, and the ranges follow on from each other.
  const legend = g.legend;
  assert.equal(legend[legend.length - 1].to, 1000);
  for (let k = 1; k < legend.length; k++) assert.equal(legend[k].from, legend[k - 1].to + 1);
});

test("the rest line and the totals are not shaded, and do not set the scale", () => {
  const rows = ["A", "B", "C", "D"].map((v, i) => src(v, "x", i === 3 ? 10 : 100));
  const g = grid(rows, { rowSide: side({ limit: 2 }) });
  const restAt = g.rows.lines.findIndex((l) => l.kind === "rest");
  assert.equal(g.cells[restAt][0].n, 110);
  assert.equal(g.cells[restAt][0].step, 0);
  assert.equal(g.cells[0][0].step, 6, "the largest named cell, not the rest, is the darkest");
});

test("the largest combination, and every one level with it, in the order of the rows and columns", () => {
  const g = grid([src("A", "x", 50), src("B", "y", 50), src("B", "x", 49)]);
  assert.deepEqual(g.leaders.map((l) => [l.row.key, l.column.key, l.n]), [["B", "y", 50], ["A", "x", 50]]);
  assert.deepEqual(grid([]).leaders, []);
});

test("an empty window has no lines and a total of nothing", () => {
  const g = grid([]);
  assert.equal(g.total, 0);
  assert.deepEqual(g.rows.lines, []);
  assert.deepEqual(g.cells, []);
});

const words = {
  rowHead: "Thing",
  totalCount: "All",
  totalShare: "Vehicles",
  format: { count: (n: number) => n.toLocaleString("en-NZ"), pct: (x: number) => `${(x * 100).toFixed(1)}%` },
  thin: "fewer than 200 vehicles behind this figure",
  noBase: { row: "no vehicles in this row", column: "no vehicles in this column" },
};

test("the table has a total row and column in vehicles, whatever the cells hold", () => {
  const t = gridTable(grid(SMALL), words);
  assert.deepEqual(t.columns.map((c) => c.name), ["x", "y", "All"]);
  assert.deepEqual(t.rows.map((r) => r.head), ["C", "A", "B", "All"]);
  assert.deepEqual(t.rows[3].cells.map((c) => c.csv), [1690, 310, 2000]);
  const shares = gridTable(grid(SMALL, { basis: "row" }), words);
  assert.deepEqual(shares.columns.map((c) => c.name), ["x", "y", "Vehicles"]);
  assert.deepEqual(shares.rows[1].cells.map((c) => c.text), ["66.7%", "33.3%", "900"]);
});

test("a greyed share is written with its reason and a share with no value is blank with its reason, never zero", () => {
  const g = grid(SMALL, { basis: "row", rowSide: side({ picked: ["Q", "B", "A"] }) });
  const t = gridTable(g, words);
  const q = t.rows.find((r) => r.head === "Q");
  assert.ok(q && q.cells.slice(0, 2).every((c) => c.csv === null && c.mark === "withheld" && c.reason === words.noBase.row));
  const b = t.rows.find((r) => r.head === "B");
  assert.ok(b && b.cells.slice(0, 2).every((c) => c.mark === "greyed" && c.reason === words.thin));
  const phrases = {
    figures_units: "units", figures_marks: "Marks: {list}.", figures_marks_none: "none", figures_mark_item: "{column}, {mark}: {reason}", figures_greyed: "greyed",
    figures_withheld: "withheld", figures_marked_column: "Greyed or withheld",
  };
  const figures = tableFigures(t, "row", "Oct 2026", ["note"]);
  const csv = figuresCsv({ question: "q", datasets: [], snapshot: "s", sources: [], attributions: [], address: "a" }, figures, phrases);
  const lines = csv.split("\r\n");
  assert.ok(lines.includes("# note"), "the notes are written above the table");
  const qLine = lines.find((l) => l.startsWith("Q,"));
  assert.ok(qLine?.startsWith("Q,,,0,") || qLine?.startsWith("Q,,,"), `blank, not zero: ${qLine}`);
  assert.ok(qLine?.includes("withheld"));
});

test("each cell of the file is the cell of the table, in the same order", () => {
  const g = grid(SMALL, { basis: "all" });
  const t = gridTable(g, words);
  const figures = tableFigures(t, "all", "Oct 2026", []);
  assert.equal(figures.rows.length, t.rows.length);
  assert.equal(figures.columns.length, t.columns.length + 1);
  figures.rows.forEach((row, i) => {
    assert.equal(row[0], t.rows[i].head);
    row.slice(1).forEach((cell, j) => assert.equal(typeof cell === "string" ? cell : cell.text, t.rows[i].cells[j].text));
  });
});

test("chooseSide reads the same totals in any order", () => {
  const a = chooseSide(new Map([["B", 3], ["A", 3], ["C", 9]]), side({ limit: 2 }));
  const b = chooseSide(new Map([["C", 9], ["A", 3], ["B", 3]]), side({ limit: 2 }));
  assert.deepEqual(a, b);
  assert.deepEqual(a.lines.map((l) => l.key), ["C", "A", ""]);
});
