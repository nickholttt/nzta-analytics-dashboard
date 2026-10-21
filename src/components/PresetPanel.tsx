// One preset: resolve it against the cube, pick the renderer its shape needs, and state every note.
import { useEffect, useMemo, useState } from "react";
import { compositeRules, findDataset, findDerived, findPreset, hybrid, isComposite, publicCopy } from "../lib/config";
import { compositionStart } from "../lib/composition";
import { loadEvents, loadManifest, loadSlice } from "../lib/data";
import type { Preset } from "../lib/config";
import type { Event, Manifest, SliceRow } from "../lib/data";
import { TRAILING_MONTHS, guardsFor, monthLabel, pct } from "../lib/measures";
import { fillNote, noteContext, noteStatesAFigure } from "../lib/notes";
import { presetView, resolvePreset } from "../lib/resolve";
import { getParam, getShareableUrl, setParam } from "../lib/url";
import { DistributionChart } from "./DistributionChart";
import { LeagueChart } from "./LeagueChart";
import { MixChart } from "./MixChart";
import { TrendChart } from "./TrendChart";

const BASIS_NOTE = "Registrations recorded by NZTA. Not the same as vehicle sales.";

export const RESERVED_LABELS: Record<string, string> = {
  __UNDEFINED__: "Not recorded",
  __UNMAPPED__: "No reference match",
  __OTHER__: "Other (beyond the cap)",
};

const TIME_PERIODS = [
  { id: "3y", label: "3 years" },
  { id: "5y", label: "5 years" },
  { id: "10y", label: "10 years" },
  { id: "all", label: "All time" },
];

// lead: one of the charts that carries the page. Larger heading, taller plot; nothing else differs.
// audience: "public" is what a visitor reads on the Explore page: the chart, its controls, its notes and
// any honest limit on what it shows. "internal" (/status) adds the build diagnostics: status badges,
// what blocks the preset, drifting notes and the preset's spec line (D-041).
// preset: a preset built outside presets.json (the sentence builder), drawn exactly as a canon one is.
export default function PresetPanel({
  presetId: requestedId,
  preset: supplied,
  lead = false,
  audience = "public",
}: {
  presetId?: string;
  preset?: Preset;
  lead?: boolean;
  audience?: "public" | "internal";
}) {
  const internal = audience === "internal";
  const preset = supplied ?? findPreset(requestedId ?? "");
  const presetId = preset?.id ?? requestedId ?? "";
  const defaultGranularityId = preset?.granularity_options?.[0]?.id ?? null;
  const [activeGranularityId, setActiveGranularityId] = useState<string | null>(() => {
    if (!defaultGranularityId || typeof window === "undefined") return defaultGranularityId;
    const fromUrl = getParam(presetId, "granularity", defaultGranularityId);
    return preset?.granularity_options?.some((g) => g.id === fromUrl) ? fromUrl : defaultGranularityId;
  });
  const defaultPeriod = preset?.period ?? "all";
  const [activePeriod, setActivePeriod] = useState<string>(() => {
    if (typeof window === "undefined") return defaultPeriod;
    const fromUrl = getParam(presetId, "period", defaultPeriod);
    return TIME_PERIODS.some((p) => p.id === fromUrl) ? fromUrl : defaultPeriod;
  });
  // All records: an all-time mix chart opens on its composition start; this draws it from the first
  // month with data. Kept in the URL as range=all, the parameter the chart used before.
  const [fullHistory, setFullHistory] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return getParam(presetId, "range", "default") === "all";
  });
  const [copied, setCopied] = useState<"" | "copied" | "address">("");
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [rows, setRows] = useState<SliceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGranularityChange = (newId: string) => {
    setActiveGranularityId(newId);
    if (defaultGranularityId) {
      setParam(presetId, "granularity", newId, defaultGranularityId);
    }
  };

  const handlePeriodChange = (newPeriod: string, full = false) => {
    setActivePeriod(newPeriod);
    setParam(presetId, "period", newPeriod, defaultPeriod);
    setFullHistory(full);
    setParam(presetId, "range", full ? "all" : "default", "default");
  };

  // Where the clipboard is unavailable or refuses, the address bar still ends up holding the link, and
  // the button says so rather than doing nothing.
  const handleCopyLink = () => {
    const shareUrl = getShareableUrl(presetId);
    window.history.replaceState(null, "", `#${presetId}`);
    const done = (state: "copied" | "address") => {
      setCopied(state);
      setTimeout(() => setCopied(""), 4000);
    };
    if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(shareUrl).then(() => done("copied"), () => done("address"));
    else done("address");
  };

  const activeGranularity = useMemo(() => {
    if (!preset?.granularity_options) return null;
    return preset.granularity_options.find((g) => g.id === activeGranularityId) ?? preset.granularity_options[0];
  }, [preset, activeGranularityId]);

  const effectivePreset = useMemo(() => (preset ? presetView(preset, activeGranularityId, activePeriod) : null), [preset, activeGranularityId, activePeriod]);

  useEffect(() => {
    loadManifest().then(setManifest, (e) => setError(String(e)));
    loadEvents().then(setEvents, (e) => setError(String(e)));
  }, []);

  const resolution = useMemo(() => (effectivePreset && manifest ? resolvePreset(effectivePreset, manifest) : null), [effectivePreset, manifest]);

  useEffect(() => {
    if (!effectivePreset?.dataset || !resolution || resolution.preventsRender.length > 0) return;
    const sliceDimension = effectivePreset.dimension ?? manifest?.datasets[effectivePreset.dataset]?.live_dimensions[0];
    if (sliceDimension && manifest?.datasets[effectivePreset.dataset]?.live_dimensions.includes(sliceDimension)) {
      setRows(null);
      loadSlice(effectivePreset.dataset, sliceDimension).then(setRows, (e) => setError(String(e)));
    }
  }, [effectivePreset, resolution, manifest]);

  const panelClass = `panel${lead ? " lead" : ""}`;
  if (!preset || !effectivePreset)
    return (
      <section className={panelClass}>
        <div className="callout blocked">
          <span className="callout-label">Missing preset</span>
          {internal ? `No preset "${presetId}" in config/presets.json.` : "This chart is not available."}
        </div>
      </section>
    );
  if (error)
    return (
      <section className={panelClass}>
        <div className="callout blocked">
          <span className="callout-label">Could not load</span>
          {internal ? error : "This chart's data did not load. Reload the page to try again."}
        </div>
      </section>
    );
  if (!manifest || !resolution)
    return (
      <section className={`${panelClass} loading`}>
        <p className="meta">Loading…</p>
      </section>
    );

  const { blocking, preventsRender, notApplied, status, statusDisagreement, shape, dimension, measure } = resolution;
  const dataset = findDataset(effectivePreset.dataset);
  const derived = findDerived(effectivePreset.derived);
  const dsManifest = effectivePreset.dataset ? manifest.datasets[effectivePreset.dataset] : undefined;
  const coverage = dsManifest?.mild_hybrid_identification_coverage;
  const relabels = Boolean(coverage && dimension?.derive?.value === hybrid.powertrain_column);
  const label = (v: string) => (relabels && v === hybrid.mild_powertrain ? (coverage as { label: string }).label : RESERVED_LABELS[v] ?? v);
  const guards = guardsFor(effectivePreset.measure, effectivePreset.derived);
  const guard = guards.min_denominator ?? 0;
  const collapseFraction = guards.min_share_of_trailing_median ?? 0;
  const snapshotsNeeded = derived?.snapshots_needed;

  // Notes that state a figure are templated from the build; a plain note that carries one is flagged
  // rather than trusted, because it will drift the next time the data moves. The dataset definition is
  // not among them: it is the sentence every chart on this dataset must carry, so it sits under the
  // question rather than in the footnotes.
  const context = noteContext(effectivePreset, manifest);
  const notes: { key: string; text: string; unresolved: string[] }[] = [];
  // On a chart that can't be drawn, a missing value is expected (its dataset may not exist yet), so the
  // note is left out instead of shown with gaps. On a drawn chart a gap is a build fault and stays visible.
  const addNote = (key: string, plain?: string, template?: string) => {
    if (template) {
      const filled = fillNote(template, context);
      if (filled.unresolved.length === 0 || preventsRender.length === 0) notes.push({ key, ...filled });
    } else if (plain) notes.push({ key, text: plain, unresolved: [] });
  };
  addNote("preset", effectivePreset.note, effectivePreset.note_template);
  const publicDimensionNote = !internal && dimension ? publicCopy.dimension_notes[dimension.id] : undefined;
  if (publicDimensionNote) addNote("dimension", publicDimensionNote);
  else addNote("dimension", dimension?.note, dimension?.note_template);
  // A visitor is told what the chart includes in plain words; the reason, in config terms, is internal.
  const publicLimits = notApplied.length
    ? (effectivePreset.filters ?? []).flatMap((f) =>
        Object.values(f).map((v) => `This chart includes every vehicle, not only “${v}”: the data can't be narrowed that way yet.`),
      )
    : [];
  const driftingNotes = [effectivePreset.note, dimension?.note].filter((n): n is string => Boolean(n) && noteStatesAFigure(n as string));

  let chart = null;
  if (preventsRender.length === 0 && rows) {
    if (shape === "mix" && dimension) {
      chart = (
        <MixChart
          preset={effectivePreset}
          dimension={dimension}
          rows={rows}
          manifest={manifest}
          events={events}
          minDenominator={guard}
          collapseFraction={collapseFraction}
          label={label}
          lead={lead}
          fullHistory={fullHistory}
          internal={internal}
        />
      );
    } else if (shape === "distribution" && dimension) {
      chart = <DistributionChart preset={effectivePreset} dimension={dimension} rows={rows} manifest={manifest} minDenominator={guard} label={label} lead={lead} />;
    } else if (shape === "trend") {
      chart = <TrendChart preset={effectivePreset} rows={rows} manifest={manifest} minDenominator={guard} collapseFraction={collapseFraction} lead={lead} />;
    } else if (shape === "league" && dimension) {
      chart = (
        <LeagueChart
          preset={effectivePreset}
          dimension={dimension}
          rows={rows}
          manifest={manifest}
          minDenominator={guard}
          label={label}
          lead={lead}
        />
      );
    }
  }

  // Visitor wording from config/presets.json public_copy, where the frozen dimensions.json carries text
  // written for maintainers (D-042).
  const dimensionLabel = (!internal && dimension && publicCopy.dimension_labels[dimension.id]) || dimension?.label;
  const definition = (!internal && effectivePreset.dataset && publicCopy.dataset_definitions[effectivePreset.dataset]) || dataset?.definition;
  const eyebrow = dimensionLabel ?? derived?.label ?? measure?.label;

  // One row of time options. An all-time mix chart that opens on a later start names that start, and
  // offers the full record as its own option, so no two buttons say the same thing.
  const start = shape === "mix" && rows ? compositionStart(rows, dimension, guard) : undefined;
  const rangeOptions = [
    ...TIME_PERIODS.filter((p) => p.id !== "all").map((p) => ({ key: p.id, id: p.id, label: p.label, full: false })),
    { key: "all", id: "all", label: start ? `Since ${monthLabel(start)}` : "All time", full: false },
    ...(start ? [{ key: "all-records", id: "all", label: "All records", full: true }] : []),
  ];

  return (
    <section className={panelClass} id={preset.id}>
      <header className="panel-head">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h3 className="panel-question">
          <span>{preset.question}</span>
          {internal && status !== "live" ? (
            <>
              {" "}
              <span className={`badge ${status}`}>{status}</span>
            </>
          ) : null}
        </h3>
        {definition ? <p className="panel-definition">{definition}</p> : null}
        <button type="button" className="button-quiet" onClick={handleCopyLink} aria-live="polite">
          {copied === "copied" ? "Link copied" : copied === "address" ? "The address bar now links to this chart" : "Copy link to this chart"}
        </button>
      </header>

      <div className="controls" style={{ marginBottom: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
        {preset.granularity_options && preset.granularity_options.length > 0 ? (
          <div className="toggle" role="radiogroup" aria-label="Show by">
            {preset.granularity_options.map((opt) => (
              <label key={opt.id}>
                <input
                  type="radio"
                  name={`granularity-${preset.id}`}
                  checked={activeGranularity?.id === opt.id}
                  onChange={() => handleGranularityChange(opt.id)}
                />{" "}
                {opt.label}
              </label>
            ))}
          </div>
        ) : null}

        {preset.dataset !== "used_imports" && preventsRender.length === 0 ? (
          <div className="toggle" role="radiogroup" aria-label="Time range">
            {rangeOptions.map((o) => (
              <label key={o.key}>
                <input
                  type="radio"
                  name={`period-${preset.id}`}
                  checked={activePeriod === o.id && (o.id !== "all" || fullHistory === o.full || !start)}
                  onChange={() => handlePeriodChange(o.id, o.full)}
                />{" "}
                {o.label}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      {isComposite(preset) ? (
        <div className="callout curated">
          <span className="callout-label">Curated comparison</span>
          Two series on one frame, a deliberate exception to one chart per question. Not offered in the builder
          {compositeRules.builder_available ? "" : ", and never will be"}: the builder grammar describes a single series.
        </div>
      ) : null}

      {internal && statusDisagreement ? (
        <div className="callout warning">
          <span className="callout-label">Status out of date</span>
          {statusDisagreement}
        </div>
      ) : null}

      {internal && snapshotsNeeded !== undefined ? (
        <div className="callout scaffold">
          <span className="callout-label">Waiting on snapshots</span>
          Needs {snapshotsNeeded} or more snapshots; this build carries 1 ({manifest.latest_snapshot}). Nothing is drawn until then.
        </div>
      ) : null}

      {internal && blocking.length > 0 ? (
        <div className={`callout ${preventsRender.length > 0 ? "blocked" : "warning"}`}>
          <span className="callout-label">{preventsRender.length > 0 ? "Cannot be drawn yet" : "Drawn with a gap"}</span>
          <strong>
            {preventsRender.length > 0 ? "Nothing can be drawn from the cube as built:" : "Drawn, but not what the preset asks for:"}
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
      {!internal && preventsRender.length > 0 ? (
        <div className="callout blocked">
          <span className="callout-label">Not available</span>
          This view can't be drawn from the data yet. Choose another option above.
        </div>
      ) : null}
      {internal
        ? notApplied.map((w) => (
            <div key={w} className="callout warning">
              <span className="callout-label">Filter not applied</span>
              {w}
            </div>
          ))
        : publicLimits.map((w) => (
            <div key={w} className="callout warning">
              <span className="callout-label">What this chart includes</span>
              {w}
            </div>
          ))}
      {(internal ? driftingNotes : []).map((n) => (
        <div key={n} className="callout warning">
          <span className="callout-label">Note will drift</span>
          This preset's note states a figure but is not templated from the build: “{n}”
        </div>
      ))}

      {chart}

      <ul className="notes">
        {notes.filter((n) => internal || n.unresolved.length === 0).map((n) => (
          <li key={n.key}>
            {n.text}
            {n.unresolved.length > 0 ? <em> (the build supplied no value for {n.unresolved.join(", ")})</em> : null}
          </li>
        ))}
        {relabels && coverage && !internal ? (
          <li>
            {coverage.label}: at least {pct(coverage.trailing.coverage_stated_confidence ?? 0)} of mild hybrids registered in the last{" "}
            {coverage.trailing.window_months} months are identified (at least {pct(coverage.all_time.coverage_stated_confidence ?? 0)} over
            all time), so this line may undercount them.
          </li>
        ) : null}
        {relabels && coverage && internal ? (
          <li>
            {coverage.label}: over the trailing {coverage.trailing.window_months} months,{" "}
            {pct(coverage.trailing.coverage_stated_confidence ?? 0)} of mild hybrids are identified at stated confidence and{" "}
            {pct(coverage.trailing.coverage_high_confidence_only ?? 0)} counting high-confidence classifications only (all time{" "}
            {pct(coverage.all_time.coverage_stated_confidence ?? 0)} and {pct(coverage.all_time.coverage_high_confidence_only ?? 0)}). A lower bound: every unresolved hybrid counts as a missed mild hybrid.
          </li>
        ) : null}
        {guard > 0 && preventsRender.length === 0 && !internal ? (
          <li>
            Grey: months with fewer than {guard} vehicles behind the figure, too few to read reliably
            {collapseFraction > 0 ? ", and months with far fewer vehicles than the months before them, which may not describe a normal month" : ""}.
            They are drawn in grey, not dropped. <a href="/method">How the figures are made</a>.
          </li>
        ) : null}
        {guard > 0 && preventsRender.length === 0 && internal ? (
          <li>
            Grey: months with fewer than {guard} vehicles behind the figure drawn
            {collapseFraction > 0
              ? `, and months whose total collapsed below ${Math.round(collapseFraction * 100)}% of the median of the ${TRAILING_MONTHS} months before them. The second guard is not the first: a month can be precisely measured and still describe a different population, which is what a nationwide shutdown does to a month of registrations`
              : ""}
            . Their shares are drawn in grey, not dropped and not zeroed.
          </li>
        ) : null}
        <li className="basis">{BASIS_NOTE}</li>
      </ul>

      {internal ? (
        <p className="spec">
          {effectivePreset.id} · {shape} · {effectivePreset.dataset ?? "composite"} · {effectivePreset.derived ?? measure?.id ?? effectivePreset.measure}
          {effectivePreset.dimension ? ` · ${effectivePreset.dimension}` : ""} · {effectivePreset.period ?? "no period"}
          {effectivePreset.top_n ? ` · top ${effectivePreset.top_n} by trailing vehicles` : ""} · snapshot {manifest.latest_snapshot}
        </p>
      ) : null}
    </section>
  );
}
