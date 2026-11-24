// The colour tokens of src/styles/site.css as the stylesheet declares them: the light set on :root, and the dark set twice (the device
// setting's media block, and the visitor's data-theme="dark" block). Shared by the tests that hold the themes to their promises.
import { readFileSync } from "node:fs";

export const siteCss = readFileSync(new URL("../../../src/styles/site.css", import.meta.url), "utf8");

// The text between the braces of the block that opens with the selector, braces nested inside it counted.
function blockAfter(css: string, opening: string): string {
  const start = css.indexOf(opening);
  if (start < 0) throw new Error(`site.css has no block that opens with ${opening}`);
  let depth = 0;
  for (let i = start + opening.length - 1; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start + opening.length, i);
  }
  throw new Error(`the block that opens with ${opening} does not close`);
}

// Each custom property, and color-scheme, with its value.
function declarations(block: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const m of block.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/^\s*(--[a-z0-9-]+|color-scheme):\s*([^;]+);/gm)) found.set(m[1], m[2].trim());
  return found;
}

export const light = declarations(blockAfter(siteCss, ":root {"));
export const darkDevice = declarations(blockAfter(blockAfter(siteCss, "@media (prefers-color-scheme: dark) {"), `:root:not([data-theme="light"]) {`));
export const darkChosen = declarations(blockAfter(siteCss, `:root[data-theme="dark"] {`));

// WCAG 2.x contrast of two #rrggbb colours.
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// A colour as it looks laid over another at the given opacity, as #rrggbb.
export function over(top: string, opacity: number, ground: string): string {
  const mix = (i: number) => Math.round(parseInt(top.slice(i, i + 2), 16) * opacity + parseInt(ground.slice(i, i + 2), 16) * (1 - opacity));
  return `#${[1, 3, 5].map((i) => mix(i).toString(16).padStart(2, "0")).join("")}`;
}
