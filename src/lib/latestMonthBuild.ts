// The latest month, read where the site is built (src/components/LatestMonth.astro calls it): the slices the build published, in Node with the reader
// the browser uses (hyparquet), then the section worked out by src/lib/latestMonth.ts. Nothing here reaches a browser: the home page ships no script.
//
// The browser reads published data only through src/lib/data.ts. This reads the same files from the folder the site is built from, and reads a slice
// by the same rules data.ts's loadSlice does (tests/site/latest-month.test.ts holds the two to the same rows over the hidden-cell fixtures):
// a month's date as a key, a hidden count as a flagged row with no count, a month not broken down by the field as such, a slice that holds either
// without the manifest saying it was written under the small-cell rule is refused whole, and a banded field's own unknown band is the not-recorded value.
//
// Where a file is missing or cannot be read, the field has no slice and its block is not drawn; where the dataset is not in the build there is no
// section. Neither is an error.
import { parquetReadObjects } from "hyparquet";
import { decompressZstd } from "hyparquet-compressors";
import { builderVocabulary, datasetName } from "./builder";
import { canvasSpec, canvasVocabulary } from "./canvas";
import { chartSentences } from "./chartWords";
import { dimensionLabel, findDataset, findDimension, findMeasure, phrases, unrecordedBand, valueWords, yearChangeFloor } from "./config";
import type { Preset } from "./config";
import { SMALL_CELL_KEY, ruleMinimum } from "./data";
import { labeller } from "./displayNames";
import { builtDisplayNames } from "./displayNamesBuild";
import type { Event, Manifest, SliceRow } from "./data";
import { latestConfig, latestMonthView } from "./latestMonth";
import type { Kit, LatestConfig, View } from "./latestMonth";
import { latestMonthLink } from "./latestMonthLinks";
import { monthKey } from "./monthkey";
import { fillNote, noteContext } from "./notes";
import { NOT_BROKEN_DOWN_TOKEN, NOT_RECORDED_TOKEN, countedText, fillTemplate, monthLabel } from "./sentences";
import { pct, shareChange } from "./measures";

// The cube is written with zstd (docs/CUBE_SCHEMA.md): the one codec the files need, as data.ts takes it.
const compressors = { ZSTD: (input: Uint8Array) => (decompressZstd as (input: Uint8Array) => Uint8Array)(input) };

// How a file of the data is read: its path under the data folder ("cube/<dataset>/<field>.parquet", "events.json") to its bytes, or nothing where it is not there. The
// page's own file reads it from the folder the site is built from (src/components/LatestMonth.astro), so this module needs no Node types.
export type ReadFile = (relative: string) => ArrayBuffer | undefined;

// One slice as data.ts's loadSlice reads it, or nothing where its file is missing, cannot be read, or holds hidden counts the manifest does not say were hidden by the rule.
export async function readSlice(read: ReadFile, manifest: Manifest, dataset: string, dimension: string): Promise<SliceRow[] | undefined> {
  const file = read(`cube/${dataset}/${dimension}.parquet`);
  if (!file) return undefined;
  let rows: Awaited<ReturnType<typeof parquetReadObjects>>;
  try {
    rows = await parquetReadObjects({ file, compressors, columns: ["month", "dim_value", "n", "denominator"] });
  } catch {
    return undefined;
  }
  const hides = (r: (typeof rows)[number]) => r.n === null || r.n === undefined || r.dim_value === NOT_BROKEN_DOWN_TOKEN;
  if (rows.some(hides) && ruleMinimum(manifest, dataset, SMALL_CELL_KEY, dimension) === undefined) return undefined;
  const band = unrecordedBand(dimension);
  const recorded = (value: string) => (band !== undefined && value === band ? NOT_RECORDED_TOKEN : value);
  return rows.map((r): SliceRow => {
    const month = monthKey(r.month);
    const denominator = Number(r.denominator);
    if (r.dim_value === NOT_BROKEN_DOWN_TOKEN) return { month, value: NOT_BROKEN_DOWN_TOKEN, n: Number(r.n), denominator, notBrokenDown: true };
    if (r.n === null || r.n === undefined) return { month, value: recorded(String(r.dim_value)), n: Number.NaN, denominator, hidden: true };
    return { month, value: recorded(String(r.dim_value)), n: Number(r.n), denominator };
  });
}

export function readEvents(read: ReadFile): Event[] | null {
  const file = read("events.json");
  if (!file) return null;
  try {
    const events = JSON.parse(new TextDecoder().decode(file));
    return Array.isArray(events) ? (events as Event[]) : null;
  } catch {
    return null;
  }
}

// The slices the section's blocks and total read, each field once.
export async function readSlices(read: ReadFile, manifest: Manifest, config: LatestConfig): Promise<Record<string, SliceRow[] | undefined>> {
  const fields = [...new Set([config.total_from, ...config.blocks.flatMap((b) => (b.dimension ? [b.dimension] : []))])];
  const slices: Record<string, SliceRow[] | undefined> = {};
  for (const dimension of fields) slices[dimension] = await readSlice(read, manifest, config.dataset, dimension);
  return slices;
}

// The section for the newest month of this build, or nothing where the build cannot give it.
export async function latestMonthSection(manifest: Manifest, read: ReadFile, config: LatestConfig = latestConfig): Promise<View | undefined> {
  const dataset = findDataset(config.dataset);
  if (!dataset || !manifest.datasets[config.dataset]) return undefined;
  const slices = await readSlices(read, manifest, config);
  const all = canvasVocabulary(builderVocabulary(manifest));
  const words = dataset.words ?? (dataset.base ? findDataset(dataset.base)?.words : undefined);
  const windowText = (month: string) => fillTemplate(phrases.window_month, { end: monthLabel(month) }).text;
  const source = fillNote(dataset.source_note ?? "", noteContext({ dataset: config.dataset } as Preset, manifest));
  // A value is named as a person writes it (src/lib/displayNames.ts); the canvas keeps the register's capitals.
  const names = labeller(builtDisplayNames(), (field) => findDimension(field)?.key_separator, (field) => (slices[field] ?? []).map((r) => r.value), valueWords);
  const kit: Kit = {
    config,
    manifest,
    slices,
    events: readEvents(read),
    sentences: chartSentences,
    label: { field: (dimension) => dimensionLabel(dimension, false, config.dataset), value: names.label },
    dataset: {
      counted: (n, window) => countedText(words?.leader_count, n, window),
      showsYear: dataset.shows_year_change === true,
      unit: words?.month_unit ?? datasetName(config.dataset, manifest),
    },
    window: windowText,
    floors: { change: yearChangeFloor(), share: findMeasure("share")?.guards?.min_denominator ?? 0 },
    format: { share: pct, points: shareChange },
    hidden: {
      word: phrases.hidden_word,
      link: phrases.hidden_link,
      reason: (minimum) => fillTemplate(phrases.hidden_reason, { minimum }).text,
      note: (hidden, minimum) => fillTemplate(hidden === 1 ? phrases.hidden_ranking_note_one : phrases.hidden_ranking_note, { count: hidden, minimum }).text,
    },
    ruleMinimum: (dimension) => ruleMinimum(manifest, config.dataset, SMALL_CELL_KEY, dimension),
    link: (block) =>
      latestMonthLink(all, manifest, {
        dataset: config.dataset,
        measure: block.canvas.measure,
        by: block.canvas.by ? (block.dimension ?? null) : null,
        type: block.canvas.type,
        settings: block.canvas.settings,
      }),
    provenance: {
      source: source.unresolved.length === 0 && source.text ? source.text : undefined,
      snapshot: fillNote(canvasSpec.words.snapshot_line, { date: manifest.latest_snapshot }).text,
    },
  };
  return latestMonthView(kit);
}
