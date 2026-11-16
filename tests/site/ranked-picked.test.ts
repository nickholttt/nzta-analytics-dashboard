// A ranking of the values a visitor chose (D-111): where the rule table offers it, how the question carries it in the address, what the
// page says about it, and that it is the same ranking as the full one (leagueRows) over fewer values. Through the real modules; no
// field or value is named, they come from config or are made up.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { everythingBuilt } from "./support/observe.ts";

const { builderVocabulary, builderPresets, questionParams, readQuestion, settle, viewsFor, RANKING } = await import("../../src/lib/builder.ts");
const { shapesFor } = await import("../../src/lib/shapes.ts");
const { fitsPin, inferShape, resolvePreset, rankingPeriods } = await import("../../src/lib/resolve.ts");
const { leagueRows, pickedSummary, rankingGuard } = await import("../../src/lib/league.ts");
const { pickedRankingSentences, rankingText, rankingWindows, rankingWords, sayList } = await import("../../src/lib/sentences.ts");
const { builderSpec, dimensions, phrases, findDimension, findMeasure } = await import("../../src/lib/config.ts");

const manifest = everythingBuilt();
const vocabulary = builderVocabulary(manifest);
const dataset = vocabulary.datasets[0].dataset;
const long = dimensions.find((d) => d.kind === "category" && d.cardinality === "high")?.id as string;
const short = dimensions.find((d) => d.kind === "category" && d.cardinality === "low")?.id as string;
const asked = (by: string, values: string[], measure = "share", extra: object = {}) => ({ dataset, measure, by, values, where: {}, view: null, ...extra });
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("the rule table ranks two or more chosen values over one window, where it ranks every value, and not otherwise", () => {
  const base = { by: "category", values: "many", span: "one_period" };
  for (const measure of ["count", "share"]) {
    assert.equal(shapesFor({ measure, ...base, picked: "none" })[0], "league", `${measure}, none chosen: the full ranking, as before`);
    assert.equal(shapesFor({ measure, ...base, picked: "several" })[0], "league", `${measure}, several chosen`);
    assert.notEqual(shapesFor({ measure, ...base, picked: "one" })[0], "league", `${measure}, one chosen has nothing to rank`);
    assert.notEqual(shapesFor({ measure, ...base, values: "few", picked: "several" })[0], "league", `${measure}: a short list is not ranked, picked or not`);
    assert.notEqual(shapesFor({ measure, ...base, span: "over_time", picked: "several" })[0], "league", `${measure}: over time is lines`);
  }
  assert.deepEqual(shapesFor({ measure: "count", ...base, picked: "several" }), ["league", "trend"]);
  assert.deepEqual(shapesFor({ measure: "share", ...base, picked: "several" }), ["league", "mix"]);
  assert.deepEqual(shapesFor({ measure: "average", ...base, picked: "several" }), ["trend"], "an average is not ranked here");
});

test("the question offers the ranking as a view only with two or more values chosen on a long list, after the shape it opens on", () => {
  assert.ok(long && short, "config has a long and a short list");
  assert.deepEqual(viewsFor(settle(vocabulary, asked(long, []))), [], "none chosen: nothing changes");
  assert.deepEqual(viewsFor(settle(vocabulary, asked(long, ["a"]))), []);
  assert.deepEqual(viewsFor(settle(vocabulary, asked(long, ["a", "b"]))), ["mix", RANKING]);
  assert.deepEqual(viewsFor(settle(vocabulary, asked(long, ["a", "b"], "count"))), ["trend", RANKING]);
  assert.deepEqual(viewsFor(settle(vocabulary, asked(short, ["a", "b"]))), [], "a short list is not ranked");
  assert.equal(RANKING, "league");
});

test("the ranking view opens on the window a ranking opens on, draws as a league, and the time row offers only windows it fits", () => {
  const q = settle(vocabulary, asked(long, ["a", "b"], "count", { view: RANKING }));
  assert.equal(q.view, RANKING);
  const [preset] = builderPresets(q);
  assert.equal(preset.shape_override, RANKING);
  assert.equal(preset.period, builderSpec.period_by_shape[RANKING]);
  assert.deepEqual(preset.values, ["a", "b"]);
  const resolution = resolvePreset(preset, manifest);
  assert.deepEqual(resolution.preventsRender, []);
  assert.equal(resolution.shape, RANKING);
  assert.equal(fitsPin(preset, "10y"), false, "a span of years is not one window");
  assert.equal(fitsPin(preset, "all"), false);
  assert.equal(fitsPin(preset, preset.period as string), true);
  assert.ok(["latest_month", "latest_year"].every((id) => fitsPin(preset, id)));
  // The lines view of the same question is untouched.
  const [lines] = builderPresets({ ...q, view: null });
  assert.equal(lines.period, builderSpec.period_when_comparing);
  assert.equal(inferShape(lines, findDimension(long), findMeasure("count")), "trend");
});

test("a measure of two parts is one ranking, which holds the share and the number together", () => {
  const q = settle(vocabulary, asked(long, ["a", "b"], "share_and_count", { view: RANKING }));
  assert.equal(builderPresets(q).length, 1);
  assert.equal(builderPresets({ ...q, view: null }).length, 2);
});

test("ranking every value sets the choice aside in the chart and the title, and keeps it in the question and the address", () => {
  const picked = settle(vocabulary, asked(long, ["a", "b"], "count", { view: RANKING }));
  const all = settle(vocabulary, asked(long, ["a", "b"], "count", { view: RANKING, rankAll: true }));
  assert.equal(all.rankAll, true);
  assert.deepEqual(all.values, ["a", "b"], "the picks are kept to go back to");
  const [one] = builderPresets(picked);
  const [every] = builderPresets(all);
  assert.equal(every.values, undefined, "no values: every value is ranked");
  assert.match(one.question, /: a, b$/);
  assert.doesNotMatch(every.question, /: a, b/);
  assert.equal(every.shape_override, RANKING);
  assert.equal(resolvePreset(every, manifest).shape, RANKING);
  assert.ok(rankingPeriods(every).length > 0 && every.ranking_period, "the full ranking offers the windows the ranking of every value does");
  // Both states are addresses, and they read back as themselves.
  for (const q of [picked, all]) {
    const back = settle(vocabulary, readQuestion(`?${questionParams(q)}`));
    assert.equal(String(questionParams(back)), String(questionParams(q)));
    assert.equal(Boolean(back.rankAll), Boolean(q.rankAll));
  }
  assert.equal(questionParams(all).get("build.rank"), "all");
  assert.equal(questionParams(picked).get("build.rank"), null);
  assert.notEqual(String(questionParams(picked)), String(questionParams(all)));
});

test("the way back restores the picks, and a question that leaves the ranking view, or has fewer than two values, leaves the full ranking", () => {
  const all = settle(vocabulary, asked(long, ["a", "b"], "count", { view: RANKING, rankAll: true }));
  const back = settle(vocabulary, { ...all, rankAll: false });
  assert.deepEqual([back.view, back.values, Boolean(back.rankAll)], [RANKING, ["a", "b"], false]);
  assert.equal(settle(vocabulary, { ...all, view: null }).rankAll, undefined);
  const one = settle(vocabulary, { ...all, values: ["a"] });
  assert.deepEqual([one.view, one.rankAll], [null, undefined]);
  // A link that asks for the full ranking with no ranking view is not read as one.
  assert.equal(settle(vocabulary, readQuestion(`?build.measure=count&build.by=${long}&build.value=a&build.value=b&build.rank=all`)).rankAll, undefined);
});

const WINDOW = "in the last 12 months";
const facts = (over: object = {}) => ({ picked: 3, field: "brand", window: WINDOW, leaders: ["A"], leaderCount: 120, unranked: [] as string[], total: 4000, conditions: false, ...over });

test("the sentences say how the ranking is labelled, who leads, who has no place and what a share is a share of", () => {
  const s = pickedRankingSentences(phrases, facts());
  assert.equal(s.label, "Ranked among the 3 you picked: each rank is a place among those 3, not among every brand.");
  assert.equal(s.leader, "A has the most of the 3 you picked, with 120 vehicles in the last 12 months.");
  assert.equal(s.share, "Each share is of all 4,000 vehicles counted in the last 12 months, not of the 3 you picked, so those shares do not add up to the whole.");
  assert.equal(s.unranked, undefined);
  assert.equal(s.shareHead, "Share of all counted");
  assert.equal(s.rankHead, "Rank of 3");
  assert.equal(s.priorHead, "Rank of 3 a year before");
  assert.match(pickedRankingSentences(phrases, facts({ conditions: true })).share as string, /^Each share is of all 4,000 vehicles that meet the conditions in the last 12 months, /);
  assert.equal(pickedRankingSentences(phrases, facts({ leaders: ["A", "B"] })).leader, "A and B are level at the top of the 3 you picked, with 120 vehicles each in the last 12 months.");
  assert.equal(pickedRankingSentences(phrases, facts({ leaders: ["A", "B", "C"] })).leader, "A, B and C are level at the top of the 3 you picked, with 120 vehicles each in the last 12 months.");
  assert.equal(pickedRankingSentences(phrases, facts({ unranked: ["C", "D"] })).unranked, "Not ranked: C and D. A value takes a place when it has vehicles in the last 12 months and names a recorded value.");
  const none = pickedRankingSentences(phrases, facts({ leaders: [], leaderCount: 0, total: 0 }));
  assert.equal(none.leader, "No vehicles were counted in the last 12 months for any of the 3 you picked, so there is nothing to rank.");
  assert.equal(none.share, undefined, "with nothing counted there is no share to describe");
  assert.equal(sayList(["x"]), "x");
  assert.equal(sayList([]), "");
});

// A ranking of chosen values over one window: A and B tie at the top, C has none, and the window's total is far more than the chosen
// values together, since each share is of everything counted.
const rows = (month: string, total: number, counts: Record<string, number>) => Object.entries(counts).map(([value, n]) => ({ month, value, n, denominator: total }));

test("the ranking of chosen values is the full ranking's own rule over fewer values: shared ranks, shares of everything, the year before", () => {
  const { currentFrom, priorFrom, priorTo } = rankingWindows("2026-10", 1);
  const picked = ["A", "B", "C", "__UNDEFINED__"];
  const all = [...rows("2026-10", 1000, { A: 50, B: 50, C: 0, __UNDEFINED__: 9 }), ...rows("2025-10", 800, { A: 10, B: 40, C: 0, __UNDEFINED__: 0 })];
  const text = rankingText(phrases, { basis: "Ranked {window}", span: 1, end: "2026-10", latest: "2026-10", covers: { first: "2021-01", last: "2026-10" } });
  const { items, currentDenom } = leagueRows({ rows: all, currentFrom, end: "2026-10", priorFrom, priorTo, hasPrior: text.hasPrior, topN: picked.length, nameOf: (v) => v, yearFloor: 5 });
  assert.deepEqual(items.map((i) => [i.name, i.rank, i.priorRank]), [["A", 1, 2], ["B", 1, 1]]);
  assert.equal(currentDenom, 1000);
  assert.deepEqual(items.map((i) => i.share), [0.05, 0.05], "a share of everything counted, so the two together are 10%, not 100%");
  const summary = pickedSummary(picked, items, (v) => (v === "__UNDEFINED__" ? "Not recorded" : v));
  assert.deepEqual(summary, { leaders: ["A", "B"], leaderCount: 50, unranked: ["C", "Not recorded"] });
  const guard = (floor: number) => rankingGuard({ floor, currentDenom, priorDenom: 800, hasPrior: true, window: WINDOW, priorDates: "Oct 2025", single: true, phrases });
  assert.equal(guard(200).shares, false);
  // Over a base under the floor the ranking greys, as the full ranking does.
  assert.equal(guard(5000).shares, true);
  assert.match(guard(5000).sentence as string, /so its shares and changes in share are greyed\.$/);
  assert.equal(rankingWords(phrases, { span: 12, end: "2026-10", latest: "2026-10" }).window, WINDOW);
});

test("the chart and the builder say the labels from config, and the builder offers the step to the full ranking and the way back", () => {
  const league = read("src/components/LeagueChart.tsx");
  assert.match(league, /pickedRankingSentences\(phrases/);
  for (const part of ["about.leader", "about.label", "about.share", "about.shareHead", "about.rankHead", "about.priorHead"]) assert.ok(league.includes(part), part);
  const builder = read("src/components/QuestionBuilder.tsx");
  assert.ok(builder.includes("Rank every {filterLabel(breakdown.id).toLowerCase()} instead"));
  assert.ok(builder.includes("Rank only the {question.values.length} you picked"));
});
