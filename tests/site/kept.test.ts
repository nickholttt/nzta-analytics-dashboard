// Where a pinned question reads its figures from (src/lib/kept.ts, D-131): which folder, in each case; what a kept snapshot that cannot answer
// the question does; the owner-field rule with its stand-in key; and the line above the chart in each case. Through the real settle, builderPresets,
// resolvePreset and the sentences in config; no field or value is named, they come from config or are made up.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { everythingBuilt } from "./support/observe.ts";

const { builderVocabulary, readQuestion, settle } = await import("../../src/lib/builder.ts");
const { dimensions } = await import("../../src/lib/config.ts");
const { SMALL_CELL_KEY, hasValues, holds, keptMonth, ownerSliceReady, pickerMonth, pinLine, readingFor } = await import("../../src/lib/kept.ts");
const { ownerDimensions } = await import("../../src/lib/owner.ts");
const dataMap = JSON.parse(readFileSync(new URL("../../config/data_map.json", import.meta.url), "utf8"));
const { fillTemplate } = await import("../../src/lib/sentences.ts");
const { readIndex } = await import("../../src/lib/snapshotIndex.ts");
const { pinNote } = await import("../../src/lib/pin.ts");
type Manifest = import("../../src/lib/data.ts").Manifest;

const everything = everythingBuilt();
const vocabulary = builderVocabulary(everything);
const dataset = vocabulary.datasets[0].dataset;
const ownerSet = new Set(vocabulary.owner);
const long = dimensions.find((d) => d.kind === "category" && d.cardinality === "high" && !ownerSet.has(d.id))?.id as string;
const owner = vocabulary.owner[0];
const manifestOf = (snapshot: string, change: (id: string, entry: Record<string, unknown>) => Record<string, unknown> = (_id, e) => e): Manifest =>
  ({
    ...everything,
    latest_snapshot: snapshot,
    datasets: Object.fromEntries(Object.entries(everything.datasets).map(([id, d]) => [id, change(id, { ...d, latest_month: snapshot.slice(0, 7) })])),
  }) as unknown as Manifest;
const served = manifestOf("2026-11-30");
const kept = manifestOf("2026-10-31");
const index = readIndex({ snapshots: [{ month: "2026-09", snapshot: "2026-09-30" }, { month: "2026-10", snapshot: "2026-10-31" }] });
const read = (query: string) => settle(vocabulary, readQuestion(`?${query}`));
const ranking = `build.measure=count&build.by=${long}&build.value=a&build.value=b&build.view=league`;
const pinned = (month: string, base = ranking) => read(`${base}&build.snapshot=${month}`);

// Loaders that record what they were asked and answer from what the case holds.
function loaders(opts: { index?: typeof index; manifests?: Record<string, Manifest>; held?: string[]; sliceFails?: boolean } = {}) {
  const calls: string[] = [];
  return {
    calls,
    load: {
      index: async () => (calls.push("index"), opts.index === undefined ? index : opts.index),
      manifest: async (month: string) => {
        calls.push(`manifest ${month}`);
        const found = (opts.manifests ?? { "2026-10": kept, "2026-09": manifestOf("2026-09-30") })[month];
        if (!found) throw new Error("no such folder");
        return found;
      },
      slice: async (ds: string, dimension: string, month: string) => {
        calls.push(`slice ${ds}/${dimension} ${month}`);
        if (opts.sliceFails) throw new Error("no such file");
        return (opts.held ?? ["a", "b", "c"]).map((value) => ({ value }));
      },
    },
  };
}

test("a question reads a kept snapshot only when it is pinned to an earlier month that the index lists", () => {
  assert.equal(keptMonth(pinned("2026-10"), served, index), "2026-10");
  assert.equal(keptMonth(pinned("2026-09"), served, index), "2026-09");
  assert.equal(keptMonth(read(ranking), served, index), undefined, "not pinned");
  assert.equal(keptMonth(pinned("2026-11"), served, index), undefined, "the month served is read from the data folder itself");
  assert.equal(keptMonth(pinned("2026-12"), served, index), undefined, "ahead of the data");
  assert.equal(keptMonth(pinned("2026-08"), served, index), undefined, "earlier, but not in the index");
  assert.equal(keptMonth(pinned("2026-10"), served, null), undefined, "no readable index");
  assert.equal(keptMonth(pinned("2026-10"), served, readIndex({ snapshots: [] })), undefined, "an empty index");
  // An index that lists the month served, or a later one, is not believed: the newest is never read from a folder.
  const odd = readIndex({ snapshots: [{ month: "2026-11", snapshot: "2026-11-30" }, { month: "2026-12", snapshot: "2026-12-31" }] });
  assert.equal(keptMonth(pinned("2026-11"), served, odd), undefined);
  assert.equal(keptMonth(pinned("2026-12"), served, odd), undefined);
});

test("which folder a question reads from, in each case, and what is asked to decide it", async () => {
  // Not pinned, or pinned to the snapshot served or ahead: the newest, and nothing is asked.
  for (const q of [read(ranking), pinned("2026-11"), pinned("2026-12")]) {
    const l = loaders();
    assert.deepEqual(await readingFor(q, served, l.load, ownerSet), { kind: "served" });
    assert.deepEqual(l.calls, []);
  }
  // Pinned to a kept month: that folder; its manifest and the values chosen are checked against it.
  const l = loaders();
  const reading = await readingFor(pinned("2026-10"), served, l.load, ownerSet);
  assert.equal(reading.kind, "kept");
  assert.equal(reading.kind === "kept" && reading.month, "2026-10");
  assert.equal(reading.kind === "kept" && reading.manifest, kept);
  assert.deepEqual(l.calls, ["index", "manifest 2026-10", `slice ${dataset}/${long} 2026-10`]);
  // Earlier and not kept; no index; an index that cannot be read: the newest, exactly as before.
  assert.deepEqual(await readingFor(pinned("2026-08"), served, loaders().load, ownerSet), { kind: "served" });
  assert.deepEqual(await readingFor(pinned("2026-10"), served, loaders({ index: null }).load, ownerSet), { kind: "served" });
  // Kept in the index but the folder cannot be read: not kept, and no claim is made.
  assert.deepEqual(await readingFor(pinned("2026-10"), served, loaders({ manifests: {} }).load, ownerSet), { kind: "served" });
});

test("a kept snapshot that did not build the dataset, or does not have the field live, cannot answer: the newest is shown and it is said", async () => {
  const second = vocabulary.datasets[1]?.dataset as string;
  assert.ok(second, "the build needs a second dataset");
  const without = manifestOf("2026-10-31", (id, e) => (id === second ? { not_built: "not built in this snapshot" } : e));
  const q = read(`build.dataset=${second}&${ranking}&build.snapshot=2026-10`);
  const unbuilt = await readingFor(q, served, loaders({ manifests: { "2026-10": without } }).load, ownerSet);
  assert.equal(unbuilt.kind === "withheld" && unbuilt.why, "missing");
  const notLive = manifestOf("2026-10-31", (_id, e) => ({ ...e, live_dimensions: (e.live_dimensions as string[]).filter((d) => d !== long) }));
  const dim = await readingFor(pinned("2026-10"), served, loaders({ manifests: { "2026-10": notLive } }).load, ownerSet);
  assert.equal(dim.kind === "withheld" && dim.why, "missing");
  assert.equal(holds(pinned("2026-10"), notLive, ownerSet), "no");
  assert.equal(holds(pinned("2026-10"), kept, ownerSet), "yes");
});

test("a value the kept snapshot does not hold cannot be drawn from it, and a table that cannot be fetched makes no claim", async () => {
  const none = await readingFor(pinned("2026-10"), served, loaders({ held: ["a"] }).load, ownerSet);
  assert.equal(none.kind === "withheld" && none.why, "missing");
  assert.equal((await readingFor(pinned("2026-10"), served, loaders({ held: ["a", "b"] }).load, ownerSet)).kind, "kept");
  // A table that cannot be fetched says nothing about what the snapshot holds: no claim, and the newest is shown as D-125 shows it.
  assert.deepEqual(await readingFor(pinned("2026-10"), served, loaders({ sliceFails: true }).load, ownerSet), { kind: "served" });
  assert.equal(hasValues([{ value: "a" }, { value: "b" }], ["a", "b"]), true);
  assert.equal(hasValues([{ value: "a" }], ["a", "b"]), false);
  assert.equal(hasValues([], []), true);
});

test("a question the newest snapshot cannot draw either is not blamed on the kept one", async () => {
  const second = vocabulary.datasets[1]?.dataset as string;
  const unbuilt = (id: string, e: Record<string, unknown>) => (id === second ? { not_built: "x" } : e);
  const q = read(`build.dataset=${second}&${ranking}&build.snapshot=2026-10`);
  const reading = await readingFor(q, manifestOf("2026-11-30", unbuilt), loaders({ manifests: { "2026-10": manifestOf("2026-10-31", unbuilt) } }).load, ownerSet);
  assert.deepEqual(reading, { kind: "served" });
});

test("a field that describes the owner is read from a kept snapshot only where that snapshot says its small cells were hidden", async () => {
  assert.ok(owner, "the data map needs a field that describes the owner, with a dimension read from it");
  assert.equal(ownerSet.has(long), false);
  assert.equal(ownerSliceReady(kept, dataset, long, ownerSet), true, "a field that is not the owner's needs nothing");
  assert.equal(ownerSliceReady(kept, dataset, owner, ownerSet), false, "a snapshot that does not say the rule was applied");
  const says = (dimensionList: string[]) =>
    manifestOf("2026-10-31", (_id, e) => ({ ...e, [SMALL_CELL_KEY]: Object.fromEntries(dimensionList.map((d) => [d, { minimum: 10 }])) }));
  assert.equal(ownerSliceReady(says([owner]), dataset, owner, ownerSet), true);
  assert.equal(ownerSliceReady(says([long]), dataset, owner, ownerSet), false, "it says so of another field only");
  assert.equal(ownerSliceReady(says([]), dataset, owner, ownerSet), false);
  assert.equal(ownerSliceReady(manifestOf("2026-10-31", (_id, e) => ({ ...e, [SMALL_CELL_KEY]: owner })), dataset, owner, ownerSet), false, "the wrong shape says nothing");
  assert.equal(ownerSliceReady(manifestOf("2026-10-31", (_id, e) => ({ ...e, [SMALL_CELL_KEY]: [owner] })), dataset, owner, ownerSet), false, "a list is the wrong shape too");
  // An entry under the dimension's key that is not a block (null, false, a number, a list, text) does not say the rule was applied.
  for (const entry of [null, false, true, 0, 10, "applied", [], [10]]) {
    assert.equal(ownerSliceReady(manifestOf("2026-10-31", (_id, e) => ({ ...e, [SMALL_CELL_KEY]: { [owner]: entry } })), dataset, owner, ownerSet), false, JSON.stringify(entry));
  }

  const byOwner = `build.measure=count&build.by=${owner}&build.view=league&build.snapshot=2026-10`;
  const withheld = await readingFor(read(byOwner), served, loaders().load, ownerSet);
  assert.equal(withheld.kind === "withheld" && withheld.why, "owner");
  // A snapshot that says the rule was applied lists the field under small_cells, and a table that hides small counts is not drawn yet (D-130): the
  // question is blocked against that manifest, so it is withheld as one the snapshot cannot answer. Once a hidden cell can be drawn, this is "kept".
  const allowed = await readingFor(read(byOwner), served, loaders({ manifests: { "2026-10": says([owner]) } }).load, ownerSet);
  assert.equal(allowed.kind === "withheld" && allowed.why, "missing");
  // The same field as a condition on a question that breaks down by another.
  const asCondition = read(`${ranking}&build.where.${owner}=x&build.snapshot=2026-10`);
  assert.equal(asCondition.where[owner]?.[0], "x", "the question carries the condition");
  assert.equal((await readingFor(asCondition, served, loaders().load, ownerSet)).kind, "withheld");
});

test("the line above the chart says which snapshot the figures are from, and never claims figures it does not show", async () => {
  const q = pinned("2026-10");
  const l = loaders();
  const keptReading = await readingFor(q, served, l.load, ownerSet);
  assert.equal(pinLine(q, served, keptReading)?.kind, "kept");
  assert.equal(pinLine(q, served, keptReading)?.text, "Pinned to Oct 2026. These are the figures of the snapshot of 31 October 2026, kept on this site.");

  const missing = await readingFor(q, served, loaders({ held: ["a"] }).load, ownerSet);
  const line = pinLine(q, served, missing);
  assert.equal(line?.kind, "withheld");
  assert.equal(
    line?.text,
    "The snapshot of 31 October 2026 that this link is pinned to cannot answer this question. Pinned to Oct 2026. The figures come from the newer snapshot of 30 November 2026, so they may differ from those seen when it was pinned.",
  );

  const byOwner = read(`build.measure=count&build.by=${owner}&build.view=league&build.snapshot=2026-10`);
  const withheld = await readingFor(byOwner, served, loaders().load, ownerSet);
  // Followed by the line the newest snapshot gets, whatever that is for this chart.
  assert.equal(
    pinLine(byOwner, served, withheld)?.text,
    `The snapshot of 31 October 2026 that this link is pinned to does not say that small counts were hidden in the fields this question names, so its figures for this question are not shown. ${pinNote(byOwner, served)?.text}`,
  );

  // Not kept: the line D-125 gives, word for word. Not pinned: none.
  const notKept = pinned("2026-08");
  assert.deepEqual(pinLine(notKept, served, { kind: "served" }), pinNote(notKept, served));
  assert.equal(pinLine(read(ranking), served, { kind: "served" }), undefined);
});

test("a kept snapshot whose dataset ends before it says so, as a pin on the newest does, and does not say the figures are the full month's", async () => {
  const second = vocabulary.datasets[1]?.dataset as string;
  const behind = manifestOf("2026-10-31", (id, e) => (id === second ? { ...e, latest_month: "2026-09", supplied: { months: { first: "2021-01" } } } : e));
  const q = read(`build.dataset=${second}&${ranking}&build.snapshot=2026-10`);
  const reading = await readingFor(q, served, loaders({ manifests: { "2026-10": behind } }).load, ownerSet);
  assert.equal(reading.kind, "kept");
  assert.equal(
    pinLine(q, served, reading)?.text,
    "Pinned to Oct 2026, which this chart has no figures for, so it shows the newest month, Sept 2026, of the snapshot of 31 October 2026.",
  );
});

test("the new sentences fill with nothing left over", async () => {
  const notices = (await import("../../src/lib/config.ts")).builderSpec.notices;
  for (const key of ["pin_kept", "pin_kept_missing", "pin_kept_withheld"] as const) {
    assert.deepEqual(fillTemplate(notices[key], { pinned: "2026-10", date: "2026-10-31" }).unresolved, [], key);
  }
});

test("the dimensions that read an owner field come from the data map and the dimensions' derive blocks, with no field named in code", () => {
  const map = { owner_groups: ["who"], fields: [
    { bound: "own", privacy: "owner_restricted" },
    { bound: "grouped", group: "who", privacy: "public" },
    { bound: "plain", group: "vehicle", privacy: "public" },
    { bound: null, privacy: "owner_restricted" },
  ] };
  const dims = [
    { id: "own" },
    { id: "by_lookup", derive: { kind: "lookup", field: "own", reference: "x.csv" } },
    { id: "by_group", derive: { kind: "copy", from: { field: "grouped" } } },
    { id: "vehicle_thing", derive: { kind: "lookup", field: "plain" } },
    { id: "unrelated", derive: { kind: "series" } },
  ];
  assert.deepEqual(ownerDimensions(map, dims), ["own", "by_lookup", "by_group"]);
  assert.deepEqual(ownerDimensions({ owner_groups: [], fields: [] }, dims), []);
  // The real map and the real dimensions: at least one dimension reads an owner field, and the vocabulary carries the same list.
  const real = ownerDimensions(dataMap, dimensions);
  assert.ok(real.length >= 1);
  assert.deepEqual(real, vocabulary.owner);
});

test("what a kept snapshot is asked about is what the chart reads: no question Build offers reads a second dataset, a pair or a narrowed table that `asks` does not list", async () => {
  // `asks` (src/lib/kept.ts) lists the chart's own dataset and the fields it names. A measure that divides one dataset by another, or a dataset that is
  // another one narrowed through a pair, reads more than that. Build offers none today; the day it does, this fails, and `asks` must list what is read.
  const { buildQuestions } = await import("./support/observe.ts");
  const { builderPresets } = await import("../../src/lib/builder.ts");
  const { resolvePreset } = await import("../../src/lib/resolve.ts");
  let checked = 0;
  for (const { key, question } of buildQuestions()) {
    for (const preset of builderPresets(question)) {
      const { companion, source } = resolvePreset(preset, everything);
      assert.equal(companion, undefined, `${key} reads a second dataset`);
      assert.equal(source?.filter, undefined, `${key} reads a pair that narrows it`);
      assert.equal(source?.cross?.pair, undefined, `${key} reads a pair`);
      checked++;
    }
  }
  assert.ok(checked > 20, "the test looked at the questions Build offers");
});

test("the deploy script's list of owner dimensions and its manifest key are the page's: the same files, the same rule, so the two cannot drift", async () => {
  const script = await import("../../scripts/kept-snapshots.mjs");
  assert.deepEqual(script.realOwnerDimensions(), ownerDimensions(dataMap, dimensions));
  assert.deepEqual(script.realOwnerDimensions(), vocabulary.owner);
  assert.equal(script.SMALL_CELL_KEY, SMALL_CELL_KEY);
  // And on a map that uses each way a field can be an owner's (its class, its group) and each way a dimension can read one (its id, a lookup, a nested derive).
  const map = { owner_groups: ["who"], fields: [{ bound: "own", privacy: "owner_restricted" }, { bound: "grouped", group: "who", privacy: "public" }, { bound: "plain", group: "vehicle", privacy: "public" }, { bound: null, privacy: "owner_restricted" }] };
  const dims = [{ id: "own" }, { id: "by_lookup", derive: { kind: "lookup", field: "own" } }, { id: "by_group", derive: { kind: "copy", from: { field: "grouped" } } }, { id: "vehicle_thing", derive: { field: "plain" } }];
  assert.deepEqual(script.ownerDimensionIds(map, dims), ownerDimensions(map, dims));
  assert.deepEqual(script.ownerDimensionIds(map, dims), ["own", "by_lookup", "by_group"]);
});

test("the suggestions under a picker are counted in the kept snapshot where it can give them, and in the newest's where it cannot (the owner field, a field not live in it)", () => {
  const reading = { kind: "kept" as const, month: "2026-10", manifest: kept };
  assert.equal(pickerMonth(reading, dataset, long, {}, ownerSet), "2026-10", "a field the kept snapshot has: its month");
  for (const not of [{ kind: "served" as const }, { kind: "withheld" as const, month: "2026-10", manifest: kept, why: "missing" as const }, undefined]) {
    assert.equal(pickerMonth(not, dataset, long, {}, ownerSet), undefined, JSON.stringify(not?.kind));
  }
  // A condition picker opened with no value is not in the question, so `asks` never named its field: the picker checks it itself.
  assert.equal(pickerMonth(reading, dataset, owner, {}, ownerSet), undefined, "an owner field the kept snapshot does not cover");
  const covers = manifestOf("2026-10-31", (_id, e) => ({ ...e, [SMALL_CELL_KEY]: { [owner]: { minimum: 10 } } }));
  assert.equal(pickerMonth({ ...reading, manifest: covers }, dataset, owner, {}, ownerSet), "2026-10", "and one it does");
  // Counted among conditions: each must be carried by the kept snapshot's fact table, and no owner one may be uncovered.
  assert.equal(pickerMonth(reading, dataset, long, { [owner]: ["x"] }, ownerSet), undefined);
  assert.equal(pickerMonth(reading, dataset, long, { [owner]: [] }, ownerSet), "2026-10", "a condition with no value keeps every vehicle and is not read");
  const lacking = manifestOf("2026-10-31", (_id, e) => ({ ...e, live_dimensions: (e.live_dimensions as string[]).filter((d) => d !== long) }));
  assert.equal(pickerMonth({ ...reading, manifest: lacking }, dataset, long, {}, ownerSet), undefined, "a field not live in the kept snapshot");
  const noFacts = manifestOf("2026-10-31", (_id, e) => ({ ...e, facts: { dimensions: [] } }));
  assert.equal(pickerMonth({ ...reading, manifest: noFacts }, dataset, long, { [long]: ["x"] }, ownerSet), undefined, "a condition its fact table does not carry");
});

test("every list of values on the Build page is asked of the snapshot the question reads from", () => {
  const source = readFileSync(new URL("../../src/components/QuestionBuilder.tsx", import.meta.url), "utf8");
  const count = (text: string) => source.split(text).length - 1;
  const pickers = count("<ValuePicker");
  assert.equal(pickers, 3, "the page has three lists of values; if that changed, this test must follow");
  assert.equal(count("snapshot={pickAt("), pickers, "each picker is given its snapshot");
  assert.ok(source.includes("valueOptions(dataset, dimension, JSON.parse(whereKey), snapshot)"), "the picker's list is read from it");
  assert.ok(source.includes("[dataset, dimension, whereKey, snapshot]"), "and read again when it changes");
});
