// The performance budget (config/performance_budget.json, scripts/check-performance-budget.mjs) must count what a page ships on first load, from
// the built files alone, and fail naming the page and the kind when a page is over, has no budget, or has a budget and no page.
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error a plain module with no types
import { budgetProblems, measurePages, propose } from "../../scripts/performance-budget.mjs";

const script = fileURLToPath(new URL("../../scripts/check-performance-budget.mjs", import.meta.url));

// An output with one page, `/`, a stylesheet with three font faces (Latin, Latin Extended and Greek), and the scripts given: name -> bytes of text.
function output(scripts: Record<string, string>, page: (links: string) => string, text = "Plain text") {
  const dir = mkdtempSync(join(tmpdir(), "perf-"));
  mkdirSync(join(dir, "_astro"));
  writeFileSync(join(dir, "_astro", "a.css"), `@font-face{src:url(/_astro/latin.woff2);unicode-range:U+0000-00FF}@font-face{src:url(/_astro/latin-ext.woff2);unicode-range:U+100-2BA}@font-face{src:url(/_astro/greek.woff2);unicode-range:U+370-3FF}body{color:#000}`);
  writeFileSync(join(dir, "_astro", "latin.woff2"), randomBytes(1000));
  writeFileSync(join(dir, "_astro", "latin-ext.woff2"), randomBytes(500));
  writeFileSync(join(dir, "_astro", "greek.woff2"), randomBytes(700));
  for (const [name, source] of Object.entries(scripts)) writeFileSync(join(dir, "_astro", name), source);
  const links = `<link rel="stylesheet" href="/_astro/a.css">${Object.keys(scripts).filter((n) => n.startsWith("entry")).map((n) => `<link rel="modulepreload" href="/_astro/${n}">`).join("")}`;
  writeFileSync(join(dir, "index.html"), page(links).replace("TEXT", text));
  return dir;
}
const page = (links: string) => `<!DOCTYPE html><html><head>${links}</head><body><p>TEXT</p></body></html>`;

test("a page's first load is its HTML, its stylesheets, the scripts it names and what they import, and the fonts its text needs", () => {
  const dir = output(
    {
      "entry.js": `import "./static.js"; export const lazy = () => import("./lazy.js");`,
      "static.js": randomBytes(300).toString("base64"),
      "lazy.js": randomBytes(5000).toString("base64"),
    },
    page,
  );
  try {
    const m = measurePages(dir)["/"];
    assert.ok(m.scripts > 300 && m.scripts < 1200, `entry and its static import counted, the lazy one not: ${m.scripts}`);
    assert.equal(m.fonts, 1500, "plain English text: the Latin and Latin Extended faces, the most a page of New Zealand text can load, and not Greek");
    assert.equal(m.total, m.html + m.scripts + m.styles + m.fonts + m.data);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a macron costs nothing: a page with one and a page without load the same fonts", () => {
  const plain = output({}, page, "Taupo");
  const macron = output({}, page, "Taupō");
  try {
    assert.equal(measurePages(plain)["/"].fonts, measurePages(macron)["/"].fonts);
  } finally {
    rmSync(plain, { recursive: true, force: true });
    rmSync(macron, { recursive: true, force: true });
  }
});

test("text that needs another face counts that face", () => {
  const dir = output({}, page, "Alpha is α");
  try {
    assert.equal(measurePages(dir)["/"].fonts, 2200, "a face outside Latin and Latin Extended still counts when the text needs it");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a page over its budget fails, naming the page and the kind; a page within it passes", () => {
  const measured = { "/": { html: 100, scripts: 5000, styles: 50, fonts: 1000, data: 0, total: 6150 } };
  const within = { pages: { "/": { html: 110, scripts: 5100, styles: 60, fonts: 1000, data: 0, total: 6300 } } };
  assert.deepEqual(budgetProblems(measured, within), []);
  const over = { pages: { "/": { html: 110, scripts: 4000, styles: 60, fonts: 1000, data: 0, total: 6300 } } };
  const found = budgetProblems(measured, over) as string[];
  assert.equal(found.length, 1);
  assert.match(found[0], /^\/: scripts are 5,000 B compressed, over the budget of 4,000 B by 1,000 B \(25\.0%\)/);
});

test("a limit of 0 prints the bytes over, with no percentage", () => {
  const found = budgetProblems({ "/": { html: 1, scripts: 40, styles: 1, fonts: 1, data: 0, total: 43 } }, { pages: { "/": { html: 1, scripts: 0, styles: 1, fonts: 1, data: 0, total: 43 } } }) as string[];
  assert.equal(found.length, 1);
  assert.match(found[0], /scripts are 40 B compressed, over the budget of 0 B by 40 B$/);
});

test("a built page with no budget, and a budget with no page, both fail", () => {
  const m = { html: 1, scripts: 0, styles: 1, fonts: 1, data: 0, total: 3 };
  const found = (budgetProblems({ "/new/": m }, { pages: { "/gone/": m } }) as string[]).join("\n");
  assert.match(found, /\/new\/ is built but has no budget/);
  assert.match(found, /\/gone\/ has a budget but is not in the build/);
});

test("a proposed budget is today's bytes plus 5%, rounded up to the next 100", () => {
  const p = propose({ "/": { html: 1000, scripts: 0, styles: 5046, fonts: 168072, data: 1, total: 174119 } });
  assert.deepEqual(p["/"], { html: 1100, scripts: 0, styles: 5300, fonts: 176500, data: 100, total: 182900 });
});

test("the command exits 1 on a planted page over its budget, naming it, and 0 when it is within", () => {
  const dir = output({ "entry.js": randomBytes(3000).toString("base64") }, page);
  const repo = mkdtempSync(join(tmpdir(), "perf-repo-"));
  try {
    mkdirSync(join(repo, "config"));
    const measured = measurePages(dir)["/"];
    const budget = (scripts: number) => JSON.stringify({ pages: { "/": { ...measured, scripts } } });
    writeFileSync(join(repo, "config/performance_budget.json"), budget(measured.scripts));
    const ok = spawnSync(process.execPath, [script, dir, "--repo", repo], { encoding: "utf8" });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    writeFileSync(join(repo, "config/performance_budget.json"), budget(measured.scripts - 100));
    const over = spawnSync(process.execPath, [script, dir, "--repo", repo], { encoding: "utf8" });
    assert.equal(over.status, 1);
    assert.match(over.stderr, /^- \/: scripts are/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
});

test("the real budget names the limit for every kind on every page", () => {
  const budget = JSON.parse(readFileSync(join(fileURLToPath(new URL("../..", import.meta.url)), "config/performance_budget.json"), "utf8"));
  assert.ok(Object.keys(budget.pages).length > 0);
  for (const [page, limits] of Object.entries(budget.pages) as Array<[string, Record<string, number>]>) {
    for (const kind of ["html", "scripts", "styles", "fonts", "data", "total"]) assert.equal(typeof limits[kind], "number", `${page} has no ${kind}`);
  }
});

test("a page that asks for files before its script has run also has a first-chart figure, and a script its inline script names is counted", () => {
  const dir = output({ "entry.js": randomBytes(400).toString("base64"), "late.js": randomBytes(4000).toString("base64") }, (links) => `<!DOCTYPE html><html><head>${links}<script>Promise.all([import("/_astro/entry.js")]).then(()=>{for(const href of ["/_astro/late.js"]){}})</script></head><body><script>(function(){const reads = ["/data/events.json","/data/cube/a.parquet"];})()</script><p>TEXT</p></body></html>`);
  try {
    mkdirSync(join(dir, "data/cube"), { recursive: true });
    writeFileSync(join(dir, "data/events.json"), JSON.stringify({ events: "x".repeat(5000) }));
    writeFileSync(join(dir, "data/cube/a.parquet"), randomBytes(700));
    const m = measurePages(dir)["/"];
    assert.ok(m.scripts > 4000, `the script only the inline script names is counted: ${m.scripts}`);
    // the JSON is compressed as the host does, the Parquet file is sent as it is
    assert.ok(m.first_chart_bytes > m.total + 700 && m.first_chart_bytes < m.total + 700 + 400, `${m.first_chart_bytes} against a total of ${m.total}`);
    assert.equal(measurePages(output({}, page))["/"].first_chart_bytes, undefined, "a page that asks for nothing has no first-chart figure");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a first-chart figure over its limit fails, naming the page; a limit with no figure, and a figure with no limit, fail too", () => {
  const m = { html: 1, scripts: 40, styles: 1, fonts: 1, data: 0, total: 43, first_chart_bytes: 90 };
  const limits = { html: 1, scripts: 40, styles: 1, fonts: 1, data: 0, total: 43 };
  assert.deepEqual(budgetProblems({ "/": m }, { pages: { "/": { ...limits, first_chart_bytes: 90 } } }), []);
  const over = budgetProblems({ "/": m }, { pages: { "/": { ...limits, first_chart_bytes: 80 } } }) as string[];
  assert.equal(over.length, 1);
  assert.match(over[0], /^\/: the first chart's critical path is 90 B compressed, over the budget of 80 B by 10 B/);
  assert.match((budgetProblems({ "/": m }, { pages: { "/": limits } }) as string[]).join("\n"), /names no limit for first_chart_bytes/);
  assert.match((budgetProblems({ "/": { ...m, first_chart_bytes: undefined } }, { pages: { "/": { ...limits, first_chart_bytes: 90 } } }) as string[]).join("\n"), /asks for nothing before its script has run/);
  assert.equal(propose({ "/": m })["/"].first_chart_bytes, 100);
});

test("the page the budget times is a page the measuring script visits, and has a byte limit for the same first chart", () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const budget = JSON.parse(readFileSync(join(root, "config/performance_budget.json"), "utf8"));
  const visited = JSON.parse(readFileSync(join(root, "scripts/first-load-pages.json"), "utf8")).pages.map((p: { path: string }) => p.path);
  const timed = Object.entries(budget.pages).filter(([, limits]) => typeof (limits as Record<string, unknown>).first_chart_ms === "number");
  assert.ok(timed.length > 0, "a page has a time limit");
  for (const [page, limits] of timed as Array<[string, Record<string, number>]>) {
    assert.ok(visited.includes(page), `${page} has first_chart_ms but scripts/first-load-pages.json does not visit it`);
    assert.equal(typeof limits.first_chart_bytes, "number", `${page} has a time limit and no limit on the bytes that give it`);
  }
});

test("a page with a first-chart figure fails, naming the page, when its HTML does not name the drawing library the build holds", () => {
  const withReads = (script: string) => (links: string) => `<!DOCTYPE html><html><head>${links}${script}</head><body><script>(function(){const reads = ["/data/events.json"];})()</script><p>TEXT</p></body></html>`;
  const files = { "entry.js": "export const a = 1;", "plot.abc123.js": randomBytes(3000).toString("base64") };
  const missing = output(files, withReads(""));
  const named = output(files, withReads(`<script>Promise.all([import("/_astro/entry.js")]).then(()=>{for(const href of ["/_astro/plot.abc123.js"]){}})</script>`));
  try {
    for (const dir of [missing, named]) {
      mkdirSync(join(dir, "data"), { recursive: true });
      writeFileSync(join(dir, "data/events.json"), "{}");
    }
    const lost = measurePages(missing)["/"];
    const problems = budgetProblems({ "/": lost }, { pages: { "/": { html: 1e6, scripts: 1e6, styles: 1e6, fonts: 1e6, data: 1e6, total: 1e6, first_chart_bytes: 1e6 } } }) as string[];
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^\/: the page's HTML does not name the drawing library \(\/_astro\/plot\.abc123\.js, [\d,]+ B\)/);
    assert.equal(measurePages(named)["/"].unnamed_drawing, undefined);
    assert.ok(measurePages(named)["/"].scripts > measurePages(missing)["/"].scripts, "named, the library is in the scripts figure");
  } finally {
    rmSync(missing, { recursive: true, force: true });
    rmSync(named, { recursive: true, force: true });
  }
});
