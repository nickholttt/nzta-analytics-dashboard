// The latest month, the first section of the front page (config/latest_month.json): what the newest month of new registrations holds, worked out from
// the slices the build published, each figure with its change on the same month a year earlier. Pure: it reads nothing and names no dataset, field,
// value or year, so tests/site/ runs it with Node's own test runner. The page's build hands it the slices (src/lib/latestMonthBuild.ts); every
// sentence is a template of config/latest_month.json, or one of the chart sentences' own (config/narrative/chart_sentences.json), filled with
// the facts worked out here (CLAUDE.md invariant 8).
//
// Three rules hold throughout:
//   - a sentence that cannot be filled, or that rests on a count the build hides, is dropped, never softened; a hidden count is shown as hidden and
//     never read as zero (the small-cell rule, D-127);
//   - a change on a year ago is left out where the earlier month is missing, has fewer vehicles than the change floor, or lies across a change in
//     how the data is recorded (invariant 7); the figure for the month stays;
//   - a block whose field the manifest does not list as live for the dataset, whose slice cannot be read, or whose slice disagrees with the others on
//     the month's total, is not drawn: no error and no empty box.
import configDoc from "../../config/latest_month.json";
import { countFact, countSentence, isReservedValue, splitChange } from "./chartSentence";
import type { SentenceTemplates } from "./chartSentence";
import { Cut } from "./conditionViews";
import { datasetLatestMonth, isBuilt } from "./data";
import type { Event, Manifest, SliceRow } from "./data";
import { recordingChange } from "./recordingChange";
import { addMonths, changeOnYear, count, fillTemplate, percent, sayList } from "./sentences";
import type { YearChange } from "./sentences";
import { windowedSection } from "./latestPeriods";
import type { PeriodsKit, PeriodTable } from "./latestPeriods";

export type BlockConfig = {
  id: string;
  kind: "total" | "split" | "ranking" | "movers";
  dimension?: string;
  top?: number;
  each?: number;
  minimum?: number;
  // The smallest change on a year ago (as a proportion) that is a move.
  least?: number;
  definition: string;
  canvas: { measure: string; by: boolean; type: string | null; settings?: Record<string, string> };
  // Whether the block is drawn once for each condition the dataset's vehicles are counted under and once for all of them, behind a switch.
  views?: boolean;
};
export type LatestConfig = {
  dataset: string;
  total_from: string;
  // The field whose values are the conditions the views split by (the figures of a block that has views, one for each value and one for all).
  view_field?: string;
  blocks: BlockConfig[];
  caveat: { href: string };
  hidden: { href: string };
  words: Record<string, string>;
};
export const latestConfig = configDoc as unknown as LatestConfig;

// Everything the section needs from outside: the slices as the site's loader reads them (a hidden cell has no count and the flag, never a zero),
// the events, and the site's own words and formatters, so nothing here reads config or names a domain value.
export type Kit = {
  config: LatestConfig;
  manifest: Manifest;
  // Each field's slice by field; absent where the file is missing or cannot be read.
  slices: Readonly<Record<string, readonly SliceRow[] | undefined>>;
  events: readonly Event[] | null;
  sentences: SentenceTemplates;
  label: { field: (dimension: string) => string | undefined; value: (dimension: string, value: string) => string };
  dataset: {
    // A count said in the dataset's words for a window ("in Oct 2026").
    counted: (n: number, window: string) => string;
    // Whether the dataset's counts can be compared with the same month a year earlier (a dataset of survivors cannot).
    showsYear: boolean;
    // What one month's figure counts, in the dataset's words: the heading of the month's figure.
    unit: string;
  };
  // "in Oct 2026".
  window: (month: string) => string;
  // The least number of vehicles in the earlier month for a change to be stated, and the least in a month for a share to be.
  floors: { change: number; share: number };
  format: { share: (x: number) => string; points: (delta: number) => string };
  hidden: { word: string; link: string; reason: (minimum: number) => string; note: (hidden: number, minimum: number) => string };
  // The minimum the build applied to a field's slice, where the manifest says it hid small counts.
  ruleMinimum: (dimension: string) => number | undefined;
  // The address of the canvas that draws a block's question, kept to the given values of other fields where there are any, or nothing where it cannot.
  // With a period (the id of a canvas period), the block's own period is replaced by it where the block has one.
  link: (block: BlockConfig, where?: Record<string, string[]>, period?: string) => string | undefined;
  // The windows the blocks with views are also drawn over (config/windows.json); absent, the section is drawn over the newest month alone.
  periods?: PeriodsKit;
  // The conditions the vehicles are split by and each field's counts under them, where the build can give them (src/lib/conditionViewsBuild.ts); absent,
  // the section is drawn without views.
  views?: ViewsKit;
  // The dataset's own source note (where its figures come from and when the export was taken), where the build has what it names, and the snapshot line.
  provenance: { source?: string; snapshot: string };
};

export type Condition = { value: string; label: string; phrase: string; phraseOne?: string };
// A condition's phrase for a count: its singular where the count is one ("1 used import"), so a figure never reads "1 used imports".
export const phraseFor = (c: Condition, n: number): string => (Math.round(n) === 1 ? (c.phraseOne ?? c.phrase) : c.phrase);
export type ViewsKit = {
  field: string;
  // In the order they are shown.
  conditions: readonly Condition[];
  cuts: Readonly<Record<string, Cut | undefined>>;
  // For a field the build caps, the fewest vehicles over a year of any value it names: a part of the count ranks a value only above it.
  floors: Readonly<Record<string, number | undefined>>;
};
// The switch has room for this many views, the conditions and all of them.
export const MAX_VIEWS = 5;

export type Change = { text: string; direction: "up" | "down" | "same" };
export type RowView = {
  name: string;
  // The value the name stands for, and each condition's count of it, in the order of the conditions.
  value?: string;
  parts?: string[];
  // Absent where the count is hidden.
  count?: string;
  hidden?: { word: string; reason: string };
  // The share of the month's vehicles, a prior-year count (movers), the change on a year ago and the change in share.
  share?: string;
  prior?: string;
  change?: Change;
  // No vehicles of this value in the same months a year earlier (a new entry): said in a tag of its own, with no percentage.
  fresh?: boolean;
  points?: Change;
  // The row's bar, from 0 to 1 of the block's largest; absent for a hidden count.
  bar?: number;
};
export type BlockView = {
  id: string;
  kind: BlockConfig["kind"];
  heading: string;
  sentences: string[];
  // The column headings, in the order the row's cells are drawn.
  columns: { name: string; key: "name" | "count" | "share" | "points" | "year" | "prior" | `part${number}` }[];
  rows: RowView[];
  notes: string[];
  // The block's figure (the total's) and the canvas address and definition it links to.
  figure?: string;
  canvas: string;
  canvasLabel: string;
  definition: string;
  hiddenLink?: string;
  // The month's figure said by its conditions ("Of these, ... new and ... used imports"), for the total.
  parts?: string;
  // The block once for each condition and once for all of them, in the order of the switch; the block's own fields above are the figures for all.
  views?: PanelView[];
  // The same block once for each window and each condition and all of them (window by window), where the section is drawn over windows.
  windowed?: PanelView[];
};
// One view of a block: its sentences, its table (or the line that says it has nothing) and its own link to the canvas.
export type PanelView = {
  label: string;
  heading: string;
  sentences: string[];
  columns: BlockView["columns"];
  rows: RowView[];
  notes: string[];
  empty?: string;
  // Absent where the canvas cannot draw the panel's period.
  canvas?: string;
  canvasLabel?: string;
  // The window and the view (condition, or all) a windowed panel is for, by position.
  win?: number;
  view?: number;
};
export type View = {
  month: string;
  prior: string;
  heading: string;
  intro: string;
  blocks: BlockView[];
  // The switch between the views of the blocks that have them; absent where no block has views.
  switch?: { legend: string; note: string; labels: string[]; period?: { legend: string; labels: string[]; checked: number } };
  // The month's figure over each window, and where each window's months are, where the section is drawn over windows.
  byPeriod?: PeriodTable;
  windowNote?: string;
  caveat: { text: string; link: string; href: string };
  hiddenHref: string;
  // The words of the links and the dash a block draws, from config.
  labels: { canvas: string; definition: string; noComparison: string; hiddenLink: string; newEntry?: string };
  provenance: Kit["provenance"];
  // Where the definition of what the section counts is, for the line that says where its figures come from.
  sourceLink: { text: string; href: string };
};

const say = (words: Record<string, string>, key: string, context: Record<string, unknown>): string | undefined => {
  const template = words[key];
  if (template === undefined) return undefined;
  const { text, unresolved } = fillTemplate(template, context);
  return unresolved.length === 0 ? text : undefined;
};

// ---- A month of one slice ----

export type MonthOf = { visible: Map<string, number>; hidden: string[]; total: number };

// The rows of one month of a slice: each visible value's count, the values whose count is hidden, and the month's total. Nothing where the slice
// has no rows for the month, where the month is not broken down by the field (its one row is no value of it), or where the rows do not agree on the
// month's total.
export function monthOf(slice: readonly SliceRow[] | undefined, month: string): MonthOf | undefined {
  if (!slice) return undefined;
  const rows = slice.filter((r) => r.month === month);
  if (rows.length === 0 || rows.some((r) => r.notBrokenDown)) return undefined;
  const total = rows[0].denominator;
  if (!Number.isFinite(total) || rows.some((r) => r.denominator !== total)) return undefined;
  const visible = new Map<string, number>();
  const hidden: string[] = [];
  for (const r of rows) {
    if (r.hidden || !Number.isFinite(r.n)) hidden.push(r.value);
    else visible.set(r.value, r.n);
  }
  return { visible, hidden, total };
}

const byCountThenName = (a: [string, number], b: [string, number]) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

const isLive = (manifest: Manifest, dataset: string, dimension: string): boolean => manifest.datasets[dataset]?.live_dimensions?.includes(dimension) === true;

// ---- The section ----

export function latestMonthView(kit: Kit): View | undefined {
  const { config, manifest } = kit;
  const words = config.words;
  if (!isBuilt(manifest, config.dataset)) return undefined;
  const month = datasetLatestMonth(manifest, config.dataset);
  const prior = addMonths(month, -12);
  const totalNow = monthOf(kit.slices[config.total_from], month);
  if (!totalNow) return undefined;
  const totalBefore = monthOf(kit.slices[config.total_from], prior);
  const total = totalNow.total;
  const priorTotal = totalBefore?.total;

  // Whether a figure of the month can be set beside the same month a year earlier: the dataset's counts allow it, and no change in how the data is
  // recorded lies between the two months for what is counted.
  const comparable = (scope: { dimension?: string; value?: string }) =>
    kit.dataset.showsYear && recordingChange(kit.events, prior, month, { dimension: scope.dimension, values: scope.value === undefined ? undefined : new Set([scope.value]) }) === false;

  // A field's two months, each agreeing with the total's on the month's total: a slice that says another total is not read.
  const read = (dimension: string) => {
    if (!isLive(manifest, config.dataset, dimension)) return undefined;
    const slice = kit.slices[dimension];
    const now = monthOf(slice, month);
    if (!now || now.total !== total) return undefined;
    const before = monthOf(slice, prior);
    return { now, before: before && priorTotal !== undefined && before.total === priorTotal ? before : undefined };
  };

  const yearChange = (dimension: string, value: string, n: number, before: MonthOf | undefined, floor: number): YearChange | undefined => {
    const earlier = before?.visible.get(value);
    if (earlier === undefined || !comparable({ dimension, value })) return undefined;
    return changeOnYear(n, earlier, floor);
  };
  const signed = (c: YearChange | undefined): Change | undefined =>
    c ? { direction: c.direction, text: c.direction === "same" ? words.level : `${c.change > 0 ? "+" : "−"}${percent(Math.abs(c.change))}` } : undefined;
  const pointsOf = (delta: number): Change | undefined => {
    const text = kit.format.points(delta);
    const split = splitChange(text);
    return split ? { direction: split.direction, text } : undefined;
  };
  const counted = (n: number) => kit.dataset.counted(n, kit.window(month));
  const comparison = (c: YearChange) => ({ change: Math.abs(c.change), prior_count: count(c.prior), prior: kit.window(prior) });
  const fieldOf = (dimension: string) => {
    const label = kit.label.field(dimension);
    return label === undefined ? undefined : { label, lower: /^[A-Z]{2,}(?![a-z])/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1) };
  };
  const ids = { month, prior_month: prior };

  // ---- The conditions the figures can be split by ----

  // Views need two conditions or more, and a switch with room for them and for all.
  const conditions: readonly Condition[] = kit.views && kit.views.conditions.length >= 2 && kit.views.conditions.length < MAX_VIEWS ? kit.views.conditions : [];
  const cutOf = (dimension: string): Cut | undefined => (conditions.length > 0 ? kit.views?.cuts[dimension] : undefined);
  // Each condition's count of a value (or of all the values given) in the newest month, said as figures.
  const partsOf = (cut: Cut | undefined, values: readonly string[]): string[] | undefined =>
    cut ? conditions.map((c) => count(values.reduce((sum, v) => sum + cut.at(v, c.value, month), 0))) : undefined;

  const view = (block: BlockConfig, v: Omit<BlockView, "id" | "kind" | "canvas" | "canvasLabel" | "definition">): BlockView | undefined => {
    const canvas = kit.link(block);
    const named = say(words, "canvas_link_named", { heading: v.heading });
    if (canvas === undefined || named === undefined) return undefined;
    return { id: block.id, kind: block.kind, ...v, canvas, canvasLabel: named, definition: block.definition };
  };

  // ---- The month's figure ----

  const totalBlock = (block: BlockConfig): BlockView | undefined => {
    const at = (m: string) => (m === month ? total : m === prior ? priorTotal : undefined);
    const fact = countFact(at, month, { floor: kit.floors.change, comparable: comparable({}) });
    const sentence = countSentence(kit.sentences, fact, { counted: (n, m) => kit.dataset.counted(n, kit.window(m)), window: kit.window });
    if (!sentence) return undefined;
    // The figure said by its conditions: "Of these, 14,904 new vehicles and 8,650 used imports", or that all were of one.
    const held = conditions.map((c) => ({ c, n: totalNow.visible.get(c.value) ?? 0 })).filter((x) => x.n > 0);
    const texts = held.map((x) => say(words, "part", { count: count(x.n), view: phraseFor(x.c, x.n) }));
    const parts =
      held.length === 1
        ? say(words, "parts_one", { view: held[0].c.phrase })
        : held.length > 1 && texts.every((t): t is string => t !== undefined)
          ? say(words, "parts_total", { parts: sayList(texts) })
          : undefined;
    const shown = view(block, { heading: kit.dataset.unit, sentences: [sentence], columns: [], rows: [], notes: [], figure: count(total) });
    return shown && parts ? { ...shown, parts } : shown;
  };

  // ---- Every value of a field ----

  const splitBlock = (block: BlockConfig): BlockView | undefined => {
    const dimension = block.dimension as string;
    const field = fieldOf(dimension);
    const data = read(dimension);
    // Shares of a month with fewer vehicles than the share floor are too imprecise to state.
    if (!field || !data || total < kit.floors.share) return undefined;
    const { now, before } = data;
    const shareable = before !== undefined && before.total >= kit.floors.share;
    const minimum = kit.ruleMinimum(dimension);
    const named = [...now.visible].filter(([value]) => !isReservedValue(value)).sort(byCountThenName);
    const restN = [...now.visible].filter(([value]) => isReservedValue(value)).reduce((s, [, n]) => s + n, 0);
    const cut = cutOf(dimension);
    const reserved = [...now.visible.keys()].filter(isReservedValue);
    const rows: RowView[] = named.map(([value, n]) => {
      const earlier = before?.visible.get(value);
      const delta = shareable && earlier !== undefined && comparable({ dimension, value }) ? n / total - earlier / before.total : undefined;
      return { name: kit.label.value(dimension, value), value, parts: partsOf(cut, [value]), count: count(n), share: kit.format.share(n / total), points: delta === undefined ? undefined : pointsOf(delta), bar: n / total };
    });
    if (restN > 0) rows.push({ name: words.rest, parts: partsOf(cut, reserved), count: count(restN), share: kit.format.share(restN / total), bar: restN / total });
    for (const value of now.hidden) {
      rows.push({ name: kit.label.value(dimension, value), hidden: { word: kit.hidden.word, reason: kit.hidden.reason(minimum ?? 0) } });
    }
    // The largest group, said only where no count is hidden: a hidden count is not known to be smaller.
    const sentences: string[] = [];
    if (named.length > 0 && now.hidden.length === 0) {
      const top = named[0][1];
      const leaders = named.filter(([, n]) => n === top);
      const share = kit.format.share(top / total);
      const context = { ...ids, field: field.lower, share };
      if (leaders.length > 1) {
        const text = say(words, "split_tied", { ...context, names: sayList(leaders.map(([v]) => kit.label.value(dimension, v))) });
        if (text) sentences.push(text);
      } else {
        const [value] = leaders[0];
        const name = kit.label.value(dimension, value);
        const lead = rows.find((r) => r.name === name);
        const text = lead?.points
          ? say(words, `split_${lead.points.direction}`, { ...context, name, points: lead.points.text.slice(1) })
          : say(words, "split_alone", { ...context, name });
        if (text) sentences.push(text);
      }
    }
    const heading = say(words, "heading_split", { field: field.lower });
    if (heading === undefined || rows.length === 0) return undefined;
    const year = say(words, "col_points", ids);
    const columns: BlockView["columns"] = [
      { name: field.label, key: "name" },
      { name: words.col_count, key: "count" },
      { name: words.col_share, key: "share" },
      ...(rows.some((r) => r.points) && year ? [{ name: year, key: "points" as const }] : []),
    ];
    const notes = now.hidden.length > 0 ? [kit.hidden.note(now.hidden.length, minimum ?? 0)] : [];
    return view(block, { heading, sentences, columns, rows, notes, hiddenLink: now.hidden.length > 0 ? config.hidden.href : undefined });
  };

  // ---- The largest values ----

  const rankingBlock = (block: BlockConfig): BlockView | undefined => {
    const dimension = block.dimension as string;
    const field = fieldOf(dimension);
    const data = read(dimension);
    if (!field || !data) return undefined;
    const { now, before } = data;
    const minimum = kit.ruleMinimum(dimension);
    const ranked = [...now.visible].filter(([value]) => !isReservedValue(value)).sort(byCountThenName);
    const shown = ranked.slice(0, block.top ?? 5);
    if (shown.length === 0) return undefined;
    const most = shown[0][1];
    const cut = cutOf(dimension);
    const rows: RowView[] = shown.map(([value, n]) => ({
      name: kit.label.value(dimension, value),
      value,
      parts: partsOf(cut, [value]),
      count: count(n),
      change: signed(yearChange(dimension, value, n, before, kit.floors.change)),
      bar: n / most,
    }));
    const sentences: string[] = [];
    // First place is said only where no count is hidden: a hidden count is not known to be smaller.
    if (now.hidden.length === 0) {
      const leaders = ranked.filter(([, n]) => n === most);
      if (leaders.length > 1) {
        const text = say(words, "ranking_tied", {
          field: field.lower,
          counted: counted(most),
          names: sayList(leaders.map(([v]) => kit.label.value(dimension, v))),
        });
        if (text) sentences.push(text);
      } else {
        const [value] = leaders[0];
        const c = yearChange(dimension, value, most, before, kit.floors.change);
        const context = { field: field.lower, name: kit.label.value(dimension, value), counted: counted(most) };
        const text = c ? say(words, `ranking_${c.direction}`, { ...context, ...comparison(c) }) ?? say(words, "ranking_alone", context) : say(words, "ranking_alone", context);
        if (text) sentences.push(text);
      }
    }
    const heading = say(words, "heading_ranking", { field: field.lower });
    const year = say(words, "col_year", ids);
    if (heading === undefined) return undefined;
    const columns: BlockView["columns"] = [
      { name: field.label, key: "name" },
      { name: words.col_count, key: "count" },
      ...(rows.some((r) => r.change) && year ? [{ name: year, key: "year" as const }] : []),
    ];
    const notes = now.hidden.length > 0 ? [kit.hidden.note(now.hidden.length, minimum ?? 0)] : [];
    return view(block, { heading, sentences, columns, rows, notes, hiddenLink: now.hidden.length > 0 ? config.hidden.href : undefined });
  };

  // ---- The largest moves ----

  const moversBlock = (block: BlockConfig): BlockView | undefined => {
    const dimension = block.dimension as string;
    const field = fieldOf(dimension);
    const data = read(dimension);
    const minimum = block.minimum ?? 0;
    if (!field || !data || !data.before) return undefined;
    const { now, before } = data;
    // Both months must reach the block's minimum, so a move from 2 to 6 is not a headline; a hidden count is no candidate.
    const moves = [...now.visible]
      .filter(([value, n]) => !isReservedValue(value) && n >= minimum)
      .flatMap(([value, n]) => {
        const c = yearChange(dimension, value, n, before, Math.max(minimum, kit.floors.change));
        return c && c.direction !== "same" && Math.abs(c.change) >= (block.least ?? 0) ? [{ value, n, c }] : [];
      });
    const rose = moves.filter((m) => m.c.direction === "up").sort((a, b) => b.c.change - a.c.change || (a.value < b.value ? -1 : 1)).slice(0, block.each ?? 3);
    const fell = moves.filter((m) => m.c.direction === "down").sort((a, b) => a.c.change - b.c.change || (a.value < b.value ? -1 : 1)).slice(0, block.each ?? 3);
    if (rose.length + fell.length === 0) return undefined;
    const largest = Math.max(...[...rose, ...fell].map((m) => Math.abs(m.c.change)));
    const cut = cutOf(dimension);
    const rows: RowView[] = [...rose, ...fell].map((m) => ({
      name: kit.label.value(dimension, m.value),
      value: m.value,
      parts: partsOf(cut, [m.value]),
      count: count(m.n),
      prior: count(m.c.prior),
      change: signed(m.c),
      bar: Math.abs(m.c.change) / largest,
    }));
    const sentences = [rose[0] && ["mover_up", rose[0]], fell[0] && ["mover_down", fell[0]]]
      .filter((x): x is [string, (typeof rose)[number]] => Boolean(x))
      .flatMap(([key, m]) => {
        const text = say(words, key, { field: field.lower, name: kit.label.value(dimension, m.value), counted: counted(m.n), ...comparison(m.c) });
        return text ? [text] : [];
      });
    const heading = say(words, "heading_movers", { field: field.lower });
    const year = say(words, "col_year", ids);
    const earlier = say(words, "col_prior", ids);
    const floor = say(words, "movers_floor", { minimum: count(minimum) });
    if (heading === undefined || !year || !earlier) return undefined;
    const columns: BlockView["columns"] = [
      { name: field.label, key: "name" },
      { name: words.col_count, key: "count" },
      { name: earlier, key: "prior" },
      { name: year, key: "year" },
    ];
    return view(block, { heading, sentences, columns, rows, notes: floor ? [floor] : [] });
  };

  // ---- A block once for each condition, and once for all ----

  type Panel = PanelView;
  const headingOf = (heading: string | undefined, view: string) => (heading === undefined ? undefined : say(words, "heading_view", { heading, view }));
  // A panel with its own link to the canvas: the block's question kept to the condition, or the block's own for all of them.
  const panelOf = (block: BlockConfig, label: string, heading: string, c: Condition | undefined, body: Omit<Panel, "label" | "heading" | "canvas" | "canvasLabel">): Panel | undefined => {
    const canvas = kit.link(block, c && kit.views ? { [kit.views.field]: [c.value] } : undefined);
    const named = say(words, "canvas_link_named", { heading });
    return canvas === undefined || named === undefined ? undefined : { label, heading, canvas, canvasLabel: named, ...body };
  };
  const emptyPanel = (block: BlockConfig, c: Condition, heading: string, message: string | undefined): Panel | undefined =>
    message === undefined ? undefined : panelOf(block, c.label, heading, c, { sentences: [], columns: [], rows: [], notes: [], empty: message });

  // The year's change for a value's count under a condition: set beside the same month a year earlier under the same condition.
  const changeUnder = (dimension: string, cut: Cut, c: Condition, before: MonthOf | undefined, value: string, n: number, floor: number): YearChange | undefined =>
    before === undefined || !comparable({ dimension, value }) ? undefined : changeOnYear(n, cut.at(value, c.value, prior), floor);

  const rankingPanel = (block: BlockConfig, c: Condition): Panel | undefined => {
    const dimension = block.dimension as string;
    const field = fieldOf(dimension);
    const cut = cutOf(dimension);
    const data = read(dimension);
    if (!field || !cut || !data) return undefined;
    const floor = kit.views?.floors[dimension];
    const heading = headingOf(say(words, "heading_ranking", { field: field.lower }), c.phrase);
    if (heading === undefined) return undefined;
    // A value ranks among the vehicles of this condition only where it has some, and, for a field the build caps, only above the fewest any named value has:
    // below that a value the cap grouped as other may have more.
    const ranked = cut
      .values([month])
      .flatMap((v) => {
        const n = cut.at(v, c.value, month);
        return isReservedValue(v) || n <= 0 || (floor !== undefined && n <= floor) ? [] : [[v, n] as [string, number]];
      })
      .sort(byCountThenName);
    const shown = ranked.slice(0, block.top ?? 5);
    if (shown.length === 0) return emptyPanel(block, c, heading, say(words, "view_empty_ranking", { ...ids, field: field.lower, view: c.phrase }));
    const most = shown[0][1];
    const rows: RowView[] = shown.map(([value, n]) => ({
      name: kit.label.value(dimension, value),
      value,
      count: count(n),
      change: signed(changeUnder(dimension, cut, c, data.before, value, n, kit.floors.change)),
      bar: n / most,
    }));
    const leaders = ranked.filter(([, n]) => n === most);
    const sentences: string[] = [];
    if (leaders.length > 1) {
      const text = say(words, "ranking_view_tied", { field: field.lower, view: c.phrase, counted: counted(most), names: sayList(leaders.map(([v]) => kit.label.value(dimension, v))) });
      if (text) sentences.push(text);
    } else {
      const [value] = leaders[0];
      const change = changeUnder(dimension, cut, c, data.before, value, most, kit.floors.change);
      const context = { field: field.lower, view: c.phrase, name: kit.label.value(dimension, value), counted: counted(most) };
      const text = (change ? say(words, `ranking_view_${change.direction}`, { ...context, ...comparison(change) }) : undefined) ?? say(words, "ranking_view_alone", context);
      if (text) sentences.push(text);
    }
    const year = say(words, "col_year", ids);
    const columns: BlockView["columns"] = [{ name: field.label, key: "name" }, { name: c.label, key: "count" }, ...(rows.some((r) => r.change) && year ? [{ name: year, key: "year" as const }] : [])];
    return panelOf(block, c.label, heading, c, { sentences, columns, rows, notes: [] });
  };

  const moversPanel = (block: BlockConfig, c: Condition): Panel | undefined => {
    const dimension = block.dimension as string;
    const field = fieldOf(dimension);
    const cut = cutOf(dimension);
    const data = read(dimension);
    if (!field || !cut || !data) return undefined;
    const floor = kit.views?.floors[dimension];
    const minimum = block.minimum ?? 0;
    const heading = headingOf(say(words, "heading_movers", { field: field.lower }), c.phrase);
    if (heading === undefined) return undefined;
    // The block's rules, applied to this condition's counts in both months.
    const moves = cut.values([month]).flatMap((value) => {
      const n = cut.at(value, c.value, month);
      if (isReservedValue(value) || n < minimum || (floor !== undefined && n <= floor)) return [];
      const change = changeUnder(dimension, cut, c, data.before, value, n, Math.max(minimum, kit.floors.change));
      return change && change.direction !== "same" && Math.abs(change.change) >= (block.least ?? 0) ? [{ value, n, c: change }] : [];
    });
    const each = block.each ?? 3;
    const rose = moves.filter((m) => m.c.direction === "up").sort((a, b) => b.c.change - a.c.change || (a.value < b.value ? -1 : 1)).slice(0, each);
    const fell = moves.filter((m) => m.c.direction === "down").sort((a, b) => a.c.change - b.c.change || (a.value < b.value ? -1 : 1)).slice(0, each);
    if (rose.length + fell.length === 0) return emptyPanel(block, c, heading, say(words, "view_empty_movers", { field: field.lower, minimum: count(minimum), view: c.phrase }));
    const largest = Math.max(...[...rose, ...fell].map((m) => Math.abs(m.c.change)));
    const rows: RowView[] = [...rose, ...fell].map((m) => ({ name: kit.label.value(dimension, m.value), value: m.value, count: count(m.n), prior: count(m.c.prior), change: signed(m.c), bar: Math.abs(m.c.change) / largest }));
    const sentences = [rose[0] && ["mover_view_up", rose[0]], fell[0] && ["mover_view_down", fell[0]]]
      .filter((x): x is [string, (typeof rose)[number]] => Boolean(x))
      .flatMap(([key, m]) => {
        const text = say(words, key, { field: field.lower, view: c.phrase, name: kit.label.value(dimension, m.value), counted: counted(m.n), ...comparison(m.c) });
        return text ? [text] : [];
      });
    const year = say(words, "col_year", ids);
    const earlier = say(words, "col_prior", ids);
    const floorNote = say(words, "movers_floor", { minimum: count(minimum) });
    if (!year || !earlier) return undefined;
    const columns: BlockView["columns"] = [{ name: field.label, key: "name" }, { name: c.label, key: "count" }, { name: earlier, key: "prior" }, { name: year, key: "year" }];
    return panelOf(block, c.label, heading, c, { sentences, columns, rows, notes: floorNote ? [floorNote] : [] });
  };

  const splitPanel = (block: BlockConfig, c: Condition): Panel | undefined => {
    const dimension = block.dimension as string;
    const field = fieldOf(dimension);
    const cut = cutOf(dimension);
    const data = read(dimension);
    if (!field || !cut || !data) return undefined;
    const heading = headingOf(say(words, "heading_split", { field: field.lower }), c.phrase);
    if (heading === undefined) return undefined;
    const here = cut.total(c.value, month);
    // Shares of a month with fewer vehicles than the share floor are too imprecise to state.
    if (here < kit.floors.share) return emptyPanel(block, c, heading, say(words, "view_empty_split", { ...ids, field: field.lower, view: c.phrase }));
    const earlierTotal = cut.total(c.value, prior);
    const shareable = data.before !== undefined && earlierTotal >= kit.floors.share;
    const values = cut.values([month]);
    const named = values.flatMap((v) => (isReservedValue(v) || cut.at(v, c.value, month) <= 0 ? [] : [[v, cut.at(v, c.value, month)] as [string, number]])).sort(byCountThenName);
    const restN = values.filter(isReservedValue).reduce((sum, v) => sum + cut.at(v, c.value, month), 0);
    const rows: RowView[] = named.map(([value, n]) => {
      const earlier = cut.at(value, c.value, prior);
      const delta = shareable && earlier > 0 && comparable({ dimension, value }) ? n / here - earlier / earlierTotal : undefined;
      return { name: kit.label.value(dimension, value), value, count: count(n), share: kit.format.share(n / here), points: delta === undefined ? undefined : pointsOf(delta), bar: n / here };
    });
    if (restN > 0) rows.push({ name: words.rest, count: count(restN), share: kit.format.share(restN / here), bar: restN / here });
    if (rows.length === 0) return emptyPanel(block, c, heading, say(words, "view_empty_ranking", { ...ids, field: field.lower, view: c.phrase }));
    const sentences: string[] = [];
    const top = named[0]?.[1];
    if (top !== undefined) {
      const leaders = named.filter(([, n]) => n === top);
      const context = { ...ids, field: field.lower, view: c.phrase, share: kit.format.share(top / here) };
      if (leaders.length > 1) {
        const text = say(words, "split_view_tied", { ...context, names: sayList(leaders.map(([v]) => kit.label.value(dimension, v))) });
        if (text) sentences.push(text);
      } else {
        const name = kit.label.value(dimension, leaders[0][0]);
        const lead = rows.find((r) => r.value === leaders[0][0]);
        const text = lead?.points ? say(words, `split_view_${lead.points.direction}`, { ...context, name, points: lead.points.text.slice(1) }) : say(words, "split_view_alone", { ...context, name });
        if (text) sentences.push(text);
      }
    }
    const year = say(words, "col_points", ids);
    const columns: BlockView["columns"] = [
      { name: field.label, key: "name" },
      { name: c.label, key: "count" },
      { name: words.col_share, key: "share" },
      ...(rows.some((r) => r.points) && year ? [{ name: year, key: "points" as const }] : []),
    ];
    return panelOf(block, c.label, heading, c, { sentences, columns, rows, notes: [] });
  };

  // All the vehicles: the block's own figures, with each condition's count beside the total (and the earlier month's count left to the sentence).
  const allPanel = (block: BlockConfig, base: BlockView): Panel | undefined => {
    if (base.rows.some((r) => r.parts === undefined)) return undefined;
    // The change column sits beside each condition's count but is the change in the total, and says so.
    const wholly = say(words, "col_year_all", ids);
    const columns: BlockView["columns"] = base.columns.flatMap((col) =>
      col.key === "prior" ? [] : col.key === "count" ? [...conditions.map((c, i) => ({ name: c.label, key: `part${i}` as const })), { name: words.view_all, key: "count" as const }] : col.key === "year" && wholly ? [{ ...col, name: wholly }] : [col],
    );
    const heading = headingOf(base.heading, words.view_all_phrase);
    if (heading === undefined) return undefined;
    return panelOf(block, words.view_all, heading, undefined, { sentences: base.sentences, columns, rows: base.rows, notes: base.notes });
  };

  const panelsOf = (block: BlockConfig, base: BlockView): PanelView[] | undefined => {
    const make = block.kind === "ranking" ? rankingPanel : block.kind === "movers" ? moversPanel : block.kind === "split" ? splitPanel : undefined;
    if (!make) return undefined;
    const panels = [...conditions.map((c) => make(block, c)), allPanel(block, base)];
    return panels.every((p): p is Panel => p !== undefined) ? panels : undefined;
  };

  const builders = { total: totalBlock, split: splitBlock, ranking: rankingBlock, movers: moversBlock } as const;
  let blocks = config.blocks.flatMap((block) => {
    const built = builders[block.kind](block);
    return built ? [built] : [];
  });
  // Each block that has views is drawn once for each condition and once for all of them behind one switch: or, where any of them cannot be made (a
  // field with no cut, a link the canvas does not answer as asked, a word that does not fill), none is and the section is drawn as it was.
  const viewed = blocks.filter((b) => config.blocks.find((x) => x.id === b.id)?.views === true);
  const made = viewed.map((b) => panelsOf(config.blocks.find((x) => x.id === b.id) as BlockConfig, b));
  const legend = say(words, "view_legend", {});
  const note = say(words, "view_note", {});
  const switchable = viewed.length > 0 && made.every((p) => p !== undefined) && legend !== undefined && note !== undefined;
  if (switchable) blocks = blocks.map((b) => (viewed.includes(b) ? { ...b, views: made[viewed.indexOf(b)] } : b));
  // Over each window too: where any panel cannot be made, the section is drawn over the newest month as it was.
  const windowed =
    switchable && kit.periods
      ? windowedSection(kit, kit.periods, {
          month,
          has: (m) => monthOf(kit.slices[config.total_from], m) !== undefined,
          conditions,
          comparableFor: (win, dimension, value) => kit.dataset.showsYear && recordingChange(kit.events, win.prior[0], month, { dimension, values: value === undefined ? undefined : new Set([value]) }) === false,
          fieldOf,
          blocks: viewed,
        })
      : undefined;
  if (windowed) blocks = blocks.map((b) => (windowed.panels.has(b.id) ? { ...b, windowed: windowed.panels.get(b.id) } : b));
  // The month's figure is the section's answer: without it there is no section.
  if (!blocks.some((b) => b.kind === "total")) return undefined;
  const heading = say(words, "heading", ids);
  const intro = say(words, "intro", ids);
  if (heading === undefined || intro === undefined) return undefined;
  return { month, prior, heading, intro, blocks, ...(switchable ? { switch: { legend: legend as string, note: windowed?.note ? `${note as string} ${windowed.note}` : (note as string), labels: [...conditions.map((c) => c.label), words.view_all], ...(windowed ? { period: windowed.period } : {}) } } : {}), ...(windowed?.table ? { byPeriod: windowed.table } : {}), ...(windowed?.note ? { windowNote: windowed.note } : {}), caveat: { text: words.caveat, link: words.caveat_link, href: config.caveat.href }, hiddenHref: config.hidden.href, labels: { canvas: words.canvas_link, definition: words.definition_link, noComparison: words.no_comparison, hiddenLink: kit.hidden.link, ...(windowed ? { newEntry: windowed.newEntry } : {}) }, provenance: kit.provenance, sourceLink: { text: words.source_link, href: config.blocks.find((b) => b.kind === "total")?.definition ?? config.caveat.href } };
}
