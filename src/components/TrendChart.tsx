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
import { answerLine, countedText, fillTemplate, hoverLine, monthRuns, monthsOf, sayBadMonth, sayExceedsTotal, sayNotRecorded, sayOffChart, sayStarts, unrecordedMonths } from "../lib/sentences";
import { countFact, countSentence, shareFact, shareSentence, valuesSentence } from "../lib/chartSentence";
import { chartSentences } from "../lib/chartWords";
import { NOT_RECORDED_TOKEN, percent } from "../lib/sentences";
import type { Manifest, SliceRow } from "../lib/data";
import { nameOrder } from "../lib/ranking";
import { derivedSeries, isRatioMeasure, ratioSeries } from "../lib/derived";
import { isolatedMonths, lineMonths } from "../lib/ratio";
import { axisTop } from "../lib/shareline";
import { zeroInside } from "../lib/rolling";
import type { Covers } from "../lib/rolling";
import type { RatioPoint, RatioSeries } from "../lib/derived";
import { latestMonthOf, servedFrom } from "../lib/resolve";
import { TRAILING_MONTHS, addMonths, collapsedAgainstTrailingMedian, counted, monthDate, monthLabel, monthRange, pct, periodWindow, shareChange, windowTotal } from "../lib/measures";
import { fillNote } from "../lib/notes";
import { count, greyedReason, markReason, monthPeriod, readout } from "../lib/readout";
import type { Greyed } from "../lib/readout";
import { LINE_WIDTH, THIN_LINE_WIDTH, chartHeight, plotStyle, seriesColour, tipStyle, xTicks } from "../lib/theme";
import { usePalette } from "../lib/useTheme";
import { ChartSentence, useComparable } from "./ChartSentence";
import { FiguresTable } from "./FiguresTable";
import type { Cell } from "../lib/figures";
import { PlotFigure } from "./PlotFigure";

const PERCENT = "percent";
const COUNT = "count";

type Props = {
  preset: Preset;
  rows: SliceRow[];
  manifest: Manifest;
  // The months the dataset covers: a month inside them in which the view has no rows holds no vehicles, so a count reads zero
  // there and a window counts it as zero (docs/METRICS.md, "Months in which nothing is counted").
  covers?: Covers;
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
  const pal = usePalette();
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
  const colour = (i: number) => seriesColour(pal, i);
  const render = useCallback(
    (width: number) =>
      Plot.plot({
        width,
        height: chartHeight(width, lead),
        marginTop: 16,
        marginLeft: 48,
        marginRight: 16,
        marginBottom: 28,
        style: plotStyle(pal),
        x: { type: "utc", label: null, domain: [monthDate(model.from), monthDate(addMonths(model.to, 1))] },
        y: { label: null, domain: [model.base, model.top] },
        marks: [
          Plot.gridY({ ticks: 5, stroke: pal.rule, strokeOpacity: 1 }),
          Plot.axisY({ ticks: 5, tickSize: 0, tickPadding: 6, label: null, tickFormat: (d: number) => `${Math.round(d * 100)}%` }),
          Plot.axisX({ ticks: xTicks(width), tickSize: 4, stroke: pal.ruleStrong, label: null }),
          Plot.ruleY([1], { stroke: pal.ruleStrong, strokeDasharray: "3,3" }),
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
                  ...tipStyle(pal),
                  title: (p: RatioPoint & { name: string }) => readout({ name: p.name, period: monthPeriod(p.month), share: p.value, n: p.n, base: p.denominator }),
                }),
              ),
            ];
          }),
        ],
      }),
    [model, series, lead, label, totalLabel, pal],
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
        period={`${monthLabel(model.from)} to ${monthLabel(model.to)}`}
        columns={[{ name: "Month", unit: "month" }, ...series.map((s) => ({ name: name(s), unit: "percent" as const }))]}
        rows={() => {
          const at = series.map((s) => new Map(s.points.map((p) => [p.month, p.value])));
          return monthRange(model.from, model.to).flatMap((m) =>
            at.every((x) => !x.has(m)) ? [] : [[{ text: monthPeriod(m), csv: m }, ...at.map((x) => (x.has(m) ? pct(x.get(m) as number) : ""))]],
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
function ValuesTrend({ preset, rows, manifest, covers, lead = false, label = asIs, values }: Props & { values: string[] }) {
  const pal = usePalette();
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
    // A month outside the dataset's months is a gap, never a zero: METRICS.md, never interpolate a missing month. A month inside
    // them in which the view has no rows holds no vehicles, so it is a zero.
    const reader = (s: string) => counted((m) => present.has(m), covers, (m) => unrecorded.has(m), (m) => cell.get(`${m}|${s}`));
    const points: ValuePoint[] = [];
    for (const s of values) {
      const at = reader(s);
      for (const m of monthRange(win.from, win.to)) points.push({ month: m, date: monthDate(m), series: s, y: rolling ? windowTotal(m, at) : at(m) });
    }
    const latest = latestMonthOf(preset, manifest);
    // The last year's figure is a whole year's or none: a month the source does not record, or the data lacks, is not a zero.
    const totals = values.map((s): { series: string; n?: number } => ({ series: s, n: windowTotal(latest, reader(s)) }));
    // The stretches of the drawn window that are left blank because the source does not record them, and the months in which
    // the published parts add up to more than the month's total (read from the manifest, not from the sums).
    const runs = monthRuns([...unrecorded].filter((m) => m >= win.from && m <= win.to));
    const served = servedFrom(preset.dataset, manifest);
    const exceeding = (preset.dimension ? manifest.datasets[served ?? ""]?.exceeds_total?.[preset.dimension] : undefined)?.filter(
      (m) => m >= win.from && m <= win.to,
    );
    return { win, points, totals, unrecorded, runs, exceeding, reader };
  }, [rows, preset, manifest, values, rolling, covers]);

  const colour = useCallback(
    (s: string) => seriesColour(pal, [...model.totals].sort((a, b) => (b.n ?? -1) - (a.n ?? -1) || nameOrder(label(a.series), label(b.series))).findIndex((t) => t.series === s)),
    [model.totals, label, pal],
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
        style: plotStyle(pal),
        x: { type: "utc", label: null, domain: [monthDate(model.win.from), monthDate(addMonths(model.win.to, 1))] },
        y: { label: null, domain: [0, yMax] },
        color: { domain: values, range: values.map(colour) },
        marks: [
          Plot.rect(
            model.runs.map((r) => ({ x1: monthDate(r.from), x2: monthDate(addMonths(r.to, 1)), y1: 0, y2: yMax })),
            { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: pal.suppressedBand },
          ),
          Plot.gridY({ ticks, stroke: pal.rule, strokeOpacity: 1 }),
          Plot.axisY({ ticks, tickSize: 0, tickPadding: 6, label: null, tickFormat: (d: number) => d.toLocaleString() }),
          Plot.axisX({ ticks: xTicks(width), tickSize: 4, stroke: pal.ruleStrong, label: null }),
          Plot.ruleY([0], { stroke: pal.ruleStrong }),
          Plot.lineY(model.points, { x: "date", y: "y", z: "series", stroke: "series", strokeWidth: LINE_WIDTH, strokeLinejoin: "round", strokeLinecap: "round" }),
          Plot.ruleX(drawn, Plot.pointerX({ x: "date", stroke: pal.ruleStrong })),
          Plot.dot(drawn, Plot.pointer({ x: "date", y: "y", r: 4, fill: "series", stroke: pal.paper, strokeWidth: 1.5 })),
          Plot.tip(
            drawn,
            Plot.pointer({
              x: "date",
              y: "y",
              ...tipStyle(pal),
              title: (p: ValuePoint) => readout({ name: label(p.series), period: monthPeriod(p.month, rolling), n: p.y }),
            }),
          ),
        ],
      });
    },
    [model, lead, values, colour, label, rolling, pal],
  );

  const names = values.map(label).join(", ");
  const words = datasetWords(preset.dataset);
  const trailing = { months: TRAILING_MONTHS };
  const recent = fillNote(words?.recent_figure ?? "in the last {months} months", trailing).text;
  // The sentence under the chart: the line with the most in the newest month, and its change on the same month a year earlier (OneTrend).
  const comparable = useComparable();
  const latestMonth = model.win.to;
  const sentence = (() => {
    const earliest = addMonths(latestMonth, -12 - (rolling ? TRAILING_MONTHS - 1 : 0));
    const sameBasis = comparable(earliest, latestMonth, { dimension: preset.dimension ?? undefined, values: new Set(values) });
    const windowOf = (m: string) => fillTemplate(rolling ? phrases.window_to : phrases.window_month, { span: TRAILING_MONTHS, end: monthLabel(m) }).text;
    const lines = values.map((s) => ({ name: label(s), at: rolling ? (m: string) => windowTotal(m, model.reader(s)) : model.reader(s) }));
    return valuesSentence(
      chartSentences,
      lines,
      latestMonth,
      { floor: yearChangeFloor(), comparable: sameBasis && Boolean(findDataset(preset.dataset)?.shows_year_change) },
      { counted: (n, m) => countedText(words?.leader_count, n, windowOf(m)), window: windowOf },
    );
  })();
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
      <ChartSentence text={sentence} />
      <FiguresTable
        label={`Vehicles for ${names}: figures, ${monthLabel(model.win.from)} to ${monthLabel(model.win.to)}`}
        period={`${monthLabel(model.win.from)} to ${monthLabel(model.win.to)}`}
        columns={[
          { name: "Month", unit: "month", csvName: rolling ? `Month (last month of the ${TRAILING_MONTHS})` : undefined },
          ...values.map((s) => ({ name: label(s), unit: "count" as const })),
        ]}
        rows={() => {
          const y = new Map(model.points.map((p) => [`${p.month}|${p.series}`, p.y]));
          return monthRange(model.win.from, model.win.to).flatMap((m): Cell[][] => {
            const cells = values.map((s) => y.get(`${m}|${s}`));
            const month = { text: monthPeriod(m, rolling), csv: m };
            // A month the source does not record is a row that says so, not a row of blanks that could be read as zero.
            if (model.unrecorded.has(m)) return [[month, ...values.map(() => ({ text: label(NOT_RECORDED_TOKEN), csv: null, mark: "withheld" as const, reason: phrases.figures_not_recorded_cell }))]];
            return cells.every((v) => v === undefined) ? [] : [[month, ...cells.map((v) => (v === undefined ? "" : count(v)))]];
          });
        }}
      />
    </>
  );
}

function OneTrend({ preset, rows, manifest, covers, minDenominator, collapseFraction, lead = false, label = asIs, month, onMonth, after }: Props) {
  const pal = usePalette();
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
    // What the representativeness guard's median reads: a month inside the dataset's months with no rows is a month of zero.
    const windowed = zeroInside(denominatorFor, covers);

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
    // A count over a month inside the dataset's months with no rows is zero; a share of no vehicles has no value, so a derived
    // series keeps the months it has a figure for.
    const countAt = counted((m) => byMonth.has(m), series ? undefined : covers, () => false, (m) => byMonth.get(m));
    // One month's point, whether or not the month is drawn: the sentence under the chart reads the month a year before the latest, which a short
    // range does not draw.
    const pointAt = (m: string): Point => {
      // A running total needs all 12 months; a missing month leaves a gap, never an interpolation.
      const y = preset.measure === "rolling_12m" ? windowTotal(m, countAt) : countAt(m);
      // A share carries both guards; a count is a count and carries neither.
      const den = denominatorFor(m);
      const greyed: Greyed | undefined =
        !share || den === undefined
          ? undefined
          : den < minDenominator
            ? "thin"
            : collapsedAgainstTrailingMedian(m, windowed, collapseFraction)
              ? "collapsed"
              : undefined;
      return { month: m, date: monthDate(m), y, n: counts.get(m), denominator: den, suppressed: greyed !== undefined, greyed, members: detail.get(m) };
    };
    for (const m of monthRange(win.from, win.to)) {
      const point = pointAt(m);
      const suppressed = point.suppressed;
      if (suppressed && runStart === null) runStart = m;
      if (!suppressed && runStart !== null) {
        bands.push({ x1: monthDate(runStart), x2: monthDate(m) });
        runStart = null;
      }
      points.push(point);
    }
    if (runStart !== null) bands.push({ x1: monthDate(runStart), x2: monthDate(addMonths(win.to, 1)) });
    return { win, points, bands, byMonth, countAt, pointAt };
  }, [rows, preset, manifest, share, minDenominator, collapseFraction, covers]);

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

  // The sentence under the chart (src/lib/chartSentence.ts): the newest month the chart draws, its figure and, where the two can be compared,
  // its change on the same month a year earlier. Read from the dataset's own months, so the range drawn does not change it. A chart that
  // opens with its own answer says this already, and a share is said only where the chart does not grey the month.
  const comparable = useComparable();
  const latestMonth = model.win.to;
  const rollingTotal = preset.measure === "rolling_12m";
  const sentence = (() => {
    if (preset.answer && answer) return undefined;
    const scope = { dimension: preset.dimension ?? undefined, values: preset.filter_value === undefined ? undefined : new Set([preset.filter_value]) };
    const earliest = addMonths(latestMonth, -12 - (rollingTotal ? TRAILING_MONTHS - 1 : 0));
    const sameBasis = comparable(earliest, latestMonth, scope);
    if (derived) {
      if (!share) return undefined;
      const at = (m: string) => {
        const p = model.pointAt(m);
        return p.suppressed ? undefined : p.y;
      };
      return shareSentence(chartSentences, shareFact(at, latestMonth, sameBasis), derived.label, { share: pct, points: shareChange });
    }
    const windowOf = (m: string) =>
      fillTemplate(rollingTotal ? phrases.window_to : phrases.window_month, { span: TRAILING_MONTHS, end: monthLabel(m) }).text;
    const at = rollingTotal ? (m: string) => windowTotal(m, model.countAt) : model.countAt;
    return countSentence(chartSentences, countFact(at, latestMonth, { floor: yearChangeFloor(), comparable: sameBasis && showYear }), {
      counted: (n, m) => countedText(words?.leader_count, n, windowOf(m)),
      window: windowOf,
    });
  })();

  const render = useCallback(
    (width: number) => {
      // The axis is set by the points drawn in colour; greyed points are drawn within it and cut off at its edge (shareline.ts, axisTop).
      const top = axisTop(model.points.map((p) => ({ value: p.y, grey: p.suppressed })), 0.01);
      const yMax = share ? Math.min(1, top * 1.05) : top * 1.05;
      const inFrame = (p: Point) => Math.min(p.y as number, yMax);
      const format = share ? (d: number) => `${Math.round(d * 100)}%` : (d: number) => d.toLocaleString();
      return Plot.plot({
        width,
        height: chartHeight(width, lead),
        marginTop: 16,
        marginLeft: share ? 44 : 56,
        marginRight: 16,
        marginBottom: 28,
        style: plotStyle(pal),
        x: { type: "utc", label: null, domain: [monthDate(model.win.from), monthDate(addMonths(model.win.to, 1))] },
        y: { label: null, domain: [0, yMax] },
        marks: [
          Plot.rect(model.bands.map((b) => ({ ...b, y1: 0, y2: yMax })), { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: pal.suppressedBand }),
          ...(chosen
            ? [
                Plot.ruleX([monthDate(chosen)], { stroke: pal.ruleStrong, strokeDasharray: "3,3" }),
                Plot.dot(model.points.filter((p) => p.month === chosen && p.y !== undefined), { x: "date", y: "y", r: 5, fill: pal.series[0], stroke: pal.paper, strokeWidth: 2 }),
              ]
            : []),
          Plot.gridY({ ticks: 5, stroke: pal.rule, strokeOpacity: 1 }),
          Plot.axisY({ ticks: 5, tickSize: 0, tickPadding: 6, label: null, tickFormat: format }),
          Plot.axisX({ ticks: xTicks(width), tickSize: 4, stroke: pal.ruleStrong, label: null }),
          Plot.ruleY([0], { stroke: pal.ruleStrong }),
          Plot.lineY(model.points, { x: "date", y: "y", stroke: pal.suppressedLine, strokeWidth: THIN_LINE_WIDTH, clip: true }),
          Plot.lineY(
            model.points.map((p) => (p.suppressed ? { ...p, y: undefined } : p)),
            { x: "date", y: "y", stroke: pal.series[0], strokeWidth: LINE_WIDTH, strokeLinejoin: "round", strokeLinecap: "round" },
          ),
          Plot.ruleX(model.points, Plot.pointerX({ x: "date", stroke: pal.ruleStrong })),
          Plot.dot(
            model.points.filter((p) => p.y !== undefined),
            Plot.pointerX({ x: "date", y: inFrame, r: 4, fill: pal.series[0], stroke: pal.paper, strokeWidth: 1.5 }),
          ),
          Plot.tip(
            model.points.filter((p) => p.y !== undefined),
            Plot.pointerX({
              x: "date",
              y: inFrame,
              ...tipStyle(pal),
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
    [model, share, lead, name, preset.measure, minDenominator, chosen, showYear, rows, label, pal],
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
      <ChartSentence text={sentence} />
      <FiguresTable
        label={`${name}: figures, ${monthLabel(model.win.from)} to ${monthLabel(model.win.to)}`}
        period={`${monthLabel(model.win.from)} to ${monthLabel(model.win.to)}`}
        columns={
          share
            ? [
                { name: "Month", unit: "month" },
                { name: "Share", unit: "percent" },
                { name: "Vehicles", unit: "count" },
                { name: "Of all vehicles", unit: "count" },
                { name: "Note", text: true, carriesMarks: true },
              ]
            : [{ name: "Month", unit: "month" }, { name: "Vehicles", unit: "count" }]
        }
        rows={() =>
          model.points
            .filter((p) => p.y !== undefined)
            .map((p) => {
              const rollingWindow = preset.measure === "rolling_12m";
              const month = { text: monthPeriod(p.month, rollingWindow), csv: p.month };
              if (!share) return [month, count(p.y as number)];
              const figure = p.greyed ? { text: pct(p.y as number), mark: "greyed" as const, reason: markReason(p.greyed, minDenominator) } : pct(p.y as number);
              // The vehicles behind a share and the vehicles it is a share of, each a number of its own.
              return [month, figure, p.n !== undefined ? count(p.n) : "", p.denominator !== undefined ? count(p.denominator) : "", greyedReason(p.greyed, minDenominator)];
            })
        }
      />
    </>
  );
}
