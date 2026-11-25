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
// A page that asks for files before its script has run (the canvas, src/lib/openingReads.ts) also has a first-chart figure: the five kinds
// and those files (gzipped; a Parquet file as served). It is what crosses the network before the first chart can be drawn, less the drawing
// code of the chart's own shape, which the page cannot name, and less the requests' headers. scripts/measure-first-load.mjs times it.
// gzip stands in for the host's compression (as scripts/measure-first-load.mjs does); a browser that accepts Brotli is sent less.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

export const KINDS = ["html", "scripts", "styles", "fonts", "data"];
export const FIRST_CHART = "first_chart_bytes";

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
  // The files the page's own inline script asks for when it opens on its own chart: `const reads = [...]`, written there by define:vars.
  const opening = /\bconst reads = (\[[^\]]*\])/.exec(html)?.[1];
  let reads = [];
  try {
    reads = opening ? JSON.parse(opening).map(local).filter(Boolean) : [];
  } catch {
    // an inline script that is not that list asks for nothing
  }
  return { styles: [...new Set(styles)], scripts: [...scripts], fonts: [...fonts], data: [...new Set(data)], reads: [...new Set(reads)] };
}

// The drawing library's chunks in a build (the chunk named "plot", astro.config.mjs).
const drawingChunks = (root) => (existsSync(join(root, "_astro")) ? readdirSync(join(root, "_astro")).filter((f) => /^plot\.[\w-]+\.js$/.test(f)).map((f) => `/_astro/${f}`) : []);

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
    const total = KINDS.reduce((n, k) => n + m[k], 0);
    // Only Parquet is sent as it is; text is compressed, as the host does.
    const reads = sum(f.reads, (p) => (p.endsWith(".parquet") ? statSync(p).size : gz(p)));
    // The drawing library is named by a script the build writes into the page (astro.config.mjs, preloadIslands). If that script is lost the library
    // (about 90 KB) drops out of every figure above while the chart still needs it, so a page with a first-chart figure must name every one in the build.
    const unnamed = f.reads.length ? drawingChunks(root).filter((url) => !f.scripts.includes(url)) : [];
    pages[key] = { ...m, total, ...(f.reads.length ? { [FIRST_CHART]: total + reads } : {}), ...(unnamed.length ? { unnamed_drawing: unnamed.map((url) => ({ url, bytes: gz(join(root, url)) })) } : {}) };
  }
  return Object.fromEntries(Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)));
}

const n = (x) => x.toLocaleString("en-NZ");

// A budget key that ends in "/*" holds every page whose address begins with what comes before the star (the pages a build generates, one for each brand or
// model, are held to one entry, not one each); any other key is one page. A page with an entry of its own is held to that, else to the longest pattern that covers it.
export const isPattern = (key) => key.endsWith("/*");
const covers = (key, page) => (isPattern(key) ? page.startsWith(key.slice(0, -1)) : key === page);
export function budgetFor(budget, page) {
  if (budget.pages[page] && !isPattern(page)) return page;
  return Object.keys(budget.pages)
    .filter((key) => isPattern(key) && covers(key, page))
    .sort((a, b) => b.length - a.length)[0];
}

// The problems: a page with no budget, a budget with no page, a kind over its limit, each naming the page and the kind. Of the pages one pattern holds, the
// worst is named, with how many more are over.
export function budgetProblems(measured, budget) {
  const problems = [];
  for (const page of Object.keys(measured)) if (budgetFor(budget, page) === undefined) problems.push(`${page} is built but has no budget: add it to config/performance_budget.json (run the check with --propose for the numbers)`);
  for (const [key, limits] of Object.entries(budget.pages)) {
    const pages = Object.keys(measured).filter((page) => budgetFor(budget, page) === key);
    if (pages.length === 0) {
      problems.push(isPattern(key) ? `${key} has a budget but no page of the build is under it: remove it from config/performance_budget.json` : `${key} has a budget but is not in the build: remove it from config/performance_budget.json`);
      continue;
    }
    for (const page of pages) {
      for (const { url, bytes } of measured[page].unnamed_drawing ?? []) problems.push(`${page}: the page's HTML does not name the drawing library (${url}, ${n(bytes)} B): the script that asks for it is missing, so those bytes are in no figure and the chart slows`);
      if (measured[page][FIRST_CHART] !== undefined && typeof limits[FIRST_CHART] !== "number") problems.push(`${page}: the budget names no limit for ${FIRST_CHART}`);
    }
    for (const kind of [...KINDS, "total", ...(typeof limits[FIRST_CHART] === "number" ? [FIRST_CHART] : [])]) {
      const limit = limits[kind];
      if (kind === FIRST_CHART && pages.some((page) => measured[page][kind] === undefined)) {
        problems.push(`${key}: the budget has a limit for ${kind} but the page asks for nothing before its script has run`);
        continue;
      }
      if (typeof limit !== "number") {
        problems.push(`${key}: the budget names no limit for ${kind}`);
        continue;
      }
      const over = pages.filter((page) => measured[page][kind] > limit).sort((a, b) => measured[b][kind] - measured[a][kind] || (a < b ? -1 : 1));
      if (over.length === 0) continue;
      const [worst] = over;
      const by = measured[worst][kind] - limit;
      const more = over.length > 1 ? ` (${over.length - 1} more page${over.length === 2 ? "" : "s"} under ${key} ${over.length === 2 ? "is" : "are"} over it too)` : "";
      problems.push(`${worst}: ${kind === FIRST_CHART ? "the first chart's critical path is" : `${kind} are`} ${n(measured[worst][kind])} B compressed, over the budget of ${n(limit)} B by ${n(by)} B${limit > 0 ? ` (${((by / limit) * 100).toFixed(1)}%)` : ""}${more}`);
    }
  }
  return problems;
}

// A budget from what is measured, with a margin and rounded up to the next 100 bytes. A page a pattern in `patterns` covers is not given a line of its own: the
// pattern's line is the largest of each kind over the pages it covers, plus the margin.
export function propose(measured, margin = 0.05, patterns = []) {
  const round = (x) => Math.ceil((x * (1 + margin)) / 100) * 100;
  const kindsOf = (m) => [...KINDS, "total", ...(m[FIRST_CHART] === undefined ? [] : [FIRST_CHART])];
  const heldBy = (page) => patterns.filter((key) => covers(key, page)).sort((a, b) => b.length - a.length)[0];
  const out = {};
  for (const [page, m] of Object.entries(measured)) {
    const key = heldBy(page);
    if (key === undefined) out[page] = Object.fromEntries(kindsOf(m).map((k) => [k, round(m[k])]));
    else out[key] = Object.fromEntries(kindsOf(m).map((k) => [k, Math.max(out[key]?.[k] ?? 0, round(m[k]))]));
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
