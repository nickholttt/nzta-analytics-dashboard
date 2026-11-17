// Reads public/data exactly as the pipeline built it: manifest.json, events.json, 1-D cube slices, pair slices and the
// fact table.
import { parquetRead, parquetReadObjects } from "hyparquet";
import type { ColumnData } from "hyparquet";
import { decompressZstd } from "hyparquet-compressors";
import { builderSpec, unrecordedBand } from "./config";
import { NOT_RECORDED_TOKEN } from "./sentences";
import { monthKey } from "./monthkey";
import { UNREADABLE_DATA, isUnreadableForm } from "./unreadable";
import { crossPair, crossValue, narrowPair } from "./cross";
import type { HybridCoverage } from "./hybrid";
import { isMonthFolder, readIndex } from "./snapshotIndex";
import type { KeptSnapshots } from "./snapshotIndex";

export { monthKey };

const DATA = "/data";
// An earlier snapshot is read from a folder of its own, that month's release less any owner table its manifest does not cover (D-131).
const KEPT = "snapshots";

// The cube is written with zstd (docs/CUBE_SCHEMA.md); hyparquet reads snappy and uncompressed pages itself. The package
// of every codec ships a brotli decoder, a gzip one and a lz4 one this site never uses, so only the one the files need is
// taken from it. A file in any other codec fails to load with hyparquet's own "unsupported compression codec" message.
// Its types say a second argument, an output length; fzstd takes an optional output buffer there, so it is left out, as the
// package's own table does.
const compressors = { ZSTD: (input: Uint8Array) => (decompressZstd as (input: Uint8Array) => Uint8Array)(input) };

// A pair's file is pairs/{dataset}/{dim_a}__{dim_b}.parquet (docs/CUBE_SCHEMA.md, Pair slices).
export const PAIR_SEPARATOR = "__";

// other: on the rows of a grid (two fields crossed), the value of the second field; value is the first
export type SliceRow = { month: string; value: string; n: number; denominator: number; other?: string };

// Where a view's rows come from: a 1-D slice, a pair slice narrowed to some values of its other dimension (side says
// which of the pair's two dimensions is the view's breakdown), or the fact table, summed to the chosen values of the
// breakdown over the vehicles every filter keeps. dimension is null for the total of what the filters keep.
export type ViewSource = {
  dataset: string;
  dimension: string | null;
  // The kept snapshot (a month) the rows are read from; none: the newest, which the data folder itself holds.
  snapshot?: string;
  filter?: { pair: string; side: "a" | "b"; dimension: string; values: string[] };
  facts?: { values?: string[]; where: Record<string, string[]> };
  // Each value of the breakdown crossed with each value of this other dimension, one row for each combination (a value reads
  // "breakdown value · other value"), from a pair slice when `pair` is given, otherwise from the fact table. Where the
  // other dimension is not narrowed to some values, the crossed rows add up to the month's whole.
  // With grid set, the rows are those of a grid (factGrid): one for each month and pair of values, the second field's value in `other`.
  cross?: { dimension: string; pair?: { pair: string; side: "a" | "b" }; grid?: boolean };
};


// What the build says about the fact table (docs/CUBE_SCHEMA.md, Fact table). Absent from a manifest built before it.
export type FactsManifest = { rows: number; dimensions: string[]; not_live: Record<string, string> };

export type { CoverageBasis } from "./hybrid";

// A dataset made from a file a maintainer supplies by hand says which file's months and when it was taken
// (docs/CUBE_SCHEMA.md, Supplied sources).
export type SuppliedManifest = {
  source: string;
  months: { first: string; last: string; count: number };
  taken: string[];
  replaced: unknown[];
};

export type DatasetManifest = {
  definition?: string;
  // Set instead of every other field where the build did not make the dataset (no supplied store): the reason. Read it
  // before reading anything else; `isBuilt` does.
  not_built?: string;
  // The dataset's own last month, which a supplied dataset can have earlier than the register's.
  latest_month?: string;
  months?: number;
  supplied?: SuppliedManifest;
  live_dimensions: string[];
  // A dataset built from a published series: for each live dimension, the months in which its values add up to more than the
  // month's total (docs/CUBE_SCHEMA.md, Slice schema). A reader of a slice's sum must read this first.
  exceeds_total?: Record<string, string[]>;
  // Absent from a manifest built before pair slices existed.
  live_pairs?: string[];
  facts?: FactsManifest | null;
  mild_hybrid_identification_coverage?: HybridCoverage;
};

export type Manifest = {
  generated_at: string;
  latest_snapshot: string;
  datasets: Record<string, DatasetManifest>;
  snapshot_archive?: { path: string; status: string };
  warnings: string[];
};

// Whether the build made this dataset: it has an entry, and the entry is not the one that says it was not built.
export const isBuilt = (manifest: Manifest, dataset?: string): boolean => {
  const entry = dataset ? manifest.datasets[dataset] : undefined;
  return Boolean(entry) && !entry?.not_built;
};

// The last month a dataset has figures for. A dataset the register does not feed can end before the snapshot.
export const datasetLatestMonth = (manifest: Manifest, dataset?: string): string =>
  (dataset ? manifest.datasets[dataset]?.latest_month : undefined) ?? manifest.latest_snapshot.slice(0, 7);

export type Event = {
  id: string;
  date_start: string;
  date_end: string | null;
  mechanism: string;
  scope: string;
  scope_values: string[];
  title: string;
  summary: string;
  announced_date: string | null;
  source_url: string;
};

// A load that fails leaves the cache, so asking again (a chart switched away and back) tries again rather than
// replaying the failure for the rest of the visit.
const cache = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) {
    const pending = load();
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
  }
  return cache.get(key) as Promise<T>;
}

// The folder a read comes from. Every cache key below carries it, so a file read from a kept snapshot and the same file of the newest never share an
// entry. Only a month is ever turned into a path.
const inFolder = (snapshot: string | undefined, path: string): string => {
  if (snapshot === undefined) return path;
  if (!isMonthFolder(snapshot)) throw new Error(`${snapshot} is not a snapshot month`);
  return `${KEPT}/${snapshot}/${path}`;
};

async function fetchOk(path: string, snapshot?: string): Promise<Response> {
  const where = inFolder(snapshot, path);
  const res = await fetch(`${DATA}/${where}`);
  if (!res.ok) throw new Error(`public/data/${where}: HTTP ${res.status}`);
  return res;
}

export const loadManifest = (snapshot?: string) => once(inFolder(snapshot, "manifest"), async () => (await fetchOk("manifest.json", snapshot)).json() as Promise<Manifest>);
export const loadEvents = (snapshot?: string) => once(inFolder(snapshot, "events"), async () => (await fetchOk("events.json", snapshot)).json() as Promise<Event[]>);

// The months a deploy keeps beside the newest, or null where there is no readable index (a local build has none; a deploy that kept nothing has an
// empty one). Absent is no error: a pin then reads as it does with no kept snapshot.
export const loadKeptSnapshots = () =>
  once("kept-snapshots", async (): Promise<KeptSnapshots | null> => {
    try {
      const res = await fetch(`${DATA}/${KEPT}/index.json`);
      return res.ok ? readIndex(await res.json()) : null;
    } catch {
      return null;
    }
  });

// Region outlines for the map, written by scripts/region-boundaries.mjs. Not cube data: they sit beside it, not in it.
export type RegionOutlines = {
  type: "FeatureCollection";
  source: string;
  features: { type: "Feature"; properties: { region: string; code: string }; geometry: { type: "MultiPolygon"; coordinates: number[][][][] } }[];
};

const REGIONS = "/geo/nz-regions.json";

export const loadRegions = () =>
  once("regions", async () => {
    const res = await fetch(REGIONS);
    if (!res.ok) throw new Error(`public${REGIONS}: HTTP ${res.status}`);
    return res.json() as Promise<RegionOutlines>;
  });

// A file in a form the reader has no decoder for says so in a sentence of its own, not the advice to reload.
async function decoded<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (e) {
    if (isUnreadableForm(e)) throw new ServiceError(UNREADABLE_DATA, false);
    throw e;
  }
}

// A banded dimension keeps its own unknown band in the cube, where other dimensions have the reserved not-recorded value. Read as that value, so a
// vehicle with no usable value is the same thing to every chart, ranking, grid, condition and label whichever way the field is made. A value the
// dimension does not hold as unknown is returned as it is.
const asRecorded = (dimension: string): ((value: string) => string) => {
  const band = unrecordedBand(dimension);
  return band === undefined ? (value) => value : (value) => (value === band ? NOT_RECORDED_TOKEN : value);
};

export const loadSlice = (dataset: string, dimension: string, snapshot?: string) =>
  once(inFolder(snapshot, `slice:${dataset}/${dimension}`), async () => {
    const path = `cube/${dataset}/${dimension}.parquet`;
    const file = await (await fetchOk(path, snapshot)).arrayBuffer();
    const rows = await decoded(() => parquetReadObjects({ file, compressors, columns: ["month", "dim_value", "n", "denominator"] }));
    const recorded = asRecorded(dimension);
    return rows.map(
      (r): SliceRow => ({ month: monthKey(r.month), value: recorded(String(r.dim_value)), n: Number(r.n), denominator: Number(r.denominator) }),
    );
  });

type PairRow = { month: string; a: string; b: string; n: number };

const loadPair = (dataset: string, pair: string, snapshot?: string) =>
  once(inFolder(snapshot, `pair:${dataset}/${pair}`), async () => {
    const file = await (await fetchOk(`pairs/${dataset}/${pair}.parquet`, snapshot)).arrayBuffer();
    const rows = await decoded(() => parquetReadObjects({ file, compressors, columns: ["month", "a_value", "b_value", "n"] }));
    const [first, second] = pair.split(PAIR_SEPARATOR);
    const [recordedA, recordedB] = [asRecorded(first), asRecorded(second)];
    return rows.map((r): PairRow => ({ month: monthKey(r.month), a: recordedA(String(r.a_value)), b: recordedB(String(r.b_value)), n: Number(r.n) }));
  });

// One column of the fact table, as an array in the table's row order. Every column file holds the same rows in the same
// order, so a question downloads only the columns it names and lines them up by position.
type FactColumn = ArrayLike<unknown>;

const loadFactColumn = (dataset: string, column: string, snapshot?: string) =>
  once(inFolder(snapshot, `facts:${dataset}/${column}`), async (): Promise<FactColumn> => {
    const file = await (await fetchOk(`facts/${dataset}/${column}.parquet`, snapshot)).arrayBuffer();
    const chunks: ColumnData[] = [];
    await decoded(() => parquetRead({ file, compressors, columns: [column], onChunk: (chunk) => chunks.push(chunk) }));
    chunks.sort((a, b) => a.rowStart - b.rowStart);
    const out: unknown[] = [];
    for (const chunk of chunks) for (let i = 0; i < chunk.columnData.length; i++) out[chunk.rowStart + i] = chunk.columnData[i];
    // The column of a dimension (the others are the month and the count, which are no dimension and have no unknown band).
    const unknown = unrecordedBand(column);
    if (unknown !== undefined) for (let i = 0; i < out.length; i++) if (out[i] === unknown) out[i] = NOT_RECORDED_TOKEN;
    return out;
  });

// The month column as "YYYY-MM" keys. The table is sorted by month, so the same value repeats in runs and one
// conversion per distinct month serves them all.
const loadFactMonths = (dataset: string, snapshot?: string) =>
  once(inFolder(snapshot, `facts:${dataset}/month-keys`), async () => {
    const raw = await loadFactColumn(dataset, "month", snapshot);
    const keys = new Map<string, string>();
    const out: string[] = new Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      const v = raw[i];
      const id = v instanceof Date ? String(v.getTime()) : String(v);
      let key = keys.get(id);
      if (key === undefined) keys.set(id, (key = monthKey(v)));
      out[i] = key;
    }
    return out;
  });

// The seam for the query service (docs/QUERY_SERVICE.md). Set at build time; unset, as by default, the fact table is
// read in the browser exactly as before and the service is never asked. Set, a question that needs the fact table is
// sent to the service in Build's own address-bar form, and its answer is turned into the same rows. Nothing else
// changes: the stage's slices, pairs, manifest and events are static files either way.
const QUERY_SERVICE: string = import.meta.env.PUBLIC_QUERY_SERVICE ?? "";

// A failure of the service, with a sentence a visitor can be shown in place of the advice to reload. down: the service
// did not answer, so trying again later may help; otherwise it answered and refused, and its sentence says why.
export class ServiceError extends Error {
  constructor(
    message: string,
    readonly down: boolean,
  ) {
    super(message);
  }
}

type ServiceAnswer = {
  months: string[];
  denominator: (number | null)[];
  values?: string[];
  cells?: (number | null)[][];
  suppression?: { cells_withheld: number; totals_withheld?: number };
};

function serviceQuestion(dimension: string | null, values: string[] | undefined, where: Record<string, string[]>): string {
  const params = new URLSearchParams();
  const key = (name: string) => `${builderSpec.id}.${name}`;
  if (dimension) params.set(key("by"), dimension);
  for (const v of [...new Set(values ?? [])].sort()) params.append(key("value"), v);
  for (const [d, kept] of Object.entries(where).sort(([a], [b]) => a.localeCompare(b)))
    for (const v of [...new Set(kept)].sort()) params.append(key(`where.${d}`), v);
  return params.toString();
}

const askService = (dataset: string, question: string) =>
  once(`service:${dataset}?${question}`, async (): Promise<ServiceAnswer> => {
    let res: Response;
    try {
      res = await fetch(`${QUERY_SERVICE}/v1/${encodeURIComponent(dataset)}/answer?${question}`);
    } catch {
      throw new ServiceError(
        "The question service is not answering, so this chart cannot be drawn just now. Explore's charts do not need it and still work. Try again in a few minutes.",
        true,
      );
    }
    if (res.ok) return res.json() as Promise<ServiceAnswer>;
    const reason = await res.json().then((b: { error?: string }) => b.error, () => undefined);
    if (res.status >= 500 || !reason)
      throw new ServiceError(`The question service could not answer (HTTP ${res.status}), so this chart cannot be drawn just now. Explore's charts still work.`, true);
    throw new ServiceError(`The question service did not answer this question: ${reason}`, false);
  });

// The service's answer as the rows factView gives for the same question, in the same order.
async function serviceView(dataset: string, dimension: string | null, values: string[] | undefined, where: Record<string, string[]>) {
  const filters = Object.fromEntries(Object.entries(where).filter(([, kept]) => kept.length > 0));
  const answer = await askService(dataset, serviceQuestion(dimension, values, filters));
  if (answer.suppression && (answer.suppression.cells_withheld > 0 || (answer.suppression.totals_withheld ?? 0) > 0))
    throw new ServiceError("Some figures in this question count too few vehicles to be shown, and drawing a chart around them is not built yet.", false);
  // With nothing withheld, every total is a number.
  const totals = answer.denominator as number[];
  const out: SliceRow[] = [];
  if (!dimension) {
    answer.months.forEach((month, i) => out.push({ month, value: "", n: totals[i], denominator: totals[i] }));
    return out;
  }
  const names = answer.values ?? [];
  const cells = answer.months.map(() => new Map<string, number>());
  for (const [mi, vi, n] of answer.cells ?? []) cells[mi as number].set(names[vi as number], n as number);
  answer.months.forEach((month, i) => {
    const cell = cells[i];
    const shown = values ?? [...cell.keys()];
    for (const value of [...shown].sort()) {
      const n = cell.get(value) ?? 0;
      if (n > 0 || values) out.push({ month, value, n, denominator: totals[i] });
    }
  });
  return out;
}

// The fact table summed to slice rows: for each month, every vehicle the filters keep is in the denominator, and each
// breakdown value (or only the chosen ones) gets its count. Every month in the table is present, with a denominator of 0
// where the filters keep nothing: there the count is a true 0, not a month missing from the data, and a share is still
// left blank (the renderers draw no share over a denominator of 0). A chosen value gets a row of 0 in a month where it
// has none, so its line runs through that month rather than breaking. With no breakdown, one row per month holds the
// total.
//
// cross: each breakdown value is crossed with this other dimension's, so a row's value is "breakdown value · other value".
// The query service is not asked for a crossed view: its question has one breakdown, so it is read from the table here. Nor is it asked for a
// kept snapshot's: it answers from the newest it holds (docs/QUERY_SERVICE.md), so the table of that snapshot's folder is read instead.
export async function factView(dataset: string, dimension: string | null, values: string[] | undefined, where: Record<string, string[]>, cross?: string, snapshot?: string) {
  if (QUERY_SERVICE && !cross && snapshot === undefined) return serviceView(dataset, dimension, values, where);
  const filters = Object.entries(where).filter(([, kept]) => kept.length > 0);
  const [months, counts, firstBreakdown, other, ...filterColumns] = await Promise.all([
    loadFactMonths(dataset, snapshot),
    loadFactColumn(dataset, "n", snapshot),
    dimension ? loadFactColumn(dataset, dimension, snapshot) : Promise.resolve(null),
    dimension && cross ? loadFactColumn(dataset, cross, snapshot) : Promise.resolve(null),
    ...filters.map(([d]) => loadFactColumn(dataset, d, snapshot)),
  ]);
  const breakdown: FactColumn | null =
    firstBreakdown && other ? Array.from({ length: firstBreakdown.length }, (_, i) => crossValue(String(firstBreakdown[i]), String(other[i]))) : firstBreakdown;
  const keep = filters.map(([, kept]) => new Set(kept));
  const chosen = values ? new Set(values) : null;
  const totals = new Map<string, number>();
  for (let i = 0; i < months.length; i++) if (i === 0 || months[i] !== months[i - 1]) totals.set(months[i], 0);
  const cells = new Map<string, Map<string, number>>();
  rows: for (let i = 0; i < months.length; i++) {
    for (let f = 0; f < keep.length; f++) if (!keep[f].has(String(filterColumns[f][i]))) continue rows;
    const month = months[i];
    const n = Number(counts[i]);
    totals.set(month, (totals.get(month) as number) + n);
    if (!breakdown) continue;
    const value = String(breakdown[i]);
    if (chosen && !chosen.has(value)) continue;
    let cell = cells.get(month);
    if (!cell) cells.set(month, (cell = new Map()));
    cell.set(value, (cell.get(value) ?? 0) + n);
  }
  const out: SliceRow[] = [];
  for (const month of [...totals.keys()].sort()) {
    const denominator = totals.get(month) as number;
    if (!breakdown) {
      out.push({ month, value: "", n: denominator, denominator });
      continue;
    }
    const cell = cells.get(month) ?? new Map<string, number>();
    const shown = values ?? [...cell.keys()];
    for (const value of [...shown].sort()) {
      const n = cell.get(value) ?? 0;
      if (n > 0 || values) out.push({ month, value, n, denominator });
    }
  }
  return out;
}

// The fact table summed to the cells of a grid: for each month, each pair of values of two fields among the vehicles every filter keeps
// (one row each, with vehicles in it), and the month's total of those vehicles as the denominator. The window and the lines of the grid are
// chosen later, from these rows (src/lib/matrix.ts), so a question downloads the columns it names once and a new window needs no more. The
// query service is not asked: its question has one breakdown, so the table is read here, as for any crossed view.
export async function factGrid(dataset: string, dimension: string, other: string, where: Record<string, string[]>, snapshot?: string): Promise<SliceRow[]> {
  const filters = Object.entries(where).filter(([, kept]) => kept.length > 0);
  const [months, counts, first, second, ...filterColumns] = await Promise.all([
    loadFactMonths(dataset, snapshot),
    loadFactColumn(dataset, "n", snapshot),
    loadFactColumn(dataset, dimension, snapshot),
    loadFactColumn(dataset, other, snapshot),
    ...filters.map(([d]) => loadFactColumn(dataset, d, snapshot)),
  ]);
  const keep = filters.map(([, kept]) => new Set(kept));
  const totals = new Map<string, number>();
  const cells = new Map<string, Map<string, SliceRow>>();
  rows: for (let i = 0; i < months.length; i++) {
    for (let f = 0; f < keep.length; f++) if (!keep[f].has(String(filterColumns[f][i]))) continue rows;
    const month = months[i];
    const n = Number(counts[i]);
    totals.set(month, (totals.get(month) ?? 0) + n);
    const value = String(first[i]);
    const second_ = String(second[i]);
    let byPair = cells.get(month);
    if (!byPair) cells.set(month, (byPair = new Map()));
    const key = `${value}\u0000${second_}`;
    const cell = byPair.get(key);
    if (cell) cell.n += n;
    else byPair.set(key, { month, value, other: second_, n, denominator: 0 });
  }
  const out: SliceRow[] = [];
  for (const month of [...cells.keys()].sort()) {
    const denominator = totals.get(month) as number;
    for (const cell of cells.get(month)?.values() ?? []) if (cell.n > 0) out.push({ ...cell, denominator });
  }
  return out;
}

// The first month the view's dataset has vehicles in, from data the view has already loaded: the fact table's month column for a
// question that reads it, the pair slice a narrowed view was cut from, else the rows themselves (a slice holds every month with
// vehicles). Not derived from the manifest, whose count of months is a count of months with rows, not a span. With the query
// service answering a question the table is not read, so the rows' own first month stands: later than the dataset's true first
// where a condition empties the early months, which blocks a comparison that exists and never admits one that does not.
export async function loadFirstMonth(source: ViewSource, rows: readonly SliceRow[]): Promise<string | undefined> {
  const earliest = (months: Iterable<string>) => {
    let first: string | undefined;
    for (const m of months) if (first === undefined || m < first) first = m;
    return first;
  };
  if (source.facts && (!QUERY_SERVICE || source.snapshot !== undefined)) return earliest(await loadFactMonths(source.dataset, source.snapshot));
  if (source.filter) return earliest((await loadPair(source.dataset, source.filter.pair, source.snapshot)).map((r) => r.month));
  return earliest(rows.map((r) => r.month));
}

export const loadView = async (source: ViewSource): Promise<SliceRow[]> => {
  const { dataset, dimension, filter, facts, cross, snapshot } = source;
  if (facts && cross?.grid && dimension) return factGrid(dataset, dimension, cross.dimension, facts.where, snapshot);
  if (cross?.pair) return crossPair(await loadPair(dataset, cross.pair.pair, snapshot), cross.pair.side);
  if (facts) return factView(dataset, dimension, facts.values, facts.where, cross?.dimension, snapshot);
  if (!dimension) throw new Error("a view from the cube's slices needs a breakdown");
  if (!filter) return loadSlice(dataset, dimension, snapshot);
  return narrowPair(await loadPair(dataset, filter.pair, snapshot), filter.side, filter.values);
};
