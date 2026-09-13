import * as Plot from "@observablehq/plot";
import React, { useEffect, useMemo, useRef, useState } from "react";
import intelData from "../data/market_intelligence.json";
import countrySilhouettes from "../data/country_silhouettes.json";
import { PlotFigure } from "./PlotFigure";
import { INK_2, PAPER, RULE_STRONG, plotStyle, tipStyle } from "../lib/theme";

type BenchmarkMetric = "units_per_brand" | "brands_per_million" | "total_units" | "brands_count";
type TimelinePerspective = "brands_and_volume" | "concentration";

export function ComplexityBenchmark() {
  const [metric, setMetric] = useState<BenchmarkMetric>("units_per_brand");
  const [selectedCountryId, setSelectedCountryId] = useState<string>("new_zealand");
  const [timelineView, setTimelineView] = useState<TimelinePerspective>("brands_and_volume");
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [simVolume, setSimVolume] = useState<number>(262); // 2025 NZ median brand volume

  const benchmarkList = intelData.international_benchmark;
  const selectedCountry = benchmarkList.find((c) => c.id === selectedCountryId) || benchmarkList[4];

  // Observable Plot for NZ Complexity Timeline (2015-2026)
  const renderTimelinePlot = (width: number) => {
    const data = intelData.nz_complexity_timeline;

    if (timelineView === "brands_and_volume") {
      return Plot.plot({
        width,
        height: 280,
        style: plotStyle,
        x: {
          tickFormat: (d) => String(d),
          label: "Year",
        },
        y: {
          label: "Active Brands Count (≥1 unit registered)",
          domain: [50, 100],
          grid: true,
        },
        marks: [
          Plot.ruleY([60], { stroke: "#94a3b8", strokeDasharray: "3,3" }),
          Plot.lineY(data, {
            x: "year",
            y: "brands_count",
            stroke: "#0284c7",
            strokeWidth: 2.5,
            curve: "monotone-x",
          }),
          Plot.dot(data, {
            x: "year",
            y: "brands_count",
            fill: "#0284c7",
            stroke: PAPER,
            strokeWidth: 2,
            r: 4.5,
            tip: {
              ...tipStyle,
              format: {
                x: (d) => `${d}`,
                y: (d) => `${d} active brands`,
              },
            },
          }),
          Plot.text(
            data.filter((d) => d.year === 2020 || d.year === 2025),
            {
              x: "year",
              y: "brands_count",
              text: (d) => `${d.brands_count} brands\n(Avg ${d.avg_units.toLocaleString()} / Med ${d.median_units})`,
              dy: -16,
              fontSize: 11,
              fontWeight: 600,
              fill: "var(--ink)",
            },
          ),
        ],
      });
    } else {
      // Concentration view: Top 3 vs Top 5 vs Top 10 Share %
      return Plot.plot({
        width,
        height: 280,
        style: plotStyle,
        x: {
          tickFormat: (d) => String(d),
          label: "Year",
        },
        y: {
          label: "Market Share (%)",
          domain: [0, 100],
          grid: true,
        },
        color: {
          domain: ["Top 3 Brands", "Top 5 Brands", "Top 10 Brands"],
          range: ["#0284c7", "#0d9488", "#b45309"],
          legend: true,
        },
        marks: [
          Plot.lineY(data, {
            x: "year",
            y: "top10_share",
            stroke: "#b45309",
            strokeWidth: 2,
            curve: "monotone-x",
          }),
          Plot.dot(data, {
            x: "year",
            y: "top10_share",
            fill: "#b45309",
            r: 3.5,
            tip: {
              ...tipStyle,
              format: {
                x: (d) => `${d}`,
                y: (d) => `Top 10 Share: ${d}%`,
              },
            },
          }),
          Plot.lineY(data, {
            x: "year",
            y: "top5_share",
            stroke: "#0d9488",
            strokeWidth: 2,
            curve: "monotone-x",
          }),
          Plot.dot(data, {
            x: "year",
            y: "top5_share",
            fill: "#0d9488",
            r: 3.5,
            tip: {
              ...tipStyle,
              format: {
                x: (d) => `${d}`,
                y: (d) => `Top 5 Share: ${d}%`,
              },
            },
          }),
          Plot.lineY(data, {
            x: "year",
            y: "top3_share",
            stroke: "#0284c7",
            strokeWidth: 2.5,
            curve: "monotone-x",
          }),
          Plot.dot(data, {
            x: "year",
            y: "top3_share",
            fill: "#0284c7",
            r: 4,
            tip: {
              ...tipStyle,
              format: {
                x: (d) => `${d}`,
                y: (d) => `Top 3 Share: ${d}%`,
              },
            },
          }),
          Plot.text(
            data.filter((d) => d.year === 2025),
            {
              x: "year",
              y: "top3_share",
              text: (d) => `Top 3: ${d.top3_share}%\n(Toyota, Ford, Mitsu)`,
              dy: -14,
              dx: -20,
              fontSize: 10.5,
              fontWeight: 600,
              fill: "#0284c7",
            },
          ),
        ],
      });
    }
  };

  // Dealership Viability Simulation calculations
  const simCalculations = useMemo(() => {
    const weeklyRate = (simVolume / 52).toFixed(1);
    const dailyRate = (simVolume / 365).toFixed(1);
    const minDealers = 8; // Typical minimum viable national network (Akl North, Akl South, Hml, Tga, Hby, Wlg, Chc, Dun)
    const carsPerDealerPerMonth = (simVolume / minDealers / 12).toFixed(1);
    const carsPerDealerPerWeek = (simVolume / minDealers / 52).toFixed(2);

    let status = "Sustainable Standalone";
    let statusColor = "#16a34a";
    let summary = "Volume supports dedicated franchised dealer premises, dedicated sales staff, and comprehensive regional parts inventory.";

    if (simVolume < 200) {
      status = "Severe Long Tail Risk";
      statusColor = "#dc2626";
      summary = "Selling under 4 cars a week nationally. A standalone showroom is impossible. Can only survive as a boutique niche alongside major brands under a shared dealer group roof (e.g. Giltrap / Armstrong's).";
    } else if (simVolume < 1000) {
      status = "Boutique / Shared Franchise";
      statusColor = "#ea580c";
      summary = "Averages less than 1 car per dealership per week across an 8-site network. Requires dual-franchise showrooms and agency sales models to prevent dealer insolvency.";
    } else if (simVolume < 3000) {
      status = "Established Niche / Premium";
      statusColor = "#ca8a04";
      summary = "Viable for premium/luxury marques where gross margin per vehicle ($10,000+) offsets low unit throughput.";
    }

    return {
      weeklyRate,
      dailyRate,
      minDealers,
      carsPerDealerPerMonth,
      carsPerDealerPerWeek,
      status,
      statusColor,
      summary,
    };
  }, [simVolume]);

  return (
    <div className="complexity-benchmark" style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* 1. HERO INFOGRAPHIC BANNER */}
      <section
        style={{
          background: "linear-gradient(180deg, #091a36 0%, #0d2347 100%)",
          color: "#ffffff",
          borderRadius: "8px",
          padding: "var(--space-5)",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255, 255, 255, 0.12)", padding: "4px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#67e8f9", marginBottom: "8px" }}>
              <span>★</span> Global Automotive Benchmark
            </div>
            <h2 style={{ color: "#ffffff", margin: "0 0 6px", fontSize: "clamp(1.25rem, 2.5vw, 1.85rem)", fontWeight: 700, letterSpacing: "-0.02em" }}>
              New Vehicle Market Complexity and Competition
            </h2>
            <p style={{ margin: 0, color: "#93c5fd", fontSize: "14px", maxWidth: "750px", lineHeight: 1.5 }}>
              How national volume, brand proliferation, and distributor economics collide. While American and Chinese brands enjoy massive scale, New Zealand hosts 82+ active brands battling over just 134k registrations.
            </p>
          </div>

          {/* Metric Selector Buttons */}
          <div style={{ display: "flex", gap: "6px", background: "rgba(255, 255, 255, 0.08)", padding: "4px", borderRadius: "6px" }}>
            {[
              { id: "units_per_brand", label: "Units / Brand" },
              { id: "brands_per_million", label: "Brands / 1M Pop" },
              { id: "total_units", label: "Total Volume" },
              { id: "brands_count", label: "Active Brands" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetric(m.id as BenchmarkMetric)}
                style={{
                  background: metric === m.id ? "#ffffff" : "transparent",
                  color: metric === m.id ? "#091a36" : "#cbd5e1",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 5 Country Comparison Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "var(--space-3)",
            marginTop: "var(--space-4)",
          }}
        >
          {benchmarkList.map((c) => {
            const isSelected = selectedCountryId === c.id;
            const isNZ = c.id === "new_zealand";
            const silhouetteSvg = (countrySilhouettes as Record<string, string>)[c.id];

            let highlightedMetricValue = `${(c.units_per_brand / 1000).toFixed(0)}K`;
            let highlightedMetricLabel = "units/brand";

            if (metric === "brands_per_million") {
              highlightedMetricValue = `${c.brands_per_million.toFixed(2)}`;
              highlightedMetricLabel = "brands / million";
            } else if (metric === "total_units") {
              highlightedMetricValue = c.units;
              highlightedMetricLabel = "units registered";
            } else if (metric === "brands_count") {
              highlightedMetricValue = `${c.brands}`;
              highlightedMetricLabel = "active brands";
            }

            return (
              <div
                key={c.id}
                onClick={() => setSelectedCountryId(c.id)}
                style={{
                  background: isNZ ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.03)",
                  border: isNZ
                    ? "2px solid #38bdf8"
                    : isSelected
                    ? "1px solid #93c5fd"
                    : "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "6px",
                  padding: "var(--space-3)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  cursor: "pointer",
                  position: "relative",
                  transition: "transform 0.15s ease, border-color 0.15s ease",
                }}
              >
                {isNZ && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-10px",
                      background: "#38bdf8",
                      color: "#091a36",
                      fontSize: "9.5px",
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      padding: "2px 8px",
                      borderRadius: "100px",
                      textTransform: "uppercase",
                    }}
                  >
                    The Outlier
                  </div>
                )}

                {/* Country Silhouette */}
                <div style={{ height: "68px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", margin: "8px 0" }}>
                  {silhouetteSvg ? (
                    <svg viewBox="0 0 100 80" style={{ height: "100%", maxWidth: "120px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}>
                      <path d={silhouetteSvg} fill="#ffffff" />
                    </svg>
                  ) : (
                    <span style={{ fontSize: "36px" }}>{c.flag}</span>
                  )}
                </div>

                {/* Country Name & Sub-details */}
                <h3 style={{ margin: "4px 0 2px", color: "#ffffff", fontSize: "15px", fontWeight: 800, letterSpacing: "0.04em" }}>
                  {c.country}
                </h3>
                <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.35, marginBottom: "12px" }}>
                  <div><strong>{c.population}</strong> people</div>
                  <div><strong>{c.brands}</strong> brands</div>
                  <div><strong>{c.units}</strong> units registered</div>
                </div>

                {/* Bottom Highlighted Metric Box */}
                <div
                  style={{
                    marginTop: "auto",
                    width: "100%",
                    background: isNZ ? "#ffffff" : "rgba(255, 255, 255, 0.95)",
                    color: isNZ ? "#0369a1" : "#0f172a",
                    borderRadius: "4px",
                    padding: "8px 4px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  }}
                >
                  <div style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                    {highlightedMetricValue}
                  </div>
                  <div style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", opacity: 0.85 }}>
                    {highlightedMetricLabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Country Insight Detail Card */}
        <div
          style={{
            marginTop: "var(--space-4)",
            background: "rgba(0, 0, 0, 0.25)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "6px",
            padding: "var(--space-3) var(--space-4)",
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-4)",
            alignItems: "center",
          }}
        >
          <div style={{ flex: "1 1 300px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "18px" }}>{selectedCountry.flag}</span>
              <strong style={{ color: "#ffffff", fontSize: "14px" }}>{selectedCountry.country}: Commercial Structure & Scale</strong>
              <span className="badge" style={{ background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.4)", fontSize: "11px" }}>
                {selectedCountry.scale_vs_nz} NZ Market Volume
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#cbd5e1", lineHeight: 1.45 }}>
              {selectedCountry.dynamics}
            </p>
          </div>
          <div style={{ flex: "1 1 260px", fontSize: "12px", borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: "var(--space-3)" }}>
            <div style={{ color: "#93c5fd", fontWeight: 600, marginBottom: "2px" }}>Distribution & Dealer Framework:</div>
            <div style={{ color: "#e2e8f0", lineHeight: 1.4 }}>{selectedCountry.dealer_model}</div>
          </div>
        </div>
      </section>

      {/* 2. THE NEW ZEALAND FRAGMENTATION TIMELINE (2015-2026) */}
      <section style={{ border: "1px solid var(--rule)", borderRadius: "6px", padding: "var(--space-4)", background: "var(--paper)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
          <div>
            <span className="eyebrow">NZ Historical Evolution (2015–2026)</span>
            <h3 style={{ margin: "var(--space-1) 0 var(--space-1)", fontSize: "16px", fontWeight: 700 }}>
              The Proliferation Surge: 62 Brands in 2020 to 84 Brands Today
            </h3>
            <p className="meta" style={{ margin: 0 }}>
              Tracking active marques in the Motor Vehicle Register against average volume per brand and market concentration.
            </p>
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              type="button"
              onClick={() => setTimelineView("brands_and_volume")}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                borderRadius: "4px",
                border: timelineView === "brands_and_volume" ? "1px solid var(--ink)" : "1px solid var(--rule)",
                background: timelineView === "brands_and_volume" ? "var(--ink)" : "transparent",
                color: timelineView === "brands_and_volume" ? "var(--paper)" : "var(--ink)",
                fontWeight: timelineView === "brands_and_volume" ? 600 : 400,
                cursor: "pointer",
              }}
            >
              Active Brands & Mean Volume
            </button>
            <button
              type="button"
              onClick={() => setTimelineView("concentration")}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                borderRadius: "4px",
                border: timelineView === "concentration" ? "1px solid var(--ink)" : "1px solid var(--rule)",
                background: timelineView === "concentration" ? "var(--ink)" : "transparent",
                color: timelineView === "concentration" ? "var(--paper)" : "var(--ink)",
                fontWeight: timelineView === "concentration" ? 600 : 400,
                cursor: "pointer",
              }}
            >
              Market Concentration (Top 3/5/10)
            </button>
          </div>
        </div>

        {/* Observable Plot Figure */}
        <PlotFigure render={renderTimelinePlot} />

        {/* Key Timeline Takeaways */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-3)", marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--rule)" }}>
          <div style={{ fontSize: "12px" }}>
            <span style={{ color: "var(--ink-3)" }}>Peak Market Volume (2021):</span>
            <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--ink)" }}>157,557 registrations · 63 brands</div>
            <div style={{ color: "var(--ink-2)" }}>Average 2,501 units/brand (Median: 502)</div>
          </div>
          <div style={{ fontSize: "12px" }}>
            <span style={{ color: "var(--ink-3)" }}>Peak Brand Count (2025):</span>
            <div style={{ fontWeight: 700, fontSize: "14px", color: "#0284c7" }}>82 active brands · 133,795 registrations</div>
            <div style={{ color: "var(--ink-2)" }}>Average 1,632 units/brand (Median: 262)</div>
          </div>
          <div style={{ fontSize: "12px" }}>
            <span style={{ color: "var(--ink-3)" }}>Top 3 Domination (2025):</span>
            <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--ink)" }}>46.0% market share</div>
            <div style={{ color: "var(--ink-2)" }}>Toyota, Ford & Mitsubishi take 61,570 units</div>
          </div>
          <div style={{ fontSize: "12px" }}>
            <span style={{ color: "var(--ink-3)" }}>The Long Tail Reality:</span>
            <div style={{ fontWeight: 700, fontSize: "14px", color: "#b45309" }}>37 brands sell &lt; 200 cars/year</div>
            <div style={{ color: "var(--ink-2)" }}>45% of brands fight over just 1.5% of sales</div>
          </div>
        </div>
      </section>

      {/* 3. THE 2025 BRAND VOLUME PYRAMID */}
      <section style={{ border: "1px solid var(--rule)", borderRadius: "6px", padding: "var(--space-4)", background: "var(--paper)" }}>
        <header style={{ marginBottom: "var(--space-3)" }}>
          <span className="eyebrow">Empirical Register Analysis (2025 NZ New)</span>
          <h3 style={{ margin: "var(--space-1) 0 var(--space-1)", fontSize: "16px", fontWeight: 700 }}>
            The New Zealand Brand Volume Pyramid
          </h3>
          <p className="meta" style={{ margin: 0 }}>
            Click on any tier below to inspect which vehicle marques belong to it and how volume is distributed:
          </p>
        </header>

        {/* Pyramid Visual Bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", margin: "var(--space-3) 0" }}>
          {intelData.brand_pyramid.tiers.map((t) => {
            const isSelected = selectedTier === t.tier;
            const tierColors = ["#0284c7", "#0d9488", "#eab308", "#f97316", "#ef4444"];
            const color = tierColors[t.tier - 1];

            return (
              <div
                key={t.tier}
                onClick={() => setSelectedTier(isSelected ? null : t.tier)}
                style={{
                  border: isSelected ? `2px solid ${color}` : "1px solid var(--rule)",
                  borderRadius: "4px",
                  padding: "10px 14px",
                  background: isSelected ? "var(--paper-warm)" : "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: "10px",
                        height: "10px",
                        borderRadius: "2px",
                        background: color,
                      }}
                    />
                    <strong style={{ fontSize: "13.5px" }}>Tier {t.tier}: {t.name}</strong>
                    <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>({t.threshold})</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12.5px" }}>
                    <span><strong>{t.brands_count}</strong> brands</span>
                    <span><strong>{t.total_units.toLocaleString()}</strong> units</span>
                    <span style={{ fontWeight: 700, color }}>{t.share_pct}% market</span>
                    <span style={{ color: "var(--ink-3)" }}>Avg {t.avg_units.toLocaleString()} / brand</span>
                    <span style={{ fontSize: "11px", color: "var(--ink-3)" }}>{isSelected ? "▲ Collapse" : "▼ Brands"}</span>
                  </div>
                </div>

                {/* Progress bar visual */}
                <div style={{ height: "4px", width: "100%", background: "var(--rule)", borderRadius: "2px", marginTop: "8px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${t.share_pct}%`, background: color, borderRadius: "2px" }} />
                </div>

                {/* Expanded Brand Drawer */}
                {isSelected && (
                  <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed var(--rule)", fontSize: "12px" }}>
                    <div style={{ color: "var(--ink-2)", marginBottom: "6px", fontStyle: "italic" }}>{t.description}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                      {t.brands.map((b) => (
                        <span
                          key={b}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "3px",
                            background: "var(--rule)",
                            color: "var(--ink)",
                            fontWeight: 600,
                            fontSize: "11.5px",
                          }}
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. DEALERSHIP VIABILITY & FRANCHISE SIMULATOR */}
      <section style={{ border: "1px solid var(--rule)", borderRadius: "6px", padding: "var(--space-4)", background: "var(--paper)" }}>
        <header style={{ marginBottom: "var(--space-3)" }}>
          <span className="eyebrow">Franchise Economics Simulator</span>
          <h3 style={{ margin: "var(--space-1) 0 var(--space-1)", fontSize: "16px", fontWeight: 700 }}>
            The 2,000 Units/Brand Reality Check: Can a Dealership Network Survive?
          </h3>
          <p className="meta" style={{ margin: 0 }}>
            In New Zealand, maintaining national coverage across both islands requires a minimum footprint of 8 dealer sites (Auckland North/South, Hamilton, Tauranga, Hawke's Bay, Wellington, Christchurch, Dunedin). Select a brand volume below:
          </p>
        </header>

        {/* Preset Volume Quick Buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: "var(--space-3) 0" }}>
          {[
            { label: "50 units (Long Tail)", val: 50 },
            { label: "262 units (NZ Median Brand)", val: 262 },
            { label: "1,500 units (Established Niche)", val: 1500 },
            { label: "4,500 units (Mainstream Volume)", val: 4500 },
            { label: "32,000 units (Toyota Anchor)", val: 32000 },
          ].map((preset) => (
            <button
              key={preset.val}
              type="button"
              onClick={() => setSimVolume(preset.val)}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                borderRadius: "4px",
                border: simVolume === preset.val ? "2px solid var(--ink)" : "1px solid var(--rule)",
                background: simVolume === preset.val ? "var(--paper-warm)" : "transparent",
                fontWeight: simVolume === preset.val ? 700 : 400,
                cursor: "pointer",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Interactive Volume Slider */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", margin: "var(--space-3) 0" }}>
          <input
            type="range"
            min="20"
            max="15000"
            step="20"
            value={simVolume}
            onChange={(e) => setSimVolume(Number(e.target.value))}
            style={{ flex: 1, cursor: "pointer" }}
          />
          <div style={{ minWidth: "120px", textAlign: "right", fontWeight: 700, fontSize: "16px" }}>
            {simVolume.toLocaleString()} units/yr
          </div>
        </div>

        {/* Simulation Output Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
          <div style={{ padding: "var(--space-3)", background: "var(--paper-warm)", borderRadius: "4px", border: "1px solid var(--rule)" }}>
            <span style={{ fontSize: "11px", color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700 }}>National Sales Pace</span>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink)", margin: "4px 0" }}>
              {simCalculations.weeklyRate} <span style={{ fontSize: "13px", fontWeight: 500 }}>cars / week</span>
            </div>
            <div style={{ fontSize: "11.5px", color: "var(--ink-2)" }}>Across the entire country ({simCalculations.dailyRate} cars/day)</div>
          </div>

          <div style={{ padding: "var(--space-3)", background: "var(--paper-warm)", borderRadius: "4px", border: "1px solid var(--rule)" }}>
            <span style={{ fontSize: "11px", color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700 }}>Rooftop Sales Throughput</span>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--ink)", margin: "4px 0" }}>
              {simCalculations.carsPerDealerPerMonth} <span style={{ fontSize: "13px", fontWeight: 500 }}>cars / dealer / month</span>
            </div>
            <div style={{ fontSize: "11.5px", color: "var(--ink-2)" }}>Across minimum 8 regional dealer locations</div>
          </div>

          <div style={{ padding: "var(--space-3)", background: "var(--paper-warm)", borderRadius: "4px", border: `1px solid ${simCalculations.statusColor}` }}>
            <span style={{ fontSize: "11px", color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700 }}>Franchise Viability</span>
            <div style={{ fontSize: "15px", fontWeight: 800, color: simCalculations.statusColor, margin: "4px 0" }}>
              {simCalculations.status}
            </div>
            <div style={{ fontSize: "11.5px", color: "var(--ink-2)", lineHeight: 1.35 }}>
              {simCalculations.summary}
            </div>
          </div>
        </div>
      </section>

      {/* 5. FOUR STRUCTURAL REASONS WHY NZ IS SO FRAGMENTED */}
      <section style={{ border: "1px solid var(--rule)", borderRadius: "6px", padding: "var(--space-4)", background: "var(--paper)" }}>
        <header style={{ marginBottom: "var(--space-3)" }}>
          <span className="eyebrow">Structural Dynamics</span>
          <h3 style={{ margin: "var(--space-1) 0 var(--space-1)", fontSize: "16px", fontWeight: 700 }}>
            Four Reasons Why New Zealand Has 140x More Brands Per Capita Than America
          </h3>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-3)" }}>
          <div style={{ padding: "var(--space-3)", border: "1px solid var(--rule)", borderRadius: "4px" }}>
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--ink)", marginBottom: "4px" }}>
              1. Zero Import Tariffs (1998 Deregulation)
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-2)", lineHeight: 1.45 }}>
              New Zealand abolished all automotive tariffs in 1998. Unlike the US (25% truck tariff, 100% Chinese EV tariff) or Europe, any global automaker can ship vehicles into Auckland with zero customs duty.
            </p>
          </div>

          <div style={{ padding: "var(--space-3)", border: "1px solid var(--rule)", borderRadius: "4px" }}>
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--ink)", marginBottom: "4px" }}>
              2. Right-Hand Drive (RHD) Synergy
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-2)", lineHeight: 1.45 }}>
              Vehicles engineered and homologated in RHD for the United Kingdom, Japan, or Australia can be certified for New Zealand with minimal regulatory friction, lowering entry capital to near zero.
            </p>
          </div>

          <div style={{ padding: "var(--space-3)", border: "1px solid var(--rule)", borderRadius: "4px" }}>
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--ink)", marginBottom: "4px" }}>
              3. The Clean Car EV Sandbox Effect
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-2)", lineHeight: 1.45 }}>
              The 2021–2023 Clean Car Discount created an unprecedented testbed for 18 post-2019 newcomers (BYD, Chery, Jaecoo, Omoda, Leapmotor, Zeekr, Tank) to test western consumer appetite before entering larger markets.
            </p>
          </div>

          <div style={{ padding: "var(--space-3)", border: "1px solid var(--rule)", borderRadius: "4px" }}>
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--ink)", marginBottom: "4px" }}>
              4. Multi-Brand Dealership Groups
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-2)", lineHeight: 1.45 }}>
              Because low volume cannot support standalone showrooms, independent importer conglomerates (Giltrap, Armstrong's, Ebbett, Ingham, Inchcape) group multiple niche brands under single roofs, absorbing overhead.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
