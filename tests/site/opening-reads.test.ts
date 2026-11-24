// The files the canvas as it opens asks for before its script has run (src/lib/openingReads.ts): the events file, and the one slice its first chart
// reads, at the path the loader (src/lib/data.ts) fetches. Run with Node's own test runner:
//   node --test "tests/site/opening-reads.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { everythingBuilt } from "./support/observe.ts";

const builder = await import("../../src/lib/builder.ts");
const canvas = await import("../../src/lib/canvas.ts");
const resolve = await import("../../src/lib/resolve.ts");
const { openingReads } = await import("../../src/lib/openingReads.ts");

const manifest = everythingBuilt() as unknown as import("../../src/lib/data.ts").Manifest;
const all = canvas.canvasVocabulary(builder.builderVocabulary(manifest));

test("the canvas as it opens asks for the events and for the one slice its first chart reads", () => {
  const [chart] = canvas.settleCanvas(all, []).charts;
  const source = resolve.resolvePreset(canvas.chartPreset(chart)!, manifest).source!;
  assert.ok(!source.filter && !source.facts && !source.cross, "the chart it opens on is one slice of the cube");
  assert.deepEqual(openingReads(all, manifest), ["/data/events.json", `/data/cube/${source.dataset}/${source.dimension}.parquet`]);
});

test("a build with no chart to open on asks for the events only", () => {
  assert.deepEqual(openingReads(all, { ...manifest, datasets: {} } as unknown as import("../../src/lib/data.ts").Manifest), ["/data/events.json"]);
});
