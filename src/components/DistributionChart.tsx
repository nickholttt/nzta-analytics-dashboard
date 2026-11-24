// distribution: an ordered band dimension over the preset's period, in band order from dimensions.json.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo } from "react";
import { datasetWords, findDataset, lowerLabel } from "../lib/config";
import type { Dimension, Preset } from "../lib/config";
import type { Manifest, SliceRow } from "../lib/data";
import { monthLabel, pct, periodWindow } from "../lib/measures";
import { groupsSentence, isReservedValue, periodPhrase } from "../lib/chartSentence";
import { chartSentences } from "../lib/chartWords";
import { countedText } from "../lib/sentences";
import { latestMonthOf } from "../lib/resolve";
import { count, readout, spanPeriod, withheldThin } from "../lib/readout";
import type { Cell } from "../lib/figures";
import { BAR_RADIUS, FONT_TEXT, chartHeight, plotStyle, tipStyle } from "../lib/theme";
import { usePalette } from "../lib/useTheme";
import { ChartSentence } from "./ChartSentence";
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

// How the labels under the bars are laid out. Every bar keeps its label: they wrap to two lines at the chart's own size, then
// the type shrinks to 11 px, and only then do alternate labels drop to a second row so each has two bars' width. A label is never left out.
const LABEL_LINE = 13;
const LABEL_SIZES = [12, 11];
function labelLayout(names: string[], room: number) {
  const context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  const lines = (name: string, size: number, cap: number) => {
    if (context) context.font = `${size}px ${FONT_TEXT}`;
    const width = (s: string) => (context ? context.measureText(s).width : (s.length * size * 7) / 12);
    const rows: string[] = [];
    for (const word of name.split(" ")) {
      const last = rows.length - 1;
      if (last >= 0 && width(`${rows[last]} ${word}`) <= cap) rows[last] = `${rows[last]} ${word}`;
      else rows.push(word);
    }
    return { count: rows.length, widest: Math.max(...rows.map(width)) };
  };
  const tries = [...LABEL_SIZES.map((size) => ({ size, stagger: false })), { size: LABEL_SIZES[LABEL_SIZES.length - 1], stagger: true }];
  const fitting = (t: { size: number; stagger: boolean }) => {
    const cap = room * (t.stagger ? 2 : 1) - 6;
    return names.every((n) => {
      const l = lines(n, t.size, cap);
      return l.count <= 2 && l.widest <= cap;
    });
  };
  const chosen = tries.find(fitting) ?? tries[tries.length - 1];
  return { ...chosen, cap: room * (chosen.stagger ? 2 : 1) - 6 };
}

export function DistributionChart({ preset, dimension, rows, manifest, minDenominator, label, dimensionLabel, lead = false }: Props) {
  const pal = usePalette();
  const heading = dimensionLabel ?? dimension.label;
  const model = useMemo(() => {
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const win = periodWindow(preset.period, months[0], latestMonthOf(preset, manifest));
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
  }, [rows, preset, dimension, manifest, minDenominator]);

  const render = useCallback(
    (width: number) => {
      const format = model.share ? (d: number) => `${Math.round(d * 100)}%` : (d: number) => d.toLocaleString();
      const marginLeft = model.share ? 44 : 64;
      const perBand = (width - marginLeft - 16) / Math.max(1, model.order.length);
      const names = model.order.map((v) => label(v));
      const layout = labelLayout(names, perBand);
      const rowsUnder = layout.stagger ? 2 : 1;
      const labels = (offset: number, parity: number) => {
        const mine = model.order.filter((_, i) => i % rowsUnder === parity);
        return Plot.text(mine, {
          x: (v: string) => v,
          frameAnchor: "bottom",
          dy: offset,
          text: (v: string) => label(v),
          lineWidth: layout.cap / layout.size,
          lineAnchor: "top",
          textAnchor: "middle",
          fontSize: layout.size,
          fill: pal.ink3,
        });
      };
      return Plot.plot({
        width,
        height: chartHeight(width, lead),
        marginTop: 16,
        marginLeft,
        marginRight: 16,
        marginBottom: 14 + LABEL_LINE * 2 * rowsUnder,
        style: plotStyle(pal),
        x: { domain: model.order, label: null, padding: 0.3, axis: null },
        y: { label: null },
        marks: [
          Plot.gridY({ ticks: 5, stroke: pal.rule, strokeOpacity: 1 }),
          Plot.axisY({ ticks: 5, tickSize: 0, tickPadding: 6, label: null, tickFormat: format }),
          ...(layout.stagger ? [labels(8, 0), labels(8 + LABEL_LINE * 2 + 2, 1)] : [labels(8, 0)]),
          Plot.barY(model.bars, { x: "value", y: "y", fill: model.suppressed ? pal.suppressedLine : pal.series[0], ry2: BAR_RADIUS }),
          Plot.ruleY([0], { stroke: pal.ruleStrong }),
          Plot.tip(
            model.bars,
            Plot.pointerX({
              x: "value",
              y: "y",
              ...tipStyle(pal),
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
    [model, label, lead, heading, minDenominator, pal],
  );

  // The chart's sentence: the band that holds the most vehicles, and its share or count as the chart gives it. A share the chart withholds
  // (too few vehicles behind it) is not stated, and a band that stands for vehicles with no value is no competitor for first.
  const words = datasetWords(preset.dataset);
  const period = findDataset(preset.dataset)?.single_period && words?.window_one ? words.window_one : periodPhrase(chartSentences, model.win.from, model.win.to);
  const sentence = period
    ? groupsSentence(
        chartSentences,
        model.bars.map((b) => ({
          name: label(b.value),
          n: b.n,
          share: model.share && !model.suppressed ? b.y : undefined,
          skip: isReservedValue(b.value) || Boolean(dimension.bands?.find((band) => band.label === b.value)?.unknown),
        })),
        model.share ? "share" : "count",
        { field: lowerLabel(heading), period, counted: (n) => countedText(words?.leader_count, n, period) },
        { share: pct },
      )
    : undefined;

  return (
    <>
      <p className="chart-unit">
        {heading} · {model.share ? "share" : "vehicles"}, {monthLabel(model.win.from)} to {monthLabel(model.win.to)} ·{" "}
        {model.denominator.toLocaleString()} vehicles{model.suppressed ? `, greyed: under ${minDenominator}` : ""}
      </p>
      <PlotFigure
        render={render}
        label={`Bar chart, ${spanPeriod(model.win.from, model.win.to)}: the ${model.share ? "share" : "number"} of vehicles by ${lowerLabel(heading)}, one bar for each band.`}
      />
      <ChartSentence text={sentence} />
      <FiguresTable
        label={`${heading}: figures, ${spanPeriod(model.win.from, model.win.to)}`}
        period={spanPeriod(model.win.from, model.win.to)}
        columns={[
          { name: heading },
          ...(model.share ? [{ name: "Share", unit: "percent" as const }] : []),
          { name: datasetWords(preset.dataset)?.count_heading ?? "Vehicles", unit: "count" as const },
        ]}
        rows={() =>
          model.bars.map((b): Cell[] => [
            label(b.value),
            ...(model.share ? [model.suppressed ? withheldThin(minDenominator) : pct(b.y)] : []),
            count(b.n),
          ])
        }
      />
    </>
  );
}
