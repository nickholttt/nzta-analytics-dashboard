// The cut of a page's lists by one value of a field (the powertrain, on the site): which values get a one-tap link, and the cuts of a field's counts
// restricted to each. Pure and free of any domain word: the field and its values come from the data and the reference files, so a value added to
// the register is one more chip with no code change (CLAUDE.md invariant 1).
import { Cut } from "./conditionViews";
import type { FactColumns } from "./conditionViews";
import { isReservedValue } from "./chartSentence";
import type { SliceRow } from "./data";

// The values that get a link: those with at least `minimum` vehicles over `months` in the field's slice, in the order of `order` (the first appearance of
// each value in the reference file), then any other by name. A hidden count has no vehicles to count, so it gives no chip. The order does not move with the data.
export function chipValues(slice: readonly SliceRow[] | undefined, months: readonly string[], minimum: number, order: readonly string[]): string[] {
  if (!slice) return [];
  const wanted = new Set(months);
  const sums = new Map<string, number>();
  for (const r of slice) if (wanted.has(r.month) && !r.hidden && !r.notBrokenDown && Number.isFinite(r.n) && !isReservedValue(r.value)) sums.set(r.value, (sums.get(r.value) ?? 0) + r.n);
  const enough = [...sums].filter(([, n]) => n >= minimum).map(([v]) => v);
  const listed = order.filter((v) => enough.includes(v));
  return [...listed, ...enough.filter((v) => !order.includes(v)).sort()];
}

// The first appearance of each value of a column of a reference file, in the file's order.
export function firstAppearance(values: readonly string[]): string[] {
  const out: string[] = [];
  for (const v of values) if (!out.includes(v)) out.push(v);
  return out;
}

export type CutSet = {
  // The restricting field's values the cuts were made for.
  values: readonly string[];
  // For each field: its cut of all the vehicles, and its cut of the vehicles of each value, by value.
  fields: Readonly<Record<string, { all: Cut; by: ReadonlyMap<string, Cut> }>>;
};

// The cuts of each of `fields` by `condition`, once for all the vehicles and once for each value of `restrict`. Nothing unless every one of them holds to the
// data: the restricting field's own cut agrees with its slice month by month, each field's cut agrees with its slice, and the cuts of each value of
// `restrict` add up to the cut of all (so no vehicle is in two lists and none is missing from them). Where it does not, the pages are drawn without it.
export function cutSet(
  columns: FactColumns,
  condition: string,
  order: readonly string[],
  fields: readonly string[],
  restrict: string,
  slices: Readonly<Record<string, readonly SliceRow[] | undefined>>,
): CutSet | undefined {
  const own = Cut.from(columns, restrict, condition, order);
  if (!own || !own.agreesWith(slices[restrict])) return undefined;
  const values = own.values([...new Set(columns.month)]).sort();
  const out: Record<string, { all: Cut; by: Map<string, Cut> }> = {};
  for (const field of fields) {
    const all = Cut.from(columns, field, condition, order);
    if (!all || !all.agreesWith(slices[field])) return undefined;
    const by = new Map<string, Cut>();
    for (const value of values) {
      const part = Cut.from(columns, field, condition, order, { field: restrict, value });
      if (!part) return undefined;
      by.set(value, part);
    }
    if (!all.agreesWithSum([...by.values()])) return undefined;
    out[field] = { all, by };
  }
  return { values, fields: out };
}
