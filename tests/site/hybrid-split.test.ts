// A dataset that does not divide its hybrids (manifest: mild_hybrid_identification_coverage.mild_split_published is false) says so on a
// chart by powertrain, and its note about the mild line does not appear; one that does, or whose manifest has no such field, is
// as before. On a fixture manifest: no dataset is in that state in the local build. The names come in as arguments, as the panel
// reads them from config; none is named here.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { hybridNotes, splitPublished } = await import("../../src/lib/hybrid.ts");
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const phrases = JSON.parse(read("config/presets.json")).defaults.phrases;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const block = (extra: object = {}) => ({
  label: "MILD (identified)",
  all_time: { coverage_stated_confidence: 0.83, coverage_high_confidence_only: 0.628 },
  trailing: { window_months: 12, coverage_stated_confidence: 0.841, coverage_high_confidence_only: 0.62 },
  ...extra,
});
const ask = (coverage: ReturnType<typeof block> | undefined, over: object = {}) =>
  hybridNotes({ coverage, onPowertrain: true, mildDrawn: true, narrowed: false, internal: false, mildValue: "MILD", undividedValue: "UNDIV", phrases, percent: pct, ...over });

test("a dataset that withholds the split says its hybrids are shown undivided, names them from config, and has no note about the mild line", () => {
  const withheld = block({ mild_split_published: false, publish_split_at_trailing_high_confidence_coverage: 0.7 });
  assert.equal(splitPublished(withheld), false);
  const notes = ask(withheld);
  assert.equal(notes.withheld, "In this dataset the undiv vehicles are shown undivided: too few could be told apart to split them into types.");
  assert.equal(notes.coverage, undefined, "the mild line is not drawn, so the note about how far it is identified does not appear");
  // Even where the rows still carry the mild value, the note about its coverage stays off.
  assert.equal(ask(withheld, { mildDrawn: true }).coverage, undefined);
});

test("the internal page gives the figure and the level the split is published at", () => {
  const withheld = block({ mild_split_published: false, publish_split_at_trailing_high_confidence_coverage: 0.7 });
  assert.equal(ask(withheld, { internal: true }).withheld, "In this dataset the undiv vehicles are shown undivided: the trailing high-confidence coverage, 62.0%, is under 70.0%, the level at which the split is published.");
  // Without the threshold in the manifest the internal page falls back to the public sentence rather than print a gap.
  assert.equal(ask(block({ mild_split_published: false }), { internal: true }).withheld, ask(block({ mild_split_published: false })).withheld);
});

test("a dataset that publishes the split, or whose manifest has no flag, is as before: the coverage note, and no sentence about undivided hybrids", () => {
  for (const coverage of [block({ mild_split_published: true, publish_split_at_trailing_high_confidence_coverage: 0.7 }), block()]) {
    assert.equal(splitPublished(coverage), true);
    const notes = ask(coverage);
    assert.equal(notes.withheld, undefined);
    assert.match(notes.coverage ?? "", /^MILD \(identified\): at least 84\.1% of the mild vehicles registered in the last 12 months are identified/);
    assert.doesNotMatch(notes.coverage ?? "", /whole|every vehicle in the dataset/);
  }
  // A narrowed view still says the figures are the whole dataset's; a view where the mild line is not drawn has no note.
  assert.match(ask(block(), { narrowed: true }).coverage ?? "", /every vehicle in the dataset/);
  assert.equal(ask(block(), { mildDrawn: false }).coverage, undefined);
});

test("only a chart by the powertrain field, and only where the build has a block for the dataset, carries either note", () => {
  assert.deepEqual(ask(block({ mild_split_published: false }), { onPowertrain: false }), {});
  assert.deepEqual(ask(undefined), {});
});

test("the panel reads the flag, relabels nothing for a withheld split, and links the caveat after the sentence", () => {
  const panel = read("src/components/PresetPanel.tsx");
  assert.match(panel, /const relabels = onPowertrain && splitPublished\(coverage\)/);
  assert.match(panel, /undividedValue: hybrid\.undivided_powertrain \?\? hybrid\.source_hybrid\.value/);
  assert.match(panel, /<a href="\/caveats#mild-hybrid-limits">\{phrases\.mild_split_withheld_link\}<\/a>/);
  assert.match(read("src/pages/caveats.astro"), /<h2 id="mild-hybrid-limits">/);
});
