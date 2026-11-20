// My questions: the questions a visitor saved, kept in this browser and nowhere else (D-125). No account, nothing is sent. A saved question is
// a Build link (the address bar's form of the question, D-111), so it opens through the same validation as any link and the question has one
// spelling. What is kept for each is that link's query (a pin is in it, as build.snapshot), a name the visitor can edit and when it was saved. Storage is read defensively: a value that cannot be read is dropped and counted, never allowed to break the page.
import { builderSpec } from "./config";

export const STORAGE_KEY = "nzta.my_questions";
const VERSION = 1;
export const MAX_SAVED = 50;
export const MAX_NAME = 120;
export const MAX_QUERY = 2000;

export type Saved = {
  id: string;
  name: string;
  // The question: Build's own parameters (those starting `build.`), as the address writes them, without the `?`.
  query: string;
  // When it was saved, as an ISO time.
  saved: string;
};

// A kind of thing a visitor saves: where its list is kept, and what of an address is the thing itself. Questions are the kind this file
// defaults to; a canvas is another (src/lib/savedCanvases.ts), kept in a list of its own under the same rules.
export type Kind = { key: string; keep: (search: string) => string | undefined; maxQuery: number };

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

// The question's own parameters of an address, and nothing else; undefined where there are none. The month a ranking ends in is a setting of
// the chart that is looking at the newest month, so it is left out: a saved question is not pinned unless it says so (build.snapshot).
export function questionQuery(search: string): string | undefined {
  const kept = new URLSearchParams();
  for (const [k, v] of new URLSearchParams(search)) if (k.startsWith(`${builderSpec.id}.`) && k !== `${builderSpec.id}.month`) kept.append(k, v);
  const text = kept.toString();
  return text !== "" && text.length <= MAX_QUERY ? text : undefined;
}

export const QUESTIONS: Kind = { key: STORAGE_KEY, keep: questionQuery, maxQuery: MAX_QUERY };

const clean = (raw: unknown, kind: Kind): Saved | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id === "" || r.id.length > 64) return undefined;
  if (typeof r.name !== "string" || r.name.trim() === "") return undefined;
  if (typeof r.query !== "string" || r.query.length > kind.maxQuery) return undefined;
  if (typeof r.saved !== "string" || Number.isNaN(Date.parse(r.saved))) return undefined;
  // Whatever else the stored text holds, only the parameters of its kind are kept.
  const query = kind.keep(`?${r.query}`);
  if (query === undefined) return undefined;
  return {
    id: r.id,
    name: r.name.trim().slice(0, MAX_NAME),
    query,
    saved: r.saved,
  };
};

export function load(storage: Store | null | undefined, kind: Kind = QUESTIONS): Loaded {
  if (!storage) return { state: "unavailable", items: [], unreadable: 0 };
  let text: string | null;
  try {
    text = storage.getItem(kind.key);
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
    const item = clean(raw, kind);
    if (!item || seen.has(item.id)) unreadable += 1;
    else {
      seen.add(item.id);
      items.push(item);
    }
  }
  return { state: "ok", items: items.slice(0, MAX_SAVED), unreadable: unreadable + Math.max(0, items.length - MAX_SAVED) };
}

// False where the browser would not keep the list.
export function persist(storage: Store | null | undefined, items: Saved[], kind: Kind = QUESTIONS): boolean {
  if (!storage) return false;
  try {
    storage.setItem(kind.key, JSON.stringify({ v: VERSION, items }));
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

// Pin or unpin a saved question: its link gains or loses the snapshot's month.
export function pinEntry(items: Saved[], id: string, month: string | null): Saved[] {
  return items.map((i) => {
    if (i.id !== id) return i;
    const params = new URLSearchParams(i.query);
    params.delete(`${builderSpec.id}.snapshot`);
    if (month) params.set(`${builderSpec.id}.snapshot`, month);
    return { ...i, query: params.toString() };
  });
}

// Where a saved question opens: the Build page, with its question in the address.
export const hrefOf = (entry: Saved): string => `/build?${entry.query}`;

// The list as plain text a visitor can paste anywhere: each name, then its link, in the order listed.
export const exportLinks = (items: Saved[], origin: string): string => items.map((i) => `${i.name}\n${origin}${hrefOf(i)}`).join("\n\n");
