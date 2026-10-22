// geo: a choropleth by region (CLAUDE.md §Shapes). Each region is shaded by its share of the preset's period, and a
// table beside the map gives every region's figures, including any the map cannot place. Region outlines are Stats NZ's
// (public/geo/nz-regions.json, D-054); a region in the cube with no outline appears in the table only.
import * as Plot from "@observablehq/plot";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dimension, Preset } from "../lib/config";
import { loadRegions } from "../lib/data";
import type { Manifest, RegionOutlines, SliceRow } from "../lib/data";
import { pct, periodWindow } from "../lib/measures";
import { readout, spanPeriod } from "../lib/readout";
import { INK_3, SERIES, SUPPRESSED_LINE, plotStyle } from "../lib/theme";
import { PlotFigure } from "./PlotFigure";

// The lightest shade, for a share of zero: a pale wash of the darkest, which is the palette's first colour.
const LOWEST = "#e3e6f3";
const MAP_MAX_WIDTH = 420;

type Props = {
  preset: Preset;
  dimension: Dimension;
  rows: SliceRow[];
  manifest: Manifest;
  minDenominator: number;
  label: (value: string) => string;
  // The breakdown in the words the panel uses for it.
  dimensionLabel?: string;
};

type Region = { value: string; n: number; share: number };

export function GeoChart({ preset, dimension, rows, manifest, minDenominator, label, dimensionLabel }: Props) {
  const heading = dimensionLabel ?? dimension.label;
  const [outlines, setOutlines] = useState<RegionOutlines | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    loadRegions().then(setOutlines, () => setFailed(true));
  }, []);

  const model = useMemo(() => {
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const win = periodWindow(preset.period, months[0], manifest.latest_snapshot.slice(0, 7));
    const totals = new Map<string, number>();
    const denominators = new Map<string, number>();
    for (const r of rows) {
      if (r.month < win.from || r.month > win.to) continue;
      totals.set(r.value, (totals.get(r.value) ?? 0) + r.n);
      denominators.set(r.month, r.denominator);
    }
    const denominator = [...denominators.values()].reduce((a, b) => a + b, 0);
    const regions: Region[] = [...totals.entries()]
      .map(([value, n]) => ({ value, n, share: denominator > 0 ? n / denominator : 0 }))
      .sort((a, b) => b.n - a.n);
    const byValue = new Map(regions.map((r) => [r.value, r]));
    const max = Math.max(0.01, ...regions.map((r) => r.share));
    return { win, regions, byValue, denominator, max, suppressed: denominator < minDenominator };
  }, [rows, preset.period, manifest.latest_snapshot, minDenominator]);

  const render = useCallback(
    (width: number) => {
      const features = outlines?.features ?? [];
      const shareOf = (f: (typeof features)[number]) => model.byValue.get(f.properties.region)?.share ?? 0;
      return Plot.plot({
        width: Math.min(width, MAP_MAX_WIDTH),
        style: plotStyle,
        // New Zealand's own projection (NZTM2000) is a transverse Mercator on 173°E.
        projection: { type: "transverse-mercator", rotate: [-173, 0], domain: outlines ?? undefined },
        // A square-root scale: one region can hold close to half the vehicles, and on a linear scale every other region
        // sits in the palest few shades. The legend shows the scale, so the spacing is not hidden.
        color: {
          type: "sqrt",
          domain: [0, model.max],
          range: [LOWEST, SERIES[0]],
          legend: true,
          label: "Share of vehicles",
          tickFormat: (d: number) => `${Math.round(d * 100)}%`,
        },
        marks: [
          // Borders in muted ink, not the page colour, so neighbouring pale regions stay apart. Each shape carries its own
          // readout as a title, shown while the pointer is over that shape: a pointer that snaps to the nearest region's
          // centre would name a neighbour across much of a large region.
          Plot.geo(features, {
            fill: model.suppressed ? SUPPRESSED_LINE : shareOf,
            stroke: INK_3,
            strokeWidth: 0.5,
            title: (f: (typeof features)[number]) => {
              const region = model.byValue.get(f.properties.region);
              return readout({
                name: label(f.properties.region),
                period: spanPeriod(model.win.from, model.win.to),
                share: region?.share ?? 0,
                n: region?.n ?? 0,
                base: model.denominator,
                greyed: model.suppressed ? "thin" : undefined,
                minDenominator,
              });
            },
          }),
        ],
      });
    },
    [outlines, model, label, minDenominator],
  );

  const mapped = new Set(outlines?.features.map((f) => f.properties.region) ?? []);
  const unmapped = model.regions.filter((r) => !mapped.has(r.value)).map((r) => label(r.value));

  return (
    <>
      <p className="chart-unit">
        {heading} · share, {spanPeriod(model.win.from, model.win.to)} · {model.denominator.toLocaleString("en-NZ")} vehicles
        {model.suppressed ? `, greyed: under ${minDenominator}` : ""}
      </p>
      <div className="geo">
        <div className="geo-map">
          {outlines ? (
            <PlotFigure
              render={render}
              label={`Map of New Zealand's regions, ${spanPeriod(model.win.from, model.win.to)}, each shaded by its share of vehicles: darker is a larger share. The table beside the map gives each region's figures.`}
            />
          ) : failed ? (
            <p className="meta">The region outlines did not load, so the map is not drawn. The table gives every region's figures.</p>
          ) : (
            <p className="meta">Loading the map…</p>
          )}
          {outlines ? <p className="geo-credit">Region outlines: Stats NZ, Regional Council 2023 (clipped), CC BY 4.0.</p> : null}
        </div>
        <div className="table-scroll" role="region" aria-label={`${heading}: figures`} tabIndex={0}>
          <table className="key">
            <thead>
              <tr>
                <th scope="col" className="text">
                  {heading}
                </th>
                <th scope="col">Share</th>
                <th scope="col">Vehicles</th>
              </tr>
            </thead>
            <tbody>
              {model.regions.map((r) => (
                <tr key={r.value}>
                  <td className="text">{label(r.value)}</td>
                  <td className={model.suppressed ? "suppressed" : "figure"}>{model.suppressed ? "suppressed" : pct(r.share)}</td>
                  <td className="figure">{r.n.toLocaleString("en-NZ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {unmapped.length > 0 && outlines ? <p className="control-note">Not on the map, so listed in the table only: {unmapped.join(", ")}.</p> : null}
    </>
  );
}
