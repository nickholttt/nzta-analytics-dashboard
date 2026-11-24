// Times the first chart of each page that has a `first_chart_ms` in config/performance_budget.json, on the throttled phone profile, and fails
// when the median is over it. This is the timed half of the performance check; scripts/check-performance-budget.mjs is the other half, and
// holds the bytes on every pull request without timing anything.
//
//   node scripts/check-first-load.mjs --playwright <folder holding node_modules/playwright-core> --chrome <chrome-headless-shell executable>
//        [--dist dist] [--runs 5] [--out <folder for the measuring script's JSON>] [--warn-only]
//
// It runs scripts/measure-first-load.mjs (the method, the profile and what is counted are in its header) on each page, prints every run's
// time, the median, the spread, the bytes, the browser and the machine it ran on (the verdict is scripts/first-load-verdict.mjs, tested without a browser), and compares the median with the limit. The profile slows the processor four
// times relative to the machine it runs on, so the figure moves with that machine: the limit was set on the maintainer's computer
// (config/performance_budget.json says how), and a slower machine reads higher. --warn-only reports a figure over the limit as a warning
// (a GitHub annotation when it runs there) and exits 0, for a machine the limit has not been checked against.
// Exit 1: a page over its limit, or a run that never drew its chart. Exit 2: the tools to measure with were not given or are missing.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { outcome, pageVerdict } from "./first-load-verdict.mjs";

const args = process.argv.slice(2);
const flag = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const warnOnly = args.includes("--warn-only");
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const budget = JSON.parse(readFileSync(join(repoRoot, "config/performance_budget.json"), "utf8"));
const pagesFile = JSON.parse(readFileSync(join(repoRoot, "scripts/first-load-pages.json"), "utf8"));

// The pages with a time limit, each matched to the page of first-load-pages.json that opens it with nothing asked.
const timed = Object.entries(budget.pages)
  .filter(([, limits]) => typeof limits.first_chart_ms === "number")
  .map(([path, limits]) => ({ path, limit: limits.first_chart_ms, id: pagesFile.pages.find((p) => p.path === path)?.id }));
if (timed.length === 0) {
  console.error("No page in config/performance_budget.json has a first_chart_ms.");
  process.exit(2);
}
const unmatched = timed.filter((t) => !t.id);
if (unmatched.length) {
  console.error(`${unmatched.map((t) => t.path).join(", ")} has a first_chart_ms but no page in scripts/first-load-pages.json with that path.`);
  process.exit(2);
}

const out = resolve(flag("out") ?? mkdtempSync(join(tmpdir(), "first-load-")));
mkdirSync(out, { recursive: true });
const runs = Number(flag("runs") ?? 5);
const passed = ["--playwright", "--chrome", "--dist"].flatMap((f) => (flag(f.slice(2)) ? [f, flag(f.slice(2))] : []));
const machine = cpus();
console.log(`Machine: ${machine[0]?.model.trim() ?? "unknown processor"}, ${machine.length} logical processors. The profile slows the processor four times relative to this one.`);

const problems = [];
let browserShown = false;
for (const { path, limit, id } of timed) {
  const run = spawnSync(process.execPath, [join(repoRoot, "scripts/measure-first-load.mjs"), ...passed, "--pages", id, "--runs", String(runs), "--out", out, "--label", "check"], { encoding: "utf8" });
  if (run.status !== 0) {
    process.stderr.write(run.stderr || run.stdout);
    process.exit(run.status === 2 ? 2 : 1);
  }
  const result = JSON.parse(readFileSync(join(out, "check-phone.json"), "utf8"))[id];
  if (!browserShown && result.browserVersion) {
    console.log(`Browser: ${result.browserVersion}`);
    browserShown = true;
  }
  const verdict = pageVerdict(path, limit, result);
  console.log(verdict.lines.join(String.fromCharCode(10)));
  if (verdict.problem) problems.push(verdict.problem);
}
const end = outcome(problems, { warnOnly, github: Boolean(process.env.GITHUB_ACTIONS) });
for (const line of end.out) console.log(line);
for (const line of end.err) console.error(line);
process.exit(end.exitCode);
