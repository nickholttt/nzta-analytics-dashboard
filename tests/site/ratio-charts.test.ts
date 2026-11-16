// Tests for the charts that divide one dataset by another (cars still registered against a published count; completeness).
// They read the real config, so a measure or preset that stops matching what D-095 and docs/METRICS.md say fails here, and
// they read the chart and resolver source, since those need a browser or the cube to run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { monthRuns, sayStarts, unrecordedMonths } from "../../src/lib/sentences.ts";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const json = (path: string) => JSON.parse(read(path));
const presetsDoc = json("config/presets.json");
const measures = json("config/measures.json").derived_measures;
const preset = (id: string) => presetsDoc.groups.flatMap((g: { presets: { id: string }[] }) => g.presets).find((p: { id: string }) => p.id === id);
const measure = (id: string) => measures.find((m: { id: string }) => m.id === id);

test("cars still registered is a ratio of the register's survivors to the long-run count, from its own measure", () => {
  const p = preset("cars-still-registered");
  const m = measure(p.derived);
  assert.equal(m.numerator_dataset, "registrations_surviving");
  assert.equal(m.denominator_dataset, p.dataset, "the preset's dataset is the denominator's, so the denominator's source statement sits beside it");
  assert.equal(m.numerator_dimension, "import_status");
  assert.equal(m.numerator_narrowed_to.dimension, "vehicle_type");
  assert.ok(m.caveat.text && m.caveat.href.startsWith("/method#"));
});

test("cars still registered is never called completeness, in any of its words (D-095)", () => {
  const p = preset("cars-still-registered");
  const m = measure(p.derived);
  const words = [p.question, m.label, m.definition, m.unit_note, m.table_label, m.note_template, m.caveat.text, m.caveat.link_label].join(" ");
  assert.doesNotMatch(words, /complete/i);
  assert.equal(p.derived === "completeness", false);
});

test("the caveat's link goes to a section of /method that exists", () => {
  const m = measure(preset("cars-still-registered").derived);
  const id = m.caveat.href.split("#")[1];
  assert.match(read("src/pages/method.astro"), new RegExp(`id="${id}"`));
});

test("the ratio chart is chosen by a measure that names both datasets, not by its id", () => {
  const trend = read("src/components/TrendChart.tsx");
  assert.match(trend, /isRatioMeasure\(findDerived\(preset\.derived\)\)/);
  const resolve = read("src/lib/resolve.ts");
  assert.match(resolve, /!isRatioMeasure\(findDerived\(preset\.derived\)\)/);
  assert.match(resolve, /numerator_narrowed_to/);
  assert.doesNotMatch(trend + resolve, /"completeness"|"cars_still_registered"/);
});

test("a build without the pair the numerator is narrowed through blocks the chart and says which pair", () => {
  assert.match(read("src/lib/resolve.ts"), /it needs the \$\{numeratorDimension\} x \$\{narrow\.dimension\} pair slice/);
});

test("a ratio chart says where its breakdown begins when the data opens with months the source does not record", () => {
  const phrases = presetsDoc.defaults.phrases;
  const T = "__UNDEFINED__";
  const rows = [
    { month: "1975-05", value: T, n: 10 },
    { month: "1975-06", value: T, n: 10 },
    { month: "1975-07", value: "A", n: 10 },
  ];
  const runs = monthRuns(unrecordedMonths(rows));
  assert.equal(sayStarts(phrases.breakdown_starts, runs, "1975-05"), "This breakdown is recorded from Jul 1975 on, so no earlier month is drawn.");
  // Not recorded later in the data, with the first month recorded: nothing to say about where it begins.
  const later = monthRuns(unrecordedMonths([{ month: "1975-05", value: "A", n: 1 }, { month: "1975-06", value: T, n: 10 }]));
  assert.equal(sayStarts(phrases.breakdown_starts, later, "1975-05"), undefined);
  assert.equal(sayStarts(phrases.breakdown_starts, [], "1975-05"), undefined);
});

test("the ratio chart draws every month of its window through lineMonths, never the points alone, so a line cannot bridge a gap", () => {
  const trend = read("src/components/TrendChart.tsx");
  const ratio = trend.slice(trend.indexOf("function RatioTrend"), trend.indexOf("function ValuesTrend"));
  assert.match(ratio, /lineMonths\(s\.points, model\.from, model\.to\)/);
  assert.match(ratio, /Plot\.lineY\(line,/);
  assert.doesNotMatch(ratio, /Plot\.lineY\(data,/);
  assert.match(ratio, /Plot\.dot\(line\.filter\(\(p\) => alone\.has\(p\.month\)\)/);
});

test("where the breakdown begins is said only when the window reaches the first month; a count's last year is whole or absent", () => {
  const trend = read("src/components/TrendChart.tsx");
  assert.match(trend, /model\.from === firstMonth \? startsSentence : undefined/);
  assert.match(trend, /n: windowTotal\(latest, reader\(s\)\)/);
});

test("the cars-still-registered notes carry only what bears on the view: no repeat of the definitions, no site-wide promise", () => {
  const m = measure(preset("cars-still-registered").derived);
  assert.equal(m.show_dataset_definitions, false);
  assert.doesNotMatch(m.note_template, /scale|above the full count/);
  assert.match(m.caveat.text, /not a survival rate/);
  assert.doesNotMatch(m.caveat.text, /\d/);
});
