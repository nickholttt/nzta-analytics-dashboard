// The lines above the table of a downloaded file (src/lib/figuresHeader.ts, D-111): each file credits the datasets it holds and no other, and
// a chart that divides one dataset by another credits both. Through the real config and a stub of the build's manifest; the presets are the
// canon's, read from config, and no organisation or dataset is named here.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const config = await import("../../src/lib/config.ts");
const { datasetAttribution, datasetsOf, figuresHeader } = await import("../../src/lib/figuresHeader.ts");
const { figuresCsv } = await import("../../src/lib/figures.ts");

const SERIES_ATTRIBUTION = "This work includes data of a series body, licensed for reuse.";
const supplied = (first: string, attribution?: string) => ({ source: "x", months: { first, last: "2026-10", count: 70 }, taken: ["2026-11-01", "2026-11-14"], replaced: [], ...(attribution ? { attribution } : {}) });
// A build that holds every dataset the canon draws on, the supplied ones with the months and dates a supplied dataset carries.
const manifest = {
  generated_at: "2026-11-17T00:00:00Z",
  latest_snapshot: "2026-10-31",
  warnings: [],
  datasets: Object.fromEntries(
    config.datasets.map((d) => [
      d.id,
      d.grain === "flow" ? { live_dimensions: [], supplied: supplied("2021-01", d.id.includes("long_run") ? SERIES_ATTRIBUTION : undefined) } : { live_dimensions: [] },
    ]),
  ),
} as never;

const preset = (id: string) => config.presets.find((p) => p.id === id) as import("../../src/lib/config.ts").Preset;
const header = (id: string) => figuresHeader({ preset: preset(id), manifest, counted: "What is counted.", address: "https://example.test/#x" });
const raw = (dataset: string) => config.findDataset(dataset)?.attribution as string;

// Three kinds of dataset the canon holds, by the grain config gives them, and a chart that divides one by another.
const register = config.presets.find((p) => p.dataset && config.findDataset(p.dataset)?.grain === "survivors" && !p.derived) as { id: string; dataset: string };
const trueRegistrations = config.presets.find((p) => p.dataset && config.findDataset(p.dataset)?.source_note && !config.findDataset(p.dataset)?.source_note?.includes("attribution") && !p.derived) as { id: string; dataset: string };
const longRun = config.presets.find((p) => p.dataset && config.findDataset(p.dataset)?.source_note?.includes("{dataset.supplied.attribution}") && !p.derived) as { id: string; dataset: string };
const ratio = config.presets.find((p) => {
  const d = config.findDerived(p.derived);
  return d?.numerator_dataset && d.denominator_dataset;
}) as { id: string; dataset: string; derived: string };

test("a register chart credits the register and nothing else", () => {
  assert.ok(register);
  const h = header(register.id);
  assert.deepEqual(h.attributions, [raw(register.dataset)]);
  assert.deepEqual(h.sources, [], "the register has no export to date");
  assert.equal(h.datasets.length, 1);
  assert.equal(h.snapshot, "2026-10-31");
  assert.equal(h.address, "https://example.test/#x");
});

test("a chart of true registrations credits that dataset's own statement and says which export it is", () => {
  assert.ok(trueRegistrations);
  const h = header(trueRegistrations.id);
  assert.deepEqual(h.attributions, [raw(trueRegistrations.dataset)]);
  assert.notEqual(raw(trueRegistrations.dataset), raw(register.dataset), "not the register's statement");
  assert.equal(h.sources.length, 1);
  assert.match(h.sources[0], /14 November 2026/, "the date of the newest export, from the build");
  assert.match(h.datasets[0], /from Jan 2021/, "and where the dataset starts");
});

test("a chart of a series another body publishes carries that body's statement from the build, and nothing of the register's or the dashboard's", () => {
  assert.ok(longRun);
  const h = header(longRun.id);
  assert.equal(h.attributions.length, 1);
  assert.ok(h.attributions[0].includes(SERIES_ATTRIBUTION), "the licence statement the supplied store carries");
  for (const other of [raw(register.dataset), raw(trueRegistrations.dataset)]) assert.ok(!h.attributions.join(" ").includes(other), "no other dataset's statement");
  const text = figuresCsv(h, { period: "x", columns: [{ name: "Month" }], rows: [["a"]] }, config.phrases);
  assert.ok(!text.includes(raw(register.dataset)) && !text.includes(raw(trueRegistrations.dataset)));
});

test("a chart that divides one dataset by another credits both, once each, and names both", () => {
  assert.ok(ratio);
  const d = config.findDerived(ratio.derived);
  const h = header(ratio.id);
  const both = [d?.numerator_dataset, d?.denominator_dataset] as string[];
  assert.deepEqual(datasetsOf(preset(ratio.id)).sort(), [...new Set([ratio.dataset, ...both])].sort());
  assert.equal(h.datasets.length, 2);
  for (const id of both) assert.ok(h.attributions.includes(datasetAttribution(id, manifest, preset(ratio.id)) as string), id);
  assert.equal(h.attributions.length, 2);
  const text = figuresCsv(h, { period: "x", columns: [{ name: "Month" }], rows: [["a"]] }, config.phrases);
  assert.equal(text.split("\r\n").filter((l) => l.startsWith("# Attribution: ")).length, 2);
  assert.ok(text.includes("# Datasets: "));
});

test("every dataset a chart in the canon or the builder draws on has a statement of its own, so no file is without one or credits another's", () => {
  const ids = new Set([...config.presets.flatMap((p) => datasetsOf(p)), ...config.builderSpec.datasets]);
  assert.ok(ids.size >= 4);
  for (const id of ids) {
    const own = config.findDataset(id);
    assert.ok(own?.attribution || config.findDataset(own?.base)?.attribution, `${id} has an attribution in config/dimensions.json`);
    const dummy = config.presets.find((p) => p.dataset === id) ?? ({ ...register, id: "x", question: "q", status: "live" } as never);
    assert.ok(datasetAttribution(id, manifest, dummy), `${id} fills against a build`);
  }
});

test("a statement that names what the build lacks is left out, not written with a gap", () => {
  const bare = { ...(manifest as object), datasets: { ...(manifest as { datasets: object }).datasets, [longRun.dataset]: { live_dimensions: [], supplied: supplied("1961-01") } } } as never;
  assert.equal(datasetAttribution(longRun.dataset, bare, preset(longRun.id)), undefined);
});
