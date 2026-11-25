// The canvas address that draws a block of the latest month's question (config/latest_month.json, canvas). It is written by the canvas's own
// functions (src/lib/canvas.ts), as a starter canvas's is (src/lib/starters.ts), so the canvas reads it back as any shared link: the dataset, the
// measure, the field and the chart's own settings. The address names no month: a chart of the newest month redraws on each month the site holds,
// and the page it is linked from is rebuilt with the data (CLAUDE.md, how a page reads, point 9).
import { CHART_PARAMS } from "./builder";
import type { Vocabulary } from "./builder";
import { CANVAS_PATH, bestType, canvasParams, draws, nextChartId, settleCanvas, withFittingTypes } from "./canvas";
import type { Manifest } from "./data";

export type LinkAsk = { dataset: string; measure: string; by: string | null; type: string | null; settings?: Record<string, string> };

// The address of a canvas of one chart that asks this question, or nothing where the canvas would answer another question (a dataset or field this
// build lacks settles to something else) or cannot draw the chart type asked for: a link never opens to a chart that is not the block's.
export function latestMonthLink(all: Vocabulary, manifest: Manifest, ask: LinkAsk): string | undefined {
  const id = nextChartId([]);
  const canvas = withFittingTypes(settleCanvas(all, [{ id, asked: { dataset: ask.dataset, measure: ask.measure, by: ask.by, where: {} }, type: ask.type, table: false, width: "full" }]), manifest);
  const [chart] = canvas.charts;
  const q = chart.question;
  if (q.dataset !== ask.dataset || q.measure !== ask.measure || q.by !== ask.by) return undefined;
  if (ask.type !== null && chart.type !== ask.type) return undefined;
  if (!draws(q, chart.type ?? bestType(q), manifest)) return undefined;
  const params = canvasParams(canvas);
  for (const [name, value] of Object.entries(ask.settings ?? {})) if (CHART_PARAMS.includes(name)) params.set(`${id}.${name}`, value);
  return `${CANVAS_PATH}?${params}`;
}
