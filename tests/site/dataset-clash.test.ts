// Datasets that count some of the same vehicles are never drawn together (config/dimensions.json, never_charted_with; D-118, D-158): the
// vehicles still registered and the registrations of the same five vehicle types are two counts of the same vehicles, so a chart reading both
// would set one against the other. The one exception is the ratio that divides them on purpose.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { everythingBuilt } from "./support/observe.ts";

const config = await import("../../src/lib/config.ts");
const resolve = await import("../../src/lib/resolve.ts");
const builder = await import("../../src/lib/builder.ts");

// The dataset config marks as never charted with others, and the ones it names: read from config, so no id is written here twice.
const guarded = config.datasets.filter((d) => (d.never_charted_with ?? []).length > 0);

test("config marks at least one dataset, and names only datasets it defines", () => {
  assert.ok(guarded.length > 0, "no dataset is marked: this test would pass without checking anything");
  for (const d of guarded) {
    for (const other of d.never_charted_with ?? []) {
      assert.ok(config.findDataset(other), `${d.id} names ${other}, which dimensions.json does not define`);
      assert.notEqual(other, d.id, `${d.id} names itself`);
    }
  }
});

test("a marked pair is a clash whichever way round it is asked, and a pair nobody marked is not", () => {
  for (const d of guarded) {
    for (const other of d.never_charted_with ?? []) {
      assert.deepEqual(config.datasetClashes([d.id, other]), [[d.id, other]]);
      assert.equal(config.datasetClashes([other, d.id]).length, 1);
    }
  }
  assert.deepEqual(config.datasetClashes(["a"], [{ id: "a", label: "a" }]), []);
  const list = [{ id: "a", label: "a", never_charted_with: ["b"] }, { id: "b", label: "b" }, { id: "c", label: "c" }];
  assert.equal(config.datasetClashes(["a", "b", "c"], list).length, 1);
  assert.equal(config.datasetClashes(["b", "c"], list).length, 0);
});

test("the one dataset of first registrations is marked against the vehicles still registered, whichever way round it is asked (D-158)", () => {
  assert.equal(config.datasetClashes(["new_registrations", "registrations_surviving"]).length, 1);
  assert.equal(config.datasetClashes(["registrations_surviving", "new_registrations"]).length, 1);
  // A flow series of it and a survivors series on one chart is never drawn.
  const base = { id: "p", question: "q", status: "live" as const };
  const resolution = resolve.resolvePreset({ ...base, dataset: "new_registrations", measure: "count", series: [{ dataset: "registrations_surviving" }] }, everythingBuilt());
  assert.equal(resolution.status, "invalid");
  assert.ok(resolution.invalid.some((s) => /never drawn on one chart/.test(s)));
});

test("completeness is the one ratio of the two, and a ratio that does not say so is a clash like any other chart of the pair", () => {
  const completeness = config.findDerived("completeness");
  assert.ok(completeness?.numerator_dataset && completeness.denominator_dataset, "completeness divides two datasets");
  assert.equal(completeness.ratio_of_clashing_datasets, true);
  const pair = [completeness.numerator_dataset, completeness.denominator_dataset];
  assert.equal(config.datasetClashes(pair).length, 1, "the pair it divides is marked: the exemption is for this ratio and not for the pair");
  const chart = config.presets.filter((p) => p.derived === "completeness");
  assert.ok(chart.length > 0, "a preset of completeness: this test would pass without checking anything");
  for (const p of chart) {
    assert.deepEqual(config.datasetClashes(config.datasetsRead(p)), [], p.id);
    assert.ok(!resolve.resolvePreset(p, everythingBuilt()).invalid.some((s) => /never drawn on one chart/.test(s)), p.id);
  }
  // The same ratio without the flag reads both datasets, so a chart of it is invalid; so is a series of the other dataset beside the ratio.
  const unflagged = (id?: string) => (id === completeness.id ? { ...completeness, ratio_of_clashing_datasets: undefined } : undefined);
  assert.equal(config.datasetClashes(config.datasetsRead(chart[0], unflagged)).length, 1);
  const beside = { ...chart[0], series: [{ dataset: completeness.numerator_dataset }, { dataset: completeness.numerator_dataset }] };
  assert.equal(beside.dataset, completeness.denominator_dataset);
  assert.equal(config.datasetClashes(config.datasetsRead(beside)).length, 1, "a series of the numerator beside the denominator's own is the pair drawn together");
});

test("every chart in the canon reads no clashing pair, and the resolver does not mark one", () => {
  const manifest = everythingBuilt();
  for (const p of config.presets) {
    assert.deepEqual(config.datasetClashes(config.datasetsRead(p)), [], p.id);
    assert.ok(!resolve.resolvePreset(p, manifest).invalid.some((s) => /never drawn on one chart/.test(s)), p.id);
  }
});

test("a ratio, a curated comparison or a filtered dataset that reaches a marked pair is read as that pair", () => {
  const [a] = guarded;
  const [b] = a.never_charted_with ?? [];
  const ratio = (id?: string) => (id === "r" ? ({ id: "r", numerator_dataset: a.id, denominator_dataset: b } as import("../../src/lib/config.ts").DerivedMeasure) : undefined);
  const base = { id: "p", question: "q", status: "live" as const };
  assert.deepEqual(new Set(config.datasetsRead({ ...base, derived: "r" }, ratio)), new Set([a.id, b]));
  assert.deepEqual(new Set(config.datasetsRead({ ...base, dataset: a.id, series: [{ dataset: b }, { dataset: b }] })), new Set([a.id, b]));
  // A dataset that is another one filtered is read as its base.
  const filtered = config.datasets.find((d) => d.base);
  assert.ok(filtered);
  assert.deepEqual(config.datasetsRead({ ...base, dataset: filtered.id }), [filtered.base]);
  // The resolver marks a chart that reads a pair, so it is not drawn.
  const resolution = resolve.resolvePreset({ ...base, dataset: a.id, measure: "count", series: [{ dataset: b }, { dataset: b }] }, everythingBuilt());
  assert.equal(resolution.status, "invalid");
  assert.ok(resolution.invalid.some((s) => s.includes(a.id) && s.includes(b) && /never drawn on one chart/.test(s)));
  assert.ok(resolution.preventsRender.length > 0);
});

test("a question built on the Build page reads one dataset, whichever it counts", () => {
  for (const dataset of config.builderSpec.datasets) {
    for (const m of config.builderSpec.measures) {
      const q = { dataset, measure: m.id, by: null, values: [], where: {}, view: null };
      for (const p of builder.builderPresets(q)) assert.deepEqual(config.datasetsRead(p), [dataset]);
    }
  }
});
