// Measures how long a page takes to draw its first answer on a phone, and what it downloaded to do so.
// Run by hand from the repository root, after a production build (docs/STATE.md, How to run):
//
//   node scripts/measure-first-load.mjs --playwright <folder holding node_modules/playwright-core>
//        --chrome <path to chrome-headless-shell> [--dist dist] [--port 4341] [--runs 5] [--pages home,q3]
//        [--profile phone|desktop] [--out <folder for the JSON result>] [--screens <folder for screenshots>]
//
// The browser library and the browser are not dependencies of the site: install playwright-core in a folder outside the
// repository. Headless only.
//
// The method is the one D-091 recorded: a new visitor (a fresh browser context, so an empty cache) opens the link; the
// phone profile is 390 x 844 px, 150 ms added latency, 1.6 Mbps down, 750 kbps up, processor slowed four times. The site
// is served from this script's own static server standing in for Cloudflare Pages: text (page, script, style, JSON)
// gzipped, Parquet and fonts sent as they are, an ETag on every file and `Cache-Control: public, max-age=0,
// must-revalidate`. `astro preview` sends nothing compressed, so it is not used for the figure.
//
// "First answer" is the time from the start of navigation until the page has drawn every chart it draws on its own
// (the count is found by a first, unthrottled visit), and "first chart" the time until the first of them is drawn.
// Bytes are what crossed the network (headers included) as Chrome reports them, split by what the file is.

import { createReadStream, existsSync, readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, join, normalize, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") ? "true" : (all[i + 1] ?? "true")]] : acc), []),
);
const dist = resolve(args.dist ?? "dist");
const port = Number(args.port ?? 4341);
const runs = Number(args.runs ?? 5);
const profile = args.profile ?? "phone";
const pagesFile = JSON.parse(readFileSync(new URL("./first-load-pages.json", import.meta.url), "utf8"));
const wanted = args.pages ? args.pages.split(",") : pagesFile.pages.map((p) => p.id);
const pages = pagesFile.pages.filter((p) => wanted.includes(p.id));
const playwrightDir = args.playwright ?? process.env.PLAYWRIGHT_CORE_DIR;
const chrome = args.chrome ?? process.env.CHROME_HEADLESS_SHELL;
if (!playwrightDir || !chrome) {
  console.error("Give --playwright <folder holding node_modules/playwright-core> and --chrome <chrome-headless-shell executable> (or set PLAYWRIGHT_CORE_DIR and CHROME_HEADLESS_SHELL).");
  process.exit(2);
}
const { chromium } = createRequire(join(resolve(playwrightDir), "x.js"))("playwright-core");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".parquet": "application/octet-stream", ".svg": "image/svg+xml" };
const COMPRESSED = new Set([".html", ".js", ".css", ".json", ".svg"]);
const gzipped = new Map();

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  let file = normalize(join(dist, decodeURIComponent(url.pathname)));
  if (file !== dist && !file.startsWith(dist + sep)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) return void res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  const ext = extname(file);
  const stat = statSync(file);
  const headers = { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "public, max-age=0, must-revalidate", etag: `"${stat.size}-${Math.floor(stat.mtimeMs)}"`, vary: "Accept-Encoding" };
  if (req.headers["if-none-match"] === headers.etag) return void res.writeHead(304, headers).end();
  if (COMPRESSED.has(ext) && /\bgzip\b/.test(String(req.headers["accept-encoding"]))) {
    if (!gzipped.has(file)) gzipped.set(file, gzipSync(readFileSync(file)));
    const body = gzipped.get(file);
    return void res.writeHead(200, { ...headers, "content-encoding": "gzip", "content-length": body.length }).end(body);
  }
  res.writeHead(200, { ...headers, "content-length": stat.size });
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(port, "127.0.0.1", ok));
const base = `http://127.0.0.1:${port}`;

const PROFILES = {
  phone: { viewport: { width: 390, height: 844 }, latency: 150, down: (1.6 * 1e6) / 8, up: (750 * 1e3) / 8, cpu: 4 },
  desktop: { viewport: { width: 1280, height: 800 }, latency: 0, down: -1, up: -1, cpu: 1 },
};
const prof = PROFILES[profile];

const kindOf = (url) => {
  const path = new URL(url).pathname;
  if (path.startsWith("/data/") || path.startsWith("/geo/")) return "data";
  if (path.endsWith(".woff2")) return "fonts";
  return "code";
};

// Installed before the page's own scripts: records when each count of drawn charts was first reached. A drawn chart is
// the figure Plot returns, which PlotFigure marks role="img".
const initScript = () => {
  window.__drawn = [];
  const check = () => {
    const n = document.querySelectorAll("figure[role=img], svg[role=img]").length;
    if (n > window.__drawn.length) for (let i = window.__drawn.length; i < n; i++) window.__drawn.push(performance.now());
  };
  new MutationObserver(check).observe(document, { childList: true, subtree: true });
};

const browser = await chromium.launch({ executablePath: chrome, headless: true });

async function visit(page, { throttle, settleMs, shot }) {
  const context = await browser.newContext({ viewport: prof.viewport });
  const tab = await context.newPage();
  await tab.addInitScript(initScript);
  const cdp = await context.newCDPSession(tab);
  await cdp.send("Network.enable");
  if (throttle) {
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: prof.latency, downloadThroughput: prof.down, uploadThroughput: prof.up });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: prof.cpu });
  }
  const requests = new Map();
  let t0 = null;
  cdp.on("Network.requestWillBeSent", (e) => {
    if (t0 === null) t0 = e.timestamp;
    requests.set(e.requestId, { url: e.request.url, start: e.timestamp });
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = requests.get(e.requestId);
    if (r) Object.assign(r, { bytes: e.encodedDataLength, end: e.timestamp });
  });
  const errors = [];
  tab.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  tab.on("pageerror", (e) => errors.push(String(e)));
  await tab.goto(base + page.path, { waitUntil: "commit" });
  const expected = page.expected ?? 1;
  let timedOut = false;
  try {
    await tab.waitForFunction((n) => window.__drawn.length >= n, expected, { timeout: throttle ? 90_000 : 30_000, polling: 50 });
  } catch {
    timedOut = true;
  }
  const drawn = await tab.evaluate(() => window.__drawn.slice());
  if (settleMs) await tab.waitForTimeout(settleMs);
  const settled = settleMs ? await tab.evaluate(() => window.__drawn.length) : drawn.length;
  if (shot) await tab.screenshot({ path: shot, fullPage: false });
  const done = [...requests.values()].filter((r) => r.end !== undefined);
  const by = { code: { bytes: 0, requests: 0 }, fonts: { bytes: 0, requests: 0 }, data: { bytes: 0, requests: 0 } };
  for (const r of done) {
    const k = kindOf(r.url);
    by[k].bytes += r.bytes;
    by[k].requests += 1;
  }
  const lastCode = Math.max(0, ...done.filter((r) => kindOf(r.url) === "code").map((r) => (r.end - t0) * 1000));
  const result = {
    timedOut,
    firstChartMs: drawn[0] ?? null,
    firstAnswerMs: drawn[expected - 1] ?? null,
    chartsDrawn: settled,
    codeLastByteMs: Math.round(lastCode),
    dataLastByteMs: Math.round(Math.max(0, ...done.filter((r) => kindOf(r.url) === "data").map((r) => (r.end - t0) * 1000))),
    dataFirstRequestMs: Math.round(Math.min(...done.filter((r) => kindOf(r.url) === "data").map((r) => (r.start - t0) * 1000))),
    fontsLastByteMs: Math.round(Math.max(0, ...done.filter((r) => kindOf(r.url) === "fonts").map((r) => (r.end - t0) * 1000))),
    bytes: by,
    totalBytes: by.code.bytes + by.fonts.bytes + by.data.bytes,
    totalRequests: done.length,
    errors,
    dataFiles: done.filter((r) => kindOf(r.url) === "data").map((r) => ({ path: new URL(r.url).pathname, bytes: r.bytes })),
  };
  await context.close();
  return result;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const out = {};
for (const page of pages) {
  const calib = await visit(page, { throttle: false, settleMs: 2500 });
  page.expected = page.expected ?? Math.max(1, calib.chartsDrawn);
  const results = [];
  for (let i = 0; i < runs; i++) {
    const shot = args.screens && i === 0 ? join(resolve(args.screens), `${args.label ?? "run"}-${page.id}-${prof.viewport.width}.png`) : undefined;
    if (shot) mkdirSync(resolve(args.screens), { recursive: true });
    results.push(await visit(page, { throttle: profile !== "desktop", settleMs: shot ? 800 : 0, shot }));
  }
  const ok = results.filter((r) => !r.timedOut && r.firstAnswerMs !== null);
  const ms = (k) => (ok.length ? { median: Math.round(median(ok.map((r) => r[k]))), min: Math.round(Math.min(...ok.map((r) => r[k]))), max: Math.round(Math.max(...ok.map((r) => r[k]))) } : null);
  const mid = ok[0] ?? results[0];
  out[page.id] = {
    path: page.path,
    chartsExpected: page.expected,
    runs: results.length,
    failedRuns: results.length - ok.length,
    firstChartMs: ms("firstChartMs"),
    firstAnswerMs: ms("firstAnswerMs"),
    codeLastByteMs: ms("codeLastByteMs"),
    dataFirstRequestMs: ms("dataFirstRequestMs"),
    dataLastByteMs: ms("dataLastByteMs"),
    fontsLastByteMs: ms("fontsLastByteMs"),
    bytes: Object.fromEntries(["code", "fonts", "data"].map((k) => [k, { bytes: Math.round(median(results.map((r) => r.bytes[k].bytes))), requests: Math.round(median(results.map((r) => r.bytes[k].requests))) }])),
    totalBytes: Math.round(median(results.map((r) => r.totalBytes))),
    totalRequests: Math.round(median(results.map((r) => r.totalRequests))),
    errors: [...new Set(results.flatMap((r) => r.errors))],
    dataFiles: mid.dataFiles,
  };
  console.log(`${page.id}: first chart ${out[page.id].firstChartMs?.median} ms, first answer ${out[page.id].firstAnswerMs?.median} ms [${out[page.id].firstAnswerMs?.min}-${out[page.id].firstAnswerMs?.max}], ${out[page.id].totalBytes} bytes in ${out[page.id].totalRequests} requests (code ${out[page.id].bytes.code.bytes}, fonts ${out[page.id].bytes.fonts.bytes}, data ${out[page.id].bytes.data.bytes})`);
}
if (args.out) {
  mkdirSync(resolve(args.out), { recursive: true });
  const name = join(resolve(args.out), `${args.label ?? "run"}-${profile}.json`);
  writeFileSync(name, JSON.stringify(out, null, 2) + "\n");
  console.log(`written ${name}`);
}
await browser.close();
server.close();
