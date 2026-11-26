// What no table holds together is refused before it is drawn, with a one-line reason from config/canvas.json (D-144, D-159): a field put in the second-field or the
// filter zone, or as the breakdown, beside fields that share no table with it; a condition a link carries that no table holds with the chart's fields; a
// field on a dataset that does not hold it; and a chart pinned to a snapshot that lacks the field. And the floor under them: no list of fields a question can name
// together joins a field that says what kind of owner with a field that says where the owner lives. Through the real modules and config over manifests written here;
// the dataset, the field and what is held with it are found in config, never named.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const config = await import("../../src/lib/config.ts");
const builder = await import("../../src/lib/builder.ts");
const canvas = await import("../../src/lib/canvas.ts");
const kept = await import("../../src/lib/kept.ts");
const { ownerDimensions } = await import("../../src/lib/owner.ts");
const { PAIR_SEPARATOR } = await import("../../src/lib/data.ts");
const { sayList } = await import("../../src/lib/sentences.ts");
type Manifest = import("../../src/lib/data.ts").Manifest;
type Question = import("../../src/lib/builder.ts").Question;

type Table = { id: string; dimensions: string[] };
type Spec = { facts?: string[]; pairs?: string[][]; narrow_facts?: Table[] };
const read = (path: string) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const pipeline = read("config/pipeline.json") as { datasets: Record<string, Spec>; supplied: Record<string, { fields?: Record<string, string>; extra_fields?: Record<string, string> }> };
const datasets = pipeline.datasets;

const live = (dataset: string) => config.dimensions.filter((d) => !d.applies_to || d.applies_to.includes(dataset)).map((d) => d.id);
// The manifest a build of config/pipeline.json would write: each dataset's wide table, narrow tables and pairs, with every dimension live.
const entryOf = (dataset: string) => {
  const spec = datasets[dataset];
  const liveHere = live(dataset);
  const wide = (spec.facts ?? []).filter((d) => liveHere.includes(d));
  return {
    months: 1,
    latest_month: "2026-10",
    live_dimensions: liveHere,
    live_pairs: (spec.pairs ?? []).map(([a, b]) => `${a}${PAIR_SEPARATOR}${b}`),
    facts: spec.facts
      ? {
          rows: 1,
          dimensions: wide,
          not_live: {},
          ...(spec.narrow_facts ? { narrow: Object.fromEntries(spec.narrow_facts.map((t) => [t.id, { rows: 1, dimensions: t.dimensions.filter((d) => liveHere.includes(d)), not_live: {} }])) } : {}),
        }
      : null,
  };
};
const built = Object.keys(datasets).filter((id) => config.builderSpec.datasets.includes(id));
const manifest = { latest_snapshot: "2026-10-31", datasets: Object.fromEntries(built.map((id) => [id, entryOf(id)])) } as unknown as Manifest;
const all = builder.builderVocabulary(manifest);

const [[FIELD, CLASS]] = Object.entries(config.builderSpec.starts_under);
const RULE = config.builderSpec.narrowings[CLASS];
const DATASET = built.find((id) => (datasets[id].narrow_facts ?? []).some((t) => t.dimensions.includes(FIELD))) as string;
const NARROW = (datasets[DATASET].narrow_facts as Table[]).find((t) => t.dimensions.includes(FIELD)) as Table;
const v = all.datasets.find((d) => d.dataset === DATASET)!;
const offered = new Set(v.measures.find((m) => m.id === "share")!.dimensions.map((d) => d.id));
const field = (id: string) => ({ id, label: canvas.fieldLabel(id), group: "g", kind: config.findDimension(id)?.kind ?? "category", definition: "", averageable: false });
const startQuestion = builder.settle(all, { dataset: DATASET, measure: "share", by: FIELD, values: [], where: {}, view: null });
// A breakdown a wide-table field the narrow table lacks, and one it holds that the dataset offers as a breakdown.
const apart = (datasets[DATASET].facts as string[]).filter((d) => offered.has(d) && !NARROW.dimensions.includes(d));
const held = NARROW.dimensions.filter((d) => d !== FIELD && offered.has(d) && builder.canCross(FIELD, d));

test("config has the field, fields its table holds with it, and fields it does not", () => {
  assert.ok(FIELD && DATASET && NARROW && apart.length >= 2 && held.length >= 2, `${FIELD} ${DATASET} ${apart} ${held}`);
  assert.deepEqual(startQuestion.where, { [RULE.dimension]: [RULE.value] }, "a chart by the field starts under its condition");
});

const label = (id: string) => canvas.fieldLabel(id);
const refusal = (other: string[], target: string) => canvas.say("refuse_not_crossed", { dataset: canvas.datasetLabel(DATASET), field: label(target), other: sayList(other.map(label)) });

test("a field a table holds with the chart's fields goes in the second field's zone and the filters, and one no table holds with them is refused with the reason", () => {
  for (const id of held) {
    assert.equal(canvas.verdict(all, startQuestion, "by2", field(id)).ok, true, `${id} as a second field`);
    // The condition the chart starts under is already there: another condition goes beside it.
    if (id !== RULE.dimension) assert.equal(canvas.verdict(all, startQuestion, "where", field(id)).ok, true, `${id} as a condition beside ${FIELD}`);
  }
  assert.equal(canvas.verdict(all, { ...startQuestion, where: {} }, "where", field(RULE.dimension)).ok, true, "and the same field before it is there");
  for (const id of apart) {
    const second = canvas.verdict(all, startQuestion, "by2", field(id));
    assert.equal(second.ok, false, `${id} as a second field`);
    if (!second.ok) {
      assert.equal(second.reason, refusal([FIELD], id), "in config's words, naming the dataset and both fields");
      assert.match(second.reason, new RegExp(canvas.datasetLabel(DATASET)));
      assert.ok(!/[{}]/.test(second.reason));
    }
    const filtered = canvas.verdict(all, startQuestion, "where", field(id));
    assert.equal(filtered.ok, false, `${id} as a condition`);
    if (!filtered.ok) assert.equal(filtered.reason, refusal([FIELD], id), "the field the condition has no table with, named");
  }
});

test("a chart of a field the narrow table lacks refuses the field as a condition and as a breakdown beside a condition on the field", () => {
  const [wideField] = apart;
  const withCondition: Question = { ...startQuestion, by: wideField, values: [], where: { [FIELD]: ["x"] } };
  // The chart's condition has no table with its breakdown: another breakdown that the narrow table holds goes in, one that it does not is refused.
  const partner = held.find((id) => id !== wideField) as string;
  assert.equal(canvas.verdict(all, withCondition, "by", field(partner)).ok, true, `${partner} as the breakdown beside a condition on ${FIELD}`);
  const refused = canvas.verdict(all, withCondition, "by", field(apart[1]));
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.reason, refusal([FIELD], apart[1]));
  // A chart with no condition takes any breakdown the measure offers: the tables matter only where the chart names more than one field.
  assert.equal(canvas.verdict(all, { ...startQuestion, where: {} }, "by", field(apart[1])).ok, true);
});

test("a field the dataset does not hold at all is refused for that, in config's words", () => {
  const other = built.find((id) => id !== DATASET && !(live(id).includes(FIELD)));
  assert.ok(other);
  const there = builder.settle(all, { dataset: other, measure: "share", by: null, values: [], where: {}, view: null });
  for (const zone of ["by", "by2", "where"] as const) {
    const q = zone === "by2" ? { ...there, by: all.datasets.find((d) => d.dataset === other)!.measures[0].dimensions[0].id } : there;
    const r = canvas.verdict(all, q, zone, field(FIELD));
    assert.equal(r.ok, false, zone);
    if (!r.ok) assert.ok(r.reason.includes(canvas.datasetLabel(other)) && r.reason.includes(label(FIELD)), r.reason);
  }
});

test("a link's condition that no table holds with the chart's fields is told with the same words, and one that a table holds is not", () => {
  const [wideField] = apart;
  const bad: Question = { ...startQuestion, where: { [RULE.dimension]: [RULE.value], [wideField]: ["x"] } };
  assert.equal(canvas.conditionApart(all, bad, wideField), refusal([FIELD], wideField));
  // The condition that shares a table with each field the chart names is not the one to blame, though no one table holds all three: the other one is told.
  assert.equal(canvas.conditionApart(all, bad, RULE.dimension), undefined);
  assert.equal(canvas.conditionApart(all, startQuestion, RULE.dimension), undefined);
  assert.equal(canvas.conditionApart(all, { ...startQuestion, where: { [held[0]]: ["x"] } }, held[0]), undefined);
});

// ---- A pinned snapshot that lacks the field ----

test("a chart pinned to a snapshot that does not hold the field says so in config's words, and reads nothing from it", async () => {
  const lacking = { ...manifest, latest_snapshot: "2026-09-30", datasets: { [DATASET]: { ...entryOf(DATASET), live_dimensions: live(DATASET).filter((d) => d !== FIELD), live_pairs: [], facts: { rows: 1, dimensions: (datasets[DATASET].facts as string[]).filter((d) => d !== FIELD), not_live: {} } } } } as unknown as Manifest;
  const pinned: Question = { ...startQuestion, snapshot: "2026-09" };
  const files: string[] = [];
  const reading = await kept.readingFor(
    pinned,
    manifest,
    {
      index: async () => new Map([["2026-09", "2026-09-30"]]) as never,
      manifest: async () => lacking,
      slice: async (...args) => {
        files.push(args.join("/"));
        return [];
      },
    },
    new Set(),
  );
  assert.equal(reading.kind, "withheld");
  assert.deepEqual(files, [], "no file of the snapshot is fetched for a question it cannot answer");
  const note = kept.pinLine(pinned, manifest, reading);
  assert.equal(note?.kind, "withheld");
  const said = canvas.say("refuse_not_in_snapshot", { date: "2026-09-30", field: label(FIELD) });
  assert.ok(said.includes(label(FIELD)) && !/[{}]/.test(said), said);
  assert.ok(note?.text.startsWith(said), note?.text);
  // A snapshot that holds every field the question names but not one table with them says what it said before.
  const cannot = { ...lacking, datasets: { [DATASET]: { ...lacking.datasets[DATASET], live_dimensions: live(DATASET), facts: { rows: 1, dimensions: (datasets[DATASET].facts as string[]).filter((d) => d !== FIELD), not_live: {} } } } } as unknown as Manifest;
  assert.equal(kept.fieldLackedBy(pinned, cannot), undefined);
  assert.equal(kept.fieldLackedBy(pinned, lacking), label(FIELD));
});

test("the lists of a pinned chart's pickers are counted in the snapshot's own narrow table, and not where it has none", () => {
  const withNarrow = { kind: "kept" as const, month: "2026-10", manifest };
  const [partner] = held;
  assert.equal(kept.pickerMonth(withNarrow, DATASET, partner, { [FIELD]: ["x"] }, new Set()), "2026-10", "a table of the snapshot holds both");
  const bare = { kind: "kept" as const, month: "2026-10", manifest: { ...manifest, datasets: { [DATASET]: { ...entryOf(DATASET), facts: { rows: 1, dimensions: (datasets[DATASET].facts as string[]), not_live: {} } } } } as unknown as Manifest };
  assert.equal(kept.pickerMonth(bare, DATASET, partner, { [FIELD]: ["x"] }, new Set()), undefined);
});

// ---- The floor under kind of owner ----

// The dimensions that read a field the map puts in one of the groups: a register field by the dimension it is bound to, a column of the dashboard's export by the
// name a derive block gives it (config/pipeline.json, supplied).
const map = read("config/data_map.json") as { owner_groups: string[]; kind_of_owner_groups: string[]; fields: { name: string; source: string; group: string; bound?: string | null; privacy?: string }[] };
// Every string in a derive block, its keys included: a lookup names a column of the export by the key it reads it under.
const strings = (x: unknown): string[] => (typeof x === "string" ? [x] : x && typeof x === "object" ? Object.entries(x).flatMap(([k, value]) => [k, ...strings(value)]) : []);
const columns = Object.assign({}, ...Object.values(pipeline.supplied).map((s) => ({ ...s.fields, ...s.extra_fields }))) as Record<string, string>;
const kindOwner = (() => {
  const named = new Set(map.fields.filter((f) => map.kind_of_owner_groups.includes(f.group)).map((f) => f.name));
  const registerBound = new Set(map.fields.filter((f) => map.kind_of_owner_groups.includes(f.group) && f.bound).map((f) => f.bound as string));
  return config.dimensions.filter((d) => registerBound.has(d.id) || strings(d.derive).some((s) => (s in columns && named.has(columns[s])) || registerBound.has(s))).map((d) => d.id);
})();
const ownerLives = ownerDimensions(map as never, config.dimensions as never);

test("the floor is checked on dimensions found in config: buyer type says what kind of owner, a region and a current use say where or who", () => {
  assert.ok(kindOwner.includes(FIELD), kindOwner.join(", "));
  assert.ok(ownerLives.length >= 2 && !ownerLives.some((d) => kindOwner.includes(d)), JSON.stringify({ ownerLives, kindOwner }));
});

const noJoin = (lists: string[][], what: string) => {
  for (const list of lists) {
    const kinds = list.filter((d) => kindOwner.includes(d));
    const owners = list.filter((d) => ownerLives.includes(d));
    assert.ok(!(kinds.length && owners.length), `${what}: ${list.join(", ")} puts ${kinds} with ${owners}`);
  }
};

test("no table a question can be read from holds a kind of owner with where an owner lives, in the build this config writes or in the staged one", () => {
  for (const manifestOfBuild of [manifest, ...(existsSync(new URL("../../public/data/manifest.json", import.meta.url)) ? [read("public/data/manifest.json") as Manifest] : [])]) {
    const vocabulary = builder.builderVocabulary(manifestOfBuild);
    assert.ok(vocabulary.datasets.length >= 2);
    for (const d of vocabulary.datasets) {
      noJoin(d.tables, `${d.dataset} tables`);
      for (const k of kindOwner) {
        const share = builder.together(d, k);
        assert.ok(!share.some((x) => ownerLives.includes(x)), `${d.dataset}: ${k} is held with ${share.filter((x) => ownerLives.includes(x))}`);
      }
      for (const m of d.measures) for (const dim of m.dimensions) if (kindOwner.includes(dim.id)) assert.ok(!dim.with.some((x) => ownerLives.includes(x)), `${d.dataset}: ${dim.id} is crossed with where an owner lives`);
    }
  }
});

test("a kind of owner and where an owner lives are never put in one chart: every field that says where is refused beside it, in each zone", () => {
  const where = ownerLives.filter((d) => live(DATASET).includes(d));
  assert.ok(where.length > 0);
  const q = builder.settle(all, { dataset: DATASET, measure: "share", by: FIELD, values: [], where: {}, view: null });
  for (const owner of where) for (const zone of ["by2", "where"] as const) assert.equal(canvas.verdict(all, q, zone, field(owner)).ok, false, `${owner} beside ${FIELD} in ${zone}`);
});

test("the check finds a table that does join them: a narrow table of the field and a place-of-owner field is caught", () => {
  const owner = ownerLives.find((d) => live(DATASET).includes(d)) as string;
  const entry = entryOf(DATASET);
  const bad = { ...manifest, datasets: { ...manifest.datasets, [DATASET]: { ...entry, facts: { ...entry.facts, narrow: { joined: { rows: 1, dimensions: [FIELD, owner], not_live: {} } } } } } } as unknown as Manifest;
  const d = builder.builderVocabulary(bad).datasets.find((x) => x.dataset === DATASET)!;
  assert.throws(() => noJoin(d.tables, "joined"), /puts/);
  assert.ok(builder.together(d, FIELD).includes(owner));
});

// ---- A count chart the tables cannot read ----

test("a count chart whose condition no one table holds with its breakdown waits for no starting values: its card says why it is not drawn, not that a list failed to load", () => {
  let checked = 0;
  for (const dataset of built) {
    for (const table of datasets[dataset].narrow_facts ?? []) {
      const wide = datasets[dataset].facts as string[];
      const vocabulary = all.datasets.find((d) => d.dataset === dataset)!;
      const countOffers = vocabulary.measures.find((m) => m.id === "count")!.dimensions;
      const narrowOnly = table.dimensions.filter((d) => !wide.includes(d) && vocabulary.filters.some((f) => f.id === d));
      const apartBreakdown = countOffers.find((d) => d.values && d.startValues && wide.includes(d.id) && !table.dimensions.includes(d.id));
      const heldBreakdown = countOffers.find((d) => d.values && d.startValues && wide.includes(d.id) && table.dimensions.includes(d.id));
      assert.ok(narrowOnly.length && apartBreakdown && heldBreakdown, `${dataset}/${table.id}`);
      for (const condition of narrowOnly) {
        const none = builder.settle(all, { dataset, measure: "count", by: apartBreakdown.id, values: [], where: { [condition]: ["x"] }, view: null });
        assert.deepEqual(Object.keys(none.where), [condition], "the link's condition is kept");
        assert.equal(canvas.awaitsValues(all, { question: none, type: null }), false, `${dataset}: ${apartBreakdown.id} kept to ${condition}`);
        const fine = builder.settle(all, { dataset, measure: "count", by: heldBreakdown.id, values: [], where: { [condition]: ["x"] }, view: null });
        assert.equal(canvas.awaitsValues(all, { question: fine, type: null }), true, `${dataset}: ${heldBreakdown.id} kept to ${condition} starts on its largest values`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 2, "both datasets with a narrow table");
});
