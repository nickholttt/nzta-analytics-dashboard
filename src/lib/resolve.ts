// What a preset asks for, checked against what the cube actually contains. Nothing is worked around:
// a blocking problem stops the chart, and a filter the cube cannot apply is shown on the chart.
//
// The check also produces a status, and presets.json carries an authored one. They are compared
// rather than merged: an authored status that no longer matches the build is reported, because a
// triage table that has quietly gone stale is worse than no triage table.
import { COMPOSITE, chartDefaults, compositeRules, findDataset, findDerived, findDimension, findMeasure, findPeriod, isComposite, isDeclaredComposite, presets } from "./config";
import type { Dimension, Measure, Preset, PresetStatus } from "./config";
import type { Manifest } from "./data";

// The shapes this local reference tool draws. league and geo are build step 6.
const RENDERED_SHAPES = new Set(["mix", "trend", "distribution"]);

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

  if (!preset.dataset && !preset.series) {
    add("invalid", "the preset names no dataset");
  } else if (preset.dataset && !manifest.datasets[preset.dataset]) {
    const ds = findDataset(preset.dataset);
    let msg = `dataset "${preset.dataset}" is not in the cube: manifest.json lists only ${inCube.join(", ")}`;
    if (!ds) {
      msg += `, and dimensions.json does not define "${preset.dataset}" either`;
      add("invalid", msg);
    } else {
      if (ds.base && ds.filter) {
        const filters = Object.entries(ds.filter).map(([k, v]) => `${k} = ${v.join(" or ")}`).join(", ");
        msg += `. It is defined as ${ds.base} filtered to ${filters}, which needs a slice split by ${Object.keys(ds.filter).join(", ")}; the cube has only one-dimensional slices`;
      } else if (ds.status) msg += ` (${ds.status})`;
      add("blocked", msg);
    }
  }

  if (preset.derived) {
    if (!findDerived(preset.derived)) add("invalid", `derived measure "${preset.derived}" is not defined in config/measures.json`);
    else add("blocked", `derived measure "${preset.derived}" has no renderer in this tool`);
  } else if (!preset.series && !measure) {
    add("invalid", `measure "${preset.measure}" is not defined in config/measures.json`);
  }

  if (preset.dimension) {
    const live = preset.dataset ? manifest.datasets[preset.dataset]?.live_dimensions : undefined;
    if (!dimension) add("invalid", `dimension "${preset.dimension}" is not defined in config/dimensions.json`);
    else if (live && !live.includes(preset.dimension)) add("blocked", `dimension "${preset.dimension}" is not live in this build`);
  }

  if (preset.period && !findPeriod(preset.period)) {
    add("invalid", `period "${preset.period}" is not in the periods listed in config/dimensions.json`);
  }

  for (const filter of preset.filters ?? []) {
    for (const [key, value] of Object.entries(filter)) {
      if (findDimension(key)) {
        add("blocked", `filter ${key} = ${value} needs a ${preset.dimension} x ${key} pair slice; the cube has only one-dimensional slices`, false);
        notApplied.push(
          `Preset filter ${key} = ${value} is not applied: the cube has only one-dimensional slices, so ${preset.dimension} cannot be split by ${key}. Every in-scope vehicle is shown.`,
        );
      } else {
        add("invalid", `filter key "${key}" is not a dimension in config/dimensions.json, so it resolves against nothing`, false);
        notApplied.push(
          `Preset filter ${key} = ${value} is not applied: "${key}" is not a dimension in config/dimensions.json, and the cube has only one-dimensional slices. Every in-scope vehicle is shown.`,
        );
      }
    }
  }

  const shape = inferShape(preset, dimension, measure);
  if (!RENDERED_SHAPES.has(shape)) add("blocked", `shape "${shape}" has no renderer in this tool`);

  const status: PresetStatus = invalid.length > 0 ? "invalid" : blocked.length > 0 ? "blocked" : "live";
  const statusDisagreement =
    preset.status === status
      ? undefined
      : `presets.json calls this preset "${preset.status}"; against this build it resolves as "${status}". One of the two is out of date.`;

  return { invalid, blocked, blocking: [...invalid, ...blocked], preventsRender, notApplied, status, statusDisagreement, shape, dimension, measure };
}

export type TriageRow = { preset: Preset; resolution: Resolution };

export const triage = (manifest: Manifest): TriageRow[] => presets.map((preset) => ({ preset, resolution: resolvePreset(preset, manifest) }));
