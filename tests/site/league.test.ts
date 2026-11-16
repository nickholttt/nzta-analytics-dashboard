// The rows of a ranking (src/lib/league.ts, the function LeagueChart draws), from real counts in tests/site/fixtures/league-cases.json:
// vehicles still registered, by brand, from the build of the 2026-10 snapshot. And whether a year-before comparison exists
// (rankingText, src/lib/sentences.ts), decided by the dataset's own months and not by the months a narrowed slice has rows for.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { leagueRows } = await import("../../src/lib/league.ts");
const { rankingText, rankingWindows, rankingWords } = await import("../../src/lib/sentences.ts");
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

test("the dataset's first month is its supplied start, else the earliest month it has rows in, never a count of months", () => {
  const supplied = { months: { first: "2021-01", last: "2026-10", count: 70 } };
  assert.equal(datasetFirstMonth({ supplied }, "2021-03"), "2021-01");
  assert.equal(datasetFirstMonth({}, "1912-01"), "1912-01");
  assert.equal(datasetFirstMonth(undefined, "1912-01"), "1912-01");
  assert.ok(datasetFirstMonth(undefined, undefined) > "2026-10", "a dataset with no known first month is never said to cover a window");
});

test("a register ranking of 1926, whose year before has rows in six of its twelve months: the comparison exists and the empty months are zero", async () => {
  // Real counts: vehicles still registered by brand, 1925 and 1926 (the build of the 2026-10 snapshot). 1925 has 22 vehicles in six
  // months (12 of them with no reference match, which take no place); the dataset's first month with rows is 1912-01. The address
  // build.measure=share, build.by=make, build.period=latest_year, build.month=1926-12 ranks 1926 against 1925. Counted by hand
  // from the same file: 1925 AUSTIN 4, DODGE 2, FIAT 2, CHRYSLER 1, MORRIS 1; 1926 FORD 6, DODGE 3, AUSTIN 2, CHEVROLET 2, MORRIS 2, FIAT 1.
  const fixture = JSON.parse(read("tests/site/fixtures/league-1926.json"));
  const first = datasetFirstMonth(undefined, fixture.first_month_with_rows);
  assert.equal(first, "1912-01");
  const { currentFrom, priorFrom, priorTo } = rankingWindows("1926-12", 12);
  assert.deepEqual([currentFrom, priorFrom, priorTo], ["1926-01", "1925-01", "1925-12"]);
  const months = new Set(fixture.rows.filter((r: { month: string }) => r.month < "1926-01").map((r: { month: string }) => r.month));
  assert.equal(months.size, 6, "only six of the twelve months of 1925 have rows");
  const text = rankingText(phrases, { basis: BASIS, span: 12, end: "1926-12", latest: "2026-10", covers: { first, last: "2026-10" } });
  assert.equal(text.hasPrior, true);
  assert.doesNotMatch(text.text, /no figures a year earlier/);
  // What the count of months gave: 1927-02, which put the window before the dataset and said there was nothing to compare with.
  assert.equal(rankingText(phrases, { basis: BASIS, span: 12, end: "1926-12", latest: "2026-10", covers: { first: "1927-02", last: "2026-10" } }).hasPrior, false);
  const { items } = leagueRows({ rows: fixture.rows, currentFrom, end: "1926-12", priorFrom, priorTo, hasPrior: text.hasPrior, topN: 15, nameOf: (v) => v, yearFloor: FLOOR });
  const row = (name: string) => items.find((i) => i.name === name);
  assert.deepEqual(items.map((i) => [i.name, i.rank, i.priorRank, i.rankDelta]), [
    ["FORD", 1, null, null],
    ["DODGE", 2, 2, 0],
    ["AUSTIN", 3, 1, -2],
    ["CHEVROLET", 3, null, null],
    ["MORRIS", 3, 4, 1],
    ["FIAT", 6, 2, -4],
  ]);
  assert.equal(row("DODGE")?.priorN, 2);
  assert.equal(row("DODGE")?.yearChange, undefined, "an earlier count of 2 is under the floor of 50");
});

test("an earlier window with no vehicles at all has no share, so an entry's change in share is not shown; it still reads as new", () => {
  const base = { currentFrom: "2026-08", end: "2026-08", priorFrom: "2025-08", priorTo: "2025-08", hasPrior: true, topN: 15, nameOf: (v: string) => v, yearFloor: FLOOR };
  // The condition keeps three vehicles of one value in the month, and none of any value in the same month a year earlier.
  const empty = leagueRows({ ...base, rows: [{ month: "2026-08", value: "A", n: 3, denominator: 3 }] });
  assert.equal(empty.priorDenom, 0);
  assert.equal(empty.items[0].share, 1);
  assert.equal(empty.items[0].priorRank, null, "no vehicles then, so no rank then");
  assert.equal(empty.items[0].shareDelta, undefined, "0 of 0 vehicles is not a share of 0%");
  assert.equal(empty.items[0].yearChange, undefined);
  // The earlier month has vehicles, none of them this value's: its share then was 0%, and the change is its whole share.
  const others = leagueRows({ ...base, rows: [{ month: "2026-08", value: "A", n: 3, denominator: 3 }, { month: "2025-08", value: "B", n: 4, denominator: 4 }] });
  assert.equal(others.priorDenom, 4);
  assert.equal(others.items[0].priorRank, null);
  assert.equal(others.items[0].shareDelta, 1);
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

// A ranking and the precision floor (docs/METRICS.md): the floor is the share's own, on the window's total, and nothing is hidden.
const { rankingGuard } = await import("../../src/lib/league.ts");
const { minDenominator } = await import("../../src/lib/measures.ts");
const SHARE_FLOOR = minDenominator("share");

function guardOf(rows: { month: string; value: string; n: number; denominator: number }[], end: string, span: number, latest = "2026-10") {
  const { currentFrom, priorFrom, priorTo } = rankingWindows(end, span);
  const text = rankingText(phrases, { basis: BASIS, span, end, latest, covers: { first: "1912-01", last: latest } });
  const result = leagueRows({ rows, currentFrom, end, priorFrom, priorTo, hasPrior: text.hasPrior, topN: 15, nameOf: (v) => v, yearFloor: FLOOR });
  const guard = rankingGuard({ floor: SHARE_FLOOR, currentDenom: result.currentDenom, priorDenom: result.priorDenom, hasPrior: text.hasPrior, ...rankingWords(phrases, { span, end, latest }), phrases });
  return { result, guard };
}

test("the hydrogen ranking rests on 3 vehicles: its shares and changes in share are greyed, with one sentence, and every row is still there", () => {
  assert.equal(SHARE_FLOOR, 200);
  const rows = cases.hydrogen.map((r: { month: string; make: string; n: number }) => ({ month: r.month, value: r.make, n: r.n, denominator: r.n }));
  const { result, guard } = guardOf(rows, "2026-10", 12);
  assert.equal(result.currentDenom, 3);
  assert.deepEqual([guard.shares, guard.changes], [true, true]);
  assert.equal(guard.sentence, "This ranking rests on 3 vehicles in the last 12 months, fewer than the 200 needed to read a share reliably, so its shares and changes in share are greyed.");
  // Nothing that was shown is hidden: the entry, its share, its rank a year before and its change in share are all still computed.
  assert.equal(result.items.length, 1);
  assert.deepEqual([result.items[0].name, result.items[0].share, result.items[0].priorRank], ["DAF", 1, 2]);
  assert.equal(result.items[0].shareDelta, 1 - 3 / 21);
});

test("a ranking of one month reads the floor on that month's vehicles, and says so for a month of one vehicle", () => {
  const rows = cases.hydrogen.map((r: { month: string; make: string; n: number }) => ({ month: r.month, value: r.make, n: r.n, denominator: r.n }));
  const { result, guard } = guardOf(rows, "2026-10", 1);
  assert.equal(result.currentDenom, 1);
  assert.equal(guard.sentence, "This ranking rests on 1 vehicle in Oct 2026, fewer than the 200 needed to read a share reliably, so its shares and changes in share are greyed.");
});

test("the floor is the same number for a month and for twelve months: the window's total is read against it, never 12 times it", () => {
  const phrasesOf = { ranking_thin: phrases.ranking_thin, ranking_thin_prior: phrases.ranking_thin_prior };
  const guard = (currentDenom: number, priorDenom: number, hasPrior = true, floor = SHARE_FLOOR) =>
    rankingGuard({ floor, currentDenom, priorDenom, hasPrior, window: "in the last 12 months", priorDates: "Nov 2024 to Oct 2025", phrases: phrasesOf });
  assert.equal(guard(199, 5000).shares, true);
  assert.equal(guard(200, 5000).shares, false, "exactly the floor is not under it");
  assert.equal(guard(2399, 5000).shares, false, "a twelve-month window of 2,399 vehicles is not greyed: twelve times the floor is not asked");
  // Only the earlier window is thin: the shares stand, the changes in share are greyed, with a sentence of their own.
  const earlier = guard(450, 120);
  assert.deepEqual([earlier.shares, earlier.changes], [false, true]);
  assert.equal(earlier.sentence, "The earlier months this ranking is compared with (Nov 2024 to Oct 2025) hold 120 vehicles, fewer than the 200 needed to read a share reliably, so its changes in share are greyed.");
  // An earlier window of no vehicles gives no change at all, so there is nothing to grey; no comparison, none either.
  assert.deepEqual(guard(450, 0), { shares: false, changes: false, sentence: undefined });
  assert.deepEqual(guard(450, 120, false), { shares: false, changes: false, sentence: undefined });
  // A ranking of a window that is thin in both says one thing, not two.
  assert.match(guard(3, 21).sentence ?? "", /^This ranking rests on 3 vehicles/);
  // A measure with no floor greys nothing.
  assert.deepEqual(guard(3, 21, true, 0), { shares: false, changes: false, sentence: undefined });
});

test("a ranking with a large base is not greyed: the battery-electric case rests on thousands of vehicles", () => {
  const rows = [...rowsOf(cases.bev.prior), ...rowsOf(cases.bev.current)];
  const { result, guard } = guardOf(rows, "2026-10", 12);
  assert.ok(result.currentDenom > 1000);
  assert.deepEqual(guard, { shares: false, changes: false, sentence: undefined });
});
