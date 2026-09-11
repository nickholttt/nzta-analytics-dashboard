// trend: a count or 12-month running total over time, for the whole dataset or one value of a dimension.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo } from "react";
import type { Preset } from "../lib/config";
import type { Manifest, SliceRow } from "../lib/data";
import { addMonths, monthDate, monthRange, periodWindow } from "../lib/measures";
import { PlotFigure } from "./PlotFigure";

type Props = { preset: Preset; rows: SliceRow[]; manifest: Manifest };

export function TrendChart({ preset, rows, manifest }: Props) {
  const points = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const r of rows) {
      if (preset.filter_value !== undefined) {
        if (r.value === preset.filter_value) byMonth.set(r.month, r.n);
      } else byMonth.set(r.month, r.denominator);
    }
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const win = periodWindow(preset.period, months[0], manifest.latest_snapshot.slice(0, 7));
    return monthRange(win.from, win.to).map((m) => {
      let y = byMonth.get(m);
      if (preset.measure === "rolling_12m") {
        const trailing = monthRange(addMonths(m, -11), m).map((k) => byMonth.get(k));
        // A running total needs all 12 months; a missing month leaves a gap, never an interpolation.
        y = trailing.every((v) => v !== undefined) ? trailing.reduce((a, b) => (a as number) + (b as number), 0) : undefined;
      }
      return { date: monthDate(m), y };
    });
  }, [rows, preset, manifest.latest_snapshot]);

  const render = useCallback(
    () =>
      Plot.plot({
        width: 1150,
        height: 380,
        x: { type: "utc", label: null },
        y: { label: "Vehicles", grid: true },
        marks: [Plot.lineY(points, { x: "date", y: "y", stroke: "#4e79a7" }), Plot.tip(points, Plot.pointerX({ x: "date", y: "y" }))],
      }),
    [points],
  );
  return <PlotFigure render={render} />;
}
