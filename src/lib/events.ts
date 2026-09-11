// The events layer, per docs/EVENTS_LAYER.md: markers only where an event's scope meets the chart's
// dimension, windowed events as bands, measurement events styled apart, at most 8 markers.
import { scopeAliases, scopeWithoutValues } from "./config";
import type { Event } from "./data";

export const MAX_MARKERS = 8;
export const MEASUREMENT = "measurement";
export const MEASUREMENT_WARNING = "This reflects a change in how the data was recorded, not a change in the market.";

export type Marker = { label: string; date: string; dateEnd: string | null; measurement: boolean; events: Event[] };

export function selectEvents(events: Event[], dimensionId: string, categories: Set<string>, fromIso: string, toIso: string) {
  const scoped: Event[] = [];
  const unscoped: Event[] = [];
  for (const e of events) {
    // Never beyond the latest snapshot or before the chart starts.
    if (e.date_start > toIso || (e.date_end ?? e.date_start) < fromIso) continue;
    if (scopeWithoutValues.includes(e.scope)) {
      unscoped.push(e);
      continue;
    }
    const dim = scopeAliases[e.scope] ?? e.scope;
    if (dim !== dimensionId) continue;
    if (e.scope_values.length === 0 || e.scope_values.some((v) => categories.has(v))) scoped.push(e);
  }
  return { scoped, unscoped };
}

export function markersFor(events: Event[]): Marker[] {
  const sorted = [...events].sort((a, b) => a.date_start.localeCompare(b.date_start));
  if (sorted.length <= MAX_MARKERS) {
    return sorted.map((e, i) => ({
      label: String(i + 1),
      date: e.date_start,
      dateEnd: e.date_end,
      measurement: e.mechanism === MEASUREMENT,
      events: [e],
    }));
  }
  // Beyond the cap, one marker per year.
  const byYear = new Map<string, Event[]>();
  for (const e of sorted) byYear.set(e.date_start.slice(0, 4), [...(byYear.get(e.date_start.slice(0, 4)) ?? []), e]);
  return [...byYear.entries()].map(([year, list]) => ({
    label: `${year} (${list.length})`,
    date: `${year}-01-01`,
    dateEnd: null,
    measurement: list.every((e) => e.mechanism === MEASUREMENT),
    events: list,
  }));
}
