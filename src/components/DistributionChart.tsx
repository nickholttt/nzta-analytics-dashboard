// distribution: an ordered band dimension over the preset's period, in band order from dimensions.json.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo } from "react";
import type { Dimension, Preset } from "../lib/config";
import type { Manifest, SliceRow } from "../lib/data";
import { pct, periodWindow } from "../lib/measures";
import { PlotFigure } from "./PlotFigure";

type Props = { preset: Preset; dimension: Dimension; rows: SliceRow[]; manifest: Manifest; minDenominator: number; label: (v: string) => string };

export function DistributionChart({ preset, dimension, rows, manifest, minDenominator, label }: Props) {
  const model = useMemo(() => {
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const win = periodWindow(preset.period, months[0], manifest.latest_snapshot.slice(0, 7));
    const totals = new Map<string, number>();
    const denominators = new Map<string, number>();
    for (const r of rows) {
      if (r.month < win.from || r.month > win.to) continue;
      totals.set(r.value, (totals.get(r.value) ?? 0) + r.n);
      denominators.set(r.month, r.denominator);
    }
    const denominator = [...denominators.values()].reduce((a, b) => a + b, 0);
    const bandOrder = (dimension.bands ?? []).map((b) => b.label);
    const order = [...bandOrder.filter((b) => totals.has(b)), ...[...totals.keys()].filter((v) => !bandOrder.includes(v)).sort()];
    const share = preset.measure === "share";
    const suppressed = share && denominator < minDenominator;
    const bars = order.map((v) => ({ value: v, y: share ? (totals.get(v) ?? 0) / denominator : totals.get(v) ?? 0 }));
    return { win, order, bars, share, suppressed, denominator };
  }, [rows, preset, dimension, manifest.latest_snapshot, minDenominator]);

  const render = useCallback(
    () =>
      Plot.plot({
        width: 1150,
        height: 380,
        x: { domain: model.order, label: dimension.label, tickFormat: label },
        y: { label: model.share ? "Share" : "Vehicles", grid: true, tickFormat: model.share ? (d: number) => `${Math.round(d * 100)}%` : undefined },
        marks: [
          Plot.barY(model.bars, { x: "value", y: "y", fill: model.suppressed ? "#bdbdbd" : "#4e79a7" }),
          Plot.tip(model.bars, Plot.pointerX({ x: "value", y: "y", title: (b: { value: string; y: number }) => `${label(b.value)}: ${model.share ? pct(b.y) : b.y.toLocaleString()}` })),
        ],
      }),
    [model, dimension.label, label],
  );

  return (
    <>
      <p className="meta">
        {model.win.from} to {model.win.to}, {model.denominator.toLocaleString()} vehicles{model.suppressed ? `, greyed: under ${minDenominator}` : ""}
      </p>
      <PlotFigure render={render} />
    </>
  );
}
