// Reads public/data exactly as the pipeline built it: manifest.json, events.json, 1-D cube slices and pair slices.
import { parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";

const DATA = "/data";

// A pair's file is pairs/{dataset}/{dim_a}__{dim_b}.parquet (docs/CUBE_SCHEMA.md, Pair slices).
export const PAIR_SEPARATOR = "__";

export type SliceRow = { month: string; value: string; n: number; denominator: number };

// Where a view's rows come from: a 1-D slice, or a pair slice narrowed to some values of its other dimension. side says
// which of the pair's two dimensions is the view's breakdown.
export type ViewSource = {
  dataset: string;
  dimension: string;
  filter?: { pair: string; side: "a" | "b"; dimension: string; values: string[] };
};

export type CoverageBasis = {
  window_months?: number;
  coverage_stated_confidence: number | null;
  coverage_high_confidence_only: number | null;
};

export type DatasetManifest = {
  definition?: string;
  live_dimensions: string[];
  // Absent from a manifest built before pair slices existed.
  live_pairs?: string[];
  mild_hybrid_identification_coverage?: { label: string; all_time: CoverageBasis; trailing: CoverageBasis };
};

export type Manifest = {
  generated_at: string;
  latest_snapshot: string;
  datasets: Record<string, DatasetManifest>;
  snapshot_archive?: { path: string; status: string };
  warnings: string[];
};

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

async function fetchOk(path: string): Promise<Response> {
  const res = await fetch(`${DATA}/${path}`);
  if (!res.ok) throw new Error(`public/data/${path}: HTTP ${res.status}`);
  return res;
}

export const loadManifest = () => once("manifest", async () => (await fetchOk("manifest.json")).json() as Promise<Manifest>);
export const loadEvents = () => once("events", async () => (await fetchOk("events.json")).json() as Promise<Event[]>);

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

export function monthKey(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 7);
  if (typeof value === "string") return value.slice(0, 7);
  if (typeof value === "number" || typeof value === "bigint") return new Date(Number(value) * 86_400_000).toISOString().slice(0, 7);
  throw new Error(`unreadable month value: ${String(value)}`);
}

export const loadSlice = (dataset: string, dimension: string) =>
  once(`slice:${dataset}/${dimension}`, async () => {
    const path = `cube/${dataset}/${dimension}.parquet`;
    const file = await (await fetchOk(path)).arrayBuffer();
    const rows = await parquetReadObjects({ file, compressors, columns: ["month", "dim_value", "n", "denominator"] });
    return rows.map(
      (r): SliceRow => ({ month: monthKey(r.month), value: String(r.dim_value), n: Number(r.n), denominator: Number(r.denominator) }),
    );
  });

type PairRow = { month: string; a: string; b: string; n: number };

const loadPair = (dataset: string, pair: string) =>
  once(`pair:${dataset}/${pair}`, async () => {
    const file = await (await fetchOk(`pairs/${dataset}/${pair}.parquet`)).arrayBuffer();
    const rows = await parquetReadObjects({ file, compressors, columns: ["month", "a_value", "b_value", "n"] });
    return rows.map((r): PairRow => ({ month: monthKey(r.month), a: String(r.a_value), b: String(r.b_value), n: Number(r.n) }));
  });

// A pair narrowed to some values of its other dimension, as the rows of a 1-D slice. The pair's denominator is the
// whole dataset's month, so a narrowed month's denominator is the sum of what is kept: a share of the subset, not of
// everything. A month with nothing kept is absent, as in any slice.
export function narrowPair(rows: PairRow[], side: "a" | "b", values: string[]): SliceRow[] {
  const keep = new Set(values);
  const cells = new Map<string, SliceRow>();
  const totals = new Map<string, number>();
  for (const r of rows) {
    const [value, other] = side === "a" ? [r.a, r.b] : [r.b, r.a];
    if (!keep.has(other)) continue;
    const key = `${r.month}|${value}`;
    const cell = cells.get(key) ?? { month: r.month, value, n: 0, denominator: 0 };
    cell.n += r.n;
    cells.set(key, cell);
    totals.set(r.month, (totals.get(r.month) ?? 0) + r.n);
  }
  return [...cells.values()]
    .map((c) => ({ ...c, denominator: totals.get(c.month) as number }))
    .sort((x, y) => x.month.localeCompare(y.month) || x.value.localeCompare(y.value));
}

export const loadView = async (source: ViewSource): Promise<SliceRow[]> => {
  const { dataset, dimension, filter } = source;
  if (!filter) return loadSlice(dataset, dimension);
  return narrowPair(await loadPair(dataset, filter.pair), filter.side, filter.values);
};
