// Everything the charts know comes from config/: presets, measures, dimensions, and the pipeline's
// category and event-scope bindings. No domain value is written in this code.
import presetsDoc from "../../config/presets.json";
import measuresDoc from "../../config/measures.json";
import dimensionsDoc from "../../config/dimensions.json";
import pipelineDoc from "../../config/pipeline.json";

export type PresetStatus = "live" | "blocked" | "invalid";

export type Preset = {
  id: string;
  question: string;
  status: PresetStatus;
  requires?: string[];
  type?: string;
  dataset?: string;
  measure?: string;
  dimension?: string | null;
  period?: string;
  filters?: Record<string, string>[];
  events?: boolean;
  note?: string;
  note_template?: string;
  top_n?: number;
  shape_override?: string;
  derived?: string;
  series?: unknown[];
  filter_value?: string;
  smoothing?: string;
};

export type Band = { label: string; min?: number; max?: number | null; unknown?: boolean; no_engine?: boolean };

export type Dimension = {
  id: string;
  label: string;
  note?: string;
  note_template?: string;
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

export type Guards = { min_denominator?: number; min_share_of_trailing_median?: number; min_coverage?: number };
export type Measure = { id: string; label: string; unit: string; shape?: string; guards?: Guards };
export type DerivedMeasure = Measure & { snapshots_needed?: number };
export type Period = { id: string; label: string; months?: number };
export type SmoothingOption = { id: string; label: string; axis: string };

type PresetsDoc = {
  groups: { id: string; label: string; presets: Preset[] }[];
  defaults: {
    mix_smoothing: string;
    mix_smoothing_options: SmoothingOption[];
    top_n_basis: string;
    trailing_window_months: number;
    mix_default_start: {
      min_share: number;
      min_categories: number;
      sustain_months: number;
      applies_to_cardinality: string[];
    };
  };
  $composite: { max_series: number; builder_available: boolean; members: string[] };
};

const presetsFile = presetsDoc as unknown as PresetsDoc;

export const presetGroups = presetsFile.groups;
export const presets: Preset[] = presetsFile.groups.flatMap((g) => g.presets);
export const chartDefaults = presetsFile.defaults;
export const compositeRules = presetsFile.$composite;

export const measures = measuresDoc.measures as unknown as Measure[];
export const derivedMeasures = measuresDoc.derived_measures as unknown as DerivedMeasure[];
export const shareChangeUnit: string = measuresDoc.share_change_display.unit;
export const dimensions = dimensionsDoc.dimensions as unknown as Dimension[];
export const datasets = dimensionsDoc.datasets as unknown as Dataset[];
export const periods = dimensionsDoc.periods as unknown as Period[];

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
export const findDerived = (id?: string) => derivedMeasures.find((m) => m.id === id);
export const findPeriod = (id?: string) => periods.find((p) => p.id === id);
// A composite preset is one the $composite block names. The type field on the preset must agree with
// that list; resolve.ts reports a disagreement rather than picking a side.
export const COMPOSITE = "composite";
export const isComposite = (preset: Preset) => preset.type === COMPOSITE;
export const isDeclaredComposite = (preset: Preset) => compositeRules.members.includes(preset.id);
