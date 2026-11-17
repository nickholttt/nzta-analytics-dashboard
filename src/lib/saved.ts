// My questions: the questions a visitor saved, kept in this browser and nowhere else (D-125). No account, nothing is sent. A saved question is
// a Build link (the address bar's form of the question, D-111), so it opens through the same validation as any link and the question has one
// spelling. What is kept for each is that link's query, a name the visitor can edit, when it was saved and, where it is pinned, the date of the
// snapshot it was pinned on. Storage is read defensively: a value that cannot be read is dropped and counted, never allowed to break the page.
import { builderSpec } from "./config";

export const STORAGE_KEY = "nzta.my_questions";
const VERSION = 1;
export const MAX_SAVED = 50;
export const MAX_NAME = 120;
const MAX_QUERY = 2000;

export type Saved = {
  id: string;
  name: string;
  // The question: Build's own parameters (those starting `build.`), as the address writes them, without the `?`.
  query: string;
  // When it was saved, as an ISO time.
  saved: string;
  // The date of the snapshot served when it was pinned here (YYYY-MM-DD); absent for a question not pinned, or pinned by a link that carried
  // only the month.
  pinned_on?: string;
};

// The two methods of the browser's storage this file uses, so a test can hold a stand-in.
export type Store = Pick<Storage, "getItem" | "setItem">;
export type Loaded = {
  // unavailable: the browser would not give or take the list (blocked, full, private mode). The page says so; Build itself works.
  state: "ok" | "unavailable";
  items: Saved[];
  // Entries that were there and could not be read, left out of the list.
  unreadable: number;
};

// The browser's storage, or nothing where the browser refuses even to name it (some privacy settings throw on the access itself).
export function browserStorage(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const isDate = (text: unknown): text is string => typeof text === "string" && /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text));

// The question's own parameters of an address, and nothing else; undefined where there are none. The month a ranking ends in is a setting of
// the chart that is looking at the newest month, so it is left out: a saved question is not pinned unless it says so (build.snapshot).
export function questionQuery(search: string): string | undefined {
  const kept = new URLSearchParams();
  for (const [k, v] of new URLSearchParams(search)) if (k.startsWith(`${builderSpec.id}.`) && k !== `${builderSpec.id}.month`) kept.append(k, v);
  const text = kept.toString();
  return text !== "" && text.length <= MAX_QUERY ? text : undefined;
}

const clean = (raw: unknown): Saved | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id === "" || r.id.length > 64) return undefined;
  if (typeof r.name !== "string" || r.name.trim() === "") return undefined;
  if (typeof r.query !== "string" || r.query.length > MAX_QUERY) return undefined;
  if (typeof r.saved !== "string" || Number.isNaN(Date.parse(r.saved))) return undefined;
  // Whatever else the stored text holds, only Build's parameters are kept.
  const query = questionQuery(`?${r.query}`);
  if (query === undefined) return undefined;
  return {
    id: r.id,
    name: r.name.trim().slice(0, MAX_NAME),
    query,
    saved: r.saved,
    ...(isDate(r.pinned_on) ? { pinned_on: r.pinned_on } : {}),
  };
};

export function load(storage: Store | null | undefined): Loaded {
  if (!storage) return { state: "unavailable", items: [], unreadable: 0 };
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: "unavailable", items: [], unreadable: 0 };
  }
  if (text === null) return { state: "ok", items: [], unreadable: 0 };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { state: "ok", items: [], unreadable: 1 };
  }
  const list = (parsed as { v?: unknown; items?: unknown } | null)?.items;
  if ((parsed as { v?: unknown } | null)?.v !== VERSION || !Array.isArray(list)) return { state: "ok", items: [], unreadable: 1 };
  const seen = new Set<string>();
  const items: Saved[] = [];
  let unreadable = 0;
  for (const raw of list) {
    const item = clean(raw);
    if (!item || seen.has(item.id)) unreadable += 1;
    else {
      seen.add(item.id);
      items.push(item);
    }
  }
  return { state: "ok", items: items.slice(0, MAX_SAVED), unreadable: unreadable + Math.max(0, items.length - MAX_SAVED) };
}

// False where the browser would not keep the list.
export function persist(storage: Store | null | undefined, items: Saved[]): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, items }));
    return true;
  } catch {
    return false;
  }
}

export type Added = { items: Saved[]; result: "added" | "exists" | "full"; entry?: Saved };

// A question saved again keeps its entry (and its name) rather than listing the same link twice. The newest is first.
export function add(items: Saved[], entry: Saved): Added {
  const same = items.find((i) => i.query === entry.query);
  if (same) return { items, result: "exists", entry: same };
  if (items.length >= MAX_SAVED) return { items, result: "full" };
  return { items: [entry, ...items], result: "added", entry };
}

export const rename = (items: Saved[], id: string, name: string): Saved[] => {
  const text = name.trim().slice(0, MAX_NAME);
  return text === "" ? items : items.map((i) => (i.id === id ? { ...i, name: text } : i));
};

export const remove = (items: Saved[], id: string): Saved[] => items.filter((i) => i.id !== id);

// Pin or unpin a saved question: its link gains or loses the snapshot's month, and the date it was pinned on is kept with it.
export function pinEntry(items: Saved[], id: string, snapshot: { month: string; date: string } | null): Saved[] {
  return items.map((i) => {
    if (i.id !== id) return i;
    const params = new URLSearchParams(i.query);
    params.delete(`${builderSpec.id}.snapshot`);
    if (snapshot) params.set(`${builderSpec.id}.snapshot`, snapshot.month);
    const { pinned_on: _was, ...rest } = i;
    return { ...rest, query: params.toString(), ...(snapshot ? { pinned_on: snapshot.date } : {}) };
  });
}

// Where a saved question opens: the Build page, with its question in the address.
export const hrefOf = (entry: Saved): string => `/build?${entry.query}`;

// The list as plain text a visitor can paste anywhere: each name, then its link, in the order listed.
export const exportLinks = (items: Saved[], origin: string): string => items.map((i) => `${i.name}\n${origin}${hrefOf(i)}`).join("\n\n");
