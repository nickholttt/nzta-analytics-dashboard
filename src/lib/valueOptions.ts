// The values of a field a visitor chooses from, counted as the chart will count them: among the vehicles the question's other conditions keep, from the one
// fact table that holds the field and every condition's field. Shared by the picker and by the page that looks for a chart's starting values; no React in it.
import { isChoosable } from "./reserved";
import { datasetLatestMonth, factView, loadManifest, loadSlice, tableHolding } from "./data";
import type { SliceRow } from "./data";
import { TRAILING_MONTHS, addMonths } from "./measures";

export type ValueOption = { value: string; recent: number; total: number };

// Values filled in when a count is broken down and none are chosen yet: a count draws one line per value, so the page starts on the
// largest few of the last 12 months, never a reserved value (not recorded, no reference match).
const STARTING_VALUES = 5;
const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");
export const startingValues = (options: readonly ValueOption[]): string[] =>
  options.filter((o) => !isReserved(o.value) && o.recent > 0).slice(0, STARTING_VALUES).map((o) => o.value);

// Every value of a breakdown, largest in the last 12 months first, then largest over all time: what a visitor most
// likely wants is at the top, and a value that has gone (a brand no longer sold) is still there to find. Counted
// among the vehicles the question's other conditions keep, so the list matches what the chart will show.
export async function valueOptions(dataset: string, dimension: string, where: Record<string, string[]>, snapshot?: string): Promise<ValueOption[]> {
  const filtered = Object.values(where).some((kept) => kept.length > 0);
  // Counted among the conditions, the list is summed from the one fact table that holds the field and every condition's field (a narrow table where the
  // wide one lacks one of them), so it is the table the chart reads.
  const [rows, manifest] = await Promise.all([
    filtered
      ? tableHolding(dataset, [dimension, ...Object.entries(where).filter(([, kept]) => kept.length > 0).map(([d]) => d)], snapshot).then((table) => factView(dataset, dimension, undefined, where, undefined, snapshot, table))
      : loadSlice(dataset, dimension, snapshot),
    loadManifest(snapshot),
  ]);
  const latest = datasetLatestMonth(manifest, dataset);
  const from = addMonths(latest, -(TRAILING_MONTHS - 1));
  const byValue = new Map<string, ValueOption>();
  for (const r of rows as SliceRow[]) {
    // A hidden count has no number to add, and a period that is not broken down has no value (D-139).
    if (r.hidden || r.notBrokenDown) continue;
    const o = byValue.get(r.value) ?? { value: r.value, recent: 0, total: 0 };
    o.total += r.n;
    if (r.month >= from && r.month <= latest) o.recent += r.n;
    byValue.set(r.value, o);
  }
  return [...byValue.values()].filter((o) => o.total > 0 && isChoosable(o.value)).sort((a, b) => b.recent - a.recent || b.total - a.total || a.value.localeCompare(b.value));
}
