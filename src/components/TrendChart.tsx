// trend: a count or 12-month running total over time: for the whole dataset or one value of a dimension, or, for a
// question built on the Build page, one line for each value it compares. Or a derived series the browser computes
// from the slice (docs/METRICS.md).
//
// A derived series is the same shape, not a sixth one, so it renders here rather than in a renderer
// of its own. What it needs beyond a plain count is a unit — a share draws on a percentage axis and
// carries the share guards — and, for a measure whose membership is recomputed every month, a
// per-month selection the count path has no notion of.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo } from "react";
import type { MouseEvent, ReactNode } from "react";
import { datasetWords, findDataset, findDerived, findDimension, phrases, yearChangeFloor } from "../lib/config";
import type { Preset } from "../lib/config";
import { answerLine, fillTemplate, hoverLine, monthRuns, monthsOf, sayBadMonth, sayExceedsTotal, sayNotRecorded, sayOffChart, sayStarts, unrecordedMonths } from "../lib/sentences";
import { NOT_RECORDED_TOKEN, percent } from "../lib/sentences";
import type { Manifest, SliceRow } from "../lib/data";
import { nameOrder } from "../lib/ranking";
import { derivedSeries, isRatioMeasure, ratioSeries } from "../lib/derived";
import { isolatedMonths, lineMonths } from "../lib/ratio";
import type { RatioPoint, RatioSeries } from "../lib/derived";
import { latestMonthOf, servedFrom } from "../lib/resolve";
import { TRAILING_MONTHS, addMonths, collapsedAgainstTrailingMedian, monthDate, monthLabel, monthRange, pct, periodWindow } from "../lib/measures";
import { fillNote } from "../lib/notes";
import { count, greyedReason, monthPeriod, readout } from "../lib/readout";
import type { Greyed } from "../lib/readout";
import {
  LINE_WIDTH,
  PAPER,
  RULE,
  RULE_STRONG,
  SERIES,
  SUPPRESSED_BAND,
  SUPPRESSED_LINE,
  THIN_LINE_WIDTH,
  chartHeight,
  plotStyle,
  seriesColour,
  tipStyle,
  xTicks,
} from "../lib/theme";
import { FiguresTable } from "./FiguresTable";
import { PlotFigure } from "./PlotFigure";

const PERCENT = "percent";
const COUNT = "count";

type Props = {
  preset: Preset;
  rows: SliceRow[];
  manifest: Manifest;
  minDenominator: number;
  collapseFraction: number;
  lead?: boolean;
  // How a value is named for a reader: reserved tokens in words. Needed only where lines are values.
  label?: (value: string) => string;
  // What the panel puts between the answer and the chart (its definition, links and time range), so the answer comes first.
  after?: () => ReactNode;
  // For a ratio of two datasets (completeness): the numerator's rows, where `rows` are the denominator's.
  companion?: SliceRow[] | null;
  // The month a figure and sentence are read for (a count with an answer); empty is the latest. The panel keeps it in the address.
  month?: string;
  onMonth?: (month: string) => void;
};

type Point = {
  month: string;
  date: Date;
  y?: number;
  n?: number;
  denominator?: number;
  suppressed: boolean;
  greyed?: Greyed;
  members?: string[];
};

// The values a count draws a line for: the ones a question names, or, for a count by a low-cardinality breakdown that
// names none, every value the slice records (not the token for what the source does not record).
// The label of a chart that was given none: one function, so a chart that depends on it is not redrawn for want of a stable one.
const asIs = (v: string) => v;

function lineValues(preset: Preset, rows: SliceRow[]): string[] | undefined {
  if (preset.derived) return undefined;
  if (preset.values?.length) return preset.values;
  if (preset.values !== undefined || preset.measure !== COUNT || findDimension(preset.dimension)?.cardinality !== "low") return undefined;
  return [...new Set(rows.filter((r) => r.value !== NOT_RECORDED_TOKEN && r.n > 0).map((r) => r.value))].sort();
}

export function TrendChart(props: Props) {
  const { preset } = props;
  if (isRatioMeasure(findDerived(preset.derived)) && props.companion) return <RatioTrend {...props} companion={props.companion} />;
  const values = lineValues(preset, props.rows);
  if (values) return <ValuesTrend {...props} values={values} />;
  return <OneTrend {...props} />;
}

// One line per value of the dimension and one for the total, each a share of the denominator dataset's count for the same
// month. The axis starts where the data does, and says so, since a share that stays near 100% would otherwise draw flat.
function RatioTrend({ preset, rows, companion, manifest, lead = false, label = asIs }: Props & { companion: SliceRow[] }) {
  const derived = findDerived(preset.derived);
  const guards = derived?.guards ?? {};
  const totalLabel = derived?.total_label ?? "All";
  const whole = useMemo(() => ratioSeries(companion, rows, guards), [companion, rows, guards]);
  const firstMonth = whole.reduce((m, s) => (s.points[0] && s.points[0].month < m ? s.points[0].month : m), "9999-12");
  const series = useMemo(() => {
    const win = periodWindow(preset.period, firstMonth, latestMonthOf(preset, manifest));
    return whole
      .map((s) => ({ ...s, points: s.points.filter((p) => p.month >= win.from && p.month <= win.to) }))
      .filter((s) => s.points.length > 0);
  }, [whole, firstMonth, preset, manifest]);
  const name = (s: RatioSeries) => (s.series === "" ? totalLabel : label(s.series));
  // Where the breakdown begins, when the denominator's data opens with months the source does not record. It bears on the
  // view only when the view reaches that first month: a window that starts later never shows what is not drawn before it.
  const startsSentence = useMemo(
    () => sayStarts(phrases.breakdown_starts, monthRuns(unrecordedMonths(rows)), rows.reduce((m, r) => (r.month < m ? r.month : m), "9999-12")),
    [rows],
  );
  const model = useMemo(() => {
    const all = series.flatMap((s) => s.points.map((p) => p.month)).sort();
    const low = series.reduce((m, s) => s.points.reduce((x, p) => Math.min(x, p.value), m), 1);
    const high = series.reduce((m, s) => s.points.reduce((x, p) => Math.max(x, p.value), m), 1);
    return { from: all[0], to: all[all.length - 1], base: Math.max(0, Math.floor(low * 20) / 20 - 0.05), top: Math.max(1, high) * 1.02 };
  }, [series]);
  const starts = model.from === firstMonth ? startsSentence : undefined;
  const colour = (i: number) => seriesColour(i);
  const render = useCallback(
    (width: number) =>
      Plot.plot({
        width,
        height: chartHeight(width, lead),
        marginTop: 16,
        marginLeft: 48,
        marginRight: 16,
        marginBottom: 28,
        style: plotStyle,
        x: { type: "utc", label: null, domain: [monthDate(model.from), monthDate(addMonths(model.to, 1))] },
        y: { label: null, domain: [model.base, model.top] },
        marks: [
          Plot.gridY({ ticks: 5, stroke: RULE, strokeOpacity: 1 }),
          Plot.axisY({ ticks: 5, tickSize: 0, tickPadding: 6, label: null, tickFormat: (d: number) => `${Math.round(d * 100)}%` }),
          Plot.axisX({ ticks: xTicks(width), tickSize: 4, stroke: RULE_STRONG, label: null }),
          Plot.ruleY([1], { stroke: RULE_STRONG, strokeDasharray: "3,3" }),
          ...series.flatMap((s, i) => {
            const data = s.points.map((p) => ({ ...p, date: monthDate(p.month), name: name(s) }));
            // Every month in the window, with no value where a month is left out, so the line breaks there instead of joining
            // the months either side. A month standing alone between gaps would draw no stroke, so it is also a dot.
            const line = lineMonths(s.points, model.from, model.to).map((p) => ({ ...p, date: monthDate(p.month) }));
            const alone = new Set(isolatedMonths(line));
            return [
              Plot.lineY(line, { x: "date", y: "value", stroke: colour(i), strokeWidth: LINE_WIDTH, strokeLinejoin: "round", strokeLinecap: "round" }),
              Plot.dot(line.filter((p) => alone.has(p.month)), { x: "date", y: "value", r: 2.5, fill: colour(i), stroke: colour(i) }),
              Plot.tip(
                data,
                Plot.pointerX({
                  x: "date",
                  y: "value",
                  ...tipStyle,
                  title: (p: RatioPoint & { name: string }) => readout({ name: p.name, period: monthPeriod(p.month), share: p.value, n: p.n, base: p.denominator }),
                }),
              ),
            ];
          }),
        ],
      }),
    [model, series, lead, label, totalLabel],
  );
  const lastOf = (s: RatioSeries) => s.points[s.points.length - 1];
  return (
    <>
      <ul className="series-key" aria-label="Lines on this chart, with the latest month's figure">
        {series.map((s, i) => (
          <li key={s.series}>
            <span className="swatch" style={{ background: colour(i) }} aria-hidden="true" />
            {name(s)} <span className="series-key-figure">{pct(lastOf(s).value)} in {monthLabel(lastOf(s).month)}</span>
          </li>
        ))}
      </ul>
      <p className="chart-unit">{fillTemplate(derived?.unit_note ?? "", { base: percent(model.base) }).text}</p>
      {starts ? <p className="chart-unit">{starts}</p> : null}
      <PlotFigure
        render={render}
        label={`Line chart, ${monthLabel(model.from)} to ${monthLabel(model.to)}: ${series.map(name).join(", ")}, month by month.`}
      />
      <FiguresTable
        label={fillTemplate(derived?.table_label ?? "", { from: monthLabel(model.from), to: monthLabel(model.to) }).text}
        columns={[{ name: "Month" }, ...series.map((s) => ({ name: name(s) }))]}
        rows={() => {
          const at = series.map((s) => new Map(s.points.map((p) => [p.month, p.value])));
          return monthRange(model.from, model.to).flatMap((m) =>
            at.every((x) => !x.has(m)) ? [] : [[monthPeriod(m), ...at.map((x) => (x.has(m) ? pct(x.get(m) as number) : ""))]],
          );
        }}
      />
    </>
  );
}

type ValuePoint = { month: string; date: Date; series: string; y?: number };

// One count line per chosen value. Colours go by vehicles in the last 12 months, largest first, the rule the mix chart
// uses for its first slots, so a value shown as a share and as a count wears the same colour in both. A count carries
// no share guard, so nothing is greyed.
function ValuesTrend({ preset, rows, manifest, lead = false, label = asIs, values }: Props & { values: string[] }) {
  const rolling = preset.measure === "rolling_12m";
  const model = useMemo(() => {
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const win = periodWindow(preset.period, months[0], latestMonthOf(preset, manifest));
    const cell = new Map<string, number>();
    const present = new Set<string>();
    for (const r of rows) {
      cell.set(`${r.month}|${r.value}`, r.n);
      present.add(r.month);
    }
    // A month the source records nothing of for this breakdown is a gap too: its vehicles sit under the not-recorded token,
    // so a value would read zero there when the truth is that nobody knows.
    const unrecorded = new Set(unrecordedMonths(rows));
    // A month absent from the data is a gap, never a zero: METRICS.md, never interpolate a missing month.
    const at = (m: string, s: string) => (present.has(m) && !unrecorded.has(m) ? (cell.get(`${m}|${s}`) ?? 0) : undefined);
    const points: ValuePoint[] = [];
    for (const s of values) {
      for (const m of monthRange(win.from, win.to)) {
        let y = at(m, s);
        if (rolling) {
          const trailing = monthRange(addMonths(m, -11), m).map((k) => at(k, s));
          y = trailing.every((v) => v !== undefined) ? trailing.reduce((a, b) => (a as number) + (b as number), 0) : undefined;
        }
        points.push({ month: m, date: monthDate(m), series: s, y });
      }
    }
    const latest = latestMonthOf(preset, manifest);
    const lastYear = monthRange(addMonths(latest, -11), latest);
    // The last year's figure is a whole year's or none: a month the source does not record, or the data lacks, is not a zero.
    const totals = values.map((s) => {
      const months = lastYear.map((m) => at(m, s));
      return { series: s, n: months.every((v) => v !== undefined) ? months.reduce((sum, v) => (sum as number) + (v as number), 0) : undefined } as { series: string; n?: number };
    });
    // The stretches of the drawn window that are left blank because the source does not record them, and the months in which
    // the published parts add up to more than the month's total (read from the manifest, not from the sums).
    const runs = monthRuns([...unrecorded].filter((m) => m >= win.from && m <= win.to));
    const served = servedFrom(preset.dataset, manifest);
    const exceeding = (preset.dimension ? manifest.datasets[served ?? ""]?.exceeds_total?.[preset.dimension] : undefined)?.filter(
      (m) => m >= win.from && m <= win.to,
    );
    return { win, points, totals, unrecorded, runs, exceeding };
  }, [rows, preset, manifest, values, rolling]);

  const colour = useCallback(
    (s: string) => seriesColour([...model.totals].sort((a, b) => (b.n ?? -1) - (a.n ?? -1) || nameOrder(label(a.series), label(b.series))).findIndex((t) => t.series === s)),
    [model.totals, label],
  );

  const render = useCallback(
    (width: number) => {
      // Reduced, not spread into Math.max: many series over a long period are more points than a call can take.
      const yMax = model.points.reduce((top, p) => Math.max(top, p.y ?? 0), 1) * 1.05;
      const drawn = model.points.filter((p) => p.y !== undefined);
      // Vehicles come whole: a small count gets a tick per vehicle, never half of one.
      const ticks = yMax <= 6 ? Array.from({ length: Math.floor(yMax) + 1 }, (_, i) => i) : 5;
      return Plot.plot({
        width,
        height: chartHeight(width, lead),
        marginTop: 16,
        marginLeft: 56,
        marginRight: 16,
        marginBottom: 28,
        style: plotStyle,
        x: { type: "utc", label: null, domain: [monthDate(model.win.from), monthDate(addMonths(model.win.to, 1))] },
        y: { label: null, domain: [0, yMax] },
        color: { domain: values, range: values.map(colour) },
        marks: [
          Plot.rect(
            model.runs.map((r) => ({ x1: monthDate(r.from), x2: monthDate(addMonths(r.to, 1)), y1: 0, y2: yMax })),
            { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: SUPPRESSED_BAND },
          ),
          Plot.gridY({ ticks, stroke: RULE, strokeOpacity: 1 }),
          Plot.axisY({ ticks, tickSize: 0, tickPadding: 6, label: null, tickFormat: (d: number) => d.toLocaleString() }),
          Plot.axisX({ ticks: xTicks(width), tickSize: 4, stroke: RULE_STRONG, label: null }),
          Plot.ruleY([0], { stroke: RULE_STRONG }),
          Plot.lineY(model.points, { x: "date", y: "y", z: "series", stroke: "series", strokeWidth: LINE_WIDTH, strokeLinejoin: "round", strokeLinecap: "round" }),
          Plot.ruleX(drawn, Plot.pointerX({ x: "date", stroke: RULE_STRONG })),
          Plot.dot(drawn, Plot.pointer({ x: "date", y: "y", r: 4, fill: "series", stroke: PAPER, strokeWidth: 1.5 })),
          Plot.tip(
            drawn,
            Plot.pointer({
              x: "date",
              y: "y",
              ...tipStyle,
              title: (p: ValuePoint) => readout({ name: label(p.series), period: monthPeriod(p.month, rolling), n: p.y }),
            }),
          ),
        ],
      });
    },
    [model, lead, values, colour, label, rolling],
  );

  const names = values.map(label).join(", ");
  const words = datasetWords(preset.dataset);
  const trailing = { months: TRAILING_MONTHS };
  const recent = fillNote(words?.recent_figure ?? "in the last {months} months", trailing).text;
  return (
    <>
      <ul className="series-key" aria-label={`Lines on this chart, with vehicles ${recent}`}>
        {model.totals.map((t) => (
          <li key={t.series}>
            <span className="swatch" style={{ background: colour(t.series) }} aria-hidden="true" />
            {label(t.series)}
            {t.n === undefined ? null : <span className="series-key-figure"> {count(t.n)} {recent}</span>}
          </li>
        ))}
      </ul>
      <p className="chart-unit">
        {fillNote((rolling ? words?.window_unit : words?.month_unit) ?? "Vehicles", trailing).text}
      </p>
      {[...sayNotRecorded(phrases.not_recorded, model.runs), ...sayExceedsTotal(phrases.exceeds_total, model.exceeding)].map((sentence) => (
        <p key={sentence} className="chart-unit">
          {sentence}
        </p>
      ))}
      <PlotFigure
        render={render}
        label={`Line chart, ${monthLabel(model.win.from)} to ${monthLabel(model.win.to)}: vehicles for ${names}, month by month.${
          model.runs.length ? ` ${sayNotRecorded(phrases.not_recorded, model.runs).join(" ")}` : ""
        }`}
      />
      <FiguresTable
        label={`Vehicles for ${names}: figures, ${monthLabel(model.win.from)} to ${monthLabel(model.win.to)}`}
        columns={[{ name: "Month" }, ...values.map((s) => ({ name: label(s) }))]}
        rows={() => {
          const y = new Map(model.points.map((p) => [`${p.month}|${p.series}`, p.y]));
          return monthRange(model.win.from, model.win.to).flatMap((m) => {
            const cells = values.map((s) => y.get(`${m}|${s}`));
            // A month the source does not record is a row that says so, not a row of blanks that could be read as zero.
            if (model.unrecorded.has(m)) return [[monthPeriod(m, rolling), ...values.map(() => label(NOT_RECORDED_TOKEN))]];
            return cells.every((v) => v === undefined) ? [] : [[monthPeriod(m, rolling), ...cells.map((v) => (v === undefined ? "" : count(v)))]];
          });
        }}
      />
    </>
  );
}

function OneTrend({ preset, rows, manifest, minDenominator, collapseFraction, lead = false, label = asIs, month, onMonth, after }: Props) {
  const derived = preset.derived ? findDerived(preset.derived) : undefined;
  const share = derived?.unit === PERCENT;
  const words = datasetWords(preset.dataset);
  // What the line is, for its readout: a derived measure by its definition's own words, otherwise the vehicles counted.
  const filtered = Object.values(preset.where ?? {}).some((kept) => kept.length > 0);
  const name = derived
    ? derived.label.charAt(0).toUpperCase() + derived.label.slice(1)
    : (preset.filter_value ?? (filtered ? "Vehicles that match" : "All vehicles"));

  const model = useMemo(() => {
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const win = periodWindow(preset.period, months[0], latestMonthOf(preset, manifest));
    const denominators = new Map<string, number>();
    for (const r of rows) denominators.set(r.month, r.denominator);
    const denominatorFor = (m: string) => denominators.get(m);

    const byMonth = new Map<string, number>();
    const detail = new Map<string, string[]>();
    const counts = new Map<string, number>();
    const series = preset.derived ? derivedSeries(preset.derived, rows, label) : undefined;
    if (series) {
      for (const p of series) {
        if (p.value !== undefined) byMonth.set(p.month, p.value);
        detail.set(p.month, p.members);
        counts.set(p.month, p.n);
      }
    } else {
      for (const r of rows) {
        if (preset.filter_value !== undefined) {
          if (r.value === preset.filter_value) byMonth.set(r.month, r.n);
        } else byMonth.set(r.month, r.denominator);
      }
    }

    const points: Point[] = [];
    const bands: { x1: Date; x2: Date }[] = [];
    let runStart: string | null = null;
    for (const m of monthRange(win.from, win.to)) {
      let y = byMonth.get(m);
      if (preset.measure === "rolling_12m") {
        const trailing = monthRange(addMonths(m, -11), m).map((k) => byMonth.get(k));
        // A running total needs all 12 months; a missing month leaves a gap, never an interpolation.
        y = trailing.every((v) => v !== undefined) ? trailing.reduce((a, b) => (a as number) + (b as number), 0) : undefined;
      }
      // A share carries both guards; a count is a count and carries neither.
      const den = denominatorFor(m);
      const greyed: Greyed | undefined =
        !share || den === undefined
          ? undefined
          : den < minDenominator
            ? "thin"
            : collapsedAgainstTrailingMedian(m, denominatorFor, collapseFraction)
              ? "collapsed"
              : undefined;
      const suppressed = greyed !== undefined;
      if (suppressed && runStart === null) runStart = m;
      if (!suppressed && runStart !== null) {
        bands.push({ x1: monthDate(runStart), x2: monthDate(m) });
        runStart = null;
      }
      points.push({ month: m, date: monthDate(m), y, n: counts.get(m), denominator: den, suppressed, greyed, members: detail.get(m) });
    }
    if (runStart !== null) bands.push({ x1: monthDate(runStart), x2: monthDate(addMonths(win.to, 1)) });
    return { win, points, bands, byMonth };
  }, [rows, preset, manifest, share, minDenominator, collapseFraction]);

  // The answer: the count for one month, against the same month a year earlier. Months come from the points that have a
  // figure, newest first, so the choice offers only months the data has.
  // The year-ago figure is read from every month the dataset has, so the window a visitor draws never changes the answer.
  // `rows` is every month the dataset has; the sentences take it whole.
  const answerMonths = useMemo(() => (preset.answer ? monthsOf(rows) : []), [rows, preset.answer]);
  const chosen = month && answerMonths.includes(month) ? month : answerMonths[0];
  const answer = useMemo(() => (preset.answer && chosen ? answerLine(preset.answer, rows, chosen, yearChangeFloor()) : undefined), [preset.answer, rows, chosen]);
  const monthNotice = preset.answer && chosen ? sayBadMonth(phrases.bad_month, month, chosen) : undefined;
  const offChart = chosen && preset.answer ? sayOffChart(phrases.month_off_chart, chosen, model.win.from, model.win.to) : undefined;
  const showYear = Boolean(findDataset(preset.dataset)?.shows_year_change);
  const yearLine = (m: string) => [hoverLine(phrases, rows, m, yearChangeFloor())];

  const render = useCallback(
    (width: number) => {
      const top = model.points.reduce((most, p) => Math.max(most, p.y ?? 0), 0.01);
      const yMax = share ? Math.min(1, top * 1.05) : top * 1.05;
      const format = share ? (d: number) => `${Math.round(d * 100)}%` : (d: number) => d.toLocaleString();
      return Plot.plot({
        width,
        height: chartHeight(width, lead),
        marginTop: 16,
        marginLeft: share ? 44 : 56,
        marginRight: 16,
        marginBottom: 28,
        style: plotStyle,
        x: { type: "utc", label: null, domain: [monthDate(model.win.from), monthDate(addMonths(model.win.to, 1))] },
        y: { label: null, domain: [0, yMax] },
        marks: [
          Plot.rect(model.bands.map((b) => ({ ...b, y1: 0, y2: yMax })), { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: SUPPRESSED_BAND }),
          ...(chosen
            ? [
                Plot.ruleX([monthDate(chosen)], { stroke: RULE_STRONG, strokeDasharray: "3,3" }),
                Plot.dot(model.points.filter((p) => p.month === chosen && p.y !== undefined), { x: "date", y: "y", r: 5, fill: SERIES[0], stroke: PAPER, strokeWidth: 2 }),
              ]
            : []),
          Plot.gridY({ ticks: 5, stroke: RULE, strokeOpacity: 1 }),
          Plot.axisY({ ticks: 5, tickSize: 0, tickPadding: 6, label: null, tickFormat: format }),
          Plot.axisX({ ticks: xTicks(width), tickSize: 4, stroke: RULE_STRONG, label: null }),
          Plot.ruleY([0], { stroke: RULE_STRONG }),
          Plot.lineY(model.points, { x: "date", y: "y", stroke: SUPPRESSED_LINE, strokeWidth: THIN_LINE_WIDTH }),
          Plot.lineY(
            model.points.map((p) => (p.suppressed ? { ...p, y: undefined } : p)),
            { x: "date", y: "y", stroke: SERIES[0], strokeWidth: LINE_WIDTH, strokeLinejoin: "round", strokeLinecap: "round" },
          ),
          Plot.ruleX(model.points, Plot.pointerX({ x: "date", stroke: RULE_STRONG })),
          Plot.dot(
            model.points.filter((p) => p.y !== undefined),
            Plot.pointerX({ x: "date", y: "y", r: 4, fill: SERIES[0], stroke: PAPER, strokeWidth: 1.5 }),
          ),
          Plot.tip(
            model.points.filter((p) => p.y !== undefined),
            Plot.pointerX({
              x: "date",
              y: "y",
              ...tipStyle,
              title: (p: Point) =>
                readout({
                  name,
                  period: monthPeriod(p.month, preset.measure === "rolling_12m"),
                  ...(share ? { share: p.y, n: p.n, base: p.denominator } : { n: p.y }),
                  greyed: p.greyed,
                  minDenominator,
                  extra: p.members?.length
                    ? [`The ${p.members.length} largest: ${p.members.map(label).join(", ")}`]
                    : showYear
                      ? yearLine(p.month)
                      : undefined,
                }),
            }),
          ),
        ],
      });
    },
    [model, share, lead, name, preset.measure, minDenominator, chosen, showYear, rows, label],
  );

  // A click or tap on the chart reads the month nearest to it. The month list is the keyboard's way to the same thing.
  const pick = (e: MouseEvent<HTMLDivElement>) => {
    const svg = e.currentTarget.querySelector("svg");
    if (!svg || !onMonth || model.points.length === 0) return;
    const box = svg.getBoundingClientRect();
    const left = share ? 44 : 56;
    const t = (e.clientX - box.left - left) / (box.width - left - 16);
    const from = monthDate(model.win.from).getTime();
    const to = monthDate(addMonths(model.win.to, 1)).getTime();
    const at = from + Math.min(1, Math.max(0, t)) * (to - from);
    const near = model.points
      .filter((p) => p.y !== undefined)
      .reduce((best, p) => (Math.abs(p.date.getTime() - at) < Math.abs(best.date.getTime() - at) ? p : best));
    onMonth(near.month);
  };

  return (
    <>
      {preset.answer && answer && chosen ? (
        <div className="answer">
          <p className="answer-figure" aria-hidden="true">{answer.figure}</p>
          <p className="answer-sentence" aria-live="polite">{answer.sentence}</p>
          <label className="month-pick">
            Month
            <select value={chosen} onChange={(e) => onMonth?.(e.target.value)}>
              {answerMonths.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {preset.answer && answer && chosen ? after?.() : null}
      {monthNotice ? <p className="chart-unit" role="status">{monthNotice}</p> : null}
      {offChart ? <p className="chart-unit" role="status">{offChart}</p> : null}
      <p className="chart-unit">{share ? "Share of the month's vehicles" : fillNote((preset.measure === "rolling_12m" ? words?.window_unit : words?.month_unit) ?? "Vehicles", { months: TRAILING_MONTHS }).text}{preset.answer ? `. ${phrases.pick_month}` : ""}</p>
      {/* The click only repeats what the month list does, so the wrapper needs no role of its own. */}
      <div onClick={preset.answer ? pick : undefined}>
        <PlotFigure
          render={render}
          label={`Line chart, ${monthLabel(model.win.from)} to ${monthLabel(model.win.to)}: ${derived ? derived.label : name.toLowerCase()}, month by month.`}
        />
      </div>
      <FiguresTable
        label={`${name}: figures, ${monthLabel(model.win.from)} to ${monthLabel(model.win.to)}`}
        columns={share ? [{ name: "Month" }, { name: "Share" }, { name: "Vehicles" }, { name: "Note", text: true }] : [{ name: "Month" }, { name: "Vehicles" }]}
        rows={() =>
          model.points
            .filter((p) => p.y !== undefined)
            .map((p) => {
              const month = monthPeriod(p.month, preset.measure === "rolling_12m");
              if (!share) return [month, count(p.y as number)];
              const vehicles = p.n !== undefined && p.denominator !== undefined ? `${count(p.n)} of ${count(p.denominator)}` : "";
              return [month, pct(p.y as number), vehicles, greyedReason(p.greyed, minDenominator)];
            })
        }
      />
    </>
  );
}
