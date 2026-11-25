// The answer pages (src/lib/answerPages.ts, config/answer_pages.json): the figures a brand's and a model's page work out from the slices, the rules that
// hold them back (a hidden count, a count too small to compare, a change in how the data is recorded), the links each opens in the canvas read back by the
// canvas's own reader, the anchors they point at, and, where the build is present, the pages made from the October data against the slices themselves.
// The module names no field or value, so the fixtures here are made up. Run with Node's own test runner:
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { realisticBuilt } from "./support/observe.ts";

const { answerConfig, answerSite } = await import("../../src/lib/answerPages.ts");
const { answerPageLink } = await import("../../src/lib/answerPageLinks.ts");
const { answerPagesSite } = await import("../../src/lib/answerPagesBuild.ts");
const { readSlice } = await import("../../src/lib/latestMonthBuild.ts");
const { count, addMonths, fillTemplate, monthLabel, monthRange } = await import("../../src/lib/sentences.ts");
const { pct } = await import("../../src/lib/measures.ts");
const { MEASUREMENT } = await import("../../src/lib/events.ts");
const canvas = await import("../../src/lib/canvas.ts");
const builder = await import("../../src/lib/builder.ts");
const config = await import("../../src/lib/config.ts");
const { fieldNoteAnchor, fullNote } = await import("../../src/lib/dimensionNote.ts");
type Kit = import("../../src/lib/answerPages.ts").Kit;
type SliceRow = import("../../src/lib/data.ts").SliceRow;
type Event = import("../../src/lib/data.ts").Event;

const LATEST = "2026-10";
const MONTHS = monthRange("2024-11", LATEST);

// Each value's count in a month, as a function of the month, for the brands and for the models under them. A null is a hidden count.
type Counts = Record<string, (month: string) => number | null>;
const recent = (now: number, before = now) => (month: string) => (month > "2025-10" ? now : before);

// A slice from the values' counts: every month, every row carrying the month's total, which the other field's slice of the same vehicles carries too.
function slice(values: Counts, extra = 0, totals: Counts = values): SliceRow[] {
  return MONTHS.flatMap((month) => {
    const total = Object.values(totals).reduce<number>((s, f) => s + (f(month) ?? 0), extra);
    return Object.entries(values).map(([value, f]): SliceRow => {
      const n = f(month);
      return n === null ? { month, value, n: Number.NaN, denominator: total, hidden: true } : { month, value, n, denominator: total };
    });
  });
}

// Four brands: one that grew, one that did not move, one under the minimum (7 a month is 84), and one level with the second (a tie).
const brands: Counts = { ALPHA: recent(100, 80), BETA: recent(60), GAMMA: recent(7), DELTA: recent(60) };
const models: Counts = { "ALPHA|A1": recent(70, 50), "ALPHA|A2": recent(30), "BETA|B1": recent(60), "GAMMA|G1": recent(7), "DELTA|D1": recent(60) };

const wording = {
  window: (end: string, months: number) => `in the ${months} months to ${monthLabel(end)}`,
  month: (month: string) => `in ${monthLabel(month)}`,
};

function kit(over: Partial<Kit> & { brands?: Counts; models?: Counts | null; hiddenBrand?: boolean } = {}): Kit {
  const { brands: b, models: m, ...rest } = over;
  return {
    config: { ...answerConfig, dataset: "set_one", brand: { ...answerConfig.brand, dimension: "field_brand" }, model: { ...answerConfig.model, dimension: "field_model" } },
    manifest: { latest_snapshot: "2026-10-31", datasets: { set_one: { latest_month: LATEST, live_dimensions: ["field_brand", "field_model"] } } } as never,
    slices: { brand: slice(b ?? brands), model: m === null ? undefined : slice(m ?? models, 0, b ?? brands) },
    events: [],
    label: (_dimension, value) => value.replace("|", " "),
    separator: "|",
    dataset: { counted: (n, period) => `${count(n)} vehicles first registered ${period}`, showsYear: true },
    period: wording,
    phrases: { priorMonths: "the same months a year earlier" },
    floors: { change: 50, share: 200 },
    format: { share: pct },
    link: (kind, value) => `/canvas/?${kind}=${encodeURIComponent(value)}`,
    provenance: { snapshot: "Snapshot." },
    ...rest,
  };
}

const site = (over: Parameters<typeof kit>[0] = {}) => answerSite(kit(over));
const page = (s: ReturnType<typeof site>, kind: string, value: string) => s?.pages.find((p) => p.kind === kind && p.value === value);

test("a brand's page: the figure is the sum of its twelve months, and the sentences say it with its change on the twelve months before", () => {
  const p = page(site(), "brand", "ALPHA");
  assert.ok(p);
  assert.equal(p.figure, "1,200");
  assert.equal(p.sentences[0], "ALPHA had 1,200 vehicles first registered in the 12 months to Oct 2026, up 25% on the 960 in the 12 months to Oct 2025.");
  assert.equal(p.sentences[1], "ALPHA had 100 vehicles first registered in Oct 2026, up 25% on the 80 in Oct 2025.");
  assert.equal(p.href, "/brand/alpha/");
  assert.equal(p.title, "How many ALPHA vehicles were first registered in New Zealand in the last 12 months?");
});

test("a brand's place and share are those of the published counts: one of the brands with vehicles, and a share of every vehicle counted in the window", () => {
  const s = site();
  const p = page(s, "brand", "ALPHA");
  // 4 brands, ALPHA first; the total of every vehicle in the twelve months is 12 x (100 + 60 + 7 + 60) = 2,724.
  assert.ok(p?.sentences.includes("ALPHA is number 1 of 4 brands by vehicles first registered in the 12 months to Oct 2026."));
  assert.ok(p?.sentences.includes(`ALPHA had ${pct(1200 / 2724)} of all the vehicles first registered in the 12 months to Oct 2026.`));
});

test("a value level with another has no place, and keeps its share", () => {
  const s = site();
  for (const v of ["BETA", "DELTA"]) {
    const p = page(s, "brand", v);
    assert.ok(p);
    assert.ok(!p.sentences.some((t) => t.includes("is number")), `${v}: level with the other`);
    assert.ok(p.sentences.some((t) => t.includes("of all the vehicles")));
  }
});

test("a brand under the minimum has no page, and neither has its model; the pages that exist are the ones above it", () => {
  const s = site();
  assert.equal(page(s, "brand", "GAMMA"), undefined);
  assert.equal(page(s, "model", "GAMMA|G1"), undefined);
  assert.deepEqual(s?.pages.filter((p) => p.kind === "brand").map((p) => p.value), ["ALPHA", "BETA", "DELTA"]);
  // The minimum is config's: a brand of exactly the minimum has a page, one vehicle short has not.
  // Twelve months of 9 in five and 8 in seven make 101 less one: four 9s and eight 8s make 100, and one fewer in the latest month makes 99.
  const fewer = (extra: number) => (m: string) => (m > "2025-10" ? (m <= "2026-02" ? 9 : 8) - (m === LATEST ? extra : 0) : 8);
  const edge = site({ brands: { ALPHA: recent(100, 80), EDGE: fewer(0), SHORT: fewer(1) }, models: null });
  assert.equal(page(edge, "brand", "EDGE")?.figure, "100", "100 vehicles is at the minimum");
  assert.equal(page(edge, "brand", "SHORT"), undefined, "99 is not");
});

test("a brand's models table lists its models most registered first, adds up to the brand with the rest and the total, and each row is the model's own page figure", () => {
  const s = site();
  const brand = page(s, "brand", "ALPHA");
  const table = brand?.tables[0];
  assert.ok(table);
  assert.deepEqual(table.rows.map((r) => r.name), ["ALPHA A1", "ALPHA A2", "All ALPHA vehicles"]);
  assert.deepEqual(table.rows.map((r) => r.cells[0].text), ["840", "360", "1,200"]);
  assert.equal(840 + 360, 1200);
  for (const row of table.rows.filter((r) => r.href)) {
    const model = s?.pages.find((p) => p.href === row.href);
    assert.ok(model, `${row.name} links to a page that exists`);
    assert.equal(model.figure, row.cells[0].text, `${row.name}: the model's page says what its row on the brand's page does`);
  }
  // Models listed are limited by config; the rest of the brand is one line, and the lines add up to the brand's total.
  const few = answerSite(kit({ config: { ...kit().config, models_listed: 1 } }));
  const rows = page(few, "brand", "ALPHA")?.tables[0].rows ?? [];
  assert.deepEqual(rows.map((r) => r.cells[0].text), ["840", "360", "1,200"]);
  assert.equal(rows[1].name, "The remaining ALPHA models");
});

test("a model's page: its figure, its change, its place among models and among its brand's, and a link to its brand", () => {
  const p = page(site(), "model", "ALPHA|A1");
  assert.ok(p);
  assert.equal(p.figure, "840");
  assert.equal(p.sentences[0], "ALPHA A1 had 840 vehicles first registered in the 12 months to Oct 2026, up 40% on the 600 in the 12 months to Oct 2025.");
  assert.ok(p.sentences.includes("ALPHA A1 is number 1 among models by vehicles first registered in the 12 months to Oct 2026."));
  assert.ok(p.sentences.includes(`Among ALPHA models, ALPHA A1 is number 1, with ${pct(840 / 1200)} of the brand's vehicles first registered in the 12 months to Oct 2026.`));
  assert.deepEqual(p.brand, { name: "ALPHA", href: "/brand/alpha/", text: "All ALPHA models" });
  const second = page(site(), "model", "ALPHA|A2");
  assert.ok(second?.sentences.some((t) => t.startsWith("Among ALPHA models, ALPHA A2 is number 2")));
});

test("the month by month table is the latest twelve months, newest first, each with its change on the same month a year earlier", () => {
  const p = page(site(), "brand", "ALPHA");
  const table = p?.tables.at(-1);
  assert.equal(table?.heading, "Month by month");
  assert.equal(table?.rows.length, answerConfig.months_shown);
  assert.equal(table?.rows[0].name, "Oct 2026");
  assert.equal(table?.rows.at(-1)?.name, "Nov 2025");
  assert.deepEqual(table?.rows[0].cells.map((c) => c.text), ["100", "+25%"]);
  assert.equal(table?.rows.reduce((s, r) => s + Number(r.cells[0].text.replace(/,/g, "")), 0), 1200, "the months are the figure");
});

test("a hidden count is shown as hidden, never read as zero: a brand whose count is hidden in the window has no page, and no place is stated while any count is hidden", () => {
  const hidden = { ...brands, BETA: (m: string) => (m === "2026-03" ? null : 60) };
  const s = site({ brands: hidden, models: null });
  assert.equal(page(s, "brand", "BETA"), undefined, "its twelve-month figure cannot be stated");
  const alpha = page(s, "brand", "ALPHA");
  assert.ok(alpha);
  assert.ok(!alpha.sentences.some((t) => t.includes("is number")), "a hidden count might be larger, so no place");
  assert.ok(alpha.sentences[0].includes("1,200"));
  // The same for a hidden model: its row on its brand's page says hidden, and the rest of the brand is not worked out.
  const m = site({ models: { ...models, "ALPHA|A2": (month) => (month === "2026-05" ? null : 30) } });
  const rows = page(m, "brand", "ALPHA")?.tables[0].rows ?? [];
  assert.deepEqual(rows.map((r) => r.name), ["ALPHA A1", "ALPHA A2", "All ALPHA vehicles"]);
  assert.equal(rows[1].cells[0].hidden, true);
  assert.equal(rows[1].cells[0].text, "hidden");
  assert.equal(page(m, "model", "ALPHA|A2"), undefined, "no page rests on a hidden count");
  assert.doesNotMatch(JSON.stringify(m), /NaN|undefined/);
});

test("a change on a year ago is dropped where the earlier figure is under the floor, missing, or across a change in how the data is recorded (invariant 7); the figure stays", () => {
  const small = site({ config: { ...kit().config }, floors: { change: 5000, share: 200 } });
  assert.equal(page(small, "brand", "ALPHA")?.sentences[0], "ALPHA had 1,200 vehicles first registered in the 12 months to Oct 2026.");
  const recording: Event = { id: "e", date_start: "2026-02-01", date_end: null, mechanism: MEASUREMENT, scope: "everything", scope_values: [], title: "t", summary: "s", announced_date: null, source_url: "u" };
  const changed = site({ events: [recording] });
  assert.equal(page(changed, "brand", "ALPHA")?.sentences[0], "ALPHA had 1,200 vehicles first registered in the 12 months to Oct 2026.");
  assert.ok(page(changed, "brand", "ALPHA")?.tables.at(-1)?.rows.slice(0, 9).every((r) => r.cells[1].none), "a month whose year earlier is across the event has nothing to compare with");
  assert.ok(page(changed, "brand", "ALPHA")?.tables.at(-1)?.rows.slice(9).every((r) => !r.cells[1].none), "the months before it, with the event in neither period, are compared");
  // Events not loaded, and a dataset that cannot be set beside a year ago: nothing is compared.
  assert.doesNotMatch(page(site({ events: null }), "brand", "ALPHA")?.sentences.join(" ") ?? "", /up |down /);
  assert.doesNotMatch(page(answerSite(kit({ dataset: { counted: (n, p) => `${count(n)} ${p}`, showsYear: false } })), "brand", "ALPHA")?.sentences.join(" ") ?? "", /up |down /);
  // No year earlier at all (a dataset that starts later): the figure for the window stays, with nothing to compare.
  const young = kit();
  young.slices = { brand: slice(brands).filter((r) => r.month > "2025-10"), model: undefined };
  assert.equal(page(answerSite(young), "brand", "ALPHA")?.sentences[0], "ALPHA had 1,200 vehicles first registered in the 12 months to Oct 2026.");
});

test("an event that touches only other values does not stop a comparison for this one", () => {
  const other: Event = { id: "e", date_start: "2026-02-01", date_end: null, mechanism: MEASUREMENT, scope: "field_brand", scope_values: ["BETA"], title: "t", summary: "s", announced_date: null, source_url: "u" };
  assert.ok(page(site({ events: [other] }), "brand", "ALPHA")?.sentences[0].includes("up 25%"));
});

test("a model slice that gives another total for a month is not read: no model pages and no models table", () => {
  const off = kit();
  off.slices = { brand: slice(brands), model: slice(models, 1) };
  const s = answerSite(off);
  assert.equal(s?.pages.some((p) => p.kind === "model"), false);
  assert.equal(page(s, "brand", "ALPHA")?.tables.length, 1, "only the months");
  // No model slice at all is the same.
  assert.equal(site({ models: null })?.pages.some((p) => p.kind === "model"), false);
});

test("a build without the dataset, or whose brand slice cannot be read, has no pages and no index", () => {
  assert.equal(site({ manifest: { latest_snapshot: "2026-10-31", datasets: { other: {} } } as never }), undefined);
  assert.equal(site({ manifest: { latest_snapshot: "2026-10-31", datasets: { set_one: { not_built: "no store" } } } as never }), undefined);
  const none = kit();
  none.slices = { brand: undefined, model: undefined };
  const s = answerSite(none);
  assert.deepEqual(s?.pages, []);
  assert.equal(s?.index, undefined);
});

test("a page whose canvas link cannot be made is not built, and nothing links to it", () => {
  const s = site({ link: (kind, value) => (value === "ALPHA|A2" ? undefined : `/canvas/?${kind}=${value}`) });
  assert.equal(page(s, "model", "ALPHA|A2"), undefined);
  const row = page(s, "brand", "ALPHA")?.tables[0].rows.find((r) => r.name === "ALPHA A2");
  assert.ok(row, "the model is still in the brand's table");
  assert.equal(row.href, undefined, "but no link to a page that is not there");
  assert.ok(!s?.index?.entries.some((e) => e.models.some((m) => m.name === "ALPHA A2")));
});

test("the index lists each brand with a page and, under it, each of its models that has one; a name two pages share has no link from the front page", () => {
  const s = site();
  assert.deepEqual(s?.index?.entries.map((e) => [e.name, e.href, e.models.map((m) => m.name)]), [
    ["ALPHA", "/brand/alpha/", ["ALPHA A1", "ALPHA A2"]],
    ["BETA", "/brand/beta/", ["BETA B1"]],
    ["DELTA", "/brand/delta/", ["DELTA D1"]],
  ]);
  assert.equal(s?.index?.href, "/brands/");
  const clash = answerSite(kit({ label: (_d, v) => (v === "BETA" || v === "DELTA" ? "SAME" : v) }));
  assert.equal(clash?.byLabel.brand.get("SAME"), null, "a label two pages share opens neither");
  assert.equal(clash?.byLabel.brand.get("ALPHA"), "/brand/alpha/");
});

test("every address is unique across the pages, and the title and description of every page are its own and fit a search result", () => {
  const s = site();
  const hrefs = s?.pages.map((p) => p.href) ?? [];
  assert.equal(new Set(hrefs).size, hrefs.length);
  const [least, most] = answerConfig.description_length;
  for (const p of s?.pages ?? []) {
    assert.ok(p.description.length >= least && p.description.length <= most, p.description);
    assert.ok(p.title.includes(p.name));
  }
  assert.equal(new Set(s?.pages.map((p) => p.title)).size, s?.pages.length);
  // A description too long for a search result is replaced by the shorter one; where neither fits, the page is not built.
  const long = answerSite(kit({ label: (_d, v) => `${v} ${"X".repeat(150)}` }));
  assert.deepEqual(long?.pages, []);
  const mid = answerSite(kit({ label: (_d, v) => `${v} ${"X".repeat(95)}` }));
  assert.ok(mid && mid.pages.length > 0);
  for (const p of mid.pages) assert.ok(p.description.length <= most && !p.description.includes("Its most registered models"), "the shorter description");
});

test("true registrations and survivors are never in one table: the pages read one dataset, config's, and it is a flow", () => {
  assert.equal(config.findDataset(answerConfig.dataset)?.grain, "flow");
  assert.ok(config.builderSpec.datasets.includes(answerConfig.dataset));
  assert.equal(new Set(["brand", "model"].map((k) => answerConfig.dataset)).size, 1);
});

test("the words of the pages are filled with nothing left over, for made-up facts", () => {
  const facts = { name: "n", brand: "b", span: 12, counted: "c", change: 0.1, prior_count: "1", prior: "p", window: "w", rank: 1, of: 2, share: "s", heading: "h", minimum: "1", view: "v", parts: "p", count: "1", field: "f" };
  for (const [key, text] of Object.entries(answerConfig.words)) {
    const { unresolved } = fillTemplate(text, facts);
    assert.deepEqual(unresolved, [], key);
  }
});

test("no page or template names a value: the config's words carry no figure and the module no field", () => {
  for (const [key, text] of Object.entries(answerConfig.words)) assert.doesNotMatch(text.replace(/\{[^}]*\}/g, ""), /\d/, `${key}: a template holds no digit`);
  const source = readFileSync(new URL("../../src/lib/answerPages.ts", import.meta.url), "utf8");
  for (const word of ["registrations_flow", "registrations_surviving", '"make"', "powertrain", "TOYOTA"]) assert.ok(!source.includes(word), word);
});

// ---- The links each page opens in the canvas, read back by the canvas's own reader ----

const built = realisticBuilt();
const all = canvas.canvasVocabulary(builder.builderVocabulary(built));
const dataset = answerConfig.dataset;

for (const [kind, value] of [["brand", "ALPHA"], ["model", "ALPHA|A1"]] as const) {
  test(`a ${kind} page's link opens the canvas on the dataset, measure and value the page shows, and writes back unchanged`, () => {
    const field = answerConfig[kind].dimension;
    const link = answerPageLink(all, built, { dataset, measure: answerConfig.measure, field, value });
    assert.ok(link, "the canvas can draw this question");
    const url = new URL(link, "https://site.example");
    assert.equal(url.pathname, "/canvas/");
    const asked = canvas.readCanvas(url.search);
    assert.equal(asked.length, 1);
    const opened = canvas.withFittingTypes(canvas.settleCanvas(all, asked), built);
    const q = opened.charts[0].question;
    assert.equal(q.dataset, dataset);
    assert.equal(q.measure, answerConfig.measure);
    assert.equal(q.by, null, "one line: the value's own count over time");
    assert.deepEqual(q.where, { [field]: [value] }, "kept to the value the page is about, and to no other");
    assert.deepEqual(builder.linkNotices(all, asked[0].asked, q), [], "the link asks for nothing the page does not give");
    assert.ok(canvas.draws(q, opened.charts[0].type ?? canvas.bestType(q), built));
    assert.deepEqual([...canvas.canvasAddress(url.search, opened)].sort(), [...url.searchParams].sort());
  });
}

test("a link to a question the canvas answers with another is not made", () => {
  const ask = { dataset, measure: answerConfig.measure, field: answerConfig.brand.dimension, value: "ALPHA" };
  assert.ok(answerPageLink(all, built, ask));
  assert.equal(answerPageLink(all, built, { ...ask, dataset: "no_such_dataset" }), undefined);
  assert.equal(answerPageLink(all, built, { ...ask, measure: "no_such_measure" }), undefined);
  assert.equal(answerPageLink(all, built, { ...ask, field: "no_such_field" }), undefined);
});

test("a question about one value, split by another field, opens the canvas on that and writes back unchanged", () => {
  const field = answerConfig.model.dimension;
  const link = answerPageLink(all, built, { dataset, measure: answerConfig.measure, field, value: "ALPHA|A1", by: "import_status" });
  assert.ok(link, "the canvas can draw this question");
  const url = new URL(link, "https://site.example");
  const asked = canvas.readCanvas(url.search);
  const opened = canvas.withFittingTypes(canvas.settleCanvas(all, asked), built);
  const q = opened.charts[0].question;
  assert.equal(q.by, "import_status");
  assert.deepEqual(q.where, { [field]: ["ALPHA|A1"] });
  assert.deepEqual([...canvas.canvasAddress(url.search, opened)].sort(), [...url.searchParams].sort());
  assert.equal(answerPageLink(all, built, { dataset, measure: answerConfig.measure, field, value: "ALPHA|A1", by: "no_such_field" }), undefined);
});

// ---- The anchors the pages point at ----

test("the definition and the caveats the pages link to are a page and an anchor that exist", () => {
  const method = readFileSync(new URL("../../src/pages/method.astro", import.meta.url), "utf8");
  const anchors = new Set([...method.matchAll(/\bid="([a-z0-9-]+)"/g)].map((m) => m[1]));
  for (const d of config.dimensions) if (fullNote(d as never)) anchors.add(fieldNoteAnchor(d.id));
  for (const href of [answerConfig.definition, answerConfig.caveat.href]) {
    const [path, anchor] = href.split("#");
    assert.ok(existsSync(new URL(`../../src/pages${path}.astro`, import.meta.url)), `${href}: a page that exists`);
    if (anchor) assert.ok(path === "/method" && anchors.has(anchor), `${href}: no heading has that anchor`);
  }
});

// ---- On the build in front of it, where there is one ----

const here = new URL("../../public/data/", import.meta.url);
const haveData = existsSync(new URL("manifest.json", here)) && existsSync(new URL(`cube/${answerConfig.dataset}/${answerConfig.model.dimension}.parquet`, here));
const reader = (relative: string) => {
  try {
    const bytes = readFileSync(new URL(relative, here));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  } catch {
    return undefined;
  }
};

// ---- Each page by new and used (made-up conditions x, "newish things", and y, "oldish things") ----

const { Cut } = await import("../../src/lib/conditionViews.ts");

// How many of each model's vehicles in a month are x: the rest are y. ALPHA|A1 mixes both, ALPHA|A2 has only y, BETA|B1 only x, DELTA|D1 half and half.
const xOf: Record<string, (month: string) => number> = {
  "ALPHA|A1": (m) => (m > "2025-10" ? 60 : 40),
  "ALPHA|A2": () => 0,
  "BETA|B1": (m) => models["BETA|B1"](m) ?? 0,
  "GAMMA|G1": (m) => models["GAMMA|G1"](m) ?? 0,
  "DELTA|D1": (m) => (models["DELTA|D1"](m) ?? 0) / 2,
};
const brandOf = (model: string) => model.split("|")[0];
// The fact table's rows for the models and for the brands: month, value, condition, count, left out where zero.
const factRows = (by: (model: string) => string): [string, string, string, number][] =>
  MONTHS.flatMap((month) =>
    Object.keys(xOf).flatMap((model) => {
      const n = models[model](month) ?? 0;
      const x = xOf[model](month);
      return [[month, by(model), "x", x] as [string, string, string, number], [month, by(model), "y", n - x] as [string, string, string, number]].filter((r) => r[3] > 0);
    }),
  );
const cutFrom = (rows: [string, string, string, number][]) => Cut.from({ month: rows.map((r) => r[0]), n: rows.map((r) => r[3]), values: { thing: rows.map((r) => r[1]), cond: rows.map((r) => r[2]) } }, "thing", "cond", ["x", "y"])!;
const conditions = [{ value: "x", label: "Newish", phrase: "newish things" }, { value: "y", label: "Oldish", phrase: "oldish things" }];

function viewKit(over: Parameters<typeof kit>[0] & { floor?: number; noModelCut?: boolean } = {}): Kit {
  const { floor, noModelCut, ...rest } = over;
  return kit({
    tail: (_d, v) => v.split("|")[1] ?? v,
    link: (kind, value, by) => `/canvas/?${kind}=${encodeURIComponent(value)}${by ? `&by=${by}` : ""}`,
    views: { field: "cond", fieldLabel: "New or old", conditions, cuts: { brand: cutFrom(factRows(brandOf)), ...(noModelCut ? {} : { model: cutFrom(factRows((m) => m)) }) }, floor },
    ...rest,
  });
}
const viewSite = (over: Parameters<typeof viewKit>[0] = {}) => answerSite(viewKit(over));
const sumOfCells = (rows: { cells: { text: string }[] }[], column: number) => rows.reduce((n, r) => n + Number(r.cells[column].text.replace(/,/g, "")), 0);

test("a brand's page says its figure by new and used beside the big figure and in a sentence, which add up to the figure", () => {
  const p = page(viewSite(), "brand", "ALPHA");
  assert.deepEqual(p?.parts, [{ label: "Newish", value: "720" }, { label: "Oldish", value: "480" }, { label: "All", value: "1,200" }]);
  assert.equal(p?.figure, "1,200");
  assert.equal(p?.sentences[0], "ALPHA had 1,200 vehicles first registered in the 12 months to Oct 2026, up 25% on the 960 in the 12 months to Oct 2025.");
  assert.equal(p?.sentences[1], "Of these, 720 newish things and 480 oldish things.");
  assert.equal(p?.sentences[2], "ALPHA had 100 vehicles first registered in Oct 2026, up 25% on the 80 in Oct 2025.");
  assert.equal(p?.sentences[3], "Of these, 60 newish things and 40 oldish things.");
  // A brand with vehicles of one condition only says that.
  assert.equal(page(viewSite(), "brand", "BETA")?.sentences[1], "All of these were newish things.");
});

test("a place by one condition is among the brands that have vehicles of it, and is left out where level, where the count is none, or the place by all is", () => {
  const s = viewSite();
  const alpha = page(s, "brand", "ALPHA")?.sentences ?? [];
  // 4 brands have newish things (ALPHA and BETA 720, DELTA 360, GAMMA 84): ALPHA is level with BETA. Oldish things: ALPHA 480, DELTA 360: two brands.
  assert.ok(alpha.includes("ALPHA is number 1 of 4 brands by vehicles first registered in the 12 months to Oct 2026."));
  assert.ok(!alpha.some((t) => t.includes("by newish things")), "level with BETA by newish things");
  assert.ok(alpha.includes("ALPHA is number 1 of 2 brands by oldish things first registered in the 12 months to Oct 2026."));
  const beta = page(s, "brand", "BETA")?.sentences ?? [];
  assert.ok(!beta.some((t) => t.includes("by oldish things")), "BETA has none");
  assert.ok(page(s, "brand", "DELTA")?.sentences.includes("DELTA is number 3 of 4 brands by newish things first registered in the 12 months to Oct 2026."));
});

test("a model's place by one condition is stated only above the cap floor, and its page says its owner's case: the month in parts", () => {
  const above = page(viewSite({ floor: 100 }), "model", "ALPHA|A1");
  // Models with oldish things: A2 and D1 (360 each) and A1 (120).
  assert.ok(above?.sentences.includes("ALPHA A1 is number 3 among models by oldish things first registered in the 12 months to Oct 2026."));
  const below = page(viewSite({ floor: 130 }), "model", "ALPHA|A1");
  assert.ok(!below?.sentences.some((t) => t.includes("oldish things first registered")), "120 is at or below the floor: a model the cap hid may have more");
  assert.ok(below?.sentences.some((t) => t.includes("ALPHA A1 is number")), "the place by all is as it was");
  const p = page(viewSite(), "model", "ALPHA|A1");
  assert.deepEqual(p?.parts?.map((x) => x.value), ["720", "120", "840"]);
  const months = p?.tables.at(-1);
  assert.deepEqual(months?.columns, ["Month", "Newish", "Oldish", "All", "Change on the same month a year earlier"]);
  assert.deepEqual(months?.rows[0].cells.slice(0, 3).map((c) => c.text), ["60", "10", "70"], "the latest month: the parts add up to the figure the page showed");
});

test("a brand's models are listed once for each condition and once for all, and in every one the rows and the rest add up to the total", () => {
  const table = page(viewSite(), "brand", "ALPHA")?.tables[0];
  assert.deepEqual(table?.switch?.labels, ["Newish", "Oldish", "All"]);
  assert.deepEqual(table?.views?.map((v) => v.label), ["Newish", "Oldish", "All"]);
  const [newish, oldish, all] = table?.views ?? [];
  // The row is the model's own name, without its brand's.
  assert.deepEqual(newish.rows.map((r) => r.name), ["A1", "All ALPHA newish things"]);
  assert.deepEqual(newish.rows.map((r) => r.cells[0].text), ["720", "720"]);
  assert.deepEqual(oldish.rows.map((r) => r.name), ["A2", "A1", "All ALPHA oldish things"]);
  assert.deepEqual(oldish.rows.map((r) => r.cells[0].text), ["360", "120", "480"]);
  assert.deepEqual(oldish.rows.map((r) => r.cells[1].text), ["75.0%", "25.0%", "100.0%"]);
  assert.deepEqual(oldish.columns, ["Model", "Oldish", "Share of ALPHA oldish things", "Change on the same 12 months a year earlier"]);
  assert.deepEqual(all.columns.slice(0, 4), ["Model", "Newish", "Oldish", "All"]);
  assert.deepEqual(all.rows.map((r) => r.cells.slice(0, 3).map((c) => c.text)), [["720", "120", "840"], ["0", "360", "360"], ["720", "480", "1,200"]]);
  // With one model listed the rest takes the others, and every column still adds up to the total's.
  const few = page(viewSite({ config: { ...kit().config, models_listed: 1 } }), "brand", "ALPHA")?.tables[0];
  for (const v of few?.views ?? []) {
    const body = v.rows.filter((r) => !r.total);
    const total = v.rows.find((r) => r.total);
    const columns = v.label === "All" ? [0, 1, 2] : [0];
    for (const c of columns) assert.equal(sumOfCells(body, c), Number((total?.cells[c].text ?? "").replace(/,/g, "")), `${v.label} column ${c}`);
  }
  assert.equal(few?.views?.[2].rows.find((r) => r.name === "The remaining ALPHA models")?.cells.slice(0, 3).map((c) => c.text).join(","), "0,360,360");
});

test("a model at or below the cap floor goes to the rest in a condition's list, and a brand with none of a condition says so", () => {
  const table = page(viewSite({ floor: 130 }), "brand", "ALPHA")?.tables[0];
  const oldish = table?.views?.[1];
  assert.deepEqual(oldish?.rows.map((r) => r.name), ["A2", "The remaining ALPHA models", "All ALPHA oldish things"], "A1 has 120: at or below the floor");
  assert.deepEqual(oldish?.rows.map((r) => r.cells[0].text), ["360", "120", "480"]);
  const none = page(viewSite(), "brand", "BETA")?.tables[0];
  assert.equal(none?.views?.[1].empty, "BETA had no oldish things in the 12 months to Oct 2026.");
});

test("the question is linked twice: as it was, and split by the condition", () => {
  const p = page(viewSite(), "model", "ALPHA|A1");
  assert.equal(p?.canvas.href, page(site(), "model", "ALPHA|A1")?.canvas.href, "the first link is unchanged");
  assert.equal(p?.canvasSplit?.href, "/canvas/?model=ALPHA%7CA1&by=cond");
  assert.equal(p?.canvasSplit?.text, "New or old, month by month: open in the canvas");
  assert.match(p?.canvasSplit?.named ?? "", /^How many ALPHA A1 vehicles .* New or old, month by month: open in the canvas$/);
  // Where that link cannot be made it is left out and the page stands.
  const without = page(viewSite({ link: (kind, value, by) => (by ? undefined : `/canvas/?${kind}=${value}`) }), "model", "ALPHA|A1");
  assert.equal(without?.canvasSplit, undefined);
  assert.ok(without?.canvas.href);
});

test("without the split, or where a cut is missing, a page is as it was: no strip, parts, switch or extra column", () => {
  const base = site();
  const without = viewSite({ views: undefined, tail: undefined });
  assert.deepEqual(without?.pages.map((p) => [p.href, p.sentences, p.tables, p.parts, p.canvasSplit]), base?.pages.map((p) => [p.href, p.sentences, p.tables, p.parts, p.canvasSplit]));
  // The brand's models need both fields' cuts: with no model cut the brand's own figures are by parts but its models table is as it was.
  const part = page(viewSite({ noModelCut: true }), "brand", "ALPHA");
  assert.ok(part?.parts);
  assert.equal(part?.tables[0].views, undefined);
  assert.equal(page(viewSite({ noModelCut: true }), "model", "ALPHA|A1")?.parts, undefined);
  // With one condition, or too many for the switch, there are none.
  const k = viewKit();
  assert.equal(page(answerSite({ ...k, views: { ...k.views!, conditions: [conditions[0]] } }), "brand", "ALPHA")?.parts, undefined);
});

test("the index names brands as written but keeps their order", () => {
  const s = viewSite({ label: (_d, v) => (v === "ALPHA" ? "Zeta-ish" : v.replace("|", " ")) });
  const order = s?.index?.entries.map((e) => e.name);
  assert.deepEqual(order, ["Zeta-ish", "BETA", "DELTA"], "in the order of the values (ALPHA, BETA, DELTA), not of the names");
});

// The pages worked out from the real build.
test("on the built data: a page's figure by new and used adds up to its figure, and the Ranger's October is 805 new and 15 used imports, 820 in all", { skip: !haveData && "no built data in public/data" }, async () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", here), "utf8"));
  const s = await answerPagesSite(manifest, reader);
  assert.ok(s);
  const ranger = s.pages.find((p) => p.href === "/model/ford-ranger/");
  assert.equal(ranger?.name, "Ford RANGER");
  assert.deepEqual(ranger?.tables.at(-1)?.columns, ["Month", "New", "Used imports", "All", "Change on the same month a year earlier"]);
  assert.deepEqual(ranger?.tables.at(-1)?.rows[0].cells.slice(0, 3).map((c) => c.text), ["805", "15", "820"]);
  assert.ok(ranger?.sentences.includes("Of these, 805 new vehicles and 15 used imports."));
  assert.equal(ranger?.canvasSplit && new URL(ranger.canvasSplit.href, "https://site.example").searchParams.get("c1.by"), "import_status");
  let withParts = 0;
  for (const p of s.pages) {
    if (!p.parts) continue;
    withParts += 1;
    const [a, b, all] = p.parts.map((x) => Number(x.value.replace(/,/g, "")));
    assert.equal(a + b, all, `${p.href}: new and used imports are the figure`);
    assert.equal(p.parts[2].value, p.figure, p.href);
    for (const row of p.tables.at(-1)?.rows ?? []) {
      const [x, y, z] = row.cells.slice(0, 3).map((c) => Number(c.text.replace(/,/g, "")));
      assert.equal(x + y, z, `${p.href} ${row.name}: each month's parts are its figure`);
    }
    for (const v of p.tables[0]?.views ?? []) {
      const body = v.rows.filter((r) => !r.total);
      const total = v.rows.find((r) => r.total);
      if (!total) continue;
      const columns = v.label === "All" ? [0, 1, 2] : [0];
      for (const c of columns) assert.equal(sumOfCells(body, c), Number(total.cells[c].text.replace(/,/g, "")), `${p.href} ${v.label} column ${c}: the rows and the rest add up to the total`);
    }
  }
  assert.ok(withParts > 300, "every page has its parts");
  // Names are as a person writes them, the order is of the register's values.
  assert.ok(s.index?.entries.some((e) => e.name === "Toyota"));
  const raw = new Map(s.pages.filter((p) => p.kind === "brand").map((p) => [p.name, p.value]));
  const values = (s.index?.entries ?? []).flatMap((e) => (raw.has(e.name) ? [raw.get(e.name) as string] : []));
  assert.deepEqual(values, [...values].sort(), "the index is in the order of the register's values");
});

test("on the built data: a brand's twelve-month figure is the sum of its months, and a model's page says what its row on its brand's page does", { skip: !haveData && "no built data in public/data" }, async () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", here), "utf8"));
  const s = await answerPagesSite(manifest, reader);
  assert.ok(s && s.pages.length > 100, "pages made from the build");
  const latest = manifest.datasets[answerConfig.dataset].latest_month;
  const window = monthRange(addMonths(latest, -(answerConfig.window - 1)), latest);
  const rows = (await readSlice(reader, manifest, answerConfig.dataset, answerConfig.brand.dimension)) ?? [];
  const sumOf = (value: string, months: string[]) => rows.filter((r) => r.value === value && months.includes(r.month)).reduce((n, r) => n + r.n, 0);
  const brands = s.pages.filter((p) => p.kind === "brand");
  for (const p of brands) {
    assert.equal(p.figure, count(sumOf(p.value, window)), `${p.value}: the figure is the sum of its twelve months`);
    assert.ok(sumOf(p.value, window) >= answerConfig.brand.minimum, `${p.value}: at or above the minimum`);
    const months = p.tables.at(-1);
    assert.equal(months?.rows.reduce((n, r) => n + Number(r.cells[r.cells.length - 2].text.replace(/,/g, "")), 0), sumOf(p.value, window), `${p.value}: its monthly table adds up to its figure`);
    const total = p.tables[0]?.rows.find((r) => r.total);
    if (total) assert.equal(total.cells[0].text, p.figure, `${p.value}: the models table ends at the brand's figure`);
    const listed = p.tables[0]?.rows.filter((r) => !r.total && !r.cells[0].hidden).reduce((n, r) => n + Number(r.cells[0].text.replace(/,/g, "")), 0);
    if (total) assert.equal(listed, sumOf(p.value, window), `${p.value}: the rows add up to the total`);
  }
  let linked = 0;
  for (const b of brands) {
    for (const row of b.tables[0]?.rows.filter((r) => r.href) ?? []) {
      const model = s.pages.find((p) => p.href === row.href);
      assert.ok(model, `${row.name}: its page exists`);
      assert.equal(model.figure, row.cells[0].text, `${row.name}: same figure on the model's page and on the brand's`);
      assert.equal(model.brand?.href, b.href, `${row.name}: a model page links back to the brand it is listed under`);
      linked += 1;
    }
  }
  assert.ok(linked > 50);
  // Every model page links to its brand's page where the brand has one, and every page is in the index.
  const indexed = new Set(s.index?.entries.flatMap((e) => [e.href, ...e.models.map((m) => m.href)]));
  for (const p of s.pages) assert.ok(indexed.has(p.href), `${p.href} is in the index`);
  assert.equal(new Set(s.pages.map((p) => p.href)).size, s.pages.length);
  assert.doesNotMatch(JSON.stringify(s.pages), /NaN|undefined|\{[a-z_]+\}/);
});

test("on the built data: each page's canvas link, read back, asks for the value the page is about", { skip: !haveData && "no built data in public/data" }, async () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", here), "utf8"));
  const s = await answerPagesSite(manifest, reader);
  assert.ok(s);
  const real = canvas.canvasVocabulary(builder.builderVocabulary(manifest));
  for (const p of s.pages) {
    const url = new URL(p.canvas.href, "https://site.example");
    const [chart] = canvas.withFittingTypes(canvas.settleCanvas(real, canvas.readCanvas(url.search)), manifest).charts;
    assert.equal(chart.question.dataset, answerConfig.dataset, p.href);
    assert.equal(chart.question.measure, answerConfig.measure, p.href);
    assert.deepEqual(chart.question.where, { [answerConfig[p.kind].dimension]: [p.value] }, `${p.href}: the link keeps to the value on the page`);
  }
});
