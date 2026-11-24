// A question that breaks down by a field the register records for only a kind of vehicle starts with the condition that keeps that kind, says so,
// and lets the visitor remove it; the removal is in the address, so it survives settle, a saved question and a pin (D-132). Through the real
// settle, readQuestion, questionParams and saved.questionQuery. No field or value is named: the fields come from the data map,
// the class and its condition from config.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { everythingBuilt } from "./support/observe.ts";

const config = await import("../../src/lib/config.ts");
const builder = await import("../../src/lib/builder.ts");
const saved = await import("../../src/lib/saved.ts");
const { fillTemplate } = await import("../../src/lib/sentences.ts");
const dataMap = JSON.parse(readFileSync(new URL("../../config/data_map.json", import.meta.url), "utf8")) as {
  enums: { recorded_for: string[] };
  fields: { name: string; bound: string | null; recorded_for: string[] }[];
};

const { standingFor } = await import("../../src/lib/nesting.ts");
const dimensionsOfField = (field: { name: string; bound: string | null }) => standingFor({ ...field, relations: { rolls_up_to: [] } }, config.dimensions as never);

const built = builder.builderVocabulary(everythingBuilt());
const [vocabulary] = built.datasets;
const all = built;
const measure = vocabulary.measures.find((m) => m.id === "share");
assert.ok(measure);
const offered = new Set(measure.dimensions.map((d) => d.id));

// The class config can express, the condition that keeps it, and the breakdowns the map says are recorded for it.
const [[CLASS, RULE]] = Object.entries(config.builderSpec.narrowings);
const standing = (field: { name: string; bound: string | null }) => dimensionsOfField(field).filter((id) => offered.has(id));
const narrowed = dataMap.fields.filter((f) => f.recorded_for.includes(CLASS)).flatMap(standing);
// A breakdown the map records for every vehicle, which no condition narrows.
const plain = dataMap.fields.filter((f) => f.recorded_for.length === 1 && f.recorded_for[0] === "every_vehicle").flatMap(standing).find((id) => id !== RULE.dimension) as string;
const [first, second] = narrowed;
const D = RULE.dimension;

const ask = (over: Partial<import("../../src/lib/builder.ts").Question>) =>
  builder.settle(all, { dataset: vocabulary.dataset, measure: "share", by: first, values: [], where: {}, view: null, ...over });
const read = (query: string) => builder.settle(all, builder.readQuestion(`?${query}`));

test("there are fields to test with: two the map records for the class, one it records for every vehicle, and a condition on a real field", () => {
  assert.ok(narrowed.length >= 2 && plain, `${narrowed} / ${plain}`);
  assert.ok(config.findDimension(D) && vocabulary.filters.some((f) => f.id === D), "the condition's field is one the dataset can apply");
  assert.ok(dataMap.enums.recorded_for.includes(CLASS), "the class config names is one of the map's");
});

test("a breakdown by such a field starts with the condition, and so does a second breakdown", () => {
  assert.deepEqual(ask({}).where, { [D]: [RULE.value] });
  const grid = ask({ by: plain, by2: second, values2: [] });
  assert.equal(grid.by2, second);
  assert.deepEqual(grid.where, { [D]: [RULE.value] }, "the second breakdown calls for it too");
  assert.deepEqual(ask({ by: first, by2: second, values2: [] }).where, { [D]: [RULE.value] }, "two such fields call for one condition, not two");
});

test("a condition on such a field narrows nothing, nor does a breakdown by a field recorded for every vehicle", () => {
  assert.deepEqual(ask({ by: plain, where: { [first]: ["x"] } }).where, { [first]: ["x"] });
  assert.deepEqual(ask({ by: plain }).where, {});
  assert.deepEqual(builder.narrowingNotes(all, ask({ by: plain })), []);
});

test("a link that has a condition on the field already keeps it, and says nothing more", () => {
  const q = ask({ where: { [D]: ["something else"] } });
  assert.deepEqual(q.where, { [D]: ["something else"] });
  assert.equal(q.widened, undefined);
  assert.deepEqual(builder.narrowingNotes(all, q), [], "the sentence is for the condition the question starts with");
  const same = ask({ where: { [D]: [RULE.value] } });
  assert.deepEqual(same.where, { [D]: [RULE.value] }, "a link may name the very same condition");
});

test("a field that is itself the breakdown is not narrowed by a condition on it, and a dataset that cannot apply the condition is not narrowed", () => {
  assert.deepEqual(ask({ by: D, by2: first, values2: [] }).where, {});
  const blind = { ...built, datasets: [{ ...vocabulary, filters: vocabulary.filters.filter((f) => f.id !== D) }] };
  const q = builder.settle(blind, { dataset: vocabulary.dataset, measure: "share", by: first, values: [], where: {}, view: null });
  assert.deepEqual(q.where, {});
  assert.deepEqual(builder.narrowingNotes(all, q), []);
});

test("a removed condition is not put back: the removal is remembered, in the address, and the question counts every vehicle", () => {
  const before = ask({});
  assert.deepEqual(before.where, { [D]: [RULE.value] });
  // What the page does when the visitor removes the condition line.
  const removed = builder.settle(all, builder.noteRemoved(before, { ...before, where: {} }));
  assert.deepEqual(removed.where, {});
  assert.deepEqual(removed.widened, [D]);
  assert.deepEqual(builder.narrowingNotes(all, removed), [], "no second sentence");
  // Then the visitor changes something else: still not put back.
  assert.deepEqual(builder.settle(all, builder.noteRemoved(removed, { ...removed, measure: "count", values: [] })).where, {});
  assert.deepEqual(builder.settle(all, builder.noteRemoved(removed, { ...removed, by: second, values: [] })).where, {}, "nor for another field the map records for the class");
});

test("a removal holds while the visitor has opened a condition on that field and not yet picked a value, so a reload does not narrow the question again", () => {
  const before = ask({});
  const removed = builder.settle(all, builder.noteRemoved(before, { ...before, where: {} }));
  // The visitor adds a condition on the field with no value yet (the page holds it as an empty list), then changes something else.
  const other = vocabulary.filters.find((f) => f.id !== D && f.id !== first);
  assert.ok(other, "a second field to put a condition on");
  const held = builder.settle(all, builder.noteRemoved(removed, { ...removed, where: { [D]: [], [other.id]: ["x"] } }));
  assert.deepEqual(held.where[other.id], ["x"], "the other condition is kept");
  assert.equal(D in held.where, false, "an empty condition is not kept");
  assert.deepEqual(held.widened, [D], "and the removal is");
  const address = builder.questionParams(held).toString();
  assert.ok(new URLSearchParams(address).getAll("build.widen").includes(D), "the address still says the condition was removed");
  assert.equal(D in read(address).where, false, "so a reload does not put it back");
});

test("the removal survives the address, a reload, a saved question and a pin", () => {
  const before = ask({});
  const removed = builder.settle(all, builder.noteRemoved(before, { ...before, where: {} }));
  const params = builder.questionParams(removed);
  assert.deepEqual(params.getAll("build.widen"), [D]);
  assert.equal(params.has(`build.where.${D}`), false);
  // A reload reads the address.
  assert.deepEqual(read(String(params)), removed);
  // A saved question is the build parameters of the address.
  const query = saved.questionQuery(`?${params}&other=1`);
  assert.ok(query);
  assert.deepEqual(read(query), removed);
  // A pin is one more parameter of it.
  const pinned = builder.settle(all, { ...removed, snapshot: "2026-10" });
  assert.deepEqual(pinned.widened, [D]);
  assert.deepEqual(pinned.where, {});
  assert.equal(pinned.snapshot, "2026-10");
  const pinnedQuery = saved.questionQuery(`?${builder.questionParams(pinned)}`);
  assert.ok(pinnedQuery);
  assert.deepEqual(read(pinnedQuery), pinned);
  // The link of an unremoved question carries the condition and no removal, so a link shows what its sender saw.
  const kept = builder.questionParams(before);
  assert.deepEqual(kept.getAll(`build.where.${D}`), [RULE.value]);
  assert.equal(kept.has("build.widen"), false);
  assert.deepEqual(read(String(kept)), before);
});

test("a removal stays only while a breakdown calls for the condition and the question does not hold it", () => {
  // No breakdown calls for it: the remembered removal goes, and a later breakdown by such a field starts narrowed again.
  const away = read(`build.measure=share&build.by=${plain}&build.widen=${D}`);
  assert.equal(away.widened, undefined);
  assert.equal(builder.questionParams(away).has("build.widen"), false);
  assert.deepEqual(read(`build.measure=share&build.by=${first}`).where, { [D]: [RULE.value] });
  // A link that both removes the condition and holds one: the condition wins.
  const both = read(`build.measure=share&build.by=${first}&build.widen=${D}&build.where.${D}=${encodeURIComponent(RULE.value)}`);
  assert.equal(both.widened, undefined);
  assert.deepEqual(both.where, { [D]: [RULE.value] });
  // A removal of something that is not a condition any breakdown calls for is nothing.
  assert.equal(read(`build.measure=share&build.by=${first}&build.widen=${plain}`).widened, undefined);
});

test("one sentence while the question holds the condition, from a template in config, naming the fields as the page labels them", () => {
  const label = (id: string) => config.lowerLabel(config.dimensionLabel(id) ?? id);
  const [one] = builder.narrowingNotes(all, ask({}));
  assert.equal(builder.narrowingNotes(all, ask({})).length, 1);
  assert.equal(one, fillTemplate(config.builderSpec.notices.narrowed, { field: label(first), kind: RULE.kind }).text);
  assert.ok(one.includes(label(first)) && one.includes(RULE.kind));
  // Two such fields: still one sentence, naming both.
  const [both] = builder.narrowingNotes(all, ask({ by2: second, values2: [] }));
  assert.equal(builder.narrowingNotes(all, ask({ by2: second, values2: [] })).length, 1);
  assert.ok(both.includes(label(first)) && both.includes(label(second)), both);
  // The condition changed to something else: the sentence goes.
  assert.deepEqual(builder.narrowingNotes(all, ask({ where: { [D]: [RULE.value, "another"] } })), []);
});

test("a class the config has no condition for narrows nothing and says nothing", () => {
  const rules = config.builderSpec.narrowings;
  const held = { ...rules };
  try {
    for (const key of Object.keys(rules)) delete rules[key];
    // The vocabulary is worked out from config when the page is built, so it is made again with the class gone.
    const bare = builder.builderVocabulary(everythingBuilt());
    assert.deepEqual(bare.narrowings, {});
    const q = builder.settle(bare, { dataset: vocabulary.dataset, measure: "share", by: first, values: [], where: {}, view: null });
    assert.deepEqual(q.where, {});
    assert.deepEqual(builder.narrowingNotes(bare, q), []);
    assert.deepEqual(builder.settle(bare, builder.noteRemoved(q, { ...q, where: {} })).widened, undefined, "a removal of nothing is nothing");
  } finally {
    Object.assign(rules, held);
  }
  assert.deepEqual(ask({}).where, { [D]: [RULE.value] });
});

test("every condition config names is a real one: a class of the map, a field the dimensions define, a value that field has", () => {
  for (const [cls, rule] of Object.entries(config.builderSpec.narrowings)) {
    assert.ok(dataMap.enums.recorded_for.includes(cls), `${cls} is a class of the map's recorded_for`);
    const dimension = config.findDimension(rule.dimension);
    assert.ok(dimension, `${rule.dimension} is a dimension`);
    assert.ok(rule.kind.length > 0);
    // A lookup dimension's values are a column of its reference file.
    const derive = dimension.derive as { kind: string; reference?: string; value?: string };
    assert.equal(derive.kind, "lookup", "the condition's value is checked against the reference file the dimension reads");
    const [header, ...rows] = readFileSync(new URL(`../../data/reference/${derive.reference}`, import.meta.url), "utf8").trim().split("\n");
    const at = header.split(",").indexOf(derive.value as string);
    assert.ok(at >= 0 && rows.some((r) => r.split(",")[at] === rule.value), `${rule.value} is a value of ${rule.dimension}`);
  }
});
