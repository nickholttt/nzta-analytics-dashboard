// Which reserved values Build offers as a value to compare or as a condition (docs/CUBE_SCHEMA.md, Reserved tokens), and what a
// link that names one it does not offer says. Through the real settle and readingNotes, over a build in which every field is live.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { everythingBuilt } from "./support/observe.ts";

const { builderVocabulary, settle, readingNotes, readQuestion, questionParams } = await import("../../src/lib/builder.ts");
const { BEYOND_CAP, isChoosable } = await import("../../src/lib/reserved.ts");
const { builderSpec, dimensions } = await import("../../src/lib/config.ts");
const { fillTemplate } = await import("../../src/lib/sentences.ts");

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const vocabulary = builderVocabulary(everythingBuilt());
// The field a cap applies to, and one it does not, from config: no field is named here.
const capped = dimensions.find((d) => d.cardinality === "very_high");
const other = dimensions.find((d) => d.cardinality === "low" && d.id !== capped?.id);
const NOT_RECORDED = "__UNDEFINED__";
const NO_MATCH = "__UNMAPPED__";

test("the value a cap collapses to is not choosable, and the two reserved values that describe vehicles are", () => {
  assert.equal(BEYOND_CAP, "__OTHER__");
  assert.equal(isChoosable(BEYOND_CAP), false);
  assert.equal(isChoosable(NOT_RECORDED), true);
  assert.equal(isChoosable(NO_MATCH), true);
  assert.equal(isChoosable("ANYTHING ELSE"), true);
});

test("a link that compares the beyond-the-cap value loses it, keeps the other values and says so", () => {
  assert.ok(capped && other);
  const asked = readQuestion(`?build.measure=share&build.by=${capped.id}&build.value=${BEYOND_CAP}&build.value=A%7CB&build.value=${NOT_RECORDED}`);
  const settled = settle(vocabulary, asked);
  assert.deepEqual(settled.values, ["A|B", NOT_RECORDED]);
  const note = readingNotes(vocabulary, asked, settled, (v) => (v === BEYOND_CAP ? "Other (beyond the cap)" : v));
  assert.deepEqual(note.left_out, [{ asked: "Other (beyond the cap)", field: (capped.public_label ?? capped.label).toLowerCase() }]);
  const text = fillTemplate(builderSpec.notices.left_out, (note.left_out ?? [])[0]).text;
  assert.match(text, /^This link named “Other \(beyond the cap\)” for /);
  assert.match(text, /so it was left out\.$/);
  // The corrected address names what is drawn.
  assert.ok(![...questionParams(settled).values()].includes(BEYOND_CAP));
});

test("a link that keeps only the beyond-the-cap value loses the condition's value, and the page says so rather than widening quietly", () => {
  assert.ok(capped && other);
  const asked = readQuestion(`?build.measure=share&build.by=${other.id}&build.where.${capped.id}=${BEYOND_CAP}`);
  const settled = settle(vocabulary, asked);
  assert.deepEqual(settled.where[capped.id] ?? [], []);
  assert.equal(readingNotes(vocabulary, asked, settled).left_out?.length, 1);
  assert.ok(!String(questionParams(settled)).includes(BEYOND_CAP));
});

test("not recorded and no reference match are still choosable, as a value and as a condition, and a link naming them is not changed", () => {
  assert.ok(capped && other);
  for (const token of [NOT_RECORDED, NO_MATCH]) {
    const asked = readQuestion(`?build.measure=share&build.by=${other.id}&build.value=${token}&build.where.${capped.id}=${token}`);
    const settled = settle(vocabulary, asked);
    assert.deepEqual(settled.values, [token]);
    assert.deepEqual(settled.where[capped.id], [token]);
    assert.equal(readingNotes(vocabulary, asked, settled).left_out, undefined, token);
  }
});

test("the picker does not list the beyond-the-cap value, among the values to compare or the values of a condition", () => {
  // The picker is shared by the Build page and the canvas (src/components/ValuePicker.tsx); the page says what a link named that it left out.
  assert.match(read("src/components/ValuePicker.tsx"), /o\.total > 0 && isChoosable\(o\.value\)/);
  assert.match(read("src/components/QuestionBuilder.tsx"), /fillNote\(builderSpec\.notices\.left_out, left\)/);
});
