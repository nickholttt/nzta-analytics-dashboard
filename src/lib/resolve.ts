// What a preset asks for, checked against what the cube actually contains. Nothing is worked around:
// a blocking problem stops the chart, and a filter the cube cannot apply is shown on the chart.
//
// The check also produces a status, and presets.json carries an authored one. They are compared
// rather than merged: an authored status that no longer matches the build is reported, because a
// triage table that has quietly gone stale is worse than no triage table.
import { COMPOSITE, chartDefaults, compositeRules, findDataset, findDerived, findDimension, findMeasure, findPeriod, isComposite, isDeclaredComposite, presets } from "./config";
import type { Dimension, Measure, Preset, PresetStatus } from "./config";
import { PAIR_SEPARATOR } from "./data";
import type { Manifest, ViewSource } from "./data";
import { RENDERED_DERIVED } from "./derived";

// The shapes this local reference tool draws: all five (CLAUDE.md §Shapes).
const RENDERED_SHAPES = new Set(["mix", "trend", "distribution", "league", "geo"]);

export type Resolution = {
  invalid: string[];
  blocked: string[];
  blocking: string[];
  // The subset that stops anything being drawn at all. A filter the cube cannot apply belongs in
  // blocking but not here: the chart is still worth showing, with the warning saying what it left out.
  preventsRender: string[];
  notApplied: string[];
  status: PresetStatus;
  statusDisagreement?: string;
  shape: string;
  dimension?: Dimension;
  measure?: Measure;
  // Where the rows come from, when anything can be drawn.
  source?: ViewSource;
};

export function inferShape(preset: Preset, dimension?: Dimension, measure?: Measure): string {
  if (preset.shape_override) return preset.shape_override;
  if (dimension?.shape_hint === "geo" || dimension?.shape_hint === "distribution") return dimension.shape_hint;
  const period = findPeriod(preset.period);
  // A league table is a ranking of one window, not a series over time.
  const singlePeriod = period?.months !== undefined && period.months <= chartDefaults.trailing_window_months;
  if (singlePeriod && (dimension?.cardinality === "high" || dimension?.cardinality === "very_high")) return "league";
  return measure?.shape ?? "trend";
}

// The periods that rank this view instead of tracing it: its own period and the one it offers for a
// ranking, kept only where that period makes it a league. The time row adds them to its spans, so a
// chart that opens as a league, or can become one, can always be brought back to it.
export function rankingPeriods(view: Preset): string[] {
  const dimension = findDimension(view.dimension);
  const measure = findMeasure(view.measure);
  return [...new Set([view.period, view.ranking_period])].filter(
    (id): id is string => Boolean(id) && inferShape({ ...view, period: id }, dimension, measure) === "league",
  );
}

export function resolvePreset(preset: Preset, manifest: Manifest): Resolution {
  const invalid: string[] = [];
  const blocked: string[] = [];
  const preventsRender: string[] = [];
  const notApplied: string[] = [];
  const add = (kind: "invalid" | "blocked", text: string, stopsDrawing = true) => {
    (kind === "invalid" ? invalid : blocked).push(text);
    if (stopsDrawing) preventsRender.push(text);
  };
  const dimension = findDimension(preset.dimension);
  const measure = findMeasure(preset.measure);
  const inCube = Object.keys(manifest.datasets);

  if (isComposite(preset) !== isDeclaredComposite(preset)) {
    add(
      "invalid",
      `composite membership disagrees: the preset ${isComposite(preset) ? "declares" : "does not declare"} type "${COMPOSITE}" but the $composite block ${
        isDeclaredComposite(preset) ? "lists" : "does not list"
      } it`,
      false,
    );
  }
  if (preset.series) {
    if (!isComposite(preset)) add("invalid", `the preset carries ${preset.series.length} series but is not typed "${COMPOSITE}"`, false);
    if (preset.series.length > compositeRules.max_series) {
      add("invalid", `a composite preset may carry at most ${compositeRules.max_series} series; this one carries ${preset.series.length}`, false);
    }
    add("blocked", "composite presets have no renderer in this tool: a curated two-series comparison, deliberately outside the builder grammar");
  }

  // A dataset that dimensions.json defines as another one filtered (base and filter) is served from its base, narrowed.
  const cubeDataset = servedFrom(preset.dataset, manifest);
  const narrowing: Narrowing[] = [];
  if (!preset.dataset && !preset.series) {
    add("invalid", "the preset names no dataset");
  } else if (preset.dataset && !cubeDataset) {
    const ds = findDataset(preset.dataset);
    const msg = `dataset "${preset.dataset}" is not in the cube: manifest.json lists only ${inCube.join(", ")}`;
    if (!ds) add("invalid", `${msg}, and dimensions.json does not define "${preset.dataset}" either`);
    else add("blocked", ds.status ? `${msg} (${ds.status})` : msg);
  } else if (preset.dataset && cubeDataset !== preset.dataset) {
    for (const [key, values] of Object.entries(findDataset(preset.dataset)?.filter ?? {})) narrowing.push({ key, values, own: true });
  }

  if (preset.derived) {
    if (!findDerived(preset.derived)) add("invalid", `derived measure "${preset.derived}" is not defined in config/measures.json`);
    else if (!RENDERED_DERIVED.has(preset.derived)) add("blocked", `derived measure "${preset.derived}" has no renderer in this tool`);
  } else if (!preset.series && !measure) {
    add("invalid", `measure "${preset.measure}" is not defined in config/measures.json`);
  }

  const entry = cubeDataset ? manifest.datasets[cubeDataset] : undefined;
  if (preset.dimension) {
    if (!dimension) add("invalid", `dimension "${preset.dimension}" is not defined in config/dimensions.json`);
    else if (entry && !entry.live_dimensions.includes(preset.dimension)) add("blocked", `dimension "${preset.dimension}" is not live in this build`);
  }

  if (preset.period && !findPeriod(preset.period)) {
    add("invalid", `period "${preset.period}" is not in the periods listed in config/dimensions.json`);
  }

  for (const filter of preset.filters ?? []) {
    for (const [key, value] of Object.entries(filter)) {
      if (findDimension(key)) narrowing.push({ key, values: [value], own: false });
      else {
        add("invalid", `filter key "${key}" is not a dimension in config/dimensions.json, so it resolves against nothing`, false);
        notApplied.push(`Preset filter ${key} = ${value} is not applied: "${key}" is not a dimension in config/dimensions.json. The chart is not narrowed by it.`);
      }
    }
  }

  // Where the rows come from. A pair slice is two-dimensional, so a view is narrowed by one dimension at most: its
  // dataset's own filter first, otherwise the preset's first filter. A dataset whose filter cannot be applied draws
  // nothing, since its base would be a different chart; a preset filter that cannot be applied leaves the chart
  // un-narrowed and says so.
  const breakdown = preset.dimension ?? entry?.live_dimensions[0];
  let source: ViewSource | undefined = entry && breakdown && cubeDataset ? { dataset: cubeDataset, dimension: breakdown } : undefined;
  const ordered = [...narrowing.filter((f) => f.own), ...narrowing.filter((f) => !f.own)];
  ordered.forEach((f, index) => {
    const wanted = `${f.key} = ${f.values.join(" or ")}`;
    const pair = index === 0 && entry && breakdown ? findPair(entry.live_pairs ?? [], breakdown, f.key) : undefined;
    if (pair && source) {
      source = { ...source, filter: { ...pair, dimension: f.key, values: f.values } };
      return;
    }
    const why =
      index === 0
        ? `it needs the ${breakdown} x ${f.key} pair slice, which this build does not carry`
        : `the view is already narrowed by ${ordered[0].key}, and a pair slice narrows by one dimension only`;
    if (f.own) {
      add("blocked", `dataset "${preset.dataset}" is ${cubeDataset} narrowed to ${wanted}: ${why}`);
      source = undefined;
    } else {
      add("blocked", `filter ${wanted}: ${why}`, false);
      notApplied.push(`Preset filter ${wanted} is not applied: ${why}. The chart is not narrowed by it.`);
    }
  });

  const shape = inferShape(preset, dimension, measure);
  if (!RENDERED_SHAPES.has(shape)) add("blocked", `shape "${shape}" has no renderer in this tool`);
  // A breakdown drawn frame by frame through time is a different picture from one period's distribution: nothing draws
  // it yet, and drawing the period's total instead would not answer the question.
  if (preset.animate_by) add("blocked", `"animate_by": "${preset.animate_by}" has no renderer in this tool: the ${shape} renderer draws one period at a time`);

  const status: PresetStatus = invalid.length > 0 ? "invalid" : blocked.length > 0 ? "blocked" : "live";
  const statusDisagreement =
    preset.status === status
      ? undefined
      : `presets.json calls this preset "${preset.status}"; against this build it resolves as "${status}". One of the two is out of date.`;

  return {
    invalid,
    blocked,
    blocking: [...invalid, ...blocked],
    preventsRender,
    notApplied,
    status,
    statusDisagreement,
    shape,
    dimension,
    measure,
    source: preventsRender.length === 0 ? source : undefined,
  };
}

type Narrowing = { key: string; values: string[]; own: boolean };

// The dataset in the cube that serves this one: itself, or for a dataset dimensions.json defines as another filtered,
// that base. A manifest entry, and any note figure drawn from it, belongs to the dataset that is served.
export function servedFrom(datasetId: string | undefined, manifest: Manifest): string | undefined {
  if (!datasetId) return undefined;
  if (manifest.datasets[datasetId]) return datasetId;
  const ds = findDataset(datasetId);
  return ds?.base && ds.filter && manifest.datasets[ds.base] ? ds.base : undefined;
}

// The live pair that splits one dimension by another, in either order, and which side of it the first one is.
export function findPair(livePairs: string[], dimension: string, other: string): { pair: string; side: "a" | "b" } | undefined {
  const forward = `${dimension}${PAIR_SEPARATOR}${other}`;
  const backward = `${other}${PAIR_SEPARATOR}${dimension}`;
  if (livePairs.includes(forward)) return { pair: forward, side: "a" };
  if (livePairs.includes(backward)) return { pair: backward, side: "b" };
  return undefined;
}

// The view a preset opens on: its first granularity option and its own period. The Explore page decides
// at build time which presets to show from this view, and PresetPanel draws from it, so the two agree.
export function presetView(preset: Preset, granularityId?: string | null, period?: string): Preset {
  const options = preset.granularity_options;
  const granularity = options?.find((g) => g.id === granularityId) ?? options?.[0];
  const base = granularity
    ? { ...preset, dimension: granularity.dimension, top_n: granularity.top_n ?? preset.top_n, note: granularity.note ?? preset.note }
    : preset;
  return { ...base, period: period ?? preset.period ?? "all" };
}

export type TriageRow = { preset: Preset; resolution: Resolution };

export const triage = (manifest: Manifest): TriageRow[] => presets.map((preset) => ({ preset, resolution: resolvePreset(preset, manifest) }));
