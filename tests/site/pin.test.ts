// Pinning a question to a snapshot (src/lib/pin.ts, D-125). The site serves one snapshot, so a pin holds a window and never a past
// snapshot's figures; these tests hold what the page says about it to that. Through the real settle, questionParams, builderPresets and
// the sentences in config; no field or value is named, they come from config or are made up.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { everythingBuilt } from "./support/observe.ts";

const { builderVocabulary, builderPresets, questionParams, readQuestion, readingNotes, settle } = await import("../../src/lib/builder.ts");
const { dimensions } = await import("../../src/lib/config.ts");
const { heldEnd, holdsWindow, pinNote } = await import("../../src/lib/pin.ts");
const { END_MONTH_SHAPES } = await import("../../src/lib/resolve.ts");
const { fillTemplate } = await import("../../src/lib/sentences.ts");

const everything = everythingBuilt();
const vocabulary = builderVocabulary(everything);
const dataset = vocabulary.datasets[0];
const long = dimensions.find((d) => d.kind === "category" && d.cardinality === "high")?.id as string;
// A second field a count by the first can be crossed with, as the page offers it.
const second = dataset.measures.find((m) => m.id === "count")?.dimensions.find((d) => d.id === long)?.with[0] as string;
const manifestOf = (snapshot: string) =>
  ({ ...everything, latest_snapshot: snapshot, datasets: Object.fromEntries(Object.entries(everything.datasets).map(([id, d]) => [id, { ...d, latest_month: snapshot.slice(0, 7) }])) }) as typeof everything;
const read = (query: string) => settle(vocabulary, readQuestion(`?${query}`));
const ranking = `build.measure=count&build.by=${long}&build.value=a&build.value=b&build.view=league`;

test("a pin is a month in the address and survives the round trip; a link with none has none", () => {
  const pinned = read(`${ranking}&build.snapshot=2026-10`);
  assert.equal(pinned.snapshot, "2026-10");
  assert.equal(questionParams(pinned).get("build.snapshot"), "2026-10");
  assert.equal(read(String(questionParams(pinned))).snapshot, "2026-10");
  assert.equal(questionParams(read(ranking)).has("build.snapshot"), false);
});

test("a pin that is not a month is dropped, and the page says so", () => {
  for (const asked of ["soon", "2026-13", "2026-1", "2026-10-31", "2026-00"]) {
    const link = readQuestion(`?${ranking}&build.snapshot=${asked}`);
    const q = settle(vocabulary, link);
    assert.equal(q.snapshot, undefined, asked);
    assert.deepEqual(readingNotes(vocabulary, link, q).snapshot, { asked });
  }
  const fine = readQuestion(`?${ranking}&build.snapshot=2026-10`);
  assert.equal(readingNotes(vocabulary, fine, settle(vocabulary, fine)).snapshot, undefined);
});

test("only a pinned question carries a month for its charts to end in", () => {
  assert.equal(builderPresets(read(ranking))[0].through, undefined);
  assert.equal(builderPresets(read(`${ranking}&build.snapshot=2026-10`))[0].through, "2026-10");
});

test("a pinned window keeps its month while the data goes on, and one with no pin follows the newest month", () => {
  assert.equal(heldEnd("2026-10", "2026-10"), undefined, "pinned to the newest month: nothing to hold");
  assert.equal(heldEnd("2026-10", "2026-11"), "2026-10", "the data has gone on: the window stays");
  assert.equal(heldEnd("2026-10", "2026-12"), "2026-10");
  assert.equal(heldEnd(undefined, "2026-11"), undefined, "no pin: the chart ends in whatever the newest month is");
  assert.equal(heldEnd("2026-12", "2026-11"), undefined, "a pin ahead of the data cannot be held: the newest is shown");
});

test("the pin line on the snapshot month pinned to says so, and claims no more than the month", () => {
  const q = read(`${ranking}&build.snapshot=2026-10`);
  const note = pinNote(q, manifestOf("2026-10-31"));
  assert.equal(note?.kind, "same");
  assert.equal(note?.text, "Pinned to Oct 2026, the snapshot month this page shows.");
});

test("on a newer snapshot a ranking keeps its window and says the figures are the newer snapshot's and may differ", () => {
  const q = read(`${ranking}&build.snapshot=2026-10`);
  assert.equal(holdsWindow(q), true);
  const note = pinNote(q, manifestOf("2026-11-30"));
  assert.equal(note?.kind, "newer");
  assert.equal(
    note?.text,
    "Pinned to Oct 2026: the window keeps ending in that month. The figures come from the newer snapshot of 30 November 2026, so they may differ from those seen when it was pinned.",
  );
});

test("a chart that cannot end in an earlier month says it runs to the newest, never that its window is held", () => {
  const q = read(`build.measure=count&build.by=${long}&build.value=a&build.value=b&build.snapshot=2026-10`);
  assert.equal(holdsWindow(q), false);
  const note = pinNote(q, manifestOf("2026-11-30"));
  assert.equal(note?.kind, "newer");
  assert.equal(
    note?.text,
    "Pinned to Oct 2026. This chart always runs to the newest month, Nov 2026, so it shows the newer snapshot of 30 November 2026, and its figures may differ from those seen when it was pinned.",
  );
  assert.doesNotMatch(note?.text ?? "", /keeps ending/);
});

test("a grid can hold its window", () => {
  assert.ok(second, "the build needs a second field a count by the first can be crossed with");
  assert.equal(holdsWindow(read(`build.measure=count&build.by=${long}&build.by2=${second}&build.snapshot=2026-10`)), true);
});

test("a pin ahead of the snapshot served is said, and the snapshot shown is named", () => {
  const note = pinNote(read(`${ranking}&build.snapshot=2026-12`), manifestOf("2026-11-30"));
  assert.equal(note?.kind, "ahead");
  assert.equal(note?.text, "This link is pinned to Dec 2026, a snapshot this site does not have yet. It shows the snapshot of 30 November 2026.");
});

test("a question that is not pinned has no pin line", () => {
  assert.equal(pinNote(read(ranking), manifestOf("2026-10-31")), undefined);
});

test("the pin sentences fill with nothing left over", () => {
  const notices = JSON.parse(readFileSync(new URL("../../config/presets.json", import.meta.url), "utf8")).builder.notices;
  for (const key of ["pin_same", "pin_newer", "pin_newer_open", "pin_ahead", "snapshot"]) {
    assert.deepEqual(fillTemplate(notices[key], { pinned: "2026-10", date: "2026-11-30", latest: "2026-11", asked: "x" }).unresolved, [], key);
  }
});

test("the shapes that can hold a pinned window are the charts that are given a month to end in", () => {
  const source = (name: string) => readFileSync(new URL(`../../src/components/${name}.tsx`, import.meta.url), "utf8");
  const shapes: Record<string, string> = { league: "LeagueChart", matrix: "MatrixChart", mix: "MixChart", distribution: "DistributionChart", geo: "GeoChart" };
  for (const [shape, file] of Object.entries(shapes)) {
    assert.equal(/\bmonth\?: string/.test(source(file)), END_MONTH_SHAPES.has(shape), `${file}: takes an end month, but END_MONTH_SHAPES (src/lib/resolve.ts) says ${END_MONTH_SHAPES.has(shape)}`);
  }
});

test("the snapshot is told by its month alone: any date within the pinned month is the same snapshot, as a rebuild of it would be", () => {
  const q = read(`${ranking}&build.snapshot=2026-10`);
  for (const date of ["2026-10-01", "2026-10-31"]) assert.equal(pinNote(q, manifestOf(date))?.kind, "same", date);
  assert.equal(pinNote(q, manifestOf("2026-11-30"))?.kind, "newer");
});
