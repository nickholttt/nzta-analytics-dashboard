// A dimension's note that depends on the state it describes (src/lib/dimensionNote.ts): with a dataset's hybrid split withheld, the chart by
// powertrain says its hybrids are shown undivided and not that there is a mild line; with it published, as before. On fixture manifests,
// through the two functions the panel calls. No dimension is named here: the one that carries a condition is found in config.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { dimensionNote, NOTE_CONDITIONS } = await import("../../src/lib/dimensionNote.ts");
const { hybridNotes, splitPublished } = await import("../../src/lib/hybrid.ts");
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const dimensions = JSON.parse(read("config/dimensions.json")).dimensions as Record<string, string>[];
const phrases = JSON.parse(read("config/presets.json")).defaults.phrases;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

// The dimension whose notes speak of a line that exists only where the split is published, as config says.
const carrying = dimensions.find((d) => d.note_condition === "split_published") as Record<string, string>;

const coverage = (extra: object = {}) => ({
  label: "MILD (identified)",
  all_time: { coverage_stated_confidence: 0.83, coverage_high_confidence_only: 0.628 },
  trailing: { window_months: 12, coverage_stated_confidence: 0.841, coverage_high_confidence_only: 0.62 },
  ...extra,
});

// What the panel puts in the notes under a chart by this dimension, in the order it puts them: the dimension's note, then the coverage
// note and the sentence about an undivided split.
function notesUnder(block: ReturnType<typeof coverage> | undefined, internal = false) {
  const note = dimensionNote(carrying, internal, { splitPublished: splitPublished(block) });
  const hybrid = hybridNotes({ coverage: block, onPowertrain: true, mildDrawn: true, narrowed: false, internal, mildValue: "MILD", undividedValue: "UNDIV", phrases, percent: pct });
  return { dimension: note.plain, coverage: hybrid.coverage, withheld: hybrid.withheld };
}

test("config's conditions are all known, and each note that has a condition says what to read when it does not hold", () => {
  assert.ok(carrying, "a dimension carries the condition: this test would pass without checking anything");
  for (const d of dimensions.filter((x) => x.note_condition)) {
    assert.ok(d.note_condition in NOTE_CONDITIONS, `${d.id}: ${d.note_condition} is not a known condition`);
    if (d.public_note) assert.ok("public_note_otherwise" in d, `${d.id}: a public note with a condition says what to read otherwise`);
    if (d.note) assert.ok("note_otherwise" in d, `${d.id}: a note with a condition says what to read otherwise`);
  }
});

test("with the split withheld the chart shows the sentence about undivided hybrids and not the note about a mild line", () => {
  const withheld = coverage({ mild_split_published: false, publish_split_at_trailing_high_confidence_coverage: 0.7 });
  const notes = notesUnder(withheld);
  assert.equal(notes.dimension, carrying.public_note_otherwise);
  assert.doesNotMatch(notes.dimension ?? "", /mild hybrid line|the note below/);
  assert.equal(notes.coverage, undefined);
  assert.match(notes.withheld ?? "", /shown undivided/);
  // The internal page reads its own note, which says the same thing about the dataset.
  const internal = notesUnder(withheld, true);
  assert.equal(internal.dimension, carrying.note_otherwise);
  assert.match(internal.dimension ?? "", /does not divide its hybrids/);
});

test("with the split published, or no flag in the manifest, the note and the coverage note are as before", () => {
  for (const block of [coverage({ mild_split_published: true, publish_split_at_trailing_high_confidence_coverage: 0.7 }), coverage(), undefined]) {
    const notes = notesUnder(block);
    assert.equal(notes.dimension, carrying.public_note);
    assert.equal(notes.withheld, undefined);
    if (block) assert.match(notes.coverage ?? "", /at least 84\.1%/);
  }
  assert.equal(notesUnder(coverage()).dimension, carrying.public_note);
  assert.equal(notesUnder(coverage(), true).dimension, carrying.note);
});

test("a dimension with no condition reads its notes as it always did, and a condition that does not hold with no alternative gives no note", () => {
  const plain = { note: "internal", note_template: "t {x}", public_note: "public" };
  assert.deepEqual(dimensionNote(plain, false, { splitPublished: false }), { plain: "public" });
  assert.deepEqual(dimensionNote({ note: "internal", note_template: "t {x}" }, true, { splitPublished: false }), { plain: "internal", template: "t {x}" });
  assert.deepEqual(dimensionNote({ ...plain, note_condition: "split_published" }, false, { splitPublished: false }), { plain: undefined });
  assert.deepEqual(dimensionNote({ ...plain, note_condition: "split_published" }, true, { splitPublished: false }), { plain: undefined });
  assert.deepEqual(dimensionNote({ ...plain, note_condition: "split_published" }, false, { splitPublished: true }), { plain: "public" });
  assert.deepEqual(dimensionNote(undefined, false, { splitPublished: true }), {});
});

test("the panel reads the note through it, with no dimension named", () => {
  const panel = read("src/components/PresetPanel.tsx");
  assert.ok(panel.includes("dimensionNote(dimension, internal, { splitPublished: splitPublished(coverage) })"));
  assert.ok(!read("src/lib/dimensionNote.ts").replace(/\/\/.*$/gm, "").includes("powertrain"));
});
