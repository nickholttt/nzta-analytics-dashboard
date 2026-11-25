// The sitemap of the public build (scripts/sitemap.mjs): written only once the site's address is set, listing exactly the pages a search engine may
// index at absolute addresses, with a pointer to it in robots.txt that never replaces what the file already says; and, with no address, nothing written
// and the build not failing. Run with Node's own test runner:
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error a plain module with no types
import { indexablePages, pagePath, robotsWith, sitemapProblems, sitemapXml, writeSitemap } from "../../scripts/sitemap.mjs";

const realSite = JSON.parse(readFileSync(join(fileURLToPath(new URL("../..", import.meta.url)), "config/site.json"), "utf8"));

const PAGE = (extra = "") => `<!DOCTYPE html><html><head><title>t</title>${extra}</head><body><p>x</p></body></html>`;
const NOINDEX = `<meta name="robots" content="noindex">`;

// An output with the pages a build has, and a repository folder holding a config/site.json with the address given.
function fixture(address: string, extraConfig: Record<string, unknown> = { sitemap: { exclude: ["/build/"] } }) {
  const dir = mkdtempSync(join(tmpdir(), "sitemap-"));
  const root = join(dir, "dist");
  const repo = join(dir, "repo");
  const files: Record<string, string> = {
    "index.html": PAGE(),
    "about/index.html": PAGE(),
    "canvas/index.html": PAGE(),
    "build/index.html": PAGE(),
    "status/index.html": PAGE(NOINDEX),
    "brand/alpha/index.html": PAGE(),
    "model/alpha-a1/index.html": PAGE(),
    "brands/index.html": PAGE(),
    "404.html": PAGE(),
    "data/manifest.json": "{}",
    "data/x/index.html": PAGE(),
    "_astro/a.js": "",
  };
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(root, name, ".."), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  mkdirSync(join(repo, "config"), { recursive: true });
  writeFileSync(join(repo, "config/site.json"), JSON.stringify({ ...realSite, about: { ...realSite.about, site_address: address }, ...extraConfig }));
  return { dir, root, repo };
}
const clean = (dir: string) => rmSync(dir, { recursive: true, force: true });

test("a page's address is its folder, and a file that is no page has none", () => {
  assert.equal(pagePath("index.html"), "/");
  assert.equal(pagePath("about/index.html"), "/about/");
  assert.equal(pagePath("brand\\alpha\\index.html"), "/brand/alpha/");
  assert.equal(pagePath("404.html"), undefined);
  assert.equal(pagePath("data/manifest.json"), undefined);
});

test("what is listed: every page a search engine may index, and not a page kept out of them, the page-not-found page, a page that only sends a visitor on, or a data folder", () => {
  const f = fixture("https://example.nz");
  try {
    assert.deepEqual(indexablePages(f.root, ["/build/"]), ["/", "/about/", "/brand/alpha/", "/brands/", "/canvas/", "/model/alpha-a1/"]);
    assert.deepEqual(indexablePages(f.root), ["/", "/about/", "/brand/alpha/", "/brands/", "/build/", "/canvas/", "/model/alpha-a1/"], "with nothing excluded, a build page is listed; status never is");
  } finally {
    clean(f.dir);
  }
});

test("with the address set, sitemap.xml lists those pages at absolute addresses, and robots.txt points to it", () => {
  const f = fixture("https://example.nz/");
  try {
    const messages: string[] = [];
    const result = writeSitemap(f.root, f.repo, (m: string) => messages.push(m));
    assert.deepEqual(result, { written: true, pages: 6, origin: "https://example.nz" });
    const xml = readFileSync(join(f.root, "sitemap.xml"), "utf8");
    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.deepEqual(locs, ["https://example.nz/", "https://example.nz/about/", "https://example.nz/brand/alpha/", "https://example.nz/brands/", "https://example.nz/canvas/", "https://example.nz/model/alpha-a1/"]);
    assert.ok(!xml.includes("status") && !xml.includes("404") && !xml.includes("build") && !xml.includes("/data/"));
    assert.equal(readFileSync(join(f.root, "robots.txt"), "utf8"), "Sitemap: https://example.nz/sitemap.xml\n");
    assert.match(messages[0], /6 pages/);
    assert.deepEqual(sitemapProblems(f.root, f.repo), []);
  } finally {
    clean(f.dir);
  }
});

test("a robots.txt the site already has keeps every rule it states, gets the line once, and is not loosened", () => {
  assert.equal(robotsWith(undefined, "https://example.nz"), "Sitemap: https://example.nz/sitemap.xml\n");
  const rules = "User-agent: *\nDisallow: /status/\nDisallow: /sense-check/\n";
  const once = robotsWith(rules, "https://example.nz");
  assert.equal(once, `${rules}\nSitemap: https://example.nz/sitemap.xml\n`);
  assert.equal(robotsWith(once, "https://example.nz"), once, "again, the same");
  const f = fixture("https://example.nz");
  try {
    writeFileSync(join(f.root, "robots.txt"), rules);
    writeSitemap(f.root, f.repo);
    assert.ok(readFileSync(join(f.root, "robots.txt"), "utf8").startsWith(rules));
    assert.equal(readFileSync(join(f.root, "robots.txt"), "utf8").match(/Sitemap:/g)?.length, 1);
  } finally {
    clean(f.dir);
  }
});

test("with no address, nothing is written, the build does not fail, and the log says how to turn it on", () => {
  for (const address of ["", "[TO DECIDE: the site's web address]", "localhost:4321", "not an address"]) {
    const f = fixture(address);
    try {
      const messages: string[] = [];
      const result = writeSitemap(f.root, f.repo, (m: string) => messages.push(m));
      assert.equal(result.written, false, address);
      assert.equal(existsSync(join(f.root, "sitemap.xml")), false, `${address}: no sitemap with a placeholder or a local address`);
      assert.equal(existsSync(join(f.root, "robots.txt")), false);
      assert.match(messages[0], /address is not set \(config\/site\.json, about\.site_address\)/);
      assert.deepEqual(sitemapProblems(f.root, f.repo), []);
    } finally {
      clean(f.dir);
    }
  }
});

test("the check fails a sitemap that is missing a page, lists one it should not, or has no pointer in robots.txt, and a sitemap with no address to hold", () => {
  const f = fixture("https://example.nz");
  try {
    writeSitemap(f.root, f.repo);
    const xml = readFileSync(join(f.root, "sitemap.xml"), "utf8");
    writeFileSync(join(f.root, "sitemap.xml"), xml.replace("  <url><loc>https://example.nz/about/</loc></url>\n", "").replace("</urlset>", "  <url><loc>https://example.nz/status/</loc></url>\n</urlset>"));
    const found = (sitemapProblems(f.root, f.repo) as string[]).join("\n");
    assert.match(found, /does not list https:\/\/example\.nz\/about\//);
    assert.match(found, /lists https:\/\/example\.nz\/status\/, which is not a page a search engine may index/);
    writeFileSync(join(f.root, "sitemap.xml"), xml);
    writeFileSync(join(f.root, "robots.txt"), "User-agent: *\n");
    assert.match((sitemapProblems(f.root, f.repo) as string[]).join("\n"), /robots\.txt has no Sitemap line/);
    rmSync(join(f.root, "sitemap.xml"));
    assert.match((sitemapProblems(f.root, f.repo) as string[]).join("\n"), /sitemap\.xml is not in the output, and the site's address is set/);
  } finally {
    clean(f.dir);
  }
  const unset = fixture("");
  try {
    writeFileSync(join(unset.root, "sitemap.xml"), sitemapXml("https://example.nz", ["/"]));
    assert.match((sitemapProblems(unset.root, unset.repo) as string[]).join("\n"), /the site's address is not set/);
  } finally {
    clean(unset.dir);
  }
});

test("an address that needs escaping is escaped", () => {
  assert.match(sitemapXml("https://example.nz", ["/a&b/"]), /<loc>https:\/\/example\.nz\/a&amp;b\/<\/loc>/);
});

test("every page the site's config leaves out of the sitemap is a page the site has", () => {
  assert.ok(realSite.sitemap.exclude.length > 0);
  for (const path of realSite.sitemap.exclude as string[]) assert.ok(existsSync(new URL(`../../src/pages${path.replace(/\/$/, "")}.astro`, import.meta.url)), `${path} is not a page of the site`);
});
