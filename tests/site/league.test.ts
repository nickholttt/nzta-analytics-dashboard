// The rows of a ranking (src/lib/league.ts, the function LeagueChart draws), from real counts in tests/site/fixtures/league-cases.json:
// vehicles still registered, by brand, from the build of the 2026-10 snapshot. And whether a year-before comparison exists
// (rankingText, src/lib/sentences.ts), decided by the dataset's own months and not by the months a narrowed slice has rows for.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { leagueRows } = await import("../../src/lib/league.ts");
const { rankingText, rankingWindows } = await import("../../src/lib/sentences.ts");
const { datasetFirstMonth } = await import("../../src/lib/built.ts");

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const cases = JSON.parse(read("tests/site/fixtures/league-cases.json"));
const phrases = JSON.parse(read("config/presets.json")).defaults.phrases;
const FLOOR = 50;
const BASIS = "Ranked by vehicles {window}";

type Window = { month: string; total: number; brands: Record<string, number> };
const rowsOf = (w: Window) => Object.entries(w.brands).map(([value, n]) => ({ month: w.month, value, n, denominator: w.total }));

test("the audit's battery-electric case: the four brands on 3 vehicles stand at #41 a year before, and the moves follow", () => {
  const { currentFrom, priorFrom, priorTo } = rankingWindows("2026-10", 12);
  const text = rankingText(phrases, { basis: BASIS, span: 12, end: "2026-10", latest: "2026-10", covers: { first: "1927-02", last: "2026-10" } });
  assert.equal(text.hasPrior, true);
  const { items } = leagueRows({
    rows: [...rowsOf(cases.bev.prior), ...rowsOf(cases.bev.current)],
    currentFrom, end: "2026-10", priorFrom, priorTo, hasPrior: text.hasPrior, topN: 25, nameOf: (v) => v, yearFloor: FLOOR,
  });
  const row = (name: string) => items.find((i) => i.name === name);
  assert.deepEqual([row("TESLA")?.rank, row("DONGFENG")?.rank], [1, 6]);
  assert.equal(row("DONGFENG")?.priorRank, 41);
  assert.equal(row("DONGFENG")?.rankDelta, 35);
  assert.equal(row("ZEEKR")?.priorRank, 30);
  assert.equal(row("ZEEKR")?.rankDelta, 22);
  assert.equal(row("FARIZON")?.priorRank, 33);
  assert.equal(row("FARIZON")?.rankDelta, 13);
  // The others tied on 3 stand at the same rank a year before (they are not in the first 25 now).
  const all = leagueRows({ rows: [...rowsOf(cases.bev.prior), ...rowsOf(cases.bev.current)], currentFrom: priorFrom, end: priorTo, priorFrom: "2023-11", priorTo: "2024-10", hasPrior: false, topN: 400, nameOf: (v) => v, yearFloor: FLOOR }).items;
  for (const name of ["CITROEN", "DONGFENG", "LOTUS", "MAZDA"]) assert.equal(all.find((i) => i.name === name)?.rank, 41, name);
});

test("a condition that keeps nothing in most months: the hydrogen case has a rank a year before, a move and a change, together", () => {
  const rows = cases.hydrogen.map((r: { month: string; make: string; n: number }) => ({ month: r.month, value: r.make, n: r.n, denominator: r.n }));
  // The months with rows are four before the end and three in it; the others, inside the dataset's months, are months of zero.
  assert.ok(new Set(rows.map((r: { month: string }) => r.month)).size < 12);
  const { currentFrom, priorFrom, priorTo } = rankingWindows("2026-10", 12);
  const text = rankingText(phrases, { basis: BASIS, span: 12, end: "2026-10", latest: "2026-10", covers: { first: "1927-02", last: "2026-10" } });
  assert.equal(text.hasPrior, true);
  assert.doesNotMatch(text.text, /no figures a year earlier/);
  assert.match(text.text, /compares each rank/);
  const { items } = leagueRows({ rows, currentFrom, end: "2026-10", priorFrom, priorTo, hasPrior: text.hasPrior, topN: 15, nameOf: (v) => v, yearFloor: FLOOR });
  assert.equal(items.length, 1);
  const [daf] = items;
  // A year before TOYOTA had 17, DAF 3 and HYUNDAI 1; now DAF has 3 and the others none.
  assert.deepEqual([daf.name, daf.rank, daf.n, daf.priorN, daf.priorRank, daf.rankDelta], ["DAF", 1, 3, 3, 2, 1]);
  assert.equal(daf.yearChange, undefined, "an earlier count of 3 is under the floor of 50: the change is withheld, with the rank and the move shown");
  assert.equal(daf.shareDelta, 1 - 3 / 21);
});

test("a window that starts before the dataset does has no comparison: no rank, move, share change or change a year before", () => {
  const rows = [{ month: "2021-06", value: "A", n: 100, denominator: 150 }, { month: "2021-06", value: "B", n: 50, denominator: 150 }];
  const { currentFrom, priorFrom, priorTo } = rankingWindows("2021-06", 1);
  const text = rankingText(phrases, { basis: BASIS, span: 1, end: "2021-06", latest: "2026-10", covers: { first: "2021-01", last: "2026-10" } });
  assert.equal(text.hasPrior, false);
  assert.match(text.text, /no figures a year earlier/i);
  const { items } = leagueRows({ rows, currentFrom, end: "2021-06", priorFrom, priorTo, hasPrior: text.hasPrior, topN: 15, nameOf: (v) => v, yearFloor: FLOOR });
  for (const i of items) assert.deepEqual([i.priorRank, i.rankDelta, i.shareDelta, i.yearChange], [null, null, undefined, undefined]);
});

test("the dataset's first month is its supplied start, or its count of months back from its last", () => {
  const manifest = {
    latest_snapshot: "2026-10-31",
    datasets: {
      supplied: { latest_month: "2026-10", months: 70, supplied: { months: { first: "2021-01", last: "2026-10", count: 70 } } },
      register: { latest_month: "2026-10", months: 1197 },
      bare: {},
    },
  };
  const first = (id: keyof typeof manifest.datasets) => datasetFirstMonth(manifest.datasets[id], "2026-10");
  assert.equal(first("supplied"), "2021-01");
  assert.equal(first("register"), "1927-02");
  assert.ok(first("bare") > "2026-10", "a dataset the manifest does not describe is never said to cover a window");
});

test("a tie across the cut is counted: the entries beyond the list that share its last rank", async () => {
  const rows = ["A", "B", "C", "D", "E"].map((v, i) => ({ month: "2026-10", value: v, n: [9, 5, 5, 5, 1][i], denominator: 25 }));
  const base = { rows, currentFrom: "2026-10", end: "2026-10", priorFrom: "2025-10", priorTo: "2025-10", hasPrior: false, nameOf: (v: string) => v, yearFloor: FLOOR };
  const two = leagueRows({ ...base, topN: 2 });
  assert.deepEqual(two.items.map((i) => [i.name, i.rank]), [["A", 1], ["B", 2]]);
  assert.equal(two.tiedBeyond, 2);
  assert.equal(leagueRows({ ...base, topN: 4 }).tiedBeyond, 0);
  assert.equal(leagueRows({ ...base, topN: 1 }).tiedBeyond, 0);
  const { fillTemplate } = await import("../../src/lib/sentences.ts");
  assert.equal(fillTemplate(phrases.tie_beyond_cut, { count: two.tiedBeyond }).text, "Not listed, with the same count and rank as the last entry shown: 2.");
});

test("LeagueChart draws what leagueRows returns, takes the comparison from rankingText, and holds no ranking of its own", () => {
  const league = read("src/components/LeagueChart.tsx");
  assert.match(league, /leagueRows\(\{ rows, currentFrom, end, priorFrom, priorTo, hasPrior: ranking\.hasPrior,/);
  assert.match(league, /covers: \{ first: datasetFirstMonth\(manifest\.datasets\[/);
  assert.doesNotMatch(league, /monthsPresent|rankByCount|hasPrior\s*[:=]\s*true/);
});
