// league: ranked horizontal bar + rank delta. Measure = count/share, single period, high-cardinality dimension.
import * as Plot from "@observablehq/plot";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { datasetWords, findDataset, findPeriod, phrases, yearChangeFloor } from "../lib/config";
import type { Dimension, Preset } from "../lib/config";
import type { Manifest, SliceRow } from "../lib/data";
import { TRAILING_MONTHS, addMonths, monthLabel, monthRange, pct, shareChange } from "../lib/measures";
import { changeOnYear, fillTemplate, rankingText, rankingWindows, sayBadMonth } from "../lib/sentences";
import { count, readout, spanPeriod } from "../lib/readout";
import { latestMonthOf } from "../lib/resolve";
import {
  FONT_TEXT,
  INK,
  INK_2,
  INK_3,
  PAPER,
  REMAINDER,
  RULE,
  RULE_STRONG,
  chartHeight,
  plotStyle,
  seriesColour,
  tipStyle,
} from "../lib/theme";
import { PlotFigure } from "./PlotFigure";

// A function that cuts a name with an ellipsis to the room a label has, measured in the chart's own font, so capitals and
// narrow letters both fit. Without a canvas (no browser) it estimates generously.
function fitter(room: number) {
  const context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (context) context.font = `${plotStyle.fontSize} ${FONT_TEXT}`;
  const width = (s: string) => (context ? context.measureText(s).width : s.length * 8);
  return (name: string) => {
    if (width(name) <= room) return name;
    let end = name.length;
    while (end > 1 && width(`${name.slice(0, end)}…`) > room) end--;
    return `${name.slice(0, end)}…`;
  };
}

const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");

export type LeagueItem = {
  rank: number;
  priorRank: number | null;
  rankDelta: number | null;
  value: string;
  name: string;
  n: number;
  share: number;
  priorN: number;
  priorShare: number;
  // Undefined where there is no earlier window to compare with.
  shareDelta: number | undefined;
  // The change in the count on the same months a year earlier, as a proportion; undefined where the earlier count is under
  // the change-on-a-year-ago floor, which is the measure's own guard.
  yearChange: number | undefined;
  colour: string;
  isRemainder: boolean;
};

type Props = {
  preset: Preset;
  dimension: Dimension;
  rows: SliceRow[];
  manifest: Manifest;
  minDenominator: number;
  label: (value: string) => string;
  // The heading of the column that names each ranked value, in the words the panel uses for the dimension.
  valueHeading: string;
  lead?: boolean;
  // The month the ranking's window ends on. Undefined, or one outside the data, is the dataset's latest month. The panel
  // keeps it in the address (`<preset>.month`), so a ranking of a past month can be linked.
  month?: string;
  onMonth?: (month: string) => void;
};

// The change on a year ago, as a percentage with its sign.
const signed = (x: number) => `${x > 0.0005 ? "+" : x < -0.0005 ? "−" : "±"}${Math.abs(x * 100).toFixed(Math.abs(x) * 100 < 10 ? 1 : 0)}%`;

// Bars follow the preset's measure. A count is offered beside the share only when the measure is not
// share: on a share preset the dataset may be one whose counts read as sales (D-044).
export function LeagueChart({ preset, dimension, rows, manifest, minDenominator, label, valueHeading, lead = false, month, onMonth }: Props) {
  const [topN, setTopN] = useState<number>(preset.top_n ?? 15);
  const offersCount = preset.measure !== "share";
  const [displayMode, setDisplayMode] = useState<"share" | "count">(offersCount ? "count" : "share");

  // The window is the preset's period where that is a span of a year or less (a month, or the last 12 months), otherwise the
  // trailing window. It is compared with the same months a year earlier, so a single month is set against the same month
  // last year, and a year against the year before it.
  const spanMonths = findPeriod(preset.period)?.months;
  const span = spanMonths !== undefined && spanMonths <= TRAILING_MONTHS ? spanMonths : TRAILING_MONTHS;
  const latest = latestMonthOf(preset, manifest);
  const available = useMemo(() => {
    const first = rows.reduce((m, r) => (r.month < m ? r.month : m), latest);
    return monthRange(addMonths(first, span - 1), latest).reverse();
  }, [rows, latest, span]);
  const end = month && available.includes(month) ? month : latest;
  const { currentFrom, priorFrom, priorTo } = rankingWindows(end, span);
  const words = datasetWords(preset.dataset);
  // What the ranking covers and whether there are figures a year earlier: decided from the rows, in one place.
  const ranking = useMemo(
    () => rankingText(phrases, { basis: words?.ranking_basis ?? "Ranked by vehicles {window}", span, end, latest, monthsPresent: new Set(rows.map((r) => r.month)) }),
    [rows, words, span, end, latest],
  );
  const showYear = Boolean(findDataset(preset.dataset)?.shows_year_change);
  const yearFloor = yearChangeFloor();

  const model = useMemo(() => {
    const currentCounts = new Map<string, number>();
    const priorCounts = new Map<string, number>();
    const monthDenoms = new Map<string, number>();

    for (const r of rows) {
      if (!monthDenoms.has(r.month)) {
        monthDenoms.set(r.month, r.denominator);
      }
      if (r.month >= currentFrom && r.month <= end) {
        currentCounts.set(r.value, (currentCounts.get(r.value) ?? 0) + r.n);
      } else if (r.month >= priorFrom && r.month <= priorTo) {
        priorCounts.set(r.value, (priorCounts.get(r.value) ?? 0) + r.n);
      }
    }

    let currentDenom = 0;
    for (const m of monthRange(currentFrom, end)) {
      currentDenom += monthDenoms.get(m) ?? 0;
    }
    const hasPrior = ranking.hasPrior;
    let priorDenom = 0;
    for (const m of monthRange(priorFrom, priorTo)) {
      priorDenom += monthDenoms.get(m) ?? 0;
    }

    // Rank all non-reserved entities in current window
    const currentRanked = [...currentCounts.entries()]
      .filter(([val, n]) => !isReserved(val) && n > 0)
      .sort((a, b) => b[1] - a[1]);

    // Rank all non-reserved entities in prior window
    const priorRanked = [...priorCounts.entries()]
      .filter(([val, n]) => !isReserved(val) && n > 0)
      .sort((a, b) => b[1] - a[1]);

    const priorRankMap = new Map<string, number>();
    priorRanked.forEach(([val], idx) => {
      priorRankMap.set(val, idx + 1);
    });

    // Extract Top N
    const topItems: LeagueItem[] = currentRanked.slice(0, topN).map(([val, n], idx) => {
      const rank = idx + 1;
      const priorRank = priorRankMap.get(val) ?? null;
      const rankDelta = priorRank !== null ? priorRank - rank : null;
      const priorN = priorCounts.get(val) ?? 0;
      const share = currentDenom > 0 ? n / currentDenom : 0;
      const priorShare = priorDenom > 0 ? priorN / priorDenom : 0;
      const shareDelta = hasPrior ? share - priorShare : undefined;
      const yearChange = hasPrior ? changeOnYear(n, priorN, yearFloor)?.change : undefined;

      // A compound value reads as words: the dimension's separator becomes a space.
      const separator = dimension.key_separator;
      const formattedName = separator && val.includes(separator) ? val.split(separator).join(" ") : label(val);

      return {
        rank,
        priorRank,
        rankDelta,
        value: val,
        name: formattedName,
        n,
        share,
        priorN,
        priorShare,
        shareDelta,
        yearChange,
        colour: seriesColour(idx),
        isRemainder: false,
      };
    });

    return { items: topItems, currentDenom, priorDenom, hasPrior };
  }, [rows, end, currentFrom, priorFrom, priorTo, yearFloor, topN, dimension, label, ranking]);

  const basis = ranking.text;
  const monthNotice = sayBadMonth(phrases.bad_month, month, end);
  const noYearAgo = fillTemplate(phrases.no_year_ago, {}).text;
  const yearLine = (d: LeagueItem) => {
    if (d.yearChange === undefined) return model.hasPrior ? [fillTemplate(phrases.year_too_few, {}).text] : [];
    const direction = Math.abs(d.yearChange) < 0.0005 ? "same" : d.yearChange > 0 ? "up" : "down";
    return [
      fillTemplate(phrases[`year_${direction}`], { change: Math.abs(d.yearChange), prior_month: spanPeriod(priorFrom, priorTo), prior_count: count(d.priorN) }).text,
    ];
  };

  // Whether the table is wider than its box depends on the names in it, not only on the screen, so it is measured:
  // the line that says the table scrolls shows only while it does.
  const tableBox = useRef<HTMLDivElement>(null);
  // The words for each column that ends beyond the box's right edge, so the line names only what is cut off or hidden.
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  useEffect(() => {
    const box = tableBox.current;
    if (!box) return;
    const measure = () => {
      const boxLeft = box.getBoundingClientRect().left;
      const hidden = [...box.querySelectorAll<HTMLElement>("th[data-hint]")]
        .filter((th) => th.getBoundingClientRect().right - boxLeft + box.scrollLeft > box.clientWidth + 1)
        .map((th) => th.dataset.hint as string);
      setHiddenColumns((was) => (was.join() === hidden.join() ? was : hidden));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [model]);

  const render = useCallback(
    (width: number) => {
      const height = Math.max(340, model.items.length * 24 + 60);
      const isShare = displayMode === "share";
      const maxVal = Math.max(0.01, ...model.items.map((d) => (isShare ? d.share : d.n)));
      const xMax = maxVal * 1.18;
      // A name wider than the room the labels have would run off the chart's left edge: it is cut with an ellipsis, and the
      // table below and the readout carry the whole name.
      const marginLeft = Math.min(180, Math.max(110, width * 0.28));
      const fit = fitter(marginLeft - 14);

      return Plot.plot({
        width,
        height,
        style: plotStyle,
        marginLeft,
        marginRight: 45,
        marginTop: 20,
        marginBottom: 30,
        y: {
          domain: model.items.map((d) => d.name),
          label: null,
          tickSize: 0,
          tickFormat: fit,
        },
        x: {
          domain: [0, xMax],
          label: null,
          tickFormat: isShare ? (d: number) => `${(d * 100).toFixed(0)}%` : (d: number) => d.toLocaleString(),
        },
        marks: [
          Plot.gridX({ stroke: RULE }),
          Plot.barX(model.items, {
            y: "name",
            x: isShare ? "share" : "n",
            fill: "colour",
            insetTop: 2,
            insetBottom: 2,
            rx: 2,
          }),
          Plot.text(model.items, {
            y: "name",
            x: isShare ? "share" : "n",
            text: (d: LeagueItem) => (isShare ? pct(d.share) : d.n.toLocaleString()),
            dx: 6,
            textAnchor: "start",
            fill: INK_2,
            fontSize: 11,
            fontWeight: 500,
          }),
          Plot.tip(
            model.items,
            Plot.pointerY({
              y: "name",
              x: isShare ? "share" : "n",
              ...tipStyle,
              title: (d: LeagueItem) => {
                const move = !model.hasPrior
                  ? noYearAgo
                  : d.rankDelta === null
                    ? "New: not ranked a year earlier"
                    : d.rankDelta > 0
                    ? `Up ${d.rankDelta} place${d.rankDelta > 1 ? "s" : ""} (was #${d.priorRank})`
                    : d.rankDelta < 0
                    ? `Down ${Math.abs(d.rankDelta)} place${Math.abs(d.rankDelta) > 1 ? "s" : ""} (was #${d.priorRank})`
                    : "Same place";
                return readout({
                  name: `#${d.rank} ${d.name}`,
                  period: spanPeriod(currentFrom, end),
                  share: d.share,
                  n: d.n,
                  base: model.currentDenom,
                  extra: [
                    move,
                    ...(d.shareDelta !== undefined ? [`Change in share: ${shareChange(d.shareDelta)}`] : []),
                    ...(showYear ? yearLine(d) : []),
                  ],
                });
              },
            }),
          ),
        ],
      });
    },
    [model, displayMode, currentFrom, end, showYear],
  );

  const countHead = (
    <th scope="col" data-hint="the number of vehicles" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
      {words?.count_heading ?? "Vehicles"}
    </th>
  );
  const yearHead = (
    <th scope="col" data-hint="the change on a year ago" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
      Change on a year ago
    </th>
  );

  return (
    <>
      <div className="controls" style={{ marginBottom: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <div className="toggle" role="radiogroup" aria-label="How many to show">
          {[10, 15, 25].map((n) => (
            <label key={n}>
              <input
                type="radio"
                name={`topn-${preset.id}`}
                checked={topN === n}
                onChange={() => setTopN(n)}
              />{" "}
              Top {n}
            </label>
          ))}
        </div>

        {offersCount ? (
        <div className="toggle" role="radiogroup" aria-label="Show as">
          <label>
            <input
              type="radio"
              name={`metric-${preset.id}`}
              checked={displayMode === "share"}
              onChange={() => setDisplayMode("share")}
            />{" "}
            Share
          </label>
          <label>
            <input
              type="radio"
              name={`metric-${preset.id}`}
              checked={displayMode === "count"}
              onChange={() => setDisplayMode("count")}
            />{" "}
            Number of vehicles
          </label>
        </div>
        ) : null}

        {onMonth && available.length > 1 ? (
          <label className="month-pick">
            {span === 1 ? "Month" : "Ranking ends in"}
            <select value={end} onChange={(e) => onMonth(e.target.value)}>
              {available.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {monthNotice ? <p className="chart-unit" role="status">{monthNotice}</p> : null}
      <p className="chart-unit">{basis}</p>

      <PlotFigure
        render={render}
        label={`Ranked bar chart, ${spanPeriod(currentFrom, end)}: the ${model.items.length} largest by ${displayMode === "share" ? "share" : "number of vehicles"}. The table below the chart lists each place, its move and its change.`}
      />

      {/* On a phone the table scrolls sideways in its own box, so the box takes keyboard focus and a name. The
          share and its change come before the count and the earlier rank, so what a phone shows without scrolling
          is the ranking itself. Headings stay on one line: a heading that wraps in a narrow column makes the whole
          header row tall, which read as a blank gap under the chart. */}
      <div ref={tableBox} className="table-scroll" role="region" aria-label="Ranking table" tabIndex={0} style={{ marginTop: "var(--space-4)" }}>
        <table className="key" style={{ width: "100%", fontSize: "13px" }}>
          <thead>
            <tr>
              <th scope="col" style={{ width: "45px" }}>Rank</th>
              <th scope="col" style={{ width: "56px" }}>Move</th>
              <th scope="col">{valueHeading}</th>
              {showYear ? countHead : null}
              {showYear ? yearHead : null}
              <th scope="col" data-hint="the share" style={{ textAlign: "right", whiteSpace: "nowrap" }}>Share</th>
              <th scope="col" data-hint="the change in share" style={{ textAlign: "right", whiteSpace: "nowrap" }}>Change in share</th>
              {showYear ? null : countHead}
              <th scope="col" data-hint="the rank a year earlier" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                Rank <span className="visually-hidden">a year </span>before
              </th>
            </tr>
          </thead>
          <tbody>
            {model.items.map((item) => {
              const hasMovement = item.rankDelta !== null;
              const isUp = hasMovement && (item.rankDelta as number) > 0;
              const isDown = hasMovement && (item.rankDelta as number) < 0;

              return (
                <tr key={item.value}>
                  <td style={{ fontWeight: 700, color: item.rank <= 3 ? "var(--ink)" : "var(--ink-2)" }}>
                    #{item.rank}
                  </td>
                  <td>
                    {!model.hasPrior ? (
                      <span style={{ color: "var(--ink-3)", fontSize: "12px" }}>
                        <span aria-hidden="true">—</span>
                        <span className="visually-hidden">{noYearAgo}</span>
                      </span>
                    ) : !hasMovement ? (
                      <span className="badge" style={{ background: "rgba(3, 105, 161, 0.1)", color: "#0369a1", fontSize: "11px" }}>
                        New
                      </span>
                    ) : isUp ? (
                      <span style={{ color: "#15803d", fontWeight: 600, fontSize: "12px" }}>
                        <span aria-hidden="true">▲</span> +{item.rankDelta}
                      </span>
                    ) : isDown ? (
                      <span style={{ color: "#b91c1c", fontWeight: 600, fontSize: "12px" }}>
                        <span aria-hidden="true">▼</span> {item.rankDelta}
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-3)", fontSize: "12px" }}>
                        <span aria-hidden="true">—</span>
                        <span className="visually-hidden">Same place</span>
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="swatch" style={{ background: item.colour }} aria-hidden="true" />
                    <strong>{item.name}</strong>
                  </td>
                  {showYear ? <td className="figure">{item.n.toLocaleString()}</td> : null}
                  {showYear ? (
                    <td className="change" style={{ textAlign: "right" }}>
                      {item.yearChange === undefined ? "—" : signed(item.yearChange)}
                    </td>
                  ) : null}
                  <td className="figure">{pct(item.share)}</td>
                  <td className="change" style={{ textAlign: "right" }}>
                    {item.shareDelta === undefined ? "—" : shareChange(item.shareDelta)}
                  </td>
                  {showYear ? null : <td className="figure">{item.n.toLocaleString()}</td>}
                  <td style={{ textAlign: "right", color: "var(--ink-3)" }}>
                    {item.priorRank !== null ? `#${item.priorRank}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hiddenColumns.length > 0 ? (
        <p className="scroll-hint">
          The table scrolls sideways: {hiddenColumns.length > 1 ? `${hiddenColumns.slice(0, -1).join(", ")} and ${hiddenColumns[hiddenColumns.length - 1]}` : hiddenColumns[0]}{" "}
          {hiddenColumns.length > 1 ? "are" : "is"} to the right.
        </p>
      ) : null}
    </>
  );
}
