// The tables of the answer pages over windows (config/windows.json): a brand's models, its nearest rivals and its powertrains, the leaders and movers of a powertrain
// cut, and the brands by volume, each once for every window and condition behind the two-choice switch (src/components/ViewSwitch.astro). Pure and free of any
// domain word: the cuts, the values and every threshold come in as arguments, so tests/site/ runs it with made-up counts. The figures and rules are
// src/lib/periodTables.ts and src/lib/windowFigures.ts's; every sentence is a template of config/answer_pages.json (CLAUDE.md invariant 8).
import type { Cut } from "./conditionViews";
import type { Condition } from "./latestMonth";
import type { PeriodTable } from "./latestPeriods";
import { figure, listOne, listWindow, movers, totalFigure } from "./periodTables";
import type { Basis, Listed } from "./periodTables";
import { gapAgainst } from "./rivals";
import { changeOutcome, moverFloor, placeAmong } from "./windowFigures";
import type { ChangeOutcome } from "./windowFigures";
import type { Window } from "./windows";
import { count, fillTemplate, percent } from "./sentences";

export type Cell = { text: string; direction?: "up" | "down" | "same"; hidden?: boolean; none?: boolean; fresh?: boolean };
export type Row = {
  name: string;
  href?: string;
  cells: Cell[];
  total?: boolean;
  // The words a screen reader gets for the row of the page's own value ("this brand"): the row is also in bold.
  marked?: string;
  // A link that follows the name (the note about how a powertrain is counted).
  after?: { href: string; text: string };
};
export type Link = { href: string; text: string; named: string };
export type Panel = {
  // The window and the view (condition, or all) the panel is for, by position.
  win: number;
  view: number;
  label: string;
  heading: string;
  sentences: string[];
  columns: string[];
  rows: Row[];
  notes: string[];
  empty?: string;
  links?: Link[];
};
export type Section = { id: string; heading: string; intro?: string; panels: Panel[] };
export type Scope = { legend: string; note: string; labels: string[]; period: { legend: string; labels: string[]; checked: number }; sections: Section[] };

export type Env = {
  words: Record<string, string>;
  windows: readonly Window[];
  defaultIndex: number;
  conditions: readonly Condition[];
  // Whether the dataset holds the month (the total slice has it).
  has: (month: string) => boolean;
  floors: { change: number; share: number };
  // Whether a value's figures can be set beside the same months a year earlier for this window (the dataset's counts allow it and no event changed how the data is recorded).
  comparable: (dimension: string | undefined, value: string | undefined, w: Window) => boolean | undefined;
  phrase: { window: (w: Window) => string; prior: (w: Window) => string };
  share: (x: number) => string;
  // The dataset's words for a count over a phrase: "3,513 vehicles first registered in the 12 months to Oct 2026".
  counted: (n: number, phrase: string) => string;
  // The months a window covers, said as a range ("Aug 2026 to Oct 2026"), and the fewest vehicles a month a mover needs.
  monthsText: (w: Window) => string;
  moverPerMonth: number;
};

export const say = (words: Record<string, string>, key: string, context: Record<string, unknown>): string | undefined => {
  const template = words[key];
  if (template === undefined) return undefined;
  const { text, unresolved } = fillTemplate(template, context);
  return unresolved.length === 0 ? text : undefined;
};

export const windowLabel = (env: Env, w: Window): string => say(env.words, `win_${w.id}`, { months: w.months.length }) ?? "";
export const viewPhrase = (env: Env, c: Condition | undefined): string => c?.phrase ?? env.words.view_all_phrase;
export const viewLabel = (env: Env, c: Condition | undefined): string => c?.label ?? env.words.view_all;

// Every window and each condition and then all of them, in the order of the panels.
export const views = (env: Env): { w: Window; c: Condition | undefined; wi: number; ci: number }[] =>
  env.windows.flatMap((w) => [...env.conditions.map((c) => c as Condition | undefined), undefined].map((c, ci) => ({ w, c, wi: w.index, ci })));

export const basisOf = (env: Env, w: Window, dimension: string | undefined): Basis => ({ window: w, has: env.has, comparable: (value) => env.comparable(dimension, value, w), changeFloor: env.floors.change });

export function changeCell(env: Env, o: ChangeOutcome): Cell {
  if (o.kind === "hidden") return { text: env.words.hidden, hidden: true };
  if (o.kind === "none") return { text: "", none: true };
  if (o.kind === "new") return { text: env.words.new_entry, fresh: true };
  return { text: o.change.direction === "same" ? env.words.level : `${o.change.change > 0 ? "+" : "−"}${percent(Math.abs(o.change.change))}`, direction: o.change.direction };
}

const noCell: Cell = { text: "", none: true };
const shareCell = (env: Env, n: number, total: number | undefined): Cell => (total !== undefined && total >= env.floors.share && total > 0 ? { text: env.share(n / total) } : noCell);
const newNote = (env: Env, w: Window, rows: readonly Row[]): string[] => (rows.some((r) => r.cells.some((c) => c.fresh)) ? [say(env.words, "new_entry_note", { prior: env.phrase.prior(w) })].filter((x): x is string => x !== undefined) : []);
// The counts of a value under each condition, as table cells (the columns an "all" panel has beside the total).
const partCells = (env: Env, cut: Cut, value: string, w: Window): Cell[] => env.conditions.map((c) => ({ text: count(figure(cut, value, c.value, w.months)) }));
const columnsFor = (env: Env, c: Condition | undefined) => (c ? [c.label] : [...env.conditions.map((x) => x.label), env.words.view_all]);
const changeHead = (env: Env, c: Condition | undefined) => say(env.words, c ? "col_change" : "col_change_all", {});

// ---- The figure over each window, for one value ----

export function valuePeriods(env: Env, cut: Cut, value: string, dimension: string): PeriodTable | undefined {
  const heading = say(env.words, "heading_periods", {});
  const columns = [env.words.col_period, ...env.conditions.map((c) => c.label), env.words.view_all, env.words.col_change_all];
  const rows = env.windows.flatMap((w) => {
    if (!w.months.every(env.has)) return [];
    const n = figure(cut, value, undefined, w.months);
    const before = w.prior.every(env.has) ? figure(cut, value, undefined, w.prior) : undefined;
    const o = changeOutcome({ now: n, before, comparable: env.comparable(dimension, value, w), floor: env.floors.change });
    const cell = changeCell(env, o);
    return [{ label: windowLabel(env, w), cells: [...env.conditions.map((c) => count(figure(cut, value, c.value, w.months))), count(n)], ...(cell.direction ? { change: { direction: cell.direction, text: cell.text } } : {}), ...(cell.fresh ? { fresh: true } : {}) }];
  });
  if (!heading || rows.length === 0 || columns.some((c) => !c)) return undefined;
  const note = rows.some((r) => r.fresh) ? say(env.words, "new_entry_note", { prior: env.phrase.prior(env.windows[0]) }) : undefined;
  return { heading, columns, rows, ...(note ? { note } : {}) };
}

// The same table for a whole cut of the market (every vehicle of one powertrain, say), whose figure is the cut's total and not one value's.
export function cutPeriods(env: Env, cut: Cut, dimension: string, value: string): PeriodTable | undefined {
  const heading = say(env.words, "heading_periods", {});
  const columns = [env.words.col_period, ...env.conditions.map((c) => c.label), env.words.view_all, env.words.col_change_all];
  const rows = env.windows.flatMap((w) => {
    if (!w.months.every(env.has)) return [];
    const n = totalFigure(cut, undefined, w.months);
    const before = w.prior.every(env.has) ? totalFigure(cut, undefined, w.prior) : undefined;
    const cell = changeCell(env, changeOutcome({ now: n, before, comparable: env.comparable(dimension, value, w), floor: env.floors.change }));
    return [{ label: windowLabel(env, w), cells: [...env.conditions.map((c) => count(totalFigure(cut, c.value, w.months))), count(n)], ...(cell.direction ? { change: { direction: cell.direction, text: cell.text } } : {}), ...(cell.fresh ? { fresh: true } : {}) }];
  });
  if (!heading || rows.length === 0 || columns.some((c) => !c)) return undefined;
  const note = rows.some((r) => r.fresh) ? say(env.words, "new_entry_note", { prior: env.phrase.prior(env.windows[0]) }) : undefined;
  return { heading, columns, rows, ...(note ? { note } : {}) };
}

// ---- A brand's models ----

export type ModelsAsk = {
  brand: string;
  name: string;
  brandCut: Cut;
  modelCut: Cut;
  brandDimension: string;
  modelDimension: string;
  floor: number | undefined;
  top: number;
  brandOf: (modelValue: string) => string | undefined;
  rowName: (modelValue: string) => string;
  href: (modelValue: string) => string | undefined;
};

export function modelsPanel(env: Env, a: ModelsAsk, w: Window, c: Condition | undefined, wi: number, ci: number): Panel | undefined {
  const heading = say(env.words, "heading_models_view", { name: a.name, view: viewPhrase(env, c) });
  const head = changeHead(env, c);
  const share = say(env.words, c ? "col_view_share" : "col_share", { name: a.name, view: c?.phrase });
  if (heading === undefined || !head || !share) return undefined;
  const label = viewLabel(env, c);
  const columns = [env.words.col_model, ...columnsFor(env, c), share, head];
  const empty = (message: string | undefined): Panel | undefined => (message === undefined ? undefined : { win: wi, view: ci, label, heading, sentences: [], columns, rows: [], notes: [], empty: message });
  const list = listWindow(a.modelCut, c?.value, basisOf(env, w, a.modelDimension), { above: a.floor, keep: (v) => a.brandOf(v) === a.brand });
  const brandN = w.months.every(env.has) ? figure(a.brandCut, a.brand, c?.value, w.months) : undefined;
  if (!list || brandN === undefined || brandN <= 0) return empty(say(env.words, "view_empty_window", { name: a.name, view: viewPhrase(env, c), window: env.phrase.window(w) }));
  const shown = list.slice(0, a.top);
  const cond = c ? [] : env.conditions;
  const rows: Row[] = shown.map((l) => ({ name: a.rowName(l.value), href: a.href(l.value), cells: [...(c ? [] : partCells(env, a.modelCut, l.value, w)), { text: count(l.n) }, shareCell(env, l.n, brandN), changeCell(env, l.outcome)] }));
  const listed = shown.reduce((s, l) => s + l.n, 0);
  const rest = brandN - listed;
  const restName = say(env.words, "other_models", { name: a.name });
  if (rest > 0 && restName) {
    const parts = cond.map((x) => ({ text: count(figure(a.brandCut, a.brand, x.value, w.months) - shown.reduce((s, l) => s + figure(a.modelCut, l.value, x.value, w.months), 0)) }));
    rows.push({ name: restName, cells: [...parts, { text: count(rest) }, shareCell(env, rest, brandN), noCell] });
  }
  const totalName = say(env.words, c ? "total_row_view" : "total_row", { name: a.name, view: c?.phrase });
  const own = listOne(a.brandCut, a.brand, c?.value, basisOf(env, w, a.brandDimension));
  if (!totalName || !own) return undefined;
  rows.push({ name: totalName, total: true, cells: [...cond.map((x) => ({ text: count(figure(a.brandCut, a.brand, x.value, w.months)) })), { text: count(brandN) }, shareCell(env, brandN, brandN), changeCell(env, own.outcome)] });
  return { win: wi, view: ci, label, heading, sentences: [], columns, rows, notes: newNote(env, w, rows) };
}

// ---- A brand beside its nearest rivals ----

export type RivalsAsk = {
  value: string;
  name: string;
  // The brands of the set, in rank order by the 12-month count of all vehicles, the page's own among them.
  set: readonly string[];
  cut: Cut;
  dimension: string;
  nameOf: (value: string) => string;
  href: (value: string) => string | undefined;
  // The most vehicles any group the build keeps out of the list may hold in a window and under a condition: a place at or below it is not stated.
  reservedMost: (condition: string | undefined, w: Window) => number;
  // The canvas address that ranks the set over a window and condition, and the one that draws it month by month; nothing where the canvas cannot.
  link: (kind: "league" | "trend", c: Condition | undefined, w: Window) => string | undefined;
};

export function rivalsPanel(env: Env, a: RivalsAsk, w: Window, c: Condition | undefined, wi: number, ci: number): Panel | undefined {
  const heading = say(env.words, "heading_rivals_view", { name: a.name, view: viewPhrase(env, c) });
  const columns = [env.words.col_brand, env.words.col_vehicles, env.words.col_share_all, env.words.col_place, changeHead(env, c)];
  if (heading === undefined || columns.some((x) => !x)) return undefined;
  const label = viewLabel(env, c);
  const basis = basisOf(env, w, a.dimension);
  const list = listWindow(a.cut, c?.value, basis);
  const empty = (message: string | undefined): Panel | undefined => (message === undefined ? undefined : { win: wi, view: ci, label, heading, sentences: [], columns: columns as string[], rows: [], notes: [], empty: message });
  if (!list) return empty(say(env.words, "view_empty_window", { name: a.name, view: viewPhrase(env, c), window: env.phrase.window(w) }));
  const sums = new Map(list.map((l) => [l.value, l.n] as [string, number]));
  const total = totalFigure(a.cut, c?.value, w.months);
  const atLeast = a.reservedMost(c?.value, w);
  const ones = a.set.map((v) => [v, listOne(a.cut, v, c?.value, basis)] as [string, Listed | undefined]);
  if (ones.some(([, l]) => !l)) return undefined;
  const rows: Row[] = ones.map(([v, l]) => {
    const place = placeAmong(v, sums, { exact: true, atLeast });
    const placeText = place ? say(env.words, "place_cell", { rank: place.rank, of: place.of }) : undefined;
    const item = l as Listed;
    return {
      name: a.nameOf(v),
      href: v === a.value ? undefined : a.href(v),
      ...(v === a.value ? { marked: env.words.this_brand } : {}),
      cells: [{ text: count(item.n) }, shareCell(env, item.n, total), placeText ? { text: placeText } : noCell, changeCell(env, item.outcome)],
    };
  });
  // The gap against the rival just above, or just below for the first of the set: dropped on a tie.
  const sentences: string[] = [];
  const against = gapAgainst(a.value, a.set);
  const mine = ones.find(([v]) => v === a.value)?.[1];
  const theirs = ones.find(([v]) => v === against)?.[1];
  if (against !== undefined && mine && theirs && mine.n !== theirs.n) {
    const key = `rival_gap_${mine.n > theirs.n ? "more" : "fewer"}${c ? "_view" : ""}`;
    const text = say(env.words, key, { name: a.name, gap: count(Math.abs(mine.n - theirs.n)), rival: a.nameOf(against), window: env.phrase.window(w), view: c?.phrase });
    if (text) sentences.push(text);
  }
  const links: Link[] = (["league", "trend"] as const).flatMap((kind) => {
    const href = a.link(kind, c, w);
    const text = say(env.words, kind === "league" ? "rivals_link_league" : "rivals_link_trend", { window: env.phrase.window(w) });
    const named = say(env.words, kind === "league" ? "rivals_link_league_named" : "rivals_link_trend_named", { heading, window: env.phrase.window(w) });
    return href && text && named ? [{ href, text, named }] : [];
  });
  return { win: wi, view: ci, label, heading, sentences, columns: columns as string[], rows, notes: newNote(env, w, rows), links };
}

// ---- A value by powertrain ----

export type CutAsk = {
  value: string;
  name: string;
  // The value's cut for each powertrain, and the powertrains in the order they are listed.
  by: ReadonlyMap<string, Cut>;
  order: readonly string[];
  dimension: string;
  labelOf: (cutValue: string) => string;
  // The canvas address of a row's label: the value's models cut to the powertrain, ranked over the window and condition; nothing where the canvas cannot.
  link?: (cutValue: string, c: Condition | undefined, w: Window) => string | undefined;
  // The powertrain whose row is followed by the note about how its line is identified, and the note's link.
  noted?: { value: string; href: string; text: string };
};

export function cutPanel(env: Env, a: CutAsk, w: Window, c: Condition | undefined, wi: number, ci: number): Panel | undefined {
  const heading = say(env.words, "heading_by_cut_view", { name: a.name, view: viewPhrase(env, c) });
  const share = say(env.words, c ? "col_view_share" : "col_share", { name: a.name, view: c?.phrase });
  const head = changeHead(env, c);
  if (heading === undefined || !share || !head) return undefined;
  const label = viewLabel(env, c);
  const columns = [env.words.col_cut, ...(c ? [c.label] : [env.words.view_all]), share, head];
  const empty = (message: string | undefined): Panel | undefined => (message === undefined ? undefined : { win: wi, view: ci, label, heading, sentences: [], columns, rows: [], notes: [], empty: message });
  if (!w.months.every(env.has)) return empty(say(env.words, "view_empty_window", { name: a.name, view: viewPhrase(env, c), window: env.phrase.window(w) }));
  const ones = [...a.by].flatMap(([p, cut]) => {
    const l = listOne(cut, a.value, c?.value, basisOf(env, w, a.dimension));
    return l && l.n > 0 ? [[p, l] as [string, Listed]] : [];
  });
  const total = ones.reduce((s, [, l]) => s + l.n, 0);
  if (total <= 0) return empty(say(env.words, "view_empty_window", { name: a.name, view: viewPhrase(env, c), window: env.phrase.window(w) }));
  const rank = (p: string) => (a.order.includes(p) ? a.order.indexOf(p) : a.order.length);
  ones.sort((x, y) => rank(x[0]) - rank(y[0]) || (x[0] < y[0] ? -1 : 1));
  const rows: Row[] = ones.map(([p, l]) => {
    const href = a.link?.(p, c, w);
    return { name: a.labelOf(p), ...(href ? { href } : {}), ...(a.noted && a.noted.value === p ? { after: { href: a.noted.href, text: a.noted.text } } : {}), cells: [{ text: count(l.n) }, shareCell(env, l.n, total), changeCell(env, l.outcome)] };
  });
  return { win: wi, view: ci, label, heading, sentences: [], columns, rows, notes: newNote(env, w, rows) };
}

// ---- The leaders and the movers of a field ----

export type LeadersAsk = {
  cut: Cut;
  dimension: string;
  heading: (view: string, label: string) => string | undefined;
  nameHead: string;
  top: number;
  above?: number;
  keep?: (value: string) => boolean;
  nameOf: (value: string) => string;
  href: (value: string) => string | undefined;
  // What a share is of: the vehicles counted for the whole of the page (a powertrain's, or every vehicle's) under the condition.
  shareOf: (c: Condition | undefined, w: Window) => number | undefined;
  shareHead: (c: Condition | undefined) => string | undefined;
  // With this, each row has its place among all the values (the most vehicles a group left out of the list may hold): the index of brands.
  place?: { atLeast: (c: Condition | undefined, w: Window) => number; head: string };
  link?: (c: Condition | undefined, w: Window, heading: string) => Link | undefined;
};

export function leadersPanel(env: Env, a: LeadersAsk, w: Window, c: Condition | undefined, wi: number, ci: number): Panel | undefined {
  const heading = a.heading(viewPhrase(env, c), viewLabel(env, c));
  const head = changeHead(env, c);
  const share = a.shareHead(c);
  if (heading === undefined || !head || !share) return undefined;
  const label = viewLabel(env, c);
  const columns = [a.nameHead, ...(a.place ? [a.place.head] : []), ...columnsFor(env, c), share, head];
  const links = (): Link[] => {
    const l = a.link?.(c, w, heading);
    return l ? [l] : [];
  };
  const list = listWindow(a.cut, c?.value, basisOf(env, w, a.dimension), { above: a.above, keep: a.keep });
  if (!list || list.length === 0) {
    const message = say(env.words, "view_empty_ranking_window", { field: a.nameHead.toLowerCase(), view: viewPhrase(env, c), window: env.phrase.window(w) });
    return message === undefined ? undefined : { win: wi, view: ci, label, heading, sentences: [], columns, rows: [], notes: [], empty: message, links: links() };
  }
  const total = a.shareOf(c, w);
  const sums = new Map(list.map((l) => [l.value, l.n] as [string, number]));
  const shown = list.slice(0, a.top);
  const rows: Row[] = shown.map((l) => {
    const place = a.place ? placeAmong(l.value, sums, { exact: true, atLeast: a.place.atLeast(c, w) }) : undefined;
    return { name: a.nameOf(l.value), href: a.href(l.value), cells: [...(a.place ? [place ? { text: String(place.rank) } : noCell] : []), ...(c ? [] : partCells(env, a.cut, l.value, w)), { text: count(l.n) }, shareCell(env, l.n, total), changeCell(env, l.outcome)] };
  });
  return { win: wi, view: ci, label, heading, sentences: [], columns, rows, notes: newNote(env, w, rows), links: links() };
}

export type MoversAsk = {
  cut: Cut;
  dimension: string;
  heading: (view: string, label: string) => string | undefined;
  nameHead: string;
  each: number;
  least: number;
  above?: number;
  keep?: (value: string) => boolean;
  nameOf: (value: string) => string;
  href: (value: string) => string | undefined;
  field: string;
  link?: (c: Condition | undefined, w: Window, heading: string) => Link | undefined;
};

export function moversPanel(env: Env, a: MoversAsk, w: Window, c: Condition | undefined, wi: number, ci: number): Panel | undefined {
  const heading = a.heading(viewPhrase(env, c), viewLabel(env, c));
  const earlier = env.words.col_prior;
  const head = changeHead(env, c);
  if (heading === undefined || !earlier || !head) return undefined;
  const label = viewLabel(env, c);
  const perMonth = env.moverPerMonth;
  const floor = moverFloor(perMonth, w.months.length, env.floors.change);
  const columns = [a.nameHead, ...columnsFor(env, c), earlier, head];
  const link = a.link?.(c, w, heading);
  const list = listWindow(a.cut, c?.value, basisOf(env, w, a.dimension), { above: a.above, keep: a.keep }) ?? [];
  const { rose, fell } = movers(list, { perMonth, months: w.months.length, changeFloor: env.floors.change, least: a.least, each: a.each });
  const links = link ? [link] : [];
  if (rose.length + fell.length === 0) {
    const message = say(env.words, "view_empty_movers_window", { field: a.field, minimum: count(floor), view: viewPhrase(env, c) });
    return message === undefined ? undefined : { win: wi, view: ci, label, heading, sentences: [], columns, rows: [], notes: [], empty: message, links };
  }
  const shown = [...rose, ...fell];
  const rows: Row[] = shown.map((l) => ({ name: a.nameOf(l.value), href: a.href(l.value), cells: [...(c ? [] : partCells(env, a.cut, l.value, w)), { text: count(l.n) }, { text: count(l.before ?? 0) }, changeCell(env, l.outcome)] }));
  const sentences = [rose[0] && ["mover_up", rose[0]], fell[0] && ["mover_down", fell[0]]]
    .filter((x): x is [string, Listed] => Boolean(x))
    .flatMap(([key, l]) => {
      const cmp = l.outcome.kind === "change" ? { change: Math.abs(l.outcome.change.change), prior_count: count(l.outcome.change.prior), prior: env.phrase.prior(w) } : {};
      const text = say(env.words, c ? key.replace("mover_", "mover_view_") : key, { field: a.field, view: viewPhrase(env, c), name: a.nameOf(l.value), counted: env.counted(l.n, env.phrase.window(w)), ...cmp });
      return text ? [text] : [];
    });
  const note = say(env.words, "movers_floor_window", { minimum: count(floor) });
  return { win: wi, view: ci, label, heading, sentences, columns, rows, notes: note ? [note] : [], links };
}

// A section: the panels for every window and every condition and all of them; nothing where any cannot be made, so the page is drawn as it was.
export function sectionOf(env: Env, id: string, heading: string, intro: string | undefined, make: (w: Window, c: Condition | undefined, wi: number, ci: number) => Panel | undefined): Section | undefined {
  const panels = views(env).map(({ w, c, wi, ci }) => make(w, c, wi, ci));
  return panels.every((p): p is Panel => p !== undefined) ? { id, heading, ...(intro ? { intro } : {}), panels } : undefined;
}

// The switch over a set of sections: the period and the condition, with the words that say what each chooses.
export function scopeOf(env: Env, sections: readonly Section[]): Scope | undefined {
  const legend = env.words.scope_legend;
  const periodLegend = say(env.words, "window_legend", {});
  const labels = env.windows.map((w) => windowLabel(env, w));
  const items = env.windows.map((w) => say(env.words, "window_note_item", { label: windowLabel(env, w), months: env.monthsText(w) }));
  const windows = items.every((x): x is string => x !== undefined) ? say(env.words, "window_note", { items: items.join("; ") }) : undefined;
  const note = windows && env.words.scope_note ? `${env.words.scope_note} ${windows}` : undefined;
  if (!legend || !periodLegend || labels.some((l) => !l) || sections.length === 0 || !note) return undefined;
  return { legend, note, labels: [...env.conditions.map((c) => c.label), env.words.view_all], period: { legend: periodLegend, labels, checked: env.defaultIndex }, sections: [...sections] };
}

