// A field's note under a chart is one line with a link to the whole of it (CLAUDE.md rule 4, D-137): every field Build offers that has a note has a
// line, the line names no figure or year and no causal word, a public page shows the line and links to the method page's section, and that section
// holds the whole note. Through the real config and the real note chooser.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { builderSpec, dimensions, phrases } = await import("../../src/lib/config.ts");
const { dimensionNote, fieldNoteAnchor, fullNote } = await import("../../src/lib/dimensionNote.ts");

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const rules = JSON.parse(read("config/narrative/rules.json")) as { banned_words: string[] };
const state = { splitPublished: true };

// Every breakdown Build offers on any measure, by id.
const offered = new Set(builderSpec.measures.flatMap((m) => Object.keys(m.dimensions ?? {})));
const withLine = dimensions.filter((d) => d.public_line);

test("every field Build offers that has a public note has a one-line form, except a note with a condition", () => {
  const noted = dimensions.filter((d) => offered.has(d.id) && d.public_note);
  assert.ok(noted.length >= 5, "the fields the brief names, at least, are offered and noted");
  // A note with a condition speaks of the chart it sits on (what the note below it holds, or nothing where a build lacks what it describes), so it
  // has no section on the method page to link to. Cut to a line it would leave its whole text reachable nowhere, so it has no line and a chart shows it
  // whole (the rule below holds that).
  const missing = noted.filter((d) => !d.public_line && !d.note_condition).map((d) => d.id);
  assert.deepEqual(missing, [], `fields with a public_note and no public_line: ${missing.join(", ")}`);
  assert.ok(noted.some((d) => d.note_condition), "config has a conditional note: the exemption is in use");
});

test("a note with a condition has no line, so its whole text is what a chart shows", () => {
  const conditional = dimensions.filter((d) => d.note_condition);
  assert.ok(conditional.length > 0);
  for (const d of conditional) assert.equal(d.public_line, undefined, `${d.id}: a line with no whole note to link to`);
});

test("a one-line form summarises a note: it has one, and is shorter", () => {
  assert.ok(withLine.length >= 5);
  for (const d of withLine) {
    assert.ok(d.public_note, `${d.id}: a line with no note to link to`);
    assert.ok((d.public_line as string).length < (d.public_note as string).length, `${d.id}: the line is not shorter than the note`);
  }
});

test("a one-line form names no figure and no year, and uses no causal or judgement word", () => {
  for (const d of withLine) {
    const line = d.public_line as string;
    assert.doesNotMatch(line, /\d/, `${d.id}: a digit`);
    assert.doesNotMatch(line, /[{}]/, `${d.id}: a placeholder; a line is plain words`);
    for (const word of rules.banned_words) assert.doesNotMatch(line, new RegExp(`\\b${word}\\b`, "i"), `${d.id}: "${word}"`);
  }
});

test("a public chart shows the line and links to the full note; the maintainers' status page keeps the note it had", () => {
  const plain = dimensions.find((d) => d.public_line && !d.note_condition);
  assert.ok(plain);
  const shown = dimensionNote(plain, false, state);
  assert.equal(shown.plain, plain.public_line);
  assert.equal(shown.more, true);
  assert.notEqual(shown.plain, plain.public_note);
  assert.equal(fullNote(plain), plain.public_note, "the section holds the whole note");
  assert.equal(dimensionNote(plain, true, state).plain, plain.note);
  assert.equal(dimensionNote(plain, true, state).more, undefined);
});

test("a note with a condition shows whole while it holds, its other sentence when it does not, and links to nothing", () => {
  const conditional = dimensions.find((d) => d.public_note && d.note_condition);
  assert.ok(conditional, "config has a conditional note");
  assert.equal(fullNote(conditional), undefined, "a note about the chart it sits on has no section of its own");
  const holds = dimensionNote(conditional, false, { splitPublished: true });
  assert.equal(holds.plain, conditional.public_note);
  assert.equal(holds.more, undefined);
  const not = dimensionNote(conditional, false, { splitPublished: false });
  assert.equal(not.plain, conditional.public_note_otherwise);
  assert.equal(not.more, undefined);
});

test("a field with a note and no line shows the whole note and links to nothing", () => {
  const unlined = dimensions.find((d) => d.public_note && !d.public_line);
  assert.ok(unlined, "config has a noted field Build does not offer");
  assert.deepEqual(dimensionNote(unlined, false, state), { plain: unlined.public_note });
});

test("the link and the section agree: each field with a link has its section, under the anchor the link names", () => {
  for (const d of dimensions) assert.equal(dimensionNote(d, false, state).more === true, fullNote(d) !== undefined || false, d.id);
  const panel = read("src/components/PresetPanel.tsx");
  assert.match(panel, /`\/method#\$\{fieldNoteAnchor\(dimension\.id\)\}`/);
  assert.match(panel, /<a href=\{n\.href\}>\{phrases\.field_note_link\}<\/a>/);
  const method = read("src/pages/method.astro");
  assert.match(method, /\(d\) => \(fullNote\(d\) \? \[\{ id: d\.id/);
  assert.match(method, /<h3 id=\{fieldNoteAnchor\(f\.id\)\}>/);
  assert.match(method, /<p>\{f\.note\}<\/p>/);
  assert.equal(fieldNoteAnchor("x_y"), "field-x_y");
  assert.ok(phrases.field_note_link.length > 0);
});
