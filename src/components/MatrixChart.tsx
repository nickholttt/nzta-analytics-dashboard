// matrix: two fields crossed, one down the side and one across the top, a shaded figure in each cell. Measure = count or share, one window,
// neither field time (CLAUDE.md, Shapes; D-083, D-114). The grid is a real table drawn from the design tokens (src/styles/site.css, --scale-N),
// not an Observable Plot figure: a table has row and column headers a screen reader reads, a first column that stays put when the grid scrolls
// on a phone, text that reflows with the reader's type size, and it is the table of figures itself, so nothing is said twice. The pure grid is
// src/lib/matrix.ts; every sentence is a template in config.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { chartDefaults, datasetWords, findDataset, findPeriod, lowerLabel, phrases } from "../lib/config";
import type { Dimension, Preset } from "../lib/config";
import { PAIR_SEPARATOR, SMALL_CELL_PAIR_KEY, ruleMinimum, smallCellPairs } from "../lib/data";
import type { Manifest, SliceRow } from "../lib/data";
import { TRAILING_MONTHS, addMonths, minDenominator as floorOf, monthLabel, monthRange, pct } from "../lib/measures";
import { BASES, bandScale, gridOf, gridTable, hiddenGridOf, isBasis, tableFigures } from "../lib/matrix";
import type { Basis, CellSource, Grid, SideSpec } from "../lib/matrix";
import { count, spanPeriod } from "../lib/readout";
import { latestMonthOf } from "../lib/resolve";
import { countedText, fillTemplate, markReason, matrixSentences, vehiclesText, rankingWindows, rankingWords, sayBadMonth } from "../lib/sentences";
import { getParam, setParam } from "../lib/url";
import { useFigures } from "./FiguresContext";

type Props = {
  preset: Preset;
  // The field down the side, and the field across the top.
  dimension: Dimension;
  dimension2: Dimension;
  rows: SliceRow[];
  manifest: Manifest;
  // Each field's values as a reader sees them.
  label: (value: string) => string;
  label2: (value: string) => string;
  // The fields in the words the page uses for them.
  rowHeading: string;
  columnHeading: string;
  // The month the window ends on (the panel keeps it in the address); undefined, or one outside the data, is the dataset's latest.
  month?: string;
  onMonth?: (month: string) => void;
  // The panel's definition, links and time range, drawn straight under the answer.
  after?: () => ReactNode;
};

const lower = lowerLabel;

// An ordered band is shown whole in the order config gives its bands; any other field is ranked.
const scaleOf = (d: Dimension) => (d.kind === "ordered_band" && d.bands ? bandScale(d.bands) : undefined);

export const defaultBasis = (preset: Preset): Basis => {
  if (isBasis(preset.cell_basis)) return preset.cell_basis;
  const wanted = chartDefaults.matrix.cells[preset.measure === "share" ? "share" : "count"];
  return isBasis(wanted) ? wanted : "count";
};

export function MatrixChart({ preset, dimension, dimension2, rows, manifest, label, label2, rowHeading, columnHeading, month, onMonth, after }: Props) {
  const fallback = defaultBasis(preset);
  const [basis, setBasis] = useState<Basis>(() => {
    const asked = typeof window === "undefined" ? fallback : getParam(preset.id, "cells", fallback);
    return isBasis(asked) ? asked : fallback;
  });
  const chooseBasis = (next: Basis) => {
    setBasis(next);
    setParam(preset.id, "cells", next, fallback);
  };

  // The window is the preset's period where that is a span of a year or less (a month, or the last 12 months).
  const spanMonths = findPeriod(preset.period)?.months;
  const span = spanMonths !== undefined && spanMonths <= TRAILING_MONTHS ? spanMonths : TRAILING_MONTHS;
  const latest = latestMonthOf(preset, manifest);
  const available = useMemo(() => {
    const first = rows.reduce((m, r) => (r.month < m ? r.month : m), latest);
    return monthRange(addMonths(first, span - 1), latest).reverse();
  }, [rows, latest, span]);
  const end = month && available.includes(month) ? month : latest;
  const { currentFrom } = rankingWindows(end, span);
  const words = datasetWords(preset.dataset);
  const floor = floorOf("share");
  const conditions = Object.values(preset.where ?? {}).some((kept) => kept.length > 0);

  const cells = useMemo<CellSource[]>(
    () =>
      rows.flatMap((r) =>
        r.other === undefined || r.notBrokenDown
          ? []
          : [{ month: r.month, value: r.value, other: r.other, n: r.n, ...(r.hidden ? { hidden: true } : {}), ...(r.lineTotals ? { totals: r.lineTotals, denominator: r.denominator } : {}) }],
      ),
    [rows],
  );
  // A table written under the small-cell rule carries the published total of each line with its cells (src/lib/data.ts, pairGrid); a period it does not
  // break down is one row that stands for the period. Neither is a grid of vehicles summed from cells.
  const protectedTable = rows.some((r) => r.lineTotals !== undefined);
  const notBrokenDown = rows.some((r) => r.notBrokenDown && r.month === end);
  const hiddenCells = cells.filter((c) => c.hidden && c.month === end).length;
  // The least count a visible cell has in this table, as its manifest entry says it applied the rule.
  const minimum = useMemo(() => {
    const pair = smallCellPairs(manifest, preset.dataset).find((p) => p.split(PAIR_SEPARATOR).sort().join() === [dimension.id, dimension2.id].sort().join());
    return pair ? ruleMinimum(manifest, preset.dataset, SMALL_CELL_PAIR_KEY, pair) : undefined;
  }, [manifest, preset.dataset, dimension.id, dimension2.id]);
  const grid: Grid = useMemo(() => {
    const side = (limit: number, picked: string[] | undefined, d: Dimension, nameOf: (v: string) => string): SideSpec => ({ limit, picked, order: scaleOf(d)?.order, unplaced: scaleOf(d)?.unplaced, nameOf });
    return (protectedTable ? hiddenGridOf : gridOf)({
      rows: cells,
      from: currentFrom,
      to: end,
      rowSide: side(chartDefaults.matrix.rows, preset.values, dimension, label),
      columnSide: side(chartDefaults.matrix.columns, preset.values2, dimension2, label2),
      basis,
      floor,
      stepFractions: chartDefaults.matrix.step_fractions,
    });
  }, [cells, currentFrom, end, preset.values, preset.values2, dimension, dimension2, label, label2, basis, floor, protectedTable]);

  const windowWords = rankingWords(phrases, { span, end, latest }).window;
  const rowField = lower(rowHeading);
  const columnField = lower(columnHeading);
  const table = useMemo(
    () =>
      gridTable(grid, {
        rowHead: rowHeading,
        totalCount: phrases.matrix_total_count,
        totalShare: phrases.matrix_total_share,
        format: { count: (n) => n.toLocaleString("en-NZ"), pct },
        thin: markReason("thin", floor),
        noBase: { row: phrases.matrix_no_base_row, column: phrases.matrix_no_base_column },
        hidden: { text: phrases.hidden_word, reason: fillTemplate(phrases.hidden_reason, { minimum }).text },
      }),
    [grid, rowHeading, floor, minimum],
  );
  const sentences = useMemo(() => {
    const side = (s: Grid["rows"], field: string) => ({ field, mode: s.mode, shown: s.shown, tiedBeyond: s.tiedBeyond, kept: s.kept, rest: s.rest });
    return matrixSentences(phrases, {
      basis,
      rowField,
      columnField,
      window: windowWords,
      total: grid.total,
      conditions,
      floor,
      rest: grid.rows.lines.find((l) => l.kind === "rest")?.name ?? grid.columns.lines.find((l) => l.kind === "rest")?.name ?? "",
      leaders: grid.leaders.map((l) => ({ row: l.row.name, column: l.column.name, n: l.n, inRest: l.inRest })),
      among: grid.leadersAmong,
      tiny: table.hasTiny,
      counted: (n) => countedText(words?.leader_count, n, windowWords),
      rows: side(grid.rows, rowField),
      columns: side(grid.columns, columnField),
      thin: { whole: grid.wholeGreyed, rows: grid.greyedRows.length, columns: grid.greyedColumns.length },
      hidden: { cells: hiddenCells, minimum },
    });
  }, [grid, table, basis, rowField, columnField, windowWords, conditions, floor, words, hiddenCells, minimum]);

  // The notes the file carries above the table are the sentences under the grid on the page, so the file says what the page does.
  const notes = useMemo(
    () => [...(sentences.cells ? [sentences.cells] : []), ...(basis === "count" ? [] : [phrases.matrix_units]), ...(sentences.tiny ? [sentences.tiny] : []), ...(sentences.hidden ? [sentences.hidden] : []), ...sentences.rows, ...sentences.columns, ...sentences.thin],
    [sentences, basis],
  );
  const figures = useCallback(() => tableFigures(table, basis, spanPeriod(currentFrom, end), notes), [table, basis, currentFrom, end, notes]);
  useFigures(figures);

  const monthNotice = sayBadMonth(phrases.bad_month, month, end);
  const monthPick =
    onMonth && available.length > 1 ? (
      <label className="month-pick">
        {span === 1 ? phrases.matrix_month_pick : phrases.matrix_window_pick}
        <select value={end} onChange={(e) => onMonth(e.target.value)}>
          {available.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  // Whether the grid is wider than its box depends on the names in it, so it is measured: the line that says it scrolls shows only while it does.
  const box = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [grid]);

  const shares = basis !== "count";
  const leaderCount = grid.leaders[0]?.n;
  const answer = sentences.leader ? (
    <div className="answer">
      <p className="answer-figure" aria-hidden="true">{count(leaderCount as number)}</p>
      <p className="answer-sentence">{sentences.leader}</p>
    </div>
  ) : null;
  const basisLabels: Record<Basis, string> = {
    count: phrases.matrix_basis_count,
    all: phrases.matrix_basis_all,
    row: phrases.matrix_basis_row,
    column: phrases.matrix_basis_column,
  };
  const controls = (
    <div className="controls" style={{ marginBottom: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
      <div className="toggle" role="radiogroup" aria-label={phrases.matrix_basis_head}>
        {BASES.map((b) => (
          <label key={b}>
            <input type="radio" name={`cells-${preset.id}`} checked={basis === b} onChange={() => chooseBasis(b)} /> {basisLabels[b]}
          </label>
        ))}
      </div>
      {monthPick}
    </div>
  );

  if (notBrokenDown) {
    const total = rows.find((r) => r.notBrokenDown && r.month === end)?.n ?? 0;
    return (
      <>
        {after?.()}
        {controls}
        <p className="chart-unit">{fillTemplate(phrases.not_broken_down, { window: windowWords, vehicles: vehiclesText(total) }).text}</p>
        <p className="chart-unit"><a href="/method#hidden-counts">{phrases.hidden_link}</a></p>
      </>
    );
  }

  if (grid.total === 0) {
    return (
      <>
        {after?.()}
        {controls}
        {monthNotice ? <p className="chart-unit" role="status">{monthNotice}</p> : null}
        <p className="chart-unit">{fillTemplate(phrases.matrix_none, { window: windowWords }).text}</p>
      </>
    );
  }

  const legendFormat = (n: number) => (shares ? `${(n / 10).toFixed(1)}%` : count(n));
  // The first step runs from the least there can be above nothing, which a share prints as 0.0%, so it is said as "up to".
  const stepLabel = (from: number, to: number) =>
    from === 1 ? fillTemplate(phrases.matrix_legend_up_to, { value: legendFormat(to) }).text : from === to ? legendFormat(from) : fillTemplate(phrases.matrix_legend_range, { from: legendFormat(from), to: legendFormat(to) }).text;
  const restName = table.rows.find((r) => r.kind === "rest")?.head ?? table.columns.find((c) => c.kind === "rest")?.name;
  const anyGreyed = grid.wholeGreyed || grid.greyedRows.length > 0 || grid.greyedColumns.length > 0;

  return (
    <>
      {answer}
      {after?.()}
      {controls}
      {monthNotice ? <p className="chart-unit" role="status">{monthNotice}</p> : null}
      {sentences.cells ? <p className="chart-unit">{sentences.cells}</p> : null}
      {sentences.tiny ? <p className="chart-unit">{sentences.tiny}</p> : null}
      {sentences.hidden ? (
        <p className="chart-unit">
          {sentences.hidden} <a href="/method#hidden-counts">{phrases.hidden_link}</a>
        </p>
      ) : null}
      {[...sentences.rows, ...sentences.columns].map((sentence) => (
        <p key={sentence} className="chart-unit">{sentence}</p>
      ))}
      {sentences.thin.map((sentence) => (
        <p key={sentence} className="chart-unit">{sentence}</p>
      ))}

      <div className="matrix-legend">
        <p className="matrix-legend-title">{shares ? phrases.matrix_legend_share : phrases.matrix_legend_count}</p>
        <ul aria-label={shares ? phrases.matrix_legend_share : phrases.matrix_legend_count}>
          {grid.legend.map((step) => (
            <li key={step.step}>
              <span className={`matrix-swatch step-${step.step}`} aria-hidden="true" />
              {stepLabel(step.from, step.to)}
            </li>
          ))}
          {hiddenCells > 0 || grid.rowTotals.some((t) => t === null) ? (
            <li>
              <span className="matrix-swatch hidden" aria-hidden="true" />
              {fillTemplate(phrases.matrix_legend_hidden, { minimum }).text}
            </li>
          ) : null}
          {anyGreyed ? (
            <li>
              <span className="matrix-swatch greyed" aria-hidden="true" />
              {fillTemplate(phrases.matrix_legend_grey, { floor }).text}
            </li>
          ) : null}
        </ul>
        <p className="chart-unit">{restName ? fillTemplate(phrases.matrix_legend_unshaded, { rest: restName }).text : phrases.matrix_legend_unshaded_plain}</p>
      </div>

      <div ref={box} className="table-scroll matrix-scroll" role="region" aria-label={fillTemplate(phrases.matrix_region, { row_field: rowHeading, column_field: columnHeading }).text} tabIndex={0}>
        <table className={grid.protected ? "matrix protected" : "matrix"}>
          <caption className="visually-hidden">{[preset.question, sentences.cells].filter(Boolean).join(" ")}</caption>
          <thead>
            <tr>
              <th scope="col" className="matrix-corner">
                <span className="matrix-axis">{columnHeading} <span aria-hidden="true">→</span></span>
                <span className="matrix-axis">{rowHeading} <span aria-hidden="true">↓</span></span>
              </th>
              {table.columns.map((c, k) => (
                <th key={`${c.kind}${k}`} scope="col" className={`matrix-head ${c.kind}`}>
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.slice(0, -1).map((r, i) => (
              <tr key={`${r.kind}${i}`}>
                <th scope="row" className={`matrix-side ${r.kind}`}>{r.head}</th>
                {r.cells.map((c, j) => (
                  <td key={j} className={`matrix-cell step-${c.step}${c.mark ? ` ${c.mark}` : ""}${j === r.cells.length - 1 ? " total" : ""}`}>
                    {c.mark === "greyed" ? <span className="visually-hidden">Greyed: </span> : null}
                    {c.text}
                    {c.mark === "withheld" ? <span className="visually-hidden"> {c.reason}</span> : null}
                    {shares && !c.mark && j < r.cells.length - 1 ? <span className="visually-hidden">, {vehiclesText(grid.cells[i][j].n)}</span> : null}
                    {c.mark === "greyed" && j < r.cells.length - 1 ? <span className="visually-hidden">, {vehiclesText(grid.cells[i][j].n)}</span> : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="matrix-side total">{table.rows[table.rows.length - 1].head}</th>
              {table.rows[table.rows.length - 1].cells.map((c, j) => (
                <td key={j} className="matrix-cell step-0 total">{c.text}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {scrolls ? <p className="scroll-hint">{phrases.matrix_scroll_hint}</p> : null}
    </>
  );
}
