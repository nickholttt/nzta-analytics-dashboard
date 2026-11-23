// A canvas chart may carry the id of the Explore preset it stands for (src/lib/presetTitles.ts): the key round-trips through the address,
// it is dropped when the question stops being the preset's, and an id config does not have is refused and said. No title text is ever
// in an address. Run with Node's own test runner:
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { realisticBuilt } from "./support/observe.ts";

const builder = await import("../../src/lib/builder.ts");
const canvas = await import("../../src/lib/canvas.ts");
const { starters, startCanvas, startParams } = await import("../../src/lib/starters.ts");
const { presetQuestion, standsFor, findPreset } = await import("../../src/lib/presetTitles.ts");

const manifest = realisticBuilt();
const all = canvas.canvasVocabulary(builder.builderVocabulary(manifest));
const reopen = (search: string) => canvas.withFittingTypes(canvas.settleCanvas(all, canvas.readCanvas(search)), manifest);
const [first] = starters;
const search = `?${startParams(all, first.charts)}`;

test("the preset's id is one key of the chart in the address, and no title text is", () => {
  const params = new URLSearchParams(search);
  first.charts.forEach((c, i) => assert.equal(params.get(`c${i + 1}.from`), c.from));
  for (const [, value] of params) for (const c of first.charts) assert.notEqual(value, presetQuestion(c.from), "a title is in the address");
});

test("the key round-trips: a link opens a chart titled by its preset and the canvas writes the same key back", () => {
  const opened = reopen(search);
  assert.deepEqual(opened.charts.map((c) => c.preset), first.charts.map((c) => c.from));
  assert.deepEqual(opened.charts.map((c) => canvas.chartHeading(c)), first.charts.map((c) => presetQuestion(c.from)));
  assert.deepEqual([...canvas.canvasAddress(search, opened)].sort(), [...new URLSearchParams(search)].sort());
});

test("the key is dropped, with its title, as soon as the question is no longer the preset's", () => {
  const [chart] = startCanvas(all, first.charts).charts;
  assert.equal(chart.preset, first.charts[0].from);
  // Not a change of question: the chart type and the width keep the title.
  assert.equal(canvas.changeChart(all, chart, {}, manifest).preset, chart.preset);
  // Every change of the question drops it: a second breakdown, a condition, another breakdown, another measure, values chosen.
  const others = all.datasets.find((v) => v.dataset === chart.question.dataset)!.measures.find((m) => m.id === chart.question.measure)!.dimensions;
  const other = others.find((d) => d.id !== chart.question.by)!;
  const changes = [
    { by2: others.find((d) => d.id !== chart.question.by && builder.canCross(chart.question.by as string, d.id))?.id },
    { where: { ...chart.question.where, [other.id]: ["x"] } },
    { by: other.id, values: [] },
    { measure: "count" },
  ];
  for (const change of changes) {
    const changed = canvas.changeChart(all, chart, change, manifest);
    assert.equal(changed.preset, undefined, `${JSON.stringify(change)} kept the title`);
    assert.equal(canvas.chartHeading(changed), undefined);
    const written = canvas.canvasAddress(search, { charts: [changed] }, new Set([changed.id]));
    assert.equal(written.has(`${changed.id}.from`), false, "the key stays in the address");
  }
  // Put back the preset's question and the id is not given back by itself: the heading is the generated title until the link is opened again.
  assert.equal(canvas.changeChart(all, canvas.changeChart(all, chart, { by: other.id, values: [] }, manifest), { by: chart.question.by, values: [] }, manifest).preset, undefined);
});

test("an id config does not have is refused and said, and so is a known id whose question is not the chart's", () => {
  const [asked] = canvas.readCanvas(search);
  const unknown = { ...asked, preset: "no-such-preset" };
  assert.equal(findPreset("no-such-preset"), undefined);
  const chart = canvas.settleChart(all, unknown);
  assert.equal(chart.preset, undefined);
  assert.deepEqual(canvas.presetNotice(unknown, chart), [canvas.say("link_preset_dropped")]);
  assert.ok(canvas.say("link_preset_dropped").length > 0);
  // A real preset on a chart it is not the question of.
  const [, second] = first.charts;
  assert.equal(standsFor(canvas.settleChart(all, asked).question, second.from), false);
  const mismatched = { ...asked, preset: second.from };
  assert.equal(canvas.settleChart(all, mismatched).preset, undefined);
  assert.equal(canvas.presetNotice(mismatched, canvas.settleChart(all, mismatched)).length, 1);
  // A link that names none says nothing, and one that names the right preset says nothing.
  assert.deepEqual(canvas.presetNotice({ ...asked, preset: undefined }, canvas.settleChart(all, { ...asked, preset: undefined })), []);
  assert.deepEqual(canvas.presetNotice(asked, canvas.settleChart(all, asked)), []);
  // Nothing a link holds is ever shown as a title: an unknown id gives no heading.
  assert.equal(canvas.chartHeading(chart), undefined);
});
