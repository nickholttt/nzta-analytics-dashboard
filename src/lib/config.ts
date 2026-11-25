// Everything the charts know comes from config/: presets, measures, dimensions, and the pipeline's
// category and event-scope bindings. No domain value is written in this code.
import presetsDoc from "../../config/presets.json";
import type { AnswerTemplates as Answer } from "./sentences";
import type { FiguresPhrases } from "./figures";
import type { MatrixPhrases, PickedRankingPhrases, RankingPhrases, RankingThinPhrases, YearPhrases } from "./sentences";
import measuresDoc from "../../config/measures.json";
import dimensionsDoc from "../../config/dimensions.json";
import pipelineDoc from "../../config/pipeline.json";

export type PresetStatus = "live" | "blocked" | "invalid";

export type GranularityOption = {
  id: string;
  label: string;
  dimension: string;
  top_n?: number;
  note?: string;
};

// The sentence above a count's chart, for the month shown, by what the figure did against the same month a year earlier.
export type AnswerTemplates = Answer;

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
  // A period the time row also offers, where it turns the chart into a ranking of one window.
  ranking_period?: string;
  filters?: Record<string, string>[];
  events?: boolean;
  note?: string;
  note_template?: string;
  top_n?: number;
  shape_override?: string;
  // Draw the breakdown frame by frame through time; no renderer does yet, so the resolver blocks it.
  animate_by?: string;
  derived?: string;
  // A ratio of two datasets drawn for each value of `dimension` crossed with each value of this other dimension. Both datasets
  // must carry the pair of the two dimensions (the numerator as a pair slice, the denominator in its fact table).
  cross?: string;
  // A second breakdown: the preset is a grid, `dimension` down the side and this field across the top, for one window (D-114). values2 are the
  // values chosen for the columns (values, for the rows); with none chosen the grid shows the largest. cell_basis says what a cell holds when
  // the address does not: count, all, row or column.
  dimension2?: string;
  values2?: string[];
  cell_basis?: string;
  // A figure and a sentence for one month above the chart (the latest, or the one the visitor chooses).
  answer?: AnswerTemplates;
  series?: unknown[];
  filter_value?: string;
  // A question built on the Build page: the breakdown values it compares, and the vehicles it keeps, by dimension.
  // Either one draws from the fact table (D-058).
  values?: string[];
  // The values above are ones the page chose (the largest under the conditions), not ones the visitor chose: what the page says of them
  // is worded for that (D-111).
  page_values?: boolean;
  // The ranking of every value, asked for from a ranking of some (D-111): the page opens with who is first.
  ranks_all?: boolean;
  // A question pinned to a snapshot (YYYY-MM): the window of a chart that ends in a month the visitor can name keeps ending in it (src/lib/pin.ts).
  through?: string;
  where?: Record<string, string[]>;
  smoothing?: string;
  granularity_options?: GranularityOption[];
};

export type Band = { label: string; min?: number; max?: number | null; unknown?: boolean; no_engine?: boolean };

export type Dimension = {
  id: string;
  label: string;
  // The field in one line, for a visitor choosing what to ask about (the canvas's field list reads it, src/lib/canvasFields.ts).
  help?: string;
  note?: string;
  note_template?: string;
  // What the field is (category, ordered band, place ...), in the data map's words, and how long its list of values is.
  // The chart rules read both (config/chart_rules.json); a dimension never names a chart.
  kind: string;
  cardinality?: string;
  applies_to?: string[];
  bands?: Band[];
  derive?: { kind: string; value?: string };
  // The separator between the parts of a compound value (brand and model), so a ranking can show them as words. A
  // copy of the cube contract's constant, which is what the pipeline writes; a pipeline test keeps the two equal.
  key_separator?: string;
  // Wording for visitors, where `label` and `note` are written for maintainers (D-042). Each is used in place of
  // its counterpart on the public pages; /status keeps the original.
  public_label?: string;
  public_note?: string;
  // The note in one line, shown in place of public_note with a link to the full one (src/lib/dimensionNote.ts, D-137).
  public_line?: string;
  // A note that holds only in some states of a build names a condition (src/lib/dimensionNote.ts) and gives what to say when it does not.
  note_condition?: string;
  note_otherwise?: string;
  public_note_otherwise?: string;
};

// How a chart says what its dataset counts. Each is a template; the chart fills in the {names} it knows.
export type DatasetWords = {
  // The count a cap on the number of named values ranks by, as a noun phrase ("the models with the most ...").
  cap_count: string;
  count_heading: string;
  month_unit: string;
  window_unit: string;
  recent_figure: string;
  ranking_basis: string;
  // What the figure of the leading value counts, with {vehicles} and {window}; a dataset that has none says the vehicles and the window.
  leader_count?: string;
  // How a dataset of one period names its window in a sentence ("counted {window}"), in place of the month it ends in.
  window_one?: string;
  suggestion_recent: string;
  suggestion_total: string;
  none_recent: string;
};

export type Dataset = {
  id: string;
  label: string;
  // The name a visitor reads for what is counted (D-042); label is for maintainers.
  public_label?: string;
  grain?: string;
  // The dataset has one period and no other (a count as at the snapshot): no series over time, no window, no change on a year ago. The chart rules read it
  // as one period (config/chart_rules.json) and a question that would draw it over time is blocked (src/lib/resolve.ts).
  single_period?: boolean;
  // Whether a count's change on a year ago is shown for this dataset (a ranking's column, the monthly answer's comparison).
  shows_year_change?: boolean;
  definition?: string;
  public_definition?: string;
  // Where the figures come from and the export's date, filled from the manifest. Said under every chart of the dataset.
  source_note?: string;
  // The statement of where this dataset's figures come from and the licence, for a file of figures: said of this dataset and no other. A
  // template over the dataset's manifest entry, as source_note is.
  attribution?: string;
  // What a chart says when a build did not make the dataset.
  not_built_message?: string;
  // The last line under every chart of the dataset: what its figures are not, in plain words (it says nothing a visitor must take from the data).
  basis_note?: string;
  // The words this dataset uses for a field in place of the field's own label, keyed by dimension id.
  dimension_labels?: Record<string, string>;
  words?: DatasetWords;
  // Datasets that count some of the same vehicles as this one, so no chart reads both (datasetClashes).
  never_charted_with?: string[];
  base?: string;
  filter?: Record<string, string[]>;
  status?: string;
};

export type Guards = { min_denominator?: number; min_share_of_trailing_median?: number; min_coverage?: number };
// kind: count, share, average or ratio, which the chart rules read (config/chart_rules.json).
export type Measure = { id: string; label: string; unit: string; kind: string; guards?: Guards };
// A derived measure that divides one dataset's slice by another's names both, and the dimensions it can be split by.
export type DerivedMeasure = Measure & {
  snapshots_needed?: number;
  top_n?: number;
  numerator_dataset?: string;
  denominator_dataset?: string;
  // The ratio divides two datasets that never share a chart (never_charted_with) on purpose: it is one number built from both, not two series
  // drawn together, so datasetsRead does not count the two as read by a chart of it. Only a measure that says so is exempt.
  ratio_of_clashing_datasets?: boolean;
  // Where the numerator's breakdown is not the preset's dimension: its own id, and the one value-set of another dimension the
  // numerator is narrowed to (through a pair slice). The two datasets then divide on the values both name alike.
  numerator_dimension?: string;
  numerator_narrowed_to?: { dimension: string; values: string[] };
  // One line, with a link, under the chart: what a reader must know before trusting the ratio.
  caveat?: { text: string; link_label: string; href: string };
  // False where the measure's own definition already says what both datasets count, so their definitions are not repeated in the
  // notes. Absent means shown.
  show_dataset_definitions?: boolean;
  total_label?: string;
  definition?: string;
  // The line under a ratio chart ({base}: where its axis starts) and the name of its table of figures ({from}, {to}).
  unit_note?: string;
  table_label?: string;
  note?: string;
  note_template?: string;
};
export type Period = { id: string; label: string; months?: number };
export type SmoothingOption = { id: string; label: string; axis: string };

// One measure the sentence builder offers: its words, and the dimensions it may be split by, keyed by
// dimension id with the words the sentence uses for each.
export type BuilderMeasure = {
  id: string;
  derived?: boolean;
  phrase: string;
  joiner: string;
  dimensions: Record<string, string>;
  // Breakdowns only one dataset offers, with the words the sentence uses, added to the list above for that dataset (a field only a dataset of one period
  // carries, or one that is a condition everywhere else).
  dataset_dimensions?: Record<string, Record<string, string>>;
  top_n?: Record<string, number>;
  // Words that say what the measure counts. One text for every dataset, or one for each dataset that needs its own.
  note?: PerDataset;
  note_template?: string;
  // A measure drawn as two charts, one per part: each part is another measure's id.
  parts?: string[];
};

// A text that is the same for every dataset, or one text for each dataset that has its own.
export type PerDataset = string | Record<string, string>;
export const forDataset = (text: PerDataset | undefined, dataset: string): string | undefined =>
  typeof text === "string" ? text : text?.[dataset];

// A line the Build page says it does not offer: shown always, or only where the build lacks a dataset.
export type NotOffered = string | { text: string; when_not_built: string };

export type BuilderSpec = {
  id: string;
  // Pairs of fields that Build does not cross: each value of one sits under one value of the other.
  cannot_cross: string[][];
  // For each class of vehicle the data map says a field is recorded for (its recorded_for), the condition that keeps that class: a question that
  // breaks down by such a field starts with it (D-132). A class with no entry narrows nothing.
  narrowings: Record<string, { dimension: string; value: string; kind: string }>;
  // What is counted when the address does not say; datasets lists every one the page can offer, in order, where built.
  dataset: string;
  datasets: string[];
  period: string;
  period_when_comparing: string;
  period_by_shape: Record<string, string>;
  // The period a dataset of one period is drawn in (dimensions.json, single_period).
  period_single: string;
  ranking_period: string;
  lead: string;
  measures: BuilderMeasure[];
  dimension_notes: Record<string, PerDataset>;
  notices: { dataset: string; retired: string; retired_narrowed: string; by: string; by2: string; value2: string; left_out: string; absent: string; snapshot: string; pin_same: string; pin_newer: string; pin_newer_plain: string; pin_newer_open: string; pin_uncovered: string; pin_ahead: string; pin_kept: string; pin_kept_missing: string; pin_kept_withheld: string; small_cells_hidden: string; narrowed: string; narrowed_label: string };
  not_offered: NotOffered[];
};

type PresetsDoc = {
  // label and title head the group's section on the Explore page; lead marks the charts that carry it.
  // defer: the section draws its data only when scrolled to. Explore defers every chart but the page's first anyway.
  groups: { id: string; label: string; title: string; lead?: boolean; defer?: boolean; presets: Preset[] }[];
  defaults: {
    year_change_measure: string;
    phrases: RankingPhrases &
      RankingThinPhrases &
      PickedRankingPhrases &
      FiguresPhrases & { figures_not_recorded_cell: string; figures_withheld_thin: string; share_change_no_prior: string; not_ranked_before: string; year_too_few_window: string; period_replaced: string } &
      YearPhrases &
      MatrixPhrases & { identification_together: string; matrix_none: string; matrix_units: string; matrix_basis_head: string; matrix_basis_count: string; matrix_basis_all: string; matrix_basis_row: string; matrix_basis_column: string; matrix_total_count: string; matrix_total_share: string; matrix_legend_count: string; matrix_legend_share: string; matrix_legend_unshaded: string; matrix_legend_unshaded_plain: string; matrix_legend_up_to: string; matrix_legend_range: string; matrix_region: string; matrix_eyebrow: string; build_second_label: string; build_second_hint_ordered: string; chart_load_failed_label: string; chart_load_failed: string; chart_draw_failed_label: string; chart_draw_failed: string; matrix_legend_grey: string; matrix_window_pick: string; matrix_month_pick: string; matrix_scroll_hint: string; matrix_no_base_row: string; matrix_no_base_column: string; build_second_and: string; build_second_none: string; build_second_swap: string; build_second_remove: string; build_second_rows: string; build_second_columns: string; build_second_hint: string } & { matrix_legend_hidden: string; matrix_no_share_row_hidden: string; matrix_no_share_column_hidden: string; hidden_word: string; hidden_reason: string; hidden_ranking_note: string; hidden_ranking_note_one: string; hidden_link: string; not_broken_down: string; field_note_link: string } & { bad_month: string; pick_month: string; month_off_chart: string; not_recorded: string; share_with_not_recorded: string; breakdown_starts: string; exceeds_total: string; identification_coverage: string; identification_coverage_internal: string; identification_coverage_whole: string; tie_beyond_cut: string; rolling_share_note: string; rolling_share_note_internal: string; window_outside_data: string; mild_split_withheld: string; mild_split_withheld_internal: string; mild_split_withheld_link: string; grey_beyond_scale: string };
    matrix: { rows: number; columns: number; step_fractions: number[]; cells: Record<string, string> };
    mix_smoothing: string;
    mix_smoothing_options: SmoothingOption[];
    top_n_basis: string;
    trailing_window_months: number;
    colour_slots_by_trailing: number;
    mix_default_start: {
      min_share: number;
      min_categories: number;
      sustain_months: number;
      applies_to_cardinality: string[];
    };
  };
  $composite: { max_series: number; builder_available: boolean; members: string[] };
  builder: BuilderSpec;
};

const presetsFile = presetsDoc as unknown as PresetsDoc;

export const presetGroups = presetsFile.groups;
export const presets: Preset[] = presetsFile.groups.flatMap((g) => g.presets);
export const chartDefaults = presetsFile.defaults;
export const phrases = chartDefaults.phrases;
// The count under which a change on a year ago is withheld: the floor of the measure config names.
export const yearChangeFloor = (): number => findMeasure(chartDefaults.year_change_measure)?.guards?.min_denominator ?? 0;
export const compositeRules = presetsFile.$composite;
export const builderSpec = presetsFile.builder;

export const measures = measuresDoc.measures as unknown as Measure[];
export const derivedMeasures = measuresDoc.derived_measures as unknown as DerivedMeasure[];
export const shareChangeUnit: string = measuresDoc.share_change_display.unit;
export const dimensions = dimensionsDoc.dimensions as unknown as Dimension[];
export const datasets = dimensionsDoc.datasets as unknown as Dataset[];
export const periods = dimensionsDoc.periods as unknown as Period[];

// A dataset that was joined into another (dimensions.json, retired_datasets). Nothing writes its id any more; an old link, a saved canvas or a
// Build link still carries it, and the page reads it as `to`, narrowed by `where` to the vehicles the old dataset counted. `label` is the name
// the old dataset had, for the sentence that tells the visitor what happened.
export type RetiredDataset = { to: string; label: string; where?: Record<string, string[]> };
export const retiredDatasets = ((dimensionsDoc as unknown as { retired_datasets?: Record<string, RetiredDataset> }).retired_datasets ?? {}) as Readonly<Record<string, RetiredDataset>>;

// The browser is given only the keys of the pipeline config that are read here (scripts/browser-config.mjs): a key read from `pipeline` below must be listed there.
const pipeline = pipelineDoc as unknown as {
  // source_hybrid.value names the powertrain value that holds the hybrids; undivided_powertrain, where the pipeline names it, the one
  // that holds them where a dataset does not divide them (the same value today).
  hybrid_classification: { powertrain_column: string; mild_powertrain: string; source_hybrid: { column: string; value: string }; undivided_powertrain?: string };
  events: { scope_dimension_aliases: Record<string, string>; scope_without_values: string[] };
};
export const hybrid = pipeline.hybrid_classification;
export const scopeAliases = pipeline.events.scope_dimension_aliases;
export const scopeWithoutValues = pipeline.events.scope_without_values;

export const findPreset = (id: string) => presets.find((p) => p.id === id);
export const findDimension = (id?: string | null) => dimensions.find((d) => d.id === id);
// The band of a banded dimension that holds the vehicles with no usable value (a band config flags `unknown`), if it has one.
export const unrecordedBand = (id?: string | null): string | undefined => findDimension(id)?.bands?.find((b) => b.unknown)?.label;
// The words for a dimension: the visitor wording where config has it, unless the page is an internal one.
// A dataset can name a field in words of its own (its dimension_labels), where the field's usual words would say something it does not mean there.
export const dimensionLabel = (id: string, internal = false, dataset?: string) => {
  const d = findDimension(id);
  return findDataset(dataset)?.dimension_labels?.[id] ?? ((!internal && d?.public_label) || d?.label);
};
// A value as a visitor reads it: a compound value (brand and model) has its dimension's separator replaced by a space. The
// value itself, in addresses and in the data, is unchanged.
export function valueWords(dimensionId: string | undefined, value: string): string {
  const separator = findDimension(dimensionId)?.key_separator;
  return separator && value.includes(separator) ? value.split(separator).join(" ") : value;
}
// A label as it reads inside a sentence: its first letter in lower case, unless the label opens with an acronym (two capitals or more), which stays
// as written. Whole-lowercasing a label would also lower the acronyms and names in the rest of it.
export const lowerLabel = (label: string): string => (/^[A-Z]{2,}(?![a-z])/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));
export const findDataset = (id?: string) => datasets.find((d) => d.id === id);
// A dataset's words for what it counts: its own, or its base dataset's where it is another one filtered.
export function datasetWords(id?: string): DatasetWords | undefined {
  const dataset = findDataset(id);
  return dataset?.words ?? (dataset?.base ? findDataset(dataset.base)?.words : undefined);
}
// A dataset's basis note: its own, or its base dataset's where it is another one filtered.
export function datasetBasisNote(id?: string): string | undefined {
  const dataset = findDataset(id);
  return dataset?.basis_note ?? (dataset?.base ? findDataset(dataset.base)?.basis_note : undefined);
}
export const findMeasure = (id?: string) => measures.find((m) => m.id === id);
export const findDerived = (id?: string) => derivedMeasures.find((m) => m.id === id);
export const findPeriod = (id?: string) => periods.find((p) => p.id === id);
// A composite preset is one the $composite block names. The type field on the preset must agree with
// that list; resolve.ts reports a disagreement rather than picking a side.
export const COMPOSITE = "composite";
export const isComposite = (preset: Preset) => preset.type === COMPOSITE;
export const isDeclaredComposite = (preset: Preset) => compositeRules.members.includes(preset.id);

// ---- Datasets that count the same vehicles are never drawn together ----

// The datasets one chart reads: its own; both a ratio divides, unless the ratio is one that config says divides datasets that never share a chart
// (ratio_of_clashing_datasets: the one chart of the pair); the dataset each series of a curated comparison names. A dataset that is another one
// filtered counts as that one.
export function datasetsRead(preset: Preset, derived: (id?: string) => DerivedMeasure | undefined = findDerived): string[] {
  const ratio = derived(preset.derived);
  const named = [
    preset.dataset,
    ...(ratio?.ratio_of_clashing_datasets ? [] : [ratio?.numerator_dataset, ratio?.denominator_dataset]),
    ...(preset.series ?? []).map((s) => (s as { dataset?: string } | null)?.dataset),
  ];
  const served = named.filter((id): id is string => Boolean(id)).map((id) => findDataset(id)?.base ?? id);
  return [...new Set(served)];
}

// The pairs among these datasets that config says are never charted together (dimensions.json, never_charted_with): one counts the
// vehicles the other does, so a chart of both would count them twice or set a scope against its own subset. Declared on either side.
export function datasetClashes(ids: readonly string[], list: readonly Dataset[] = datasets): [string, string][] {
  const declared = (a: string, b: string) => list.find((d) => d.id === a)?.never_charted_with?.includes(b) ?? false;
  return ids.flatMap((a, i) => ids.slice(i + 1).filter((b) => declared(a, b) || declared(b, a)).map((b): [string, string] => [a, b]));
}
