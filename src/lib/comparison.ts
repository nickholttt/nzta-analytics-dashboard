// This site's figures set beside the figures other organisations publish (the build's reconciliation file, docs/CUBE_SCHEMA.md): which figures
// the public page shows, how they are grouped, how a gap is written, and every sentence about them, filled from config/comparison.json. Pure: it
// names no organisation, measure, dataset or value (the file carries them), so tests/site/ runs it with Node's own test runner.
//   node --test "tests/site/*.test.ts"
import wordsDoc from "../../config/comparison.json";
import { fillTemplate, monthLabel } from "./sentences";
import type { Reconciliation, ReconciliationRow, ReconciliationSource, ReconciliationStatus } from "./data";

export type Words = typeof wordsDoc;
export const words: Words = wordsDoc;

// How the page says a dataset, a field and a value in a visitor's words. A lookup that finds none says so, and the sentence that needed it is left
// out: an id is never shown in its place.
export type Labels = {
  dataset: (id: string) => string | undefined;
  dimension: (id: string, dataset: string) => string | undefined;
  value: (dimension: string, value: string) => string;
};

const COUNT = new Intl.NumberFormat("en-NZ");
const MINUS = "−";

export const figure = (n: number): string => COUNT.format(n);

// A gap in vehicles with its sign: a plus where this site's figure is higher, a minus where it is lower, and none for no gap.
export function signedCount(n: number): string {
  if (n === 0) return "0";
  return `${n > 0 ? "+" : MINUS}${figure(Math.abs(n))}`;
}

// A gap as a share of theirs, two decimals, signed. A gap that rounds to nothing is written without a sign.
export function signedPercent(p: number): string {
  const rounded = Math.round(Math.abs(p) * 100) / 100;
  if (rounded === 0) return "0.00%";
  return `${p > 0 ? "+" : MINUS}${rounded.toFixed(2)}%`;
}

// A template's text, or null where a placeholder it names is not supplied: a sentence that cannot be filled is dropped, not softened.
function say(template: string | undefined, context: Record<string, unknown>): string | null {
  if (template === undefined) return null;
  const { text, unresolved } = fillTemplate(template, context);
  return unresolved.length === 0 ? text : null;
}

export const isPublicKind = (kind: string, w: Words = words): boolean => w.public_kinds.includes(kind);

// ---- Which sentence ----

// Said where the file is not in this build of the site.
export const absentSentence = (w: Words = words): string => w.absent;

// Why a figure is not set beside this site's, by the reason's kind. A kind the words do not know gets the general sentence.
export function notComparedSentence(reasonKind: string | null, w: Words = words): string {
  const known = w.not_compared as Record<string, string>;
  return (reasonKind !== null && reasonKind !== "other" ? known[reasonKind] : undefined) ?? w.not_compared.other;
}

// The label on a figure the organisation did not publish as one figure: it is added up from what the organisation did publish.
export function addedUpLabel(row: Pick<ReconciliationRow, "added_up_from">, sourceName: string, w: Words = words): string | null {
  if (!row.added_up_from) return null;
  return say(w.added_up, { source: sourceName, added_up_from: row.added_up_from });
}

// What this site's figure counts, in a visitor's words: the dataset and each condition. Null where a name cannot be found.
export function oursSentence(row: Pick<ReconciliationRow, "dataset" | "filters">, labels: Labels, w: Words = words): string | null {
  const dataset = labels.dataset(row.dataset);
  if (dataset === undefined) return null;
  const either = new Intl.ListFormat("en-NZ", { style: "long", type: "disjunction" });
    const conditions: string[] = [];
  for (const [dimension, values] of Object.entries(row.filters ?? {})) {
    if (values.length === 0) continue;
    const field = labels.dimension(dimension, row.dataset);
    if (field === undefined) return null;
    const text = say(w.ours.condition, { field, values: either.format(values.map((v) => labels.value(dimension, v))) });
    if (text === null) return null;
    conditions.push(text);
  }
  return conditions.length === 0 ? say(w.ours.all, { dataset }) : say(w.ours.where, { dataset, conditions: conditions.join(w.ours.join) });
}

// "Jan 2025 to Oct 2026", or one month alone.
export function spanSentence(first: string, last: string, w: Words = words): string | null {
  return say(first === last ? w.opening.span_one : w.opening.span, { from: first, to: last });
}

// ---- Grouping ----

export type FigureRowView = {
  month: string;
  monthLabel: string;
  theirs: string;
  // Absent on a figure that is not set beside this site's: the sentence says why.
  ours?: string;
  gap?: string;
  gapPct?: string;
  notCompared?: string;
  readUrl: string;
  // The page's host name and the day it was read, as the link's text.
  readLabel: string | null;
  // What this row says that its group does not say for every row: its own wording where it differs from the group's, an added-up label or a known
  // difference that not every row of the group has.
  notes: string[];
};

export type SeriesView = {
  // The wording most of the group's rows share.
  measure: string;
  kind: string;
  // Said once for the group where every row says the same; otherwise it is in the notes of the rows that have it.
  addedUp: string | null;
  ours: string | null;
  knownDifference: string | null;
  captionLatest: string | null;
  captionAll: string | null;
  // The newest month compared, and any month after it that is not compared; and every month. `every` is the heading of the second, and is
  // null when the first already holds every month. A month can have two rows, a figure as first released and as restated.
  latest: FigureRowView[];
  all: FigureRowView[];
  every: string | null;
};

export type SourceView = {
  id: string;
  name: string;
  homeUrl: string;
  basis: string | null;
  says: string;
  definition: string | null;
  series: SeriesView[];
};

export type ComparisonView =
  | { kind: "absent" | "empty"; heading: string; text: string }
  | {
      kind: "figures";
      heading: string;
      opening: string | null;
      gapNote: string;
      columns: Words["columns"];
      sources: SourceView[];
      closing: string | null;
    };

const byMonthDescending = (a: { month: string }, b: { month: string }) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0);
const alphabetical = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// The month of the newest figure that was set beside this site's, or undefined where none was.
export function newestCompared(rows: readonly ReconciliationRow[]): string | undefined {
  let newest: string | undefined;
  for (const row of rows) if (row.status !== "not_compared" && (newest === undefined || row.month > newest)) newest = row.month;
  return newest;
}

// The host name of the page a figure was read on, without "www.": the organisation's own release and a news report of it are told apart by it.
export function hostOf(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return host === "" ? undefined : host;
  } catch {
    return undefined;
  }
}

// The value most rows of a group share; of those tied, the one the newest row has. `rows` is newest first.
function mostCommon(rows: readonly ReconciliationRow[], of: (row: ReconciliationRow) => string): string {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(of(row), (counts.get(of(row)) ?? 0) + 1);
  let best = of(rows[0]);
  for (const [value, count] of counts) if (count > (counts.get(best) ?? 0)) best = value;
  return best;
}

// The one value every row of a group has (null where every row has none), or undefined where they differ.
function sharedBy(rows: readonly ReconciliationRow[], of: (row: ReconciliationRow) => string | null): string | null | undefined {
  const first = of(rows[0]);
  return rows.every((row) => of(row) === first) ? first : undefined;
}

// The group's key is what this site's figure is, not how the organisation words it: the same question worded a little differently from one row to
// the next stays in one table.
const seriesKey = (row: ReconciliationRow): string => JSON.stringify([row.source, row.dataset, row.filters]);

function figureRow(row: ReconciliationRow, notes: string[], w: Words): FigureRowView {
  const compared = row.status !== "not_compared" && row.ours !== null && row.gap !== null && row.gap_pct !== null;
  const host = hostOf(row.source_url);
  return {
    month: row.month,
    monthLabel: monthLabel(row.month),
    theirs: figure(row.theirs),
    ...(compared
      ? { ours: figure(row.ours as number), gap: signedCount(row.gap as number), gapPct: signedPercent(row.gap_pct as number) }
      : { notCompared: notComparedSentence(row.reason_kind, w) }),
    readUrl: row.source_url,
    readLabel: host === undefined ? null : say(w.read_link, { host, date: row.date_read }),
    notes,
  };
}

function seriesView(rows: ReconciliationRow[], source: ReconciliationSource, labels: Labels, w: Words): SeriesView {
  // Newest month first. Two rows of one month (a figure as first released and as restated) both stay, ordered by their wording and the day read.
  const newestFirst = [...rows].sort((a, b) => byMonthDescending(a, b) || alphabetical(a.measure_as_published, b.measure_as_published) || alphabetical(a.date_read, b.date_read));
  const first = newestFirst[0];
  const measure = mostCommon(newestFirst, (row) => row.measure_as_published);
  const headline = newestCompared(newestFirst) ?? first.month;
  const shown = newestFirst.filter((row) => row.month >= headline);
  const oldest = newestFirst[newestFirst.length - 1].month;

  const addedUpShared = sharedBy(newestFirst, (row) => row.added_up_from);
  const knownShared = sharedBy(newestFirst, (row) => row.known_difference);
  const addedUp = (row: ReconciliationRow) => (row.added_up_from ? addedUpLabel(row, source.name, w) : null);
  const known = (row: ReconciliationRow) => (row.known_difference ? say(w.known_difference, { note: row.known_difference }) : null);
  const view = (row: ReconciliationRow): FigureRowView => {
    const notes = [
      row.measure_as_published === measure ? null : say(w.wording, { measure: row.measure_as_published }),
      addedUpShared === undefined ? addedUp(row) : null,
      knownShared === undefined ? known(row) : null,
    ].filter((note): note is string => note !== null);
    return figureRow(row, notes, w);
  };

  return {
    measure,
    kind: first.figure_kind,
    addedUp: addedUpShared ? addedUp(first) : null,
    ours: oursSentence(first, labels, w),
    knownDifference: knownShared ? known(first) : null,
    captionLatest: say(w.caption.latest, { source: source.name, measure }),
    captionAll: say(w.caption.all, { source: source.name, measure }),
    latest: shown.map(view),
    all: newestFirst.map(view),
    every: shown.length < newestFirst.length ? say(w.every_month, { from: oldest, to: first.month }) : null,
  };
}

// The public section: the file's sources in its order, each with its figures of the kinds config lists, grouped by what this site's figure is (dataset and conditions).
// A figure of any other kind is only counted in the closing sentence.
export function comparisonView(reconciliation: Reconciliation | undefined | null, labels: Labels, w: Words = words): ComparisonView {
  const heading = w.heading;
  if (!reconciliation || !Array.isArray(reconciliation.rows) || typeof reconciliation.sources !== "object" || reconciliation.sources === null) {
    return { kind: "absent", heading, text: absentSentence(w) };
  }
  const shownRows = reconciliation.rows.filter((row) => isPublicKind(row.figure_kind, w));
  const sourceIds = Object.keys(reconciliation.sources);
  if (shownRows.length === 0 || sourceIds.length === 0) return { kind: "empty", heading, text: w.empty };

  const months = shownRows.map((row) => row.month).sort();
  const span = spanSentence(months[0], months[months.length - 1], w);
  const opening = span === null ? null : say(sourceIds.length === 1 ? w.opening.one : w.opening.many, { count: figure(sourceIds.length), span, date: reconciliation.latest_snapshot });

  const kindOrder = (kind: string) => w.public_kinds.indexOf(kind);
  const sources = sourceIds.map((id): SourceView => {
    const source = reconciliation.sources[id];
    const groups = new Map<string, ReconciliationRow[]>();
    for (const row of shownRows) {
      if (row.source !== id) continue;
      const key = seriesKey(row);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const series = [...groups.values()]
      .map((rows) => seriesView(rows, source, labels, w))
      .sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || alphabetical(a.measure, b.measure));
    return {
      id,
      name: source.name,
      homeUrl: source.home_url,
      basis: source.data_basis ?? null,
      says: w.says_it_counts,
      definition: say(w.definition, { definition: source.definition, date: source.definition_date_read }),
      series,
    };
  });

  const further = reconciliation.rows.length - shownRows.length;
  const closing = further === 0 ? null : say(further === 1 ? w.closing.one : w.closing.many, { count: figure(further) });
  return { kind: "figures", heading, opening, gapNote: w.gap_note, columns: w.columns, sources, closing };
}

// ---- The internal list of restated figures ----

export type RestatedFigure = { month: string; status: ReconciliationStatus; source: string; measure: string; earlier: string; current: string; change: string; ours: string | null };

export type RestatedView = {
  heading: string;
  intro: string | null;
  caption: string;
  columns: Words["restated"]["columns"];
  rows: RestatedFigure[];
};

// The rows a source restated by the size the build warns about (the file says which, so this names no size), newest month first. Null where none
// was: the status page shows nothing for it.
export function restatedView(reconciliation: Reconciliation | undefined | null, w: Words = words): RestatedView | null {
  if (!reconciliation || !Array.isArray(reconciliation.rows)) return null;
  const sources = reconciliation.sources ?? {};
  const restated = reconciliation.rows
    .filter((row) => row.restated_past_warning === true && typeof row.restated_from === "number" && typeof row.restated_pct === "number")
    .sort(
      (a, b) =>
        byMonthDescending(a, b) || alphabetical(a.source, b.source) || alphabetical(a.measure_as_published, b.measure_as_published) || alphabetical(JSON.stringify(a.filters), JSON.stringify(b.filters)),
    );
  if (restated.length === 0) return null;
  return {
    heading: w.restated.heading,
    intro: say(w.restated.intro, { count: figure(restated.length) }),
    caption: w.restated.caption,
    columns: w.restated.columns,
    rows: restated.map((row) => ({
      month: row.month,
      status: row.status,
      source: sources[row.source]?.name ?? row.source,
      measure: row.measure_as_published,
      earlier: figure(row.restated_from as number),
      current: figure(row.theirs),
      change: signedPercent(row.restated_pct as number),
      ours: row.ours === null ? null : figure(row.ours),
    })),
  };
}

// ---- The internal table ----

export const STATUS_ORDER: readonly ReconciliationStatus[] = ["fail", "warn", "not_compared", "pass"];

// Every row, the ones that need a look first: fail, warn, not compared, then pass, each newest month first, then by source, measure and question.
export function statusRows(rows: readonly ReconciliationRow[]): ReconciliationRow[] {
  const rank = (status: string) => {
    const i = STATUS_ORDER.indexOf(status as ReconciliationStatus);
    return i === -1 ? STATUS_ORDER.length : i;
  };
  const key = (row: ReconciliationRow) => `${row.source}\u0000${row.measure_as_published}\u0000${row.dataset}\u0000${JSON.stringify(row.filters)}`;
  return [...rows].sort((a, b) => rank(a.status) - rank(b.status) || byMonthDescending(a, b) || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

// A row's question as the internal page names it: the dimension and its values, as the file holds them.
export const filtersText = (filters: Record<string, string[]>): string =>
  Object.entries(filters ?? {})
    .map(([dimension, values]) => `${dimension}: ${values.join(" | ")}`)
    .join("; ");
