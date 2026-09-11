// What a preset asks for, checked against what the cube actually contains. Nothing is worked around:
// a blocking problem stops the chart, and a filter the cube cannot apply is shown on the chart.
import { derivedMeasures, findDataset, findDimension, findMeasure, periods } from "./config";
import type { Dimension, Measure, Preset } from "./config";
import type { Manifest } from "./data";

export type Resolution = {
  blocking: string[];
  notApplied: string[];
  vocabulary: string[];
  shape: string;
  dimension?: Dimension;
  measure?: Measure;
};

export function inferShape(preset: Preset, dimension?: Dimension, measure?: Measure): string {
  if (preset.shape_override) return preset.shape_override;
  if (dimension?.shape_hint === "geo" || dimension?.shape_hint === "distribution") return dimension.shape_hint;
  const singlePeriod = preset.period === "latest_month" || preset.period === "latest_year";
  if (singlePeriod && (dimension?.cardinality === "high" || dimension?.cardinality === "very_high")) return "league";
  return measure?.shape ?? "trend";
}

export function resolvePreset(preset: Preset, manifest: Manifest): Resolution {
  const blocking: string[] = [];
  const notApplied: string[] = [];
  const vocabulary: string[] = [];
  const dimension = findDimension(preset.dimension);
  const measure = findMeasure(preset.measure);
  const inCube = Object.keys(manifest.datasets);

  if (preset.series) blocking.push("multi-series presets are not rendered by this tool");

  if (!preset.dataset) {
    blocking.push("the preset names no dataset");
  } else if (!manifest.datasets[preset.dataset]) {
    const ds = findDataset(preset.dataset);
    let msg = `dataset "${preset.dataset}" is not in the cube: manifest.json lists only ${inCube.join(", ")}`;
    if (!ds) msg += `, and dimensions.json does not define "${preset.dataset}" either`;
    else if (ds.base && ds.filter) {
      const filters = Object.entries(ds.filter).map(([k, v]) => `${k} = ${v.join(" or ")}`).join(", ");
      msg += `. It is defined as ${ds.base} filtered to ${filters}, which needs a slice split by ${Object.keys(ds.filter).join(", ")}; the cube has only one-dimensional slices`;
    } else if (ds.status) msg += ` (${ds.status})`;
    blocking.push(msg);
  }

  if (preset.derived) {
    blocking.push(
      derivedMeasures.some((d) => d.id === preset.derived)
        ? `derived measure "${preset.derived}" is not rendered by this tool`
        : `derived measure "${preset.derived}" is not defined in config/measures.json`,
    );
  } else if (!measure) {
    blocking.push(`measure "${preset.measure}" is not defined in config/measures.json`);
  }

  if (preset.dimension) {
    const live = preset.dataset ? manifest.datasets[preset.dataset]?.live_dimensions : undefined;
    if (!dimension) blocking.push(`dimension "${preset.dimension}" is not defined in config/dimensions.json`);
    else if (live && !live.includes(preset.dimension)) blocking.push(`dimension "${preset.dimension}" is not live in this build`);
  }

  if (preset.period && preset.period !== "all" && !periods.some((p) => p.id === preset.period)) {
    vocabulary.push(`period "${preset.period}" is not in the periods listed in config/dimensions.json`);
  }

  for (const filter of preset.filters ?? []) {
    for (const [key, value] of Object.entries(filter)) {
      notApplied.push(
        findDimension(key)
          ? `Preset filter ${key} = ${value} is not applied: the cube has only one-dimensional slices, so ${preset.dimension} cannot be split by ${key}. Every in-scope vehicle is shown.`
          : `Preset filter ${key} = ${value} is not applied: "${key}" is not a dimension in config/dimensions.json, and the cube has only one-dimensional slices. Every in-scope vehicle is shown.`,
      );
    }
  }

  return { blocking, notApplied, vocabulary, shape: inferShape(preset, dimension, measure), dimension, measure };
}
