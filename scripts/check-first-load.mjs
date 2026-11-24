// Times the first chart of each page that has a `first_chart_ms` in config/performance_budget.json, on the throttled phone profile, and fails
// when the median is over it. This is the timed half of the performance check; scripts/check-performance-budget.mjs is the other half, and
// holds the bytes on every pull request without timing anything.
//
//   node scripts/check-first-load.mjs --playwright <folder holding node_modules/playwright-core> --chrome <chrome-headless-shell executable>
//        [--dist dist] [--runs 5] [--out <folder for the measuring script's JSON>] [--warn-only]
//
// It runs scripts/measure-first-load.mjs (the method, the profile and what is counted are in its header) on each page, prints every run's
// time, the median, the spread, the bytes and the machine it ran on, and compares the median with the limit. The profile slows the processor four
// times relative to the machine it runs on, so the figure moves with that machine: the limit was set on the maintainer's computer
// (config/performance_budget.json says how), and a slower machine reads higher. --warn-only reports a figure over the limit as a warning
// (a GitHub annotation when it runs there) and exits 0, for a machine the limit has not been checked against.
// Exit 1: a page over its limit, or a run that never drew its chart. Exit 2: the tools to measure with were not given or are missing.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
const n = (x) => Math.round(x).toLocaleString("en-NZ");

const machine = cpus();
console.log(`Machine: ${machine[0]?.model.trim() ?? "unknown processor"}, ${machine.length} logical processors. The profile slows the processor four times relative to this one.`);

let over = 0;
for (const { path, limit, id } of timed) {
  const run = spawnSync(process.execPath, [join(repoRoot, "scripts/measure-first-load.mjs"), ...passed, "--pages", id, "--runs", String(runs), "--out", out, "--label", "check"], { encoding: "utf8" });
  if (run.status !== 0) {
    process.stderr.write(run.stderr || run.stdout);
    process.exit(run.status === 2 ? 2 : 1);
  }
  const result = JSON.parse(readFileSync(join(out, "check-phone.json"), "utf8"))[id];
  const median = result.firstChartMs?.median;
  console.log(`${path}  first chart, ${result.runs} runs on the phone profile (390 px, 1.6 Mbps down, 150 ms latency, processor slowed four times, empty cache)`);
  console.log(`  each run (ms): ${result.firstChartRunsMs.map(n).join(", ")}`);
  console.log(`  median ${n(median)} ms, fastest ${n(result.firstChartMs.min)}, slowest ${n(result.firstChartMs.max)}; limit ${n(limit)} ms`);
  console.log(`  crossed the network by then: ${n(result.totalBytes)} B in ${result.totalRequests} requests (code ${n(result.bytes.code.bytes)}, fonts ${n(result.bytes.fonts.bytes)}, data ${n(result.bytes.data.bytes)})`);
  const problem =
    result.failedRuns > 0 ? `${path}: ${result.failedRuns} of ${result.runs} runs never drew the first chart` : median > limit ? `${path}: the first chart's median is ${n(median)} ms, over the limit of ${n(limit)} ms by ${n(median - limit)} ms` : null;
  if (problem) {
    over += 1;
    if (warnOnly) console.log(`${process.env.GITHUB_ACTIONS ? "::warning title=First chart time::" : "Warning: "}${problem}. This run only warns: the limit was set on another machine.`);
    else console.error(`- ${problem}`);
  } else console.log(`  ${n(limit - median)} ms under the limit`);
}
if (over && !warnOnly) {
  console.error(`\n${over} page${over === 1 ? "" : "s"} over the time limit. Find what the first chart now waits for (scripts/measure-first-load.mjs --out writes every request's start and end), or, if the change is wanted, say why in the pull request and raise first_chart_ms in config/performance_budget.json.`);
  process.exit(1);
}
