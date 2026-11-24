// A link made for the Build page loads the same chart on the canvas (work order 3, lane A). The old page read a link with readQuestion and
// settle; the canvas reads the address the Build page now sends the visitor on to with readCanvas and settleCanvas. Both sides here are those
// functions, run on the same link, against the same build. Run with Node's own test runner:
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { everythingBuilt } from "./support/observe.ts";

const builder = await import("../../src/lib/builder.ts");
const canvas = await import("../../src/lib/canvas.ts");
const resolve = await import("../../src/lib/resolve.ts");
const { canvasSearchFromBuild } = await import("../../src/lib/buildLink.ts");
const { buildLinkRules } = await import("../../src/lib/buildLinkRules.ts");

type Link = { name: string; link: string };
const fixture = JSON.parse(readFileSync(new URL("./fixtures/build-links.json", import.meta.url), "utf8")) as Record<"held" | "more" | "strange", Link[]>;
const service = (JSON.parse(readFileSync(new URL("../../scripts/query_service_prototype/questions.json", import.meta.url), "utf8")).questions as { id: string; link: string }[]).map(
  (q): Link => ({ name: `query service, ${q.id}`, link: q.link }),
);
const manifest = everythingBuilt();
const buildVocabulary = builder.builderVocabulary(manifest);
const all = canvas.canvasVocabulary(buildVocabulary);
const rules = buildLinkRules();
const links = [...fixture.held, ...service, ...fixture.more];

const named = (name: string): string => (links.find((l) => l.name.includes(name)) as Link).link;
const searchOf = (link: string) => (link.includes("?") ? link.slice(link.indexOf("?")) : "");

// What the old Build page made of the link, and what the canvas makes of the address the Build page sends the visitor on to.
function open(link: string) {
  const search = searchOf(link);
  const question = builder.settle(buildVocabulary, builder.readQuestion(search));
  const redirect = canvasSearchFromBuild(search, rules);
  const charts = canvas.withFittingTypes(canvas.settleCanvas(all, canvas.readCanvas(redirect)), manifest).charts;
  return { search, question, redirect, charts, presets: builder.builderPresets(question) };
}

// The chart's own settings, by name, as an address holds them for the scope.
const settingsOf = (search: string, scope: string) => canvas.chartSettings(search, scope).sort();

test("every link a Build page was given opens as a canvas, one chart for each chart the Build page drew, in the same order", () => {
  for (const { name, link } of links) {
    const { presets, charts, redirect } = open(link);
    assert.equal(charts.length, presets.length, name);
    assert.deepEqual(charts.map((c) => c.id), presets.map((_, i) => `c${i + 1}`), name);
    assert.ok(redirect === "" || redirect.startsWith("?canvas.charts="), name);
  }
  // Guards against a set that proves nothing: the links hold a measure of two parts, which was two charts on the Build page.
  assert.ok(links.some((l) => open(l.link).presets.length === 2));
});

test("each chart asks the question the Build page asked, field by field: dataset, measure, breakdowns, values, conditions and pin", () => {
  let crossed = 0;
  let pinned = 0;
  for (const { name, link } of links) {
    const { question, presets, charts } = open(link);
    // A link that ranks every value is the ranking of the values the chart has: compared below, by what it draws.
    if (question.rankAll) continue;
    charts.forEach((chart, i) => {
      const { view: _build, ...build } = question;
      const { view: _canvas, ...got } = chart.question;
      assert.deepEqual(got, { ...build, measure: presets[i].measure ?? presets[i].derived }, `${name}, chart ${i + 1}`);
      assert.equal(chart.type, question.view, `${name}: the chart type is the view the Build page held`);
    });
    if (question.by2) crossed += 1;
    if (question.snapshot) pinned += 1;
  }
  assert.ok(crossed > 0, "no link of the set keeps a second breakdown");
  assert.ok(pinned > 0, "no link of the set keeps a pin");
});

test("a link that chose a chart type opens as that type, and one that chose none opens as the best fit", () => {
  const chosen = links.map((l) => open(l.link)).filter((o) => o.question.view);
  assert.ok(chosen.length > 0, "no link of the set keeps a chart type");
  for (const { question, charts } of chosen) for (const chart of charts) assert.equal(chart.type, question.view);
  const none = open(named("a share by a group"));
  assert.equal(none.question.view, null);
  assert.equal(none.charts[0].type, null);
});

test("a link that ranks every value opens as a ranking with no values chosen, which draws the same ranking", () => {
  const { question, charts, presets } = open(named("every value"));
  assert.equal(question.rankAll, true);
  assert.ok(question.values.length > 0, "the Build page held values it set aside");
  assert.equal(charts.length, 1);
  assert.equal(charts[0].type, builder.RANKING);
  assert.deepEqual(charts[0].question.values, []);
  const drawn = canvas.chartPreset(charts[0]);
  assert.equal(drawn?.values, undefined);
  assert.equal(drawn?.shape_override, builder.RANKING);
  assert.equal(drawn?.dimension, presets[0].dimension);
  assert.deepEqual(drawn?.where, presets[0].where);
  assert.equal(presets[0].values, undefined, "the Build page ranked every value too");
});

test("each chart is drawn as the Build page drew it: the same shape, from the same figures", () => {
  for (const { name, link } of links) {
    const { presets, charts } = open(link);
    charts.forEach((chart, i) => {
      const was = resolve.resolvePreset(presets[i], manifest);
      const is = resolve.resolvePreset(canvas.chartPreset(chart) as import("../../src/lib/config.ts").Preset, manifest);
      assert.equal(is.shape, was.shape, `${name}, chart ${i + 1}`);
      assert.deepEqual(is.preventsRender, was.preventsRender, `${name}, chart ${i + 1}`);
      assert.deepEqual(is.source, was.source, `${name}, chart ${i + 1}`);
    });
  }
});

test("a chart keeps the settings the Build page kept for it: the first part's under its own scope, a later part's under its own", () => {
  const parts = open(named("setting for each part"));
  assert.equal(parts.charts.length, 2);
  assert.deepEqual(canvas.chartSettings(parts.redirect, "c1"), [["period", "5y"]]);
  assert.deepEqual(canvas.chartSettings(parts.redirect, "c2").sort(), [["period", "1y"], ["range", "all"]]);
  const grid = open(named("cell setting"));
  assert.deepEqual(canvas.chartSettings(grid.redirect, "c1"), [["cells", "column"]]);
  assert.equal(grid.charts[0].question.snapshot, "2026-10");
  // Every setting of every link goes to the chart that had it, and nothing else goes anywhere.
  for (const { name, link } of links) {
    const { search, redirect, presets } = open(link);
    const scopes = presets.map((_, i) => (i === 0 ? "build" : `build-${presets[i].measure}`));
    scopes.forEach((scope, i) => assert.deepEqual(settingsOf(redirect, `c${i + 1}`), settingsOf(search, scope), name));
  }
});

test("a measure of two parts is one chart in a ranking or a grid, as the Build page drew it", () => {
  const ranking = open(named("ranking of a measure of two parts"));
  assert.equal(ranking.presets.length, 1);
  assert.equal(ranking.charts.length, 1);
  assert.equal(ranking.charts[0].question.measure, rules.parts.share_and_count[0]);
  const grid = open(named("grid of a measure of two parts"));
  assert.equal(grid.charts.length, grid.presets.length);
});

test("a Build link with nothing of Build's in it opens the canvas as it opens with nothing asked", () => {
  for (const link of ["/build", "/build/", "/build/?", "/build/?utm_source=x", "/build/#top"]) assert.equal(canvasSearchFromBuild(searchOf(link), rules), "", link);
  const empty = canvas.settleCanvas(all, canvas.readCanvas(""));
  const bare = open("/build/").charts;
  assert.deepEqual(bare, empty.charts.map((c) => ({ ...c, type: null })));
});

test("a link that names something the data lacks, or something that is not a parameter, opens a canvas and throws nothing", () => {
  for (const { name, link } of fixture.strange) {
    assert.doesNotThrow(() => {
      const { charts, redirect } = open(link);
      assert.ok(charts.length >= 1, name);
      // What opened is a canvas the address can hold: it writes back and reads again as the same canvas.
      const again = canvas.withFittingTypes(canvas.settleCanvas(all, canvas.readCanvas(`?${canvas.canvasParams({ charts })}`)), manifest);
      assert.deepEqual(again.charts, charts, name);
      assert.equal(typeof redirect, "string");
    }, name);
  }
  // The measure it names is not one the data has: the canvas settles it to one it has, and the link's other parts are not lost.
  const { charts } = open(fixture.strange[0].link);
  assert.ok(all.datasets[0].measures.some((m) => m.id === charts[0].question.measure));
});
