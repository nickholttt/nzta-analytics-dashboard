// The fact table's columns, read where the site is built (the home page's latest month and the answer pages ask), in Node with the reader the browser
// uses (hyparquet), and the cuts worked out from them (src/lib/conditionViews.ts). Nothing here reaches a browser: those pages ship no script.
//
// The fact table is read because it holds the counts of a field by the condition. A field the table does not carry is read from the published pair of it and
// the condition instead, where the manifest lists one live (readPairColumns). Where a field's counts cannot be read, are not listed, or any field is under
// the small-cell rule, that field has no cut and the page is drawn as it was. Each column and each pair is read once per reader, however many pages ask.
import { parquetReadObjects } from "hyparquet";
import { decompressZstd } from "hyparquet-compressors";
import { findDimension, unrecordedBand } from "./config";
import { Cut, capFloor, pairColumns } from "./conditionViews";
import { cutSet } from "./powertrainCut";
import type { CutSet } from "./powertrainCut";
import type { FactColumns } from "./conditionViews";
import { PAIR_SEPARATOR, SMALL_CELL_KEY, ruleMinimum, smallCellPairs } from "./data";
import type { Manifest, SliceRow } from "./data";
import type { ReadFile } from "./latestMonthBuild";
import { monthKey } from "./monthkey";
import { findPair } from "./resolve";
import { NOT_BROKEN_DOWN_TOKEN, NOT_RECORDED_TOKEN } from "./sentences";

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

// A column of month keys from the file's months, each distinct month converted once.
function monthKeys(month: readonly unknown[]): string[] {
  const keys = new Map<string, string>();
  return month.map((v) => {
    const id = v instanceof Date ? String(v.getTime()) : String(v);
    let key = keys.get(id);
    if (key === undefined) keys.set(id, (key = monthKey(v)));
    return key;
  });
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
  const months = monthKeys(month);
  const values: Record<string, string[]> = {};
  dimensions.forEach((d, i) => {
    const band = unrecordedBand(d);
    values[d] = (rest[i] as unknown[]).map((v) => (band !== undefined && v === band ? NOT_RECORDED_TOKEN : String(v)));
  });
  return { month: months, n: counts, values };
}

// A published pair's rows as the fact table's columns for `field` and `condition`, or nothing unless: the manifest lists the pair live and not written under the
// small-cell rule, neither field is under that rule, the file is there and can be read, and no row hides its count or stands for a month not broken down. The
// pair holds exactly the counts of the two fields, so a cut from it is the cut the fact table would give for them.
export async function readPairColumns(read: ReadFile, manifest: Manifest, dataset: string, field: string, condition: string): Promise<FactColumns | undefined> {
  const found = findPair(manifest.datasets[dataset]?.live_pairs ?? [], field, condition);
  if (!found || smallCellPairs(manifest, dataset).includes(found.pair)) return undefined;
  if ([field, condition].some((d) => ruleMinimum(manifest, dataset, SMALL_CELL_KEY, d) !== undefined)) return undefined;
  let mine = columns.get(read);
  if (!mine) columns.set(read, (mine = new Map()));
  const key = `pair:${dataset}/${found.pair}`;
  let pending = mine.get(key);
  if (!pending) {
    pending = (async () => {
      const file = read(`pairs/${dataset}/${found.pair}.parquet`);
      if (!file) return undefined;
      try {
        return await parquetReadObjects({ file, compressors, columns: ["month", "a_value", "b_value", "n"] });
      } catch {
        return undefined;
      }
    })();
    mine.set(key, pending);
  }
  const rows = (await pending) as { month: unknown; a_value: unknown; b_value: unknown; n: unknown }[] | undefined;
  if (!rows) return undefined;
  const counts = rows.map((r) => (r.n === null || r.n === undefined ? Number.NaN : Number(r.n)));
  if (counts.some((x) => !Number.isFinite(x)) || rows.some((r) => r.a_value === NOT_BROKEN_DOWN_TOKEN && r.b_value === NOT_BROKEN_DOWN_TOKEN)) return undefined;
  const [first, second] = found.pair.split(PAIR_SEPARATOR);
  const recorded = (d: string) => {
    const band = unrecordedBand(d);
    return (v: unknown) => (band !== undefined && v === band ? NOT_RECORDED_TOKEN : String(v));
  };
  return pairColumns({ month: monthKeys(rows.map((r) => r.month)), n: counts, a: rows.map((r) => recorded(first)(r.a_value)), b: rows.map((r) => recorded(second)(r.b_value)) }, field, condition, found.side);
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
  // A field the fact table carries is cut from it, every one in one read; any other from the published pair of it and the condition, where there is one.
  // One field with no counts to cut leaves that field without a cut and no other.
  const listed = manifest.datasets[dataset]?.facts?.dimensions ?? [];
  const inTable = all.filter((f) => listed.includes(f));
  const table = inTable.length > 0 && listed.includes(condition) ? await readFactColumns(read, manifest, dataset, inTable) : undefined;
  for (const field of all) {
    const columns = listed.includes(field) ? table : await readPairColumns(read, manifest, dataset, field, condition);
    const cut = columns ? Cut.from(columns, field, condition, order) : undefined;
    if (cut && cut.agreesWith(slices[field])) cuts[field] = cut;
    else if (cut) console.warn(`[new and used] ${dataset}: THE COUNTS OF ${field} BY ${condition} DISAGREE WITH ITS SLICE (${columns === table ? "the fact table" : "the published pair"}): no split is drawn for it`);
    else console.warn(`[new and used] ${dataset}: no split by ${condition} for ${field}: its counts are missing`);
    floors[field] = cuts[field] && isCapped(field) ? capFloor(slices[field], months) : undefined;
  }
  return { condition, cuts, floors };
}

// The cuts of `fields` by `condition` for all the vehicles and for the vehicles of each value of `restrict` (the powertrain, on the site), read from the fact
// table where the site is built; nothing, with one build line, where the table is missing or any cut does not hold to its slice (src/lib/powertrainCut.ts).
export async function restrictedCuts(
  read: ReadFile,
  manifest: Manifest,
  dataset: string,
  condition: string,
  order: readonly string[],
  fields: readonly string[],
  restrict: string,
  slices: Readonly<Record<string, readonly SliceRow[] | undefined>>,
): Promise<CutSet | undefined> {
  const table = await readFactColumns(read, manifest, dataset, [...new Set([condition, restrict, ...fields])]);
  const set = table ? cutSet(table, condition, order, fields, restrict, slices) : undefined;
  if (!set) console.warn(`[by ${restrict}] ${dataset}: no cut by ${restrict}: the fact table is missing or does not agree with the slices`);
  return set;
}
