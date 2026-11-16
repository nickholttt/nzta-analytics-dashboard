// The rolling mix (src/lib/rolling.ts) against a plain version written here, and monthKey (src/lib/monthkey.ts). Seeded.
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { isReserved, rollingMix } from "../../src/lib/rolling.ts";
import { monthKey } from "../../src/lib/monthkey.ts";
import { addMonths } from "../../src/lib/sentences.ts";

type Row = { month: string; value: string; n: number; denominator: number };

let seed = 7919;
const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

// The definition in words: for each month that has a figure, the twelve months ending there must all have a figure and
// start no earlier than the first month, and their denominators must reach the floor; each value's share is its count
// over those months (a row repeated for a month and value: the last one stands) divided by the window's denominators.
function plain(rows: Row[], floor: number, window: number) {
  const usable = rows.filter((r) => !isReserved(r.value));
  const denominator = new Map<string, number>();
  const count = new Map<string, number>();
  for (const r of usable) {
    denominator.set(r.month, r.denominator);
    count.set(JSON.stringify([r.month, r.value]), r.n);
  }
  const months = [...denominator.keys()].sort();
  const values = [...new Set(usable.map((r) => r.value))];
  const out: { month: string; shares: number[] }[] = [];
  for (const month of months) {
    const window_: string[] = [];
    for (let k = window - 1; k >= 0; k--) window_.push(addMonths(month, -k));
    if (window_[0] < months[0]) continue;
    if (window_.some((m) => !denominator.has(m))) continue;
    const total = window_.reduce((s, m) => s + (denominator.get(m) as number), 0);
    if (total < floor) continue;
    out.push({ month, shares: values.map((v) => window_.reduce((s, m) => s + (count.get(JSON.stringify([m, v])) ?? 0), 0) / total) });
  }
  return out;
}

const VALUES = ["A", "B", "C|D", "E|", "__UNDEFINED__", "__UNMAPPED__", "__OTHER__"];

function series(): Row[] {
  const rows: Row[] = [];
  let y = between(1990, 2020);
  let m = between(1, 12);
  const months = between(0, 45);
  for (let i = 0; i < months; i++, m++) {
    if (m > 12) (m = 1), y++;
    if (random() < 0.1) continue; // a month with no rows at all
    const denominator = random() < 0.08 ? 0 : between(0, 900);
    for (const v of VALUES) if (random() < 0.8) rows.push({ month: key(y, m), value: v, n: between(0, 300), denominator });
    if (random() < 0.15) rows.push({ month: key(y, m), value: "A", n: between(0, 300), denominator }); // repeated: the last stands
  }
  return rows;
}

test("the rolling mix equals the plain definition over a few thousand seeded series, windows of 12 and 3", () => {
  for (let i = 0; i < 2500; i++) {
    const rows = series();
    const floor = between(0, 6000);
    const window = i % 4 === 0 ? 3 : 12;
    assert.deepEqual(rollingMix(rows, floor, window), plain(rows, floor, window), `series ${i}`);
  }
});

test("an empty series, an all-reserved series and a series with every denominator zero give what the definition gives", () => {
  assert.deepEqual(rollingMix([], 0, 12), []);
  const reserved: Row[] = Array.from({ length: 24 }, (_, i) => ({ month: addMonths("2020-01", i), value: "__OTHER__", n: 5, denominator: 50 }));
  assert.deepEqual(rollingMix(reserved, 0, 12), []);
  const zero: Row[] = Array.from({ length: 24 }, (_, i) => ({ month: addMonths("2020-01", i), value: "A", n: 0, denominator: 0 }));
  assert.deepEqual(rollingMix(zero, 0, 12), plain(zero, 0, 12));
  assert.deepEqual(rollingMix(zero, 1, 12), []);
});

test("a value with a vertical bar in it is its own value, and a repeated row's last count stands", () => {
  const rows: Row[] = [];
  for (let i = 0; i < 12; i++) rows.push({ month: addMonths("2021-01", i), value: "A|B", n: 10, denominator: 100 }, { month: addMonths("2021-01", i), value: "A", n: 30, denominator: 100 });
  rows.push({ month: "2021-12", value: "A", n: 90, denominator: 100 });
  const [only] = rollingMix(rows, 0, 12);
  assert.equal(only.month, "2021-12");
  assert.equal(only.shares[0], 120 / 1200);
  assert.equal(only.shares[1], 420 / 1200);
});

test("monthKey reads the three forms a reader hands back, once per distinct instant, and refuses the rest", () => {
  assert.equal(monthKey(new Date(Date.UTC(2026, 9, 1))), "2026-10");
  assert.equal(monthKey(new Date(Date.UTC(2026, 9, 1))), "2026-10");
  assert.equal(monthKey("2026-10-01"), "2026-10");
  const day = Date.UTC(2025, 11, 1) / 86_400_000;
  assert.equal(monthKey(day), "2025-12");
  assert.equal(monthKey(BigInt(day)), "2025-12");
  assert.equal(monthKey(0), "1970-01");
  for (let i = 0; i < 2000; i++) {
    const y = between(1950, 2040);
    const mo = between(0, 11);
    const date = new Date(Date.UTC(y, mo, 1));
    assert.equal(monthKey(date), key(y, mo + 1));
    assert.equal(monthKey(date.getTime() / 86_400_000), key(y, mo + 1));
  }
  assert.throws(() => monthKey(undefined), /unreadable month value/);
  assert.throws(() => monthKey({}), /unreadable month value/);
});
