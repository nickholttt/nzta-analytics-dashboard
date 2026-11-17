// The index of the snapshots a deploy keeps beside the newest (public/data/snapshots/index.json, written by scripts/kept-snapshots.mjs, D-131).
// Pure, so a test reads it as the page does. The page trusts nothing it cannot account for: an index that is not exactly what the script writes
// is read as no index, and a question pinned to a month then shows what a pin without a kept snapshot shows (D-125).
export type KeptSnapshots = ReadonlyMap<string, string>;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// The months kept, each with its snapshot date; null where the file is absent, not JSON, not a list of months with dates, names a date outside
// its month, or lists a month twice.
export function readIndex(json: unknown): KeptSnapshots | null {
  const list = (json as { snapshots?: unknown } | null | undefined)?.snapshots;
  if (!Array.isArray(list)) return null;
  const kept = new Map<string, string>();
  for (const entry of list) {
    const { month, snapshot } = (entry ?? {}) as { month?: unknown; snapshot?: unknown };
    if (typeof month !== "string" || typeof snapshot !== "string" || !MONTH.test(month) || !DATE.test(snapshot) || !snapshot.startsWith(month) || kept.has(month)) return null;
    kept.set(month, snapshot);
  }
  return kept;
}

// A folder name the reader will ask for: a month, so no other path can be built from a pin.
export const isMonthFolder = (value: string): boolean => MONTH.test(value);
