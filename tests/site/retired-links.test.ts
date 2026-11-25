// An old link to a dataset that was joined into New registrations loads back as the same chart with the same figures (D-158; the owner's
// order of 2026-11-25: "old links keep working"), and nothing the site writes names a retired id. The corpus is
// tests/site/fixtures/retired-links.json: every link the repository's own starters and Explore views made before the change, written by the
// code of that day (the full starter canvas, each of its charts, the Explore views the canvas could ask, a saved canvas as My canvases kept
// it), a Build link of each old dataset and the odd links a visitor could have made. Beside each link is what the old code settled it to: the
// chart's dataset, measure, breakdowns, values, conditions, pin, type and shape, and the resolver's verdict. Run with Node's own test runner:
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { realisticBuilt } from "./support/observe.ts";

const config = await import("../../src/lib/config.ts");
const builder = await import("../../src/lib/builder.ts");
const resolve = await import("../../src/lib/resolve.ts");
const canvas = await import("../../src/lib/canvas.ts");
const saved = await import("../../src/lib/savedCanvases.ts");
const { canvasSearchFromBuild } = await import("../../src/lib/buildLink.ts");
const { buildLinkRules } = await import("../../src/lib/buildLinkRules.ts");
const { starterViews } = await import("../../src/lib/starters.ts");

type Old = {
  id: string;
  dataset: string;
  measure: string;
  by: string | null;
  by2: string | null;
  values: string[];
  values2: string[];
  where: Record<string, string[]>;
  pageValues: boolean;
  snapshot: string | null;
  type: string | null;
  preset: string | null;
  status: string;
  shape: string;
};
type Link = { name: string; link: string; kind: string; charts: Old[] };
const corpus = JSON.parse(readFileSync(new URL("./fixtures/retired-links.json", import.meta.url), "utf8")) as Link[];
const retired = config.retiredDatasets;
const manifest = realisticBuilt();
const buildVocabulary = builder.builderVocabulary(manifest);
const all = canvas.canvasVocabulary(buildVocabulary);
const scopeFile = readFileSync(new URL("../../data/reference/vehicle_scope.csv", import.meta.url), "utf8").trim().split("\n");
const header = scopeFile[0].split(",");

const searchOf = (link: string) => (link.includes("?") ? link.slice(link.indexOf("?")) : "");
const searchFor = (l: Link) => (l.kind === "build" ? canvasSearchFromBuild(searchOf(l.link), buildLinkRules()) : searchOf(l.link));
const open = (search: string) => canvas.withFittingTypes(canvas.settleCanvas(all, canvas.readCanvas(search)), manifest);
const sorted = (where: Record<string, string[]>) => Object.fromEntries(Object.entries(where).map(([d, v]) => [d, [...v].sort()]).sort(([a], [b]) => (a < b ? -1 : 1)));

// What the old dataset's own scope was, from the data: the types the vehicle scope file marks in the column the old dataset required.
function typesCounted(column: string): string[] {
  const at = (name: string) => header.indexOf(name);
  return scopeFile
    .slice(1)
    .map((line) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((cell) => cell.replace(/,$/, "").replace(/^"|"$/g, "")) ?? [])
    .filter((cells) => cells[at(column)] === "true")
    .map((cells) => cells[at("label")]);
}

// What an old chart asks, as the one dataset asks it: the same measure, breakdowns, values and pin, and the old dataset's own conditions added to
// the link's by intersection (a list with nothing in common leaves the old list).
function expected(old: Old): Record<string, string[]> {
  const where = { ...old.where };
  for (const [d, list] of Object.entries(retired[old.dataset]?.where ?? {})) {
    const both = (where[d] ?? []).filter((v) => list.includes(v));
    where[d] = both.length > 0 ? both : [...list];
  }
  return sorted(where);
}

test("the corpus holds what it should: the starter and each of its charts, Explore views, a saved canvas, Build links and odd ones, of both retired ids", () => {
  const kinds = new Set(corpus.map((l) => l.kind));
  for (const kind of ["starter", "starter-chart", "preset", "saved", "build", "canvas"]) assert.ok(kinds.has(kind), kind);
  const datasets = new Set(corpus.flatMap((l) => l.charts.map((c) => c.dataset)));
  for (const id of Object.keys(retired)) assert.ok(datasets.has(id), `a link to ${id}`);
  assert.ok(Object.keys(retired).length >= 2, "config retires the datasets this corpus was written for");
});

test("an old link opens as the same chart: the same measure, breakdowns, values and pin, on the one dataset, with the old dataset's conditions added", () => {
  for (const link of corpus) {
    const opened = open(searchFor(link));
    assert.equal(opened.charts.length, link.charts.length, link.name);
    link.charts.forEach((old, i) => {
      const chart = opened.charts[i];
      const where = `${link.name}, chart ${i + 1}`;
      const retiredTo = retired[old.dataset];
      const q = chart.question;
      assert.equal(q.dataset, retiredTo ? retiredTo.to : old.dataset, `${where}: dataset`);
      assert.equal(q.measure, old.measure, `${where}: measure`);
      assert.equal(q.by, old.by, `${where}: breakdown`);
      assert.equal(q.by2 ?? null, old.by2, `${where}: second breakdown`);
      assert.deepEqual(q.values, old.values, `${where}: values`);
      assert.deepEqual(q.values2 ?? [], old.values2, `${where}: second values`);
      assert.equal(Boolean(q.pageValues), old.pageValues, `${where}: the page's own values`);
      assert.equal(q.snapshot ?? null, old.snapshot, `${where}: pin`);
      assert.deepEqual(sorted(q.where), retiredTo ? expected(old) : sorted(old.where), `${where}: conditions`);
      assert.equal(chart.type, old.type, `${where}: chart type`);
      // It draws: the resolver's verdict and shape are the old chart's.
      const [preset] = builder.builderPresets(q);
      const resolution = resolve.resolvePreset(preset, manifest);
      assert.equal(resolution.status, old.status, `${where}: status`);
      assert.equal(resolution.shape, old.shape, `${where}: shape`);
    });
  }
});

test("a link to the narrower dataset keeps the vehicle types it counted, as the data's own scope file says, and a link to the wider one keeps them all", () => {
  const narrow = Object.entries(retired).filter(([, r]) => r.where?.vehicle_type);
  const wide = Object.entries(retired).filter(([, r]) => !r.where);
  assert.ok(narrow.length > 0 && wide.length > 0, "one of each: this test would pass without checking anything");
  // The types the old dataset counted are the ones the scope file marks in the default scope: the block is data and the data agrees with it.
  for (const [id, r] of narrow) assert.deepEqual([...(r.where?.vehicle_type ?? [])].sort(), typesCounted("in_scope").sort(), id);
  for (const link of corpus) {
    const opened = open(searchFor(link));
    link.charts.forEach((old, i) => {
      const types = builder.builderPresets(opened.charts[i].question)[0].where?.vehicle_type ?? [];
      if (retired[old.dataset]?.where?.vehicle_type && !old.where.vehicle_type) assert.deepEqual([...types].sort(), typesCounted("in_scope").sort(), `${link.name}, chart ${i + 1}`);
      if (wide.some(([id]) => id === old.dataset) && !old.where.vehicle_type) assert.deepEqual(types, [], `${link.name}, chart ${i + 1}: a link to the wider dataset adds no condition`);
    });
  }
});

test("a link to a retired id is told what became of it, in one sentence for each chart; a link that names none is told nothing of one", () => {
  for (const link of corpus) {
    const asked = canvas.readCanvas(searchFor(link));
    const opened = open(searchFor(link));
    asked.forEach((a, i) => {
      const old = link.charts[i];
      const notices = builder.linkNotices(buildVocabulary, a.asked, opened.charts[i].question);
      const told = notices.filter((n) => n.startsWith("This link was made for"));
      if (retired[old.dataset]) {
        assert.equal(told.length, 1, `${link.name}, chart ${i + 1}`);
        assert.ok(told[0].toLowerCase().includes((retired[old.dataset].label as string).toLowerCase()), told[0]);
        assert.equal(retired[old.dataset].where === undefined, !/\bkeeps\b/.test(told[0]), told[0]);
      } else assert.equal(told.length, 0, `${link.name}, chart ${i + 1}`);
    });
  }
});

test("a canvas written back from an old link names no retired id, and read again it is the same canvas", () => {
  for (const link of corpus) {
    const opened = open(searchFor(link));
    const written = `?${canvas.canvasParams(opened)}`;
    for (const id of Object.keys(retired)) assert.ok(!written.includes(id), `${link.name}: ${id} in ${written}`);
    const again = open(written);
    assert.deepEqual(
      again.charts.map((c) => ({ ...c.question })),
      opened.charts.map((c) => ({ ...c.question })),
      link.name,
    );
    assert.deepEqual(again.charts.map((c) => c.type), opened.charts.map((c) => c.type), link.name);
  }
});

test("a saved canvas, kept as the old text and read again, is the canvas the new text is", () => {
  const old = corpus.find((l) => l.kind === "saved");
  assert.ok(old);
  const stored = saved.canvasQuery(searchOf(old.link)) as string;
  assert.ok(Object.keys(retired).some((id) => stored.includes(id)), "the stored text keeps the id it was saved with");
  const fromStored = open(`?${stored}`);
  const fromNew = open(`?${canvas.canvasParams(fromStored)}`);
  assert.deepEqual(fromStored.charts.map((c) => ({ ...c.question })), fromNew.charts.map((c) => ({ ...c.question })));
  // Saving it again writes the new text.
  const again = saved.canvasQuery(`?${canvas.canvasParams(fromStored)}`) as string;
  for (const id of Object.keys(retired)) assert.ok(!again.includes(id), id);
  // Pinning a stored canvas keeps it readable.
  const latest = { ...manifest, latest_snapshot: "2026-10-31", datasets: Object.fromEntries(Object.entries(manifest.datasets).map(([id, d]) => [id, { ...d, latest_month: "2026-10" }])) } as typeof manifest;
  const pinned = saved.pinSavedCanvas(all, latest, stored, "2026-10");
  assert.equal(open(`?${pinned}`).charts.length, old.charts.length);
});

test("a link that names a retired id and a pin keeps the pin where the chart can be pinned, as the old link did", () => {
  const link = corpus.find((l) => l.name.includes("pinned"));
  assert.ok(link);
  const [chart] = open(searchFor(link)).charts;
  assert.equal(chart.question.snapshot ?? null, link.charts[0].snapshot);
});

test("nothing the site writes names a retired id: not a starter, not a canvas of any dataset it offers, not a config file's dataset", () => {
  const ids = Object.keys(retired);
  assert.ok(ids.length > 0);
  for (const s of starterViews(all, manifest, "/canvas/")) for (const id of ids) assert.ok(!s.href.includes(id), `${s.id}: ${id}`);
  for (const dataset of config.builderSpec.datasets) {
    assert.ok(!ids.includes(dataset), `the builder offers ${dataset}`);
    for (const m of config.builderSpec.measures) {
      const q = builder.settle(buildVocabulary, { dataset, measure: m.id });
      for (const id of ids) assert.ok(!`${canvas.canvasParams({ charts: [{ id: "c1", question: q, type: null, table: false, width: "full" }] })}`.includes(id), `${dataset} ${m.id}`);
    }
  }
  // No dataset is retired and defined at once, and each retired id leads to a dataset that is.
  for (const [id, r] of Object.entries(retired)) {
    assert.equal(config.findDataset(id), undefined, `${id} is still defined`);
    assert.ok(config.findDataset(r.to), `${id} leads to ${r.to}, which is not defined`);
    assert.ok(config.builderSpec.datasets.includes(r.to), `${r.to} is not offered`);
  }
  // Config names the datasets a preset, a starter or a measure reads: none of them is retired.
  const named: string[] = [];
  const walk = (node: unknown, key = ""): void => {
    if (Array.isArray(node)) node.forEach((n) => walk(n, key));
    else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) walk(v, k);
    else if (typeof node === "string" && /(^|_)datasets?$/.test(key) && !key.startsWith("$")) named.push(node);
  };
  for (const file of ["presets", "starter_canvases", "measures", "latest_month", "answer_pages"]) walk(JSON.parse(readFileSync(new URL(`../../config/${file}.json`, import.meta.url), "utf8")));
  assert.ok(named.length > 20, "the walk found the datasets config names: this test would pass without checking anything");
  for (const id of ids) assert.ok(!named.includes(id), `config names the retired ${id}`);
});
