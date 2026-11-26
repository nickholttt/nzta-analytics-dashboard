// The list of values a picker offers, and the starting values a count chart looks for, are counted among the conditions from the one fact table that holds the
// field and every condition's field (src/lib/valueOptions.ts): a field kept to a value of a field only a narrow table holds is read from that table, not from a
// file the wide table does not have. Through the real reader over the synthetic cube (tests/site/fixtures/narrow-cube: a wide table of a and b, a narrow table
// of a and c, made-up names and counts).
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("./fixtures/narrow-cube/", import.meta.url);
const asked: string[] = [];
globalThis.fetch = (async (url: string) => {
  asked.push(String(url));
  try {
    const bytes = readFileSync(new URL(String(url).replace(/^\/data\//, ""), root));
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), json: async () => JSON.parse(bytes.toString("utf8")) };
  } catch {
    return { ok: false, status: 404 };
  }
}) as never;

const { valueOptions, startingValues } = await import("../../src/lib/valueOptions.ts");

test("a field kept to a value of a field only the narrow table holds is counted from the narrow table", async () => {
  asked.length = 0;
  const options = await valueOptions("ds", "a", { c: ["p"] });
  // The narrow table's rows kept to c = p: x has 10 + 20 and y has none; the wide table has no column c at all.
  assert.deepEqual(options, [{ value: "x", recent: 30, total: 30 }]);
  assert.ok(asked.every((u) => u.startsWith("/data/facts/ds/narrow/side/") || u.endsWith("manifest.json")), asked.join(", "));
  assert.deepEqual(startingValues(options), ["x"]);
});

test("a field kept to a value of a field the wide table holds is counted from the wide table, and with no condition from the slice's own file", async () => {
  asked.length = 0;
  assert.deepEqual(await valueOptions("ds", "a", { b: ["u"] }), [
    { value: "y", recent: 2, total: 2 },
    { value: "x", recent: 1, total: 1 },
  ]);
  assert.ok(asked.some((u) => u === "/data/facts/ds/b.parquet") && !asked.some((u) => u.includes("/narrow/")), asked.join(", "));
});

test("a field and a condition no one table holds together are an error, never read from a table that lacks one", async () => {
  await assert.rejects(() => valueOptions("ds", "b", { c: ["p"] }), /no fact table of ds holds b, c together/);
});
