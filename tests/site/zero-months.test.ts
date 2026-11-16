// A month in which a condition keeps no vehicles has no rows, and inside the dataset's own months it is a month of zero vehicles,
// never a missing month (docs/METRICS.md, "Months in which nothing is counted"). The windowed figures, through the functions the
// charts call (src/lib/shareline.ts, measures.ts, rolling.ts), on real counts in tests/site/fixtures/zero-months.json: a model
// whose months are thin (by import status), and the vehicles on one rare powertrain (by make), from the 2026-10 cube.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { shareLine, figureAt, greyedAt, keyWindow, countIn } = await import("../../src/lib/shareline.ts");
const { counted, windowTotal, minDenominator, minShareOfTrailingMedian } = await import("../../src/lib/measures.ts");
const { rollingMix } = await import("../../src/lib/rolling.ts");
const { monthRange } = await import("../../src/lib/sentences.ts");

const cases = JSON.parse(readFileSync(new URL("fixtures/zero-months.json", import.meta.url), "utf8"));
type Entry = [string, string, number];
const FLOOR = minDenominator("share");
const FRACTION = minShareOfTrailingMedian("share");

// A view's rows as a narrowed slice gives them: each value's count in each month that has any, every row carrying the month's total.
function slice(entries: Entry[]) {
  const totals = new Map<string, number>();
  for (const [month, , n] of entries) totals.set(month, (totals.get(month) ?? 0) + n);
  return entries.map(([month, value, n]) => ({ month, value, n, denominator: totals.get(month) as number }));
}

// The share line the chart builds for one view: the rows' denominators, the dataset's months, the guards' numbers from config.
function lineOf(rows: ReturnType<typeof slice>, covers: { first: string; last: string } | undefined, rolling: boolean, floor = FLOOR) {
  const denominators = new Map(rows.map((r) => [r.month, r.denominator]));
  const rowsFirst = [...denominators.keys()].sort()[0];
  return shareLine(denominators, { rolling, covers, rowsFirst, minDenominator: floor, collapseFraction: FRACTION });
}
const countsOf = (rows: ReturnType<typeof slice>, value: string) => new Map(rows.filter((r) => r.value === value).map((r) => [r.month, r.n]));
const at = (line: ReturnType<typeof lineOf>, rows: ReturnType<typeof slice>, value: string, month: string) => {
  const counts = countsOf(rows, value);
  return figureAt(line, month, (m) => countIn(line, counts, m));
};

const ora = slice(cases.ora_by_import_status as Entry[]);
const flowMonths = cases.flow;

test("a point that was blank is drawn: the 12 months to Dec 2023 include two months with no rows, and the share is recomputed by hand", () => {
  // Before the change a month with no rows made the whole window missing. The two months (Jan and Feb 2023) lie inside the dataset's
  // months, which begin in Jan 2021: they hold no vehicles of this model.
  const before = at(lineOf(ora, undefined, true), ora, "NZ New", "2023-12");
  assert.equal(before, undefined, "the rule it replaces: a window with a month that has no rows is blank");
  const line = lineOf(ora, flowMonths, true);
  const now = at(line, ora, "NZ New", "2023-12");
  // Mar to Dec 2023: 25 + 25 + 17 + 44 + 10 + 7 + 10 + 97 + 92 + 113 vehicles, all of this model's, all new.
  const vehicles = 25 + 25 + 17 + 44 + 10 + 7 + 10 + 97 + 92 + 113;
  assert.equal(vehicles, 440);
  assert.deepEqual(now, { share: 1, n: 440, denominator: 440 });
  assert.equal(greyedAt(line, "2023-12"), undefined, "440 vehicles are over the floor, so the point is drawn in colour");
});

test("a window of few vehicles is still greyed, and the figure is still drawn", () => {
  const line = lineOf(ora, flowMonths, true);
  // Jan to Dec 2024: Feb 1, Sep 1, Oct 1, Nov 6, Dec 32: 41 vehicles, every one new.
  assert.deepEqual(at(line, ora, "NZ New", "2024-12"), { share: 1, n: 41, denominator: 41 });
  assert.equal(greyedAt(line, "2024-12"), "thin");
  // Nov 2025 to Oct 2026: 387 new and 1 used import in the 388 vehicles of the window (Dec 4, Jan 10, Feb 3, Mar 3, Jun 40, Jul 78, Aug 46, Sep 91, Oct 112).
  const window = at(line, ora, "NZ New", "2026-10");
  assert.deepEqual(window, { share: 387 / 388, n: 4 + 10 + 3 + 3 + 40 + 78 + 46 + 91 + 112, denominator: 387 + 1 });
  assert.deepEqual(at(line, ora, "Used Import", "2026-10"), { share: 1 / 388, n: 1, denominator: 388 });
  assert.equal(greyedAt(line, "2026-10"), undefined);
});

test("a window that holds no vehicles at all has no share, never 0%", () => {
  const line = lineOf(ora, flowMonths, true);
  // Mar 2022 to Feb 2023: none of this model's vehicles in any of the twelve months, all inside the dataset's months.
  assert.equal(at(line, ora, "NZ New", "2023-02"), undefined);
  assert.equal(at(line, ora, "Used Import", "2023-02"), undefined);
  // And the whole of 2021: still no vehicles, still no share.
  assert.equal(at(line, ora, "NZ New", "2021-12"), undefined);
  // The same on the register's hydrogen vehicles: Oct 2019 to Sep 2020 holds none.
  const hydrogen = slice(cases.hydrogen_by_make_surviving as Entry[]);
  assert.equal(at(lineOf(hydrogen, cases.surviving, true), hydrogen, "TOYOTA", "2020-09"), undefined);
});

test("a window that starts before the dataset's first month is still blank, wholly or in part", () => {
  const line = lineOf(ora, flowMonths, true);
  assert.equal(at(line, ora, "NZ New", "2020-06"), undefined, "wholly before the first month (Jan 2021)");
  assert.equal(at(line, ora, "NZ New", "2021-06"), undefined, "starts in Jul 2020, before it");
  assert.equal(at(line, ora, "NZ New", "2021-12") ?? "blank", "blank", "the first window wholly inside holds no vehicles: blank for that reason");
  const hydrogen = slice(cases.hydrogen_by_make_surviving as Entry[]);
  assert.equal(at(lineOf(hydrogen, cases.surviving, true), hydrogen, "TOYOTA", "1911-06"), undefined);
  // The month it is blank for is not made a month of zero by the rule: outside the dataset's months it is missing.
  assert.equal(line.windowed("2020-12"), undefined);
  assert.equal(line.windowed("2021-01"), 0);
});

test("the rare powertrain by make: a share the rolling rule could not draw is drawn, by hand: 8 vehicles in the 12 months to Feb 2022", () => {
  const rows = slice(cases.hydrogen_by_make_surviving as Entry[]);
  const line = lineOf(rows, cases.surviving, true);
  // Mar 2021 to Feb 2022 hold Nov 2021 (one of one make, one of another) and Feb 2022 (six): 8 vehicles.
  assert.deepEqual(at(line, rows, "DAF", "2022-02"), { share: 1 / 8, n: 1, denominator: 8 });
  assert.deepEqual(at(line, rows, "HYUNDAI", "2022-02"), { share: 1 / 8, n: 1, denominator: 8 });
  assert.deepEqual(at(line, rows, "TOYOTA", "2022-02"), { share: 6 / 8, n: 6, denominator: 8 });
  assert.equal(greyedAt(line, "2022-02"), "thin", "eight vehicles are far under the floor, so the point is greyed, not hidden");
  assert.equal(at(lineOf(rows, undefined, true), rows, "DAF", "2022-02"), undefined, "without the dataset's months, as before the change");
});

test("a monthly share is not changed: a month with no rows has no share, whatever the dataset's months", () => {
  const monthly = lineOf(ora, flowMonths, false);
  assert.equal(at(monthly, ora, "NZ New", "2023-01"), undefined);
  assert.deepEqual(at(monthly, ora, "NZ New", "2023-03"), { share: 1, n: 25, denominator: 25 });
  assert.deepEqual(at(monthly, ora, "Used Import", "2026-07"), { share: 1 / 79, n: 1, denominator: 79 });
});

test("the representativeness guard reads the true twelve months before: Feb 2024 holds 1 vehicle against a median of 21", () => {
  // Floor of 1, so that the precision guard does not speak first. The twelve months before Feb 2024 (Feb 2023 to Jan 2024) have two
  // months with no rows: 0, 0, 7, 10, 10, 17, 25, 25, 44, 92, 97, 113, whose median is (17 + 25) / 2 = 21; a third of it is 6.93.
  const sorted = [0, 0, 7, 10, 10, 17, 25, 25, 44, 92, 97, 113];
  assert.equal((sorted[5] + sorted[6]) / 2, 21);
  assert.equal(greyedAt(lineOf(ora, flowMonths, false, 1), "2024-02"), "collapsed");
  assert.equal(greyedAt(lineOf(ora, undefined, false, 1), "2024-02"), undefined, "before: two months of the twelve were missing, so the guard could not fire");
  // A month with no rows is not greyed for being collapsed: it has no figure to grey.
  assert.equal(greyedAt(lineOf(ora, flowMonths, false, 1), "2024-03"), undefined);
});

test("the key's windows read an absent month inside the dataset as zero, and a window outside the dataset's months is not a window", () => {
  const line = lineOf(ora, flowMonths, true);
  const counts = countsOf(ora, "NZ New");
  const n = (m: string) => countIn(line, counts, m);
  const last = keyWindow(line, "2025-11", "2026-10", n);
  assert.deepEqual(last, { n: 387, denominator: 388, missing: 0 });
  // The 12 months before: Nov 2024 to Oct 2025, four of them with no rows: Nov 6, Dec 32, Jan 35, Feb 4, Mar 1, Apr 1, May 4, Jun 1.
  assert.deepEqual(keyWindow(line, "2024-11", "2025-10", n), { n: 6 + 32 + 35 + 4 + 1 + 1 + 4 + 1, denominator: 84, missing: 0 });
  // The same without the dataset's months, as the key was before: the absent months were skipped, which gives the same totals.
  const without = lineOf(ora, undefined, true);
  const nWithout = (m: string) => (without.windowed(m) === undefined ? undefined : (counts.get(m) ?? 0));
  assert.deepEqual(keyWindow(without, "2024-11", "2025-10", nWithout), { n: 84, denominator: 84, missing: 4 }, "four months absent");
  // A window that begins before Jan 2021: 12 months missing, so there is no figure for it.
  assert.equal(keyWindow(line, "2020-01", "2020-12", n).missing, 12);
  assert.equal(keyWindow(line, "2020-07", "2021-06", n).missing, 6);
});

test("a count's 12-month total: months with no rows inside the dataset read zero; a month outside it, or one the source does not record, breaks the line", () => {
  const rows = slice(cases.hydrogen_by_make_flow as Entry[]);
  const present = new Set(rows.map((r) => r.month));
  const cell = new Map(rows.filter((r) => r.value === "DAF").map((r) => [r.month, r.n]));
  const reader = (covers: { first: string; last: string } | undefined, blank: (m: string) => boolean = () => false) =>
    counted((m) => present.has(m), covers, blank, (m) => cell.get(m));
  // Nov 2025 to Oct 2026: Dec 2025, Aug 2026 and Oct 2026, one each.
  assert.equal(windowTotal("2026-10", reader(flowMonths)), 3);
  assert.equal(windowTotal("2026-10", reader(undefined)), undefined, "before: the months with no rows were gaps, so the total was missing");
  // The twelve months to Dec 2021 start in Jan 2021, the first month: inside, and holding one DAF (Nov 2021).
  assert.equal(windowTotal("2021-12", reader(flowMonths)), 1);
  // One month short at the start: Jan 2021 is the first month, so the twelve months to Nov 2021 are 11 from it and Dec 2020 is outside.
  assert.equal(windowTotal("2021-11", reader(flowMonths)), undefined);
  assert.equal(windowTotal("2020-12", reader(flowMonths)), undefined);
  // A month the source does not record is a gap whatever the rule: no total, not a total with a zero in it.
  assert.equal(windowTotal("2026-10", reader(flowMonths, (m) => m === "2026-05")), undefined);
  // The monthly count of one with no rows, inside the dataset, is zero.
  assert.equal(reader(flowMonths)("2022-06"), 0);
  assert.equal(reader(flowMonths)("2020-06"), undefined);
});

test("the rolling mix that finds a chart's default start reads the same rule: a window the rare powertrain could never fill is now a window", () => {
  const rows = slice(cases.hydrogen_by_make_surviving as Entry[]);
  const names = [...new Set(rows.map((r) => r.value))];
  assert.deepEqual(rollingMix(rows, 8, 12), [], "no twelve consecutive months have rows");
  const mix = rollingMix(rows, 8, 12, cases.surviving);
  const feb = mix.find((m) => m.month === "2022-02");
  assert.ok(feb, "the 12 months to Feb 2022 hold 8 vehicles, which reaches a floor of 8");
  const share = (name: string) => (feb as { shares: number[] }).shares[names.indexOf(name)];
  assert.deepEqual([share("DAF"), share("HYUNDAI"), share("TOYOTA")], [1 / 8, 1 / 8, 6 / 8]);
  // Every window it gives holds vehicles, and starts inside the dataset.
  for (const point of mix) assert.ok(point.month >= "1912-12", point.month);
  assert.ok(mix.every((m) => m.shares.some((s) => s > 0)));
  // A window of no vehicles gives nothing even at a floor of 0.
  assert.equal(rollingMix(rows, 0, 12, cases.surviving).some((m) => m.month === "2020-09"), false);
  // The months a window of the dataset can start from: monthRange agrees with the fixture's first and last month.
  assert.equal(monthRange(cases.surviving.first, cases.surviving.last).length, 1378);
});

const { axisTop } = await import("../../src/lib/shareline.ts");

// The points a share chart draws for one value, as MixChart makes them: the figure, and whether a guard greys it.
function pointsOf(rows: ReturnType<typeof slice>, covers: { first: string; last: string }, value: string, from: string) {
  const line = lineOf(rows, covers, true);
  return monthRange(from, covers.last).map((month) => ({ month, value: at(line, rows, value, month)?.share, grey: greyedAt(line, month) !== undefined }));
}

test("the vertical axis is set by the points drawn in colour: a greyed point above them does not stretch it", () => {
  // One used import among a model's registrations. Its 12-month share is 1 in 139 for the 12 months to Jul 2026 and 1 in 185 to Aug 2026
  // (under the floor, greyed), then 1 in 276 to Sep 2026 and 1 in 388 to Oct 2026 (over it, in colour).
  const points = pointsOf(ora, flowMonths, "Used Import", "2026-05");
  const greyed = points.filter((p) => p.grey && p.value);
  const coloured = points.filter((p) => !p.grey && p.value);
  assert.deepEqual(greyed.map((p) => [p.month, p.value]), [["2026-07", 1 / 139], ["2026-08", 1 / 185]]);
  assert.deepEqual(coloured.map((p) => [p.month, p.value]), [["2026-09", 1 / 276], ["2026-10", 1 / 388]]);
  assert.equal(axisTop(points, 0), 1 / 276, "the axis follows the coloured points, not the 1 in 139");
  // Greyed points count again once there is nothing in colour to set the axis by.
  assert.equal(axisTop(greyed, 0), 1 / 139);
  // The least the axis takes still holds, and a month with no figure sets nothing.
  assert.equal(axisTop(points, 0.05), 0.05);
  assert.equal(axisTop([{ value: undefined, grey: false }], 0.05), 0.05);
});

test("a chart in which every point is greyed sets its axis by what there is, as before", () => {
  const rows = slice(cases.hydrogen_by_make_surviving as Entry[]);
  const points = pointsOf(rows, cases.surviving, "TOYOTA", "2021-01");
  assert.ok(points.some((p) => p.value !== undefined && p.value > 0));
  assert.ok(points.every((p) => p.grey), "a few to 47 vehicles in a window: all under the floor");
  assert.equal(axisTop(points, 0.05), Math.max(0.05, ...points.map((p) => p.value ?? 0)));
});

test("the charts that draw a greyed line set the axis with axisTop, clip the grey line to the frame, and keep the hover at the frame's edge", () => {
  for (const file of ["src/components/MixChart.tsx", "src/components/TrendChart.tsx"]) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.ok(source.includes("axisTop(model.points.map((p) => ({ value: "), file);
    assert.ok(source.includes("stroke: SUPPRESSED_LINE, strokeWidth: THIN_LINE_WIDTH, clip: true"), file);
    assert.ok(source.includes("const inFrame = (p: Point) => Math.min("), file);
  }
  const panel = readFileSync(new URL("../../src/components/PresetPanel.tsx", import.meta.url), "utf8");
  assert.equal(panel.split("{phrases.grey_beyond_scale}").length - 1, 2, "the public and the internal grey note both say it");
});
