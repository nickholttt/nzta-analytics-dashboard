// The grid of two fields crossed (src/lib/matrix.ts, docs/METRICS.md "A grid of two fields", D-114): which values stand on each side, what each cell
// holds, what is greyed or has no figure, how dark each cell is, and the totals.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CellSource, GridInput, SideSpec } from "../../src/lib/matrix.ts";

const { gridOf, gridTable, chooseSide, tableFigures, bandScale, REST_NAME } = await import("../../src/lib/matrix.ts");
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
  assert.equal(g.rows.mode, "ordered");
  assert.equal(g.rows.lines.some((l) => l.kind === "rest"), false);
});

test("an ordered band is shown from the first band the data has to the last, with a line of zeros for each band between with none; none is a gap", () => {
  const order = ["0", "1", "2", "3", "4", "5", "6"];
  // 2 and 4 are in the data only in other months; 1 and 5 are never in it; 0 and 6 are never in it and are outside the first and the last.
  const rows = [src("3", "x", 900), src("2", "x", 40, "2020-01"), src("4", "x", 5, "2019-05")].concat([src("1", "x", 70)]);
  const g = grid(rows, { rowSide: side({ order }) });
  assert.deepEqual(g.rows.lines.map((l) => l.key), ["1", "2", "3", "4"], "from the first the data has (1) to the last (4); 0, 5 and 6 are outside them");
  assert.deepEqual(g.rows.lines.map((l) => l.total), [70, 0, 900, 0]);
  assert.deepEqual(g.cells[1].map((c) => c.n), [0]);
  assert.equal(g.total, 970, "the vehicles of other months are not counted");
  // A band the data never has in the middle is a line of zeros, so the scale does not skip.
  const gap = grid([src("0", "x", 70), src("3", "x", 900)], { rowSide: side({ order }) });
  assert.deepEqual(gap.rows.lines.map((l) => [l.key, l.total]), [["0", 70], ["1", 0], ["2", 0], ["3", 900]]);
  assert.equal(gap.total, 970);
  // One band alone is one line; a value the order does not know follows the bands.
  assert.deepEqual(grid([src("3", "x", 5)], { rowSide: side({ order }) }).rows.lines.map((l) => l.key), ["3"]);
  assert.deepEqual(grid([src("3", "x", 5), src("zz", "x", 1), src("1", "x", 2)], { rowSide: side({ order }) }).rows.lines.map((l) => l.key), ["1", "2", "3", "zz"]);
});

test("a value that means not recorded or not applicable takes no part in setting the ends of an ordered scale, and follows the bands", async () => {
  const config = await import("../../src/lib/config.ts");
  // Config's own bands: those with no range are the flagged values, and they end each list.
  const flagged = config.dimensions.filter((d) => d.kind === "ordered_band" && d.bands).map((d) => [d.id, bandScale(d.bands!).unplaced] as const);
  assert.ok(flagged.some(([, u]) => u.length > 0), "config has bands with no range");
  for (const d of config.dimensions.filter((x) => x.kind === "ordered_band" && x.bands)) {
    const { order, unplaced } = bandScale(d.bands!);
    assert.deepEqual(order.slice(order.length - unplaced.length), unplaced, `${d.id}: the bands with no range are the last of its order`);
    assert.ok(order.length > unplaced.length, `${d.id}: and it has bands with a range`);
  }
  const order = ["0", "1", "2", "3", "4", "none", "unknown"];
  const unplaced = ["none", "unknown"];
  // A grid narrowed to low bands, with a few vehicles of an unknown one: no padding up to band 4 for their sake.
  const g = grid([src("0", "x", 70), src("2", "x", 9), src("unknown", "x", 3)], { rowSide: side({ order, unplaced }) });
  assert.deepEqual(g.rows.lines.map((l) => l.key), ["0", "1", "2", "unknown"]);
  assert.deepEqual(g.rows.lines.map((l) => l.total), [70, 0, 9, 3]);
  // Without the marker the same data would pad to the end of the order, which is what this prevents.
  assert.deepEqual(grid([src("0", "x", 70), src("2", "x", 9), src("unknown", "x", 3)], { rowSide: side({ order }) }).rows.lines.map((l) => l.key), order);
  // Only flagged values: they are the lines, in their order; a flagged value that is absent is not a line.
  assert.deepEqual(grid([src("unknown", "x", 3), src("none", "x", 2)], { rowSide: side({ order, unplaced }) }).rows.lines.map((l) => l.key), ["none", "unknown"]);
  assert.deepEqual(grid([src("4", "x", 3)], { rowSide: side({ order, unplaced }) }).rows.lines.map((l) => l.key), ["4"]);
});

test("values picked on an ordered band keep the band's order, whatever their size", () => {
  const order = ["0", "1", "2", "3"];
  const rows = [src("3", "x", 900), src("1", "x", 5), src("0", "x", 70), src("2", "x", 1)];
  const g = grid(rows, { rowSide: side({ order, picked: ["3", "0", "2"] }) });
  assert.deepEqual(g.rows.lines.map((l) => l.key), ["0", "2", "3", ""], "in band order, then the rest");
  assert.equal(g.rows.mode, "picked");
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
  // The legend lists each step a cell is drawn in, with the range it covers, and the ranges do not overlap.
  const legend = g.legend;
  assert.deepEqual(legend.map((s) => s.step), [1, 3, 5, 6], "only the steps in use");
  assert.equal(legend[legend.length - 1].to, 1000);
  for (let k = 1; k < legend.length; k++) assert.ok(legend[k].from > legend[k - 1].to);
});

test("a grid that is greyed throughout has no shade and so no legend", () => {
  const g = grid(SMALL, { basis: "all", floor: 5000 });
  assert.deepEqual(g.legend, []);
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
  assert.ok(qLine?.startsWith("Q,,,"), `blank, not zero: ${qLine}`);
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

// The file's figure and the shade step are made from the figure the page prints, so they cannot disagree with it (the review of #75, item 2).
const sweep: [number, number][] = [[3, 2000], [23, 80], [1, 8], [5, 8], [1, 16], [3, 16], [7, 16], [1, 40], [1, 80], [3, 80], [1, 2000], [999, 2000], [1999, 2000], [1, 3]];
for (const base of [8, 16, 40, 80, 160, 1000, 2000]) for (let n = 0; n <= base; n++) sweep.push([n, base]);

test("the file writes the figure the page prints, and the shade is stepped from it, over a sweep that includes exact half-tenths", async () => {
  const { pct } = await import("../../src/lib/measures.ts");
  const { printedPercent, printedTenths } = await import("../../src/lib/matrix.ts");
  let compared = 0;
  for (const [n, base] of sweep) {
    // One row whose cells are n and the rest of base, as a share of its row; no floor, so nothing is greyed.
    const g = grid([src("R", "x", n), src("R", "y", base - n)], { basis: "row", floor: 0, rowSide: side({ picked: ["R"] }) });
    const t = gridTable(g, { ...words, format: { ...words.format, pct } });
    const j = g.columns.lines.findIndex((l) => l.key === "x");
    if (j < 0) continue;
    const cell = t.rows[0].cells[j];
    const figure = g.cells[0][j].figure as number;
    assert.equal(cell.text === pct(figure) || cell.text === "<" + pct(0.001), true, `${n}/${base}: the page prints ${cell.text}`);
    if (cell.tiny) {
      assert.equal(cell.csv, "<" + pct(0.001).replace("%", ""), `${n}/${base}`);
      assert.ok(n > 0);
    } else {
      assert.equal(cell.csv, Number(cell.text.replace("%", "")), `${n}/${base}: the file says ${cell.csv}, the page ${cell.text}`);
      assert.equal(printedTenths(figure), Math.round(Number(cell.text.replace("%", "")) * 10), `${n}/${base}: the step is of the printed figure`);
    }
    assert.equal(printedPercent(figure), (figure * 100).toFixed(1));
    compared++;
  }
  assert.ok(compared > 400, "the sweep ran");
  // The named cases: 3/2000 prints 0.1% (the file said 0.2) and 23/80 prints 28.7% (it was stepped as 28.8%).
  const at = (n: number, base: number) => {
    const g = grid([src("R", "x", n), src("R", "y", base - n)], { basis: "row", floor: 0, rowSide: side({ picked: ["R"] }) });
    return { g, cell: gridTable(g, { ...words, format: { ...words.format, pct } }).rows[0].cells[g.columns.lines.findIndex((l) => l.key === "x")] };
  };
  assert.deepEqual([at(3, 2000).cell.text, at(3, 2000).cell.csv], ["0.1%", 0.1]);
  assert.deepEqual([at(23, 80).cell.text, at(23, 80).cell.csv], ["28.7%", 28.7]);
  assert.equal(printedTenths(23 / 80), 287);
});

test("a share that is more than nothing but prints as 0.0% is written with a less-than sign, here and in the file, and a true zero as zero", () => {
  const g = grid([src("R", "x", 1), src("R", "y", 9999), src("R", "z", 0)], { basis: "row", floor: 0, rowSide: side({ picked: ["R"] }) });
  const t = gridTable(g, words);
  const x = t.rows[0].cells[g.columns.lines.findIndex((l) => l.key === "x")];
  assert.deepEqual([x.text, x.csv, x.tiny], ["<0.1%", "<0.1", true]);
  assert.equal(x.step, 1, "a share of something is shaded, as before");
  assert.equal(t.hasTiny, true);
  const zero = grid([src("R", "y", 9999)], { basis: "row", floor: 0, rowSide: side({ picked: ["R"] }), columnSide: side({ picked: ["x", "y"] }) });
  const zeroCell = gridTable(zero, words).rows[0].cells;
  assert.ok(zeroCell.some((c) => c.text === "0.0%" && c.csv === 0 && !c.tiny), "a zero is 0.0% and 0");
});

test("a greyed share is marked, and keeps its figure", () => {
  const g = grid(SMALL, { basis: "row", floor: 200 });
  const t = gridTable(g, words);
  const b = t.rows.find((r) => r.head === "B");
  assert.ok(b && b.cells.slice(0, 2).every((c) => c.mark === "greyed" && c.step === 0 && /^\d/.test(c.text)));
});

// The answer is true of the question, not of the cut (the review of #75, item 1).
test("the largest combination is worked out over every named pair in the window, and its row is kept on the grid when the cut would lose it", () => {
  // A and B hold 100 each, 25 in each of four columns; K holds 99, all in one column, and is the smallest row.
  const rows = ["w", "x", "y", "z"].flatMap((c) => [src("A", c, 25), src("B", c, 25)]).concat([src("K", "x", 99)]);
  const g = grid(rows, { rowSide: side({ limit: 2 }) });
  assert.deepEqual(g.leaders.map((l) => [l.row.key, l.column.key, l.n]), [["K", "x", 99]], "K by x, though K is cut by the limit");
  assert.equal(g.rows.kept, "K");
  assert.deepEqual(g.rows.lines.map((l) => l.key), ["A", "B", "K"], "K is on the grid, so the sentence can be found (and with nothing left over there is no rest line)");
  assert.deepEqual(g.leadersAmong, { rows: false, columns: false });
  // Nothing is lost: the cells still add up.
  assert.equal(g.cells.flat().reduce((s, c) => s + c.n, 0), g.total);
  assert.equal(g.total, 299, "100 in A, 100 in B and 99 in K");
});

test("level leaders: the first is on the grid, one the cut would lose is counted in the rest line, and the sentence says how many are", async () => {
  const { phrases } = await import("../../src/lib/config.ts");
  const { matrixSentences } = await import("../../src/lib/sentences.ts");
  // A by x and B by y are level at 50. Rows are cut at one, so B's row is in the rest line; the columns hold both.
  const g = grid([src("A", "x", 50), src("B", "y", 50), src("C", "x", 10)], { rowSide: side({ limit: 1 }) });
  assert.deepEqual(g.leaders.map((l) => [l.row.key, l.column.key, l.inRest]), [["A", "x", false], ["B", "y", true]]);
  assert.deepEqual(g.rows.lines.map((l) => l.kind), ["value", "rest"], "B has no row of its own");
  const facts = {
    basis: "count" as const, rowField: "thing", columnField: "kind", window: "in the window", total: g.total, conditions: false, floor: 200, rest: "All other",
    leaders: g.leaders.map((l) => ({ row: l.row.name, column: l.column.name, n: l.n, inRest: l.inRest })), among: g.leadersAmong, counted: (n: number) => `${n} vehicles`,
    rows: { field: "thing", mode: g.rows.mode, shown: 1, tiedBeyond: 0, rest: g.rows.rest }, columns: { field: "kind", mode: g.columns.mode, shown: 2, tiedBeyond: 0, rest: g.columns.rest },
    thin: { whole: false, rows: 0, columns: 0 }, tiny: false,
  };
  const one = matrixSentences(phrases, facts).leader as string;
  assert.match(one, /^2 combinations of two named values are level as the largest, each with 50 vehicles: thing A and kind x; thing B and kind y\. One of these is counted in All other, not in a cell of its own\.$/);
  // Two of three in the rest line is said in the plural; none in it adds nothing.
  const three = matrixSentences(phrases, { ...facts, leaders: [...facts.leaders, { row: "D", column: "z", n: 50, inRest: true }] }).leader as string;
  assert.match(three, /\. 2 of these are counted in All other, not in a cell of their own\.$/);
  const shown = grid([src("A", "x", 50), src("B", "y", 50)]);
  assert.ok(shown.leaders.every((l) => !l.inRest));
  const plain = matrixSentences(phrases, { ...facts, leaders: shown.leaders.map((l) => ({ row: l.row.name, column: l.column.name, n: l.n, inRest: l.inRest })) }).leader as string;
  assert.ok(!/counted in/.test(plain));
});

test("the answer says it is the largest of two named values, so it stays true beside a reserved line that holds more", async () => {
  const { phrases } = await import("../../src/lib/config.ts");
  const { matrixSentences } = await import("../../src/lib/sentences.ts");
  const g = grid([src("A", "x", 10), src("B", "x", 5), src("__UNDEFINED__", "x", 500), src("__UNMAPPED__", "y", 400)]);
  assert.ok(g.rows.lines.some((l) => l.kind === "reserved") && g.rowTotals.some((t) => t > g.leaders[0].n), "a reserved line is on the grid and holds more");
  const sentence = matrixSentences(phrases, {
    basis: "count", rowField: "thing", columnField: "kind", window: "in the window", total: g.total, conditions: false, floor: 200, rest: "All other",
    leaders: g.leaders.map((l) => ({ row: l.row.name, column: l.column.name, n: l.n, inRest: l.inRest })), among: g.leadersAmong, counted: (n: number) => `${n} vehicles`,
    rows: { field: "thing", mode: g.rows.mode, shown: 2, tiedBeyond: 0, rest: g.rows.rest }, columns: { field: "kind", mode: g.columns.mode, shown: 1, tiedBeyond: 0, rest: g.columns.rest },
    thin: { whole: false, rows: 0, columns: 0 }, tiny: false,
  }).leader as string;
  assert.match(sentence, /^The largest combination of two named values is thing A and kind x: 10 vehicles/);
});

test("a side cut by size counts the values chosen by size, not the one kept for the answer, so its two sentences agree", async () => {
  const { phrases } = await import("../../src/lib/config.ts");
  const { matrixSentences } = await import("../../src/lib/sentences.ts");
  // Columns w 119, p 30, q 30, z 20, cut at two; the largest pair (a, z) is 20, so z is kept though q, which is level with p, is cut.
  const rows = [..."abcdefg"].map((r) => src(r, "w", 17)).concat([src("a", "p", 15), src("b", "p", 15), src("a", "q", 15), src("b", "q", 15), src("a", "z", 20)]);
  const g = grid(rows, { columnSide: side({ limit: 2 }) });
  assert.deepEqual(g.leaders.map((l) => [l.row.key, l.column.key, l.n]), [["a", "z", 20]]);
  assert.equal(g.columns.kept, "z");
  assert.deepEqual(g.columns.lines.filter((l) => l.kind === "value").map((l) => l.key), ["w", "p", "z"], "three lines, z out of its place");
  assert.equal(g.columns.shown, 2, "the two chosen by size");
  assert.equal(g.rows.shown, 7, "a side with nothing kept counts all its lines");
  const side2 = (s: typeof g.columns, field: string) => ({ field, mode: s.mode, shown: s.shown, tiedBeyond: s.tiedBeyond, kept: s.kept, rest: s.rest });
  const said = matrixSentences(phrases, {
    basis: "count", rowField: "thing", columnField: "kind", window: "in the window", total: g.total, conditions: false, floor: 200, rest: "All other",
    leaders: g.leaders.map((l) => ({ row: l.row.name, column: l.column.name, n: l.n, inRest: l.inRest })), among: g.leadersAmong, counted: (n: number) => `${n} vehicles`,
    rows: side2(g.rows, "thing"), columns: side2(g.columns, "kind"), thin: { whole: false, rows: 0, columns: 0 }, tiny: false,
  });
  assert.match(said.columns[0], /^Columns: the 2 kind values with the most vehicles/);
  assert.ok(said.columns.some((s) => /z is shown as well, out of its place/.test(s)));
});

test("where the visitor picked values the leader is the largest among those, and the sentence says so", async () => {
  const { phrases } = await import("../../src/lib/config.ts");
  const { matrixSentences } = await import("../../src/lib/sentences.ts");
  // The picks are B and C; A by x holds 1000 and is left out of the question.
  const rows = [src("A", "x", 1000), src("B", "x", 3), src("B", "y", 2), src("C", "y", 7)];
  const g = grid(rows, { rowSide: side({ picked: ["B", "C"] }) });
  assert.deepEqual(g.leaders.map((l) => [l.row.key, l.column.key, l.n]), [["C", "y", 7]]);
  assert.deepEqual(g.leadersAmong, { rows: true, columns: false });
  const facts = (gr: typeof g) => ({
    basis: "count" as const, rowField: "thing", columnField: "kind", window: "in the window", total: gr.total, conditions: false, floor: 200, rest: "All other",
    leaders: gr.leaders.map((l) => ({ row: l.row.name, column: l.column.name, n: l.n })), among: gr.leadersAmong, counted: (n: number) => `${n} vehicles`,
    rows: { field: "thing", mode: gr.rows.mode, shown: 2, tiedBeyond: 0, rest: gr.rows.rest }, columns: { field: "kind", mode: gr.columns.mode, shown: 2, tiedBeyond: 0, rest: gr.columns.rest },
    thin: { whole: false, rows: 0, columns: 0 }, tiny: false,
  });
  const picked = matrixSentences(phrases, facts(g)).leader as string;
  assert.match(picked, /Among the thing values you picked, the largest combination of two named values is thing C and kind y: 7 vehicles/);
  const whole = grid(rows);
  assert.deepEqual(whole.leaders.map((l) => l.row.key), ["A"], "with nothing picked the leader is A by x");
  const plain = matrixSentences(phrases, facts(whole)).leader as string;
  assert.match(plain, /^The largest combination of two named values is thing A and kind x: 1000 vehicles/);
  assert.ok(!/you picked/.test(plain));
});

test("a sentence that cannot be filled is dropped, not shown with a gap", async () => {
  const { phrases } = await import("../../src/lib/config.ts");
  const { matrixSentences } = await import("../../src/lib/sentences.ts");
  const g = grid(SMALL);
  const facts = {
    basis: "count" as const, rowField: "thing", columnField: "kind", window: "in the window", total: g.total, conditions: false, floor: 200, rest: "All other",
    leaders: g.leaders.map((l) => ({ row: l.row.name, column: l.column.name, n: l.n })), among: g.leadersAmong, counted: (n: number) => String(n),
    rows: { field: "thing", mode: g.rows.mode, shown: 3, tiedBeyond: 0, rest: g.rows.rest }, columns: { field: "kind", mode: g.columns.mode, shown: 2, tiedBeyond: 0, rest: g.columns.rest },
    thin: { whole: false, rows: 0, columns: 0 }, tiny: false,
  };
  assert.ok(matrixSentences(phrases, facts).leader, "filled from the real template");
  const broken = { ...phrases, matrix_leader: "The largest is {nothing_supplies_this}.", matrix_cells_count: "Each cell is {gap}.", matrix_rows_all: "Rows: {gap}." };
  const said = matrixSentences(broken, facts);
  assert.equal(said.leader, undefined);
  assert.equal(said.cells, undefined);
  assert.ok(said.rows.every((s) => !s.includes("{") && !s.includes("?")));
  assert.ok(!said.rows.includes("Rows: ?."));
});

test("chooseSide reads the same totals in any order", () => {
  const a = chooseSide(new Map([["B", 3], ["A", 3], ["C", 9]]), side({ limit: 2 }));
  const b = chooseSide(new Map([["C", 9], ["A", 3], ["B", 3]]), side({ limit: 2 }));
  assert.deepEqual(a, b);
  assert.deepEqual(a.lines.map((l) => l.key), ["C", "A", ""]);
});
