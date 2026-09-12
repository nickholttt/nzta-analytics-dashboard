// trend: one line over time. A count or 12-month running total for the whole dataset or one value of
// a dimension, or a derived series the browser computes from the slice (docs/METRICS.md).
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
import { addMonths, collapsedAgainstTrailingMedian, monthDate, monthRange, pct, periodWindow } from "../lib/measures";
import { PlotFigure } from "./PlotFigure";

const LINE = "#4e79a7";
const GREY_LINE = "#bdbdbd";
const GREY_BAND = "#ececec";
const PERCENT = "percent";

type Props = { preset: Preset; rows: SliceRow[]; manifest: Manifest; minDenominator: number; collapseFraction: number };

type Point = { month: string; date: Date; y?: number; suppressed: boolean; denominator?: number; members?: string[] };

export function TrendChart({ preset, rows, manifest, minDenominator, collapseFraction }: Props) {
  const derived = preset.derived ? findDerived(preset.derived) : undefined;
  const share = derived?.unit === PERCENT;

  const model = useMemo(() => {
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const win = periodWindow(preset.period, months[0], manifest.latest_snapshot.slice(0, 7));
    const denominators = new Map<string, number>();
    for (const r of rows) denominators.set(r.month, r.denominator);
    const denominatorFor = (m: string) => denominators.get(m);

    const byMonth = new Map<string, number>();
    const detail = new Map<string, string[]>();
    const series = preset.derived ? derivedSeries(preset.derived, rows) : undefined;
    if (series) {
      for (const p of series) {
        if (p.value !== undefined) byMonth.set(p.month, p.value);
        detail.set(p.month, p.members);
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
      const suppressed =
        share && den !== undefined && (den < minDenominator || collapsedAgainstTrailingMedian(m, denominatorFor, collapseFraction));
      if (suppressed && runStart === null) runStart = m;
      if (!suppressed && runStart !== null) {
        bands.push({ x1: monthDate(runStart), x2: monthDate(m) });
        runStart = null;
      }
      points.push({ month: m, date: monthDate(m), y, suppressed, denominator: den, members: detail.get(m) });
    }
    if (runStart !== null) bands.push({ x1: monthDate(runStart), x2: monthDate(addMonths(win.to, 1)) });
    return { win, points, bands };
  }, [rows, preset, manifest.latest_snapshot, share, minDenominator, collapseFraction]);

  const render = useCallback(() => {
    const top = Math.max(0.01, ...model.points.map((p) => p.y ?? 0));
    const yMax = share ? Math.min(1, top * 1.05) : top * 1.05;
    return Plot.plot({
      width: 1150,
      height: 380,
      x: { type: "utc", label: null, domain: [monthDate(model.win.from), monthDate(addMonths(model.win.to, 1))] },
      y: {
        label: share ? "Share of the month's vehicles" : "Vehicles",
        grid: true,
        domain: [0, yMax],
        tickFormat: share ? (d: number) => `${Math.round(d * 100)}%` : undefined,
      },
      marks: [
        Plot.rect(model.bands.map((b) => ({ ...b, y1: 0, y2: yMax })), { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: GREY_BAND }),
        Plot.lineY(model.points, { x: "date", y: "y", stroke: GREY_LINE, strokeWidth: 1.2 }),
        Plot.lineY(
          model.points.map((p) => (p.suppressed ? { ...p, y: undefined } : p)),
          { x: "date", y: "y", stroke: LINE, strokeWidth: 1.7 },
        ),
        Plot.tip(
          model.points.filter((p) => p.y !== undefined),
          Plot.pointerX({
            x: "date",
            y: "y",
            title: (p: Point) =>
              [
                `${p.month}: ${share ? pct(p.y as number) : (p.y as number).toLocaleString()}`,
                p.members?.length ? p.members.join(", ") : null,
                p.suppressed ? `greyed: ${p.denominator} vehicles behind this figure` : null,
              ]
                .filter(Boolean)
                .join("\n"),
          }),
        ),
      ],
    });
  }, [model, share]);

  return <PlotFigure render={render} />;
}
