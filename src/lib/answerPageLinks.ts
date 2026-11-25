// The canvas address that draws the question an answer page answers (config/answer_pages.json): the count of one value of a field over time. It is
// written by the canvas's own functions (src/lib/canvas.ts), as the latest month's links (src/lib/latestMonthLinks.ts) and a starter canvas's
// (src/lib/starters.ts) are, so the canvas reads it back as any shared link: the dataset, the measure and the one value the question is kept to.
// The address names no month: the chart redraws on each month the site holds, and the page it is linked from is rebuilt with the data
// (CLAUDE.md, how a page reads, point 9).
//
// A question about one value is asked as a condition on its field; `by` splits the count by another field, as the page's second link does.
import type { Vocabulary } from "./builder";
import { CANVAS_PATH, bestType, canvasParams, draws, nextChartId, settleCanvas, withFittingTypes } from "./canvas";
import type { Manifest } from "./data";

// `by` splits the count by another field (the second link of a page, which draws the value's count by new or used); absent, the count is of the value alone.
export type PageAsk = { dataset: string; measure: string; field: string; value: string; by?: string };

const sameWhere = (a: Record<string, string[]>, b: Record<string, string[]>) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

// The address of a canvas of one chart that asks this question, or nothing where the canvas would answer another question (a dataset, field or
// value this build lacks settles to something else) or cannot draw it: a link never opens to a chart that is not the page's.
export function answerPageLink(all: Vocabulary, manifest: Manifest, ask: PageAsk): string | undefined {
  const id = nextChartId([]);
  const where = { [ask.field]: [ask.value] };
  const canvas = withFittingTypes(settleCanvas(all, [{ id, asked: { dataset: ask.dataset, measure: ask.measure, by: ask.by ?? null, where }, type: null, table: false, width: "full" }]), manifest);
  const [chart] = canvas.charts;
  const q = chart.question;
  if (q.dataset !== ask.dataset || q.measure !== ask.measure || q.by !== (ask.by ?? null) || !sameWhere(q.where, where)) return undefined;
  if (!draws(q, chart.type ?? bestType(q), manifest)) return undefined;
  return `${CANVAS_PATH}?${canvasParams(canvas)}`;
}
