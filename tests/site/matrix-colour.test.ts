// The shade steps of a grid (src/styles/site.css, --scale-N and --scale-ink-N) keep their printed figure readable: every step reaches WCAG AA (4.5:1) for
// its ink, there is one step for each fraction in config, and the greyed cell's ink reaches it too (D-114). The tokens are read from the
// stylesheet, so a change to one shows here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../src/styles/site.css", import.meta.url), "utf8");
const presets = JSON.parse(readFileSync(new URL("../../config/presets.json", import.meta.url), "utf8"));
const token = (name: string): string => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `--${name} is defined`);
  return m[1];
};
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

test("there is one shade for each step in config, and each one's ink reaches 4.5 to 1", () => {
  const steps = presets.defaults.matrix.step_fractions as number[];
  assert.equal(steps[steps.length - 1], 1);
  assert.ok(steps.every((f, i) => i === 0 || f > steps[i - 1]), "the steps grow");
  const lowest: number[] = [];
  steps.forEach((_, i) => {
    const r = ratio(token(`scale-${i + 1}`), token(`scale-ink-${i + 1}`));
    assert.ok(r >= 4.5, `step ${i + 1}: ${r.toFixed(2)}`);
    lowest.push(r);
  });
  assert.equal(css.match(/--scale-\d+:/g)?.length, steps.length, "no step without a fraction");
  assert.ok(Math.min(...lowest) > 5, "the lowest ratio is the one recorded in the stylesheet's comment");
});

test("the greyed cell's ink and the page's ink reach 4.5 to 1 on their grounds, and the steps are told apart from the paper", () => {
  assert.ok(ratio(token("thin-wash"), token("ink-2")) >= 4.5);
  assert.ok(ratio(token("paper"), token("ink-2")) >= 4.5);
  assert.notEqual(token("scale-1"), token("paper"));
});
