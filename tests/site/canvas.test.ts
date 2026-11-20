// The canvas's own logic (src/lib/canvas.ts, src/lib/canvasFields.ts; work order 2 section 5): what a field may do in a zone and why
// not, which chart types fit a question and why the others do not, and a canvas link loading back exactly. Run with Node's own test
// runner:
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { buildQuestions, everythingBuilt } from "./support/observe.ts";

const config = await import("../../src/lib/config.ts");
const builder = await import("../../src/lib/builder.ts");
const resolve = await import("../../src/lib/resolve.ts");
const canvas = await import("../../src/lib/canvas.ts");
const { canvasFields, sourceField } = await import("../../src/lib/canvasFields.ts");
type Question = import("../../src/lib/builder.ts").Question;
type CanvasChart = import("../../src/lib/canvas.ts").CanvasChart;
type CanvasField = import("../../src/lib/canvas.ts").CanvasField;

// A build in which every dimension made from a register field is live in every dataset that holds counts. A dimension read from another
// source's published series (the data map's derive_reads.other_source_kinds) is in no such dataset in a real build, so it is left out.
const everything = everythingBuilt();
const elsewhere: string[] = JSON.parse(readFileSync(new URL("../../config/data_map.json", import.meta.url), "utf8")).derive_reads.other_source_kinds;
const fromRegister = (ids: string[]) => ids.filter((id) => !elsewhere.includes(config.findDimension(id)?.derive?.kind ?? ""));
const manifest = {
  datasets: Object.fromEntries(
    Object.entries(everything.datasets).map(([id, entry]) => [
      id,
      { ...entry, live_dimensions: fromRegister(entry.live_dimensions), facts: { ...entry.facts, dimensions: fromRegister(entry.facts?.dimensions ?? []) } },
    ]),
  ),
} as unknown as import("../../src/lib/data.ts").Manifest;
const all = canvas.canvasVocabulary(builder.builderVocabulary(manifest));
const groups = canvasFields(all, manifest);
const fields = new Map<string, CanvasField>(groups.flatMap((g) => g.fields.map((f): [string, CanvasField] => [f.id, f])));
const field = (id: string): CanvasField => fields.get(id) as CanvasField;
const first = all.datasets[0];
const ask = (q: Partial<Question>): Question => ({ ...builder.settle(all, { dataset: first.dataset, ...q }), view: null });
const words = canvas.canvasSpec.words;
// A reason is one of the canvas's templates, filled: no placeholder left over and nothing unresolved.
const filled = (text: string | undefined) => Boolean(text) && !/[{}]/.test(text as string) && !(text as string).includes("?");
// Every question the Build page can form that a canvas can hold: one chart each.
const questions = buildQuestions().filter(({ question }) => builder.isOneChart(question.measure)).map(({ key, question }) => ({ key, question: ask(question) }));

// Dimensions picked by what they are, never by name: the first the first dataset's measures offer of each kind.
const offeredBy = (measure: string) => first.measures.find((m) => m.id === measure)?.dimensions ?? [];
const dimensionOf = (measure: string, test: (d: import("../../src/lib/config.ts").Dimension) => boolean) =>
  offeredBy(measure).map((d) => config.findDimension(d.id)).find((d) => d && test(d))?.id as string;
const many = (measure: string) => dimensionOf(measure, (d) => d.kind === "category" && ["high", "very_high"].includes(d.cardinality ?? ""));
const few = (measure: string) => dimensionOf(measure, (d) => d.kind === "category" && d.cardinality === "low");
const banded = (measure: string) => dimensionOf(measure, (d) => d.kind === "ordered_band");
const place = (measure: string) => dimensionOf(measure, (d) => d.kind === "place");

test("the canvas offers every dataset the builder does, with the measures drawn as one chart", () => {
  const whole = builder.builderVocabulary(manifest);
  assert.deepEqual(all.datasets.map((v) => v.dataset), whole.datasets.map((v) => v.dataset));
  for (const v of all.datasets) for (const m of v.measures) assert.ok(builder.isOneChart(m.id), `${m.id} is drawn as more than one chart`);
  const parts = whole.datasets.flatMap((v) => v.measures).find((m) => !builder.isOneChart(m.id));
  assert.ok(parts, "the builder has a measure of two parts to leave out");
  const settled = builder.settle(all, { measure: parts.id });
  assert.equal(settled.measure, all.datasets[0].measures[0].id, "a link naming a measure of two parts settles to the first the canvas offers");
});

// ---- The field list ----

test("every field the canvas lists is in exactly one group of config, with a definition, and the time field is among them", () => {
  const listed = groups.flatMap((g) => g.fields);
  assert.equal(new Set(listed.map((f) => f.id)).size, listed.length, "a field is listed twice");
  const known = new Set(canvas.canvasSpec.groups.map((g) => g.id));
  for (const g of groups) assert.ok(known.has(g.id) && g.label);
  for (const f of listed) {
    assert.ok(f.label && f.definition, `${f.id} has no label or no definition`);
    assert.ok(f.definition.length <= 200, `${f.id}: a definition is one line`);
  }
  assert.ok(fields.has(canvas.TIME_FIELD));
  // The list is the dimensions the build carries and the time field: nothing else, and none a chart can use left out.
  const live = all.datasets.flatMap((v) => manifest.datasets[v.dataset].live_dimensions);
  assert.deepEqual(new Set(listed.map((f) => f.id)), new Set([canvas.TIME_FIELD, ...live]));
  const offered = all.datasets.flatMap((v) => [...v.measures.flatMap((m) => m.dimensions.map((d) => d.id)), ...v.filters.map((f) => f.id)]);
  for (const id of offered) assert.ok(fields.has(id), `${id} is offered to a chart and is not in the field list`);
});

test("a field a chart can use that config puts in no group stops the page being built, and the message names it", () => {
  // The untrimmed test build offers the dimensions read from another source as filters; they have no register field, so no map group.
  const whole = canvas.canvasVocabulary(builder.builderVocabulary(everything));
  assert.throws(
    () => canvasFields(whole, everything),
    (error: Error) => {
      const named = /puts the field "([a-z_]+)" in no group/.exec(error.message)?.[1];
      return Boolean(named && elsewhere.includes(config.findDimension(named)?.derive?.kind ?? "") && !(named in canvas.canvasSpec.group_of));
    },
  );
});

test("a field's group comes from the data map: the group of the register field it is made from, or the hand placement in config", () => {
  const spec = canvas.canvasSpec;
  for (const d of config.dimensions.filter((x) => fields.has(x.id))) {
    const byHand = spec.group_of[d.id];
    const source = sourceField(d);
    assert.ok(byHand || source, `${d.id}: no register field found, and no group by hand`);
    const expected = byHand ?? spec.groups.find((g) => g.map_groups.includes(source?.group ?? "") && (!g.kinds || g.kinds.includes(d.kind)))?.id;
    assert.equal(field(d.id).group, expected);
  }
  for (const id of Object.keys(spec.group_of)) assert.ok(config.findDimension(id), `group_of names ${id}, which is not a dimension`);
});

test("a field's definition is its dimension's own help line, or the shorter line config keeps for it; the month names its register fields", () => {
  const spec = canvas.canvasSpec;
  const shorter = Object.keys(spec.definitions).filter((k) => !k.startsWith("$"));
  for (const id of shorter) assert.ok(config.findDimension(id), `definitions names ${id}, which is not a dimension`);
  for (const d of config.dimensions.filter((x) => fields.has(x.id))) {
    assert.ok(spec.definitions[d.id] ?? d.help, `${d.id} has no help line and no shorter one`);
    assert.equal(field(d.id).definition, spec.definitions[d.id] ?? d.help);
  }
  // A shorter line is kept only where it is needed: the help line would not fit a line of the list, or it is one of the few written for a maintainer.
  assert.ok(shorter.length <= 6, "config/canvas.json is not a second copy of the help lines");
  const map = JSON.parse(readFileSync(new URL("../../config/data_map.json", import.meta.url), "utf8")).fields as { name: string; kind: string }[];
  assert.ok(spec.time_field.map_fields.length > 0);
  for (const name of spec.time_field.map_fields) assert.equal(map.find((f) => f.name === name)?.kind, spec.time_field.kind, `${name} is not a field of time in the data map`);
  assert.equal(field(canvas.TIME_FIELD).definition, spec.time_field.definition);
});

// ---- What a field may do in a zone ----

test("a field the measure offers goes into the breakdown, and one already there is refused with a reason", () => {
  const by = many("share");
  const other = few("share");
  const q = ask({ measure: "share", by });
  const moved = canvas.verdict(all, q, "by", field(other));
  assert.ok(moved.ok && moved.change.by === other && moved.replaces === by);
  const again = canvas.verdict(all, q, "by", field(by));
  assert.ok(!again.ok && filled(again.reason));
});

test("every refusal is a filled sentence, for every field in every zone of every question", () => {
  for (const { key, question } of questions) {
    for (const f of fields.values()) {
      for (const zone of canvas.ZONES) {
        const v = canvas.verdict(all, question, zone, f);
        if (!v.ok) assert.ok(filled(v.reason), `${key}: ${f.id} in ${zone} gives “${v.reason}”`);
      }
    }
  }
});

test("a field that is accepted makes a question the data can answer, with the field where it was put", () => {
  for (const { key, question } of questions) {
    const chart: CanvasChart = { id: "c1", question, type: null, table: false, width: "half" };
    for (const f of fields.values()) {
      for (const zone of canvas.FIELD_ZONES) {
        const v = canvas.verdict(all, question, zone, f);
        if (!v.ok) continue;
        const after = canvas.changeChart(all, chart, v.change, manifest).question;
        const where = `${key}: ${f.id} into ${zone}`;
        if (zone === "by") assert.equal(after.by, f.id, where);
        if (zone === "by2") assert.equal(after.by2, f.id, where);
        if (zone === "where") assert.ok(f.id in after.where, where);
        const preset = canvas.chartPreset({ id: "c1", question: after, type: null });
        assert.ok(preset && resolve.resolvePreset(preset, manifest).preventsRender.length === 0, `${where} cannot be drawn`);
      }
    }
  }
});

test("the time field goes in the period and nowhere else, and no field goes in the dataset", () => {
  const q = ask({ measure: "share" });
  const time = field(canvas.TIME_FIELD);
  assert.ok(canvas.verdict(all, q, "period", time).ok);
  for (const zone of ["by", "by2", "where", "measure", "dataset"] as const) assert.ok(!canvas.verdict(all, q, zone, time).ok, zone);
  const other = field(few("share"));
  assert.ok(!canvas.verdict(all, q, "period", other).ok);
  assert.ok(!canvas.verdict(all, q, "dataset", other).ok);
});

test("no field is a measure yet, and the reason tells a number the map lets be averaged from a field that is not a number", () => {
  const q = ask({ measure: "count", by: null });
  const number = [...fields.values()].find((f) => f.averageable) as CanvasField;
  const category = [...fields.values()].find((f) => !f.averageable && f.id !== canvas.TIME_FIELD) as CanvasField;
  assert.ok(number && category, "the map has a number that can be averaged, and a field that is not one");
  const a = canvas.verdict(all, q, "measure", number);
  const b = canvas.verdict(all, q, "measure", category);
  assert.ok(!a.ok && !b.ok);
  assert.equal(!a.ok && a.reason, canvas.say("refuse_average_unpublished", { field: number.label }));
  assert.equal(!b.ok && b.reason, canvas.say("refuse_not_a_number", { field: category.label }));
});

test("a second field needs a first, is not the first, and is not one nested under it", () => {
  const total = ask({ measure: "count", by: null });
  const by = many("count");
  const none = canvas.verdict(all, total, "by2", field(by));
  assert.equal(!none.ok && none.reason, canvas.say("refuse_needs_by", { zone: canvas.zoneLabel("by") }));
  const q = ask({ measure: "count", by });
  assert.ok(!canvas.verdict(all, q, "by2", field(by)).ok);
  const main = offeredBy("count").find((d) => d.id === by);
  const crossable = main?.with[0] as string;
  const crossed = canvas.verdict(all, q, "by2", field(crossable));
  assert.ok(crossed.ok && crossed.change.by2 === crossable);
  const nested = offeredBy("count").find((d) => d.id !== by && !builder.canCross(by, d.id));
  assert.ok(nested, "config has a pair of fields that nest");
  const refused = canvas.verdict(all, q, "by2", field(nested.id));
  assert.equal(!refused.ok && refused.reason, canvas.say("refuse_nested", { field: field(nested.id).label, other: field(by).label }));
});

test("a filter starts with no value and is held; a breakdown's own field is not a filter; a filter made the breakdown keeps its values", () => {
  const by = few("share");
  const other = many("share");
  const q = ask({ measure: "share", by });
  const chart: CanvasChart = { id: "c1", question: q, type: null, table: false, width: "half" };
  const own = canvas.verdict(all, q, "where", field(by));
  assert.equal(!own.ok && own.reason, canvas.say("refuse_is_breakdown", { field: field(by).label, zone: canvas.zoneLabel("by") }));
  const added = canvas.verdict(all, q, "where", field(other));
  assert.ok(added.ok);
  const held = canvas.changeChart(all, chart, added.ok ? added.change : {}, manifest);
  assert.deepEqual(held.question.where[other], [], "the empty filter stays on the page until it has a value");
  assert.equal(canvas.canvasParams({ charts: [held] }).has(`c1.where.${other}`), false, "and is not in the address");
  const valued = canvas.changeChart(all, held, { where: { ...held.question.where, [other]: ["a", "b"] } }, manifest);
  const moved = canvas.verdict(all, valued.question, "by", field(other));
  const after = canvas.changeChart(all, valued, moved.ok ? moved.change : {}, manifest).question;
  assert.equal(after.by, other);
  assert.deepEqual(after.values, ["a", "b"], "the filter's values become the values compared");
  assert.ok(!(other in after.where));
});

test("a field no dataset offers is listed with why, and is refused with that reason", () => {
  const offered = new Set(all.datasets.flatMap((v) => [...v.measures.flatMap((m) => m.dimensions.map((d) => d.id)), ...v.filters.map((f) => f.id)]));
  for (const f of fields.values()) {
    if (f.id === canvas.TIME_FIELD) continue;
    assert.equal(Boolean(f.unavailable), !offered.has(f.id), f.id);
    if (!f.unavailable) continue;
    assert.ok(words[f.unavailable], `${f.id}: ${f.unavailable} is not one of the canvas's words`);
    const q = ask({ measure: "share" });
    for (const zone of canvas.FIELD_ZONES) {
      const v = canvas.verdict(all, q, zone, f);
      assert.ok(!v.ok);
    }
    assert.equal(canvas.usable(all, q, f), false);
  }
});

// ---- Field to chart type ----

const typesOf = (q: Question) => canvas.chartTypes(all, q, manifest);
const fitting = (q: Question) => typesOf(q).filter((t) => t.fits).map((t) => t.id);

test("every question has a best fit, listed first, and every type that does not fit says why", () => {
  const six = canvas.canvasSpec.chart_types.map((t) => t.id);
  for (const { key, question } of questions) {
    const types = typesOf(question);
    assert.deepEqual([...types.map((t) => t.id)].sort(), [...six].sort(), key);
    assert.ok(types[0].fits && types[0].best && types[0].id === canvas.bestType(question), `${key}: the best fit is not first`);
    assert.equal(types.filter((t) => t.best).length, 1, key);
    const firstUnfit = types.findIndex((t) => !t.fits);
    assert.ok(firstUnfit === -1 || types.slice(firstUnfit).every((t) => !t.fits), `${key}: a type that fits is listed after one that does not`);
    for (const t of types) assert.equal(t.fits, t.reason === undefined, `${key} ${t.id}`);
    for (const t of types.filter((x) => !x.fits)) assert.ok(filled(t.reason), `${key}: ${t.id} gives “${t.reason}”`);
  }
});

test("a type the picker offers is the chart that is drawn, and one it greys is never drawn", () => {
  for (const { key, question } of questions) {
    for (const t of typesOf(question)) {
      const preset = canvas.chartPreset({ id: "c1", question, type: t.id });
      const resolution = preset ? resolve.resolvePreset(preset, manifest) : undefined;
      const drawn = Boolean(resolution && resolution.preventsRender.length === 0 && resolution.shape === t.id);
      assert.equal(drawn, t.fits, `${key}: ${t.id}`);
      // A chart whose type no longer fits falls back to the best fit, so a greyed type is never on a canvas.
      const kept = canvas.withFittingTypes({ charts: [{ id: "c1", question, type: t.id, table: false, width: "half" }] }, manifest).charts[0].type;
      assert.equal(kept, t.fits ? t.id : null, `${key}: ${t.id}`);
    }
  }
});

test("a share by a long list is lines of shares or a ranking; the lines of counts say they need another measure", () => {
  const q = ask({ measure: "share", by: many("share") });
  assert.deepEqual(fitting(q), ["mix", "league"]);
  // The reason names the measures of this dataset the type would show, as the Measure zone names them.
  const trend = typesOf(q).find((t) => t.id === "trend");
  const count = first.measures.find((m) => m.id === "count") as (typeof first.measures)[number];
  assert.ok(trend?.reason?.includes(canvas.measureLabel(count)), trend?.reason);
  const grid = typesOf(q).find((t) => t.id === "matrix");
  assert.equal(grid?.reason, canvas.say("why_crossed", { type: grid?.label, zone: canvas.zoneLabel("by2") }));
});

test("a share by a short list is not ranked, and says the list is short", () => {
  const by = few("share");
  const q = ask({ measure: "share", by });
  assert.deepEqual(fitting(q), ["mix"]);
  const ranking = typesOf(q).find((t) => t.id === "league");
  assert.equal(ranking?.reason, canvas.say("why_values", { type: ranking?.label, field: field(by).label }));
});

test("a count of chosen values is lines or a ranking of two or more; one value is not ranked", () => {
  const by = many("count");
  assert.deepEqual(fitting(ask({ measure: "count", by, values: ["a", "b", "c"] })), ["trend", "league"]);
  const one = ask({ measure: "count", by, values: ["a"] });
  assert.deepEqual(fitting(one), ["trend"]);
  const ranking = typesOf(one).find((t) => t.id === "league");
  assert.equal(ranking?.reason, canvas.say("why_picked", { type: ranking?.label, field: field(by).label }));
  // With no values of the visitor's own, the ranking is of every value: the page's starting values are for the lines.
  const page = { ...ask({ measure: "count", by }), values: ["a", "b", "c", "d", "e"], pageValues: true };
  assert.deepEqual(fitting(page), ["trend", "league"]);
  const ranked = canvas.chartPreset({ id: "c1", question: page, type: "league" });
  assert.equal(ranked?.values, undefined);
  const lines = canvas.chartPreset({ id: "c1", question: page, type: null });
  assert.deepEqual(lines?.values, page.values);
});

test("a share by ordered bands is bands or lines; a share by a place is a map or lines; a total is one line", () => {
  assert.deepEqual(fitting(ask({ measure: "share", by: banded("share") })), ["distribution", "mix"]);
  const where = place("share");
  if (where) assert.deepEqual(fitting(ask({ measure: "share", by: where })), ["geo", "mix"]);
  const total = ask({ measure: "count", by: null });
  assert.deepEqual(fitting(total), ["trend"]);
  const ranking = typesOf(total).find((t) => t.id === "league");
  assert.ok(ranking?.reason?.includes(canvas.zoneLabel("by")), ranking?.reason);
});

test("two fields are a grid and nothing else, and every other type says which field to take away", () => {
  const by = many("count");
  const by2 = offeredBy("count").find((d) => d.id === by)?.with[0] as string;
  const q = ask({ measure: "count", by, by2 });
  assert.equal(q.by2, by2);
  assert.deepEqual(fitting(q), ["matrix"]);
  for (const t of typesOf(q).filter((x) => !x.fits)) {
    assert.equal(t.reason, canvas.say("why_second_field", { type: t.label, field: field(by2).label, zone: canvas.zoneLabel("by2") }));
  }
});

test("a chart's shape is always pinned, so the panel's time row never turns it into another type", () => {
  for (const { key, question } of questions) {
    const preset = canvas.chartPreset({ id: "c1", question, type: null });
    assert.ok(preset, key);
    const shape = resolve.resolvePreset(preset, manifest).shape;
    for (const period of config.periods.map((p) => p.id).filter((p) => resolve.fitsPin(preset, p))) {
      assert.equal(resolve.resolvePreset(resolve.presetView(preset, null, period), manifest).shape, shape, `${key}: ${period}`);
    }
  }
});

// ---- The address ----

const sample = (): CanvasChart[] => {
  const picked = questions.filter((_, i) => i % 7 === 0).slice(0, canvas.canvasSpec.max_charts - 2);
  const charts = picked.map(({ question }, i): CanvasChart => {
    const fits = fitting(question);
    return { id: `c${i * 2 + 1}`, question, type: i % 3 === 0 ? null : fits[i % fits.length], table: i % 4 === 1, width: i % 2 ? "full" : "half" };
  });
  const by = many("count");
  const other = few("count");
  // Values and conditions that hold what an address must carry unharmed.
  const awkward = ask({ measure: "count", by, values: ["A&B=C", "D, E", "é / ü", "100%", "a+b"], where: { [other]: ["x y", "z&w"] } });
  return [...charts, { id: "c90", question: awkward, type: "league", table: true, width: "full" }];
};

test("a canvas link loads back exactly: the same charts in the same order, with their questions, types, tables and widths", () => {
  const charts = sample();
  assert.ok(charts.length >= 5);
  const built = { charts };
  const link = `?${canvas.canvasParams(built)}`;
  const back = canvas.withFittingTypes(canvas.settleCanvas(all, canvas.readCanvas(link)), manifest);
  assert.deepEqual(back, built);
  // And again from what it loaded: one canvas has one address.
  assert.equal(String(canvas.canvasParams(back)), String(canvas.canvasParams(built)));
  // In any order of charts, the order is the link's.
  const reversed = { charts: [...charts].reverse() };
  assert.deepEqual(canvas.settleCanvas(all, canvas.readCanvas(`?${canvas.canvasParams(reversed)}`)).charts.map((c) => c.id), reversed.charts.map((c) => c.id));
});

test("a link with no chart opens one, at full width; a link naming more than the limit keeps the first; an id that is not one is left out", () => {
  const cold = canvas.settleCanvas(all, canvas.readCanvas(""));
  assert.equal(cold.charts.length, 1);
  assert.equal(cold.charts[0].width, "full");
  assert.deepEqual(cold.charts[0].question, ask({}));
  const max = canvas.canvasSpec.max_charts;
  const ids = Array.from({ length: max + 3 }, (_, i) => `c${i + 1}`);
  assert.equal(canvas.readCanvas(`?canvas.charts=${ids.join(",")}`).length, max);
  assert.deepEqual(canvas.readCanvas("?canvas.charts=c1,build,c0,constructor,c2,c1,x9").map((c) => c.id), ["c1", "c2"]);
  assert.equal(canvas.nextChartId([{ id: "c1" }, { id: "c7" }, { id: "c3" }]), "c8");
});

test("writing the address keeps an unchanged chart's own settings, clears a changed chart's, drops a removed chart, and leaves other parameters", () => {
  const [a, b] = sample();
  const before = `?utm=x&canvas.charts=c1,c3,c9&${canvas.canvasParams({ charts: [a, b] })}&${a.id}.period=5y&${b.id}.period=3y&${b.id}.month=2020-01&c9.measure=share&c9.period=10y`;
  const after = canvas.canvasAddress(before, { charts: [a, b] }, new Set([b.id]));
  assert.equal(after.get("utm"), "x");
  assert.equal(after.get(`${a.id}.period`), "5y");
  assert.equal(after.has(`${b.id}.period`), false);
  assert.equal(after.has(`${b.id}.month`), false);
  assert.equal([...after.keys()].some((k) => k.startsWith("c9.")), false);
  assert.deepEqual(after.getAll("canvas.charts"), [`${a.id},${b.id}`]);
  const read = canvas.withFittingTypes(canvas.settleCanvas(all, canvas.readCanvas(`?${after}`)), manifest);
  assert.deepEqual(read, { charts: [a, b] });
});

test("nothing a visitor types is in the address: a canvas's parameters are its charts' ids, their questions and their settings", () => {
  const params = canvas.canvasParams({ charts: sample() });
  const names = new Set(["measure", "by", "dataset", "value", "by2", "value2", "widen", "snapshot", "type", "show", "size"]);
  for (const key of params.keys()) {
    const [scope, ...rest] = key.split(".");
    assert.ok(scope === "canvas" ? rest.join(".") === "charts" : canvas.isChartId(scope) && (names.has(rest[0]) || rest[0] === "where"), key);
  }
});

// ---- The page: charts added, copied, removed and moved ----

const ids = (c: { charts: CanvasChart[] }) => c.charts.map((chart) => chart.id);
// What a link to a canvas opens: the canvas itself, whatever was done to it.
const reopened = (c: { charts: CanvasChart[] }) => canvas.withFittingTypes(canvas.settleCanvas(all, canvas.readCanvas(`?${canvas.canvasParams(c)}`)), manifest);

test("a chart is added after the last and copied after the one it copies, each under an id no chart has; a full canvas takes neither", () => {
  const start = { charts: sample().slice(0, 3) };
  const added = canvas.addChart(all, start);
  assert.ok(added);
  assert.deepEqual(ids(added.canvas), [...ids(start), added.id]);
  assert.ok(!ids(start).includes(added.id));
  const made = added.canvas.charts[3];
  assert.deepEqual({ question: made.question, type: made.type, table: made.table, width: made.width }, { question: ask({}), type: null, table: false, width: "half" });

  const copied = canvas.duplicateChart(start, start.charts[1].id);
  assert.ok(copied);
  assert.deepEqual(ids(copied.canvas), [start.charts[0].id, start.charts[1].id, copied.id, start.charts[2].id]);
  assert.ok(!ids(start).includes(copied.id));
  assert.deepEqual({ ...copied.canvas.charts[2], id: start.charts[1].id }, start.charts[1]);
  assert.equal(canvas.duplicateChart(start, "c999"), null);
  assert.deepEqual(reopened(added.canvas), added.canvas);
  assert.deepEqual(reopened(copied.canvas), copied.canvas);

  let full = start;
  while (!canvas.isFull(full)) full = canvas.addChart(all, full)?.canvas as typeof full;
  assert.equal(full.charts.length, canvas.canvasSpec.max_charts);
  assert.equal(canvas.addChart(all, full), null);
  assert.equal(canvas.duplicateChart(full, full.charts[0].id), null);
  assert.deepEqual(reopened(full), full);
});

test("a chart removed can be put back where it was; a canvas keeps its one chart; an id given away since is not put back", () => {
  const start = { charts: sample().slice(0, 3) };
  const [, middle] = start.charts;
  const without = canvas.removeChart(start, middle.id);
  assert.deepEqual(ids(without), [start.charts[0].id, start.charts[2].id]);
  assert.deepEqual(canvas.restoreChart(without, middle, 1), start);
  assert.equal(canvas.removeChart(start, "c999"), start);
  const one = { charts: [middle] };
  assert.equal(canvas.removeChart(one, middle.id), one);
  assert.equal(canvas.restoreChart(start, middle, 0), null);
});

test("a chart moved takes the place it is moved to and the others keep their order, in the link too", () => {
  const start = { charts: sample().slice(0, 4) };
  const [a, b, c, d] = ids(start);
  assert.deepEqual(ids(canvas.moveChart(start, a, 2)), [b, c, a, d]);
  assert.deepEqual(ids(canvas.moveChart(start, d, 0)), [d, a, b, c]);
  assert.deepEqual(ids(canvas.moveChart(start, c, 1)), [a, c, b, d]);
  // Past either end is the end; a chart moved to its own place, or one that is not there, leaves the canvas as it was.
  assert.deepEqual(ids(canvas.moveChart(start, b, 99)), [a, c, d, b]);
  assert.deepEqual(ids(canvas.moveChart(start, b, -5)), [b, a, c, d]);
  assert.equal(canvas.moveChart(start, b, 1), start);
  assert.equal(canvas.moveChart(start, "c999", 0), start);
  const moved = canvas.moveChart(start, a, 3);
  assert.deepEqual(reopened(moved), moved);
});

test("a copy starts with the chart's own settings, and a chart put back gets its own back; neither touches another chart's", () => {
  const start = { charts: sample().slice(0, 2) };
  const [a, b] = start.charts;
  const before = `?utm=x&${canvas.canvasParams(start)}&${a.id}.period=5y&${a.id}.month=2020-01&${b.id}.period=3y`;
  const copied = canvas.duplicateChart(start, a.id);
  assert.ok(copied);
  const settings = canvas.chartSettings(before, a.id);
  assert.deepEqual(settings, [["period", "5y"], ["month", "2020-01"]]);
  const after = canvas.canvasAddress(canvas.withChartSettings(before, copied.id, settings), copied.canvas);
  assert.equal(after.get(`${copied.id}.period`), "5y");
  assert.equal(after.get(`${copied.id}.month`), "2020-01");
  assert.equal(after.get(`${a.id}.period`), "5y");
  assert.equal(after.get(`${b.id}.period`), "3y");
  assert.equal(after.get("utm"), "x");

  // Removed, the chart's settings leave the address with it; put back, they are the ones it had, whatever the address holds by then.
  const gone = canvas.canvasAddress(before, canvas.removeChart(start, a.id));
  assert.equal([...gone.keys()].some((k) => k.startsWith(`${a.id}.`)), false);
  const back = canvas.canvasAddress(canvas.withChartSettings(`?${gone}&${a.id}.period=1y`, a.id, settings), start);
  assert.deepEqual(back.getAll(`${a.id}.period`), ["5y"]);
  assert.equal(back.get(`${a.id}.month`), "2020-01");
  // A setting that is not a chart's own is not written.
  assert.equal(new URLSearchParams(canvas.withChartSettings("", a.id, [["measure", "share"]])).has(`${a.id}.measure`), false);
});

// ---- The words ----

test("every word the canvas says is in config, and config holds no word the canvas does not say", () => {
  const dir = new URL("../../src/components/canvas/", import.meta.url);
  const sources = [
    readFileSync(new URL("../../src/lib/canvas.ts", import.meta.url), "utf8"),
    readFileSync(new URL("../../src/lib/canvasFields.ts", import.meta.url), "utf8"),
    readFileSync(new URL("../../src/pages/canvas.astro", import.meta.url), "utf8"),
    ...readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).map((f) => readFileSync(new URL(f, dir), "utf8")),
  ].join("\n");
  const said = new Set([...sources.matchAll(/\b(?:say|refuse)\(\s*["`]([a-z0-9_]+)["`]/g), ...sources.matchAll(/canvasSpec\.words\.([a-z0-9_]+)/g)].map((m) => m[1]));
  // Keys made from a zone's own id: its name, and what a drop on it would do where it takes a field.
  for (const zone of canvas.ZONES) said.add(`zone_${zone}`);
  for (const zone of [...canvas.FIELD_ZONES, "period"]) said.add(`drop_${zone}`);
  for (const width of canvas.WIDTHS) said.add(`width_${width}`);
  for (const key of [...sources.matchAll(/"((?:refuse|why|status)_[a-z0-9_]+)"/g)].map((m) => m[1])) said.add(key);
  const held = Object.keys(words).filter((k) => !k.startsWith("$"));
  for (const key of said) assert.ok(key in words, `${key} is said and is not in config/canvas.json`);
  for (const key of held) assert.ok(said.has(key), `${key} is in config/canvas.json and nothing says it`);
});
