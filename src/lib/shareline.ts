// A share over time, the part of it that is arithmetic: each month's figure, whether the two guards grey it, and a window's
// total for the key under the chart. Pure, so a test runs the same code the chart draws (docs/METRICS.md, "Months in which nothing
// is counted"; "What a tripped guard does").
//
// A figure that sums a window (the rolling share, the key, the representativeness guard's median) needs every month's denominator.
// Under a condition a month in which nothing is kept has no rows. A month inside the dataset's own months with no rows holds no
// vehicles and counts as zero in a window; a month outside them is missing, and a window with one has no figure.
import { TRAILING_MONTHS, addMonths, collapsedAgainstTrailingMedian, monthRange, rollingShare, windowShare } from "./measures";
import { zeroInside } from "./rolling";
import type { Covers } from "./rolling";
import type { Greyed } from "./readout";

export type ShareLine = {
  rolling: boolean;
  // The rows' own denominator for a month: undefined where the view has no rows for it.
  own: (month: string) => number | undefined;
  // The denominator a window reads: the rows' own, zero for a month inside the dataset's months with no rows, undefined outside.
  windowed: (month: string) => number | undefined;
  // The first month a window may reach back to: the dataset's own first month, or the earliest month the rows have if that is earlier.
  first: string;
  minDenominator: number;
  collapseFraction: number;
};

export function shareLine(
  denominators: ReadonlyMap<string, number>,
  o: { rolling: boolean; covers?: Covers; rowsFirst: string; minDenominator: number; collapseFraction: number },
): ShareLine {
  const own = (month: string) => denominators.get(month);
  return {
    rolling: o.rolling,
    own,
    windowed: zeroInside(own, o.covers),
    first: o.covers && o.covers.first < o.rowsFirst ? o.covers.first : o.rowsFirst,
    minDenominator: o.minDenominator,
    collapseFraction: o.collapseFraction,
  };
}

// A value's count in a month: its row's, zero where the denominator has a figure for the month and the value has no row (the month holds
// none of it), undefined for a month the denominator has no figure for. `byMonth` is the value's counts, by month.
export const countIn = (line: ShareLine, byMonth: ReadonlyMap<string, number> | undefined, month: string): number | undefined =>
  line.windowed(month) === undefined ? undefined : (byMonth?.get(month) ?? 0);

// The figure drawn at a month for one value: its count, the denominator it rests on and the share. Monthly, the month's own; rolling,
// the window of `TRAILING_MONTHS` months ending there. `nFor` gives a value's count in a month the denominator has a figure for.
// Undefined where there is no share: a month with no rows (monthly), a window that reaches outside the dataset's months, or one that
// holds no vehicles at all.
export function figureAt(line: ShareLine, month: string, nFor: (month: string) => number | undefined) {
  if (!line.rolling) {
    const den = line.own(month);
    const n = nFor(month);
    if (!den || n === undefined) return undefined;
    return { share: n / den, n, denominator: den };
  }
  const r = rollingShare(month, line.first, nFor, line.windowed);
  return r ? { share: r.share, n: r.n, denominator: r.denominator } : undefined;
}

// The denominator a month's figure rests on, for the precision guard: the month's own, or the window's total. Undefined where
// there is none (no rows in a month; a window that reaches outside the dataset's months).
export function basisAt(line: ShareLine, month: string): number | undefined {
  if (!line.rolling) return line.own(month);
  const from = addMonths(month, -(TRAILING_MONTHS - 1));
  if (from < line.first) return undefined;
  let total = 0;
  for (const m of monthRange(from, month)) {
    const den = line.windowed(m);
    if (den === undefined) return undefined;
    total += den;
  }
  return total;
}

// Which guard greys a month, if either. The precision floor reads the denominator behind the drawn figure (basisAt); the
// representativeness guard reads the month's own denominator against the median of the 12 months before it, for a monthly share
// only: a 12-month figure spans a year, so one collapsed month does not make its window unrepresentative. An absent figure is not
// greyed, it is absent.
export function greyedAt(line: ShareLine, month: string): Greyed | undefined {
  const basis = basisAt(line, month);
  if (basis !== undefined && basis < line.minDenominator) return "thin";
  if (!line.rolling && line.own(month) !== undefined && collapsedAgainstTrailingMedian(month, line.windowed, line.collapseFraction)) return "collapsed";
  return undefined;
}

// A window's vehicles and total for the key under the chart, with how many of its months are outside the dataset's months. A window
// with any is not a window of the dataset, and the key shows no figure for it.
export function keyWindow(line: ShareLine, from: string, to: string, nFor: (month: string) => number | undefined) {
  return windowShare(from, to, nFor, line.windowed);
}
