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
const DATASET = "registrations_flow";

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
