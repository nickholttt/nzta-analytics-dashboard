// What the canvas accepts is what the resolver can read (D-144, D-160): a live pair is read only for a plain breakdown (no values chosen, no second field) with
// exactly one condition on the other field of the pair, so it counts as a table only for a question of that shape; and a field put in the breakdown zone is
// judged with the second field the chart keeps, as the other zones are. Through the real modules and config over synthetic manifests: the dataset and the fields
// are found in config/pipeline.json, the tables are made here.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = await import("../../src/lib/config.ts");
const builder = await import("../../src/lib/builder.ts");
const canvas = await import("../../src/lib/canvas.ts");
const { resolvePreset } = await import("../../src/lib/resolve.ts");
const { PAIR_SEPARATOR } = await import("../../src/lib/data.ts");
type Manifest = import("../../src/lib/data.ts").Manifest;
type Question = import("../../src/lib/builder.ts").Question;

type Spec = { facts?: string[]; narrow_facts?: { id: string; dimensions: string[] }[] };
const datasets = (JSON.parse(readFileSync(new URL("../../config/pipeline.json", import.meta.url), "utf8")) as { datasets: Record<string, Spec> }).datasets;
const [[FIELD]] = Object.entries(config.builderSpec.starts_under);
const DATASET = Object.entries(datasets).find(([id, spec]) => config.builderSpec.datasets.includes(id) && (spec.narrow_facts ?? []).some((t) => t.dimensions.includes(FIELD)))?.[0] as string;
const live = config.dimensions.filter((d) => !d.applies_to || d.applies_to.includes(DATASET)).map((d) => d.id);
const WIDE = (datasets[DATASET].facts as string[]).filter((d) => live.includes(d));

const manifestOf = (wide: string[], narrow: Record<string, string[]>, pairs: string[][] = []): Manifest =>
  ({
    latest_snapshot: "2026-10-31",
    datasets: {
      [DATASET]: {
        months: 1,
        latest_month: "2026-10",
        live_dimensions: live,
        live_pairs: pairs.map(([a, b]) => `${a}${PAIR_SEPARATOR}${b}`),
        facts: { rows: 1, dimensions: wide, not_live: {}, narrow: Object.fromEntries(Object.entries(narrow).map(([id, dimensions]) => [id, { rows: 1, dimensions, not_live: {} }])) },
      },
    },
  }) as unknown as Manifest;
const field = (id: string) => ({ id, label: canvas.fieldLabel(id), group: "g", kind: "category", definition: "", averageable: false });
const resolved = (q: Question, manifest: Manifest) => resolvePreset(builder.builderPresets(q)[0], manifest);
const vocabularyOf = (manifest: Manifest) => builder.builderVocabulary(manifest);

// Fields that are breakdowns of the dataset and cross with one another, found in config: a, b and d cross pairwise, and c is the field config starts under a condition.
const picks = (() => {
  const share = vocabularyOf(manifestOf(WIDE, {})).datasets.find((x) => x.dataset === DATASET)!.measures.find((m) => m.id === "share")!.dimensions;
  const crossing = share.filter((x) => x.id !== FIELD && x.with.length >= 2).map((x) => x.id);
  for (const a of crossing) for (const b of crossing) for (const d of crossing) if (new Set([a, b, d]).size === 3 && builder.canCross(a, b) && builder.canCross(a, d) && builder.canCross(b, d)) return { a, b, d, c: FIELD };
  throw new Error("no three fields that cross");
})();

// ---- A pair counts only for the question it is read for ----

test("a pair of a field only the wide table holds and one only a narrow table holds is a table for a plain breakdown with one condition, and for no other question", () => {
  const { a: W, c: N, b: X } = picks;
  const manifest = manifestOf(WIDE.filter((f) => f !== N), { side: [N, X] }, [[W, N]]);
  const all = vocabularyOf(manifest);
  const plain = builder.settle(all, { dataset: DATASET, measure: "share", by: W, values: [], where: {}, view: null });
  // The condition goes in beside a plain breakdown: the pair reads it, and the resolver draws it from the pair.
  assert.equal(canvas.verdict(all, plain, "where", field(N)).ok, true);
  const kept = builder.settle(all, { ...plain, where: { [N]: ["x"] } });
  const r = resolved(kept, manifest);
  assert.deepEqual(r.preventsRender, []);
  assert.deepEqual(r.source?.filter && { pair: r.source.filter.pair }, { pair: `${W}${PAIR_SEPARATOR}${N}` });
  // With values chosen the pair is not read, and no fact table holds the two: refused, as the resolver blocks it.
  const chosen = { ...plain, values: ["x"], pageValues: false };
  const refused = canvas.verdict(all, chosen, "where", field(N));
  assert.equal(refused.ok, false, "a condition beside chosen values");
  if (!refused.ok) assert.ok(refused.reason.includes(canvas.fieldLabel(W)) && refused.reason.includes(canvas.fieldLabel(N)), refused.reason);
  assert.ok(resolved({ ...kept, values: ["x"], pageValues: false }, manifest).preventsRender.length > 0, "the resolver blocks what the verdict refuses");
  // A second condition is not one the pair reads either.
  assert.equal(canvas.verdict(all, kept, "where", field(X)).ok, false, "a second condition beside the pair's");
  assert.ok(resolved(builder.settle(all, { ...kept, where: { [N]: ["x"], [X]: ["y"] } }), manifest).preventsRender.length > 0);
  // And a second field is never read from a pair.
  assert.equal(canvas.verdict(all, kept, "by2", field(X)).ok, false);
});

test("the values of a breakdown kept to a condition are offered to choose only where one fact table holds both", () => {
  const { a: W, c: N, b: X } = picks;
  const manifest = manifestOf(WIDE.filter((f) => f !== N), { side: [N, X] }, [[W, N]]);
  const all = vocabularyOf(manifest);
  const q = builder.settle(all, { dataset: DATASET, measure: "share", by: W, values: [], where: { [N]: ["x"] }, view: null });
  assert.equal(canvas.canChooseValues(all, q, W), false, "read from the pair: choosing a value would leave it");
  assert.equal(canvas.canChooseValues(all, { ...q, where: {} }, W), true);
  assert.equal(canvas.canChooseValues(all, builder.settle(all, { dataset: DATASET, measure: "share", by: X, values: [], where: { [N]: ["x"] }, view: null }), X), true, "one table holds both");
});

// ---- The breakdown zone judges the second field ----

test("a field put in the breakdown is judged with the second field the chart keeps, as in the other zones", () => {
  // Two narrow tables, {a, b, c} and {a, b, d}; the wide table holds none of the four.
  const { a, b, c, d } = picks;
  const manifest = manifestOf(WIDE.filter((f) => ![a, b, c, d].includes(f)), { first: [a, b, c], second: [a, b, d] });
  const all = vocabularyOf(manifest);
  // A link carries a chart by b, across d, kept to a value of c: no table holds the three, so it is not drawn.
  const link = builder.settle(all, { dataset: DATASET, measure: "share", by: b, by2: d, values: [], values2: [], where: { [c]: ["x"] }, view: null });
  assert.equal(link.by2, d, "the question keeps its second field");
  assert.ok(resolved(link, manifest).preventsRender.length > 0);
  // Putting a in the breakdown keeps d across and c as the condition: still no table holds them, so the verdict refuses it, as the resolver would block it.
  assert.equal(canvas.verdict(all, link, "by", field(a)).ok, false);
  const after = builder.settle(all, { ...link, by: a });
  assert.equal(after.by2, d);
  assert.ok(resolved(after, manifest).preventsRender.length > 0, "what the verdict refuses is what the resolver blocks");
  // Where a table holds the lot, it goes in.
  const crossed = builder.settle(all, { dataset: DATASET, measure: "share", by: b, by2: d, values: [], values2: [], where: {}, view: null });
  assert.equal(canvas.verdict(all, crossed, "by", field(a)).ok, true, "a and d are in the second table");
  const kept = builder.settle(all, { dataset: DATASET, measure: "share", by: b, values: [], where: { [c]: ["x"] }, view: null });
  assert.equal(canvas.verdict(all, kept, "by", field(a)).ok, true, "a and c are in the first");
  assert.equal(resolved(builder.settle(all, { ...kept, by: a }), manifest).preventsRender.length, 0);
});
