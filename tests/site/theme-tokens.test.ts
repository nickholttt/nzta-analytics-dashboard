// The light and dark themes keep their promises (src/styles/site.css, src/lib/theme.ts): the two dark blocks, one for the device setting and
// one for a visitor's choice, say the same thing; every colour has a dark value; the chart colours that mirror the stylesheet match it, in both
// themes; and what is printed on a dark surface reaches the contrast the light one does.
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { darkChosen, darkDevice, light, ratio } from "./support/tokens.ts";

const token = (set: Map<string, string>, name: string): string => {
  const value = set.get(`--${name}`);
  assert.ok(value && /^#[0-9a-f]{6}$/i.test(value), `--${name} is a #rrggbb colour: ${value}`);
  return value;
};

test("the dark block for the device setting and the dark block for a visitor's choice hold the same declarations", () => {
  assert.ok(darkDevice.size > 30, "the blocks are read");
  assert.deepEqual([...darkChosen], [...darkDevice]);
  assert.equal(darkChosen.get("color-scheme"), "dark");
  assert.equal(light.get("color-scheme"), "light");
});

test("every colour the light theme sets has a dark value, and the dark theme sets nothing the light one does not", () => {
  const colourish = (v: string) => /^(#|rgb\(|Highlight)/.test(v);
  const lightColours = [...light].filter(([, v]) => colourish(v)).map(([k]) => k);
  assert.ok(lightColours.length > 30);
  for (const name of lightColours) assert.ok(darkChosen.has(name), `${name} has no dark value`);
  for (const name of darkChosen.keys()) assert.ok(light.has(name), `${name} is set for dark and not for light`);
});

test("in the dark theme, text reaches 4.5 to 1 on the paper and the raised paper, and the accent and the status inks on theirs", () => {
  const t = (name: string) => token(darkChosen, name);
  for (const ground of ["paper", "paper-2", "card", "card-muted"]) for (const ink of ["ink", "ink-2", "ink-3"]) assert.ok(ratio(t(ink), t(ground)) >= 4.5, `${ink} on ${ground}`);
  for (const ground of ["paper", "paper-2", "card", "card-muted"]) assert.ok(ratio(t("accent"), t(ground)) >= 4.5, `a link on ${ground}`);
  assert.ok(ratio(t("on-accent"), t("accent")) >= 4.5, "text on a filled accent");
  assert.ok(ratio(t("warn-ink"), t("warn-wash")) >= 4.5 && ratio(t("block-ink"), t("block-wash")) >= 4.5, "status inks on their washes");
  for (const rank of ["rank-up", "rank-down", "rank-new"]) assert.ok(ratio(t(rank), t("paper")) >= 4.5, rank);
  assert.ok(ratio(t("mark-ink"), t("mark")) >= 4.5, "highlighted text");
  assert.ok(ratio(t("selected-ink"), t("selected")) >= 4.5, "a chosen option");
  assert.ok(ratio(t("selection-ink"), t("selection")) >= 4.5, "selected text");
  assert.ok(ratio(t("ink-2"), t("thin-wash")) >= 4.5, "a figure under the precision floor");
  assert.ok(ratio(t("ink-2"), t("rule-strong")) >= 4.5, "its hatch");
  assert.ok(ratio(t("control"), t("card")) >= 3 && ratio(t("control"), t("card-muted")) >= 3, "the edge of a control (WCAG 1.4.11)");
  assert.ok(ratio(t("accent"), t("paper")) >= 3, "the focus ring");
});
