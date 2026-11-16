// Checks the output of the public build (INTERNAL_PAGES=false npx astro build) after the fact, from dist/ alone:
//   node scripts/check-public-build.mjs [dist]
// It fails, naming the file, when the output holds an internal page, a script no page reaches, or a page that names a
// script the output does not hold. Known issue 7 was the second: the status page's script shipped, unlinked, in a build
// without the status page. Exit 0 when the output is clean.
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
  for (const [, relative] of source.matchAll(/(?:from|import)\s*\(?\s*"(\.\/[^"]+\.js)"/g)) reach(`/_astro/${relative.slice(2)}`, url);
};
for (const file of readdirSync(root, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".html")))
  for (const [, url] of readFileSync(join(root, file), "utf8").matchAll(/"(\/_astro\/[^"]+\.js)"/g)) reach(url, file);
for (const file of readdirSync(join(root, "_astro")).filter((f) => f.endsWith(".js")))
  if (!reached.has(`/_astro/${file}`)) problems.push(`_astro/${file} is not reached from any page`);

if (problems.length) {
  console.error(problems.map((p) => `- ${p}`).join("\n"));
  process.exit(1);
}
console.log(`${root}: no internal page, and every script is reached from a page (${reached.size} scripts).`);
