// The plain English lint: nothing a visitor reads may hold a word of the project's own workings (config/narrative/plain_english.json).
//   node scripts/check-plain-english.mjs [dist] [--repo <folder holding config/>]   (--repo is for the tests; it defaults to this repository)
// It reads the built public pages (after INTERNAL_PAGES=false npx astro build): each page's title, description and other meta words,
// its visible text, the words in alt and aria-label attributes, and the words handed to a chart or the canvas as props; and the
// visitor-facing words of config/*.json, which the charts draw in the browser and so are not in any page's file. Exit 0 when nothing
// is found. A real exception goes in the config's allow list with a reason; an entry that no longer matches anything fails too, so the
// list cannot hold a rule that is no longer needed. Built-ins only; it takes a few seconds.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { configWords, findHits, isAllowed, loadRules, pageWords } from "./plain-english.mjs";

const args = process.argv.slice(2);
const repoFlag = args.indexOf("--repo");
const repoRoot = repoFlag >= 0 ? resolve(args[repoFlag + 1]) : fileURLToPath(new URL("..", import.meta.url));
const root = resolve(args.filter((a, i) => !a.startsWith("--") && (repoFlag < 0 || i !== repoFlag + 1))[0] ?? "dist");
if (!existsSync(join(root, "_astro"))) {
  console.error(`${root} has no _astro folder: build the site first (INTERNAL_PAGES=false npx astro build).`);
  process.exit(2);
}

const rules = loadRules(repoRoot);
const hits = [];
const used = new Set();
const record = (hit, page) => {
  const entry = rules.allow.findIndex((a) => a.rule === hit.rule && (hit.source.includes(a.in) || (page ?? "").includes(a.in)) && (!a.text || hit.text.includes(a.text)));
  if (entry >= 0) used.add(entry);
  if (!isAllowed(rules, hit, page)) hits.push({ ...hit, page });
};

const pages = readdirSync(root, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".html") && !f.startsWith("data") && !f.startsWith("geo"))
  .map((f) => f.replace(/\\/g, "/"));
for (const page of pages) {
  for (const w of pageWords(readFileSync(join(root, page), "utf8"))) for (const hit of findHits(rules, `${page} > ${w.source}`, w.text, w.isWords)) record(hit, page);
}
for (const w of configWords(rules, repoRoot)) for (const hit of findHits(rules, w.source, w.text, /\s/.test(w.text), true)) record(hit, w.source);

// An entry for a page is stale only if that page was built: a page that is not in the output cannot be read, so its exception is not yet needed or not yet disproved.
const stale = rules.allow.map((a, i) => ({ a, i })).filter(({ a, i }) => !used.has(i) && (a.in.startsWith("config/") || pages.includes(a.in.split(" > ")[0])));
if (hits.length || stale.length) {
  for (const h of hits) console.error(`- ${h.source}: "${h.text}" holds "${h.rule}"; write instead: ${h.sayInstead}`);
  for (const { a } of stale) console.error(`- the allow list entry for "${a.rule}" in "${a.in}" matches nothing any more: remove it from config/narrative/plain_english.json`);
  console.error(`\n${hits.length} internal term${hits.length === 1 ? "" : "s"} a visitor could read${stale.length ? `, ${stale.length} unused allow entr${stale.length === 1 ? "y" : "ies"}` : ""}.`);
  process.exit(1);
}
console.log(`${root}: no internal term in ${pages.length} pages or in the words of ${rules.configFiles.length} config files (${rules.ids.size} ids read from config; ${rules.allow.length} allowed, each with a reason).`);
