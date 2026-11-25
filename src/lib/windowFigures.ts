// What a window's figures say (src/lib/windows.ts): the change on the same months a year earlier, a place, a share and the floor a mover must reach.
// Pure: it reads nothing and names no field or value, so tests/site/ runs it with Node's own test runner. The rules are the site's own
// (CLAUDE.md invariants 7 and 8), stated once here and used by every page:
//   - a figure is the sum of the window's months for one condition; a hidden count or a missing month gives none, never a zero;
//   - the change is on the same months a year earlier. It is left out where an event changed how the data is recorded between the two windows, or where the
//     earlier window is under the change floor. Where the earlier window is complete and holds no vehicle of this value at all, it is a new entry, a thing
//     of its own and not a percentage;
//   - a place is a rank of the window's sums. A tie gives none, a value at or below the count a reserved group may hold gives none, and a place is
//     never stated for an earlier window.
import { changeOnYear } from "./sentences";
import type { YearChange } from "./sentences";

export type ChangeOutcome =
  // The figure is hidden or a month is missing: nothing is said, and the cell says it is hidden.
  | { kind: "hidden" }
  // No comparison can be made: the earlier window is under the floor, or an event changed how the data is recorded between the two.
  | { kind: "none" }
  // No vehicles were first registered under this name in the earlier window, which is complete.
  | { kind: "new" }
  | { kind: "change"; change: YearChange };

export type ChangeInput = {
  // This window's figure: nothing where it is hidden or a month is missing.
  now: number | undefined;
  // The same months a year earlier: nothing where any of them is missing or hidden.
  before: number | undefined;
  // Whether the dataset's counts can be set beside a year earlier at all and no event changed the recording between the two windows
  // (recordingChange returned false). Anything else, including events not loaded, leaves the comparison out.
  comparable: boolean | undefined;
  // The fewest vehicles in the earlier window for a percentage to be stated.
  floor: number;
};

// The outcome of one row's change, the rules tested in this order.
export function changeOutcome(i: ChangeInput): ChangeOutcome {
  if (i.now === undefined) return { kind: "hidden" };
  if (i.comparable !== true) return { kind: "none" };
  if (i.before === 0 && i.now > 0) return { kind: "new" };
  if (i.before === undefined || i.before < i.floor) return { kind: "none" };
  const change = changeOnYear(i.now, i.before, i.floor);
  return change ? { kind: "change", change } : { kind: "none" };
}

// The fewest vehicles a value needs in each window to be a mover: a minimum for each month the window spans, and never under the change floor.
export const moverFloor = (perMonth: number, months: number, changeFloor: number): number => Math.max(changeFloor, perMonth * months);

// A mover reaches the floor in both windows; a hidden count is no candidate.
export const qualifiesAsMover = (now: number | undefined, before: number | undefined, floor: number): boolean =>
  now !== undefined && before !== undefined && now >= floor && before >= floor;

export type Place = { rank: number; of: number };

// A value's place among sums: one more than the values with more, nothing where it is level with another, at or below `atLeast` (the most vehicles a
// group the build keeps out of the list may hold), or where the list is not exact (a count is hidden).
export function placeAmong(value: string, sums: ReadonlyMap<string, number>, opts: { exact: boolean; atLeast?: number }): Place | undefined {
  const n = sums.get(value);
  if (!opts.exact || n === undefined || n <= 0 || n <= (opts.atLeast ?? 0)) return undefined;
  let ahead = 0;
  let level = 0;
  let of = 0;
  for (const [other, s] of sums) {
    if (s <= 0) continue;
    of += 1;
    if (other === value) continue;
    if (s > n) ahead += 1;
    else if (s === n) level += 1;
  }
  return level === 0 ? { rank: ahead + 1, of } : undefined;
}

export const byCountThenName = (a: readonly [string, number], b: readonly [string, number]): number => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

// A share of a total, or nothing where the total is under the floor for a share to be stated.
export const shareOf = (n: number, total: number | undefined, floor: number): number | undefined => (total !== undefined && total >= floor && total > 0 ? n / total : undefined);
