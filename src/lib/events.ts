// The events layer, per docs/EVENTS_LAYER.md: markers only where an event's scope meets the chart's
// dimension, windowed events as bands, measurement events styled apart, at most 8 visible markers.
//
// Collision handling is two steps, because neither alone is enough. Events close together are
// clustered into one numbered marker that the list below expands. What survives clustering is then
// given a lane, so clusters that are still close print as a column rather than on top of each other.
// Both steps are measured against the frame's width in pixels: a label is the same width on a phone
// as on a desktop, so a fraction of the axis that clears it at 1280px does not at 320px. When the
// labels cannot fit in the lanes there are, clustering works harder until they do.
import { scopeAliases, scopeWithoutValues } from "./config";
import type { Event } from "./data";

export const MAX_MARKERS = 8;
export const MAX_LANES = 4;
export const MEASUREMENT = "measurement";
export const MEASUREMENT_WARNING = "This reflects a change in how the data was recorded, not a change in the market.";

// A fraction of the x domain: two events closer than this become one marker, whatever the width.
const MERGE_SEPARATION = 0.02;
// Pixels. Labels are 11px semibold, and every character is counted as wide as a numeral (7px measured
// headless), which the space and brackets in `3 (2)` are not, so the estimate never undercuts a label.
// Labels keep the gap from each other and half of it from the frame's edges.
const LABEL_CHAR_PX = 7;
const LABEL_GAP_PX = 4;

export type Marker = { label: string; date: string; measurement: boolean; events: Event[] };
// `at` is where the label's centre sits, as a fraction of the frame. It is the marker's date unless
// that would put part of the label outside the frame.
export type LanedMarker = Marker & { lane: number; at: number };

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
// nearest, which may not be one of the events it covers. Anchored first, it points at a real date, or
// at the frame's edge when that date is outside it. Every event keeps its own rule regardless, so clustering never moves one. The label says how
// many are folded in; the list below expands them.
function toMarker(events: Event[], index: number): Marker {
  return {
    label: events.length === 1 ? String(index + 1) : `${index + 1} (${events.length})`,
    date: events[0].date_start,
    measurement: events.every((e) => e.mechanism === MEASUREMENT),
    events,
  };
}

// Each label is centred on its marker's date and slid inward just far enough to stay inside the frame,
// so a window running past the latest snapshot, or an event that began before the chart did, still
// gets a whole label at the edge it touches. Then, in order of left edge, each takes the lowest lane
// whose last label ends clear of it. Returns null when a label would need a lane beyond MAX_LANES.
// frameWidth 0 means the width is not known yet: every label is placed with no collision check.
function assignLanes(markers: Marker[], at: (iso: string) => number, frameWidth: number): LanedMarker[] | null {
  const placed = markers.map((m) => {
    const x = at(`${m.date}T00:00:00Z`);
    if (!frameWidth) return { ...m, at: Math.min(1, Math.max(0, x)), left: 0, right: 0 };
    const half = Math.min(frameWidth, m.label.length * LABEL_CHAR_PX + LABEL_GAP_PX) / 2;
    const centre = Math.min(frameWidth - half, Math.max(half, x * frameWidth));
    return { ...m, at: centre / frameWidth, left: centre - half, right: centre + half };
  });
  const rightInLane: number[] = [];
  const laned: LanedMarker[] = [];
  for (const { left, right, ...m } of [...placed].sort((a, b) => a.left - b.left)) {
    // Each interval already carries half the gap on either side.
    let lane = frameWidth ? rightInLane.findIndex((r) => r <= left) : 0;
    if (lane === -1) {
      if (rightInLane.length === MAX_LANES) return null;
      lane = rightInLane.length;
    }
    rightInLane[lane] = right;
    laned.push({ ...m, lane });
  }
  return laned.sort((a, b) => a.date.localeCompare(b.date));
}

// frameWidth is the plot frame's width in pixels, or 0 before it is known.
export function layoutMarkers(events: Event[], domainFrom: string, domainTo: string, frameWidth: number): LanedMarker[] {
  const sorted = [...events].sort((a, b) => a.date_start.localeCompare(b.date_start));
  if (sorted.length === 0) return [];
  // Grouping and placement read the same position, clamped to the frame, so events that began before
  // the chart count as being at its first month for both, as their labels are.
  const raw = positioner(domainFrom, domainTo);
  const at = (iso: string) => Math.min(1, Math.max(0, raw(iso)));
  // Widen the merge until the documented cap is met and every label has a lane. A chart whose whole
  // span is a century folds its events into a handful of clusters; a chart of the last few years
  // barely merges at all. Past a separation of 1 every event is in one group, which always fits; only
  // a date that does not parse stays apart, and then the labels are placed unchecked rather than the
  // loop running on.
  for (let separation = MERGE_SEPARATION; separation <= 1; separation *= 1.6) {
    const groups = group(sorted, at, separation);
    if (groups.length > MAX_MARKERS) continue;
    const laned = assignLanes(groups.map(toMarker), at, frameWidth);
    if (laned) return laned;
  }
  const markers = group(sorted, at, Number.POSITIVE_INFINITY).map(toMarker);
  return assignLanes(markers, at, frameWidth) ?? (assignLanes(markers, at, 0) as LanedMarker[]);
}
