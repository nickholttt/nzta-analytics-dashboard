// Build's second breakdown (D-114): a question with two fields is a grid of them for one window. How it is offered, kept in the address, settled
// from a link, and resolved; and that it leaves every question without one exactly as it was.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { everythingBuilt } from "./support/observe.ts";

const config = await import("../../src/lib/config.ts");
const builder = await import("../../src/lib/builder.ts");
const resolve = await import("../../src/lib/resolve.ts");
const { shapesFor } = await import("../../src/lib/shapes.ts");

const manifest = everythingBuilt();
const [vocabulary] = builder.builderVocabulary(manifest).datasets;
const share = vocabulary.measures.find((m) => m.id === "share");
assert.ok(share);
const optionFor = (id: string) => share.dimensions.find((d) => d.id === id);

test("a field is offered a second only where both are in the fact table, they are two, and neither sits under one value of the other", () => {
  const make = optionFor("make");
  assert.ok(make && make.values);
  assert.ok(make.with.includes("powertrain"));
  assert.ok(!make.with.includes("make"), "never with itself");
  for (const [a, b] of config.builderSpec.cannot_cross) {
    assert.ok(config.findDimension(a) && config.findDimension(b), `${a} and ${b} are fields config defines`);
    assert.ok(!optionFor(a)?.with.includes(b) && !optionFor(b)?.with.includes(a), `${a} and ${b} are not crossed`);
  }
  assert.ok(!(optionFor("model")?.with ?? []).includes("make"), "a model under its brand");
  // The measure made of a derived ratio offers none.
  const derived = vocabulary.measures.find((m) => m.derived);
  assert.ok(derived && derived.dimensions.every((d) => d.with.length === 0));
});

test("the pairs Build does not cross are symmetric in effect and name no value", () => {
  assert.ok(builder.canCross("powertrain", "segment"));
  assert.ok(!builder.canCross("segment", "segment"));
  assert.ok(!builder.canCross("parent_group", "make") && !builder.canCross("make", "parent_group"));
});

const base = { dataset: vocabulary.dataset, measure: "share", by: "powertrain", values: [] as string[], where: {}, view: null };

test("a question with a second breakdown is kept, one that cannot have it is not, and neither changes a question without one", () => {
  const crossed = builder.settle({ datasets: [vocabulary] }, { ...base, by2: "segment", values2: ["Car"] });
  assert.equal(crossed.by2, "segment");
  assert.deepEqual(crossed.values2, ["Car"]);
  assert.equal(crossed.pageValues, undefined, "a grid has no starting values of the page’s own");
  const refused = builder.settle({ datasets: [vocabulary] }, { ...base, by: "make", by2: "parent_group" });
  assert.equal(refused.by2, undefined);
  assert.ok(!("values2" in refused));
  const plain = builder.settle({ datasets: [vocabulary] }, base);
  assert.deepEqual(Object.keys(plain).sort(), ["by", "dataset", "measure", "pageValues", "values", "view", "where"].sort());
});

test("a condition on the second field becomes the values chosen for it, as a condition on the first does", () => {
  const q = builder.settle({ datasets: [vocabulary] }, { ...base, by2: "segment", where: { segment: ["Car", "Ute"], import_status: ["NZ New"] } });
  assert.deepEqual(q.values2, ["Car", "Ute"]);
  assert.deepEqual(Object.keys(q.where), ["import_status"]);
});

test("the address carries the second breakdown and its values, and an address without one reads as before", () => {
  const q = builder.settle({ datasets: [vocabulary] }, { ...base, by2: "segment", values: ["Diesel"], values2: ["Car", "Ute"] });
  const params = builder.questionParams(q);
  assert.equal(params.get("build.by2"), "segment");
  assert.deepEqual(params.getAll("build.value2"), ["Car", "Ute"]);
  const back = builder.readQuestion(`?${params}`);
  assert.equal(back.by2, "segment");
  assert.deepEqual(back.values2, ["Car", "Ute"]);
  assert.deepEqual(builder.settle({ datasets: [vocabulary] }, back), q);
  const old = builder.questionParams(builder.settle({ datasets: [vocabulary] }, base));
  assert.ok(![...old.keys()].some((k) => k.includes("by2") || k.includes("value2")));
  assert.equal(builder.readQuestion("?build.measure=share&build.by=make").by2, undefined);
});

test("a second breakdown the link names and the question cannot have is said", () => {
  const asked = { ...base, by: "make", by2: "parent_group" };
  const note = builder.readingNotes({ datasets: [vocabulary] }, asked, builder.settle({ datasets: [vocabulary] }, asked));
  assert.ok(note.by2 && note.by2.asked.length > 0);
  const fine = { ...base, by2: "segment" };
  assert.equal(builder.readingNotes({ datasets: [vocabulary] }, fine, builder.settle({ datasets: [vocabulary] }, fine)).by2, undefined);
});

test("the question draws one grid: matrix, live, in a window, reading the fact table, and says it is crossed", () => {
  const q = builder.settle({ datasets: [vocabulary] }, { ...base, measure: "share_and_count", by2: "segment" });
  const presets = builder.builderPresets(q);
  assert.equal(presets.length, 1, "a share and a number is one grid; the cells can hold either");
  const [p] = presets;
  assert.equal(p.dimension2, "segment");
  assert.equal(p.shape_override, "matrix");
  assert.equal(p.period, "latest_year");
  const resolution = resolve.resolvePreset(p, manifest);
  assert.equal(resolution.shape, "matrix");
  assert.equal(resolution.status, "live");
  assert.deepEqual(resolution.source?.cross, { dimension: "segment", grid: true });
  assert.ok(resolution.source?.facts);
  const facts = resolve.questionFacts(p, config.findDimension(p.dimension), config.findMeasure(p.measure));
  assert.equal(facts.crossed_with, "category");
  assert.deepEqual(shapesFor(facts), ["matrix"]);
  assert.deepEqual(builder.viewsFor(q), [], "there is one shape that fits, so there is nothing to switch");
});

test("the time row of a grid offers a month and the last 12 months, and no span of years", () => {
  const q = builder.settle({ datasets: [vocabulary] }, { ...base, by2: "segment" });
  const [p] = builder.builderPresets(q);
  assert.deepEqual(resolve.rankingPeriods(p).sort(), ["latest_month", "latest_year"]);
  assert.ok(resolve.fitsPin(p, "latest_month") && resolve.fitsPin(p, "latest_year"));
  assert.ok(!resolve.fitsPin(p, "5y") && !resolve.fitsPin(p, "all"));
});

test("a grid of a field with the fact table lacking the other is blocked, not drawn without it", () => {
  const thin = { datasets: { [vocabulary.dataset]: { live_dimensions: ["powertrain", "segment"], live_pairs: [], facts: { dimensions: ["powertrain"] } } } } as never;
  const [p] = builder.builderPresets(builder.settle({ datasets: [vocabulary] }, { ...base, by2: "segment" }));
  const resolution = resolve.resolvePreset(p, thin);
  assert.ok(resolution.preventsRender.some((m) => /fact table does not carry segment/.test(m)), resolution.preventsRender.join("; "));
});

test("a field crossed with itself, a ratio of two datasets and a grid over time are not grids", () => {
  const [p] = builder.builderPresets(builder.settle({ datasets: [vocabulary] }, { ...base, by2: "segment" }));
  assert.ok(resolve.resolvePreset({ ...p, dimension2: p.dimension }, manifest).invalid.some((m) => /itself/.test(m)));
  assert.ok(resolve.resolvePreset({ ...p, period: "5y", shape_override: undefined }, manifest).invalid.some((m) => /drawn as a grid, for one window/.test(m)));
  const ratio = config.presets.find((x) => x.cross);
  assert.ok(ratio);
  assert.ok(!resolve.canDraw(ratio, "matrix"));
});

test("the words of a grid question: both fields, and the question the page states", () => {
  const q = builder.settle({ datasets: [vocabulary] }, { ...base, by2: "segment", values: ["Diesel"] });
  const [p] = builder.builderPresets(q);
  const first = share.dimensions.find((d) => d.id === "powertrain")?.phrase;
  const second = share.dimensions.find((d) => d.id === "segment")?.phrase;
  assert.ok(p.question.includes(`by ${first} ${config.phrases.build_second_and} ${second}`), p.question);
  assert.ok(!p.question.includes(":"), "the picks are not listed after the question; the pickers hold them");
});

test("every preset with a second breakdown pins its shape, and the Explore view of it is a question Build can ask", () => {
  const grids = config.presets.filter((p) => p.dimension2);
  for (const p of grids) {
    assert.equal(p.shape_override, "matrix", `${p.id} pins the grid, so the time row offers a window and no span of years`);
    assert.equal(resolve.resolvePreset(resolve.presetView(p), manifest).status, "live", `${p.id}`);
    assert.equal(p.status, "live");
    const q = builder.builderQuestionFor(resolve.presetView(p));
    assert.ok(q && q.by2 === p.dimension2, `${p.id} has a Build question`);
  }
});

test("values for a second breakdown the link names none for are said, and nothing is said where there is one", () => {
  const asked = { ...base, values2: ["Car"] };
  const note = builder.readingNotes({ datasets: [vocabulary] }, asked, builder.settle({ datasets: [vocabulary] }, asked));
  assert.equal(note.value2, true);
  assert.ok(config.builderSpec.notices.value2.length > 0);
  const fine = { ...base, by2: "segment", values2: ["Car"] };
  assert.equal(builder.readingNotes({ datasets: [vocabulary] }, fine, builder.settle({ datasets: [vocabulary] }, fine)).value2, undefined);
  // A link that names a second breakdown the question cannot have is said once, as that, not twice.
  const refused = { ...base, by: "make", by2: "parent_group", values2: ["x"] };
  assert.equal(builder.readingNotes({ datasets: [vocabulary] }, refused, builder.settle({ datasets: [vocabulary] }, refused)).value2, undefined);
});

test("every phrase the grid's code reads from config exists there", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const source = ["src/components/MatrixChart.tsx", "src/components/QuestionBuilder.tsx", "src/components/PresetPanel.tsx", "src/lib/sentences.ts"]
    .map((f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8"))
    .join("\n");
  const used = new Set([...source.matchAll(/\bphrases\.((?:matrix|build_second|chart)_[a-z_0-9]+)/g)].map((m) => m[1]));
  const keyed = [...source.matchAll(/\bp\.(matrix_[a-z_0-9]+)/g)].map((m) => m[1]);
  for (const k of [...used, ...keyed]) assert.equal(typeof (config.phrases as Record<string, unknown>)[k], "string", `phrases.${k}`);
  // The templates the sentences build by name (matrix_rows_largest, matrix_columns_kept ...) exist for both sides.
  for (const side of ["rows", "columns"]) for (const kind of ["largest", "picked", "all", "ordered", "kept", "tie", "rest"]) assert.equal(typeof (config.phrases as Record<string, unknown>)[`matrix_${side}_${kind}`], "string", `matrix_${side}_${kind}`);
  assert.ok(used.size > 20);
  assert.ok(readdirSync(new URL("../../src/components/", import.meta.url)).includes("MatrixChart.tsx"));
});
