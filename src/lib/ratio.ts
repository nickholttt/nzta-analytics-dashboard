// The arithmetic of a ratio of two datasets (docs/METRICS.md): one dataset's vehicles as a share of another's for the same
// month and value. Pure, with no imports, so tests/site/ runs it with Node's own test runner. derived.ts supplies what needs
// config (the guards, the trailing-median test) and chart code draws the result.

type Row = { month: string; value: string; n: number; denominator: number };

export const isReserved = (value: string) => value.startsWith("__") && value.endsWith("__");

export type RatioPoint = { month: string; value: number; n: number; denominator: number };
// series "" is the total over every value of the dimension.
export type RatioSeries = { series: string; points: RatioPoint[] };

export type RatioLeaves = {
  // The precision floor: a denominator under it is not divided by.
  floor: number;
  // Months far below their own recent history (the representativeness guard): left out for every line.
  collapsed: ReadonlySet<string>;
  // Months in which the denominator's source records nothing of the breakdown: there is no value to divide by.
  unrecorded: ReadonlySet<string>;
};

// Each line holds only the months that pass: a month that fails a guard, or has no value to divide by, is not in `points`.
// A chart must not join the months either side of it (lineMonths below), and a ratio above 1 is kept as it is.
export function ratioCore(numerator: readonly Row[], denominator: readonly Row[], leaves: RatioLeaves): RatioSeries[] {
  const have = new Set(numerator.map((r) => r.month));
  const numCell = new Map(numerator.map((r) => [`${r.month}|${r.value}`, r.n]));
  const numTotal = new Map(numerator.map((r) => [r.month, r.denominator]));
  const denTotal = new Map(denominator.map((r) => [r.month, r.denominator]));
  const months = [...denTotal.keys()].sort();
  const usable = (m: string, base: number) => have.has(m) && !leaves.collapsed.has(m) && !leaves.unrecorded.has(m) && base >= leaves.floor && base > 0;
  const values = [...new Set(denominator.filter((r) => !isReserved(r.value)).map((r) => r.value))].sort();
  const total: RatioSeries = { series: "", points: [] };
  for (const m of months) {
    const base = denTotal.get(m) as number;
    const n = numTotal.get(m) ?? 0;
    if (usable(m, base)) total.points.push({ month: m, value: n / base, n, denominator: base });
  }
  const byValue = values.map((v): RatioSeries => {
    const points: RatioPoint[] = [];
    for (const r of denominator) {
      if (r.value !== v || !usable(r.month, r.n)) continue;
      const n = numCell.get(`${r.month}|${v}`) ?? 0;
      points.push({ month: r.month, value: n / r.n, n, denominator: r.n });
    }
    return { series: v, points: points.sort((a, b) => a.month.localeCompare(b.month)) };
  });
  return [total, ...byValue].filter((s) => s.points.length > 0);
}

const after = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + m;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

// A line's value for every month from `from` to `to`: undefined for a month it leaves out, so a chart breaks the line there
// and never draws a stroke across it (docs/METRICS.md: never interpolate a missing month).
export function lineMonths(points: readonly RatioPoint[], from: string, to: string): { month: string; value?: number }[] {
  const at = new Map(points.map((p) => [p.month, p.value]));
  const out: { month: string; value?: number }[] = [];
  for (let m = from; m <= to; m = after(m)) out.push({ month: m, value: at.get(m) });
  return out;
}

// The months a broken line cannot show as a stroke: a month with a value whose neighbours either side have none. A chart
// draws each as a dot, so a figure standing alone between gaps is still seen.
export function isolatedMonths(line: readonly { month: string; value?: number }[]): string[] {
  return line.filter((p, i) => p.value !== undefined && line[i - 1]?.value === undefined && line[i + 1]?.value === undefined).map((p) => p.month);
}
