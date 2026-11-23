// Holds each built public page to its performance budget (config/performance_budget.json): the most bytes it may ship on first load,
// compressed, by kind (html, scripts, styles, fonts, data) and in total. Measured from the built files, not timed, so it gives the same
// answer on every machine (scripts/performance-budget.mjs says what counts).
//   node scripts/check-performance-budget.mjs [dist] [--report] [--propose] [--repo <folder holding config/>]
//   --report   print every page's bytes beside its limits, then check
//   --propose  print a budget (today's bytes plus 5%, rounded up to 100 bytes) as the JSON for the config's "pages", and exit 0
// Exit 1, naming the page and the kind, when a page is over; also when a page has no budget or a budget has no page.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { KINDS, budgetProblems, measurePages, propose } from "./performance-budget.mjs";

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

if (args.includes("--propose")) {
  console.log(JSON.stringify(propose(measured), null, 2));
  process.exit(0);
}
const budget = JSON.parse(readFileSync(join(repoRoot, "config/performance_budget.json"), "utf8"));
if (args.includes("--report")) {
  for (const [page, m] of Object.entries(measured)) {
    console.log(`${page.padEnd(14)} ${[...KINDS, "total"].map((k) => `${k} ${n(m[k])}/${n(budget.pages[page]?.[k] ?? 0)}`).join("  ")}`);
  }
}
const problems = budgetProblems(measured, budget);
if (problems.length) {
  console.error(problems.map((p) => `- ${p}`).join("\n"));
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}: a page is over its budget. Make it lighter, or, if the weight is wanted, raise the limit in config/performance_budget.json and say why in the pull request.`);
  process.exit(1);
}
console.log(`${root}: ${Object.keys(measured).length} pages, each within its budget (bytes compressed, from the built files).`);
