// The sentence builder's vocabulary: what the `builder` block in config/presets.json allows, narrowed
// to what draws against the cube as built. Each choice becomes a preset like any in the canon, so the
// resolver and the panel treat a built chart exactly as they treat an Explore one (D-044).
import { builderSpec, findDerived, findDimension, findMeasure, isComposite } from "./config";
import type { BuilderMeasure, Preset } from "./config";
import type { Manifest } from "./data";
import { inferShape, resolvePreset } from "./resolve";

export type Choice = { measure: string; dimension: string };

// What the page offers, worked out at build time and handed to the island as plain data.
export type BuilderOption = { id: string; phrase: string; joiner: string; dimensions: { id: string; phrase: string }[] };

const findBuilderMeasure = (id: string) => builderSpec.measures.find((m) => m.id === id);

// A derived measure's size comes from its definition, so the words cannot disagree with the line.
const measurePhrase = (m: BuilderMeasure) => m.phrase.replace("{top_n}", String(findDerived(m.id)?.top_n ?? ""));

export function sentence(choice: Choice): string {
  const m = findBuilderMeasure(choice.measure);
  if (!m) return "";
  const words = [measurePhrase(m), m.joiner, m.dimensions[choice.dimension]].filter(Boolean).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// The panel carries one preset note, so what the canon says about the dimension joins the measure's.
const joined = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ") || undefined;

export function builderPreset(choice: Choice): Preset {
  const m = findBuilderMeasure(choice.measure);
  const dimensionNote = builderSpec.dimension_notes[choice.dimension];
  const preset: Preset = {
    id: builderSpec.id,
    question: sentence(choice),
    status: "live",
    dataset: builderSpec.dataset,
    dimension: choice.dimension,
    period: builderSpec.period,
    ranking_period: builderSpec.ranking_period,
    events: true,
    note: joined(m?.note, dimensionNote),
    note_template: m?.note_template ? joined(m.note_template, dimensionNote) : undefined,
    top_n: m?.top_n?.[choice.dimension],
    ...(m?.derived ? { derived: m.id, shape_override: findDerived(m.id)?.shape } : { measure: m?.id }),
  };
  const shape = inferShape(preset, findDimension(choice.dimension), findMeasure(preset.measure));
  return { ...preset, period: builderSpec.period_by_shape[shape] ?? builderSpec.period };
}

// Only what draws is offered: a dimension the cube does not carry, or a shape with no renderer, never
// reaches the sentence. A measure left with nothing to split by is dropped with it.
export function builderOptions(manifest: Manifest): BuilderOption[] {
  return builderSpec.measures
    .map((m) => ({
      id: m.id,
      phrase: measurePhrase(m),
      joiner: m.joiner,
      dimensions: Object.entries(m.dimensions)
        .filter(([id]) => resolvePreset(builderPreset({ measure: m.id, dimension: id }), manifest).preventsRender.length === 0)
        .map(([id, phrase]) => ({ id, phrase })),
    }))
    .filter((m) => m.dimensions.length > 0);
}

// A choice from the address bar is kept only if the page offers it; otherwise the nearest one that is.
export function settle(options: BuilderOption[], measure?: string | null, dimension?: string | null): Choice {
  const m = options.find((o) => o.id === measure) ?? options[0];
  const d = m.dimensions.find((o) => o.id === dimension) ?? m.dimensions[0];
  return { measure: m.id, dimension: d.id };
}

// The sentence that draws the same chart as this view, where the builder can say it: its dataset, a measure it
// offers with this breakdown, the same cap on named values, and no filter, since the sentence has no blank for one.
// Composite presets never qualify ($composite in config/presets.json), and neither does the builder's own chart.
export function builderChoiceFor(view: Preset): Choice | null {
  if (view.id === builderSpec.id || isComposite(view) || view.series || view.filters?.length) return null;
  if (view.dataset !== builderSpec.dataset || !view.dimension) return null;
  const m = builderSpec.measures.find((x) => (x.derived ? x.id === view.derived : !view.derived && x.id === view.measure));
  if (!m || !(view.dimension in m.dimensions) || m.top_n?.[view.dimension] !== view.top_n) return null;
  return { measure: m.id, dimension: view.dimension };
}

// The Build page's address for a choice. It carries the time range the chart was showing, where that differs from the
// sentence's own default, so the chart opens as the reader left it.
export function builderHref(choice: Choice, period?: string, fullHistory = false): string {
  const id = builderSpec.id;
  const params = new URLSearchParams({ [`${id}.measure`]: choice.measure, [`${id}.by`]: choice.dimension });
  if (period && period !== builderPreset(choice).period) params.set(`${id}.period`, period);
  if (fullHistory) params.set(`${id}.range`, "all");
  return `/build?${params}`;
}
