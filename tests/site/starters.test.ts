// The starter canvases (config/starter_canvases.json, src/lib/starters.ts): each opens as a canvas through the same reading code as a shared
// one, with nothing asked for that the data does not give, and writes back to the same address; each chart is what the Explore preset it
// stands for asks. Run with Node's own test runner:
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { everythingBuilt } from "./support/observe.ts";

const config = await import("../../src/lib/config.ts");
const builder = await import("../../src/lib/builder.ts");
const resolve = await import("../../src/lib/resolve.ts");
const canvas = await import("../../src/lib/canvas.ts");
const { starters, startCanvas, startParams, holds, starterViews } = await import("../../src/lib/starters.ts");
const { presetAsks, presetQuestion } = await import("../../src/lib/presetTitles.ts");

const manifest = everythingBuilt();
const all = canvas.canvasVocabulary(builder.builderVocabulary(manifest));
const entries = (params: URLSearchParams) => [...params].map(([k, v]) => `${k}=${v}`).sort();
const sorted = (where: Record<string, string[]>) =>
  JSON.stringify(
    Object.entries(where)
      .map(([d, v]) => [d, [...v].sort()])
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );

test("there are three or four starters, each with a question for a title, a line, and charts the canvas can hold", () => {
  assert.ok(starters.length >= 3 && starters.length <= 4, `${starters.length} starters`);
  assert.equal(new Set(starters.map((s) => s.id)).size, starters.length);
  for (const s of starters) {
    assert.ok(s.title.endsWith("?"), `${s.id}: the title is a question`);
    assert.ok(s.description.length > 0 && s.description.length <= 200, `${s.id}: the description is a line`);
    assert.ok(s.charts.length >= 1 && s.charts.length <= canvas.canvasSpec.max_charts, `${s.id}: ${s.charts.length} charts`);
  }
});

test("a starter's words are held to the rules every other sentence about the data is (no figure, no cause, no placeholder)", () => {
  const rules = JSON.parse(readFileSync(new URL("../../config/narrative/rules.json", import.meta.url), "utf8")) as { banned_words: string[] };
  for (const s of starters) {
    for (const text of [s.title, s.description]) {
      assert.ok(!/\d/.test(text), `${s.id}: a figure in "${text}"`);
      assert.ok(!/[{}]/.test(text), `${s.id}: a placeholder in "${text}"`);
      for (const word of rules.banned_words) assert.ok(!new RegExp(`\\b${word}\\b`, "i").test(text), `${s.id}: "${word}" in "${text}"`);
    }
  }
});

test("every starter opens as a canvas, charts and all, with nothing asked for that is not given, and writes back to the same address", () => {
  for (const starter of starters) {
    const search = `?${startParams(all, starter.charts)}`;
    // Opened as any shared canvas is: read from the address, settled against the data.
    const asked = canvas.readCanvas(search);
    assert.equal(asked.length, starter.charts.length, `${starter.id}: every chart is in the address`);
    const opened = canvas.withFittingTypes(canvas.settleCanvas(all, asked), manifest);
    assert.equal(opened.charts.length, starter.charts.length);
    starter.charts.forEach((spec, i) => {
      const chart = opened.charts[i];
      const where = `${starter.id} chart ${i + 1} (${spec.from})`;
      const q = chart.question;
      assert.equal(q.dataset, spec.dataset, `${where}: dataset`);
      assert.equal(q.measure, spec.measure, `${where}: measure`);
      assert.equal(q.by, spec.by, `${where}: breakdown`);
      assert.equal(q.by2 ?? null, spec.by2 ?? null, `${where}: second breakdown`);
      assert.equal(sorted(q.where), sorted(spec.where ?? {}), `${where}: conditions`);
      assert.equal(chart.width, spec.width, `${where}: width`);
      assert.equal(chart.type, spec.type, `${where}: the chart type is kept, so the build draws it`);
      assert.deepEqual(builder.linkNotices(all, asked[i].asked, q), [], `${where}: the link asked for something the page did not give`);
      // The chart draws, as the type it opens as, against a build that holds every dataset.
      const type = chart.type ?? canvas.bestType(q);
      assert.ok(canvas.draws(q, type, manifest), `${where}: not drawn as ${type}`);
      assert.ok(holds(all, spec, manifest), `${where}: the page would leave it out`);
    });
    // Written back: the address a canvas writes for what it opened is the address it was opened from, settings and all.
    assert.deepEqual(entries(canvas.canvasAddress(search, opened)), entries(new URLSearchParams(search)), `${starter.id}: the address changes when the canvas is written back`);
    assert.deepEqual(
      startCanvas(all, starter.charts).charts.map((c) => c.id),
      starter.charts.map((_, i) => `${canvas.canvasSpec.chart_prefix}${i + 1}`),
    );
  }
});

test("a chart's own settings are ones the panel reads, and every chart is on one dataset the canvas offers", () => {
  for (const s of starters)
    for (const chart of s.charts) {
      for (const name of Object.keys(chart.settings ?? {})) assert.ok(builder.CHART_PARAMS.includes(name), `${s.id}/${chart.from}: ${name} is not a setting of a chart`);
      assert.ok(all.datasets.some((v) => v.dataset === chart.dataset), `${chart.from}: the canvas does not offer ${chart.dataset}`);
    }
});

test("each chart is the Explore preset it stands for: its question, its shape and its period", () => {
  const seen = new Set<string>();
  for (const s of starters)
    for (const spec of s.charts) {
      const preset = config.presets.find((p) => p.id === spec.from);
      assert.ok(preset, `${spec.from} is not a preset`);
      assert.equal(preset.status, "live", `${spec.from} is not live`);
      assert.ok(!seen.has(spec.from), `${spec.from} is on two starters`);
      seen.add(spec.from);
      const view = resolve.presetView(preset);
      const asks = presetAsks(preset);
      const [made] = startCanvas(all, [spec]).charts;
      assert.equal(made.question.dataset, asks.dataset, `${spec.from}: dataset`);
      assert.equal(made.question.measure, asks.measure, `${spec.from}: measure`);
      assert.equal(made.question.by, asks.by, `${spec.from}: breakdown`);
      assert.equal(made.question.by2 ?? null, asks.by2, `${spec.from}: second breakdown`);
      assert.equal(sorted(made.question.where), sorted(asks.where), `${spec.from}: conditions`);
      assert.equal(made.preset, spec.from, `${spec.from}: the chart is titled by the preset`);
      const opens = canvas.chartPreset(made);
      assert.ok(opens, `${spec.from}: no chart`);
      assert.equal(spec.settings?.period ?? opens.period, preset.period ?? "all", `${spec.from}: period`);
      assert.equal(resolve.resolvePreset(opens, manifest).shape, resolve.resolvePreset(view, manifest).shape, `${spec.from}: shape`);
    }
});

test("the list on the front page holds each starter as a link to the canvas, with the charts the build draws, and leaves out a starter with none", () => {
  const views = starterViews(all, manifest, "/canvas/");
  assert.deepEqual(
    views.map((v) => v.id),
    starters.map((s) => s.id),
  );
  for (const v of views) {
    const starter = starters.find((s) => s.id === v.id)!;
    assert.equal(v.href, `/canvas/?${startParams(all, starter.charts)}`);
    assert.equal(v.charts.length, starter.charts.length);
    assert.deepEqual(
      v.charts,
      starter.charts.map((c) => presetQuestion(c.from)),
      "the list shows the question each chart stands for",
    );
  }
  // A build with only one dataset leaves out the charts of the others, and a starter with none.
  const only = "registrations_surviving";
  const without = { datasets: Object.fromEntries(Object.entries(manifest.datasets).filter(([id]) => id === only)) } as unknown as typeof manifest;
  const fewer = starterViews(canvas.canvasVocabulary(builder.builderVocabulary(without)), without, "/canvas/");
  assert.deepEqual(
    fewer.map((v) => v.id),
    starters.filter((s) => s.charts.some((c) => c.dataset === only)).map((s) => s.id),
  );
  for (const v of fewer) assert.equal(v.charts.length, starters.find((s) => s.id === v.id)!.charts.filter((c) => c.dataset === only).length);
});
