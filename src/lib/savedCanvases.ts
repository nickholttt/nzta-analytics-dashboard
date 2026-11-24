// My canvases: the canvases a visitor saved, kept in this browser and nowhere else, under the rules of My questions (src/lib/saved.ts,
// D-125): no account, nothing sent, read defensively. A saved canvas is a canvas link, so it opens through the same validation as any
// link and a canvas has one spelling. What is kept is that link's query, a name the visitor can edit and when it was saved. The name is
// never in a link.
import { canvasSearchFromBuild } from "./buildLink";
import type { BuildLinkRules } from "./buildLink";
import { isMonthKey } from "./builder";
import type { Vocabulary } from "./builder";
import { CANVAS_PATH, canvasAddress, canvasSpec, pinCanvas, readCanvas, settleCanvas } from "./canvas";
import type { Manifest } from "./data";
import { MAX_SAVED, QUESTIONS, load, persist } from "./saved";
import type { Kind, Saved, Store } from "./saved";

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

// ---- My questions, carried over ----
//
// Build is the canvas now, so the questions a visitor saved on it are carried into this list, once, each as a canvas of the chart or charts
// the question drew, with its name, the day it was saved and its pin. What was saved is never deleted: the old list stays in the browser as it
// was, and the ids of the entries already carried are kept beside it, so a second visit adds nothing and a canvas the visitor has since
// removed does not come back.

const CARRIED_KEY = "nzta.my_questions_carried";

export type CarriedOver = {
  // The list with the carried canvases after the ones already there, and the ids of every question dealt with so far.
  items: Saved[];
  carried: string[];
  added: number;
};

// The canvases the questions not yet carried make. A question is dealt with when its canvas is added, is one already there (the same chart
// saved as a canvas), or cannot be made into one; where the list is full the rest wait until there is room.
export function carryOver(questions: readonly Saved[], canvases: readonly Saved[], carried: readonly string[], rules: BuildLinkRules): CarriedOver {
  const items = [...canvases];
  const done = new Set(carried);
  let added = 0;
  for (const question of questions) {
    if (done.has(question.id)) continue;
    const query = canvasQuery(canvasSearchFromBuild(`?${question.query}`, rules));
    if (query !== undefined && !items.some((i) => i.query === query)) {
      if (items.length >= MAX_SAVED) continue;
      // The question's own id is its entry's, unless another entry of the list has it.
      const id = items.some((i) => i.id === question.id) ? `${question.id.slice(0, 60)}-q` : question.id;
      items.push({ id, name: question.name, query, saved: question.saved });
      added += 1;
    }
    done.add(question.id);
  }
  return { items, carried: [...done], added };
}

const readCarried = (storage: Store): string[] => {
  try {
    const parsed = JSON.parse(storage.getItem(CARRIED_KEY) ?? "null") as { v?: unknown; ids?: unknown } | null;
    return parsed?.v === 1 && Array.isArray(parsed.ids) ? parsed.ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};

// Carries the saved questions into the list of canvases, in the browser's storage. How many canvases were added; nothing where the browser will
// not give or take the lists. The canvases are written before the record of what was carried: if the record fails, the next visit finds the
// same canvases already there (by their question) and adds none.
export function carryQuestionsOver(storage: Store | null | undefined, rules: BuildLinkRules): number {
  if (!storage) return 0;
  const questions = load(storage, QUESTIONS);
  const canvases = load(storage, CANVASES);
  if (questions.state !== "ok" || canvases.state !== "ok" || questions.items.length === 0) return 0;
  const before = readCarried(storage);
  const made = carryOver(questions.items, canvases.items, before, rules);
  if (made.carried.length === before.length) return 0;
  if (!persist(storage, made.items, CANVASES)) return 0;
  try {
    storage.setItem(CARRIED_KEY, JSON.stringify({ v: 1, ids: made.carried }));
  } catch {
    // The canvases are kept; the next visit adds none of them again.
  }
  return made.added;
}
