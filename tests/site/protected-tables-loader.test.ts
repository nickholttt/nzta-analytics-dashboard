// A table the manifest says was written under the small-cell rule is read with its hidden cells hidden (src/lib/data.ts, D-139): a hidden count is flagged and has
// no number (NaN, never 0), a period that is not broken down is one row that is no value, and a grid carries the published total of each of its lines. A table that
// holds a NULL but is not listed is still refused (D-130). Through the real loader over a small synthetic cube with made-up values
// (tests/site/fixtures/protected-cube), served in place of the network.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("./fixtures/protected-cube/", import.meta.url);
globalThis.fetch = (async (url: string) => {
  try {
    const path = String(url).replace(/^\/data\//, "");
    const bytes = readFileSync(new URL(path, root));
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      json: async () => JSON.parse(bytes.toString("utf8")),
    };
  } catch {
    return { ok: false, status: 404 };
  }
}) as never;

const { builderSpec } = await import("../../src/lib/config.ts");
const { ServiceError, loadSlice, loadView, ruleMinimum, smallCellPairs } = await import("../../src/lib/data.ts");
const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8"));

const D = "stock";
const refused = (e: unknown) => e instanceof ServiceError && e.down === false && e.message === builderSpec.notices.small_cells_hidden;

test("the manifest's own entry is what says a table was written under the rule", () => {
  assert.deepEqual(smallCellPairs(manifest, D), ["usage__kind", "unbroken__kind"]);
  assert.equal(ruleMinimum(manifest, D, "small_cells", "usage"), 10);
  assert.equal(ruleMinimum(manifest, D, "small_cell_pairs", "usage__kind"), 10);
  assert.equal(ruleMinimum(manifest, D, "small_cells", "loose"), undefined, "a table that is not listed");
  assert.equal(ruleMinimum(manifest, D, "small_cells", "kind"), undefined);
  assert.equal(ruleMinimum(undefined, D, "small_cells", "usage"), undefined, "no manifest says nothing");
  const bare = { ...manifest, datasets: { [D]: { ...manifest.datasets[D], small_cells: { usage: {}, kind: "x", loose: { minimum: 0 } } } } };
  assert.equal(ruleMinimum(bare, D, "small_cells", "usage"), undefined, "an entry that states no minimum says no rule was applied");
  assert.equal(ruleMinimum(bare, D, "small_cells", "kind"), undefined);
  assert.equal(ruleMinimum(bare, D, "small_cells", "loose"), undefined);
});

test("a listed slice is read with its hidden values flagged and without a count, never as zero", async () => {
  const rows = await loadSlice(D, "usage");
  assert.equal(rows.length, 4);
  const hidden = rows.filter((r) => r.hidden);
  assert.deepEqual(hidden.map((r) => r.value).sort(), ["delta", "gamma"]);
  for (const r of hidden) {
    assert.ok(Number.isNaN(r.n), `${r.value} has no number`);
    assert.notEqual(r.n, 0);
    assert.equal(r.denominator, 920, "the period's total is still published");
  }
  assert.deepEqual(
    rows.filter((r) => !r.hidden).map((r) => [r.value, r.n]),
    [["alpha", 600], ["beta", 300]],
  );
  assert.deepEqual(await loadView({ dataset: D, dimension: "usage" }), rows, "through the view the charts use");
});

test("a listed slice that is not broken down is one row that stands for the period, not a value", async () => {
  const rows = await loadSlice(D, "unbroken");
  assert.deepEqual(rows, [{ month: "2026-10", value: "__NOT_BROKEN_DOWN__", n: 920, denominator: 920, notBrokenDown: true }]);
});

test("a table that holds a NULL and is not listed is still refused, a slice and a pair alike", async () => {
  await assert.rejects(() => loadSlice(D, "loose"), refused);
  await assert.rejects(() => loadView({ dataset: D, dimension: "usage", filter: { pair: "loose__kind", side: "a", dimension: "kind", values: ["x"] } }), refused);
  await assert.rejects(() => loadView({ dataset: D, dimension: "loose", cross: { dimension: "kind", pair: { pair: "loose__kind", side: "a" }, grid: true } }), refused, "even as a grid");
});

test("a listed pair is refused for any use but the grid: it is never summed or narrowed with a hidden cell as zero", async () => {
  await assert.rejects(() => loadView({ dataset: D, dimension: "usage", filter: { pair: "usage__kind", side: "a", dimension: "kind", values: ["x"] } }), refused);
  await assert.rejects(() => loadView({ dataset: D, dimension: "usage", cross: { dimension: "kind", pair: { pair: "usage__kind", side: "a" } } }), refused);
});

test("the grid of a listed pair: every cell is a row, hidden cells are flagged, and each carries the published total of its row and of its column", async () => {
  const rows = await loadView({ dataset: D, dimension: "usage", cross: { dimension: "kind", pair: { pair: "usage__kind", side: "a" }, grid: true } });
  assert.equal(rows.length, 8);
  const at = (value: string, other: string) => rows.find((r) => r.value === value && r.other === other)!;
  assert.equal(at("alpha", "x").n, 500);
  assert.deepEqual(at("alpha", "x").lineTotals, { row: 600, column: 710 });
  assert.deepEqual(at("beta", "y").lineTotals, { row: 300, column: 210 });
  for (const [value, other] of [["gamma", "x"], ["gamma", "y"], ["delta", "x"], ["delta", "y"]]) {
    const cell = at(value, other);
    assert.equal(cell.hidden, true);
    assert.ok(Number.isNaN(cell.n) && cell.n !== 0);
    assert.equal(cell.lineTotals?.row, null, "a value hidden in its slice has no published total");
    assert.equal(cell.denominator, 920);
  }
  assert.equal(at("gamma", "x").lineTotals?.column, 710, "its column total is published");
});

test("the grid read with the other field down the side swaps the sides and their totals", async () => {
  const rows = await loadView({ dataset: D, dimension: "kind", cross: { dimension: "usage", pair: { pair: "usage__kind", side: "b" }, grid: true } });
  const cell = rows.find((r) => r.value === "x" && r.other === "alpha")!;
  assert.equal(cell.n, 500);
  assert.deepEqual(cell.lineTotals, { row: 710, column: 600 });
});

test("a pair that is not broken down is one row for the period, and says so", async () => {
  const rows = await loadView({ dataset: D, dimension: "unbroken", cross: { dimension: "kind", pair: { pair: "unbroken__kind", side: "a" }, grid: true } });
  assert.deepEqual(rows, [{ month: "2026-10", value: "__NOT_BROKEN_DOWN__", other: "__NOT_BROKEN_DOWN__", n: 920, denominator: 920, notBrokenDown: true }]);
});
