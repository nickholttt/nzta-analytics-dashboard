// distribution: an ordered band dimension over the preset's period, in band order from dimensions.json.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo } from "react";
import type { Dimension, Preset } from "../lib/config";
import type { Manifest, SliceRow } from "../lib/data";
import { monthLabel, pct, periodWindow } from "../lib/measures";
import { RULE, RULE_STRONG, SERIES, SUPPRESSED_LINE, chartHeight, plotStyle, tipStyle } from "../lib/theme";
import { PlotFigure } from "./PlotFigure";

type Props = {
  preset: Preset;
  dimension: Dimension;
  rows: SliceRow[];
  manifest: Manifest;
  minDenominator: number;
  label: (v: string) => string;
  lead?: boolean;
};

type Bar = { value: string; y: number };

export function DistributionChart({ preset, dimension, rows, manifest, minDenominator, label, lead = false }: Props) {
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
    const bars: Bar[] = order.map((v) => ({ value: v, y: share ? (totals.get(v) ?? 0) / denominator : totals.get(v) ?? 0 }));
    return { win, order, bars, share, suppressed, denominator };
  }, [rows, preset, dimension, manifest.latest_snapshot, minDenominator]);

  const render = useCallback(
    (width: number) => {
      const format = model.share ? (d: number) => `${Math.round(d * 100)}%` : (d: number) => d.toLocaleString();
      return Plot.plot({
        width,
        height: chartHeight(width, lead),
        marginTop: 16,
        marginLeft: model.share ? 44 : 64,
        marginRight: 16,
        marginBottom: 36,
        style: plotStyle,
        x: { domain: model.order, label: null, padding: 0.3 },
        y: { label: null },
        marks: [
          Plot.gridY({ ticks: 5, stroke: RULE, strokeOpacity: 1 }),
          Plot.axisY({ ticks: 5, tickSize: 0, tickPadding: 6, label: null, tickFormat: format }),
          Plot.axisX({ tickSize: 0, tickPadding: 8, label: null, tickFormat: label }),
          Plot.barY(model.bars, { x: "value", y: "y", fill: model.suppressed ? SUPPRESSED_LINE : SERIES[0], ry2: 3 }),
          Plot.ruleY([0], { stroke: RULE_STRONG }),
          Plot.tip(
            model.bars,
            Plot.pointerX({ x: "value", y: "y", ...tipStyle, title: (b: Bar) => `${label(b.value)}\n${model.share ? pct(b.y) : b.y.toLocaleString()}` }),
          ),
        ],
      });
    },
    [model, label, lead],
  );

  return (
    <>
      <p className="chart-unit">
        {dimension.label} · {model.share ? "share" : "vehicles"}, {monthLabel(model.win.from)} to {monthLabel(model.win.to)} ·{" "}
        {model.denominator.toLocaleString()} vehicles{model.suppressed ? `, greyed: under ${minDenominator}` : ""}
      </p>
      <PlotFigure render={render} />
    </>
  );
}
