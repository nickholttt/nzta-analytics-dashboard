// The starter canvases (config/starter_canvases.json): ready-made canvases a visitor opens and changes. A starter is a canvas link. Its
// charts are asked as any chart of a shared canvas is (the Build question, a chart type, a width, the chart's own settings), settled by
// the same reading code (src/lib/canvas.ts) and written to the address by the same writer, so a starter opens through no path of its
// own. This module is pure: it names no field, measure, dataset or value; config does.
import startersDoc from "../../config/starter_canvases.json";
import { CHART_PARAMS } from "./builder";
import type { Question, Vocabulary } from "./builder";
import { bestType, canvasParams, chartPreset, draws, nextChartId, settleCanvas } from "./canvas";
import type { AskedChart, Canvas, Width } from "./canvas";
import type { Manifest } from "./data";

export type StarterChart = {
  // The Explore preset this chart stands for.
  from: string;
  dataset: string;
  measure: string;
  by: string | null;
  by2?: string;
  where?: Record<string, string[]>;
  // The chart type, or null for the best fit.
  type: string | null;
  width: Width;
  // The chart's own settings in the address: a time range, how a grid's cells are counted (builder.CHART_PARAMS).
  settings?: Record<string, string>;
};
export type Starter = { id: string; title: string; description: string; charts: StarterChart[] };
export const starters = (startersDoc as unknown as { starters: Starter[] }).starters;

// What a starter's chart asks of the canvas, under the id the chart will have on the canvas.
const asked = (chart: StarterChart, id: string): AskedChart => ({
  id,
  asked: { dataset: chart.dataset, measure: chart.measure, by: chart.by, ...(chart.by2 ? { by2: chart.by2 } : {}), where: structuredClone(chart.where ?? {}) },
  type: chart.type,
  table: false,
  width: chart.width,
});

const idsOf = (count: number): string[] => {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) ids.push(nextChartId(ids.map((id) => ({ id }))));
  return ids;
};

// The canvas a list of a starter's charts opens as, the charts numbered from one in the order given.
export const startCanvas = (all: Vocabulary, charts: readonly StarterChart[]): Canvas => {
  const ids = idsOf(charts.length);
  return settleCanvas(all, charts.map((c, i) => asked(c, ids[i])));
};

// The address of the canvas, without its leading mark: exactly what the canvas writes back for it, with each chart's own settings.
export function startParams(all: Vocabulary, charts: readonly StarterChart[]): URLSearchParams {
  const params = canvasParams(startCanvas(all, charts));
  const ids = idsOf(charts.length);
  charts.forEach((chart, i) => {
    for (const [name, value] of Object.entries(chart.settings ?? {})) if (CHART_PARAMS.includes(name)) params.set(`${ids[i]}.${name}`, value);
  });
  return params;
}

// Whether the canvas gives the chart exactly as the starter asks it: the dataset, measure and breakdowns are the ones named (a dataset this
// build lacks settles to another), and the build draws it as the type it opens as.
export function holds(all: Vocabulary, chart: StarterChart, manifest: Manifest): boolean {
  const [made] = startCanvas(all, [chart]).charts;
  const q: Question = made.question;
  const same = q.dataset === chart.dataset && q.measure === chart.measure && q.by === chart.by && (q.by2 ?? null) === (chart.by2 ?? null);
  return same && draws(q, made.type ?? bestType(q), manifest);
}

// A starter as the list shows it: its words, the title of each chart it holds, and its link. A chart this build cannot draw is left out of
// it, and a starter left with no chart is not listed.
export type StarterView = { id: string; title: string; description: string; charts: string[]; href: string };
export function starterViews(all: Vocabulary, manifest: Manifest, path: string): StarterView[] {
  return starters.flatMap((starter) => {
    const charts = starter.charts.filter((c) => holds(all, c, manifest));
    if (charts.length === 0) return [];
    const canvas = startCanvas(all, charts);
    return [{ id: starter.id, title: starter.title, description: starter.description, charts: canvas.charts.map((c) => chartPreset(c)?.question ?? ""), href: `${path}?${startParams(all, charts)}` }];
  });
}
