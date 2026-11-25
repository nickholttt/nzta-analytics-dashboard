// A page a visitor can find has a specific title, a description that says what the page is and no more, and social card tags; the card image
// is named only once the site's address is set (src/layouts/pageMeta.ts, config/site.json meta, scripts/check-page-metadata.mjs).
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import "./support/register.mjs";
// @ts-expect-error a plain module with no types
import { metadataProblems, pngSize } from "../../scripts/check-page-metadata.mjs";

const { pageMeta, siteOrigin } = await import("../../src/layouts/pageMeta.ts");
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const site = JSON.parse(readFileSync(join(repoRoot, "config/site.json"), "utf8"));
const rules = JSON.parse(readFileSync(join(repoRoot, "config/narrative/rules.json"), "utf8"));
const ids = Object.keys(site.meta.pages) as Array<keyof typeof site.meta.pages>;
const tag = (tags: Array<{ key: string; content: string }>, key: string) => tags.find((t) => t.key === key)?.content;

test("every page's description says what the page is: no figure, no year, no cause or judgement word", () => {
  for (const id of ids) {
    for (const [what, text] of [["title", site.meta.pages[id].title], ["description", site.meta.pages[id].description]] as const) {
      assert.doesNotMatch(text, /\d/, `${id} ${what} holds a digit, so a figure or a year`);
      for (const word of rules.banned_words) assert.doesNotMatch(text.toLowerCase(), new RegExp(`\\b${word}\\b`), `${id} ${what} holds "${word}"`);
    }
    assert.ok(site.meta.pages[id].description.endsWith("."), `${id}'s description is one sentence`);
  }
});

test("with no address set, no card image, page address or canonical link is written, and the card is the plain kind", () => {
  for (const address of ["[TO DECIDE: the site's web address]", "", "localhost"]) {
    const meta = pageMeta("canvas", { pathname: "/canvas/", address });
    assert.equal(meta.canonical, undefined);
    for (const key of ["og:image", "og:url", "twitter:image"]) assert.equal(tag(meta.tags, key), undefined, `${key} with address "${address}"`);
    assert.equal(tag(meta.tags, "twitter:card"), "summary");
    assert.equal(tag(meta.tags, "description"), site.meta.pages.canvas.description);
    assert.ok(tag(meta.tags, "og:title"), "the title and description are written all the same");
  }
});

test("once the address is set, the card image is an absolute address and nothing else is left to do", () => {
  for (const address of ["https://example.nz", "example.nz", "https://example.nz/"]) {
    const meta = pageMeta("method", { pathname: "/method/", address });
    assert.equal(tag(meta.tags, "og:image"), "https://example.nz/cards/method.png");
    assert.equal(tag(meta.tags, "twitter:image"), "https://example.nz/cards/method.png");
    assert.equal(tag(meta.tags, "og:image:width"), "1200");
    assert.equal(tag(meta.tags, "og:image:height"), "630");
    assert.equal(tag(meta.tags, "og:url"), "https://example.nz/method/");
    assert.equal(meta.canonical, "https://example.nz/method/");
    assert.equal(tag(meta.tags, "twitter:card"), "summary_large_image");
  }
  assert.equal(siteOrigin("[TO DECIDE: the site's web address]"), undefined);
});

test("a page kept out of search engines carries a title and a description but no card", () => {
  const meta = pageMeta("not_found", { pathname: "/404.html", noindex: true, address: "https://example.nz" });
  assert.deepEqual(meta.tags.map((t) => t.key), ["description"]);
  assert.equal(meta.canonical, undefined);
});

test("a page whose charts are drawn by a script says so, for a visitor with scripts off; a page of plain text does not", () => {
  for (const id of ["canvas", "build"] as const) assert.equal(pageMeta(id, { pathname: "/" }).needsScript, true, id);
  for (const id of ["explore", "method", "caveats", "about", "feedback", "differences", "not_found"] as const) assert.equal(pageMeta(id, { pathname: "/" }).needsScript, false, id);
});

test("the notice for scripts being off is true: a page that ships a script has it, a page that ships none does not (the front page ships none)", () => {
  const notice = `<noscript><div class="callout warning"><span class="callout-label">Scripts are off</span>x</div></noscript>`;
  const withScript = (extra: string) => full("canvas", { extra: `<script type="module" src="/_astro/x.js"></script>${extra}` });
  assert.deepEqual(check({ "canvas/index.html": withScript(notice), "_astro/x.js": "export {};" }), []);
  assert.match(check({ "canvas/index.html": withScript(""), "_astro/x.js": "export {};" }).join("\n"), /canvas\/index\.html: ships a script but has no notice/);
  assert.match(check({ "about/index.html": full("about", { extra: notice }) }).join("\n"), /about\/index\.html: says scripts are off and needed, but ships no script/);
});

test("the site's name is written only once it is decided", () => {
  assert.equal(tag(pageMeta("about", { pathname: "/about/", siteName: "[TO DECIDE: the site's name]" }).tags, "og:site_name"), undefined);
  assert.equal(tag(pageMeta("about", { pathname: "/about/", siteName: "A name" }).tags, "og:site_name"), "A name");
});

test("a card image is committed for every page that is searched for, at the size config says", () => {
  for (const id of ids.filter((i) => i !== "not_found")) {
    const size = pngSize(join(repoRoot, "public", site.meta.card_folder, `${id}.png`));
    assert.ok(size, `public${site.meta.card_folder}/${id}.png is missing or not a PNG: run scripts/make-social-cards.mjs`);
    assert.deepEqual(size, { width: site.meta.card_width, height: site.meta.card_height });
  }
});

// The check over a built output, run on a small one with the real config copied beside it.
function check(pages: Record<string, string>, { cards = true, address = "[TO DECIDE: the site's web address]" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "page-meta-"));
  try {
    mkdirSync(join(dir, "repo/config"), { recursive: true });
    writeFileSync(join(dir, "repo/config/site.json"), JSON.stringify({ ...site, about: { ...site.about, site_address: address } }));
    mkdirSync(join(dir, "dist/_astro"), { recursive: true });
    if (cards) {
      mkdirSync(join(dir, "dist/cards"), { recursive: true });
      for (const id of ids) if (id !== "not_found") copyFileSync(join(repoRoot, "public/cards", `${id}.png`), join(dir, `dist/cards/${id}.png`));
    }
    for (const [name, html] of Object.entries(pages)) {
      mkdirSync(join(dir, "dist", name, ".."), { recursive: true });
      writeFileSync(join(dir, "dist", name), html);
    }
    return metadataProblems(join(dir, "dist"), join(dir, "repo")) as string[];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const full = (id: keyof typeof site.meta.pages, { title = `${site.meta.pages[id].title} · ${site.meta.title_suffix}`, description = site.meta.pages[id].description, extra = "" } = {}) =>
  `<!DOCTYPE html><html><head><title>${title}</title>${description ? `<meta name="description" content="${description}">` : ""}` +
  `<meta property="og:type" content="website"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}">` +
  `<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}">${extra}</head><body></body></html>`;

test("the check passes on pages with their titles, descriptions and cards", () => {
  assert.deepEqual(check({ "about/index.html": full("about"), "method/index.html": full("method") }), []);
});

test("the check fails, naming the page, on a missing description, a title that is not the page's, a repeated title, or a missing card", () => {
  const noDescription = check({ "about/index.html": full("about", { description: "" }) });
  assert.match(noDescription.join("\n"), /about\/index\.html: has no description/);
  const wrongTitle = check({ "about/index.html": full("about", { title: "Page · NZ vehicle registrations" }) });
  assert.match(wrongTitle.join("\n"), /not one of config\/site\.json meta\.pages/);
  const repeated = check({ "about/index.html": full("about"), "again/index.html": full("about") });
  assert.match(repeated.join("\n"), /again\/index\.html: the title/);
  const noCard = check({ "about/index.html": full("about") }, { cards: false });
  assert.match(noCard.join("\n"), /about\/index\.html: its card image \/cards\/about\.png is not in the output/);
});

test("the check fails on a card image named before the address is set, and on one missing once it is", () => {
  const early = check({ "about/index.html": full("about", { extra: `<meta property="og:image" content="https://example.nz/cards/about.png">` }) });
  assert.match(early.join("\n"), /has og:image, but the site's address is not set/);
  const late = check({ "about/index.html": full("about") }, { address: "https://example.nz" });
  assert.match(late.join("\n"), /has no og:image, and the site's address is set/);
});

test("a generated page (a brand's or model's) has a title of its own, found by its folder, and shares its kind's card; two with one title fail", () => {
  const answers = JSON.parse(readFileSync(join(repoRoot, "config/answer_pages.json"), "utf8"));
  const own = (title: string, description: string) => full("about", { title: `${title} · ${site.meta.title_suffix}`, description });
  const a = own("How many ALPHA vehicles were first registered in New Zealand in the last 12 months?", "Registrations of ALPHA in New Zealand: a count in the last year, and the months.");
  const b = own("How many BETA vehicles were first registered in New Zealand in the last 12 months?", "Registrations of BETA in New Zealand: a count in the last year, and the months.");
  const files = { [`${answers.brand.path}/alpha/index.html`]: a, [`${answers.brand.path}/beta/index.html`]: b };
  assert.deepEqual(checkWithAnswers(files, answers), []);
  const twin = checkWithAnswers({ ...files, [`${answers.model.path}/x/index.html`]: a }, answers).join("\n");
  assert.match(twin, /the title .* is the one .* has/);
  // The same title outside the generated folders is not one of meta.pages.
  assert.match(check({ "elsewhere/index.html": a }).join("\n"), /not one of config\/site\.json meta\.pages/);
});

function checkWithAnswers(pages: Record<string, string>, answers: unknown) {
  const dir = mkdtempSync(join(tmpdir(), "page-meta-"));
  try {
    mkdirSync(join(dir, "repo/config"), { recursive: true });
    writeFileSync(join(dir, "repo/config/site.json"), JSON.stringify(site));
    writeFileSync(join(dir, "repo/config/answer_pages.json"), JSON.stringify(answers));
    mkdirSync(join(dir, "dist/_astro"), { recursive: true });
    mkdirSync(join(dir, "dist/cards"), { recursive: true });
    for (const id of ids) if (id !== "not_found") copyFileSync(join(repoRoot, "public/cards", `${id}.png`), join(dir, `dist/cards/${id}.png`));
    for (const [name, html] of Object.entries(pages)) {
      mkdirSync(join(dir, "dist", name, ".."), { recursive: true });
      writeFileSync(join(dir, "dist", name), html);
    }
    return metadataProblems(join(dir, "dist"), join(dir, "repo")) as string[];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
