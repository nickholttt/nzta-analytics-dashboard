// The answer pages (config/answer_pages.json): a page for each brand and each model above a minimum volume, and their index. Worked out when the
// site is built from the slices the build published (src/lib/answerPagesBuild.ts hands them over); the pages ship no script. Pure: it reads nothing
// and names no dataset, field, value or year, so tests/site/ runs it with Node's own test runner. Every sentence is a template of
// config/answer_pages.json filled with the facts worked out here (CLAUDE.md invariant 8).
//
// The rules that hold throughout, the latest month's own (src/lib/latestMonth.ts):
//   - a sentence that cannot be filled, or that rests on a count the build hides, is dropped, never softened; a hidden count is shown as hidden and
//     never read as zero (the small-cell rule, D-127): a value with a hidden count in its window has no page, and a place is not stated while any
//     count in the ranking is hidden;
//   - a change on a year ago is left out where the earlier period is missing, has fewer vehicles than the change floor, or lies across a change in
//     how the data is recorded (invariant 7); the figure stays;
//   - a place is not stated for a value level with another.
// Only true registrations are read: one dataset (config), so survivors and flow are never in one table.
import configDoc from "../../config/answer_pages.json";
import { datasetLatestMonth, isBuilt } from "./data";
import type { Event, Manifest, SliceRow } from "./data";
import { Cut } from "./conditionViews";
import { MAX_VIEWS, monthOf, phraseFor } from "./latestMonth";
import type { Condition, MonthOf } from "./latestMonth";
import { recordingChange } from "./recordingChange";
import { slugsFor } from "./answerSlug";
import { addMonths, changeOnYear, count, fillTemplate, monthLabel, monthRange, percent, sayList } from "./sentences";
import { isReservedValue } from "./chartSentence";
import { basisOf, cutPeriods, leadersPanel, moversPanel, modelsPanel, cutPanel, rivalsPanel, say as sayIn, sectionOf, scopeOf, valuePeriods, windowLabel } from "./answerPeriods";
import type { Cell, Env, Row, Scope, Section } from "./answerPeriods";
import type { PeriodTable } from "./latestPeriods";
import { nearestRivals } from "./rivals";
import { windowPhrase, windowRange, windowsFor } from "./windows";
import type { Window } from "./windows";
import { fieldNoteAnchor } from "./dimensionNote";
import { figure, listOne, totalFigure } from "./periodTables";

export type FieldConfig = { dimension: string; path: string; minimum: number };
export type AnswerConfig = {
  dataset: string;
  measure: string;
  window: number;
  brand: FieldConfig;
  model: FieldConfig;
  // The field the lists are cut by, one page for each value with at least `minimum` vehicles over the window (a value of a field the pages cut their lists by).
  cut: FieldConfig;
  // The field whose values the vehicles are counted under (new or used): each page says its figures by them.
  view_field?: string;
  models_listed: number;
  // The canvas period a brand's rivals are drawn month by month over.
  rivals_trend_period: string;
  months_shown: number;
  index_path: string;
  description_length: [number, number];
  definition: string;
  caveat: { href: string };
  words: Record<string, string>;
};
export const answerConfig = configDoc as unknown as AnswerConfig;

export type Kind = "brand" | "model";
// A page's kind: a brand's, a model's, or a cut's (every vehicle of one value of the cut field).
export type PageKind = Kind | "cut";

// Everything the pages need from outside: the slices as the site's loader reads them, the events, and the site's own words and formatters, so nothing
// here reads config or names a domain value.
export type Kit = {
  config: AnswerConfig;
  manifest: Manifest;
  // The slice of each field the pages are made for; absent where the file is missing or cannot be read.
  slices: Readonly<Record<Kind, readonly SliceRow[] | undefined>>;
  events: readonly Event[] | null;
  // A value as a visitor reads it, and the separator a compound value (a model, as brand and model) is joined with.
  label: (dimension: string, value: string) => string;
  // A compound value (a model) without its leading parts (its brand): a brand's own table names its models by this. Absent, the label is used.
  tail?: (dimension: string, value: string) => string;
  separator: string | undefined;
  dataset: {
    // A count said in the dataset's words for a period ("in the 12 months to Oct 2026").
    counted: (n: number, period: string) => string;
    // Whether the dataset's counts can be compared with the same period a year earlier (a dataset of survivors cannot).
    showsYear: boolean;
  };
  // The phrase that follows a figure: the months to a month ("in the 12 months to Oct 2026"), and one month ("in Oct 2026").
  period: { window: (end: string, months: number) => string; month: (month: string) => string };
  // The words for what a year-on-year column compares with.
  phrases: { priorMonths: string };
  // The least number of vehicles in the earlier period for a change to be stated, and the least in a total for a share to be.
  floors: { change: number; share: number };
  format: { share: (x: number) => string };
  // The address of the canvas that draws one value's question (split by a field, where one is given), or nothing where it cannot.
  link: (kind: Kind, value: string, by?: string) => string | undefined;
  // The conditions the vehicles are counted under and each field's counts by them, where the build can give them (src/lib/conditionViewsBuild.ts); absent,
  // the pages are drawn without them.
  views?: {
    field: string;
    // The field as the second link names it.
    fieldLabel: string;
    conditions: readonly Condition[];
    cuts: Readonly<Partial<Record<Kind, Cut>>>;
    // The fewest vehicles over the window of any model the build names: a model ranks on a part of its count only above it.
    floor: number | undefined;
  };
  // Where the figures come from and the snapshot's date, as the latest month says them.
  provenance: { source?: string; snapshot: string };
  // The windows the pages also say their figures over (config/windows.json); absent, they are said over the 12 months alone.
  periods?: { windows: readonly Window[]; defaultIndex: number; moverPerMonth: number; span: (end: string, months: number) => string; range: (start: string, end: string) => string };
  // Each field's counts cut to each value of the cut field, where the fact table agrees with the slices (src/lib/cutSet.ts), and how the values are named and ordered.
  cutBy?: {
    field: string;
    // The values with a page of their own, in the reference file's order, and every value in that order.
    chips: readonly string[];
    order: readonly string[];
    label: (value: string) => string;
    cuts: Readonly<Record<Kind, ReadonlyMap<string, Cut>>>;
    // The value whose line is only partly identified, and the address of the note about how it is counted.
    noted?: { value: string; href: string };
    // The words about the field a page of a value carries: the field's note, and, for the line that is only partly identified, how far it is.
    notes: (value: string) => string[];
    // The phrase a value is said by in a sentence ("battery electric vehicles").
    phrase: (value: string) => string;
  };
  // The address of the canvas that draws a question about the config's dataset and measure, or nothing where it cannot.
  askLink?: (ask: { by: string | null; type: string | null; settings?: Record<string, string>; where?: Record<string, string[]>; values?: string[] }) => string | undefined;
};

export type TableCell = Cell;
export type TableRow = Row;
export type TableView = {
  heading: string;
  columns: string[];
  rows: TableRow[];
  note?: string;
  // The table once for each condition and once for all (the table's own columns and rows are the figures for all), and the words of the switch between them.
  views?: { label: string; heading: string; columns: string[]; rows: TableRow[]; empty?: string }[];
  switch?: { legend: string; note: string; labels: string[] };
};
export type PageView = {
  kind: PageKind;
  value: string;
  name: string;
  slug: string;
  href: string;
  title: string;
  description: string;
  // The vehicles in the window, as the page's headline figure, and the sentences that say it.
  figure: string;
  sentences: string[];
  tables: TableView[];
  // The figure over each window, and the tables behind the two-choice switch (the period and the vehicles counted), where the build gives windows.
  periods?: PeriodTable;
  scope?: Scope;
  // The one table the page draws over the 12 months with no choice (a model's cut values).
  fixed?: Section;
  // On a page of a cut: the links to every cut's page, with this one marked; and the notes about the field.
  cutNav?: CutNav;
  notes?: string[];
  // More links to the canvas, after the page's own.
  more?: { href: string; text: string; named: string }[];
  canvas: { href: string; text: string; named: string };
  // The same question split by the condition, month by month.
  canvasSplit?: { href: string; text: string; named: string };
  // The window's figure by condition and for all, beside the big figure.
  parts?: { label: string; value: string }[];
  // The brand of a model, as the model's page links to it (the link only where the brand has a page).
  brand?: { name: string; href?: string; text?: string };
  // The words the page draws beside its content, from config.
  labels: { definition: string; source: string; caveat: string; caveatLink: string; noComparison: string; noComparisonReason: string; breadcrumb: string; home: string; index: string; newEntry: string };
  caveatHref: string;
  definitionHref: string;
  provenance: Kit["provenance"];
};
export type CutNav = { legend: string; all: { text: string; href: string }; items: { text: string; href: string; current?: boolean }[]; note?: { text: string; href: string; after: number } };
export type IndexEntry = { name: string; href?: string; models: { name: string; href: string }[]; modelsLabel: string };
export type IndexView = { href: string; title: string; intro: string; entries: IndexEntry[] };
export type Site = {
  month: string;
  pages: PageView[];
  index: IndexView | undefined;
  // The row of links to the pages of the cuts (with this one marked on its own page); absent where there are none.
  cutNav?: CutNav;
  // The page of each value by kind, by the value's label: for the front page's tables, which name a value as a label.
  byLabel: Record<Kind, ReadonlyMap<string, string | null>>;
};

const say = (words: Record<string, string>, key: string, context: Record<string, unknown>): string | undefined => {
  const template = words[key];
  if (template === undefined) return undefined;
  const { text, unresolved } = fillTemplate(template, context);
  return unresolved.length === 0 ? text : undefined;
};

const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ---- The counts of one field, month by month ----

// What a field's slice says of the months the pages read: each month as monthOf reads it, and nothing for a month the slice lacks.
class Counts {
  constructor(private readonly months: ReadonlyMap<string, MonthOf>) {}

  static read(slice: readonly SliceRow[] | undefined, months: readonly string[]): Counts | undefined {
    if (!slice) return undefined;
    const read = new Map<string, MonthOf>();
    for (const month of months) {
      const m = monthOf(slice, month);
      if (m) read.set(month, m);
    }
    return new Counts(read);
  }

  hasMonth = (month: string) => this.months.has(month);
  total = (month: string) => this.months.get(month)?.total;

  // A value's count in a month: a number, "hidden" where the build hides it, nothing where the month is not in the slice. A value with no row in
  // a month the slice holds had no vehicles then (docs/CUBE_SCHEMA.md: a month with no vehicles is absent, never a row of zeros).
  at(value: string, month: string): number | "hidden" | undefined {
    const m = this.months.get(month);
    if (!m) return undefined;
    if (m.hidden.includes(value)) return "hidden";
    return m.visible.get(value) ?? 0;
  }

  // The sum over months, or nothing where any is hidden or missing.
  sum(value: string, months: readonly string[]): number | undefined {
    let total = 0;
    for (const month of months) {
      const n = this.at(value, month);
      if (typeof n !== "number") return undefined;
      total += n;
    }
    return total;
  }

  // The total of every vehicle over the months, or nothing where a month is missing.
  totalOver(months: readonly string[]): number | undefined {
    let total = 0;
    for (const month of months) {
      const t = this.total(month);
      if (t === undefined) return undefined;
      total += t;
    }
    return total;
  }

  // Every value the slice names in the months, in no order.
  values(months: readonly string[]): string[] {
    const out = new Set<string>();
    for (const month of months) {
      const m = this.months.get(month);
      if (!m) continue;
      for (const v of m.visible.keys()) out.add(v);
      for (const v of m.hidden) out.add(v);
    }
    return [...out];
  }

  // Whether any count in the months is hidden, or a month is missing: a ranking over them is not exact.
  incomplete(months: readonly string[]): boolean {
    return months.some((month) => {
      const m = this.months.get(month);
      return !m || m.hidden.length > 0;
    });
  }
}

type Standing = {
  // Each named value's sum over the window, where it can be said.
  sums: Map<string, number>;
  // Whether places can be said: no count hidden and no month missing.
  exact: boolean;
};

const standing = (counts: Counts, months: readonly string[]): Standing => {
  const sums = new Map<string, number>();
  for (const value of counts.values(months)) {
    if (isReservedValue(value)) continue;
    const s = counts.sum(value, months);
    if (s !== undefined) sums.set(value, s);
  }
  return { sums, exact: !counts.incomplete(months) };
};

// A value's place in a list of sums: its number, one more than the values with more, and nothing where it is level with another or the list is not exact.
function placeOf(value: string, sums: ReadonlyMap<string, number>, exact: boolean): { rank: number; of: number } | undefined {
  const n = sums.get(value);
  if (!exact || n === undefined) return undefined;
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
  return n > 0 && level === 0 ? { rank: ahead + 1, of } : undefined;
}

// ---- The site ----

export function answerSite(kit: Kit): Site | undefined {
  const { config, manifest } = kit;
  const words = config.words;
  const none = (month: string): Site => ({ month, pages: [], index: undefined, byLabel: { brand: new Map(), model: new Map() } });
  if (!isBuilt(manifest, config.dataset)) return undefined;
  const latest = datasetLatestMonth(manifest, config.dataset);
  const span = config.window;
  const thisWindow = monthRange(addMonths(latest, 1 - span), latest);
  const priorWindow = thisWindow.map((m) => addMonths(m, -12));
  const shown = monthRange(addMonths(latest, 1 - config.months_shown), latest);
  const windows = kit.periods ? [...kit.periods.windows] : [];
  const needed = [...new Set([...thisWindow, ...priorWindow, ...shown, ...shown.map((m) => addMonths(m, -12)), ...windows.flatMap((w) => [...w.months, ...w.prior])])].sort();
  const brandCounts = Counts.read(kit.slices.brand, needed);
  if (!brandCounts || !brandCounts.hasMonth(latest)) return none(latest);
  const modelCounts = Counts.read(kit.slices.model, needed);
  // The two fields count the same vehicles: a model slice that gives another total for a month the window holds is not read.
  const modelsAgree = modelCounts !== undefined && needed.every((m) => !modelCounts.hasMonth(m) || modelCounts.total(m) === brandCounts.total(m));
  const models = modelsAgree ? modelCounts : undefined;

  const brandStanding = standing(brandCounts, thisWindow);
  const modelStanding = models ? standing(models, thisWindow) : undefined;
  const windowTotal = brandCounts.totalOver(thisWindow);

  const phrase = {
    window: kit.period.window(latest, span),
    priorWindow: kit.period.window(addMonths(latest, -12), span),
    month: kit.period.month(latest),
    priorMonth: kit.period.month(addMonths(latest, -12)),
  };

  // ---- The conditions the figures can be said by ----

  const conditions: readonly Condition[] = kit.views && kit.views.conditions.length >= 2 && kit.views.conditions.length < MAX_VIEWS ? kit.views.conditions : [];
  const cuts = { brand: conditions.length > 0 ? kit.views?.cuts.brand : undefined, model: conditions.length > 0 ? kit.views?.cuts.model : undefined };
  const floor = kit.views?.floor;
  // Each condition's places among the values of a field: the sums of the named values over the window.
  const standingBy = (cut: Cut | undefined) =>
    cut ? new Map(conditions.map((c) => [c.value, new Map(cut.values(thisWindow).filter((v) => !isReservedValue(v)).map((v) => [v, cut.sum(v, c.value, thisWindow)] as [string, number]))])) : undefined;
  const conditionStanding = { brand: standingBy(cuts.brand), model: standingBy(cuts.model) };
  // The most vehicles of a condition that any one reserved group holds (no reference match, not recorded, beyond the cap). A make the build groups there
  // may have up to that many, so a brand's place by a condition is not said unless its own count is above it.
  const reservedMost = (cut: Cut | undefined, c: Condition): number =>
    cut ? Math.max(0, ...cut.values(thisWindow).filter(isReservedValue).map((v) => cut.sum(v, c.value, thisWindow))) : 0;
  const reserved = { brand: new Map(conditions.map((c) => [c.value, reservedMost(cuts.brand, c)])) };
  // The part of a figure a sentence says each condition has: "Of these, 805 new vehicles and 15 used imports", or that all were of one.
  // The parts as a list ("805 new vehicles and 15 used imports"): nothing where all were of one condition, which the sentence says in its own words.
  const partsList = (amounts: readonly number[]): string | undefined => {
    const held = conditions.map((c, i) => ({ c, n: amounts[i] })).filter((x) => x.n > 0);
    const texts = held.map((x) => say(words, "part", { count: count(x.n), view: phraseFor(x.c, x.n) }));
    return held.length > 1 && texts.every((t): t is string => t !== undefined) ? sayList(texts) : undefined;
  };
  const partsSentence = (key: "parts_window" | "parts_month", amounts: readonly number[]): string | undefined => {
    const held = conditions.map((c, i) => ({ c, n: amounts[i] })).filter((x) => x.n > 0);
    if (held.length === 1) return say(words, "parts_one", { view: held[0].c.phrase });
    const list = partsList(amounts);
    return list === undefined ? undefined : say(words, key, { parts: list });
  };
  // A place by a condition's count: said as the place by all is, for a model only above the floor, below which a model the cap hid may have more, and
  // for a brand only above the reserved groups' count, below which a make the build grouped there may have more.
  const placeUnder = (kind: Kind, value: string, c: Condition, exact: boolean) => {
    const sums = conditionStanding[kind]?.get(c.value);
    const n = sums?.get(value);
    if (!sums || n === undefined || (kind === "model" && floor !== undefined && n <= floor) || (kind === "brand" && n <= (reserved.brand.get(c.value) ?? 0))) return undefined;
    return placeOf(value, sums, exact);
  };

  // Whether a figure for two periods a year apart can be set side by side: the dataset's counts allow it and no change in how the data is
  // recorded lies between the two, for the value in question.
  const comparable = (kind: Kind, value: string, from: string, to: string) =>
    kit.dataset.showsYear && recordingChange(kit.events, from, to, { dimension: config[kind].dimension, values: new Set([value]) }) === false;
  const earliestPrior = priorWindow[0];

  // ---- The windows the figures can also be said over ----

  const said = kit.periods ? { month: kit.period.month, span: kit.periods.span, range: kit.periods.range } : undefined;
  const env: Env | undefined =
    kit.periods && said && windows.length > 0 && conditions.length > 0 && cuts.brand && cuts.model
      ? {
          words,
          windows,
          defaultIndex: kit.periods.defaultIndex,
          conditions,
          has: brandCounts.hasMonth,
          floors: kit.floors,
          comparable: (dimension, value, w) => kit.dataset.showsYear && recordingChange(kit.events, w.prior[0], latest, { dimension, values: value === undefined ? undefined : new Set([value]) }) === false,
          phrase: { window: (w) => windowPhrase(w.months, w.yearToDate, said), prior: (w) => windowPhrase(w.prior, w.yearToDate, said) },
          share: kit.format.share,
          counted: (n, p) => kit.dataset.counted(n, p),
          monthsText: (w) => windowRange(w.months, (a, b) => sayIn(words, "months_range", { start: monthLabel(a), end: monthLabel(b) }) ?? "", monthLabel),
          moverPerMonth: kit.periods.moverPerMonth,
        }
      : undefined;
  // The window of the config's own span, the one the pages' headline figures are over.
  const headlineWindow = windows.find((w) => !w.yearToDate && w.months.length === span);

  // ---- The pages that exist ----

  const named = (kind: Kind, counts: Counts | undefined, stand: Standing | undefined): string[] =>
    counts && stand ? [...stand.sums].filter(([, n]) => n >= config[kind].minimum && n > 0).map(([value]) => value).sort(byName) : [];
  const brandValues = named("brand", brandCounts, brandStanding);
  const modelValues = named("model", models, modelStanding);
  const slugs = { brand: slugsFor(brandValues), model: slugsFor(modelValues) };
  // A page that cannot be made (no canvas address, no title that fits) is not linked to: the pages are made once, and again with only those that stand.
  let alive: ReadonlySet<string> | undefined;
  const hrefOf = (kind: Kind, value: string): string | undefined => {
    const slug = slugs[kind].get(value);
    return slug === undefined || (alive && !alive.has(`${kind}:${value}`)) ? undefined : `/${config[kind].path}/${slug}/`;
  };
  const brandOfModel = (value: string): string | undefined => {
    if (!kit.separator) return undefined;
    const parts = value.split(kit.separator);
    return parts.length > 1 ? parts[0] : undefined;
  };

  // ---- One value's figures ----

  const facts = (kind: Kind, value: string, counts: Counts) => {
    const n = counts.sum(value, thisWindow);
    const before = counts.sum(value, priorWindow);
    const monthN = counts.at(value, latest);
    const monthBefore = counts.at(value, addMonths(latest, -12));
    return { n, before, monthN, monthBefore, yearOk: comparable(kind, value, earliestPrior, latest), monthOk: comparable(kind, value, addMonths(latest, -12), latest) };
  };

  // A count sentence: the figure in the dataset's words for a period, with its change on the period a year earlier where that can be said.
  const countSentence = (name: string, n: number, period: string, earlier: { n: number | "hidden" | undefined; period: string; ok: boolean }): string | undefined => {
    const counted = kit.dataset.counted(n, period);
    const change = earlier.ok && typeof earlier.n === "number" ? changeOnYear(n, earlier.n, kit.floors.change) : undefined;
    const alone = { name, counted };
    if (change) return say(words, `count_${change.direction}`, { ...alone, change: Math.abs(change.change), prior_count: count(change.prior), prior: earlier.period }) ?? say(words, "count_alone", alone);
    return say(words, "count_alone", alone);
  };

  const changeCell = (n: number | undefined, earlier: number | "hidden" | undefined, ok: boolean): TableCell => {
    if (ok && n !== undefined && n > 0 && earlier === 0 && words.new_entry) return { text: words.new_entry, fresh: true };
    const c = ok && n !== undefined && typeof earlier === "number" ? changeOnYear(n, earlier, kit.floors.change) : undefined;
    if (!c) return { text: "", none: true };
    return { text: c.direction === "same" ? words.level : `${c.change > 0 ? "+" : "−"}${percent(Math.abs(c.change))}`, direction: c.direction };
  };

  const months = (kind: Kind, value: string, counts: Counts): TableView | undefined => {
    const cut = cuts[kind];
    const rows: TableRow[] = [...shown].reverse().flatMap((month) => {
      const n = counts.at(value, month);
      if (n === undefined) return [];
      const before = counts.at(value, addMonths(month, -12));
      const cells: TableCell[] =
        n === "hidden" ? [{ text: words.hidden, hidden: true }, { text: "", none: true }] : [{ text: count(n) }, changeCell(n, before, comparable(kind, value, addMonths(month, -12), month))];
      // Each month's figure is shown by its parts too, which add up to it.
      if (cut && typeof n === "number") cells.splice(0, 0, ...conditions.map((c) => ({ text: count(cut.at(value, c.value, month)) })));
      return [{ name: monthLabel(month), cells }];
    });
    const heading = words.heading_months;
    const columns = [words.col_month, ...(cut ? [...conditions.map((c) => c.label), words.view_all] : [words.col_count]), cut ? words.col_year_all : words.col_year];
    return heading && rows.length > 0 ? { heading, columns, rows } : undefined;
  };

  const labelsOf = (): PageView["labels"] => ({
    definition: words.definition_link,
    source: words.source_link,
    caveat: words.caveat,
    caveatLink: words.caveat_link,
    noComparison: words.no_comparison,
    noComparisonReason: words.no_comparison_reason,
    breadcrumb: words.breadcrumb,
    home: words.home_link,
    index: words.index_link,
    newEntry: words.new_entry,
  });

  // The first of the descriptions, longest first, that fits a search result.
  const fit = (...texts: (string | undefined)[]) => {
    const [least, most] = config.description_length;
    return texts.find((t): t is string => t !== undefined && t.length >= least && t.length <= most);
  };

  const finish = (kind: Kind, value: string, name: string, sentences: string[], tables: TableView[], n: number, parts: string | undefined, extra: Partial<PageView>): PageView | undefined => {
    const slug = slugs[kind].get(value);
    const href = hrefOf(kind, value);
    const canvas = kit.link(kind, value);
    const title = say(words, `${kind}_title`, { name, span });
    const counted = kit.dataset.counted(n, phrase.window);
    // A description says the split too where it is there, so a search result or a link preview does not show the combined figure alone.
    const description = fit(
      say(words, `${kind}_description_parts`, { name, counted, parts }),
      say(words, "short_description_parts", { name, counted, parts }),
      say(words, `${kind}_description`, { name, counted }),
      say(words, "short_description", { name, counted }),
    );
    if (slug === undefined || href === undefined || canvas === undefined || title === undefined || description === undefined || sentences.length === 0) return undefined;
    const named = say(words, "canvas_link_named", { heading: title });
    if (named === undefined || !words.canvas_link) return undefined;
    // The same question split by the condition, where the canvas can draw it: left out where it cannot.
    const splitHref = kit.views && conditions.length > 0 && cuts[kind] ? kit.link(kind, value, kit.views.field) : undefined;
    const splitText = kit.views ? say(words, "canvas_split_link", { field: kit.views.fieldLabel }) : undefined;
    const splitNamed = kit.views ? say(words, "canvas_split_named", { heading: title, field: kit.views.fieldLabel }) : undefined;
    const cut = cuts[kind];
    const strip = cut ? [...conditions.map((c) => ({ label: c.label, value: count(cut.sum(value, c.value, thisWindow)) })), { label: words.view_all, value: count(n) }] : undefined;
    return {
      kind, value, name, slug, href, title, description, figure: count(n), sentences, tables,
      canvas: { href: canvas, text: words.canvas_link, named },
      ...(splitHref && splitText && splitNamed ? { canvasSplit: { href: splitHref, text: splitText, named: splitNamed } } : {}),
      ...(strip ? { parts: strip } : {}),
      labels: labelsOf(),
      caveatHref: config.caveat.href,
      definitionHref: config.definition,
      provenance: kit.provenance,
      ...extra,
    };
  };

  // ---- The tables over windows ----

  const modelName = (value: string) => (kit.tail ? kit.tail(config.model.dimension, value) : kit.label(config.model.dimension, value));
  // The brands with a page by the 12-month count of all vehicles: the order the nearest rivals are taken from. A brand with a hidden count has no sum, so the next one stands in.
  const brandsByVolume = (): string[] =>
    [...brandStanding.sums].filter(([v, n]) => n > 0 && hrefOf("brand", v) !== undefined).sort((a, b) => b[1] - a[1] || byName(a[0], b[0])).map(([v]) => v);
  const reservedMostBy = (cut: Cut) => (condition: string | undefined, w: Window) => Math.max(0, ...cut.values(w.months).filter(isReservedValue).map((v) => figure(cut, v, condition, w.months)));
  const fieldNote = (): { value: string; href: string; text: string } | undefined =>
    kit.cutBy?.noted && words.field_note_link ? { value: kit.cutBy.noted.value, href: kit.cutBy.noted.href, text: words.field_note_link } : undefined;
  const viewFieldWhere = (c: Condition | undefined): Record<string, string[]> => (c && kit.views ? { [kit.views.field]: [c.value] } : {});

  // A brand's tables over windows: its models, its nearest rivals and its cut values, behind one switch. Nothing where the models cannot be given, so the page is drawn as it was.
  const brandScope = (brand: string, name: string): Scope | undefined => {
    if (!env || !cuts.brand || !cuts.model) return undefined;
    const brandCut = cuts.brand;
    const modelCut = cuts.model;
    const sections: Section[] = [];
    const heading = say(words, "heading_models", { name });
    const models = heading && sectionOf(env, "models", heading, undefined, (w, c, wi, ci) => modelsPanel(env, { brand, name, brandCut, modelCut, brandDimension: config.brand.dimension, modelDimension: config.model.dimension, floor, top: config.models_listed, brandOf: brandOfModel, rowName: modelName, href: (v) => hrefOf("model", v) }, w, c, wi, ci));
    if (!models) return undefined;
    sections.push(models);
    const set = nearestRivals(brand, brandsByVolume());
    const rivalsHeading = say(words, "heading_rivals", { name });
    if (set && set.length > 1 && rivalsHeading) {
      const others = set.filter((v) => v !== brand).map((v) => kit.label(config.brand.dimension, v));
      const intro = say(words, "rivals_intro", { name, window: phrase.window, names: sayList(others) });
      const rivals = sectionOf(env, "rivals", rivalsHeading, intro, (w, c, wi, ci) =>
        rivalsPanel(env, { value: brand, name, set, cut: brandCut, dimension: config.brand.dimension, nameOf: (v) => kit.label(config.brand.dimension, v), href: (v) => hrefOf("brand", v), reservedMost: reservedMostBy(brandCut), link: (kind, cond, win) => kit.askLink?.({ by: config.brand.dimension, type: kind, values: [...set], where: viewFieldWhere(cond), settings: { period: kind === "league" ? win.canvasPeriod : config.rivals_trend_period } }) }, w, c, wi, ci),
      );
      if (rivals) sections.push(rivals);
    }
    const cutHeading = say(words, "heading_by_cut", { name });
    if (kit.cutBy && cutHeading) {
      const pt = kit.cutBy;
      const section = sectionOf(env, "cut", cutHeading, undefined, (w, c, wi, ci) =>
        cutPanel(env, { value: brand, name, by: pt.cuts.brand, order: pt.order, dimension: config.brand.dimension, labelOf: pt.label, noted: fieldNote(), link: (p, cond, win) => kit.askLink?.({ by: config.model.dimension, type: "league", where: { [config.brand.dimension]: [brand], [pt.field]: [p], ...viewFieldWhere(cond) }, settings: { period: win.canvasPeriod } }) }, w, c, wi, ci),
      );
      if (section) sections.push(section);
    }
    return scopeOf(env, sections);
  };

  // A model's cut values over the 12 months, with no choice to make.
  const modelFixed = (value: string, name: string): Section | undefined => {
    const pt = kit.cutBy;
    const heading = say(words, "heading_by_cut", { name });
    if (!env || !pt || !heading || !headlineWindow) return undefined;
    const panel = cutPanel(env, { value, name, by: pt.cuts.model, order: pt.order, dimension: config.model.dimension, labelOf: pt.label, noted: fieldNote() }, headlineWindow, undefined, headlineWindow.index, env.conditions.length);
    return panel && !panel.empty ? { id: "cut", heading, panels: [panel] } : undefined;
  };

  // The two more links of a model: its cut values month by month, and it beside the other models of its brand.
  const modelLinks = (value: string, name: string, brand: string | undefined, brandName: string | undefined): { href: string; text: string; named: string }[] => {
    const out: { href: string; text: string; named: string }[] = [];
    const pt = kit.cutBy;
    const byPt = pt ? kit.link("model", value, pt.field) : undefined;
    const t1 = say(words, "model_cut_link", { name });
    if (byPt && t1) out.push({ href: byPt, text: t1, named: say(words, "model_cut_named", { name }) ?? t1 });
    const siblings = brand !== undefined && headlineWindow ? kit.askLink?.({ by: config.model.dimension, type: "league", where: { [config.brand.dimension]: [brand] }, settings: { period: headlineWindow.canvasPeriod } }) : undefined;
    const t2 = brandName ? say(words, "model_siblings_link", { brand: brandName }) : undefined;
    if (siblings && t2) out.push({ href: siblings, text: t2, named: say(words, "model_siblings_named", { brand: brandName, name }) ?? t2 });
    return out;
  };

  // ---- A brand's page ----

  const brandPage = (value: string): PageView | undefined => {
    const name = kit.label(config.brand.dimension, value);
    const f = facts("brand", value, brandCounts);
    if (f.n === undefined) return undefined;
    const sentences: string[] = [];
    const push = (s: string | undefined) => void (s && sentences.push(s));
    const cut = cuts.brand;
    push(countSentence(name, f.n, phrase.window, { n: f.before, period: phrase.priorWindow, ok: f.yearOk }));
    if (cut) push(partsSentence("parts_window", conditions.map((c) => cut.sum(value, c.value, thisWindow))));
    if (typeof f.monthN === "number") push(countSentence(name, f.monthN, phrase.month, { n: f.monthBefore, period: phrase.priorMonth, ok: f.monthOk }));
    if (cut && typeof f.monthN === "number") push(partsSentence("parts_month", conditions.map((c) => cut.at(value, c.value, latest))));
    const place = placeOf(value, brandStanding.sums, brandStanding.exact);
    if (place) push(say(words, "brand_rank", { name, rank: place.rank, of: place.of, window: phrase.window }));
    // Its place among the brands that have vehicles of each condition, said as its place among all is.
    for (const c of cut ? conditions : []) {
      const under = placeUnder("brand", value, c, brandStanding.exact);
      if (under) push(say(words, "brand_rank_view", { name, rank: under.rank, of: under.of, view: c.phrase, window: phrase.window }));
    }
    if (windowTotal !== undefined && windowTotal >= kit.floors.share) push(say(words, "brand_share", { name, share: kit.format.share(f.n / windowTotal), window: phrase.window }));

    const tables: TableView[] = [];
    const scope = brandScope(value, name);
    // The models over the windows replace the models of the 12 months where they can be given.
    const listed = scope ? undefined : modelsOf(value, f.n, name);
    if (listed) tables.push(listed);
    const byMonth = months("brand", value, brandCounts);
    if (byMonth) tables.push(byMonth);
    const periods = scope && env && cuts.brand ? valuePeriods(env, cuts.brand, value, config.brand.dimension) : undefined;
    return finish("brand", value, name, sentences, tables, f.n, cut ? partsList(conditions.map((c) => cut.sum(value, c.value, thisWindow))) : undefined, scope && periods ? { scope, periods } : {});
  };

  // The brand's models, most registered first, each linking to its page where it has one, and the rest of the brand in one line.
  const modelsOf = (brand: string, brandN: number, brandName: string): TableView | undefined => {
    if (!models || !modelStanding) return undefined;
    const mine = [...modelStanding.sums].filter(([value, n]) => brandOfModel(value) === brand && n > 0);
    // A model whose count is hidden has no sum; its row is shown as hidden and the rest of the brand is not worked out.
    const hidden = models.values(thisWindow).filter((value) => brandOfModel(value) === brand && !modelStanding.sums.has(value) && !isReservedValue(value));
    mine.sort((a, b) => b[1] - a[1] || byName(a[0], b[0]));
    const top = mine.slice(0, config.models_listed);
    if (top.length === 0) return undefined;
    const shareable = brandN >= kit.floors.share;
    const prior = (value: string) => models.sum(value, priorWindow);
    const rows: TableRow[] = top.map(([value, n]) => {
      const p = prior(value);
      return {
        name: kit.tail ? kit.tail(config.model.dimension, value) : kit.label(config.model.dimension, value),
        href: hrefOf("model", value),
        cells: [
          { text: count(n) },
          shareable ? { text: kit.format.share(n / brandN) } : { text: "", none: true },
          changeCell(n, p, comparable("model", value, earliestPrior, latest)),
        ],
      };
    });
    for (const value of hidden.slice(0, config.models_listed)) rows.push({ name: kit.label(config.model.dimension, value), cells: [{ text: words.hidden, hidden: true }, { text: "", none: true }, { text: "", none: true }] });
    const rest = hidden.length === 0 ? brandN - top.reduce((s, [, n]) => s + n, 0) : undefined;
    const otherName = say(words, "other_models", { name: brandName });
    if (rest !== undefined && rest > 0 && otherName) rows.push({ name: otherName, cells: [{ text: count(rest) }, shareable ? { text: kit.format.share(rest / brandN) } : { text: "", none: true }, { text: "", none: true }] });
    const totalName = say(words, "total_row", { name: brandName });
    if (totalName) rows.push({ name: totalName, total: true, cells: [{ text: count(brandN) }, shareable ? { text: kit.format.share(1) } : { text: "", none: true }, changeCell(brandN, brandCounts.sum(brand, priorWindow), comparable("brand", brand, earliestPrior, latest))] });
    const heading = say(words, "heading_models", { name: brandName });
    const columns = [words.col_model, say(words, "col_window", { window: phrase.window }), say(words, "col_share", { name: brandName }), say(words, "col_window_change", { span })];
    if (heading === undefined || columns.some((c) => c === undefined)) return undefined;
    const table: TableView = { heading, columns: columns as string[], rows };
    const views = hidden.length === 0 ? modelViews(brand, brandN, brandName, top.map(([value]) => value)) : undefined;
    return views ? { ...table, ...views } : table;
  };

  // The brand's models once for each condition, ranked by that condition's count, and once for all with each condition's count beside the total. In
  // every one the models listed and the line for the rest add up to the brand's line. A model ranks on a part of its count only above the floor.
  const modelViews = (brand: string, brandN: number, brandName: string, listedForAll: readonly string[]): Pick<TableView, "views" | "switch"> | undefined => {
    const brandCut = cuts.brand;
    const modelCut = cuts.model;
    const legend = words.view_legend_models;
    const note = words.view_note_models;
    if (!brandCut || !modelCut || !models || !legend || !note) return undefined;
    const shareable = (n: number) => n >= kit.floors.share;
    const own = (value: string) => brandOfModel(value) === brand && !isReservedValue(value);
    const modelsOfBrand = modelCut.values(thisWindow).filter(own);
    const rowFor = (value: string, cells: TableCell[]): TableRow => ({ name: kit.tail ? kit.tail(config.model.dimension, value) : kit.label(config.model.dimension, value), href: hrefOf("model", value), cells });
    const noCell: TableCell = { text: "", none: true };
    // The change is on the vehicles the table counts: in a condition's table that condition's, and where a table has every condition's count beside the total, the total's.
    const columnsFor = (heads: string[], share: string | undefined, wholly = false): string[] | undefined => {
      const last = say(words, wholly ? "col_window_change_all" : "col_window_change", { span });
      return share === undefined || last === undefined ? undefined : [words.col_model, ...heads, share, last];
    };
    const out: NonNullable<TableView["views"]> = [];
    for (const c of conditions) {
      const brandC = brandCut.sum(brand, c.value, thisWindow);
      const heading = say(words, "heading_models_view", { name: brandName, view: c.phrase });
      const columns = columnsFor([c.label], say(words, "col_view_share", { name: brandName, view: c.phrase }));
      if (heading === undefined || !columns) return undefined;
      if (brandC <= 0) {
        const empty = say(words, "view_empty", { name: brandName, view: c.phrase, window: phrase.window });
        if (empty === undefined) return undefined;
        out.push({ label: c.label, heading, columns, rows: [], empty });
        continue;
      }
      const ranked = modelsOfBrand
        .map((value) => [value, modelCut.sum(value, c.value, thisWindow)] as [string, number])
        .filter(([, n]) => n > 0 && (floor === undefined || n > floor))
        .sort((a, b) => b[1] - a[1] || byName(a[0], b[0]))
        .slice(0, config.models_listed);
      const rows: TableRow[] = ranked.map(([value, n]) => rowFor(value, [{ text: count(n) }, shareable(brandC) ? { text: kit.format.share(n / brandC) } : noCell, changeCell(n, modelCut.sum(value, c.value, priorWindow), comparable("model", value, earliestPrior, latest))]));
      const rest = brandC - ranked.reduce((sum, [, n]) => sum + n, 0);
      const otherName = say(words, "other_models", { name: brandName });
      if (rest > 0 && otherName) rows.push({ name: otherName, cells: [{ text: count(rest) }, shareable(brandC) ? { text: kit.format.share(rest / brandC) } : noCell, noCell] });
      const totalName = say(words, "total_row_view", { name: brandName, view: c.phrase });
      if (!totalName) return undefined;
      rows.push({ name: totalName, total: true, cells: [{ text: count(brandC) }, shareable(brandC) ? { text: kit.format.share(1) } : noCell, changeCell(brandC, brandCut.sum(brand, c.value, priorWindow), comparable("brand", brand, earliestPrior, latest))] });
      out.push({ label: c.label, heading, columns, rows });
    }
    // All of them: the table as it is, each condition's count beside the total, the rest and the total adding up in every column.
    const heading = say(words, "heading_models_view", { name: brandName, view: words.view_all_phrase });
    const columns = columnsFor([...conditions.map((c) => c.label), words.view_all], say(words, "col_share", { name: brandName }), true);
    const totalName = say(words, "total_row", { name: brandName });
    const otherName = say(words, "other_models", { name: brandName });
    if (heading === undefined || !columns || !totalName) return undefined;
    const partsOf = (value: string) => conditions.map((c) => modelCut.sum(value, c.value, thisWindow));
    const brandParts = conditions.map((c) => brandCut.sum(brand, c.value, thisWindow));
    const all = listedForAll.map((value) => {
      const n = models.sum(value, thisWindow);
      return n === undefined ? undefined : rowFor(value, [...partsOf(value).map((x) => ({ text: count(x) })), { text: count(n) }, shareable(brandN) ? { text: kit.format.share(n / brandN) } : noCell, changeCell(n, models.sum(value, priorWindow), comparable("model", value, earliestPrior, latest))]);
    });
    if (all.some((r) => r === undefined)) return undefined;
    const rows = all as TableRow[];
    const listedParts = conditions.map((_, i) => listedForAll.reduce((sum, value) => sum + partsOf(value)[i], 0));
    const listedN = listedForAll.reduce((sum, value) => sum + (models.sum(value, thisWindow) ?? 0), 0);
    const rest = brandN - listedN;
    if (rest > 0 && otherName) rows.push({ name: otherName, cells: [...brandParts.map((x, i) => ({ text: count(x - listedParts[i]) })), { text: count(rest) }, shareable(brandN) ? { text: kit.format.share(rest / brandN) } : noCell, noCell] });
    rows.push({ name: totalName, total: true, cells: [...brandParts.map((x) => ({ text: count(x) })), { text: count(brandN) }, shareable(brandN) ? { text: kit.format.share(1) } : noCell, changeCell(brandN, brandCounts.sum(brand, priorWindow), comparable("brand", brand, earliestPrior, latest))] });
    out.push({ label: words.view_all, heading, columns, rows });
    return { views: out, switch: { legend, note, labels: [...conditions.map((c) => c.label), words.view_all] } };
  };

  // ---- A model's page ----

  const modelPage = (value: string): PageView | undefined => {
    if (!models || !modelStanding) return undefined;
    const name = kit.label(config.model.dimension, value);
    const f = facts("model", value, models);
    if (f.n === undefined) return undefined;
    const sentences: string[] = [];
    const push = (s: string | undefined) => void (s && sentences.push(s));
    const cut = cuts.model;
    push(countSentence(name, f.n, phrase.window, { n: f.before, period: phrase.priorWindow, ok: f.yearOk }));
    if (cut) push(partsSentence("parts_window", conditions.map((c) => cut.sum(value, c.value, thisWindow))));
    if (typeof f.monthN === "number") push(countSentence(name, f.monthN, phrase.month, { n: f.monthBefore, period: phrase.priorMonth, ok: f.monthOk }));
    if (cut && typeof f.monthN === "number") push(partsSentence("parts_month", conditions.map((c) => cut.at(value, c.value, latest))));
    const place = placeOf(value, modelStanding.sums, modelStanding.exact);
    if (place) push(say(words, "model_rank", { name, rank: place.rank, window: phrase.window }));
    for (const c of cut ? conditions : []) {
      const under = placeUnder("model", value, c, modelStanding.exact);
      if (under) push(say(words, "model_rank_view", { name, rank: under.rank, view: c.phrase, window: phrase.window }));
    }
    const brand = brandOfModel(value);
    const brandName = brand === undefined ? undefined : kit.label(config.brand.dimension, brand);
    const brandN = brand === undefined ? undefined : brandCounts.sum(brand, thisWindow);
    if (brand !== undefined && brandName !== undefined && brandN !== undefined && brandN >= kit.floors.share) {
      // Among the brand's models: each is a model the build names, and a model it does not name is smaller than any it does, so the place is exact.
      const mine = new Map([...modelStanding.sums].filter(([v]) => brandOfModel(v) === brand));
      const within = placeOf(value, mine, modelStanding.exact);
      if (within) push(say(words, "model_in_brand", { brand: brandName, name, rank: within.rank, share: kit.format.share(f.n / brandN), window: phrase.window }));
    }
    const tables: TableView[] = [];
    const byMonth = months("model", value, models);
    if (byMonth) tables.push(byMonth);
    const brandHref = brand === undefined ? undefined : hrefOf("brand", brand);
    const link = brandName === undefined ? undefined : say(words, "brand_page_link", { name: brandName });
    const periods = env && cuts.model ? valuePeriods(env, cuts.model, value, config.model.dimension) : undefined;
    const fixed = modelFixed(value, name);
    const more = modelLinks(value, name, brand, brandName);
    const extra: Partial<PageView> = { ...(periods ? { periods } : {}), ...(fixed ? { fixed } : {}), ...(more.length > 0 ? { more } : {}) };
    return finish("model", value, name, sentences, tables, f.n, cut ? partsList(conditions.map((c) => cut.sum(value, c.value, thisWindow))) : undefined, brandName === undefined ? extra : { ...extra, brand: { name: brandName, href: brandHref, text: link } });
  };

  // ---- A cut's page: every vehicle of one value of the cut field ----

  const cutValues = kit.cutBy && env ? kit.cutBy.chips.filter((v) => kit.cutBy?.cuts.brand.has(v) && kit.cutBy.cuts.model.has(v)) : [];
  const cutSlugs = slugsFor(cutValues);
  const cutHref = (value: string) => (cutSlugs.has(value) ? `/${config.cut.path}/${cutSlugs.get(value)}/` : undefined);
  const cutNav = (current?: string): CutNav | undefined => {
    const legend = words.cut_legend;
    if (!kit.cutBy || cutValues.length === 0 || !legend || !words.cut_all) return undefined;
    const items = cutValues.map((v) => ({ text: kit.cutBy?.label(v) ?? v, href: cutHref(v) ?? "", ...(v === current ? { current: true } : {}) }));
    const note = kit.cutBy.noted && cutValues.includes(kit.cutBy.noted.value) && words.field_note_link ? { text: words.field_note_link, href: kit.cutBy.noted.href, after: cutValues.indexOf(kit.cutBy.noted.value) } : undefined;
    return { legend, all: { text: words.cut_all, href: "/" }, items, ...(note ? { note } : {}) };
  };
  const upper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

  const cutPage = (value: string): PageView | undefined => {
    const by = kit.cutBy;
    const slug = cutSlugs.get(value);
    const href = cutHref(value);
    if (!env || !by || slug === undefined || href === undefined || !cuts.brand || !headlineWindow) return undefined;
    const brandCut = by.cuts.brand.get(value) as Cut;
    const modelCut = by.cuts.model.get(value) as Cut;
    const cutName = by.phrase(value);
    const name = by.label(value);
    const n = totalFigure(brandCut, undefined, headlineWindow.months);
    const before = headlineWindow.prior.every(env.has) ? totalFigure(brandCut, undefined, headlineWindow.prior) : undefined;
    const comparableNow = env.comparable(config.cut.dimension, value, headlineWindow);
    const change = comparableNow && before !== undefined ? changeOnYear(n, before, kit.floors.change) : undefined;
    const counted = kit.dataset.counted(n, phrase.window);
    const context = { count: count(n), cut: cutName, window: phrase.window, prior: phrase.priorWindow };
    const sentences: string[] = [];
    const push = (x: string | undefined) => void (x && sentences.push(x));
    push((change ? say(words, `cut_count_${change.direction}`, { ...context, change: Math.abs(change.change), prior_count: count(change.prior) }) : undefined) ?? say(words, "cut_count_alone", context));
    const all = windowTotal;
    if (all !== undefined && all >= kit.floors.share) push(say(words, "cut_share", { cut_cap: upper(cutName), share: kit.format.share(n / all), window: phrase.window }));
    const amounts = conditions.map((c) => totalFigure(brandCut, c.value, headlineWindow.months));
    push(partsSentence("parts_window", amounts));
    const parts = partsList(amounts);
    const title = say(words, "cut_title", { cut: cutName });
    const description = fit(say(words, "cut_description_parts", { cut: cutName, counted, parts }), say(words, "cut_description", { cut: cutName, counted }), say(words, "cut_description_parts_short", { cut: cutName, counted, parts }), say(words, "cut_description_short", { cut: cutName, counted }));
    const canvasHref = kit.askLink?.({ by: null, type: null, where: { [config.cut.dimension]: [value] } });
    const cutLink = (dimension: string, wherePanel: (c: Condition | undefined) => Record<string, string[]>) => (c: Condition | undefined, w: Window, heading: string) => {
      const link = kit.askLink?.({ by: dimension, type: "league", where: wherePanel(c), settings: { period: w.canvasPeriod } });
      const named = say(words, "canvas_link_named", { heading });
      return link && named && words.canvas_link ? { href: link, text: words.canvas_link, named } : undefined;
    };
    const wherePanel = (c: Condition | undefined) => ({ [config.cut.dimension]: [value], ...viewFieldWhere(c) });
    const totalOf = (cut: Cut) => (c: Condition | undefined, w: Window) => (w.months.every(env.has) ? totalFigure(cut, c?.value, w.months) : undefined);
    const shareHead = () => say(words, "col_share_cut", { cut: cutName });
    const brandAsk = { cut: brandCut, dimension: config.brand.dimension, nameHead: words.col_brand, top: config.models_listed, nameOf: (v: string) => kit.label(config.brand.dimension, v), href: (v: string) => hrefOf("brand", v), shareOf: totalOf(brandCut), shareHead: () => shareHead(), link: cutLink(config.brand.dimension, wherePanel) };
    const modelAsk = { cut: modelCut, dimension: config.model.dimension, nameHead: words.col_model, top: config.models_listed, above: floor, nameOf: (v: string) => kit.label(config.model.dimension, v), href: (v: string) => hrefOf("model", v), shareOf: totalOf(modelCut), shareHead: () => shareHead(), link: cutLink(config.model.dimension, wherePanel) };
    // A section's heading, and the heading of each of its panels (the section's, then the count it shows).
    const headed = (key: string) => {
      const heading = say(words, key, { cut: cutName });
      return { heading, panel: (_view: string, label: string) => (heading === undefined ? undefined : say(words, "heading_label", { heading, label })) };
    };
    const [hBrands, hModels, hBrandMovers, hModelMovers] = ["heading_cut_brands", "heading_cut_models", "heading_cut_brand_movers", "heading_cut_model_movers"].map(headed);
    const sections = [
      hBrands.heading && sectionOf(env, "brands", hBrands.heading, undefined, (w, c, wi, ci) => leadersPanel(env, { ...brandAsk, heading: hBrands.panel }, w, c, wi, ci)),
      hModels.heading && sectionOf(env, "models", hModels.heading, undefined, (w, c, wi, ci) => leadersPanel(env, { ...modelAsk, heading: hModels.panel }, w, c, wi, ci)),
      hBrandMovers.heading && sectionOf(env, "brand-movers", hBrandMovers.heading, undefined, (w, c, wi, ci) =>
        moversPanel(env, { cut: brandCut, dimension: config.brand.dimension, nameHead: words.col_brand, each: 3, least: 0.05, nameOf: brandAsk.nameOf, href: brandAsk.href, field: words.col_brand.toLowerCase(), link: brandAsk.link, heading: hBrandMovers.panel }, w, c, wi, ci)),
      hModelMovers.heading && sectionOf(env, "model-movers", hModelMovers.heading, undefined, (w, c, wi, ci) =>
        moversPanel(env, { cut: modelCut, dimension: config.model.dimension, nameHead: words.col_model, each: 3, least: 0.05, above: floor, nameOf: modelAsk.nameOf, href: modelAsk.href, field: words.col_model.toLowerCase(), link: modelAsk.link, heading: hModelMovers.panel }, w, c, wi, ci)),
    ];
    const scope = sections.every((x): x is Section => Boolean(x)) ? scopeOf(env, sections) : undefined;
    const periods = cutPeriods(env, brandCut, config.cut.dimension, value);
    const named = say(words, "canvas_link_named", { heading: title });
    if (!scope || !periods || title === undefined || description === undefined || sentences.length === 0 || !canvasHref || named === undefined || !words.canvas_link) return undefined;
    return {
      kind: "cut", value, name, slug, href, title, description, figure: count(n), sentences, tables: [], periods, scope,
      canvas: { href: canvasHref, text: words.canvas_link, named },
      parts: [...conditions.map((c, i) => ({ label: c.label, value: count(amounts[i]) })), { label: words.view_all, value: count(n) }],
      cutNav: cutNav(value),
      notes: by.notes(value),
      labels: labelsOf(),
      caveatHref: config.caveat.href,
      definitionHref: config.definition,
      provenance: kit.provenance,
    };
  };

  const make = () => [...brandValues.flatMap((v) => brandPage(v) ?? []), ...modelValues.flatMap((v) => modelPage(v) ?? [])];
  let pages = make();
  if (pages.length < brandValues.length + modelValues.length) {
    alive = new Set(pages.map((p) => `${p.kind}:${p.value}`));
    pages = make();
  }
  // The cuts' pages come after, so a name in them links only to a page that stands.
  const cutPages = cutValues.flatMap((v) => cutPage(v) ?? []);
  pages = [...pages, ...cutPages];

  // ---- The index ----

  const built = (kind: Kind) => new Map(pages.filter((p) => p.kind === kind).map((p) => [p.value, p]));
  const brandPages = built("brand");
  const modelPages = built("model");
  // The names are as a person writes them, but the order is of the values as the register holds them, as it always was.
  const groups = new Map<string, { value: string; name: string; href?: string; models: { value: string; name: string; href: string }[] }>();
  for (const [value, page] of brandPages) groups.set(value, { value, name: page.name, href: page.href, models: [] });
  for (const [value, page] of modelPages) {
    const brand = brandOfModel(value);
    if (brand === undefined) continue;
    const group = groups.get(brand) ?? { value: brand, name: kit.label(config.brand.dimension, brand), models: [] };
    group.models.push({ value, name: page.name, href: page.href });
    groups.set(brand, group);
  }
  const entries = [...groups.values()]
    .sort((a, b) => byName(a.value, b.value))
    .map((g) => ({ value: g.value, entry: { name: g.name, href: g.href, models: g.models.sort((a, b) => byName(a.value, b.value)).map(({ name, href }) => ({ name, href })), modelsLabel: say(words, "index_models", { name: g.name }) ?? g.name } }));
  // Models with no brand in their value, which no group holds, are listed by themselves.
  const loose = [...modelPages.entries()].filter(([value]) => brandOfModel(value) === undefined).map(([value, p]) => ({ value, entry: { name: p.name, models: [], href: p.href, modelsLabel: p.name } }));
  const title = say(words, "index_title", {});
  const minimum = Math.min(config.brand.minimum, config.model.minimum);
  const intro = say(words, "index_intro", { span, minimum: count(minimum) });
  const index: IndexView | undefined = title && intro && pages.length > 0 ? { href: `/${config.index_path}/`, title, intro, entries: [...entries, ...loose].sort((a, b) => byName(a.value, b.value)).map((e) => e.entry) } : undefined;

  // The label of each value with a page, for the front page's tables; a label two values share has no link, as a link might open the other's.
  const labelled = (kind: Kind) => {
    const map = new Map<string, string | null>();
    for (const p of pages.filter((x) => x.kind === kind)) map.set(p.name, map.has(p.name) ? null : p.href);
    return map;
  };
  const nav = cutPages.length > 0 ? cutNav() : undefined;
  return { month: latest, pages, index, ...(nav ? { cutNav: nav } : {}), byLabel: { brand: labelled("brand"), model: labelled("model") } };
}
