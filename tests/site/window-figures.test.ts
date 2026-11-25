import "./support/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { changeOutcome, moverFloor, placeAmong, qualifiesAsMover, shareOf } = await import("../../src/lib/windowFigures.ts");
const { recordingChange } = await import("../../src/lib/recordingChange.ts");

const base = { now: 120, before: 100, comparable: true as boolean | undefined, floor: 50 };

test("a new entry is stated only where the earlier window is complete and holds exactly none", () => {
  assert.deepEqual(changeOutcome({ ...base, before: 0 }), { kind: "new" });
  // an earlier window with a missing or hidden month has no sum, so there is no new entry and no comparison
  assert.deepEqual(changeOutcome({ ...base, before: undefined }), { kind: "none" });
  // nothing now and nothing before is not a new entry
  assert.deepEqual(changeOutcome({ ...base, now: 0, before: 0 }), { kind: "none" });
});

test("the comparison is dropped under the floor, across a recording change, on a hidden figure and while events are not loaded", () => {
  assert.equal(changeOutcome({ ...base, before: 49 }).kind, "none");
  assert.equal(changeOutcome({ ...base, before: 50 }).kind, "change");
  assert.equal(changeOutcome({ ...base, comparable: false }).kind, "none");
  assert.equal(changeOutcome({ ...base, comparable: undefined }).kind, "none");
  assert.equal(changeOutcome({ ...base, now: undefined }).kind, "hidden");
  // a recording change also stops a new entry from being said: the earlier window may be empty because of how it was recorded
  assert.equal(changeOutcome({ ...base, before: 0, comparable: false }).kind, "none");
});

test("a recording event between the two windows leaves the comparison out, and events not loaded say nothing", () => {
  const event = { id: "e", mechanism: "measurement", date_start: "2026-03-01", date_end: "2026-03-01", scope: "all", scope_values: [] } as never;
  const between = recordingChange([event], "2025-11", "2026-10", {});
  assert.equal(changeOutcome({ ...base, comparable: between === false }).kind, "none");
  assert.equal(recordingChange([], "2025-11", "2026-10", {}), false);
  assert.equal(recordingChange(null, "2025-11", "2026-10", {}), undefined);
});

test("the change reads up, down or level", () => {
  const up = changeOutcome(base);
  assert.ok(up.kind === "change" && up.change.direction === "up");
  const down = changeOutcome({ ...base, now: 80 });
  assert.ok(down.kind === "change" && down.change.direction === "down");
  const same = changeOutcome({ ...base, now: 100 });
  assert.ok(same.kind === "change" && same.change.direction === "same");
});

test("a place: a tie gives none, a value at or below the reserved count gives none, and a hidden count gives none", () => {
  const sums = new Map([["a", 500], ["b", 300], ["c", 300], ["d", 40]]);
  assert.deepEqual(placeAmong("a", sums, { exact: true }), { rank: 1, of: 4 });
  assert.equal(placeAmong("b", sums, { exact: true }), undefined);
  assert.equal(placeAmong("d", sums, { exact: true, atLeast: 40 }), undefined);
  assert.deepEqual(placeAmong("d", sums, { exact: true, atLeast: 39 }), { rank: 4, of: 4 });
  assert.equal(placeAmong("a", sums, { exact: false }), undefined);
  assert.equal(placeAmong("missing", sums, { exact: true }), undefined);
});

test("the movers minimum scales with the months and must hold in both windows", () => {
  assert.equal(moverFloor(100, 1, 50), 100);
  assert.equal(moverFloor(100, 3, 50), 300);
  assert.equal(moverFloor(100, 12, 50), 1200);
  assert.equal(moverFloor(10, 1, 50), 50);
  assert.equal(qualifiesAsMover(300, 300, 300), true);
  assert.equal(qualifiesAsMover(300, 299, 300), false);
  assert.equal(qualifiesAsMover(299, 900, 300), false);
  assert.equal(qualifiesAsMover(undefined, 900, 300), false);
});

test("a share is stated only over the floor", () => {
  assert.equal(shareOf(50, 200, 100), 0.25);
  assert.equal(shareOf(50, 99, 100), undefined);
  assert.equal(shareOf(50, undefined, 100), undefined);
});
