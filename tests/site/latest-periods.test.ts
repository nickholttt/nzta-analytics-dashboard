// The latest month over four windows (src/lib/latestPeriods.ts): on the real build when public/data is there, each window's figure is the sum of its months of the
// fact table's raw rows, a window's prior is the same months a year earlier, the switch's default panels are the ones the markup marks, and the new entries
// of the 12 months are counted against the raw rows.
import "./support/register.mjs";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const real = existsSync(join("public", "data", "manifest.json"));
const manifest = real ? JSON.parse(readFileSync(join("public", "data", "manifest.json"), "utf8")) : undefined;
const { readPublished } = await import("../../src/lib/publishedFiles.mjs");
const { latestMonthSection, readSlice } = await import("../../src/lib/latestMonthBuild.ts");
const { readFactColumns } = await import("../../src/lib/conditionViewsBuild.ts");
const { Cut } = await import("../../src/lib/conditionViews.ts");
const { listWindow, newEntries } = await import("../../src/lib/periodTables.ts");
const { windowsFor } = await import("../../src/lib/windows.ts");
const { count } = await import("../../src/lib/sentences.ts");

const DATASET = "registrations_flow";
const section = real ? await latestMonthSection(manifest, readPublished) : undefined;
const table = real ? await readFactColumns(readPublished, manifest, DATASET, ["make", "model", "import_status"]) : undefined;
const latest = manifest?.datasets?.[DATASET]?.latest_month as string | undefined;
const windows = latest ? windowsFor(latest) : [];

// The raw sum of a field's value over months, for a condition or all, straight from the rows.
const raw = (field: string, value: string, condition: string | undefined, months: string[]) => {
  let n = 0;
  table!.n.forEach((x, i) => {
    if (table!.values[field][i] === value && months.includes(table!.month[i]) && (condition === undefined || table!.values.import_status[i] === condition)) n += x;
  });
  return n;
};

test("the by-period table is the raw sum of each window's months, and its change is on the same months a year earlier", { skip: !real }, () => {
  assert.ok(section?.byPeriod, "the section has a by-period table");
  const rows = section!.byPeriod!.rows;
  assert.equal(rows.length, windows.length);
  windows.forEach((w, i) => {
    const sum = (months: string[], c?: string) => table!.n.reduce((s, x, j) => s + (months.includes(table!.month[j]) && (c === undefined || table!.values.import_status[j] === c) ? x : 0), 0);
    assert.deepEqual(rows[i].cells, [count(sum(w.months, "NZ New")), count(sum(w.months, "Used Import")), count(sum(w.months))]);
    const now = sum(w.months);
    const before = sum(w.prior);
    assert.equal(rows[i].change?.direction, now > before ? "up" : now < before ? "down" : "same");
  });
});

test("every block with views has a panel for each window and each condition and all, and the default window's are the ones marked", { skip: !real }, () => {
  assert.ok(section?.switch?.period);
  const { period } = section!.switch!;
  assert.equal(period.labels.length, windows.length);
  assert.equal(windows[period.checked].id, "month", "the home page opens on the month");
  for (const b of section!.blocks.filter((x) => x.windowed)) {
    const panels = b.windowed!;
    assert.equal(panels.length, windows.length * 3, b.id);
    for (const w of windows) assert.deepEqual(panels.filter((p) => p.win === w.index).map((p) => p.view).sort(), [0, 1, 2], `${b.id} ${w.id}`);
    assert.equal(panels.filter((p) => p.win === period.checked).length, 3);
  }
});

test("a brand's figure in each panel is the raw sum of the window's months, for each condition and for all", { skip: !real }, () => {
  const brands = section!.blocks.find((b) => b.id === "brands")!.windowed!;
  const conditions = ["NZ New", "Used Import", undefined];
  for (const p of brands) {
    const w = windows[p.win!];
    const condition = conditions[p.view!];
    const [first] = p.rows;
    assert.equal(first.count, count(raw("make", first.value!, condition, w.months)), `${w.id} ${condition ?? "all"} ${first.name}`);
    if (condition === undefined) assert.deepEqual(first.parts, [count(raw("make", first.value!, "NZ New", w.months)), count(raw("make", first.value!, "Used Import", w.months))]);
    // a place is not stated twice: rows are in order of the raw counts
    const counts = p.rows.map((r) => raw("make", r.value!, condition, w.months));
    assert.deepEqual([...counts].sort((a, b) => b - a), counts);
  }
});

test("a panel's change is on the same months a year earlier, and a new entry is a value with none then", { skip: !real }, () => {
  const models = section!.blocks.find((b) => b.id === "models")!.windowed!;
  for (const p of models) {
    const w = windows[p.win!];
    const condition = [ "NZ New", "Used Import", undefined][p.view!];
    for (const r of p.rows) {
      const now = raw("model", r.value!, condition, w.months);
      const before = raw("model", r.value!, condition, w.prior);
      if (r.fresh) assert.equal(before, 0);
      if (r.change && r.change.direction === "up") assert.ok(now > before);
      if (r.change && r.change.direction === "down") assert.ok(now < before);
    }
  }
});

test("the new entries of the 12 months are the values with vehicles now and none in the same months a year earlier, counted from the raw rows", { skip: !real }, async () => {
  const slices: Record<string, Awaited<ReturnType<typeof readSlice>>> = {};
  for (const f of ["make", "model", "import_status"]) slices[f] = await readSlice(readPublished, manifest, DATASET, f);
  const twelve = windows.find((w) => w.id === "12m")!;
  const has = (m: string) => slices.import_status!.some((r) => r.month === m);
  for (const [field, expected] of [["make", undefined], ["model", undefined]] as const) {
    const cut = Cut.from(table!, field, "import_status", ["NZ New", "Used Import"])!;
    const list = listWindow(cut, undefined, { window: twelve, has, comparable: () => true, changeFloor: 50 })!;
    const fresh = newEntries(list).map((l) => l.value).sort();
    const byHand = [...new Set(table!.values[field])].filter((v) => !v.startsWith("__") && raw(field, v, undefined, twelve.months) > 0 && raw(field, v, undefined, twelve.prior) === 0).sort();
    assert.deepEqual(fresh, byHand, field);
    assert.ok(expected === undefined);
  }
});
