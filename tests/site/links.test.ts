// The canvas links the home page, the brand and model pages, the powertrain pages and the index carry (src/lib/latestMonthLinks.ts): each reads back through the canvas's
// own reader as the page says (dataset, field, values, conditions, type and period), draws, carries no notice, and writes back the same address; a link for a
// period the canvas does not have is withheld; and the forms' fields, as a browser sends them, read back as the page says.
import "./support/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { realisticBuilt } from "./support/observe.ts";

const canvas = await import("../../src/lib/canvas.ts");
const builder = await import("../../src/lib/builder.ts");
const { latestMonthLink } = await import("../../src/lib/latestMonthLinks.ts");
const { windowsConfig } = await import("../../src/lib/windows.ts");
const { findPeriod } = await import("../../src/lib/config.ts");

const built = realisticBuilt();
const all = canvas.canvasVocabulary(builder.builderVocabulary(built));
const DATASET = "new_registrations";

// Opens an address as the canvas does and reports what it asks.
function open(link: string) {
  const url = new URL(link, "https://site.example");
  const asked = canvas.readCanvas(url.search);
  const opened = canvas.withFittingTypes(canvas.settleCanvas(all, asked), built);
  const chart = opened.charts[0];
  return { url, asked, opened, chart, q: chart.question, period: Object.fromEntries(canvas.chartSettings(url.search, "c1")).period };
}

test("a ranking of a brand and its rivals over a window reads back with those values, the condition, the type and the period", () => {
  const link = latestMonthLink(all, built, { dataset: DATASET, measure: "count", by: "make", type: "league", values: ["TOYOTA", "FORD", "MAZDA"], where: { import_status: ["NZ New"] }, settings: { period: "latest_3m" } });
  assert.ok(link);
  const { url, asked, opened, chart, q, period } = open(link);
  assert.equal(q.dataset, DATASET);
  assert.equal(q.by, "make");
  assert.deepEqual([...q.values].sort(), ["FORD", "MAZDA", "TOYOTA"]);
  assert.deepEqual({ ...q.where }, { import_status: ["NZ New"] });
  assert.equal(chart.type, "league");
  assert.equal(period, "latest_3m");
  assert.deepEqual(builder.linkNotices(all, asked[0].asked, q), []);
  assert.ok(canvas.draws(q, chart.type ?? canvas.bestType(q), built));
  assert.deepEqual([...canvas.canvasAddress(url.search, opened)].sort(), [...url.searchParams].sort());
});

test("a brand's models cut to a powertrain, ranked over a window and a condition, read back as asked", () => {
  const link = latestMonthLink(all, built, { dataset: DATASET, measure: "count", by: "model", type: "league", where: { make: ["TOYOTA"], powertrain: ["BEV"], import_status: ["Used Import"] }, settings: { period: "latest_year" } });
  assert.ok(link);
  const { q, period, chart } = open(link);
  assert.equal(q.by, "model");
  assert.deepEqual({ ...q.where }, { make: ["TOYOTA"], powertrain: ["BEV"], import_status: ["Used Import"] });
  assert.equal(period, "latest_year");
  assert.equal(chart.type, "league");
});

test("a link is withheld for a period the canvas does not have, and for values the chart would not keep", () => {
  assert.equal(latestMonthLink(all, built, { dataset: DATASET, measure: "count", by: "make", type: "league", settings: { period: "year_to_date" } }), undefined);
  assert.ok(latestMonthLink(all, built, { dataset: DATASET, measure: "count", by: "make", type: "league", settings: { period: "latest_month" } }));
  // more values than a chart keeps would settle to fewer: withheld, never a different chart
  const many = Array.from({ length: 60 }, (_, i) => `BRAND${i}`);
  assert.equal(latestMonthLink(all, built, { dataset: DATASET, measure: "count", by: "make", type: "league", values: many }), undefined);
});

test("every window's canvas period is one the canvas has, or its link is withheld by that rule", () => {
  for (const w of windowsConfig.windows) {
    const link = latestMonthLink(all, built, { dataset: DATASET, measure: "count", by: "make", type: "league", settings: { period: w.canvas_period } });
    assert.equal(link !== undefined, findPeriod(w.canvas_period) !== undefined, w.id);
  }
});

// ---- Every link the generated pages carry, read back, on the real build ----

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const real = existsSync(join("public", "data", "manifest.json"));
test("every canvas link in a brand page's rivals and powertrain tables, and a model page's two more, reads back as the panel says", { skip: !real }, async () => {
  const { answerPagesSite } = await import("../../src/lib/answerPagesBuild.ts");
  const { readPublished } = await import("../../src/lib/publishedFiles.mjs");
  const { windowsFor } = await import("../../src/lib/windows.ts");
  const manifest = JSON.parse(readFileSync(join("public", "data", "manifest.json"), "utf8"));
  const site = await answerPagesSite(manifest, readPublished);
  const windows = windowsFor(manifest.datasets[DATASET].latest_month);
  const conditions = ["NZ New", "Used Import", undefined];
  const opens = canvas.canvasVocabulary(builder.builderVocabulary(manifest));
  const read = (href: string) => {
    const url = new URL(href, "https://site.example");
    const asked = canvas.readCanvas(url.search);
    const opened = canvas.withFittingTypes(canvas.settleCanvas(opens, asked), manifest);
    const chart = opened.charts[0];
    assert.deepEqual(builder.linkNotices(opens, asked[0].asked, chart.question), [], href);
    assert.ok(canvas.draws(chart.question, chart.type ?? canvas.bestType(chart.question), manifest), href);
    assert.deepEqual([...canvas.canvasAddress(url.search, opened)].sort(), [...url.searchParams].sort(), href);
    return { q: chart.question, type: chart.type, period: Object.fromEntries(canvas.chartSettings(url.search, "c1")).period };
  };
  let rivalLinks = 0;
  let rowLinks = 0;
  for (const page of site!.pages.filter((p) => p.kind === "brand").slice(0, 25)) {
    for (const section of page.scope!.sections) {
      for (const p of section.panels) {
        const w = windows[p.win];
        const condition = conditions[p.view];
        const where = (q: { where: Record<string, string[]> }) => ({ ...q.where });
        for (const l of p.links ?? []) {
          const { q, type, period } = read(l.href);
          assert.equal(q.by, "make");
          assert.equal(q.values.length, p.rows.length);
          assert.deepEqual(where(q), condition ? { import_status: [condition] } : {});
          if (l.href.includes("c1.type=league")) {
            assert.equal(type, "league");
            assert.equal(period, w.canvasPeriod);
          } else {
            assert.equal(type, "trend");
            assert.equal(period, "3y");
          }
          rivalLinks += 1;
        }
        for (const r of section.id === "cut" ? p.rows : []) {
          if (!r.href) continue;
          const { q, type, period } = read(r.href);
          assert.equal(q.by, "model");
          assert.equal(type, "league");
          assert.equal(period, w.canvasPeriod);
          assert.deepEqual(q.where.make, [page.value]);
          assert.equal(q.where.powertrain.length, 1);
          assert.deepEqual(q.where.import_status ?? [], condition ? [condition] : []);
          rowLinks += 1;
        }
      }
    }
  }
  assert.ok(rivalLinks > 100 && rowLinks > 100, `${rivalLinks} rival links, ${rowLinks} row links`);
  for (const page of site!.pages.filter((p) => p.kind === "model").slice(0, 25)) {
    for (const l of page.more ?? []) read(l.href);
    assert.ok((page.more ?? []).length >= 1);
  }
});

// ---- The forms that set brands beside each other, as a browser sends them ----

test("a form's hidden fields and chosen options, flattened as a browser submits them, read back through the canvas as the page says", { skip: !real }, async () => {
  const { answerPagesSite } = await import("../../src/lib/answerPagesBuild.ts");
  const { readPublished } = await import("../../src/lib/publishedFiles.mjs");
  const manifest = JSON.parse(readFileSync(join("public", "data", "manifest.json"), "utf8"));
  const site = await answerPagesSite(manifest, readPublished);
  const opens = canvas.canvasVocabulary(builder.builderVocabulary(manifest));
  const submit = (form: NonNullable<typeof site>["pages"][number]["compare"], choices: Record<number, string>) => {
    const params = new URLSearchParams();
    for (const [name, value] of form!.hidden) params.append(name, value);
    form!.selects.forEach((s, i) => params.append(s.name, choices[i] ?? s.selected));
    return `?${params}`;
  };
  const read = (search: string) => {
    const asked = canvas.readCanvas(search);
    const opened = canvas.withFittingTypes(canvas.settleCanvas(opens, asked), manifest);
    const [chart] = opened.charts;
    assert.deepEqual(builder.linkNotices(opens, asked[0].asked, chart.question), []);
    assert.ok(canvas.draws(chart.question, chart.type ?? canvas.bestType(chart.question), manifest));
    return { q: chart.question, type: chart.type, period: Object.fromEntries(canvas.chartSettings(search, "c1")).period, opened };
  };
  const page = site!.pages.find((p) => p.kind === "brand" && p.href === "/brand/toyota/")!;
  const form = page.compare!;
  const other = (label: string) => form.selects[0].options.find((o) => o.label === label)!.value;
  // the form with this brand fixed: the page's own brand, one more, and the defaults for the rest
  const base = read(submit(form, { 0: other("Mazda") }));
  assert.deepEqual([...base.q.values].sort(), ["MAZDA", "TOYOTA"]);
  assert.equal(base.type, "league");
  assert.equal(base.period, "latest_year");
  assert.deepEqual({ ...base.q.where }, {});
  // two more brands, new vehicles only, a powertrain, the 3 months: spaces go as +
  const full = read(submit(form, { 0: other("Mazda"), 1: other("Ford"), 2: "latest_3m", 3: "NZ New", 4: "BEV" }));
  assert.deepEqual([...full.q.values].sort(), ["FORD", "MAZDA", "TOYOTA"]);
  assert.deepEqual({ ...full.q.where }, { import_status: ["NZ New"], powertrain: ["BEV"] });
  assert.equal(full.period, "latest_3m");
  assert.match(submit(form, { 0: other("Mazda"), 3: "NZ New" }), /c1\.where\.import_status=NZ\+New/);
  // the empty choices ("no further brand", "all vehicles", "any powertrain") ask for nothing and the address is written back without them
  const search = submit(form, { 0: other("Mazda") });
  assert.match(search, /c1\.where\.import_status=&/);
  const again = canvas.canvasAddress(search, base.opened);
  assert.ok(![...again.keys()].some((k) => k.startsWith("c1.where.")));
  // the form on the index: three brands, two required
  const index = site!.index!.compare!;
  assert.deepEqual(index.selects.slice(0, 3).map((s) => s.required), [true, true, false]);
  const pick = (i: number, label: string) => index.selects[i].options.find((o) => o.label === label)!.value;
  const three = read(submit(index, { 0: pick(0, "Toyota"), 1: pick(1, "Ford"), 2: pick(2, "Mazda") }));
  assert.deepEqual([...three.q.values].sort(), ["FORD", "MAZDA", "TOYOTA"]);
  const two = read(submit(index, { 0: pick(0, "Toyota"), 1: pick(1, "Ford") }));
  assert.deepEqual([...two.q.values].sort(), ["FORD", "TOYOTA"]);
  // no form can ask for more brands than the canvas keeps
  assert.ok(index.selects.filter((s) => s.name === index.selects[0].name).length <= 3);
});
