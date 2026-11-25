// The timed check's verdict (scripts/first-load-verdict.mjs), without a browser: over the limit fails, at the limit passes, a page that never
// drew its chart fails and prints no timing, and --warn-only turns a failure into a warning with exit 0.
//   node --test "tests/site/first-load-verdict.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error a plain module with no types
import { outcome, pageVerdict } from "../../scripts/first-load-verdict.mjs";

const bytes = { code: { bytes: 300000, requests: 20 }, fonts: { bytes: 39000, requests: 2 }, data: { bytes: 40000, requests: 3 } };
const drawn = (runs: number[], failedRuns = 0) => {
  const s = [...runs].sort((a, b) => a - b);
  return { runs: runs.length + failedRuns, failedRuns, firstChartMs: { median: s[(s.length - 1) >> 1], min: s[0], max: s[s.length - 1] }, firstChartRunsMs: runs, totalBytes: 379000, totalRequests: 25, bytes, errors: [] };
};
const none = { runs: 5, failedRuns: 5, firstChartMs: null, firstChartRunsMs: [], totalBytes: 100, totalRequests: 3, bytes, errors: ["boom"] };

test("a median over the limit is a problem naming the page and by how much; at the limit it passes", () => {
  const over = pageVerdict("/canvas/", 3000, drawn([3100, 3200, 3300]));
  assert.match(over.problem, /^\/canvas\/: the first chart's median is 3,200 ms, over the limit of 3,000 ms by 200 ms$/);
  const at = pageVerdict("/canvas/", 3000, drawn([2900, 3000, 3100]));
  assert.equal(at.problem, null);
  assert.ok(at.lines.some((l: string) => /0 ms under the limit/.test(l)));
});

test("a page where no run drew its chart is a problem and prints no timing, and one run that did not draw is a problem too", () => {
  const v = pageVerdict("/canvas/", 3000, none);
  assert.match(v.problem, /^\/canvas\/: 5 of 5 runs never drew the first chart$/);
  assert.ok(!v.lines.some((l: string) => /median|each run/.test(l)), "no timing lines when there is no timing");
  assert.ok(v.lines.some((l: string) => /boom/.test(l)), "the page's own errors are shown");
  assert.match(pageVerdict("/canvas/", 3000, drawn([2500, 2600], 1)).problem, /1 of 3 runs never drew/);
});

test("the command exits 1 with a problem, and 0 with --warn-only, which prints a warning", () => {
  assert.deepEqual(outcome([], {}), { exitCode: 0, out: [], err: [] });
  const fail = outcome(["/canvas/: x"], {});
  assert.equal(fail.exitCode, 1);
  assert.match(fail.err.join("\n"), /^- \/canvas\/: x/);
  const warn = outcome(["/canvas/: x"], { warnOnly: true, github: true });
  assert.equal(warn.exitCode, 0);
  assert.deepEqual(warn.err, []);
  assert.match(warn.out[0], /^::warning title=First chart time::\/canvas\/: x\./);
  assert.match(outcome(["p"], { warnOnly: true }).out[0], /^Warning: p\./);
});
