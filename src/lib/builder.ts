// A chart's question: what to measure, what to break the vehicles down by, which values of that breakdown to compare, which vehicles to keep,
// and, where more than one shape fits, which to draw (D-058, D-059). Each becomes a preset like any in the canon, two for share and number, so
// the resolver and the panel treat a built chart exactly as they treat an Explore one. A chart on the canvas holds one (src/lib/canvas.ts); the
// Build page it began on only sends a link on (src/lib/buildLink.ts).
import dataMapDoc from "../../config/data_map.json";
import { builderSpec, dimensions, lowerLabel, phrases, findDataset, findDerived, findDimension, findMeasure, dimensionLabel, forDataset } from "./config";
import type { BuilderMeasure, Preset } from "./config";
import { isBuilt } from "./data";
import type { Manifest } from "./data";
import { monthLabel } from "./measures";
import { drawnShapes, findPair, inferShape, questionFacts, resolvePreset } from "./resolve";
import { nested, rollUps } from "./nesting";
import { narrowingsOf } from "./narrowing";
import type { Narrowing } from "./narrowing";
import { fillTemplate, sayList } from "./sentences";
import { ownerDimensions } from "./owner";
import type { MapDimension, MapField } from "./nesting";
import type { RecordedField } from "./narrowing";
import { isChoosable } from "./reserved";
import { needsBreakdown } from "./shapes";
import { chartDefaults } from "./config";

export type Question = {
  // What is counted: a dataset id from builderSpec.datasets.
  dataset: string;
  measure: string;
  by: string | null;
  values: string[];
  // A second breakdown: the question is a grid, `by` down the side and this field across the top, for one window (D-114). values are the
  // rows chosen and values2 the columns; with none chosen the grid shows the largest. Neither is ever the page's own, so neither is a state of
  // the question apart from the address.
  by2?: string | null;
  values2?: string[];
  where: Record<string, string[]>;
  // The conditions the question would start with, which the visitor removed: the fields they are on (D-132). Kept in the address, so a link
  // shows the question its sender saw; present only while the field is not one of the question's conditions and a breakdown calls for it.
  widened?: string[];
  view: string | null;
  // With the ranking view and values chosen: rank every value under the same conditions instead of the ones chosen. The choice is
  // kept, so one step takes the visitor back to it (D-111).
  rankAll?: boolean;
  // The values are the page's own starting values (the largest under the conditions), not the visitor's. They are not in the address, so
  // they follow the conditions and the dataset, and a shared link reproduces the page: no build.value means the page's own (D-111).
  pageValues?: boolean;
  // Pinned to the snapshot of this month (YYYY-MM): the window keeps ending in it, in the charts that end in a month the visitor can name
  // (a ranking, a grid). The site serves one snapshot, so the figures are that snapshot's; the page says when it is not the one pinned to.
  snapshot?: string;
};

// What the page offers, worked out at build time against the cube as built and handed to the island as plain data.
// values: whether this measure can compare chosen values of the breakdown (it needs the fact table).
export type BuilderOption = {
  id: string;
  phrase: string;
  joiner: string;
  derived: boolean;
  allowsTotal: boolean;
  // with: the fields this one can be crossed with in a grid (the fact table carries both, they are not one nested in the other).
  dimensions: { id: string; phrase: string; values: boolean; with: string[] }[];
};
export type FilterOption = { id: string; label: string };
// What one dataset offers; label is how the page names what it counts.
export type DatasetVocabulary = { dataset: string; label: string; measures: BuilderOption[]; filters: FilterOption[] };
// owner: the dimensions made from a field that describes the owner (src/lib/owner.ts), which a kept snapshot's table of is read only where it says its
// small cells were hidden (src/lib/kept.ts).
// narrowings: for each dimension made from a field the register records for only a kind of vehicle, the conditions that keep that kind (src/lib/narrowing.ts),
// worked out here from the data map so the island does not carry the map. Absent means none.
// nests: for each dimension, the dimensions it rolls up to through any number of steps (src/lib/nesting.ts), likewise worked out here, which is what
// canCrossIn reads. Absent means none.
export type Vocabulary = { datasets: DatasetVocabulary[]; owner: string[]; narrowings?: Record<string, Narrowing[]>; nests?: Record<string, string[]> };

const findBuilderMeasure = (id: string) => builderSpec.measures.find((m) => m.id === id);
const partsOf = (m: BuilderMeasure) => (m.parts ?? [m.id]).map(findBuilderMeasure).filter((x): x is BuilderMeasure => Boolean(x));

// A derived measure's size comes from its definition, so the words cannot disagree with the line.
const measurePhrase = (m: BuilderMeasure) => m.phrase.replace("{top_n}", String(findDerived(m.id)?.top_n ?? ""));

// The breakdowns a measure's own list offers, with those only a dataset offers (dataset_dimensions) added for that dataset.
const ownDimensions = (m: BuilderMeasure, dataset?: string): Record<string, string> => ({ ...m.dimensions, ...(dataset ? m.dataset_dimensions?.[dataset] : undefined) });

// The breakdowns a measure offers, each with its words. A measure made of parts offers what every part offers.
function dimensionsOf(m: BuilderMeasure, dataset?: string): Record<string, string> {
  if (!m.parts) return ownDimensions(m, dataset);
  const parts = partsOf(m);
  return Object.fromEntries(Object.entries(ownDimensions(parts[0] ?? m, dataset)).filter(([id]) => parts.every((p) => id in ownDimensions(p, dataset))));
}

// Whether the dataset has one period and no other (dimensions.json, single_period): it has no series over time.
const hasOnePeriod = (dataset: string): boolean => Boolean(findDataset(dataset)?.single_period);

// The conditions that keep something, in one order whatever order they were added in (fields by id, each field's values by
// text), so one question has one address and one sentence. The page lists a visitor's conditions in the order they were added.
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const cleanWhere = (where: Record<string, string[]>) =>
  Object.fromEntries(
    Object.entries(where)
      .filter(([, kept]) => kept.length > 0)
      .sort(([a], [b]) => byText(a, b))
      .map(([d, kept]): [string, string[]] => [d, [...new Set(kept)].sort(byText)]),
  );
const joined = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ") || undefined;

export function questionText(q: Question, measureId: string, label: (value: string) => string = (v) => v): string {
  const m = findBuilderMeasure(measureId);
  if (!m) return "";
  const by = q.by ? dimensionsOf(m, q.dataset)[q.by] : undefined;
  const by2 = q.by && q.by2 && !m.derived ? dimensionsOf(m, q.dataset)[q.by2] : undefined;
  const words = [measurePhrase(m), by ? m.joiner : "", by, by2 ? phrases.build_second_and : "", by2].filter(Boolean).join(" ");
  const named = !m.derived && !by2 && q.by && q.values.length ? `: ${q.values.map(label).join(", ")}` : "";
  return words.charAt(0).toUpperCase() + words.slice(1) + named;
}

// A count compares values as lines over time whatever the breakdown: the map and the distribution draw shares only.
const COUNT = "count";
const TREND = "trend";
// The view that ranks. A ranking of the values a visitor chose is a view of the question, since it is what the question looks like in
// one window: the rule table says where it fits (config/chart_rules.json, D-111).
export const RANKING = "league";
// The view of a question with a second breakdown: a grid, the only shape that fits two fields crossed in one window.
export const MATRIX = "matrix";

function presetFor(q: Question, measureId: string, id: string, label?: (value: string) => string): Preset {
  const m = findBuilderMeasure(measureId);
  // Ranking every value sets the choice aside: the chart, its title and its figures are those of the question without it.
  const asked = q.view === RANKING && q.rankAll ? { ...q, values: [] } : q;
  // A second breakdown makes the question a grid of the two fields; the values chosen are the lines of each side, and none are the page's own.
  const crossed = Boolean(!m?.derived && asked.by && asked.by2);
  const values = !m?.derived && asked.by && asked.values.length ? asked.values : undefined;
  const values2 = crossed && asked.values2?.length ? asked.values2 : undefined;
  const where = cleanWhere(q.where);
  const dimensionNote = joined(
    q.by ? forDataset(builderSpec.dimension_notes[q.by], q.dataset) : undefined,
    crossed && q.by2 ? forDataset(builderSpec.dimension_notes[q.by2], q.dataset) : undefined,
  );
  // A count by a breakdown is lines unless the visitor asked for the ranking; a view the visitor chose among the shapes that fit
  // applies to the rest. The resolver reports a view that does not fit the question.
  // A dataset of one period has no lines over time: a count by a breakdown is its ranking, whatever the view says.
  const single = hasOnePeriod(q.dataset);
  const view = crossed ? MATRIX : single && q.by ? RANKING : measureId === COUNT && q.by ? (q.view === RANKING ? RANKING : TREND) : q.view;
  const preset: Preset = {
    id,
    question: questionText(asked, measureId, label) + (q.dataset === builderSpec.dataset ? "" : ` (${datasetName(q.dataset)})`),
    status: "live",
    dataset: q.dataset,
    dimension: q.by ?? undefined,
    period: builderSpec.period,
    // Chosen values reach their ranking through the view, not through the time row: the time row of a lines chart offers no ranking
    // window, so there is one way in and the page says which view is on (D-111).
    ranking_period: values || crossed || single ? undefined : builderSpec.ranking_period,
    events: true,
    note: joined(forDataset(m?.note, q.dataset), dimensionNote),
    note_template: m?.note_template ? joined(m.note_template, dimensionNote) : undefined,
    top_n: values || crossed || !q.by ? undefined : m?.top_n?.[q.by],
    ...(m?.derived ? { derived: m.id } : { measure: m?.id }),
    ...(values ? { values } : {}),
    ...(values && q.pageValues && !crossed ? { page_values: true } : {}),
    ...(crossed ? { dimension2: q.by2 as string, ...(values2 ? { values2 } : {}) } : {}),
    ...(q.view === RANKING && q.rankAll ? { ranks_all: true } : {}),
    ...(Object.keys(where).length ? { where } : {}),
    ...(q.snapshot ? { through: q.snapshot } : {}),
    ...(view ? { shape_override: view } : {}),
  };
  const shape = inferShape(preset, findDimension(q.by), findMeasure(preset.measure));
  const opening = values ? builderSpec.period_when_comparing : builderSpec.period;
  // The one period of a dataset that has one is the window of its charts.
  return { ...preset, period: single ? builderSpec.period_single : (builderSpec.period_by_shape[shape] ?? opening) };
}

// The question's charts: one, or one per part. The first takes the builder's id, which scopes its settings in the
// address bar; a later part takes the builder's id and its own. A page that holds several questions (the canvas) gives each its own id.
export function builderPresets(q: Question, label?: (value: string) => string, id: string = builderSpec.id): Preset[] {
  const m = findBuilderMeasure(q.measure);
  if (!m) return [];
  // A ranking has the share and the number of vehicles in one table, so a measure of two parts is one chart in this view.
  const parts = q.view === RANKING || (q.by2 && q.by) ? partsOf(m).slice(0, 1) : partsOf(m);
  return parts.map((part, i) => presetFor(q, part.id, i === 0 ? id : `${id}-${part.id}`, label));
}

// Whether a measure the builder offers is drawn as one chart: a measure made of parts is one chart for each part.
export const isOneChart = (measureId: string): boolean => !findBuilderMeasure(measureId)?.parts;

// The shapes a question may be drawn as: those the chart rules say fit it and that have a renderer, best first, so the
// first is the one drawn. A visitor switches only among shapes that fit (D-059), and there is nothing to switch where
// one fits, so the list is empty then.
export function viewsFor(q: Question): string[] {
  const [first] = builderPresets({ ...q, view: null, rankAll: false });
  if (!first || first.derived) return [];
  const facts = (preset: Preset) => questionFacts(preset, findDimension(q.by), findMeasure(first.measure));
  const shapes = drawnShapes(facts(first));
  // Two or more values chosen can also be ranked, in the window a ranking opens on, where the rule table says that window ranks them.
  const ranksChosen = Boolean(first.values && first.values.length > 1) && drawnShapes(facts({ ...first, period: builderSpec.period_by_shape[RANKING] ?? builderSpec.ranking_period })).includes(RANKING);
  const all = ranksChosen && !shapes.includes(RANKING) ? [...shapes, RANKING] : shapes;
  return all.length > 1 ? all : [];
}

const dataMapFields = () => (dataMapDoc as unknown as { fields: RecordedField[] }).fields;

// What rolls up to what, from the data map. Read when first asked, so a page that never asks does not carry the map.
let rollUpsOfMap: ReturnType<typeof rollUps> | undefined;
const rolledUp = (a: string, b: string): boolean => {
  rollUpsOfMap ??= rollUps((dataMapDoc as unknown as { fields: MapField[] }).fields, dimensions as unknown as MapDimension[]);
  return nested(rollUpsOfMap, a, b);
};

// Whether Build crosses two fields: they are two, and neither sits under a single value of the other. That is a pair measured and listed
// in config (builder.cannot_cross), or one the data map says rolls up (a class under its type of vehicle, D-122).
const crossable = (a: string, b: string, nested: (a: string, b: string) => boolean): boolean =>
  a !== b && !builderSpec.cannot_cross.some(([x, y]) => (x === a && y === b) || (x === b && y === a)) && !nested(a, b);

// Where the page is built, from the data map itself.
export const canCross = (a: string, b: string): boolean => crossable(a, b, rolledUp);

// In the browser, from what the vocabulary carries of the map, so that the page does not carry the map.
export const canCrossIn = (all: Vocabulary, a: string, b: string): boolean => crossable(a, b, (x, y) => Boolean(all.nests?.[x]?.includes(y) || all.nests?.[y]?.includes(x)));

// What a dataset is called to a visitor: its public label, and for one that starts later than the register, where it starts.
export function datasetName(id: string, manifest?: Manifest): string {
  const dataset = findDataset(id);
  const first = manifest?.datasets[id]?.supplied?.months.first;
  const name = dataset?.public_label ?? dataset?.label ?? id;
  return first ? `${name}, from ${monthLabel(first)}` : name;
}

const draws = (q: Question, manifest: Manifest) => builderPresets(q).every((p) => resolvePreset(p, manifest).preventsRender.length === 0);

// Only what draws is offered: a breakdown the cube does not carry, or a shape with no renderer, never reaches the page.
// A breakdown offers chosen values only where the fact table carries it. A measure left with nothing to show is dropped.
export function builderVocabulary(manifest: Manifest): Vocabulary {
  const datasets = builderSpec.datasets
    .filter((id) => isBuilt(manifest, id))
    .map((id) => datasetVocabulary(manifest, id))
    .filter((v) => v.measures.length > 0);
  const narrowings = Object.fromEntries(
    dimensions.flatMap((d) => {
      const found = narrowingsOf(d.id, dataMapFields(), dimensions as unknown as MapDimension[], builderSpec.narrowings);
      return found.length ? [[d.id, found] as const] : [];
    }),
  );
  rollUpsOfMap ??= rollUps((dataMapDoc as unknown as { fields: MapField[] }).fields, dimensions as unknown as MapDimension[]);
  const nests = Object.fromEntries([...rollUpsOfMap].map(([from, to]) => [from, [...to]]));
  return { datasets, owner: ownerDimensions(dataMapDoc as unknown as Parameters<typeof ownerDimensions>[0], dimensions), narrowings, nests };
}

function datasetVocabulary(manifest: Manifest, dataset: string): DatasetVocabulary {
  const facts = manifest.datasets[dataset]?.facts;
  const blank: Question = { dataset, measure: "", by: null, values: [], where: {}, view: null };
  const measures = builderSpec.measures
    .map((m): BuilderOption => {
      const probe = (by: string | null, values: string[] = []) => draws({ ...blank, measure: m.id, by, values }, manifest);
      const offered = Object.entries(dimensionsOf(m, dataset)).flatMap(([id, phrase]) => {
        const values = !m.derived && Boolean(facts?.dimensions.includes(id)) && probe(id, ["?"]);
        // A count by a breakdown draws a line per chosen value, so without values it has nothing to draw. In a dataset of one period it is a ranking of
        // every value, which needs none. A short list of a dataset with no fact table (a published series) has no values to choose: its slice holds every value.
        const needsValues = partsOf(m).some((p) => p.id === COUNT) && !hasOnePeriod(dataset) && (Boolean(facts) || findDimension(id)?.cardinality !== "low");
        return values || (!needsValues && probe(id)) ? [{ id, phrase, values }] : [];
      });
      // A grid needs the fact table to carry both fields, and a plain measure of vehicles.
      // Where the fact table carries both fields they are crossed from it; where it does not, from the pair slice of the two, if the question draws.
      const crosses = (d: { id: string; values: boolean }, o: { id: string; values: boolean }) =>
        canCross(d.id, o.id) && (d.values && o.values ? true : !facts && Boolean(findPair(manifest.datasets[dataset]?.live_pairs ?? [], d.id, o.id)) && draws({ ...blank, measure: m.id, by: d.id, by2: o.id }, manifest));
      const dimensions = offered.map((d) => ({ ...d, with: m.derived ? [] : offered.filter((o) => o.id !== d.id && crosses(d, o)).map((o) => o.id) }));
      return {
        id: m.id,
        phrase: measurePhrase(m),
        joiner: m.joiner,
        derived: Boolean(m.derived),
        allowsTotal: !m.parts && !m.derived && !needsBreakdown(findMeasure(m.id)?.kind) && probe(null),
        dimensions,
      };
    })
    .filter((m) => m.dimensions.length > 0 || m.allowsTotal);
  const filters = (facts?.dimensions ?? [])
    .filter((id) => findDimension(id))
    .map((id) => ({ id, label: dimensionLabel(id, false, dataset) ?? id }));
  return { dataset, label: datasetName(dataset, manifest), measures, filters };
}

// The conditions after a visitor changes the values of one: a condition left with no value is gone, since a condition with none keeps
// every vehicle and a line that says nothing is only clutter. (A condition just added is the one empty line the page holds, until it has
// its first value; that is the page adding it, not this.)
export function withValues(where: Record<string, string[]>, dimension: string, values: string[]): Record<string, string[]> {
  if (values.length > 0) return { ...where, [dimension]: values };
  return Object.fromEntries(Object.entries(where).filter(([d]) => d !== dimension));
}

// As many values as the palette has colours: past that, lines can no longer be told apart (src/lib/theme.ts).
export const MAX_VALUES = 8;

// A pin names a month, written as the address writes every month.
export const isMonthKey = (text: string | undefined): text is string => typeof text === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(text);

// The conditions the fields a question breaks down by call for, from the vocabulary: the data map says which classes of vehicle each field is recorded
// for, and config (builder.narrowings) which condition keeps a class. One per dimension; a field with no class config can express calls for none.
const narrowingsFor = (all: Vocabulary, ids: (string | null | undefined)[]): Narrowing[] => {
  const found = new Map<string, Narrowing>();
  for (const id of ids) for (const n of (id && all.narrowings?.[id]) || []) if (!found.has(n.dimension)) found.set(n.dimension, n);
  return [...found.values()];
};

// The sentences that say a question was narrowed to where its fields are recorded: one for each condition a breakdown calls for, while the
// question still holds exactly that condition. A visitor who changed it is no longer told it is the starting one, and one who removed it is
// told nothing: the chart then counts every vehicle and the field's note says what the gap is.
export function narrowingNotes(all: Vocabulary, q: Question): string[] {
  const kept = cleanWhere(q.where);
  const groups = new Map<string, { kind: string; fields: string[] }>();
  for (const id of q.by ? [q.by, ...(q.by2 ? [q.by2] : [])] : []) {
    for (const n of all.narrowings?.[id] ?? []) {
      const on = kept[n.dimension];
      if (!(on?.length === 1 && on[0] === n.value)) continue;
      const group = groups.get(n.dimension) ?? { kind: n.kind, fields: [] };
      group.fields.push(lowerLabel(dimensionLabel(id) ?? id));
      groups.set(n.dimension, group);
    }
  }
  return [...groups.values()].map((g) => fillTemplate(builderSpec.notices.narrowed, { field: sayList(g.fields), kind: g.kind }).text);
}

// The question after the visitor changed it: a condition it had that the new one lacks was removed, and is remembered as removed so the
// condition a breakdown calls for does not come back (settle keeps it only while a breakdown still calls for it).
export function noteRemoved(before: Pick<Question, "where">, asked: Question): Question {
  const removed = Object.keys(before.where).filter((d) => !(d in asked.where));
  return removed.length ? { ...asked, widened: [...(asked.widened ?? []), ...removed] } : asked;
}

// The question the page settles to when it changes. A condition the visitor took away is remembered as removed (noteRemoved); one the page itself
// dropped because the link named a value the data does not hold (absentValues) is not, since the visitor removed nothing: the question then starts as
// the same link without that condition would, with the condition its breakdown calls for (D-137).
export function settleChange(all: Vocabulary, before: Pick<Question, "where">, asked: Question, byVisitor: boolean): Question {
  return settle(all, byVisitor ? noteRemoved(before, asked) : asked);
}

// The question after part of it changes: what the change sets aside, then the nearest question the data can answer (settleChange). One
// rule for every page that holds a question, so a chart on the canvas changes exactly as the Build page's does.
// canApply: whether the question's data can condition on a field. removal: the change is the visitor's, so a condition it takes away
// stays away (noteRemoved).
export function changeQuestion(all: Vocabulary, current: Question, next: Partial<Question>, canApply: (dimension: string) => boolean, removal = true): Question {
  const asked = { ...current, ...next };
  // Ranking every value is a state of the ranking view only.
  if (next.view !== undefined && next.view !== RANKING) asked.rankAll = false;
  // Values the page chose follow the question: a new condition or measure sets them aside, and the page looks again.
  if (current.pageValues && next.values === undefined && (next.where !== undefined || next.measure !== undefined)) asked.values = [];
  // A grid chooses its own lines, so the values the page filled in for the lines of a chart are set aside when the second breakdown is added.
  if (current.pageValues && next.by2 && next.values === undefined) asked.values = [];
  // Another dataset carries other conditions and other values: the ones it does not carry go, and the chosen values start over.
  if (next.dataset && next.dataset !== current.dataset) {
    const carried = all.datasets.find((v) => v.dataset === next.dataset)?.filters ?? [];
    asked.where = Object.fromEntries(Object.entries(asked.where).filter(([d]) => carried.some((f) => f.id === d)));
    asked.values = [];
  }
  // A condition with no value yet keeps every vehicle and has no place in the address, so settle drops it. It stays
  // on the page while the visitor changes something else, and goes only when they remove it.
  const held = Object.entries(asked.where ?? {}).filter(([d, kept]) => kept.length === 0 && canApply(d));
  // A condition the question had and the visitor took away stays away, though a breakdown would start the question with it (D-132).
  const settled = settleChange(all, current, asked, removal);
  for (const [d] of held) if (d !== settled.by && !(d in settled.where)) settled.where[d] = [];
  return settled;
}

// A question from the address bar, kept only as far as the page offers it; otherwise the nearest one that is. A
// condition on the breakdown itself becomes the values compared, where the breakdown takes values, so choosing to break
// down by what was a condition never quietly widens the question. A condition the page cannot apply (a field the fact
// table lacks, or one config does not define) is kept for the same reason: the resolver then blocks the chart and the
// page says which condition to remove, where dropping it would draw a wider question than the link asked.
export function settle(all: Vocabulary, q: Partial<Question>): Question {
  const vocabulary = all.datasets.find((v) => v.dataset === q.dataset) ?? all.datasets.find((v) => v.dataset === builderSpec.dataset) ?? all.datasets[0];
  const m = vocabulary.measures.find((o) => o.id === q.measure) ?? vocabulary.measures[0];
  const dimension = m.dimensions.find((d) => d.id === q.by);
  const by = dimension ? dimension.id : m.allowsTotal && (q.by === null || q.by === undefined) ? null : (m.dimensions[0]?.id ?? null);
  const takesValues = Boolean(by && m.dimensions.find((d) => d.id === by)?.values);
  // A second breakdown only where the dataset carries both fields and they can be crossed; otherwise the question has none.
  const by2 = by && q.by2 && dimension?.with.includes(q.by2) ? q.by2 : null;
  const onBreakdown = by ? (q.where?.[by] ?? []) : [];
  const onBreakdown2 = by2 ? (q.where?.[by2] ?? []) : [];
  // A value the page does not offer to choose (the one a cap collapses to) is left out of the values and the conditions: the page says so
  // (readingNotes), as it does for a breakdown it does not have.
  const where = Object.fromEntries(
    Object.entries(q.where ?? {})
      .filter(([d, kept]) => d !== by && d !== by2 && kept.length > 0)
      .map(([d, kept]) => [d, kept.filter(isChoosable)]),
  );
  const asked = (q.values?.length ? q.values : onBreakdown).filter(isChoosable);
  const values = takesValues ? [...new Set(asked)].slice(0, by2 ? chartDefaults.matrix.rows : MAX_VALUES) : [];
  const values2 = by2 ? [...new Set((q.values2?.length ? q.values2 : onBreakdown2).filter(isChoosable))].slice(0, chartDefaults.matrix.columns) : [];
  // Values the page chose: any question that names none, and one the page has filled in and the visitor has not touched. A grid chooses its own
  // lines in the window it shows, so it has no starting values to fill in.
  const pageValues = !by2 && takesValues && (values.length === 0 || q.pageValues === true);
  // A breakdown by a field recorded for only a kind of vehicle starts with the condition that keeps that kind (D-132), unless the link already
  // has a condition on that field, or says it was removed. A condition on a breakdown itself is already the question, and a field this data
  // cannot condition on cannot be narrowed.
  const narrowings = narrowingsFor(all, [by, by2]).filter((n) => n.dimension !== by && n.dimension !== by2 && vocabulary.filters.some((f) => f.id === n.dimension));
  const named = q.where ?? {};
  // A removal holds while the question holds no value for that field: a condition the visitor has opened and not yet filled (an empty list) is not
  // a condition, and dropping the removal for it would put the starting condition back on the next reload.
  const widened = [...new Set(q.widened ?? [])].filter((d) => narrowings.some((n) => n.dimension === d) && !named[d]?.length).sort(byText);
  for (const n of narrowings) if (!(n.dimension in named) && !widened.includes(n.dimension)) where[n.dimension] = [n.value];
  const settled: Question = { dataset: vocabulary.dataset, measure: m.id, by, values, ...(by2 ? { by2, values2 } : {}), where, ...(widened.length ? { widened } : {}), view: null, ...(pageValues ? { pageValues } : {}), ...(isMonthKey(q.snapshot) ? { snapshot: q.snapshot } : {}) };
  // A count with no values yet is waiting for the page's own, which come after the page has looked at the data; a view that needs
  // two or more is judged as if they were there, so a link to the ranking of the page's values is kept.
  const waiting = pageValues && values.length === 0 && partsOf(findBuilderMeasure(m.id) as BuilderMeasure).some((p) => p.id === COUNT);
  const judged = waiting ? { ...settled, values: ["?", "?"] } : settled;
  const view = !by2 && q.view && viewsFor(judged).includes(q.view) ? q.view : null;
  return { ...settled, view, ...(view === RANKING && q.rankAll ? { rankAll: true } : {}) };
}

// What a link asked for that the page did not give, so it can say so: the dataset it named and the breakdown it named, each
// with what is shown instead. A condition the page cannot apply is already said where it is kept.
// A label as it reads inside a sentence.
const lowerFirst = lowerLabel;

export type Reading = {
  dataset?: { asked: string; shown: string };
  by?: { asked: string; dataset: string; shown: string };
  // The second breakdown the link named and the question cannot have.
  by2?: { asked: string };
  // Values for a second breakdown the link names no second breakdown for.
  value2?: true;
  // A snapshot the link named that is not a month.
  snapshot?: { asked: string };
  // Values the link named that the page does not offer to choose, each with the field it was named for.
  left_out?: { asked: string; field: string }[];
};

export function readingNotes(all: Vocabulary, asked: Partial<Question>, settled: Question, label: (value: string, dimension: string) => string = (v) => v): Reading {
  const note: Reading = {};
  const named = [
    ...(asked.by && asked.values ? asked.values.map((v) => ({ v, d: asked.by as string })) : []),
    ...Object.entries(asked.where ?? {}).flatMap(([d, kept]) => kept.map((v) => ({ v, d }))),
  ].filter(({ v }) => !isChoosable(v));
  if (named.length) {
    const seen = new Set<string>();
    note.left_out = named.flatMap(({ v, d }) => {
      const key = `${d}|${v}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ asked: label(v, d), field: lowerFirst(dimensionLabel(d, false, settled.dataset) ?? d) }];
    });
  }
  if (asked.dataset && asked.dataset !== settled.dataset) {
    note.dataset = { asked: lowerFirst(findDataset(asked.dataset)?.public_label ?? asked.dataset), shown: lowerFirst(datasetName(settled.dataset)) };
  }
  if (typeof asked.by === "string" && asked.by !== "" && asked.by !== settled.by) {
    const offered = all.datasets.find((v) => v.dataset === settled.dataset)?.measures.find((m) => m.id === settled.measure);
    const shown = settled.by ? offered?.dimensions.find((d) => d.id === settled.by)?.phrase : undefined;
    note.by = { asked: lowerFirst(dimensionLabel(asked.by, false, settled.dataset) ?? asked.by), dataset: lowerFirst(datasetName(settled.dataset)), shown: shown ?? "all of them together" };
  }
  if (typeof asked.by2 === "string" && asked.by2 !== "" && asked.by2 !== settled.by2) note.by2 = { asked: lowerFirst(dimensionLabel(asked.by2, false, settled.dataset) ?? asked.by2) };
  if (!asked.by2 && (asked.values2 ?? []).length > 0) note.value2 = true;
  if (asked.snapshot && !settled.snapshot) note.snapshot = { asked: asked.snapshot };
  return note;
}

// What a link asked for that the page did not give, as the sentences the page says: one rule for the Build page and for each chart of
// a canvas, so a link is told the same thing wherever it opens.
export function linkNotices(all: Vocabulary, asked: Partial<Question>, settled: Question, label: (value: string, dimension: string) => string = (v) => v): string[] {
  const note = readingNotes(all, asked, settled, label);
  const notices = builderSpec.notices;
  const fill = (template: string, context: Record<string, unknown>) => fillTemplate(template, context).text;
  return [
    ...(note.dataset ? [fill(notices.dataset, note.dataset)] : []),
    ...(note.by ? [fill(notices.by, note.by)] : []),
    ...(note.by2 ? [fill(notices.by2, note.by2)] : []),
    ...(note.value2 ? [notices.value2] : []),
    ...(note.snapshot ? [fill(notices.snapshot, note.snapshot)] : []),
    ...(note.left_out ?? []).map((left) => fill(notices.left_out, left)),
  ];
}

// A value a question names for a field, as a breakdown's value or a condition's. The page's own starting values are not named by the visitor and are
// read from the field's table, so they are not listed.
export type NamedValue = { dimension: string; value: string };

export function namedValues(q: Question): NamedValue[] {
  const named: NamedValue[] = [
    ...(q.by && !q.pageValues ? q.values.map((value) => ({ dimension: q.by as string, value })) : []),
    ...(q.by && q.by2 ? (q.values2 ?? []).map((value) => ({ dimension: q.by2 as string, value })) : []),
    ...Object.entries(q.where).flatMap(([dimension, kept]) => kept.map((value) => ({ dimension, value }))),
  ];
  const seen = new Set<string>();
  return named.filter(({ dimension, value }) => !seen.has(`${dimension}|${value}`) && seen.add(`${dimension}|${value}`));
}

// Reads the values one dataset's own table of a field holds, given the other conditions the question has (they decide which file the field's picker
// reads, and so which file this reads: src/lib/data.ts, fieldValues). Undefined when the table cannot be read; the picker says so itself.
export type FieldValuesReader = (dataset: string, dimension: string, others: Record<string, string[]>) => Promise<ReadonlySet<string> | undefined>;

// The values the question names that its dataset's own table of that field does not hold: a value the data never had or no longer has, which would
// match no vehicle and say nothing. Judged by the question's own dataset, so a value that only another dataset holds is absent here. A field this
// data cannot condition on is not judged (the page already says so), nor one whose table could not be read.
export async function absentValues(q: Question, canApply: (dimension: string) => boolean, read: FieldValuesReader): Promise<NamedValue[]> {
  const named = namedValues(q).filter((n) => canApply(n.dimension));
  const applicable = Object.fromEntries(Object.entries(q.where).filter(([d, kept]) => canApply(d) && kept.length > 0));
  const fields = [...new Set(named.map((n) => n.dimension))];
  const held = await Promise.all(fields.map((d) => read(q.dataset, d, Object.fromEntries(Object.entries(applicable).filter(([other]) => other !== d)))));
  return named.filter((n) => {
    const table = held[fields.indexOf(n.dimension)];
    return table !== undefined && !table.has(n.value);
  });
}

// The question without those values: a condition left with no value goes with them, as it does when the visitor takes its last value away.
export function withoutValues(q: Question, absent: NamedValue[]): Pick<Question, "values" | "values2" | "where"> {
  const gone = (dimension: string, value: string) => absent.some((a) => a.dimension === dimension && a.value === value);
  const where = Object.fromEntries(
    Object.entries(q.where).flatMap(([d, kept]): [string, string[]][] => {
      const left = kept.filter((v) => !gone(d, v));
      return left.length === 0 && kept.length > 0 ? [] : [[d, left]];
    }),
  );
  return {
    values: q.by ? q.values.filter((v) => !gone(q.by as string, v)) : q.values,
    values2: q.by2 ? (q.values2 ?? []).filter((v) => !gone(q.by2 as string, v)) : q.values2,
    where,
  };
}

// One sentence for each value a link named that the data does not hold.
export function absentNotes(dataset: string, absent: NamedValue[], label: (value: string, dimension: string) => string = (v) => v): string[] {
  return absent.map(({ dimension, value }) =>
    fillTemplate(builderSpec.notices.absent, { asked: label(value, dimension), field: lowerFirst(dimensionLabel(dimension, false, dataset) ?? dimension), dataset: lowerFirst(datasetName(dataset)) }).text,
  );
}

// The address-bar form of a question, scoped by the builder's id, or by the id a page that holds several questions gives each one (the
// canvas). Values repeat a key rather than join with a separator, since a value may contain any character.
const WHERE = "where.";

// Conditions are keyed by text from the address bar or from config. An object with no prototype holds any key as its
// own, where a plain one would hand back a built-in for a key such as "constructor" and the page would fail on it.
const noConditions = (): Record<string, string[]> => Object.create(null);

export function readQuestion(search: string, scope: string = builderSpec.id): Partial<Question> {
  const key = (name: string) => `${scope}.${name}`;
  const params = new URLSearchParams(search);
  const where = noConditions();
  for (const [k, v] of params) {
    if (k.startsWith(key(WHERE))) (where[k.slice(key(WHERE).length)] ??= []).push(v);
  }
  const by = params.get(key("by"));
  return {
    dataset: params.get(key("dataset")) ?? undefined,
    measure: params.get(key("measure")) ?? undefined,
    by: by === null ? undefined : by === "" ? null : by,
    values: params.getAll(key("value")),
    by2: params.get(key("by2")) || undefined,
    values2: params.getAll(key("value2")),
    where,
    view: params.get(key("view")),
    snapshot: params.get(key("snapshot")) || undefined,
    widened: params.getAll(key("widen")),
    rankAll: params.get(key("rank")) === "all",
  };
}

export function questionParams(q: Question, scope: string = builderSpec.id): URLSearchParams {
  const key = (name: string) => `${scope}.${name}`;
  const params = new URLSearchParams({ [key("measure")]: q.measure, [key("by")]: q.by ?? "" });
  // An address with no dataset means the default one, so an older link keeps its meaning and the default adds nothing.
  if (q.dataset !== builderSpec.dataset) params.set(key("dataset"), q.dataset);
  // The page's own values are not in the address: a link without values means them.
  if (!q.pageValues) for (const v of q.values) params.append(key("value"), v);
  for (const [d, kept] of Object.entries(cleanWhere(q.where))) for (const v of kept) params.append(key(`${WHERE}${d}`), v);
  if (q.by2) {
    params.set(key("by2"), q.by2);
    for (const v of q.values2 ?? []) params.append(key("value2"), v);
  }
  for (const d of [...(q.widened ?? [])].sort(byText)) params.append(key("widen"), d);
  if (q.snapshot) params.set(key("snapshot"), q.snapshot);
  if (q.view) params.set(key("view"), q.view);
  if (q.view === RANKING && q.rankAll) params.set(key("rank"), "all");
  return params;
}

// The question that draws the same chart as this Explore view, where the builder can ask it: its dataset, a measure
// it offers with this breakdown, the same cap on named values, and the view's filters as the question's. Composite
// presets never qualify ($composite in config/presets.json), and neither does the builder's own chart.
export function builderQuestionFor(view: Preset): Question | null {
  if (view.id.startsWith(builderSpec.id) || view.series || !view.dataset || !builderSpec.datasets.includes(view.dataset) || !view.dimension) return null;
  const m = builderSpec.measures.find((x) => !x.parts && (x.derived ? x.id === view.derived : !view.derived && x.id === view.measure));
  const offered = m ? ownDimensions(m, view.dataset) : {};
  if (!m || !(view.dimension in offered) || (view.dimension2 ? !(view.dimension2 in offered) : m.top_n?.[view.dimension] !== view.top_n)) return null;
  const where = noConditions();
  for (const filter of view.filters ?? []) for (const [d, v] of Object.entries(filter)) (where[d] ??= []).push(v);
  return { dataset: view.dataset, measure: m.id, by: view.dimension, values: [], ...(view.dimension2 ? { by2: view.dimension2, values2: [] } : {}), where, view: null };
}

// The chart's own settings in the address (the first chart's are scoped by the builder's id, a later part's by its own id and a dash).
export const CHART_PARAMS = ["period", "range", "smoothing", "month", "cells"];
