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
import { decodeEntities } from "./plain-english.mjs";

// A tag's opening, read as a browser reads it: a quoted attribute value may hold ">" (Astro escapes only "&" and the quote in an attribute).
const TAG = /<([a-z][a-z0-9-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
// An element whose body is code or style, with its body.
const element = (name) => new RegExp(`<${name}\\b(?:"[^"]*"|'[^']*'|[^'">])*>([\\s\\S]*?)</${name}>`, "gi");

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

// The attributes of a tag, their values decoded as a browser decodes them (&quot; and &#39; are quotes, not text).
function attributes(tag) {
  const found = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) found[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  return found;
}

// The addresses named in a redirect rule or a header.
const urlsIn = (text) => [...text.matchAll(/(?:https?:)?\/\/[^\s"'<>;,)]+/g)].map((m) => m[0]);

export function trackingProblems(root, rules, { repoRoot, env = process.env, publicHeaders, publicRedirects } = {}) {
  const problems = [];
  const origin = repoRoot ? ownOrigin(repoRoot) : undefined;
  const files = readdirSync(root, { recursive: true, encoding: "utf8" }).map((f) => f.replace(/\\/g, "/"));
  const signatures = rules.tracker_signatures.map((s) => new RegExp(s, "i"));
  const apis = rules.forbidden_apis.map((a) => ({ re: new RegExp(a.pattern), say: a.say }));
  // An allowed address is named exactly ("exact") or by its beginning ("prefix"), each with its reason.
  const allowedUrl = (url) => rules.allowed_urls_in_code.some((a) => (a.exact ? url === a.exact : url.startsWith(a.prefix))) || (origin && (url === origin || url.startsWith(`${origin}/`)));

  for (const name of rules.forbidden_files) if (existsSync(join(root, name))) problems.push(`${name} is in the output: the site is static files, with no code that runs for a visitor's request`);
  for (const name of rules.forbidden_env) if (env[name]) problems.push(`${name} is set in the environment of this build: it would send every question to another address`);

  const scanCode = (file, source) => {
    for (const re of signatures) if (re.test(source)) problems.push(`${file} holds ${re.source}, the mark of a tracking or tag product`);
    for (const { re, say } of apis) if (re.test(source)) problems.push(`${file}: ${say}`);
    // An address with a scheme (any host, an IP address included), or a protocol-relative one that opens a string: "//" in a comment or a
    // regular expression is not an address, and a string that begins with "//host.tld" is.
    for (const m of source.matchAll(/https?:\/\/[A-Za-z0-9.-]+[^\s"'`)<>\\]*|(?<=["'`])\/\/(?:[A-Za-z0-9-]+\.)+[A-Za-z0-9-]+[^\s"'`)<>\\]*/g)) {
      const url = m[0];
      if (!allowedUrl(url)) problems.push(`${file} names ${url}, which the config does not allow in code`);
    }
    for (const m of source.matchAll(/\bfetch\s*\(\s*["'`]\s*((?:https?:)?\/\/[^"'`]+)/g)) if (isForeign(m[1], origin)) problems.push(`${file} fetches ${m[1]}, an address on another origin`);
    for (const m of source.matchAll(/\bimport\s*\(\s*["'`]\s*((?:https?:)?\/\/[^"'`]+)/g)) if (isForeign(m[1], origin)) problems.push(`${file} imports ${m[1]}, an address on another origin`);
  };

  for (const file of files) {
    const path = join(root, file);
    if (file.endsWith(".html")) {
      let html = readFileSync(path, "utf8");
      for (const m of html.matchAll(element("script"))) scanCode(`${file} (inline script)`, m[1]);
      for (const m of html.matchAll(element("style"))) scanCss(`${file} (inline style)`, m[1], problems, origin);
      // Their bodies are read above; what is left is each element's opening tag, whose attributes are read with the others.
      html = html.replace(/(<(script|style)\b(?:"[^"]*"|'[^']*'|[^'">])*>)[\s\S]*?<\/\2>/gi, "$1");
      for (const re of signatures) if (re.test(html)) problems.push(`${file} holds ${re.source}, the mark of a tracking or tag product`);
      for (const m of html.matchAll(TAG)) {
        const tag = m[1].toLowerCase();
        const attrs = attributes(m[2]);
        // An inline handler is script: it may send the visitor or a request anywhere.
        for (const [name, value] of Object.entries(attrs)) if (name.startsWith("on")) scanCode(`${file} (${name} attribute of <${tag}>)`, value);
        if ((tag === "a" || tag === "area") && attrs.ping) for (const address of attrs.ping.split(/\s+/)) if (address && isForeign(address, origin)) problems.push(`${file}: <${tag} ping="${address}"> sends a ping to another origin`);
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
          // The address of a refresh may be quoted: content="0; url='https://...'".
          const target = /url\s*=\s*["']?([^"'\s]+)/i.exec(attrs.content ?? "")?.[1];
          if (/^refresh$/i.test(attrs["http-equiv"] ?? "") && target && isForeign(target, origin)) problems.push(`${file}: a meta refresh sends the visitor to another origin`);
          const name = (attrs.property ?? attrs.name ?? "").toLowerCase();
          if (/^(og:(image|url|video|audio)|twitter:(image|url|player))(:|$)/.test(name) && isForeign(attrs.content ?? "", origin)) problems.push(`${file}: <meta ${name}> names ${attrs.content}, which is not this site's own address`);
        }
      }
    } else if (file.endsWith(".js") || file.endsWith(".mjs")) {
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
    // A Link header makes the browser preload or connect to what it names.
    if (name === "link") for (const url of urlsIn(line)) if (isForeign(url, origin)) problems.push(`_headers sends a Link header naming ${url}, an address on another origin`);
  }
  // A redirect rule is "from to [status]": the site's own paths must not be sent to another origin.
  const redirects = publicRedirects ?? (existsSync(join(root, "_redirects")) ? readFileSync(join(root, "_redirects"), "utf8") : "");
  for (const line of redirects.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    for (const url of urlsIn(line)) if (isForeign(url, origin)) problems.push(`_redirects sends "${line.trim()}" to ${url}, an address on another origin`);
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
  const sourceRedirects = existsSync(join(repoRoot, "public/_redirects")) ? readFileSync(join(repoRoot, "public/_redirects"), "utf8") : "";
  const problems = trackingProblems(root, rules, {
    repoRoot,
    publicHeaders: `${sourceHeaders}\n${existsSync(join(root, "_headers")) ? readFileSync(join(root, "_headers"), "utf8") : ""}`,
    publicRedirects: `${sourceRedirects}\n${existsSync(join(root, "_redirects")) ? readFileSync(join(root, "_redirects"), "utf8") : ""}`,
  });
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
