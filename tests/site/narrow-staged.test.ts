// A question read from a narrow fact table gives the same figures as the wide table for every field the two share: the month totals, each field summed alone,
// and one field kept to values of another (src/lib/data.ts, D-144). Through the real loader over the staged cube (public/data), skipped where there is none.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../../public/data/", import.meta.url);
globalThis.fetch = (async (url: string) => {
  try {
    const bytes = readFileSync(new URL(String(url).replace(/^\/data\//, ""), root));
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), json: async () => JSON.parse(bytes.toString("utf8")) };
  } catch {
    return { ok: false, status: 404 };
  }
}) as never;

const data = await import("../../src/lib/data.ts");
type Row = import("../../src/lib/data.ts").SliceRow;
const cells = (rows: Row[]) => rows.map((r) => `${r.month} ${r.value} ${r.n}/${r.denominator}`);

const real = existsSync(new URL("manifest.json", root)) && Object.values(JSON.parse(readFileSync(new URL("manifest.json", root), "utf8")).datasets as Record<string, { facts?: { narrow?: object } }>).some((d) => Object.keys(d.facts?.narrow ?? {}).length > 0);
const skip = real ? false : "public/data has no narrow fact tables";

// What each table says of a field in each month, as text: the same question put to the wide table and to a narrow one must agree wherever both hold the field.
const same = async (dataset: string, field: string | null, table: string) => {
  const [wide, narrow] = [await data.factView(dataset, field, undefined, {}), await data.factView(dataset, field, undefined, {}, undefined, undefined, table)];
  assert.ok(wide.length > 0 && narrow.length > 0);
  assert.deepEqual(cells(narrow), cells(wide), `${dataset} by ${field ?? "nothing"} from ${table}`);
};

test("each narrow table of the staged cube gives the wide table's month totals and, for every field they share, its figures", { skip }, async () => {
  const manifest = await data.loadManifest();
  let tables = 0;
  for (const [dataset, entry] of Object.entries(manifest.datasets)) {
    for (const [table, narrow] of Object.entries(entry.facts?.narrow ?? {})) {
      tables++;
      await same(dataset, null, table);
      const shared = narrow.dimensions.filter((d) => entry.facts?.dimensions.includes(d));
      assert.ok(shared.length > 0, `${dataset}/${table} shares a field with the wide table`);
      for (const field of shared) await same(dataset, field, table);
    }
  }
  assert.ok(tables >= 2);
});

test("a condition read from a narrow table keeps the vehicles the wide table keeps, for the fields they share", { skip }, async () => {
  const manifest = await data.loadManifest();
  for (const [dataset, entry] of Object.entries(manifest.datasets)) {
    for (const [table, narrow] of Object.entries(entry.facts?.narrow ?? {})) {
      const [by, kept] = narrow.dimensions.filter((d) => entry.facts?.dimensions.includes(d));
      const values = [...(await data.fieldValues(dataset, kept, true))].slice(0, 2);
      const [wide, thin] = [await data.factView(dataset, by, undefined, { [kept]: values }), await data.factView(dataset, by, undefined, { [kept]: values }, undefined, undefined, table)];
      assert.ok(wide.length > 0);
      assert.deepEqual(cells(thin), cells(wide), `${dataset}/${table}: ${by} kept to ${kept}`);
    }
  }
});
