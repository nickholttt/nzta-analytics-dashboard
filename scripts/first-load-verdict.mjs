// What the timed check says about one page's measurement, and whether the command fails. Pure, so tests/site/first-load-verdict.test.ts can
// run it without a browser. Used by scripts/check-first-load.mjs. `result` is one page's entry of scripts/measure-first-load.mjs's JSON.
export const n = (x) => Math.round(x).toLocaleString("en-NZ");

// The lines to print for a page and the problem with it, if any. A median is over when it is more than the limit: at the limit passes.
// A page where any run never drew its chart is a problem whatever the others did, and where none did there is no time to print.
export function pageVerdict(path, limit, result) {
  const lines = [`${path}  first chart, ${result.runs} runs on the phone profile (390 px, 1.6 Mbps down, 150 ms latency, processor slowed four times, empty cache)`];
  const median = result.firstChartMs?.median;
  if (result.firstChartMs && result.firstChartRunsMs?.length) {
    lines.push(`  each run (ms): ${result.firstChartRunsMs.map(n).join(", ")}`);
    lines.push(`  median ${n(median)} ms, fastest ${n(result.firstChartMs.min)}, slowest ${n(result.firstChartMs.max)}; limit ${n(limit)} ms`);
  }
  lines.push(`  crossed the network by then: ${n(result.totalBytes)} B in ${result.totalRequests} requests (code ${n(result.bytes.code.bytes)}, fonts ${n(result.bytes.fonts.bytes)}, data ${n(result.bytes.data.bytes)})`);
  if (result.errors?.length) lines.push(`  errors the page logged: ${result.errors.join(" | ")}`);
  let problem = null;
  if (result.failedRuns > 0) problem = `${path}: ${result.failedRuns} of ${result.runs} runs never drew the first chart`;
  else if (median > limit) problem = `${path}: the first chart's median is ${n(median)} ms, over the limit of ${n(limit)} ms by ${n(median - limit)} ms`;
  else lines.push(`  ${n(limit - median)} ms under the limit`);
  return { lines, problem };
}

// What to print and how to exit once every page has a verdict. With warnOnly a problem is a warning (a GitHub annotation on a runner) and the exit is 0.
export function outcome(problems, { warnOnly = false, github = false } = {}) {
  if (problems.length === 0) return { exitCode: 0, out: [], err: [] };
  if (warnOnly) return { exitCode: 0, out: problems.map((p) => `${github ? "::warning title=First chart time::" : "Warning: "}${p}. This run only warns: the limit was set on another machine.`), err: [] };
  return {
    exitCode: 1,
    out: [],
    err: [
      ...problems.map((p) => `- ${p}`),
      `\n${problems.length} page${problems.length === 1 ? "" : "s"} over the time limit or never drawn. Find what the first chart now waits for (scripts/measure-first-load.mjs --out writes every request's start and end), or, if the change is wanted, say why in the pull request and raise first_chart_ms in config/performance_budget.json.`,
    ],
  };
}
