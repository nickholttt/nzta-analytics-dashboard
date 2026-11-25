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
import { monthOf } from "./latestMonth";
import type { MonthOf } from "./latestMonth";
import { recordingChange } from "./recordingChange";
import { slugsFor } from "./answerSlug";
import { addMonths, changeOnYear, count, fillTemplate, monthLabel, monthRange, percent } from "./sentences";
import { isReservedValue } from "./chartSentence";

export type FieldConfig = { dimension: string; path: string; minimum: number };
export type AnswerConfig = {
  dataset: string;
  measure: string;
  window: number;
  brand: FieldConfig;
  model: FieldConfig;
  models_listed: number;
  months_shown: number;
  index_path: string;
  description_length: [number, number];
  definition: string;
  caveat: { href: string };
  words: Record<string, string>;
};
export const answerConfig = configDoc as unknown as AnswerConfig;

export type Kind = "brand" | "model";

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
  // The address of the canvas that draws one value's question, or nothing where it cannot.
  link: (kind: Kind, value: string) => string | undefined;
  // Where the figures come from and the snapshot's date, as the latest month says them.
  provenance: { source?: string; snapshot: string };
};

export type TableCell = { text: string; direction?: "up" | "down" | "same"; hidden?: boolean; none?: boolean };
export type TableRow = { name: string; href?: string; cells: TableCell[]; total?: boolean };
export type TableView = { heading: string; columns: string[]; rows: TableRow[]; note?: string };
export type PageView = {
  kind: Kind;
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
  canvas: { href: string; text: string; named: string };
  // The brand of a model, as the model's page links to it (the link only where the brand has a page).
  brand?: { name: string; href?: string; text?: string };
  // The words the page draws beside its content, from config.
  labels: { definition: string; source: string; caveat: string; caveatLink: string; noComparison: string; noComparisonReason: string; breadcrumb: string; home: string; index: string };
  caveatHref: string;
  definitionHref: string;
  provenance: Kit["provenance"];
};
export type IndexEntry = { name: string; href?: string; models: { name: string; href: string }[]; modelsLabel: string };
export type IndexView = { href: string; title: string; intro: string; entries: IndexEntry[] };
export type Site = {
  month: string;
  pages: PageView[];
  index: IndexView | undefined;
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
  const needed = [...new Set([...thisWindow, ...priorWindow, ...shown, ...shown.map((m) => addMonths(m, -12))])].sort();
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

  // Whether a figure for two periods a year apart can be set side by side: the dataset's counts allow it and no change in how the data is
  // recorded lies between the two, for the value in question.
  const comparable = (kind: Kind, value: string, from: string, to: string) =>
    kit.dataset.showsYear && recordingChange(kit.events, from, to, { dimension: config[kind].dimension, values: new Set([value]) }) === false;
  const earliestPrior = priorWindow[0];

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
    const c = ok && n !== undefined && typeof earlier === "number" ? changeOnYear(n, earlier, kit.floors.change) : undefined;
    if (!c) return { text: "", none: true };
    return { text: c.direction === "same" ? words.level : `${c.change > 0 ? "+" : "−"}${percent(Math.abs(c.change))}`, direction: c.direction };
  };

  const months = (kind: Kind, value: string, counts: Counts): TableView | undefined => {
    const rows: TableRow[] = [...shown].reverse().flatMap((month) => {
      const n = counts.at(value, month);
      if (n === undefined) return [];
      const before = counts.at(value, addMonths(month, -12));
      const cells: TableCell[] =
        n === "hidden" ? [{ text: words.hidden, hidden: true }, { text: "", none: true }] : [{ text: count(n) }, changeCell(n, before, comparable(kind, value, addMonths(month, -12), month))];
      return [{ name: monthLabel(month), cells }];
    });
    const heading = words.heading_months;
    return heading && rows.length > 0 ? { heading, columns: [words.col_month, words.col_count, words.col_year], rows } : undefined;
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
  });

  const fit = (text: string | undefined, short: string | undefined) => {
    const [least, most] = config.description_length;
    return [text, short].find((t): t is string => t !== undefined && t.length >= least && t.length <= most);
  };

  const finish = (kind: Kind, value: string, name: string, sentences: string[], tables: TableView[], n: number, extra: Partial<PageView>): PageView | undefined => {
    const slug = slugs[kind].get(value);
    const href = hrefOf(kind, value);
    const canvas = kit.link(kind, value);
    const title = say(words, `${kind}_title`, { name, span });
    const counted = kit.dataset.counted(n, phrase.window);
    const description = fit(say(words, `${kind}_description`, { name, counted }), say(words, "short_description", { name, counted }));
    if (slug === undefined || href === undefined || canvas === undefined || title === undefined || description === undefined || sentences.length === 0) return undefined;
    const named = say(words, "canvas_link_named", { heading: title });
    if (named === undefined || !words.canvas_link) return undefined;
    return {
      kind, value, name, slug, href, title, description, figure: count(n), sentences, tables,
      canvas: { href: canvas, text: words.canvas_link, named },
      labels: labelsOf(),
      caveatHref: config.caveat.href,
      definitionHref: config.definition,
      provenance: kit.provenance,
      ...extra,
    };
  };

  // ---- A brand's page ----

  const brandPage = (value: string): PageView | undefined => {
    const name = kit.label(config.brand.dimension, value);
    const f = facts("brand", value, brandCounts);
    if (f.n === undefined) return undefined;
    const sentences: string[] = [];
    const push = (s: string | undefined) => void (s && sentences.push(s));
    push(countSentence(name, f.n, phrase.window, { n: f.before, period: phrase.priorWindow, ok: f.yearOk }));
    if (typeof f.monthN === "number") push(countSentence(name, f.monthN, phrase.month, { n: f.monthBefore, period: phrase.priorMonth, ok: f.monthOk }));
    const place = placeOf(value, brandStanding.sums, brandStanding.exact);
    if (place) push(say(words, "brand_rank", { name, rank: place.rank, of: place.of, window: phrase.window }));
    if (windowTotal !== undefined && windowTotal >= kit.floors.share) push(say(words, "brand_share", { name, share: kit.format.share(f.n / windowTotal), window: phrase.window }));

    const tables: TableView[] = [];
    const listed = modelsOf(value, f.n, name);
    if (listed) tables.push(listed);
    const byMonth = months("brand", value, brandCounts);
    if (byMonth) tables.push(byMonth);
    return finish("brand", value, name, sentences, tables, f.n, {});
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
        name: kit.label(config.model.dimension, value),
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
    return { heading, columns: columns as string[], rows };
  };

  // ---- A model's page ----

  const modelPage = (value: string): PageView | undefined => {
    if (!models || !modelStanding) return undefined;
    const name = kit.label(config.model.dimension, value);
    const f = facts("model", value, models);
    if (f.n === undefined) return undefined;
    const sentences: string[] = [];
    const push = (s: string | undefined) => void (s && sentences.push(s));
    push(countSentence(name, f.n, phrase.window, { n: f.before, period: phrase.priorWindow, ok: f.yearOk }));
    if (typeof f.monthN === "number") push(countSentence(name, f.monthN, phrase.month, { n: f.monthBefore, period: phrase.priorMonth, ok: f.monthOk }));
    const place = placeOf(value, modelStanding.sums, modelStanding.exact);
    if (place) push(say(words, "model_rank", { name, rank: place.rank, window: phrase.window }));
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
    return finish("model", value, name, sentences, tables, f.n, brandName === undefined ? {} : { brand: { name: brandName, href: brandHref, text: link } });
  };

  const make = () => [...brandValues.flatMap((v) => brandPage(v) ?? []), ...modelValues.flatMap((v) => modelPage(v) ?? [])];
  let pages = make();
  if (pages.length < brandValues.length + modelValues.length) {
    alive = new Set(pages.map((p) => `${p.kind}:${p.value}`));
    pages = make();
  }

  // ---- The index ----

  const built = (kind: Kind) => new Map(pages.filter((p) => p.kind === kind).map((p) => [p.value, p]));
  const brandPages = built("brand");
  const modelPages = built("model");
  const groups = new Map<string, { name: string; href?: string; models: { name: string; href: string }[] }>();
  for (const [value, page] of brandPages) groups.set(value, { name: page.name, href: page.href, models: [] });
  for (const [value, page] of modelPages) {
    const brand = brandOfModel(value);
    if (brand === undefined) continue;
    const group = groups.get(brand) ?? { name: kit.label(config.brand.dimension, brand), models: [] };
    group.models.push({ name: page.name, href: page.href });
    groups.set(brand, group);
  }
  const entries: IndexEntry[] = [...groups.values()]
    .sort((a, b) => byName(a.name, b.name))
    .map((g) => ({ name: g.name, href: g.href, models: g.models.sort((a, b) => byName(a.name, b.name)), modelsLabel: say(words, "index_models", { name: g.name }) ?? g.name }));
  // Models with no brand in their value, which no group holds, are listed by themselves.
  const loose = [...modelPages.entries()].filter(([value]) => brandOfModel(value) === undefined).map(([, p]) => ({ name: p.name, models: [], href: p.href, modelsLabel: p.name }));
  const title = say(words, "index_title", {});
  const minimum = Math.min(config.brand.minimum, config.model.minimum);
  const intro = say(words, "index_intro", { span, minimum: count(minimum) });
  const index: IndexView | undefined = title && intro && pages.length > 0 ? { href: `/${config.index_path}/`, title, intro, entries: [...entries, ...loose].sort((a, b) => byName(a.name, b.name)) } : undefined;

  // The label of each value with a page, for the front page's tables; a label two values share has no link, as a link might open the other's.
  const labelled = (kind: Kind) => {
    const map = new Map<string, string | null>();
    for (const p of pages.filter((x) => x.kind === kind)) map.set(p.name, map.has(p.name) ? null : p.href);
    return map;
  };
  return { month: latest, pages, index, byLabel: { brand: labelled("brand"), model: labelled("model") } };
}
