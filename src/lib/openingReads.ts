// What the canvas as it opens (an address with no question in it) is going to read for its first chart, worked out where the page is built so that
// the page can ask for the files before its script has run. The events file is read by every chart; the chart's own file is named only where it
// is one slice of the cube, which is the chart the canvas opens on. A chart that reads anything else (a pair, the fact table, another dataset beside
// it) names nothing: it is asked for when the script is running, as every other chart is. The paths are the ones src/lib/data.ts fetches.
import type { Vocabulary } from "./builder";
import { chartPreset, settleCanvas } from "./canvas";
import type { Manifest } from "./data";
import { resolvePreset } from "./resolve";

const DATA = "/data";

export function openingReads(all: Vocabulary, manifest: Manifest): string[] {
  const [chart] = settleCanvas(all, []).charts;
  const preset = chart && chartPreset(chart);
  const resolution = preset ? resolvePreset(preset, manifest) : undefined;
  const source = resolution?.preventsRender.length === 0 ? resolution.source : undefined;
  const plain = source && source.dimension && !source.filter && !source.facts && !source.cross && !resolution?.companion && source.snapshot === undefined;
  return [`${DATA}/events.json`, ...(plain ? [`${DATA}/cube/${source.dataset}/${source.dimension}.parquet`] : [])];
}
