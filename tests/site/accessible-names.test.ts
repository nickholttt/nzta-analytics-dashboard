// A button's accessible name must contain the words it shows (WCAG 2.5.3, Label in Name), or a person who speaks to
// their device cannot say what they see. Run with: node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../src/components/QuestionBuilder.tsx", import.meta.url), "utf8");

test("the remove-condition button's aria-label starts with the words it shows, then names the field", () => {
  const visible = "Remove this condition";
  const at = source.indexOf(`${visible}\n`);
  assert.ok(at > 0, "the button's visible words are no longer in the source: update this test");
  const button = source.slice(source.lastIndexOf('className="button-quiet"', at), at);
  assert.ok(button.includes("aria-label={`" + visible + ": "), "the aria-label must begin with the visible words");
});
