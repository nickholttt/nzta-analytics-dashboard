// mix: share of each value over time, as lines. Months under the share guard are greyed, not hidden.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo, useState } from "react";
import { chartDefaults } from "../lib/config";
import type { Dimension, Preset } from "../lib/config";
import { appliesTo, defaultStartMonth } from "../lib/composition";
import type { Event, Manifest, SliceRow } from "../lib/data";
import { MEASUREMENT, assignLanes, markersFor, selectEvents } from "../lib/events";
import {
  TRAILING_MONTHS,
  addMonths,
  collapsedAgainstTrailingMedian,
  monthDate,
  monthRange,
  pct,
  periodWindow,
  rollingShare,
  shareChange,
  trailingWindow,
  windowShare,
} from "../lib/measures";
import { EventList } from "./EventList";
import { PlotFigure } from "./PlotFigure";

const ALL_OTHER = "All other";
const PALETTE = ["#4e79a7", "#f28e2c", "#e15759", "#76b7b2", "#59a14f", "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#17becf"];
const OTHER_COLOUR = "#444";
const GREY_LINE = "#bdbdbd";
const GREY_BAND = "#ececec";
const LANE_HEIGHT = 15;

const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");
const ROLLING = "rolling_12m";

type Point = { month: string; date: Date; series: string; share?: number; suppressed: boolean; denominator?: number };

type Props = {
  preset: Preset;
  dimension: Dimension;
  rows: SliceRow[];
  manifest: Manifest;
  events: Event[] | null;
  minDenominator: number;
  collapseFraction: number;
  label: (value: string) => string;
};

export function MixChart({ preset, dimension, rows, manifest, events, minDenominator, collapseFraction, label }: Props) {
  const [showUnscoped, setShowUnscoped] = useState(false);
  const [smoothing, setSmoothing] = useState(preset.smoothing ?? chartDefaults.mix_smoothing);
  const [allTime, setAllTime] = useState(false);
  const latest = manifest.latest_snapshot.slice(0, 7);
  const rolling = smoothing === ROLLING;
  const smoothingOption = chartDefaults.mix_smoothing_options.find((o) => o.id === smoothing);

  const model = useMemo(() => {
    const cell = new Map<string, number>();
    const denominators = new Map<string, number>();
    for (const r of rows) {
      cell.set(`${r.month}|${r.value}`, r.n);
      denominators.set(r.month, r.denominator);
    }
    const monthsPresent = [...denominators.keys()].sort();
    const first = monthsPresent[0];
    const full = periodWindow(preset.period, first, latest);
    // An all-time mix chart starts where the dimension first had something to show, not at the first
    // month with any data. All time stays one click away; it is never the default.
    const wholeSeries = preset.period === "all" || preset.period === undefined;
    const composed = wholeSeries && appliesTo(dimension) ? defaultStartMonth(rows, minDenominator) : undefined;
    const defaultStart = composed && composed > full.from ? composed : undefined;
    const win = defaultStart && !allTime ? { from: defaultStart, to: full.to } : full;

    // top_n ranks by vehicles over the trailing window, not over the whole period. A period total
    // ranks the incumbents of the last decade and buries anything that arrived inside it, so a wave
    // of new entrants lands in the remainder where no reader can see it. Reserved tokens never take
    // a place and fall into the remainder.
    const rankWin = trailingWindow(win.to, first);
    const totals = new Map<string, number>();
    for (const r of rows) if (r.month >= rankWin.from && r.month <= rankWin.to) totals.set(r.value, (totals.get(r.value) ?? 0) + r.n);
    const ranked = [...totals.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([v]) => v);
    const kept = preset.top_n ? ranked.filter((v) => !isReserved(v)).slice(0, preset.top_n) : ranked;
    const series = preset.top_n ? [...kept, ALL_OTHER] : kept;

    // Event scoping asks which categories the chart actually shows over its period. That is not the
    // ranked set: ranking now looks at the trailing window only, and an event about a category that
    // stopped selling a decade ago still belongs on a chart that reaches back that far.
    const categories = new Set<string>();
    for (const r of rows) if (r.n > 0 && r.month >= win.from && r.month <= win.to) categories.add(r.value);

    const denominatorFor = (month: string) => denominators.get(month);
    const nFor = (month: string, s: string) => {
      const den = denominators.get(month);
      if (den === undefined) return undefined;
      if (s !== ALL_OTHER) return cell.get(`${month}|${s}`) ?? 0;
      return den - kept.reduce((sum, k) => sum + (cell.get(`${month}|${k}`) ?? 0), 0);
    };

    // Rolling is computed here from n and denominator, never read from the cube: the cube carries
    // counts only, so the window and the suppression guard stay changeable without a rebuild.
    const valueAt = (month: string, s: string) => {
      if (!rolling) {
        const den = denominatorFor(month);
        const n = nFor(month, s);
        if (den === undefined || !den || n === undefined) return undefined;
        return { share: n / den, denominator: den };
      }
      const r = rollingShare(month, first, (m) => nFor(m, s), denominatorFor);
      return r ? { share: r.share, denominator: r.denominator } : undefined;
    };

    // The guard applies to whatever denominator the drawn figure actually rests on: the month's own
    // when monthly, the window's when rolling. An absent figure is not suppressed, it is absent.
    // Two guards, docs/METRICS.md: a precision floor on the denominator behind the drawn figure, and
    // a representativeness floor against the month's own recent history. Neither implies the other.
    const collapsed = (month: string) => collapsedAgainstTrailingMedian(month, denominatorFor, collapseFraction);

    const basisDenominator = (month: string) => {
      if (!rolling) return denominatorFor(month);
      if (addMonths(month, -(TRAILING_MONTHS - 1)) < first) return undefined;
      let total = 0;
      for (const m of monthRange(addMonths(month, -(TRAILING_MONTHS - 1)), month)) {
        const den = denominatorFor(m);
        if (den === undefined) return undefined;
        total += den;
      }
      return total;
    };

    const points: Point[] = [];
    const bands: { x1: Date; x2: Date; y1: number; y2: number }[] = [];
    let runStart: string | null = null;
    const months = monthRange(win.from, win.to);
    for (const m of months) {
      const basis = basisDenominator(m);
      const thin = basis !== undefined && basis < minDenominator;
      // The rolling figure spans a year, so one collapsed month does not make its window
      // unrepresentative; the guard applies to the month's own share.
      const suppressed = thin || (!rolling && collapsed(m));
      if (suppressed && runStart === null) runStart = m;
      if (!suppressed && runStart !== null) {
        bands.push({ x1: monthDate(runStart), x2: monthDate(m), y1: 0, y2: 1 });
        runStart = null;
      }
      for (const s of series) {
        const v = valueAt(m, s);
        points.push({ month: m, date: monthDate(m), series: s, share: v?.share, suppressed, denominator: v?.denominator });
      }
    }
    if (runStart !== null) bands.push({ x1: monthDate(runStart), x2: monthDate(addMonths(win.to, 1)), y1: 0, y2: 1 });

    // The table states the trailing figure and its change on the window before, and is ordered by the
    // figure it shows, largest first, so the reader never has to re-sort it by eye.
    const summary = series
      .map((s, i) => {
        const now = windowShare(addMonths(latest, -(TRAILING_MONTHS - 1)), latest, (m) => nFor(m, s), denominatorFor);
        const before = windowShare(addMonths(latest, -(2 * TRAILING_MONTHS - 1)), addMonths(latest, -TRAILING_MONTHS), (m) => nFor(m, s), denominatorFor);
        const shown = now.denominator >= minDenominator ? now.n / now.denominator : undefined;
        return { series: s, before, shown, colour: colourOf(s, i), remainder: s === ALL_OTHER };
      })
      // Ordered by the figure it shows, largest first. The remainder is pinned last whatever its
      // size: it is what is left over, not a competitor, and sorting it among the named values
      // invites a reader to read it as one.
      .sort((a, b) => Number(a.remainder) - Number(b.remainder) || (b.shown ?? -1) - (a.shown ?? -1));

    return { win, full, rankWin, series, points, bands, summary, categories, defaultStart };
  }, [rows, preset, dimension, latest, minDenominator, collapseFraction, rolling, allTime]);

  const selected = useMemo(
    () => (preset.events && events ? selectEvents(events, dimension.id, model.categories, `${model.win.from}-01`, manifest.latest_snapshot) : null),
    [events, preset.events, dimension.id, model, manifest.latest_snapshot],
  );
  const domain = useMemo(() => ({ from: model.win.from, to: addMonths(model.win.to, 1) }), [model.win.from, model.win.to]);
  const markers = useMemo(
    () => (selected ? markersFor(showUnscoped ? [...selected.scoped, ...selected.unscoped] : selected.scoped, domain.from, domain.to) : []),
    [selected, showUnscoped, domain],
  );
  const laned = useMemo(() => assignLanes(markers, domain.from, domain.to), [markers, domain]);
  const laneCount = laned.reduce((n, m) => Math.max(n, m.lane + 1), 1);

  const render = useCallback(() => {
    const yMax = Math.min(1, Math.max(0.05, ...model.points.map((p) => p.share ?? 0)) * 1.05);
    const bands = model.bands.map((b) => ({ ...b, y2: yMax }));
    // Clustering moves a label, never a date: every event keeps its own rule and its own band.
    const eventsShown = laned.flatMap((m) => m.events);
    const windowed = eventsShown
      .filter((e) => e.date_end)
      .map((e) => ({ x1: new Date(e.date_start), x2: new Date(e.date_end as string), y1: 0, y2: yMax }));
    const rules = eventsShown.map((e) => ({ x: new Date(e.date_start), measurement: e.mechanism === MEASUREMENT }));
    const pins = laned.map((m) => ({ ...m, x: new Date(m.date) }));
    const announced = eventsShown.filter((e) => e.announced_date).map((e) => ({ x: new Date(e.announced_date as string) }));
    const ends = model.series
      .map((s) => [...model.points].reverse().find((p) => p.series === s && p.share !== undefined && !p.suppressed))
      .filter((p): p is Point => Boolean(p));
    // Stack the end labels down the axis so close series do not print on top of each other, then
    // lift the stack back inside the frame if it has run past the bottom.
    const gap = Math.min(yMax * 0.035, yMax / Math.max(1, ends.length - 1));
    let previous = Number.POSITIVE_INFINITY;
    const stacked = [...ends]
      .sort((a, b) => (b.share ?? 0) - (a.share ?? 0))
      .map((p) => {
        const labelY = Math.min(p.share as number, previous - gap);
        previous = labelY;
        return { ...p, labelY };
      });
    const lowest = stacked.length ? stacked[stacked.length - 1].labelY : 0;
    const labels = lowest < 0 ? stacked.map((p) => ({ ...p, labelY: p.labelY - lowest })) : stacked;
    return Plot.plot({
      width: 1150,
      height: 480 + (laneCount - 1) * LANE_HEIGHT,
      // Every marker lane needs its own row of clear space above the frame.
      marginTop: 28 + (laneCount - 1) * LANE_HEIGHT,
      marginRight: 190,
      x: { type: "utc", label: null, domain: [monthDate(model.win.from), monthDate(addMonths(model.win.to, 1))] },
      y: { label: smoothingOption?.axis ?? null, domain: [0, yMax], grid: true, tickFormat: (d: number) => `${Math.round(d * 100)}%` },
      color: { domain: model.series, range: model.series.map(colourOf) },
      marks: [
        Plot.rect(bands, { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: GREY_BAND }),
        Plot.rect(windowed, { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: "#f5c26b", fillOpacity: 0.22 }),
        Plot.ruleX(announced, { x: "x", stroke: "#777", strokeOpacity: 0.35 }),
        Plot.ruleX(rules.filter((r) => !r.measurement), { x: "x", stroke: "#222", strokeOpacity: 0.7 }),
        Plot.ruleX(rules.filter((r) => r.measurement), { x: "x", stroke: "#b03", strokeDasharray: "4,3" }),
        // Lane 0 sits just above the frame and each further lane above that, so markers that would
        // print on top of each other are read as a column instead of a smear. dy is a constant
        // offset in Plot, not a channel, so each lane needs its own mark.
        ...Array.from({ length: laneCount }, (_, lane) =>
          Plot.text(
            pins.filter((p) => p.lane === lane),
            { x: "x", y: yMax, text: "label", dy: -10 - lane * LANE_HEIGHT, fontWeight: "bold" },
          ),
        ),
        Plot.lineY(model.points, { x: "date", y: "share", z: "series", stroke: GREY_LINE, strokeWidth: 1.2 }),
        Plot.lineY(
          model.points.map((p) => (p.suppressed ? { ...p, share: undefined } : p)),
          { x: "date", y: "share", z: "series", stroke: "series", strokeWidth: 1.7 },
        ),
        Plot.text(labels, { x: "date", y: "labelY", text: (p: Point) => label(p.series), fill: "series", textAnchor: "start", dx: 6 }),
        Plot.tip(
          model.points.filter((p) => p.share !== undefined),
          Plot.pointer({
            x: "date",
            y: "share",
            title: (p: Point) =>
              `${label(p.series)}\n${p.month}: ${pct(p.share as number)}${p.suppressed ? `\ngreyed: ${p.denominator} vehicles behind this figure` : ""}`,
          }),
        ),
      ],
    });
  }, [model, laned, laneCount, label, minDenominator, smoothingOption]);

  return (
    <>
      {model.defaultStart ? (
        <p className="controls">
          <label>
            <input type="radio" name={`range-${preset.id}`} checked={!allTime} onChange={() => setAllTime(false)} /> From {model.defaultStart}
          </label>
          <label>
            <input type="radio" name={`range-${preset.id}`} checked={allTime} onChange={() => setAllTime(true)} /> All time
          </label>
          <span className="meta">
            The first month with at least {chartDefaults.mix_default_start.min_categories} categories above{" "}
            {chartDefaults.mix_default_start.min_share * 100}% of the trailing {TRAILING_MONTHS} months, held for{" "}
            {chartDefaults.mix_default_start.sustain_months} months. Before it the mix has nothing to show and the rest of the chart is
            squeezed into the right of the frame. Data starts {model.full.from}.
          </span>
        </p>
      ) : null}
      <p className="controls">
        {chartDefaults.mix_smoothing_options.map((o) => (
          <label key={o.id}>
            <input type="radio" name={`smoothing-${preset.id}`} checked={smoothing === o.id} onChange={() => setSmoothing(o.id)} /> {o.label}
          </label>
        ))}
        <span className="meta">
          {rolling
            ? `Each point is the trailing ${TRAILING_MONTHS} months' vehicles of this value over the trailing ${TRAILING_MONTHS} months' total, computed in the browser from the monthly counts. A window missing a month is left blank, never filled in.`
            : "Each point is the month's own share."}
        </span>
      </p>
      <PlotFigure render={render} />
      <table className="summary">
        <thead>
          <tr>
            <th />
            <th>Last {TRAILING_MONTHS} months</th>
            <th>Change on the {TRAILING_MONTHS} months before</th>
          </tr>
        </thead>
        <tbody>
          {model.summary.map(({ series, before, shown, colour }) => {
            const beforeOk = before.denominator >= minDenominator;
            return (
              <tr key={series}>
                <td>
                  <span className="swatch" style={{ background: colour }} /> {label(series)}
                </td>
                <td>{shown === undefined ? "suppressed" : pct(shown)}</td>
                <td>{shown !== undefined && beforeOk ? shareChange(shown - before.n / before.denominator) : "suppressed"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {selected ? (
        <div className="events-block">
          <EventList markers={laned} />
          {selected.unscoped.length > 0 ? (
            <button type="button" onClick={() => setShowUnscoped(!showUnscoped)}>
              {showUnscoped ? "Hide" : "Show"} {selected.unscoped.length} market-wide events
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function colourOf(s: string, i: number) {
  return s === ALL_OTHER ? OTHER_COLOUR : PALETTE[i % PALETTE.length];
}
