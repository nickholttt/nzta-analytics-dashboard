// Everything the charts know comes from config/: presets, measures, dimensions, and the pipeline's
// category and event-scope bindings. No domain value is written in this code.
import presetsDoc from "../../config/presets.json";
import measuresDoc from "../../config/measures.json";
import dimensionsDoc from "../../config/dimensions.json";
import pipelineDoc from "../../config/pipeline.json";

export type Preset = {
  id: string;
  question: string;
  dataset?: string;
  measure?: string;
  dimension?: string | null;
  period?: string;
  filters?: Record<string, string>[];
  events?: boolean;
  note?: string;
  top_n?: number;
  shape_override?: string;
  derived?: string;
  series?: unknown[];
  filter_value?: string;
};

export type Band = { label: string; min?: number; max?: number | null; unknown?: boolean; no_engine?: boolean };

export type Dimension = {
  id: string;
  label: string;
  note?: string;
  shape_hint?: string;
  cardinality?: string;
  applies_to?: string[];
  bands?: Band[];
  derive?: { kind: string; value?: string };
};

export type Dataset = {
  id: string;
  label: string;
  definition?: string;
  base?: string;
  filter?: Record<string, string[]>;
  status?: string;
};

export type Measure = { id: string; label: string; unit: string; shape?: string; guards?: { min_denominator?: number } };

type PresetsDoc = { groups: { id: string; label: string; presets: Preset[] }[] };

export const presets: Preset[] = (presetsDoc as unknown as PresetsDoc).groups.flatMap((g) => g.presets);
export const measures = measuresDoc.measures as unknown as Measure[];
export const derivedMeasures = measuresDoc.derived_measures as unknown as { id: string }[];
export const shareChangeUnit: string = measuresDoc.share_change_display.unit;
export const dimensions = dimensionsDoc.dimensions as unknown as Dimension[];
export const datasets = dimensionsDoc.datasets as unknown as Dataset[];
export const periods = dimensionsDoc.periods as { id: string; label: string }[];

const pipeline = pipelineDoc as unknown as {
  hybrid_classification: { powertrain_column: string; mild_powertrain: string };
  events: { scope_dimension_aliases: Record<string, string>; scope_without_values: string[] };
};
export const hybrid = pipeline.hybrid_classification;
export const scopeAliases = pipeline.events.scope_dimension_aliases;
export const scopeWithoutValues = pipeline.events.scope_without_values;

export const findPreset = (id: string) => presets.find((p) => p.id === id);
export const findDimension = (id?: string | null) => dimensions.find((d) => d.id === id);
export const findDataset = (id?: string) => datasets.find((d) => d.id === id);
export const findMeasure = (id?: string) => measures.find((m) => m.id === id);
