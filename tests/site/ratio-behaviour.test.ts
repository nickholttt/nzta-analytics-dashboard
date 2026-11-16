// Behaviour tests for the ratio chart's arithmetic and its gaps (src/lib/ratio.ts), fed by the pair slice the way the cars-still-
// registered chart is (src/lib/cross.ts), and for a cube that lacks a dataset (src/lib/built.ts). Node's own test runner:
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { isolatedMonths, lineMonths, ratioCore } from "../../src/lib/ratio.ts";
import { crossPair, crossValue, narrowPair } from "../../src/lib/cross.ts";
import { unrecordedMonths } from "../../src/lib/sentences.ts";
import { isUnbuilt } from "../../src/lib/built.ts";

const NEW = "NZ New";
const USED = "Used Import";
const PASSENGER = "Passenger cars and vans";
const GOODS = "Goods vans, trucks and utes";
const NONE = "__UNDEFINED__";

// Month i counted from 1975-07: i = 0 to 5 is 1975-07 to 1975-12.
const month = (i: number) => `1975-${String(7 + i).padStart(2, "0")}`;

// The register's survivors as the pair slice holds them (a: status, b: type), and a goods row that must never reach the
// passenger numerator.
const pair = Array.from({ length: 6 }, (_, i) => [
  { month: month(i), a: NEW, b: PASSENGER, n: 50 + i },
  { month: month(i), a: USED, b: PASSENGER, n: 10 },
  { month: month(i), a: NEW, b: GOODS, n: 999 },
]).flat();

// The published count, split by status: two months before the split (not recorded), then six months in which the used line has
// 250 cars behind it, except months 2 and 3, which have 100 (under the floor of 200), so the used line has a gap with a run of
// two months drawn either side of it.
const published = [
  { month: "1975-05", value: NONE, n: 400, denominator: 400 },
  { month: "1975-06", value: NONE, n: 400, denominator: 400 },
  ...Array.from({ length: 6 }, (_, i) => {
    const used = i === 2 || i === 3 ? 100 : 250;
    return [
      { month: month(i), value: NEW, n: 300, denominator: 300 + used },
      { month: month(i), value: USED, n: used, denominator: 300 + used },
    ];
  }).flat(),
];
const numerator = narrowPair(pair, "a", [PASSENGER]);
const leaves = (collapsed: string[] = []) => ({ floor: 200, collapsed: new Set(collapsed), unrecorded: new Set(unrecordedMonths(published)) });
const lineOf = (series: ReturnType<typeof ratioCore>, name: string) => series.find((s) => s.series === name)?.points ?? [];

test("the numerator is the narrowed pair slice: goods rows never reach it, and the total is the passenger survivors", () => {
  assert.equal(numerator.some((r) => r.n === 999), false);
  const total = ratioCore(numerator, published, leaves()).find((s) => s.series === "")!;
  assert.equal(total.points[0].n, 60);
  assert.equal(total.points[0].denominator, 550);
});

test("a ratio is each value's survivors over the published count of the same month and value", () => {
  const series = ratioCore(numerator, published, leaves());
  assert.equal(lineOf(series, NEW)[0].value, 50 / 300);
  assert.equal(lineOf(series, USED)[0].value, 10 / 250);
});

test("months the source does not record are not drawn on any line, and the reserved value has no line of its own", () => {
  const series = ratioCore(numerator, published, leaves());
  for (const s of series) assert.ok(s.points.every((p) => p.month >= "1975-07"), `${s.series} has a month before the split`);
  assert.equal(series.some((s) => s.series === NONE), false);
});

test("a month under the precision floor is left out of that line only, and a collapsed month out of every line", () => {
  const series = ratioCore(numerator, published, leaves([month(5)]));
  assert.deepEqual(lineOf(series, USED).map((p) => p.month), [month(0), month(1), month(4)]);
  assert.equal(lineOf(series, NEW).some((p) => p.month === month(5)), false);
  assert.equal(series.find((s) => s.series === "")!.points.some((p) => p.month === month(5)), false);
});

test("a line is broken at a month it leaves out: no value is made up between the months either side", () => {
  const used = lineOf(ratioCore(numerator, published, leaves()), USED);
  assert.deepEqual(used.map((p) => p.month), [month(0), month(1), month(4), month(5)]);
  const line = lineMonths(used, month(0), month(5));
  assert.equal(line.length, 6);
  assert.deepEqual(line.map((p) => p.value === undefined), [false, false, true, true, false, false]);
});

test("a month standing alone between gaps is named, so it can be drawn as a dot; runs of two or more are not", () => {
  const point = (m: string) => ({ month: m, value: 0.5, n: 1, denominator: 2 });
  const line = lineMonths([point("2020-01"), point("2020-02"), point("2020-04"), point("2020-06"), point("2020-07")], "2020-01", "2020-07");
  assert.deepEqual(isolatedMonths(line), ["2020-04"]);
  assert.deepEqual(isolatedMonths([]), []);
});

test("a month before the first point or after the last is a gap, not a zero", () => {
  const line = lineMonths([{ month: "2020-03", value: 0.5, n: 1, denominator: 2 }], "2020-01", "2020-05");
  assert.deepEqual(line.map((p) => p.value), [undefined, undefined, 0.5, undefined, undefined]);
  assert.deepEqual(isolatedMonths(line), ["2020-03"]);
});

test("a ratio above one is kept as it is", () => {
  const top = [{ month: "2021-01", value: "A", n: 300, denominator: 300 }];
  const over = [{ month: "2021-01", value: "A", n: 400, denominator: 400 }];
  const series = ratioCore(over, top, { floor: 200, collapsed: new Set(), unrecorded: new Set() });
  assert.equal(series.find((s) => s.series === "A")?.points[0].value, 400 / 300);
});

test("a crossed value keeps a reserved token reserved, on either side, so no line is named after half a token", () => {
  assert.equal(crossValue(PASSENGER, NEW), `${PASSENGER} · ${NEW}`);
  assert.equal(crossValue(NONE, NEW), NONE);
  assert.equal(crossValue(PASSENGER, NONE), NONE);
  const rows = crossPair(
    [
      { month: "2021-01", a: NEW, b: PASSENGER, n: 5 },
      { month: "2021-01", a: NONE, b: PASSENGER, n: 2 },
      { month: "2021-01", a: NEW, b: NONE, n: 1 },
    ],
    "b",
  );
  assert.deepEqual(rows.map((r) => r.value).sort(), [NONE, `${PASSENGER} · ${NEW}`].sort());
  assert.equal(rows.find((r) => r.value === NONE)?.n, 3);
  assert.equal(rows[0].denominator, 8);
});

test("a cube with no entry for a dataset config has words for is not built; with no words it is not in the cube at all", () => {
  assert.equal(isUnbuilt(undefined, true), true);
  assert.equal(isUnbuilt(undefined, false), false);
  assert.equal(isUnbuilt({ not_built: "no store" }, false), true);
  assert.equal(isUnbuilt({}, true), false);
});
