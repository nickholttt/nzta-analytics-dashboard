// The lists the pages draw over a window (src/lib/windows.ts): every value of a field with its figure over the window, the same months a year earlier, and how it
// changed, from a cut of the fact table (src/lib/conditionViews.ts). Pure and free of any domain word: the field, its values and every threshold come in as
// arguments, so tests/site/ runs it with made-up counts. The rules are src/lib/windowFigures.ts's.
import { isReservedValue } from "./chartSentence";
import type { Cut } from "./conditionViews";
import { byCountThenName, changeOutcome, moverFloor, qualifiesAsMover } from "./windowFigures";
import type { ChangeOutcome } from "./windowFigures";
import { complete } from "./windows";
import type { Window } from "./windows";

// The vehicles of a condition (or of all of them, where it is undefined) in a value, summed over months.
export function figure(cut: Cut, value: string, condition: string | undefined, months: readonly string[]): number {
  return condition === undefined ? months.reduce((s, m) => s + cut.all(value, m), 0) : cut.sum(value, condition, months);
}

// Every vehicle of a condition (or all of them) over months, whatever its value: the denominator of a share.
export function totalFigure(cut: Cut, condition: string | undefined, months: readonly string[]): number {
  const conditions = condition === undefined ? cut.conditions() : [condition];
  return months.reduce((s, m) => s + conditions.reduce((t, c) => t + cut.total(c, m), 0), 0);
}

export type Basis = {
  window: Window;
  // Whether the dataset holds the month (the total slice has it): a window with a month it lacks has no figure.
  has: (month: string) => boolean;
  // Whether this value's figures can be set beside the same months a year earlier (src/lib/windowFigures.ts: ChangeInput.comparable).
  comparable: (value: string) => boolean | undefined;
  // The fewest vehicles in the earlier window for a percentage to be stated.
  changeFloor: number;
};

export type Listed = { value: string; n: number; before: number | undefined; outcome: ChangeOutcome };

// Every value with vehicles in the window, most first: nothing where a month of the window is missing. A value at or below `above` is left out: for a field the
// build caps, a part of the count ranks a value only above the fewest vehicles any named value has, below which a value the cap grouped as other may have more.
// `keep` narrows the values (the models of one brand).
export function listWindow(cut: Cut, condition: string | undefined, basis: Basis, opts: { above?: number; keep?: (value: string) => boolean } = {}): Listed[] | undefined {
  const { window: w } = basis;
  if (!complete(w.months, basis.has)) return undefined;
  const priorComplete = complete(w.prior, basis.has);
  const out: Listed[] = [];
  for (const value of cut.values(w.months)) {
    if (isReservedValue(value) || (opts.keep && !opts.keep(value))) continue;
    const n = figure(cut, value, condition, w.months);
    if (n <= 0 || (opts.above !== undefined && n <= opts.above)) continue;
    const before = priorComplete ? figure(cut, value, condition, w.prior) : undefined;
    out.push({ value, n, before, outcome: changeOutcome({ now: n, before, comparable: basis.comparable(value), floor: basis.changeFloor }) });
  }
  return out.sort((a, b) => byCountThenName([a.value, a.n], [b.value, b.n]));
}

// One value's row for a window, whether it is listed or not: its figure and how it changed.
export function listOne(cut: Cut, value: string, condition: string | undefined, basis: Basis): Listed | undefined {
  const { window: w } = basis;
  if (!complete(w.months, basis.has)) return undefined;
  const n = figure(cut, value, condition, w.months);
  const before = complete(w.prior, basis.has) ? figure(cut, value, condition, w.prior) : undefined;
  return { value, n, before, outcome: changeOutcome({ now: n, before, comparable: basis.comparable(value), floor: basis.changeFloor }) };
}

export type Movers = { rose: Listed[]; fell: Listed[] };

// The values whose count rose most and fell most on the same months a year earlier. A value qualifies only where both windows reach the floor (a minimum for each
// month the window spans), and a new entry has no percentage to rank by, so it is no mover.
export function movers(list: readonly Listed[], rule: { perMonth: number; months: number; changeFloor: number; least: number; each: number }): Movers {
  const floor = moverFloor(rule.perMonth, rule.months, rule.changeFloor);
  const moves = list.flatMap((l) => (l.outcome.kind === "change" && l.outcome.change.direction !== "same" && qualifiesAsMover(l.n, l.before, floor) && Math.abs(l.outcome.change.change) >= rule.least ? [{ l, c: l.outcome.change }] : []));
  const rose = moves.filter((m) => m.c.direction === "up").sort((a, b) => b.c.change - a.c.change || (a.l.value < b.l.value ? -1 : 1)).slice(0, rule.each);
  const fell = moves.filter((m) => m.c.direction === "down").sort((a, b) => a.c.change - b.c.change || (a.l.value < b.l.value ? -1 : 1)).slice(0, rule.each);
  return { rose: rose.map((m) => m.l), fell: fell.map((m) => m.l) };
}

// The new entries of a list: values with vehicles now and none in a complete earlier window.
export const newEntries = (list: readonly Listed[]): Listed[] => list.filter((l) => l.outcome.kind === "new");
