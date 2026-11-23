// Whether two months a sentence compares lie either side of a change in how the data is recorded (CLAUDE.md invariant 7; the `mechanism`
// column of data/reference/events.csv, docs/EVENTS_LAYER.md). A change across such an event may be the recording and not the market, so a
// sentence does not state it: it keeps the figure for the later month and leaves the comparison out. Pure over the events it is given.
import { scopeAliases, scopeWithoutValues } from "./config";
import type { Event } from "./data";
import { MEASUREMENT } from "./events";

// What the chart counts, as far as an event's scope can be matched to it: the field it is broken down by and the values it shows. None of
// either is a chart of the total, which every event's vehicles are inside.
export type RecordingScope = { dimension?: string; values?: ReadonlySet<string> };

// True when an event that changed the recording lies within the months from `from` to `to` (each "YYYY-MM", both included) and touches what
// the chart counts; false when none does; undefined while the events are not loaded, when nothing can be said and the comparison is not made.
// An event with no date cannot be placed in time (the chart's marker layer leaves it out as well), so it does not count.
export function recordingChange(events: readonly Event[] | null, from: string, to: string, scope: RecordingScope = {}): boolean | undefined {
  if (!events) return undefined;
  const start = `${from}-01`;
  const end = `${to}-31`;
  return events.some((e) => {
    if (e.mechanism !== MEASUREMENT || !e.date_start) return false;
    if (e.date_start > end || (e.date_end ?? e.date_start) < start) return false;
    if (scopeWithoutValues.includes(e.scope)) return true;
    // An event scoped to the field the chart is broken down by, for values the chart does not show, does not touch it. Any other event's
    // vehicles are inside every total, so it does.
    const own = (scopeAliases[e.scope] ?? e.scope) === scope.dimension;
    return !(own && scope.values && e.scope_values.length > 0 && !e.scope_values.some((v) => scope.values?.has(v)));
  });
}
