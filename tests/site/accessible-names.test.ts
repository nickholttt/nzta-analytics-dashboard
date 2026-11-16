// A button's accessible name must contain the words it shows (WCAG 2.5.3, Label in Name), or a person who speaks to
// their device cannot say what they see. Run with: node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { REMOVE_CONDITION, removeConditionLabel } = await import("../../src/lib/builder.ts");

test("the remove-condition button's name starts with the words it shows, then names the field", () => {
  assert.equal(REMOVE_CONDITION, "Remove this condition");
  assert.equal(removeConditionLabel("Vehicle type"), "Remove this condition: vehicle type");
});
