// The sentences about the data, built from phrase templates in config and facts the caller supplies. Pure: no React, no
// config reads, no data loading, and no imports, so tests/site/ runs it with Node's own test runner (docs/playbooks/run-checks.md).
// A template names no domain value, figure or cause (CLAUDE.md invariant 8); the words are in config/presets.json
// (defaults.phrases, preset.answer) and config/dimensions.json (a dataset's words).

// ---- Months ----

// Called per month inside loops over every month of a series, so it parses without splitting and pads from a table.
const MONTH_PART = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
// A month as a count of months since year 0, and back: the form to step through a range in. Something that is not a
// "YYYY-MM" key (a missing month, text) has no index: NaN, which compares false with everything, so a range over it is
// empty (as before), and monthAt turns it into "" rather than a "NaN-undefined" that could pass for a month.
export function monthIndex(key: string): number {
  if (typeof key !== "string") return Number.NaN;
  const dash = key.indexOf("-");
  const month = Number(key.slice(dash + 1));
  return dash > 0 && month >= 1 && month <= 12 ? Number(key.slice(0, dash)) * 12 + (month - 1) : Number.NaN;
}
export const monthAt = (index: number): string => (Number.isInteger(index) ? `${Math.floor(index / 12)}-${MONTH_PART[((index % 12) + 12) % 12]}` : "");
export const addMonths = (key: string, k: number): string => monthAt(monthIndex(key) + k);

// Every month from one key to another, both included; empty when either is not a month or the first is after the second.
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = monthIndex(from), last = monthIndex(to); t <= last; t++) out.push(monthAt(t));
  return out;
}

// A month as a reader says it: "Aug 2026", not "2026-08".
const MONTH_FORMAT = new Intl.DateTimeFormat("en-NZ", { month: "short", year: "numeric", timeZone: "UTC" });
const LABELS = new Map<string, string>();
export const monthLabel = (key: string) => {
  let label = LABELS.get(key);
  if (label === undefined) LABELS.set(key, (label = MONTH_FORMAT.format(new Date(`${key}-01T00:00:00Z`))));
  return label;
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// ---- Templates ----

export const UNRESOLVED = "?";
export type NoteContext = Record<string, unknown>;

// {dotted.path} with an optional |filter. The same pattern pipeline/tests/test_site_config.py checks config against.
export const PLACEHOLDER = /\{([a-z_]+(?:\.[A-Za-z0-9_]+)*)(\|[a-z]+)?\}/g;

function lookup(context: NoteContext, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => {
    if (node === null || node === undefined) return undefined;
    return (node as Record<string, unknown>)[key];
  }, context);
}

// One rule for every proportion the site writes in a sentence: under 10% one decimal place, otherwise whole.
export const percent = (proportion: number) => `${(proportion * 100).toFixed(proportion * 100 < 10 ? 1 : 0)}%`;

function format(value: unknown, filter?: string): string {
  if (value === undefined || value === null) return UNRESOLVED;
  if (filter === "|month" && typeof value === "string") return monthLabel(value);
  if (filter === "|date" && typeof value === "string") return DATE_FORMAT.format(new Date(`${value}T00:00:00Z`));
  if (filter === "|pct") return typeof value === "number" ? percent(value) : UNRESOLVED;
  return String(value);
}

// The filled text and every path the caller did not supply, so a template that cannot be filled is known.
export function fillTemplate(template: string, context: NoteContext): { text: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const text = template.replace(PLACEHOLDER, (_match, path: string, filter?: string) => {
    const value = lookup(context, path);
    if (value === undefined || value === null) unresolved.push(path);
    return format(value, filter);
  });
  return { text, unresolved };
}

// Why a figure is greyed, without the word "greyed": the readout puts it after the word, the file of figures beside the mark.
export const markReason = (greyed: "thin" | "collapsed" | undefined, minDenominator?: number): string =>
  greyed === "thin"
    ? `fewer than ${minDenominator ?? ""} vehicles behind this figure`
    : greyed === "collapsed"
      ? "far fewer vehicles than the months before, so it may not describe a normal month"
      : "";

// ---- The change on a year ago ----

// Smaller than this, as a proportion, is the same: it would show as 0.0%.
const SAME_BELOW = 0.0005;

export type YearChange = { prior: number; change: number; direction: "up" | "down" | "same" };

// The change from a count a year earlier to this one, or undefined where that count is missing or under the measure's floor.
export function changeOnYear(now: number | undefined, prior: number | undefined, floor: number): YearChange | undefined {
  if (now === undefined || prior === undefined || prior <= 0 || prior < floor) return undefined;
  const change = (now - prior) / prior;
  return { prior, change, direction: Math.abs(change) < SAME_BELOW ? "same" : change > 0 ? "up" : "down" };
}

// One formatter, made once: toLocaleString makes a new one on every call, and a chart's hover text asks for a figure per
// point.
const COUNT_FORMAT = new Intl.NumberFormat("en-NZ");
export const count = (n: number) => COUNT_FORMAT.format(Math.round(n));
// A number of vehicles as words: "1 vehicle", "3 vehicles".
export const vehiclesText = (n: number) => `${count(n)} ${Math.round(n) === 1 ? "vehicle" : "vehicles"}`;

// The rows of one dataset's slice: every month the dataset has, each row carrying that month's total. The functions below
// take these rows whole, never a window of them, so the months a chart draws cannot change a sentence.
export type MonthRow = { month: string; denominator: number };

function monthlyTotals(rows: readonly MonthRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.month, r.denominator);
  return totals;
}

// Every month the rows have, newest first: the months a visitor may ask about.
export function monthsOf(rows: readonly MonthRow[]): string[] {
  return [...monthlyTotals(rows).keys()].sort().reverse();
}

const yearContext = (month: string, c: YearChange) => ({
  prior_month: monthLabel(addMonths(month, -12)),
  prior_count: count(c.prior),
  change: Math.abs(c.change),
});

export type YearPhrases = { year_up: string; year_down: string; year_same: string; no_year_ago: string; year_too_few: string };

// What a point says about the year before it, for a hover over a monthly count. Three cases, each its own sentence: a change,
// a year-ago month that is not in the data, and one with too few vehicles to compare with.
export function hoverLine(p: YearPhrases, rows: readonly MonthRow[], month: string, floor: number): string {
  const totals = monthlyTotals(rows);
  const prior = totals.get(addMonths(month, -12));
  const c = changeOnYear(totals.get(month), prior, floor);
  if (c) return fillTemplate(p[`year_${c.direction}`], yearContext(month, c)).text;
  return fillTemplate(prior === undefined ? p.no_year_ago : p.year_too_few, {}).text;
}

export type AnswerTemplates = { up: string; down: string; same: string; alone: string };

// The figure and the sentence for a month. alone is for a month with no usable year-ago figure, and for a template that cannot
// be filled, which is dropped for it rather than shown with gaps.
export function answerLine(
  templates: AnswerTemplates,
  rows: readonly MonthRow[],
  month: string,
  floor: number,
): { figure: string; sentence: string } | undefined {
  const totals = monthlyTotals(rows);
  const now = totals.get(month);
  if (now === undefined) return undefined;
  const c = changeOnYear(now, totals.get(addMonths(month, -12)), floor);
  const context = { month: monthLabel(month), count: count(now), ...(c ? yearContext(month, c) : {}) };
  const filled = c ? fillTemplate(templates[c.direction], context) : undefined;
  const text = filled && filled.unresolved.length === 0 ? filled.text : fillTemplate(templates.alone, context).text;
  return { figure: count(now), sentence: text };
}

// ---- A ranking ----

export type RankingPhrases = {
  window_last: string;
  window_to: string;
  window_month: string;
  prior_month: string;
  prior_months: string;
  ranking_dates: string;
  ranking_compare: string;
  ranking_no_prior: string;
};

// What a ranking says where its base is under the precision floor (docs/METRICS.md, "A ranking and the precision floor").
export type RankingThinPhrases = { ranking_thin: string; ranking_thin_prior: string; ranking_thin_prior_month: string };

export type RankingFacts = {
  // The dataset's own opening sentence, with {window}.
  basis: string;
  span: number;
  end: string;
  latest: string;
  // A dataset of one period names its window in its own words (its window_one) and not by the month it ends in.
  once?: string;
  // The first and last month of the dataset the ranking is of (its supplied start or its earliest month with vehicles, and its
  // newest), never the months a narrowed view has rows for: under a condition a month with no vehicles has no rows, and that is
  // a month of zero, not a month the dataset lacks.
  covers: { first: string; last: string };
};

const dates = (from: string, to: string) => (from === to ? monthLabel(from) : `${monthLabel(from)} to ${monthLabel(to)}`);

// The months a ranking covers and the same months a year earlier, from where it ends.
export function rankingWindows(end: string, span: number) {
  const currentFrom = addMonths(end, -(span - 1));
  return { currentFrom, priorFrom: addMonths(currentFrom, -12), priorTo: addMonths(end, -12) };
}

// Why a change on a year ago is withheld, in the words of the window ranked: a ranking of twelve months does not speak of a month.
export function yearTooFewText(p: { year_too_few: string; year_too_few_window: string; prior_months: string }, span: number, end: string): string {
  if (span === 1) return p.year_too_few;
  return fillTemplate(p.year_too_few_window, { prior_window: fillTemplate(p.prior_months, { span, end: monthLabel(end) }).text }).text;
}

// What a ranking covers, and what it is compared with, and whether there is a comparison at all: it is only described when
// the earlier window lies wholly inside the months the dataset covers. A ranking with none says so instead of describing one.
// The words for the window a ranking ranks ("in the last 12 months") and the months it is compared with ("Nov 2024 to Oct 2025").
export function rankingWords(p: RankingPhrases, f: Pick<RankingFacts, "span" | "end" | "latest" | "once">): { window: string; priorDates: string } {
  const { priorFrom, priorTo } = rankingWindows(f.end, f.span);
  const span = { span: f.span, end: monthLabel(f.end) };
  if (f.once) return { window: f.once, priorDates: dates(priorFrom, priorTo) };
  return { window: fillTemplate(f.span === 1 ? p.window_month : f.end === f.latest ? p.window_last : p.window_to, span).text, priorDates: dates(priorFrom, priorTo) };
}

export function rankingText(p: RankingPhrases, f: RankingFacts): { text: string; hasPrior: boolean } {
  const { currentFrom, priorFrom, priorTo } = rankingWindows(f.end, f.span);
  const hasPrior = priorFrom >= f.covers.first && priorTo <= f.covers.last;
  const span = { span: f.span, end: monthLabel(f.end) };
  const { window, priorDates } = rankingWords(p, f);
  const parts = [fillTemplate(f.basis, { window }).text];
  if (f.span > 1) parts.push(fillTemplate(p.ranking_dates, { current: dates(currentFrom, f.end) }).text);
  const opening = `${parts.join(" ")}.`;
  if (!hasPrior) return { text: `${opening} ${p.ranking_no_prior}`, hasPrior };
  const prior = fillTemplate(f.span === 1 ? p.prior_month : p.prior_months, span).text;
  return { text: `${opening} ${fillTemplate(p.ranking_compare, { prior_window: prior, prior: priorDates }).text}`, hasPrior };
}

// ---- A ranking of the values a visitor chose, or that the page chose ----

// The words around a ranking of some values (D-111). Its ranks are places among those values, and each share stays a share of everything
// counted under the conditions, so the page says both, in sentences a template fills. The values are the visitor's ("you picked") or the
// page's own starting values ("shown"): the page never says a visitor picked what the page chose, so each sentence has both forms.
export type PickedRankingPhrases = {
  ranking_picked: string;
  ranking_shown: string;
  ranking_picked_leader: string;
  ranking_shown_leader: string;
  ranking_picked_leaders: string;
  ranking_shown_leaders: string;
  ranking_picked_none: string;
  ranking_shown_none: string;
  ranking_all_leader: string;
  ranking_all_leaders: string;
  ranking_unranked_empty: string;
  ranking_unranked_not_recorded: string;
  ranking_unranked_unmatched: string;
  ranking_picked_share: string;
  ranking_picked_share_where: string;
  ranking_shown_share: string;
  ranking_shown_share_where: string;
  ranking_picked_share_head: string;
  ranking_picked_rank_head: string;
  ranking_picked_prior_head: string;
  ranking_switch_picked: string;
  ranking_switch_shown: string;
  ranking_back_to_lines: string;
  ranking_all_note_picked: string;
  ranking_all_note_shown: string;
  ranking_back_picked: string;
  ranking_back_shown: string;
  picker_page_values: string;
};

// Names as a reader says them in a sentence: "A", "A and B", "A, B and C".
export const sayList = (names: readonly string[]): string =>
  names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

// The cube's token for vehicles whose value the reference has no entry for (docs/CUBE_SCHEMA.md, Reserved tokens).
export const NO_MATCH_TOKEN = "__UNMAPPED__";

// The cube's value for a month of an owner-field slice that is not broken down at all, every cell of it hidden by the small-cell rule (D-127):
// the one row of that month, with the month's total in `n`. It is no value of the field, so no chart may take it for one (src/lib/data.ts, D-130).
export const NOT_BROKEN_DOWN_TOKEN = "__NOT_BROKEN_DOWN__";

// The figure of the value in first place, said in the dataset's own words for what it counts: "3,513 vehicles first registered in the last 12
// months that are still registered". template has {vehicles} and {window}; a dataset with none says the vehicles and the window.
export const countedText = (template: string | undefined, n: number, window: string): string =>
  fillTemplate(template ?? "{vehicles} {window}", { vehicles: vehiclesText(n), window }).text;

export type PickedRankingFacts = {
  // Whether the values are the visitor's own choice (false: the page's starting values).
  own: boolean;
  // How many values are ranked among, the field they are values of as a noun that reads after "every", and the months of the window the
  // page chooses its starting values from.
  picked: number;
  field: string;
  months: number;
  // "in the last 12 months", "in Oct 2026" (rankingWords).
  window: string;
  // The values in first place by the name a reader sees, with their count said in the dataset's words (countedText); none where no value has
  // a vehicle in the window.
  leaders: readonly string[];
  counted: string;
  // The values that take no place, by name, by why: no vehicles in the window, or a value that stands for vehicles whose field is not recorded
  // or has no match in the reference.
  unranked: { empty: readonly string[]; notRecorded: readonly string[]; unmatched: readonly string[] };
  // Every vehicle counted in the window under the conditions, which each share is a share of, and whether there are conditions.
  total: number;
  conditions: boolean;
};

// The sentences above and below a ranking of some values. A sentence that cannot be said is left out, not softened: with nothing to rank
// there is no leader and no share to say.
export function pickedRankingSentences(p: PickedRankingPhrases, f: PickedRankingFacts) {
  const form = f.own ? "picked" : "shown";
  const context = { picked: f.picked, field: f.field, window: f.window, months: f.months, counted: f.counted };
  const one = f.leaders.length === 1;
  const leader =
    f.leaders.length === 0
      ? fillTemplate(p[`ranking_${form}_none` as keyof PickedRankingPhrases], context).text
      : fillTemplate(p[(one ? `ranking_${form}_leader` : `ranking_${form}_leaders`) as keyof PickedRankingPhrases], { ...context, leader: f.leaders[0], leaders: sayList(f.leaders) }).text;
  const unranked = [
    f.unranked.empty.length ? fillTemplate(p.ranking_unranked_empty, { ...context, names: sayList(f.unranked.empty) }).text : undefined,
    f.unranked.notRecorded.length ? fillTemplate(p.ranking_unranked_not_recorded, { ...context, names: sayList(f.unranked.notRecorded) }).text : undefined,
    f.unranked.unmatched.length ? fillTemplate(p.ranking_unranked_unmatched, { ...context, names: sayList(f.unranked.unmatched) }).text : undefined,
  ].filter((s): s is string => s !== undefined);
  return {
    label: fillTemplate(p[f.own ? "ranking_picked" : "ranking_shown"], context).text,
    leader,
    unranked,
    share:
      f.total > 0 && f.leaders.length > 0
        ? fillTemplate(p[`ranking_${form}_share${f.conditions ? "_where" : ""}` as keyof PickedRankingPhrases], { ...context, vehicles: vehiclesText(f.total) }).text
        : undefined,
    shareHead: p.ranking_picked_share_head,
    rankHead: fillTemplate(p.ranking_picked_rank_head, context).text,
    priorHead: fillTemplate(p.ranking_picked_prior_head, context).text,
  };
}

// The first sentence under the question of a ranking of every value: who is first, and with how many.
export function rankingLeaderSentence(p: PickedRankingPhrases, leaders: readonly string[], counted: string): string | undefined {
  if (leaders.length === 0) return undefined;
  return fillTemplate(leaders.length === 1 ? p.ranking_all_leader : p.ranking_all_leaders, { leader: leaders[0], leaders: sayList(leaders), counted }).text;
}

// What the question builder says around a ranking of some values: the switch to the ranking, the way back to the values, the note while every
// value is ranked, and the note under the picker where the values are the page's own.
export function pickedBuilderSentences(p: PickedRankingPhrases, f: { own: boolean; picked: number; field: string; months: number; names: readonly string[] }) {
  const form = f.own ? "picked" : "shown";
  const context = { picked: f.picked, field: f.field, months: f.months, names: sayList(f.names) };
  return {
    toRanking: fillTemplate(p[`ranking_switch_${form}` as keyof PickedRankingPhrases], context).text,
    toLines: p.ranking_back_to_lines,
    allNote: fillTemplate(p[`ranking_all_note_${form}` as keyof PickedRankingPhrases], context).text,
    back: fillTemplate(p[`ranking_back_${form}` as keyof PickedRankingPhrases], context).text,
    pickerNote: f.own ? undefined : fillTemplate(p.picker_page_values, context).text,
  };
}

// ---- A month the address names ----

// A sentence for a month that is asked about and is not inside the months the chart draws; undefined when it is inside.
export function sayOffChart(template: string, month: string, from: string, to: string): string | undefined {
  if (month >= from && month <= to) return undefined;
  return fillTemplate(template, { month: monthLabel(month) }).text;
}

// A sentence for an address that names a month the chart cannot show; undefined when the month is fine or none was named.
export function sayBadMonth(template: string, asked: string | undefined, shown: string): string | undefined {
  if (!asked || asked === shown) return undefined;
  return fillTemplate(template, { asked, shown: monthLabel(shown) }).text;
}

// ---- Months a breakdown was not recorded ----

// The cube's token for vehicles whose value the source does not record (docs/CUBE_SCHEMA.md, Reserved tokens).
export const NOT_RECORDED_TOKEN = "__UNDEFINED__";

export type CountRow = { month: string; value: string; n: number };
export type MonthRun = { from: string; to: string };

// The months in which the source records nothing of this breakdown: every vehicle of the month sits under the token. Such a
// month is not a month of zeros, so a chart that draws a line for each value leaves it blank. A month with some vehicles
// recorded is drawn, whatever share is not.
export function unrecordedMonths(rows: readonly CountRow[]): string[] {
  const seen = new Map<string, { recorded: number; unrecorded: number }>();
  for (const r of rows) {
    const month = seen.get(r.month) ?? { recorded: 0, unrecorded: 0 };
    if (r.value === NOT_RECORDED_TOKEN) month.unrecorded += r.n;
    else month.recorded += r.n;
    seen.set(r.month, month);
  }
  return [...seen.entries()]
    .filter(([, m]) => m.unrecorded > 0 && m.recorded === 0)
    .map(([month]) => month)
    .sort();
}

// Months in order, grouped into stretches of consecutive months.
export function monthRuns(months: readonly string[]): MonthRun[] {
  const runs: MonthRun[] = [];
  for (const month of [...months].sort()) {
    const last = runs[runs.length - 1];
    if (last && addMonths(last.to, 1) === month) last.to = month;
    else runs.push({ from: month, to: month });
  }
  return runs;
}

// One sentence for each stretch of months that is left blank.
export const sayNotRecorded = (template: string, runs: readonly MonthRun[]): string[] =>
  runs.map((r) => fillTemplate(template, { from: monthLabel(r.from), to: monthLabel(r.to) }).text);

// Where the breakdown begins, when the data opens with months that are not recorded: the month after the first stretch. Undefined
// when the first month of the data is recorded.
export function sayStarts(template: string, runs: readonly MonthRun[], firstMonth: string): string | undefined {
  const first = runs[0];
  if (!first || first.from !== firstMonth) return undefined;
  return fillTemplate(template, { from: monthLabel(addMonths(first.to, 1)) }).text;
}

// A dataset built from a published series lists the months where a breakdown's values add up to more than the month's total
// (docs/CUBE_SCHEMA.md, Slice schema): the values are the source's own, so they are drawn as published and the month is said.
export const sayExceedsTotal = (template: string, months: readonly string[] | undefined): string[] =>
  [...(months ?? [])].sort().map((m) => fillTemplate(template, { month: monthLabel(m) }).text);


// ---- A grid of two fields (D-114) ----

// The words around a grid. Each is a template in config (defaults.phrases, matrix_*); the sentences below are filled from facts the grid's
// code computes, and a sentence that cannot be filled is dropped, not softened (invariant 8).
export type MatrixPhrases = {
  matrix_leader: string;
  matrix_leaders: string;
  matrix_leader_picked: string;
  matrix_leaders_picked: string;
  matrix_leaders_rest_one: string;
  matrix_leaders_rest: string;
  matrix_pair: string;
  matrix_cells_count: string;
  matrix_cells_all: string;
  matrix_cells_all_where: string;
  matrix_cells_row: string;
  matrix_cells_column: string;
  matrix_thin_all: string;
  matrix_thin_rows_one: string;
  matrix_thin_rows: string;
  matrix_thin_columns_one: string;
  matrix_thin_columns: string;
  matrix_rows_largest: string;
  matrix_columns_largest: string;
  matrix_rows_largest_one: string;
  matrix_columns_largest_one: string;
  matrix_rows_picked: string;
  matrix_columns_picked: string;
  matrix_rows_picked_one: string;
  matrix_columns_picked_one: string;
  matrix_rows_all: string;
  matrix_columns_all: string;
  matrix_rows_ordered: string;
  matrix_columns_ordered: string;
  matrix_rows_kept: string;
  matrix_columns_kept: string;
  matrix_rows_tie: string;
  matrix_columns_tie: string;
  matrix_rows_tie_one: string;
  matrix_columns_tie_one: string;
  matrix_rows_rest: string;
  matrix_columns_rest: string;
  matrix_rest_further: string;
  matrix_rest_further_one: string;
  matrix_rest_unrecorded: string;
  matrix_rest_unmatched: string;
  matrix_rest_beyond: string;
  matrix_tiny: string;
  matrix_hidden: string;
  matrix_hidden_one: string;
};

export type MatrixSideFacts = {
  // The field this side is, as a noun that reads before "values".
  field: string;
  mode: "picked" | "largest" | "all" | "ordered";
  // How many named values stand on this side.
  shown: number;
  tiedBeyond: number;
  // A value shown out of its rank because it is in the largest combination.
  kept?: string;
  rest?: { values: number; notRecorded: boolean; unmatched: boolean; beyondCap: boolean };
};

export type MatrixFacts = {
  basis: "count" | "all" | "row" | "column";
  rowField: string;
  columnField: string;
  // "in the last 12 months", "in Oct 2026" (rankingWords).
  window: string;
  total: number;
  conditions: boolean;
  floor: number;
  // The name of the line that holds every value not shown.
  rest: string;
  // inRest: counted in a cell of the rest line, not in a cell of its own.
  leaders: readonly { row: string; column: string; n: number; inRest?: boolean }[];
  // Which sides the largest combination is among the picked values of; neither is the largest of the whole window.
  among: { rows: boolean; columns: boolean };
  // The figure of a combination in the dataset's own words for what it counts (countedText).
  counted: (n: number) => string;
  rows: MatrixSideFacts;
  columns: MatrixSideFacts;
  thin: { whole: boolean; rows: number; columns: number };
  // Some share is above zero and prints as nothing.
  tiny: boolean;
  // Cells with no count (D-139) and the least count a shown cell has: absent, or none hidden, for a grid of every cell.
  hidden?: { cells: number; minimum?: number };
};

// A template filled, or nothing where it cannot be: a sentence with a gap is dropped.
const said = (template: string, context: NoteContext): string | undefined => {
  const filled = fillTemplate(template, context);
  return filled.unresolved.length === 0 ? filled.text : undefined;
};
const present = (list: (string | undefined)[]): string[] => list.filter((s): s is string => s !== undefined && s !== "");

// The sentences of a grid: who leads, what a cell holds, how each side was chosen, what the rest line holds, and what is greyed.
export function matrixSentences(p: MatrixPhrases, f: MatrixFacts) {
  const base = { window: f.window, floor: f.floor, rest: f.rest, vehicles: vehiclesText(f.total) };
  const side = (which: "rows" | "columns", s: MatrixSideFacts): string[] => {
    const context = { ...base, shown: s.shown, field: s.field, count: s.tiedBeyond, names: s.kept };
    const key = (kind: string) => `matrix_${which}_${kind}` as keyof MatrixPhrases;
    const parts = s.rest
      ? present([
          s.rest.values > 0 ? said(s.rest.values === 1 ? p.matrix_rest_further_one : p.matrix_rest_further, { ...context, count: s.rest.values }) : undefined,
          s.rest.notRecorded ? said(p.matrix_rest_unrecorded, context) : undefined,
          s.rest.unmatched ? said(p.matrix_rest_unmatched, context) : undefined,
          s.rest.beyondCap ? said(p.matrix_rest_beyond, context) : undefined,
        ])
      : [];
    return present([
      // One value standing on a side is said in the singular, as the rest line and a tie are.
      said(p[key(s.shown === 1 && (s.mode === "largest" || s.mode === "picked") ? `${s.mode}_one` : s.mode)], context),
      s.tiedBeyond > 0 && s.mode === "largest" ? said(p[key(s.tiedBeyond === 1 ? "tie_one" : "tie")], context) : undefined,
      s.kept ? said(p[key("kept")], context) : undefined,
      s.rest && parts.length ? said(p[key("rest")], { ...context, list: sayList(parts) }) : undefined,
    ]);
  };
  const pair = (l: { row: string; column: string }) => said(p.matrix_pair, { row_field: f.rowField, row: l.row, column_field: f.columnField, column: l.column });
  const picked = f.among.rows || f.among.columns;
  const among = sayList([...(f.among.rows ? [f.rowField] : []), ...(f.among.columns ? [f.columnField] : [])]);
  const leader =
    f.leaders.length === 0
      ? undefined
      : f.leaders.length === 1
        ? said(picked ? p.matrix_leader_picked : p.matrix_leader, {
            field: among,
            row_field: f.rowField,
            row: f.leaders[0].row,
            column_field: f.columnField,
            column: f.leaders[0].column,
            counted: f.counted(f.leaders[0].n),
          })
        : said(picked ? p.matrix_leaders_picked : p.matrix_leaders, {
            field: among,
            count: f.leaders.length,
            counted: f.counted(f.leaders[0].n),
            list: f.leaders.map(pair).filter(Boolean).join("; "),
          });
  // Level leaders named in the sentence that the grid does not show as a cell of their own: the sentence must not point at what is not there.
  const inRest = f.leaders.filter((l) => l.inRest).length;
  const leaderRest = inRest > 0 ? said(inRest === 1 ? p.matrix_leaders_rest_one : p.matrix_leaders_rest, { ...base, count: inRest }) : undefined;
  const cells = said(
    f.basis === "count" ? p.matrix_cells_count : f.basis === "all" ? (f.conditions ? p.matrix_cells_all_where : p.matrix_cells_all) : f.basis === "row" ? p.matrix_cells_row : p.matrix_cells_column,
    base,
  );
  const thin = f.thin.whole
    ? present([said(p.matrix_thin_all, base)])
    : present([
        f.thin.rows > 0 ? said(f.thin.rows === 1 ? p.matrix_thin_rows_one : p.matrix_thin_rows, { ...base, count: f.thin.rows }) : undefined,
        f.thin.columns > 0 ? said(f.thin.columns === 1 ? p.matrix_thin_columns_one : p.matrix_thin_columns, { ...base, count: f.thin.columns }) : undefined,
      ]);
  return { leader: leader && leaderRest ? `${leader} ${leaderRest}` : leader, cells, rows: side("rows", f.rows), columns: side("columns", f.columns), thin, tiny: f.tiny ? said(p.matrix_tiny, base) : undefined,
    // A sentence that cannot be filled (no least count) is dropped, not written with a gap.
    hidden: f.hidden && f.hidden.cells > 0 ? said(f.hidden.cells === 1 ? p.matrix_hidden_one : p.matrix_hidden, { ...base, count: f.hidden.cells, minimum: f.hidden.minimum }) : undefined };
}
