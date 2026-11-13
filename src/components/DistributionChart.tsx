// distribution: an ordered band dimension over the preset's period, in band order from dimensions.json.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo } from "react";
import type { Dimension, Preset } from "../lib/config";
import type { Manifest, SliceRow } from "../lib/data";
import { monthLabel, pct, periodWindow } from "../lib/measures";
import { count, readout, spanPeriod } from "../lib/readout";
import { RULE, RULE_STRONG, SERIES, SUPPRESSED_LINE, chartHeight, plotStyle, tipStyle } from "../lib/theme";
import { FiguresTable } from "./FiguresTable";
import { PlotFigure } from "./PlotFigure";

type Props = {
  preset: Preset;
  dimension: Dimension;
  rows: SliceRow[];
  manifest: Manifest;
  minDenominator: number;
  label: (v: string) => string;
  // The breakdown in the words the panel uses for it.
  dimensionLabel?: string;
  lead?: boolean;
};

type Bar = { value: string; y: number; n: number };

export function DistributionChart({ preset, dimension, rows, manifest, minDenominator, label, dimensionLabel, lead = false }: Props) {
  const heading = dimensionLabel ?? dimension.label;
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
    const bars: Bar[] = order.map((v) => {
      const n = totals.get(v) ?? 0;
      return { value: v, y: share ? n / denominator : n, n };
    });
    return { win, order, bars, share, suppressed, denominator };
  }, [rows, preset, dimension, manifest.latest_snapshot, minDenominator]);

  const render = useCallback(
    (width: number) => {
      const format = model.share ? (d: number) => `${Math.round(d * 100)}%` : (d: number) => d.toLocaleString();
      const marginLeft = model.share ? 44 : 64;
      // Every band keeps its bar, but where labels would run into each other only every step-th is labelled, counting
      // from the first band; the readout names each bar. The step is the smallest at which every pair of neighbouring
      // labels clears the other, taking a label as 7px a character, with 6px between.
      const perBand = (width - marginLeft - 16) / Math.max(1, model.order.length);
      const widths = model.order.map((v) => label(v).length * 7);
      const fits = (s: number) => widths.every((w, i) => i % s !== 0 || i + s >= widths.length || s * perBand >= (w + widths[i + s]) / 2 + 6);
      let step = 1;
      while (step < widths.length && !fits(step)) step++;
      return Plot.plot({
        width,
        height: chartHeight(width, lead),
        marginTop: 16,
        marginLeft,
        marginRight: 16,
        marginBottom: 36,
        style: plotStyle,
        x: { domain: model.order, label: null, padding: 0.3 },
        y: { label: null },
        marks: [
          Plot.gridY({ ticks: 5, stroke: RULE, strokeOpacity: 1 }),
          Plot.axisY({ ticks: 5, tickSize: 0, tickPadding: 6, label: null, tickFormat: format }),
          Plot.axisX({ ticks: model.order.filter((_, i) => i % step === 0), tickSize: 0, tickPadding: 8, label: null, tickFormat: label }),
          Plot.barY(model.bars, { x: "value", y: "y", fill: model.suppressed ? SUPPRESSED_LINE : SERIES[0], ry2: 3 }),
          Plot.ruleY([0], { stroke: RULE_STRONG }),
          Plot.tip(
            model.bars,
            Plot.pointerX({
              x: "value",
              y: "y",
              ...tipStyle,
              title: (b: Bar) =>
                readout({
                  name: `${heading}: ${label(b.value)}`,
                  period: spanPeriod(model.win.from, model.win.to),
                  ...(model.share ? { share: b.y, n: b.n, base: model.denominator } : { n: b.n }),
                  greyed: model.suppressed ? "thin" : undefined,
                  minDenominator,
                }),
            }),
          ),
        ],
      });
    },
    [model, label, lead, heading, minDenominator],
  );

  return (
    <>
      <p className="chart-unit">
        {heading} · {model.share ? "share" : "vehicles"}, {monthLabel(model.win.from)} to {monthLabel(model.win.to)} ·{" "}
        {model.denominator.toLocaleString()} vehicles{model.suppressed ? `, greyed: under ${minDenominator}` : ""}
      </p>
      <PlotFigure
        render={render}
        label={`Bar chart, ${spanPeriod(model.win.from, model.win.to)}: the ${model.share ? "share" : "number"} of vehicles by ${heading.toLowerCase()}, one bar for each band.`}
      />
      <FiguresTable
        label={`${heading}: figures, ${spanPeriod(model.win.from, model.win.to)}`}
        columns={[{ name: heading }, ...(model.share ? [{ name: "Share" }] : []), { name: "Still registered" }]}
        rows={() =>
          model.bars.map((b) => [label(b.value), ...(model.share ? [model.suppressed ? "suppressed" : pct(b.y)] : []), count(b.n)])
        }
      />
    </>
  );
}
