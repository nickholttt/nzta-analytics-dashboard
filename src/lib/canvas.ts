// The canvas: a page of charts a visitor builds by putting fields into each chart's zones (work order 2 section 5; D-138, D-147).
// A chart on a canvas is a Build question (src/lib/builder.ts) under an id of its own, with the chart type the visitor chose, whether
// its figures are shown as a table, and a width. This module is the canvas's own logic and is pure: what a field may do in a zone and,
// where it may not, why; which chart types fit a question and why the others do not; and the address a canvas is written to and read
// back from. It names no field, measure, dataset or value: the words are config/canvas.json's, the rules are the builder's and the
// chart rule table's.
import canvasDoc from "../../config/canvas.json";
import { dimensionLabel, dimensions, findDataset, findDerived, findDimension, findMeasure } from "./config";
import type { Preset } from "./config";
import { CHART_PARAMS, MATRIX, RANKING, builderPresets, canCross, changeQuestion, isOneChart, questionParams, readQuestion, settle } from "./builder";
import type { BuilderOption, DatasetVocabulary, Question, Vocabulary } from "./builder";
import type { Manifest } from "./data";
import { inferShape, questionFacts, resolvePreset } from "./resolve";
import { isWindowShape, ruleTable, shapesFor } from "./shapes";
import type { FactName, Facts } from "./shapes";
import { fillTemplate } from "./sentences";

export type FieldGroupSpec = { id: string; label: string; map_groups: string[]; kinds?: string[] };
export type ChartTypeSpec = { id: string; label: string; help: string };
export type CanvasSpec = {
  id: string;
  chart_prefix: string;
  max_charts: number;
  time_field: { id: string; map_fields: string[]; group: string; kind: string; label: string; definition: string };
  groups: FieldGroupSpec[];
  group_of: Record<string, string>;
  definitions: Record<string, string>;
  measures: Record<string, string>;
  measure_kinds: Record<string, string>;
  kinds: Record<string, string>;
  chart_types: ChartTypeSpec[];
  table: ChartTypeSpec;
  words: Record<string, string>;
};

export const canvasSpec = canvasDoc as unknown as CanvasSpec;
// The time field's id, and the id of the choice that shows a chart's figures as a table.
export const TIME_FIELD = canvasSpec.time_field.id;
export const TABLE = canvasSpec.table.id;

// One of the canvas's words, filled. A key config does not have reads as nothing, and the template lint holds every key that is there.
export const say = (key: string, context: Record<string, unknown> = {}): string => fillTemplate(canvasSpec.words[key] ?? "", context).text;

// ---- A chart, and a canvas ----

export type Width = "half" | "full";
export const WIDTHS: readonly Width[] = ["half", "full"];

export type CanvasChart = {
  // Scopes the chart's question and its own settings in the address (c1, c2, ...). Given when the chart is made and never reused on a canvas.
  id: string;
  // The question, settled. Its view is not used: the chart type is `type`.
  question: Question;
  // The shape the visitor chose, where it fits the question; null draws the best fit.
  type: string | null;
  // The figures as a table, in place of the picture.
  table: boolean;
  width: Width;
};
export type Canvas = { charts: CanvasChart[] };

// A field of the field list, made at build time from the data map (src/lib/canvasFields.ts) and handed to the page as plain data.
export type CanvasField = {
  // A dimension's id, or the time field's.
  id: string;
  label: string;
  group: string;
  kind: string;
  definition: string;
  // The data map lets the number this field is made from be averaged. No average is published yet, so this only chooses the reason given.
  averageable: boolean;
  // Why no chart can use the field yet, as a key of the canvas's words, where no dataset offers it as a breakdown or a filter.
  unavailable?: string;
};
export type CanvasFieldGroup = { id: string; label: string; fields: CanvasField[] };

// What a canvas offers of each dataset: the measures drawn as one chart. A measure of two parts is two charts on the Build page; on a
// canvas the visitor adds a chart for each, so a link that names one settles to the dataset's first measure.
export const canvasVocabulary = (all: Vocabulary): Vocabulary => ({
  ...all,
  datasets: all.datasets.map((v) => ({ ...v, measures: v.measures.filter((m) => isOneChart(m.id)) })).filter((v) => v.measures.length > 0),
});

const datasetOf = (all: Vocabulary, id: string): DatasetVocabulary => all.datasets.find((v) => v.dataset === id) ?? all.datasets[0];
const measureOf = (v: DatasetVocabulary, id: string): BuilderOption => v.measures.find((m) => m.id === id) ?? v.measures[0];

// ---- Names, as the canvas says them ----

export const fieldLabel = (id: string): string => (id === TIME_FIELD ? canvasSpec.time_field.label : (dimensionLabel(id) ?? id));
export const datasetLabel = (id: string): string => findDataset(id)?.public_label ?? findDataset(id)?.label ?? id;
// A measure as the Measure zone names it: the canvas's own words, else the builder's phrase for it.
export const measureLabel = (m: Pick<BuilderOption, "id" | "phrase">): string => {
  const words = canvasSpec.measures[m.id];
  return words ? fillTemplate(words, { top_n: findDerived(m.id)?.top_n ?? "" }).text : m.phrase;
};
export type Zone = "dataset" | "measure" | "by" | "by2" | "where" | "period";
export const ZONES: readonly Zone[] = ["dataset", "measure", "by", "by2", "where", "period"];
// The zones a field of the list can be put in without dragging: the ones that hold fields.
export const FIELD_ZONES: readonly Zone[] = ["by", "by2", "where"];
export const zoneLabel = (zone: Zone): string => say(`zone_${zone}`);
const typeLabel = (id: string): string => (id === TABLE ? canvasSpec.table.label : (canvasSpec.chart_types.find((t) => t.id === id)?.label ?? id));

// ---- What a field may do in a zone ----

// ok: the change to the question that puts the field there, and the field it replaces, if any. Otherwise the reason, in words.
export type Verdict = { ok: true; change: Partial<Question>; replaces?: string } | { ok: false; reason: string };

export function verdict(all: Vocabulary, q: Question, zone: Zone, field: CanvasField): Verdict {
  const v = datasetOf(all, q.dataset);
  const m = measureOf(v, q.measure);
  const names = { field: field.label, dataset: datasetLabel(v.dataset), measure: measureLabel(m), zone: zoneLabel(zone) };
  const refuse = (key: string, more: Record<string, unknown> = {}): Verdict => ({ ok: false, reason: say(key, { ...names, ...more }) });

  if (zone === "period") return field.id === TIME_FIELD ? { ok: true, change: {} } : refuse("refuse_period_field");
  if (zone === "dataset") return refuse("refuse_dataset_zone");
  if (field.id === TIME_FIELD) return refuse("refuse_time", { zone: zoneLabel("period") });
  if (zone === "measure") return refuse(field.averageable ? "refuse_average_unpublished" : "refuse_not_a_number");

  const offered = m.dimensions.find((d) => d.id === field.id);
  const filters = v.filters.some((f) => f.id === field.id);
  const brokenDownElsewhere = v.measures.some((o) => o.dimensions.some((d) => d.id === field.id));
  // Why this measure of this dataset does not break down by the field.
  const noBreakdown = (): Verdict =>
    field.unavailable ? refuse(field.unavailable) : brokenDownElsewhere ? refuse("refuse_not_for_measure") : filters ? refuse("refuse_filter_field") : refuse("refuse_not_in_dataset");

  if (zone === "by") {
    if (q.by === field.id) return refuse("refuse_same");
    if (!offered) return noBreakdown();
    // A condition on the field becomes the values compared (settle), so choosing to break down by a filter never widens the question.
    return { ok: true, change: { by: field.id, values: [] }, ...(q.by ? { replaces: q.by } : {}) };
  }

  if (zone === "by2") {
    if (!q.by) return refuse("refuse_needs_by", { zone: zoneLabel("by") });
    if (q.by === field.id) return refuse("refuse_is_breakdown", { zone: zoneLabel("by") });
    if (q.by2 === field.id) return refuse("refuse_same");
    const main = m.dimensions.find((d) => d.id === q.by);
    if (main?.with.includes(field.id)) return { ok: true, change: { by2: field.id, values2: [] }, ...(q.by2 ? { replaces: q.by2 } : {}) };
    if (m.derived) return refuse("refuse_measure_one_field");
    if (!offered) return noBreakdown();
    return refuse(canCross(q.by, field.id) ? "refuse_not_crossed" : "refuse_nested", { other: fieldLabel(q.by) });
  }

  // Filters.
  if (q.by === field.id) return refuse("refuse_is_breakdown", { zone: zoneLabel("by") });
  if (q.by2 === field.id) return refuse("refuse_is_breakdown", { zone: zoneLabel("by2") });
  if (field.id in q.where) return refuse("refuse_same");
  // A filter starts with no value, which keeps every vehicle: the page holds it until it has one (changeQuestion).
  if (filters) return { ok: true, change: { where: { ...q.where, [field.id]: [] } } };
  if (field.unavailable) return refuse(field.unavailable);
  if (v.filters.length === 0) return refuse("refuse_no_filters");
  return refuse(brokenDownElsewhere ? "refuse_no_values" : "refuse_not_in_dataset");
}

// Whether the chart uses the field already, in any zone.
export const inUse = (q: Question, field: string): boolean => q.by === field || q.by2 === field || field in q.where;

// Whether the chart can use the field in any zone that holds fields, or does already: the field list greys the ones it cannot.
export const usable = (all: Vocabulary, q: Question, field: CanvasField): boolean =>
  field.id === TIME_FIELD || inUse(q, field.id) || FIELD_ZONES.some((zone) => verdict(all, q, zone, field).ok);

// ---- The chart a question is drawn as ----

// The shape the engine draws when the visitor chooses none: the first the rule table gives the question (src/lib/resolve.ts).
export function bestType(q: Question): string {
  const [open] = builderPresets({ ...q, view: null, rankAll: false }, undefined, canvasSpec.chart_prefix);
  return open ? inferShape(open, findDimension(open.dimension), findMeasure(open.measure)) : "";
}

// The question as its chart type asks it. A ranking with no values of the visitor's own ranks every value: the values the page fills in
// are a starting set for lines, and a ranking of five the page chose would say less than the ranking of all.
function asked(q: Question, type: string): Question {
  if (q.by2) return { ...q, view: null, rankAll: false };
  if (type !== RANKING || !q.pageValues) return { ...q, view: type, rankAll: false };
  const { pageValues: _page, ...own } = q;
  return { ...own, values: [], view: RANKING, rankAll: false };
}

// The chart of a canvas chart, as a preset the panel draws. The shape is always pinned (the chosen type, else the best fit), so the
// panel's time row offers the periods that shape can have and never turns the chart into another type: the type picker does that.
export function chartPreset(chart: Pick<CanvasChart, "id" | "question" | "type">, label?: (value: string) => string): Preset | undefined {
  const type = chart.type ?? bestType(chart.question);
  return builderPresets(asked(chart.question, type), label, chart.id)[0];
}

// A count broken down is drawn as one line for each value, so with no value it has nothing to draw: the page then looks for the largest
// few to start from, as the Build page does. A ranking needs none (it ranks every value), and neither does a share (it keeps the
// largest and gathers the rest) or a dataset of one period (it is a ranking).
const COUNT_KIND = "count";
export function awaitsValues(all: Vocabulary, chart: Pick<CanvasChart, "question" | "type">): boolean {
  const q = chart.question;
  if (!q.by || q.by2 || q.values.length > 0) return false;
  const preset = chartPreset({ id: canvasSpec.chart_prefix, question: q, type: chart.type });
  if (!preset || preset.derived || preset.shape_override === RANKING) return false;
  const breakdown = measureOf(datasetOf(all, q.dataset), q.measure).dimensions.find((d) => d.id === q.by);
  return findMeasure(preset.measure)?.kind === COUNT_KIND && Boolean(breakdown?.values);
}

// Whether the engine draws the question as this shape: the rule table says the shape fits, and nothing in the build stops the chart.
function draws(q: Question, type: string, manifest: Manifest): boolean {
  const [preset] = builderPresets(asked(q, type), undefined, canvasSpec.chart_prefix);
  if (!preset) return false;
  const resolution = resolvePreset(preset, manifest);
  return resolution.preventsRender.length === 0 && resolution.shape === type;
}

export type TypeChoice = ChartTypeSpec & { fits: boolean; best: boolean; reason?: string };

// The chart types for a question: the best fit first, then the others that fit, then those that do not, each with its reason. The table
// of figures is not among them: it is always available, and the page lists it after the ones that fit.
export function chartTypes(all: Vocabulary, q: Question, manifest: Manifest): TypeChoice[] {
  const best = bestType(q);
  const choices = canvasSpec.chart_types.map((spec): TypeChoice => {
    const fits = draws(q, spec.id, manifest);
    return { ...spec, fits, best: fits && spec.id === best, ...(fits ? {} : { reason: typeReason(all, q, spec.id) }) };
  });
  const rank = (c: TypeChoice) => (c.best ? 0 : c.fits ? 1 : 2);
  return choices.map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).map(({ c }) => c);
}

// The facts of a question as the rule table reads them (src/lib/resolve.ts), with the values counted as chosen only where the visitor
// chose them: the page's own starting values are not a choice.
function factsOf(q: Question): Facts {
  const [open] = builderPresets({ ...q, view: null, rankAll: false }, undefined, canvasSpec.chart_prefix);
  if (!open) return {};
  const facts = questionFacts(open, findDimension(open.dimension), findMeasure(open.measure));
  const picked = q.pageValues ? 0 : q.values.length;
  return { ...facts, picked: picked === 0 ? "none" : picked === 1 ? "one" : "several" };
}

// Alternatives as a reader says them: "A", "A or B", "A, B or C".
const oneOf = (words: readonly string[]): string => (words.length < 2 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`);

const SPANS = ruleTable.facts.span;
// The facts a visitor can change from a chart's zones, the easiest first, and the order a reason names them in when two must change.
const BY_EASE: FactName[] = ["measure", "picked", "crossed_with", "by", "values", "periods"];
const BY_WEIGHT: FactName[] = ["by", "crossed_with", "measure", "picked", "values", "periods"];
const knownKinds = new Set(dimensions.map((d) => d.kind));

// Why a chart type does not fit a question, read off the rule table with no field named: the one fact that would have to differ for the
// table to give the shape (the window aside, which the type sets itself), or the weightier of two. The words are config's.
export function typeReason(all: Vocabulary, q: Question, type: string): string {
  const v = datasetOf(all, q.dataset);
  const names = { type: typeLabel(type), dataset: datasetLabel(v.dataset), field: q.by ? fieldLabel(q.by) : "" };
  // Two engine rules the table does not hold: two fields are drawn as a grid and nothing else, and a dataset of one period as a ranking or a grid.
  if (q.by2 && type !== MATRIX) return say("why_second_field", { ...names, field: fieldLabel(q.by2), zone: zoneLabel("by2") });
  if (findDataset(v.dataset)?.single_period && !isWindowShape(type)) return say("why_one_period", names);

  const facts = factsOf(q);
  const gives = (changed: Facts) => SPANS.some((span) => shapesFor({ ...facts, ...changed, span }).includes(type));
  // The table already gives the shape, so what stops the chart is the build: a field its tables do not hold together, a hidden count.
  if (gives({})) return say("why_blocked", names);
  const others = (name: FactName) => ruleTable.facts[name].filter((value) => value !== facts[name]);
  const reason = (name: FactName, wanted: string[]): string => {
    if (name === "measure") {
      // The measures of this dataset that are of a kind the type shows, by the names the Measure zone gives them; where it offers
      // none, the kinds in words.
      const offered = v.measures.filter((m) => wanted.includes((findMeasure(m.id) ?? findDerived(m.id))?.kind ?? "")).map(measureLabel);
      const words = offered.length ? offered : wanted.map((kind) => canvasSpec.measure_kinds[kind]).filter(Boolean);
      return words.length ? say("why_measure", { ...names, wanted: oneOf(words) }) : say("why_general", names);
    }
    if (name === "by") {
      const words = wanted.filter((kind) => knownKinds.has(kind)).map((kind) => canvasSpec.kinds[kind]).filter(Boolean);
      if (!words.length) return say("why_general", names);
      return say(q.by ? "why_by_kind" : "why_by_none", { ...names, wanted: oneOf(words), zone: zoneLabel("by") });
    }
    if (name === "crossed_with") return say("why_crossed", { ...names, zone: zoneLabel("by2") });
    if (name === "picked" && q.by) return say("why_picked", names);
    if (name === "values" && q.by) return say("why_values", names);
    return say("why_general", names);
  };
  for (const name of BY_EASE) {
    const wanted = others(name).filter((value) => gives({ [name]: value }));
    if (wanted.length) return reason(name, wanted);
  }
  for (const name of BY_WEIGHT) {
    const wanted = others(name).filter((value) => BY_WEIGHT.some((second) => second !== name && others(second).some((other) => gives({ [name]: value, [second]: other }))));
    if (wanted.length) return reason(name, wanted);
  }
  return say("why_general", names);
}

// ---- Changing a chart ----

// A chart after part of its question changes: the question settles as it does on the Build page (changeQuestion), and a chart type the
// new question does not fit gives way to the best fit. Without a manifest the type is kept, and checked when the build is known.
// removal: false where the page takes something out itself (a value a link named that the data does not hold), which is not the visitor
// removing it (changeQuestion).
export function changeChart(all: Vocabulary, chart: CanvasChart, next: Partial<Question>, manifest?: Manifest, removal = true): CanvasChart {
  const v = datasetOf(all, chart.question.dataset);
  const settled = changeQuestion(all, chart.question, { ...next, view: null }, (d) => v.filters.some((f) => f.id === d), removal);
  const question = { ...settled, view: null };
  return { ...chart, question, type: keptType(question, chart.type, manifest) };
}

const isShape = (type: string | null): type is string => Boolean(type && canvasSpec.chart_types.some((t) => t.id === type));
const keptType = (q: Question, type: string | null, manifest?: Manifest): string | null =>
  isShape(type) && (!manifest || draws(q, type, manifest)) ? type : null;

// The canvas with every chart type the build cannot draw set back to the best fit: run once the manifest has loaded.
export const withFittingTypes = (canvas: Canvas, manifest: Manifest): Canvas => ({
  charts: canvas.charts.map((chart) => ({ ...chart, type: keptType(chart.question, chart.type, manifest) })),
});

// ---- The page: adding, copying, removing and moving charts ----

// Whether the canvas holds as many charts as one may.
export const isFull = (canvas: Canvas): boolean => canvas.charts.length >= canvasSpec.max_charts;

// The canvas with a chart at a place, and that chart's id; null where the canvas is full or the id is taken.
function withChart(canvas: Canvas, chart: CanvasChart, index: number): { canvas: Canvas; id: string } | null {
  if (isFull(canvas) || canvas.charts.some((c) => c.id === chart.id)) return null;
  const at = Math.max(0, Math.min(index, canvas.charts.length));
  return { canvas: { charts: [...canvas.charts.slice(0, at), chart, ...canvas.charts.slice(at)] }, id: chart.id };
}

// A new chart after the last: the question the data answers when nothing is asked, at half width, so two added charts share a row.
export const addChart = (all: Vocabulary, canvas: Canvas): { canvas: Canvas; id: string } | null =>
  withChart(canvas, settleChart(all, { id: nextChartId(canvas.charts), asked: {}, type: null, table: false, width: "half" }), canvas.charts.length);

// A copy of a chart, under an id of its own, straight after the chart it copies.
export function duplicateChart(canvas: Canvas, id: string): { canvas: Canvas; id: string } | null {
  const index = canvas.charts.findIndex((c) => c.id === id);
  if (index < 0) return null;
  return withChart(canvas, { ...canvas.charts[index], id: nextChartId(canvas.charts) }, index + 1);
}

// A chart put back where it was taken from. Null where its id has been given to another chart since.
export const restoreChart = (canvas: Canvas, chart: CanvasChart, index: number): Canvas | null => withChart(canvas, chart, index)?.canvas ?? null;

// The canvas without a chart. A canvas keeps one chart: a link with none opens one anyway (settleCanvas).
export const removeChart = (canvas: Canvas, id: string): Canvas =>
  canvas.charts.length > 1 && canvas.charts.some((c) => c.id === id) ? { charts: canvas.charts.filter((c) => c.id !== id) } : canvas;

// The canvas with a chart moved to a place, counted from none, the others keeping their order.
export function moveChart(canvas: Canvas, id: string, to: number): Canvas {
  const from = canvas.charts.findIndex((c) => c.id === id);
  const at = Math.max(0, Math.min(to, canvas.charts.length - 1));
  if (from < 0 || from === at) return canvas;
  const rest = canvas.charts.filter((c) => c.id !== id);
  return { charts: [...rest.slice(0, at), canvas.charts[from], ...rest.slice(at)] };
}

// ---- The address ----
//
// The whole canvas is in the address: the charts in order, then each chart's question under its id, written as the Build page writes one
// under its own (questionParams), with the chart's type, whether it shows a table, and its width. The panel that draws a chart keeps the
// chart's own settings (its time range, a month) under the same id. Nothing a visitor types is ever in the address.

const pageKey = (name: string) => `${canvasSpec.id}.${name}`;
const CHARTS = "charts";
const TYPE = "type";
const SHOW = "show";
const SIZE = "size";
const ID = new RegExp(`^${canvasSpec.chart_prefix}[1-9][0-9]{0,2}$`);
export const isChartId = (text: string): boolean => ID.test(text);

// An id for a new chart: one past the largest on the canvas, so an id a removed chart had is not given again while a later one stands.
export function nextChartId(charts: readonly Pick<CanvasChart, "id">[]): string {
  const taken = charts.map((c) => Number(c.id.slice(canvasSpec.chart_prefix.length))).filter(Number.isFinite);
  return `${canvasSpec.chart_prefix}${Math.max(0, ...taken) + 1}`;
}

export type AskedChart = { id: string; asked: Partial<Question>; type: string | null; table: boolean; width: Width };

export function readCanvas(search: string): AskedChart[] {
  const params = new URLSearchParams(search);
  const ids = [...new Set((params.get(pageKey(CHARTS)) ?? "").split(",").filter(isChartId))].slice(0, canvasSpec.max_charts);
  return ids.map((id) => ({
    id,
    asked: readQuestion(search, id),
    type: params.get(`${id}.${TYPE}`),
    table: params.get(`${id}.${SHOW}`) === TABLE,
    width: params.get(`${id}.${SIZE}`) === "full" ? "full" : "half",
  }));
}

// A chart from what a link asked for, kept as far as the data can answer it: the nearest question (settle), and a type that is one of
// the six. Whether the build draws that type is checked once the manifest is known (withFittingTypes).
export const settleChart = (all: Vocabulary, a: AskedChart): CanvasChart => ({
  id: a.id,
  question: { ...settle(all, a.asked), view: null },
  type: isShape(a.type) ? a.type : null,
  table: a.table,
  width: a.width,
});

// The canvas a link opens. A link with no chart opens one: the question the data answers when nothing is asked, at full width.
export function settleCanvas(all: Vocabulary, asked: readonly AskedChart[]): Canvas {
  if (asked.length === 0) return { charts: [settleChart(all, { id: nextChartId([]), asked: {}, type: null, table: false, width: "full" })] };
  return { charts: asked.map((a) => settleChart(all, a)) };
}

export function canvasParams(canvas: Canvas): URLSearchParams {
  const params = new URLSearchParams({ [pageKey(CHARTS)]: canvas.charts.map((c) => c.id).join(",") });
  for (const chart of canvas.charts) {
    for (const [k, v] of questionParams({ ...chart.question, view: null, rankAll: false }, chart.id)) params.append(k, v);
    if (chart.type) params.set(`${chart.id}.${TYPE}`, chart.type);
    if (chart.table) params.set(`${chart.id}.${SHOW}`, TABLE);
    if (chart.width === "full") params.set(`${chart.id}.${SIZE}`, "full");
  }
  return params;
}

// The address with the canvas written into it. A chart whose question or type changed loses its own settings (its time range belongs to
// the chart it was); a chart that did not change keeps them; a chart no longer on the canvas loses everything under its id.
export function canvasAddress(search: string, canvas: Canvas, changed: ReadonlySet<string> = new Set()): URLSearchParams {
  const params = new URLSearchParams(search);
  const kept = new Set(canvas.charts.filter((c) => !changed.has(c.id)).map((c) => c.id));
  for (const k of [...params.keys()]) {
    const [scope, ...rest] = k.split(".");
    const id = scope.split("-")[0];
    if (scope === canvasSpec.id) params.delete(k);
    else if (isChartId(id) && !(kept.has(id) && scope === id && CHART_PARAMS.includes(rest.join(".")))) params.delete(k);
  }
  for (const [k, v] of canvasParams(canvas)) params.append(k, v);
  return params;
}

// A chart's own settings as an address holds them (its time range, a month), by name.
export type ChartSettings = [name: string, value: string][];
export function chartSettings(search: string, id: string): ChartSettings {
  const params = new URLSearchParams(search);
  return CHART_PARAMS.flatMap((name) => params.getAll(`${id}.${name}`).map((value): [string, string] => [name, value]));
}

// An address in which a chart has the settings given, in place of any it had: what a copy of a chart starts with, and what a chart
// put back gets back. Written before the canvas is (canvasAddress), which keeps them for a chart that did not change.
export function withChartSettings(search: string, id: string, settings: ChartSettings): string {
  const params = new URLSearchParams(search);
  for (const name of CHART_PARAMS) params.delete(`${id}.${name}`);
  for (const [name, value] of settings) if (CHART_PARAMS.includes(name)) params.append(`${id}.${name}`, value);
  return `?${params}`;
}
