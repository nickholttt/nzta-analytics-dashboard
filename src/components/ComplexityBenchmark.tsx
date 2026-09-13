import * as Plot from "@observablehq/plot";
import React, { useMemo, useState } from "react";
import intelData from "../data/market_intelligence.json";
import countrySilhouettes from "../data/country_silhouettes.json";
import { PlotFigure } from "./PlotFigure";
import { INK, INK_2, INK_3, PAPER, PAPER_2, RULE, RULE_STRONG, plotStyle, tipStyle } from "../lib/theme";

type BenchmarkMetric = "units_per_brand" | "brands_per_million" | "total_units" | "brands_count";
type TimelinePerspective = "global_evolution" | "nz_brands_volume" | "nz_concentration";

export function ComplexityBenchmark() {
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [metric, setMetric] = useState<BenchmarkMetric>("units_per_brand");
  const [selectedCountryId, setSelectedCountryId] = useState<string>("new_zealand");
  const [timelineView, setTimelineView] = useState<TimelinePerspective>("global_evolution");
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [simVolume, setSimVolume] = useState<number>(262); // 2025 NZ median brand volume

  const availableYears = intelData.benchmark_years as number[];
  const benchmarkByYear = intelData.benchmark_by_year as Record<string, any[]>;
  const currentYearList = benchmarkByYear[String(selectedYear)] || benchmarkByYear["2025"];
  const selectedCountry = currentYearList.find((c) => c.id === selectedCountryId) || currentYearList[4];

  // Observable Plot figure generator
  const renderTimelinePlot = (width: number) => {
    if (timelineView === "global_evolution") {
      // 10-Year Comparative Units/Brand Evolution (Log Scale)
      const data = intelData.benchmark_evolution_timeline;

      // Transform data into long format for multi-series plotting
      const longData: { year: number; country: string; units_per_brand: number; color: string }[] = [];
      const countryMeta = [
        { id: "usa", label: "USA", color: "#6366f1" },
        { id: "china", label: "China", color: "#e11d48" },
        { id: "japan", label: "Japan", color: "#0d9488" },
        { id: "australia", label: "Australia", color: "#b45309" },
        { id: "new_zealand", label: "New Zealand", color: "#0284c7" },
      ];

      data.forEach((row: any) => {
        countryMeta.forEach((cm) => {
          longData.push({
            year: row.year,
            country: cm.label,
            units_per_brand: row[`${cm.id}_units_per_brand`],
            color: cm.color,
          });
        });
      });

      return Plot.plot({
        width,
        height: 300,
        style: plotStyle,
        y: {
          type: "log",
          label: "Units per Brand (Annual, Logarithmic Scale)",
          grid: true,
          tickFormat: (d) => (d >= 1000 ? `${(d / 1000).toFixed(0)}k` : `${d}`),
        },
        x: {
          tickFormat: (d) => String(d),
          label: "Year",
        },
        color: {
          domain: countryMeta.map((c) => c.label),
          range: countryMeta.map((c) => c.color),
          legend: true,
        },
        marks: [
          Plot.ruleY([2000], { stroke: "#cbd5e1", strokeDasharray: "2,2" }),
          Plot.lineY(longData, {
            x: "year",
            y: "units_per_brand",
            stroke: "color",
            strokeWidth: (d) => (d.country === "New Zealand" ? 3 : 1.8),
            curve: "monotone-x",
          }),
          Plot.dot(longData, {
            x: "year",
            y: "units_per_brand",
            fill: "color",
            r: (d) => (d.country === "New Zealand" ? 4.5 : 3),
            tip: {
              ...tipStyle,
              format: {
                x: (d) => `${d}`,
                y: (d) => `${Number(d).toLocaleString()} units/brand`,
              },
            },
          }),
          Plot.text(
            longData.filter((d) => d.year === 2025),
            {
              x: "year",
              y: "units_per_brand",
              text: (d) => ` ${d.country} (${(d.units_per_brand >= 1000 ? `${(d.units_per_brand / 1000).toFixed(0)}k` : d.units_per_brand)})`,
              textAnchor: "start",
              dx: 6,
              fontSize: 11,
              fontWeight: 600,
              fill: "color",
            },
          ),
        ],
      });
    } else if (timelineView === "nz_brands_volume") {
      const data = intelData.nz_complexity_timeline;

      return Plot.plot({
        width,
        height: 280,
        style: plotStyle,
        x: {
          tickFormat: (d) => String(d),
          label: "Year",
        },
        y: {
          label: "Active Brands in NZ Register",
          domain: [50, 100],
          grid: true,
        },
        marks: [
          Plot.ruleY([60], { stroke: "#cbd5e1", strokeDasharray: "3,3" }),
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
              fill: INK,
            },
          ),
        ],
      });
    } else {
      // Concentration view: Top 3 vs Top 5 vs Top 10 Share %
      const data = intelData.nz_complexity_timeline;

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
        ],
      });
    }
  };

  // Dealership Viability Simulation calculations
  const simCalculations = useMemo(() => {
    const weeklyRate = (simVolume / 52).toFixed(1);
    const dailyRate = (simVolume / 365).toFixed(1);
    const minDealers = 8;
    const carsPerDealerPerMonth = (simVolume / minDealers / 12).toFixed(1);

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
      carsPerDealerPerMonth,
      status,
      statusColor,
      summary,
    };
  }, [simVolume]);

  return (
    <div className="complexity-benchmark" style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* 1. EDITORIAL BENCHMARK SECTION (MATCHING SITE PALETTE) */}
      <section
        style={{
          background: "var(--paper)",
          border: "1px solid var(--rule-strong)",
          borderRadius: "6px",
          padding: "var(--space-5)",
        }}
      >
        {/* Header with Title and Year/Metric Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-4)", marginBottom: "var(--space-4)", paddingBottom: "var(--space-4)", borderBottom: "1px solid var(--rule)" }}>
          <div>
            <span className="eyebrow" style={{ display: "inline-block", marginBottom: "4px" }}>
              Global Automotive Tracking · 10-Year Comparative Evolution
            </span>
            <h2 style={{ margin: "0 0 6px", fontSize: "clamp(1.25rem, 2.2vw, 1.75rem)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)" }}>
              New Vehicle Market Complexity & Competition
            </h2>
            <p className="lead" style={{ margin: 0, maxWidth: "760px" }}>
              How national volume, brand proliferation, and distributor economics collide. While American and Chinese brands operate with massive scale, New Zealand hosts 82+ active brands battling over 134k registrations.
            </p>
          </div>

          {/* Metric Selector Toggle */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", background: "var(--paper-warm)", padding: "4px", borderRadius: "6px", border: "1px solid var(--rule)" }}>
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
                  background: metric === m.id ? "var(--paper)" : "transparent",
                  color: metric === m.id ? "var(--ink)" : "var(--ink-2)",
                  border: metric === m.id ? "1px solid var(--rule-strong)" : "1px solid transparent",
                  boxShadow: metric === m.id ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: metric === m.id ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 10-YEAR HISTORICAL YEAR SCRUBBER / SELECTOR */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-3)", padding: "10px 14px", background: "var(--paper-warm)", borderRadius: "6px", border: "1px solid var(--rule)", marginBottom: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-2)" }}>
              Year:
            </span>
            <div style={{ display: "flex", gap: "4px" }}>
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYear(yr)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "4px",
                    border: selectedYear === yr ? "2px solid var(--ink)" : "1px solid var(--rule)",
                    background: selectedYear === yr ? "var(--ink)" : "var(--paper)",
                    color: selectedYear === yr ? "var(--paper)" : "var(--ink)",
                    fontSize: "12px",
                    fontWeight: selectedYear === yr ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          <div style={{ fontSize: "12px", color: "var(--ink-2)" }}>
            Showing verified statistics for <strong>{selectedYear}</strong>
          </div>
        </div>

        {/* 5 COUNTRY COMPARISON CARDS (EDITORIAL SITE STYLING) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "var(--space-3)",
          }}
        >
          {currentYearList.map((c: any) => {
            const isSelected = selectedCountryId === c.id;
            const isNZ = c.id === "new_zealand";
            const silhouetteSvg = (countrySilhouettes as Record<string, string>)[c.id];

            let highlightedMetricValue = `${(c.units_per_brand / 1000).toFixed(0)}K`;
            let highlightedMetricLabel = "units / brand";

            if (metric === "brands_per_million") {
              highlightedMetricValue = `${c.brands_per_million.toFixed(2)}`;
              highlightedMetricLabel = "brands / million";
            } else if (metric === "total_units") {
              highlightedMetricValue = c.units;
              highlightedMetricLabel = "annual units";
            } else if (metric === "brands_count") {
              highlightedMetricValue = `${c.brands}`;
              highlightedMetricLabel = "active brands";
            }

            return (
              <div
                key={c.id}
                onClick={() => setSelectedCountryId(c.id)}
                style={{
                  background: isNZ ? "var(--paper-warm)" : "var(--paper)",
                  border: isNZ
                    ? "2px solid var(--ink)"
                    : isSelected
                    ? "1px solid var(--ink)"
                    : "1px solid var(--rule)",
                  borderRadius: "6px",
                  padding: "var(--space-3)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  cursor: "pointer",
                  position: "relative",
                  boxShadow: isNZ ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {isNZ && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-10px",
                      background: "var(--ink)",
                      color: "var(--paper)",
                      fontSize: "9px",
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

                {/* Country Silhouette Vector (Rendered in elegant ink stroke/fill) */}
                <div style={{ height: "62px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", margin: "6px 0 10px" }}>
                  {silhouetteSvg ? (
                    <svg viewBox="0 0 100 80" style={{ height: "100%", maxWidth: "110px" }}>
                      <path d={silhouetteSvg} fill="var(--ink)" opacity="0.82" />
                    </svg>
                  ) : (
                    <span style={{ fontSize: "32px" }}>{c.flag}</span>
                  )}
                </div>

                {/* Country Title */}
                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "14px" }}>{c.flag}</span>
                  <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, letterSpacing: "0.02em", color: "var(--ink)" }}>
                    {c.country}
                  </h3>
                </div>

                {/* Submetrics list */}
                <div style={{ fontSize: "11.5px", color: "var(--ink-2)", lineHeight: 1.4, marginBottom: "12px" }}>
                  <div><strong>{c.population}</strong> people</div>
                  <div><strong>{c.brands}</strong> active brands</div>
                  <div><strong>{c.units}</strong> registered</div>
                </div>

                {/* Highlighted Metric Container */}
                <div
                  style={{
                    marginTop: "auto",
                    width: "100%",
                    background: isNZ ? "var(--paper)" : "var(--paper-warm)",
                    border: "1px solid var(--rule-strong)",
                    borderRadius: "4px",
                    padding: "6px 4px",
                  }}
                >
                  <div style={{ fontSize: "18px", fontWeight: 800, color: isNZ ? "var(--accent)" : "var(--ink)", lineHeight: 1.1 }}>
                    {highlightedMetricValue}
                  </div>
                  <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-3)", marginTop: "2px" }}>
                    {highlightedMetricLabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Country Insight & Attribution */}
        <div
          style={{
            marginTop: "var(--space-4)",
            background: "var(--paper-warm)",
            border: "1px solid var(--rule)",
            borderRadius: "6px",
            padding: "var(--space-3) var(--space-4)",
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-4)",
            alignItems: "center",
          }}
        >
          <div style={{ flex: "1 1 320px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "16px" }}>{selectedCountry.flag}</span>
              <strong style={{ fontSize: "13.5px", color: "var(--ink)" }}>
                {selectedCountry.country} ({selectedYear})
              </strong>
              <span className="badge" style={{ background: "rgba(0,0,0,0.06)", color: "var(--ink)", fontSize: "11px" }}>
                {selectedCountry.scale_vs_nz} NZ Scale / Brand
              </span>
            </div>
            <div style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: 1.45 }}>
              {selectedCountry.dealer_model}
            </div>
          </div>
          <div style={{ flex: "1 1 240px", fontSize: "11.5px", borderLeft: "1px solid var(--rule)", paddingLeft: "var(--space-3)", color: "var(--ink-3)" }}>
            <div><strong>Verifiable Data Source:</strong></div>
            <div style={{ color: "var(--ink-2)", marginTop: "2px" }}>{selectedCountry.source}</div>
          </div>
        </div>
      </section>

      {/* 2. OBSERVABLE PLOT: 10-YEAR EVOLUTION CHARTS */}
      <section style={{ border: "1px solid var(--rule-strong)", borderRadius: "6px", padding: "var(--space-4)", background: "var(--paper)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
          <div>
            <span className="eyebrow">10-Year Historical Evolution (2015–2025)</span>
            <h3 style={{ margin: "var(--space-1) 0 var(--space-1)", fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
              {timelineView === "global_evolution"
                ? "Global Scale Evolution: Units per Brand Over 10 Years"
                : timelineView === "nz_brands_volume"
                ? "NZ Brand Proliferation Surge (62 → 84 Brands)"
                : "NZ Market Concentration Over Time"}
            </h3>
            <p className="meta" style={{ margin: 0 }}>
              {timelineView === "global_evolution"
                ? "Logarithmic trajectory of annual vehicle volume per brand across USA, China, Japan, Australia, and New Zealand."
                : "Tracking active marques in the Motor Vehicle Register against average volume per brand and market concentration."}
            </p>
          </div>

          {/* Perspective Buttons */}
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              type="button"
              onClick={() => setTimelineView("global_evolution")}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                borderRadius: "4px",
                border: timelineView === "global_evolution" ? "1px solid var(--ink)" : "1px solid var(--rule)",
                background: timelineView === "global_evolution" ? "var(--ink)" : "transparent",
                color: timelineView === "global_evolution" ? "var(--paper)" : "var(--ink)",
                fontWeight: timelineView === "global_evolution" ? 600 : 400,
                cursor: "pointer",
              }}
            >
              Global 10-Year Scale (All 5)
            </button>
            <button
              type="button"
              onClick={() => setTimelineView("nz_brands_volume")}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                borderRadius: "4px",
                border: timelineView === "nz_brands_volume" ? "1px solid var(--ink)" : "1px solid var(--rule)",
                background: timelineView === "nz_brands_volume" ? "var(--ink)" : "transparent",
                color: timelineView === "nz_brands_volume" ? "var(--paper)" : "var(--ink)",
                fontWeight: timelineView === "nz_brands_volume" ? 600 : 400,
                cursor: "pointer",
              }}
            >
              NZ Brands & Volume
            </button>
            <button
              type="button"
              onClick={() => setTimelineView("nz_concentration")}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                borderRadius: "4px",
                border: timelineView === "nz_concentration" ? "1px solid var(--ink)" : "1px solid var(--rule)",
                background: timelineView === "nz_concentration" ? "var(--ink)" : "transparent",
                color: timelineView === "nz_concentration" ? "var(--paper)" : "var(--ink)",
                fontWeight: timelineView === "nz_concentration" ? 600 : 400,
                cursor: "pointer",
              }}
            >
              NZ Concentration (Top 3/5/10)
            </button>
          </div>
        </div>

        {/* Observable Plot Figure */}
        <PlotFigure render={renderTimelinePlot} />

        {/* 10-Year Takeaways Table */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "var(--space-3)", marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--rule)" }}>
          <div style={{ fontSize: "12px" }}>
            <span style={{ color: "var(--ink-3)" }}>USA 10-Year Scale:</span>
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--ink)" }}>~420,000 units / brand</div>
            <div style={{ color: "var(--ink-2)" }}>Strict franchise laws hold brands at 38–39</div>
          </div>
          <div style={{ fontSize: "12px" }}>
            <span style={{ color: "var(--ink-3)" }}>China 10-Year Proliferation:</span>
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--ink)" }}>110 brands (2015) → 160 brands (2025)</div>
            <div style={{ color: "var(--ink-2)" }}>Massive domestic volume still yields 200k/brand</div>
          </div>
          <div style={{ fontSize: "12px" }}>
            <span style={{ color: "var(--ink-3)" }}>Australia 10-Year Shift:</span>
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--ink)" }}>19.9k (2015) → 16.1k units/brand (2025)</div>
            <div style={{ color: "var(--ink-2)" }}>Brand count rose from 58 to 76</div>
          </div>
          <div style={{ fontSize: "12px" }}>
            <span style={{ color: "var(--ink-3)" }}>New Zealand Collapse:</span>
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#0284c7" }}>2,501 (2021) → 1,632 units/brand (2025)</div>
            <div style={{ color: "var(--ink-2)" }}>Median volume dropped to just 262 cars/yr</div>
          </div>
        </div>
      </section>

      {/* 3. THE 2025 BRAND VOLUME PYRAMID */}
      <section style={{ border: "1px solid var(--rule-strong)", borderRadius: "6px", padding: "var(--space-4)", background: "var(--paper)" }}>
        <header style={{ marginBottom: "var(--space-3)" }}>
          <span className="eyebrow">Empirical Register Analysis (2025 NZ New)</span>
          <h3 style={{ margin: "var(--space-1) 0 var(--space-1)", fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
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
            const tierColors = ["#0284c7", "#0d9488", "#ca8a04", "#ea580c", "#dc2626"];
            const color = tierColors[t.tier - 1];

            return (
              <div
                key={t.tier}
                onClick={() => setSelectedTier(isSelected ? null : t.tier)}
                style={{
                  border: isSelected ? `2px solid ${color}` : "1px solid var(--rule)",
                  borderRadius: "4px",
                  padding: "10px 14px",
                  background: isSelected ? "var(--paper-warm)" : "var(--paper)",
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
                    <strong style={{ fontSize: "13.5px", color: "var(--ink)" }}>Tier {t.tier}: {t.name}</strong>
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
      <section style={{ border: "1px solid var(--rule-strong)", borderRadius: "6px", padding: "var(--space-4)", background: "var(--paper)" }}>
        <header style={{ marginBottom: "var(--space-3)" }}>
          <span className="eyebrow">Franchise Economics Simulator</span>
          <h3 style={{ margin: "var(--space-1) 0 var(--space-1)", fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
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
      <section style={{ border: "1px solid var(--rule-strong)", borderRadius: "6px", padding: "var(--space-4)", background: "var(--paper)" }}>
        <header style={{ marginBottom: "var(--space-3)" }}>
          <span className="eyebrow">Structural Dynamics</span>
          <h3 style={{ margin: "var(--space-1) 0 var(--space-1)", fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
            Four Reasons Why New Zealand Has 140x More Brands Per Capita Than America
          </h3>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-3)" }}>
          <div style={{ padding: "var(--space-3)", border: "1px solid var(--rule)", borderRadius: "4px", background: "var(--paper-warm)" }}>
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--ink)", marginBottom: "4px" }}>
              1. Zero Import Tariffs (1998 Deregulation)
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-2)", lineHeight: 1.45 }}>
              New Zealand abolished all automotive tariffs in 1998. Unlike the US (25% truck tariff, 100% Chinese EV tariff) or Europe, any global automaker can ship vehicles into Auckland with zero customs duty.
            </p>
          </div>

          <div style={{ padding: "var(--space-3)", border: "1px solid var(--rule)", borderRadius: "4px", background: "var(--paper-warm)" }}>
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--ink)", marginBottom: "4px" }}>
              2. Right-Hand Drive (RHD) Synergy
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-2)", lineHeight: 1.45 }}>
              Vehicles engineered and homologated in RHD for the United Kingdom, Japan, or Australia can be certified for New Zealand with minimal regulatory friction, lowering entry capital to near zero.
            </p>
          </div>

          <div style={{ padding: "var(--space-3)", border: "1px solid var(--rule)", borderRadius: "4px", background: "var(--paper-warm)" }}>
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--ink)", marginBottom: "4px" }}>
              3. The Clean Car EV Sandbox Effect
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-2)", lineHeight: 1.45 }}>
              The 2021–2023 Clean Car Discount created an unprecedented testbed for 18 post-2019 newcomers (BYD, Chery, Jaecoo, Omoda, Leapmotor, Zeekr, Tank) to test western consumer appetite before entering larger markets.
            </p>
          </div>

          <div style={{ padding: "var(--space-3)", border: "1px solid var(--rule)", borderRadius: "4px", background: "var(--paper-warm)" }}>
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
