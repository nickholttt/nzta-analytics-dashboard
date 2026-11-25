// The fact table's columns, read where the site is built (the home page's latest month and the answer pages ask), in Node with the reader the browser
// uses (hyparquet), and the cuts worked out from them (src/lib/conditionViews.ts). Nothing here reaches a browser: those pages ship no script.
//
// The fact table is read because the dataset publishes no pair slice of a field by the condition (the manifest's live_pairs is empty), and the fact
// table holds exactly those counts. Where it cannot be read, is not listed for every field, or any field it is asked for is under the small-cell rule,
// there are no cuts and the pages are drawn as they were. Each column is read once per reader, however many pages ask.
import { parquetReadObjects } from "hyparquet";
import { decompressZstd } from "hyparquet-compressors";
import { findDimension, unrecordedBand } from "./config";
import { Cut, capFloor } from "./conditionViews";
import type { FactColumns } from "./conditionViews";
import { SMALL_CELL_KEY, ruleMinimum } from "./data";
import type { Manifest, SliceRow } from "./data";
import type { ReadFile } from "./latestMonthBuild";
import { monthKey } from "./monthkey";
import { NOT_RECORDED_TOKEN } from "./sentences";

const compressors = { ZSTD: (input: Uint8Array) => (decompressZstd as (input: Uint8Array) => Uint8Array)(input) };

const columns = new WeakMap<ReadFile, Map<string, Promise<unknown[] | undefined>>>();

async function readColumn(read: ReadFile, dataset: string, column: string): Promise<unknown[] | undefined> {
  let mine = columns.get(read);
  if (!mine) columns.set(read, (mine = new Map()));
  const key = `${dataset}/${column}`;
  let pending = mine.get(key);
  if (!pending) {
    pending = (async () => {
      const file = read(`facts/${dataset}/${column}.parquet`);
      if (!file) return undefined;
      try {
        return (await parquetReadObjects({ file, compressors, columns: [column] })).map((r) => r[column]);
      } catch {
        return undefined;
      }
    })();
    mine.set(key, pending);
  }
  return pending;
}

// The fact table's month, count and the named dimensions' columns, or nothing unless: the manifest lists every dimension in the fact table, every file
// is there and can be read, every count is a number, and none of the dimensions was written under the small-cell rule.
export async function readFactColumns(read: ReadFile, manifest: Manifest, dataset: string, dimensions: readonly string[]): Promise<FactColumns | undefined> {
  const listed = manifest.datasets[dataset]?.facts?.dimensions;
  if (!listed || dimensions.some((d) => !listed.includes(d))) return undefined;
  if (dimensions.some((d) => ruleMinimum(manifest, dataset, SMALL_CELL_KEY, d) !== undefined)) return undefined;
  const [month, n, ...rest] = await Promise.all([readColumn(read, dataset, "month"), readColumn(read, dataset, "n"), ...dimensions.map((d) => readColumn(read, dataset, d))]);
  if (!month || !n || rest.some((c) => !c)) return undefined;
  const counts = n.map(Number);
  if (counts.some((x) => !Number.isFinite(x))) return undefined;
  const keys = new Map<string, string>();
  const months = month.map((v) => {
    const id = v instanceof Date ? String(v.getTime()) : String(v);
    let key = keys.get(id);
    if (key === undefined) keys.set(id, (key = monthKey(v)));
    return key;
  });
  const values: Record<string, string[]> = {};
  dimensions.forEach((d, i) => {
    const band = unrecordedBand(d);
    values[d] = (rest[i] as unknown[]).map((v) => (band !== undefined && v === band ? NOT_RECORDED_TOKEN : String(v)));
  });
  return { month: months, n: counts, values };
}

export type ViewCuts = {
  // The condition's field.
  condition: string;
  // Each asked field's cut, or nothing where the fact table does not agree with the field's slice (one build line says so).
  cuts: Record<string, Cut | undefined>;
  // For a field the build caps (a model), the fewest vehicles over the months of any value it names; nothing for a field with no cap.
  floors: Record<string, number | undefined>;
};

// Whether the dimension's values beyond a cap are grouped as other (config/dimensions.json, derive.cap).
const isCapped = (dimension: string): boolean => typeof (findDimension(dimension)?.derive as { cap?: number } | undefined)?.cap === "number";

// The cuts of each field in `fields` by `condition`, each held to its slice, and the cap floors over `months`.
export async function viewCuts(
  read: ReadFile,
  manifest: Manifest,
  dataset: string,
  condition: string,
  order: readonly string[],
  fields: readonly string[],
  slices: Readonly<Record<string, readonly SliceRow[] | undefined>>,
  months: readonly string[],
): Promise<ViewCuts> {
  const cuts: Record<string, Cut | undefined> = {};
  const floors: Record<string, number | undefined> = {};
  const all = [...new Set([condition, ...fields])];
  const table = await readFactColumns(read, manifest, dataset, all);
  for (const field of all) {
    const cut = table ? Cut.from(table, field, condition, order) : undefined;
    if (cut && cut.agreesWith(slices[field])) cuts[field] = cut;
    else console.warn(`[new and used] ${dataset}: no split by ${condition} for ${field}: the fact table is missing or does not agree with its slice`);
    floors[field] = cuts[field] && isCapped(field) ? capFloor(slices[field], months) : undefined;
  }
  return { condition, cuts, floors };
}
