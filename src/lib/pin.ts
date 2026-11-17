// Pinning a question to a snapshot, so a figure can be quoted. The site serves one snapshot, the newest, so a pin can hold a window but never
// a snapshot's figures: those of a snapshot that has been replaced are not here, and a past month's can change between snapshots (vehicles
// leave the register, months are restated). What a pin does, and what the page says it does, is therefore:
//   - the window keeps ending in the pinned month, in the charts that end in a month the visitor can name (END_MONTH_SHAPES);
//   - the figures are always those of the snapshot being served, and the page says so, with its date, whenever that is not the snapshot month
//     the question was pinned to (the sentences are in config/presets.json, builder.notices). The snapshot is told by its month alone: the
//     snapshot date is always the last day of its month (docs/CUBE_SCHEMA.md), so a rebuild of the same month cannot be told from the first.
// A question that is not pinned has no month: it ends in the newest one, so a saved link redraws on a new month with nothing to do.
import { builderSpec, findDimension, findMeasure } from "./config";
import { builderPresets, isMonthKey } from "./builder";
import type { Question } from "./builder";
import type { Manifest } from "./data";
import { datasetLatestMonth } from "./data";
import { END_MONTH_SHAPES, inferShape } from "./resolve";
import { fillTemplate } from "./sentences";

// The month of the snapshot a page serves, as a pin names it.
export const servedMonth = (manifest: Manifest): string => manifest.latest_snapshot.slice(0, 7);

// The month a pinned chart ends in: the month it was pinned to while the data has gone on past it, otherwise none, and the chart ends in the
// dataset's newest month. So the same pin ends in the same month until the data moves on, and a question with no pin always follows the newest.
export const heldEnd = (through: string | undefined, newest: string): string | undefined => (through && through < newest ? through : undefined);

// The month a ranking or a grid ends in: a pinned question's, never the month the visitor had picked before pinning; otherwise the one they picked
// (empty: the newest).
export const shownEnd = (through: string | undefined, newest: string, picked: string): string | undefined => (through ? heldEnd(through, newest) : picked);

export type PinNote = { kind: "same" | "newer" | "ahead"; text: string };

// Whether the question's chart ends in a month a pin can hold.
export function holdsWindow(q: Question): boolean {
  const [first] = builderPresets(q);
  return Boolean(first) && END_MONTH_SHAPES.has(inferShape(first, findDimension(first.dimension), findMeasure(first.measure)));
}

// What to tell a visitor about a pinned question against the snapshot served now; undefined for a question that is not pinned.
export function pinNote(q: Question, manifest: Manifest): PinNote | undefined {
  if (!isMonthKey(q.snapshot)) return undefined;
  const served = manifest.latest_snapshot;
  const fill = (kind: PinNote["kind"], template: string): PinNote => ({
    kind,
    text: fillTemplate(template, { pinned: q.snapshot, date: served, latest: datasetLatestMonth(manifest, q.dataset) }).text,
  });
  const notices = builderSpec.notices;
  if (q.snapshot > servedMonth(manifest)) return fill("ahead", notices.pin_ahead);
  if (q.snapshot === servedMonth(manifest)) return fill("same", notices.pin_same);
  return fill("newer", holdsWindow(q) ? notices.pin_newer : notices.pin_newer_open);
}
