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
  assert.equal(asked.length, 2);
});

test("a kept snapshot's slice that hides cells is refused too: the pinned reading goes through the same loader", async () => {
  await assert.rejects(() => loadSlice(DATASET, "hidden_cell", "2026-06"), refused);
  await assert.rejects(() => loadSlice(DATASET, "not_broken_down", "2026-06"), refused);
  assert.ok(asked.includes("/data/snapshots/2026-06/cube/registrations_surviving/hidden_cell.parquet"));
  assert.equal((await loadSlice(DATASET, "ordinary", "2026-06")).length, 4, "an ordinary kept slice still loads");
});

// The pipeline writes this value (docs/CUBE_SCHEMA.md); the site must spell it the same way. #91 (D-127) adds it to pipeline/contract.py, which this branch
// does not have yet, so until then there is nothing to compare with and this test says so in its output instead of passing as if it had compared. Once
// contract.py carries a reserved value for the not-broken-down month, every such value it holds must equal the site's, and CI fails if it does not.
test("the not-broken-down value equals the pipeline's once pipeline/contract.py defines it (until #91 merges there is nothing to compare, and this says so)", (t) => {
  assert.equal(NOT_BROKEN_DOWN_TOKEN, "__NOT_BROKEN_DOWN__");
  const contract = new URL("../../pipeline/contract.py", import.meta.url);
  assert.ok(existsSync(contract), "pipeline/contract.py is where the reserved values are defined");
  const defined = [...readFileSync(contract, "utf8").matchAll(/^(\w+)\s*=\s*"(__\w+__)"/gm)].filter(([, name, value]) => /BROKEN|BREAKDOWN/i.test(`${name} ${value}`));
  if (defined.length === 0) return t.diagnostic("pipeline/contract.py has no not-broken-down value yet (#91, D-127): the site's spelling is not compared with the pipeline's");
  for (const [, name, value] of defined) assert.equal(value, NOT_BROKEN_DOWN_TOKEN, `pipeline/contract.py ${name}`);
});
