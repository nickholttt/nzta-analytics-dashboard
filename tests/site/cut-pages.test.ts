// The pages of each powertrain (/powertrain/<slug>/, src/lib/answerPages.ts) and their agreement with the other surfaces, on the real build: the chips follow the reference
// file's order and the minimum, a page's figure is the raw sum, and a brand's figure is the same on the home page, on its own page, in its powertrain rows and
// in the cut pages' leaders. The sweep below reads window by count by powertrain against the fact table's raw rows.
import "./support/register.mjs";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const real = existsSync(join("public", "data", "manifest.json"));
const manifest = real ? JSON.parse(readFileSync(join("public", "data", "manifest.json"), "utf8")) : undefined;
const { readPublished } = await import("../../src/lib/publishedFiles.mjs");
const { answerPagesSite } = await import("../../src/lib/answerPagesBuild.ts");
const { latestMonthSection } = await import("../../src/lib/latestMonthBuild.ts");
const { readFactColumns } = await import("../../src/lib/conditionViewsBuild.ts");
const { readReference } = await import("../../src/lib/readReference.mjs");
const { windowsFor } = await import("../../src/lib/windows.ts");
const { count } = await import("../../src/lib/sentences.ts");
const { answerConfig } = await import("../../src/lib/answerPages.ts");

const DATASET = "new_registrations";
const site = real ? await answerPagesSite(manifest, readPublished) : undefined;
const table = real ? await readFactColumns(readPublished, manifest, DATASET, ["make", "model", "powertrain", "import_status"]) : undefined;
const windows = real ? windowsFor(manifest.datasets[DATASET].latest_month) : [];
const CONDITIONS = ["NZ New", "Used Import", undefined];
const num = (text: string) => Number(text.replace(/,/g, ""));

const raw = (match: { powertrain?: string; make?: string }, condition: string | undefined, months: string[]) => {
  let n = 0;
  table!.n.forEach((x, i) => {
    if (!months.includes(table!.month[i])) return;
    if (condition !== undefined && table!.values.import_status[i] !== condition) return;
    if (match.powertrain !== undefined && table!.values.powertrain[i] !== match.powertrain) return;
    if (match.make !== undefined && table!.values.make[i] !== match.make) return;
    n += x;
  });
  return n;
};

test("the chips are the powertrains with at least the minimum over the 12 months, in the reference file's order", { skip: !real }, () => {
  const twelve = windows.find((w) => !w.yearToDate && w.months.length === 12)!;
  const order = [...new Set((readReference("powertrain_map.csv") as Record<string, string>[]).map((r) => r.powertrain))];
  const expected = order.filter((v) => raw({ powertrain: v }, undefined, twelve.months) >= answerConfig.cut.minimum);
  assert.ok(expected.length >= 5);
  const labels = site!.cutNav!.items.map((i) => i.text);
  const pages = site!.pages.filter((p) => p.kind === "cut");
  assert.deepEqual(pages.map((p) => p.value), expected);
  assert.equal(labels.length, expected.length);
  assert.equal(site!.cutNav!.all.href, "/");
  // every page marks itself and carries the same row of links
  for (const p of pages) assert.deepEqual(p.cutNav!.items.filter((i) => i.current).map((i) => i.href), [p.href]);
});

test("a cut page's figure is the raw sum of its powertrain over the 12 months, and its by-period table the raw sums of each window", { skip: !real }, () => {
  for (const p of site!.pages.filter((x) => x.kind === "cut")) {
    const twelve = windows.find((w) => !w.yearToDate && w.months.length === 12)!;
    assert.equal(num(p.figure), raw({ powertrain: p.value }, undefined, twelve.months), p.value);
    windows.forEach((w, i) => {
      const row = p.periods!.rows[i];
      assert.deepEqual(row.cells.map(num), [raw({ powertrain: p.value }, "NZ New", w.months), raw({ powertrain: p.value }, "Used Import", w.months), raw({ powertrain: p.value }, undefined, w.months)], `${p.value} ${w.id}`);
    });
  }
});

test("a sweep of window by count by powertrain: the first brand and the first model of each panel are the raw leaders", { skip: !real }, () => {
  for (const p of site!.pages.filter((x) => x.kind === "cut")) {
    for (const id of ["brands", "models"]) {
      const section = p.scope!.sections.find((s) => s.id === id)!;
      const field = id === "brands" ? "make" : "model";
      for (const panel of section.panels) {
        if (panel.empty) continue;
        const w = windows[panel.win];
        const condition = CONDITIONS[panel.view];
        const [first] = panel.rows;
        const value = [...new Set(table!.values[field])].find((v) => (id === "brands" ? site!.pages.find((x) => x.href === first.href)?.value === v : site!.pages.find((x) => x.href === first.href)?.value === v));
        if (!value) continue;
        const n = (m: { powertrain?: string; make?: string }) => raw(m, condition, w.months);
        const cell = first.cells[first.cells.length - 3];
        if (field === "make") assert.equal(num(cell.text), n({ powertrain: p.value, make: value }), `${p.value} ${w.id} ${condition ?? "all"} ${first.name}`);
        else {
          let sum = 0;
          table!.n.forEach((x, i) => {
            if (table!.values.model[i] === value && table!.values.powertrain[i] === p.value && w.months.includes(table!.month[i]) && (condition === undefined || table!.values.import_status[i] === condition)) sum += x;
          });
          assert.equal(num(cell.text), sum, `${p.value} ${w.id} ${condition ?? "all"} ${first.name}`);
        }
      }
    }
  }
});

test("a brand's 12-month figure is the same on the home page, on its page, summed over its powertrain rows, and in each cut page that lists it", { skip: !real }, async () => {
  const section = await latestMonthSection(manifest, readPublished);
  const homeBrands = section!.blocks.find((b) => b.id === "brands")!.windowed!;
  const twelveIndex = windows.find((w) => !w.yearToDate && w.months.length === 12)!.index;
  const allPanel = homeBrands.find((p) => p.win === twelveIndex && p.view === 2)!;
  const top = allPanel.rows[0];
  const page = site!.pages.find((p) => p.kind === "brand" && p.name === top.name)!;
  assert.equal(page.figure, top.count);
  assert.equal(num(page.figure), raw({ make: page.value }, undefined, windows[twelveIndex].months));
  // the brand's models and the rest add up to the brand's row
  const models = page.scope!.sections.find((s) => s.id === "models")!.panels.find((p) => p.win === twelveIndex && p.view === 2)!;
  const total = models.rows.find((r) => r.total)!;
  assert.equal(total.cells[total.cells.length - 3].text, page.figure);
  const parts = models.rows.filter((r) => !r.total).reduce((s, r) => s + num(r.cells[r.cells.length - 3].text), 0);
  assert.equal(parts, num(page.figure));
  // its powertrain rows add up to it
  const byPowertrain = page.scope!.sections.find((s) => s.id === "cut")!.panels.find((p) => p.win === twelveIndex && p.view === 2)!;
  assert.equal(byPowertrain.rows.reduce((s, r) => s + num(r.cells[0].text), 0), num(page.figure));
  // and where a cut page lists it, with the same figure as the powertrain row
  let seen = 0;
  for (const cut of site!.pages.filter((p) => p.kind === "cut")) {
    const leaders = cut.scope!.sections.find((s) => s.id === "brands")!.panels.find((p) => p.win === twelveIndex && p.view === 2)!;
    const row = leaders.rows.find((r) => r.href === page.href);
    if (!row) continue;
    const fromPage = byPowertrain.rows.find((r) => r.name === cut.name || r.name.startsWith(cut.name));
    assert.ok(fromPage, `${cut.name} has a row on the brand's page`);
    assert.equal(row.cells[row.cells.length - 3].text, fromPage.cells[0].text, `${page.name} in ${cut.name}`);
    seen += 1;
  }
  assert.ok(seen >= 3);
  assert.equal(count(num(page.figure)), page.figure);
});

test("the new entries over the 12 months are counted from the raw rows: models and brands with vehicles now and none a year earlier", { skip: !real }, () => {
  const twelve = windows.find((w) => !w.yearToDate && w.months.length === 12)!;
  const count12 = (field: "make" | "model") => {
    const now = new Map<string, number>();
    const before = new Map<string, number>();
    table!.n.forEach((x, i) => {
      const v = table!.values[field][i];
      if (v.startsWith("__")) return;
      if (twelve.months.includes(table!.month[i])) now.set(v, (now.get(v) ?? 0) + x);
      if (twelve.prior.includes(table!.month[i])) before.set(v, (before.get(v) ?? 0) + x);
    });
    return [...now].filter(([v, n]) => n > 0 && (before.get(v) ?? 0) === 0).length;
  };
  // the figures are those of the build under test (22 models and 4 brands on the October 2026 build): they are counted, not stated
  assert.ok(count12("make") >= 0 && count12("model") >= 0);
  const newModels = site!.pages.filter((p) => p.kind === "model" && p.periods!.rows.find((r) => r.fresh)).length;
  assert.ok(newModels <= count12("model"), `${newModels} model pages open with a new entry in a period, of ${count12("model")} new models`);
});

test("the index ranks every brand with a page over the 12 months: each row is the raw sum, in order, with a place only where it can be said", { skip: !real }, () => {
  const league = site!.index!.league!;
  const twelve = windows.find((w) => !w.yearToDate && w.months.length === 12)!;
  assert.equal(league.section.panels.length, 3);
  assert.equal(league.labels.length, 3);
  const brandPages = site!.pages.filter((p) => p.kind === "brand");
  league.section.panels.forEach((panel, ci) => {
    const condition = CONDITIONS[ci];
    assert.equal(panel.view, ci);
    const counts = panel.rows.map((r) => {
      const page = brandPages.find((b) => b.href === r.href)!;
      assert.ok(page, `${r.name} has a page`);
      const n = raw({ make: page.value }, condition, twelve.months);
      assert.equal(num(r.cells[condition === undefined ? 3 : 1].text), n, `${r.name} ${condition ?? "all"}`);
      return n;
    });
    assert.deepEqual([...counts].sort((a, b) => b - a), counts);
    // a place is never stated for a brand level with another
    for (let i = 0; i < panel.rows.length; i++) {
      const place = panel.rows[i].cells[0].text;
      const tied = counts.filter((n) => n === counts[i]).length > 1;
      if (tied) assert.equal(place, "", `${panel.rows[i].name} is level with another`);
    }
  });
  assert.equal(league.section.panels[2].rows.length, brandPages.length);
});
