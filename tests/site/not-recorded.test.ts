// Tests for months a breakdown was not recorded and months whose parts add up to more than the total
// (src/lib/sentences.ts), run with Node's own test runner: node --test "tests/site/*.test.ts"
// The last group reads the trend chart's source to check it uses them, since the component needs a browser to run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { monthRuns, sayExceedsTotal, sayNotRecorded, unrecordedMonths } from "../../src/lib/sentences.ts";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const phrases = JSON.parse(read("config/presets.json")).defaults.phrases;
const TOKEN = "__UNDEFINED__";

// Three months with the breakdown not recorded, then two where it is, one of them with a few vehicles still not recorded.
const rows = [
  { month: "1975-04", value: TOKEN, n: 6000 },
  { month: "1975-05", value: TOKEN, n: 6100 },
  { month: "1975-06", value: TOKEN, n: 6689 },
  { month: "1975-07", value: "A", n: 6906 },
  { month: "1975-07", value: "B", n: 344 },
  { month: "1975-08", value: "A", n: 5000 },
  { month: "1975-08", value: "B", n: 300 },
  { month: "1975-08", value: TOKEN, n: 1 },
];

test("a month with every vehicle under the not-recorded token is not recorded; a month with any vehicle recorded is not", () => {
  assert.deepEqual(unrecordedMonths(rows), ["1975-04", "1975-05", "1975-06"]);
});

test("a month with a count of zero under the token is not called not recorded", () => {
  assert.deepEqual(unrecordedMonths([{ month: "2020-01", value: TOKEN, n: 0 }]), []);
});

test("months are grouped into stretches of consecutive months, in order", () => {
  assert.deepEqual(monthRuns(["1975-06", "1975-04", "1975-05", "1976-12", "1977-01", "1980-03"]), [
    { from: "1975-04", to: "1975-06" },
    { from: "1976-12", to: "1977-01" },
    { from: "1980-03", to: "1980-03" },
  ]);
  assert.deepEqual(monthRuns([]), []);
});

test("each stretch left blank is said in words that name its months, and never as zero", () => {
  const [sentence] = sayNotRecorded(phrases.not_recorded, monthRuns(unrecordedMonths(rows)));
  assert.match(sentence, /from Apr 1975 to Jun 1975/);
  assert.match(sentence, /left blank, not drawn as zero/);
});

test("the months a build says add up to more than the total are each said as published; none, nothing", () => {
  assert.deepEqual(sayExceedsTotal(phrases.exceeds_total, []), []);
  assert.deepEqual(sayExceedsTotal(phrases.exceeds_total, undefined), []);
  const [sentence] = sayExceedsTotal(phrases.exceeds_total, ["1975-07"]);
  assert.match(sentence, /In Jul 1975/);
  assert.match(sentence, /more than the month's total/);
  assert.match(sentence, /shown as published/);
});

const trend = read("src/components/TrendChart.tsx");

test("the trend chart leaves a not-recorded month blank, says it, and reads the manifest's exceeds_total rather than summing", () => {
  assert.match(trend, /unrecordedMonths\(rows\)/);
  assert.match(trend, /counted\(\(m\) => present\.has\(m\), covers, \(m\) => unrecorded\.has\(m\),/);
  assert.match(trend, /sayNotRecorded\(phrases\.not_recorded,/);
  assert.match(trend, /\.exceeds_total\?\.\[preset\.dimension\]/);
  assert.match(trend, /sayExceedsTotal\(phrases\.exceeds_total,/);
});

test("a long-run chart names the source's own statement, from the manifest, beside the register's basis note", () => {
  const dataset = JSON.parse(read("config/dimensions.json")).datasets.find((d: { id: string }) => d.id === "registrations_cars_long_run");
  assert.match(dataset.source_note, /\{dataset\.supplied\.attribution\}/);
  assert.ok(dataset.not_built_message, "a build without the dataset needs words to say so");
  assert.match(read("src/components/PresetPanel.tsx"), /BASIS_NOTE/);
});
