// The sentence builder's vocabulary: what the `builder` block in config/presets.json allows, narrowed
// to what draws against the cube as built. Each choice becomes a preset like any in the canon, so the
// resolver and the panel treat a built chart exactly as they treat an Explore one (D-044).
import { builderSpec, findDerived, findDimension, findMeasure } from "./config";
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

export function builderPreset(choice: Choice): Preset {
  const m = findBuilderMeasure(choice.measure);
  const preset: Preset = {
    id: builderSpec.id,
    question: sentence(choice),
    status: "live",
    dataset: builderSpec.dataset,
    dimension: choice.dimension,
    period: builderSpec.period,
    events: true,
    note: m?.note,
    note_template: m?.note_template,
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
