// This site's figures set beside the figures other organisations publish (src/lib/comparison.ts, config/comparison.json): which figures the public page
// shows, how they are grouped, how a gap is written, what is said of a figure that is not compared, and the file being absent. The fixtures are made up:
// the module names no organisation, so nothing here does either. Run with Node's own test runner:
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const comparison = await import("../../src/lib/comparison.ts");
const { PLACEHOLDER, monthLabel } = await import("../../src/lib/sentences.ts");
type Row = import("../../src/lib/data.ts").ReconciliationRow;
type Reconciliation = import("../../src/lib/data.ts").Reconciliation;

const row = (over: Partial<Row>): Row => ({
  source: "alpha",
  month: "2026-09",
  measure_as_published: "Measure A",
  dataset: "set_one",
  filters: { field_x: ["Value P"] },
  ours: 1040,
  theirs: 1020,
  gap: 20,
  gap_pct: 1.9608,
  tolerance_pct: 2,
  hard_bound_pct: 4,
  known_difference: null,
  status: "pass",
  reason_kind: null,
  reason: null,
  source_url: "https://alpha.example/page",
  date_read: "2026-11-20",
  figure_kind: "passenger",
  added_up_from: null,
  stops_alone_pct: null,
  ...over,
});

const notCompared = (over: Partial<Row>): Row => row({ ours: null, gap: null, gap_pct: null, status: "not_compared", reason_kind: "month_not_held", reason: "internal text", ...over });

const file = (rows: Row[], over: Partial<Reconciliation> = {}): Reconciliation => ({
  latest_snapshot: "2026-10-31",
  sources: {
    alpha: { name: "Alpha Association", home_url: "https://alpha.example/", independent: true, definition: "What alpha says it counts", definition_date_read: "2026-11-20", data_basis: null },
    beta: { name: "Beta Board", home_url: "https://beta.example/", independent: true, definition: "What beta says it counts", definition_date_read: "2026-11-21", data_basis: "a short basis label" },
  },
  summary: { rows: rows.length, by_status: { pass: 0, warn: 0, fail: 0, not_compared: 0 }, by_source: {}, months: { first: "2026-08", last: "2026-10" }, thresholds: {} },
  rows,
  ...over,
});

const labels = {
  dataset: (id: string) => ({ set_one: "Dataset One", set_two: "Dataset Two" })[id],
  dimension: (id: string) => ({ field_x: "Field X", field_y: "Field Y" })[id],
  value: (_dimension: string, value: string) => value.replace("|", " "),
};

const figures = (view: ReturnType<typeof comparison.comparisonView>) => {
  assert.equal(view.kind, "figures");
  return view as Extract<typeof view, { kind: "figures" }>;
};

test("a gap is written with its sign, a true minus, thousands separated, and no sign for none", () => {
  assert.equal(comparison.signedCount(257), "+257");
  assert.equal(comparison.signedCount(-1234), "−1,234");
  assert.equal(comparison.signedCount(0), "0");
  assert.equal(comparison.signedPercent(11.068), "+11.07%");
  assert.equal(comparison.signedPercent(-6.2914), "−6.29%");
  assert.equal(comparison.signedPercent(0), "0.00%");
  assert.equal(comparison.signedPercent(-0.004), "0.00%", "a gap that rounds to nothing carries no sign");
  assert.equal(comparison.signedPercent(0.005), "+0.01%");
  assert.equal(comparison.figure(11824), "11,824");
});

test("no file says so in one sentence, with no table and no error", () => {
  for (const missing of [undefined, null, {} as unknown as Reconciliation]) {
    const view = comparison.comparisonView(missing, labels);
    assert.equal(view.kind, "absent");
    assert.equal((view as { text: string }).text, comparison.absentSentence());
  }
  assert.match(comparison.absentSentence(), /not in this build of the site yet/);
  assert.match(comparison.absentSentence(), /next monthly refresh/);
});

test("a file with no figure of a public kind says so, and does not open a section of empty tables", () => {
  assert.equal(comparison.comparisonView(file([]), labels).kind, "empty");
  assert.equal(comparison.comparisonView(file([row({ figure_kind: "model" })]), labels).kind, "empty");
});

test("only the kinds config lists are shown, and the closing sentence counts the others", () => {
  const view = figures(
    comparison.comparisonView(
      file([row({}), row({ figure_kind: "model", measure_as_published: "Hidden one" }), row({ figure_kind: "model", measure_as_published: "Hidden two", source: "beta" })]),
      labels,
    ),
  );
  const measures = view.sources.flatMap((s) => s.series.map((x) => x.measure));
  assert.deepEqual(measures, ["Measure A"]);
  assert.equal(view.closing, "2 further figures are checked the same way in every build. They are not shown here.");
  const one = figures(comparison.comparisonView(file([row({}), row({ figure_kind: "model" })]), labels));
  assert.match(one.closing ?? "", /^One further figure/);
  assert.equal(figures(comparison.comparisonView(file([row({})]), labels)).closing, null, "no closing sentence where there is nothing further");
  assert.ok(comparison.isPublicKind("passenger") && comparison.isPublicKind("commercial") && comparison.isPublicKind("total"));
  assert.ok(!comparison.isPublicKind("model"));
});

test("the opening sentence names how many organisations, the span of months shown and the snapshot", () => {
  const view = figures(comparison.comparisonView(file([row({ month: "2026-08" }), row({ month: "2026-10", source: "beta" }), row({ month: "2025-01", figure_kind: "model" })]), labels));
  assert.equal(
    view.opening,
    `2 organisations publish figures that this site's can be set beside. The figures below are for ${monthLabel("2026-08")} to ${monthLabel("2026-10")}. This site's figures are as at the snapshot of 31 October 2026.`,
  );
  const alone = figures(comparison.comparisonView(file([row({})], { sources: { alpha: file([]).sources.alpha } }), labels));
  assert.match(alone.opening ?? "", new RegExp(`^One organisation publishes .* are for ${monthLabel("2026-09")}\\. `), "one organisation, one month");
});

test("each source in the file's order, with its link, its basis and its definition and the day it was read", () => {
  const view = figures(comparison.comparisonView(file([row({ source: "beta", measure_as_published: "B1" }), row({})]), labels));
  assert.deepEqual(
    view.sources.map((s) => [s.id, s.name, s.homeUrl, s.basis]),
    [
      ["alpha", "Alpha Association", "https://alpha.example/", null],
      ["beta", "Beta Board", "https://beta.example/", "a short basis label"],
    ],
  );
  assert.equal(view.sources[0].says, "What it says it counts");
  assert.equal(view.sources[0].definition, "“What alpha says it counts” Read on 20 November 2026.");
  assert.equal(view.sources[1].definition, "“What beta says it counts” Read on 21 November 2026.");
});

test("figures are grouped by what was measured, kinds in config's order, and the newest compared month is the one shown", () => {
  const rows = [
    row({ month: "2026-08", ours: 900, theirs: 1000, gap: -100, gap_pct: -10 }),
    row({ month: "2026-10", ours: 1100, theirs: 1000, gap: 100, gap_pct: 10 }),
    row({ month: "2026-09" }),
    row({ measure_as_published: "Measure B", figure_kind: "total", month: "2026-10", filters: {} }),
    row({ measure_as_published: "Measure C", figure_kind: "commercial", month: "2026-10", filters: { field_y: ["Value Q"] } }),
  ];
  const view = figures(comparison.comparisonView(file(rows), labels));
  const series = view.sources[0].series;
  assert.deepEqual(series.map((s) => s.measure), ["Measure A", "Measure C", "Measure B"], "passenger, commercial, then total");
  const a = series[0];
  assert.deepEqual(a.latest.map((r) => r.month), ["2026-10"]);
  assert.deepEqual(a.all.map((r) => r.month), ["2026-10", "2026-09", "2026-08"], "every month, newest first");
  assert.equal(a.latest[0].theirs, "1,000");
  assert.equal(a.latest[0].ours, "1,100");
  assert.equal(a.latest[0].gap, "+100");
  assert.equal(a.latest[0].gapPct, "+10.00%");
  assert.equal(a.all[2].gap, "−100");
  assert.equal(a.all[2].gapPct, "−10.00%");
  assert.equal(a.every, `Every month, ${monthLabel("2026-08")} to ${monthLabel("2026-10")}`);
  assert.equal(series[1].every, null, "a figure for one month needs no list of months");
  assert.equal(a.latest[0].monthLabel, monthLabel("2026-10"));
  assert.equal(a.latest[0].readUrl, "https://alpha.example/page");
  assert.equal(a.latest[0].readLabel, "alpha.example, read 20 November 2026");
});

test("the same measure asked of two datasets, or with two conditions, is two groups", () => {
  const view = figures(comparison.comparisonView(file([row({}), row({ dataset: "set_two" }), row({ filters: { field_y: ["Value Q"] } })]), labels));
  assert.equal(view.sources[0].series.length, 3);
});

test("rows are grouped by what this site's figure is, not by the organisation's wording of it", () => {
  const view = figures(
    comparison.comparisonView(
      file([
        row({ month: "2026-08", measure_as_published: "Measure A (two figures, added here)" }),
        row({ month: "2026-09", measure_as_published: "Measure A (two figures of the table, added here)" }),
        row({ month: "2026-10", measure_as_published: "Measure A (two figures of the table, added here)" }),
        row({ month: "2026-07", measure_as_published: "Measure A (two figures of the table, added here), given in a later release" }),
      ]),
      labels,
    ),
  );
  const series = view.sources[0].series;
  assert.equal(series.length, 1, "one table for one question");
  assert.equal(series[0].measure, "Measure A (two figures of the table, added here)", "the heading is the wording most rows share");
  assert.deepEqual(series[0].all.map((r) => r.month), ["2026-10", "2026-09", "2026-08", "2026-07"]);
  assert.deepEqual(series[0].all.map((r) => r.notes), [[], [], ["As the source words it: Measure A (two figures, added here)"], ["As the source words it: Measure A (two figures of the table, added here), given in a later release"]], "a row worded otherwise says so itself");
  assert.equal(series[0].captionLatest, "Alpha Association: Measure A (two figures of the table, added here), newest month compared");
  // The tie goes to the wording the newest row has.
  const tied = figures(comparison.comparisonView(file([row({ month: "2026-08", measure_as_published: "Old words" }), row({ month: "2026-09", measure_as_published: "New words" })]), labels));
  assert.equal(tied.sources[0].series[0].measure, "New words");
  // Another organisation's figure for the same question is its own group.
  const two = figures(comparison.comparisonView(file([row({}), row({ source: "beta" })]), labels));
  assert.deepEqual(two.sources.map((s) => s.series.length), [1, 1]);
});

test("two rows of one month, as first released and as restated, are both shown, each with its wording and its link", () => {
  const view = figures(
    comparison.comparisonView(
      file([
        row({ month: "2026-10", measure_as_published: "Measure A", theirs: 1000, ours: 1010, gap: 10, gap_pct: 1, source_url: "https://www.alpha.example/release", date_read: "2026-11-20" }),
        row({ month: "2026-10", measure_as_published: "Measure A, restated", theirs: 1005, ours: 1010, gap: 5, gap_pct: 0.4975, source_url: "https://news.example/report", date_read: "2026-11-22" }),
        row({ month: "2026-09" }),
      ]),
      labels,
    ),
  );
  const a = view.sources[0].series[0];
  assert.equal(a.latest.length, 2, "both rows of the newest month");
  assert.deepEqual(a.latest.map((r) => [r.month, r.theirs, r.readUrl, r.readLabel]), [
    ["2026-10", "1,000", "https://www.alpha.example/release", "alpha.example, read 20 November 2026"],
    ["2026-10", "1,005", "https://news.example/report", "news.example, read 22 November 2026"],
  ]);
  assert.deepEqual(a.latest.map((r) => r.notes.length), [0, 1], "the row worded otherwise carries its wording");
  assert.equal(a.all.length, 3);
  assert.equal(a.every, `Every month, ${monthLabel("2026-09")} to ${monthLabel("2026-10")}`, "two rows of one month make a longer list than the first table");
});

test("the link's text is the page's host name without www, then the day read; a page with no host has no link text", () => {
  assert.equal(comparison.hostOf("https://www.example.org/a/b?c=1"), "example.org");
  assert.equal(comparison.hostOf("https://vstat.example.org:8443/new"), "vstat.example.org");
  assert.equal(comparison.hostOf("https://WWW.Example.org/"), "example.org");
  assert.equal(comparison.hostOf("not a url"), undefined);
  const view = figures(comparison.comparisonView(file([row({ source_url: "not a url" })]), labels));
  assert.equal(view.sources[0].series[0].latest[0].readLabel, null);
});

test("a month newer than the newest compared one stays visible, with the sentence that says it is not compared", () => {
  const view = figures(comparison.comparisonView(file([row({ month: "2026-09" }), row({ month: "2026-08" }), notCompared({ month: "2026-10" })]), labels));
  const a = view.sources[0].series[0];
  assert.deepEqual(a.latest.map((r) => r.month), ["2026-10", "2026-09"]);
  assert.equal(a.latest[0].ours, undefined);
  assert.equal(a.latest[0].gap, undefined);
  assert.equal(a.latest[0].notCompared, "This site does not hold this month yet, so the two figures are not set side by side.");
  assert.equal(a.latest[0].theirs, "1,020", "their figure is still shown");
  assert.equal(a.all.length, 3);
  const none = figures(comparison.comparisonView(file([notCompared({ month: "2026-10" }), notCompared({ month: "2026-09" })]), labels));
  assert.deepEqual(none.sources[0].series[0].latest.map((r) => r.month), ["2026-10"], "with none compared, the newest month stands");
  assert.equal(comparison.newestCompared([notCompared({})]), undefined);
  assert.equal(comparison.newestCompared([row({ month: "2026-05" }), row({ month: "2026-07" }), notCompared({ month: "2026-09" })]), "2026-07");
});

test("every kind of reason has its own sentence, and an unknown one has the general sentence, never the pipeline's text", () => {
  const kinds = ["month_not_held", "dataset_not_built", "hidden_cell", "no_published_table", "value_not_held"];
  const said = kinds.map((kind) => comparison.notComparedSentence(kind));
  assert.equal(new Set(said).size, kinds.length, "each kind is said differently");
  assert.equal(comparison.notComparedSentence("something_new"), comparison.words.not_compared.other);
  assert.equal(comparison.notComparedSentence(null), comparison.words.not_compared.other);
  const view = figures(comparison.comparisonView(file([notCompared({ reason_kind: "hidden_cell", reason: "internal id leaks here" })]), labels));
  assert.ok(!JSON.stringify(view).includes("internal"), "the reason text of the file is never shown");
});

test("a figure added up is labelled with the organisation's name and what it was added up from", () => {
  const view = figures(comparison.comparisonView(file([row({ added_up_from: "chart" }), row({ filters: {}, added_up_from: null })]), labels));
  const [a, b] = view.sources[0].series.sort((x, y) => Number(Boolean(y.addedUp)) - Number(Boolean(x.addedUp)));
  assert.equal(a.addedUp, "Added up from Alpha Association's published chart.");
  assert.equal(b.addedUp, null);
  assert.equal(comparison.addedUpLabel({ added_up_from: "table" }, "Beta Board"), "Added up from Beta Board's published table.");
});

test("the added-up label is said once for a group where every row has it, and beside the rows that have it where they differ", () => {
  const every = figures(comparison.comparisonView(file([row({ month: "2026-09", added_up_from: "table" }), row({ month: "2026-10", added_up_from: "table" })]), labels)).sources[0].series[0];
  assert.equal(every.addedUp, "Added up from Alpha Association's published table.");
  assert.deepEqual(every.all.map((r) => r.notes), [[], []]);
  const some = figures(comparison.comparisonView(file([row({ month: "2026-09" }), row({ month: "2026-10", added_up_from: "table" })]), labels)).sources[0].series[0];
  assert.equal(some.addedUp, null);
  assert.deepEqual(some.all.map((r) => r.notes), [["Added up from Alpha Association's published table."], []]);
  const kinds = figures(comparison.comparisonView(file([row({ month: "2026-09", added_up_from: "chart" }), row({ month: "2026-10", added_up_from: "table" })]), labels)).sources[0].series[0];
  assert.equal(kinds.addedUp, null, "two different words are not one label");
  assert.deepEqual(kinds.all.map((r) => r.notes), [["Added up from Alpha Association's published table."], ["Added up from Alpha Association's published chart."]]);
});

test("what this site's figure counts is said in the labels visitors read, and never in an id", () => {
  const ours = (filters: Record<string, string[]>, dataset = "set_one") => comparison.oursSentence({ dataset, filters }, labels);
  assert.equal(ours({}), "This site's figure: Dataset One, with no conditions.");
  assert.equal(ours({ field_x: ["Value P"] }), "This site's figure: Dataset One. Conditions: Field X: Value P.");
  assert.equal(ours({ field_x: ["Value P", "Value Q"], field_y: ["Some|Thing"] }), "This site's figure: Dataset One. Conditions: Field X: Value P or Value Q; Field Y: Some Thing.");
  assert.equal(ours({ field_x: [] }), "This site's figure: Dataset One, with no conditions.", "a condition with no value keeps everything");
  assert.equal(ours({}, "no_such_set"), null, "a dataset the page cannot name leaves the sentence out");
  assert.equal(ours({ no_such_field: ["v"] }), null, "a field the page cannot name leaves the sentence out");
  const view = figures(comparison.comparisonView(file([row({})]), labels));
  assert.ok(!view.sources[0].series[0].ours?.includes("set_one") && !view.sources[0].series[0].ours?.includes("field_x"));
});

test("a known difference is said once where every row has it, and beside the rows that have it where they differ", () => {
  const same = figures(comparison.comparisonView(file([row({ month: "2026-08", known_difference: "Same note" }), row({ month: "2026-09", known_difference: "Same note" })]), labels)).sources[0].series[0];
  assert.equal(same.knownDifference, "Known difference: Same note");
  assert.deepEqual(same.all.map((r) => r.notes), [[], []]);
  const differ = figures(
    comparison.comparisonView(file([row({ month: "2026-08", known_difference: "Same note" }), row({ month: "2026-09" }), row({ month: "2026-10", known_difference: "Newer note" })]), labels),
  ).sources[0].series[0];
  assert.equal(differ.knownDifference, null);
  assert.deepEqual(differ.all.map((r) => r.notes), [["Known difference: Newer note"], [], ["Known difference: Same note"]]);
  assert.equal(figures(comparison.comparisonView(file([row({})]), labels)).sources[0].series[0].knownDifference, null);
});

test("the internal table puts the figures that need a look first, each newest month first", () => {
  const rows = [
    row({ month: "2026-10", status: "pass" }),
    row({ month: "2026-09", status: "fail" }),
    notCompared({ month: "2026-10" }),
    row({ month: "2026-08", status: "warn" }),
    row({ month: "2026-10", status: "warn" }),
    row({ month: "2026-07", status: "pass" }),
  ];
  assert.deepEqual(
    comparison.statusRows(rows).map((r) => `${r.status} ${r.month}`),
    ["fail 2026-09", "warn 2026-10", "warn 2026-08", "not_compared 2026-10", "pass 2026-10", "pass 2026-07"],
  );
  assert.equal(comparison.filtersText({ a: ["x", "y"], b: ["z"] }), "a: x | y; b: z");
  assert.equal(comparison.filtersText({}), "");
});

// ---- config/comparison.json is held to the template lint ----
//
// The same rules pipeline/tests/test_site_config.py applies to the other words of config (config/narrative/rules.json): a placeholder only from the
// list for this kind of template, no digit, no causal or judgement word, and no value or label of a reference file.

const read = (relative: string) => readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");
const rules = JSON.parse(read("config/narrative/rules.json"));

function texts(node: unknown, path = ""): [string, string][] {
  if (typeof node === "string") return [[path, node]];
  if (Array.isArray(node)) return [];
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, value]) => (key.startsWith("$") || key === "public_kinds" ? [] : texts(value, path ? `${path}.${key}` : key)));
  }
  return [];
}
const templates = texts(comparison.words);

// One line of a reference file, with quoted cells.
function cells(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') (cell += '"'), (i += 1);
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") (out.push(cell), (cell = ""));
    else cell += c;
  }
  out.push(cell);
  return out;
}

// The columns of each reference file that the site shows a visitor as a value or a label: the list pipeline/tests/test_site_config.py holds templates to.
const NAME_COLUMNS: Record<string, string[]> = {
  "brand_registry.csv": ["make_canonical", "parent_group", "owner_country", "heritage_country", "brand_region"],
  "powertrain_map.csv": ["powertrain", "powertrain_detail", "powertrain_group", "powertrain_group_label"],
  "segment_map.csv": ["segment", "segment_group"],
  "vehicle_scope.csv": ["label", "trade_group"],
  "import_status_map.csv": ["import_status"],
  "tla_region.csv": ["region"],
  "statsnz_series.csv": ["label"],
  "nz_assembled_map.csv": ["label"],
  "class_map.csv": ["label"],
  "transmission_map.csv": ["group"],
  "vehicle_usage_map.csv": ["label"],
};

function domainNames(): Set<string> {
  const names = new Set<string>();
  for (const [file, wanted] of Object.entries(NAME_COLUMNS)) {
    const [header, ...lines] = read(`data/reference/${file}`).split(/\r?\n/).filter((l) => l.length > 0);
    const columns = cells(header);
    const at = wanted.map((c) => columns.indexOf(c));
    assert.ok(at.every((i) => i >= 0), `${file} has lost a column this test reads`);
    for (const line of lines) for (const i of at) names.add((cells(line)[i] ?? "").trim());
  }
  const ordinary = new Set<string>((rules.ordinary_words as string[]).map((w) => w.toLowerCase()));
  return new Set([...names].filter((n) => n && !ordinary.has(n.toLowerCase())));
}

test("the words of the section are there to be checked", () => {
  assert.ok(templates.length >= 25, "the words have gone missing: these tests would pass without checking anything");
  assert.ok(Array.isArray(rules.placeholders.comparison), "config/narrative/rules.json has no list of placeholders for these templates");
  assert.ok(domainNames().size > 100, "the reference names did not load");
});

test("a template uses only the placeholders the code fills, and only the filters it applies", () => {
  for (const [where, text] of templates) {
    for (const [, path, filter] of text.matchAll(new RegExp(PLACEHOLDER.source, "g"))) {
      assert.ok((rules.placeholders.comparison as string[]).includes(path), `${where}: {${path}} is not a placeholder the code fills`);
      assert.ok(!filter || (rules.filters as string[]).includes(filter.slice(1)), `${where}: ${filter} is not a filter the code applies`);
    }
    const rest = text.replace(new RegExp(PLACEHOLDER.source, "g"), "");
    assert.ok(!/[{}]/.test(rest), `${where}: a brace that is not a placeholder`);
  }
});

test("a template holds no digit and no causal or judgement word", () => {
  for (const [where, text] of templates) {
    const bare = text.replace(new RegExp(PLACEHOLDER.source, "g"), " ");
    assert.ok(!/\d/.test(bare), `${where}: a template holds no digit; a figure comes from the data`);
    for (const word of rules.banned_words as string[]) assert.ok(!new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(bare), `${where}: '${word}' is a causal or judgement word`);
    assert.ok(!bare.includes("!"), `${where}: no exclamation marks`);
  }
});

test("a template names no value of a dimension and no label of a reference file", () => {
  const names = domainNames();
  for (const [where, text] of templates) {
    const bare = text.replace(new RegExp(PLACEHOLDER.source, "g"), " ");
    const found = [...names].filter((n) => new RegExp(`(?<![\\w-])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?(?![\\w-])`, "i").test(bare));
    assert.deepEqual(found, [], `${where}: names values or labels that live in config and the reference files`);
  }
});

test("every template the code reads can be filled, and a filled sentence leaves no placeholder and no question mark", () => {
  const rich = file([
    row({ added_up_from: "chart", known_difference: "A note" }),
    row({ month: "2026-08" }),
    notCompared({ month: "2026-10" }),
    row({ figure_kind: "model", source: "beta" }),
  ]);
  const text = JSON.stringify(comparison.comparisonView(rich, labels));
  assert.ok(!/\{[a-z_.|]+\}/.test(text), "a placeholder was left in a sentence");
  assert.ok(!text.includes('"?'), "a placeholder with no value was drawn as a question mark");
});
