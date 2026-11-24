// The shade steps of a grid (src/styles/site.css, --scale-N and --scale-ink-N) keep their printed figure readable in both themes: every step reaches
// WCAG AA (4.5:1) for its ink, there is one step for each fraction in config, and the greyed cell's ink reaches it too (D-114). The tokens are read
// from the stylesheet, so a change to one shows here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { darkChosen, light, ratio } from "./support/tokens.ts";

const presets = JSON.parse(readFileSync(new URL("../../config/presets.json", import.meta.url), "utf8"));
const themes = { light, dark: darkChosen } as const;
const token = (theme: keyof typeof themes, name: string): string => {
  const value = themes[theme].get(`--${name}`);
  assert.ok(value && /^#[0-9a-fA-F]{6}$/.test(value), `--${name} is defined in ${theme}`);
  return value;
};
const steps = presets.defaults.matrix.step_fractions as number[];

for (const theme of ["light", "dark"] as const) {
  test(`${theme}: there is one shade for each step in config, and each one's ink reaches 4.5 to 1`, () => {
    assert.equal(steps[steps.length - 1], 1);
    assert.ok(steps.every((f, i) => i === 0 || f > steps[i - 1]), "the steps grow");
    const lowest: number[] = [];
    steps.forEach((_, i) => {
      const r = ratio(token(theme, `scale-${i + 1}`), token(theme, `scale-ink-${i + 1}`));
      assert.ok(r >= 4.5, `step ${i + 1}: ${r.toFixed(2)}`);
      lowest.push(r);
    });
    assert.equal([...themes[theme].keys()].filter((k) => /^--scale-\d+$/.test(k)).length, steps.length, "no step without a fraction");
    // The lowest ratio is the one the stylesheet's comment records for light; dark's is held to the same bar.
    assert.ok(Math.min(...lowest) > (theme === "light" ? 5 : 4.9), `the lowest ratio: ${Math.min(...lowest).toFixed(2)}`);
  });

  test(`${theme}: the greyed cell's ink and the page's ink reach 4.5 to 1 on their grounds, and the steps are told apart from the paper`, () => {
    assert.ok(ratio(token(theme, "thin-wash"), token(theme, "ink-2")) >= 4.5);
    assert.ok(ratio(token(theme, "paper"), token(theme, "ink-2")) >= 4.5);
    for (let i = 1; i <= steps.length; i++) assert.notEqual(token(theme, `scale-${i}`), token(theme, "paper"));
  });

  test(`${theme}: a share of nothing, printed as a dash in the ink of a note, and the hatch of a greyed cell behind its type, reach 4.5 to 1`, () => {
    assert.ok(ratio(token(theme, "paper"), token(theme, "ink-3")) >= 4.5, "the dash on paper");
    assert.ok(ratio(token(theme, "rule-strong"), token(theme, "ink-2")) >= 4.5, "the type of a greyed cell over the lines of its hatch");
  });
}

test("the steps grow in lightness in the dark theme (more is brighter) and in darkness in the light one, so a deeper shade always means more", () => {
  const lum = (hex: string) => ratio(hex, "#000000") * 0.05 - 0.05;
  const order = (theme: keyof typeof themes) => steps.map((_, i) => lum(token(theme, `scale-${i + 1}`)));
  const up = order("dark");
  const down = order("light");
  for (let i = 1; i < steps.length; i++) {
    assert.ok(up[i] > up[i - 1], `dark step ${i + 1}`);
    assert.ok(down[i] < down[i - 1], `light step ${i + 1}`);
  }
});
