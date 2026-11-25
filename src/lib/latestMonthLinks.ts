// The canvas address that draws a block of the latest month's question (config/latest_month.json, canvas). It is written by the canvas's own
// functions (src/lib/canvas.ts), as a starter canvas's is (src/lib/starters.ts), so the canvas reads it back as any shared link: the dataset, the
// measure, the field and the chart's own settings. The address names no month: a chart of the newest month redraws on each month the site holds,
// and the page it is linked from is rebuilt with the data (CLAUDE.md, how a page reads, point 9).
import { CHART_PARAMS } from "./builder";
import type { Vocabulary } from "./builder";
import { CANVAS_PATH, bestType, canvasParams, draws, nextChartId, settleCanvas, withFittingTypes } from "./canvas";
import type { Canvas } from "./canvas";
import { findPeriod } from "./config";
import type { Manifest } from "./data";

// `where` keeps the question to the values of other fields (the vehicles first registered new, say), as a canvas's own conditions do. `values` names the
// values of the field it is broken down by that the chart is of (a brand and its rivals): a link whose chart would keep other values is withheld.
export type LinkAsk = { dataset: string; measure: string; by: string | null; type: string | null; settings?: Record<string, string>; where?: Record<string, string[]>; values?: string[] };

const sameWhere = (a: Record<string, string[]>, b: Record<string, string[]>) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

// The address of a canvas of one chart that asks this question, or nothing where the canvas would answer another question (a dataset or field this
// build lacks settles to something else) or cannot draw the chart type asked for: a link never opens to a chart that is not the block's. A period the
// canvas does not have (config/dimensions.json, periods) withholds the link, as does a value the settled chart does not keep.
export function latestMonthLink(all: Vocabulary, manifest: Manifest, ask: LinkAsk): string | undefined {
  if (ask.settings?.period !== undefined && findPeriod(ask.settings.period) === undefined) return undefined;
  const id = nextChartId([]);
  const canvas = withFittingTypes(settleCanvas(all, [{ id, asked: { dataset: ask.dataset, measure: ask.measure, by: ask.by, where: ask.where ?? {}, ...(ask.values ? { values: ask.values } : {}) }, type: ask.type, table: false, width: "full" }]), manifest);
  const [chart] = canvas.charts;
  const q = chart.question;
  if (q.dataset !== ask.dataset || q.measure !== ask.measure || q.by !== ask.by || !sameWhere(q.where, ask.where ?? {})) return undefined;
  if (ask.values && JSON.stringify([...q.values].sort()) !== JSON.stringify([...ask.values].sort())) return undefined;
  if (ask.type !== null && chart.type !== ask.type) return undefined;
  if (!draws(q, chart.type ?? bestType(q), manifest)) return undefined;
  const params = canvasParams(canvas);
  for (const [name, value] of Object.entries(ask.settings ?? {})) if (CHART_PARAMS.includes(name)) params.set(`${id}.${name}`, value);
  return `${CANVAS_PATH}?${params}`;
}

// The canvas of one full-width chart of a league of the field, as the canvas settles it for the dataset and measure: what a form's hidden fields are written from.
export function oneChartCanvas(all: Vocabulary, manifest: Manifest, ask: { dataset: string; measure: string; by: string; type: string }): Canvas | undefined {
  const id = nextChartId([]);
  const canvas = withFittingTypes(settleCanvas(all, [{ id, asked: { dataset: ask.dataset, measure: ask.measure, by: ask.by, where: {} }, type: ask.type, table: false, width: "full" }]), manifest);
  const [chart] = canvas.charts;
  return chart && chart.question.dataset === ask.dataset && chart.question.measure === ask.measure && chart.question.by === ask.by && chart.type === ask.type ? canvas : undefined;
}
