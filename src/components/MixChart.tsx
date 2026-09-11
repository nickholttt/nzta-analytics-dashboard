// mix: share of each value per month, as lines. Months under the share guard are greyed, not hidden.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo, useState } from "react";
import type { Preset } from "../lib/config";
import type { Event, Manifest, SliceRow } from "../lib/data";
import { markersFor, selectEvents } from "../lib/events";
import { addMonths, monthDate, monthRange, pct, periodWindow, shareChange, windowShare } from "../lib/measures";
import { EventList } from "./EventList";
import { PlotFigure } from "./PlotFigure";

const ALL_OTHER = "All other";
const PALETTE = ["#4e79a7", "#f28e2c", "#e15759", "#76b7b2", "#59a14f", "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#17becf"];
const OTHER_COLOUR = "#444";
const GREY_LINE = "#bdbdbd";
const GREY_BAND = "#ececec";

const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");

type Point = { month: string; date: Date; series: string; share?: number; suppressed: boolean; denominator?: number };

type Props = {
  preset: Preset;
  dimensionId: string;
  rows: SliceRow[];
  manifest: Manifest;
  events: Event[] | null;
  minDenominator: number;
  label: (value: string) => string;
};

export function MixChart({ preset, dimensionId, rows, manifest, events, minDenominator, label }: Props) {
  const [showUnscoped, setShowUnscoped] = useState(false);
  const latest = manifest.latest_snapshot.slice(0, 7);

  const model = useMemo(() => {
    const cell = new Map<string, number>();
    const denominators = new Map<string, number>();
    for (const r of rows) {
      cell.set(`${r.month}|${r.value}`, r.n);
      denominators.set(r.month, r.denominator);
    }
    const monthsPresent = [...denominators.keys()].sort();
    const win = periodWindow(preset.period, monthsPresent[0], latest);

    const totals = new Map<string, number>();
    for (const r of rows) if (r.month >= win.from && r.month <= win.to) totals.set(r.value, (totals.get(r.value) ?? 0) + r.n);
    const ranked = [...totals.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([v]) => v);
    // top_n ranks by vehicles over the chart's period; reserved tokens never take a place and fall into the remainder.
    const kept = preset.top_n ? ranked.filter((v) => !isReserved(v)).slice(0, preset.top_n) : ranked;
    const series = preset.top_n ? [...kept, ALL_OTHER] : kept;

    const nFor = (month: string, s: string) => {
      const den = denominators.get(month);
      if (den === undefined) return undefined;
      if (s !== ALL_OTHER) return cell.get(`${month}|${s}`) ?? 0;
      return den - kept.reduce((sum, k) => sum + (cell.get(`${month}|${k}`) ?? 0), 0);
    };

    const points: Point[] = [];
    const bands: { x1: Date; x2: Date; y1: number; y2: number }[] = [];
    let runStart: string | null = null;
    const months = monthRange(win.from, win.to);
    for (const m of months) {
      const den = denominators.get(m);
      const suppressed = den !== undefined && den < minDenominator;
      if (suppressed && runStart === null) runStart = m;
      if (!suppressed && runStart !== null) {
        bands.push({ x1: monthDate(runStart), x2: monthDate(m), y1: 0, y2: 1 });
        runStart = null;
      }
      for (const s of series) {
        const n = nFor(m, s);
        points.push({ month: m, date: monthDate(m), series: s, share: n === undefined || !den ? undefined : n / den, suppressed, denominator: den });
      }
    }
    if (runStart !== null) bands.push({ x1: monthDate(runStart), x2: monthDate(addMonths(win.to, 1)), y1: 0, y2: 1 });

    const summary = series.map((s) => {
      const now = windowShare(addMonths(latest, -11), latest, (m) => nFor(m, s), (m) => denominators.get(m));
      const before = windowShare(addMonths(latest, -23), addMonths(latest, -12), (m) => nFor(m, s), (m) => denominators.get(m));
      return { series: s, now, before };
    });
    return { win, series, points, bands, summary, categories: new Set(ranked) };
  }, [rows, preset, latest, minDenominator]);

  const selected = useMemo(
    () => (preset.events && events ? selectEvents(events, dimensionId, model.categories, `${model.win.from}-01`, manifest.latest_snapshot) : null),
    [events, preset.events, dimensionId, model, manifest.latest_snapshot],
  );
  const markers = useMemo(
    () => (selected ? markersFor(showUnscoped ? [...selected.scoped, ...selected.unscoped] : selected.scoped) : []),
    [selected, showUnscoped],
  );

  const colour = (s: string, i: number) => (s === ALL_OTHER ? OTHER_COLOUR : PALETTE[i % PALETTE.length]);

  const render = useCallback(() => {
    const yMax = Math.min(1, Math.max(0.05, ...model.points.map((p) => p.share ?? 0)) * 1.05);
    const bands = model.bands.map((b) => ({ ...b, y2: yMax }));
    const windowed = markers.filter((m) => m.dateEnd).map((m) => ({ x1: new Date(m.date), x2: new Date(m.dateEnd as string), y1: 0, y2: yMax }));
    const pins = markers.map((m) => ({ ...m, x: new Date(m.date) }));
    const announced = markers.flatMap((m) => m.events.filter((e) => e.announced_date).map((e) => ({ x: new Date(e.announced_date as string) })));
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
      height: 480,
      marginTop: 28,
      marginRight: 190,
      x: { type: "utc", label: null, domain: [monthDate(model.win.from), monthDate(addMonths(model.win.to, 1))] },
      y: { label: "Share of the month's vehicles", domain: [0, yMax], grid: true, tickFormat: (d: number) => `${Math.round(d * 100)}%` },
      color: { domain: model.series, range: model.series.map(colour) },
      marks: [
        Plot.rect(bands, { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: GREY_BAND }),
        Plot.rect(windowed, { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: "#f5c26b", fillOpacity: 0.22 }),
        Plot.ruleX(announced, { x: "x", stroke: "#777", strokeOpacity: 0.35 }),
        Plot.ruleX(pins.filter((p) => !p.measurement), { x: "x", stroke: "#222", strokeOpacity: 0.7 }),
        Plot.ruleX(pins.filter((p) => p.measurement), { x: "x", stroke: "#b03", strokeDasharray: "4,3" }),
        Plot.text(pins, { x: "x", y: yMax, text: "label", dy: -10, fontWeight: "bold" }),
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
              `${label(p.series)}\n${p.month}: ${pct(p.share as number)}${p.suppressed ? `\ngreyed: ${p.denominator} vehicles in the month, under ${minDenominator}` : ""}`,
          }),
        ),
      ],
    });
  }, [model, markers, label, minDenominator]);

  return (
    <>
      <PlotFigure render={render} />
      <table className="summary">
        <thead>
          <tr>
            <th />
            <th>Last 12 months</th>
            <th>Change on the 12 months before</th>
          </tr>
        </thead>
        <tbody>
          {model.summary.map(({ series, now, before }, i) => {
            const nowOk = now.denominator >= minDenominator;
            const beforeOk = before.denominator >= minDenominator;
            return (
              <tr key={series}>
                <td>
                  <span className="swatch" style={{ background: colour(series, i) }} /> {label(series)}
                </td>
                <td>{nowOk ? pct(now.n / now.denominator) : "suppressed"}</td>
                <td>{nowOk && beforeOk ? shareChange(now.n / now.denominator - before.n / before.denominator) : "suppressed"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {selected ? (
        <div className="events-block">
          <EventList markers={markers} />
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
