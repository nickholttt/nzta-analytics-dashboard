// Checks the output of the public build (INTERNAL_PAGES=false npx astro build) after the fact, from dist/ alone:
//   node scripts/check-public-build.mjs [dist]
// It fails, naming the file, when the output holds an internal page, a script no page reaches, a page that names a
// script the output does not hold, or a script that names a chunk (in any quote form, or in Vite's dependency map) the output does not hold.
// Known issue 7 was the second: the status page's script shipped, unlinked, in a build without the status page. Exit 0 when the output is clean.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "dist");
const INTERNAL_PAGE_FOLDERS = JSON.parse(readFileSync(new URL("./internal-pages.json", import.meta.url), "utf8")).folders;
const problems = [];

if (!existsSync(join(root, "_astro"))) {
  console.error(`${root} has no _astro folder: build the site first.`);
  process.exit(2);
}
for (const folder of INTERNAL_PAGE_FOLDERS) if (existsSync(join(root, folder))) problems.push(`${folder}/ is in the public output`);

const reached = new Set();
const reach = (url, from) => {
  if (reached.has(url)) return;
  if (!existsSync(join(root, url))) return void problems.push(`${from} names ${url}, which is not in the output`);
  reached.add(url);
  const source = readFileSync(join(root, url), "utf8");
  for (const [, relative] of source.matchAll(/(?:from|import)\s*\(?\s*["`'](\.\/[^"`']+\.js)["`']/g)) reach(`/_astro/${relative.slice(2)}`, url);
};
for (const file of readdirSync(root, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".html")))
  for (const [, url] of readFileSync(join(root, file), "utf8").matchAll(/"(\/_astro\/[^"]+\.js)"/g)) reach(url, file);
for (const file of readdirSync(join(root, "_astro")).filter((f) => f.endsWith(".js")))
  if (!reached.has(`/_astro/${file}`)) problems.push(`_astro/${file} is not reached from any page`);

// An independent guard (the review of #75): the pattern above, like the one that prunes the build (astro.config.mjs), reads import paths in the
// forms it was written for, and a form it does not read is a script both miss (Vite writes a lazy import with backquotes, and lists a
// chunk's own dependencies in a map of plain strings). So this reads nothing of the syntax: every file name shaped like the build's own
// output that appears anywhere in a script the pages reach must exist in the output. That shape, read from the real output: a name that may
// itself hold dots (a page's script is Page.astro_astro_type_script_index_0_lang.<hash>.js), then a dot, then exactly 8 characters of the
// base64url alphabet, then .js. It is read as a whole name, starting after a quote, a slash or ./, so that text such as "astro.config.js",
// or a longer word that merely ends in eight letters, is not taken for a file.
const named = /(?<=["'`/])[A-Za-z0-9_.-]+\.[A-Za-z0-9_-]{8}\.js\b/g;
const held = new Set(readdirSync(join(root, "_astro")).filter((f) => f.endsWith(".js")));
for (const url of [...reached]) {
  for (const [name] of readFileSync(join(root, url), "utf8").matchAll(named)) {
    if (!held.has(name)) problems.push(`${url} names ${name}, which is not in the output`);
  }
}

if (problems.length) {
  console.error([...new Set(problems)].map((p) => `- ${p}`).join("\n"));
  process.exit(1);
}
console.log(`${root}: no internal page, and every script is reached from a page (${reached.size} scripts).`);
