// Writes public/geo/nz-regions.json, the region outlines the map chart draws, from Stats NZ's coastline-clipped
// regional council boundaries (CC BY 4.0). Run from the repository root when the boundaries change:
//
//   node scripts/region-boundaries.mjs
//
// The outlines are simplified for a chart a few hundred pixels wide: the service drops points within OFFSET degrees,
// coordinates keep 3 decimals (about 100 m), and islands smaller than MIN_AREA are dropped unless they are a region's
// largest piece. Every region must match data/reference/tla_region.csv by code and name, or nothing is written.
// See docs/DECISIONS.md, D-054.
import fs from "node:fs";
import path from "node:path";

const SERVICE = "https://services2.arcgis.com/vKb0s8tBIA3bdocZ/arcgis/rest/services/REGC2023/FeatureServer/0/query";
const CODE = "REGC2023_V1_00";
const NAME = "REGC2023_V1_00_NAME";
const SOURCE = "Stats NZ, Regional Council 2023 Clipped, licensed for reuse under CC BY 4.0";
const OFFSET = 0.01;
const MIN_AREA = 0.002;
const REFERENCE = path.join("data", "reference", "tla_region.csv");
const OUT = path.join("public", "geo", "nz-regions.json");
// Stats NZ's code for the area outside any region (the Chatham Islands). It lies across the 180th meridian, so a map
// fitted to it would span the globe; its vehicles are listed in the chart's table instead.
const OUTSIDE_REGIONS = "99";

const params = new URLSearchParams({
  where: "1=1",
  outFields: `${CODE},${NAME}`,
  outSR: "4326",
  maxAllowableOffset: String(OFFSET),
  geometryPrecision: "3",
  f: "geojson",
});
const response = await fetch(`${SERVICE}?${params}`);
if (!response.ok) throw new Error(`${SERVICE}: HTTP ${response.status}`);
const source = await response.json();

// Signed area of a ring in square degrees: positive when it runs anticlockwise with latitude upwards.
const signedArea = (ring) => {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return sum / 2;
};
// D3's geography wants the outer ring of a polygon clockwise and its holes anticlockwise; GeoJSON (RFC 7946) has the
// opposite, and D3 reads an anticlockwise outer ring as the whole globe minus the region.
const wound = (ring, clockwise) => ((signedArea(ring) < 0) === clockwise ? ring : [...ring].reverse());

// The region name the reference file uses: Stats NZ's name without its " Region" suffix.
const reference = fs.readFileSync(REFERENCE, "utf8").trim().split(/\r?\n/).slice(1).map((line) => line.split(","));
const byCode = new Map(reference.map(([, region, code]) => [code, region]));

const features = [];
const problems = [];
for (const feature of source.features) {
  const code = feature.properties[CODE];
  if (code === OUTSIDE_REGIONS) continue;
  const region = feature.properties[NAME].replace(/ Region$/, "");
  if (byCode.get(code) !== region) problems.push(`code ${code} is "${region}" here but "${byCode.get(code)}" in ${REFERENCE}`);
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const largest = Math.max(...polygons.map((p) => Math.abs(signedArea(p[0]))));
  const kept = polygons
    .filter((p) => Math.abs(signedArea(p[0])) >= Math.min(MIN_AREA, largest))
    .map(([outer, ...holes]) => [wound(outer, true), ...holes.map((h) => wound(h, false))]);
  features.push({ type: "Feature", properties: { region, code }, geometry: { type: "MultiPolygon", coordinates: kept } });
}
const drawn = new Set(features.map((f) => f.properties.code));
for (const [code, region] of byCode) if (code !== OUTSIDE_REGIONS && !drawn.has(code)) problems.push(`${region} (${code}) has no boundary`);
if (problems.length) {
  console.error(`Not written:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

features.sort((a, b) => a.properties.code.localeCompare(b.properties.code));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify({ type: "FeatureCollection", source: SOURCE, features })}\n`);
const points = features.reduce((n, f) => n + f.geometry.coordinates.flat(2).length, 0);
console.log(`Wrote ${OUT}: ${features.length} regions, ${points} points, ${fs.statSync(OUT).size} bytes`);
