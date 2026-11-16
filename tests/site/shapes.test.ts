// The chart rules (config/chart_rules.json, src/lib/shapes.ts, D-100): one table says which of the six shapes fit a
// question, best first. These tests hold the table to what CLAUDE.md says of it: every question fits at least one shape,
// only the six can be named, a table of the figures is always available, a shape with no renderer is never offered, no
// field lists its own charts, and the table names no domain value. Run with Node's own test runner:
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { buildQuestions } from "./support/observe.ts";

const config = await import("../../src/lib/config.ts");
const resolve = await import("../../src/lib/resolve.ts");
const builder = await import("../../src/lib/builder.ts");
const { ruleTable, shapesFor, valuesClass, needsBreakdown } = await import("../../src/lib/shapes.ts");

const SIX = ["mix", "trend", "league", "distribution", "geo", "matrix"];
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const json = (path: string) => JSON.parse(read(path));
const facts: Record<string, string[]> = ruleTable.facts;
const names = Object.keys(facts);

// Every combination of the table's facts.
function combinations(): Record<string, string>[] {
  let all: Record<string, string>[] = [{}];
  for (const name of names) all = all.flatMap((c) => facts[name].map((value) => ({ ...c, [name]: value })));
  return all;
}

test("the table names the six shapes and no others", () => {
  assert.deepEqual([...ruleTable.shapes].sort(), [...SIX].sort(), "a seventh shape needs a decision (CLAUDE.md, Shapes)");
  for (const rule of ruleTable.rules) {
    assert.ok(rule.shapes.length > 0, `${rule.id} returns no shape`);
    assert.equal(new Set(rule.shapes).size, rule.shapes.length, `${rule.id} names a shape twice`);
    for (const shape of rule.shapes) assert.ok(SIX.includes(shape), `${rule.id} names ${shape}, which is not one of the six`);
  }
});

test("every rule matches on facts and words the table defines, and the last matches everything", () => {
  const ids = ruleTable.rules.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "rule ids are unique");
  for (const rule of ruleTable.rules) {
    for (const [name, wanted] of Object.entries(rule.when)) {
      assert.ok(names.includes(name), `${rule.id} matches on ${name}, which is not a fact`);
      for (const word of [wanted].flat()) assert.ok(facts[name].includes(word as string), `${rule.id}: "${word}" is not a word for ${name}`);
    }
  }
  assert.deepEqual(ruleTable.rules.at(-1)?.when, {}, "the last rule is the one that matches every question");
});

test("every combination of the facts resolves to at least one shape, ordered and without repeats", () => {
  const all = combinations();
  assert.ok(all.length > 1000, "the whole space is walked");
  for (const c of all) {
    const shapes = shapesFor(c);
    assert.ok(shapes.length >= 1, `nothing fits ${JSON.stringify(c)}`);
    assert.equal(new Set(shapes).size, shapes.length, `a shape is named twice for ${JSON.stringify(c)}`);
    for (const s of shapes) assert.ok(SIX.includes(s), `${s} is not one of the six`);
  }
});

test("a question with a fact left out still resolves", () => {
  assert.ok(shapesFor({}).length >= 1);
  assert.ok(shapesFor({ measure: "count" }).length >= 1);
});

test("every rule is reached by some question, so each has a case", () => {
  const reached = new Set(combinations().map((c) => ruleTable.rules.find((r) => shapesFor(c) === r.shapes)?.id));
  for (const rule of ruleTable.rules) assert.ok(reached.has(rule.id), `no question is decided by ${rule.id}`);
});

test("two fields crossed fit a matrix, which has no renderer and is never offered", () => {
  const crossed = { measure: "count", by: "category", values: "many", span: "over_time", picked: "none", crossed_with: "category" };
  assert.deepEqual(shapesFor(crossed), ["matrix"]);
  assert.ok(!resolve.RENDERED_SHAPES.has("matrix"));
  assert.deepEqual(resolve.drawnShapes(crossed), [], "a shape with no renderer is not offered");
  // Crossed with time is not a matrix: time is the axis of a line.
  assert.ok(!shapesFor({ ...crossed, crossed_with: "time" }).includes("matrix"));
});

test("only shapes with a renderer are ever offered, and the first offered is the one drawn", () => {
  for (const c of combinations()) for (const s of resolve.drawnShapes(c)) assert.ok(resolve.RENDERED_SHAPES.has(s));
  for (const s of resolve.RENDERED_SHAPES) assert.ok(SIX.includes(s));
});

test("a table of the figures is available for every shape that is drawn", () => {
  // Every renderer carries its figures as a table: a disclosure on the trend and the distribution, a key table beside
  // the lines and the map, the ranking itself as a table.
  for (const shape of resolve.RENDERED_SHAPES) {
    const file = `src/components/${shape[0].toUpperCase()}${shape.slice(1)}Chart.tsx`;
    assert.ok(existsSync(new URL(`../../${file}`, import.meta.url)), `${shape} has a renderer at ${file}`);
    assert.match(read(file), /<FiguresTable|<table/, `${file} gives the figures as a table`);
  }
});

test("the renderers are not asked which chart a field wants: no measure or dimension names a shape", () => {
  const entries = [...json("config/measures.json").measures, ...json("config/measures.json").derived_measures, ...json("config/dimensions.json").dimensions];
  for (const e of entries) {
    for (const key of Object.keys(e)) assert.ok(!/^shape|chart/i.test(key), `${e.id} has a key "${key}" that names a chart`);
  }
});

test("every measure and dimension states what it is, in the words the table knows", () => {
  const measureKinds = [...config.measures, ...config.derivedMeasures];
  assert.ok(measureKinds.length >= 10);
  for (const m of measureKinds) assert.ok(facts.measure.includes(m.kind), `measure ${m.id}: kind "${m.kind}"`);
  for (const k of ruleTable.needs_breakdown) assert.ok(facts.measure.includes(k), `needs_breakdown names ${k}`);
  for (const d of config.dimensions) {
    assert.ok(facts.by.filter((w) => w !== "none").includes(d.kind), `dimension ${d.id}: kind "${d.kind}"`);
    assert.ok(Object.keys(ruleTable.value_classes).includes(d.cardinality as string), `dimension ${d.id}: cardinality "${d.cardinality}"`);
  }
  for (const word of Object.values(ruleTable.value_classes)) assert.ok(facts.values.includes(word as string), `value class ${word}`);
});

test("a dimension's kind agrees with the data map where it is a plain binding of one field", () => {
  const map = json("config/data_map.json");
  const kinds: string[] = map.enums.kind;
  const few = map.cardinality.few_max_values;
  assert.ok(Number.isInteger(few) && few > 0);
  const bound = (logical: string) => map.fields.find((f: { bound?: string }) => f.bound === logical);
  let checked = 0;
  for (const d of config.dimensions) {
    assert.ok(kinds.includes(d.kind), `dimension ${d.id}: ${d.kind} is not a kind in the data map`);
    const derive = d.derive as { kind: string; field?: string; from?: string; minus?: string };
    if (derive.kind === "raw" || derive.kind === "lookup") {
      const field = bound(derive.field as string);
      assert.ok(field, `dimension ${d.id} reads ${derive.field}, which the data map does not bind`);
      assert.equal(d.kind, field.kind, `dimension ${d.id} is a ${d.kind}; its field ${field.name} is a ${field.kind}`);
      // A lookup can merge a field's values into fewer, never split them into more.
      if (field.cardinality === "few") assert.equal(d.cardinality, "low", `${d.id}: ${field.name} has at most ${few} values`);
      if (derive.kind === "raw" && field.cardinality === "many") assert.notEqual(d.cardinality, "low", `${d.id}: ${field.name} has more than ${few} values`);
      checked++;
    } else if (derive.kind === "band") {
      assert.equal(d.kind, "ordered_band", `dimension ${d.id} is cut into bands`);
      assert.ok(Array.isArray((d as { bands?: unknown[] }).bands) && (d as { bands: unknown[] }).bands.length > 1, `${d.id} lists its bands`);
      for (const source of [derive.field, derive.from, derive.minus].filter(Boolean) as string[]) {
        const field = bound(source);
        if (field) assert.ok(["number", "time"].includes(field.kind), `${d.id}: a band is cut from a number or a year, and ${field.name} is a ${field.kind}`);
      }
      checked++;
    }
  }
  assert.ok(checked >= 8, "the plain bindings are checked");
});

test("a dimension's cardinality is what the ranking rule reads, and a count of values never decides it", () => {
  assert.equal(valuesClass("low"), "few");
  assert.equal(valuesClass("very_high"), "many");
  assert.equal(valuesClass(undefined), "few");
});

test("the table holds no domain value: no field, measure, dataset or reference value", () => {
  const text = read("config/chart_rules.json").toLowerCase();
  const words = (list: (string | undefined)[]) => list.filter((w): w is string => Boolean(w) && w!.length >= 3);
  const present = (phrase: string) => new RegExp(`(^|[^a-z0-9_])${phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9_])`).test(text);
  const ids = words([
    ...config.dimensions.map((d) => d.id),
    ...config.measures.map((m) => m.id),
    ...config.derivedMeasures.map((m) => m.id),
    ...config.datasets.map((d) => d.id),
    ...config.builderSpec.measures.map((m) => m.id),
    ...config.presets.map((p) => p.id),
  ]);
  for (const id of ids) {
    // The words the table is made of are the kinds themselves, which a measure may share its id with (a count, a share).
    if (ruleTable.facts.measure.includes(id)) continue;
    assert.ok(!present(id), `the table mentions "${id}", which config defines`);
  }
  // The values the reference files hold for the columns a visitor sees.
  const columns: Record<string, string[]> = {
    "brand_registry.csv": ["make_canonical", "parent_group", "owner_country", "heritage_country", "brand_region"],
    "powertrain_map.csv": ["nzta_motive_power", "powertrain", "powertrain_detail", "powertrain_group"],
    "segment_map.csv": ["vehicle_type", "body_type", "segment", "segment_group"],
    "tla_region.csv": ["tla", "region"],
    "import_status_map.csv": ["nzta_import_status", "import_status"],
    "vehicle_scope.csv": ["vehicle_type", "label", "scope_group"],
    "statsnz_series.csv": ["label"],
  };
  let looked = 0;
  for (const [file, wanted] of Object.entries(columns)) {
    assert.ok(readdirSync(new URL("../../data/reference/", import.meta.url)).includes(file), `${file} exists`);
    const [head, ...rows] = csv(read(`data/reference/${file}`));
    for (const column of wanted) {
      const at = head.indexOf(column);
      assert.ok(at >= 0, `${file} has a column ${column}`);
      for (const row of rows) {
        const value = (row[at] ?? "").trim();
        if (value.length < 3) continue;
        looked++;
        assert.ok(!present(value), `the table mentions "${value}", a value in ${file}`);
      }
    }
  }
  assert.ok(looked > 200, "the reference values are read");
});

test("a preset that pins its shape pins one the table says fits", () => {
  let pinned = 0;
  for (const p of config.presets) {
    if (!p.shape_override) continue;
    const view = resolve.presetView(p);
    const fitting = shapesFor(resolve.questionFacts(view, config.findDimension(view.dimension), config.findMeasure(view.measure)));
    assert.ok(fitting.includes(p.shape_override), `${p.id} pins ${p.shape_override}; the table gives ${fitting}`);
    pinned++;
  }
  assert.ok(pinned >= 2);
});

test("the resolver reports a preset pinned to a shape that does not fit as invalid, and one that fits as sound", () => {
  const dataset = config.builderSpec.dataset;
  const share = config.measures.find((m) => m.kind === "share");
  const category = config.dimensions.find((d) => d.kind === "category" && d.cardinality === "low");
  assert.ok(share && category);
  const manifest = { datasets: { [dataset]: { live_dimensions: [category.id], live_pairs: [] } } } as never;
  const base = { id: "pinned", question: "?", status: "live" as const, dataset, measure: share.id, dimension: category.id, period: "all" };
  const doesNotFit = (shape?: string) => resolve.resolvePreset({ ...base, shape_override: shape }, manifest).invalid.filter((m) => /does not fit/.test(m));
  assert.deepEqual(doesNotFit(undefined), []);
  assert.deepEqual(doesNotFit("mix"), []);
  const [message] = doesNotFit("geo");
  assert.match(message, /shape_override "geo" does not fit/);
  assert.match(message, /config\/chart_rules\.json gives mix/);
  const invalid = resolve.resolvePreset({ ...base, shape_override: "geo" }, manifest);
  assert.equal(invalid.status, "invalid");
  assert.ok(invalid.preventsRender.length > 0, "a shape that does not fit is not drawn");
});

test("every question Build can form is pinned only to shapes that fit, and offers only shapes that are drawn", () => {
  const questions = buildQuestions();
  assert.ok(questions.length > 60);
  for (const { key, question } of questions) {
    const views = builder.viewsFor(question);
    assert.ok(views.length === 0 || views.length >= 2, `${key}: a switch is offered only between two or more`);
    for (const v of views) assert.ok(resolve.RENDERED_SHAPES.has(v), `${key}: ${v} has no renderer`);
    for (const view of [null, ...views]) {
      for (const p of builder.builderPresets({ ...question, view })) {
        const facts = resolve.questionFacts(p, config.findDimension(p.dimension), config.findMeasure(p.measure));
        const fitting = shapesFor(facts);
        if (p.shape_override) assert.ok(fitting.includes(p.shape_override), `${key} view=${view}: pinned ${p.shape_override}, the table gives ${fitting}`);
        assert.ok(resolve.RENDERED_SHAPES.has(resolve.inferShape(p, config.findDimension(p.dimension), config.findMeasure(p.measure))), `${key}: the shape drawn has a renderer`);
      }
    }
    if (views.length) {
      const [first] = builder.builderPresets({ ...question, view: null });
      assert.equal(resolve.inferShape(first, config.findDimension(first.dimension), config.findMeasure(first.measure)), views[0], `${key}: the first shape offered is the one drawn`);
    }
  }
});

test("a share asked of all vehicles together is not offered, and any other measure is", () => {
  assert.equal(needsBreakdown("share"), true);
  assert.equal(needsBreakdown("count"), false);
  assert.equal(needsBreakdown(undefined), false);
  // Against a build that carries every dimension: a plain measure is offered with no breakdown unless it is a share.
  const all = config.dimensions.map((d) => d.id);
  const manifest = { datasets: { [config.builderSpec.dataset]: { live_dimensions: all, live_pairs: [], facts: { dimensions: all } } } } as never;
  const [vocabulary] = builder.builderVocabulary(manifest).datasets;
  let plain = 0;
  for (const m of vocabulary.measures) {
    const spec = config.builderSpec.measures.find((x) => x.id === m.id);
    if (spec?.parts || spec?.derived) {
      assert.equal(m.allowsTotal, false, `${m.id} is made of parts or derived`);
      continue;
    }
    assert.equal(m.allowsTotal, config.findMeasure(m.id)?.kind !== "share", `${m.id}`);
    plain++;
  }
  assert.ok(plain >= 2);
});

// A reference file's rows, quotes and all.
function csv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") (row.push(cell), (cell = ""));
    else if (c === "\n") (row.push(cell), rows.push(row), (row = []), (cell = ""));
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) (row.push(cell), rows.push(row));
  return rows;
}
