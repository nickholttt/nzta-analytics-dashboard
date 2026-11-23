// Loads every public page in a headless browser and holds what actually happens to the same rules as the static checks. Run by hand,
// not in CI: it needs a browser, and the browser library is not a dependency of the site (as scripts/measure-first-load.mjs).
//
//   npx astro preview --port 4333        (after INTERNAL_PAGES=false npx astro build; stop it with: npx astro preview stop)
//   node scripts/check-public-browser.mjs --playwright <folder holding node_modules/playwright-core>
//        --chrome <chrome-headless-shell executable> [--base http://127.0.0.1:4333] [--dist dist] [--widths 390,1280]
//
// For each page the build holds (and 404.html, asked for at an address the site does not have), at each width:
//   - every request the page makes goes to the preview's own origin (the static check cannot see an address built while the page runs);
//   - the page sets no cookie, and writes nothing to localStorage, sessionStorage or IndexedDB on its own (a saved question is the visitor's act);
//   - the words the page draws, which the static lint cannot see because the charts and the canvas draw their own, hold no internal term
//     (config/narrative/plain_english.json), with the page's title, description and the alt and aria-label words.
// Exit 0 when every page passes. Headless only.
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findHits, isAllowed, loadRules } from "./plain-english.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") ? "true" : (all[i + 1] ?? "true")]] : acc), []),
);
const playwrightDir = args.playwright ?? process.env.PLAYWRIGHT_CORE_DIR;
const chrome = args.chrome ?? process.env.CHROME_HEADLESS_SHELL;
if (!playwrightDir || !chrome) {
  console.error("Give --playwright <folder holding node_modules/playwright-core> and --chrome <chrome-headless-shell executable> (or set PLAYWRIGHT_CORE_DIR and CHROME_HEADLESS_SHELL).");
  process.exit(2);
}
const { chromium } = createRequire(join(resolve(playwrightDir), "x.js"))("playwright-core");
const base = (args.base ?? "http://127.0.0.1:4333").replace(/\/$/, "");
const dist = resolve(args.dist ?? "dist");
const widths = (args.widths ?? "390,1280").split(",").map(Number);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const rules = loadRules(repoRoot);

const paths = readdirSync(dist, { recursive: true, encoding: "utf8" })
  .map((f) => f.replace(/\\/g, "/"))
  .filter((f) => f.endsWith(".html") && !f.startsWith("data/"))
  .map((f) => (f === "404.html" ? "/this-page-does-not-exist" : f === "index.html" ? "/" : `/${f.replace(/index\.html$/, "")}`));

// What the page draws: every text node outside script and style (hidden ones too, since a closed menu is still words a visitor reaches), and
// the words in alt, aria-label, title and placeholder attributes, with the document's title and meta words.
const collect = () => {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let text = "";
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const tag = n.parentElement?.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") continue;
    text += ` ${n.textContent}`;
  }
  out.push({ source: "page text", text });
  for (const el of document.querySelectorAll("[alt],[aria-label],[title],[placeholder],[aria-description]"))
    for (const a of ["alt", "aria-label", "title", "placeholder", "aria-description"]) if (el.getAttribute(a)) out.push({ source: a, text: el.getAttribute(a) });
  out.push({ source: "title", text: document.title });
  for (const m of document.querySelectorAll('meta[name="description"],meta[property^="og:"],meta[name^="twitter:"]'))
    if (!/image$|url$|card$|type$/.test(m.getAttribute("property") ?? m.getAttribute("name") ?? "")) out.push({ source: `meta ${m.getAttribute("property") ?? m.getAttribute("name")}`, text: m.content });
  return out;
};

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const problems = [];
for (const width of widths) {
  for (const path of paths) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    const foreign = [];
    page.on("request", (r) => {
      const url = r.url();
      if (!url.startsWith("data:") && !url.startsWith("blob:") && new URL(url).origin !== base) foreign.push(url);
    });
    const label = `${path} at ${width} px`;
    try {
      await page.goto(base + path, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(800);
      for (const url of foreign) problems.push(`${label}: a request to ${url}, which is not ${base}`);
      const cookies = await context.cookies();
      if (cookies.length) problems.push(`${label}: cookies set: ${cookies.map((c) => c.name).join(", ")}`);
      const stored = await page.evaluate(async () => ({
        cookie: document.cookie,
        local: Object.keys(window.localStorage),
        session: Object.keys(window.sessionStorage),
        databases: (await indexedDB.databases?.())?.length ?? 0,
      }));
      if (stored.cookie) problems.push(`${label}: document.cookie is not empty`);
      if (stored.local.length) problems.push(`${label}: localStorage written on load: ${stored.local.join(", ")}`);
      if (stored.session.length) problems.push(`${label}: sessionStorage written: ${stored.session.join(", ")}`);
      if (stored.databases) problems.push(`${label}: IndexedDB opened`);
      if (width === widths[0]) {
        for (const w of await page.evaluate(collect)) {
          const text = w.text.replace(/\s+/g, " ").trim();
          for (const hit of findHits(rules, `${label} > ${w.source}`, text, true)) if (!isAllowed(rules, hit, `${path.slice(1)}index.html`)) problems.push(`${hit.source}: "${hit.text}" holds "${hit.rule}"; write instead: ${hit.sayInstead}`);
        }
      }
    } catch (error) {
      problems.push(`${label}: could not be loaded: ${error.message.split("\n")[0]}`);
    }
    await context.close();
  }
}
await browser.close();

if (problems.length) {
  console.error([...new Set(problems)].map((p) => `- ${p}`).join("\n"));
  process.exit(1);
}
console.log(`${paths.length} pages at ${widths.join(" and ")} px: every request went to ${base}, no cookie or stored value was set on load, and no internal term was drawn.`);
