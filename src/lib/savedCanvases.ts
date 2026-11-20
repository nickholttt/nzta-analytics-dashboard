// My canvases: the canvases a visitor saved, kept in this browser and nowhere else, under the rules of My questions (src/lib/saved.ts,
// D-125): no account, nothing sent, read defensively. A saved canvas is a canvas link, so it opens through the same validation as any
// link and a canvas has one spelling. What is kept is that link's query, a name the visitor can edit and when it was saved. The name is
// never in a link.
import { canvasSpec, readCanvas } from "./canvas";
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
  for (const [k, v] of new URLSearchParams(search)) {
    const [scope, ...rest] = k.split(".");
    if (ids.includes(scope) && rest.length > 0 && rest.join(".") !== MONTH) kept.append(k, v);
  }
  const text = kept.toString();
  return text.length <= MAX_QUERY ? text : undefined;
}

export const CANVASES: Kind = { key: STORAGE_KEY, keep: canvasQuery, maxQuery: MAX_QUERY };

// Where a saved canvas opens: the canvas page, with the canvas in the address.
export const canvasHref = (entry: Pick<Saved, "query">): string => `/canvas/?${entry.query}`;

// The list as plain text a visitor can paste anywhere: each name, then its link, in the order listed.
export const canvasLinks = (items: Saved[], origin: string): string => items.map((i) => `${i.name}\n${origin}${canvasHref(i)}`).join("\n\n");
