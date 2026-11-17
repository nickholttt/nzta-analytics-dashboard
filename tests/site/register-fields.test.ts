// The three register fields bound in D-116 (the assembly flag, NZTA's class code, seats in bands) as breakdowns of Build, and what they
// need that a plain category does not: a pair that is never crossed because one rolls up to the other (D-122), and a gap shown as the gap
// it is. Through the real vocabulary, settle and readingNotes over a build in which every field is live (tests/site/support/observe.ts).
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { everythingBuilt } from "./support/observe.ts";

const config = await import("../../src/lib/config.ts");
const builder = await import("../../src/lib/builder.ts");

const NEW = ["nz_assembled", "nzta_class", "seats_band"];
const manifest = everythingBuilt();
const [vocabulary] = builder.builderVocabulary(manifest).datasets;
const all = { datasets: [vocabulary] };
const measure = (id: string) => {
  const m = vocabulary.measures.find((x) => x.id === id);
  assert.ok(m, `the builder offers ${id}`);
  return m;
};

test("each of the three is offered as a breakdown of a share, a count and the two together, with words, and chosen values", () => {
  for (const id of ["share", "count", "share_and_count"]) {
    for (const field of NEW) {
      const option = measure(id).dimensions.find((d) => d.id === field);
      assert.ok(option, `${id} by ${field}`);
      assert.ok(option.phrase.length > 0 && option.values, `${id} by ${field} has words and takes chosen values`);
    }
  }
  // A measure made of a ratio of the largest few offers none of them: it is about brands.
  const derived = vocabulary.measures.find((m) => m.derived);
  assert.ok(derived && NEW.every((f) => !derived.dimensions.some((d) => d.id === f)));
});

test("each of the three is also a second breakdown, for the others and for the fields that already were", () => {
  const share = measure("share");
  for (const field of NEW) {
    const option = share.dimensions.find((d) => d.id === field);
    assert.ok(option && option.with.length > 0, `${field} can be crossed with something`);
    assert.ok(option.with.includes("powertrain") && share.dimensions.find((d) => d.id === "powertrain")?.with.includes(field), `${field} and powertrain`);
    const q = builder.settle(all, { dataset: vocabulary.dataset, measure: "share", by: "powertrain", by2: field, values: [], where: {}, view: null });
    assert.equal(q.by2, field, `${field} is kept as the second breakdown`);
    const [preset] = builder.builderPresets(q);
    assert.equal(preset.dimension2, field);
  }
});

test("a phrase exists in config for each breakdown the builder offers, and the sentence reads them", () => {
  for (const field of NEW) {
    const q = builder.settle(all, { dataset: vocabulary.dataset, measure: "share", by: field, values: [], where: {}, view: null });
    assert.equal(q.by, field);
    const phrase = measure("share").dimensions.find((d) => d.id === field)?.phrase as string;
    assert.ok(builder.questionText(q, "share").toLowerCase().includes(phrase.toLowerCase()), builder.questionText(q, "share"));
  }
  assert.ok(config.builderSpec.measures.every((m) => !m.derived || NEW.every((f) => !(f in m.dimensions))));
});
