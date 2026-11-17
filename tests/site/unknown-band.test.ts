// A banded field's unknown band is read as the reserved not-recorded value (src/lib/data.ts, D-122), through the real readers of a slice, a pair
// and the fact table, over a few rows written for this test (tests/site/fixtures/mini-cube) and served to them in place of the network.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("./fixtures/mini-cube/", import.meta.url);
globalThis.fetch = (async (url: string) => {
  const path = String(url).replace(/^\/data\//, "");
  try {
    const bytes = readFileSync(new URL(path, root));
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  } catch {
    return { ok: false, status: 404 };
  }
}) as never;

const config = await import("../../src/lib/config.ts");
const data = await import("../../src/lib/data.ts");
const sentencesModule = await import("../../src/lib/sentences.ts");
const { NOT_RECORDED_TOKEN } = sentencesModule;

// The fixture's two fields: one banded with an unknown band, one that holds the reserved value itself. Their words come from config.
const banded = config.dimensions.find((d) => d.id === "seats_band");
assert.ok(banded);
const unknown = config.unrecordedBand(banded.id);
assert.ok(unknown, "config flags an unknown band on the banded field");
const DATASET = "registrations_surviving";
const sum = (rows: { value: string; n: number }[], value: string) => rows.filter((r) => r.value === value).reduce((a, r) => a + r.n, 0);

test("config names the unknown band of the dimensions that have one, and no other", () => {
  const flagged = config.dimensions.filter((d) => d.bands?.some((b) => b.unknown));
  assert.ok(flagged.length >= 1);
  for (const d of flagged) assert.equal(config.unrecordedBand(d.id), d.bands?.find((b) => b.unknown)?.label);
  assert.equal(config.unrecordedBand("powertrain"), undefined);
  assert.equal(config.unrecordedBand(undefined), undefined);
});

test("a slice of a banded field has its unknown band under the not-recorded value, with its vehicles", async () => {
  const rows = await data.loadSlice(DATASET, banded.id);
  assert.ok(!rows.some((r) => r.value === unknown), "no row keeps the band's own name");
  assert.equal(sum(rows, NOT_RECORDED_TOKEN), 6, "the two months' unknown counts, 2 and 4");
  assert.ok(rows.some((r) => r.value !== NOT_RECORDED_TOKEN), "the other bands are as they were");
});

test("a pair's banded side is read the same way, and its other side is not touched", async () => {
  const rows = await (data as unknown as { loadView: (s: unknown) => Promise<{ value: string; n: number }[]> }).loadView({
    dataset: DATASET,
    dimension: banded.id,
    cross: { dimension: "nzta_class", pair: { pair: `${banded.id}${data.PAIR_SEPARATOR}nzta_class`, side: "a" } },
  });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => !r.value.startsWith(unknown)), "no value starts with the band's own name");
});

test("the fact table's column of a banded field is read the same way: a condition on the reserved value keeps those vehicles, and one on the band's own name keeps none", async () => {
  const kept = await data.factView(DATASET, "nzta_class", undefined, { [banded.id]: [NOT_RECORDED_TOKEN] });
  assert.equal(kept.find((r) => r.month === "2026-10" && r.value === "__UNDEFINED__")?.n, 4);
  assert.equal(kept.find((r) => r.month === "2026-09" && r.value === "A")?.n, 2);
  const byName = await data.factView(DATASET, "nzta_class", undefined, { [banded.id]: [unknown] });
  assert.equal(byName.filter((r) => r.n > 0).length, 0, "the band's own name is not a value any more");
  // Broken down by the banded field, the vehicles under the reserved value are those of the band, in every month.
  const by = await data.factView(DATASET, banded.id, undefined, {});
  assert.deepEqual([...new Set(by.filter((r) => r.value === NOT_RECORDED_TOKEN).map((r) => r.month))].sort(), ["2026-09", "2026-10"]);
  assert.equal(sum(by, NOT_RECORDED_TOKEN), 6);
  // A field with no unknown band is not changed: what it holds as the reserved value stays.
  const other = await data.factView(DATASET, "nzta_class", undefined, {});
  assert.equal(sum(other, NOT_RECORDED_TOKEN), 7);
});

test("a not-recorded part outside the window a chart draws does not count as drawn", async () => {
  const { notRecordedDrawn } = await import("../../src/lib/measures.ts");
  const windowed = config.periods.find((p) => p.months);
  assert.ok(windowed?.months, "config has a period that is a number of months");
  const latest = "2026-10";
  const before = sentencesModule.addMonths(latest, -windowed.months);
  const rows = [
    { month: before, value: NOT_RECORDED_TOKEN, n: 5 },
    { month: before, value: "A", n: 1 },
    { month: latest, value: "A", n: 3 },
  ];
  assert.equal(notRecordedDrawn(rows, windowed.id, latest), false, "the only not-recorded vehicles are a month before the window");
  assert.equal(notRecordedDrawn(rows, "all", latest), true, "over every month they are drawn");
  assert.equal(notRecordedDrawn([...rows, { month: latest, value: NOT_RECORDED_TOKEN, n: 1 }], windowed.id, latest), true);
  assert.equal(notRecordedDrawn([...rows, { month: latest, value: NOT_RECORDED_TOKEN, n: 0 }], windowed.id, latest), false, "a zero is not a part");
  assert.equal(notRecordedDrawn([], windowed.id, latest), false);
});

test("the line that says a share is of all vehicles, not-recorded ones included, fills from config with no placeholder left, and names no value", () => {
  const { fillTemplate } = sentencesModule;
  const filled = fillTemplate(config.phrases.share_with_not_recorded, { field: "A field", value: "A value" });
  assert.deepEqual(filled.unresolved, []);
  assert.equal(filled.text, "A field: each share is of all vehicles counted, including any not recorded, which are drawn as their own part, “A value”.");
});
