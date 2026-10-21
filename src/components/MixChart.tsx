// mix: share of each value over time, as lines. Months under the share guard are greyed, not hidden.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo, useState } from "react";
import { chartDefaults } from "../lib/config";
import type { Dimension, Preset } from "../lib/config";
import { compositionStart } from "../lib/composition";
import type { Event, Manifest, SliceRow } from "../lib/data";
import { MEASUREMENT, layoutMarkers, selectEvents } from "../lib/events";
import {
  TRAILING_MONTHS,
  addMonths,
  collapsedAgainstTrailingMedian,
  monthDate,
  monthLabel,
  monthRange,
  pct,
  periodWindow,
  rollingShare,
  shareChange,
  trailingWindow,
  windowShare,
} from "../lib/measures";
import { monthPeriod, readout } from "../lib/readout";
import type { Greyed } from "../lib/readout";
import {
  EVENT_WINDOW,
  INK_2,
  INK_3,
  LINE_WIDTH,
  PAPER,
  REMAINDER,
  RULE,
  RULE_STRONG,
  SUPPRESSED_BAND,
  SUPPRESSED_LINE,
  THIN_LINE_WIDTH,
  chartHeight,
  hasOwnColour,
  plotStyle,
  seriesColour,
  tipStyle,
  xTicks,
} from "../lib/theme";
import { getParam, setParam } from "../lib/url";
import { EventList } from "./EventList";
import { PlotFigure } from "./PlotFigure";

export const ALL_OTHER = "All other";
const LANE_HEIGHT = 15;
const LABEL_LINE_HEIGHT = 15;
const LEADER_PX = 14;
const MARGIN_LEFT = 44;
const MARGIN_BOTTOM = 28;

const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");
// The pipeline's token for values beyond its own cap (docs/CUBE_SCHEMA.md): a group too small to name, so
// on a capped chart it belongs in the remainder, unlike the tokens for what the record could not place.
const BEYOND_CAP = "__OTHER__";
const ownLine = (v: string) => isReserved(v) && v !== BEYOND_CAP;
const ROLLING = "rolling_12m";

type Point = {
  month: string;
  date: Date;
  series: string;
  share?: number;
  n?: number;
  denominator?: number;
  suppressed: boolean;
  greyed?: Greyed;
};

type Props = {
  preset: Preset;
  dimension: Dimension;
  rows: SliceRow[];
  manifest: Manifest;
  events: Event[] | null;
  minDenominator: number;
  collapseFraction: number;
  label: (value: string) => string;
  lead?: boolean;
  // All records: draw from the first month with data instead of the composition start. The panel owns
  // the choice, so the chart's time options sit in one row.
  fullHistory?: boolean;
  // Plain wording for visitors; the internal page keeps the exact rule (D-042).
  internal?: boolean;
};

export function MixChart({ preset, dimension, rows, manifest, events, minDenominator, collapseFraction, label, lead = false, fullHistory = false, internal = false }: Props) {
  const [showUnscoped, setShowUnscoped] = useState(false);
  const defaultSmoothing = preset.smoothing ?? chartDefaults.mix_smoothing;
  const [smoothing, setSmoothing] = useState<string>(() => {
    if (typeof window === "undefined") return defaultSmoothing;
    const fromUrl = getParam(preset.id, "smoothing", defaultSmoothing);
    return chartDefaults.mix_smoothing_options.some((o) => o.id === fromUrl) ? fromUrl : defaultSmoothing;
  });

  const handleSmoothingChange = (newSmoothing: string) => {
    setSmoothing(newSmoothing);
    setParam(preset.id, "smoothing", newSmoothing, defaultSmoothing);
  };

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
    const defaultStart = wholeSeries ? compositionStart(rows, dimension, minDenominator) : undefined;
    const win = defaultStart && !fullHistory ? { from: defaultStart, to: full.to } : full;

    // top_n ranks by vehicles over the trailing window, not over the whole period. A period total
    // ranks the incumbents of the last decade and buries anything that arrived inside it, so a wave
    // of new entrants lands in the remainder where no reader can see it. Reserved tokens never take
    // a place.
    const rankWin = trailingWindow(win.to, first);
    const totals = new Map<string, number>();
    for (const r of rows) if (r.month >= rankWin.from && r.month <= rankWin.to) totals.set(r.value, (totals.get(r.value) ?? 0) + r.n);
    const ranked = [...totals.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([v]) => v);
    const kept = preset.top_n ? ranked.filter((v) => !isReserved(v)).slice(0, preset.top_n) : ranked;

    // Event scoping asks which categories the chart actually shows over its period. That is not the
    // ranked set: ranking now looks at the trailing window only, and an event about a category that
    // stopped selling a decade ago still belongs on a chart that reaches back that far.
    const categories = new Set<string>();
    const inPeriod = new Set<string>();
    // A rolling share at the window's first month reaches back a year before it.
    const drawnFrom = rolling ? addMonths(win.from, -(TRAILING_MONTHS - 1)) : win.from;
    const drawn = new Set<string>();
    for (const r of rows) {
      if (r.n <= 0) continue;
      if (r.month >= full.from && r.month <= full.to) inPeriod.add(r.value);
      if (r.month >= win.from && r.month <= win.to) categories.add(r.value);
      if (r.month >= drawnFrom && r.month <= win.to) drawn.add(r.value);
    }

    // Without top_n there is no remainder, so every group with vehicles behind the drawn window needs
    // its own line. Drawing only the trailing ranking would drop a group that stopped years ago from
    // the years it was there, and the lines would add up to less than the total.
    // With top_n, a token for what the record could not place keeps its own line too, as it does without
    // one: it is not a group too small to name. Folded into the remainder, an era with no country recorded
    // read as "All other" near 100% (D-046).
    const rankedSet = new Set(ranked);
    const unranked = preset.top_n ? [] : [...drawn].filter((v) => !rankedSet.has(v)).sort();
    const reservedDrawn = preset.top_n ? [...drawn].filter(ownLine).sort() : [];
    const series = preset.top_n ? [...kept, ...reservedDrawn, ALL_OTHER] : [...ranked, ...unranked];
    const named = [...kept, ...new Set(rows.map((r) => r.value).filter(ownLine))];

    const denominatorFor = (month: string) => denominators.get(month);
    const nFor = (month: string, s: string) => {
      const den = denominators.get(month);
      if (den === undefined) return undefined;
      if (s !== ALL_OTHER) return cell.get(`${month}|${s}`) ?? 0;
      return den - named.reduce((sum, k) => sum + (cell.get(`${month}|${k}`) ?? 0), 0);
    };

    // Which series take one of the palette's colours. A mix chart tells two stories, what matters now and
    // what mattered over its period, and the palette has fewer slots than some charts have series. Ranked
    // by trailing volume alone, a category that carried the 1950s is grey through the decades it
    // dominated; ranked by peak alone, a contender that has only ever been as large as it is today is
    // grey. So the first slots go to the largest series over the trailing window and the rest by peak
    // rolling share over the preset's whole period. Both are fixed by the period and the latest month,
    // so neither the range nor the smoothing toggle repaints a line. The remainder and the reserved
    // tokens never take a colour: neither is a competitor. Without top_n the candidates are every group
    // in the preset's period, not just the drawn window, so that switching to all time cannot hand an
    // earlier group a colour that pushes a later one down the palette.
    const candidates = (preset.top_n ? kept : [...inPeriod]).filter((s) => !isReserved(s));
    const peak = new Map<string, number>();
    for (const s of candidates) {
      let max = 0;
      for (const m of monthRange(full.from, full.to)) {
        const r = rollingShare(m, first, (k) => nFor(k, s), denominatorFor);
        if (r && r.denominator >= minDenominator && r.share > max) max = r.share;
      }
      peak.set(s, max);
    }
    const byTrailing = ranked.filter((v) => peak.has(v)).slice(0, chartDefaults.colour_slots_by_trailing);
    const byPeak = candidates.filter((s) => !byTrailing.includes(s)).sort((a, b) => (peak.get(b) ?? 0) - (peak.get(a) ?? 0));
    const colourRank = new Map([...byTrailing, ...byPeak].map((s, i) => [s, i]));
    const colourOf = (s: string) => (s === ALL_OTHER ? REMAINDER : seriesColour(colourRank.get(s) ?? Number.POSITIVE_INFINITY));
    const ownColour = (s: string) => s !== ALL_OTHER && hasOwnColour(colourRank.get(s) ?? Number.POSITIVE_INFINITY);

    // Rolling is computed here from n and denominator, never read from the cube: the cube carries
    // counts only, so the window and the suppression guard stay changeable without a rebuild.
    const valueAt = (month: string, s: string) => {
      if (!rolling) {
        const den = denominatorFor(month);
        const n = nFor(month, s);
        if (den === undefined || !den || n === undefined) return undefined;
        return { share: n / den, n, denominator: den };
      }
      const r = rollingShare(month, first, (m) => nFor(m, s), denominatorFor);
      return r ? { share: r.share, n: r.n, denominator: r.denominator } : undefined;
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
      const greyed: Greyed | undefined = thin ? "thin" : !rolling && collapsed(m) ? "collapsed" : undefined;
      const suppressed = greyed !== undefined;
      if (suppressed && runStart === null) runStart = m;
      if (!suppressed && runStart !== null) {
        bands.push({ x1: monthDate(runStart), x2: monthDate(m), y1: 0, y2: 1 });
        runStart = null;
      }
      for (const s of series) {
        const v = valueAt(m, s);
        points.push({ month: m, date: monthDate(m), series: s, share: v?.share, n: v?.n, denominator: v?.denominator, suppressed, greyed });
      }
    }
    if (runStart !== null) bands.push({ x1: monthDate(runStart), x2: monthDate(addMonths(win.to, 1)), y1: 0, y2: 1 });

    // The key states the trailing figure and its change on the window before, and is ordered by the
    // figure it shows, largest first, so the reader never has to re-sort it by eye.
    const summary = series
      .map((s) => {
        const now = windowShare(addMonths(latest, -(TRAILING_MONTHS - 1)), latest, (m) => nFor(m, s), denominatorFor);
        const before = windowShare(addMonths(latest, -(2 * TRAILING_MONTHS - 1)), addMonths(latest, -TRAILING_MONTHS), (m) => nFor(m, s), denominatorFor);
        const shown = now.denominator >= minDenominator ? now.n / now.denominator : undefined;
        return { series: s, before, shown, colour: colourOf(s), remainder: s === ALL_OTHER };
      })
      // Ordered by the figure it shows, largest first. The remainder is pinned last whatever its
      // size: it is what is left over, not a competitor, and sorting it among the named values
      // invites a reader to read it as one.
      .sort((a, b) => Number(a.remainder) - Number(b.remainder) || (b.shown ?? -1) - (a.shown ?? -1));

    return { win, full, rankWin, series, points, bands, summary, categories, defaultStart, colourOf, ownColour };
  }, [rows, preset, dimension, latest, minDenominator, collapseFraction, rolling, fullHistory]);

  const selected = useMemo(
    () => (preset.events && events ? selectEvents(events, dimension.id, model.categories, `${model.win.from}-01`, manifest.latest_snapshot) : null),
    [events, preset.events, dimension.id, model, manifest.latest_snapshot],
  );
  const domain = useMemo(() => ({ from: model.win.from, to: addMonths(model.win.to, 1) }), [model.win.from, model.win.to]);
  const shownEvents = useMemo(
    () => (selected ? (showUnscoped ? [...selected.scoped, ...selected.unscoped] : selected.scoped) : []),
    [selected, showUnscoped],
  );

  // End labels: series with their own colour and the remainder. On narrow screens (<540px),
  // leaders and labels are omitted so the plot has full width for the data lines; the key table
  // immediately below identifies every series with swatches and trailing numbers. The right margin
  // they need sets the frame's width, which the event markers are laid out against.
  const endLabels = useCallback(
    (width: number) => {
      const showDirectLabels = width >= 540;
      const ends = showDirectLabels
        ? model.series
            .filter((s) => s === ALL_OTHER || model.ownColour(s))
            .map((s) => [...model.points].reverse().find((p) => p.series === s && p.share !== undefined && !p.suppressed))
            .filter((p): p is Point => Boolean(p))
        : [];
      const longest = showDirectLabels ? Math.max(0, ...ends.map((p) => label(p.series).length)) : 0;
      const marginRight = showDirectLabels ? Math.min(230, 20 + LEADER_PX + longest * 6.8) : 16;
      return { showDirectLabels, ends, marginRight };
    },
    [model, label],
  );
  const markersAt = useCallback(
    (width: number) => layoutMarkers(shownEvents, domain.from, domain.to, width ? width - MARGIN_LEFT - endLabels(width).marginRight : 0),
    [shownEvents, domain, endLabels],
  );
  // The list under the chart numbers its entries as the chart does, so both follow the drawn width.
  const [figureWidth, setFigureWidth] = useState(0);
  const listed = useMemo(() => markersAt(figureWidth), [markersAt, figureWidth]);
  const eventCount = shownEvents.length;

  const render = useCallback(
    (width: number) => {
      const height = chartHeight(width, lead);
      const laned = markersAt(width);
      const laneCount = laned.reduce((n, m) => Math.max(n, m.lane + 1), 1);
      // Every marker lane needs its own row of clear space above the frame.
      const marginTop = 24 + (laneCount - 1) * LANE_HEIGHT;
      const yMax = Math.min(1, Math.max(0.05, ...model.points.map((p) => p.share ?? 0)) * 1.05);
      const bands = model.bands.map((b) => ({ ...b, y2: yMax }));
      const { ownColour } = model;

      // Clustering moves a label, never a date: every event keeps its own rule and its own band.
      const eventsShown = laned.flatMap((m) => m.events);
      const windowed = eventsShown
        .filter((e) => e.date_end)
        .map((e) => ({ x1: new Date(e.date_start), x2: new Date(e.date_end as string), y1: 0, y2: yMax }));
      const rules = eventsShown.map((e) => ({ x: new Date(e.date_start), measurement: e.mechanism === MEASUREMENT }));
      const from = monthDate(domain.from).getTime();
      const span = monthDate(domain.to).getTime() - from;
      const pins = laned.map((m) => ({ ...m, x: new Date(from + m.at * span) }));
      const announced = eventsShown.filter((e) => e.announced_date).map((e) => ({ x: new Date(e.announced_date as string) }));

      const { showDirectLabels, ends, marginRight } = endLabels(width);
      const innerHeight = height - marginTop - MARGIN_BOTTOM;
      const innerWidth = width - MARGIN_LEFT - marginRight;

      // Labels sit in one column to the right of the frame, stacked a line apart, each joined to its
      // line's end by a leader, so a label pushed away from a crowded end still points at its line.
      const gap = (LABEL_LINE_HEIGHT / innerHeight) * yMax;
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
      const spanMonths = monthRange(domain.from, domain.to).length;
      const labelX = monthDate(addMonths(domain.to, Math.max(1, Math.ceil((spanMonths * LEADER_PX) / Math.max(1, innerWidth)))));

      const drawn = model.points.map((p) => (p.suppressed ? { ...p, share: undefined } : p));
      const ownColourPoints = drawn.filter((p) => ownColour(p.series));
      const contextPoints = drawn.filter((p) => !ownColour(p.series));
      const labelMarks = showDirectLabels
        ? [
            Plot.link(labels, { x1: "date", y1: "share", x2: () => labelX, y2: "labelY", stroke: RULE_STRONG }),
            Plot.dot(labels, { x: "date", y: "share", r: 3.5, fill: "series", stroke: PAPER, strokeWidth: 1.5 }),
            Plot.text(labels, { x: () => labelX, y: "labelY", text: (p: Point) => label(p.series), textAnchor: "start", dx: 4, fill: INK_2 }),
          ]
        : [];

      return Plot.plot({
        width,
        height,
        marginTop,
        marginRight,
        marginLeft: MARGIN_LEFT,
        marginBottom: MARGIN_BOTTOM,
        style: plotStyle,
        x: { type: "utc", label: null, domain: [monthDate(domain.from), monthDate(domain.to)] },
        y: { label: null, domain: [0, yMax] },
        color: { domain: model.series, range: model.series.map(model.colourOf) },
        marks: [
          Plot.rect(bands, { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: SUPPRESSED_BAND }),
          // A window can run past the latest snapshot (a policy in force until 2029); it stops at the
          // frame rather than shading the end labels.
          Plot.rect(windowed, { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: EVENT_WINDOW, fillOpacity: 0.55, clip: true }),
          Plot.gridY({ ticks: 5, stroke: RULE, strokeOpacity: 1 }),
          Plot.axisY({ ticks: 5, tickSize: 0, tickPadding: 6, label: null, tickFormat: (d: number) => `${Math.round(d * 100)}%` }),
          Plot.axisX({ ticks: xTicks(width), tickSize: 4, stroke: RULE_STRONG, label: null }),
          Plot.ruleY([0], { stroke: RULE_STRONG }),
          // An event that straddles the chart's start, or was announced before it, would otherwise draw
          // its rule in the left margin over the axis labels.
          Plot.ruleX(announced, { x: "x", stroke: INK_3, strokeOpacity: 0.4, strokeDasharray: "1,3", clip: true }),
          Plot.ruleX(rules.filter((r) => !r.measurement), { x: "x", stroke: INK_2, strokeOpacity: 0.45, clip: true }),
          Plot.ruleX(rules.filter((r) => r.measurement), { x: "x", stroke: INK_2, strokeOpacity: 0.8, strokeDasharray: "4,3", clip: true }),
          // Lane 0 sits just above the frame and each further lane above that, so markers that would
          // print on top of each other are read as a column instead of a smear. dy is a constant
          // offset in Plot, not a channel, so each lane needs its own mark.
          ...Array.from({ length: laneCount }, (_, lane) =>
            Plot.text(pins.filter((p) => p.lane === lane), {
              x: "x",
              y: yMax,
              text: "label",
              dy: -10 - lane * LANE_HEIGHT,
              fill: INK_2,
              fontWeight: 600,
              fontSize: 11,
            }),
          ),
          Plot.lineY(model.points, { x: "date", y: "share", z: "series", stroke: SUPPRESSED_LINE, strokeWidth: THIN_LINE_WIDTH }),
          Plot.lineY(contextPoints, {
            x: "date",
            y: "share",
            z: "series",
            stroke: "series",
            strokeWidth: THIN_LINE_WIDTH,
            strokeLinejoin: "round",
            strokeLinecap: "round",
          }),
          Plot.lineY(ownColourPoints, {
            x: "date",
            y: "share",
            z: "series",
            stroke: "series",
            strokeWidth: LINE_WIDTH,
            strokeLinejoin: "round",
            strokeLinecap: "round",
          }),
          ...labelMarks,
          Plot.ruleX(model.points, Plot.pointerX({ x: "date", stroke: RULE_STRONG })),
          Plot.dot(
            model.points.filter((p) => p.share !== undefined),
            Plot.pointer({ x: "date", y: "share", r: 4, fill: "series", stroke: PAPER, strokeWidth: 1.5 }),
          ),
          Plot.tip(
            model.points.filter((p) => p.share !== undefined),
            Plot.pointer({
              x: "date",
              y: "share",
              ...tipStyle,
              title: (p: Point) =>
                readout({
                  name: label(p.series),
                  period: monthPeriod(p.month, rolling),
                  share: p.share,
                  n: p.n,
                  base: p.denominator,
                  greyed: p.greyed,
                  minDenominator,
                }),
            }),
          ),
        ],
      });
    },
    [model, markersAt, endLabels, label, lead, domain, rolling, minDenominator],
  );

  return (
    <>
      <div className="controls">
        <div className="toggle" role="radiogroup" aria-label="Smoothing">
          {chartDefaults.mix_smoothing_options.map((o) => (
            <label key={o.id}>
              <input
                type="radio"
                name={`smoothing-${preset.id}`}
                checked={smoothing === o.id}
                onChange={() => handleSmoothingChange(o.id)}
              />{" "}
              {o.label}
            </label>
          ))}
        </div>
      </div>
      <p className="chart-unit">{smoothingOption?.axis}</p>
      <PlotFigure
        render={render}
        onWidth={setFigureWidth}
        label={`Line chart, ${monthLabel(model.win.from)} to ${monthLabel(model.win.to)}: ${(smoothingOption?.axis ?? "share").toLowerCase()}, one line per group. The table below the chart gives each group's share over the last ${TRAILING_MONTHS} months.`}
      />
      <table className="key">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Series</span>
            </th>
            <th scope="col">Last {TRAILING_MONTHS} months</th>
            <th scope="col">Change on the {TRAILING_MONTHS} months before</th>
          </tr>
        </thead>
        <tbody>
          {model.summary.map(({ series, before, shown, colour, remainder }) => {
            const beforeOk = before.denominator >= minDenominator;
            const changeShown = shown !== undefined && beforeOk;
            return (
              <tr key={series} className={remainder ? "remainder" : undefined}>
                <td>
                  <span className="swatch" style={{ background: colour }} aria-hidden="true" />
                  <span>{label(series)}</span>
                </td>
                <td className={shown === undefined ? "suppressed" : "figure"}>{shown === undefined ? "suppressed" : pct(shown)}</td>
                <td className={changeShown ? "change" : "suppressed"}>{changeShown ? shareChange(shown - before.n / before.denominator) : "suppressed"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {selected && (eventCount > 0 || selected.unscoped.length > 0) ? (
        <details className="events-block">
          <summary>
            {eventCount} {eventCount === 1 ? "event" : "events"} marked on the chart
          </summary>
          <EventList markers={listed} />
          {selected.unscoped.length > 0 ? (
            <button type="button" className="button-quiet" onClick={() => setShowUnscoped(!showUnscoped)}>
              {showUnscoped ? "Hide" : "Show"} {selected.unscoped.length} market-wide events
            </button>
          ) : null}
        </details>
      ) : null}
      {model.defaultStart || rolling ? (
        <p className="control-note">
          {!internal && model.defaultStart
            ? `The chart opens in ${monthLabel(model.defaultStart)}, the first month from which at least ${chartDefaults.mix_default_start.min_categories} groups each held more than ${
                chartDefaults.mix_default_start.min_share * 100
              }% of vehicles over the previous ${TRAILING_MONTHS} months, for ${chartDefaults.mix_default_start.sustain_months} months running. Records start in ${monthLabel(model.full.from)}: choose All records to see them. `
            : ""}
          {!internal && rolling
            ? `Each point is the share over the ${TRAILING_MONTHS} months up to that month, which smooths out month-to-month swings. A point is left blank when any of its ${TRAILING_MONTHS} months is missing from the data.`
            : ""}
          {internal && model.defaultStart
            ? `The default start is the first month with at least ${chartDefaults.mix_default_start.min_categories} categories above ${
                chartDefaults.mix_default_start.min_share * 100
              }% of the trailing ${TRAILING_MONTHS} months, held for ${chartDefaults.mix_default_start.sustain_months} months. Before it the mix has nothing to show and the rest of the chart is squeezed into the right of the frame. Data starts ${monthLabel(
                model.full.from,
              )}. `
            : ""}
          {internal && rolling
            ? `Each point is the trailing ${TRAILING_MONTHS} months' vehicles of this value over the trailing ${TRAILING_MONTHS} months' total, computed in the browser from the monthly counts. A window missing a month is left blank, never filled in.`
            : ""}
        </p>
      ) : null}
    </>
  );
}
