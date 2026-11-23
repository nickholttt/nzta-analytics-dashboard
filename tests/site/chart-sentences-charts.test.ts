// Where the sentence sits and how the charts use src/lib/chartSentence.ts. These read the charts' source, because the components need a browser to run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const CHARTS = ["TrendChart", "MixChart", "DistributionChart", "LeagueChart", "GeoChart", "MatrixChart"];

test("every chart draws its sentence under the figure, and the figure points at it", () => {
  for (const name of CHARTS) assert.match(read(`src/components/${name}.tsx`), /<ChartSentence text=\{/, name);
  assert.match(read("src/components/PlotFigure.tsx"), /setAttribute\("aria-describedby"/);
  assert.match(read("src/components/FiguresView.tsx"), /aria-describedby=\{describedBy\}/);
});

test("a chart's sentence is read from the figures its table is made from, in the table's own formats", () => {
  const mix = read("src/components/MixChart.tsx");
  // The change is the very expression the key table writes with shareChange, and the share the one it writes with pct.
  assert.match(mix, /shown - before\.n \/ before\.denominator/);
  assert.match(mix, /\{ share: pct, points: shareChange \}/);
  assert.match(mix, /summaryRows\[i\]\.changeShown/);
  const trend = read("src/components/TrendChart.tsx");
  assert.match(trend, /\{ share: pct, points: shareChange \}/);
  assert.match(trend, /countedText\(words\?\.leader_count/);
});

test("no sentence is written in code: the charts and the module name no template text of their own", () => {
  const code = (source: string) =>
    source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  for (const path of [...CHARTS.map((name) => `src/components/${name}.tsx`), "src/components/ChartSentence.tsx", "src/lib/chartSentence.ts"]) {
    assert.doesNotMatch(code(read(path)), /has the most|is the largest group|largest share of|level at the top/, path);
  }
});
