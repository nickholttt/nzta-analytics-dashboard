// The canvas reads a narrow fact table (D-144, D-159) where the wide one does not hold every field a question names: the resolver picks the cheapest table that
// holds them all (the pair, then the wide table, then the first narrow table of the manifest), the vocabulary offers a field of a narrow table as a breakdown, a
// second field and a condition beside the fields that table holds, and a link that names them reads back and writes back exactly. Through the real modules and
// config over manifests written here: the dataset, the field and its partners are found in config/pipeline.json and config/presets.json, never named.
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

type Table = { id: string; dimensions: string[] };
type Spec = { facts?: string[]; narrow_facts?: Table[] };
const datasets = (JSON.parse(readFileSync(new URL("../../config/pipeline.json", import.meta.url), "utf8")) as { datasets: Record<string, Spec> }).datasets;

// The field that starts under a condition (D-160) is the one kept in a narrow table and in no column of the wide one, on a dataset the canvas offers.
const [[FIELD, CLASS]] = Object.entries(config.builderSpec.starts_under);
const RULE = config.builderSpec.narrowings[CLASS];
const PAIR = `${FIELD}${PAIR_SEPARATOR}${RULE.dimension}`;
const DATASET = Object.entries(datasets).find(([id, spec]) => config.builderSpec.datasets.includes(id) && (spec.narrow_facts ?? []).some((t) => t.dimensions.includes(FIELD)))?.[0] as string;
const NARROW = (datasets[DATASET].narrow_facts as Table[]).find((t) => t.dimensions.includes(FIELD)) as Table;
const WIDE = datasets[DATASET].facts as string[];

const live = (dataset: string) => config.dimensions.filter((d) => !d.applies_to || d.applies_to.includes(dataset)).map((d) => d.id);
// The partners: the fields the narrow table holds with the field, and whether the wide table holds them too.
const partners = NARROW.dimensions.filter((d) => d !== FIELD && live(DATASET).includes(d));
// A field of the dataset that no table holds with the field: in the wide table and not in the narrow one.
const apart = WIDE.filter((d) => live(DATASET).includes(d) && !NARROW.dimensions.includes(d));

const entryFor = (narrow: Record<string, string[]>, pairs: string[] = [PAIR]) => ({
  months: 1,
  latest_month: "2026-10",
  live_dimensions: live(DATASET),
  live_pairs: pairs,
  facts: {
    rows: 1,
    dimensions: WIDE.filter((d) => live(DATASET).includes(d)),
    not_live: {},
    ...(Object.keys(narrow).length ? { narrow: Object.fromEntries(Object.entries(narrow).map(([id, dimensions]) => [id, { rows: 1, dimensions: dimensions.filter((d) => live(DATASET).includes(d)), not_live: {} }])) } : {}),
  },
});
const manifestOf = (narrow: Record<string, string[]>, pairs?: string[]): Manifest => ({ latest_snapshot: "2026-10-31", datasets: { [DATASET]: entryFor(narrow, pairs) } }) as unknown as Manifest;
const served = manifestOf({ [NARROW.id]: NARROW.dimensions });
const all = builder.builderVocabulary(served);
const v = all.datasets.find((d) => d.dataset === DATASET)!;
// The partners the dataset offers as a breakdown, which a grid can cross the field with; the others (a field config offers as a condition only) can be kept beside it.
const breakdowns = new Set(v.measures.find((m) => m.id === "share")!.dimensions.map((d) => d.id));

const ask = (over: Partial<Question>) => builder.settle(all, { dataset: DATASET, measure: "share", values: [], where: {}, view: null, by: FIELD, ...over });
const resolved = (q: Question, manifest: Manifest = served) => resolvePreset(builder.builderPresets(q)[0], manifest);

// A value of the condition's own field, and one of the field's, from the reference files the fields are read from.
const valuesOf = (id: string): string[] => {
  const derive = config.findDimension(id)?.derive as { reference: string; value: string };
  const [header, ...rows] = readFileSync(new URL(`../../data/reference/${derive.reference}`, import.meta.url), "utf8").trim().split("\n");
  const at = header.split(",").indexOf(derive.value);
  return [...new Set(rows.map((r) => r.split(",")[at]))].filter(Boolean);
};
const [ownValue] = valuesOf(FIELD);
const otherValue = valuesOf(RULE.dimension).find((x) => x !== RULE.value) as string;

test("config has a narrow table that holds the field with partners, a wide table that holds some of them, and fields no table holds with it", () => {
  assert.ok(FIELD && DATASET && NARROW && partners.length >= 2, `${FIELD} ${DATASET} ${NARROW?.id} ${partners}`);
  assert.ok(partners.some((p) => WIDE.includes(p)), "a partner the wide table holds too");
  assert.ok(apart.length >= 1, "a field the narrow table lacks");
  assert.ok(ownValue && otherValue);
});

test("the vocabulary offers the field's values, crossed with and kept beside every field its table holds, and starts no count on values of the page's own", () => {
  assert.ok(v.filters.some((f) => f.id === FIELD), "a condition");
  for (const measure of ["share", "count"]) {
    const option = v.measures.find((m) => m.id === measure)?.dimensions.find((d) => d.id === FIELD);
    assert.ok(option, measure);
    assert.equal(option.values, true, "the narrow table carries it, so its values can be chosen");
    assert.equal(option.startValues, false, "a short list kept in a narrow table: the page starts on none");
    for (const p of partners) {
      assert.equal(option.with.includes(p), breakdowns.has(p) && builder.canCross(FIELD, p), `${FIELD} with ${p}`);
      assert.ok(v.filters.some((f) => f.id === p), `${p} is a condition`);
    }
    for (const other of apart) assert.ok(!option.with.includes(other), `${other} is not held with ${FIELD}`);
  }
  assert.deepEqual(v.tables[1].sort(), [...NARROW.dimensions].sort(), "the narrow table's fields are one table");
  assert.deepEqual(builder.together(v, FIELD).filter((d) => !partners.includes(d) && d !== FIELD && !(v.tables.some((t) => t.length === 2 && t.includes(d) && t.includes(FIELD)))), []);
  // A build with no narrow table offers it as before: a breakdown with no values, no crossing and no condition.
  const bare = builder.builderVocabulary(manifestOf({}, [])).datasets.find((d) => d.dataset === DATASET)!;
  assert.equal(bare.filters.some((f) => f.id === FIELD), false);
  assert.equal(bare.measures.find((m) => m.id === "share")?.dimensions.find((d) => d.id === FIELD)?.values, false);
  assert.deepEqual(bare.measures.find((m) => m.id === "share")?.dimensions.find((d) => d.id === FIELD)?.with, []);
  const q = ask({ measure: "count" });
  assert.equal(q.pageValues, undefined, "a count by the field is drawn with every value, the page starts on none");
  assert.equal(canvas.awaitsValues(all, { question: q, type: null }), false);
});

test("a question the wide table answers is read from it, as before, though a narrow table holds the same fields", () => {
  const field = partners.find((p) => WIDE.includes(p) && p !== RULE.dimension) as string;
  const q = builder.settle(all, { dataset: DATASET, measure: "share", by: field, values: [], where: { [RULE.dimension]: [RULE.value] }, view: null });
  const r = resolved(q);
  assert.deepEqual(r.preventsRender, []);
  assert.equal(r.source?.facts?.table, undefined, "the wide table, not the narrow one");
  assert.ok(r.source?.facts);
});

for (const p of ["share", "count"].flatMap((measure) => partners.map((partner) => ({ measure, partner })))) {
  test(`${p.measure} of the field by ${p.partner}: kept to the condition the field starts under, a condition on ${p.partner} and the field as a condition each read the narrow table`, () => {
    const withTable = (r: ReturnType<typeof resolved>) => assert.equal(r.source?.facts?.table, NARROW.id, JSON.stringify(r.source));
    // The field as a breakdown with a partner as a condition, and the partner as a breakdown with the field as a condition.
    const byField = ask({ measure: p.measure, where: { [p.partner]: ["x"] } });
    if (p.partner === RULE.dimension) assert.ok(resolved(byField).source?.filter, "one condition on a field the pair holds: the pair, as before");
    else {
      assert.deepEqual(resolved(byField).preventsRender, []);
      withTable(resolved(byField));
    }
    if (!breakdowns.has(p.partner)) return;
    const byPartner = builder.settle(all, { dataset: DATASET, measure: p.measure, by: p.partner, values: [], where: { [FIELD]: [ownValue] }, view: null });
    assert.equal(byPartner.by, p.partner);
    assert.deepEqual(byPartner.where, { [FIELD]: [ownValue] });
    const r = resolved(byPartner);
    assert.deepEqual(r.preventsRender, []);
    if (p.partner === RULE.dimension) assert.deepEqual(r.source?.filter && { pair: r.source.filter.pair }, { pair: PAIR });
    else withTable(r);
  });
}

for (const partner of partners.filter((p) => breakdowns.has(p) && builder.canCross(FIELD, p))) {
  test(`the field crossed with ${partner} is a grid read from the narrow table, the only chart type that fits, and the others say why not`, () => {
    const q = ask({ by2: partner });
    assert.equal(q.by2, partner, "the question keeps the second field");
    const r = resolved(q);
    assert.deepEqual(r.preventsRender, []);
    assert.equal(r.shape, "matrix");
    assert.equal(r.source?.facts?.table, NARROW.id);
    assert.deepEqual(r.source?.cross, { dimension: partner, grid: true });
    const types = canvas.chartTypes(all, q, served);
    assert.deepEqual(types.filter((t) => t.fits).map((t) => t.id), ["matrix"]);
    for (const t of types.filter((x) => !x.fits)) assert.ok(t.reason && !/[{}]/.test(t.reason), `${t.id}: ${t.reason}`);
    // The same two fields with the condition the field starts under: still one table.
    const kept = ask({ by2: partner, where: { [RULE.dimension]: [RULE.value] } });
    if (partner !== RULE.dimension) assert.equal(resolved(kept).source?.facts?.table, NARROW.id);
  });
}

test("a field no table holds with the field is never its second field, and a question that names one anyway is blocked, not drawn from one table", () => {
  for (const other of apart) {
    assert.equal(ask({ by2: other }).by2 ?? null, null, `${other} dropped from the question`);
    const forced = builder.builderPresets({ dataset: DATASET, measure: "share", by: FIELD, values: [], by2: other, values2: [], where: {}, view: null })[0];
    const r = resolvePreset(forced, served);
    assert.ok(r.preventsRender.some((m) => /no one fact table/.test(m)), r.preventsRender.join("; "));
    assert.equal(r.source, undefined);
  }
});

test("the first narrow table of the manifest that holds every field is the one read, and a table that lacks one is passed over", () => {
  const first = "first_table";
  const second = "second_table";
  const [partner] = partners;
  const asked = ask({ by2: partner });
  const both = manifestOf({ [first]: NARROW.dimensions, [second]: NARROW.dimensions });
  assert.equal(resolved(asked, both).source?.facts?.table, first);
  const reversed = manifestOf({ [second]: NARROW.dimensions, [first]: NARROW.dimensions });
  assert.equal(resolved(asked, reversed).source?.facts?.table, second);
  const lacking = manifestOf({ [first]: [FIELD], [second]: NARROW.dimensions });
  assert.equal(resolved(asked, lacking).source?.facts?.table, second, "the first one lacks the partner");
  const none = manifestOf({ [first]: [FIELD] });
  assert.ok(resolved(asked, none).preventsRender.length > 0);
});

test("choosing the field's values moves the question from the pair to the narrow table, and the answer is the same question", () => {
  const q = ask({ values: [ownValue] });
  assert.deepEqual(q.values, [ownValue]);
  const r = resolved(q);
  assert.deepEqual(r.preventsRender, []);
  assert.equal(r.source?.filter, undefined);
  assert.equal(r.source?.facts?.table, NARROW.id);
  assert.deepEqual(r.source?.facts?.values, [ownValue]);
});

// ---- Links ----

// A canvas link is the chart's question as the page writes it; read and settled again, it writes the same address.
const roundTrips = (vocabulary: ReturnType<typeof builder.builderVocabulary>, query: string) => {
  const chart = canvas.settleChart(vocabulary, canvas.readCanvas(`?${query}`)[0]);
  const written = String(canvas.canvasParams({ charts: [chart] }));
  const again = canvas.settleChart(vocabulary, canvas.readCanvas(`?${written}`)[0]);
  assert.deepEqual(again.question, chart.question, "the same question");
  assert.equal(String(canvas.canvasParams({ charts: [again] })), written, "the same address");
  return { chart, written, params: new URLSearchParams(written) };
};
const link = (extra: string, by = FIELD) => `canvas.charts=c1&c1.measure=share&c1.by=${by}&c1.dataset=${DATASET}${extra}`;
const encoded = (text: string) => encodeURIComponent(text);

test("the four links of the design: the field for the condition it starts under, with it removed, crossed with a partner, and a partner kept to one value of the field", () => {
  // Share by the field, kept to the starting condition.
  const start = roundTrips(all, link(`&c1.where.${RULE.dimension}=${encoded(RULE.value)}`));
  assert.deepEqual(start.chart.question.where, { [RULE.dimension]: [RULE.value] });
  assert.equal(start.params.get("c1.by"), FIELD);
  // The same with the condition removed.
  const widened = roundTrips(all, link(`&c1.widen=${RULE.dimension}`));
  assert.deepEqual(widened.chart.question.where, {});
  assert.deepEqual(widened.chart.question.widened, [RULE.dimension]);
  // The field crossed with a partner, kept to the condition it starts under: a grid.
  const partner = partners.find((p) => p !== RULE.dimension && breakdowns.has(p) && builder.canCross(FIELD, p)) as string;
  const grid = roundTrips(all, link(`&c1.by2=${partner}&c1.where.${RULE.dimension}=${encoded(RULE.value)}`));
  assert.equal(grid.chart.question.by2, partner);
  assert.deepEqual(grid.chart.question.where, { [RULE.dimension]: [RULE.value] });
  assert.equal(grid.params.get("c1.by2"), partner);
  assert.ok(resolved(grid.chart.question).source?.facts?.table === NARROW.id);
  // A partner kept to one value of the field.
  const kept = roundTrips(all, link(`&c1.where.${FIELD}=${encoded(ownValue)}`, partner));
  assert.deepEqual(kept.chart.question.where, { [FIELD]: [ownValue] });
  assert.equal(kept.chart.question.by, partner);
  assert.equal(kept.params.get(`c1.where.${FIELD}`), ownValue);
  assert.equal(resolved(kept.chart.question).source?.facts?.table, NARROW.id);
  // Links written as the page wrote them before the narrow tables, and as a build without them reads them: the same addresses.
  const older = roundTrips(builder.builderVocabulary(manifestOf({})), link(""));
  assert.ok(older.params.get("c1.by") === FIELD);
});

test("a link that names a condition and a second field no table holds together is kept as it was asked and is not drawn", () => {
  const other = apart[0];
  const chart = canvas.settleChart(all, canvas.readCanvas(`?${link(`&c1.where.${other}=x&c1.where.${RULE.dimension}=${encoded(RULE.value)}`)}`)[0]);
  assert.deepEqual(Object.keys(chart.question.where).sort(), [other, RULE.dimension].sort(), "settle keeps a condition it cannot apply: the page says so");
  const r = resolved(chart.question);
  assert.ok(r.preventsRender.length > 0);
  assert.equal(r.source, undefined);
  assert.ok(otherValue);
});
