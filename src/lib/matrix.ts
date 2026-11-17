// matrix: two fields crossed, one down the side and one across the top, a figure shaded in each cell (CLAUDE.md, Shapes; D-083, D-114).
// Pure, so tests/site/ runs it with Node's own test runner; MatrixChart draws what this returns. It reads rows of the fact table that have been
// summed to (month, value, other value) and a window of months, and gives back the grid: which values stand on each side, what each cell
// holds, which cells are greyed or have no figure, how dark each is, and the totals. Nothing here knows a field, a measure or a value.
//
// The rules it keeps (docs/METRICS.md, "A grid of two fields"):
//   - every vehicle the conditions keep in the window is in exactly one cell, so the cells add up to the total, and the totals are the
//     conditions' totals; values that are not shown stand together in one line, "All other", never left out;
//   - the lines on a side are the visitor's picks or the largest in the window, ordered by count with ties alphabetical (the one
//     ranking rule, ranking.ts); an ordered band is shown whole, every band the data has under the conditions, in its own order, picked or not;
//   - reserved values: "not recorded" and "no reference match" describe real vehicles and are lines of their own (after the named values,
//     taking no place in the ranking); "beyond the cap" is where a cap puts values, so it is always in "All other";
//   - a share is a share of everything counted (the grid), or of its row, or of its column, as the visitor chooses; it is greyed when its base
//     is under the precision floor and has no value when its base is nothing; a cell of no vehicles is zero;
//   - a shade means the same figure everywhere in the grid: the steps are fractions of the largest figure among the cells it shades;
//   - a figure is printed once, to one decimal place, and the file and the shade step are made from that printed figure, never from the
//     unrounded one, so the three cannot disagree;
//   - the answer, the largest combination, is the largest over every named pair in the window where the sides are the page's own, and the
//     largest among the values picked where the visitor picked; the first of the largest combinations is always shown on the grid.
import { byCountThenName, nameOrder, rankByCount } from "./ranking";
import { BEYOND_CAP, REST_NAME } from "./reserved";
import { NOT_RECORDED_TOKEN, NO_MATCH_TOKEN } from "./sentences";
import type { Cell as FigureCell, Column, Figures } from "./figures";

// What the visitor chooses a cell to hold. count: the vehicles. all: a share of everything counted. row: a share of its row. column: a share of its column.
export type Basis = "count" | "all" | "row" | "column";
export const BASES: readonly Basis[] = ["count", "all", "row", "column"];
export const isBasis = (v: unknown): v is Basis => typeof v === "string" && (BASES as readonly string[]).includes(v);

export { REST_NAME };

const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");

// A share as printed: a percentage to one decimal place, the same rounding as `pct` in measures.ts (a test holds the two together). The step
// of the shade and the figure in the file are made from this, so a cell cannot print 0.1%, be stepped as 0.2% and be written as 0.2.
export const printedPercent = (figure: number): string => (figure * 100).toFixed(1);
export const printedTenths = (figure: number): number => Math.round(Number(printedPercent(figure)) * 10);

// The rows of the fact table summed to a pair of values: one row for each month and combination that has vehicles.
export type CellSource = { month: string; value: string; other: string; n: number };

export type SideSpec = {
  // How many lines to show when nothing is picked.
  limit: number;
  // The values the visitor chose. They are the lines.
  picked?: readonly string[];
  // An ordered band: its values in this order. Never cut or ranked, picked or not.
  order?: readonly string[];
  nameOf: (value: string) => string;
};

export type LineKind = "value" | "reserved" | "rest";
export type Line = { key: string; name: string; kind: LineKind; total: number };

export type Side = {
  lines: Line[];
  // How the lines were chosen: the visitor's picks, the largest, every value there is, or every band of an ordered field in its order.
  mode: "picked" | "largest" | "all" | "ordered";
  // Values cut at the limit that have the same count, and so the same rank, as the last line shown (they are in "All other").
  tiedBeyond: number;
  // A value shown out of its rank because it is in the largest combination, so the answer can be found on the grid.
  kept?: string;
  // What "All other" holds, when there is such a line.
  rest?: { values: number; notRecorded: boolean; unmatched: boolean; beyondCap: boolean };
};

export type GridCell = {
  n: number;
  // The figure the cell shows, in its basis: the vehicles, or a proportion; null where its base holds no vehicles (a share of nothing).
  figure: number | null;
  // 0: no shade (no vehicles, a figure with no value, a greyed figure, "All other"). 1 to the number of steps: darker is more.
  step: number;
  greyed: boolean;
};

// inRest: the row or the column of this combination is not a line of its own, so its vehicles are counted in a cell of the rest line.
export type Leader = { row: { key: string; name: string }; column: { key: string; name: string }; n: number; inRest: boolean };

export type Grid = {
  basis: Basis;
  rows: Side;
  columns: Side;
  cells: GridCell[][];
  rowTotals: number[];
  columnTotals: number[];
  total: number;
  // The shade steps some cell is drawn in, each as the range of whole units (vehicles, or tenths of a percent) it covers.
  legend: { step: number; from: number; to: number }[];
  // The shares are greyed everywhere (the base is the whole grid and it is under the floor), or in these rows and columns (their own bases are).
  wholeGreyed: boolean;
  greyedRows: number[];
  greyedColumns: number[];
  // The combinations of two named values (reserved values and "All other" take no place) with the most vehicles, all that are level: over every
  // pair in the window, or, on a side the visitor picked values for, among those values only. The first has its row and column on the grid; a
  // later one may be counted in the rest line (inRest).
  leaders: Leader[];
  // Which sides the leaders are among the picked values of.
  leadersAmong: { rows: boolean; columns: boolean };
};

export type GridInput = {
  rows: readonly CellSource[];
  from: string;
  to: string;
  rowSide: SideSpec;
  columnSide: SideSpec;
  basis: Basis;
  floor: number;
  // The upper end of each shade step as a fraction of the largest figure, ending in 1.
  stepFractions: readonly number[];
};

// Which values stand on a side, from the vehicles each holds in the window. seen: the values the data has in any month under the conditions,
// which an ordered band shows whole (a band with no vehicles in the window is a line of zeros, not a gap). keep: a value to show whatever its rank.
export function chooseSide(totals: ReadonlyMap<string, number>, spec: SideSpec, seen?: ReadonlySet<string>, keep?: string): Side {
  const named = [...totals].filter(([value, n]) => !isReserved(value) && n > 0).map(([value, n]) => ({ value, name: spec.nameOf(value), n }));
  const total = (value: string) => totals.get(value) ?? 0;
  const entry = (value: string) => ({ value, name: spec.nameOf(value), n: total(value) });
  const at = new Map((spec.order ?? []).map((v, i) => [v, i]));
  const byOrder = (a: { value: string; name: string }, b: { value: string; name: string }) =>
    (at.get(a.value) ?? Infinity) - (at.get(b.value) ?? Infinity) || nameOrder(a.name, b.name);
  let shown: { value: string; name: string; n: number }[];
  let mode: Side["mode"];
  let tiedBeyond = 0;
  let kept: string | undefined;
  if (spec.picked && spec.picked.length > 0) {
    mode = "picked";
    const chosen = [...new Set(spec.picked.filter((v) => !isReserved(v)))].map(entry);
    shown = spec.order ? chosen.sort(byOrder) : rankByCount(chosen);
  } else if (spec.order) {
    mode = "ordered";
    // Every band the data has under the conditions, in any month, in its own order; any value the order does not know follows.
    const values = new Set([...[...(seen ?? [])].filter((v) => !isReserved(v)), ...named.map((e) => e.value)]);
    shown = [...values].map(entry).sort(byOrder);
  } else {
    const ranked = rankByCount(named);
    mode = ranked.length <= spec.limit ? "all" : "largest";
    shown = ranked.slice(0, spec.limit);
    if (ranked.length > spec.limit) {
      const last = ranked[spec.limit - 1];
      const extra = keep !== undefined && !shown.some((e) => e.value === keep) ? ranked.find((e) => e.value === keep) : undefined;
      tiedBeyond = last ? ranked.slice(spec.limit).filter((e) => e.rank === last.rank && e.value !== extra?.value).length : 0;
      if (extra) {
        shown = [...shown, extra].sort(byCountThenName);
        kept = extra.name;
      }
    }
  }
  const picked = new Set(spec.picked ?? []);
  const reservedShown = [NOT_RECORDED_TOKEN, NO_MATCH_TOKEN].filter((token) => (mode === "picked" ? picked.has(token) : total(token) > 0));
  const lines: Line[] = [
    ...shown.map((e): Line => ({ key: e.value, name: e.name, kind: "value", total: e.n })),
    ...reservedShown.map((token): Line => ({ key: token, name: spec.nameOf(token), kind: "reserved", total: total(token) })),
  ];
  const stands = new Set(lines.map((l) => l.key));
  const left = [...totals].filter(([value, n]) => n > 0 && !stands.has(value));
  const rest = left.length
    ? {
        total: left.reduce((sum, [, n]) => sum + n, 0),
        detail: {
          values: left.filter(([value]) => !isReserved(value)).length,
          notRecorded: left.some(([value]) => value === NOT_RECORDED_TOKEN),
          unmatched: left.some(([value]) => value === NO_MATCH_TOKEN),
          beyondCap: left.some(([value]) => value === BEYOND_CAP),
        },
      }
    : undefined;
  if (rest) lines.push({ key: "", name: REST_NAME, kind: "rest", total: rest.total });
  return { lines, mode, tiedBeyond, ...(kept ? { kept } : {}), ...(rest ? { rest: rest.detail } : {}) };
}

// The combinations of two named values with the most vehicles in the window: all that are level, ordered by the rank of their row then their column.
// A side the visitor picked values for is held to those values.
function leadersOf(
  pairs: ReadonlyMap<string, ReadonlyMap<string, number>>,
  rowSide: SideSpec,
  columnSide: SideSpec,
  rowRank: Map<string, number>,
  columnRank: Map<string, number>,
) {
  const rowPicks = rowSide.picked?.length ? new Set(rowSide.picked) : undefined;
  const columnPicks = columnSide.picked?.length ? new Set(columnSide.picked) : undefined;
  let best = 0;
  let found: { value: string; other: string; n: number }[] = [];
  for (const [value, inner] of pairs) {
    if (isReserved(value) || (rowPicks && !rowPicks.has(value))) continue;
    for (const [other, n] of inner) {
      if (isReserved(other) || (columnPicks && !columnPicks.has(other)) || n === 0 || n < best) continue;
      if (n > best) found = [];
      best = n;
      found.push({ value, other, n });
    }
  }
  found.sort((a, b) => (rowRank.get(a.value) ?? 0) - (rowRank.get(b.value) ?? 0) || (columnRank.get(a.other) ?? 0) - (columnRank.get(b.other) ?? 0));
  return { found, rowPicked: Boolean(rowPicks), columnPicked: Boolean(columnPicks) };
}

// The grid for one window.
export function gridOf(input: GridInput): Grid {
  const { from, to, basis, floor, stepFractions } = input;
  const pairs = new Map<string, Map<string, number>>();
  const rowSums = new Map<string, number>();
  const columnSums = new Map<string, number>();
  const rowSeen = new Set<string>();
  const columnSeen = new Set<string>();
  for (const r of input.rows) {
    if (r.n === 0) continue;
    rowSeen.add(r.value);
    columnSeen.add(r.other);
    if (r.month < from || r.month > to) continue;
    let inner = pairs.get(r.value);
    if (!inner) pairs.set(r.value, (inner = new Map()));
    inner.set(r.other, (inner.get(r.other) ?? 0) + r.n);
    rowSums.set(r.value, (rowSums.get(r.value) ?? 0) + r.n);
    columnSums.set(r.other, (columnSums.get(r.other) ?? 0) + r.n);
  }
  // The answer is worked out over the whole window, whatever the cut, and its row and column are kept on the grid.
  const rank = (sums: Map<string, number>, nameOf: (v: string) => string) =>
    new Map(rankByCount([...sums].map(([value, n]) => ({ value, name: nameOf(value), n }))).map((e, i) => [e.value, i] as const));
  const led = leadersOf(pairs, input.rowSide, input.columnSide, rank(rowSums, input.rowSide.nameOf), rank(columnSums, input.columnSide.nameOf));
  const first = led.found[0];
  const rows = chooseSide(rowSums, input.rowSide, rowSeen, first?.value);
  const columns = chooseSide(columnSums, input.columnSide, columnSeen, first?.other);
  const restRow = rows.lines.findIndex((l) => l.kind === "rest");
  const restColumn = columns.lines.findIndex((l) => l.kind === "rest");
  const indexOf = (side: Side, rest: number) => {
    const at = new Map(side.lines.flatMap((l, i) => (l.kind === "rest" ? [] : [[l.key, i] as const])));
    return (value: string) => at.get(value) ?? rest;
  };
  const rowAt = indexOf(rows, restRow);
  const columnAt = indexOf(columns, restColumn);

  const counts = rows.lines.map(() => columns.lines.map(() => 0));
  for (const [value, inner] of pairs) {
    for (const [other, n] of inner) {
      // A value that is not shown always has the line for the rest, which exists because it holds vehicles.
      counts[rowAt(value)][columnAt(other)] += n;
    }
  }
  const rowTotals = counts.map((line) => line.reduce((a, b) => a + b, 0));
  const columnTotals = columns.lines.map((_, j) => counts.reduce((sum, line) => sum + line[j], 0));
  const total = rowTotals.reduce((a, b) => a + b, 0);

  const base = (i: number, j: number) => (basis === "all" ? total : basis === "row" ? rowTotals[i] : basis === "column" ? columnTotals[j] : Infinity);
  const figureOf = (i: number, j: number): number | null => {
    if (basis === "count") return counts[i][j];
    const b = base(i, j);
    return b > 0 ? counts[i][j] / b : null;
  };
  const greyedAt = (i: number, j: number) => {
    if (basis === "count") return false;
    const b = base(i, j);
    return b > 0 && b < floor;
  };
  // A unit is a whole number of vehicles, or of tenths of a percent as printed, so a threshold and the figure printed are the same figure.
  const unitOf = (i: number, j: number) => {
    const figure = figureOf(i, j);
    if (figure === null || counts[i][j] === 0) return 0;
    return basis === "count" ? counts[i][j] : Math.max(1, printedTenths(figure));
  };
  const shades = (i: number, j: number) =>
    rows.lines[i].kind !== "rest" && columns.lines[j].kind !== "rest" && !greyedAt(i, j) && figureOf(i, j) !== null;
  let max = 0;
  rows.lines.forEach((_, i) => columns.lines.forEach((__, j) => shades(i, j) && (max = Math.max(max, unitOf(i, j)))));
  // The step's upper end: a fraction of the largest, whole, never under 1 and never less than the step before it.
  const upper: number[] = [];
  stepFractions.forEach((fraction, k) => upper.push(Math.max(1, k === stepFractions.length - 1 ? max : Math.round(fraction * max), upper[k - 1] ?? 1)));
  const stepOf = (unit: number) => (unit <= 0 || max === 0 ? 0 : upper.findIndex((u) => unit <= u) + 1 || upper.length);

  const cells = counts.map((line, i) =>
    line.map((n, j): GridCell => {
      const shaded = shades(i, j);
      return { n, figure: figureOf(i, j), step: shaded ? stepOf(unitOf(i, j)) : 0, greyed: greyedAt(i, j) };
    }),
  );
  // Only the steps a cell is drawn in: a grid that is greyed throughout has none.
  const used = new Set(cells.flat().map((c) => c.step));
  const legend: Grid["legend"] = [];
  upper.forEach((u, k) => {
    const lo = k === 0 ? 1 : upper[k - 1] + 1;
    if (u >= lo && used.has(k + 1)) legend.push({ step: k + 1, from: lo, to: u });
  });

  const wholeGreyed = basis !== "count" && total > 0 && total < floor;
  const greyedRows = basis === "row" ? rowTotals.flatMap((t, i) => (t > 0 && t < floor ? [i] : [])) : [];
  const greyedColumns = basis === "column" ? columnTotals.flatMap((t, j) => (t > 0 && t < floor ? [j] : [])) : [];

  const name = (side: SideSpec, value: string) => ({ key: value, name: side.nameOf(value) });
  // Only the first of several level leaders has its row and column kept on the grid, so a later one can sit in the rest line; the sentence says so.
  const stands = (side: Side, value: string) => side.lines.some((l) => l.kind !== "rest" && l.key === value);
  const leaders = led.found.map(
    (l): Leader => ({ row: name(input.rowSide, l.value), column: name(input.columnSide, l.other), n: l.n, inRest: !stands(rows, l.value) || !stands(columns, l.other) }),
  );
  return {
    basis, rows, columns, cells, rowTotals, columnTotals, total, legend, wholeGreyed, greyedRows, greyedColumns, leaders,
    leadersAmong: { rows: led.rowPicked, columns: led.columnPicked },
  };
}

// ---- The table ----
//
// The grid as a table of figures, the one the page draws and the file of figures writes (src/lib/figures.ts). A cell is its text, the figure
// behind the text, and, where it has one, a mark. The last column and the last row are totals: vehicles, whatever the cells hold.

export type TableWords = {
  rowHead: string;
  // The heading of the totals: "All" where the cells are vehicles, "Vehicles" where they are shares.
  totalCount: string;
  totalShare: string;
  // pct is the page's own formatter for a share: the file's figure is read back from what it prints.
  format: { count: (n: number) => string; pct: (x: number) => string };
  // Why a share is greyed, and why it has no value, in the words of the file and of the page.
  thin: string;
  noBase: { row: string; column: string };
};

// csv is a number, or "<" and a number for a share that is more than nothing and prints as 0.0 (the file says so in a note), or nothing.
export type TableCell = { text: string; csv: number | string | null; step: number; mark?: "greyed" | "withheld"; reason?: string; tiny?: boolean };
export type TableRow = { head: string; kind: LineKind | "total"; cells: TableCell[] };
export type Table = { rowHead: string; columns: { name: string; kind: LineKind | "total" }[]; rows: TableRow[]; hasTiny: boolean };

// The figure a printed share stands for, read back from the text so the file cannot differ from the page.
const figureOfText = (text: string): number => Number(text.replace("%", ""));

export function gridTable(grid: Grid, w: TableWords): Table {
  const shares = grid.basis !== "count";
  const totalHead = shares ? w.totalShare : w.totalCount;
  const count = (n: number): TableCell => ({ text: w.format.count(n), csv: n, step: 0 });
  // A share above zero that prints as nothing is told from a true zero by a less-than sign, here and in the file.
  const least = w.format.pct(1 / 1000);
  const shareCell = (n: number, figure: number): { text: string; csv: number | string; tiny: boolean } => {
    const text = w.format.pct(figure);
    if (n > 0 && figureOfText(text) === 0) return { text: `<${least}`, csv: `<${least.replace("%", "")}`, tiny: true };
    return { text, csv: figureOfText(text), tiny: false };
  };
  let hasTiny = false;
  const rows: TableRow[] = grid.rows.lines.map((line, i) => ({
    head: line.name,
    kind: line.kind,
    cells: [
      ...grid.columns.lines.map((_, j): TableCell => {
        const c = grid.cells[i][j];
        if (!shares) return { text: w.format.count(c.n), csv: c.n, step: c.step };
        if (c.figure === null) {
          const reason = grid.basis === "row" ? w.noBase.row : w.noBase.column;
          return { text: "—", csv: null, step: 0, mark: "withheld", reason };
        }
        const s = shareCell(c.n, c.figure);
        hasTiny ||= s.tiny;
        return c.greyed ? { text: s.text, csv: s.csv, step: 0, mark: "greyed", reason: w.thin, tiny: s.tiny } : { text: s.text, csv: s.csv, step: c.step, tiny: s.tiny };
      }),
      count(grid.rowTotals[i]),
    ],
  }));
  rows.push({ head: totalHead, kind: "total", cells: [...grid.columnTotals.map(count), count(grid.total)] });
  return {
    rowHead: w.rowHead,
    columns: [...grid.columns.lines.map((l) => ({ name: l.name, kind: l.kind })), { name: totalHead, kind: "total" as const }],
    rows,
    hasTiny,
  };
}

// The table as the file of figures: the row heading first, then a column for each column of the grid. The columns of shares are headed (%)
// by the file; the last column and the last row hold vehicles, which the notes of the file say.
export function tableFigures(table: Table, basis: Basis, period: string, notes: string[]): Figures {
  const shares = basis !== "count";
  const columns: Column[] = [
    { name: table.rowHead, key: "name", text: true },
    ...table.columns.map((c, k): Column => ({ name: c.name, key: `c${k}`, unit: shares && c.kind !== "total" ? "percent" : "count" })),
  ];
  const rows: FigureCell[][] = table.rows.map((r) => [
    r.head,
    ...r.cells.map((c): FigureCell => ({ text: c.text, csv: c.csv, ...(c.mark ? { mark: c.mark, reason: c.reason } : {}) })),
  ]);
  return { period, columns, rows, notes };
}
