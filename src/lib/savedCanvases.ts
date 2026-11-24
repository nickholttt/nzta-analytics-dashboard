// My canvases: the canvases a visitor saved, kept in this browser and nowhere else, under the rules of My questions (src/lib/saved.ts,
// D-125): no account, nothing sent, read defensively. A saved canvas is a canvas link, so it opens through the same validation as any
// link and a canvas has one spelling. What is kept is that link's query, a name the visitor can edit and when it was saved. The name is
// never in a link.
import { isMonthKey } from "./builder";
import type { Vocabulary } from "./builder";
import { CANVAS_PATH, canvasAddress, canvasSpec, pinCanvas, readCanvas, settleCanvas } from "./canvas";
import type { Manifest } from "./data";
import type { Kind, Saved } from "./saved";

const STORAGE_KEY = "nzta.my_canvases";
// A canvas is up to twelve questions, each with its values and filters, so its link is longer than a question's.
const MAX_QUERY = 16000;
const MONTH = "month";

// The canvas's own parameters of an address, and nothing else: its charts in order, then for each chart its question, its type, its
// width and its own settings. Undefined where the address names no chart, or the canvas is too long to keep. The month a ranking ends
// in is left out, as it is from a saved question: a saved canvas looks at the newest month unless it is pinned.
export function canvasQuery(search: string): string | undefined {
  const ids = readCanvas(search).map((chart) => chart.id);
  if (ids.length === 0) return undefined;
  const kept = new URLSearchParams({ [`${canvasSpec.id}.charts`]: ids.join(",") });
  const own = [...new URLSearchParams(search)].filter(([k]) => {
    const [scope, ...rest] = k.split(".");
    return ids.includes(scope) && rest.length > 0 && rest.join(".") !== MONTH;
  });
  // One order whatever order the address has them in, so the same canvas is the same text: chart by chart, each chart's parameters by
  // name, and a name that repeats (a value) in the order it came.
  const chartOf = (k: string) => ids.indexOf(k.split(".")[0]);
  own.sort(([a], [b]) => chartOf(a) - chartOf(b) || (a < b ? -1 : a > b ? 1 : 0));
  for (const [k, v] of own) kept.append(k, v);
  const text = kept.toString();
  return text.length <= MAX_QUERY ? text : undefined;
}

export const CANVASES: Kind = { key: STORAGE_KEY, keep: canvasQuery, maxQuery: MAX_QUERY };

// Where a saved canvas opens: the canvas page, with the canvas in the address.
export const canvasHref = (entry: Pick<Saved, "query">): string => `${CANVAS_PATH}?${entry.query}`;

// The list as plain text a visitor can paste anywhere: each name, then its link, in the order listed.
export const canvasLinks = (items: Saved[], origin: string): string => items.map((i) => `${i.name}\n${origin}${canvasHref(i)}`).join("\n\n");

// The month a saved canvas is pinned to: its first pinned chart's. Undefined for a canvas with no pin.
export function savedPin(query: string): string | undefined {
  const params = new URLSearchParams(query);
  return readCanvas(`?${query}`).map((chart) => params.get(`${chart.id}.snapshot`) ?? undefined).find(isMonthKey);
}

// A saved canvas pinned to a month, or with its pins taken off (null), as the text that is kept. Each chart keeps its own settings. The
// same text where nothing changes: no chart of it can be pinned.
export function pinSavedCanvas(all: Vocabulary, manifest: Manifest, query: string, month: string | null): string {
  const search = `?${query}`;
  const pinned = pinCanvas(settleCanvas(all, readCanvas(search)), manifest, month);
  return canvasQuery(`?${canvasAddress(search, pinned)}`) ?? query;
}
