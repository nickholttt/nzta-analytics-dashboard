// The roll-up of the powertrain into groups (D-124) as a breakdown of Build: offered for a share, a count and the two together, with
// words, and never set beside the powertrain it rolls up from, in either order (src/lib/nesting.ts reads the data map's rolls_up_to).
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { everythingBuilt } from "./support/observe.ts";

const config = await import("../../src/lib/config.ts");
const builder = await import("../../src/lib/builder.ts");
const { rollUps, nested } = await import("../../src/lib/nesting.ts");

const GROUP = "powertrain_group";
const FROM = "powertrain";
const dataMap = JSON.parse(readFileSync(new URL("../../config/data_map.json", import.meta.url), "utf8"));
const manifest = everythingBuilt();
const [vocabulary] = builder.builderVocabulary(manifest).datasets;
const all = { datasets: [vocabulary] };
const measure = (id: string) => {
  const m = vocabulary.measures.find((x) => x.id === id);
  assert.ok(m, `the builder offers ${id}`);
  return m;
};

test("the group is offered as a breakdown of a share, a count and the two together, with words and chosen values, and not of the ratio of the largest", () => {
  for (const id of ["share", "count", "share_and_count"]) {
    const option = measure(id).dimensions.find((d) => d.id === GROUP);
    assert.ok(option, `${id} by ${GROUP}`);
    assert.ok(option.phrase.length > 0 && option.values, `${id} has words and takes chosen values`);
  }
  const derived = vocabulary.measures.find((m) => m.derived);
  assert.ok(derived && !derived.dimensions.some((d) => d.id === GROUP));
  assert.ok(config.builderSpec.measures.every((m) => !m.derived || !(GROUP in m.dimensions)));
});

test("a question by the group is asked in words, and a share by it keeps the group as its breakdown", () => {
  const q = builder.settle(all, { dataset: vocabulary.dataset, measure: "share", by: GROUP, values: [], where: {}, view: null });
  assert.equal(q.by, GROUP);
  const phrase = measure("share").dimensions.find((d) => d.id === GROUP)?.phrase as string;
  assert.ok(builder.questionText(q, "share").toLowerCase().includes(phrase.toLowerCase()), builder.questionText(q, "share"));
});

test("the group is under the powertrain it rolls up from, so the two are never crossed, in either order", () => {
  const ups = rollUps(dataMap.fields, config.dimensions as never);
  assert.ok(nested(ups, FROM, GROUP) && nested(ups, GROUP, FROM));
  assert.equal(builder.canCross(FROM, GROUP), false);
  assert.equal(builder.canCross(GROUP, FROM), false);
  // The group is read from the motive power alone, so nothing else is under it or over it by this relation.
  assert.ok(!nested(ups, GROUP, "segment") && !nested(ups, GROUP, "make") && !nested(ups, GROUP, "import_status"));
  assert.ok(builder.canCross(GROUP, "import_status") && builder.canCross("import_status", GROUP));
  for (const [first, second] of [[FROM, GROUP], [GROUP, FROM]]) {
    const q = builder.settle(all, { dataset: vocabulary.dataset, measure: "share", by: first, by2: second, values: [], where: {}, view: null });
    assert.equal(q.by, first);
    assert.ok(!q.by2, `${second} is not kept as the second breakdown of ${first}`);
  }
  const share = measure("share");
  assert.ok(!share.dimensions.find((d) => d.id === GROUP)?.with.includes(FROM));
  assert.ok(!share.dimensions.find((d) => d.id === FROM)?.with.includes(GROUP));
});

test("the group can still be crossed with other fields", () => {
  const q = builder.settle(all, { dataset: vocabulary.dataset, measure: "share", by: GROUP, by2: "import_status", values: [], where: {}, view: null });
  assert.equal(q.by2, "import_status");
});
