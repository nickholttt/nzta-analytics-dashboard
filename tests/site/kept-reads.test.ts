// Reading a kept snapshot through src/lib/data.ts, the only door to published data (D-131): which folder each file is asked of, that a read
// of a kept snapshot and of the newest never share a cache entry, and how the index of kept months is read. The real module runs against a
// stand-in for fetch that records what it was asked.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { loadKeptSnapshots, loadManifest, loadEvents, loadSlice, loadView, loadFirstMonth } = await import("../../src/lib/data.ts");
const { readIndex } = await import("../../src/lib/snapshotIndex.ts");

type Answer = { ok: boolean; body?: unknown; throws?: boolean };
const asked: string[] = [];
let answers: Record<string, Answer> = {};
// While set, a file under /data (or under a kept snapshot's folder) is served from the few rows written for the tests (tests/site/fixtures/mini-cube).
let serveFixture = false;
const fixture = new URL("./fixtures/mini-cube/", import.meta.url);
globalThis.fetch = (async (url: string) => {
  asked.push(url);
  if (serveFixture) {
    try {
      const bytes = readFileSync(new URL(url.replace(/^\/data\/(snapshots\/\d{4}-\d{2}\/)?/, ""), fixture));
      return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    } catch {
      return { ok: false, status: 404 };
    }
  }
  const answer = answers[url] ?? { ok: false };
  if (answer.throws) throw new TypeError("network down");
  return { ok: answer.ok, status: answer.ok ? 200 : 404, json: async () => answer.body, arrayBuffer: async () => new ArrayBuffer(8) };
}) as unknown as typeof fetch;
const reset = (next: Record<string, Answer> = {}) => {
  asked.length = 0;
  answers = next;
};

test("a manifest is asked of the folder of its snapshot, and the newest's of the data folder; the two are cached apart", async () => {
  reset({
    "/data/manifest.json": { ok: true, body: { latest_snapshot: "2026-11-30" } },
    "/data/snapshots/2026-10/manifest.json": { ok: true, body: { latest_snapshot: "2026-10-31" } },
  });
  const newest = await loadManifest();
  const kept = await loadManifest("2026-10");
  assert.equal(newest.latest_snapshot, "2026-11-30");
  assert.equal(kept.latest_snapshot, "2026-10-31");
  // Asked again, neither is fetched again, and each still answers with its own.
  assert.equal((await loadManifest("2026-10")).latest_snapshot, "2026-10-31");
  assert.equal((await loadManifest()).latest_snapshot, "2026-11-30");
  assert.deepEqual(asked, ["/data/manifest.json", "/data/snapshots/2026-10/manifest.json"]);
});

test("the events of a kept snapshot are those of its folder", async () => {
  reset({ "/data/events.json": { ok: true, body: [{ id: "new" }] }, "/data/snapshots/2026-09/events.json": { ok: true, body: [{ id: "old" }] } });
  assert.equal((await loadEvents("2026-09"))[0].id, "old");
  assert.equal((await loadEvents())[0].id, "new");
});

test("a slice, a pair and the fact table's columns of a kept snapshot are asked of its folder, and never of the newest's", async () => {
  reset();
  // The stand-in returns no Parquet, so each read fails after asking; what matters is where it asked.
  const base = { dataset: "ds", dimension: "dim" };
  await loadView({ ...base, snapshot: "2026-08" }).catch(() => undefined);
  await loadView({ ...base, snapshot: "2026-08", filter: { pair: "dim__other", side: "a", dimension: "other", values: ["x"] } }).catch(() => undefined);
  await loadView({ ...base, snapshot: "2026-08", facts: { where: { other: ["x"] } } }).catch(() => undefined);
  await loadView({ ...base, snapshot: "2026-08", facts: { where: {} }, cross: { dimension: "other", grid: true } }).catch(() => undefined);
  await loadFirstMonth({ ...base, snapshot: "2026-08", facts: { where: {} } }, []).catch(() => undefined);
  assert.ok(asked.length >= 5, asked.join(", "));
  for (const url of asked) assert.match(url, /^\/data\/snapshots\/2026-08\//, url);
  assert.ok(asked.includes("/data/snapshots/2026-08/cube/ds/dim.parquet"));
  assert.ok(asked.includes("/data/snapshots/2026-08/pairs/ds/dim__other.parquet"));
  assert.ok(asked.includes("/data/snapshots/2026-08/facts/ds/n.parquet"));
  assert.ok(asked.includes("/data/snapshots/2026-08/facts/ds/other.parquet"));
  assert.ok(asked.includes("/data/snapshots/2026-08/facts/ds/month.parquet"));
});

test("a read with no snapshot is asked of the data folder itself", async () => {
  reset();
  await loadSlice("ds2", "dim2").catch(() => undefined);
  await loadView({ dataset: "ds2", dimension: "dim2", facts: { where: {} } }).catch(() => undefined);
  assert.ok(asked.length >= 2);
  for (const url of asked) assert.match(url, /^\/data\/(cube|facts)\/ds2\//, url);
});

test("a slice of a kept snapshot and the same slice of the newest are two reads: neither is answered from the other's cache entry", async () => {
  reset();
  await loadSlice("ds3", "dim3", "2026-07").catch(() => undefined);
  await loadSlice("ds3", "dim3").catch(() => undefined);
  assert.deepEqual(asked, ["/data/snapshots/2026-07/cube/ds3/dim3.parquet", "/data/cube/ds3/dim3.parquet"]);
});

test("only a month is turned into a folder", () => {
  for (const bad of ["../x", "2026-1", "2026-10/..", "latest", ""]) assert.throws(() => loadManifest(bad), /not a snapshot month/, bad);
});

test("the index of kept months: absent, unreadable, malformed and a month listed twice are all read as none kept, and none is an error", async () => {
  const good = { snapshots: [{ month: "2026-09", snapshot: "2026-09-30" }, { month: "2026-10", snapshot: "2026-10-31" }] };
  assert.deepEqual([...(readIndex(good) ?? [])], [["2026-09", "2026-09-30"], ["2026-10", "2026-10-31"]]);
  assert.deepEqual([...(readIndex({ snapshots: [] }) ?? [])], []);
  const twice = { snapshots: [{ month: "2026-09", snapshot: "2026-09-30" }, { month: "2026-09", snapshot: "2026-09-29" }] };
  for (const bad of [null, undefined, "x", 3, {}, { snapshots: "2026-10" }, { snapshots: [null] }, { snapshots: [{ month: "2026-10" }] }, { snapshots: [{ month: "2026-10", snapshot: "2026-09-30" }] }, { snapshots: [{ month: "2026-13", snapshot: "2026-13-01" }] }, twice])
    assert.equal(readIndex(bad), null, JSON.stringify(bad));
  reset({ "/data/snapshots/index.json": { ok: false } });
  assert.equal(await loadKeptSnapshots(), null, "absent: 404");
});

test("an index that cannot be fetched or parsed is none kept and is not an error", async () => {
  // The first read is cached for the visit, so each case is a fresh module instance.
  for (const [label, answer] of [["network down", { ok: false, throws: true }], ["not JSON", { ok: true, body: undefined }]] as const) {
    const fresh = await import(`../../src/lib/data.ts?${label}`);
    reset({ "/data/snapshots/index.json": answer });
    assert.equal(await fresh.loadKeptSnapshots(), null, label);
  }
  const fresh = await import("../../src/lib/data.ts?good");
  reset({ "/data/snapshots/index.json": { ok: true, body: { snapshots: [{ month: "2026-10", snapshot: "2026-10-31" }] } } });
  assert.equal((await fresh.loadKeptSnapshots())?.get("2026-10"), "2026-10-31");
  assert.deepEqual(asked, ["/data/snapshots/index.json"]);
});

test("a file that loads is cached for its own folder: the same slice of the newest and of a kept snapshot are each fetched once, and neither answers for the other", async () => {
  serveFixture = true;
  try {
    reset();
    const dimension = "seats_band";
    const newest = await loadSlice("registrations_surviving", dimension);
    const kept = await loadSlice("registrations_surviving", dimension, "2026-06");
    assert.deepEqual(asked, ["/data/cube/registrations_surviving/seats_band.parquet", "/data/snapshots/2026-06/cube/registrations_surviving/seats_band.parquet"]);
    assert.equal(await loadSlice("registrations_surviving", dimension), newest);
    assert.equal(await loadSlice("registrations_surviving", dimension, "2026-06"), kept);
    assert.notEqual(newest, kept);
    assert.equal(asked.length, 2, "read again, neither is fetched again");
  } finally {
    serveFixture = false;
  }
});
