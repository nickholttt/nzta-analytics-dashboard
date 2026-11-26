// A field's counts split by a condition (src/lib/conditionViews.ts, src/lib/conditionViewsBuild.ts): the parts add up to the total the slice gives, a cut that
// disagrees with its slice is refused, and the cap floor. The module names no field or value, so the fixtures are made up; the last tests read the real
// build when public/data is there.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const { Cut, capFloor, pairColumns } = await import("../../src/lib/conditionViews.ts");
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

test("a cut made from a pair's rows is the cut made from the fact table's rows of the same counts, whichever side of the pair the field is on", () => {
  // The pair holds one row for each value of the two fields in a month: the fact table's rows added up over its other fields.
  const rows = [
    ["2026-10", "a", "x", 805],
    ["2026-10", "a", "y", 15],
    ["2026-10", "b", "y", 50],
    ["2025-10", "a", "x", 600],
    ["2025-10", "b", "x", 20],
    ["2025-10", "b", "y", 5],
  ] as const;
  const pair = { month: rows.map((r) => r[0]), n: rows.map((r) => r[3]), a: rows.map((r) => r[1]), b: rows.map((r) => r[2]) };
  const swapped = { ...pair, a: pair.b, b: pair.a };
  const fromTable = Cut.from(FACTS, "thing", "cond", ["x", "y"])!;
  const sides = [Cut.from(pairColumns(pair, "thing", "cond", "a"), "thing", "cond", ["x", "y"])!, Cut.from(pairColumns(swapped, "thing", "cond", "b"), "thing", "cond", ["x", "y"])!];
  for (const cut of sides) {
    assert.deepEqual(cut.conditions(), fromTable.conditions());
    for (const month of ["2026-10", "2025-10"]) {
      assert.deepEqual([...cut.values([month])].sort(), [...fromTable.values([month])].sort());
      for (const value of ["a", "b", "zzz"]) {
        for (const c of ["x", "y"]) assert.equal(cut.at(value, c, month), fromTable.at(value, c, month), `${month} ${value} ${c}`);
        assert.equal(cut.all(value, month), fromTable.all(value, month));
      }
      for (const c of ["x", "y"]) assert.equal(cut.total(c, month), fromTable.total(c, month));
    }
    assert.ok(cut.agreesWith(SLICE), "it agrees with the slice the table's cut agrees with");
  }
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
const built = existsSync(join(ROOT, "manifest.json")) && existsSync(join(ROOT, "facts", "new_registrations", "make.parquet"));
const readReal = (relative: string): ArrayBuffer | undefined => {
  try {
    const file = readFileSync(join(ROOT, relative));
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  } catch {
    return undefined;
  }
};

const pairBuilt = built && existsSync(join(ROOT, "pairs", "new_registrations", "buyer_type__import_status.parquet"));
test("a field the fact table lacks is cut from its pair with the condition, agrees with its slice, and leaves the other fields' cuts as they were; a slice it disagrees with is refused", { skip: !pairBuilt }, async () => {
  const m = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
  const slices: Record<string, SliceRow[] | undefined> = {};
  for (const f of ["import_status", "make", "buyer_type"]) slices[f] = await readSlice(readReal, m, "new_registrations", f);
  const months = ["2026-10"];
  const asked = ["make", "buyer_type"];
  const { cuts } = await viewCuts(readReal, m, "new_registrations", "import_status", ["NZ New", "Used Import"], asked, slices, months);
  assert.ok(cuts.buyer_type, "the buyer type has a cut");
  assert.ok(cuts.make && cuts.import_status, "the fields the table carries keep theirs");
  assert.deepEqual(cuts.buyer_type.conditions(), ["NZ New", "Used Import"]);
  for (const month of ["2026-10", "2025-10"]) assert.equal(cuts.buyer_type.total("NZ New", month) + cuts.buyer_type.total("Used Import", month), cuts.import_status.total("NZ New", month) + cuts.import_status.total("Used Import", month), `${month}: the buyer types add up to the month's vehicles`);
  // The same counts held to a slice that says one more vehicle: no cut for the field, and the others still have theirs.
  const rows = slices.buyer_type as SliceRow[];
  const off = rows.map((r, i) => (i === 0 ? { ...r, n: r.n + 1 } : r));
  const refused = await viewCuts(readReal, m, "new_registrations", "import_status", ["NZ New", "Used Import"], asked, { ...slices, buyer_type: off }, months);
  assert.equal(refused.cuts.buyer_type, undefined);
  assert.ok(refused.cuts.make && refused.cuts.import_status);
});

test("the real fact table agrees with every slice it is cut for, month by month, and the Ranger's parts are 805 and 15", { skip: !built }, async () => {
  const m = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
  const fields = ["make", "model", "powertrain_group"];
  const slices: Record<string, SliceRow[] | undefined> = {};
  for (const f of ["import_status", ...fields]) slices[f] = await readSlice(readReal, m, "new_registrations", f);
  const months = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  const { cuts, floors } = await viewCuts(readReal, m, "new_registrations", "import_status", ["NZ New", "Used Import"], fields, slices, months);
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

// ---- The latest month drawn by its conditions (made-up fixtures) ----

const { latestConfig, latestMonthView } = await import("../../src/lib/latestMonth.ts");
const { chartSentences } = await import("../../src/lib/chartWords.ts");
const { count, monthLabel } = await import("../../src/lib/sentences.ts");
const { pct, shareChange } = await import("../../src/lib/measures.ts");
type Kit = import("../../src/lib/latestMonth.ts").Kit;
type BlockConfig = import("../../src/lib/latestMonth.ts").BlockConfig;

const MONTH = "2026-10";
const PRIOR = "2025-10";
// Each value's count under the two conditions, x ("newish things") and y ("oldish things"), in the month and a year earlier. Every field counts the same vehicles:
// 490 x and 510 y in the month, 490 x and 310 y a year earlier.
const GRID: Record<string, Record<string, Record<string, [number, number]>>> = {
  field_a: {
    [MONTH]: { alpha: [200, 400], beta: [290, 10], gamma: [0, 100] },
    [PRIOR]: { alpha: [100, 300], beta: [340, 10], gamma: [50, 0] },
  },
  field_b: {
    [MONTH]: { p1: [100, 400], p2: [290, 110], p3: [98, 0], p4: [2, 0] },
    [PRIOR]: { p1: [100, 200], p2: [340, 110], p3: [48, 0], p4: [2, 0] },
  },
};
const rowsOf = (field: string): [string, string, string, number][] =>
  Object.entries(GRID[field]).flatMap(([month, values]) =>
    Object.entries(values).flatMap(([value, [x, y]]) => [[month, value, "x", x] as [string, string, string, number], [month, value, "y", y] as [string, string, string, number]].filter((r) => r[3] > 0)),
  );
const cutOf = (field: string) =>
  Cut.from({ month: rowsOf(field).map((r) => r[0]), n: rowsOf(field).map((r) => r[3]), values: { thing: rowsOf(field).map((r) => r[1]), cond: rowsOf(field).map((r) => r[2]) } }, "thing", "cond", ["x", "y"])!;
const sliceOf = (field: string): SliceRow[] => {
  const total = (month: string) => Object.values(GRID[field][month]).reduce((s, [x, y]) => s + x + y, 0);
  return Object.entries(GRID[field]).flatMap(([month, values]) => Object.entries(values).map(([value, [x, y]]) => ({ month, value, n: x + y, denominator: total(month) })));
};
const condSlice = (x: number, y: number, xBefore = 490, yBefore = 310): SliceRow[] => [
  { month: MONTH, value: "x", n: x, denominator: x + y },
  { month: MONTH, value: "y", n: y, denominator: x + y },
  { month: PRIOR, value: "x", n: xBefore, denominator: xBefore + yBefore },
  { month: PRIOR, value: "y", n: yBefore, denominator: xBefore + yBefore },
];
const block = (kind: BlockConfig["kind"], dimension: string | undefined, over: Partial<BlockConfig> = {}): BlockConfig => ({
  id: `${kind}-${dimension ?? "all"}`,
  kind,
  dimension,
  definition: "/method#x",
  canvas: { measure: "count", by: dimension !== undefined, type: null },
  ...over,
});
// "field_a" is also the field the block cuts by: its cuts here are made from the same grid as its slice.
function kit(over: Partial<Kit> & { blocks?: BlockConfig[]; floors?: Record<string, number | undefined>; noViews?: boolean; cond?: SliceRow[] } = {}): Kit {
  const { blocks, floors, noViews, cond, ...rest } = over;
  return {
    config: {
      ...latestConfig,
      dataset: "set_one",
      total_from: "cond",
      view_field: "cond",
      blocks: blocks ?? [block("total", undefined), block("ranking", "field_a", { top: 3, views: true }), block("ranking", "field_b", { top: 3, views: true }), block("movers", "field_b", { each: 2, minimum: 100, least: 0.05, views: true })],
    },
    manifest: { latest_snapshot: "2026-10-31", datasets: { set_one: { latest_month: MONTH, live_dimensions: ["cond", "field_a", "field_b"] } } } as never,
    slices: { cond: cond ?? condSlice(490, 510), field_a: sliceOf("field_a"), field_b: sliceOf("field_b") },
    events: [],
    sentences: chartSentences,
    label: { field: (d) => ({ field_a: "Field A", field_b: "Field B", cond: "Condition" })[d], value: (_d, v) => v },
    dataset: { counted: (n, window) => `${count(n)} vehicles ${window}`, showsYear: true, unit: "Vehicles each month" },
    window: (m) => `in ${monthLabel(m)}`,
    floors: { change: 50, share: 200 },
    format: { share: pct, points: shareChange },
    hidden: { word: "hidden", link: "How counts are hidden", reason: (m) => `Counts under ${m} are hidden.`, note: (n, m) => `${n} hidden under ${m}.` },
    ruleMinimum: () => undefined,
    link: (_b, where) => (where ? `/canvas/?asked&where=${JSON.stringify(where)}` : "/canvas/?asked"),
    provenance: { snapshot: "Snapshot." },
    views: noViews
      ? undefined
      : {
          field: "cond",
          conditions: [{ value: "x", label: "Newish", phrase: "newish things" }, { value: "y", label: "Oldish", phrase: "oldish things" }],
          cuts: { field_a: cutOf("field_a"), field_b: cutOf("field_b") },
          floors: floors ?? {},
        },
    ...rest,
  };
}
const find = (view: ReturnType<typeof latestMonthView>, id: string) => view?.blocks.find((b) => b.id === id);
const panel = (view: ReturnType<typeof latestMonthView>, id: string, label: string) => find(view, id)?.views?.find((p) => p.label === label);

test("the fixture's conditions add up to the slices it is checked against", () => {
  for (const field of ["field_a", "field_b"]) assert.ok(cutOf(field).agreesWith(sliceOf(field)), field);
});

test("the month's figure is said by its conditions, and by one where the other has none", () => {
  const view = latestMonthView(kit());
  assert.equal(find(view, "total-all")?.parts, "Of these, 490 newish things and 510 oldish things.");
  assert.equal(find(view, "total-all")?.figure, "1,000");
  const one = latestMonthView(kit({ cond: condSlice(1000, 0, 490, 310) }));
  assert.equal(find(one, "total-all")?.parts, "All of these were newish things.");
});

test("a block with views is drawn once for each condition and once for all, in the order of the switch", () => {
  const view = latestMonthView(kit());
  assert.deepEqual(view?.switch?.labels, ["Newish", "Oldish", "All"]);
  assert.deepEqual(find(view, "ranking-field_b")?.views?.map((p) => p.label), ["Newish", "Oldish", "All"]);
  assert.equal(find(view, "total-all")?.views, undefined, "the month's figure is outside the switch");
});

test("a rank on one condition is among that condition's vehicles only: first by all is not first by newish, and a value with none is absent", () => {
  const view = latestMonthView(kit());
  // By all, field_b's p1 (500) is first. Among newish things p2 (290) is first, and p1 (100) is second.
  assert.equal(find(view, "ranking-field_b")?.rows[0].name, "p1");
  const newish = panel(view, "ranking-field_b", "Newish");
  assert.deepEqual(newish?.rows.map((r) => r.name), ["p2", "p1", "p3"]);
  assert.match(newish?.sentences[0] ?? "", /^Among newish things, p2 is first by field B: 290 vehicles in Oct 2026, down 15% on the 340 in Oct 2025\.$/);
  // gamma has no newish vehicles this month: absent from that panel, and present among oldish things.
  assert.deepEqual(panel(view, "ranking-field_a", "Newish")?.rows.map((r) => r.name), ["beta", "alpha"]);
  assert.deepEqual(panel(view, "ranking-field_a", "Oldish")?.rows.map((r) => r.name), ["alpha", "gamma", "beta"]);
});

test("the all panel has each condition's count beside the total, and they add up to it", () => {
  const view = latestMonthView(kit());
  const all = panel(view, "ranking-field_a", "All");
  assert.deepEqual(all?.columns.map((c) => c.key), ["name", "part0", "part1", "count", "year"]);
  assert.deepEqual(all?.columns.map((c) => c.name).slice(0, 4), ["Field A", "Newish", "Oldish", "All"]);
  for (const r of all?.rows ?? []) assert.equal(count(Number(r.parts?.[0].replace(/,/g, "")) + Number(r.parts?.[1].replace(/,/g, ""))), r.count);
  // The all panel is the block's own figures: nothing about the total changes.
  assert.deepEqual(all?.rows.map((r) => r.count), find(view, "ranking-field_a")?.rows.map((r) => r.count));
  assert.equal(all?.canvas, "/canvas/?asked", "the address of the question for all of them has no condition");
});

test("each condition's panel has its own link that keeps the question to that condition", () => {
  const view = latestMonthView(kit());
  assert.equal(panel(view, "ranking-field_b", "Newish")?.canvas, `/canvas/?asked&where=${JSON.stringify({ cond: ["x"] })}`);
  assert.equal(panel(view, "ranking-field_b", "Oldish")?.canvas, `/canvas/?asked&where=${JSON.stringify({ cond: ["y"] })}`);
  assert.match(panel(view, "ranking-field_b", "Newish")?.canvasLabel ?? "", /newish things.*open in the canvas$/);
});

test("a field the build caps ranks a value on a part of its count only above the fewest any named value has", () => {
  const view = latestMonthView(kit({ floors: { field_b: 99 } }));
  // p3 has 98 newish vehicles: below the floor, a value the cap hid might have more, so it is not placed. p1 has 100 and is.
  assert.deepEqual(panel(view, "ranking-field_b", "Newish")?.rows.map((r) => r.name), ["p2", "p1"]);
  // The all panel ranks by the slice's own count, as before.
  assert.deepEqual(panel(view, "ranking-field_b", "All")?.rows.map((r) => r.name), ["p1", "p2", "p3"]);
});

test("the movers' minimum and floors apply to the condition's own counts, and a panel with none says so", () => {
  const view = latestMonthView(kit());
  const oldish = panel(view, "movers-field_b", "Oldish");
  assert.deepEqual(oldish?.rows.map((r) => [r.name, r.count, r.prior, r.change?.text]), [["p1", "400", "200", "+100%"]]);
  const newish = panel(view, "movers-field_b", "Newish");
  assert.deepEqual(newish?.rows.map((r) => [r.name, r.change?.text]), [["p2", "−15%"]]);
  const none = latestMonthView(kit({ blocks: [block("total", undefined), block("movers", "field_b", { each: 2, minimum: 1000, least: 0.05, views: true })] }));
  assert.equal(find(none, "movers-field_b"), undefined, "no move for all of them: no block");
  const some = latestMonthView(kit({ blocks: [block("total", undefined), block("movers", "field_b", { each: 2, minimum: 300, least: 0.05, views: true })] }));
  // For all of them p1 had 300 a year ago and 500 now, so the block is drawn; among newish things no value has 300, and among oldish things p1 had 200 a year ago.
  assert.equal(panel(some, "movers-field_b", "Newish")?.empty, "No field B has 300 or more newish things in both months to compare.");
  assert.equal(panel(some, "movers-field_b", "Oldish")?.empty, "No field B has 300 or more oldish things in both months to compare.");
  assert.equal(panel(some, "movers-field_b", "Newish")?.rows.length, 0);
  assert.equal(panel(some, "movers-field_b", "All")?.rows[0].name, "p1");
});

test("a split is of the condition's own total, with its own shares", () => {
  const view = latestMonthView(kit({ blocks: [block("total", undefined), block("split", "field_a", { views: true })] }));
  const newish = panel(view, "split-field_a", "Newish");
  // 290 of 490 newish things are beta's; 200 are alpha's.
  assert.deepEqual(newish?.rows.map((r) => [r.name, r.count, r.share]), [["beta", "290", "59.2%"], ["alpha", "200", "40.8%"]]);
  assert.match(newish?.sentences[0] ?? "", /^Among newish things, by field A, beta is the largest group: 59\.2% of the newish things counted in Oct 2026/);
  assert.deepEqual(panel(view, "split-field_a", "All")?.columns.map((c) => c.key), ["name", "part0", "part1", "count", "share", "points"]);
});

test("a cut that is missing for any block leaves the section as it was: no switch, no views, no parts of the total's sentence lost", () => {
  const base = latestMonthView(kit({ noViews: true }));
  assert.equal(base?.switch, undefined);
  assert.ok(base?.blocks.every((b) => b.views === undefined));
  const lacking = kit();
  const missing = latestMonthView({ ...lacking, views: { ...lacking.views!, cuts: { field_a: cutOf("field_a") } } });
  assert.equal(missing?.switch, undefined);
  assert.ok(missing?.blocks.every((b) => b.views === undefined));
  // The block's own figures are the same with or without views.
  const withViews = latestMonthView(kit());
  for (const b of base?.blocks ?? []) assert.deepEqual(find(withViews, b.id)?.rows.map(({ parts, ...r }) => r), b.rows.map(({ parts, ...r }) => r), b.id);
  // A link the canvas cannot answer for a condition takes the views away, not the block.
  const noLink = latestMonthView(kit({ link: (_b, where) => (where ? undefined : "/canvas/?asked") }));
  assert.equal(noLink?.switch, undefined);
  assert.ok(find(noLink, "ranking-field_b"));
});

test("with one condition, or too many for the switch, there are no views", () => {
  const k = kit();
  const one = latestMonthView({ ...k, views: { ...k.views!, conditions: [k.views!.conditions[0]] } });
  assert.equal(one?.switch, undefined);
  const many = Array.from({ length: 5 }, (_, i) => ({ value: `c${i}`, label: `C${i}`, phrase: `c${i}` }));
  assert.equal(latestMonthView({ ...k, views: { ...k.views!, conditions: many } })?.switch, undefined);
});
