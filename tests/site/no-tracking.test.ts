// The no-tracking check (scripts/check-no-tracking.mjs, config/public_privacy.json) is a privacy guard: it must pass on an output that
// loads only its own files, and fail on each way a page could reach another origin or keep something on a visitor's device.
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error a plain module with no types
import { trackingProblems } from "../../scripts/check-no-tracking.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const rules = JSON.parse(readFileSync(join(repoRoot, "config/public_privacy.json"), "utf8"));

// An output folder with the files given (path -> text), and a repository folder whose site.json holds the address given.
function problems(files: Record<string, string>, { address = "[TO DECIDE: the site's web address]", env = {} as Record<string, string> } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "no-tracking-"));
  try {
    const out = join(dir, "dist");
    const repo = join(dir, "repo");
    mkdirSync(join(out, "_astro"), { recursive: true });
    mkdirSync(join(repo, "config"), { recursive: true });
    writeFileSync(join(repo, "config/site.json"), JSON.stringify({ about: { site_address: address } }));
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(dirname(join(out, name)), { recursive: true });
      writeFileSync(join(out, name), text);
    }
    return trackingProblems(out, rules, { repoRoot: repo, env }) as string[];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const page = (head = "", body = "") => `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;

test("an output that loads only its own files, links out, and keeps saved questions in localStorage passes", () => {
  const found = problems({
    "index.html": page(
      `<link rel="stylesheet" href="/_astro/a.css"><link rel="modulepreload" href="/_astro/a.js"><link rel="canonical" href="https://example.org/"><script>window.localStorage.setItem("k", "v")</script>`,
      `<a href="https://www.nzta.govt.nz/">NZTA</a><a href="//example.org/x">other</a><img src="/x.png"><img src="data:image/png;base64,AAAA">`,
    ),
    "_astro/a.css": `@font-face { src: url(/_astro/f.woff2) } body { background: url(data:image/png;base64,AAAA) }`,
    "_astro/a.js": `export const a = fetch("/data/manifest.json"); const ns = "http://www.w3.org/2000/svg"; localStorage.getItem("k");`,
    "_headers": "/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n",
  });
  assert.deepEqual(found, []);
});

test("a script, stylesheet, image, frame, preconnect or form on another origin fails, naming the page", () => {
  const found = problems({
    "p/index.html": page(
      `<script src="https://cdn.example.com/x.js"></script><link rel="stylesheet" href="//fonts.example.com/f.css"><link rel="preconnect" href="https://fonts.example.com">`,
      `<img srcset="/a.png 1x, https://img.example.com/b.png 2x"><iframe src="https://embed.example.com/"></iframe><form action="https://forms.example.com/post"></form>`,
    ),
  });
  const text = found.join("\n");
  for (const needle of ["cdn.example.com/x.js", "fonts.example.com/f.css", "preconnect", "img.example.com/b.png", "embed.example.com", "forms.example.com"]) assert.match(text, new RegExp(needle.replace(".", "\\.")), `${needle} was not found:\n${text}`);
  assert.ok(found.every((f) => f.startsWith("p/index.html")));
});

test("a cookie, session storage, IndexedDB, a beacon, XMLHttpRequest or a WebSocket in a script fails; localStorage does not", () => {
  const found = problems({
    "index.html": page("", `<script>document.cookie = "a=b"; sessionStorage.x = 1; navigator.sendBeacon("/x")</script>`),
    "_astro/a.js": `indexedDB.open("x"); new XMLHttpRequest(); new WebSocket("wss://x"); localStorage.setItem("a", "b");`,
  });
  const text = found.join("\n");
  for (const needle of ["cookie", "session storage", "IndexedDB", "beacon", "XMLHttpRequest", "WebSocket"]) assert.match(text, new RegExp(needle, "i"), `${needle} was not found:\n${text}`);
  assert.doesNotMatch(text, /localStorage is used|local storage/i);
});

test("an analytics snippet, in a page or a script, fails", () => {
  const found = problems({
    "index.html": page(`<script async src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>`, `<script>window.dataLayer = window.dataLayer || []; gtag('js', new Date());</script>`),
    "_astro/a.js": `const s = "https://static.cloudflareinsights.com/beacon.min.js";`,
  });
  const text = found.join("\n");
  assert.match(text, /googletagmanager/);
  assert.match(text, /dataLayer/);
  assert.match(text, /cloudflareinsights/);
});

test("a script that fetches an address on another origin, or names one the config does not allow, fails; an ordinary word does not", () => {
  const found = problems({
    "_astro/a.js": `fetch("https://api.example.com/answer"); const x = "https://other.example.com/y"; const note = "an implausible double click";`,
  });
  const text = found.join("\n");
  assert.match(text, /fetches https:\/\/api\.example\.com/);
  assert.match(text, /names https:\/\/other\.example\.com/);
  assert.doesNotMatch(text, /tracking or tag product/);
});

test("a stylesheet that loads a font or an image from another origin fails", () => {
  const found = problems({ "_astro/a.css": `@import url("https://fonts.example.com/css"); @font-face { src: url(https://f.example.com/a.woff2) }` });
  assert.equal(found.length, 2, found.join("\n"));
});

test("a Set-Cookie header, server code, or a query service address in the build fails", () => {
  const found = problems({ "_headers": "/*\n  Set-Cookie: a=b\n", "_worker.js": "export default {}" }, { env: { PUBLIC_QUERY_SERVICE: "https://q.example.com" } });
  const text = found.join("\n");
  assert.match(text, /set-cookie/i);
  assert.match(text, /_worker\.js/);
  assert.match(text, /PUBLIC_QUERY_SERVICE/);
});

test("a social card image is allowed only at the site's own address, once it is set", () => {
  const card = { "index.html": page(`<meta property="og:image" content="https://example.org/cards/home.png"><meta name="twitter:image" content="https://example.org/cards/home.png">`) };
  assert.equal(problems(card).length, 2, "no address is set, so no page may name one");
  assert.deepEqual(problems(card, { address: "https://example.org" }), []);
  assert.equal(problems(card, { address: "https://other.example.com" }).length, 2);
});

test("the command exits 1 on a planted third-party script and 0 on the clean output", () => {
  const dir = mkdtempSync(join(tmpdir(), "no-tracking-cli-"));
  try {
    mkdirSync(join(dir, "_astro"));
    writeFileSync(join(dir, "index.html"), page(`<link rel="stylesheet" href="/_astro/a.css">`));
    writeFileSync(join(dir, "_astro/a.css"), "body{}");
    const clean = spawnSync(process.execPath, [join(repoRoot, "scripts/check-no-tracking.mjs"), dir], { encoding: "utf8" });
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    assert.match(clean.stdout, /localStorage/);
    writeFileSync(join(dir, "index.html"), page(`<script src="https://cdn.example.com/x.js"></script>`));
    const planted = spawnSync(process.execPath, [join(repoRoot, "scripts/check-no-tracking.mjs"), dir], { encoding: "utf8" });
    assert.equal(planted.status, 1);
    assert.match(planted.stderr, /index\.html/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
