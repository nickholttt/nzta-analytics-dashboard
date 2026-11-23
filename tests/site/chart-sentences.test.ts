// The one sentence under every chart (src/lib/chartSentence.ts; work order 3, lane A, item 2), run with Node's own test runner:
//   node --test "tests/site/*.test.ts"
// For each shape and measure: the fact worked out from a small fixture, the sentence the real templates give, a sentence that rests on a withheld
// figure being dropped, a missing or too small earlier month dropping the comparison, and a change in how the data is recorded doing the same
// (invariant 7). The figures in a sentence are written by the functions the charts' tables use.
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const json = (path: string) => JSON.parse(read(path));
const sentences = await import("../../src/lib/chartSentence.ts");
const { chartSentences: t } = await import("../../src/lib/chartWords.ts");
const { count, countedText, monthLabel, percent } = await import("../../src/lib/sentences.ts");
const { pct, shareChange } = await import("../../src/lib/measures.ts");
const { recordingChange } = await import("../../src/lib/recordingChange.ts");
const phrases = json("config/presets.json").defaults.phrases;
const datasets = json("config/dimensions.json").datasets;
const wordsOf = (id: string) => datasets.find((d: { id: string }) => d.id === id).words;

const FLOOR = 50;
const fmt = { share: pct, points: shareChange };

// The dataset's own words for a month, as TrendChart gives them.
const say = (dataset: string, rolling = false) => {
  const window = (m: string) => {
    return (rolling ? phrases.window_to : phrases.window_month).replace("{span}", "12").replace("{end}", monthLabel(m));
  };
  return { counted: (n: number, m: string) => countedText(wordsOf(dataset).leader_count, n, window(m)), window };
};

// A series with every month from 2024-01 to 2026-10: 1,000 a month, then the months set below.
const series = (set: Record<string, number> = {}) => (m: string) => (m >= "2024-01" && m <= "2026-10" ? (set[m] ?? 1000) : undefined);

test("a count in a month: its figure and its change on the same month a year earlier, in the dataset's own words", () => {
  const up = sentences.countSentence(t, sentences.countFact(series({ "2026-10": 1120 }), "2026-10", { floor: FLOOR, comparable: true }), say("registrations_flow"));
  assert.equal(up, "1,120 vehicles first registered in Oct 2026, up 12% on the 1,000 in Oct 2025.");
  const down = sentences.countSentence(t, sentences.countFact(series({ "2026-10": 950 }), "2026-10", { floor: FLOOR, comparable: true }), say("registrations_flow"));
  assert.equal(down, "950 vehicles first registered in Oct 2026, down 5.0% on the 1,000 in Oct 2025.");
  const same = sentences.countSentence(t, sentences.countFact(series(), "2026-10", { floor: FLOOR, comparable: true }), say("registrations_flow"));
  assert.equal(same, "1,000 vehicles first registered in Oct 2026, the same as the 1,000 in Oct 2025.");
});

test("a count's figures are the ones the chart's table writes: the whole number with its separator, the change by the one rule", () => {
  const fact = sentences.countFact(series({ "2026-10": 21091, "2025-10": 18800 }), "2026-10", { floor: FLOOR, comparable: true });
  assert.equal(fact?.n, 21091);
  const text = sentences.countSentence(t, fact, say("registrations_flow")) as string;
  assert.ok(text.includes(count(21091)) && text.includes(count(18800)) && text.includes(percent((21091 - 18800) / 18800)), text);
});

test("a missing year-ago month, one under the floor, or one that cannot be compared drops the comparison and keeps the figure", () => {
  const alone = "1,000 vehicles first registered in Oct 2026.";
  // The year-ago month is not in the dataset: the series starts later.
  const late = (m: string) => (m >= "2026-01" && m <= "2026-10" ? 1000 : undefined);
  assert.equal(sentences.countSentence(t, sentences.countFact(late, "2026-10", { floor: FLOOR, comparable: true }), say("registrations_flow")), alone);
  // It is there but holds fewer vehicles than the floor, as the table of the change on a year ago withholds it.
  assert.equal(sentences.countSentence(t, sentences.countFact(series({ "2025-10": 10 }), "2026-10", { floor: FLOOR, comparable: true }), say("registrations_flow")), alone);
  // Nothing in it at all.
  assert.equal(sentences.countSentence(t, sentences.countFact(series({ "2025-10": 0 }), "2026-10", { floor: FLOOR, comparable: true }), say("registrations_flow")), alone);
  // The dataset does not give a change on a year ago, or a change in the recording lies between the months (the caller says so).
  assert.equal(sentences.countSentence(t, sentences.countFact(series({ "2026-10": 1500 }), "2026-10", { floor: FLOOR, comparable: false }), say("registrations_flow")), "1,500 vehicles first registered in Oct 2026.");
});

test("a month with no figure has no sentence", () => {
  assert.equal(sentences.countSentence(t, sentences.countFact(series(), "2026-11", { floor: FLOOR, comparable: true }), say("registrations_flow")), undefined);
});

test("a running total says its twelve months, and the twelve a year earlier", () => {
  const at = (m: string) => (m >= "2025-01" && m <= "2026-10" ? 12000 : undefined);
  const fact = sentences.countFact(at, "2026-10", { floor: FLOOR, comparable: true });
  assert.equal(sentences.countSentence(t, fact, say("registrations_flow", true)), "12,000 vehicles first registered in the 12 months to Oct 2026, the same as the 12,000 in the 12 months to Oct 2025.");
});

test("each dataset says what it counts in its own words, a bare figure for one that names its own unit", () => {
  assert.equal(sentences.countSentence(t, { month: "2026-10", n: 3513 }, say("registrations_surviving")), "3,513 vehicles first registered in Oct 2026 that are still registered.");
  assert.equal(sentences.countSentence(t, { month: "2026-09", n: 4200 }, say("registrations_cars_long_run")), `4,200 cars registered for the first time in ${monthLabel("2026-09")}.`);
  assert.equal(sentences.countSentence(t, { month: "2026-10", n: 1 }, say("registrations_flow_wider")), "1 vehicle first registered in Oct 2026, on the wider scope.");
});

const lines = (a: Record<string, number>, b: Record<string, number>) => [
  { name: "Line A", at: series(a) },
  { name: "Line B", at: series(b) },
];

test("the line with the most, and its change on a year earlier", () => {
  const text = sentences.valuesSentence(t, lines({ "2026-10": 1300 }, { "2026-10": 900 }), "2026-10", { floor: FLOOR, comparable: true }, say("registrations_flow"));
  assert.equal(text, "Line A has the most: 1,300 vehicles first registered in Oct 2026, up 30% on the 1,000 in Oct 2025.");
  assert.equal(
    sentences.valuesSentence(t, lines({ "2026-10": 1300, "2025-10": 5 }, {}), "2026-10", { floor: FLOOR, comparable: true }, say("registrations_flow")),
    "Line A has the most: 1,300 vehicles first registered in Oct 2026.",
  );
});

test("lines level at the top are all named and no comparison is made between them", () => {
  assert.equal(
    sentences.valuesSentence(t, lines({}, {}), "2026-10", { floor: FLOOR, comparable: true }, say("registrations_flow")),
    "Line A and Line B are level at the top: each has 1,000 vehicles first registered in Oct 2026.",
  );
});

test("a month in which a line has no figure leaves the whole chart without a sentence, and so does a chart of nothing", () => {
  const gap = [{ name: "Line A", at: series() }, { name: "Line B", at: (m: string) => (m === "2026-10" ? undefined : 5) }];
  assert.equal(sentences.valuesSentence(t, gap, "2026-10", { floor: FLOOR, comparable: true }, say("registrations_flow")), undefined);
  assert.equal(sentences.valuesSentence(t, [], "2026-10", { floor: FLOOR, comparable: true }, say("registrations_flow")), undefined);
  assert.equal(sentences.valuesSentence(t, lines({ "2026-10": 0 }, { "2026-10": 0 }), "2026-10", { floor: FLOOR, comparable: true }, say("registrations_flow")), undefined);
});

const ratio = (set: Record<string, number | undefined>) => (m: string) => (m in set ? set[m] : m >= "2024-01" && m <= "2026-10" ? 0.4 : undefined);

test("a share or ratio in a month: its figure and its change in points on a year earlier, as the table writes them", () => {
  const label = "the combined share of the largest few";
  const up = sentences.shareSentence(t, sentences.shareFact(ratio({ "2026-10": 0.412 }), "2026-10", true), label, fmt);
  assert.equal(up, `The combined share of the largest few was ${pct(0.412)} in Oct 2026, up ${shareChange(0.012).slice(1)} from ${pct(0.4)} in Oct 2025.`);
  assert.equal(up, "The combined share of the largest few was 41.2% in Oct 2026, up 1.2 pp from 40.0% in Oct 2025.");
  assert.equal(sentences.shareSentence(t, sentences.shareFact(ratio({ "2026-10": 0.38 }), "2026-10", true), label, fmt), "The combined share of the largest few was 38.0% in Oct 2026, down 2.0 pp from 40.0% in Oct 2025.");
  assert.equal(sentences.shareSentence(t, sentences.shareFact(ratio({ "2026-10": 0.40001 }), "2026-10", true), label, fmt), "The combined share of the largest few was 40.0% in Oct 2026, level with 40.0% in Oct 2025.");
});

test("a share the chart greys has no sentence, and an earlier month it greys, lacks or cannot compare leaves the comparison out", () => {
  const label = "the combined share of the largest few";
  assert.equal(sentences.shareSentence(t, sentences.shareFact(ratio({ "2026-10": undefined }), "2026-10", true), label, fmt), undefined);
  const alone = "The combined share of the largest few was 40.0% in Oct 2026.";
  assert.equal(sentences.shareSentence(t, sentences.shareFact(ratio({ "2025-10": undefined }), "2026-10", true), label, fmt), alone);
  assert.equal(sentences.shareSentence(t, sentences.shareFact(ratio({}), "2026-10", false), label, fmt), alone);
  assert.equal(sentences.shareSentence(t, sentences.shareFact((m) => (m === "2026-10" ? 0.4 : undefined), "2026-10", true), label, fmt), alone);
});

test("a change in points is read from the formatter's own sign, so a change the table prints as none reads as none", () => {
  assert.deepEqual(sentences.splitChange("+1.2 pp"), { direction: "up", size: "1.2 pp" });
  assert.deepEqual(sentences.splitChange("−0.4 pp"), { direction: "down", size: "0.4 pp" });
  assert.deepEqual(sentences.splitChange(shareChange(0.00001)), { direction: "same", size: "0.0 pp" });
  assert.equal(sentences.splitChange("n/a"), undefined);
});

const options = { recent: "first registered in the last 12 months", months: 12 };

test("shares over time: the largest, with its figure and change as the key table gives them", () => {
  const parts = [
    { name: "Value A", share: 0.171, delta: 0.0082 },
    { name: "Value B", share: 0.15, delta: -0.02 },
    { name: "All other", share: 0.4, delta: 0.1, skip: true },
    { name: "Not recorded", share: 0.2, delta: 0.1, skip: true },
  ];
  assert.equal(sentences.mixSentence(t, parts, options, fmt), "Value A has the largest share of vehicles first registered in the last 12 months: 17.1%, up 0.8 pp on the 12 months before.");
  assert.equal(sentences.mixSentence(t, [{ name: "Value A", share: 0.3, delta: -0.1 }], options, fmt), "Value A has the largest share of vehicles first registered in the last 12 months: 30.0%, down 10.0 pp on the 12 months before.");
});

test("shares over time: no change in the table, or none to state, gives the figure alone; a share withheld gives nothing", () => {
  assert.equal(sentences.mixSentence(t, [{ name: "Value A", share: 0.171 }, { name: "Value B", share: 0.1 }], options, fmt), "Value A has the largest share of vehicles first registered in the last 12 months: 17.1%.");
  // A value whose share the table withholds could be the largest: nobody is named.
  assert.equal(sentences.mixSentence(t, [{ name: "Value A", share: 0.171 }, { name: "Value B" }], options, fmt), undefined);
  // A value that only stands for the rest, or for vehicles with no value, is no competitor, withheld or not.
  assert.equal(sentences.mixSentence(t, [{ name: "Value A", share: 0.2 }, { name: "All other", skip: true }], options, fmt), "Value A has the largest share of vehicles first registered in the last 12 months: 20.0%.");
  assert.equal(sentences.mixSentence(t, [], options, fmt), undefined);
  assert.equal(sentences.mixSentence(t, [{ name: "Value A", share: 0 }], options, fmt), undefined);
});

test("shares over time: values with the same share are all named, with no change", () => {
  const text = sentences.mixSentence(t, [{ name: "Value A", share: 0.2, delta: 0.01 }, { name: "Value B", share: 0.2, delta: 0.02 }], options, fmt);
  assert.equal(text, "Value A and Value B are level with the largest share of vehicles first registered in the last 12 months: 20.0% each.");
});

const words = { field: "engine size", period: "from Nov 2025 to Oct 2026", counted: (n: number) => countedText(wordsOf("registrations_surviving").leader_count, n, "from Nov 2025 to Oct 2026") };

test("the largest band or place: by share where the chart gives one, by count where it counts", () => {
  const groups = [
    { name: "Band A", n: 400, share: 0.4 },
    { name: "Band B", n: 500, share: 0.5 },
    { name: "Band C", n: 100, share: 0.1 },
  ];
  assert.equal(sentences.groupsSentence(t, groups, "share", words, fmt), "By engine size, Band B is the largest group: 50.0% of the vehicles counted from Nov 2025 to Oct 2026.");
  assert.equal(sentences.groupsSentence(t, groups, "count", words, fmt), "By engine size, Band B is the largest group: 500 vehicles first registered from Nov 2025 to Oct 2026 that are still registered.");
});

test("the largest band or place: shares the chart withholds are not stated, a group that is no competitor is passed over, ties are named", () => {
  const withheld = [{ name: "Band A", n: 400 }, { name: "Band B", n: 500 }];
  assert.equal(sentences.groupsSentence(t, withheld, "share", words, fmt), undefined);
  // The count is not a share: a chart that counts and withholds nothing still says its leader.
  assert.match(sentences.groupsSentence(t, withheld, "count", words, fmt) as string, /^By engine size, Band B is the largest group: 500 vehicles/);
  const unplaced = [{ name: "Band A", n: 400, share: 0.4 }, { name: "Not recorded", n: 600, share: 0.6, skip: true }];
  assert.match(sentences.groupsSentence(t, unplaced, "share", words, fmt) as string, /Band A is the largest group: 40\.0%/);
  const tied = [{ name: "Band A", n: 500, share: 0.5 }, { name: "Band B", n: 500, share: 0.5 }];
  assert.equal(sentences.groupsSentence(t, tied, "share", words, fmt), "By engine size, Band A and Band B are level as the largest groups: 50.0% each of the vehicles counted from Nov 2025 to Oct 2026.");
  assert.equal(sentences.groupsSentence(t, [{ name: "Band A", n: 0, share: 0 }], "share", words, fmt), undefined);
  assert.equal(sentences.groupsSentence(t, [], "count", words, fmt), undefined);
});

test("the months a chart covers are said as one month or a span", () => {
  assert.equal(sentences.periodPhrase(t, "2026-10", "2026-10"), "in Oct 2026");
  assert.equal(sentences.periodPhrase(t, "2025-11", "2026-10"), "from Nov 2025 to Oct 2026");
});

test("a template that cannot be filled is dropped, not written with a gap", () => {
  assert.equal(sentences.countSentence({ count_alone: "{counted} in {nowhere}." }, { month: "2026-10", n: 5 }, say("registrations_flow")), undefined);
  assert.equal(sentences.countSentence({}, { month: "2026-10", n: 5 }, say("registrations_flow")), undefined);
  // A comparison template that cannot be filled falls back to the figure alone.
  assert.equal(
    sentences.countSentence({ count_up: "{counted}, up {gone}.", count_alone: "{counted}." }, { month: "2026-10", n: 1200, prior: { prior: 1000, change: 0.2, direction: "up" } }, say("registrations_flow")),
    "1,200 vehicles first registered in Oct 2026.",
  );
});

test("the same figures on the same snapshot give the same sentence", () => {
  const make = () => sentences.countSentence(t, sentences.countFact(series({ "2026-10": 1120 }), "2026-10", { floor: FLOOR, comparable: true }), say("registrations_flow"));
  assert.equal(make(), make());
});

test("a chart that counts only the vehicles its conditions keep says so at the end of its sentence, and never drops the sentence's own full stop", () => {
  assert.equal(sentences.narrowedSentence(t, "1,120 vehicles first registered in Oct 2026, up 12% on the 1,000 in Oct 2025."), "1,120 vehicles first registered in Oct 2026, up 12% on the 1,000 in Oct 2025, among the vehicles the chart's conditions keep.");
  assert.equal(sentences.narrowedSentence({}, "A sentence."), undefined);
});

// ---- A change in how the data is recorded between the months compared (invariant 7) ----

type Ev = Parameters<typeof recordingChange>[0] extends infer E ? (E extends readonly (infer X)[] ? X : never) : never;
const event = (o: Partial<Ev>): Ev => ({ id: "x", date_start: "2026-03-15", date_end: null, mechanism: "measurement", scope: "market", scope_values: [], title: "", summary: "", announced_date: null, source_url: "", ...o }) as Ev;

test("a change in the recording between two months is found; one outside them, a change in the market and an undated one are not", () => {
  assert.equal(recordingChange([event({})], "2025-10", "2026-10"), true);
  assert.equal(recordingChange([event({ date_start: "2025-10-01" })], "2025-10", "2026-10"), true);
  assert.equal(recordingChange([event({ date_start: "2026-10-31" })], "2025-10", "2026-10"), true);
  assert.equal(recordingChange([event({ date_start: "2025-09-30" })], "2025-10", "2026-10"), false);
  assert.equal(recordingChange([event({ date_start: "2026-11-01" })], "2025-10", "2026-10"), false);
  assert.equal(recordingChange([event({ mechanism: "demand" })], "2025-10", "2026-10"), false);
  assert.equal(recordingChange([event({ date_start: "" })], "2025-10", "2026-10"), false);
  // A window that began before and runs through the months.
  assert.equal(recordingChange([event({ date_start: "2024-01-01", date_end: "2027-01-01" })], "2025-10", "2026-10"), true);
  assert.equal(recordingChange([event({ date_start: "2024-01-01", date_end: "2025-09-30" })], "2025-10", "2026-10"), false);
});

test("until the events are loaded nothing can be said, so the comparison is not made", () => {
  assert.equal(recordingChange(null, "2025-10", "2026-10"), undefined);
});

test("an event scoped to another field's values touches a total and any other breakdown, and one scoped to the chart's own field only where its values are shown", () => {
  const scoped = event({ scope: "make", scope_values: ["VALUE X"] });
  assert.equal(recordingChange([scoped], "2025-10", "2026-10"), true);
  assert.equal(recordingChange([scoped], "2025-10", "2026-10", { dimension: "powertrain", values: new Set(["a"]) }), true);
  assert.equal(recordingChange([scoped], "2025-10", "2026-10", { dimension: "make", values: new Set(["VALUE Y"]) }), false);
  assert.equal(recordingChange([scoped], "2025-10", "2026-10", { dimension: "make", values: new Set(["VALUE X", "VALUE Y"]) }), true);
  assert.equal(recordingChange([scoped], "2025-10", "2026-10", { dimension: "make" }), true);
  // A market-wide event touches every chart.
  assert.equal(recordingChange([event({})], "2025-10", "2026-10", { dimension: "make", values: new Set(["VALUE Y"]) }), true);
});
