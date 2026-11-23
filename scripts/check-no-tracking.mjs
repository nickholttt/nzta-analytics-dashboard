// No tracking, no cookies, no request to another origin (config/public_privacy.json), checked on the built public output.
//   node scripts/check-no-tracking.mjs [dist] [--repo <folder holding config/ and public/>]   (--repo is for the tests)
// It reads every page, script and stylesheet in the output and fails, naming the file, on:
//   - a script, stylesheet, font, image, frame, preload, prefetch, preconnect, form action or other fetched resource that names another origin;
//   - a cookie (document.cookie, the cookie store, a Set-Cookie header in _headers), session storage, IndexedDB, a beacon, XMLHttpRequest,
//     a WebSocket or an event stream (localStorage is allowed, and the config says why);
//   - the signature of an analytics or tag product in a page, a script or a stylesheet;
//   - an address in a script or stylesheet that the config does not allow, or a fetch of a literal address on another origin;
//   - server code in the output (_worker.js, functions/), or PUBLIC_QUERY_SERVICE set in the environment of the build.
// A link a visitor follows (<a>, <area>) is not a request. What this cannot see is a request whose address is built while the page runs:
// scripts/check-public-browser.mjs loads each page in a headless browser and fails on any request to another origin, and is run by hand.
// Built-ins only.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The page's own origin, from config/site.json, once the user has set it; undefined while it is still a gap.
export function ownOrigin(repoRoot) {
  const address = JSON.parse(readFileSync(join(repoRoot, "config/site.json"), "utf8")).about?.site_address ?? "";
  try {
    const url = new URL(/^https?:\/\//.test(address) ? address : `https://${address}`);
    return address && !address.includes("TO DECIDE") && url.hostname.includes(".") ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

const isForeign = (value, origin) => {
  const v = value.trim();
  if (!/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(v)) return false; // relative, or data:, blob:, mailto:, #fragment
  return !(origin && (v === origin || v.startsWith(`${origin}/`)));
};

// What a tag fetches, by tag: the attributes that make the browser request something, and for <link> only the rels that do.
const FETCHING = {
  script: ["src"], img: ["src", "srcset"], iframe: ["src"], frame: ["src"], source: ["src", "srcset"], video: ["src", "poster"], audio: ["src"],
  embed: ["src"], object: ["data"], track: ["src"], input: ["src", "formaction"], form: ["action"], base: ["href"], link: ["href", "imagesrcset"],
  use: ["href", "xlink:href"], image: ["href", "xlink:href"], button: ["formaction"],
};
const LINK_NOT_A_REQUEST = new Set(["canonical", "alternate", "author", "license", "help", "next", "prev", "search", "bookmark"]);

function attributes(tag) {
  const found = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) found[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
  return found;
}

export function trackingProblems(root, rules, { repoRoot, env = process.env, publicHeaders } = {}) {
  const problems = [];
  const origin = repoRoot ? ownOrigin(repoRoot) : undefined;
  const files = readdirSync(root, { recursive: true, encoding: "utf8" }).map((f) => f.replace(/\\/g, "/"));
  const signatures = rules.tracker_signatures.map((s) => new RegExp(s, "i"));
  const apis = rules.forbidden_apis.map((a) => ({ re: new RegExp(a.pattern), say: a.say }));
  const allowedUrl = (url) => rules.allowed_urls_in_code.some((a) => url.startsWith(a.prefix)) || (origin && (url === origin || url.startsWith(`${origin}/`)));

  for (const name of rules.forbidden_files) if (existsSync(join(root, name))) problems.push(`${name} is in the output: the site is static files, with no code that runs for a visitor's request`);
  for (const name of rules.forbidden_env) if (env[name]) problems.push(`${name} is set in the environment of this build: it would send every question to another address`);

  const scanCode = (file, source) => {
    for (const re of signatures) if (re.test(source)) problems.push(`${file} holds ${re.source}, the mark of a tracking or tag product`);
    for (const { re, say } of apis) if (re.test(source)) problems.push(`${file}: ${say}`);
    for (const m of source.matchAll(/(?:https?:)?\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}[^\s"'`)<>\\]*/g)) {
      const url = m[0];
      if (!/^https?:/.test(url)) continue; // "//" in a comment or a regular expression is not an address; an address starts with a scheme
      if (!allowedUrl(url)) problems.push(`${file} names ${url}, which the config does not allow in code`);
    }
    for (const m of source.matchAll(/\bfetch\s*\(\s*["'`]\s*((?:https?:)?\/\/[^"'`]+)/g)) if (isForeign(m[1], origin)) problems.push(`${file} fetches ${m[1]}, an address on another origin`);
    for (const m of source.matchAll(/\bimport\s*\(\s*["'`]\s*((?:https?:)?\/\/[^"'`]+)/g)) if (isForeign(m[1], origin)) problems.push(`${file} imports ${m[1]}, an address on another origin`);
  };

  for (const file of files) {
    const path = join(root, file);
    if (file.endsWith(".html")) {
      let html = readFileSync(path, "utf8");
      for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) scanCode(`${file} (inline script)`, m[1]);
      for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) scanCss(`${file} (inline style)`, m[1], problems, origin);
      html = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (all) => all.slice(0, all.indexOf(">") + 1));
      for (const re of signatures) if (re.test(html)) problems.push(`${file} holds ${re.source}, the mark of a tracking or tag product`);
      for (const m of html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
        const tag = m[1].toLowerCase();
        const attrs = attributes(m[0]);
        if (tag === "link" && LINK_NOT_A_REQUEST.has((attrs.rel ?? "").toLowerCase())) continue;
        for (const name of FETCHING[tag] ?? []) {
          for (const value of (attrs[name] ?? "").split(",")) {
            const address = value.trim().split(/\s+/)[0] ?? "";
            if (address && isForeign(address, origin)) problems.push(`${file}: <${tag} ${name}="${address}"> asks another origin for a file`);
          }
        }
        if ("style" in attrs) scanCss(`${file} (style attribute)`, attrs.style, problems, origin);
        if (tag === "link" && /^(preconnect|dns-prefetch)$/i.test(attrs.rel ?? "") && attrs.href) problems.push(`${file}: <link rel="${attrs.rel}"> opens a connection to ${attrs.href} before any request`);
        if (tag === "meta") {
          if (/^refresh$/i.test(attrs["http-equiv"] ?? "") && /url\s*=\s*(?:https?:)?\/\//i.test(attrs.content ?? "") && isForeign((attrs.content ?? "").replace(/^.*url\s*=\s*/i, ""), origin)) problems.push(`${file}: a meta refresh sends the visitor to another origin`);
          const name = (attrs.property ?? attrs.name ?? "").toLowerCase();
          if (/^(og:(image|url|video|audio)|twitter:(image|url|player))(:|$)/.test(name) && isForeign(attrs.content ?? "", origin)) problems.push(`${file}: <meta ${name}> names ${attrs.content}, which is not this site's own address`);
        }
      }
    } else if (file.endsWith(".js") || file.endsWith(".mjs")) {
      if (file.startsWith("data/") || file.startsWith("geo/")) continue;
      scanCode(file, readFileSync(path, "utf8"));
    } else if (file.endsWith(".css")) {
      const css = readFileSync(path, "utf8");
      scanCss(file, css, problems, origin);
      for (const re of signatures) if (re.test(css)) problems.push(`${file} holds ${re.source}, the mark of a tracking or tag product`);
    }
  }

  const headers = publicHeaders ?? (existsSync(join(root, "_headers")) ? readFileSync(join(root, "_headers"), "utf8") : "");
  for (const line of headers.split(/\r?\n/)) {
    const name = line.trim().split(":")[0].toLowerCase();
    if (rules.forbidden_headers.includes(name)) problems.push(`_headers sets ${name}: the site sets no cookie`);
  }
  return [...new Set(problems)];
}

function scanCss(file, css, problems, origin) {
  for (const m of css.matchAll(/url\(\s*["']?([^"')\s]+)/gi)) if (isForeign(m[1], origin)) problems.push(`${file}: url(${m[1]}) asks another origin for a file`);
  for (const m of css.matchAll(/@import\s+["']([^"']+)/gi)) if (isForeign(m[1], origin)) problems.push(`${file}: @import ${m[1]} asks another origin for a file`);
}

// Where localStorage is used in the output, so the report says what it allowed.
export function storageUses(root, rules) {
  const uses = [];
  for (const file of readdirSync(root, { recursive: true, encoding: "utf8" }).map((f) => f.replace(/\\/g, "/"))) {
    if (!/\.(js|html)$/.test(file) || file.startsWith("data/")) continue;
    if (rules.storage.allowed.some((api) => new RegExp(`\\b${escape(api)}\\b`).test(readFileSync(join(root, file), "utf8")))) uses.push(file);
  }
  return uses;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const repoFlag = args.indexOf("--repo");
  const repoRoot = repoFlag >= 0 ? resolve(args[repoFlag + 1]) : fileURLToPath(new URL("..", import.meta.url));
  const root = resolve(args.filter((a, i) => !a.startsWith("--") && (repoFlag < 0 || i !== repoFlag + 1))[0] ?? "dist");
  if (!existsSync(join(root, "_astro"))) {
    console.error(`${root} has no _astro folder: build the site first (INTERNAL_PAGES=false npx astro build).`);
    process.exit(2);
  }
  const rules = JSON.parse(readFileSync(join(repoRoot, "config/public_privacy.json"), "utf8"));
  // The headers file the host applies is public/_headers (copied to the output); both are read.
  const sourceHeaders = existsSync(join(repoRoot, "public/_headers")) ? readFileSync(join(repoRoot, "public/_headers"), "utf8") : "";
  const problems = trackingProblems(root, rules, { repoRoot, publicHeaders: `${sourceHeaders}\n${existsSync(join(root, "_headers")) ? readFileSync(join(root, "_headers"), "utf8") : ""}` });
  if (problems.length) {
    console.error(problems.map((p) => `- ${p}`).join("\n"));
    console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}: the public site must load nothing from another origin and set nothing on a visitor's device but what the config allows.`);
    process.exit(1);
  }
  const uses = storageUses(root, rules);
  const origin = ownOrigin(repoRoot);
  console.log(
    `${root}: no third-party request, tracker, cookie or server code. Allowed: ${rules.storage.allowed.join(", ")} (in ${uses.length} file${uses.length === 1 ? "" : "s"}): ${rules.storage.reason} ` +
      `Own address: ${origin ?? "not set yet, so no page may name an address of its own"}.`,
  );
}
