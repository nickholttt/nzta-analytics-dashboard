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

// ---- Holes found by the review of the pull request: each case below was missed before and is planted here. ----

test("an attribute value is read as a browser reads it: a quoted address in an escaped style attribute, and a '>' inside an earlier attribute", () => {
  const style = problems({ "index.html": page("", `<div style="background:url(&quot;https://evil.example/a.png&quot;)"></div>`) });
  assert.match(style.join("\n"), /evil\.example\/a\.png/);
  const gt = problems({ "index.html": page("", `<img alt="a > b" src="https://evil.example/p.gif">`) });
  assert.match(gt.join("\n"), /<img src="https:\/\/evil\.example\/p\.gif">/);
  const entity = problems({ "index.html": page("", `<img src="https:&#47;&#47;evil.example/p.gif">`) });
  assert.match(entity.join("\n"), /evil\.example/);
});

test("a protocol-relative address that opens a string in a script fails; a comment that holds '//' does not", () => {
  const found = problems({ "_astro/a.js": `new Image().src="//evil.example/p.gif"; const s = document.createElement("script"); s.src='//evil.example/t.js';` }).join("\n");
  assert.match(found, /\/\/evil\.example\/p\.gif/);
  assert.match(found, /\/\/evil\.example\/t\.js/);
  assert.deepEqual(problems({ "_astro/a.js": `// see //example.org/notes for why\nconst x = 1; // a.b //c.d` }), []);
});

test("a ping on a link or an area fails", () => {
  const found = problems({ "index.html": page("", `<a href="/x" ping="https://evil.example/p">x</a><area href="/y" ping="//evil.example/q">`) }).join("\n");
  assert.match(found, /<a ping="https:\/\/evil\.example\/p">/);
  assert.match(found, /<area ping="\/\/evil\.example\/q">/);
});

test("a redirect to another origin, and a Link header naming one, fail; a redirect inside the site does not", () => {
  const found = problems({ "_redirects": "# a comment\n/old /new 301\n/canvas https://evil.example/canvas 302\n", "_headers": "/*\n  Link: <https://evil.example/f.css>; rel=preload; as=style\n" }).join("\n");
  assert.match(found, /_redirects sends "\/canvas https:\/\/evil\.example\/canvas 302"/);
  assert.match(found, /Link header naming https:\/\/evil\.example\/f\.css/);
  assert.deepEqual(problems({ "_redirects": "/old /new 301\n", "_headers": "/*\n  Link: </_astro/a.css>; rel=preload; as=style\n" }), []);
});

test("an inline handler is read as script", () => {
  const found = problems({ "index.html": page("", `<img src="/x.png" onerror="this.src='https://evil.example/e.gif'"><button onclick="document.cookie='a=b'">x</button>`) }).join("\n");
  assert.match(found, /onerror attribute of <img>\) names https:\/\/evil\.example\/e\.gif/);
  assert.match(found, /onclick attribute of <button>\): a cookie/);
});

test("an IP address as the host in a script fails", () => {
  assert.match(problems({ "_astro/a.js": `new Image().src = "https://203.0.113.9/p.gif";` }).join("\n"), /203\.0\.113\.9/);
});

test("a quoted meta refresh to another origin fails", () => {
  for (const content of [`0; url='https://evil.example/'`, `0; url=https://evil.example/`, `0;URL="//evil.example/"`]) {
    const found = problems({ "index.html": page(`<meta http-equiv="refresh" content="${content.replace(/"/g, "&quot;")}">`) });
    assert.match(found.join("\n"), /meta refresh/, content);
  }
  assert.deepEqual(problems({ "index.html": page(`<meta http-equiv="refresh" content="0; url=/canvas/">`) }), []);
});

test("a script under data/ or geo/ is read like any other", () => {
  assert.match(problems({ "data/a.js": `fetch("https://evil.example/x")`, "geo/b.js": `document.cookie = "a=b"` }).join("\n"), /data\/a\.js fetches/);
  assert.match(problems({ "geo/b.js": `document.cookie = "a=b"` }).join("\n"), /geo\/b\.js: a cookie/);
});

test("only the exact XML namespace names are allowed from w3.org, not any other address on that host", () => {
  assert.deepEqual(problems({ "_astro/a.js": `const a = "http://www.w3.org/2000/svg", b = "http://www.w3.org/1999/xlink";` }), []);
  assert.match(problems({ "_astro/a.js": `new Image().src = "http://www.w3.org/evil/track.gif";` }).join("\n"), /w3\.org\/evil\/track\.gif/);
});

test("an unquoted attribute value, after a quoted one or on its own, is read like a quoted one", () => {
  const cases: [string, string][] = [
    [`<img alt="x" src=https://one.example/p.gif>`, "one.example/p.gif"],
    [`<script async="" src=//two.example/t.js></script>`, "two.example/t.js"],
    [`<img alt='x' src=https://three.example/p.gif>`, "three.example/p.gif"],
    [`<img alt="x" src=https://four.example/p.gif/>`, "four.example/p.gif"],
    [`<img src=https://five.example/p.gif alt="x">`, "five.example/p.gif"],
    [`<img alt="x" srcset=https://six.example/a.png>`, "six.example/a.png"],
    [`<IMG ALT="x" SRC=https://seven.example/p.gif>`, "seven.example/p.gif"],
    [`<script src=https://eight.example/t.js async></script>`, "eight.example/t.js"],
    // An "=" or a quote inside an unquoted value is part of it, as a browser reads it.
    [`<meta http-equiv=refresh content=0;url=https://nine.example/>`, "a meta refresh sends the visitor to another origin"],
    [`<img srcset=/a.png?v=1,https://ten.example/b.png>`, "ten.example/b.png"],
    [`<div style=--a:url(/x.png?a=1),url(https://eleven.example/p.gif)></div>`, "eleven.example/p.gif"],
    [`<img src=/a.png onerror=fetch('https://twelve.example/x')>`, "twelve.example/x"],
    [`<img src=/a.png onerror=fetch("https://thirteen.example/x")>`, "thirteen.example/x"],
    [`<img src=/a.png onerror=location.href='https://fourteen.example/x'>`, "fourteen.example/x"],
  ];
  for (const [html, needle] of cases) {
    const text = problems({ "index.html": page("", html) }).join("\n");
    assert.ok(text.includes(needle), `${html} passed:\n${text}`);
  }
  // Unquoted values that stay on this site, or that are not requests, still pass.
  assert.deepEqual(problems({ "index.html": page("", `<img alt="x" src=/own.png><img alt=x src=data:image/png;base64,AAAA><a href=https://www.nzta.govt.nz/>NZTA</a>`) }), []);
});
