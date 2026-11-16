// The lines above the table of a downloaded file of figures (src/lib/figures.ts): what the chart is of, where its figures come from and who
// asks to be credited for them. Pure, so a test runs the header a chart's download writes. Each file carries the attribution of the datasets
// it holds and no other: a file of Stats NZ's series says nothing of NZTA's dashboard, and a chart that divides one dataset by another
// carries both (D-111).
import { findDataset, findDerived } from "./config";
import type { Preset } from "./config";
import { datasetName } from "./builder";
import type { FiguresHeader } from "./figures";
import type { Manifest } from "./data";
import { fillNote, noteContext } from "./notes";

// The datasets a chart draws on: its own, and for a measure that divides one by another, both of those.
export function datasetsOf(preset: Preset): string[] {
  const derived = findDerived(preset.derived);
  return [...new Set([preset.dataset, derived?.numerator_dataset, derived?.denominator_dataset].filter((id): id is string => Boolean(id)))];
}

// A template of a dataset's (its attribution, its source note) filled from the build, or nothing where the build lacks what it names: a
// sentence with a gap is dropped, not written with a question mark in it.
function filled(template: string | undefined, preset: Preset, dataset: string, manifest: Manifest): string | undefined {
  if (!template) return undefined;
  const { text, unresolved } = fillNote(template, noteContext({ ...preset, dataset }, manifest));
  return unresolved.length === 0 ? text : undefined;
}

// A dataset's own statement; one that is another filtered (used imports, from every registration) says what its base says.
export function datasetAttribution(dataset: string, manifest: Manifest, preset: Preset): string | undefined {
  const own = findDataset(dataset);
  return filled(own?.attribution ?? findDataset(own?.base)?.attribution, preset, dataset, manifest);
}

export function figuresHeader(args: { preset: Preset; manifest: Manifest; counted?: string; address: string }): FiguresHeader {
  const { preset, manifest, counted, address } = args;
  const datasets = datasetsOf(preset);
  const per = <T>(read: (id: string) => T | undefined) => datasets.map(read).filter((v): v is T => v !== undefined);
  return {
    question: preset.question,
    counted,
    datasets: datasets.map((id) => datasetName(id, manifest)),
    snapshot: manifest.latest_snapshot,
    sources: per((id) => filled(findDataset(id)?.source_note, preset, id, manifest)),
    attributions: [...new Set(per((id) => datasetAttribution(id, manifest, preset)))],
    address,
  };
}
