// The rolling mix, apart from the chart code so a test can run it without the site's config: pure, over rows and numbers.
import type { SliceRow } from "./data";
import { monthAt, monthIndex } from "./sentences.ts";

export const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");

// The months a dataset covers, first to last, both included: its own first month and its own newest (docs/METRICS.md, "Months in
// which nothing is counted"). A month between them in which a view's rows are absent holds no vehicles in what is counted: it is a
// month of zero, not a month the data lacks.
export type Covers = { first: string; last: string };

export const isInside = (covers: Covers | undefined, month: string): boolean => Boolean(covers) && month >= (covers as Covers).first && month <= (covers as Covers).last;

// A month's denominator as the windowed figures read it: the rows' own where they have one, zero for a month inside the dataset's
// months that has none, and still undefined (missing) for a month outside them. With the months not known, nothing is inside.
export function zeroInside(denominatorFor: (month: string) => number | undefined, covers: Covers | undefined): (month: string) => number | undefined {
  if (!covers) return denominatorFor;
  return (month) => {
    const own = denominatorFor(month);
    return own !== undefined ? own : isInside(covers, month) ? 0 : undefined;
  };
}

// The rolling mix at each month: shares over the trailing window, so the count of categories above the line does not flicker with
// monthly noise. A window thinner than the precision floor, one that holds no vehicles at all (a share of no vehicles has no value),
// or one that reaches outside the dataset's months produces nothing. Where the dataset's months are known (`covers`), a month inside
// them with no rows at all counts as zero in a window; where they are not, only a month with rows is a month. (A month whose rows
// all carry a reserved value is neither: it has no denominator here, as before, so a window across it stays blank.)
export function rollingMix(rows: SliceRow[], minDenominator: number, window: number, covers?: Covers) {
  const denominators = new Map<number, number>();
  const counts = new Map<string, Map<number, number>>();
  const seen = new Set<number>();
  for (const r of rows) {
    const at = monthIndex(r.month);
    seen.add(at);
    if (isReserved(r.value)) continue;
    denominators.set(at, r.denominator);
    let byMonth = counts.get(r.value);
    if (!byMonth) counts.set(r.value, (byMonth = new Map()));
    byMonth.set(at, r.n);
  }
  if (covers) {
    const last = monthIndex(covers.last);
    for (let at = monthIndex(covers.first); at <= last; at++) if (!seen.has(at)) denominators.set(at, 0);
  }
  // Counts laid out by calendar month, so a window is a run of cells and not a lookup of twelve strings per value.
  const months = [...denominators.keys()].sort((x, y) => x - y);
  const origin = months[0];
  const span = months.length ? months[months.length - 1] - origin + 1 : 0;
  const dense = [...counts.values()].map((byMonth) => {
    const cells = new Float64Array(span);
    for (const [at, n] of byMonth) cells[at - origin] = n;
    return cells;
  });
  const out: { month: string; shares: number[] }[] = [];
  for (const at of months) {
    const from = at - (window - 1);
    if (from < origin) continue;
    let total = 0;
    let missing = false;
    for (let m = from; m <= at; m++) {
      const d = denominators.get(m);
      if (d === undefined) {
        missing = true;
        break;
      }
      total += d;
    }
    if (missing || total === 0 || total < minDenominator) continue;
    out.push({
      month: monthAt(at),
      shares: dense.map((cells) => {
        let n = 0;
        for (let m = from; m <= at; m++) n += cells[m - origin];
        return n / total;
      }),
    });
  }
  return out;
}
