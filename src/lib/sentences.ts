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

export type RankingFacts = {
  // The dataset's own opening sentence, with {window}.
  basis: string;
  span: number;
  end: string;
  latest: string;
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

// What a ranking covers, and what it is compared with, and whether there is a comparison at all: it is only described when
// the earlier window lies wholly inside the months the dataset covers. A ranking with none says so instead of describing one.
export function rankingText(p: RankingPhrases, f: RankingFacts): { text: string; hasPrior: boolean } {
  const { currentFrom, priorFrom, priorTo } = rankingWindows(f.end, f.span);
  const hasPrior = priorFrom >= f.covers.first && priorTo <= f.covers.last;
  const span = { span: f.span, end: monthLabel(f.end) };
  const window = fillTemplate(f.span === 1 ? p.window_month : f.end === f.latest ? p.window_last : p.window_to, span).text;
  const parts = [fillTemplate(f.basis, { window }).text];
  if (f.span > 1) parts.push(fillTemplate(p.ranking_dates, { current: dates(currentFrom, f.end) }).text);
  const opening = `${parts.join(" ")}.`;
  if (!hasPrior) return { text: `${opening} ${p.ranking_no_prior}`, hasPrior };
  const prior = fillTemplate(f.span === 1 ? p.prior_month : p.prior_months, span).text;
  return { text: `${opening} ${fillTemplate(p.ranking_compare, { prior_window: prior, prior: dates(priorFrom, priorTo) }).text}`, hasPrior };
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
