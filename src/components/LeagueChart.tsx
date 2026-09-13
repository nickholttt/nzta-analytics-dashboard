// league: ranked horizontal bar + rank delta. Measure = count/share, single period, high-cardinality dimension.
import * as Plot from "@observablehq/plot";
import { useCallback, useMemo, useState } from "react";
import type { Dimension, Preset } from "../lib/config";
import type { Manifest, SliceRow } from "../lib/data";
import { TRAILING_MONTHS, addMonths, monthLabel, monthRange, pct, shareChange } from "../lib/measures";
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
  shareDelta: number;
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
  lead?: boolean;
};

export function LeagueChart({ preset, dimension, rows, manifest, minDenominator, label, lead = false }: Props) {
  const [topN, setTopN] = useState<number>(preset.top_n ?? 15);
  const [displayMode, setDisplayMode] = useState<"share" | "count">("share");

  const latest = manifest.latest_snapshot.slice(0, 7);
  const currentFrom = addMonths(latest, -(TRAILING_MONTHS - 1));
  const priorFrom = addMonths(latest, -(2 * TRAILING_MONTHS - 1));
  const priorTo = addMonths(latest, -TRAILING_MONTHS);

  const model = useMemo(() => {
    const currentCounts = new Map<string, number>();
    const priorCounts = new Map<string, number>();
    const monthDenoms = new Map<string, number>();

    for (const r of rows) {
      if (!monthDenoms.has(r.month)) {
        monthDenoms.set(r.month, r.denominator);
      }
      if (r.month >= currentFrom && r.month <= latest) {
        currentCounts.set(r.value, (currentCounts.get(r.value) ?? 0) + r.n);
      } else if (r.month >= priorFrom && r.month <= priorTo) {
        priorCounts.set(r.value, (priorCounts.get(r.value) ?? 0) + r.n);
      }
    }

    let currentDenom = 0;
    for (const m of monthRange(currentFrom, latest)) {
      currentDenom += monthDenoms.get(m) ?? 0;
    }
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
      const shareDelta = share - priorShare;

      // Clean name formatting for models e.g. "TOYOTA|RAV4" -> "Toyota RAV4"
      let formattedName = label(val);
      if (dimension.id === "model" && val.includes("|")) {
        const [make, mod] = val.split("|");
        formattedName = `${make} ${mod}`;
      }

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
        colour: seriesColour(idx),
        isRemainder: false,
      };
    });

    return {
      items: topItems,
      currentDenom,
      priorDenom,
      currentPeriodLabel: `${monthLabel(currentFrom)} – ${monthLabel(latest)}`,
      priorPeriodLabel: `${monthLabel(priorFrom)} – ${monthLabel(priorTo)}`,
    };
  }, [rows, latest, currentFrom, priorFrom, priorTo, topN, dimension, label]);

  const render = useCallback(
    (width: number) => {
      const height = Math.max(340, model.items.length * 24 + 60);
      const isShare = displayMode === "share";
      const maxVal = Math.max(0.01, ...model.items.map((d) => (isShare ? d.share : d.n)));
      const xMax = maxVal * 1.18;

      return Plot.plot({
        width,
        height,
        style: plotStyle,
        marginLeft: Math.min(180, Math.max(110, width * 0.28)),
        marginRight: 45,
        marginTop: 20,
        marginBottom: 30,
        y: {
          domain: model.items.map((d) => d.name),
          label: null,
          tickSize: 0,
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
                const move =
                  d.rankDelta === null
                    ? "New entrant in top ranks"
                    : d.rankDelta > 0
                    ? `▲ Up ${d.rankDelta} spot${d.rankDelta > 1 ? "s" : ""} (was #${d.priorRank})`
                    : d.rankDelta < 0
                    ? `▼ Down ${Math.abs(d.rankDelta)} spot${Math.abs(d.rankDelta) > 1 ? "s" : ""} (was #${d.priorRank})`
                    : `Unchanged (held #${d.rank})`;
                return `#${d.rank} · ${d.name}\n${d.n.toLocaleString()} vehicles · ${pct(d.share)} share\nRank movement: ${move}\nShare delta: ${shareChange(d.shareDelta)}`;
              },
            }),
          ),
        ],
      });
    },
    [model, displayMode],
  );

  return (
    <>
      <div className="controls" style={{ marginBottom: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <div className="toggle" role="radiogroup" aria-label="Top N Leaders">
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

        <div className="toggle" role="radiogroup" aria-label="Display Metric">
          <label>
            <input
              type="radio"
              name={`metric-${preset.id}`}
              checked={displayMode === "share"}
              onChange={() => setDisplayMode("share")}
            />{" "}
            Market share (%)
          </label>
          <label>
            <input
              type="radio"
              name={`metric-${preset.id}`}
              checked={displayMode === "count"}
              onChange={() => setDisplayMode("count")}
            />{" "}
            Vehicle count
          </label>
        </div>
      </div>

      <p className="chart-unit">
        Ranked by registrations in trailing 12 months ({model.currentPeriodLabel}). Rank movement compares against {model.priorPeriodLabel}.
      </p>

      <PlotFigure render={render} />

      <div style={{ overflowX: "auto", marginTop: "var(--space-4)" }}>
        <table className="key" style={{ width: "100%", fontSize: "13px" }}>
          <thead>
            <tr>
              <th scope="col" style={{ width: "45px" }}>Rank</th>
              <th scope="col" style={{ width: "70px" }}>Trend</th>
              <th scope="col">Nameplate</th>
              <th scope="col" style={{ textAlign: "right" }}>Trailing 12M Vehicles</th>
              <th scope="col" style={{ textAlign: "right" }}>Market Share</th>
              <th scope="col" style={{ textAlign: "right" }}>Share Change</th>
              <th scope="col" style={{ textAlign: "right" }}>Prior Rank</th>
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
                    {!hasMovement ? (
                      <span className="badge" style={{ background: "rgba(2, 132, 199, 0.1)", color: "#0284c7", fontSize: "11px" }}>
                        New
                      </span>
                    ) : isUp ? (
                      <span style={{ color: "#16a34a", fontWeight: 600, fontSize: "12px" }}>
                        ▲ +{item.rankDelta}
                      </span>
                    ) : isDown ? (
                      <span style={{ color: "#dc2626", fontWeight: 600, fontSize: "12px" }}>
                        ▼ {item.rankDelta}
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-3)", fontSize: "12px" }}>
                        —
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="swatch" style={{ background: item.colour }} aria-hidden="true" />
                    <strong>{item.name}</strong>
                    {dimension.id === "model" ? (
                      <a
                        href={`/inspector?q=q_suv&model=${encodeURIComponent(item.value)}`}
                        className="meta"
                        style={{ marginLeft: "var(--space-2)", fontSize: "11px", textDecoration: "none", color: "var(--accent)" }}
                        title={`Inspect ${item.name} statutory body type`}
                      >
                        Inspect ↗
                      </a>
                    ) : (
                      <a
                        href={`/inspector?q=q1&make=${encodeURIComponent(item.value)}`}
                        className="meta"
                        style={{ marginLeft: "var(--space-2)", fontSize: "11px", textDecoration: "none", color: "var(--accent)" }}
                        title={`Inspect ${item.name} breakdown`}
                      >
                        Inspect ↗
                      </a>
                    )}
                  </td>
                  <td className="figure">{item.n.toLocaleString()}</td>
                  <td className="figure">{pct(item.share)}</td>
                  <td className="change" style={{ textAlign: "right" }}>
                    {shareChange(item.shareDelta)}
                  </td>
                  <td style={{ textAlign: "right", color: "var(--ink-3)" }}>
                    {item.priorRank !== null ? `#${item.priorRank}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
