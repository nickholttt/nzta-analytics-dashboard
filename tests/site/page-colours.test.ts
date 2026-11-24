import "./support/register.mjs";
// The canvas's own logic for colour: a value keeps one colour across the charts of a page (src/lib/pageColours.ts). Only which slot a value gets
// is tested, never what the slot looks like.
import assert from "node:assert/strict";
import test from "node:test";
const { assignPageColours, registrationsInPageOrder } = await import("../../src/lib/pageColours.ts");
import type { PageChart } from "../../src/lib/pageColours.ts";

const chart = (id: string, field: string, values: string[]): PageChart => ({ chart: id, field, values });
const entries = (m: Map<string, number> | undefined) => [...(m ?? new Map())];

test("a value has the same slot on every chart it is on, however it ranks there", () => {
  const out = assignPageColours([chart("c1", "f", ["a", "b", "c"]), chart("c2", "f", ["c", "a", "d"]), chart("c3", "f", ["d", "b"])]);
  for (const value of ["a", "b", "c", "d"]) {
    const seen = ["c1", "c2", "c3"].map((c) => out.get(c)?.get(value)).filter((s) => s !== undefined);
    assert.equal(new Set(seen).size, 1, `${value} on ${seen.length} charts`);
  }
});

test("no two values on one chart share a slot", () => {
  const charts = [chart("c1", "f", ["a", "b", "c", "d"]), chart("c2", "f", ["e", "c", "a"]), chart("c3", "f", ["b", "e", "f", "a"])];
  const out = assignPageColours(charts);
  for (const { chart: id } of charts) {
    const slots = [...(out.get(id) ?? new Map()).values()];
    assert.equal(new Set(slots).size, slots.length, id);
  }
});

test("values that never meet may share a slot, and the first chart's values take the lowest", () => {
  const out = assignPageColours([chart("c1", "f", ["a", "b"]), chart("c2", "f", ["c", "d"])]);
  assert.deepEqual(entries(out.get("c1")), [["a", 0], ["b", 1]]);
  assert.deepEqual(entries(out.get("c2")), [["c", 0], ["d", 1]]);
});

test("different fields do not constrain each other, and the same text in two fields is two values", () => {
  const out = assignPageColours([chart("c1", "f", ["a", "b"]), chart("c2", "g", ["a", "b"]), chart("c3", "f", ["b", "a"])]);
  assert.deepEqual(entries(out.get("c2")), [["a", 0], ["b", 1]]);
  assert.equal(out.get("c3")?.get("a"), out.get("c1")?.get("a"));
  assert.equal(out.get("c3")?.get("b"), out.get("c1")?.get("b"));
});

test("a value with no slot free page-wide takes the lowest free on each chart, and is left out where there is none", () => {
  // Four slots. a to d meet on c1. e meets a, b and c on c2 and d on c3, so across the page it meets four values that hold all four slots.
  const charts = [chart("c1", "f", ["a", "b", "c", "d"]), chart("c2", "f", ["e", "a", "b", "c"]), chart("c3", "f", ["d", "e"]), chart("c4", "f", ["a", "b", "c", "d", "e"])];
  const out = assignPageColours(charts, 4);
  assert.deepEqual(entries(out.get("c1")), [["a", 0], ["b", 1], ["c", 2], ["d", 3]]);
  // On c2 a, b and c hold slots 0 to 2: e takes the one left, which is d's colour on the other charts.
  assert.equal(out.get("c2")?.get("e"), 3);
  // On c3 d holds slot 3: e takes the lowest free.
  assert.equal(out.get("c3")?.get("e"), 0);
  // c4 holds five values for four slots: the fifth is left out, to be drawn in grey, and no slot is used twice.
  const c4 = out.get("c4") ?? new Map();
  assert.equal(c4.size, 4);
  assert.equal(new Set(c4.values()).size, 4);
  assert.equal(c4.has("e"), false);
});

test("the result does not depend on the order the charts registered in", () => {
  const registrations = [
    { place: 3, ...chart("c3", "f", ["d", "b"]) },
    { place: 1, ...chart("c1", "f", ["a", "b", "c"]) },
    { place: 2, ...chart("c2", "f", ["c", "a", "d"]) },
  ];
  const plain = (m: Map<string, Map<string, number>>) => [...m].map(([id, slots]) => [id, [...slots]]);
  const first = plain(assignPageColours(registrationsInPageOrder(registrations)));
  const flipped = plain(assignPageColours(registrationsInPageOrder([...registrations].reverse())));
  const shuffled = plain(assignPageColours(registrationsInPageOrder([registrations[1], registrations[2], registrations[0]])));
  assert.deepEqual(flipped, first);
  assert.deepEqual(shuffled, first);
  assert.deepEqual(registrationsInPageOrder(registrations).map((c) => c.chart), ["c1", "c2", "c3"]);
});
