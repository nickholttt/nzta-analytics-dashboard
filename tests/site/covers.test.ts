// What the panel hands the charts as the months the dataset covers (src/lib/resolve.ts, datasetCovers): the dataset's own first and last
// month, never those of the rows a narrowed view happens to have. On fixture manifests, through the real function and the real presets.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { datasetCovers } = await import("../../src/lib/resolve.ts");
const { findPreset, findDataset } = await import("../../src/lib/config.ts");
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const live = { live_dimensions: [], live_pairs: [], facts: null };
const manifest = {
  generated_at: "2026-11-17T00:00:00Z",
  latest_snapshot: "2026-10-31",
  warnings: [],
  datasets: {
    registrations_surviving: { ...live },
    registrations_flow: { ...live, latest_month: "2026-10", supplied: { source: "x", months: { first: "2021-01", last: "2026-10", count: 70 }, taken: [], replaced: [] } },
    registrations_cars_long_run: { ...live, latest_month: "2026-09", supplied: { source: "y", months: { first: "1961-01", last: "2026-09", count: 789 }, taken: [], replaced: [] } },
  },
} as unknown as import("../../src/lib/data.ts").Manifest;

const preset = (id: string) => findPreset(id) as NonNullable<ReturnType<typeof findPreset>>;

test("an all-time register view covers the register's first month with vehicles, as the page loaded it, to the snapshot's month", () => {
  const owner = preset("brand-owner-origin");
  assert.equal(owner.period, "all");
  assert.equal(owner.dataset, "registrations_surviving");
  assert.deepEqual(datasetCovers(owner, manifest, "1912-01"), { first: "1912-01", last: "2026-10" });
});

test("a supplied dataset covers its file's months, whatever its rows hold; one that ends early ends there", () => {
  assert.deepEqual(datasetCovers(preset("registrations-powertrain-mix"), manifest, "2021-07"), { first: "2021-01", last: "2026-10" });
  assert.deepEqual(datasetCovers(preset("cars-registered-monthly"), manifest, "1975-07"), { first: "1961-01", last: "2026-09" });
});

test("a dataset defined as another one filtered covers that one's months", () => {
  const filtered = findDataset("used_imports");
  assert.ok(filtered?.base, "a dataset served from another");
  const view = preset("used-import-age");
  assert.equal(view.dataset, "used_imports");
  assert.deepEqual(datasetCovers(view, manifest, "1913-05"), { first: "1913-05", last: "2026-10" });
});

test("with no first month known nothing is inside the dataset, and the panel hands the charts that rather than a guess", () => {
  const { first, last } = datasetCovers(preset("brand-owner-origin"), manifest, undefined);
  assert.ok(first > last);
});

test("the panel takes it from this function, once until its inputs change, and hands the same object to every chart that sums a window", () => {
  const panel = read("src/components/PresetPanel.tsx");
  assert.ok(panel.includes("useMemo(() => (effectivePreset && manifest ? datasetCovers(effectivePreset, manifest, firstMonth) : undefined), [effectivePreset, manifest, firstMonth])"));
  assert.equal(panel.split("covers={covers}").length - 1, 2, "the share chart and the trend chart");
  assert.ok(panel.includes("compositionStart(rows, dimension, guard, covers)"));
  assert.ok(!panel.includes("datasetFirstMonth"), "the panel builds no object of its own");
});
