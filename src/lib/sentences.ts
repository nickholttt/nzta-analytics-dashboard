// The sentences about the data, built from phrase templates in config and facts the caller supplies. Pure: no React, no
// config reads, no data loading, and no imports, so tests/site/ runs it with Node's own test runner (docs/playbooks/run-checks.md).
// A template names no domain value, figure or cause (CLAUDE.md invariant 8); the words are in config/presets.json
// (defaults.phrases, preset.answer) and config/dimensions.json (a dataset's words).

// ---- Months ----

export function addMonths(key: string, k: number): string {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

// A month as a reader says it: "Aug 2026", not "2026-08".
const MONTH_FORMAT = new Intl.DateTimeFormat("en-NZ", { month: "short", year: "numeric", timeZone: "UTC" });
export const monthLabel = (key: string) => MONTH_FORMAT.format(new Date(`${key}-01T00:00:00Z`));

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

// The change on the same month a year earlier. countFor reads every month the dataset has, not only the months a chart
// draws, so the window a visitor chooses never changes the answer. Undefined where that month is missing, or its count is
// under the measure's floor.
export function yearChange(countFor: (month: string) => number | undefined, month: string, floor: number): YearChange | undefined {
  const now = countFor(month);
  const prior = countFor(addMonths(month, -12));
  if (now === undefined || prior === undefined || prior <= 0 || prior < floor) return undefined;
  const change = (now - prior) / prior;
  return { prior, change, direction: Math.abs(change) < SAME_BELOW ? "same" : change > 0 ? "up" : "down" };
}

export const count = (n: number) => Math.round(n).toLocaleString("en-NZ");

const yearContext = (month: string, c: YearChange) => ({
  prior_month: monthLabel(addMonths(month, -12)),
  prior_count: count(c.prior),
  change: Math.abs(c.change),
});

export type YearPhrases = { up: string; down: string; same: string };

// What a point says about the year before it, for a hover.
export function sayYearChange(phrases: YearPhrases, month: string, c: YearChange): string {
  return fillTemplate(phrases[c.direction], yearContext(month, c)).text;
}

export type AnswerTemplates = { up: string; down: string; same: string; alone: string };

// The figure and the sentence for a month. alone is for a month with no usable year-ago figure, and for a template that cannot
// be filled, which is dropped for it rather than shown with gaps.
export function sayAnswer(
  templates: AnswerTemplates,
  countFor: (month: string) => number | undefined,
  month: string,
  floor: number,
): { figure: string; sentence: string } | undefined {
  const now = countFor(month);
  if (now === undefined) return undefined;
  const c = yearChange(countFor, month, floor);
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
  currentFrom: string;
  priorFrom: string;
  priorTo: string;
  hasPrior: boolean;
};

const dates = (from: string, to: string) => (from === to ? monthLabel(from) : `${monthLabel(from)} to ${monthLabel(to)}`);

// What a ranking covers, and what it is compared with. The comparison is only described when there is one: a ranking with
// no figures a year earlier says so instead.
export function sayRanking(p: RankingPhrases, f: RankingFacts): string {
  const span = { span: f.span, end: monthLabel(f.end) };
  const window = fillTemplate(f.span === 1 ? p.window_month : f.end === f.latest ? p.window_last : p.window_to, span).text;
  const parts = [fillTemplate(f.basis, { window }).text];
  if (f.span > 1) parts.push(fillTemplate(p.ranking_dates, { current: dates(f.currentFrom, f.end) }).text);
  const opening = `${parts.join(" ")}.`;
  if (!f.hasPrior) return `${opening} ${p.ranking_no_prior}`;
  const prior = fillTemplate(f.span === 1 ? p.prior_month : p.prior_months, span).text;
  return `${opening} ${fillTemplate(p.ranking_compare, { prior_window: prior, prior: dates(f.priorFrom, f.priorTo) }).text}`;
}

// ---- A month the address names ----

// A sentence for an address that names a month the chart cannot show; undefined when the month is fine or none was named.
export function sayBadMonth(template: string, asked: string | undefined, shown: string): string | undefined {
  if (!asked || asked === shown) return undefined;
  return fillTemplate(template, { asked, shown: monthLabel(shown) }).text;
}
