// One preset: resolve it against the cube, pick the renderer its shape needs, and state every note.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { builderHref, builderPresets, builderQuestionFor, datasetName } from "../lib/builder";
import { figuresCsv, figuresFileName } from "../lib/figures";
import { attribution } from "../lib/siteCopy";
import { compositeRules, phrases, valueWords, findDataset, findDerived, dimensionLabel as dimensionWords, findDimension, findPeriod, findPreset, hybrid, isComposite } from "../lib/config";
import { compositionStart } from "../lib/composition";
import { dimensionNote } from "../lib/dimensionNote";
import { conditionsSentence } from "../lib/scope";
import { hybridNotes, splitPublished } from "../lib/hybrid";
import { ServiceError, loadEvents, loadFirstMonth, loadManifest, loadView } from "../lib/data";
import type { Preset } from "../lib/config";
import type { Event, Manifest, SliceRow } from "../lib/data";
import { TRAILING_MONTHS, guardsFor, monthLabel, pct } from "../lib/measures";
import { fillNote, noteContext, noteStatesAFigure } from "../lib/notes";
import { datasetCovers, fitsPin, latestMonthOf, presetView, rankingPeriods, resolvePreset, servedFrom } from "../lib/resolve";
import { isNearScreen, openGate, whenGateOpens } from "../lib/loadGate";
import { getParam, getShareableUrl, setParam } from "../lib/url";
import { DistributionChart } from "./DistributionChart";
import { GeoChart } from "./GeoChart";
import { FiguresContext } from "./FiguresContext";
import type { FiguresGetter } from "./FiguresContext";
import { LeagueChart } from "./LeagueChart";
import { MixChart } from "./MixChart";
import { TrendChart } from "./TrendChart";

const BASIS_NOTE = "Registrations recorded by NZTA. Not the same as vehicle sales.";

// A value's own words where it is one of the reserved tokens, otherwise the value as it is. Asked with hasOwn, since a
// value can be any text and a plain lookup would answer a built-in for one such as "constructor".
// A value's label as a function that keeps its identity from one render to the next, so a chart that orders ties by the name shown
// does not recompute whenever the panel does. One per dimension and relabelling.
const labelFunctions = new Map<string, (v: string) => string>();
const labelFor = (dimensionId: string | undefined, relabelAs: string | undefined) => {
  const key = `${dimensionId ?? ""}|${relabelAs ?? ""}`;
  let fn = labelFunctions.get(key);
  if (!fn) {
    fn = (v: string) => (relabelAs !== undefined && v === hybrid.mild_powertrain ? relabelAs : valueWords(dimensionId, reservedLabel(v)));
    labelFunctions.set(key, fn);
  }
  return fn;
};

export const reservedLabel = (v: string) => (Object.hasOwn(RESERVED_LABELS, v) ? RESERVED_LABELS[v] : v);

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

// A period the time row offers: one of its spans, the preset's own period, or a period that ranks the view.
const offers = (preset: Preset, granularityId: string | null, id: string) =>
  fitsPin(preset, id) && (TIME_PERIODS.some((p) => p.id === id) || id === (preset.period ?? "all") || rankingPeriods(presetView(preset, granularityId)).includes(id));

const spanLabel = (months: number) => (months >= 24 && months % 12 === 0 ? `${months / 12} years` : `${months} months`);

// lead: one of the charts that carries the page. Larger heading, taller plot; nothing else differs.
// audience: "public" is what a visitor reads on the Explore page: the chart, its controls, its notes and
// any honest limit on what it shows. "internal" (/status) adds the build diagnostics: status badges,
// what blocks the preset, drifting notes and the preset's spec line (D-041).
// preset: a preset built outside presets.json (the sentence builder), drawn exactly as a canon one is.
// anchored: the copied link jumps to this panel. Off where the controls that made the chart sit above it.
export default function PresetPanel({
  presetId: requestedId,
  preset: supplied,
  lead = false,
  audience = "public",
  anchored = true,
  defer = false,
}: {
  presetId?: string;
  preset?: Preset;
  anchored?: boolean;
  // Draw nothing from the cube until the page's first chart is drawn and this panel is within a screen of the visible
  // part of the page, so the charts below the first add no downloads before it draws (src/lib/loadGate.ts).
  defer?: boolean;
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
    if (typeof window === "undefined" || !preset) return defaultPeriod;
    const fromUrl = getParam(presetId, "period", defaultPeriod);
    return offers(preset, activeGranularityId, fromUrl) ? fromUrl : defaultPeriod;
  });
  // All records: an all-time mix chart opens on its composition start; this draws it from the first
  // month with data. Kept in the URL as range=all, the parameter the chart used before.
  const [fullHistory, setFullHistory] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return getParam(presetId, "range", "default") === "all";
  });
  // The month a ranking ends on, or the month a monthly figure is read for; empty is the dataset's latest. Kept in the
  // address as `<preset>.month`.
  const [month, setMonth] = useState<string>(() => (typeof window === "undefined" ? "" : getParam(presetId, "month", "")));
  const [copied, setCopied] = useState<"" | "copied" | "address">("");
  // The table of figures the chart on show draws, which it registers; the download writes it (src/lib/figures.ts).
  const figuresGetter = useRef<FiguresGetter | null>(null);
  const [hasFigures, setHasFigures] = useState(false);
  const registerFigures = useCallback((getter: FiguresGetter | null) => {
    figuresGetter.current = getter;
    setHasFigures(getter !== null);
  }, []);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [events, setEvents] = useState<Event[] | null>(null);
  const [rows, setRows] = useState<SliceRow[] | null>(null);
  // The first month the dataset has vehicles in, loaded with the rows: a ranking needs it to know whether a year before exists.
  const [firstMonth, setFirstMonth] = useState<string | undefined>(undefined);
  // For a measure that divides one dataset by another: the numerator's rows, beside `rows`, the denominator's.
  const [companion, setCompanion] = useState<SliceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A link to this chart (#id) loads it whether or not it is deferred, and brings it into view once it is drawn.
  const linked = typeof window !== "undefined" && window.location.hash === `#${presetId}`;
  const [wanted, setWanted] = useState(!defer || linked);
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const [near, setNear] = useState(false);
  // Bumped when a panel that was taken for near is found not to be, so its observer starts afresh and reports where it is now.
  const [looked, setLooked] = useState(0);
  useEffect(() => {
    if (wanted || !sentinel) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (seen) => {
        // The latest state, not the first sight: while the page's islands are still mounting every panel is briefly
        // near the top, and that must not count once the layout has settled.
        setNear(seen[seen.length - 1].isIntersecting);
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [wanted, sentinel, looked]);
  // Once the gate is open, where the panel is is read again after the page has settled: while the page's islands mount and
  // before the first chart has drawn, every panel is a short placeholder and the whole page can sit inside the margin, so a panel
  // taken for near then may be a screen or many away now. Only one that is near still loads.
  useEffect(() => {
    if (!near || wanted || !sentinel) return;
    let frame = 0;
    const cancelGate = whenGateOpens(() => {
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (typeof IntersectionObserver === "undefined" || isNearScreen(sentinel.getBoundingClientRect(), window.innerHeight)) setWanted(true);
          else {
            setNear(false);
            setLooked((n) => n + 1);
          }
        });
      });
    });
    return () => {
      cancelGate();
      cancelAnimationFrame(frame);
    };
  }, [near, wanted, sentinel]);
  // What a visitor is told when the query service fails: its own sentence, not the reload advice for a file.
  const [serviceError, setServiceError] = useState<string | null>(null);

  const handleGranularityChange = (newId: string) => {
    setActiveGranularityId(newId);
    if (defaultGranularityId) {
      setParam(presetId, "granularity", newId, defaultGranularityId);
    }
    // A ranking period the new view cannot rank over is not in its row, so the view opens on its default.
    if (preset && !offers(preset, newId, activePeriod)) {
      handlePeriodChange(defaultPeriod);
    }
  };

  const handleMonthChange = (chosen: string) => {
    const value = manifest && effectivePreset && chosen === latestMonthOf(effectivePreset, manifest) ? "" : chosen;
    setMonth(value);
    setParam(presetId, "month", value, "");
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
    const shareUrl = anchored ? getShareableUrl(presetId) : window.location.href;
    if (anchored) window.history.replaceState(null, "", `#${presetId}`);
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
  // The months the dataset covers, for every figure that sums a window: a month inside them in which a condition keeps nothing has no
  // rows and holds no vehicles (docs/METRICS.md, "Months in which nothing is counted"). One object until the preset, the build or the
  // first month changes, so the charts that read it do not recompute on every render of the panel.
  const covers = useMemo(() => (effectivePreset && manifest ? datasetCovers(effectivePreset, manifest, firstMonth) : undefined), [effectivePreset, manifest, firstMonth]);

  // The resolver says where the rows come from: a 1-D slice, or a pair slice narrowed to the view's filter. A view
  // changed again before its rows arrive drops them, so a slow earlier load cannot draw under a later view.
  useEffect(() => {
    const source = resolution?.source;
    if (!source || !wanted) return;
    let current = true;
    setRows(null);
    setCompanion(null);
    const other = resolution?.companion;
    Promise.all([
      loadView(source).then(async (loaded) => [loaded, await loadFirstMonth(source, loaded)] as const),
      other ? loadView(other) : Promise.resolve(null),
    ]).then(
      ([[loaded, first], second]) => {
        if (!current) return;
        setCompanion(second);
        setFirstMonth(first);
        setRows(loaded);
      },
      (e) => {
        if (!current) return;
        setServiceError(e instanceof ServiceError ? e.message : null);
        setError(String(e));
      },
    );
    return () => {
      current = false;
    };
  }, [resolution, wanted]);

  // The page's first chart, once it is drawn or cannot be (an error, nothing to draw, a view the cube cannot give), lets the deferred
  // ones begin. A chart that has its rows is drawn a moment later, and its height is what moves the panels below it, so the gate
  // waits for the figure itself; where none appears within a few seconds it opens anyway, so a chart that never draws cannot hold
  // the rest of the page back.
  useEffect(() => {
    if (defer) return;
    if (error || (resolution && resolution.preventsRender.length > 0) || (rows && rows.length === 0)) return openGate();
    if (!rows || !sentinel) return;
    const drawn = () => Boolean(sentinel.querySelector("[role=img]"));
    if (drawn()) return openGate();
    const watch = new MutationObserver(() => drawn() && openGate());
    watch.observe(sentinel, { childList: true, subtree: true });
    const fallback = setTimeout(openGate, 4000);
    return () => {
      watch.disconnect();
      clearTimeout(fallback);
    };
  }, [defer, rows, error, resolution, sentinel]);

  const panelClass = `panel${lead ? " lead" : ""}${wanted ? "" : " loading"}`;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!linked || scrolled || !rows || !sentinel) return;
    setScrolled(true);
    sentinel.scrollIntoView();
  }, [linked, scrolled, rows, sentinel]);
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
          {internal ? error : (serviceError ?? "This chart's data did not load. Reload the page to try again.")}
        </div>
      </section>
    );
  if (!manifest || !resolution)
    return (
      <section className={`${panelClass} loading`} ref={setSentinel}>
        <p className="meta">Loading…</p>
      </section>
    );

  const { blocking, preventsRender, notApplied, status, statusDisagreement, shape, dimension, measure, narrowedBy, keptBy, notBuilt } = resolution;
  const notBuiltMessage = notBuilt ? findDataset(notBuilt)?.not_built_message : undefined;
  const dataset = findDataset(effectivePreset.dataset);
  const derived = findDerived(effectivePreset.derived);
  const served = servedFrom(effectivePreset.dataset, manifest);
  const dsManifest = served ? manifest.datasets[served] : undefined;
  const coverage = dsManifest?.mild_hybrid_identification_coverage;
  const onPowertrain = Boolean(coverage && dimension?.derive?.value === hybrid.powertrain_column);
  // A dataset that does not divide its hybrids has no mild line to relabel (docs/CUBE_SCHEMA.md, mild_split_published).
  const relabels = onPowertrain && splitPublished(coverage);
  const label = labelFor(dimension?.id, relabels ? (coverage as { label: string }).label : undefined);
  const guards = guardsFor(effectivePreset.measure, effectivePreset.derived);
  const guard = guards.min_denominator ?? 0;
  const collapseFraction = guards.min_share_of_trailing_median ?? 0;
  const snapshotsNeeded = derived?.snapshots_needed;
  // Only a chart drawn month by month greys months. A ranking or a distribution sums one window and greys the whole
  // chart or nothing, which its own unit line says, so the note on grey months stays off them.
  const greyNote = guard > 0 && preventsRender.length === 0 && (shape === "mix" || shape === "trend") && !derived?.numerator_dataset;

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
  addNote("measure", undefined, derived?.note_template);
  // A ratio of two datasets says what each one counts, so neither definition is more than a glance away.
  for (const id of derived?.show_dataset_definitions === false ? [] : [derived?.denominator_dataset, derived?.numerator_dataset]) {
    const ds = findDataset(id);
    if (ds?.public_definition && !notBuilt) notes.push({ key: `definition-${id}`, text: `${ds.public_label ?? ds.label}: ${ds.public_definition}`, unresolved: [] });
  }
  // Where the figures come from and the date of the export, said under every chart whose dataset is supplied.
  const sourceNote = findDataset(effectivePreset.dataset)?.source_note;
  if (sourceNote && !notBuilt) addNote("source", undefined, sourceNote);
  // The dimension's note may depend on the state of the dataset (a mild line only where the split is published): src/lib/dimensionNote.ts.
  const dimensionText = dimensionNote(dimension, internal, { splitPublished: splitPublished(coverage) });
  addNote("dimension", dimensionText.plain, dimensionText.template);
  // A filter the chart applies is said under its definition, so a narrowed chart never reads as every vehicle. One it
  // cannot apply is said in a callout: a visitor is told what the chart includes in plain words; the reason, in config
  // terms, is internal.
  const quoted = (values: string[], dimensionId?: string) => values.map((v) => `“${valueWords(dimensionId, reservedLabel(v))}”`).join(" or ");
  const nameOf = (id: string) => {
    const words = dimensionWords(id, internal) || id;
    return words.charAt(0).toLowerCase() + words.slice(1);
  };
  const scope = keptBy?.length
    ? conditionsSentence(keptBy, nameOf, (d, v) => valueWords(d, reservedLabel(v)))
    : narrowedBy
      ? `Only ${quoted(narrowedBy.values, narrowedBy.dimension)} vehicles are counted.`
      : undefined;
  const unapplied = notApplied.length
    ? (effectivePreset.filters ?? []).flatMap((f) => Object.entries(f)).filter(([key]) => key !== narrowedBy?.dimension)
    : [];
  const narrowed = Boolean(resolution.source?.filter);
  const publicLimits = unapplied.map(([, v]) =>
    narrowed
      ? `This chart is not narrowed to “${v}”: the data can't be narrowed that way yet.`
      : `This chart includes every vehicle, not only “${v}”: the data can't be narrowed that way yet.`,
  );
  // The identification coverage is the dataset's, as the build publishes it. A chart narrowed to part of the dataset
  // (its own filter, or a built question's conditions) says so, since the figure is not for the vehicles drawn.
  // It speaks of one line, so it appears only where that value is among those drawn: a view that chose other values, or whose
  // condition leaves it none, has no such line.
  const coverageDrawn = Boolean(rows?.some((r) => r.value === hybrid.mild_powertrain && r.n > 0));
  // A dataset that withholds the split says its hybrids are shown undivided, and the note about the mild line does not appear.
  const hybridText = hybridNotes({
    coverage,
    onPowertrain,
    mildDrawn: coverageDrawn,
    narrowed: narrowed || Boolean(keptBy?.length),
    internal,
    mildValue: hybrid.mild_powertrain,
    undividedValue: hybrid.undivided_powertrain ?? hybrid.source_hybrid.value,
    phrases,
    percent: pct,
  });
  const coverageNote = hybridText.coverage;
  const driftingNotes = [effectivePreset.note, dimension?.note].filter((n): n is string => Boolean(n) && noteStatesAFigure(n as string));

  // Visitor wording from the dimension's public_label, where its label is written for maintainers (D-042).
  const dimensionLabel = dimension ? dimensionWords(dimension.id, internal) : undefined;

  let chart = null;
  if (preventsRender.length === 0 && rows) {
    // A view that loads no rows is said, not drawn: every renderer needs at least one month. A filter value that matches
    // nothing in the data does this, so the internal page names the source to check.
    if (rows.length === 0) {
      const filter = resolution.source?.filter;
      chart = (
        <div className="callout blocked">
          <span className="callout-label">Nothing to draw</span>
          {internal
            ? `No rows: ${resolution.source?.dataset} by ${resolution.source?.dimension}${
                filter ? `, narrowed to ${filter.dimension} = ${filter.values.join(" or ")}` : ""
              } loaded nothing. Check the view's filter values against the data.`
            : "No vehicles in the data match this view."}
        </div>
      );
    } else if (shape === "mix" && dimension) {
      chart = (
        <MixChart
          preset={effectivePreset}
          dimension={dimension}
          rows={rows}
          manifest={manifest}
          events={events}
          covers={covers}
          minDenominator={guard}
          collapseFraction={collapseFraction}
          label={label}
          lead={lead}
          fullHistory={fullHistory}
          internal={internal}
        />
      );
    } else if (shape === "distribution" && dimension) {
      chart = (
        <DistributionChart
          preset={effectivePreset}
          dimension={dimension}
          rows={rows}
          manifest={manifest}
          minDenominator={guard}
          label={label}
          dimensionLabel={dimensionLabel}
          lead={lead}
        />
      );
    } else if (shape === "trend") {
      chart = (
        <TrendChart
          preset={effectivePreset}
          rows={rows}
          manifest={manifest}
          covers={covers}
          minDenominator={guard}
          collapseFraction={collapseFraction}
          lead={lead}
          label={label}
          companion={companion}
          after={
            preset.answer
              ? () => (
                  <>
                    {definitionBlock}
                    {actionsBlock}
                    {controlsBlock}
                  </>
                )
              : undefined
          }
          month={month}
          onMonth={handleMonthChange}
        />
      );
    } else if (shape === "league" && dimension) {
      chart = (
        <LeagueChart
          preset={effectivePreset}
          dimension={dimension}
          rows={rows}
          firstMonth={firstMonth}
          manifest={manifest}
          minDenominator={guard}
          label={label}
          valueHeading={dimensionLabel ?? dimension.label}
          lead={lead}
          month={month}
          onMonth={handleMonthChange}
        />
      );
    } else if (shape === "geo" && dimension) {
      chart = (
        <GeoChart
          preset={effectivePreset}
          dimension={dimension}
          rows={rows}
          manifest={manifest}
          minDenominator={guard}
          label={label}
          dimensionLabel={dimensionLabel}
        />
      );
    }
  }

  const definition = notBuilt ? undefined : (derived?.definition ?? ((!internal && dataset?.public_definition) || dataset?.definition));
  const eyebrow = dimensionLabel ?? derived?.label ?? measure?.label;

  // The same chart on the Build page, ready to change: offered only where the sentence can say this view and the cube
  // draws what it says, and opened on the time range shown here.
  const builderQuestion = builderQuestionFor(effectivePreset);
  const builderLink =
    builderQuestion && builderPresets(builderQuestion).every((p) => resolvePreset(p, manifest).preventsRender.length === 0)
      ? builderHref(builderQuestion, activePeriod, fullHistory)
      : undefined;
  const questionId = `${preset.id}-question`;

  // One row of time options. An all-time mix chart that opens on a later start names that start, and
  // offers the full record as its own option, so no two buttons say the same thing. A period that ranks
  // the chart comes last: it draws a different chart, not a shorter span of the same one.
  const start = shape === "mix" && rows ? compositionStart(rows, dimension, guard, covers) : undefined;
  // A preset whose own period is none of the spans and does not rank it (a distribution of the last 12 months) keeps
  // that period as a span of its own, in order of length, so the option it opens on is always in the row.
  const ranking = rankingPeriods(presetView(preset, activeGranularityId));
  const own = findPeriod(defaultPeriod);
  // A span as long as the data, or longer, draws what All time draws, so it is not offered as a second button.
  const dataMonths = rows ? new Set(rows.map((r) => r.month)).size : Infinity;
  const spans = [
    ...TIME_PERIODS.filter((p) => p.id !== "all" && (findPeriod(p.id)?.months ?? 0) < dataMonths).map((p) => ({ key: p.id, id: p.id, label: p.label, full: false, months: findPeriod(p.id)?.months ?? 0 })),
    ...(own?.months && !TIME_PERIODS.some((p) => p.id === own.id) && !ranking.includes(own.id)
      ? [{ key: own.id, id: own.id, label: spanLabel(own.months), full: false, months: own.months }]
      : []),
  ].sort((a, b) => a.months - b.months);
  const rangeOptions = [
    ...spans,
    { key: "all", id: "all", label: start ? `Since ${monthLabel(start)}` : "All time", full: false },
    ...(start ? [{ key: "all-records", id: "all", label: "All records", full: true }] : []),
    ...ranking.map((id) => ({
      key: id,
      id,
      // LeagueChart ranks the period's own months (a month, or the last 12), so the label names them.
      label: `${findPeriod(id)?.months ?? TRAILING_MONTHS}-month ranking`,
      full: false,
    })),
  ].filter((o) => fitsPin(effectivePreset, o.id));

  // On a count that opens with an answer, the answer comes straight under the question and the rest follows it.
  const answerFirst = Boolean(preset.answer) && shape === "trend" && preventsRender.length === 0 && Boolean(rows?.length);
  const definitionBlock = definition || scope ? <p className="panel-definition">{[definition, scope].filter(Boolean).join(" ")}</p> : null;
  // The file of figures: the table the chart shows, the question in the words the page states it, and where the figures come from. Made here,
  // in the browser, from the rows already loaded; nothing is requested and nothing is sent.
  const handleDownload = () => {
    const figures = figuresGetter.current?.();
    if (!figures) return;
    const header = {
      question: preset.question,
      counted: [definition, scope].filter(Boolean).join(" "),
      dataset: datasetName(effectivePreset.dataset ?? "", manifest),
      snapshot: manifest.latest_snapshot,
      source: notes.find((n) => n.key === "source")?.text,
      attribution,
      address: anchored ? getShareableUrl(presetId) : window.location.href,
    };
    const blob = new Blob(["\uFEFF", figuresCsv(header, figures, phrases)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = figuresFileName(preset.question, manifest.latest_snapshot);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const actionsBlock = (
    <div className="panel-actions">
      <button type="button" className="button-quiet" onClick={handleCopyLink} aria-live="polite">
        {copied === "copied" ? "Link copied" : copied === "address" ? "The address bar now links to this chart" : "Copy link to this chart"}
      </button>
      {builderLink ? (
        <a className="button-quiet" href={builderLink} aria-describedby={questionId}>
          Change this chart
        </a>
      ) : null}
      {hasFigures && preventsRender.length === 0 ? (
        <button type="button" className="button-quiet" onClick={handleDownload}>
          Download the figures (CSV)
        </button>
      ) : null}
    </div>
  );
  const controlsBlock = (
    <div className="controls" style={{ marginBottom: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
      {preset.granularity_options && preset.granularity_options.length > 0 && !(notBuilt && !internal) ? (
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

      {preventsRender.length === 0 ? (
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
  );

  return (
    <FiguresContext.Provider value={registerFigures}>
    <section className={panelClass} id={preset.id} ref={setSentinel}>
      <header className="panel-head">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h3 className="panel-question">
          <span id={questionId}>{preset.question}</span>
          {internal && status !== "live" ? (
            <>
              {" "}
              <span className={`badge ${status}`}>{status}</span>
            </>
          ) : null}
        </h3>
        {answerFirst ? null : definitionBlock}
        {answerFirst ? null : actionsBlock}
      </header>

      {answerFirst ? null : controlsBlock}

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
          {notBuiltMessage ?? "This view can't be drawn from the data yet. Choose another option above."}
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

      {/* One polite status per chart that is being fetched, named by the chart's question, and the same element says when it
          has arrived (then hidden from the eye, which sees the chart). A chart not yet asked for says so in plain text that is
          not live, so a page of charts never speaks for all of them at once; the internal page draws everything at once and
          has no live regions. */}
      {preventsRender.length === 0 && !wanted ? <p className="meta">This chart loads as you scroll to it.</p> : null}
      {preventsRender.length === 0 && wanted ? (
        <p
          className={rows ? "visually-hidden" : "meta"}
          role={internal ? undefined : "status"}
          aria-labelledby={internal ? undefined : questionId}
        >
          {rows ? (rows.length > 0 ? "The chart has loaded." : "") : "Loading the chart…"}
        </p>
      ) : null}
      {chart}

      <ul className="notes">
        {derived?.caveat && !notBuilt && preventsRender.length === 0 ? (
          <li className="caveat">
            {derived.caveat.text} <a href={derived.caveat.href}>{derived.caveat.link_label}</a>
          </li>
        ) : null}
        {notes.filter((n) => (internal || n.unresolved.length === 0) && (internal || !notBuilt)).map((n) => (
          <li key={n.key}>
            {n.text}
            {n.unresolved.length > 0 ? <em> (the build supplied no value for {n.unresolved.join(", ")})</em> : null}
          </li>
        ))}
        {coverageNote ? <li>{coverageNote}</li> : null}
        {hybridText.withheld ? (
          <li>
            {hybridText.withheld} <a href="/caveats#mild-hybrid-limits">{phrases.mild_split_withheld_link}</a>
          </li>
        ) : null}
        {greyNote && !internal ? (
          <li>
            Grey: months with fewer than {guard} vehicles behind the figure, too few to read reliably
            {collapseFraction > 0 ? ", and months with far fewer vehicles than the months before them, which may not describe a normal month" : ""}.
            They are drawn in grey, not dropped. {phrases.grey_beyond_scale} <a href="/method">How the figures are made</a>.
          </li>
        ) : null}
        {greyNote && internal ? (
          <li>
            Grey: months with fewer than {guard} vehicles behind the figure drawn
            {collapseFraction > 0
              ? `, and months whose total collapsed below ${Math.round(collapseFraction * 100)}% of the median of the ${TRAILING_MONTHS} months before them. The second guard is not the first: a month can be precisely measured and still describe a different population, which is what a nationwide shutdown does to a month of registrations`
              : ""}
            . Their shares are drawn in grey, not dropped and not zeroed. {phrases.grey_beyond_scale}
          </li>
        ) : null}
        {notBuilt && !internal ? null : <li className="basis">{BASIS_NOTE}</li>}
      </ul>

      {internal ? (
        <p className="spec">
          {effectivePreset.id} · {shape} · {effectivePreset.dataset ?? "composite"} · {effectivePreset.derived ?? measure?.id ?? effectivePreset.measure}
          {effectivePreset.dimension ? ` · ${effectivePreset.dimension}` : ""} · {effectivePreset.period ?? "no period"}
          {effectivePreset.top_n ? ` · top ${effectivePreset.top_n} by trailing vehicles` : ""} · snapshot {manifest.latest_snapshot}
        </p>
      ) : null}
    </section>
    </FiguresContext.Provider>
  );
}
