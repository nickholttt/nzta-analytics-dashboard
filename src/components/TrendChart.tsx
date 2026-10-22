// trend: a count or 12-month running total over time: for the whole dataset or one value of a dimension, or, for a
// question built on the Build page, one line for each value it compares. Or a derived series the browser computes
// from the slice (docs/METRICS.md).
//
// A derived series is the same shape, not a sixth one, so it renders here rather than in a renderer
// of its own. What it needs beyond a plain count is a unit — a share draws on a percentage axis and
// carries the share guards — and, for a measure whose membership is recomputed every month, a
// per-month selection the count path has no notion of.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo } from "react";
import { findDerived } from "../lib/config";
import type { Preset } from "../lib/config";
import type { Manifest, SliceRow } from "../lib/data";
import { derivedSeries } from "../lib/derived";
import { addMonths, collapsedAgainstTrailingMedian, monthDate, monthLabel, monthRange, pct, periodWindow } from "../lib/measures";
import { count, greyedReason, monthPeriod, readout } from "../lib/readout";
import type { Greyed } from "../lib/readout";
import {
  LINE_WIDTH,
  PAPER,
  RULE,
  RULE_STRONG,
  SERIES,
  SUPPRESSED_BAND,
  SUPPRESSED_LINE,
  THIN_LINE_WIDTH,
  chartHeight,
  plotStyle,
  seriesColour,
  tipStyle,
  xTicks,
} from "../lib/theme";
import { FiguresTable } from "./FiguresTable";
import { PlotFigure } from "./PlotFigure";

const PERCENT = "percent";

type Props = {
  preset: Preset;
  rows: SliceRow[];
  manifest: Manifest;
  minDenominator: number;
  collapseFraction: number;
  lead?: boolean;
  // How a value is named for a reader: reserved tokens in words. Needed only where lines are values.
  label?: (value: string) => string;
};

type Point = {
  month: string;
  date: Date;
  y?: number;
  n?: number;
  denominator?: number;
  suppressed: boolean;
  greyed?: Greyed;
  members?: string[];
};

export function TrendChart(props: Props) {
  const { preset } = props;
  if (!preset.derived && preset.values?.length) return <ValuesTrend {...props} values={preset.values} />;
  return <OneTrend {...props} />;
}

type ValuePoint = { month: string; date: Date; series: string; y?: number };

// One count line per chosen value. Colours go by vehicles in the last 12 months, largest first, the rule the mix chart
// uses for its first slots, so a value shown as a share and as a count wears the same colour in both. A count carries
// no share guard, so nothing is greyed.
function ValuesTrend({ preset, rows, manifest, lead = false, label = (v) => v, values }: Props & { values: string[] }) {
  const rolling = preset.measure === "rolling_12m";
  const model = useMemo(() => {
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const win = periodWindow(preset.period, months[0], manifest.latest_snapshot.slice(0, 7));
    const cell = new Map<string, number>();
    const present = new Set<string>();
    for (const r of rows) {
      cell.set(`${r.month}|${r.value}`, r.n);
      present.add(r.month);
    }
    // A month absent from the data is a gap, never a zero: METRICS.md, never interpolate a missing month.
    const at = (m: string, s: string) => (present.has(m) ? (cell.get(`${m}|${s}`) ?? 0) : undefined);
    const points: ValuePoint[] = [];
    for (const s of values) {
      for (const m of monthRange(win.from, win.to)) {
        let y = at(m, s);
        if (rolling) {
          const trailing = monthRange(addMonths(m, -11), m).map((k) => at(k, s));
          y = trailing.every((v) => v !== undefined) ? trailing.reduce((a, b) => (a as number) + (b as number), 0) : undefined;
        }
        points.push({ month: m, date: monthDate(m), series: s, y });
      }
    }
    const latest = manifest.latest_snapshot.slice(0, 7);
    const lastYear = monthRange(addMonths(latest, -11), latest);
    const totals = values.map((s) => ({ series: s, n: lastYear.reduce((sum, m) => sum + (at(m, s) ?? 0), 0) }));
    return { win, points, totals };
  }, [rows, preset.period, manifest.latest_snapshot, values, rolling]);

  const colour = useCallback(
    (s: string) => seriesColour([...model.totals].sort((a, b) => b.n - a.n).findIndex((t) => t.series === s)),
    [model.totals],
  );

  const render = useCallback(
    (width: number) => {
      const yMax = Math.max(1, ...model.points.map((p) => p.y ?? 0)) * 1.05;
      const drawn = model.points.filter((p) => p.y !== undefined);
      return Plot.plot({
        width,
        height: chartHeight(width, lead),
        marginTop: 16,
        marginLeft: 56,
        marginRight: 16,
        marginBottom: 28,
        style: plotStyle,
        x: { type: "utc", label: null, domain: [monthDate(model.win.from), monthDate(addMonths(model.win.to, 1))] },
        y: { label: null, domain: [0, yMax] },
        color: { domain: values, range: values.map(colour) },
        marks: [
          Plot.gridY({ ticks: 5, stroke: RULE, strokeOpacity: 1 }),
          Plot.axisY({ ticks: 5, tickSize: 0, tickPadding: 6, label: null, tickFormat: (d: number) => d.toLocaleString() }),
          Plot.axisX({ ticks: xTicks(width), tickSize: 4, stroke: RULE_STRONG, label: null }),
          Plot.ruleY([0], { stroke: RULE_STRONG }),
          Plot.lineY(model.points, { x: "date", y: "y", z: "series", stroke: "series", strokeWidth: LINE_WIDTH, strokeLinejoin: "round", strokeLinecap: "round" }),
          Plot.ruleX(drawn, Plot.pointerX({ x: "date", stroke: RULE_STRONG })),
          Plot.dot(drawn, Plot.pointer({ x: "date", y: "y", r: 4, fill: "series", stroke: PAPER, strokeWidth: 1.5 })),
          Plot.tip(
            drawn,
            Plot.pointer({
              x: "date",
              y: "y",
              ...tipStyle,
              title: (p: ValuePoint) => readout({ name: label(p.series), period: monthPeriod(p.month, rolling), n: p.y }),
            }),
          ),
        ],
      });
    },
    [model, lead, values, colour, label, rolling],
  );

  const names = values.map(label).join(", ");
  return (
    <>
      <ul className="series-key" aria-label="Lines on this chart, with vehicles in the last 12 months">
        {model.totals.map((t) => (
          <li key={t.series}>
            <span className="swatch" style={{ background: colour(t.series) }} aria-hidden="true" />
            {label(t.series)} <span className="series-key-figure">{count(t.n)} in the last 12 months</span>
          </li>
        ))}
      </ul>
      <p className="chart-unit">{rolling ? "Vehicles, 12-month running total" : "Vehicles a month"}</p>
      <PlotFigure
        render={render}
        label={`Line chart, ${monthLabel(model.win.from)} to ${monthLabel(model.win.to)}: vehicles for ${names}, month by month.`}
      />
      <FiguresTable
        label={`Vehicles for ${names}: figures, ${monthLabel(model.win.from)} to ${monthLabel(model.win.to)}`}
        columns={[{ name: "Month" }, ...values.map((s) => ({ name: label(s) }))]}
        rows={() => {
          const y = new Map(model.points.map((p) => [`${p.month}|${p.series}`, p.y]));
          return monthRange(model.win.from, model.win.to).flatMap((m) => {
            const cells = values.map((s) => y.get(`${m}|${s}`));
            return cells.every((v) => v === undefined) ? [] : [[monthPeriod(m, rolling), ...cells.map((v) => (v === undefined ? "" : count(v)))]];
          });
        }}
      />
    </>
  );
}

function OneTrend({ preset, rows, manifest, minDenominator, collapseFraction, lead = false }: Props) {
  const derived = preset.derived ? findDerived(preset.derived) : undefined;
  const share = derived?.unit === PERCENT;
  // What the line is, for its readout: a derived measure by its definition's own words, otherwise the vehicles counted.
  const filtered = Object.values(preset.where ?? {}).some((kept) => kept.length > 0);
  const name = derived
    ? derived.label.charAt(0).toUpperCase() + derived.label.slice(1)
    : (preset.filter_value ?? (filtered ? "Vehicles that match" : "All vehicles"));

  const model = useMemo(() => {
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const win = periodWindow(preset.period, months[0], manifest.latest_snapshot.slice(0, 7));
    const denominators = new Map<string, number>();
    for (const r of rows) denominators.set(r.month, r.denominator);
    const denominatorFor = (m: string) => denominators.get(m);

    const byMonth = new Map<string, number>();
    const detail = new Map<string, string[]>();
    const counts = new Map<string, number>();
    const series = preset.derived ? derivedSeries(preset.derived, rows) : undefined;
    if (series) {
      for (const p of series) {
        if (p.value !== undefined) byMonth.set(p.month, p.value);
        detail.set(p.month, p.members);
        counts.set(p.month, p.n);
      }
    } else {
      for (const r of rows) {
        if (preset.filter_value !== undefined) {
          if (r.value === preset.filter_value) byMonth.set(r.month, r.n);
        } else byMonth.set(r.month, r.denominator);
      }
    }

    const points: Point[] = [];
    const bands: { x1: Date; x2: Date }[] = [];
    let runStart: string | null = null;
    for (const m of monthRange(win.from, win.to)) {
      let y = byMonth.get(m);
      if (preset.measure === "rolling_12m") {
        const trailing = monthRange(addMonths(m, -11), m).map((k) => byMonth.get(k));
        // A running total needs all 12 months; a missing month leaves a gap, never an interpolation.
        y = trailing.every((v) => v !== undefined) ? trailing.reduce((a, b) => (a as number) + (b as number), 0) : undefined;
      }
      // A share carries both guards; a count is a count and carries neither.
      const den = denominatorFor(m);
      const greyed: Greyed | undefined =
        !share || den === undefined
          ? undefined
          : den < minDenominator
            ? "thin"
            : collapsedAgainstTrailingMedian(m, denominatorFor, collapseFraction)
              ? "collapsed"
              : undefined;
      const suppressed = greyed !== undefined;
      if (suppressed && runStart === null) runStart = m;
      if (!suppressed && runStart !== null) {
        bands.push({ x1: monthDate(runStart), x2: monthDate(m) });
        runStart = null;
      }
      points.push({ month: m, date: monthDate(m), y, n: counts.get(m), denominator: den, suppressed, greyed, members: detail.get(m) });
    }
    if (runStart !== null) bands.push({ x1: monthDate(runStart), x2: monthDate(addMonths(win.to, 1)) });
    return { win, points, bands };
  }, [rows, preset, manifest.latest_snapshot, share, minDenominator, collapseFraction]);

  const render = useCallback(
    (width: number) => {
      const top = Math.max(0.01, ...model.points.map((p) => p.y ?? 0));
      const yMax = share ? Math.min(1, top * 1.05) : top * 1.05;
      const format = share ? (d: number) => `${Math.round(d * 100)}%` : (d: number) => d.toLocaleString();
      return Plot.plot({
        width,
        height: chartHeight(width, lead),
        marginTop: 16,
        marginLeft: share ? 44 : 56,
        marginRight: 16,
        marginBottom: 28,
        style: plotStyle,
        x: { type: "utc", label: null, domain: [monthDate(model.win.from), monthDate(addMonths(model.win.to, 1))] },
        y: { label: null, domain: [0, yMax] },
        marks: [
          Plot.rect(model.bands.map((b) => ({ ...b, y1: 0, y2: yMax })), { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: SUPPRESSED_BAND }),
          Plot.gridY({ ticks: 5, stroke: RULE, strokeOpacity: 1 }),
          Plot.axisY({ ticks: 5, tickSize: 0, tickPadding: 6, label: null, tickFormat: format }),
          Plot.axisX({ ticks: xTicks(width), tickSize: 4, stroke: RULE_STRONG, label: null }),
          Plot.ruleY([0], { stroke: RULE_STRONG }),
          Plot.lineY(model.points, { x: "date", y: "y", stroke: SUPPRESSED_LINE, strokeWidth: THIN_LINE_WIDTH }),
          Plot.lineY(
            model.points.map((p) => (p.suppressed ? { ...p, y: undefined } : p)),
            { x: "date", y: "y", stroke: SERIES[0], strokeWidth: LINE_WIDTH, strokeLinejoin: "round", strokeLinecap: "round" },
          ),
          Plot.ruleX(model.points, Plot.pointerX({ x: "date", stroke: RULE_STRONG })),
          Plot.dot(
            model.points.filter((p) => p.y !== undefined),
            Plot.pointerX({ x: "date", y: "y", r: 4, fill: SERIES[0], stroke: PAPER, strokeWidth: 1.5 }),
          ),
          Plot.tip(
            model.points.filter((p) => p.y !== undefined),
            Plot.pointerX({
              x: "date",
              y: "y",
              ...tipStyle,
              title: (p: Point) =>
                readout({
                  name,
                  period: monthPeriod(p.month, preset.measure === "rolling_12m"),
                  ...(share ? { share: p.y, n: p.n, base: p.denominator } : { n: p.y }),
                  greyed: p.greyed,
                  minDenominator,
                  extra: p.members?.length ? [`The ${p.members.length} largest: ${p.members.join(", ")}`] : undefined,
                }),
            }),
          ),
        ],
      });
    },
    [model, share, lead, name, preset.measure, minDenominator],
  );

  return (
    <>
      <p className="chart-unit">{share ? "Share of the month's vehicles" : "Vehicles"}</p>
      <PlotFigure
        render={render}
        label={`Line chart, ${monthLabel(model.win.from)} to ${monthLabel(model.win.to)}: ${derived ? derived.label : name.toLowerCase()}, month by month.`}
      />
      <FiguresTable
        label={`${name}: figures, ${monthLabel(model.win.from)} to ${monthLabel(model.win.to)}`}
        columns={share ? [{ name: "Month" }, { name: "Share" }, { name: "Vehicles" }, { name: "Note", text: true }] : [{ name: "Month" }, { name: "Vehicles" }]}
        rows={() =>
          model.points
            .filter((p) => p.y !== undefined)
            .map((p) => {
              const month = monthPeriod(p.month, preset.measure === "rolling_12m");
              if (!share) return [month, count(p.y as number)];
              const vehicles = p.n !== undefined && p.denominator !== undefined ? `${count(p.n)} of ${count(p.denominator)}` : "";
              return [month, pct(p.y as number), vehicles, greyedReason(p.greyed, minDenominator)];
            })
        }
      />
    </>
  );
}
