// Power (in bands) and the gearbox as breakdowns of Build (D-132): phrases in config, the same mechanisms as the three fields of D-122, and
// crossing with each other and with the fields already offered. Through the real vocabulary and settle over a build in which every field is live
// (tests/site/support/observe.ts).
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { everythingBuilt } from "./support/observe.ts";

const config = await import("../../src/lib/config.ts");
const builder = await import("../../src/lib/builder.ts");

const FIELDS = ["power_band", "transmission"];
const manifest = everythingBuilt();
const [vocabulary] = builder.builderVocabulary(manifest).datasets;
const all = { datasets: [vocabulary] };
const measure = (id: string) => {
  const m = vocabulary.measures.find((x) => x.id === id);
  assert.ok(m, `the builder offers ${id}`);
  return m;
};

test("both are offered as a breakdown of a share, a count and the two together, with words and chosen values, and not of the ratio of the largest", () => {
  for (const id of ["share", "count", "share_and_count"]) {
    for (const field of FIELDS) {
      const option = measure(id).dimensions.find((d) => d.id === field);
      assert.ok(option, `${id} by ${field}`);
      assert.ok(option.phrase.length > 0 && option.values, `${id} by ${field} has words and takes chosen values`);
    }
  }
  const derived = vocabulary.measures.find((m) => m.derived);
  assert.ok(derived && FIELDS.every((f) => !derived.dimensions.some((d) => d.id === f)));
});

test("each is listed beside the field the data map puts it with, in a share and in a count", () => {
  for (const id of ["share", "count"]) {
    const order = Object.keys(config.builderSpec.measures.find((m) => m.id === id)?.dimensions ?? {});
    assert.equal(order[order.indexOf("engine_size_band") + 1], "power_band", `${id}: power follows engine size`);
    assert.equal(order[order.indexOf("seats_band") + 1], "transmission", `${id}: the gearbox follows seats`);
  }
});

test("the two cross with each other and with fields already offered, in either order: the data map records no nesting between them", () => {
  const share = measure("share");
  for (const field of FIELDS) {
    const option = share.dimensions.find((d) => d.id === field);
    assert.ok(option);
    for (const other of ["powertrain", "make", "seats_band", "engine_size_band", ...FIELDS.filter((f) => f !== field)]) {
      assert.ok(option.with.includes(other) && share.dimensions.find((d) => d.id === other)?.with.includes(field), `${field} and ${other}`);
    }
    const q = builder.settle(all, { dataset: vocabulary.dataset, measure: "share", by: "powertrain", by2: field, values: [], where: {}, view: null });
    assert.equal(q.by2, field, `${field} is kept as the second breakdown`);
  }
  const grid = builder.settle(all, { dataset: vocabulary.dataset, measure: "count", by: "power_band", by2: "transmission", values: [], values2: [], where: {}, view: null });
  assert.deepEqual([grid.by, grid.by2], ["power_band", "transmission"]);
});

test("the sentence reads each phrase, and power's unknown band is flagged in config as every other banded field's is", () => {
  for (const field of FIELDS) {
    const q = builder.settle(all, { dataset: vocabulary.dataset, measure: "share", by: field, values: [], where: {}, view: null });
    assert.equal(q.by, field);
    const phrase = measure("share").dimensions.find((d) => d.id === field)?.phrase as string;
    assert.ok(builder.questionText(q, "share").toLowerCase().includes(phrase.toLowerCase()), builder.questionText(q, "share"));
  }
  assert.ok(config.unrecordedBand("power_band"), "the unknown band of power is the one the readers turn into Not recorded");
  assert.equal(config.unrecordedBand("transmission"), undefined, "the gearbox's gap is the reserved value from the pipeline, not a band");
});
