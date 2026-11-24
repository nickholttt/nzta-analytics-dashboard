// What each built page ships on first load, measured from the built files alone, and the budget it is held to (config/performance_budget.json).
// Shared by scripts/check-performance-budget.mjs and its tests. Built-ins only. Deterministic: it reads the files the page's own HTML names
// and counts their bytes; it times nothing, so it does not move with the machine it runs on.
//
// What a page "ships on first load", by kind:
//   html    the page's own file, gzipped
//   styles  each stylesheet the page links, gzipped
//   scripts each script the page names (a script tag, a modulepreload, an island's component or renderer, a file its inline script adds links for) and every script those import
//           statically, gzipped. A script loaded later on a visitor's action (a lazy import) is not first load and is not counted
//   fonts   for every page, the Latin and the Latin Extended face of each family the stylesheets declare (a page of New Zealand English
//           and te reo Maori, with its macrons, can load both, and the charts and the canvas draw their text in them), and any other face
//           whose unicode-range covers a character of the page's own text; as served (woff2 is already compressed)
//   data    each file the page asks the browser to preload (the manifest), gzipped. Data a script asks for after it starts (the events
//           file, a table of figures) is not named by the page's HTML and is not counted
//   total   the sum of the five
// gzip stands in for the host's compression (as scripts/measure-first-load.mjs does); a browser that accepts Brotli is sent less.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

export const KINDS = ["html", "scripts", "styles", "fonts", "data"];

const gz = (path) => gzipSync(readFileSync(path)).length;
const decode = (s) => s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|[a-z]+);/gi, (all, dec, hex) => (dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : " "));

function ranges(spec) {
  return spec.split(",").map((part) => {
    const m = /U\+([0-9a-f?]+)(?:-([0-9a-f]+))?/i.exec(part.trim());
    if (!m) return [0, -1];
    return m[1].includes("?") ? [parseInt(m[1].replace(/\?/g, "0"), 16), parseInt(m[1].replace(/\?/g, "f"), 16)] : [parseInt(m[1], 16), parseInt(m[2] ?? m[1], 16)];
  });
}

export function pageFiles(root, html) {
  const local = (url) => (url.startsWith("/") && !url.startsWith("//") ? url.split(/[?#]/)[0] : undefined);
  const styles = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/gi)].flatMap((m) => /\bhref="([^"]+)"/i.exec(m[0])?.[1] ?? []).map(local).filter(Boolean);

  const entries = [
    ...[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)].map((m) => m[1]),
    ...[...html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/gi)].map((m) => m[1]),
    ...[...html.matchAll(/(?:component-url|renderer-url|before-hydration-url)="([^"]+)"/gi)].map((m) => m[1]),
    // a script the page's own inline script adds links for once the island's code has arrived (astro.config.mjs, preloadIslands)
    ...[...html.matchAll(/"(\/_astro\/[^"\s]+\.js)"/g)].map((m) => m[1]),
  ].map(local).filter(Boolean);
  const scripts = new Set();
  const add = (url) => {
    if (scripts.has(url) || !existsSync(join(root, url))) return;
    scripts.add(url);
    for (const [, rel] of readFileSync(join(root, url), "utf8").matchAll(/(?:from|import)\s*["'`](\.\/[^"'`]+\.js)["'`]/g)) add(`/_astro/${rel.slice(2)}`);
  };
  entries.forEach(add);

  const data = [...html.matchAll(/<link\b[^>]*\brel="preload"[^>]*>/gi)].flatMap((m) => (/\bas="fetch"/i.test(m[0]) ? (/\bhref="([^"]+)"/i.exec(m[0])?.[1] ?? []) : [])).map(local).filter(Boolean);

  // The Latin face of each family (it covers A) and the Latin Extended face (it covers a, o and u with a macron: U+0101, U+014D, U+016B) are
  // always counted: a page of New Zealand text can draw both. Any other face counts when the page's own text needs it.
  const text = decode(html.replace(/<(script|style|template|head)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " "));
  const codes = new Set([...text].map((c) => c.codePointAt(0)));
  const fonts = new Set();
  for (const css of styles) {
    if (!existsSync(join(root, css))) continue;
    for (const [, face] of readFileSync(join(root, css), "utf8").matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const url = /url\(\s*["']?([^"')\s]+)/.exec(face)?.[1];
      const range = /unicode-range\s*:\s*([^;}]+)/i.exec(face)?.[1];
      if (!url) continue;
      const span = range ? ranges(range) : [[0, 0x10ffff]];
      const covers = (c) => span.some(([a, b]) => c >= a && c <= b);
      if ([0x41, 0x101, 0x14d, 0x16b].some(covers) || [...codes].some(covers)) fonts.add(url);
    }
  }
  return { styles: [...new Set(styles)], scripts: [...scripts], fonts: [...fonts], data: [...new Set(data)] };
}

// The bytes of every built page, by kind: { "/": { html, scripts, styles, fonts, data, total }, ... }
export function measurePages(root) {
  const pages = {};
  for (const file of readdirSync(root, { recursive: true, encoding: "utf8" }).map((f) => f.replace(/\\/g, "/"))) {
    if (!file.endsWith(".html") || file.startsWith("data/") || file.startsWith("geo/")) continue;
    const key = file === "index.html" ? "/" : file.endsWith("/index.html") ? `/${file.slice(0, -"index.html".length)}` : `/${file}`;
    const html = readFileSync(join(root, file), "utf8");
    const f = pageFiles(root, html);
    const sum = (urls, size) => urls.reduce((n, url) => n + (existsSync(join(root, url)) ? size(join(root, url)) : 0), 0);
    const m = { html: gzipSync(Buffer.from(html)).length, scripts: sum(f.scripts, gz), styles: sum(f.styles, gz), fonts: sum(f.fonts, (p) => statSync(p).size), data: sum(f.data, gz) };
    pages[key] = { ...m, total: KINDS.reduce((n, k) => n + m[k], 0) };
  }
  return Object.fromEntries(Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)));
}

const n = (x) => x.toLocaleString("en-NZ");

// The problems: a page with no budget, a budget with no page, a kind over its limit, each naming the page and the kind.
export function budgetProblems(measured, budget) {
  const problems = [];
  for (const page of Object.keys(measured)) if (!budget.pages[page]) problems.push(`${page} is built but has no budget: add it to config/performance_budget.json (run the check with --propose for the numbers)`);
  for (const [page, limits] of Object.entries(budget.pages)) {
    if (!measured[page]) {
      problems.push(`${page} has a budget but is not in the build: remove it from config/performance_budget.json`);
      continue;
    }
    for (const kind of [...KINDS, "total"]) {
      const limit = limits[kind];
      if (typeof limit !== "number") problems.push(`${page}: the budget names no limit for ${kind}`);
      else if (measured[page][kind] > limit) {
        const over = measured[page][kind] - limit;
        problems.push(`${page}: ${kind} are ${n(measured[page][kind])} B compressed, over the budget of ${n(limit)} B by ${n(over)} B${limit > 0 ? ` (${((over / limit) * 100).toFixed(1)}%)` : ""}`);
      }
    }
  }
  return problems;
}

// A budget from what is measured, with a margin and rounded up to the next 100 bytes.
export const propose = (measured, margin = 0.05) =>
  Object.fromEntries(Object.entries(measured).map(([page, m]) => [page, Object.fromEntries([...KINDS, "total"].map((k) => [k, Math.ceil((m[k] * (1 + margin)) / 100) * 100]))]));
