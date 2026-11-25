// The answer pages, read where the site is built (src/pages/[...answer].astro, the front page and the layout call it): the slices the build
// published, in Node with the reader the latest month uses (src/lib/latestMonthBuild.ts, which holds it to the browser's loader), then the pages
// worked out by src/lib/answerPages.ts. Nothing here reaches a browser: the pages ship no script.
//
// Where a file is missing or cannot be read, or the dataset is not in the build, there are no pages and no index. Neither is an error.
import { builderVocabulary, datasetName } from "./builder";
import { canvasSpec, canvasVocabulary } from "./canvas";
import { answerPageLink } from "./answerPageLinks";
import { answerConfig, answerSite } from "./answerPages";
import type { AnswerConfig, Kind, Kit, Site } from "./answerPages";
import { datasetWords, dimensionLabel, findDataset, findDimension, findMeasure, phrases, valueWords, yearChangeFloor } from "./config";
import type { Preset } from "./config";
import type { Manifest } from "./data";
import { labeller } from "./displayNames";
import { builtDisplayNames } from "./displayNamesBuild";
import { readEvents, readSlice } from "./latestMonthBuild";
import type { ReadFile } from "./latestMonthBuild";
import { fillNote, noteContext } from "./notes";
import { countedText, fillTemplate, monthLabel } from "./sentences";
import { pct } from "./measures";

const KINDS: readonly Kind[] = ["brand", "model"];

// The site's pages for the newest month of this build, or nothing where the build cannot give them.
export async function answerPagesSite(manifest: Manifest, read: ReadFile, config: AnswerConfig = answerConfig): Promise<Site | undefined> {
  const dataset = findDataset(config.dataset);
  const entry = manifest.datasets[config.dataset];
  if (!dataset || !entry) return undefined;
  const slices: Partial<Record<Kind, Awaited<ReturnType<typeof readSlice>>>> = {};
  for (const kind of KINDS) {
    const live = entry.live_dimensions?.includes(config[kind].dimension) === true;
    slices[kind] = live ? await readSlice(read, manifest, config.dataset, config[kind].dimension) : undefined;
  }
  const all = canvasVocabulary(builderVocabulary(manifest));
  const words = datasetWords(config.dataset);
  const source = fillNote(dataset.source_note ?? "", noteContext({ dataset: config.dataset } as Preset, manifest));
  // A value is named as a person writes it (src/lib/displayNames.ts); the canvas keeps the register's capitals.
  const fieldKind = (field: string): Kind | undefined => KINDS.find((kind) => config[kind].dimension === field);
  const names = labeller(
    builtDisplayNames(),
    (field) => findDimension(field)?.key_separator,
    (field) => {
      const kind = fieldKind(field);
      return (kind ? (slices[kind] ?? []) : []).map((r) => r.value);
    },
    valueWords,
  );
  const kit: Kit = {
    config,
    manifest,
    slices: { brand: slices.brand, model: slices.model },
    events: readEvents(read),
    label: names.label,
    tail: names.tail,
    separator: findDimension(config.model.dimension)?.key_separator,
    dataset: { counted: (n, period) => countedText(words?.leader_count, n, period), showsYear: dataset.shows_year_change === true },
    period: {
      window: (end, months) => fillTemplate(phrases.window_to, { span: months, end: monthLabel(end) }).text,
      month: (month) => fillTemplate(phrases.window_month, { end: monthLabel(month) }).text,
    },
    phrases: { priorMonths: phrases.prior_months },
    floors: { change: yearChangeFloor(), share: findMeasure("share")?.guards?.min_denominator ?? 0 },
    format: { share: pct },
    link: (kind, value) => answerPageLink(all, manifest, { dataset: config.dataset, measure: config.measure, field: config[kind].dimension, value }),
    provenance: {
      source: source.unresolved.length === 0 && source.text ? source.text : undefined,
      snapshot: fillNote(canvasSpec.words.snapshot_line, { date: manifest.latest_snapshot }).text,
    },
  };
  return answerSite(kit);
}
