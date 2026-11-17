// Measures computed in the browser from n and denominator (docs/CUBE_SCHEMA.md, docs/METRICS.md).
import { NOT_RECORDED_TOKEN, addMonths, monthRange } from "./sentences";
import { chartDefaults, findDerived, findMeasure, findPeriod, shareChangeUnit } from "./config";
import type { Guards } from "./config";
import { isInside } from "./rolling";
import type { Covers } from "./rolling";

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

export { addMonths, monthLabel, monthRange } from "./sentences";

export const monthDate = (key: string) => new Date(`${key}-01T00:00:00Z`);



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

// Whether the window a chart draws holds any vehicle with no value of the breakdown. The rows hold every month loaded and a chart
// draws only its period, so a sentence about a not-recorded part must be judged on the window, never on all the rows.
export function notRecordedDrawn(rows: { month: string; value: string; n: number }[], periodId: string | undefined, latest: string): boolean {
  if (rows.length === 0) return false;
  const first = rows.reduce((m, r) => (r.month < m ? r.month : m), rows[0].month);
  const win = periodWindow(periodId, first, latest);
  return rows.some((r) => r.value === NOT_RECORDED_TOKEN && r.n > 0 && r.month >= win.from && r.month <= win.to);
}

// Sum of n and of denominator over a month range, for trailing-window shares. `missing` counts the months the denominator has no
// figure for: with the dataset's months known (rolling.ts, zeroInside) those lie outside them, and a window that has any is not
// a window of the dataset's months, so it has no figure. A month inside them with nothing kept is a zero and is not missing.
export function windowShare(
  from: string,
  to: string,
  nFor: (month: string) => number | undefined,
  denominatorFor: (month: string) => number | undefined,
) {
  let n = 0;
  let d = 0;
  let missing = 0;
  for (const m of monthRange(from, to)) {
    const den = denominatorFor(m);
    if (den === undefined) {
      missing++;
      continue;
    }
    d += den;
    n += nFor(m) ?? 0;
  }
  return { n, denominator: d, missing };
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
// interpolate a missing month. A month is missing when `denominatorFor` has no figure for it, and `first` is the dataset's own
// first month: the caller hands a denominator that reads a month inside the dataset's months with no rows as zero (rolling.ts,
// zeroInside), so a month in which a condition keeps nothing is not missing. A window that holds no vehicles at all has no share.
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

// A count line's value for a month, or undefined where the month is a gap: the view has rows for it (`present`), or it lies inside
// the dataset's months, where a month with no rows holds no vehicles and reads zero. A month the source does not record (`blank`)
// is a gap whatever else is true of it, and so is a month outside the dataset's months. `n` is the count where there is one.
export const counted = (
  present: (month: string) => boolean,
  covers: Covers | undefined,
  blank: (month: string) => boolean,
  n: (month: string) => number | undefined,
) => (month: string): number | undefined => (!blank(month) && (present(month) || isInside(covers, month)) ? (n(month) ?? 0) : undefined);

// The 12-month running total at `to`: the sum of the window's months, or undefined (the line breaks) if any month is a gap. A month
// in which nothing is counted but which lies inside the dataset reads zero, so it is not a gap (counted, above).
export function windowTotal(to: string, at: (month: string) => number | undefined, months = TRAILING_MONTHS): number | undefined {
  let sum = 0;
  for (const m of monthRange(addMonths(to, -(months - 1)), to)) {
    const v = at(m);
    if (v === undefined) return undefined;
    sum += v;
  }
  return sum;
}
