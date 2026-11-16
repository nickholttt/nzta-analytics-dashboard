// Conditions on a built question (D-111): any number of them, one removable line each, one address and one sentence for one
// question whatever order they were added in. Through the real settle, questionParams, builderPresets and resolvePreset, over a
// build in which every field is live; no field or value is named here, they come from config or are made up.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { everythingBuilt } from "./support/observe.ts";

const { builderVocabulary, builderPresets, questionParams, readQuestion, settle, withValues } = await import("../../src/lib/builder.ts");
const { resolvePreset } = await import("../../src/lib/resolve.ts");
const { conditionsSentence } = await import("../../src/lib/scope.ts");

const manifest = everythingBuilt();
const vocabulary = builderVocabulary(manifest);
const first = vocabulary.datasets[0];
// A breakdown that does not take values, so every other field is free to be a condition.
const by = first.measures.find((m) => m.id === "share")?.dimensions[0].id as string;
const fields = first.filters.map((f) => f.id).filter((id) => id !== by);

const asked = (ids: string[]) => ({
  dataset: first.dataset,
  measure: "share",
  by,
  values: [],
  where: Object.fromEntries(ids.map((id, i) => [id, [`v${i}b`, `v${i}a`]])),
  view: null,
});

test("a visitor can add a condition on every field the dataset has, and the chart still draws", () => {
  assert.ok(fields.length >= 4, "the build has at least four fields to ask about");
  const q = settle(vocabulary, asked(fields));
  assert.deepEqual(Object.keys(q.where).sort(), [...fields].sort());
  const [preset] = builderPresets(q);
  const resolution = resolvePreset(preset, manifest);
  assert.deepEqual(resolution.preventsRender, []);
  assert.equal(resolution.keptBy?.length, fields.length);
});

test("the sentence lists every condition, each with all of its values: one value, or several joined by or", () => {
  const four = fields.slice(0, 4);
  const q = settle(vocabulary, asked(four));
  const resolution = resolvePreset(builderPresets(q)[0], manifest);
  const sentence = conditionsSentence(resolution.keptBy ?? [], (d) => `field ${d}`, (d, v) => v) as string;
  for (const id of four) assert.ok(sentence.includes(`field ${id} is `), id);
  for (let i = 0; i < 4; i++) assert.ok(sentence.includes(`“v${i}a” or “v${i}b”`), `values of condition ${i}`);
  assert.equal(sentence.split(", and ").length, 4);
  assert.match(sentence, /^Only vehicles where /);
  assert.match(sentence, / are counted\.$/);
  assert.equal(conditionsSentence([{ dimension: "d", values: ["x"] }], (d) => d, (_, v) => v), "Only vehicles where d is “x” are counted.");
  assert.equal(conditionsSentence([], (d) => d, (_, v) => v), undefined);
  assert.equal(conditionsSentence([{ dimension: "d", values: [] }], (d) => d, (_, v) => v), undefined, "a condition with no value is not in the sentence");
});

test("one question has one address and one sentence, whatever order its conditions and their values were added in", () => {
  const ids = fields.slice(0, 3);
  const forwards = settle(vocabulary, asked(ids));
  const backwards = settle(vocabulary, { ...asked(ids), where: Object.fromEntries([...ids].reverse().map((id) => [id, [...forwards.where[id]].reverse()])) });
  assert.notDeepEqual(Object.keys(forwards.where), Object.keys(backwards.where), "the test must add them in two orders");
  assert.equal(String(questionParams(forwards)), String(questionParams(backwards)));
  const sentences = [forwards, backwards].map((q) => {
    const keptBy = resolvePreset(builderPresets(q)[0], manifest).keptBy ?? [];
    return conditionsSentence(keptBy, (d) => d, (_, v) => v);
  });
  assert.equal(sentences[0], sentences[1]);
  // The address lists the fields in order of their ids.
  const keys = [...questionParams(forwards).keys()].filter((k) => k.startsWith("build.where."));
  assert.deepEqual(keys.filter((k, i) => keys.indexOf(k) === i), [...new Set(keys)].sort());
});

test("an address with many conditions reads back as the question it was written from", () => {
  const q = settle(vocabulary, asked(fields));
  const back = settle(vocabulary, readQuestion(`?${questionParams(q)}`));
  assert.deepEqual(back.where, Object.fromEntries(Object.entries(q.where).sort(([a], [b]) => (a < b ? -1 : 1)).map(([d, v]) => [d, [...v].sort()])));
  assert.equal(String(questionParams(back)), String(questionParams(q)));
});

test("taking the last value off a condition takes the line away; taking another leaves it", () => {
  const where = { a: ["x", "y"], b: ["z"] };
  assert.deepEqual(withValues(where, "a", ["y"]), { a: ["y"], b: ["z"] });
  assert.deepEqual(withValues(where, "b", []), { a: ["x", "y"] });
  assert.deepEqual(withValues(where, "c", ["w"]), { a: ["x", "y"], b: ["z"], c: ["w"] });
  assert.deepEqual(where, { a: ["x", "y"], b: ["z"] }, "the question it was given is not changed");
});

test("each condition's remove button is a button of its own, named by its words and its field", () => {
  const source = readFileSync(new URL("../../src/components/QuestionBuilder.tsx", import.meta.url), "utf8");
  assert.match(source, /Object\.entries\(question\.where\)\.map\(\(\[d, kept\]\) => \(\s*<div className="condition" key=\{d\}>/);
  assert.match(source, /aria-label=\{`Remove this condition: \$\{filterLabel\(d\)\.toLowerCase\(\)\}`\}/);
  assert.match(source, /withValues\(question\.where, d, values\)/);
});
