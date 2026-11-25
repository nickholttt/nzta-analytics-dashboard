// The answer pages and the front page over windows, on the build in front of it (public/data, the October data) and read against the fact table's raw rows:
// a place within a panel is the rank among that panel's own sums; a powertrain page's share is of the powertrain's vehicles under the condition; a by-period
// row is the raw sum of its months for each condition; the windowed links of the front page and a brand's rivals read back through the canvas's own reader as the
// page says; a mover's floor is the monthly minimum times the months; a change across an event that changed how the data is recorded is not stated on either
// surface; and every address into the method page names a heading that exists. Skipped where there is no build.
import "./support/register.mjs";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const real = existsSync(join("public", "data", "manifest.json"));
const manifest = real ? JSON.parse(readFileSync(join("public", "data", "manifest.json"), "utf8")) : undefined;
const { readPublished } = await import("../../src/lib/publishedFiles.mjs");
const { answerPagesSite } = await import("../../src/lib/answerPagesBuild.ts");
const { latestMonthSection } = await import("../../src/lib/latestMonthBuild.ts");
const { readFactColumns } = await import("../../src/lib/conditionViewsBuild.ts");
const { windowsFor, windowsConfig } = await import("../../src/lib/windows.ts");
const { count } = await import("../../src/lib/sentences.ts");
const { pct } = await import("../../src/lib/measures.ts");
const { isReservedValue } = await import("../../src/lib/chartSentence.ts");
const { yearChangeFloor, findDimension } = await import("../../src/lib/config.ts");
const { fieldNoteAnchor, fullNote } = await import("../../src/lib/dimensionNote.ts");
const canvas = await import("../../src/lib/canvas.ts");
const builder = await import("../../src/lib/builder.ts");

const DATASET = "new_registrations";
const NEW = "NZ New";
const USED = "Used Import";
const CONDITIONS = [NEW, USED, undefined] as const;
const latest = manifest?.datasets?.[DATASET]?.latest_month as string | undefined;
const windows = latest ? windowsFor(latest) : [];
const table = real ? await readFactColumns(readPublished, manifest, DATASET, ["make", "model", "import_status", "powertrain"]) : undefined;
const site = real ? await answerPagesSite(manifest, readPublished) : undefined;
const section = real ? await latestMonthSection(manifest, readPublished) : undefined;

// The raw sum over months for a value of a field, a condition (or all) and, where given, one powertrain.
const raw = (field: string, value: string | undefined, condition: string | undefined, months: string[], powertrain?: string) => {
  let n = 0;
  table!.n.forEach((x, i) => {
    if (value !== undefined && table!.values[field][i] !== value) return;
    if (!months.includes(table!.month[i])) return;
    if (condition !== undefined && table!.values.import_status[i] !== condition) return;
    if (powertrain !== undefined && table!.values.powertrain[i] !== powertrain) return;
    n += x;
  });
  return n;
};
const brandPages = () => site!.pages.filter((p) => p.kind === "brand");
const nameToValue = () => new Map(brandPages().map((p) => [p.name, p.value]));

const all = real ? canvas.canvasVocabulary(builder.builderVocabulary(manifest)) : undefined;
function read(link: string) {
  const url = new URL(link, "https://site.example");
  const asked = canvas.readCanvas(url.search);
  const opened = canvas.withFittingTypes(canvas.settleCanvas(all!, asked), manifest);
  return { q: opened.charts[0].question, period: Object.fromEntries(canvas.chartSettings(url.search, "c1")).period };
}

test("a brand's place in the rivals table is its rank among the raw sums of that table's own window and condition", { skip: !real }, () => {
  const names = nameToValue();
  const brands = [...new Set(table!.values.make)].filter((v) => !isReservedValue(v));
  let checked = 0;
  for (const page of brandPages().slice(0, 12)) {
    const rivals = page.scope!.sections.find((s) => s.id === "rivals")!;
    for (const p of rivals.panels) {
      const w = windows[p.win];
      const condition = CONDITIONS[p.view];
      const sums = new Map(brands.map((b) => [b, raw("make", b, condition, w.months)] as [string, number]));
      for (const row of p.rows) {
        const m = /^(\d+) of (\d+)$/.exec(row.cells[2].text);
        if (!m) {
          assert.ok(row.cells[2].none && row.cells[2].reason, `${page.value} ${w.id}: a place not stated says so`);
          continue;
        }
        const n = sums.get(names.get(row.name)!)!;
        assert.equal(Number(m[1]), 1 + [...sums.values()].filter((x) => x > n).length, `${page.value} ${w.id} ${condition ?? "all"} ${row.name}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 100);
});

test("a rivals panel's own link asks for the brands in the panel, the window's period and the panel's condition", { skip: !real }, () => {
  const names = nameToValue();
  for (const page of brandPages().slice(0, 6)) {
    const rivals = page.scope!.sections.find((s) => s.id === "rivals")!;
    for (const p of rivals.panels) {
      const w = windows[p.win];
      const link = p.links!.find((l) => l.text.startsWith("Rank"));
      if (!link) {
        assert.ok(w.yearToDate, `${page.value} ${w.id}: only a window the canvas lacks has no ranking link`);
        continue;
      }
      const league = read(link.href);
      assert.deepEqual([...league.q.values].sort(), p.rows.map((r) => names.get(r.name)!).sort(), `${page.value}: the brands the table shows`);
      assert.equal(league.period, w.canvasPeriod);
      const condition = CONDITIONS[p.view];
      assert.deepEqual({ ...league.q.where }, condition ? { import_status: [condition] } : {});
    }
  }
});

test("the headings of the share and the place name the vehicles counted: new, used imports or all", { skip: !real }, () => {
  const names = nameToValue();
  const rivals = brandPages()[0].scope!.sections.find((s) => s.id === "rivals")!;
  const [newPanel, usedPanel, allPanel] = [0, 1, 2].map((v) => rivals.panels.find((p) => p.win === 2 && p.view === v)!);
  assert.deepEqual(newPanel.columns.slice(1, 4), ["New", "Share of all new vehicles", "Place among brands by new vehicles"]);
  assert.match(usedPanel.columns[2], /used imports$/);
  assert.deepEqual(allPanel.columns.slice(2, 4), ["Share of all vehicles", "Place among all brands"]);
  // and the figure under "Share of all new vehicles" is of all new vehicles
  const w = windows[2];
  const row = newPanel.rows[0];
  const n = raw("make", names.get(row.name), NEW, w.months);
  assert.equal(row.cells[1].text, pct(n / raw("make", undefined, NEW, w.months)));
  const league = site!.index!.league!.section.panels.find((p) => p.win === 2 && p.view === 0)!;
  assert.match(league.columns.join("|"), /Share of all new vehicles\|/);
});

test("a powertrain page's share is of that powertrain's vehicles under the condition, and its heading says which", { skip: !real }, () => {
  const names = nameToValue();
  const pages = site!.pages.filter((p) => p.kind === "cut");
  assert.ok(pages.length >= 5);
  for (const page of pages) {
    const w = windows[2];
    const sec = page.scope!.sections.find((s) => s.id === "brands")!;
    for (const view of [0, 1, 2]) {
      const panel = sec.panels.find((p) => p.win === 2 && p.view === view)!;
      const condition = CONDITIONS[view];
      const total = raw("make", undefined, condition, w.months, page.value);
      const row = panel.rows[0];
      const n = raw("make", names.get(row.name), condition, w.months, page.value);
      assert.equal(row.cells[view === 2 ? 3 : 1].text, pct(n / total), `${page.value} ${condition ?? "all"} ${row.name}`);
      if (view < 2) assert.match(panel.columns.join("|"), /, counting (new vehicles|used imports)\|/, page.value);
    }
  }
});

test("a brand's by-period row has the raw sum of its months for new, for used imports and for all", { skip: !real }, () => {
  for (const page of brandPages().slice(0, 10)) {
    page.periods!.rows.forEach((r, i) => {
      const w = windows[i];
      assert.deepEqual(r.cells.slice(0, 3), [count(raw("make", page.value, NEW, w.months)), count(raw("make", page.value, USED, w.months)), count(raw("make", page.value, undefined, w.months))], `${page.value} ${w.id}`);
    });
  }
});

test("the front page's windowed links ask for the window's period and the panel's condition", { skip: !real }, () => {
  const config = JSON.parse(readFileSync(join("config", "latest_month.json"), "utf8"));
  let checked = 0;
  for (const b of section!.blocks.filter((x) => x.windowed)) {
    const block = config.blocks.find((x: { id: string }) => x.id === b.id);
    for (const p of b.windowed!) {
      if (!p.canvas) continue;
      const { q, period } = read(p.canvas);
      const condition = CONDITIONS[p.view!];
      assert.deepEqual({ ...q.where }, condition ? { import_status: [condition] } : {}, `${b.id} w${p.win} v${p.view}`);
      if (block.canvas.settings?.period !== undefined) assert.equal(period, windows[p.win!].canvasPeriod, `${b.id} w${p.win}`);
      checked++;
    }
  }
  assert.ok(checked > 40);
});

test("a mover's floor is the monthly minimum times the window's months, and the note says so", { skip: !real }, () => {
  const per = windowsConfig.mover_minimum_per_month;
  const change = yearChangeFloor();
  for (const page of site!.pages.filter((p) => p.kind === "cut").slice(0, 3)) {
    for (const id of ["brand-movers", "model-movers"]) {
      for (const p of page.scope!.sections.find((s) => s.id === id)!.panels) {
        const note = p.notes[0] ?? p.empty;
        const floor = Math.max(change, per * windows[p.win].months.length);
        assert.ok(note?.includes(count(floor)), `${page.value} ${id} w${p.win}: ${note}`);
      }
    }
  }
});

test("a powertrain page's mover sentences and empty messages say which vehicles they count", { skip: !real }, () => {
  for (const page of site!.pages.filter((p) => p.kind === "cut")) {
    const cut = /had the most (.+) first registered/.exec(page.title)![1];
    for (const id of ["brand-movers", "model-movers"]) {
      for (const p of page.scope!.sections.find((s) => s.id === id)!.panels) {
        for (const s of [...p.sentences, ...(p.empty ? [p.empty] : [])]) assert.ok(s.includes(cut), `${page.value} ${id}: ${s}`);
        if (p.view < 2) for (const s of [...p.sentences, ...(p.empty ? [p.empty] : [])]) assert.match(s, /counting (new vehicles|used imports)/);
      }
    }
  }
});

test("a line identified only in part is said so in the sentences, and its change on a year earlier is not stated", { skip: !real }, () => {
  const mild = site!.pages.find((p) => p.kind === "cut" && /identified/i.test(p.name));
  if (!mild) return;
  assert.ok(mild.sentences.every((s) => !/(?<!identified )mild hybrid vehicles/i.test(s)), mild.sentences.join(" | "));
  assert.ok(mild.sentences.every((s) => !/ (up|down) \d/.test(s)));
  for (const p of mild.scope!.sections.flatMap((s) => s.panels)) for (const r of p.rows) assert.ok(r.cells.every((c) => !c.direction && !c.fresh), `${mild.value}: ${r.name}`);
});

test("an event that changed how the data is recorded, inside a window's earlier months, drops the change on the front page and on the brand pages", { skip: !real }, async () => {
  const events = JSON.parse(new TextDecoder().decode(readPublished("events.json")!));
  const fixture = { id: "fixture-recording", date_start: "2025-06-01", date_end: "2025-06-30", category: "regulatory", mechanism: "measurement", scope: "market", scope_values: [], title: "x", summary: "x", expected_effect: "none", announced_date: null, confidence: "documented", verified: true, source_url: "", notes: "" };
  const withEvent = (name: string) => (name === "events.json" ? new TextEncoder().encode(JSON.stringify([...events, fixture])).buffer : readPublished(name));
  const changed = { site: (await answerPagesSite(manifest, withEvent as never))!, section: (await latestMonthSection(manifest, withEvent as never))! };
  const stated = (cells: { direction?: string; fresh?: boolean }[]) => cells.some((c) => c.direction || c.fresh);
  const surfaces = (s: { site: NonNullable<typeof site>; section: NonNullable<typeof section> }, wi: number) => {
    const brands = s.site.pages.filter((p) => p.kind === "brand").flatMap((p) => p.scope!.sections.flatMap((x) => x.panels.filter((y) => y.win === wi && y.view === 2).flatMap((y) => y.rows)));
    const home = s.section.blocks.find((b) => b.id === "brands")!.windowed!.filter((y) => y.win === wi && y.view === 2).flatMap((y) => y.rows);
    return { brands: stated(brands.flatMap((r) => r.cells)), home: home.some((r) => r.change || r.fresh) };
  };
  windows.forEach((w, wi) => {
    const before = surfaces({ site: site!, section: section! }, wi);
    assert.deepEqual(before, { brands: true, home: true }, `without the event, ${w.id} states a change`);
    const after = surfaces(changed, wi);
    // the earlier months of the window that hold June 2025 are not compared
    const hit = w.prior.includes("2025-06");
    assert.deepEqual(after, hit ? { brands: false, home: false } : { brands: true, home: true }, `with the event, ${w.id}`);
  });
});

test("every address into the method page names a heading that exists", { skip: !real }, () => {
  const method = readFileSync(join("src", "pages", "method.astro"), "utf8");
  const anchors = new Set([...method.matchAll(/\bid="([a-z0-9-]+)"/g)].map((m) => m[1]));
  const dimensions = JSON.parse(readFileSync(join("config", "dimensions.json"), "utf8")).dimensions as { id: string }[];
  for (const d of dimensions) if (fullNote(findDimension(d.id) as never)) anchors.add(fieldNoteAnchor(d.id));
  const hrefs = [site!.cutNav?.note?.href, ...site!.pages.flatMap((p) => [p.cutNav?.note?.href, ...(p.scope?.sections ?? []).flatMap((s) => s.panels.flatMap((x) => x.rows.map((r) => r.after?.href))), ...(p.fixed?.panels ?? []).flatMap((x) => x.rows.map((r) => r.after?.href))])].filter((h): h is string => Boolean(h));
  for (const href of hrefs.filter((h) => h.startsWith("/method#"))) assert.ok(anchors.has(href.split("#")[1]), `${href}: no heading has that anchor`);
});
