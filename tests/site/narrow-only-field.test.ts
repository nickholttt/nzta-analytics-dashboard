// A field the build keeps as a slice and in a narrow fact table, and not as a column of the wide fact table (D-144, D-159), is offered on the canvas
// as a breakdown where it has few values: the question is drawn from the slice, every value, with no values to choose. One with many values is not,
// since a line for each of them cannot be told apart. It is not offered as a condition or crossed with another field: both need the wide table, which
// does not carry it. Through the real modules and config over a manifest written here; the dataset and the field are found in config/pipeline.json.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = await import("../../src/lib/config.ts");
const { builderVocabulary, builderPresets } = await import("../../src/lib/builder.ts");
const { resolvePreset } = await import("../../src/lib/resolve.ts");
type Manifest = import("../../src/lib/data.ts").Manifest;

type Spec = { facts?: string[]; narrow_facts?: { id: string; dimensions: string[] }[] };
const datasets = (JSON.parse(readFileSync(new URL("../../config/pipeline.json", import.meta.url), "utf8")) as { datasets: Record<string, Spec> }).datasets;
const narrowOnly = Object.entries(datasets).flatMap(([dataset, spec]) =>
  (spec.narrow_facts ?? []).flatMap((t) => t.dimensions.filter((id) => !(spec.facts ?? []).includes(id)).map((id) => ({ dataset, id }))),
);
const few = narrowOnly.filter(({ id }) => config.findDimension(id)?.cardinality === "low" && config.builderSpec.measures.some((m) => id in m.dimensions));
const many = narrowOnly.filter(({ id }) => config.findDimension(id)?.cardinality !== "low");

// Every dimension live for the dataset, a fact table of the wide table's own columns, and a pair of nothing: the narrow field has its slice and no more.
const manifestFor = (dataset: string): Manifest => {
  const wide = datasets[dataset].facts ?? [];
  const live = config.dimensions.filter((d) => !d.applies_to || d.applies_to.includes(dataset)).map((d) => d.id);
  return { latest_snapshot: "2026-10-31", datasets: { [dataset]: { months: 1, latest_month: "2026-10", live_dimensions: live, live_pairs: [], facts: { dimensions: wide.filter((id) => live.includes(id)) } } } } as unknown as Manifest;
};

test("config has a field kept only as a slice and a narrow table, with few values and a word for the sentence", () => {
  assert.ok(few.length > 0, "the narrow table that carries a field of few values is the case this test is about");
});

for (const { dataset, id } of few) {
  test(`${id} on ${dataset} is offered as a count and a share by it, with no values to choose, and is drawn from its slice`, () => {
    const manifest = manifestFor(dataset);
    const vocabulary = builderVocabulary(manifest).datasets.find((v) => v.dataset === dataset);
    assert.ok(vocabulary);
    for (const measure of ["count", "share"]) {
      const offered = vocabulary.measures.find((m) => m.id === measure)?.dimensions.find((d) => d.id === id);
      assert.ok(offered, `${measure} by ${id}`);
      assert.equal(offered.values, false, "the fact table does not carry it, so there are no values to choose from it");
      assert.deepEqual(offered.with, [], "a grid needs both fields in the fact table");
      const [preset] = builderPresets({ dataset, measure, by: id, values: [], where: {}, view: null });
      const resolution = resolvePreset(preset, manifest);
      assert.deepEqual(resolution.preventsRender, []);
      assert.deepEqual(resolution.source, { dataset, dimension: id }, "read from the slice, not from the fact table");
    }
    assert.equal(vocabulary.filters.some((f) => f.id === id), false, "a condition needs the wide fact table");
  });
}

for (const { dataset, id } of many) {
  test(`${id} on ${dataset} has many values and is not offered as a count`, () => {
    const vocabulary = builderVocabulary(manifestFor(dataset)).datasets.find((v) => v.dataset === dataset);
    assert.equal(vocabulary?.measures.find((m) => m.id === "count")?.dimensions.some((d) => d.id === id) ?? false, false);
  });
}
