// The sitemap of the public build: sitemap.xml lists every page a search engine may index, and robots.txt points to it. Written when the site is built
// (astro.config.mjs), from the pages the build wrote, so a page the site makes later (a brand's, a model's: config/answer_pages.json) is in it with no
// further step. Built-ins only; no dependency.
//
// A sitemap holds absolute addresses, and the site's address is the owner's to choose (config/site.json, about.site_address; the layout reads it the same way
// for canonical links and social cards, src/layouts/pageMeta.ts). While it is not set, no sitemap is written, and no robots.txt line: a placeholder or a local
// address in a file a search engine reads would be worse than no file. Setting the address is the only step that turns it on.
//
// What is listed: every built page that is not kept out of search engines (noindex), is not the page-not-found page, and is not named under
// "sitemap.exclude" in config/site.json (a page that only sends a visitor on). Each address is the page's own, as its canonical link writes it.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ownOrigin } from "./check-no-tracking.mjs";

const SITEMAP = "sitemap.xml";
const ROBOTS = "robots.txt";

const escapeXml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// The address of a built page file ("about/index.html" is "/about/"), or nothing for a file that is no page a visitor has an address for.
export function pagePath(file) {
  const name = file.replace(/\\/g, "/");
  if (!name.endsWith("index.html")) return undefined;
  if (name === "index.html") return "/";
  return name.endsWith("/index.html") ? `/${name.slice(0, -"index.html".length)}` : undefined;
}

// Every page of the output a search engine may index, by address, in order.
export function indexablePages(root, exclude = []) {
  const out = [];
  for (const file of readdirSync(root, { recursive: true, encoding: "utf8" })) {
    const path = pagePath(file);
    if (path === undefined || /^\/(?:data|geo|_astro)\//.test(path) || exclude.includes(path)) continue;
    const html = readFileSync(join(root, file), "utf8");
    if (/<meta\b[^>]*\bname="robots"[^>]*\bcontent="[^"]*noindex/i.test(html)) continue;
    out.push(path);
  }
  return out.sort();
}

export function sitemapXml(origin, paths) {
  const urls = paths.map((p) => `  <url><loc>${escapeXml(new URL(p, origin).href)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// A robots.txt that points to the sitemap: the line is added to a file the site already has, never replacing what it says; with none, the file is the one
// line, which allows everything, as having no file does.
export function robotsWith(existing, origin) {
  const line = `Sitemap: ${new URL(`/${SITEMAP}`, origin).href}`;
  if (existing === undefined || existing.trim() === "") return `${line}\n`;
  return existing.split(/\r?\n/).some((l) => l.trim().toLowerCase() === line.toLowerCase()) ? existing : `${existing.replace(/\s*$/, "\n")}\n${line}\n`;
}

const siteConfig = (repoRoot) => JSON.parse(readFileSync(join(repoRoot, "config/site.json"), "utf8"));

// Writes the sitemap and the robots.txt line into the output, where the site's address is set. Returns what it did, and why not where it did nothing.
export function writeSitemap(root, repoRoot, say = () => {}) {
  const origin = ownOrigin(repoRoot);
  if (!origin) {
    const reason = "no sitemap.xml written: the site's address is not set (config/site.json, about.site_address). Set it and build again, and the sitemap and the robots.txt line are written with nothing else to do.";
    say(reason);
    return { written: false, reason };
  }
  const paths = indexablePages(root, siteConfig(repoRoot).sitemap?.exclude ?? []);
  writeFileSync(join(root, SITEMAP), sitemapXml(origin, paths));
  const robots = join(root, ROBOTS);
  writeFileSync(robots, robotsWith(existsSync(robots) ? readFileSync(robots, "utf8") : undefined, origin));
  say(`sitemap.xml written with ${paths.length} pages at ${origin}, and a Sitemap line in robots.txt.`);
  return { written: true, pages: paths.length, origin };
}

// What is wrong with the output's sitemap, for the public build's check: where the address is set, the sitemap must list exactly the pages that may be
// indexed, each at the site's address, and robots.txt must point to it; where it is not, neither may exist.
export function sitemapProblems(root, repoRoot) {
  const problems = [];
  const origin = ownOrigin(repoRoot);
  const sitemap = join(root, SITEMAP);
  const robots = join(root, ROBOTS);
  const pointer = /^\s*sitemap\s*:/im;
  if (!origin) {
    if (existsSync(sitemap)) problems.push(`${SITEMAP} is in the output, but the site's address is not set: it cannot hold absolute addresses`);
    if (existsSync(robots) && pointer.test(readFileSync(robots, "utf8"))) problems.push(`${ROBOTS} points to a sitemap, but the site's address is not set`);
    return problems;
  }
  if (!existsSync(sitemap)) return [`${SITEMAP} is not in the output, and the site's address is set`];
  const listed = [...readFileSync(sitemap, "utf8").matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  const expected = indexablePages(root, siteConfig(repoRoot).sitemap?.exclude ?? []).map((p) => new URL(p, origin).href);
  for (const url of expected) if (!listed.includes(url)) problems.push(`${SITEMAP} does not list ${url}`);
  for (const url of listed) if (!expected.includes(url)) problems.push(`${SITEMAP} lists ${url}, which is not a page a search engine may index in this output`);
  if (new Set(listed).size !== listed.length) problems.push(`${SITEMAP} lists an address more than once`);
  if (!existsSync(robots) || !pointer.test(readFileSync(robots, "utf8"))) problems.push(`${ROBOTS} has no Sitemap line, and the site's address is set`);
  return problems;
}
