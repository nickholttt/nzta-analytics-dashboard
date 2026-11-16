// The rolling mix, apart from the chart code so a test can run it without the site's config: pure, over rows and numbers.
import type { SliceRow } from "./data";
import { monthAt, monthIndex } from "./sentences.ts";

export const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");

// The rolling mix at each month: shares over the trailing window, so the count of categories above
// the line does not flicker with monthly noise. Windows thinner than the precision floor, or missing
// a month, produce nothing — the same rule the rolling share uses.
export function rollingMix(rows: SliceRow[], minDenominator: number, window: number) {
  const denominators = new Map<number, number>();
  const counts = new Map<string, Map<number, number>>();
  for (const r of rows) {
    if (isReserved(r.value)) continue;
    const at = monthIndex(r.month);
    denominators.set(at, r.denominator);
    let byMonth = counts.get(r.value);
    if (!byMonth) counts.set(r.value, (byMonth = new Map()));
    byMonth.set(at, r.n);
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
    if (missing || total < minDenominator) continue;
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
