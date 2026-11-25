// Every page a visitor can find has a specific title, a description and social card tags, and its card image is there and the right size.
//   node scripts/check-page-metadata.mjs [dist] [--repo <folder holding config/>]   (--repo is for the tests)
// Read from the built public output and config/site.json (meta). A page kept out of search engines (noindex) needs a title and a
// description only. While the site's address is not set (about.site_address), no page may name an image, a page address or a canonical
// address, since a card image must be an absolute address; the pictures themselves (cards/<page>.png, 1200 x 630) must exist all the same,
// so that setting the address is the only step left. Built-ins only.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ownOrigin } from "./check-no-tracking.mjs";
import { pageFiles } from "./performance-budget.mjs";

const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (all, n) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", "#x27": "'" })[n]);

export function pngSize(path) {
  const bytes = readFileSync(path);
  if (bytes.length < 24 || bytes.toString("latin1", 1, 4) !== "PNG") return undefined;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export function metadataProblems(root, repoRoot) {
  const problems = [];
  const site = JSON.parse(readFileSync(join(repoRoot, "config/site.json"), "utf8"));
  const { meta } = site;
  const origin = ownOrigin(repoRoot);
  const byTitle = new Map(Object.entries(meta.pages).map(([id, p]) => [`${p.title} · ${meta.title_suffix}`, id]));
  // A generated page (config/answer_pages.json: a brand's, a model's) has a title of its own, which says what that page is, and shares the card of its kind
  // (an entry of meta.pages with "generated"): it is found by its folder, not by its title. One picture serves hundreds of pages.
  const answers = existsSync(join(repoRoot, "config/answer_pages.json")) ? JSON.parse(readFileSync(join(repoRoot, "config/answer_pages.json"), "utf8")) : {};
  const generated = Object.entries(meta.pages).flatMap(([id, p]) => (p.generated && answers[p.generated]?.path ? [[`${answers[p.generated].path}/`, id]] : []));
  const seenTitle = new Map();
  const seenDescription = new Map();

  for (const file of readdirSync(root, { recursive: true, encoding: "utf8" }).map((f) => f.replace(/\\/g, "/"))) {
    if (!file.endsWith(".html") || file.startsWith("data/") || file.startsWith("geo/")) continue;
    const html = readFileSync(join(root, file), "utf8");
    const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").trim();
    const tags = {};
    for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
      const key = /\b(?:name|property)="([^"]*)"/i.exec(tag)?.[1];
      const content = /\bcontent="([^"]*)"/i.exec(tag)?.[1];
      if (key && content !== undefined) tags[key] = decode(content);
    }
    const noindex = /noindex/i.test(tags.robots ?? "");
    const here = (what) => problems.push(`${file}: ${what}`);

    if (!title) here("has no title");
    else if (!title.endsWith(` · ${meta.title_suffix}`)) here(`the title "${title}" does not end with " · ${meta.title_suffix}"`);
    else if (title === ` · ${meta.title_suffix}` || title.length <= meta.title_suffix.length + 6) here(`the title "${title}" says nothing specific about the page`);
    if (title && seenTitle.has(title)) here(`the title "${title}" is the one ${seenTitle.get(title)} has: each page's title says what that page is`);
    seenTitle.set(title, file);

    const description = tags.description ?? "";
    if (!description) here("has no description");
    else {
      if (description.length < 40 || description.length > 200) here(`the description is ${description.length} characters; one sentence of 40 to 200 reads well in a search result`);
      if (seenDescription.has(description)) here(`the description is the one ${seenDescription.get(description)} has`);
      seenDescription.set(description, file);
    }
    // The notice for a visitor with scripts off must be true: a page that ships a script gives it, and a page that ships none does not.
    const ships = pageFiles(root, html).scripts.length > 0;
    const says = /<noscript>[\s\S]*?Scripts are off[\s\S]*?<\/noscript>/.test(html);
    if (ships && !says) here("ships a script but has no notice for a visitor with scripts off (config/site.json meta.pages needs_script)");
    if (!ships && says) here("says scripts are off and needed, but ships no script (remove needs_script from its entry in config/site.json meta.pages)");
    if (noindex) continue;

    for (const key of ["og:type", "og:title", "og:description", "twitter:card", "twitter:title", "twitter:description"]) if (!tags[key]) here(`has no ${key}`);
    const id = generated.find(([folder]) => file.startsWith(folder))?.[1] ?? byTitle.get(title);
    if (!id) here(`the title "${title}" is not one of config/site.json meta.pages, so its card cannot be found`);
    const cardTags = ["og:image", "og:url", "twitter:image"];
    if (origin) {
      for (const key of [...cardTags, "og:image:width", "og:image:height"]) if (!tags[key]) here(`has no ${key}, and the site's address is set`);
      if (!/rel="canonical"/i.test(html)) here("has no canonical link, and the site's address is set");
      if (id && tags["og:image"] && tags["og:image"] !== `${origin}${meta.card_folder}/${id}.png`) here(`og:image is ${tags["og:image"]}, not ${origin}${meta.card_folder}/${id}.png`);
    } else {
      for (const key of cardTags) if (tags[key]) here(`has ${key}, but the site's address is not set, so it cannot be an absolute address`);
      if (/rel="canonical"/i.test(html)) here("has a canonical link, but the site's address is not set");
      if (tags["twitter:card"] && tags["twitter:card"] !== "summary") here(`twitter:card is ${tags["twitter:card"]}; with no image it is "summary"`);
    }
    if (id) {
      const image = join(root, meta.card_folder, `${id}.png`);
      if (!existsSync(image)) here(`its card image ${meta.card_folder}/${id}.png is not in the output (run scripts/make-social-cards.mjs and commit public${meta.card_folder})`);
      else {
        const size = pngSize(image);
        if (!size) here(`${meta.card_folder}/${id}.png is not a PNG`);
        else if (size.width !== meta.card_width || size.height !== meta.card_height) here(`${meta.card_folder}/${id}.png is ${size.width} x ${size.height}, not ${meta.card_width} x ${meta.card_height}`);
      }
    }
  }
  return [...new Set(problems)];
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
  const problems = metadataProblems(root, repoRoot);
  if (problems.length) {
    console.error(problems.map((p) => `- ${p}`).join("\n"));
    process.exit(1);
  }
  const origin = ownOrigin(repoRoot);
  console.log(`${root}: every page has a specific title and a description, and every card image is there at the right size. ${origin ? `Cards are named at ${origin}.` : "The site's address is not set, so no page names a card image yet."}`);
}
