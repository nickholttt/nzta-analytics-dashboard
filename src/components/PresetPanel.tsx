// One preset: resolve it against the cube, pick the renderer its shape needs, and state every note.
import { useEffect, useMemo, useState } from "react";
import { findDataset, findPreset, hybrid } from "../lib/config";
import { loadEvents, loadManifest, loadSlice } from "../lib/data";
import type { Event, Manifest, SliceRow } from "../lib/data";
import { minDenominator, pct } from "../lib/measures";
import { resolvePreset } from "../lib/resolve";
import { DistributionChart } from "./DistributionChart";
import { MixChart } from "./MixChart";
import { TrendChart } from "./TrendChart";

// Cohort survival divides a cohort's survivors at one snapshot by its survivors at an earlier one
// (docs/METRICS.md), so a single figure needs two snapshots.
const SNAPSHOTS_NEEDED: Record<string, number> = { cohort_survival: 2 };

const BASIS_NOTE = "Registrations recorded by NZTA. Not the same as vehicle sales.";

const RESERVED_LABELS: Record<string, string> = {
  __UNDEFINED__: "Not recorded",
  __UNMAPPED__: "No reference match",
  __OTHER__: "Other (beyond the cap)",
};

export default function PresetPanel({ presetId }: { presetId: string }) {
  const preset = findPreset(presetId);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [rows, setRows] = useState<SliceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadManifest().then(setManifest, (e) => setError(String(e)));
    loadEvents().then(setEvents, (e) => setError(String(e)));
  }, []);

  const resolution = useMemo(() => (preset && manifest ? resolvePreset(preset, manifest) : null), [preset, manifest]);

  useEffect(() => {
    if (!preset?.dataset || !resolution || resolution.blocking.length > 0) return;
    const sliceDimension = preset.dimension ?? manifest?.datasets[preset.dataset]?.live_dimensions[0];
    if (sliceDimension) loadSlice(preset.dataset, sliceDimension).then(setRows, (e) => setError(String(e)));
  }, [preset, resolution, manifest]);

  if (!preset) return <section className="panel blocked">No preset "{presetId}" in config/presets.json.</section>;
  if (error) return <section className="panel blocked">{error}</section>;
  if (!manifest || !resolution) return <section className="panel">Loading…</section>;

  const { blocking, notApplied, vocabulary, shape, dimension, measure } = resolution;
  const dataset = findDataset(preset.dataset);
  const dsManifest = preset.dataset ? manifest.datasets[preset.dataset] : undefined;
  const coverage = dsManifest?.mild_hybrid_identification_coverage;
  const relabels = Boolean(coverage && dimension?.derive?.value === hybrid.powertrain_column);
  const label = (v: string) => (relabels && v === hybrid.mild_powertrain ? (coverage as { label: string }).label : RESERVED_LABELS[v] ?? v);
  const guard = minDenominator(preset.measure);
  const snapshotsNeeded = preset.derived ? SNAPSHOTS_NEEDED[preset.derived] : undefined;

  let chart = null;
  if (blocking.length === 0 && rows) {
    if (shape === "mix" && preset.dimension) {
      chart = <MixChart preset={preset} dimensionId={preset.dimension} rows={rows} manifest={manifest} events={events} minDenominator={guard} label={label} />;
    } else if (shape === "distribution" && dimension) {
      chart = <DistributionChart preset={preset} dimension={dimension} rows={rows} manifest={manifest} minDenominator={guard} label={label} />;
    } else if (shape === "trend") {
      chart = <TrendChart preset={preset} rows={rows} manifest={manifest} />;
    } else {
      chart = <p className="blocked">Shape "{shape}" has no renderer in this tool.</p>;
    }
  }

  return (
    <section className="panel">
      <h3>{preset.question}</h3>
      <p className="meta">
        preset {preset.id} · shape {shape} · dataset {preset.dataset ?? "none"} · {preset.derived ? `derived ${preset.derived}` : `measure ${measure?.id ?? preset.measure}`}
        {preset.dimension ? ` · dimension ${preset.dimension}` : ""} · period {preset.period ?? "none"}
        {preset.top_n ? ` · top ${preset.top_n} by vehicles over the period, the rest as one line` : ""} · snapshot {manifest.latest_snapshot}
      </p>

      {snapshotsNeeded !== undefined ? (
        <div className="scaffold">
          Needs {snapshotsNeeded} or more snapshots; this build carries 1 ({manifest.latest_snapshot}). Nothing is drawn until then.
        </div>
      ) : null}

      {blocking.length > 0 ? (
        <div className="blocked">
          <strong>Cannot render from the cube as built:</strong>
          <ul>{blocking.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
      ) : null}
      {notApplied.map((w) => <div key={w} className="warning">{w}</div>)}
      {vocabulary.map((w) => <div key={w} className="warning">{w}</div>)}

      {chart}

      <ul className="notes">
        {dataset?.definition ? <li>{dataset.definition}</li> : null}
        {preset.note ? <li>{preset.note}</li> : null}
        {dimension?.note ? <li>{dimension.note}</li> : null}
        {relabels && coverage ? (
          <li>
            {coverage.label}: over the trailing {coverage.trailing.window_months} months,{" "}
            {pct(coverage.trailing.coverage_stated_confidence ?? 0)} of mild hybrids are identified at stated confidence and{" "}
            {pct(coverage.trailing.coverage_high_confidence_only ?? 0)} counting high-confidence classifications only (all time{" "}
            {pct(coverage.all_time.coverage_stated_confidence ?? 0)} and {pct(coverage.all_time.coverage_high_confidence_only ?? 0)}). A lower bound: every unresolved hybrid counts as a missed mild hybrid.
          </li>
        ) : null}
        {guard > 0 && blocking.length === 0 ? <li>Grey: months with fewer than {guard} vehicles in total. Their shares are drawn in grey, not dropped and not zeroed.</li> : null}
        <li>{BASIS_NOTE}</li>
      </ul>
    </section>
  );
}
