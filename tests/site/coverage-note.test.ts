// The identification-coverage note under a chart (D-107 item 3): the figures are the whole dataset's, so a chart narrowed to
// part of it says so. The words are in config/presets.json (defaults.phrases), not in the panel.
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fillTemplate } from "../../src/lib/sentences.ts";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const phrases = JSON.parse(read("config/presets.json")).defaults.phrases;
const facts = { label: "LABEL", value: "VALUE", window: 12, trailing: "T%", all_time: "A%", trailing_high: "TH%", all_time_high: "AH%" };

test("both coverage notes fill completely from the facts the panel supplies", () => {
  for (const key of ["identification_coverage", "identification_coverage_internal"]) {
    const filled = fillTemplate(phrases[key], facts);
    assert.deepEqual(filled.unresolved, [], key);
    assert.match(filled.text, /T%/);
    assert.match(filled.text, /A%/);
  }
  assert.match(fillTemplate(phrases.identification_coverage_internal, facts).text, /TH%.*AH%/);
});

test("the sentence for a narrowed chart says the figures are for every vehicle in the dataset", () => {
  assert.match(phrases.identification_coverage_whole, /every vehicle in the dataset/);
  assert.match(phrases.identification_coverage_whole, /not for the vehicles this chart is narrowed to/);
});

test("the panel adds that sentence whenever the view is narrowed by a filter of its own or by conditions, and holds no words of its own", () => {
  const panel = read("src/components/PresetPanel.tsx");
  assert.match(panel, /narrowed \|\| keptBy\?\.length \? \[phrases\.identification_coverage_whole\]/);
  assert.doesNotMatch(panel, /of mild hybrids/);
  // ... and only where the value the note speaks of has a line: it must be in the rows the chart draws.
  assert.match(panel, /relabels && coverage && coverageDrawn/);
  assert.match(panel, /rows\?\.some\(\(r\) => r\.value === hybrid\.mild_powertrain && r\.n > 0\)/);
});

test("the note on a capped dimension names the count its dataset ranks by, from the dataset's own words", () => {
  const dimensions = JSON.parse(read("config/dimensions.json"));
  const capped = dimensions.dimensions.filter((d: { derive?: { cap?: number } }) => d.derive?.cap);
  assert.ok(capped.length > 0, "a capped dimension: this test would pass without checking anything");
  for (const d of capped) assert.match(d.note_template, /\{words\.cap_count\}/, d.id);
  const own = dimensions.datasets.filter((ds: { words?: { cap_count?: string } }) => ds.words);
  const counts = own.map((ds: { words: { cap_count?: string } }) => ds.words.cap_count);
  assert.ok(counts.every(Boolean), "every dataset that has words names the count its cap ranks by");
  assert.equal(new Set(counts).size, counts.length, "no two datasets share one: each says its own");
});

test("the note under a 12-month share says a point is blank for a month with no vehicles in what is counted, as well as for a missing month", () => {
  for (const key of ["rolling_share_note", "rolling_share_note_internal"]) {
    const filled = fillTemplate(phrases[key], { months: 12 });
    assert.deepEqual(filled.unresolved, [], key);
    assert.match(filled.text, /no vehicles in what is counted/, key);
    assert.match(filled.text, /missing/, key);
    assert.doesNotMatch(phrases[key], /\d/, "the number of months comes in as a placeholder");
  }
  const mix = read("src/components/MixChart.tsx");
  assert.match(mix, /fillTemplate\(phrases\.rolling_share_note, \{ months: TRAILING_MONTHS \}\)/);
  assert.doesNotMatch(mix, /is missing from the data/);
});
