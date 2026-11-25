// A field's counts split by a condition (src/lib/conditionViews.ts, src/lib/conditionViewsBuild.ts): the parts add up to the total the slice gives, a cut that
// disagrees with its slice is refused, and the cap floor. The module names no field or value, so the fixtures are made up; the last tests read the real
// build when public/data is there.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const { Cut, capFloor } = await import("../../src/lib/conditionViews.ts");
const { readFactColumns, viewCuts } = await import("../../src/lib/conditionViewsBuild.ts");
const { readSlice } = await import("../../src/lib/latestMonthBuild.ts");
type FactColumns = import("../../src/lib/conditionViews.ts").FactColumns;
type SliceRow = import("../../src/lib/data.ts").SliceRow;

const columns = (rows: [string, string, string, number][]): FactColumns => ({
  month: rows.map((r) => r[0]),
  n: rows.map((r) => r[3]),
  values: { thing: rows.map((r) => r[1]), cond: rows.map((r) => r[2]) },
});
// Rows of a fact table: month, thing, condition, count. A thing and condition can repeat in a month, as the fact table's other fields split them.
const FACTS = columns([
  ["2026-10", "a", "x", 700],
  ["2026-10", "a", "x", 105],
  ["2026-10", "a", "y", 15],
  ["2026-10", "b", "y", 50],
  ["2025-10", "a", "x", 600],
  ["2025-10", "b", "x", 20],
  ["2025-10", "b", "y", 5],
]);
const slice = (rows: [string, string, number][]): SliceRow[] => rows.map(([month, value, n]) => ({ month, value, n, denominator: 0 }));
const SLICE = slice([["2026-10", "a", 820], ["2026-10", "b", 50], ["2025-10", "a", 600], ["2025-10", "b", 25]]);

test("the parts of a value add up to the total the slice shows, for every value and month", () => {
  const cut = Cut.from(FACTS, "thing", "cond", ["x", "y"])!;
  assert.equal(cut.at("a", "x", "2026-10"), 805);
  assert.equal(cut.at("a", "y", "2026-10"), 15);
  assert.equal(cut.all("a", "2026-10"), 820);
  for (const r of SLICE) assert.equal(cut.all(r.value, r.month), r.n);
  assert.equal(cut.total("x", "2026-10") + cut.total("y", "2026-10"), 870);
  assert.ok(cut.agreesWith(SLICE));
});

test("a combination with no row is zero, and the conditions are in the order given, then any other as held", () => {
  const cut = Cut.from(FACTS, "thing", "cond", ["y", "x"])!;
  assert.equal(cut.at("b", "x", "2026-10"), 0);
  assert.equal(cut.at("zzz", "x", "2026-10"), 0);
  assert.deepEqual(cut.conditions(), ["y", "x"]);
  assert.deepEqual(Cut.from(FACTS, "thing", "cond", ["y"])!.conditions(), ["y", "x"]);
  assert.deepEqual(Cut.from(FACTS, "thing", "cond", [])!.conditions(), ["x", "y"]);
});

test("a window's sum is the months' counts added", () => {
  const cut = Cut.from(FACTS, "thing", "cond", ["x", "y"])!;
  assert.equal(cut.sum("a", "x", ["2026-10", "2025-10"]), 1405);
  assert.equal(cut.sum("b", "y", ["2026-10", "2025-10"]), 55);
});

test("a cut that disagrees with its slice is refused: a different count, a value the slice lacks, a hidden or missing count", () => {
  const cut = Cut.from(FACTS, "thing", "cond", ["x", "y"])!;
  assert.equal(cut.agreesWith(slice([["2026-10", "a", 819], ["2026-10", "b", 50], ["2025-10", "a", 600], ["2025-10", "b", 25]])), false);
  assert.equal(cut.agreesWith(slice([["2026-10", "a", 820], ["2026-10", "b", 50], ["2025-10", "a", 600]])), false);
  assert.equal(cut.agreesWith(slice([["2026-10", "a", 820], ["2026-10", "b", 50], ["2025-10", "a", 600], ["2025-10", "b", 25], ["2025-10", "c", 3]])), false);
  assert.equal(cut.agreesWith([{ month: "2026-10", value: "a", n: Number.NaN, denominator: 0, hidden: true }, ...SLICE.slice(1)]), false);
  assert.equal(cut.agreesWith(undefined), false);
});

test("columns of unequal length, or a count that is not a number, make no cut", () => {
  assert.equal(Cut.from({ ...FACTS, n: FACTS.n.slice(1) }, "thing", "cond", []), undefined);
  assert.equal(Cut.from({ ...FACTS, n: [Number.NaN, ...FACTS.n.slice(1)] }, "thing", "cond", []), undefined);
  assert.equal(Cut.from(FACTS, "missing", "cond", []), undefined);
});

test("the cap floor is the fewest vehicles over the months of any value the build names; reserved values are not named", () => {
  const months = ["2026-09", "2026-10"];
  const s = slice([["2026-09", "a", 100], ["2026-10", "a", 50], ["2026-09", "b", 30], ["2026-10", "b", 45], ["2026-09", "__OTHER__", 5], ["2025-01", "c", 1]]);
  assert.equal(capFloor(s, months), 75);
  assert.equal(capFloor([], months), undefined);
  assert.equal(capFloor(undefined, months), undefined);
});

// ---- a made-up build, to test the reader's refusals ----

const manifest = (over: Record<string, unknown> = {}) =>
  ({ datasets: { d: { facts: { rows: 1, dimensions: ["cond", "thing"], not_live: {} }, small_cells: {}, ...over } } }) as unknown as import("../../src/lib/data.ts").Manifest;

test("the fact table is not read where the manifest does not list a field, or a field was written under the small-cell rule", async () => {
  const none = () => undefined;
  assert.equal(await readFactColumns(none, manifest(), "d", ["cond", "thing"]), undefined);
  assert.equal(await readFactColumns(none, manifest({ facts: { rows: 1, dimensions: ["cond"], not_live: {} } }), "d", ["cond", "thing"]), undefined);
  assert.equal(await readFactColumns(none, manifest({ small_cells: { thing: { minimum: 5 } } }), "d", ["cond", "thing"]), undefined);
  const cuts = await viewCuts(none, manifest(), "d", "cond", [], ["thing"], { thing: SLICE, cond: SLICE }, ["2026-10"]);
  assert.deepEqual(cuts.cuts, {});
});

// ---- the real build, where there is one ----

const ROOT = join(process.cwd(), "public", "data");
const built = existsSync(join(ROOT, "manifest.json")) && existsSync(join(ROOT, "facts", "registrations_flow", "make.parquet"));
const readReal = (relative: string): ArrayBuffer | undefined => {
  try {
    const file = readFileSync(join(ROOT, relative));
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  } catch {
    return undefined;
  }
};

test("the real fact table agrees with every slice it is cut for, month by month, and the Ranger's parts are 805 and 15", { skip: !built }, async () => {
  const m = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
  const fields = ["make", "model", "powertrain_group"];
  const slices: Record<string, SliceRow[] | undefined> = {};
  for (const f of ["import_status", ...fields]) slices[f] = await readSlice(readReal, m, "registrations_flow", f);
  const months = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  const { cuts, floors } = await viewCuts(readReal, m, "registrations_flow", "import_status", ["NZ New", "Used Import"], fields, slices, months);
  for (const f of ["import_status", ...fields]) assert.ok(cuts[f], `${f} has a cut`);
  const model = cuts.model!;
  assert.deepEqual(model.conditions(), ["NZ New", "Used Import"]);
  assert.equal(model.at("FORD|RANGER", "NZ New", "2026-10"), 805);
  assert.equal(model.at("FORD|RANGER", "Used Import", "2026-10"), 15);
  assert.equal(model.all("FORD|RANGER", "2026-10"), 820);
  assert.equal(typeof floors.model, "number");
  assert.equal(floors.make, undefined);
  // The month's total is the same whichever field it is cut by, and is the figure the page showed before.
  const totals = ["import_status", ...fields].map((f) => cuts[f]!.total("NZ New", "2026-10") + cuts[f]!.total("Used Import", "2026-10"));
  assert.equal(new Set(totals).size, 1);
});
