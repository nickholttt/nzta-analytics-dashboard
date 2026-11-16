// Tests for the one ranking rule (src/lib/ranking.ts, docs/METRICS.md "Ranking and ties"): equal counts share the rank of the
// first of them (1, 2, 2, 4) and are listed alphabetically by the name shown; a move is the difference of those shared ranks.
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nameOrder, rankByCount } from "../../src/lib/ranking.ts";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const entry = (name: string, n: number) => ({ value: name, name, n });
const rankOf = (entries: ReturnType<typeof entry>[]) => new Map(rankByCount(entries).map((e) => [e.value, e.rank]));

test("entries with the same count share the rank of the first of them, and the next rank skips", () => {
  const ranks = rankByCount([entry("A", 10), entry("B", 7), entry("C", 7), entry("D", 5), entry("E", 5), entry("F", 5), entry("G", 1)]);
  assert.deepEqual(ranks.map((e) => e.rank), [1, 2, 2, 4, 4, 4, 7]);
});

test("within a tie the order is alphabetical by the name shown, whatever order the entries arrive in", () => {
  const arrivals = [
    [entry("MAZDA", 3), entry("LOTUS", 3), entry("DONGFENG", 3), entry("CITROEN", 3)],
    [entry("CITROEN", 3), entry("DONGFENG", 3), entry("LOTUS", 3), entry("MAZDA", 3)],
    [entry("LOTUS", 3), entry("CITROEN", 3), entry("MAZDA", 3), entry("DONGFENG", 3)],
  ];
  for (const order of arrivals) assert.deepEqual(rankByCount(order).map((e) => e.value), ["CITROEN", "DONGFENG", "LOTUS", "MAZDA"]);
});

test("the name shown decides the order, not the raw value", () => {
  const ranked = rankByCount([
    { value: "B|ZED", name: "ALPHA ZED", n: 4 },
    { value: "A|OMEGA", name: "OMEGA", n: 4 },
  ]);
  assert.deepEqual(ranked.map((e) => e.value), ["B|ZED", "A|OMEGA"]);
});

test("two values that show the same name are still ordered the same way every time", () => {
  const one = rankByCount([{ value: "Y", name: "SAME", n: 2 }, { value: "X", name: "SAME", n: 2 }]);
  const other = rankByCount([{ value: "X", name: "SAME", n: 2 }, { value: "Y", name: "SAME", n: 2 }]);
  assert.deepEqual(one.map((e) => e.value), ["X", "Y"]);
  assert.deepEqual(other.map((e) => e.value), ["X", "Y"]);
});

test("a move is the difference of the shared ranks, so tied entries move together", () => {
  const now = rankOf([entry("A", 20), entry("B", 9), entry("C", 9), entry("D", 4)]);
  const before = rankOf([entry("A", 20), entry("B", 9), entry("C", 9), entry("D", 12)]);
  const move = (v: string) => (before.get(v) as number) - (now.get(v) as number);
  assert.equal(before.get("B"), 3);
  assert.equal(now.get("B"), 2);
  assert.equal(move("B"), 1);
  assert.equal(move("C"), 1);
  assert.equal(move("D"), -2);
});

test("an entry with no figure a year before has no rank then", () => {
  const before = rankOf([entry("A", 20), entry("B", 9)]);
  assert.equal(before.get("C"), undefined);
});

test("the audit's case: four brands on 3 vehicles behind 40 others all stand at 41, and the next stands at 45", () => {
  const above = Array.from({ length: 40 }, (_, i) => entry(`BRAND ${String(i).padStart(2, "0")}`, 100 - i));
  const tied = [entry("MAZDA", 3), entry("LOTUS", 3), entry("DONGFENG", 3), entry("CITROEN", 3)];
  const ranks = rankOf([...above, ...tied, entry("OTHER", 2)]);
  for (const name of ["CITROEN", "DONGFENG", "LOTUS", "MAZDA"]) assert.equal(ranks.get(name), 41, name);
  assert.equal(ranks.get("OTHER"), 45);
  // The old rule ranked by count only and left a tie in the order it arrived, so the place a brand took depended on that
  // order: arriving fourth of the four it read #44, as the audit's build showed DONGFENG. By position in the alphabet it would
  // read #42; the rule gives all four the rank of the first, #41.
  const arrivedFourth = [...above, entry("CITROEN", 3), entry("LOTUS", 3), entry("MAZDA", 3), entry("DONGFENG", 3)].map((e, i) => [e.value, i + 1] as const);
  assert.equal(new Map(arrivedFourth).get("DONGFENG"), 44);
});

test("nameOrder is the order of a tie in any list sorted by size: alphabetical by the name, the same whatever the input order", () => {
  const names = ["TOYOTA RAV4", "Petrol", "PHEV", "BEV", "Other (beyond the cap)"];
  assert.deepEqual([...names].sort(nameOrder), [...names].reverse().sort(nameOrder));
  assert.deepEqual(["PHEV", "Petrol"].sort(nameOrder), ["Petrol", "PHEV"]);
});

test("the lines, the key, the hover order, the colours and the map order a tie by the name shown", () => {
  const mix = read("src/components/MixChart.tsx");
  assert.match(mix, /name: label\(value\), n \}\)\)\)\.map\(\(e\) => e\.value\)/);
  for (const part of [/nameOrder\(label\(a\), label\(b\)\)\);\n? *const colourRank|nameOrder\(label\(a\), label\(b\)\)\)\);/, /nameOrder\(label\(a\.series\), label\(b\.series\)\)/]) assert.match(mix, part);
  assert.match(read("src/components/TrendChart.tsx"), /nameOrder\(label\(a\.series\), label\(b\.series\)\)/);
  assert.match(read("src/components/GeoChart.tsx"), /name: label\(a\.value\)/);
  assert.match(read("src/components/TrendChart.tsx"), /derivedSeries\(preset\.derived, rows, label\)/);
});

test("the league and the other charts that order by size use the rule, not a bare sort on the count", () => {
  assert.match(read("src/lib/league.ts"), /rankByCount\(/);
  assert.match(read("src/components/LeagueChart.tsx"), /leagueRows\(/);
  assert.doesNotMatch(read("src/components/LeagueChart.tsx"), /\.sort\(\(a, b\) => b\[1\] - a\[1\]\)/);
  assert.match(read("src/components/MixChart.tsx"), /rankByCount\(/);
  assert.match(read("src/components/GeoChart.tsx"), /byCountThenName/);
  assert.match(read("src/lib/derived.ts"), /byCountThenName/);
});
