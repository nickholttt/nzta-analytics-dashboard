// A narrow fact table (D-144) is read from files of its own, under the table the manifest names, and never lined up with the wide table's columns: every cache
// key carries the table (src/lib/data.ts). Through the real loader over a small synthetic cube (tests/site/fixtures/narrow-cube: a dataset with a wide table of
// four rows and a narrow one of three, which share a field and differ in rows and counts, with made-up names). The staged cube is read in
// tests/site/narrow-staged.test.ts.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fixture = new URL("./fixtures/narrow-cube/", import.meta.url);
// The stand-in serves the synthetic cube, with the dataset "again" standing for "ds" so the same files can be read under a second cache key.
const root = fixture;
const asked: string[] = [];
globalThis.fetch = (async (url: string) => {
  asked.push(String(url));
  try {
    const path = String(url).replace(/^\/data\//, "").replace("/again/", "/ds/");
    const bytes = readFileSync(new URL(path, root));
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), json: async () => JSON.parse(bytes.toString("utf8")) };
  } catch {
    return { ok: false, status: 404 };
  }
}) as never;

const data = await import("../../src/lib/data.ts");
type Row = import("../../src/lib/data.ts").SliceRow;
const cells = (rows: Row[]) => rows.map((r) => `${r.month} ${r.value} ${r.n}/${r.denominator}`);

test("the table that holds every field is the wide one first, then the first narrow one that does, else none", () => {
  const facts = { rows: 4, dimensions: ["a", "b"], not_live: {}, narrow: { side: { rows: 3, dimensions: ["a", "c"], not_live: {} }, other: { rows: 2, dimensions: ["c", "d"], not_live: { d: "not live" } } } };
  assert.deepEqual(data.factTableFor(facts, []), {});
  assert.deepEqual(data.factTableFor(facts, ["a", "b"]), {}, "the wide table, though a narrow one holds a");
  assert.deepEqual(data.factTableFor(facts, ["a", "c"]), { table: "side" });
  assert.deepEqual(data.factTableFor(facts, ["c"]), { table: "side" }, "the first in the manifest's order");
  assert.equal(data.factTableFor(facts, ["b", "c"]), null, "no one table holds both");
  assert.equal(data.factTableFor(facts, ["c", "d"]), null, "a field the table left out is not held");
  assert.equal(data.factTableFor(facts, ["z"]), null);
  assert.equal(data.factTableFor(undefined, []), null);
  assert.equal(data.factTableFor({ rows: 1, dimensions: ["a"], not_live: {} }, ["c"]), null, "a manifest with no narrow table");
  assert.deepEqual(data.factTables(facts), [["a", "b"], ["a", "c"], ["c"]]);
});

test("a question that names a narrow table is read from that table's files, and the wide one's are not touched", async () => {
  asked.length = 0;
  const rows = await data.loadView({ dataset: "ds", dimension: "a", facts: { where: {}, table: "side" } });
  assert.deepEqual(cells(rows), ["2026-09 x 10/10", "2026-10 x 20/50", "2026-10 y 30/50"]);
  assert.ok(asked.length > 0);
  for (const url of asked) assert.match(url, /^\/data\/facts\/ds\/narrow\/side\//, url);
  assert.deepEqual([...new Set(asked)].sort(), ["/data/facts/ds/narrow/side/a.parquet", "/data/facts/ds/narrow/side/month.parquet", "/data/facts/ds/narrow/side/n.parquet"]);
});

test("the wide and the narrow table of one dataset keep their own month and count columns, whichever is read first", async () => {
  // The narrow table first, under a name no other test has read, then the wide one: a cache keyed by dataset and column alone would answer the wide
  // question with the narrow table's three-row month column.
  asked.length = 0;
  const narrow = await data.loadView({ dataset: "again", dimension: "a", facts: { where: { c: ["p"] }, table: "side" } });
  const wide = await data.loadView({ dataset: "again", dimension: "a", facts: { where: { b: ["u"] } } });
  assert.deepEqual(cells(narrow), ["2026-09 x 10/10", "2026-10 x 20/20"]);
  assert.deepEqual(cells(wide), ["2026-09 x 1/3", "2026-09 y 2/3"], "kept to b = u: the wide table's two rows of the first month");
  assert.ok(asked.includes("/data/facts/again/month.parquet") && asked.includes("/data/facts/again/narrow/side/month.parquet"), asked.join(", "));
  // And the other way round, on the dataset that has been read both ways already: each answer is the same as before, from the cache.
  assert.deepEqual(cells(await data.loadView({ dataset: "again", dimension: "a", facts: { where: { b: ["u"] } } })), cells(wide));
  assert.deepEqual(cells(await data.loadView({ dataset: "again", dimension: "a", facts: { where: { c: ["p"] }, table: "side" } })), cells(narrow));
  const before = asked.length;
  await data.loadView({ dataset: "again", dimension: null, facts: { where: {} } });
  await data.loadView({ dataset: "again", dimension: null, facts: { where: {}, table: "side" } });
  assert.equal(asked.length, before, "every column is cached, each under its own table");
});

test("a grid, the first month and a value list of a narrow table are read from it", async () => {
  const grid = await data.loadView({ dataset: "ds", dimension: "a", facts: { where: {}, table: "side" }, cross: { dimension: "c", grid: true } });
  assert.deepEqual(grid.map((r) => `${r.month} ${r.value}/${r.other} ${r.n}`), ["2026-09 x/p 10", "2026-10 x/p 20", "2026-10 y/q 30"]);
  assert.equal(await data.loadFirstMonth({ dataset: "ds", dimension: "a", facts: { where: {}, table: "side" } }, []), "2026-09");
  assert.deepEqual([...(await data.fieldValues("ds", "c", true, undefined, ["a"]))].sort(), ["p", "q"], "the picker's values: the table that holds the field and the condition's field");
  assert.deepEqual([...(await data.fieldValues("ds", "b", true, undefined, ["a"]))].sort(), ["u", "v"], "and the wide table where it holds both");
  await assert.rejects(() => data.fieldValues("ds", "c", true, undefined, ["b"]), /no fact table of ds holds c, b together/);
});

test("only an id of the shape the cube writes is turned into a path", async () => {
  for (const bad of ["../x", "side/..", "Side", "", "a b"]) await assert.rejects(() => data.loadView({ dataset: "ds", dimension: "a", facts: { where: {}, table: bad } }), /not a fact table id/, bad);
});
