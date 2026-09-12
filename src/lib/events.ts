// The events layer, per docs/EVENTS_LAYER.md: markers only where an event's scope meets the chart's
// dimension, windowed events as bands, measurement events styled apart, at most 8 visible markers.
//
// Collision handling is two steps, because neither alone is enough. Events closer together than a
// label is wide are clustered into one numbered marker that the list below expands — the documented
// cap drives how hard the clustering has to work. What survives clustering is then given a lane, so
// clusters that are still close print as a column rather than on top of each other.
import { scopeAliases, scopeWithoutValues } from "./config";
import type { Event } from "./data";

export const MAX_MARKERS = 8;
export const MAX_LANES = 4;
export const MEASUREMENT = "measurement";
export const MEASUREMENT_WARNING = "This reflects a change in how the data was recorded, not a change in the market.";

// Fractions of the x domain. Two events closer than MERGE become one marker; two markers closer than
// CLEAR need different lanes for their labels to be readable.
const MERGE_SEPARATION = 0.02;
const CLEAR_SEPARATION = 0.075;

export type Marker = { label: string; date: string; measurement: boolean; events: Event[] };
export type LanedMarker = Marker & { lane: number };

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

const monthIso = (month: string) => `${month}-01T00:00:00Z`;

function positioner(domainFrom: string, domainTo: string) {
  const start = Date.parse(monthIso(domainFrom));
  const span = Date.parse(monthIso(domainTo)) - start;
  return (iso: string) => (span > 0 ? (Date.parse(iso) - start) / span : 0);
}

function group(sorted: Event[], at: (iso: string) => number, separation: number): Event[][] {
  const groups: Event[][] = [];
  for (const e of sorted) {
    const last = groups[groups.length - 1];
    if (last && at(e.date_start) - at(last[0].date_start) < separation) last.push(e);
    else groups.push([e]);
  }
  return groups;
}

// A cluster's label sits on its first event, never between its events: at the centroid the numeral
// points at empty axis, and a reader tracing down from it lands on whichever rule happens to be
// nearest, which may not be one of the events it covers. Anchored first, it always points at a real
// date. Every event keeps its own rule regardless, so clustering never moves one. The label says how
// many are folded in; the list below expands them.
function toMarker(events: Event[], index: number): Marker {
  return {
    label: events.length === 1 ? String(index + 1) : `${index + 1} (${events.length})`,
    date: events[0].date_start,
    measurement: events.every((e) => e.mechanism === MEASUREMENT),
    events,
  };
}

export function markersFor(events: Event[], domainFrom: string, domainTo: string): Marker[] {
  const sorted = [...events].sort((a, b) => a.date_start.localeCompare(b.date_start));
  if (sorted.length === 0) return [];
  const at = positioner(domainFrom, domainTo);
  // Widen the merge until the documented cap is met. A chart whose whole span is a century folds its
  // events into a handful of clusters; a chart of the last few years barely merges at all.
  let separation = MERGE_SEPARATION;
  let groups = group(sorted, at, separation);
  while (groups.length > MAX_MARKERS && separation < 1) {
    separation *= 1.6;
    groups = group(sorted, at, separation);
  }
  return groups.map(toMarker);
}

// Walk the markers in date order and take the lowest lane whose last marker is far enough away to
// clear. Lanes wrap once they run out, so a genuine pile-up degrades to overlap rather than marching
// off the top of the plot.
export function assignLanes(markers: Marker[], domainFrom: string, domainTo: string, separation = CLEAR_SEPARATION): LanedMarker[] {
  const at = positioner(domainFrom, domainTo);
  const lastInLane: number[] = [];
  return [...markers]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => {
      const x = at(`${m.date}T00:00:00Z`);
      let lane = lastInLane.findIndex((last) => x - last >= separation);
      if (lane === -1) lane = lastInLane.length < MAX_LANES ? lastInLane.length : 0;
      lastInLane[lane] = x;
      return { ...m, lane };
    });
}
