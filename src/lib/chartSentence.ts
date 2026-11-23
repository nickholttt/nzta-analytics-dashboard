// The one sentence under every chart (CLAUDE.md invariant 8; work order 3, lane A, item 2). Each function takes the figures a chart
// draws and works out one fact in generic terms (a month's figure and its change on a year earlier, the part that is largest, the
// line that has the most), then fills a phrase template from config/narrative/chart_sentences.json. Pure: no React, no config reads
// and no domain word, so tests/site/ runs it with Node's own test runner. The charts hand it the figures from the same code that
// draws and tabulates them, and the formatters the table uses, so a figure in the sentence is the figure in the table.
//
// Three rules hold in every function here:
//   - a sentence that cannot be filled, or that rests on a figure the chart withholds, is dropped, never softened;
//   - a comparison whose earlier period is missing, too small, not comparable or spans a change in how the data is recorded is
//     left out of the sentence, which keeps its first clause (the *_alone templates), never guessed at;
//   - the same figures on the same snapshot give the same sentence.
import { addMonths, changeOnYear, count, fillTemplate, monthLabel, sayList } from "./sentences";
import type { NoteContext, YearChange } from "./sentences";

// The templates of config/narrative/chart_sentences.json by key.
export type SentenceTemplates = Record<string, string>;

// A template filled, or nothing where it is missing or cannot be filled.
function said(template: string | undefined, context: NoteContext): string | undefined {
  if (template === undefined) return undefined;
  const filled = fillTemplate(template, context);
  return filled.unresolved.length === 0 ? filled.text : undefined;
}

// The text of a comparison's template, then the sentence without the comparison where it cannot be said.
const withComparison = (t: SentenceTemplates, key: string, context: NoteContext, alone: NoteContext): string | undefined =>
  said(t[`${key}_${(context as { direction?: string }).direction}`], context) ?? said(t[`${key}_alone`], alone);

// A reserved value (not recorded, no reference match, beyond the cap) is no competitor for first place, as in a ranking.
export const isReservedValue = (value: string): boolean => value.startsWith("__") && value.endsWith("__");

export type Direction = "up" | "down" | "same";

// ---- A count in a month, and the line that has the most ----

export type CountFact = { month: string; n: number; prior?: YearChange };

// What a count series says for a month: its figure, and its change on the same month a year earlier where that month has a figure at or above
// the floor and the two months can be compared. `at` reads the series (the running total for a rolling one), undefined for a gap.
export function countFact(at: (month: string) => number | undefined, month: string, o: { floor: number; comparable: boolean }): CountFact | undefined {
  const n = at(month);
  if (n === undefined) return undefined;
  const prior = o.comparable ? changeOnYear(n, at(addMonths(month, -12)), o.floor) : undefined;
  return prior ? { month, n, prior } : { month, n };
}

// What a dataset counts, in its own words, and the months a figure covers, in the reader's.
export type CountWords = {
  // "21,091 vehicles first registered in Oct 2026": the figure said in the dataset's words (countedText) for the month.
  counted: (n: number, month: string) => string;
  // The months a figure covers, as the phrase that follows a figure: "in Oct 2026", "in the 12 months to Oct 2026".
  window: (month: string) => string;
};

const comparison = (f: CountFact, say: CountWords) =>
  f.prior
    ? { direction: f.prior.direction, change: Math.abs(f.prior.change), prior_count: count(f.prior.prior), prior: say.window(addMonths(f.month, -12)) }
    : undefined;

export function countSentence(t: SentenceTemplates, f: CountFact | undefined, say: CountWords): string | undefined {
  if (!f) return undefined;
  const alone = { counted: say.counted(f.n, f.month) };
  const more = comparison(f, say);
  return more ? withComparison(t, "count", { ...alone, ...more }, alone) : said(t.count_alone, alone);
}

export type ValueLine = { name: string; at: (month: string) => number | undefined };

// Which line has the most in a month, with its change on a year earlier. Lines level at the top are all named, and without a comparison.
// A month in which any line has no figure is a gap for the whole chart (a month the source does not record), so nothing is said.
export function valuesSentence(t: SentenceTemplates, lines: readonly ValueLine[], month: string, o: { floor: number; comparable: boolean }, say: CountWords): string | undefined {
  const facts = lines.map((line) => ({ name: line.name, fact: countFact(line.at, month, o) }));
  if (facts.length === 0 || facts.some((f) => !f.fact)) return undefined;
  const top = Math.max(...facts.map((f) => (f.fact as CountFact).n));
  if (!(top > 0)) return undefined;
  const leaders = facts.filter((f) => (f.fact as CountFact).n === top);
  const counted = say.counted(top, month);
  if (leaders.length > 1) return said(t.values_tied, { names: sayList(leaders.map((l) => l.name)), counted });
  const [{ name, fact }] = leaders;
  const alone = { name, counted };
  const more = comparison(fact as CountFact, say);
  return more ? withComparison(t, "values", { ...alone, ...more }, alone) : said(t.values_alone, alone);
}

// ---- A share or ratio in a month (a line of one measure) ----

// How a figure is written in the chart's table: a share as a percentage, a change in a share in points. The sentence uses the table's own functions.
export type ShareFormats = { share: (x: number) => string; points: (delta: number) => string };

// A change in points as the formatter writes it ("+1.2 pp"): its direction from the sign, its size without it. The sign is the formatter's, so
// a change too small to print as a change reads as none.
export function splitChange(text: string): { direction: Direction; size: string } | undefined {
  const sign = text.charAt(0);
  const direction = sign === "+" ? "up" : sign === "−" || sign === "-" ? "down" : sign === "±" ? "same" : undefined;
  return direction ? { direction, size: text.slice(1) } : undefined;
}

export type ShareFact = { month: string; value: number; prior?: { value: number; delta: number } };

// at: the line's figure for a month, undefined where the chart greys it or has none. The month's own figure is what the sentence rests on: where it is
// greyed there is no sentence, and where only the earlier month is, the comparison is left out.
export function shareFact(at: (month: string) => number | undefined, month: string, comparable: boolean): ShareFact | undefined {
  const value = at(month);
  if (value === undefined) return undefined;
  const earlier = comparable ? at(addMonths(month, -12)) : undefined;
  return earlier === undefined ? { month, value } : { month, value, prior: { value: earlier, delta: value - earlier } };
}

const sentenceCase = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export function shareSentence(t: SentenceTemplates, f: ShareFact | undefined, label: string, fmt: ShareFormats): string | undefined {
  if (!f) return undefined;
  const alone = { label: sentenceCase(label), share: fmt.share(f.value), month: monthLabel(f.month) };
  const change = f.prior ? splitChange(fmt.points(f.prior.delta)) : undefined;
  if (!f.prior || !change) return said(t.ratio_alone, alone);
  const more = { ...alone, direction: change.direction, points: change.size, prior_share: fmt.share(f.prior.value), prior_month: monthLabel(addMonths(f.month, -12)) };
  return withComparison(t, "ratio", more, alone);
}

// ---- The largest of several shares over a window (shares over time) ----

// One value of a breakdown: its share over the window and, where the chart's table gives one, how that share moved on the window before.
// skip: a value that is no competitor for first place (the line that holds the rest, a reserved value).
export type Part = { name: string; share?: number; delta?: number; skip?: boolean };

export function mixSentence(t: SentenceTemplates, parts: readonly Part[], o: { recent: string; months: number }, fmt: ShareFormats): string | undefined {
  const named = parts.filter((p) => !p.skip);
  // A value whose share the chart withholds could be the largest: nothing is said of who is.
  if (named.length === 0 || named.some((p) => p.share === undefined)) return undefined;
  const top = Math.max(...named.map((p) => p.share as number));
  if (!(top > 0)) return undefined;
  const leaders = named.filter((p) => p.share === top);
  const context = { recent: o.recent, months: o.months, share: fmt.share(top) };
  if (leaders.length > 1) return said(t.mix_tied, { ...context, names: sayList(leaders.map((l) => l.name)) });
  const [leader] = leaders;
  const alone = { ...context, name: leader.name };
  const change = leader.delta === undefined ? undefined : splitChange(fmt.points(leader.delta));
  return change ? withComparison(t, "mix", { ...alone, direction: change.direction, points: change.size }, alone) : said(t.mix_alone, alone);
}

// ---- The largest part of one window (bands, places) ----

// One part of a breakdown over a window. share: undefined where the chart withholds it (too few vehicles behind it).
export type Group = { name: string; n: number; share?: number; skip?: boolean };

export type GroupWords = {
  // The breakdown's name as it reads after "By": "engine size".
  field: string;
  // The window as the phrase that follows "counted": "in Oct 2026", "from Nov 2025 to Oct 2026".
  period: string;
  // A count said in the dataset's words, for the window.
  counted: (n: number) => string;
};

export function groupsSentence(t: SentenceTemplates, groups: readonly Group[], basis: "share" | "count", words: GroupWords, fmt: Pick<ShareFormats, "share">): string | undefined {
  const named = groups.filter((g) => !g.skip);
  if (named.length === 0) return undefined;
  // Shares the chart withholds are not stated, and neither is who leads by them.
  if (basis === "share" && named.some((g) => g.share === undefined)) return undefined;
  const top = Math.max(...named.map((g) => g.n));
  if (!(top > 0)) return undefined;
  const leaders = named.filter((g) => g.n === top);
  const context = { field: words.field, period: words.period, counted: words.counted(top), share: basis === "share" ? fmt.share(leaders[0].share as number) : undefined };
  if (leaders.length > 1) return said(t[`parts_${basis}_tied`], { ...context, names: sayList(leaders.map((l) => l.name)) });
  return said(t[`parts_${basis}`], { ...context, name: leaders[0].name });
}

// A sentence of a chart that counts only the vehicles its conditions keep, saying so at its end: the figures are not those of every vehicle.
export function narrowedSentence(t: SentenceTemplates, sentence: string): string | undefined {
  return said(t.narrowed, { sentence: sentence.replace(/\.$/, "") });
}

// The months a chart covers as the phrase that follows a figure or "counted": one month is "in Oct 2026", a span "from Nov 2025 to Oct 2026".
export function periodPhrase(t: SentenceTemplates, from: string, to: string): string | undefined {
  return from === to ? said(t.period_month, { month: monthLabel(from) }) : said(t.period_span, { from: monthLabel(from), to: monthLabel(to) });
}
