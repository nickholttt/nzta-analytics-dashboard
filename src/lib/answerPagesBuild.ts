// The answer pages, read where the site is built (src/pages/[...answer].astro, the front page and the layout call it): the slices the build
// published, in Node with the reader the latest month uses (src/lib/latestMonthBuild.ts, which holds it to the browser's loader), then the pages
// worked out by src/lib/answerPages.ts. Nothing here reaches a browser: the pages ship no script.
//
// Where a file is missing or cannot be read, or the dataset is not in the build, there are no pages and no index. Neither is an error.
import { builderVocabulary, datasetName } from "./builder";
import { canvasSpec, canvasVocabulary } from "./canvas";
import { answerPageLink } from "./answerPageLinks";
import { viewCuts } from "./conditionViewsBuild";
import { answerConfig, answerSite } from "./answerPages";
import type { AnswerConfig, Kind, Kit, Site } from "./answerPages";
import { datasetWords, dimensionLabel, findDataset, findDimension, findMeasure, phrases, valueWords, yearChangeFloor } from "./config";
import type { Preset } from "./config";
import { datasetLatestMonth } from "./data";
import type { Manifest } from "./data";
import { conditionOrder, conditionWords, labeller } from "./displayNames";
import { builtDisplayNames } from "./displayNamesBuild";
import { readEvents, readSlice } from "./latestMonthBuild";
import type { ReadFile } from "./latestMonthBuild";
import { fillNote, noteContext } from "./notes";
import { addMonths, countedText, fillTemplate, monthLabel, monthRange } from "./sentences";
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
  // The vehicles counted by the condition the pages say their figures under (new or used): cut from the fact table where it agrees with the slices.
  const display = builtDisplayNames();
  let views: Kit["views"];
  if (config.view_field && display) {
    const field = config.view_field;
    const latest = datasetLatestMonth(manifest, config.dataset);
    const wanted = KINDS.map((kind) => config[kind].dimension);
    const bySlice: Record<string, Awaited<ReturnType<typeof readSlice>>> = { [field]: await readSlice(read, manifest, config.dataset, field) };
    for (const kind of KINDS) bySlice[config[kind].dimension] = slices[kind];
    const cut = await viewCuts(read, manifest, config.dataset, field, conditionOrder(display, field), wanted, bySlice, monthRange(addMonths(latest, 1 - config.window), latest));
    const held = cut.cuts[field]?.conditions();
    if (held && held.length > 0) {
      const conditions = held.map((value) => {
        const given = conditionWords(display, field, value);
        const label = given?.label ?? names.label(field, value);
        return { value, label, phrase: given?.phrase ?? label };
      });
      views = {
        field,
        fieldLabel: dimensionLabel(field, false, config.dataset) ?? field,
        conditions,
        cuts: { brand: cut.cuts[config.brand.dimension], model: cut.cuts[config.model.dimension] },
        floor: cut.floors[config.model.dimension],
      };
    }
  }
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
    views,
    link: (kind, value, by) => answerPageLink(all, manifest, { dataset: config.dataset, measure: config.measure, field: config[kind].dimension, value, by }),
    provenance: {
      source: source.unresolved.length === 0 && source.text ? source.text : undefined,
      snapshot: fillNote(canvasSpec.words.snapshot_line, { date: manifest.latest_snapshot }).text,
    },
  };
  return answerSite(kit);
}
