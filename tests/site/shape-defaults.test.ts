// What the site draws today, kept as a fixture: for each preset in the canon and each question the Build page can form,
// the shape chosen, the shapes a visitor may switch between and the periods that turn it into a ranking
// (tests/site/support/observe.ts). A change to how a shape is chosen shows here as a difference to read. To accept one
// that is meant, regenerate the fixture and list the difference in the decision record that made it:
//   UPDATE_SHAPE_DEFAULTS=1 node --test tests/site/shape-defaults.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { observe } from "./support/observe.ts";

const fixture = new URL("./fixtures/shape-defaults.json", import.meta.url);

test("every preset and every Build question draws as the fixture says", () => {
  const seen = observe();
  if (process.env.UPDATE_SHAPE_DEFAULTS) writeFileSync(fixture, JSON.stringify(seen, null, 2) + "\n");
  const expected = JSON.parse(readFileSync(fixture, "utf8"));
  const differences = [...new Set([...Object.keys(expected), ...Object.keys(seen)])]
    .filter((k) => expected[k] !== seen[k])
    .map((k) => `${k}: was ${JSON.stringify(expected[k])}, now ${JSON.stringify(seen[k])}`);
  assert.deepEqual(differences, []);
});

test("the fixture covers the canon and the builder", () => {
  const keys = Object.keys(JSON.parse(readFileSync(fixture, "utf8")));
  assert.ok(keys.filter((k) => k.startsWith("explore ")).length >= 100, "the canon's presets");
  assert.ok(keys.filter((k) => k.startsWith("build ")).length >= 250, "the builder's questions");
});
