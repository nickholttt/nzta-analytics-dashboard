// Derived series the trend renderer computes in the browser from the one-dimensional slices.
//
// Registered by measure id, so resolve.ts can say which derived measures have a renderer and which
// are still waiting for one. Everything a series needs beyond the slice — how many values to take,
// the suppression guards — comes from that measure's definition in config/measures.json.
import { findDerived } from "./config";
import type { DerivedMeasure, Guards } from "./config";
import { collapsedAgainstTrailingMedian } from "./measures";
import { isReserved, ratioCore } from "./ratio";
import type { RatioSeries } from "./ratio";
import { unrecordedMonths } from "./sentences";
import type { SliceRow } from "./data";

export const TOP_N_SHARE = "top_5_share";

export const RENDERED_DERIVED = new Set([TOP_N_SHARE]);

// n: the vehicles the members hold, the figure the value is a share of the denominator for.
export type DerivedPoint = { month: string; value?: number; n: number; denominator?: number; members: string[] };

// Top-N share, docs/METRICS.md: the combined share of the N largest values of the dimension in that
// month. Membership is recomputed every month, which is the whole point — a fixed five would track
// the fortunes of those five rather than how concentrated the market is. Reserved tokens never take
// a place: "no reference match" is not a brand, and on make it is a large share of the early months.
export function topNShare(rows: SliceRow[], topN: number): DerivedPoint[] {
  const byMonth = new Map<string, { denominator: number; values: { value: string; n: number }[] }>();
  for (const r of rows) {
    let month = byMonth.get(r.month);
    if (!month) byMonth.set(r.month, (month = { denominator: r.denominator, values: [] }));
    if (!isReserved(r.value) && r.n > 0) month.values.push({ value: r.value, n: r.n });
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { denominator, values }]) => {
      const top = [...values].sort((a, b) => b.n - a.n).slice(0, topN);
      const n = top.reduce((sum, v) => sum + v.n, 0);
      return {
        month,
        value: denominator > 0 ? n / denominator : undefined,
        n,
        denominator,
        members: top.map((v) => v.value),
      };
    });
}

export function derivedSeries(derivedId: string, rows: SliceRow[]): DerivedPoint[] | undefined {
  if (derivedId !== TOP_N_SHARE) return undefined;
  const topN = findDerived(derivedId)?.top_n;
  if (!topN) throw new Error(`derived measure "${derivedId}" has no top_n in config/measures.json`);
  return topNShare(rows, topN);
}

// A ratio of two datasets, docs/METRICS.md (completeness; cars still registered against a published count): one dataset's
// vehicles as a share of another's for the same month and value of a dimension. The two datasets, the dimension and the guards
// come from the measure's definition in config/measures.json, so a measure that names both datasets is drawn by this, whatever
// it is called. A month whose denominator is missing, under the precision floor, or collapsed against its own recent history is
// left out, never drawn as zero; so is a month in which the denominator's source records nothing of the breakdown, since there
// is no value to divide by. A ratio above 1 is kept as it is. The total is the datasets' own month totals.
export const isRatioMeasure = (measure?: DerivedMeasure): boolean => Boolean(measure?.numerator_dataset && measure.denominator_dataset);

export type { RatioPoint, RatioSeries } from "./ratio";

export function ratioSeries(numerator: SliceRow[], denominator: SliceRow[], guards: Guards): RatioSeries[] {
  const fraction = guards.min_share_of_trailing_median ?? 0;
  const denTotal = new Map(denominator.map((r) => [r.month, r.denominator]));
  // The month's population: a month far below its own recent history is left out for every line.
  const collapsed = new Set([...denTotal.keys()].filter((m) => collapsedAgainstTrailingMedian(m, (k) => denTotal.get(k), fraction)));
  return ratioCore(numerator, denominator, { floor: guards.min_denominator ?? 0, collapsed, unrecorded: new Set(unrecordedMonths(denominator)) });
}
