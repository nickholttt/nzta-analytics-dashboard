// The latest month, the front page's first section (src/lib/latestMonth.ts, config/latest_month.json): the figures it works out from the slices, the
// links each block opens in the canvas read back by the canvas's own reader, the anchors it points at, and the build-time reader held to the browser's
// loader. The module names no field or value, so the fixtures here are made up. Run with Node's own test runner:
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { realisticBuilt } from "./support/observe.ts";

const { latestConfig, latestMonthView, monthOf } = await import("../../src/lib/latestMonth.ts");
const { latestMonthLink } = await import("../../src/lib/latestMonthLinks.ts");
const { readSlice, latestMonthSection } = await import("../../src/lib/latestMonthBuild.ts");
const { count, fillTemplate, monthLabel } = await import("../../src/lib/sentences.ts");
const { pct, shareChange } = await import("../../src/lib/measures.ts");
const { MEASUREMENT } = await import("../../src/lib/events.ts");
const canvas = await import("../../src/lib/canvas.ts");
const builder = await import("../../src/lib/builder.ts");
const config = await import("../../src/lib/config.ts");
const { chartSentences } = await import("../../src/lib/chartWords.ts");
const { fieldNoteAnchor, fullNote } = await import("../../src/lib/dimensionNote.ts");
const { datasetLatestMonth } = await import("../../src/lib/data.ts");
type Kit = import("../../src/lib/latestMonth.ts").Kit;
type SliceRow = import("../../src/lib/data.ts").SliceRow;
type Event = import("../../src/lib/data.ts").Event;
type BlockConfig = import("../../src/lib/latestMonth.ts").BlockConfig;

const MONTH = "2026-10";
const PRIOR = "2025-10";
// A slice of made-up values: for each month, each value's count, every row carrying the month's total.
function slice(months: Record<string, Record<string, number | null>>, hiddenToo = false): SliceRow[] {
  return Object.entries(months).flatMap(([month, values]) => {
    const total = Object.values(values).reduce<number>((s, n) => s + (n ?? 0), 0) + (hiddenToo ? 5 : 0);
    return Object.entries(values).map(([value, n]): SliceRow => (n === null ? { month, value, n: Number.NaN, denominator: total, hidden: true } : { month, value, n, denominator: total }));
  });
}

const block = (kind: BlockConfig["kind"], dimension: string | undefined, over: Partial<BlockConfig> = {}): BlockConfig => ({
  id: `${kind}-${dimension ?? "all"}`,
  kind,
  dimension,
  definition: "/method#x",
  canvas: { measure: "count", by: dimension !== undefined, type: null },
  ...over,
});

// The shared slices of two fields that count the same 1,000 vehicles in the month and 800 in the month a year earlier.
const field_a = slice({
  [MONTH]: { alpha: 600, beta: 300, gamma: 100 },
  [PRIOR]: { alpha: 400, beta: 350, gamma: 50 },
});
const field_b = slice({
  [MONTH]: { p1: 500, p2: 400, p3: 98, p4: 2 },
  [PRIOR]: { p1: 300, p2: 450, p3: 48, p4: 2 },
});

function kit(over: Partial<Kit> & { blocks?: BlockConfig[]; slices?: Kit["slices"] } = {}): Kit {
  const { blocks, slices, ...rest } = over;
  return {
    config: { ...latestConfig, dataset: "set_one", total_from: "field_a", blocks: blocks ?? [block("total", undefined), block("split", "field_a"), block("ranking", "field_b", { top: 3 }), block("movers", "field_b", { each: 2, minimum: 100, least: 0.05 })] },
    manifest: { latest_snapshot: "2026-10-31", datasets: { set_one: { latest_month: MONTH, live_dimensions: ["field_a", "field_b"] } } } as never,
    slices: slices ?? { field_a, field_b },
    events: [],
    sentences: chartSentences,
    label: { field: (d) => ({ field_a: "Field A", field_b: "Field B" })[d], value: (_d, v) => v },
    dataset: { counted: (n, window) => `${count(n)} vehicles ${window}`, showsYear: true, unit: "Vehicles each month" },
    window: (m) => `in ${monthLabel(m)}`,
    floors: { change: 50, share: 200 },
    format: { share: pct, points: shareChange },
    hidden: { word: "hidden", link: "How counts are hidden", reason: (m) => `Counts under ${m} are hidden.`, note: (n, m) => `${n} hidden under ${m}.` },
    ruleMinimum: () => undefined,
    link: () => "/canvas/?asked",
    provenance: { snapshot: "Snapshot." },
    ...rest,
  };
}

const make = (over: Parameters<typeof kit>[0] = {}) => latestMonthView(kit(over));
const find = (view: ReturnType<typeof make>, id: string) => view?.blocks.find((b) => b.id === id);

test("the month's figure is the month's total, which every field's parts add up to, and the sentence is the chart sentence's own", () => {
  const view = make();
  assert.ok(view);
  assert.equal(view.month, MONTH);
  const total = find(view, "total-all");
  assert.equal(total?.figure, "1,000");
  assert.equal(total?.sentences[0], "1,000 vehicles in Oct 2026, up 25% on the 800 in Oct 2025.");
  for (const [dimension, rows] of Object.entries({ field_a, field_b })) {
    const sum = rows.filter((r) => r.month === MONTH).reduce((s, r) => s + r.n, 0);
    assert.equal(count(sum), total?.figure, `${dimension}: its parts add up to the month's figure`);
  }
  const split = find(view, "split-field_a");
  assert.deepEqual(split?.rows.map((r) => r.count), ["600", "300", "100"]);
  assert.deepEqual(split?.rows.map((r) => r.share), ["60.0%", "30.0%", "10.0%"]);
});

test("the earlier month is the same month one year before, and a change in share is in percentage points of the two months' own totals", () => {
  const view = make();
  const split = find(view, "split-field_a");
  // alpha: 60% now, 400 of 800 = 50% a year ago.
  assert.deepEqual(split?.rows[0].points, { direction: "up", text: "+10.0 pp" });
  assert.equal(view?.prior, PRIOR);
  const ranking = find(view, "ranking-field_b");
  assert.deepEqual(ranking?.rows[0].change, { direction: "up", text: "+67%" }, "500 on 300");
  assert.deepEqual(ranking?.rows[1].change, { direction: "down", text: "−11%" }, "400 on 450");
  assert.match(ranking?.sentences[0] ?? "", /up 67% on the 300 in Oct 2025\.$/);
});

test("a month with no year-ago data gives no change, and the figure stays", () => {
  const view = make({ slices: { field_a: field_a.filter((r) => r.month === MONTH), field_b: field_b.filter((r) => r.month === MONTH) } });
  assert.equal(find(view, "total-all")?.sentences[0], "1,000 vehicles in Oct 2026.");
  assert.ok(find(view, "split-field_a")?.rows.every((r) => r.points === undefined));
  assert.ok(find(view, "ranking-field_b")?.rows.every((r) => r.change === undefined));
  assert.equal(find(view, "movers-field_b"), undefined, "a move needs a month to move from");
  assert.doesNotMatch(JSON.stringify(view), /up |down /, "no comparison anywhere");
});

test("a change on a year ago is withheld where the value had fewer vehicles than the floor then, and the same month a year earlier is the one read", () => {
  const view = make();
  // gamma had 50 a year ago: at the floor, so stated. With a floor of 51 it is not.
  assert.ok(find(view, "split-field_a")?.rows[2].points);
  const stricter = make({ floors: { change: 51, share: 200 }, blocks: [block("total", undefined), block("ranking", "field_a", { top: 3 })] });
  assert.equal(find(stricter, "ranking-field_a")?.rows[2].change, undefined);
  assert.ok(find(stricter, "ranking-field_a")?.rows[0].change);
});

test("movers keep to the minimum in both months: a move from 2 to 6 is not a headline, and the rest are ordered by size of change", () => {
  const moving = slice({
    [MONTH]: { a: 400, b: 6, c: 150, d: 120, e: 300, f: 300 },
    [PRIOR]: { a: 200, b: 2, c: 300, d: 40, e: 301, f: 150 },
  });
  const view = make({ blocks: [block("total", undefined), block("movers", "field_b", { each: 2, minimum: 100, least: 0.05 })], slices: { field_a: moving, field_b: moving } });
  const movers = find(view, "movers-field_b");
  // b: 6 from 2 and d: 120 from 40 are under the minimum a year ago; e moved by 0.3%, under the least change that is a move.
  assert.deepEqual(movers?.rows.map((r) => [r.name, r.change?.text]), [["a", "+100%"], ["f", "+100%"], ["c", "−50%"]]);
  assert.ok(!movers?.rows.some((r) => ["b", "d", "e"].includes(r.name)));
  assert.match(movers?.sentences[0] ?? "", /^a rose most by field B: 400 vehicles in Oct 2026, up 100% on the 200 in Oct 2025\.$/);
  assert.match(movers?.sentences[1] ?? "", /^c fell most/);
  assert.ok(movers?.notes[0].includes("100"), "the minimum is said");
  const each = make({ blocks: [block("total", undefined), block("movers", "field_b", { each: 1, minimum: 100, least: 0.05 })], slices: { field_a: moving, field_b: moving } });
  assert.equal(find(each, "movers-field_b")?.rows.length, 2, "one of each side");
});

test("a hidden count is shown as hidden, never as zero or NaN, and is never ranked, added or the ground of a sentence", () => {
  const hiding = slice({ [MONTH]: { alpha: 600, beta: 300, gamma: null }, [PRIOR]: { alpha: 400, beta: 350, gamma: null } });
  const view = make({ blocks: [block("total", undefined), block("split", "field_a"), block("ranking", "field_a", { top: 5 }), block("movers", "field_a", { each: 2, minimum: 10 })], slices: { field_a: hiding, field_b }, ruleMinimum: () => 10 });
  const split = find(view, "split-field_a");
  const hidden = split?.rows.find((r) => r.name === "gamma");
  assert.equal(hidden?.count, undefined);
  assert.equal(hidden?.share, undefined);
  assert.equal(hidden?.hidden?.word, "hidden");
  assert.deepEqual(split?.sentences, [], "who is largest rests on counts, one of which is hidden");
  assert.deepEqual(find(view, "ranking-field_a")?.sentences, []);
  assert.ok(!find(view, "ranking-field_a")?.rows.some((r) => r.name === "gamma"));
  assert.ok(!find(view, "movers-field_a")?.rows.some((r) => r.name === "gamma"));
  assert.equal(split?.notes.length, 1);
  assert.doesNotMatch(JSON.stringify(view), /NaN|null/);
});

test("a month not broken down by a field, or a slice that disagrees on the month's total, draws no block for the field", () => {
  const notBroken: SliceRow[] = [{ month: MONTH, value: "__NOT_BROKEN_DOWN__", n: 1000, denominator: 1000, notBrokenDown: true }, ...field_b.filter((r) => r.month === PRIOR)];
  assert.equal(monthOf(notBroken, MONTH), undefined);
  assert.equal(find(make({ slices: { field_a, field_b: notBroken } }), "ranking-field_b"), undefined);
  const other = field_b.map((r) => (r.month === MONTH ? { ...r, denominator: 1001 } : r));
  const view = make({ slices: { field_a, field_b: other } });
  assert.equal(find(view, "ranking-field_b"), undefined);
  assert.ok(find(view, "total-all"), "the others are still drawn");
});

test("a field the manifest does not list as live, or whose slice cannot be read, leaves no block; a build without the dataset or the total has no section", () => {
  // The Market type block is written in config before the field is built: its field is not live, so there is no block and no gap.
  const listed = make({ manifest: { latest_snapshot: "2026-10-31", datasets: { set_one: { latest_month: MONTH, live_dimensions: ["field_a"] } } } as never });
  assert.ok(find(listed, "split-field_a") && !find(listed, "ranking-field_b") && !find(listed, "movers-field_b"));
  const unreadable = make({ slices: { field_a, field_b: undefined } });
  assert.ok(find(unreadable, "split-field_a") && !find(unreadable, "ranking-field_b"));
  assert.equal(make({ manifest: { latest_snapshot: "2026-10-31", datasets: { other: {} } } as never }), undefined);
  assert.equal(make({ manifest: { latest_snapshot: "2026-10-31", datasets: { set_one: { not_built: "no store" } } } as never }), undefined);
  assert.equal(make({ slices: { field_b } }), undefined, "no total, no section");
});

test("a change in how the data is recorded between the two months drops the comparison and keeps the figure (invariant 7)", () => {
  const recording: Event = { id: "e", date_start: "2026-02-01", date_end: null, mechanism: MEASUREMENT, scope: "everything", scope_values: [], title: "t", summary: "s", announced_date: null, source_url: "u" };
  const view = make({ events: [recording] });
  assert.equal(find(view, "total-all")?.sentences[0], "1,000 vehicles in Oct 2026.");
  assert.ok(find(view, "ranking-field_b")?.rows.every((r) => r.change === undefined));
  assert.ok(find(view, "split-field_a")?.rows.every((r) => r.points === undefined));
  // Events not loaded: nothing can be said, so nothing is compared.
  assert.equal(find(make({ events: null }), "total-all")?.sentences[0], "1,000 vehicles in Oct 2026.");
  // A dataset whose counts cannot be set beside a year ago (survivors) compares nothing.
  assert.equal(find(make({ dataset: { counted: (n, w) => `${count(n)} vehicles ${w}`, showsYear: false, unit: "u" } }), "total-all")?.sentences[0], "1,000 vehicles in Oct 2026.");
});

test("a share is not stated for a month with fewer vehicles than the floor", () => {
  const view = make({ floors: { change: 50, share: 2000 } });
  assert.equal(find(view, "split-field_a"), undefined);
});

// ---- Each block's link, read back by the canvas ----

const built = realisticBuilt();
const all = canvas.canvasVocabulary(builder.builderVocabulary(built));
const live = new Set(built.datasets[latestConfig.dataset]?.live_dimensions);

test("the section's dataset is one this build's vocabulary holds, so its links can open", () => {
  assert.ok(built.datasets[latestConfig.dataset], "config/latest_month.json names a dataset config/dimensions.json defines");
  assert.ok(all.datasets.some((d) => d.dataset === latestConfig.dataset));
});

for (const b of latestConfig.blocks.filter((x) => !x.dimension || live.has(x.dimension))) {
  test(`block ${b.id}: its link opens the canvas on the dataset, measure, field and month the block shows, and writes back unchanged`, () => {
    const by = b.canvas.by ? (b.dimension as string) : null;
    const link = latestMonthLink(all, built, { dataset: latestConfig.dataset, measure: b.canvas.measure, by, type: b.canvas.type, settings: b.canvas.settings });
    assert.ok(link, "the canvas can draw this question");
    const url = new URL(link, "https://site.example");
    assert.equal(url.pathname, "/canvas/");
    const asked = canvas.readCanvas(url.search);
    assert.equal(asked.length, 1);
    const opened = canvas.withFittingTypes(canvas.settleCanvas(all, asked), built);
    const q = opened.charts[0].question;
    assert.equal(q.dataset, latestConfig.dataset);
    assert.equal(q.measure, b.canvas.measure);
    assert.equal(q.by, by);
    assert.deepEqual(q.where, {}, "every vehicle, as the block counts them");
    assert.equal(opened.charts[0].type, b.canvas.type);
    assert.deepEqual(builder.linkNotices(all, asked[0].asked, q), [], "the link asks for nothing the page does not give");
    assert.ok(canvas.draws(q, opened.charts[0].type ?? canvas.bestType(q), built));
    // The chart's own settings: a ranking of the newest month, and no month named, so it is the dataset's newest, the month the block shows.
    const settings = canvas.chartSettings(url.search, "c1");
    assert.deepEqual(Object.fromEntries(settings.filter(([name]) => name !== "month")), b.canvas.settings ?? {});
    assert.ok(!settings.some(([name]) => name === "month"));
    assert.deepEqual([...canvas.canvasAddress(url.search, opened)].sort(), [...url.searchParams].sort(), "the address a canvas writes for what it opened is the one it opened from");
  });
}

// ---- Each view's link, read back by the canvas ----

const { conditionOrder } = await import("../../src/lib/displayNames.ts");
const { builtDisplayNames } = await import("../../src/lib/displayNamesBuild.ts");

for (const b of latestConfig.blocks.filter((x) => x.views && x.dimension && live.has(x.dimension))) {
  test(`block ${b.id}: each view's link opens the canvas on the block's question kept to that condition, and for all of them on the block's own`, () => {
    const field = latestConfig.view_field as string;
    const values = conditionOrder(builtDisplayNames(), field);
    assert.ok(values.length >= 2, "the display names file gives the conditions");
    for (const where of [...values.map((v) => ({ [field]: [v] })), undefined]) {
      const link = latestMonthLink(all, built, { dataset: latestConfig.dataset, measure: b.canvas.measure, by: b.canvas.by ? (b.dimension as string) : null, type: b.canvas.type, settings: b.canvas.settings, where });
      assert.ok(link, "the canvas can draw this question");
      const url = new URL(link, "https://site.example");
      const asked = canvas.readCanvas(url.search);
      const opened = canvas.withFittingTypes(canvas.settleCanvas(all, asked), built);
      const q = opened.charts[0].question;
      assert.equal(q.dataset, latestConfig.dataset);
      assert.equal(q.measure, b.canvas.measure);
      assert.equal(q.by, b.canvas.by ? b.dimension : null);
      assert.deepEqual(q.where, where ?? {});
      assert.equal(opened.charts[0].type, b.canvas.type);
      assert.deepEqual(builder.linkNotices(all, asked[0].asked, q), []);
      assert.ok(canvas.draws(q, opened.charts[0].type ?? canvas.bestType(q), built));
      assert.deepEqual([...canvas.canvasAddress(url.search, opened)].sort(), [...url.searchParams].sort());
      const settings = canvas.chartSettings(url.search, "c1");
      assert.deepEqual(Object.fromEntries(settings.filter(([name]) => name !== "month")), b.canvas.settings ?? {});
    }
  });
}

test("the views of the real section are the registered figures cut by new or used, the switch's three, each with a link", { skip: !existsSync("public/data/manifest.json") }, async () => {
  const { readPublished } = await import("../../src/lib/publishedFiles.mjs");
  const manifest = JSON.parse(readFileSync("public/data/manifest.json", "utf8"));
  const section = await latestMonthSection(manifest, readPublished);
  assert.ok(section?.switch, "the build gives the switch");
  assert.deepEqual(section.switch.labels, ["New", "Used imports", "All"]);
  const total = section.blocks.find((b) => b.kind === "total");
  const [, n, u] = /^Of these, ([\d,]+) new vehicles and ([\d,]+) used imports\.$/.exec(total?.parts ?? "") ?? [];
  assert.ok(n && u, total?.parts);
  assert.equal(count(Number(n.replace(/,/g, "")) + Number(u.replace(/,/g, ""))), total?.figure, "new and used imports are the month's figure");
  for (const b of section.blocks.filter((x) => latestConfig.blocks.find((c) => c.id === x.id)?.views)) {
    assert.equal(b.views?.length, 3, b.id);
    for (const p of b.views ?? []) {
      assert.ok(p.canvas.startsWith("/canvas/?"), p.label);
      assert.ok(p.rows.length > 0 || p.empty, `${b.id} ${p.label} has a table or says it has none`);
    }
    // The all view is the block's own figures, each row's parts adding up to its count.
    const all = b.views?.[2];
    assert.deepEqual(all?.rows.map((r) => r.count), b.rows.map((r) => r.count));
    for (const r of all?.rows ?? []) assert.equal(count((r.parts ?? []).reduce((s, x) => s + Number(x.replace(/,/g, "")), 0)), r.count, `${b.id} ${r.name}`);
  }
});

test("a link to a question the canvas answers with another is not made: a field this build lacks leaves no link", () => {
  assert.equal(latestMonthLink(all, built, { dataset: latestConfig.dataset, measure: "count", by: "no_such_field", type: null }), undefined);
  assert.equal(latestMonthLink(all, built, { dataset: "no_such_dataset", measure: "count", by: null, type: null }), undefined);
  // A chart type the question does not fit (a ranking of a field with two values) is not asked for either.
  assert.equal(latestMonthLink(all, built, { dataset: latestConfig.dataset, measure: "count", by: "import_status", type: "league" }), undefined);
});

test("a block's question kept to one value of another field opens the canvas with that condition and writes back unchanged", () => {
  const ask = { dataset: latestConfig.dataset, measure: "count", by: "make", type: "league", settings: { period: "latest_month" }, where: { import_status: ["NZ New"] } };
  const link = latestMonthLink(all, built, ask);
  assert.ok(link, "the canvas can draw this question");
  const url = new URL(link, "https://site.example");
  const asked = canvas.readCanvas(url.search);
  const opened = canvas.withFittingTypes(canvas.settleCanvas(all, asked), built);
  assert.deepEqual(opened.charts[0].question.where, { import_status: ["NZ New"] });
  assert.equal(opened.charts[0].question.by, "make");
  assert.deepEqual([...canvas.canvasAddress(url.search, opened)].sort(), [...url.searchParams].sort());
  // With no condition the address is the block's own, unchanged.
  assert.equal(latestMonthLink(all, built, { ...ask, where: undefined }), latestMonthLink(all, built, { ...ask, where: {} }));
  assert.ok(!new URL(latestMonthLink(all, built, { ...ask, where: undefined }) as string, "https://site.example").search.includes("where"));
  assert.equal(latestMonthLink(all, built, { ...ask, where: { no_such_field: ["x"] } }), undefined);
});

test("the month shown is the dataset's newest month the manifest names, never read from the survivors dataset", () => {
  const view = make();
  assert.equal(view?.month, datasetLatestMonth(kit().manifest, "set_one"));
  assert.equal(latestConfig.dataset, config.builderSpec.datasets.find((id) => id === latestConfig.dataset));
  assert.equal(config.findDataset(latestConfig.dataset)?.grain, "flow", "true registrations, which never share a chart with survivors");
});

// ---- The definitions each block points at ----

test("every definition a block points at, and the section's two links, is a page and an anchor that exist", () => {
  const method = readFileSync(new URL("../../src/pages/method.astro", import.meta.url), "utf8");
  const anchors = new Set([...method.matchAll(/\bid="([a-z0-9-]+)"/g)].map((m) => m[1]));
  for (const d of config.dimensions) if (fullNote(d as never)) anchors.add(fieldNoteAnchor(d.id));
  const hrefs = [...latestConfig.blocks.map((b) => b.definition), latestConfig.hidden.href, latestConfig.caveat.href];
  for (const href of hrefs) {
    const [path, anchor] = href.split("#");
    assert.ok(["/method", "/caveats"].includes(path), `${href}: a page that exists`);
    assert.ok(existsSync(new URL(`../../src/pages${path}.astro`, import.meta.url)));
    if (anchor) assert.ok(path === "/method" && anchors.has(anchor), `${href}: no heading has that anchor`);
  }
});

// ---- The build-time reader and the browser's loader read a slice the same way ----

const root = new URL("./fixtures/hidden-cube/", import.meta.url);
const DATASET = "registrations_surviving";
const rule = { minimum: 10 };
const manifestWith = (small: Record<string, unknown>) => ({ latest_snapshot: "2026-10-31", datasets: { [DATASET]: { live_dimensions: [], small_cells: small } } }) as never;
const reader = (folder: URL) => (relative: string) => {
  try {
    const bytes = readFileSync(new URL(relative, folder));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  } catch {
    return undefined;
  }
};
const folder = reader(root);

test("the reader returns the loader's rows for an ordinary slice, a slice of hidden cells and a month not broken down", async () => {
  const served = manifestWith({ hidden_cell: rule, not_broken_down: rule });
  globalThis.fetch = (async (url: string) => {
    const path = String(url).replace(/^\/data\//, "");
    try {
      if (path === "manifest.json") return { ok: true, status: 200, json: async () => served };
      const bytes = readFileSync(new URL(path, root));
      return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    } catch {
      return { ok: false, status: 404 };
    }
  }) as never;
  const { loadSlice } = await import("../../src/lib/data.ts");
  for (const name of ["ordinary", "hidden_cell", "not_broken_down"]) {
    const loaded = await loadSlice(DATASET, name);
    const read = await readSlice(folder, served, DATASET, name);
    assert.deepEqual(read, loaded, name);
  }
  const hidden = (await readSlice(folder, served, DATASET, "hidden_cell")) ?? [];
  assert.ok(hidden.some((r) => r.hidden && Number.isNaN(r.n)), "a hidden count has no number, and is never zero");
});

test("a slice that hides counts is refused whole where the manifest does not say it was written under the rule, as the loader refuses it", async () => {
  assert.equal(await readSlice(folder, manifestWith({}), DATASET, "hidden_cell"), undefined);
  assert.equal(await readSlice(folder, manifestWith({}), DATASET, "not_broken_down"), undefined);
  assert.equal((await readSlice(folder, manifestWith({}), DATASET, "ordinary"))?.length, 4);
  assert.equal(await readSlice(folder, manifestWith({}), DATASET, "no_such_slice"), undefined, "a file that is not there is no slice, and no error");
});

// ---- On the build in front of it, where there is one ----

const here = new URL("../../public/data/", import.meta.url);
const haveData = existsSync(new URL("manifest.json", here)) && existsSync(new URL(`cube/${latestConfig.dataset}/${latestConfig.total_from}.parquet`, here));

test("on the built data the figure is the sum of the vehicle-type split and of every other field, and the year-ago month is a year earlier", { skip: !haveData && "no built data in public/data" }, async () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", here), "utf8"));
  const folder = reader(here);
  const view = await latestMonthSection(manifest, folder);
  assert.ok(view);
  assert.equal(view.month, datasetLatestMonth(manifest, latestConfig.dataset));
  assert.equal(view.prior, `${Number(view.month.slice(0, 4)) - 1}${view.month.slice(4)}`);
  const total = find(view, "total");
  for (const dimension of ["vehicle_type", "import_status", "powertrain_group", "make", "model"]) {
    const rows = await readSlice(folder, manifest, latestConfig.dataset, dimension);
    if (!rows) continue;
    const sum = rows.filter((r) => r.month === view.month).reduce((s, r) => s + r.n, 0);
    assert.equal(count(sum), total?.figure, `${dimension}: its parts add up to the month's figure`);
  }
  assert.doesNotMatch(JSON.stringify(view), /NaN|undefined|\{[a-z_]+\}/);
});

test("the words of the section are filled with nothing left over, for a made-up month", () => {
  for (const [key, text] of Object.entries(latestConfig.words)) {
    const { unresolved } = fillTemplate(text, { month: MONTH, prior_month: PRIOR, counted: "c", change: 0.1, prior_count: "1", prior: "p", name: "n", names: "n", field: "f", share: "s", points: "p", minimum: "1", heading: "h", view: "v", parts: "p", count: "1" });
    assert.deepEqual(unresolved, [], key);
  }
});
