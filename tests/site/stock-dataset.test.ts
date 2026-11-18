// A dataset of one period (dimensions.json, single_period) in Build and in the resolver (D-139): it is offered with exactly the dimensions its manifest lists,
// as a ranking of one field and a grid of two, from the slices and the pair, and never over time; and a table the manifest says was written under the small-cell
// rule is drawn, while one that is not stays blocked. Through the real modules and config over a manifest written here; the dataset is whichever config marks
// as having one period, and no field is named: the fields are the ones its manifest lists.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const config = await import("../../src/lib/config.ts");
const { builderVocabulary, builderPresets, viewsFor, settle } = await import("../../src/lib/builder.ts");
const { resolvePreset, inferShape, questionFacts } = await import("../../src/lib/resolve.ts");
const { shapesFor, isWindowShape } = await import("../../src/lib/shapes.ts");
const { everythingBuilt } = await import("./support/observe.ts");
type Manifest = import("../../src/lib/data.ts").Manifest;
type Preset = import("../../src/lib/config.ts").Preset;

const stock = config.datasets.find((d) => d.single_period);
assert.ok(stock, "config marks a dataset as having one period");
const D = stock.id;
// The two fields its entry lists, as config offers them for it (the measure's dataset_dimensions), and the pair of them.
const offered = Object.keys(config.builderSpec.measures.find((m) => m.id === "count")?.dataset_dimensions?.[D] ?? {});
const [owner, plain] = [config.dimensions.find((d) => d.applies_to?.includes(D))?.id as string, offered.find((id) => !config.findDimension(id)?.applies_to) as string];
const pair = `${owner}__${plain}`;
const rule = { minimum: 10, minimum_hidden_cells: 2, minimum_hidden_vehicles: 10, months: 1 };
const entry = (extra: object = {}) => ({ months: 1, latest_month: "2026-10", live_dimensions: [owner, plain], live_pairs: [pair], facts: null, small_cells: { [owner]: rule }, small_cell_pairs: { [pair]: rule }, ...extra });
const manifest = (extra: object = {}): Manifest => ({ ...everythingBuilt(), latest_snapshot: "2026-10-31", datasets: { ...everythingBuilt().datasets, [D]: entry(extra) } }) as unknown as Manifest;

const count = (by: string | null, by2?: string, id = D): Preset =>
  builderPresets({ dataset: id, measure: "count", by, values: [], ...(by2 ? { by2, values2: [] } : {}), where: {}, view: null })[0];

test("the dataset is set up in config: two fields, an owner one and a plain one, a pair of them, and a word for each in the sentence", () => {
  assert.ok(owner && plain && owner !== plain);
  assert.deepEqual([...offered].sort(), [owner, plain].sort());
  assert.ok(config.builderSpec.datasets.includes(D));
});

test("Build offers it with exactly the dimensions its manifest lists, a ranking of each, and a grid of the two", () => {
  const vocabulary = builderVocabulary(manifest()).datasets.find((v) => v.dataset === D);
  assert.ok(vocabulary, "the dataset is offered where the build made it");
  assert.deepEqual(vocabulary.measures.map((m) => m.id), ["count"], "only a count: a share, a ratio and a total need a series");
  const count = vocabulary.measures[0];
  assert.deepEqual(count.dimensions.map((d) => d.id).sort(), [owner, plain].sort());
  assert.equal(count.allowsTotal, false, "a total of one period is not a chart");
  for (const d of count.dimensions) assert.equal(d.values, false, "no values to choose: it has no fact table");
  assert.deepEqual(count.dimensions.find((d) => d.id === owner)?.with, [plain]);
  assert.deepEqual(count.dimensions.find((d) => d.id === plain)?.with, [owner]);
  assert.deepEqual(vocabulary.filters, [], "no condition: it has no fact table");
});

test("it is not offered where the build did not make it, and a field its manifest does not list is not offered", () => {
  const without = { ...manifest(), datasets: everythingBuilt().datasets } as unknown as Manifest;
  assert.equal(builderVocabulary(without).datasets.some((v) => v.dataset === D), false);
  const one = builderVocabulary(manifest({ live_dimensions: [plain], live_pairs: [] })).datasets.find((v) => v.dataset === D);
  assert.deepEqual(one?.measures[0].dimensions.map((d) => d.id), [plain]);
  assert.deepEqual(one?.measures[0].dimensions[0].with, [], "no pair, no grid");
  const nothing = builderVocabulary(manifest({ live_dimensions: [], live_pairs: [] })).datasets.find((v) => v.dataset === D);
  assert.equal(nothing, undefined);
});

test("a count by the protected field is a ranking in the one month, from the slice, and is live", () => {
  const preset = count(owner);
  const r = resolvePreset(preset, manifest());
  assert.equal(r.shape, "league");
  assert.equal(r.status, "live");
  assert.deepEqual(r.preventsRender, []);
  assert.deepEqual(r.source, { dataset: D, dimension: owner });
  assert.equal(preset.period, config.builderSpec.period_single);
  assert.deepEqual(viewsFor({ dataset: D, measure: "count", by: owner, values: [], where: {}, view: null }), [], "nothing to switch to");
});

test("two fields are a grid of the pair, every value of both, and live; the pair is read in either order", () => {
  for (const [a, b] of [[owner, plain], [plain, owner]]) {
    const r = resolvePreset(count(a, b), manifest());
    assert.equal(r.shape, "matrix", `${a} by ${b}`);
    assert.equal(r.status, "live");
    assert.deepEqual(r.source, { dataset: D, dimension: a, cross: { dimension: b, pair: { pair, side: a === owner ? "a" : "b" }, grid: true } });
  }
});

test("a dataset of one period has no time shapes: a total, and any line over time, is blocked", () => {
  const total = resolvePreset(count(null), manifest());
  assert.equal(total.status, "blocked");
  assert.ok(total.preventsRender.some((m) => /has one period/.test(m)));
  const lines = resolvePreset({ ...count(plain), shape_override: "trend" }, manifest());
  assert.ok(lines.preventsRender.length > 0, "a pin to a time shape is not drawn");
  assert.ok(lines.invalid.some((m) => /does not fit/.test(m)));
  // Asked for any range of time, the question is still of the one period.
  for (const period of config.periods.map((p) => p.id)) assert.equal(inferShape({ ...count(plain), shape_override: undefined, period }, config.findDimension(plain), config.findMeasure("count")), "league", period);
});

test("the rule table reads one period from the dataset: the same question over time is lines, in one period it is a ranking", () => {
  const facts = { measure: "count", by: "category", values: "few", picked: "none", crossed_with: "none" };
  assert.deepEqual(shapesFor({ ...facts, span: "over_time", periods: "several" }), ["trend"]);
  assert.deepEqual(shapesFor({ ...facts, span: "one_period", periods: "several" }), ["trend"], "one window of a series is still lines");
  assert.deepEqual(shapesFor({ ...facts, span: "one_period", periods: "one" }), ["league"]);
  assert.deepEqual(shapesFor({ ...facts, by: "none", span: "one_period", periods: "one" }), ["trend"], "a total falls to the last rule, which the resolver blocks");
  assert.equal(isWindowShape("league"), true, "the new rule asks for one period too, so a ranking stays a shape of one window");
  assert.equal(questionFacts(count(owner), config.findDimension(owner), config.findMeasure("count")).periods, "one");
  assert.equal(questionFacts({ ...count(owner), dataset: config.builderSpec.dataset }, config.findDimension(owner), config.findMeasure("count")).periods, "several");
});

test("a protected table is drawn only where its own manifest entry says the rule was applied; otherwise the old block holds", () => {
  const unlisted = (key: "small_cells" | "small_cell_pairs", value: object) => manifest({ [key]: value });
  const reason = (p: Preset, m: Manifest) => resolvePreset(p, m).blocked.filter((b) => /small counts hidden/.test(b));
  assert.deepEqual(reason(count(owner), manifest()), []);
  // listed with no rule stated (an entry that is not an object, or states no least count): blocked.
  for (const bad of [{ [owner]: {} }, { [owner]: "x" }, { [owner]: { minimum: 0 } }]) assert.equal(reason(count(owner), unlisted("small_cells", bad)).length, 1, JSON.stringify(bad));
  // the grid needs the pair's own entry, not only the slice's.
  assert.equal(reason(count(owner, plain), unlisted("small_cell_pairs", {})).length, 1, "the protected field is blocked: the slice's entry alone does not cover the pair");
  assert.equal(resolvePreset(count(owner, plain), unlisted("small_cell_pairs", {})).status, "blocked");
  assert.deepEqual(reason(count(owner, plain), manifest()), []);
});

test("a protected field is not drawn narrowed, crossed or as a condition, even in a dataset of one period", () => {
  const m = manifest();
  const blockedFor = (p: Preset) => resolvePreset(p, m).blocked.filter((b) => /small counts hidden/.test(b));
  assert.equal(blockedFor({ ...count(plain), filters: [{ [owner]: "x" }] }).length, 1, "a preset's filter");
  assert.equal(blockedFor({ ...count(plain), where: { [owner]: ["x"] } }).length, 1, "a condition");
  assert.equal(blockedFor({ ...count(owner), cross: plain }).length, 1, "a crossing");
});

test("the same block holds in a dataset of several periods, whatever its entry holds: the field is not offered a hidden-cell drawing there", () => {
  const dataset = config.builderSpec.dataset;
  const base = everythingBuilt();
  const m = { ...base, datasets: { ...base.datasets, [dataset]: { ...base.datasets[dataset], small_cells: { [plain]: rule } } } } as unknown as Manifest;
  // Pinned to a ranking over a year, the one shape that could draw a hidden count, so the block is what stops it.
  const r = resolvePreset({ ...count(plain, undefined, dataset), dataset, shape_override: "league", period: "latest_year" }, m);
  assert.equal(r.blocked.filter((b) => /small counts hidden/.test(b)).length, 1);
  assert.ok(r.preventsRender.length > 0);
});

test("a link that names the dataset and a field settles to the question it names, with nothing to choose", () => {
  const vocabulary = builderVocabulary(manifest());
  const q = settle(vocabulary, { dataset: D, measure: "count", by: owner, by2: plain, view: "trend" });
  assert.equal(q.dataset, D);
  assert.equal(q.by, owner);
  assert.equal(q.by2, plain);
  assert.equal(q.view, null);
  assert.deepEqual(q.values, []);
  const alone = settle(vocabulary, { dataset: D, measure: "share", by: owner });
  assert.equal(alone.measure, "count", "a measure the dataset does not offer becomes the one it does");
});

test("a dataset of one period names its window in its own words, never by the month it ends in", async () => {
  const { rankingWords, rankingText } = await import("../../src/lib/sentences.ts");
  const words = config.datasetWords(D);
  assert.ok(words?.window_one, "config gives the dataset its own words for the window");
  assert.doesNotMatch(words.window_one, /\d/);
  const facts = { span: 1, end: "2026-10", latest: "2026-10" };
  assert.equal(rankingWords(config.phrases, { ...facts, once: words.window_one }).window, words.window_one);
  assert.match(rankingWords(config.phrases, facts).window, /2026/, "a dataset with several months still names the month");
  const basis = rankingText(config.phrases, { basis: "Counted {window}", ...facts, once: words.window_one, covers: { first: "2026-10", last: "2026-10" } }).text;
  assert.match(basis, new RegExp(`Counted ${words.window_one}`));
  // The sentences that carry {window} are the ones a grid and a ranking of this dataset fill with it.
  const sentence = config.phrases.matrix_rows_all.replace("{field}", "x").replace("{window}", words.window_one);
  assert.doesNotMatch(sentence, /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/);
});
