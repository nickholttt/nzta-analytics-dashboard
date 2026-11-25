// The canvas has a period of the last 3 months (config/dimensions.json, periods): a ranking is offered over it, spans 3 months, and is set beside the same 3 months
// a year earlier; and a link that asks for it reads back as asked.
import "./support/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { realisticBuilt } from "./support/observe.ts";

const config = await import("../../src/lib/config.ts");
const { rankingWindows } = await import("../../src/lib/sentences.ts");
const { latestMonthLink } = await import("../../src/lib/latestMonthLinks.ts");
const canvas = await import("../../src/lib/canvas.ts");
const builder = await import("../../src/lib/builder.ts");
const { periodWindow } = await import("../../src/lib/measures.ts");

test("the 3-month period is a period of 3 months, between the month and the 12 months", () => {
  assert.equal(config.findPeriod("latest_3m")?.months, 3);
  const months = config.periods.filter((p) => p.months !== undefined && p.months <= 12).map((p) => p.months);
  assert.deepEqual([...months].sort((a, b) => (a as number) - (b as number)), [1, 3, 12]);
});

test("a ranking over it spans the 3 months to the newest and is set beside the same 3 months a year earlier", () => {
  const span = config.findPeriod("latest_3m")?.months as number;
  const w = rankingWindows("2026-10", span);
  assert.equal(w.currentFrom, "2026-08");
  assert.equal(w.priorFrom, "2025-08");
  assert.equal(w.priorTo, "2025-10");
  assert.deepEqual(periodWindow("latest_3m", "2021-01", "2026-10"), { from: "2026-08", to: "2026-10" });
});

test("a link that asks for a ranking over the 3 months reads back as asked and writes back unchanged", () => {
  const built = realisticBuilt();
  const all = canvas.canvasVocabulary(builder.builderVocabulary(built));
  const link = latestMonthLink(all, built, { dataset: "registrations_flow", measure: "count", by: "make", type: "league", settings: { period: "latest_3m" } });
  assert.ok(link);
  const url = new URL(link, "https://site.example");
  assert.deepEqual(canvas.chartSettings(url.search, "c1"), [["period", "latest_3m"]]);
  const opened = canvas.withFittingTypes(canvas.settleCanvas(all, canvas.readCanvas(url.search)), built);
  assert.equal(opened.charts[0].type, "league");
  assert.deepEqual([...canvas.canvasAddress(url.search, opened)].sort(), [...url.searchParams].sort());
});
