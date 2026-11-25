// Tests for two dimensions crossed (src/lib/cross.ts), and for the completeness chart that uses it (vehicle type and new or
// used), run with Node's own test runner: node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CROSS_SEPARATOR, crossPair, crossValue } from "../../src/lib/cross.ts";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

// A pair slice of status (a) by type (b), two months.
const pair = [
  { month: "2021-01", a: "new", b: "car", n: 90 },
  { month: "2021-01", a: "used", b: "car", n: 60 },
  { month: "2021-01", a: "new", b: "truck", n: 20 },
  { month: "2021-02", a: "new", b: "car", n: 100 },
  { month: "2021-02", a: "used", b: "truck", n: 5 },
];

test("a crossed row's value names the breakdown first and the other dimension second, whichever side of the pair it is", () => {
  const byType = crossPair(pair, "b");
  assert.deepEqual(
    byType.filter((r) => r.month === "2021-01").map((r) => r.value),
    ["car" + CROSS_SEPARATOR + "new", "car" + CROSS_SEPARATOR + "used", "truck" + CROSS_SEPARATOR + "new"],
  );
  const byStatus = crossPair(pair, "a");
  assert.ok(byStatus.some((r) => r.value === crossValue("new", "car")));
});

test("a crossed month's denominator is the sum of its cells, so the cells add up to the whole", () => {
  const rows = crossPair(pair, "b");
  for (const month of ["2021-01", "2021-02"]) {
    const cells = rows.filter((r) => r.month === month);
    assert.equal(cells.reduce((sum, r) => sum + r.n, 0), cells[0].denominator);
  }
  assert.equal(rows.find((r) => r.month === "2021-01")?.denominator, 170);
});

test("a cell the pair has no row for is not made up, and rows are sorted by month then value", () => {
  const rows = crossPair(pair, "b");
  assert.equal(rows.filter((r) => r.month === "2021-02").length, 2);
  assert.deepEqual(rows.map((r) => `${r.month}|${r.value}`), [...rows.map((r) => `${r.month}|${r.value}`)].sort());
});

test("the fact table path builds its crossed value with the same function as the pair path", () => {
  assert.match(read("src/lib/data.ts"), /crossValue\(String\(firstBreakdown\[i\]\), String\(other\[i\]\)\)/);
  assert.match(read("src/lib/data.ts"), /crossPair\(await loadPair\(/);
});

test("completeness by vehicle type and new or used divides the pair slice by the fact table, from config", () => {
  const presets = JSON.parse(read("config/presets.json")).groups.flatMap((g: { presets: { id: string }[] }) => g.presets);
  const p = presets.find((x: { id: string }) => x.id === "registrations-completeness-by-type");
  assert.equal(p.derived, "completeness");
  // The chart reads the dataset the ratio divides by, which counts the same vehicle types as the survivors it divides (D-157).
  const measure = JSON.parse(read("config/measures.json")).derived_measures.find((m: { id: string }) => m.id === "completeness");
  assert.equal(p.dataset, measure.denominator_dataset);
  assert.ok(p.dimension && p.cross && p.dimension !== p.cross);
  const resolve = read("src/lib/resolve.ts");
  assert.match(resolve, /cross: \{ dimension: preset\.cross, pair \}/);
  assert.match(resolve, /facts: \{ where: \{\} \}, cross: \{ dimension: preset\.cross \}/);
});

test("completeness is shown, never used to scale: no chart of a count reads a ratio", () => {
  const trend = read("src/components/TrendChart.tsx");
  const ratioStart = trend.indexOf("function RatioTrend");
  const valuesStart = trend.indexOf("function ValuesTrend");
  assert.ok(ratioStart >= 0 && valuesStart > ratioStart);
  assert.doesNotMatch(trend.slice(valuesStart), /ratioSeries|completeness/i);
});
