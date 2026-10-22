// The Build page's questions. A question is what to measure, what to break the vehicles down by, which values of that
// breakdown to compare, which vehicles to keep, and, where more than one shape fits, which to draw (D-058, D-059). Each
// becomes a preset like any in the canon, two for share and number, so the resolver and the panel treat a built chart
// exactly as they treat an Explore one.
import { builderSpec, findDerived, findDimension, findMeasure, publicCopy } from "./config";
import type { BuilderMeasure, Preset } from "./config";
import type { Manifest } from "./data";
import { inferShape, resolvePreset } from "./resolve";

export type Question = {
  measure: string;
  by: string | null;
  values: string[];
  where: Record<string, string[]>;
  view: string | null;
};

// What the page offers, worked out at build time against the cube as built and handed to the island as plain data.
// values: whether this measure can compare chosen values of the breakdown (it needs the fact table).
export type BuilderOption = {
  id: string;
  phrase: string;
  joiner: string;
  derived: boolean;
  allowsTotal: boolean;
  dimensions: { id: string; phrase: string; values: boolean }[];
};
export type FilterOption = { id: string; label: string };
export type Vocabulary = { dataset: string; measures: BuilderOption[]; filters: FilterOption[] };

const findBuilderMeasure = (id: string) => builderSpec.measures.find((m) => m.id === id);
const partsOf = (m: BuilderMeasure) => (m.parts ?? [m.id]).map(findBuilderMeasure).filter((x): x is BuilderMeasure => Boolean(x));

// A derived measure's size comes from its definition, so the words cannot disagree with the line.
const measurePhrase = (m: BuilderMeasure) => m.phrase.replace("{top_n}", String(findDerived(m.id)?.top_n ?? ""));

// The breakdowns a measure offers, each with its words. A measure made of parts offers what every part offers.
function dimensionsOf(m: BuilderMeasure): Record<string, string> {
  if (!m.parts) return m.dimensions;
  const parts = partsOf(m);
  return Object.fromEntries(Object.entries(parts[0]?.dimensions ?? {}).filter(([id]) => parts.every((p) => id in p.dimensions)));
}

const cleanWhere = (where: Record<string, string[]>) => Object.fromEntries(Object.entries(where).filter(([, kept]) => kept.length > 0));
const joined = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ") || undefined;

export function questionText(q: Question, measureId: string, label: (value: string) => string = (v) => v): string {
  const m = findBuilderMeasure(measureId);
  if (!m) return "";
  const by = q.by ? dimensionsOf(m)[q.by] : undefined;
  const words = [measurePhrase(m), by ? m.joiner : "", by].filter(Boolean).join(" ");
  const named = !m.derived && q.by && q.values.length ? `: ${q.values.map(label).join(", ")}` : "";
  return words.charAt(0).toUpperCase() + words.slice(1) + named;
}

function presetFor(q: Question, measureId: string, id: string, label?: (value: string) => string): Preset {
  const m = findBuilderMeasure(measureId);
  const values = !m?.derived && q.by && q.values.length ? q.values : undefined;
  const where = cleanWhere(q.where);
  const dimensionNote = q.by ? builderSpec.dimension_notes[q.by] : undefined;
  const preset: Preset = {
    id,
    question: questionText(q, measureId, label),
    status: "live",
    dataset: builderSpec.dataset,
    dimension: q.by ?? undefined,
    period: builderSpec.period,
    ranking_period: builderSpec.ranking_period,
    events: true,
    note: joined(m?.note, dimensionNote),
    note_template: m?.note_template ? joined(m.note_template, dimensionNote) : undefined,
    top_n: values || !q.by ? undefined : m?.top_n?.[q.by],
    ...(m?.derived ? { derived: m.id, shape_override: findDerived(m.id)?.shape } : { measure: m?.id }),
    ...(values ? { values } : {}),
    ...(Object.keys(where).length ? { where } : {}),
    ...(q.view ? { shape_override: q.view } : {}),
  };
  const shape = inferShape(preset, findDimension(q.by), findMeasure(preset.measure));
  const opening = values ? builderSpec.period_when_comparing : builderSpec.period;
  return { ...preset, period: builderSpec.period_by_shape[shape] ?? opening };
}

// The question's charts: one, or one per part. The first takes the builder's id, which scopes its settings in the
// address bar; a later part takes the builder's id and its own.
export function builderPresets(q: Question, label?: (value: string) => string): Preset[] {
  const m = findBuilderMeasure(q.measure);
  if (!m) return [];
  return partsOf(m).map((part, i) => presetFor(q, part.id, i === 0 ? builderSpec.id : `${builderSpec.id}-${part.id}`, label));
}

// The shapes a question may be drawn as: the one inferred, and lines over time where a dimension's own shape (a map, a
// distribution) shows one period at a time. A visitor switches only among shapes that fit (D-059).
export function viewsFor(q: Question): string[] {
  const [first] = builderPresets({ ...q, view: null });
  if (!first || first.derived) return [];
  const dimension = findDimension(q.by);
  const inferred = inferShape(first, dimension, findMeasure(first.measure));
  const hinted = dimension?.shape_hint === "geo" || dimension?.shape_hint === "distribution";
  return hinted && first.measure === "share" ? [inferred, "mix"] : [];
}

const draws = (q: Question, manifest: Manifest) => builderPresets(q).every((p) => resolvePreset(p, manifest).preventsRender.length === 0);

// Only what draws is offered: a breakdown the cube does not carry, or a shape with no renderer, never reaches the page.
// A breakdown offers chosen values only where the fact table carries it. A measure left with nothing to show is dropped.
export function builderVocabulary(manifest: Manifest): Vocabulary {
  const facts = manifest.datasets[builderSpec.dataset]?.facts;
  const blank: Question = { measure: "", by: null, values: [], where: {}, view: null };
  const measures = builderSpec.measures
    .map((m): BuilderOption => {
      const probe = (by: string | null, values: string[] = []) => draws({ ...blank, measure: m.id, by, values }, manifest);
      const dimensions = Object.entries(dimensionsOf(m)).flatMap(([id, phrase]) => {
        const values = !m.derived && Boolean(facts?.dimensions.includes(id)) && probe(id, ["?"]);
        // A count by a breakdown draws a line per chosen value, so without values it has nothing to draw.
        const needsValues = partsOf(m).some((p) => p.id === "count");
        return values || (!needsValues && probe(id)) ? [{ id, phrase, values }] : [];
      });
      return {
        id: m.id,
        phrase: measurePhrase(m),
        joiner: m.joiner,
        derived: Boolean(m.derived),
        allowsTotal: !m.parts && !m.derived && findMeasure(m.id)?.shape === "trend" && probe(null),
        dimensions,
      };
    })
    .filter((m) => m.dimensions.length > 0 || m.allowsTotal);
  const filters = (facts?.dimensions ?? [])
    .filter((id) => findDimension(id))
    .map((id) => ({ id, label: publicCopy.dimension_labels[id] ?? findDimension(id)?.label ?? id }));
  return { dataset: builderSpec.dataset, measures, filters };
}

// A question from the address bar, kept only as far as the page offers it; otherwise the nearest one that is.
export function settle(vocabulary: Vocabulary, q: Partial<Question>): Question {
  const m = vocabulary.measures.find((o) => o.id === q.measure) ?? vocabulary.measures[0];
  const dimension = m.dimensions.find((d) => d.id === q.by);
  const by = dimension ? dimension.id : m.allowsTotal && (q.by === null || q.by === undefined) ? null : (m.dimensions[0]?.id ?? null);
  const offered = new Set(vocabulary.filters.map((f) => f.id));
  const where = Object.fromEntries(Object.entries(q.where ?? {}).filter(([d, kept]) => offered.has(d) && d !== by && kept.length > 0));
  const values = by && m.dimensions.find((d) => d.id === by)?.values ? (q.values ?? []) : [];
  const settled: Question = { measure: m.id, by, values, where, view: null };
  return { ...settled, view: q.view && viewsFor(settled).includes(q.view) ? q.view : null };
}

// The address-bar form of a question, scoped by the builder's id. Values repeat a key rather than join with a
// separator, since a value may contain any character.
const key = (name: string) => `${builderSpec.id}.${name}`;
const WHERE = "where.";

export function readQuestion(search: string): Partial<Question> {
  const params = new URLSearchParams(search);
  const where: Record<string, string[]> = {};
  for (const [k, v] of params) {
    if (k.startsWith(key(WHERE))) (where[k.slice(key(WHERE).length)] ??= []).push(v);
  }
  const by = params.get(key("by"));
  return {
    measure: params.get(key("measure")) ?? undefined,
    by: by === null ? undefined : by === "" ? null : by,
    values: params.getAll(key("value")),
    where,
    view: params.get(key("view")),
  };
}

export function questionParams(q: Question): URLSearchParams {
  const params = new URLSearchParams({ [key("measure")]: q.measure, [key("by")]: q.by ?? "" });
  for (const v of q.values) params.append(key("value"), v);
  for (const [d, kept] of Object.entries(cleanWhere(q.where))) for (const v of kept) params.append(key(`${WHERE}${d}`), v);
  if (q.view) params.set(key("view"), q.view);
  return params;
}

// The question that draws the same chart as this Explore view, where the builder can ask it: its dataset, a measure
// it offers with this breakdown, the same cap on named values, and the view's filters as the question's. Composite
// presets never qualify ($composite in config/presets.json), and neither does the builder's own chart.
export function builderQuestionFor(view: Preset): Question | null {
  if (view.id.startsWith(builderSpec.id) || view.series || view.dataset !== builderSpec.dataset || !view.dimension) return null;
  const m = builderSpec.measures.find((x) => !x.parts && (x.derived ? x.id === view.derived : !view.derived && x.id === view.measure));
  if (!m || !(view.dimension in m.dimensions) || m.top_n?.[view.dimension] !== view.top_n) return null;
  const where: Record<string, string[]> = {};
  for (const filter of view.filters ?? []) for (const [d, v] of Object.entries(filter)) (where[d] ??= []).push(v);
  return { measure: m.id, by: view.dimension, values: [], where, view: null };
}

// The Build page's address for a question. It carries the time range the chart was showing, where that differs from
// the question's own default, so the chart opens as the reader left it.
export function builderHref(q: Question, period?: string, fullHistory = false): string {
  const params = questionParams(q);
  const [first] = builderPresets(q);
  if (period && first && period !== first.period) params.set(key("period"), period);
  if (fullHistory) params.set(key("range"), "all");
  return `/build?${params}`;
}
