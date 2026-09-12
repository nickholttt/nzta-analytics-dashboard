// One preset: resolve it against the cube, pick the renderer its shape needs, and state every note.
import { useEffect, useMemo, useState } from "react";
import { compositeRules, findDataset, findDerived, findPreset, hybrid, isComposite } from "../lib/config";
import { loadEvents, loadManifest, loadSlice } from "../lib/data";
import type { Event, Manifest, SliceRow } from "../lib/data";
import { TRAILING_MONTHS, minDenominator, minShareOfTrailingMedian, pct } from "../lib/measures";
import { fillNote, noteContext, noteStatesAFigure } from "../lib/notes";
import { resolvePreset } from "../lib/resolve";
import { DistributionChart } from "./DistributionChart";
import { MixChart } from "./MixChart";
import { TrendChart } from "./TrendChart";

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
    if (!preset?.dataset || !resolution || resolution.preventsRender.length > 0) return;
    const sliceDimension = preset.dimension ?? manifest?.datasets[preset.dataset]?.live_dimensions[0];
    if (sliceDimension && manifest?.datasets[preset.dataset]?.live_dimensions.includes(sliceDimension)) {
      loadSlice(preset.dataset, sliceDimension).then(setRows, (e) => setError(String(e)));
    }
  }, [preset, resolution, manifest]);

  if (!preset) return <section className="panel blocked">No preset "{presetId}" in config/presets.json.</section>;
  if (error) return <section className="panel blocked">{error}</section>;
  if (!manifest || !resolution) return <section className="panel">Loading…</section>;

  const { blocking, preventsRender, notApplied, status, statusDisagreement, shape, dimension, measure } = resolution;
  const dataset = findDataset(preset.dataset);
  const dsManifest = preset.dataset ? manifest.datasets[preset.dataset] : undefined;
  const coverage = dsManifest?.mild_hybrid_identification_coverage;
  const relabels = Boolean(coverage && dimension?.derive?.value === hybrid.powertrain_column);
  const label = (v: string) => (relabels && v === hybrid.mild_powertrain ? (coverage as { label: string }).label : RESERVED_LABELS[v] ?? v);
  const guard = minDenominator(preset.measure);
  const collapseFraction = minShareOfTrailingMedian(preset.measure);
  const snapshotsNeeded = findDerived(preset.derived)?.snapshots_needed;

  // Notes that state a figure are templated from the build; a plain note that carries one is flagged
  // rather than trusted, because it will drift the next time the data moves.
  const context = noteContext(preset, manifest);
  const notes: { key: string; text: string; unresolved: string[] }[] = [];
  const addNote = (key: string, plain?: string, template?: string) => {
    if (template) notes.push({ key, ...fillNote(template, context) });
    else if (plain) notes.push({ key, text: plain, unresolved: [] });
  };
  if (dataset?.definition) addNote("definition", dataset.definition);
  addNote("preset", preset.note, preset.note_template);
  addNote("dimension", dimension?.note, dimension?.note_template);
  const driftingNotes = [preset.note, dimension?.note].filter((n): n is string => Boolean(n) && noteStatesAFigure(n as string));

  let chart = null;
  if (preventsRender.length === 0 && rows) {
    if (shape === "mix" && dimension) {
      chart = (
        <MixChart
          preset={preset}
          dimension={dimension}
          rows={rows}
          manifest={manifest}
          events={events}
          minDenominator={guard}
          collapseFraction={collapseFraction}
          label={label}
        />
      );
    } else if (shape === "distribution" && dimension) {
      chart = <DistributionChart preset={preset} dimension={dimension} rows={rows} manifest={manifest} minDenominator={guard} label={label} />;
    } else if (shape === "trend") {
      chart = <TrendChart preset={preset} rows={rows} manifest={manifest} />;
    }
  }

  return (
    <section className="panel">
      <h3>
        {preset.question} <span className={`badge ${status}`}>{status}</span>
      </h3>
      <p className="meta">
        preset {preset.id} · shape {shape} · dataset {preset.dataset ?? "composite"} · {preset.derived ? `derived ${preset.derived}` : `measure ${measure?.id ?? preset.measure}`}
        {preset.dimension ? ` · dimension ${preset.dimension}` : ""} · period {preset.period ?? "none"}
        {preset.top_n ? ` · top ${preset.top_n} by vehicles over the trailing window, the rest as one line` : ""} · snapshot {manifest.latest_snapshot}
      </p>

      {isComposite(preset) ? (
        <div className="curated">
          <strong>Curated comparison.</strong> Two series on one frame, a deliberate exception to one chart per question. Not offered in the builder
          {compositeRules.builder_available ? "" : ", and never will be"}: the builder grammar describes a single series.
        </div>
      ) : null}

      {statusDisagreement ? <div className="warning">{statusDisagreement}</div> : null}

      {snapshotsNeeded !== undefined ? (
        <div className="scaffold">
          Needs {snapshotsNeeded} or more snapshots; this build carries 1 ({manifest.latest_snapshot}). Nothing is drawn until then.
        </div>
      ) : null}

      {blocking.length > 0 ? (
        <div className={preventsRender.length > 0 ? "blocked" : "warning"}>
          <strong>
            {preventsRender.length > 0
              ? "Nothing can be drawn from the cube as built:"
              : "Drawn, but not what the preset asks for:"}
          </strong>
          <ul>{blocking.map((b) => <li key={b}>{b}</li>)}</ul>
          {preset.requires?.length ? (
            <>
              <strong>Coming when this lands:</strong>
              <ul>{preset.requires.map((r) => <li key={r}>{r}</li>)}</ul>
            </>
          ) : null}
        </div>
      ) : null}
      {notApplied.map((w) => <div key={w} className="warning">{w}</div>)}
      {driftingNotes.map((n) => (
        <div key={n} className="warning">
          This preset's note states a figure but is not templated from the build, so it will drift: “{n}”
        </div>
      ))}

      {chart}

      <ul className="notes">
        {notes.map((n) => (
          <li key={n.key}>
            {n.text}
            {n.unresolved.length > 0 ? <em> (the build supplied no value for {n.unresolved.join(", ")})</em> : null}
          </li>
        ))}
        {relabels && coverage ? (
          <li>
            {coverage.label}: over the trailing {coverage.trailing.window_months} months,{" "}
            {pct(coverage.trailing.coverage_stated_confidence ?? 0)} of mild hybrids are identified at stated confidence and{" "}
            {pct(coverage.trailing.coverage_high_confidence_only ?? 0)} counting high-confidence classifications only (all time{" "}
            {pct(coverage.all_time.coverage_stated_confidence ?? 0)} and {pct(coverage.all_time.coverage_high_confidence_only ?? 0)}). A lower bound: every unresolved hybrid counts as a missed mild hybrid.
          </li>
        ) : null}
        {guard > 0 && preventsRender.length === 0 ? (
          <li>
            Grey: months with fewer than {guard} vehicles behind the figure drawn
            {collapseFraction > 0
              ? `, and months whose total collapsed below ${Math.round(collapseFraction * 100)}% of the median of the ${TRAILING_MONTHS} months before them. The second guard is not the first: a month can be precisely measured and still describe a different population, which is what a nationwide shutdown does to a month of registrations`
              : ""}
            . Their shares are drawn in grey, not dropped and not zeroed.
          </li>
        ) : null}
        <li>{BASIS_NOTE}</li>
      </ul>
    </section>
  );
}
