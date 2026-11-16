// Month keys ("YYYY-MM"): stepping through them, and what a missing or malformed key does. Seeded, so a failure repeats.
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, monthAt, monthIndex, monthRange } from "../../src/lib/sentences.ts";

let seed = 20261116;
const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

// The plain way: count months with a year and a month, no index arithmetic.
function reference(from: [number, number], to: [number, number]): string[] {
  const out: string[] = [];
  let [y, m] = from;
  while (y < to[0] || (y === to[0] && m <= to[1])) {
    out.push(key(y, m));
    if (++m > 12) (m = 1), y++;
  }
  return out;
}

test("monthRange is every month from one key to the other, both included, over random pairs and year ends", () => {
  for (let i = 0; i < 3000; i++) {
    const from: [number, number] = [between(1955, 2035), between(1, 12)];
    const to: [number, number] = i % 3 === 0 ? [from[0], between(1, 12)] : [from[0] + between(0, 6), between(1, 12)];
    assert.deepEqual(monthRange(key(...from), key(...to)), reference(from, to), `${key(...from)} to ${key(...to)}`);
  }
  assert.deepEqual(monthRange("2025-12", "2026-01"), ["2025-12", "2026-01"]);
  assert.deepEqual(monthRange("2026-03", "2026-03"), ["2026-03"]);
  assert.deepEqual(monthRange("2026-04", "2026-03"), []);
});

test("monthRange over a missing or malformed month is an empty list, as it was before the index form", () => {
  const bad = [undefined, null, "", "2026", "2026-", "-05", "2026-13", "2026-00", "abc", "2026-0x", 5];
  for (const x of bad) {
    assert.deepEqual(monthRange(x as never, "2026-03"), [], `from ${String(x)}`);
    assert.deepEqual(monthRange("2026-03", x as never), [], `to ${String(x)}`);
  }
});

test("a malformed month has no index, and no NaN reaches a month key", () => {
  for (const x of [undefined, "", "2026", "2026-13", "x-01", "2026-ab"]) {
    assert.ok(Number.isNaN(monthIndex(x as never)), String(x));
    assert.equal(addMonths(x as never, 3), "", String(x));
  }
  assert.equal(monthAt(Number.NaN), "");
  assert.equal(monthAt(1.5), "");
  assert.doesNotMatch(addMonths("2026-10", 1), /NaN|undefined/);
});
