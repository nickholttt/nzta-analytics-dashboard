// A note that states a figure must come from the build, or it drifts the moment the data moves.
// note_template resolves {dotted.path} against the manifest, the preset's dataset entry in it, and
// the preset's measure and dimension definitions. A plain note may carry no figure at all; the panel
// renders a warning where one does, so the rule is enforced in front of the reader.
import { findDerived, findDimension, findMeasure } from "./config";
import type { Preset } from "./config";
import type { DatasetManifest, Manifest } from "./data";
import { servedFrom } from "./resolve";

import { fillTemplate } from "./sentences";
export { UNRESOLVED } from "./sentences";
export type { NoteContext } from "./sentences";
import type { NoteContext } from "./sentences";

// A dataset served from another one filtered (used imports, from every registration) reads that one's manifest entry.
export function noteContext(preset: Preset, manifest: Manifest): NoteContext {
  const served = servedFrom(preset.dataset, manifest);
  return {
    manifest,
    dataset: served ? withLatestExport(manifest.datasets[served]) : undefined,
    measure: findMeasure(preset.measure) ?? findDerived(preset.derived),
    dimension: findDimension(preset.dimension),
  };
}

// A supplied dataset's manifest entry with the date of its newest export under supplied.taken_latest, which a template can name.
function withLatestExport(entry: DatasetManifest): DatasetManifest {
  const supplied = entry.supplied;
  return supplied ? { ...entry, supplied: { ...supplied, taken_latest: supplied.taken[supplied.taken.length - 1] } as typeof supplied } : entry;
}

// Returns the filled note and every path the build did not supply, so a template that has outlived
// its manifest field is visible rather than silently rendering a question mark.
export const fillNote = fillTemplate;

export const noteStatesAFigure = (note: string) => /\d/.test(note);
