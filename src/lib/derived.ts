// Derived series the trend renderer computes in the browser from the one-dimensional slices.
//
// Registered by measure id, so resolve.ts can say which derived measures have a renderer and which
// are still waiting for one. Everything a series needs beyond the slice — how many values to take,
// the suppression guards — comes from that measure's definition in config/measures.json.
import { findDerived } from "./config";
import type { SliceRow } from "./data";

export const TOP_N_SHARE = "top_5_share";

export const RENDERED_DERIVED = new Set([TOP_N_SHARE]);

export type DerivedPoint = { month: string; value?: number; denominator?: number; members: string[] };

const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");

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
