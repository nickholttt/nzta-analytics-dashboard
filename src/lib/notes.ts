// A note that states a figure must come from the build, or it drifts the moment the data moves.
// note_template resolves {dotted.path} against the manifest, the preset's dataset entry in it, and
// the preset's measure and dimension definitions. A plain note may carry no figure at all; the panel
// renders a warning where one does, so the rule is enforced in front of the reader.
import { findDerived, findDimension, findMeasure } from "./config";
import type { Preset } from "./config";
import type { DatasetManifest, Manifest } from "./data";
import { monthLabel } from "./measures";
import { servedFrom } from "./resolve";

const DATE_FORMAT = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const PLACEHOLDER = /\{([a-z_]+(?:\.[A-Za-z0-9_]+)*)(\|[a-z]+)?\}/g;

export const UNRESOLVED = "?";

export type NoteContext = Record<string, unknown>;

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

function lookup(context: NoteContext, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => {
    if (node === null || node === undefined) return undefined;
    return (node as Record<string, unknown>)[key];
  }, context);
}

function format(value: unknown, filter?: string): string {
  if (value === undefined || value === null) return UNRESOLVED;
  if (filter === "|month" && typeof value === "string") return monthLabel(value);
  if (filter === "|date" && typeof value === "string") return DATE_FORMAT.format(new Date(`${value}T00:00:00Z`));
  if (filter === "|pct") return typeof value === "number" ? `${(value * 100).toFixed(value * 100 < 10 ? 1 : 0)}%` : UNRESOLVED;
  return String(value);
}

// Returns the filled note and every path the build did not supply, so a template that has outlived
// its manifest field is visible rather than silently rendering a question mark.
export function fillNote(template: string, context: NoteContext): { text: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const text = template.replace(PLACEHOLDER, (_match, path: string, filter?: string) => {
    const value = lookup(context, path);
    if (value === undefined || value === null) unresolved.push(path);
    return format(value, filter);
  });
  return { text, unresolved };
}

export const noteStatesAFigure = (note: string) => /\d/.test(note);
