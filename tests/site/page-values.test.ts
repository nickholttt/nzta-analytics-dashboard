// The values the page fills in when a count is broken down (D-111): they are the page's own, not the visitor's, so the address does not hold
// them (a link without values means them), they follow the conditions, and the page never says the visitor picked them. Through the real
// settle, questionParams and builderPresets over a build in which every field is live; no field or value is named, they come from config or
// are made up.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { everythingBuilt } from "./support/observe.ts";

const { builderVocabulary, builderPresets, questionParams, readQuestion, settle, viewsFor, RANKING } = await import("../../src/lib/builder.ts");
const { dimensions } = await import("../../src/lib/config.ts");

const vocabulary = builderVocabulary(everythingBuilt());
const dataset = vocabulary.datasets[0].dataset;
const long = dimensions.find((d) => d.kind === "category" && d.cardinality === "high")?.id as string;
const asked = (over: object = {}) => ({ dataset, measure: "count", by: long, values: [] as string[], where: {}, view: null, ...over });

test("a count with no values named is waiting for the page's own, and a link without values means them", () => {
  const q = settle(vocabulary, readQuestion(`?build.measure=count&build.by=${long}`));
  assert.equal(q.pageValues, true);
  assert.deepEqual(q.values, []);
  assert.equal(questionParams(q).getAll("build.value").length, 0);
});

test("values named in the address are the visitor's own, so an older link, which named the starting values it was given, keeps its meaning", () => {
  const q = settle(vocabulary, readQuestion(`?build.measure=count&build.by=${long}&build.value=a&build.value=b`));
  assert.equal(q.pageValues, undefined);
  assert.deepEqual(q.values, ["a", "b"]);
  assert.deepEqual(questionParams(q).getAll("build.value"), ["a", "b"]);
  const back = settle(vocabulary, readQuestion(`?${questionParams(q)}`));
  assert.deepEqual([back.values, back.pageValues], [["a", "b"], undefined]);
});

test("the values the page filled in are not written to the address, and the address still reads back as the same question", () => {
  const filled = settle(vocabulary, asked({ values: ["a", "b", "c"], pageValues: true }));
  assert.deepEqual(filled.values, ["a", "b", "c"]);
  assert.equal(filled.pageValues, true);
  assert.equal(questionParams(filled).getAll("build.value").length, 0, "no build.value: the page's own");
  const back = settle(vocabulary, readQuestion(`?${questionParams(filled)}`));
  assert.deepEqual([back.pageValues, back.values], [true, []], "a shared link has the page choose again, from the same conditions");
  // The visitor choosing one, even one of the page's, makes the values theirs, and they are in the address.
  const chosen = settle(vocabulary, { ...filled, pageValues: false });
  assert.equal(chosen.pageValues, undefined);
  assert.deepEqual(questionParams(chosen).getAll("build.value"), ["a", "b", "c"]);
});

test("a link to the ranking of the page's own values keeps the ranking, which is judged as if the values were there", () => {
  const link = settle(vocabulary, readQuestion(`?build.measure=count&build.by=${long}&build.view=${RANKING}`));
  assert.equal(link.view, RANKING, "a count waiting for the page's values keeps the ranking view");
  assert.equal(link.pageValues, true);
  assert.equal(questionParams(link).get("build.view"), RANKING);
  const full = settle(vocabulary, readQuestion(`?build.measure=count&build.by=${long}&build.view=${RANKING}&build.rank=all`));
  assert.equal(full.rankAll, true);
  // A share has no starting values to wait for, so with none named there is nothing to rank among, and the view is dropped.
  assert.equal(settle(vocabulary, readQuestion(`?build.measure=share&build.by=${long}&build.view=${RANKING}`)).view, null);
  // Once the values are in, the ranking holds only where there are two or more.
  assert.equal(settle(vocabulary, asked({ values: ["a"], pageValues: true, view: RANKING })).view, null);
  assert.equal(settle(vocabulary, asked({ values: ["a", "b"], pageValues: true, view: RANKING })).view, RANKING);
  assert.deepEqual(viewsFor(settle(vocabulary, asked({ values: ["a", "b"], pageValues: true }))), ["trend", RANKING]);
});

test("the chart is told whether its values are the page's, and only then", () => {
  const filled = settle(vocabulary, asked({ values: ["a", "b"], pageValues: true }));
  const [page] = builderPresets(filled);
  assert.deepEqual([page.values, page.page_values], [["a", "b"], true]);
  const [own] = builderPresets(settle(vocabulary, asked({ values: ["a", "b"] })));
  assert.deepEqual([own.values, own.page_values], [["a", "b"], undefined]);
  // Waiting for values, the chart has none and nothing to say about them.
  const [waiting] = builderPresets(settle(vocabulary, asked()));
  assert.deepEqual([waiting.values, waiting.page_values], [undefined, undefined]);
});

test("a breakdown that takes no values has no page values", () => {
  const q = settle(vocabulary, { dataset, measure: "count", by: null, values: [], where: {}, view: null });
  assert.equal(q.pageValues, undefined);
});
