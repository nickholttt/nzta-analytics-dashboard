// A slice that hides small counts is refused whole by the loader (src/lib/data.ts, D-130): a hidden cell has no count (a NULL, which is not a zero),
// and a month that is not broken down is one row that is no value of the field. Through the real loader over three small slices written for this
// test (tests/site/fixtures/hidden-cube) served in place of the network. No field is named: the files carry made-up values.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("./fixtures/hidden-cube/", import.meta.url);
const asked: string[] = [];
globalThis.fetch = (async (url: string) => {
  asked.push(url);
  try {
    // A kept snapshot's folder holds the same files as the newest's (D-131), so one fixture serves both.
    const bytes = readFileSync(new URL(String(url).replace(/^\/data\/(snapshots\/\d{4}-\d{2}\/)?/, ""), root));
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  } catch {
    return { ok: false, status: 404 };
  }
}) as never;

const { builderSpec } = await import("../../src/lib/config.ts");
const { ServiceError, loadSlice, loadView } = await import("../../src/lib/data.ts");
const { NOT_BROKEN_DOWN_TOKEN, fillTemplate } = await import("../../src/lib/sentences.ts");

const DATASET = "registrations_surviving";
const sentence = builderSpec.notices.small_cells_hidden;
const refused = (e: unknown) => e instanceof ServiceError && e.down === false && e.message === sentence;

test("the sentence for a refused table is in config, is plain, and says neither that a count is zero nor to reload", () => {
  assert.ok(sentence.length > 0);
  assert.deepEqual(fillTemplate(sentence, {}).unresolved, [], "it needs nothing filled in");
  assert.equal(fillTemplate(sentence, {}).text, sentence);
  assert.doesNotMatch(sentence, /reload|zero|\b0\b/i);
  assert.match(sentence, /small counts/i);
});

test("an ordinary slice loads as it always did: one row for each cell, the count as a number", async () => {
  const rows = await loadSlice(DATASET, "ordinary");
  assert.deepEqual(rows, [
    { month: "2026-09", value: "north", n: 12, denominator: 30 },
    { month: "2026-09", value: "south", n: 18, denominator: 30 },
    { month: "2026-10", value: "north", n: 15, denominator: 40 },
    { month: "2026-10", value: "south", n: 25, denominator: 40 },
  ]);
  assert.deepEqual(await loadView({ dataset: DATASET, dimension: "ordinary" }), rows, "through the view the charts use");
});

test("a slice with one hidden cell is refused with the sentence in config; its NULL is not read as a count of zero", async () => {
  await assert.rejects(() => loadSlice(DATASET, "hidden_cell"), refused);
  await assert.rejects(() => loadView({ dataset: DATASET, dimension: "hidden_cell" }), refused, "and so is a view of it");
});

test("a slice with a month that is not broken down is refused: its one row is not a value of the field", async () => {
  await assert.rejects(() => loadSlice(DATASET, "not_broken_down"), refused);
});

test("a refused slice is not kept: asked again, the file is read again and refused again", async () => {
  asked.length = 0;
  await assert.rejects(() => loadSlice(DATASET, "hidden_cell"), refused);
  await assert.rejects(() => loadSlice(DATASET, "hidden_cell"), refused);
  // The manifest is asked too, to see whether the table is one written under the rule (D-139); this folder has none, so it is not.
  assert.equal(asked.filter((url) => url.endsWith(".parquet")).length, 2);
});

test("a kept snapshot's slice that hides cells is refused too: the pinned reading goes through the same loader", async () => {
  await assert.rejects(() => loadSlice(DATASET, "hidden_cell", "2026-06"), refused);
  await assert.rejects(() => loadSlice(DATASET, "not_broken_down", "2026-06"), refused);
  assert.ok(asked.includes("/data/snapshots/2026-06/cube/registrations_surviving/hidden_cell.parquet"));
  assert.equal((await loadSlice(DATASET, "ordinary", "2026-06")).length, 4, "an ordinary kept slice still loads");
});

// The pipeline writes this value (docs/CUBE_SCHEMA.md, D-127); the site must spell it the same way. This reads pipeline/contract.py and cannot pass without
// comparing: it fails when it finds no assignment of the reserved value (a rename or a change to the file's shape would otherwise silence it), when it
// finds more than one, and when the value differs from the site's. The pattern allows a type annotation and either quote style.
test("pipeline/contract.py assigns the not-broken-down value exactly once, and it equals the site's constant", () => {
  assert.equal(NOT_BROKEN_DOWN_TOKEN, "__NOT_BROKEN_DOWN__");
  const contract = new URL("../../pipeline/contract.py", import.meta.url);
  assert.ok(existsSync(contract), "pipeline/contract.py is where the reserved values are defined");
  const assignment = /^NOT_BROKEN_DOWN\s*(?::[^=\n]+)?=\s*(["'])(.*?)\1\s*(?:#.*)?$/gm;
  const found = [...readFileSync(contract, "utf8").matchAll(assignment)];
  assert.equal(found.length, 1, "pipeline/contract.py has exactly one assignment of NOT_BROKEN_DOWN");
  assert.equal(found[0][2], NOT_BROKEN_DOWN_TOKEN, "the pipeline's value is the site's");
});
