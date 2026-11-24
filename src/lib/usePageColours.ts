// How the charts of a canvas page share their colours (src/lib/pageColours.ts). A renderer on a card registers the values it gives a colour to, in
// its own colour-rank order, and is told the slot of the palette each of them wears on the page. A value that is on three charts is then one
// colour on all three. Where there is no card (the status page), nothing is registered and a renderer colours by its own rank, as it always did.
import { createContext, useContext, useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { assignPageColours, registrationsInPageOrder } from "./pageColours";
import type { PageSlots, Registration } from "./pageColours";

// Which chart this is, and where it sits on the page. Set by the card around the panel; absent outside a card.
export type PageChartContext = { chart: string; place: number };
export const PageChartContext = createContext<PageChartContext | null>(null);

// The page's charts, by id. Module-level on purpose: the charts are separate islands of one page and meet nowhere else.
const registered = new Map<string, Registration>();
let slots: PageSlots = new Map();
const listeners = new Set<() => void>();

const sameSlots = (a: Map<string, number> | undefined, b: Map<string, number> | undefined) =>
  a !== undefined && b !== undefined && a.size === b.size && [...a].every(([value, slot]) => b.get(value) === slot);

// Worked out again from every chart registered, in the order of the page, so the answer never depends on the order the charts arrived in. A chart
// whose slots did not change keeps its map, so it does not redraw because another chart arrived.
function recompute() {
  const next = assignPageColours(registrationsInPageOrder([...registered.values()]));
  let changed = next.size !== slots.size;
  for (const [chart, mine] of next) {
    const before = slots.get(chart);
    if (sameSlots(before, mine)) next.set(chart, before as Map<string, number>);
    else changed = true;
  }
  if (!changed) return;
  slots = next;
  for (const listener of listeners) listener();
}

function register(entry: Registration): () => void {
  registered.set(entry.chart, entry);
  recompute();
  return () => {
    if (registered.get(entry.chart) !== entry) return;
    registered.delete(entry.chart);
    recompute();
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const snapshot = () => slots;

// Registers this chart's values and returns the slot of the palette each wears on the page, or undefined where there is no card to share colours
// with, or the chart is not yet known to the page (it then colours by its own rank for the moment before it is). A value of the chart that is
// not given a slot is one the page has no colour left for: it is drawn in the grey of a series beyond the palette.
// values: in the chart's own colour-rank order, cut to the palette's size, never the remainder or a reserved token. Keep it to a stable list; a
// change of what it holds registers the chart again, and nothing else does.
export function usePageColours(field: string | undefined, values: string[]): ((value: string) => number | undefined) | undefined {
  const where = useContext(PageChartContext);
  const key = JSON.stringify([where?.chart, where?.place, field, values]);
  // In a layout effect, so the first colours are the page's and not the chart's own, before the chart is painted.
  useLayoutEffect(() => {
    if (!where || field === undefined) return;
    return register({ chart: where.chart, place: where.place, field, values });
    // The key is what the registration is made of.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const all = useSyncExternalStore(subscribe, snapshot, snapshot);
  const mine = where && field !== undefined ? all.get(where.chart) : undefined;
  return useMemo(() => (mine ? (value: string) => mine.get(value) : undefined), [mine]);
}
