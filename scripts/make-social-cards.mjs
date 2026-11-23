// Draws the social card of each public page: a 1200 x 630 PNG with the page's title, in the site's own colours and type, committed under
// public/cards/ so the build copies them. Run by hand from the repository root when a title in config/site.json (meta.pages) changes:
//
//   node scripts/make-social-cards.mjs --playwright <folder holding node_modules/playwright-core> --chrome <chrome-headless-shell executable> [--out public/cards]
//
// The browser library and the browser are not dependencies of the site (as scripts/measure-first-load.mjs). Headless only. The card names
// no figure or year: the page's title, the site's title suffix and the line under them (meta.card_foot in config), and nothing else. The colours are the tokens of src/styles/site.css and
// the two typefaces are the ones the site ships (@fontsource), embedded in the card's page so the picture does not depend on what the
// machine has installed. scripts/check-page-metadata.mjs checks that each card exists and is the size config says.
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const out = resolve(args.out ?? join(repoRoot, "public/cards"));
const { meta } = JSON.parse(readFileSync(join(repoRoot, "config/site.json"), "utf8"));

const css = readFileSync(join(repoRoot, "src/styles/site.css"), "utf8");
const token = (name) => {
  const value = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`).exec(css)?.[1];
  if (!value) throw new Error(`src/styles/site.css has no ${name} token`);
  return value;
};
const font = (pkg, file) => readFileSync(join(repoRoot, "node_modules/@fontsource-variable", pkg, "files", file)).toString("base64");
const serif = font("source-serif-4", "source-serif-4-latin-opsz-normal.woff2");
const sans = font("ibm-plex-sans", "ibm-plex-sans-latin-wght-normal.woff2");
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const card = (title) => `<!DOCTYPE html><html lang="en-NZ"><head><meta charset="utf-8"><style>
@font-face { font-family: "Card Serif"; font-weight: 200 900; src: url(data:font/woff2;base64,${serif}) format("woff2"); }
@font-face { font-family: "Card Sans"; font-weight: 100 700; src: url(data:font/woff2;base64,${sans}) format("woff2"); }
html, body { margin: 0; width: ${meta.card_width}px; height: ${meta.card_height}px; background: ${token("--paper")}; }
body { box-sizing: border-box; padding: 84px 96px; display: flex; flex-direction: column; justify-content: space-between; color: ${token("--ink")}; }
.rule { width: 72px; height: 6px; background: ${token("--accent")}; margin-bottom: 32px; }
.eyebrow { font: 500 30px/1.2 "Card Sans", sans-serif; color: ${token("--ink-2")}; letter-spacing: 0.01em; }
h1 { margin: 0; font: 600 92px/1.08 "Card Serif", Georgia, serif; letter-spacing: -0.015em; text-wrap: balance; max-width: 960px; }
.foot { border-top: 2px solid ${token("--rule-strong")}; padding-top: 24px; font: 400 26px/1.2 "Card Sans", sans-serif; color: ${token("--ink-3")}; }
</style></head><body>
<div><div class="rule"></div><div class="eyebrow">${escape(meta.title_suffix)}</div></div>
<h1>${escape(title)}</h1>
<div class="foot">${escape(meta.card_foot)}</div>
</body></html>`;

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
for (const [id, page] of Object.entries(meta.pages)) {
  if (id === "not_found") continue; // a page kept out of search engines is not one a visitor shares
  const tab = await browser.newPage({ viewport: { width: meta.card_width, height: meta.card_height }, deviceScaleFactor: 1 });
  await tab.setContent(card(page.title));
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: join(out, `${id}.png`), clip: { x: 0, y: 0, width: meta.card_width, height: meta.card_height } });
  await tab.close();
  console.log(`${id}.png`);
}
await browser.close();
