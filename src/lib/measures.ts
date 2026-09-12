// Measures computed in the browser from n and denominator (docs/CUBE_SCHEMA.md, docs/METRICS.md).
import { chartDefaults, findDerived, findMeasure, findPeriod, shareChangeUnit } from "./config";
import type { Guards } from "./config";

// A preset names either a measure or a derived one, and both carry guards.
export const guardsFor = (measureId?: string, derivedId?: string): Guards =>
  findMeasure(measureId)?.guards ?? findDerived(derivedId)?.guards ?? {};
export const minDenominator = (measureId?: string, derivedId?: string) => guardsFor(measureId, derivedId).min_denominator ?? 0;
export const minShareOfTrailingMedian = (measureId?: string, derivedId?: string) =>
  guardsFor(measureId, derivedId).min_share_of_trailing_median ?? 0;

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

// Every share change goes through this formatter: 10% to 15% is +5.0 pp, never +50%.
export function shareChange(delta: number): string {
  if (shareChangeUnit !== "percentage_points") throw new Error(`unsupported share change unit: ${shareChangeUnit}`);
  const v = delta * 100;
  const sign = v > 0.05 ? "+" : v < -0.05 ? "−" : "±";
  return `${sign}${Math.abs(v).toFixed(1)} pp`;
}

export function addMonths(key: string, k: number): string {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export const monthDate = (key: string) => new Date(`${key}-01T00:00:00Z`);

export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addMonths(k, 1)) out.push(k);
  return out;
}

// The trailing window every trailing figure on the site uses: the top-N ranking basis, the rolling
// share, and the summary table's two comparison windows. One number, from config.
export const TRAILING_MONTHS = chartDefaults.trailing_window_months;

// The representativeness guard, docs/METRICS.md. A month whose denominator has collapsed against its
// own recent history describes a different population from the months either side of it, however
// precisely its percentages are measured. Compared against a median, not a mean, so one collapsed
// month does not lower the bar for the next twelve.
export function collapsedAgainstTrailingMedian(
  month: string,
  denominatorFor: (month: string) => number | undefined,
  fraction: number,
) {
  if (fraction <= 0) return false;
  const own = denominatorFor(month);
  if (own === undefined) return false;
  const prior: number[] = [];
  for (const m of monthRange(addMonths(month, -TRAILING_MONTHS), addMonths(month, -1))) {
    const den = denominatorFor(m);
    if (den !== undefined) prior.push(den);
  }
  // Nothing to compare against yet: the guard cannot fire, rather than firing by default.
  if (prior.length < TRAILING_MONTHS) return false;
  prior.sort((a, b) => a - b);
  const mid = prior.length / 2;
  const median = prior.length % 2 ? prior[Math.floor(mid)] : (prior[mid - 1] + prior[mid]) / 2;
  return median > 0 && own < median * fraction;
}

// Period lengths come from config/dimensions.json. A period the config does not list, or lists
// without a length, cannot be windowed: say so rather than guess.
export function periodWindow(periodId: string | undefined, first: string, latest: string) {
  if (!periodId || periodId === "all") return { from: first, to: latest };
  const period = findPeriod(periodId);
  if (!period) throw new Error(`period "${periodId}" is not in config/dimensions.json`);
  if (!period.months) throw new Error(`period "${periodId}" has no months in config/dimensions.json`);
  const from = addMonths(latest, -(period.months - 1));
  return { from: from < first ? first : from, to: latest };
}

// Sum of n and of denominator over a month range, for trailing-window shares.
export function windowShare(
  from: string,
  to: string,
  nFor: (month: string) => number | undefined,
  denominatorFor: (month: string) => number | undefined,
) {
  let n = 0;
  let d = 0;
  for (const m of monthRange(from, to)) {
    const den = denominatorFor(m);
    if (den === undefined) continue;
    d += den;
    n += nFor(m) ?? 0;
  }
  return { n, denominator: d };
}

// The trailing window ending at `to`, clamped so it never reaches before the data starts. Used to
// rank top-N: a ten-year volume total ranks the last decade's incumbents, which buries anything that
// arrived recently, and the arrivals are usually the story.
export const trailingWindow = (to: string, first: string) => {
  const from = addMonths(to, -(TRAILING_MONTHS - 1));
  return { from: from < first ? first : from, to };
};

// A month's rolling share: the window's n over the window's denominator, never a mean of monthly
// shares, which would weight a thin month the same as a full one. A window missing any of its months
// yields undefined and the line breaks, the same rule the running total uses — METRICS.md: never
// interpolate a missing month.
export function rollingShare(
  month: string,
  first: string,
  nFor: (month: string) => number | undefined,
  denominatorFor: (month: string) => number | undefined,
) {
  const from = addMonths(month, -(TRAILING_MONTHS - 1));
  if (from < first) return undefined;
  let n = 0;
  let denominator = 0;
  for (const m of monthRange(from, month)) {
    const den = denominatorFor(m);
    if (den === undefined) return undefined;
    denominator += den;
    n += nFor(m) ?? 0;
  }
  if (denominator === 0) return undefined;
  return { share: n / denominator, n, denominator };
}
