// The latest month over four windows (config/windows.json): the blocks that have views are drawn once for each window and each condition, behind the two-choice
// switch (src/components/ViewSwitch.astro), and a table of the figure over each window sits under the month's figure. Worked out here from the cuts the
// page's build gives (src/lib/latestMonthBuild.ts); pure, and free of any domain word. The figures and rules are src/lib/periodTables.ts and
// src/lib/windowFigures.ts's; every sentence is a template of config/latest_month.json (CLAUDE.md invariant 8).
import { isReservedValue } from "./chartSentence";
import type { Cut } from "./conditionViews";
import type { BlockConfig, BlockView, Change, Condition, Kit, PanelView, RowView } from "./latestMonth";
import { listWindow, movers, figure, totalFigure } from "./periodTables";
import type { Basis, Listed } from "./periodTables";
import { changeOutcome, moverFloor } from "./windowFigures";
import type { ChangeOutcome } from "./windowFigures";
import { count, fillTemplate, monthLabel, percent, sayList } from "./sentences";
import { windowPhrase as windowPhraseOf, windowRange } from "./windows";
import type { Window } from "./windows";

// What the windowed section needs beyond the kit's views.
export type PeriodsKit = {
  windows: readonly Window[];
  // The window each switch opens on, and the fewest vehicles a month a value needs to be a mover.
  defaultIndex: number;
  moverPerMonth: number;
  // "in the 3 months to Oct 2026": the dataset's words for a count over several months to a month.
  span: (end: string, months: number) => string;
};

export type PeriodRow = { label: string; cells: string[]; change?: Change; fresh?: boolean };
export type PeriodTable = { heading: string; columns: string[]; rows: PeriodRow[]; note?: string };

export type Windowed = {
  // The panels of each block that has views, in the order window by window and, within a window, each condition and then all.
  panels: Map<string, PanelView[]>;
  period: { legend: string; labels: string[]; checked: number };
  table?: PeriodTable;
  note?: string;
  newEntry: string;
};

const say = (words: Record<string, string>, key: string, context: Record<string, unknown>): string | undefined => {
  const template = words[key];
  if (template === undefined) return undefined;
  const { text, unresolved } = fillTemplate(template, context);
  return unresolved.length === 0 ? text : undefined;
};

const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function windowedSection(kit: Kit, periods: PeriodsKit, ctx: { month: string; has: (month: string) => boolean; conditions: readonly Condition[]; comparableFor: (win: Window, dimension?: string, value?: string) => boolean | undefined; fieldOf: (dimension: string) => { label: string; lower: string } | undefined; blocks: readonly BlockView[] }): Windowed | undefined {
  const { config } = kit;
  const words = config.words;
  const { month, conditions } = ctx;
  const views = kit.views;
  if (!views || conditions.length < 2) return undefined;
  const windows = periods.windows;
  const all = [...conditions.map((c) => c as Condition | undefined), undefined];

  const labelOf = (w: Window) => say(words, `win_${w.id}`, { months: w.months.length }) ?? "";
  const said = { month: kit.window, span: periods.span, range: (start: string, end: string) => say(words, "in_ytd", { start: monthLabel(start), end: monthLabel(end) }) ?? "" };
  const windowPhrase = (w: Window) => windowPhraseOf(w.months, w.yearToDate, said);
  const priorPhrase = (w: Window) => windowPhraseOf(w.prior, w.yearToDate, said);
  const basisFor = (w: Window, dimension: string | undefined): Basis => ({ window: w, has: ctx.has, comparable: (value) => ctx.comparableFor(w, dimension, value), changeFloor: kit.floors.change });

  const signed = (o: ChangeOutcome): { change?: Change; fresh?: boolean } =>
    o.kind === "change" ? { change: { direction: o.change.direction, text: o.change.direction === "same" ? words.level : `${o.change.change > 0 ? "+" : "−"}${percent(Math.abs(o.change.change))}` } } : o.kind === "new" ? { fresh: true } : {};
  const comparison = (l: Listed, w: Window) => (l.outcome.kind === "change" ? { change: Math.abs(l.outcome.change.change), prior_count: count(l.outcome.change.prior), prior: priorPhrase(w) } : undefined);
  const headingOf = (heading: string | undefined, view: string) => (heading === undefined ? undefined : say(words, "heading_view", { heading, view }));
  const newNote = (w: Window, rows: readonly { fresh?: boolean }[]) => (rows.some((r) => r.fresh) ? [say(words, "new_entry_note", { prior: priorPhrase(w) })].filter((x): x is string => x !== undefined) : []);

  // A panel's own link to the canvas: the block's question kept to the condition, over the window's period where the block has one.
  const panelLink = (block: BlockConfig, c: Condition | undefined, w: Window, heading: string) => {
    const named = say(words, "canvas_link_named", { heading });
    if (named === undefined) return undefined;
    const href = kit.link(block, c ? { [views.field]: [c.value] } : undefined, block.canvas.settings?.period !== undefined ? w.canvasPeriod : undefined, c ? undefined : [views.field]);
    return href === undefined ? { canvas: undefined, canvasLabel: undefined } : { canvas: href, canvasLabel: named };
  };

  const partsOf = (cut: Cut, value: string, w: Window) => conditions.map((c) => count(figure(cut, value, c.value, w.months)));
  const rowOf = (cut: Cut, l: Listed, dimension: string, c: Condition | undefined, w: Window, extra: Partial<RowView> = {}): RowView => ({
    name: kit.label.value(dimension, l.value),
    value: l.value,
    ...(c === undefined ? { parts: partsOf(cut, l.value, w) } : {}),
    count: count(l.n),
    ...signed(l.outcome),
    ...extra,
  });

  const emptyPanel = (block: BlockConfig, c: Condition | undefined, w: Window, heading: string, message: string | undefined, wi: number, ci: number): PanelView | undefined =>
    message === undefined ? undefined : { label: c?.label ?? words.view_all, heading, sentences: [], columns: [], rows: [], notes: [], empty: message, win: wi, view: ci, ...panelLink(block, c, w, heading) };

  const viewPhrase = (c: Condition | undefined) => c?.phrase ?? words.view_all_phrase;

  const rankingPanel = (block: BlockConfig, c: Condition | undefined, w: Window, wi: number, ci: number): PanelView | undefined => {
    const dimension = block.dimension as string;
    const field = ctx.fieldOf(dimension);
    const cut = views.cuts[dimension];
    if (!field || !cut) return undefined;
    const base = say(words, "heading_ranking", { field: field.lower });
    const heading = c ? headingOf(base, c.phrase) : headingOf(base, words.view_all_phrase);
    if (heading === undefined) return undefined;
    const list = listWindow(cut, c?.value, basisFor(w, dimension), { above: views.floors[dimension] });
    if (!list || list.length === 0) return emptyPanel(block, c, w, heading, say(words, "view_empty_ranking_window", { field: field.lower, view: viewPhrase(c), window: windowPhrase(w) }), wi, ci);
    const shown = list.slice(0, block.top ?? 5);
    const most = shown[0].n;
    const rows: RowView[] = shown.map((l) => rowOf(cut, l, dimension, c, w, { bar: l.n / most }));
    const leaders = list.filter((l) => l.n === most);
    const counted = (n: number) => kit.dataset.counted(n, windowPhrase(w));
    const prefix = c ? "ranking_view_" : "ranking_";
    const sentences: string[] = [];
    if (leaders.length > 1) {
      const text = say(words, `${prefix}tied`, { field: field.lower, view: viewPhrase(c), counted: counted(most), names: sayList(leaders.map((l) => kit.label.value(dimension, l.value))) });
      if (text) sentences.push(text);
    } else {
      const lead = leaders[0];
      const context = { field: field.lower, view: viewPhrase(c), name: kit.label.value(dimension, lead.value), counted: counted(most) };
      const cmp = comparison(lead, w);
      const direction = lead.outcome.kind === "change" ? lead.outcome.change.direction : undefined;
      const text = (cmp && direction ? say(words, `${prefix}${direction}`, { ...context, ...cmp }) : undefined) ?? say(words, `${prefix}alone`, context);
      if (text) sentences.push(text);
    }
    const year = say(words, c ? "col_year_window" : "col_year_all_window", {});
    const columns: BlockView["columns"] = [
      { name: field.label, key: "name" },
      ...(c ? [{ name: c.label, key: "count" as const }] : [...conditions.map((x, i) => ({ name: x.label, key: `part${i}` as const })), { name: words.view_all, key: "count" as const }]),
      ...(rows.some((r) => r.change || r.fresh) && year ? [{ name: year, key: "year" as const }] : []),
    ];
    return { label: c?.label ?? words.view_all, heading, sentences, columns, rows, notes: newNote(w, rows), win: wi, view: ci, ...panelLink(block, c, w, heading) };
  };

  const moversPanel = (block: BlockConfig, c: Condition | undefined, w: Window, wi: number, ci: number): PanelView | undefined => {
    const dimension = block.dimension as string;
    const field = ctx.fieldOf(dimension);
    const cut = views.cuts[dimension];
    if (!field || !cut) return undefined;
    const base = say(words, "heading_movers", { field: field.lower });
    const heading = headingOf(base, viewPhrase(c));
    if (heading === undefined) return undefined;
    const perMonth = block.minimum ?? periods.moverPerMonth;
    const floor = moverFloor(perMonth, w.months.length, kit.floors.change);
    const list = listWindow(cut, c?.value, basisFor(w, dimension), { above: views.floors[dimension] }) ?? [];
    const { rose, fell } = movers(list, { perMonth, months: w.months.length, changeFloor: kit.floors.change, least: block.least ?? 0, each: block.each ?? 3 });
    if (rose.length + fell.length === 0) return emptyPanel(block, c, w, heading, say(words, "view_empty_movers_window", { field: field.lower, minimum: count(floor), view: viewPhrase(c) }), wi, ci);
    const shownMoves = [...rose, ...fell];
    const largest = Math.max(...shownMoves.map((l) => (l.outcome.kind === "change" ? Math.abs(l.outcome.change.change) : 0)));
    const rows: RowView[] = shownMoves.map((l) => rowOf(cut, l, dimension, c, w, { prior: count(l.before ?? 0), bar: l.outcome.kind === "change" ? Math.abs(l.outcome.change.change) / largest : 0 }));
    const counted = (n: number) => kit.dataset.counted(n, windowPhrase(w));
    const sentences = [rose[0] && ["mover_up", rose[0]], fell[0] && ["mover_down", fell[0]]]
      .filter((x): x is [string, Listed] => Boolean(x))
      .flatMap(([key, l]) => {
        const text = say(words, c ? key.replace("mover_", "mover_view_") : key, { field: field.lower, view: viewPhrase(c), name: kit.label.value(dimension, l.value), counted: counted(l.n), ...comparison(l, w) });
        return text ? [text] : [];
      });
    const year = say(words, c ? "col_year_window" : "col_year_all_window", {});
    const earlier = say(words, "col_prior_window", {});
    if (!year || !earlier) return undefined;
    const columns: BlockView["columns"] = [
      { name: field.label, key: "name" },
      ...(c ? [{ name: c.label, key: "count" as const }, { name: earlier, key: "prior" as const }] : [...conditions.map((x, i) => ({ name: x.label, key: `part${i}` as const })), { name: words.view_all, key: "count" as const }]),
      { name: year, key: "year" },
    ];
    const note = say(words, "movers_floor_window", { minimum: count(floor) });
    return { label: c?.label ?? words.view_all, heading, sentences, columns, rows, notes: note ? [note] : [], win: wi, view: ci, ...panelLink(block, c, w, heading) };
  };

  const splitPanel = (block: BlockConfig, c: Condition | undefined, w: Window, wi: number, ci: number): PanelView | undefined => {
    const dimension = block.dimension as string;
    const field = ctx.fieldOf(dimension);
    const cut = views.cuts[dimension];
    if (!field || !cut) return undefined;
    const heading = headingOf(say(words, "heading_split", { field: field.lower }), viewPhrase(c));
    if (heading === undefined) return undefined;
    const here = ctx.has && w.months.every(ctx.has) ? totalFigure(cut, c?.value, w.months) : undefined;
    if (here === undefined || here < kit.floors.share) return emptyPanel(block, c, w, heading, say(words, "view_empty_split_window", { field: field.lower, view: viewPhrase(c), window: windowPhrase(w) }), wi, ci);
    const priorOk = w.prior.every(ctx.has);
    const earlierTotal = priorOk ? totalFigure(cut, c?.value, w.prior) : undefined;
    const shareable = earlierTotal !== undefined && earlierTotal >= kit.floors.share;
    const values = cut.values(w.months);
    const sums = values.flatMap((v) => (isReservedValue(v) ? [] : [[v, figure(cut, v, c?.value, w.months)] as [string, number]])).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || byName(a[0], b[0]));
    const restN = values.filter(isReservedValue).reduce((s, v) => s + figure(cut, v, c?.value, w.months), 0);
    const rows: RowView[] = sums.map(([value, n]) => {
      const earlier = priorOk ? figure(cut, value, c?.value, w.prior) : undefined;
      const ok = shareable && earlier !== undefined && earlier > 0 && ctx.comparableFor(w, dimension, value) === true;
      const delta = ok ? n / here - (earlier as number) / (earlierTotal as number) : undefined;
      const points = delta === undefined ? undefined : kit.format.points(delta);
      const split = points === undefined ? undefined : points.startsWith("−") || points.startsWith("-") ? "down" : points.startsWith("+") ? "up" : "same";
      return { name: kit.label.value(dimension, value), value, ...(c === undefined ? { parts: partsOf(cut, value, w) } : {}), count: count(n), share: kit.format.share(n / here), ...(points !== undefined && split ? { points: { text: points, direction: split as Change["direction"] } } : {}), bar: n / here };
    });
    if (restN > 0) rows.push({ name: words.rest, count: count(restN), ...(c === undefined ? { parts: conditions.map((x) => count(values.filter(isReservedValue).reduce((s, v) => s + figure(cut, v, x.value, w.months), 0))) } : {}), share: kit.format.share(restN / here), bar: restN / here });
    if (rows.length === 0) return emptyPanel(block, c, w, heading, say(words, "view_empty_ranking_window", { field: field.lower, view: viewPhrase(c), window: windowPhrase(w) }), wi, ci);
    const sentences: string[] = [];
    const top = sums[0]?.[1];
    if (top !== undefined) {
      const leaders = sums.filter(([, n]) => n === top);
      const context = { field: field.lower, view: viewPhrase(c), share: kit.format.share(top / here), window: windowPhrase(w), prior: priorPhrase(w) };
      if (leaders.length > 1) {
        const text = say(words, "split_win_tied", { ...context, names: sayList(leaders.map(([v]) => kit.label.value(dimension, v))) });
        if (text) sentences.push(text);
      } else {
        const lead = rows.find((r) => r.value === leaders[0][0]);
        const name = kit.label.value(dimension, leaders[0][0]);
        const text = lead?.points ? say(words, `split_win_${lead.points.direction}`, { ...context, name, points: lead.points.text.slice(1) }) : say(words, "split_win_alone", { ...context, name });
        if (text) sentences.push(text);
      }
    }
    const points = say(words, "col_points_window", {});
    const columns: BlockView["columns"] = [
      { name: field.label, key: "name" },
      ...(c ? [{ name: c.label, key: "count" as const }] : [...conditions.map((x, i) => ({ name: x.label, key: `part${i}` as const })), { name: words.view_all, key: "count" as const }]),
      { name: words.col_share, key: "share" },
      ...(rows.some((r) => r.points) && points ? [{ name: points, key: "points" as const }] : []),
    ];
    return { label: c?.label ?? words.view_all, heading, sentences, columns, rows, notes: [], win: wi, view: ci, ...panelLink(block, c, w, heading) };
  };

  // Each block that has views, once for each window and each condition and all of them: any that cannot be made leaves the section as it was.
  const panels = new Map<string, PanelView[]>();
  for (const b of ctx.blocks) {
    const block = config.blocks.find((x) => x.id === b.id);
    if (!block || block.views !== true) continue;
    const make = block.kind === "ranking" ? rankingPanel : block.kind === "movers" ? moversPanel : block.kind === "split" ? splitPanel : undefined;
    if (!make) return undefined;
    const list: PanelView[] = [];
    for (const w of windows) {
      for (const [ci, c] of all.entries()) {
        const p = make(block, c, w, w.index, ci);
        if (!p) return undefined;
        list.push(p);
      }
    }
    panels.set(b.id, list);
  }
  const legend = say(words, "window_legend", {});
  const labels = windows.map(labelOf);
  if (panels.size === 0 || legend === undefined || labels.some((l) => !l)) return undefined;

  // The figure over each window, by condition and for all, beside its change on the same months a year earlier.
  const totalCut = views.cuts[kit.config.view_field ?? ""];
  let table: PeriodTable | undefined;
  if (totalCut) {
    const heading = say(words, "heading_periods", {});
    const columns = [words.col_period, ...conditions.map((c) => c.label), words.view_all, words.col_change_all];
    const rows: PeriodRow[] = windows.flatMap((w) => {
      if (!w.months.every(ctx.has)) return [];
      const parts = conditions.map((c) => totalFigure(totalCut, c.value, w.months));
      const n = totalFigure(totalCut, undefined, w.months);
      const before = w.prior.every(ctx.has) ? totalFigure(totalCut, undefined, w.prior) : undefined;
      const outcome = changeOutcome({ now: n, before, comparable: ctx.comparableFor(w), floor: kit.floors.change });
      return [{ label: labelOf(w), cells: [...parts.map(count), count(n)], ...signed(outcome) }];
    });
    if (heading && rows.length > 0 && columns.every((c) => c !== undefined)) table = { heading, columns, rows, ...(rows.some((r) => r.fresh) ? { note: say(words, "new_entry_note", { prior: priorPhrase(windows[0]) }) } : {}) };
  }
  const items = windows.map((w) => say(words, "window_note_item", { label: labelOf(w), months: windowRange(w.months, (start, end) => say(words, "months_range", { start: monthLabel(start), end: monthLabel(end) }) ?? "", monthLabel) }));
  const note = items.every((x): x is string => x !== undefined) ? say(words, "window_note", { items: items.join("; ") }) : undefined;
  const newEntry = words.new_entry;
  if (newEntry === undefined) return undefined;
  return { panels, period: { legend, labels, checked: periods.defaultIndex }, table, note, newEntry };
}
