// A question over a dimension that the manifest lists under small_cells is blocked before it loads, and says why (src/lib/resolve.ts, D-130): as the
// breakdown, as a second breakdown, as a crossing and as a condition. A manifest that lists none blocks nothing. Through the real resolver over a
// build in which every field is live; the field is any one config defines, never named here.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { everythingBuilt } from "./support/observe.ts";

const config = await import("../../src/lib/config.ts");
const { SMALL_CELL_KEY, smallCellDimensions } = await import("../../src/lib/data.ts");
const { resolvePreset } = await import("../../src/lib/resolve.ts");
const { SMALL_CELL_KEY: keptKey, holds, blockedIn } = await import("../../src/lib/kept.ts");
const { builderPresets } = await import("../../src/lib/builder.ts");
type Manifest = import("../../src/lib/data.ts").Manifest;
type Preset = import("../../src/lib/config.ts").Preset;

const built = everythingBuilt();
const withBlock = (block: unknown, from: Manifest = built): Manifest =>
  ({ ...from, datasets: Object.fromEntries(Object.entries(from.datasets).map(([id, d]) => [id, block === undefined ? d : { ...d, [SMALL_CELL_KEY]: block }])) }) as unknown as Manifest;
const hiddenReason = (preset: Preset, manifest: Manifest) => resolvePreset(preset, manifest).blocked.filter((b) => /small counts hidden/.test(b));

// A preset the build can draw as it stands, and two fields of the same dataset to put in the other places a question names a field.
const base = config.presets.find((p) => p.dimension && p.dataset && !p.derived && !p.series && resolvePreset(p, built).preventsRender.length === 0) as Preset;
const [first, second, third] = config.dimensions.map((d) => d.id).filter((d) => d !== base?.dimension);

test("the build and the preset these tests start from can be drawn", () => {
  assert.ok(base && first && second && third);
  assert.equal(resolvePreset(base, built).preventsRender.length, 0);
  assert.deepEqual(hiddenReason(base, built), []);
});

test("the dimensions a manifest lists are read from its block, and from nothing else", () => {
  const dataset = base.dataset as string;
  assert.equal(SMALL_CELL_KEY, "small_cells");
  assert.equal(keptKey, SMALL_CELL_KEY, "the kept-snapshot reader names the same key");
  assert.deepEqual(smallCellDimensions(withBlock({ [first]: { minimum: 10 }, [second]: { minimum: 10 } }), dataset), [first, second]);
  for (const none of [undefined, {}, null, [], [first], "x", 3, true]) assert.deepEqual(smallCellDimensions(withBlock(none), dataset), [], JSON.stringify(none));
  assert.deepEqual(smallCellDimensions(withBlock({ [first]: {} }), undefined), [], "no dataset");
  assert.deepEqual(smallCellDimensions(withBlock({ [first]: {} }), "not_a_dataset"), [], "a dataset the manifest lacks");
});

test("a preset broken down by a listed dimension is blocked before it loads, with a reason; one broken down by another is not", () => {
  const listed = withBlock({ [base.dimension as string]: { minimum: 10 } });
  const r = resolvePreset(base, listed);
  assert.equal(r.status, "blocked");
  assert.ok(r.preventsRender.length > 0);
  assert.equal(r.source, undefined, "nothing is read");
  assert.deepEqual(hiddenReason(base, listed), [`dimension "${base.dimension}" has small counts hidden in ${base.dataset}, and this site does not draw a table like that yet`]);
  assert.ok(r.statusDisagreement, "the internal status page reports the authored status as out of date");
  assert.deepEqual(hiddenReason(base, withBlock({ [first]: { minimum: 10 } })), [], "another field being listed blocks nothing");
});

test("a second breakdown, a crossing and a condition on a listed dimension are each blocked", () => {
  const listed = withBlock({ [second]: { minimum: 10 } });
  assert.equal(hiddenReason({ ...base, dimension2: second }, listed).length, 1, "second breakdown");
  assert.equal(hiddenReason({ ...base, cross: second }, listed).length, 1, "crossing");
  assert.equal(hiddenReason({ ...base, where: { [second]: ["x"] } }, listed).length, 1, "condition");
  assert.equal(hiddenReason({ ...base, filters: [{ [second]: "x" }] }, listed).length, 1, "a preset's own filter");
  assert.equal(hiddenReason({ ...base, where: { [second]: [] } }, listed).length, 0, "a condition with no value is not applied, so it names nothing");
  assert.equal(hiddenReason({ ...base, dimension2: second, where: { [second]: ["x"] } }, listed).length, 1, "named twice, said once");
  assert.equal(hiddenReason({ ...base, dimension2: second }, withBlock({ [third]: { minimum: 10 } })).length, 0);
});

test("a manifest that lists none blocks nothing: the same verdict as one with no block at all", () => {
  for (const preset of [base, { ...base, dimension2: second }, { ...base, where: { [second]: ["x"] } }]) {
    assert.deepEqual(resolvePreset(preset, withBlock({})), resolvePreset(preset, built));
  }
});

test("a kept snapshot whose manifest lists a dimension cannot answer a question over it, whether or not it says the rule was applied", () => {
  const question = { dataset: base.dataset as string, measure: "count", by: base.dimension as string, values: [], where: {}, view: null };
  assert.ok(builderPresets(question).length > 0);
  assert.equal(blockedIn(question, built), false);
  const listed = withBlock({ [base.dimension as string]: { minimum: 10 } });
  assert.equal(blockedIn(question, listed), true);
  assert.equal(holds(question, listed, new Set([base.dimension as string])), "no");
});
