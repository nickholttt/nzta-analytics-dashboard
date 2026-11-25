// Holds each built public page to its performance budget (config/performance_budget.json): the most bytes it may ship on first load,
// compressed, by kind (html, scripts, styles, fonts, data) and in total, and, for a page that asks for files before its script has run (the canvas),
// the bytes on the way to its first chart (first_chart_bytes). Measured from the built files, not timed, so it gives the same
// answer on every machine (scripts/performance-budget.mjs says what counts).
//   node scripts/check-performance-budget.mjs [dist] [--report] [--propose] [--repo <folder holding config/>]
//   --report   print every page's bytes beside its limits, then check; the pages one pattern holds ("/brand/*") are one line, the largest of each kind
//   --propose  print a budget (today's bytes plus 5%, rounded up to 100 bytes) as the JSON for the config's "pages", and exit 0; the pages a pattern the
//              config already has covers are one line, the largest of each kind plus 5%
// Exit 1, naming the page and the kind, when a page is over; also when a page has no budget or a budget has no page.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FIRST_CHART, KINDS, budgetFor, budgetProblems, isPattern, measurePages, propose } from "./performance-budget.mjs";

const args = process.argv.slice(2);
const repoFlag = args.indexOf("--repo");
const repoRoot = repoFlag >= 0 ? resolve(args[repoFlag + 1]) : fileURLToPath(new URL("..", import.meta.url));
const root = resolve(args.filter((a, i) => !a.startsWith("--") && (repoFlag < 0 || i !== repoFlag + 1))[0] ?? "dist");
if (!existsSync(join(root, "_astro"))) {
  console.error(`${root} has no _astro folder: build the site first (INTERNAL_PAGES=false npx astro build).`);
  process.exit(2);
}
const measured = measurePages(root);
const n = (x) => x.toLocaleString("en-NZ");

const budget = JSON.parse(readFileSync(join(repoRoot, "config/performance_budget.json"), "utf8"));
if (args.includes("--propose")) {
  console.log(JSON.stringify(propose(measured, 0.05, Object.keys(budget.pages).filter(isPattern)), null, 2));
  process.exit(0);
}
if (args.includes("--report")) {
  const line = (name, m, limits) => `${name.padEnd(14)} ${[...KINDS, "total", ...(m[FIRST_CHART] === undefined ? [] : [FIRST_CHART])].map((k) => `${k} ${n(m[k])}/${n(limits?.[k] ?? 0)}`).join("  ")}`;
  const shown = new Set();
  for (const [page, m] of Object.entries(measured)) {
    const key = budgetFor(budget, page);
    if (key === undefined || !isPattern(key)) {
      console.log(line(page, m, key === undefined ? undefined : budget.pages[key]));
    } else if (!shown.has(key)) {
      shown.add(key);
      const held = Object.entries(measured).filter(([other]) => budgetFor(budget, other) === key).map(([, x]) => x);
      const largest = Object.fromEntries([...KINDS, "total"].map((k) => [k, Math.max(...held.map((x) => x[k]))]));
      console.log(line(`${key} (${held.length})`, largest, budget.pages[key]));
    }
  }
}
const problems = budgetProblems(measured, budget);
if (problems.length) {
  console.error(problems.map((p) => `- ${p}`).join("\n"));
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}: a page is over its budget. Make it lighter, or, if the weight is wanted, raise the limit in config/performance_budget.json and say why in the pull request.`);
  process.exit(1);
}
console.log(`${root}: ${Object.keys(measured).length} pages, each within its budget (bytes compressed, from the built files). The budget counts what a page's own HTML names; data a script asks for after it starts (the events file, a table of figures) is not counted.`);
