// A brand beside its nearest rivals (src/lib/rivals.ts, src/lib/answerPeriods.ts): two above and two below by the 12-month count, four rivals at either end, only brands
// with a page, a hidden rival skipped for the next, the same set in every window and condition, and the gap sentence dropped on a tie.
import "./support/register.mjs";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const { gapAgainst, nearestRivals } = await import("../../src/lib/rivals.ts");
const { Cut } = await import("../../src/lib/conditionViews.ts");
const { rivalsPanel } = await import("../../src/lib/answerPeriods.ts");
const { windowsFor } = await import("../../src/lib/windows.ts");
type FactColumns = import("../../src/lib/conditionViews.ts").FactColumns;

const RANKED = ["a", "b", "c", "d", "e", "f", "g", "h"];

test("two above and two below, in rank order", () => {
  assert.deepEqual(nearestRivals("d", RANKED), ["b", "c", "d", "e", "f"]);
});

test("at either end the set shifts so that four rivals always show", () => {
  assert.deepEqual(nearestRivals("a", RANKED), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(nearestRivals("b", RANKED), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(nearestRivals("h", RANKED), ["d", "e", "f", "g", "h"]);
  assert.deepEqual(nearestRivals("g", RANKED), ["d", "e", "f", "g", "h"]);
  assert.deepEqual(nearestRivals("a", ["a", "b", "c"]), ["a", "b", "c"]);
  assert.equal(nearestRivals("z", RANKED), undefined);
});

test("a brand left out of the ranking (no page, or a hidden count) is never a rival, and the next one stands in", () => {
  const ranked = RANKED.filter((v) => v !== "c");
  assert.ok(!nearestRivals("d", ranked)!.includes("c"));
  assert.deepEqual(nearestRivals("d", ranked), ["a", "b", "d", "e", "f"]);
});

test("the gap is against the rival just above, or just below for the first of the set", () => {
  const set = ["b", "c", "d", "e", "f"];
  assert.equal(gapAgainst("d", set), "c");
  assert.equal(gapAgainst("b", set), "c");
  assert.equal(gapAgainst("b", ["b"]), undefined);
});

// A made-up market: three brands over two months, new and used.
const rows: [string, string, string, number][] = [];
for (const month of ["2026-08", "2026-09", "2026-10", "2025-08", "2025-09", "2025-10"]) {
  rows.push([month, "A", "x", 100], [month, "A", "y", 20], [month, "B", "x", 100], [month, "B", "y", 5], [month, "C", "x", 40]);
}
const facts: FactColumns = { month: rows.map((r) => r[0]), n: rows.map((r) => r[3]), values: { brand: rows.map((r) => r[1]), cond: rows.map((r) => r[2]) } };
const cut = Cut.from(facts, "brand", "cond", ["x", "y"])!;
const words: Record<string, string> = {
  heading_rivals_view: "{name} beside its nearest rivals: {view}",
  col_brand: "Brand",
  col_vehicles: "Vehicles",
  col_share_all: "Share",
  col_place: "Place",
  col_change: "Change",
  col_change_all: "Change in all",
  place_cell: "{rank} of {of}",
  this_brand: "this brand",
  new_entry: "New entry",
  level: "Level",
  hidden: "hidden",
  view_all: "All",
  view_all_phrase: "all vehicles",
  view_empty_window: "none",
  rival_gap_more: "{name} had {gap} more vehicles than {rival} {window}.",
  rival_gap_fewer: "{name} had {gap} fewer vehicles than {rival} {window}.",
  rival_gap_more_view: "Among {view}, {name} had {gap} more vehicles than {rival} {window}.",
  rival_gap_fewer_view: "Among {view}, {name} had {gap} fewer vehicles than {rival} {window}.",
};
const windows = windowsFor("2026-10");
const env = {
  words,
  windows,
  defaultIndex: 2,
  conditions: [{ value: "x", label: "New", phrase: "new vehicles" }, { value: "y", label: "Used imports", phrase: "used imports" }],
  has: () => true,
  floors: { change: 50, share: 100 },
  comparable: () => true as boolean | undefined,
  phrase: { window: () => "in the window", prior: () => "in the window a year earlier" },
  share: (x: number) => `${(x * 100).toFixed(1)}%`,
  counted: (n: number) => String(n),
  monthsText: () => "",
  moverPerMonth: 100,
};
const ask = (value: string, set: string[]) => ({ value, name: value, set, cut, dimension: "brand", nameOf: (v: string) => v, href: (v: string) => `/${v}/`, reservedMost: () => 0, link: () => undefined });

test("the same brands are in every panel, in the same order, with the page's own marked", () => {
  const set = ["A", "B", "C"];
  const panels = windows.flatMap((w) => [env.conditions[0], env.conditions[1], undefined].map((c, ci) => rivalsPanel(env as never, ask("B", set) as never, w, c as never, w.index, ci)!));
  assert.ok(panels.every(Boolean));
  for (const p of panels) {
    assert.deepEqual(p.rows.map((r) => r.name), set);
    assert.deepEqual(p.rows.map((r) => r.marked !== undefined), [false, true, false]);
  }
});

test("the gap sentence is against the rival above, says more or fewer, and is dropped on a tie", () => {
  const month = windows[0];
  const all = rivalsPanel(env as never, ask("B", ["A", "B", "C"]) as never, month, undefined, 0, 2)!;
  // A has 120 and B 105 in a month: B had 15 fewer vehicles than A
  assert.match(all.sentences[0], /^B had 15 fewer vehicles than A /);
  const aboveC = rivalsPanel(env as never, ask("C", ["A", "B", "C"]) as never, month, undefined, 0, 2)!;
  assert.match(aboveC.sentences[0], /^C had 65 fewer vehicles than B /);
  const first = rivalsPanel(env as never, ask("A", ["A", "B", "C"]) as never, month, undefined, 0, 2)!;
  assert.match(first.sentences[0], /^A had 15 more vehicles than B /);
  // under new vehicles alone A and B are level at 100 each: no sentence
  const tie = rivalsPanel(env as never, ask("B", ["A", "B", "C"]) as never, month, env.conditions[0] as never, 0, 0)!;
  assert.deepEqual(tie.sentences, []);
});

const real = existsSync(join("public", "data", "manifest.json"));
test("on the real build every brand page's rivals are the two above and the two below by the 12-month count, the same in every panel", { skip: !real }, async () => {
  const { answerPagesSite } = await import("../../src/lib/answerPagesBuild.ts");
  const { readPublished } = await import("../../src/lib/publishedFiles.mjs");
  const manifest = JSON.parse(readFileSync(join("public", "data", "manifest.json"), "utf8"));
  const site = await answerPagesSite(manifest, readPublished);
  const brands = site!.pages.filter((p) => p.kind === "brand");
  assert.ok(brands.length > 50);
  const figure = (p: (typeof brands)[number]) => Number(p.figure.replace(/,/g, ""));
  const ranked = [...brands].sort((a, b) => figure(b) - figure(a) || (a.value < b.value ? -1 : 1)).map((p) => p.value);
  for (const p of brands) {
    const rivals = p.scope!.sections.find((s) => s.id === "rivals")!;
    const names = rivals.panels.map((x) => x.rows.map((r) => r.name).join("|"));
    assert.equal(new Set(names).size, 1, `${p.value}: one set for every window and condition`);
    const expected = nearestRivals(p.value, ranked)!;
    const shown = rivals.panels[0].rows.map((r) => brands.find((b) => b.name === r.name)?.value);
    assert.deepEqual(shown, expected, p.value);
    assert.equal(shown.length, Math.min(5, ranked.length));
  }
});
