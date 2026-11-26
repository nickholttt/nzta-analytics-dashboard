// A breakdown by a field the fact table lacks, which the build keeps as a slice and a pair with the condition's field, starts under that condition
// (config builder.starts_under, D-160): the question settles with it, the resolver reads the pair narrowed to it and says so (keptBy), the visitor can
// remove it or change its value, and each link reads back and writes back exactly. Where the build has no such pair the question settles with no condition
// and is drawn from the slice as it was; a question the fact table answers is never read from a pair. Through the real modules and config over manifests
// written here; no field or value is named, they are found in config. The last test reads the staged data and is skipped where there is none.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const config = await import("../../src/lib/config.ts");
const builder = await import("../../src/lib/builder.ts");
const canvas = await import("../../src/lib/canvas.ts");
const { resolvePreset } = await import("../../src/lib/resolve.ts");
const { PAIR_SEPARATOR } = await import("../../src/lib/data.ts");
type Manifest = import("../../src/lib/data.ts").Manifest;
type Question = import("../../src/lib/builder.ts").Question;

type Spec = { facts?: string[]; narrow_facts?: { id: string; dimensions: string[] }[] };
const datasets = (JSON.parse(readFileSync(new URL("../../config/pipeline.json", import.meta.url), "utf8")) as { datasets: Record<string, Spec> }).datasets;

const [[FIELD, CLASS]] = Object.entries(config.builderSpec.starts_under);
const RULE = config.builderSpec.narrowings[CLASS];
const PAIR = `${FIELD}${PAIR_SEPARATOR}${RULE.dimension}`;
// The dataset that keeps the field only as a slice and a narrow table, and has the condition's field in its fact table.
const DATASET = Object.entries(datasets).find(([id, spec]) => config.builderSpec.datasets.includes(id) && (spec.narrow_facts ?? []).some((t) => t.dimensions.includes(FIELD)) && !(spec.facts ?? []).includes(FIELD) && (spec.facts ?? []).includes(RULE.dimension))?.[0] as string;

const live = (dataset: string) => config.dimensions.filter((d) => !d.applies_to || d.applies_to.includes(dataset)).map((d) => d.id);
const entryFor = (dataset: string, pairs: string[]) => {
  const wide = (datasets[dataset].facts ?? []).filter((id) => live(dataset).includes(id));
  return { months: 1, latest_month: "2026-10", live_dimensions: live(dataset), live_pairs: pairs, facts: { dimensions: wide } };
};
const manifestFor = (pairs: string[]): Manifest => ({ latest_snapshot: "2026-10-31", datasets: { [DATASET]: entryFor(DATASET, pairs) } }) as unknown as Manifest;
const served = manifestFor([PAIR]);
const bare = manifestFor([]);

const ask = (all: ReturnType<typeof builder.builderVocabulary>, over: Partial<Question> = {}) =>
  builder.settle(all, { dataset: DATASET, measure: "share", by: FIELD, values: [], where: {}, view: null, ...over });
const resolved = (q: Question, manifest: Manifest) => resolvePreset(builder.builderPresets(q)[0], manifest);

// A value of the condition's field other than the one it starts under, from the reference file the field is read from.
const otherValue = (() => {
  const derive = config.findDimension(RULE.dimension)?.derive as { reference: string; value: string };
  const [header, ...rows] = readFileSync(new URL(`../../data/reference/${derive.reference}`, import.meta.url), "utf8").trim().split("\n");
  const at = header.split(",").indexOf(derive.value);
  return [...new Set(rows.map((r) => r.split(",")[at]))].find((v) => v && v !== RULE.value) as string;
})();

test("config names a field that starts under a condition, and the build here has a dataset that serves it from its pair", () => {
  assert.ok(FIELD && RULE && DATASET && otherValue, `${FIELD} ${CLASS} ${DATASET} ${otherValue}`);
  assert.ok(RULE.widened_to, "the words for the chart once the condition is removed");
  assert.ok(config.findDimension(FIELD) && config.findDimension(RULE.dimension));
});

for (const measure of ["share", "count"]) {
  test(`with the pair live, a ${measure} chart by the field settles under the condition and is read from the pair, saying it counts those vehicles`, () => {
    const all = builder.builderVocabulary(served);
    const q = ask(all, { measure });
    assert.deepEqual(q.where, { [RULE.dimension]: [RULE.value] });
    assert.equal(q.widened, undefined);
    const r = resolved(q, served);
    assert.deepEqual(r.preventsRender, []);
    assert.deepEqual(r.source, { dataset: DATASET, dimension: FIELD, filter: { pair: PAIR, side: "a", dimension: RULE.dimension, values: [RULE.value] } });
    assert.deepEqual(r.keptBy, [{ dimension: RULE.dimension, values: [RULE.value] }], "the panel writes the scope line and narrows the sentence from this");
    assert.equal(r.narrowedBy, undefined);
    assert.equal(r.shape, measure === "share" ? "mix" : "trend");
    assert.equal(canvas.bestType(q), r.shape);
  });
}

test("a chart that has lost the starting condition says what it counts instead, in config's words", () => {
  const all = builder.builderVocabulary(served);
  const q = ask(all);
  assert.deepEqual(builder.narrowingNotes(all, q), [], "the sentence for a field the register leaves blank is not said of a condition the question starts under for its reading");
  assert.equal(builder.builderPresets(q)[0].note?.includes(RULE.widened_to as string) ?? false, false, "no such words while the condition stands");
  const removed = builder.settleChange(all, q, { ...q, where: {} }, true);
  assert.deepEqual(removed.where, {});
  assert.deepEqual(removed.widened, [RULE.dimension]);
  assert.deepEqual(builder.narrowingNotes(all, removed), []);
  const note = builder.builderPresets(removed)[0].note;
  assert.ok(note?.includes(config.builderSpec.notices.widened.replace("{kind}", RULE.widened_to as string)), note);
  // Changed to another value, it is the visitor's condition and the words for a removed one do not apply.
  const changed = builder.settleChange(all, q, { ...q, where: { [RULE.dimension]: [otherValue] } }, true);
  assert.equal(builder.builderPresets(changed)[0].note?.includes(RULE.widened_to as string) ?? false, false);
  assert.deepEqual(builder.narrowingNotes(all, changed), []);
});

test("with no pair, the question settles with no condition and is drawn from the slice with every vehicle, as before", () => {
  const all = builder.builderVocabulary(bare);
  assert.equal(all.narrowings?.[FIELD], undefined);
  for (const measure of ["share", "count"]) {
    const q = ask(all, { measure });
    assert.deepEqual(q.where, {});
    const r = resolved(q, bare);
    assert.deepEqual(r.preventsRender, []);
    assert.deepEqual(r.source, { dataset: DATASET, dimension: FIELD });
    assert.equal(r.keptBy, undefined);
  }
  // A build whose pair is live for another dataset only starts the question there only.
  const elsewhere = { datasets: { ...served.datasets, ...Object.fromEntries(config.builderSpec.datasets.filter((id) => id !== DATASET && id in datasets).map((id) => [id, entryFor(id, [])])) } } as unknown as Manifest;
  const started = builder.builderVocabulary(elsewhere).narrowings?.[FIELD]?.[0];
  assert.deepEqual(started?.starting, [DATASET]);
});

test("a condition on the field's own pair is read from the pair for the other value too, and a second condition is blocked rather than drawn wider", () => {
  const all = builder.builderVocabulary(served);
  const used = ask(all, { where: { [RULE.dimension]: [otherValue] } });
  assert.deepEqual(used.where, { [RULE.dimension]: [otherValue] });
  const r = resolved(used, served);
  assert.deepEqual(r.preventsRender, []);
  assert.deepEqual(r.source?.filter, { pair: PAIR, side: "a", dimension: RULE.dimension, values: [otherValue] });
  assert.deepEqual(r.keptBy, [{ dimension: RULE.dimension, values: [otherValue] }]);
  // Another condition beside it: no one pair holds both, so today's blocked card stands. The canvas's verdict does not refuse it first (it has no manifest); this is listed in D-160.
  const second = (datasets[DATASET].facts ?? []).find((id) => id !== RULE.dimension && id !== FIELD) as string;
  const two = ask(all, { where: { [RULE.dimension]: [RULE.value], [second]: ["x"] } });
  assert.equal(Object.keys(two.where).length, 2);
  const blocked = resolved(two, served);
  assert.ok(blocked.preventsRender.length > 0);
  assert.equal(blocked.source, undefined);
});

// A canvas link is the chart's question as the page writes it; read and settled again, it writes the same address.
const roundTrips = (all: ReturnType<typeof builder.builderVocabulary>, query: string) => {
  const chart = canvas.settleChart(all, canvas.readCanvas(`?${query}`)[0]);
  const written = String(canvas.canvasParams({ charts: [chart] }));
  const again = canvas.settleChart(all, canvas.readCanvas(`?${written}`)[0]);
  assert.deepEqual(again.question, chart.question, "the same question");
  assert.equal(String(canvas.canvasParams({ charts: [again] })), written, "the same address");
  return { chart, written };
};
const link = (extra: string) => `canvas.charts=c1&c1.measure=share&c1.by=${FIELD}&c1.dataset=${DATASET}${extra}`;

test("the default link, the link with the condition removed, and the link for the other value each read back and write back exactly", () => {
  const all = builder.builderVocabulary(served);
  const start = roundTrips(all, link(`&c1.where.${RULE.dimension}=${encodeURIComponent(RULE.value)}`));
  assert.deepEqual(start.chart.question.where, { [RULE.dimension]: [RULE.value] });
  assert.ok(start.written.includes(`c1.where.${RULE.dimension}=`), "the address carries the condition");
  // A link written before the condition existed names none and means the question as it starts now: it reads as the starting one and is written with it.
  const older = roundTrips(all, link(""));
  assert.equal(older.written, start.written);
  const widened = roundTrips(all, link(`&c1.widen=${RULE.dimension}`));
  assert.deepEqual(widened.chart.question.where, {});
  assert.deepEqual(widened.chart.question.widened, [RULE.dimension]);
  assert.ok(widened.written.includes(`c1.widen=${RULE.dimension}`));
  const other = roundTrips(all, link(`&c1.where.${RULE.dimension}=${encodeURIComponent(otherValue)}`));
  assert.deepEqual(other.chart.question.where, { [RULE.dimension]: [otherValue] });
  assert.equal(other.chart.question.widened, undefined);
  // The same links on a build with no pair: no condition, and the removal of one that was never there is nothing.
  const none = builder.builderVocabulary(bare);
  assert.deepEqual(roundTrips(none, link("")).chart.question.where, {});
  assert.equal(roundTrips(none, link(`&c1.widen=${RULE.dimension}`)).chart.question.widened, undefined);
});

test("a question the fact table answers is read from the fact table, however many pairs the build holds: no chart reads other than it did", () => {
  let checked = 0;
  for (const dataset of config.builderSpec.datasets) {
    const spec = datasets[dataset];
    if (!spec?.facts) continue;
    const dimensions = spec.facts.filter((id) => live(dataset).includes(id) && config.findDimension(id));
    const pairs = dimensions.flatMap((a) => dimensions.filter((b) => b !== a).map((b) => `${a}${PAIR_SEPARATOR}${b}`));
    const manifest = { datasets: { [dataset]: { ...entryFor(dataset, pairs), live_dimensions: dimensions, facts: { dimensions } } } } as unknown as Manifest;
    const measure = config.builderSpec.measures.find((m) => m.id === "share") as { dimensions: Record<string, string> };
    for (const by of dimensions.filter((id) => id in measure.dimensions)) {
      for (const condition of dimensions.filter((id) => id !== by)) {
        const q: Question = { dataset, measure: "share", by, values: [], where: { [condition]: ["x"] }, view: null };
        const r = resolved(q, manifest);
        assert.equal(r.source?.filter, undefined, `${dataset}: ${by} kept to ${condition} is not read from a pair`);
        assert.ok(r.source?.facts, `${dataset}: ${by} kept to ${condition} is read from the fact table`);
        checked++;
      }
    }
  }
  assert.ok(checked > 50, `${checked} questions checked`);
});

// What the pipeline published, read from the staged pair file and summed here, apart from the site's own reader.
const staged = new URL("../../public/data/", import.meta.url);
const pairFile = new URL(`pairs/${DATASET}/${PAIR}.parquet`, staged);
test("the pair read through the site's reader gives the latest month's new-vehicle figures the pipeline published", { skip: !existsSync(pairFile) && "public/data holds no such pair" }, async () => {
  const { parquetReadObjects } = await import("hyparquet");
  const { decompressZstd } = await import("hyparquet-compressors");
  const bytes = readFileSync(pairFile);
  const raw = await parquetReadObjects({
    file: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    compressors: { ZSTD: (input: Uint8Array) => (decompressZstd as (input: Uint8Array) => Uint8Array)(input) },
    columns: ["month", "a_value", "b_value", "n"],
  });
  const monthOf = (value: unknown) => (value instanceof Date ? value.toISOString().slice(0, 7) : String(value).slice(0, 7));
  const last = raw.map((r) => monthOf(r.month)).sort().at(-1) as string;
  const expected = new Map<string, number>();
  for (const r of raw) if (monthOf(r.month) === last && r.b_value === RULE.value) expected.set(String(r.a_value), (expected.get(String(r.a_value)) ?? 0) + Number(r.n));
  assert.ok(expected.size >= 2, "the staged pair has the month's new-vehicle figures to compare with");
  const total = [...expected.values()].reduce((a, b) => a + b, 0);

  globalThis.fetch = (async (url: string) => {
    try {
      const file = readFileSync(new URL(String(url).replace(/^\/data\//, ""), staged));
      return { ok: true, status: 200, arrayBuffer: async () => file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) };
    } catch {
      return { ok: false, status: 404 };
    }
  }) as never;
  const { loadView } = await import("../../src/lib/data.ts");
  const rows = (await loadView(resolved(ask(builder.builderVocabulary(served)), served).source as never)).filter((r) => r.month === last);
  assert.deepEqual(new Map(rows.map((r) => [r.value, r.n])), expected);
  assert.ok(rows.every((r) => r.denominator === total), "a share is of the new vehicles of the month, not of every vehicle the pair's file counts");
});

// A link that names no condition, and so opens narrowed, is told so in config's words; a link that names the condition, or its removal, or a chart
// with no pair to serve it, is told nothing.
test("a link that names no starting condition is told the chart starts with it; one that names it, or its removal, is not", () => {
  const told = (all: ReturnType<typeof builder.builderVocabulary>, extra: string) => {
    const asked = canvas.readCanvas(`?${link(extra)}`)[0].asked;
    return builder.linkNotices(all, asked, builder.settle(all, asked));
  };
  const all = builder.builderVocabulary(served);
  const started = config.builderSpec.notices.started.replace("{kind}", RULE.kind);
  assert.deepEqual(told(all, ""), [started]);
  assert.deepEqual(told(all, `&c1.where.${RULE.dimension}=${encodeURIComponent(RULE.value)}`), []);
  assert.deepEqual(told(all, `&c1.where.${RULE.dimension}=${encodeURIComponent(otherValue)}`), []);
  assert.deepEqual(told(all, `&c1.widen=${RULE.dimension}`), []);
  assert.deepEqual(told(builder.builderVocabulary(bare), ""), []);
});
