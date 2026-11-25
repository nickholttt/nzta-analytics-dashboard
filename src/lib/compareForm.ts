// The form that sets brands beside each other in the canvas: a plain GET form to the canvas's own address, so it works with no script. Its hidden fields are the
// address of a one-chart canvas written by the canvas's own functions (src/lib/canvas.ts), and the names of its visible fields are the names that address gives the
// values, the conditions and the period, found by asking the canvas's functions rather than typed here. Pure and free of any domain word, so tests/site/ runs it
// with made-up options.
import { CHART_PARAMS, questionParams } from "./builder";
import type { Question } from "./builder";
import { canvasParams } from "./canvas";
import type { Canvas } from "./canvas";

export type Option = { value: string; label: string };
export type Select = {
  name: string;
  label: string;
  required: boolean;
  // The option chosen when the page is drawn.
  selected: string;
  options: Option[];
};
export type CompareForm = {
  action: string;
  legend: string;
  hidden: [string, string][];
  selects: Select[];
  button: string;
  note: string;
};

// The names the canvas gives a chart's values, a condition on a field and its period, for the first chart of a canvas.
export type FormNames = { value: string; where: (field: string) => string; period: string; hidden: [string, string][] };

// Everything the form needs from the canvas: the hidden fields of a chart that ranks `by` for the dataset and measure, and the names of the fields it reads. Both come from
// the canvas's own writers, so a change to the address's shape is a change here with no edit.
export function formNames(canvas: Canvas, question: Question): FormNames | undefined {
  const [chart] = canvas.charts;
  if (!chart) return undefined;
  const id = chart.id;
  // The page's own values are left out of an address, so the probe names its values itself.
  const probe = questionParams({ ...question, pageValues: false, values:["\u0001value"], where: { "\u0001field": ["\u0001where"] } }, id);
  const valueKey = [...probe].find(([, v]) => v === "\u0001value")?.[0];
  const whereKey = [...probe].find(([, v]) => v === "\u0001where")?.[0];
  if (!valueKey || !whereKey || !CHART_PARAMS.includes("period")) return undefined;
  return {
    value: valueKey,
    where: (field) => whereKey.replace("\u0001field", field),
    period: `${id}.period`,
    hidden: [...canvasParams(canvas)],
  };
}

