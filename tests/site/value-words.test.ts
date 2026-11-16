// A compound value (a model, as brand and model) is read as words wherever a visitor reads it, and stays the raw key in
// addresses and data (D-107 item 5). Node's own test runner:
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { valueWords, findDimension } = await import("../../src/lib/config.ts");
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

// The one dimension whose values are compound, and its separator, from config: no value is named here.
const compound = JSON.parse(read("config/dimensions.json")).dimensions.find((d: { key_separator?: string }) => d.key_separator);

test("a compound value reads as words and a plain one is unchanged", () => {
  const sep = compound.key_separator;
  assert.equal(valueWords(compound.id, `ALPHA${sep}BETA 2`), "ALPHA BETA 2");
  assert.equal(valueWords(compound.id, "NO SEPARATOR"), "NO SEPARATOR");
});

test("a dimension without a separator, or none at all, leaves the value as it is", () => {
  const plain = JSON.parse(read("config/dimensions.json")).dimensions.find((d: { key_separator?: string }) => !d.key_separator);
  assert.ok(findDimension(plain.id));
  assert.equal(valueWords(plain.id, "A|B"), "A|B");
  assert.equal(valueWords(undefined, "A|B"), "A|B");
});

test("the panel, the picker and the sentences use it, so the table of figures, the chips and the conditions agree", () => {
  assert.match(read("src/components/PresetPanel.tsx"), /valueWords\(dimensionId, reservedLabel\(v\)\)/);
  assert.match(read("src/components/PresetPanel.tsx"), /quoted\(k\.values, k\.dimension\)/);
  assert.match(read("src/components/QuestionBuilder.tsx"), /valueWords\(dimension, reservedLabel\(v\)\)/);
});
