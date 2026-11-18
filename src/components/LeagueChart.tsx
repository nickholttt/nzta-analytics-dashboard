// league: ranked horizontal bar + rank delta. Measure = count/share, single period, high-cardinality dimension.
import * as Plot from "@observablehq/plot";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { datasetWords, findDataset, findPeriod, phrases, yearChangeFloor } from "../lib/config";
import type { Dimension, Preset } from "../lib/config";
import { datasetFirstMonth } from "../lib/built";
import { SMALL_CELL_KEY, ruleMinimum } from "../lib/data";
import type { Manifest, SliceRow } from "../lib/data";
import { TRAILING_MONTHS, addMonths, minDenominator as floorOf, monthLabel, monthRange, pct, shareChange } from "../lib/measures";
import { countedText, fillTemplate, pickedRankingSentences, rankingLeaderSentence, rankingText, rankingWindows, rankingWords, sayBadMonth, vehiclesText, yearTooFewText } from "../lib/sentences";
import { count, greyedReason, readout, spanPeriod } from "../lib/readout";
import { latestMonthOf, servedFrom } from "../lib/resolve";
import {
  FONT_TEXT,
  INK,
  INK_2,
  INK_3,
  PAPER,
  REMAINDER,
  RULE,
  RULE_STRONG,
  SUPPRESSED_LINE,
  chartHeight,
  plotStyle,
  seriesColour,
  tipStyle,
} from "../lib/theme";
import { cellAt, cellText } from "../lib/figures";
import { leaderIsClear, leagueRows, leagueTable, pickedSummary, rankingGuard, rankingLimit } from "../lib/league";
import { useFigures } from "./FiguresContext";
import type { LeagueRow } from "../lib/league";
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

export type LeagueItem = LeagueRow & { colour: string; isRemainder: boolean };

type Props = {
  preset: Preset;
  dimension: Dimension;
  rows: SliceRow[];
  // The first month the dataset has vehicles in (data.ts, loadFirstMonth): where a year-before comparison can begin.
  firstMonth?: string;
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
  // The panel's definition, links and time range, drawn straight under the answer, as the trend chart's are.
  after?: () => ReactNode;
};

// The change on a year ago, as a percentage with its sign.
const signed = (x: number) => `${x > 0.0005 ? "+" : x < -0.0005 ? "−" : "±"}${Math.abs(x * 100).toFixed(Math.abs(x) * 100 < 10 ? 1 : 0)}%`;

// Bars follow the preset's measure. A count is offered beside the share only when the measure is not
// share: on a share preset the dataset may be one whose counts read as sales (D-044).
export function LeagueChart({ preset, dimension, rows, firstMonth, manifest, minDenominator, label, valueHeading, lead = false, month, onMonth, after }: Props) {
  const [topN, setTopN] = useState<number>(preset.top_n ?? 15);
  // A ranking of the values a visitor chose (D-111): it lists all of them, and says it is a ranking among them.
  const picked = preset.values && preset.values.length > 0 ? preset.values : undefined;
  // Whether the visitor chose them, or they are the values the page started from: the page says which, in its words for each.
  const own = !preset.page_values;
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
  const once = findDataset(preset.dataset)?.single_period ? words?.window_one : undefined;
  // What the ranking covers and whether there are figures a year earlier: decided from the rows, in one place.
  const ranking = useMemo(
    () => rankingText(phrases, { basis: words?.ranking_basis ?? "Ranked by vehicles {window}", span, end, latest, once, covers: { first: datasetFirstMonth(manifest.datasets[servedFrom(preset.dataset, manifest) ?? ""], firstMonth), last: latest } }),
    [words, span, end, latest, once, manifest, preset.dataset, firstMonth],
  );
  // A dataset with one period has no earlier window: no move, no change on a year ago, no rank before, and no series (src/lib/league.ts).
  const single = Boolean(findDataset(preset.dataset)?.single_period);
  const showYear = Boolean(findDataset(preset.dataset)?.shows_year_change) && !single;
  // The least count a table shows, as its manifest entry says it applied the rule, for the words about hidden counts.
  const minimum = ruleMinimum(manifest, preset.dataset, SMALL_CELL_KEY, dimension.id);
  const yearFloor = yearChangeFloor();

  // The floor a share is read against: the share measure's own, whatever the preset counts, since a ranking prints shares
  // (docs/METRICS.md, "A ranking and the precision floor").
  const floor = floorOf("share");
  const model = useMemo(() => {
    const result = leagueRows({ rows, currentFrom, end, priorFrom, priorTo, hasPrior: ranking.hasPrior && !single, topN: rankingLimit({ single, picked, topN }), nameOf: label, yearFloor });
    const items: LeagueItem[] = result.items.map((item, idx) => ({ ...item, colour: seriesColour(idx), isRemainder: false }));
    const guard = rankingGuard({
      floor,
      currentDenom: result.currentDenom,
      priorDenom: result.priorDenom,
      hasPrior: ranking.hasPrior,
      ...rankingWords(phrases, { span, end, latest, once }),
      single: span === 1,
      phrases,
    });
    return { items, hidden: result.hidden, hiddenAtMost: result.hiddenAtMost, notBrokenDown: result.notBrokenDown, currentDenom: result.currentDenom, priorDenom: result.priorDenom, hasPrior: ranking.hasPrior && !single, tiedBeyond: result.tiedBeyond, guard: items.length > 0 ? guard : { shares: false, changes: false, sentence: undefined } };
  }, [rows, end, currentFrom, priorFrom, priorTo, yearFloor, topN, label, ranking, floor, picked, single, once]);

  // What the page says about the choice: how it is ranked, who leads, who is not ranked and what a share is a share of.
  const windowWords = rankingWords(phrases, { span, end, latest, once }).window;
  const about = useMemo(() => {
    if (!picked) return undefined;
    const summary = pickedSummary(picked, model.items, label);
    return pickedRankingSentences(phrases, {
      own,
      picked: picked.length,
      field: valueHeading.charAt(0).toLowerCase() + valueHeading.slice(1),
      months: TRAILING_MONTHS,
      window: windowWords,
      leaders: summary.leaders,
      counted: countedText(words?.leader_count, summary.leaderCount, windowWords),
      unranked: summary.unranked,
      total: model.currentDenom,
      conditions: Object.values(preset.where ?? {}).some((kept) => kept.length > 0),
    });
  }, [picked, own, model, label, valueHeading, windowWords, words, preset.where]);
  // The answer of a ranking of every value: who is first, with how many.
  const leaderAnswer = useMemo(() => {
    if (picked || !(preset.ranks_all || single) || model.items.length === 0) return undefined;
    const first = model.items.filter((i) => i.rank === 1);
    // A hidden count could be as large as the leader's: then nobody is named.
    if (!leaderIsClear(first[0].n, model.hiddenAtMost)) return undefined;
    return rankingLeaderSentence(phrases, first.map((i) => i.name), countedText(words?.leader_count, first[0].n, windowWords));
  }, [picked, preset.ranks_all, single, model, words, windowWords]);
  // The earlier window in the words of the window ranked, so a ranking of twelve months does not speak of a month.
  const yearTooFew = yearTooFewText(phrases, span, end);

  const basis = single ? `${fillTemplate(words?.ranking_basis ?? "{window}", { window: windowWords }).text}.` : ranking.text;
  const hiddenWords = useMemo(
    () => ({ text: phrases.hidden_word, reason: fillTemplate(phrases.hidden_reason, { minimum }).text }),
    [minimum],
  );
  const hiddenNote = model.hidden.length
    ? fillTemplate(model.hidden.length === 1 ? phrases.hidden_ranking_note_one : phrases.hidden_ranking_note, { count: model.hidden.length, minimum })
    : undefined;
  // The table of the ranking, built once: the page draws it and the file of figures writes it (src/lib/figures.ts).
  const table = useMemo(
    () =>
      leagueTable(model.items, {
        compares: !single,
        hiddenValues: model.hidden,
        hiddenWords,
        hasPrior: model.hasPrior,
        showYear,
        guard: model.guard,
        floor,
        valueHeading,
        countHeading: words?.count_heading ?? "Vehicles",
        headings: about ? { rank: about.rankHead, share: about.shareHead, prior: about.priorHead } : undefined,
        words: {
          noYearAgo: phrases.no_year_ago,
          yearTooFew,
          shareChangeNoPrior: phrases.share_change_no_prior,
          notRankedBefore: phrases.not_ranked_before,
        },
        format: { count: (n) => n.toLocaleString(), pct, shareChange, yearChange: signed },
      }),
    [model, showYear, floor, valueHeading, words, about, yearTooFew, single, hiddenWords],
  );
  const figures = useCallback(() => ({ period: spanPeriod(currentFrom, end), columns: table.columns, rows: table.rows }), [table, currentFrom, end]);
  useFigures(figures);
  const monthNotice = sayBadMonth(phrases.bad_month, month, end);
  const noYearAgo = fillTemplate(phrases.no_year_ago, {}).text;
  const yearLine = (d: LeagueItem) => {
    if (d.yearChange === undefined) return model.hasPrior ? [yearTooFew] : [];
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
      const shown = [...model.items.map((d) => d.name), ...model.hidden.map((d) => d.name)];
      const height = Math.max(single ? 120 : 340, shown.length * 24 + 60);
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
          domain: shown,
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
            fill: isShare && model.guard.shares ? SUPPRESSED_LINE : "colour",
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
          // A hidden value has no bar: its name stands on the axis with the word at the start of the row, never a bar of zero length that reads as zero.
          Plot.text(model.hidden, { y: "name", x: 0, text: () => phrases.hidden_word, dx: 6, textAnchor: "start", fill: INK_3, fontSize: 11, fontStyle: "italic" }),
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
                  greyed: model.guard.shares ? "thin" : undefined,
                  minDenominator: floor,
                  extra: [
                    move,
                    ...(d.shareDelta !== undefined ? [`Change in share: ${shareChange(d.shareDelta)}`, ...(model.guard.changes && !model.guard.shares ? [greyedReason("thin", floor)] : [])] : []),
                    ...(showYear ? yearLine(d) : []),
                  ],
                });
              },
            }),
          ),
        ],
      });
    },
    [model, displayMode, currentFrom, end, showYear, floor, single],
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

  const answer =
    about || leaderAnswer ? (
      <div className="answer">
        {model.items.length > 0 ? <p className="answer-figure" aria-hidden="true">{count(model.items[0].n)}</p> : null}
        <p className="answer-sentence">{about ? about.leader : leaderAnswer}</p>
        {about && model.items.length > 0 ? <p className="chart-unit">{about.label}</p> : null}
        {about && model.items.length > 0 ? about.unranked.map((sentence) => <p key={sentence} className="chart-unit">{sentence}</p>) : null}
      </div>
    ) : null;
  const monthPick =
    onMonth && available.length > 1 ? (
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
    ) : null;

  // The field does not break this period down: no value, no bar and no rank, only the total and a sentence that says so.
  if (model.notBrokenDown) {
    return (
      <>
        {after?.()}
        <p className="chart-unit">{fillTemplate(phrases.not_broken_down, { window: windowWords, vehicles: vehiclesText(model.currentDenom) }).text}</p>
        <p className="chart-unit"><a href="/method#hidden-counts">{phrases.hidden_link}</a></p>
      </>
    );
  }

  // None of the values has a vehicle in the window: one sentence, in place of an empty chart and table.
  if (picked && model.items.length === 0) {
    return (
      <>
        {answer}
        {after?.()}
        {monthNotice ? <p className="chart-unit" role="status">{monthNotice}</p> : null}
        {monthPick ? <div className="controls" style={{ marginBottom: "var(--space-3)" }}>{monthPick}</div> : null}
      </>
    );
  }

  return (
    <>
      {answer}
      {after?.()}
      <div className="controls" style={{ marginBottom: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
        {picked || single ? null : (
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
        )}

        {offersCount ? (
        <div className="toggle" role="radiogroup" aria-label="Show bars as">
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

        {monthPick}
      </div>

      {monthNotice ? <p className="chart-unit" role="status">{monthNotice}</p> : null}
      <p className="chart-unit">{basis}</p>
      {about?.share ? <p className="chart-unit">{about.share}</p> : null}
      {model.guard.sentence ? <p className="chart-unit">{model.guard.sentence}</p> : null}
      {hiddenNote ? (
        <p className="chart-unit">
          {hiddenNote.text} <a href="/method#hidden-counts">{phrases.hidden_link}</a>
        </p>
      ) : null}

      <PlotFigure
        render={render}
        label={`Ranked bar chart, ${single ? windowWords : spanPeriod(currentFrom, end)}: the ${model.items.length} ${single ? "values" : "largest"}${model.hidden.length ? ` and ${model.hidden.length} with a hidden count` : ""} by ${displayMode === "share" ? "share" : "number of vehicles"}. ${single ? "The table below the chart lists each place." : "The table below the chart lists each place, its move and its change."}`}
      />

      {/* On a phone the table scrolls sideways in its own box, so the box takes keyboard focus and a name. The
          share and its change come before the count and the earlier rank, so what a phone shows without scrolling
          is the ranking itself. Headings stay on one line: a heading that wraps in a narrow column makes the whole
          header row tall, which read as a blank gap under the chart. */}
      <div ref={tableBox} className="table-scroll" role="region" aria-label="Ranking table" tabIndex={0} style={{ marginTop: "var(--space-4)" }}>
        <table className="key" style={{ width: "100%", fontSize: "13px" }}>
          <thead>
            <tr>
              <th scope="col" style={about ? { whiteSpace: "nowrap" } : { width: "45px" }}>{about ? about.rankHead : "Rank"}</th>
              {single ? null : <th scope="col" style={{ width: "56px" }}>Move</th>}
              <th scope="col">{valueHeading}</th>
              {showYear ? countHead : null}
              {showYear ? yearHead : null}
              <th scope="col" data-hint="the share" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{about ? about.shareHead : "Share"}</th>
              {single ? null : <th scope="col" data-hint="the change in share" style={{ textAlign: "right", whiteSpace: "nowrap" }}>Change in share</th>}
              {showYear ? null : countHead}
              {single ? null : (
                <th scope="col" data-hint="the rank a year earlier" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {about ? about.priorHead : <>Rank <span className="visually-hidden">a year </span>before</>}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {model.items.map((item, at) => {
              const hasMovement = item.rankDelta !== null;
              const isUp = hasMovement && (item.rankDelta as number) > 0;
              const isDown = hasMovement && (item.rankDelta as number) < 0;

              return (
                <tr key={item.value}>
                  <td style={{ fontWeight: 700, color: item.rank <= 3 ? "var(--ink)" : "var(--ink-2)" }}>
                    #{item.rank}
                  </td>
                  {single ? null : <td>
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
                  </td>}
                  <td>
                    <span className="swatch" style={{ background: item.colour }} aria-hidden="true" />
                    <strong>{item.name}</strong>
                  </td>
                  {showYear ? <td className="figure">{cellText(cellAt(table, at, "count"))}</td> : null}
                  {showYear ? (
                    <td className="change" style={{ textAlign: "right" }}>
                      {cellText(cellAt(table, at, "year"))}
                    </td>
                  ) : null}
                  <td className={model.guard.shares ? "figure greyed" : "figure"}>
                    {model.guard.shares ? <span className="visually-hidden">Greyed: </span> : null}
                    {cellText(cellAt(table, at, "share"))}
                  </td>
                  {single ? null : <td className={model.guard.changes && item.shareDelta !== undefined ? "change greyed" : "change"} style={{ textAlign: "right" }}>
                    {item.shareDelta === undefined ? (
                      cellText(cellAt(table, at, "change"))
                    ) : (
                      <>
                        {model.guard.changes ? <span className="visually-hidden">Greyed: </span> : null}
                        {cellText(cellAt(table, at, "change"))}
                      </>
                    )}
                  </td>}
                  {showYear ? null : <td className="figure">{cellText(cellAt(table, at, "count"))}</td>}
                  {single ? null : <td style={{ textAlign: "right", color: "var(--ink-3)" }}>
                    {cellText(cellAt(table, at, "before"))}
                  </td>}
                </tr>
              );
            })}
            {/* A value whose count is hidden stands after the ranked ones: its rank, share and count each say hidden, in the word config gives. */}
            {model.hidden.map((item, at) => (
              <tr key={item.value} className="hidden-row">
                {table.columns.map((column, c) => (
                  <td key={column.key} className={column.key === "name" ? undefined : "figure"} style={column.key === "name" ? undefined : { textAlign: "right" }}>
                    {column.key === "name" ? <strong>{item.name}</strong> : cellText(table.rows[model.items.length + at][c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.notes.map((note) => (
        <p key={`${note.column}|${note.reason}`} className="chart-unit">
          {note.column}: {note.reason.charAt(0).toLowerCase() + note.reason.slice(1)}
        </p>
      ))}
      {model.tiedBeyond > 0 ? <p className="chart-unit">{fillTemplate(phrases.tie_beyond_cut, { count: model.tiedBeyond }).text}</p> : null}
      {hiddenColumns.length > 0 ? (
        <p className="scroll-hint">
          The table scrolls sideways: {hiddenColumns.length > 1 ? `${hiddenColumns.slice(0, -1).join(", ")} and ${hiddenColumns[hiddenColumns.length - 1]}` : hiddenColumns[0]}{" "}
          {hiddenColumns.length > 1 ? "are" : "is"} to the right.
        </p>
      ) : null}
    </>
  );
}
