// The questions a visitor saved on the Build page are carried into My canvases once (src/lib/savedCanvases.ts, carryQuestionsOver): each as
// the canvas of the chart or charts the question drew, keeping its name and its pin, and nothing the visitor saved is lost. Storage is a stand-in
// with the two methods the module uses. Run with Node's own test runner:
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { everythingBuilt } from "./support/observe.ts";

const builder = await import("../../src/lib/builder.ts");
const canvas = await import("../../src/lib/canvas.ts");
const { dimensions } = await import("../../src/lib/config.ts");
const { buildLinkRules } = await import("../../src/lib/buildLinkRules.ts");
const saved = await import("../../src/lib/saved.ts");
const kept = await import("../../src/lib/savedCanvases.ts");

const manifest = everythingBuilt();
const all = canvas.canvasVocabulary(builder.builderVocabulary(manifest));
const rules = buildLinkRules();
const field = dimensions.find((d) => d.kind === "category" && d.cardinality === "high")?.id as string;
const parts = rules.parts[Object.keys(rules.parts)[0]];

// A browser's storage that keeps what it is given; the lists it holds can be read as text.
const memory = (start: Record<string, string> = {}, fail: (key: string) => boolean = () => false) => {
  const held = new Map(Object.entries(start));
  return {
    held,
    getItem: (k: string) => held.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (fail(k)) throw new Error("full");
      held.set(k, v);
    },
  };
};
const question = (over: Partial<import("../../src/lib/saved.ts").Saved> = {}) => ({ id: "q1", name: "A question", query: `build.measure=count&build.by=${field}`, saved: "2026-11-17T01:02:03.000Z", ...over });
const listOf = (...items: object[]) => JSON.stringify({ v: 1, items });
const withQuestions = (...items: object[]) => memory({ [saved.STORAGE_KEY]: listOf(...items) });
const canvasesIn = (store: ReturnType<typeof memory>) => saved.load(store, kept.CANVASES).items;

test("a saved question becomes a canvas of its chart, with its name, the day it was saved and its pin", () => {
  const store = withQuestions(
    question(),
    question({ id: "q2", name: "Pinned one", query: `build.measure=share&build.by=${field}&build.snapshot=2026-10`, saved: "2026-11-18T00:00:00.000Z" }),
  );
  assert.equal(kept.carryQuestionsOver(store, rules), 2);
  const [first, second] = canvasesIn(store);
  assert.deepEqual([first.id, first.name, first.saved], ["q1", "A question", "2026-11-17T01:02:03.000Z"]);
  assert.deepEqual([second.id, second.name, second.saved], ["q2", "Pinned one", "2026-11-18T00:00:00.000Z"]);
  // Each opens as the chart the question drew, and the pin is the canvas's pin.
  const open = (item: { query: string }) => canvas.settleCanvas(all, canvas.readCanvas(`?${item.query}`)).charts;
  const was = (q: { query: string }) => builder.settle(builder.builderVocabulary(manifest), builder.readQuestion(`?${q.query}`));
  assert.equal(open(first).length, 1);
  assert.deepEqual(open(first)[0].question, { ...was(question()), view: null });
  assert.equal(kept.savedPin(first.query), undefined);
  assert.equal(kept.savedPin(second.query), "2026-10");
  assert.equal(open(second)[0].question.snapshot, "2026-10");
});

test("a question that was two charts becomes a canvas of two, as the page drew it", () => {
  const store = withQuestions(question({ query: `build.measure=${Object.keys(rules.parts)[0]}&build.by=${field}` }));
  assert.equal(kept.carryQuestionsOver(store, rules), 1);
  const charts = canvas.settleCanvas(all, canvas.readCanvas(`?${canvasesIn(store)[0].query}`)).charts;
  assert.deepEqual(charts.map((c) => c.question.measure), parts);
});

test("carrying over is done once: a second visit adds nothing, and a canvas the visitor removed does not come back", () => {
  const store = withQuestions(question(), question({ id: "q2", query: `build.measure=share&build.by=${field}` }));
  assert.equal(kept.carryQuestionsOver(store, rules), 2);
  const once = store.held.get(kept.CANVASES.key);
  assert.equal(kept.carryQuestionsOver(store, rules), 0);
  assert.equal(store.held.get(kept.CANVASES.key), once);
  // The visitor removes one, and renames another: neither is undone.
  const [a, b] = canvasesIn(store);
  saved.persist(store, [{ ...b, name: "Mine" }], kept.CANVASES);
  assert.equal(kept.carryQuestionsOver(store, rules), 0);
  assert.deepEqual(canvasesIn(store).map((i) => [i.id, i.name]), [[b.id, "Mine"]]);
  assert.notEqual(a.id, b.id);
});

test("what was saved is never deleted: the old list is as it was after carrying over, and again after the visitor clears the canvases", () => {
  const store = withQuestions(question(), question({ id: "q2", query: `build.measure=share&build.by=${field}` }));
  const before = store.held.get(saved.STORAGE_KEY);
  kept.carryQuestionsOver(store, rules);
  assert.equal(store.held.get(saved.STORAGE_KEY), before);
  saved.persist(store, [], kept.CANVASES);
  kept.carryQuestionsOver(store, rules);
  assert.equal(store.held.get(saved.STORAGE_KEY), before);
});

test("an entry that cannot be read is skipped and the others are carried; it stays in the old list", () => {
  const text = listOf(question({ id: "ok1" }), null, 7, { ...question({ id: "bad1" }), name: "" }, { ...question({ id: "bad2" }), query: "unrelated=1" }, question({ id: "ok2", query: `build.measure=share&build.by=${field}` }));
  const store = memory({ [saved.STORAGE_KEY]: text });
  assert.equal(kept.carryQuestionsOver(store, rules), 2);
  assert.deepEqual(canvasesIn(store).map((i) => i.id), ["ok1", "ok2"]);
  assert.equal(store.held.get(saved.STORAGE_KEY), text);
  // Text that is not a list at all is nothing to carry, and nothing throws.
  for (const bad of ["not json", "{", "null", '{"v":2,"items":[]}']) assert.equal(kept.carryQuestionsOver(memory({ [saved.STORAGE_KEY]: bad }), rules), 0, bad);
});

test("canvases the visitor already has stay first, and a question already saved as that canvas is not listed twice", () => {
  const store = withQuestions(question());
  kept.carryQuestionsOver(store, rules);
  const [carried] = canvasesIn(store);
  const mine = { id: "mine", name: "Mine", query: kept.canvasQuery("?canvas.charts=c1&c1.measure=share") as string, saved: "2026-11-20T00:00:00.000Z" };
  const other = memory({ [saved.STORAGE_KEY]: listOf(question(), question({ id: "q2", name: "Another", query: `build.measure=share&build.by=${field}` })) });
  saved.persist(other, [mine, { ...carried, id: "same-chart", name: "Saved as a canvas" }], kept.CANVASES);
  assert.equal(kept.carryQuestionsOver(other, rules), 1);
  assert.deepEqual(canvasesIn(other).map((i) => i.name), ["Mine", "Saved as a canvas", "Another"]);
});

test("a full list takes what fits, and the rest wait for room", () => {
  const room = 2;
  const filled = Array.from({ length: saved.MAX_SAVED - room }, (_, i) => ({ id: `c${i}`, name: `Canvas ${i}`, query: kept.canvasQuery(`?canvas.charts=c1&c1.measure=count&c1.by=${field}&c1.value=v${i}`) as string, saved: "2026-11-20T00:00:00.000Z" }));
  const store = withQuestions(...Array.from({ length: 4 }, (_, i) => question({ id: `q${i}`, query: `build.measure=share&build.by=${field}&build.value=w${i}` })));
  saved.persist(store, filled, kept.CANVASES);
  assert.equal(kept.carryQuestionsOver(store, rules), room);
  assert.equal(canvasesIn(store).length, saved.MAX_SAVED);
  assert.equal(kept.carryQuestionsOver(store, rules), 0);
  // Room made, the next ones come.
  saved.persist(store, canvasesIn(store).slice(0, saved.MAX_SAVED - 1), kept.CANVASES);
  assert.equal(kept.carryQuestionsOver(store, rules), 1);
  assert.deepEqual(canvasesIn(store).slice(-1).map((i) => i.id), ["q2"]);
});

test("a browser that will not give or take the lists leaves them alone, and nothing throws", () => {
  assert.equal(kept.carryQuestionsOver(null, rules), 0);
  assert.equal(kept.carryQuestionsOver(undefined, rules), 0);
  const refuses = { getItem: () => { throw new Error("denied"); }, setItem: () => undefined };
  assert.equal(kept.carryQuestionsOver(refuses, rules), 0);
  // The canvases cannot be kept: nothing is written, and the next visit tries again.
  const full = memory({ [saved.STORAGE_KEY]: listOf(question()) }, (key) => key === kept.CANVASES.key);
  assert.equal(kept.carryQuestionsOver(full, rules), 0);
  assert.equal(full.held.has("nzta.my_questions_carried"), false);
  full.setItem = (k: string, v: string) => void full.held.set(k, v);
  assert.equal(kept.carryQuestionsOver(full, rules), 1);
  // The record cannot be kept: the canvases are, and the next visit adds none of them again.
  const noRecord = memory({ [saved.STORAGE_KEY]: listOf(question()) }, (key) => key !== kept.CANVASES.key);
  assert.equal(kept.carryQuestionsOver(noRecord, rules), 1);
  assert.equal(kept.carryQuestionsOver(noRecord, rules), 0);
  assert.equal(canvasesIn(noRecord).length, 1);
});
