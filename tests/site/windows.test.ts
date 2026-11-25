import "./support/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { complete, defaultWindow, sumOver, windowsFor, windowsConfig } = await import("../../src/lib/windows.ts");

const by = (latest: string) => Object.fromEntries(windowsFor(latest).map((w) => [w.id, w]));

test("the four windows end with the newest month and have the months they are named for", () => {
  const w = by("2026-10");
  assert.deepEqual(w.month.months, ["2026-10"]);
  assert.deepEqual(w["3m"].months, ["2026-08", "2026-09", "2026-10"]);
  assert.equal(w["12m"].months.length, 12);
  assert.equal(w["12m"].months[0], "2025-11");
  assert.deepEqual(w.ytd.months, ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
});

test("the prior window is the same months a year before, for every window", () => {
  for (const w of windowsFor("2026-02")) {
    assert.equal(w.prior.length, w.months.length);
    w.months.forEach((m, i) => assert.equal(w.prior[i], `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`));
  }
});

test("the year to date is one month in January and twelve in December", () => {
  assert.equal(by("2027-01").ytd.months.length, 1);
  assert.equal(by("2026-12").ytd.months.length, 12);
  assert.equal(by("2026-12").ytd.months[0], "2026-01");
});

test("a window's figure is the sum of its months, and a missing or hidden month gives none", () => {
  const counts: Record<string, number | null> = { "2026-08": 10, "2026-09": 20, "2026-10": 30, "2026-07": null };
  const at = (m: string) => counts[m];
  assert.equal(sumOver(["2026-08", "2026-09", "2026-10"], at), 60);
  assert.equal(sumOver(["2026-07", "2026-08"], at), undefined);
  assert.equal(sumOver(["2026-06", "2026-08"], at), undefined);
  assert.equal(sumOver([], at), undefined);
  assert.equal(complete(["2026-08", "2026-09"], (m) => m in counts), true);
  assert.equal(complete(["2026-06", "2026-09"], (m) => m in counts), false);
});

test("each surface has a default window that exists", () => {
  const windows = windowsFor("2026-10");
  for (const surface of Object.keys(windowsConfig.default)) assert.ok(defaultWindow(windows, surface));
  assert.equal(defaultWindow(windows, "home")?.id, "month");
  assert.equal(defaultWindow(windows, "brand")?.id, "12m");
  assert.deepEqual(windowsFor("nonsense"), []);
});
