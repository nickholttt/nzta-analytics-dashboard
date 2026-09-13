import { useEffect, useState } from "react";

interface BodyTypeShare {
  body: string;
  count: number;
  share: number;
}

interface MotivePowerShare {
  power: string;
  count: number;
  share: number;
}

interface Vehicle {
  name: string;
  make: string;
  model: string;
  total: number;
  mia_segment: string;
  pipeline_segment: string;
  category: string;
  body_types: BodyTypeShare[];
  motive_powers: MotivePowerShare[];
}

interface StationWagonModel {
  make: string;
  model: string;
  station_wagon_count: number;
  total_model_count: number;
  station_wagon_pct: number;
  is_suv: boolean;
}

interface UteYear {
  year: number;
  ranger: number;
  hilux: number;
  diff: number;
  leader: string;
}

interface InspectorData {
  generated_at: string;
  fleet_stats: {
    total_vehicles: number;
    body_suv_count: number;
    station_wagons_total: number;
    utilities_total: number;
    hatchbacks_total: number;
    saloons_total: number;
  };
  vehicles: Vehicle[];
  top_station_wagons: StationWagonModel[];
  ute_rivalry: UteYear[];
}

import rawInspectorData from "../data/inspector_data.json";

const data: InspectorData = rawInspectorData as unknown as InspectorData;

export default function DataInspector() {
  const [selectedVehicleName, setSelectedVehicleName] = useState<string>("TOYOTA RAV4");

  const selectedVehicle = data.vehicles.find((v) => v.name === selectedVehicleName) ?? data.vehicles[0];

  const quickPills = [
    "TOYOTA RAV4",
    "FORD RANGER",
    "TOYOTA HILUX",
    "MAZDA CX-5",
    "MITSUBISHI OUTLANDER",
    "NISSAN QASHQAI",
    "TOYOTA COROLLA",
    "SUZUKI SWIFT",
    "TOYOTA HIGHLANDER",
  ];

  return (
    <div className="inspector-container">
      {/* Overview Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--space-4)",
          margin: "var(--space-6) 0 var(--space-7)",
        }}
      >
        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--rule-strong)",
            borderRadius: "var(--radius)",
            padding: "var(--space-4)",
          }}
        >
          <span className="eyebrow">MVR Total Fleet</span>
          <p style={{ fontSize: "var(--text-xl)", fontWeight: 700, margin: "var(--space-1) 0 0", color: "var(--ink)" }}>
            {data.fleet_stats.total_vehicles.toLocaleString()}
          </p>
          <p className="meta" style={{ marginTop: "var(--space-1)" }}>Active registered vehicles</p>
        </div>

        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--rule-strong)",
            borderRadius: "var(--radius)",
            padding: "var(--space-4)",
          }}
        >
          <span className="eyebrow">NZTA "SUV" Body Type</span>
          <p style={{ fontSize: "var(--text-xl)", fontWeight: 700, margin: "var(--space-1) 0 0", color: "var(--block-ink)" }}>
            {data.fleet_stats.body_suv_count}
          </p>
          <p className="meta" style={{ marginTop: "var(--space-1)" }}>Zero rows match "SUV" in NZTA body</p>
        </div>

        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--rule-strong)",
            borderRadius: "var(--radius)",
            padding: "var(--space-4)",
          }}
        >
          <span className="eyebrow">Station Wagons (inc. SUVs)</span>
          <p style={{ fontSize: "var(--text-xl)", fontWeight: 700, margin: "var(--space-1) 0 0", color: "var(--ink)" }}>
            {data.fleet_stats.station_wagons_total.toLocaleString()}
          </p>
          <p className="meta" style={{ marginTop: "var(--space-1)" }}>28.7% of total register</p>
        </div>

        <div
          style={{
            background: "var(--paper)",
            border: "1px solid var(--rule-strong)",
            borderRadius: "var(--radius)",
            padding: "var(--space-4)",
          }}
        >
          <span className="eyebrow">Utilities (Utes)</span>
          <p style={{ fontSize: "var(--text-xl)", fontWeight: 700, margin: "var(--space-1) 0 0", color: "var(--ink)" }}>
            {data.fleet_stats.utilities_total.toLocaleString()}
          </p>
          <p className="meta" style={{ marginTop: "var(--space-1)" }}>9.7% of total register</p>
        </div>
      </div>

      {/* SECTION 1: Interactive Model & Body Type Explorer */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <div className="section-head">
          <p className="eyebrow">Verification Tool</p>
          <h2 className="section-title">Explore How NZTA Classifies Any Vehicle</h2>
        </div>

        <p className="panel-definition" style={{ marginBottom: "var(--space-4)" }}>
          Select a vehicle below to examine how it is recorded by NZTA in the raw Motor Vehicle Register versus how the automotive industry classifies it.
        </p>

        {/* Quick selection pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
          {quickPills.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedVehicleName(name)}
              style={{
                fontFamily: "var(--font-text)",
                fontSize: "var(--text-xs)",
                fontWeight: selectedVehicleName === name ? 600 : 400,
                padding: "6px 12px",
                borderRadius: "var(--radius)",
                border: "1px solid",
                borderColor: selectedVehicleName === name ? "var(--ink)" : "var(--rule-strong)",
                background: selectedVehicleName === name ? "var(--ink)" : "var(--paper)",
                color: selectedVehicleName === name ? "var(--paper)" : "var(--ink)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Dropdown for all 35 models */}
        <div style={{ marginBottom: "var(--space-5)", maxWidth: "340px" }}>
          <label htmlFor="vehicle-select" className="meta" style={{ display: "block", marginBottom: "var(--space-1)" }}>
            Or select from top 35 models:
          </label>
          <select
            id="vehicle-select"
            value={selectedVehicleName}
            onChange={(e) => setSelectedVehicleName(e.target.value)}
            style={{
              width: "100%",
              padding: "var(--space-2) var(--space-3)",
              fontFamily: "var(--font-text)",
              fontSize: "var(--text-sm)",
              border: "1px solid var(--rule-strong)",
              borderRadius: "var(--radius)",
              background: "var(--paper)",
              color: "var(--ink)",
            }}
          >
            {data.vehicles.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.total.toLocaleString()} on road)
              </option>
            ))}
          </select>
        </div>

        {/* Vehicle Detail Card */}
        {selectedVehicle && (
          <div
            style={{
              background: "var(--paper-2)",
              border: "1px solid var(--rule-strong)",
              borderRadius: "var(--radius)",
              padding: "var(--space-5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "var(--space-2)", borderBottom: "1px solid var(--rule)", paddingBottom: "var(--space-3)", marginBottom: "var(--space-4)" }}>
              <div>
                <span className="eyebrow">{selectedVehicle.category}</span>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", margin: "var(--space-1) 0 0" }}>
                  {selectedVehicle.name}
                </h3>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="meta">Total registered on NZ roads</span>
                <p style={{ fontSize: "var(--text-lg)", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                  {selectedVehicle.total.toLocaleString()}
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--space-5)" }}>
              {/* Statutory Body Type Breakdown */}
              <div>
                <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-2)", marginBottom: "var(--space-3)" }}>
                  Statutory Body Type in NZTA Register
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {selectedVehicle.body_types.map((bt) => (
                    <div key={bt.body}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", marginBottom: "3px" }}>
                        <span style={{ fontWeight: bt.share > 50 ? 600 : 400 }}>{bt.body}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>
                          {bt.count.toLocaleString()} ({bt.share}%)
                        </span>
                      </div>
                      <div style={{ height: "6px", background: "var(--rule)", borderRadius: "3px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, Math.max(1, bt.share))}%`,
                            background: bt.body === "STATION WAGON" ? "var(--accent)" : "var(--ink)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Motive Power Breakdown */}
              <div>
                <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-2)", marginBottom: "var(--space-3)" }}>
                  Motive Power / Fuel
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {selectedVehicle.motive_powers.map((mp) => (
                    <div key={mp.power}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", marginBottom: "3px" }}>
                        <span>{mp.power}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>
                          {mp.count.toLocaleString()} ({mp.share}%)
                        </span>
                      </div>
                      <div style={{ height: "6px", background: "var(--rule)", borderRadius: "3px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, Math.max(1, mp.share))}%`,
                            background: mp.power.includes("HYBRID") ? "#2e7d32" : mp.power === "ELECTRIC" ? "#0288d1" : "var(--ink-3)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Interpretation Callout */}
            <div
              className="callout curated"
              style={{ marginTop: "var(--space-5)" }}
            >
              <span className="callout-label">Classification Insight</span>
              <strong>MIA Commercial Segment:</strong> {selectedVehicle.mia_segment} · <strong>Pipeline Segment:</strong> {selectedVehicle.pipeline_segment}
              <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-xs)", color: "var(--ink-2)" }}>
                {selectedVehicle.body_types[0]?.body === "STATION WAGON" && selectedVehicle.category.includes("SUV") ? (
                  <>
                    Notice that NZTA records <strong>{selectedVehicle.body_types[0]?.share}%</strong> of {selectedVehicle.name}s as <code>STATION WAGON</code>.
                    This confirms the fundamental data constraint: statutory registration rules define 2-box liftback passenger cars as station wagons.
                    Because there is no <code>SUV</code> body type in the register, an SUV segment can only be derived through a model-level taxonomy.
                  </>
                ) : selectedVehicle.body_types[0]?.body === "UTILITY" ? (
                  <>
                    NZTA records <strong>{selectedVehicle.body_types[0]?.share}%</strong> of {selectedVehicle.name}s as <code>UTILITY</code>.
                    This puts it into the Light Commercial / Ute category, where market share trends operate completely independently from passenger vehicle sales.
                  </>
                ) : (
                  <>
                    NZTA records this vehicle predominantly as <code>{selectedVehicle.body_types[0]?.body}</code>.
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: The "SUV Claim" Empirical Proof */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <div className="section-head">
          <p className="eyebrow">The SUV Claim Verified</p>
          <h2 className="section-title">Proof: The Top 20 Models Registered as "Station Wagon"</h2>
        </div>

        <p className="panel-definition" style={{ marginBottom: "var(--space-4)" }}>
          Below are the 20 most numerous vehicle models recorded under <code>body_type = 'STATION WAGON'</code> in the NZTA Motor Vehicle Register.
          Notice that 17 of the 20 are universally recognized commercial SUVs.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table className="key" style={{ width: "100%", margin: 0 }}>
            <thead>
              <tr>
                <th scope="col">Make & Model</th>
                <th scope="col">Commercial Type</th>
                <th scope="col" style={{ textAlign: "right" }}>Registered as Station Wagon</th>
                <th scope="col" style={{ textAlign: "right" }}>Total on Road</th>
                <th scope="col" style={{ textAlign: "right" }}>% Recorded as Station Wagon</th>
              </tr>
            </thead>
            <tbody>
              {data.top_station_wagons.map((row) => (
                <tr key={`${row.make}-${row.model}`}>
                  <td style={{ fontWeight: 600 }}>
                    {row.make} {row.model}
                  </td>
                  <td>
                    {row.is_suv ? (
                      <span className="badge live" style={{ color: "var(--accent)" }}>SUV</span>
                    ) : (
                      <span className="badge" style={{ color: "var(--ink-3)" }}>Estate / Wagon</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {row.station_wagon_count.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {row.total_model_count.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                    {row.station_wagon_pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="callout warning" style={{ marginTop: "var(--space-5)" }}>
          <span className="callout-label">Why This Matters</span>
          Under New Zealand Land Transport regulations, vehicles are registered by structural shape, not commercial marketing category.
          When an industry report from the Motor Industry Association (MIA) states that "SUVs account for 55% of the passenger market",
          they are classifying sales using a proprietary model catalogue. In the open government register, virtually all of those vehicles
          arrive as <code>STATION WAGON</code> (or occasionally <code>HATCHBACK</code> for subcompact crossovers).
        </div>
      </section>

      {/* SECTION 3: Coalface Reality: The Ute Battle (Ranger vs Hilux) */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <div className="section-head">
          <p className="eyebrow">Industry Market Dynamics</p>
          <h2 className="section-title">The Coalface Truth: Ford Ranger vs Toyota Hilux (2015–2026)</h2>
        </div>

        <p className="panel-definition" style={{ marginBottom: "var(--space-4)" }}>
          If an industry expert looks at our total market share chart showing Toyota at ~30%, they will point out that Toyota does not lead the ute market.
          Here are the empirical new registrations by year from the NZTA register for New Zealand's two top utilities:
        </p>

        <div style={{ overflowX: "auto" }}>
          <table className="key" style={{ width: "100%", margin: 0 }}>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col" style={{ textAlign: "right" }}>Ford Ranger (New Utes)</th>
                <th scope="col" style={{ textAlign: "right" }}>Toyota Hilux (New Utes)</th>
                <th scope="col" style={{ textAlign: "right" }}>Ranger Lead</th>
                <th scope="col">Market Leader</th>
              </tr>
            </thead>
            <tbody>
              {data.ute_rivalry.map((row) => (
                <tr key={row.year}>
                  <td style={{ fontWeight: 600 }}>{row.year}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {row.ranger.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {row.hilux.toLocaleString()}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: row.diff > 0 ? "var(--ink)" : "var(--warn-ink)" }}>
                    +{row.diff.toLocaleString()}
                  </td>
                  <td>
                    <span className="badge live" style={{ color: "var(--accent)" }}>
                      {row.leader}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="callout curated" style={{ marginTop: "var(--space-5)" }}>
          <span className="callout-label">Analytical Takeaway</span>
          Ford Ranger has been New Zealand's <strong>#1 selling ute every single year for over a decade</strong>.
          Toyota's overall market share dominance (~30% of total registrations) is powered by hybrid passenger vehicles
          (RAV4, Corolla, Yaris Cross, Highlander) and commercial vans (Hiace).
          This demonstrates why an aggregate "Brand Share" chart without passenger versus commercial separation hides the real commercial battle at the coalface.
        </div>
      </section>

      {/* SECTION 4: Architecture Roadmap */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <div className="section-head">
          <p className="eyebrow">Platform Roadmap</p>
          <h2 className="section-title">Bridging Statutory Data to Automotive Industry Reality</h2>
        </div>

        <div className="prose">
          <p>
            To achieve full institutional credibility with automotive executives, journalists, and policy analysts, the platform's post-freeze architecture will introduce two enhancements:
          </p>
          <ol>
            <li>
              <strong>Model-Level Segment Taxonomy (<code>model_segments.csv</code>)</strong>:
              Instead of relying exclusively on NZTA's coarse structural <code>body_type</code>, a reference mapping will assign top nameplates directly to MIA/VFACTS segments (SUV, Light Passenger, Ute, Van).
            </li>
            <li>
              <strong>Segment-Filtered Brand Share</strong>:
              Allowing users to view <em>Brand Share in Passenger & SUVs</em> (dominated by Toyota) versus <em>Brand Share in Utes / Light Commercials</em> (dominated by Ford), aligning macro-data directly with industry reality.
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
