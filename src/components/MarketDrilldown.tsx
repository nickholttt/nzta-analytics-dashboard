import * as Plot from "@observablehq/plot";
import React, { useEffect, useMemo, useRef, useState } from "react";
import intelData from "../data/market_intelligence.json";
import inspectorData from "../data/inspector_data.json";
import { PlotFigure } from "./PlotFigure";
import { pct, shareChange } from "../lib/measures";
import { INK_2, PAPER, RULE_STRONG, plotStyle, tipStyle } from "../lib/theme";

type QuestionId = "q1" | "q2" | "q3" | "q4" | "q5" | "q6" | "q_suv";

const QUESTIONS: { id: QuestionId; title: string; subtitle: string; tag: string }[] = [
  {
    id: "q1",
    title: "Brand Makeup: Volume vs Commercial Reality",
    subtitle: "Toyota commands ~28% total volume, but what actually makes it up?",
    tag: "Brand Drilldown",
  },
  {
    id: "q2",
    title: "The Clean Car Policy Shockwave (2021–2026)",
    subtitle: "What happened when the Clean Car Discount ended on 31 Dec 2023?",
    tag: "Policy Impact",
  },
  {
    id: "q3",
    title: "The Commercial Ute Wars: Ranger vs Hilux",
    subtitle: "Who really owns the high-margin ute sector across economic cycles?",
    tag: "Ute Battle",
  },
  {
    id: "q4",
    title: "The Chinese Brand Surge: SAIC, BYD & GWM",
    subtitle: "Are Chinese marques really taking over, and which brands lead?",
    tag: "New Entrants",
  },
  {
    id: "q5",
    title: "Regional Geography: Urban EVs vs Rural Utes",
    subtitle: "Where do electric cars versus diesel utes live in New Zealand?",
    tag: "Geography",
  },
  {
    id: "q6",
    title: "Segment Champions: Cars, Utes, Vans & Trucks",
    subtitle: "Who leads each statutory segment and what fuels them?",
    tag: "Segment Matrix",
  },
  {
    id: "q_suv",
    title: "The 'SUV Claim' & Physical Geometry Rules",
    subtitle: "Why does NZTA record zero SUVs and 110,000 RAV4 station wagons?",
    tag: "Data Invariant",
  },
];

export function MarketDrilldown() {
  // Read initial params from URL if available
  const [activeQ, setActiveQ] = useState<QuestionId>(() => {
    if (typeof window === "undefined") return "q1";
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") as QuestionId;
    return QUESTIONS.some((item) => item.id === q) ? q : "q1";
  });

  const [selectedMake, setSelectedMake] = useState<string>(() => {
    if (typeof window === "undefined") return "TOYOTA";
    const params = new URLSearchParams(window.location.search);
    const m = (params.get("make") || "TOYOTA").toUpperCase();
    return (intelData.top_makes as string[]).includes(m) ? m : "TOYOTA";
  });

  const [selectedSegment, setSelectedSegment] = useState<string>(() => {
    if (typeof window === "undefined") return "Ute";
    const params = new URLSearchParams(window.location.search);
    return params.get("segment") || "Ute";
  });

  // Keep URL in sync
  const setQuestion = (q: QuestionId) => {
    setActiveQ(q);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("q", q);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const handleMakeChange = (m: string) => {
    setSelectedMake(m);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("make", m);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const makeData = (intelData.brand_composition as Record<string, any>)[selectedMake] || intelData.brand_composition.TOYOTA;

  return (
    <div className="market-drilldown" style={{ marginTop: "var(--space-4)" }}>
      {/* Question Selector Tabs */}
      <div
        className="question-tabs"
        role="tablist"
        aria-label="Automotive Market Questions"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "var(--space-2)",
          marginBottom: "var(--space-5)",
        }}
      >
        {QUESTIONS.map((q) => {
          const isActive = activeQ === q.id;
          return (
            <button
              key={q.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setQuestion(q.id)}
              style={{
                textAlign: "left",
                padding: "var(--space-3)",
                border: isActive ? "2px solid var(--ink)" : "1px solid var(--rule)",
                background: isActive ? "var(--paper)" : "transparent",
                borderRadius: "4px",
                cursor: "pointer",
                boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-1)",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span
                  className="meta"
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: isActive ? "var(--accent)" : "var(--ink-2)",
                  }}
                >
                  {q.tag}
                </span>
                {isActive ? <span style={{ fontSize: "11px", fontWeight: 600 }}>Active</span> : null}
              </div>
              <strong style={{ fontSize: "14px", color: "var(--ink)" }}>{q.title}</strong>
              <span className="meta" style={{ fontSize: "12px", color: "var(--ink-2)", lineHeight: 1.3 }}>
                {q.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* QUESTION 1: BRAND MAKEUP & COMMERCIAL REALITY */}
      {activeQ === "q1" && (
        <section className="drilldown-panel">
          <header style={{ marginBottom: "var(--space-4)" }}>
            <span className="eyebrow">Industry Question 1</span>
            <h3 style={{ margin: "var(--space-1) 0 var(--space-2)" }}>Toyota's Paradox: Passenger Volume vs Commercial Ute Reality</h3>
            <p className="lead" style={{ margin: 0 }}>
              Toyota registers ~28% of all vehicles in New Zealand. But coalface dealers and fleet buyers know that Toyota is not one uniform monolith: it is an electrified passenger car giant combined with a commercial diesel van and ute operation.
            </p>
          </header>

          {/* Make Selector Pills */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <label className="meta" style={{ display: "block", marginBottom: "var(--space-2)", fontWeight: 600 }}>
              Select Brand to Inspect (2021–2026 Inflow):
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {(intelData.top_makes as string[]).slice(0, 12).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleMakeChange(m)}
                  style={{
                    padding: "6px 12px",
                    fontSize: "13px",
                    borderRadius: "20px",
                    border: selectedMake === m ? "2px solid var(--ink)" : "1px solid var(--rule)",
                    background: selectedMake === m ? "var(--ink)" : "transparent",
                    color: selectedMake === m ? "var(--paper)" : "var(--ink)",
                    cursor: "pointer",
                    fontWeight: selectedMake === m ? 600 : 400,
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Two-Column Breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
            {/* Segment Makeup */}
            <div style={{ padding: "var(--space-4)", border: "1px solid var(--rule)", borderRadius: "4px", background: "var(--paper)" }}>
              <h4 style={{ margin: "0 0 var(--space-3)" }}>{selectedMake} by Vehicle Segment</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {makeData.segments.map((s: any) => (
                  <div key={s.segment}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                      <span><strong>{s.segment}</strong></span>
                      <span>{s.n.toLocaleString()} ({s.pct}%)</span>
                    </div>
                    <div style={{ height: "8px", background: "var(--rule)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${s.pct}%`, height: "100%", background: s.segment === "Ute" ? "#b45309" : s.segment === "Car" ? "var(--accent)" : "#475569" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Powertrain Makeup */}
            <div style={{ padding: "var(--space-4)", border: "1px solid var(--rule)", borderRadius: "4px", background: "var(--paper)" }}>
              <h4 style={{ margin: "0 0 var(--space-3)" }}>{selectedMake} by Powertrain</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {makeData.powertrains.slice(0, 5).map((p: any) => (
                  <div key={p.powertrain}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                      <span><strong>{p.powertrain}</strong></span>
                      <span>{p.n.toLocaleString()} ({p.pct}%)</span>
                    </div>
                    <div style={{ height: "8px", background: "var(--rule)", borderRadius: "4px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${p.pct}%`,
                          height: "100%",
                          background: p.powertrain === "Hybrid" ? "#16a34a" : p.powertrain === "BEV" ? "#0284c7" : p.powertrain === "Diesel" ? "#475569" : "#ea580c",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Models Roster */}
          <div style={{ padding: "var(--space-4)", border: "1px solid var(--rule)", borderRadius: "4px", marginBottom: "var(--space-4)" }}>
            <h4 style={{ margin: "0 0 var(--space-3)" }}>Top Models for {selectedMake} (2021–2026 Volume)</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
              {makeData.top_models.map((m: any) => {
                const modelName = m.model.split("|")[1] || m.model;
                return (
                  <div key={m.model} style={{ padding: "var(--space-2) var(--space-3)", borderLeft: "3px solid var(--accent)", background: "rgba(0,0,0,0.02)" }}>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>{modelName}</div>
                    <div className="meta" style={{ fontSize: "12px", color: "var(--ink-2)" }}>
                      {m.n.toLocaleString()} vehicles ({m.pct}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Analytical Takeaway */}
          <div className="callout note" style={{ margin: 0 }}>
            <span className="callout-label">Coalface Takeaway</span>
            {selectedMake === "TOYOTA" ? (
              <p style={{ margin: 0 }}>
                Toyota's market dominance is driven by <strong>Hybrids (62.5% of its volume)</strong> and passenger cars/SUVs (81.3%). While the Hilux accounts for 49,197 registrations (13.0%), Ford Ranger outsells Hilux in the ute segment. Toyota wins the overall market because it dominates electrified passenger transport, not because it sweeps utes.
              </p>
            ) : selectedMake === "FORD" ? (
              <p style={{ margin: 0 }}>
                Ford's NZ business is heavily concentrated: <strong>Utes represent over 62% of Ford's total volume</strong>, and over 74% of Ford registrations are Diesel. Ford's passenger car footprint (Focus, Fiesta) has receded, leaving the Ranger and Everest as its primary commercial engines.
              </p>
            ) : (
              <p style={{ margin: 0 }}>
                {selectedMake} has registered {makeData.total_recent.toLocaleString()} vehicles since 2021 ({makeData.total_all.toLocaleString()} on the road all-time). Its top model is {makeData.top_models[0]?.model.split("|")[1] || "N/A"}.
              </p>
            )}
          </div>
        </section>
      )}

      {/* QUESTION 2: CLEAN CAR POLICY SHOCKWAVE */}
      {activeQ === "q2" && (
        <section className="drilldown-panel">
          <header style={{ marginBottom: "var(--space-4)" }}>
            <span className="eyebrow">Industry Question 2</span>
            <h3 style={{ margin: "var(--space-1) 0 var(--space-2)" }}>The Clean Car Policy Shockwave (2021–2026)</h3>
            <p className="lead" style={{ margin: 0 }}>
              On 31 December 2023, the Clean Car Discount (feebate) scheme was abolished by the incoming Coalition Government. On 1 April 2024, Road User Charges (RUC) were introduced for Light EVs and Plug-in Hybrids. Look at the immediate monthly reaction in the register:
            </p>
          </header>

          {/* Before and After Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
            <div style={{ padding: "var(--space-3)", border: "1px solid var(--rule)", borderRadius: "4px", background: "rgba(22, 163, 74, 0.05)" }}>
              <span className="meta" style={{ fontWeight: 600, color: "#16a34a" }}>DECEMBER 2023 (Final Subsidy Month)</span>
              <div style={{ fontSize: "28px", fontWeight: 700, margin: "var(--space-1) 0" }}>20.0% BEV</div>
              <p className="meta" style={{ margin: 0, color: "var(--ink-2)" }}>
                Hybrid: 44.7% | Diesel: 5.8%<br />
                Combined electrified: 64.7% of all registrations.
              </p>
            </div>

            <div style={{ padding: "var(--space-3)", border: "1px solid var(--rule)", borderRadius: "4px", background: "rgba(220, 38, 38, 0.05)" }}>
              <span className="meta" style={{ fontWeight: 600, color: "#dc2626" }}>JANUARY 2024 (Subsidy Repealed)</span>
              <div style={{ fontSize: "28px", fontWeight: 700, margin: "var(--space-1) 0" }}>1.4% BEV</div>
              <p className="meta" style={{ margin: 0, color: "var(--ink-2)" }}>
                Hybrid: 25.7% | Diesel: 24.7%<br />
                BEV share plummeted by 93% in 30 days.
              </p>
            </div>

            <div style={{ padding: "var(--space-3)", border: "1px solid var(--rule)", borderRadius: "4px", background: "rgba(2, 132, 199, 0.05)" }}>
              <span className="meta" style={{ fontWeight: 600, color: "#0284c7" }}>2025–2026 NEW EQUILIBRIUM</span>
              <div style={{ fontSize: "28px", fontWeight: 700, margin: "var(--space-1) 0" }}>~30% Hybrid</div>
              <p className="meta" style={{ margin: 0, color: "var(--ink-2)" }}>
                BEV stabilized at 3–4%<br />
                Petrol + Diesel recovered to 60% combined.
              </p>
            </div>
          </div>

          {/* Observable Plot: Monthly Powertrain Timeline */}
          <div style={{ padding: "var(--space-4)", border: "1px solid var(--rule)", borderRadius: "4px", background: "var(--paper)", marginBottom: "var(--space-4)" }}>
            <h4 style={{ margin: "0 0 var(--space-2)" }}>Monthly Registrations Share by Powertrain (2021–2026)</h4>
            <PlotFigure
              render={(width) => {
                const data = intelData.policy_timeline.flatMap((d) => [
                  { month: d.month, date: new Date(`${d.month}-01T00:00:00Z`), powertrain: "BEV (Electric)", share: d.bev_share },
                  { month: d.month, date: new Date(`${d.month}-01T00:00:00Z`), powertrain: "Hybrid", share: d.hybrid_share },
                  { month: d.month, date: new Date(`${d.month}-01T00:00:00Z`), powertrain: "Diesel", share: d.diesel_share },
                  { month: d.month, date: new Date(`${d.month}-01T00:00:00Z`), powertrain: "Petrol", share: d.petrol_share },
                ]);

                return Plot.plot({
                  width,
                  height: 320,
                  style: plotStyle,
                  marginLeft: 45,
                  marginRight: 20,
                  marginBottom: 30,
                  x: { type: "utc", label: null },
                  y: { label: null, domain: [0, 60], tickFormat: (d) => `${d}%` },
                  color: {
                    domain: ["BEV (Electric)", "Hybrid", "Diesel", "Petrol"],
                    range: ["#0284c7", "#16a34a", "#475569", "#ea580c"],
                  },
                  marks: [
                    Plot.gridY({ ticks: 5, stroke: "var(--rule)" }),
                    // Policy repeal vertical rule at 2023-12-31
                    Plot.ruleX([new Date("2024-01-01T00:00:00Z")], { stroke: "#dc2626", strokeWidth: 1.5, strokeDasharray: "4,4" }),
                    Plot.text([{ date: new Date("2024-01-01T00:00:00Z"), text: "Clean Car Discount Repealed" }], {
                      x: "date",
                      y: 55,
                      text: "text",
                      dx: 6,
                      textAnchor: "start",
                      fill: "#dc2626",
                      fontSize: 11,
                      fontWeight: 600,
                    }),
                    Plot.lineY(data, { x: "date", y: "share", z: "powertrain", stroke: "powertrain", strokeWidth: 2 }),
                    Plot.dot(data, Plot.pointer({ x: "date", y: "share", fill: "powertrain", r: 4 })),
                    Plot.tip(
                      data,
                      Plot.pointer({
                        x: "date",
                        y: "share",
                        ...tipStyle,
                        title: (d: any) => `${d.powertrain}\n${d.month}: ${d.share}%`,
                      }),
                    ),
                  ],
                });
              }}
            />
          </div>
        </section>
      )}

      {/* QUESTION 3: THE UTE WARS */}
      {activeQ === "q3" && (
        <section className="drilldown-panel">
          <header style={{ marginBottom: "var(--space-4)" }}>
            <span className="eyebrow">Industry Question 3</span>
            <h3 style={{ margin: "var(--space-1) 0 var(--space-2)" }}>The Ute Wars: Ford Ranger vs Toyota Hilux vs Mitsubishi Triton</h3>
            <p className="lead" style={{ margin: 0 }}>
              Utes account for ~15% to 18% of New Zealand's total vehicle fleet and are the most profitable nameplates for mainstream distributors. Here is the annual breakdown of new ute registrations from 2015 to 2026:
            </p>
          </header>

          <div style={{ padding: "var(--space-4)", border: "1px solid var(--rule)", borderRadius: "4px", background: "var(--paper)", marginBottom: "var(--space-4)" }}>
            <h4 style={{ margin: "0 0 var(--space-2)" }}>Annual Ute Market Share (%) by Top Contenders (2015–2026)</h4>
            <PlotFigure
              render={(width) => {
                const data = intelData.ute_timeline.flatMap((d) => [
                  { year: d.year, date: new Date(`${d.year}-01-01T00:00:00Z`), model: "Ford Ranger", share: d.ford_ranger_share },
                  { year: d.year, date: new Date(`${d.year}-01-01T00:00:00Z`), model: "Toyota Hilux", share: d.toyota_hilux_share },
                  { year: d.year, date: new Date(`${d.year}-01-01T00:00:00Z`), model: "Mitsubishi Triton", share: d.mitsubishi_triton_share },
                  { year: d.year, date: new Date(`${d.year}-01-01T00:00:00Z`), model: "Isuzu D-Max", share: d["isuzu_d-max_share"] || 0 },
                ]);

                return Plot.plot({
                  width,
                  height: 300,
                  style: plotStyle,
                  marginLeft: 45,
                  marginRight: 20,
                  marginBottom: 30,
                  x: { type: "utc", label: null },
                  y: { label: null, domain: [0, 45], tickFormat: (d) => `${d}%` },
                  color: {
                    domain: ["Ford Ranger", "Toyota Hilux", "Mitsubishi Triton", "Isuzu D-Max"],
                    range: ["#0284c7", "#ea580c", "#dc2626", "#475569"],
                  },
                  marks: [
                    Plot.gridY({ ticks: 5, stroke: "var(--rule)" }),
                    Plot.lineY(data, { x: "date", y: "share", z: "model", stroke: "model", strokeWidth: 2.2 }),
                    Plot.dot(data, { x: "date", y: "share", fill: "model", r: 3.5 }),
                    Plot.tip(
                      data,
                      Plot.pointer({
                        x: "date",
                        y: "share",
                        ...tipStyle,
                        title: (d: any) => `${d.model}\n${d.year}: ${d.share}% share of utes`,
                      }),
                    ),
                  ],
                });
              }}
            />
          </div>

          {/* Rivalry Table */}
          <div style={{ overflowX: "auto" }}>
            <table className="key" style={{ width: "100%", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Total Utes</th>
                  <th>Ford Ranger</th>
                  <th>Ranger Share</th>
                  <th>Toyota Hilux</th>
                  <th>Hilux Share</th>
                  <th>Ranger Margin</th>
                </tr>
              </thead>
              <tbody>
                {intelData.ute_timeline.map((row) => {
                  const margin = row.ford_ranger - row.toyota_hilux;
                  return (
                    <tr key={row.year}>
                      <td><strong>{row.year}</strong></td>
                      <td>{row.total_utes.toLocaleString()}</td>
                      <td>{row.ford_ranger.toLocaleString()}</td>
                      <td>{row.ford_ranger_share}%</td>
                      <td>{row.toyota_hilux.toLocaleString()}</td>
                      <td>{row.toyota_hilux_share}%</td>
                      <td style={{ fontWeight: 600, color: margin > 0 ? "var(--accent)" : "#dc2626" }}>
                        {margin > 0 ? `+${margin.toLocaleString()}` : margin.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* QUESTION 4: CHINESE BRAND SURGE */}
      {activeQ === "q4" && (
        <section className="drilldown-panel">
          <header style={{ marginBottom: "var(--space-4)" }}>
            <span className="eyebrow">Industry Question 4</span>
            <h3 style={{ margin: "var(--space-1) 0 var(--space-2)" }}>The Rise of Chinese Brands: SAIC, BYD & GWM</h3>
            <p className="lead" style={{ margin: 0 }}>
              Chinese automotive groups (SAIC/MG, BYD, Great Wall Motors/Haval, LDV, Geely/Volvo/Polestar) expanded rapidly from under 1% of total registrations in 2018 to over 7% by 2023. Here is the volume progression by marquee:
            </p>
          </header>

          <div style={{ padding: "var(--space-4)", border: "1px solid var(--rule)", borderRadius: "4px", background: "var(--paper)", marginBottom: "var(--space-4)" }}>
            <h4 style={{ margin: "0 0 var(--space-2)" }}>Annual Registrations for Leading Chinese Brands (2018–2026)</h4>
            <div style={{ overflowX: "auto" }}>
              <table className="key" style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>China Share</th>
                    <th>MG (SAIC)</th>
                    <th>BYD</th>
                    <th>Haval (GWM)</th>
                    <th>LDV</th>
                    <th>Volvo</th>
                    <th>GWM</th>
                  </tr>
                </thead>
                <tbody>
                  {intelData.chinese_brand_timeline.map((r) => (
                    <tr key={r.year}>
                      <td><strong>{r.year}</strong></td>
                      <td style={{ fontWeight: 600 }}>{r.china_share}%</td>
                      <td>{r.mg.toLocaleString()}</td>
                      <td>{r.byd.toLocaleString()}</td>
                      <td>{r.haval.toLocaleString()}</td>
                      <td>{r.ldv.toLocaleString()}</td>
                      <td>{r.volvo.toLocaleString()}</td>
                      <td>{r.gwm.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* QUESTION 5: REGIONAL MATRIX */}
      {activeQ === "q5" && (
        <section className="drilldown-panel">
          <header style={{ marginBottom: "var(--space-4)" }}>
            <span className="eyebrow">Industry Question 5</span>
            <h3 style={{ margin: "var(--space-1) 0 var(--space-2)" }}>Regional Matrix: Urban EV Havens vs Rural Ute Strongholds</h3>
            <p className="lead" style={{ margin: 0 }}>
              Vehicle adoption in New Zealand is geographically polarized. Urban administrative centers (Wellington, Auckland) lead in battery electric adoption, while agricultural and transport corridors (Waikato, Otago, Bay of Plenty) over-index heavily on utilities and diesel.
            </p>
          </header>

          <div style={{ overflowX: "auto" }}>
            <table className="key" style={{ width: "100%", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Registrations (2021–2026)</th>
                  <th>BEV Share (%)</th>
                  <th>Ute Share (%)</th>
                  <th>Diesel Share (%)</th>
                  <th>Regional Bias</th>
                </tr>
              </thead>
              <tbody>
                {intelData.regional_matrix.map((r) => {
                  const isEVLean = r.bev_share >= 6.5;
                  const isUteLean = r.ute_share >= 14.0;
                  return (
                    <tr key={r.region}>
                      <td><strong>{r.region}</strong></td>
                      <td>{r.total.toLocaleString()}</td>
                      <td style={{ fontWeight: isEVLean ? 600 : 400, color: isEVLean ? "#0284c7" : "inherit" }}>
                        {r.bev_share}%
                      </td>
                      <td style={{ fontWeight: isUteLean ? 600 : 400, color: isUteLean ? "#b45309" : "inherit" }}>
                        {r.ute_share}%
                      </td>
                      <td>{r.diesel_share}%</td>
                      <td>
                        {isEVLean ? (
                          <span className="badge" style={{ background: "rgba(2, 132, 199, 0.1)", color: "#0284c7" }}>
                            EV Lean
                          </span>
                        ) : isUteLean ? (
                          <span className="badge" style={{ background: "rgba(180, 83, 9, 0.1)", color: "#b45309" }}>
                            Ute Lean
                          </span>
                        ) : (
                          <span className="meta">Balanced</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* QUESTION 6: SEGMENT CHAMPIONS */}
      {activeQ === "q6" && (
        <section className="drilldown-panel">
          <header style={{ marginBottom: "var(--space-4)" }}>
            <span className="eyebrow">Industry Question 6</span>
            <h3 style={{ margin: "var(--space-1) 0 var(--space-2)" }}>Segment Champions: Who Leads Cars, Utes, Vans & Trucks?</h3>
            <p className="lead" style={{ margin: 0 }}>
              Select a statutory vehicle segment to inspect the top 10 brands, top 10 models, and powertrain split (2021–2026 inflow):
            </p>
          </header>

          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
            {["Car", "Ute", "Van", "Truck"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedSegment(s)}
                style={{
                  padding: "8px 16px",
                  fontSize: "14px",
                  borderRadius: "4px",
                  border: selectedSegment === s ? "2px solid var(--ink)" : "1px solid var(--rule)",
                  background: selectedSegment === s ? "var(--ink)" : "transparent",
                  color: selectedSegment === s ? "var(--paper)" : "var(--ink)",
                  fontWeight: selectedSegment === s ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {s}s ({intelData.segment_leaders[s as keyof typeof intelData.segment_leaders]?.total.toLocaleString()})
              </button>
            ))}
          </div>

          {/* Leaders Breakdown */}
          {(() => {
            const seg = intelData.segment_leaders[selectedSegment as keyof typeof intelData.segment_leaders];
            if (!seg) return null;
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-4)" }}>
                {/* Top Makes */}
                <div style={{ padding: "var(--space-4)", border: "1px solid var(--rule)", borderRadius: "4px", background: "var(--paper)" }}>
                  <h4 style={{ margin: "0 0 var(--space-3)" }}>Top Brands in {selectedSegment}s</h4>
                  <table className="key" style={{ width: "100%", fontSize: "13px" }}>
                    <thead>
                      <tr>
                        <th>Brand</th>
                        <th>Volume</th>
                        <th>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seg.top_makes.map((m: any) => (
                        <tr key={m.make}>
                          <td><strong>{m.make}</strong></td>
                          <td>{m.n.toLocaleString()}</td>
                          <td>{m.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Top Models */}
                <div style={{ padding: "var(--space-4)", border: "1px solid var(--rule)", borderRadius: "4px", background: "var(--paper)" }}>
                  <h4 style={{ margin: "0 0 var(--space-3)" }}>Top Models in {selectedSegment}s</h4>
                  <table className="key" style={{ width: "100%", fontSize: "13px" }}>
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Volume</th>
                        <th>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seg.top_models.map((m: any) => (
                        <tr key={m.model}>
                          <td><strong>{m.model.split("|")[1] || m.model}</strong></td>
                          <td>{m.n.toLocaleString()}</td>
                          <td>{m.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* QUESTION SUV: THE SUV CLAIM */}
      {activeQ === "q_suv" && (
        <section className="drilldown-panel">
          <header style={{ marginBottom: "var(--space-4)" }}>
            <span className="eyebrow">Data Invariant Verification</span>
            <h3 style={{ margin: "var(--space-1) 0 var(--space-2)" }}>Statutory Body Types: The SUV Claim Verified</h3>
            <p className="lead" style={{ margin: 0 }}>
              Under the Land Transport Rule (Vehicle Dimensions and Mass), vehicles are registered by structural geometric envelope. A 2-box passenger car with a rear liftgate is legally recorded as a <code>STATION WAGON</code>.
            </p>
          </header>

          <div style={{ padding: "var(--space-4)", border: "1px solid var(--rule)", borderRadius: "4px", background: "var(--paper)", marginBottom: "var(--space-4)" }}>
            <h4 style={{ margin: "0 0 var(--space-2)" }}>Top 20 "Station Wagons" in the Register</h4>
            <p className="meta" style={{ margin: "0 0 var(--space-3)" }}>
              17 of the top 20 "station wagon" nameplates are modern SUVs.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="key" style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Model</th>
                    <th>Station Wagon Count</th>
                    <th>True Market Body Type</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectorData.top_station_wagons.map((m: any, idx: number) => (
                    <tr key={m.model}>
                      <td>#{idx + 1}</td>
                      <td><strong>{m.make} {m.model}</strong></td>
                      <td>{m.station_wagon_count.toLocaleString()}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: m.is_suv ? "rgba(22, 163, 74, 0.1)" : "rgba(0,0,0,0.05)",
                            color: m.is_suv ? "#16a34a" : "inherit",
                          }}
                        >
                          {m.is_suv ? "SUV" : "Station Wagon"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
