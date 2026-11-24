// One colour for a value across every chart on a canvas page. Each chart works out, for itself, the values that deserve a colour of the palette
// and their order (the largest first, or by peak: its own rule); this decides which slot of the palette each of those values wears, so a value
// that is on three charts is the same colour on all three. Pure: the same list always gives the same slots, whatever order the charts happened
// to load in, and it knows no value by name (invariant 1): a value is only a field and a text.
import { SERIES_COUNT } from "./theme";

export type PageChart = {
  chart: string;
  // The field the chart breaks down by. The same text in two fields is two values, and they do not constrain each other.
  field: string;
  // The values that take a colour of the palette, in the chart's own colour-rank order, cut to the palette's size. Never the remainder or a
  // reserved token: those have colours of their own and no slot.
  values: string[];
};

// For each chart, from each value to the slot of the palette it wears there.
export type PageSlots = Map<string, Map<string, number>>;

// A chart as a renderer registers itself: where it sits on the page, besides what it draws.
export type Registration = PageChart & { place: number };

// The charts in the order of the page, whatever order they registered in. A tie (two charts claiming one place) is settled by the id, so the
// order is still one and the same.
export const registrationsInPageOrder = (registrations: Registration[]): PageChart[] =>
  [...registrations].sort((a, b) => a.place - b.place || (a.chart < b.chart ? -1 : a.chart > b.chart ? 1 : 0)).map(({ chart, field, values }) => ({ chart, field, values }));

const keyOf = (field: string, value: string) => `${field}\u0000${value}`;

// Charts in page order, in; for each chart, a map from value to palette slot out. A value that is not in its chart's map is drawn in the grey
// of a series beyond the palette.
//
// Going through the values in order of first appearance (page order, then rank), a value takes the lowest slot that no value it shares a chart
// with, anywhere on the page, already holds, and keeps it on every chart. Two values that never meet may therefore share a slot.
//
// The one case where a value's colour can differ between charts: a value that meets, across the page, more values than there are slots may find
// none free. It then takes, chart by chart, the lowest slot free on that chart, and is grey on a chart that has none.
export function assignPageColours(charts: PageChart[], slots: number = SERIES_COUNT): PageSlots {
  // For each value, the values it shares a chart with.
  const meets = new Map<string, Set<string>>();
  for (const { field, values } of charts) {
    for (const value of values) {
      let others = meets.get(keyOf(field, value));
      if (!others) meets.set(keyOf(field, value), (others = new Set()));
      for (const other of values) if (other !== value) others.add(keyOf(field, other));
    }
  }

  const slotOf = new Map<string, number>();
  const unplaced = new Set<string>();
  for (const { field, values } of charts) {
    for (const value of values) {
      const key = keyOf(field, value);
      if (slotOf.has(key) || unplaced.has(key)) continue;
      const taken = new Set<number>();
      for (const other of meets.get(key) ?? []) {
        const held = slotOf.get(other);
        if (held !== undefined) taken.add(held);
      }
      let slot = 0;
      while (slot < slots && taken.has(slot)) slot++;
      if (slot < slots) slotOf.set(key, slot);
      else unplaced.add(key);
    }
  }

  const result: PageSlots = new Map();
  for (const { chart, field, values } of charts) {
    const mine = new Map<string, number>();
    for (const value of values) {
      const slot = slotOf.get(keyOf(field, value));
      if (slot !== undefined) mine.set(value, slot);
    }
    const used = new Set(mine.values());
    for (const value of values) {
      if (!unplaced.has(keyOf(field, value))) continue;
      let slot = 0;
      while (slot < slots && used.has(slot)) slot++;
      if (slot < slots) {
        mine.set(value, slot);
        used.add(slot);
      }
    }
    result.set(chart, mine);
  }
  return result;
}
