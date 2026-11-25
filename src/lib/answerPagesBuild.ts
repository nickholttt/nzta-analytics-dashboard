// The answer pages, read where the site is built (src/pages/[...answer].astro, the front page and the layout call it): the slices the build
// published, in Node with the reader the latest month uses (src/lib/latestMonthBuild.ts, which holds it to the browser's loader), then the pages
// worked out by src/lib/answerPages.ts. Nothing here reaches a browser: the pages ship no script.
//
// Where a file is missing or cannot be read, or the dataset is not in the build, there are no pages and no index. Neither is an error.
import { builderVocabulary, datasetName } from "./builder";
import { canvasSpec, canvasVocabulary } from "./canvas";
import { answerPageLink } from "./answerPageLinks";
import { restrictedCuts, viewCuts } from "./conditionViewsBuild";
import { chipValues, firstAppearance } from "./powertrainCut";
import { hybrid } from "./config";
import { fieldNoteAnchor } from "./dimensionNote";
import { latestMonthLink } from "./latestMonthLinks";
import { readReference } from "./readReference.mjs";
import { defaultWindow, windowsConfig, windowsFor } from "./windows";
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
        return { value, label, phrase: given?.phrase ?? label, ...(given?.phraseOne ? { phraseOne: given.phraseOne } : {}) };
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
  // The windows, and the cuts of the brands and models by powertrain, where the fact table agrees with the slices.
  const latestMonth = datasetLatestMonth(manifest, config.dataset);
  const windows = windowsFor(latestMonth);
  const open = defaultWindow(windows, "brand");
  let cutBy: Kit["cutBy"];
  if (views && display && entry.live_dimensions?.includes(config.cut.dimension)) {
    const cutSlices: Record<string, Awaited<ReturnType<typeof readSlice>>> = { [config.cut.dimension]: await readSlice(read, manifest, config.dataset, config.cut.dimension), [views.field]: await readSlice(read, manifest, config.dataset, views.field) };
    for (const kind of KINDS) cutSlices[config[kind].dimension] = slices[kind];
    const set = await restrictedCuts(read, manifest, config.dataset, views.field, conditionOrder(display, views.field), KINDS.map((kind) => config[kind].dimension), config.cut.dimension, cutSlices);
    if (set) {
      const order = firstAppearance((readReference("powertrain_map.csv") ?? []).map((r: Record<string, string>) => r.powertrain));
      const cutNames = labeller(display, () => undefined, () => set.values, valueWords);
      const coverage = (manifest.datasets[config.dataset] as { mild_hybrid_identification_coverage?: { label: string; complete_at_coverage: number; all_time: { coverage_stated_confidence: number | null }; trailing: { coverage_stated_confidence: number | null } } }).mild_hybrid_identification_coverage;
      const partial = coverage !== undefined && [coverage.all_time.coverage_stated_confidence, coverage.trailing.coverage_stated_confidence].some((x) => x === null || x < coverage.complete_at_coverage);
      // The mild line takes the label the canvas gives it while it is only partly identified.
      const label = (value: string) => (partial && value === hybrid.mild_powertrain && coverage ? coverage.label : cutNames.label(config.cut.dimension, value));
      const chips = chipValues(cutSlices[config.cut.dimension], monthRange(addMonths(latestMonth, 1 - config.window), latestMonth), config.cut.minimum, order);
      cutBy = {
        field: config.cut.dimension,
        chips,
        order,
        label,
        cuts: { brand: set.fields[config.brand.dimension].by, model: set.fields[config.model.dimension].by },
        noted: set.values.includes(hybrid.mild_powertrain) ? { value: hybrid.mild_powertrain, href: `/method#${fieldNoteAnchor(config.cut.dimension)}` } : undefined,
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
    periods: open && windows.length > 0 ? { windows, defaultIndex: open.index, moverPerMonth: windowsConfig.mover_minimum_per_month, span: (end, months) => fillTemplate(phrases.window_to, { span: months, end: monthLabel(end) }).text, range: (start, end) => fillTemplate(config.words.in_ytd, { start: monthLabel(start), end: monthLabel(end) }).text } : undefined,
    cutBy,
    askLink: (ask) => latestMonthLink(all, manifest, { dataset: config.dataset, measure: config.measure, ...ask }),
    link: (kind, value, by) => answerPageLink(all, manifest, { dataset: config.dataset, measure: config.measure, field: config[kind].dimension, value, by }),
    provenance: {
      source: source.unresolved.length === 0 && source.text ? source.text : undefined,
      snapshot: fillNote(canvasSpec.words.snapshot_line, { date: manifest.latest_snapshot }).text,
    },
  };
  return answerSite(kit);
}
