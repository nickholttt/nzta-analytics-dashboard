// My questions (src/lib/saved.ts, D-125): what is kept in the browser, how it is read back, and what a saved question does when the data moves on.
// A saved question is a Build link, so these go through the real readQuestion, settle and builderPresets. Storage is a stand-in with the
// two methods the module uses. No field or value is named; they come from config or are made up.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { everythingBuilt } from "./support/observe.ts";

const { builderVocabulary, builderPresets, readQuestion, settle, questionParams } = await import("../../src/lib/builder.ts");
const { dimensions } = await import("../../src/lib/config.ts");
const { heldEnd } = await import("../../src/lib/pin.ts");
const { latestMonthOf } = await import("../../src/lib/resolve.ts");
const saved = await import("../../src/lib/saved.ts");

const everything = everythingBuilt();
const vocabulary = builderVocabulary(everything);
const long = dimensions.find((d) => d.kind === "category" && d.cardinality === "high")?.id as string;
const manifestWith = (latest: string) =>
  ({ ...everything, latest_snapshot: `${latest}-28`, datasets: Object.fromEntries(Object.entries(everything.datasets).map(([id, d]) => [id, { ...d, latest_month: latest }])) }) as typeof everything;

const entry = (over: Partial<import("../../src/lib/saved.ts").Saved> = {}) => ({ id: "a1", name: "A question", query: `build.measure=count&build.by=${long}`, saved: "2026-11-17T01:02:03.000Z", ...over });
const storeOf = (text: string | null, over: object = {}) => ({ getItem: () => text, setItem: () => undefined, ...over });
const listOf = (...items: object[]) => JSON.stringify({ v: 1, items });

test("what is stored comes back as it went in", () => {
  const written: Record<string, string> = {};
  const store = { getItem: (k: string) => written[k] ?? null, setItem: (k: string, v: string) => void (written[k] = v) };
  const items = [entry(), entry({ id: "b2", name: "Another", query: `build.measure=share&build.by=${long}&build.snapshot=2026-10`, pinned_on: "2026-10-31" })];
  assert.equal(saved.persist(store, items), true);
  assert.deepEqual(saved.load(store), { state: "ok", items, unreadable: 0 });
});

test("nothing stored is an empty list, which is not the same as a list that cannot be read", () => {
  assert.deepEqual(saved.load(storeOf(null)), { state: "ok", items: [], unreadable: 0 });
  assert.deepEqual(saved.load(storeOf(listOf())), { state: "ok", items: [], unreadable: 0 });
});

test("storage the browser blocks leaves an unavailable list, and nothing throws", () => {
  assert.equal(saved.load(null).state, "unavailable");
  assert.equal(saved.load(storeOf(null, { getItem: () => { throw new Error("denied"); } })).state, "unavailable");
  assert.equal(saved.persist(null, [entry()]), false);
  assert.equal(saved.persist(storeOf(null, { setItem: () => { throw new Error("full"); } }), [entry()]), false);
});

test("a stored value that is not the list is dropped and counted", () => {
  for (const text of ["not json", "{", "[]", '{"v":2,"items":[]}', '{"v":1}', '{"v":1,"items":"x"}', "null", "7"]) {
    assert.deepEqual(saved.load(storeOf(text)), { state: "ok", items: [], unreadable: 1 }, text);
  }
});

test("an entry that cannot be read is dropped and counted, and the others are kept", () => {
  const good = entry();
  const loaded = saved.load(
    storeOf(
      listOf(
        good,
        null,
        7,
        "x",
        { ...entry({ id: "n1" }), name: "" },
        { ...entry({ id: "n2" }), name: 4 },
        { ...entry({ id: "q1" }), query: 4 },
        { ...entry({ id: "q2" }), query: "unrelated=1" },
        { ...entry({ id: "q3" }), query: "x".repeat(5000) },
        { ...entry({ id: "t1" }), saved: "yesterday" },
        { ...entry({ id: "i1" }), id: "" },
        { ...entry({ id: "a1" }), name: "same id twice" },
      ),
    ),
  );
  assert.deepEqual(loaded.items, [good]);
  assert.equal(loaded.unreadable, 11);
});

test("a stored link keeps Build's own parameters and nothing else", () => {
  const loaded = saved.load(storeOf(listOf(entry({ query: `evil=1&build.measure=count&build.by=${long}&build.month=2026-08&other.x=2` }))));
  assert.equal(loaded.items[0].query, `build.measure=count&build.by=${long}`);
});

test("a name is trimmed and cut, and a pinned date that is not a date is not kept", () => {
  const loaded = saved.load(storeOf(listOf(entry({ name: `  ${"n".repeat(300)}  `, pinned_on: "tomorrow" }))));
  assert.equal(loaded.items[0].name.length, saved.MAX_NAME);
  assert.equal("pinned_on" in loaded.items[0], false);
});

test("a question saved from the address keeps its settings but not the month a ranking was looked at in", () => {
  const query = saved.questionQuery(`?build.measure=count&build.by=${long}&build.period=1y&build.month=2026-08&other=1#x`);
  assert.equal(query, `build.measure=count&build.by=${long}&build.period=1y`);
  assert.equal(saved.questionQuery("?other=1"), undefined);
  assert.equal(saved.questionQuery(""), undefined);
});

test("saving the same question twice keeps one entry; a full list says so", () => {
  const first = saved.add([], entry());
  assert.equal(first.result, "added");
  const again = saved.add(first.items, entry({ id: "z9", name: "Renamed copy" }));
  assert.equal(again.result, "exists");
  assert.equal(again.items.length, 1);
  assert.equal(again.entry?.name, "A question");
  const many = Array.from({ length: saved.MAX_SAVED }, (_, i) => entry({ id: `i${i}`, query: `build.measure=count&build.by=${long}&build.value=v${i}` }));
  assert.equal(saved.add(many, entry({ id: "late" })).result, "full");
});

test("rename and remove change one entry; a blank name changes nothing", () => {
  const items = [entry(), entry({ id: "b2", query: `build.measure=share&build.by=${long}` })];
  assert.equal(saved.rename(items, "b2", "  New name ")[1].name, "New name");
  assert.equal(saved.rename(items, "b2", "   ")[1].name, "A question");
  assert.deepEqual(saved.remove(items, "a1").map((i) => i.id), ["b2"]);
});

test("pinning a saved question adds the snapshot to its link and the date it was pinned on, and unpinning takes both away", () => {
  const items = [entry({ query: `build.measure=count&build.by=${long}&build.view=league` })];
  const pinned = saved.pinEntry(items, "a1", { month: "2026-10", date: "2026-10-31" });
  assert.equal(new URLSearchParams(pinned[0].query).get("build.snapshot"), "2026-10");
  assert.equal(pinned[0].pinned_on, "2026-10-31");
  assert.equal(settle(vocabulary, readQuestion(`?${pinned[0].query}`)).snapshot, "2026-10");
  const loose = saved.pinEntry(pinned, "a1", null);
  assert.equal(loose[0].query, items[0].query);
  assert.equal("pinned_on" in loose[0], false);
});

test("the list is exported as plain text, a name and a link each, in the order listed", () => {
  const items = [entry(), entry({ id: "b2", name: "Second", query: "build.measure=share&build.by=x" })];
  assert.equal(saved.exportLinks(items, "https://example.test"), `A question\nhttps://example.test/build?build.measure=count&build.by=${long}\n\nSecond\nhttps://example.test/build?build.measure=share&build.by=x`);
  assert.equal(saved.exportLinks([], "https://example.test"), "");
});

test("a saved link goes through the same validation as any link: what the data cannot answer falls back", () => {
  const q = settle(vocabulary, readQuestion(`?${saved.hrefOf(entry({ query: "build.measure=no_such_measure&build.by=no_such_field" })).split("?")[1]}`));
  assert.ok(vocabulary.datasets[0].measures.some((m) => m.id === q.measure), "the measure is one the page offers");
});

test("a saved question that is not pinned redraws on the newest month; a pinned one keeps its window", () => {
  // The visitor was looking at a ranking ending in an earlier month when they saved it: the month is not kept.
  const query = saved.questionQuery(`?build.measure=count&build.by=${long}&build.value=a&build.value=b&build.view=league&build.month=2026-08`) as string;
  const open = (query: string) => builderPresets(settle(vocabulary, readQuestion(`?${query}`)))[0];
  const loose = open(query);
  const pinned = open(saved.pinEntry([entry({ query })], "a1", { month: "2026-10", date: "2026-10-31" })[0].query);
  const endsIn = (preset: typeof loose, latest: string) => heldEnd(preset.through, latestMonthOf(preset, manifestWith(latest))) ?? latestMonthOf(preset, manifestWith(latest));
  // The same stored question, opened before and after a new month arrives.
  assert.equal(endsIn(loose, "2026-10"), "2026-10");
  assert.equal(endsIn(loose, "2026-11"), "2026-11", "no work from the visitor: it ends in the new newest month");
  assert.equal(endsIn(pinned, "2026-10"), "2026-10");
  assert.equal(endsIn(pinned, "2026-11"), "2026-10", "the pin keeps its month");
  assert.equal(loose.through, undefined);
  assert.equal(questionParams(settle(vocabulary, readQuestion(`?${query}`))).has("build.month"), false);
});
