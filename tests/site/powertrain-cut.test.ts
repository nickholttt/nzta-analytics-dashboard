// The cut of a field's counts restricted to one value of another (src/lib/powertrainCut.ts): a filtered cut equals hand sums, the cuts of every value add up to the
// cut of all, a cut that disagrees with its slice is refused, and the chips follow the reference file's order and the minimum. Made-up fixtures; the last test
// sweeps window by condition by value over the real build's rows when public/data is there.
import "./support/register.mjs";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const { Cut } = await import("../../src/lib/conditionViews.ts");
const { chipValues, cutSet, firstAppearance } = await import("../../src/lib/powertrainCut.ts");
type FactColumns = import("../../src/lib/conditionViews.ts").FactColumns;
type SliceRow = import("../../src/lib/data.ts").SliceRow;

// month, thing, condition, restricting value, count
const ROWS: [string, string, string, string, number][] = [
  ["2026-10", "a", "x", "p", 700],
  ["2026-10", "a", "x", "q", 105],
  ["2026-10", "a", "y", "p", 15],
  ["2026-10", "b", "y", "q", 50],
  ["2026-09", "a", "x", "p", 600],
  ["2026-09", "b", "x", "p", 20],
  ["2026-09", "b", "y", "q", 5],
];
const facts = (rows = ROWS): FactColumns => ({ month: rows.map((r) => r[0]), n: rows.map((r) => r[4]), values: { thing: rows.map((r) => r[1]), cond: rows.map((r) => r[2]), kind: rows.map((r) => r[3]) } });
const slice = (rows: [string, string, number][]): SliceRow[] => rows.map(([month, value, n]) => ({ month, value, n, denominator: 0 }));
const THING = slice([["2026-10", "a", 820], ["2026-10", "b", 50], ["2026-09", "a", 600], ["2026-09", "b", 25]]);
const KIND = slice([["2026-10", "p", 715], ["2026-10", "q", 155], ["2026-09", "p", 620], ["2026-09", "q", 5]]);

test("a filtered cut equals the hand sums of the rows with that value", () => {
  const p = Cut.from(facts(), "thing", "cond", ["x", "y"], { field: "kind", value: "p" })!;
  assert.equal(p.at("a", "x", "2026-10"), 700);
  assert.equal(p.at("a", "y", "2026-10"), 15);
  assert.equal(p.at("b", "y", "2026-10"), 0);
  assert.equal(p.sum("a", "x", ["2026-09", "2026-10"]), 1300);
  const q = Cut.from(facts(), "thing", "cond", ["x", "y"], { field: "kind", value: "q" })!;
  assert.equal(q.all("a", "2026-10"), 105);
  assert.equal(Cut.from(facts(), "thing", "cond", [], { field: "missing", value: "p" }), undefined);
});

test("the cuts of every value add up to the cut of all, and the cut of the restricting field agrees with its slice", () => {
  const set = cutSet(facts(), "cond", ["x", "y"], ["thing"], "kind", { thing: THING, kind: KIND })!;
  assert.ok(set);
  assert.deepEqual([...set.values], ["p", "q"]);
  const all = set.fields.thing.all;
  for (const month of ["2026-09", "2026-10"]) {
    for (const thing of ["a", "b"]) for (const c of ["x", "y"]) {
      assert.equal([...set.fields.thing.by.values()].reduce((s, cut) => s + cut.at(thing, c, month), 0), all.at(thing, c, month));
    }
  }
});

test("a restricting field that disagrees with its slice, or a field that does, is refused", () => {
  const wrongKind = slice([["2026-10", "p", 716], ["2026-10", "q", 155], ["2026-09", "p", 620], ["2026-09", "q", 5]]);
  assert.equal(cutSet(facts(), "cond", ["x", "y"], ["thing"], "kind", { thing: THING, kind: wrongKind }), undefined);
  const wrongThing = slice([["2026-10", "a", 821], ["2026-10", "b", 50], ["2026-09", "a", 600], ["2026-09", "b", 25]]);
  assert.equal(cutSet(facts(), "cond", ["x", "y"], ["thing"], "kind", { thing: wrongThing, kind: KIND }), undefined);
  // a hidden count in the slice cannot be agreed with
  const hidden = KIND.map((r, i) => (i === 0 ? { ...r, n: Number.NaN, hidden: true } : r));
  assert.equal(cutSet(facts(), "cond", ["x", "y"], ["thing"], "kind", { thing: THING, kind: hidden }), undefined);
});

test("a cut whose values do not add up to the whole is refused", () => {
  const cut = Cut.from(facts(), "thing", "cond", ["x", "y"])!;
  const p = Cut.from(facts(), "thing", "cond", ["x", "y"], { field: "kind", value: "p" })!;
  assert.equal(cut.agreesWithSum([p]), false);
  const q = Cut.from(facts(), "thing", "cond", ["x", "y"], { field: "kind", value: "q" })!;
  assert.equal(cut.agreesWithSum([p, q]), true);
});

test("the chips are the values with enough vehicles over the months, in the reference file's order; one that is withheld gives none", () => {
  const months = ["2026-09", "2026-10"];
  const s = slice([["2026-10", "bev", 900], ["2026-09", "bev", 300], ["2026-10", "petrol", 5000], ["2026-10", "mild", 2000], ["2026-10", "rare", 3], ["2026-10", "zzz", 1500]]);
  const order = firstAppearance(["petrol", "petrol", "bev", "mild", "rare"]);
  assert.deepEqual(order, ["petrol", "bev", "mild", "rare"]);
  assert.deepEqual(chipValues(s, months, 1000, order), ["petrol", "bev", "mild", "zzz"]);
  // the order does not move with the counts
  const flipped = s.map((r) => (r.value === "petrol" ? { ...r, n: 1 } : r.value === "mild" ? { ...r, n: 9000 } : r));
  assert.deepEqual(chipValues(flipped, months, 1000, order), ["bev", "mild", "zzz"]);
  assert.deepEqual(chipValues(undefined, months, 1000, order), []);
  // a withheld mild split leaves no row for the value, so it has no chip
  assert.deepEqual(chipValues(s.filter((r) => r.value !== "mild"), months, 1000, order), ["petrol", "bev", "zzz"]);
});

const real = existsSync(join("public", "data", "manifest.json"));
test("on the real build, the cuts by powertrain agree with the slices and with a sweep of the raw rows", { skip: !real }, async () => {
  const { readPublished } = await import("../../src/lib/publishedFiles.mjs");
  const { readFactColumns } = await import("../../src/lib/conditionViewsBuild.ts");
  const { readSlice } = await import("../../src/lib/latestMonthBuild.ts");
  const manifest = JSON.parse(readFileSync(join("public", "data", "manifest.json"), "utf8"));
  const dataset = "registrations_flow";
  const table = await readFactColumns(readPublished, manifest, dataset, ["make", "model", "powertrain", "import_status"]);
  assert.ok(table);
  const slices: Record<string, SliceRow[] | undefined> = {};
  for (const f of ["make", "model", "powertrain"]) slices[f] = await readSlice(readPublished, manifest, dataset, f);
  const set = cutSet(table, "import_status", ["NZ New", "Used Import"], ["make", "model"], "powertrain", slices)!;
  assert.ok(set, "the real cuts hold to their slices");
  const months = ["2026-08", "2026-09", "2026-10"];
  for (const [field, c, p] of [["make", "NZ New", "BEV"], ["make", "Used Import", "Hybrid"], ["model", "NZ New", "Petrol"]] as const) {
    const by = new Map<string, number>();
    table.n.forEach((n, i) => {
      if (months.includes(table.month[i]) && table.values.import_status[i] === c && table.values.powertrain[i] === p) by.set(table.values[field][i], (by.get(table.values[field][i]) ?? 0) + n);
    });
    const cut = set.fields[field].by.get(p)!;
    for (const [value, n] of by) assert.equal(cut.sum(value, c, months), n);
  }
});
