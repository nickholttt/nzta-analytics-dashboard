// The Explore question a canvas chart may be titled with. A chart carries the id of the preset it stands for (config/presets.json); the id
// keys into config, so no title text is ever in an address. The chart keeps the title while its question is the preset's, and loses it the
// moment the question changes. This module is pure and names no field, measure, dataset or value.
import { presets } from "./config";
import type { Preset } from "./config";
import { builderQuestionFor } from "./builder";
import type { Question } from "./builder";
import { presetView } from "./resolve";

export const findPreset = (id: string): Preset | undefined => presets.find((p) => p.id === id);

// The title of a preset, as Explore gave it to its chart.
export const presetQuestion = (id: string): string | undefined => findPreset(id)?.question;

export type Asks = { dataset: string; measure: string | undefined; by: string | null; by2: string | null; where: Record<string, string[]> };

// What a preset asks, in a Build question's terms: the question the builder reads off it, with its where added (the builder reads a preset's
// filters and not its where). A preset with no breakdown, a count of all vehicles, is read from its own fields.
export function presetAsks(preset: Preset): Asks {
  const view = presetView(preset);
  const asks = builderQuestionFor(view);
  const filters = Object.fromEntries((preset.filters ?? []).flatMap((f) => Object.entries(f)).map(([d, v]): [string, string[]] => [d, [v]]));
  return {
    dataset: asks?.dataset ?? (preset.dataset as string),
    measure: asks?.measure ?? preset.measure ?? preset.derived,
    by: asks ? asks.by : (preset.dimension ?? null),
    by2: asks?.by2 ?? null,
    where: { ...(asks?.where ?? filters), ...(preset.where ?? {}) },
  };
}

const sameWhere = (a: Record<string, string[]>, b: Record<string, string[]>): boolean => {
  const keep = (w: Record<string, string[]>) => Object.entries(w).filter(([, v]) => v.length > 0).map(([d, v]) => `${d}=${[...v].sort().join("|")}`).sort().join(";");
  return keep(a) === keep(b);
};

// Whether the question is the preset's: the dataset, the measure, the breakdown or two, and the conditions, with no values of the visitor's
// own chosen (values the page fills in are not a choice). A chart pinned to a snapshot is still the same question.
export function standsFor(q: Question, id: string): boolean {
  const preset = findPreset(id);
  if (!preset) return false;
  const asks = presetAsks(preset);
  const chosen = (q.pageValues ? [] : q.values).length + (q.values2?.length ?? 0);
  return chosen === 0 && q.dataset === asks.dataset && q.measure === asks.measure && q.by === asks.by && (q.by2 ?? null) === asks.by2 && sameWhere(q.where, asks.where);
}
