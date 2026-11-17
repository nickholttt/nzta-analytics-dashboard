// Pinning a question to a snapshot (src/lib/pin.ts, D-125). The site serves one snapshot, so a pin holds a window and never a past
// snapshot's figures; these tests hold what the page says about it to that. Through the real settle, questionParams, builderPresets and
// the sentences in config; no field or value is named, they come from config or are made up.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { everythingBuilt } from "./support/observe.ts";

const { addressParams, builderVocabulary, builderPresets, questionParams, readQuestion, readingNotes, settle } = await import("../../src/lib/builder.ts");
const { dimensions, findPeriod } = await import("../../src/lib/config.ts");
const { canPin, heldEnd, holdsWindow, pinNote, shownEnd } = await import("../../src/lib/pin.ts");
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

test("on a newer snapshot a ranking says the figures are the newer snapshot's and may differ, and that its window is kept only where the dataset's first month is known", () => {
  // The default dataset: the manifest does not give its first month, so the line cannot know the chart has a window for the pinned month.
  const q = read(`${ranking}&build.snapshot=2026-10`);
  assert.equal(holdsWindow(q), true);
  const note = pinNote(q, manifestOf("2026-11-30"));
  assert.equal(note?.kind, "newer");
  assert.equal(note?.text, "Pinned to Oct 2026. The figures come from the newer snapshot of 30 November 2026, so they may differ from those seen when it was pinned.");
  // A month long before any vehicle on the register: the chart falls back to the newest month, and the line must not say the window is kept.
  const early = pinNote(read(`${ranking}&build.snapshot=1880-03`), manifestOf("2026-11-30"));
  assert.doesNotMatch(early?.text ?? "", /keeps ending/);
  // A supplied dataset gives its first month, so a pinned month it has a window for is said to be kept.
  const supplied = pinNote(rankingOn(behind, "&build.snapshot=2026-08"), behindManifest("2026-11-30", "2026-11"));
  assert.equal(supplied?.kind, "newer");
  assert.equal(
    supplied?.text,
    "Pinned to Aug 2026: the window keeps ending in that month. The figures come from the newer snapshot of 30 November 2026, so they may differ from those seen when it was pinned.",
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
  const shapes: Record<string, string> = { league: "LeagueChart", matrix: "MatrixChart", trend: "TrendChart", mix: "MixChart", distribution: "DistributionChart", geo: "GeoChart" };
  // The trend chart takes a month too, but only to read a figure and a sentence for it (a preset with an `answer`), which no question on the Build
  // page has: Build's lines always draw to the newest month, so the trend is not a shape a pin can hold.
  const readsAMonthOnly = new Set(["trend"]);
  for (const [shape, file] of Object.entries(shapes)) {
    if (readsAMonthOnly.has(shape)) {
      assert.equal(END_MONTH_SHAPES.has(shape), false, `${file} reads a month for an answer line only`);
      assert.match(source(file), /\bmonth\?: string/, `${file} no longer takes a month: drop it from readsAMonthOnly`);
      continue;
    }
    assert.equal(/\bmonth\?: string/.test(source(file)), END_MONTH_SHAPES.has(shape), `${file}: takes an end month, but END_MONTH_SHAPES (src/lib/resolve.ts) says ${END_MONTH_SHAPES.has(shape)}`);
  }
});

test("the snapshot is told by its month alone: any date within the pinned month is the same snapshot, as a rebuild of it would be", () => {
  const q = read(`${ranking}&build.snapshot=2026-10`);
  for (const date of ["2026-10-01", "2026-10-31"]) assert.equal(pinNote(q, manifestOf(date))?.kind, "same", date);
  assert.equal(pinNote(q, manifestOf("2026-11-30"))?.kind, "newer");
});

test("a month the visitor picked in a ranking is not carried into the pin: the pinned window ends in the pin's month, not in the one picked", () => {
  // Pinned to the snapshot served (the newest month): the chart ends in the newest month whatever was picked before.
  assert.equal(shownEnd("2026-10", "2026-10", "2025-03"), undefined);
  // Pinned to an earlier month: that month.
  assert.equal(shownEnd("2026-10", "2026-11", "2025-03"), "2026-10");
  // Not pinned: the month the visitor picked, and none means the newest.
  assert.equal(shownEnd(undefined, "2026-10", "2025-03"), "2025-03");
  assert.equal(shownEnd(undefined, "2026-10", ""), "");
});

test("pinning takes the picked month out of the address and keeps the chart's other settings; an unpinned question keeps its month", () => {
  const search = `?${ranking}&build.period=1y&build.month=2025-03&other=1`;
  const unpinned = addressParams(search, read(ranking), true);
  assert.equal(unpinned.get("build.month"), "2025-03");
  const pinned = addressParams(search, read(`${ranking}&build.snapshot=2026-10`), true);
  assert.equal(pinned.has("build.month"), false);
  assert.equal(pinned.get("build.period"), "1y");
  assert.equal(pinned.get("build.snapshot"), "2026-10");
  assert.equal(pinned.get("other"), "1");
});

// A build in which the second dataset (true registrations: a supplied one) starts in 2021-01 and ends a month before the register's snapshot.
const behind = vocabulary.datasets[1]?.dataset as string;
const behindManifest = (snapshot: string, latest: string) =>
  ({
    ...everything,
    latest_snapshot: snapshot,
    datasets: Object.fromEntries(
      Object.entries(everything.datasets).map(([id, d]) => [id, id === behind ? { ...d, latest_month: latest, supplied: { months: { first: "2021-01" } } } : { ...d, latest_month: snapshot.slice(0, 7) }]),
    ),
  }) as unknown as typeof everything;
const rankingOn = (dataset: string, extra = "") => read(`build.dataset=${dataset}&${ranking}${extra}`);

test("a pin is offered only where the question's figures reach the snapshot's month", () => {
  assert.ok(behind, "the build needs a second dataset");
  const manifest = behindManifest("2026-11-30", "2026-10");
  assert.equal(canPin(rankingOn(vocabulary.datasets[0].dataset), manifest), true);
  assert.equal(canPin(rankingOn(behind), manifest), false, "the dataset ends in 2026-10 and the snapshot is 2026-11");
  assert.equal(canPin(rankingOn(behind), behindManifest("2026-10-31", "2026-10")), true, "the same dataset once the months agree");
});

test("a pin that the dataset's newest month contradicts does not say the window keeps ending in it", () => {
  const manifest = behindManifest("2026-11-30", "2026-10");
  const link = rankingOn(behind, "&build.snapshot=2026-11");
  assert.equal(holdsWindow(link), true);
  const note = pinNote(link, manifest);
  assert.equal(note?.kind, "uncovered");
  assert.equal(note?.text, "Pinned to Nov 2026, which this chart has no figures for, so it shows the newest month, Oct 2026, of the snapshot of 30 November 2026.");
  assert.doesNotMatch(note?.text ?? "", /keeps ending|the one this page shows/);
});

test("a pinned month before the dataset has a window for it is said, and the month a window needs is the first plus its length", () => {
  const manifest = behindManifest("2026-10-31", "2026-10");
  const first = pinNote(rankingOn(behind, "&build.snapshot=2019-05"), manifest);
  assert.equal(first?.kind, "uncovered");
  assert.equal(first?.text, "Pinned to May 2019, which this chart has no figures for, so it shows the newest month, Oct 2026, of the snapshot of 31 October 2026.");
  // A window of 12 months from 2021-01 first ends in 2021-12.
  assert.equal(findPeriod(builderPresets(rankingOn(behind))[0].period)?.months, 12, "the window this test counts from");
  assert.equal(pinNote(rankingOn(behind, "&build.snapshot=2021-11"), manifest)?.kind, "uncovered");
  assert.equal(pinNote(rankingOn(behind, "&build.snapshot=2021-12"), manifest)?.kind, "newer");
});

test("a chart that cannot hold a window is not told it has no window for the month", () => {
  const manifest = behindManifest("2026-11-30", "2026-10");
  const lines = read(`build.dataset=${behind}&build.measure=count&build.by=${long}&build.value=a&build.value=b&build.snapshot=2026-11`);
  assert.equal(holdsWindow(lines), false);
  assert.equal(pinNote(lines, manifest)?.kind, "same");
});
