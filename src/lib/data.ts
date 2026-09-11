// Reads public/data exactly as the pipeline built it: manifest.json, events.json and 1-D cube slices.
import { parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";

const DATA = "/data";

export type SliceRow = { month: string; value: string; n: number; denominator: number };

export type CoverageBasis = {
  window_months?: number;
  coverage_stated_confidence: number | null;
  coverage_high_confidence_only: number | null;
};

export type DatasetManifest = {
  definition?: string;
  live_dimensions: string[];
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

const cache = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, load());
  return cache.get(key) as Promise<T>;
}

async function fetchOk(path: string): Promise<Response> {
  const res = await fetch(`${DATA}/${path}`);
  if (!res.ok) throw new Error(`public/data/${path}: HTTP ${res.status}`);
  return res;
}

export const loadManifest = () => once("manifest", async () => (await fetchOk("manifest.json")).json() as Promise<Manifest>);
export const loadEvents = () => once("events", async () => (await fetchOk("events.json")).json() as Promise<Event[]>);

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
