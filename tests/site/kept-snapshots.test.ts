// The kept snapshots a deploy unpacks beside the newest (scripts/kept-snapshots.mjs, D-131): what makes a folder sound, what the index must say,
// and that the public-build check fails when either is wrong. Run on folders made in a temporary directory.
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../scripts/kept-snapshots.mjs", import.meta.url));
const checker = fileURLToPath(new URL("../../scripts/check-public-build.mjs", import.meta.url));
const { indexProblems, problemsIn, readKept, writeIndex } = await import("../../scripts/kept-snapshots.mjs");

// A data folder whose newest snapshot is `served`, with the kept folders given: folder name -> the snapshot date its manifest names (null: no manifest).
function data(served: string, kept: Record<string, string | null>) {
  const dir = mkdtempSync(join(tmpdir(), "kept-"));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ latest_snapshot: served }));
  for (const [name, date] of Object.entries(kept)) {
    mkdirSync(join(dir, "snapshots", name), { recursive: true });
    if (date !== null) writeFileSync(join(dir, "snapshots", name, "manifest.json"), JSON.stringify({ latest_snapshot: date }));
  }
  return dir;
}
const withData = <T>(served: string, kept: Record<string, string | null>, run: (dir: string) => T): T => {
  const dir = data(served, kept);
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const cli = (dir: string) => {
  const r = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
  return { status: r.status, out: r.stdout + r.stderr };
};

test("a good set of folders is listed in month order, each with its snapshot date, and the index says so", () => {
  withData("2026-12-31", { "2026-10": "2026-10-31", "2026-09": "2026-09-30" }, (dir) => {
    assert.deepEqual(problemsIn(dir), []);
    const run = cli(dir);
    assert.equal(run.status, 0, run.out);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "snapshots", "index.json"), "utf8")), {
      snapshots: [
        { month: "2026-09", snapshot: "2026-09-30" },
        { month: "2026-10", snapshot: "2026-10-31" },
      ],
    });
    assert.deepEqual(indexProblems(dir), []);
  });
});

test("with no earlier snapshot the index is written empty, and nothing is wrong", () => {
  withData("2026-10-31", {}, (dir) => {
    assert.equal(cli(dir).status, 0);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "snapshots", "index.json"), "utf8")), { snapshots: [] });
    assert.deepEqual(indexProblems(dir), []);
  });
});

test("a folder whose manifest is another month's fails, and the message names the folder", () => {
  withData("2026-12-31", { "2026-10": "2026-09-30" }, (dir) => {
    const run = cli(dir);
    assert.equal(run.status, 1);
    assert.match(run.out, /snapshots\/2026-10\/manifest\.json is the snapshot of 2026-09-30, not a snapshot of 2026-10/);
  });
});

test("a folder with no manifest fails, and the message names the folder", () => {
  withData("2026-12-31", { "2026-10": null }, (dir) => {
    const run = cli(dir);
    assert.equal(run.status, 1);
    assert.match(run.out, /snapshots\/2026-10 has no readable manifest\.json/);
  });
});

test("a folder that is not named for a month, a manifest with no date, and a stray file each fail", () => {
  withData("2026-12-31", { latest: "2026-10-31" }, (dir) => assert.match(problemsIn(dir).join("\n"), /snapshots\/latest is not a folder named for a month/));
  withData("2026-12-31", { "2026-10": "soon" }, (dir) => assert.match(problemsIn(dir).join("\n"), /snapshots\/2026-10\/manifest\.json names no snapshot date/));
  withData("2026-12-31", {}, (dir) => {
    mkdirSync(join(dir, "snapshots"), { recursive: true });
    writeFileSync(join(dir, "snapshots", "notes.txt"), "x");
    assert.match(problemsIn(dir).join("\n"), /snapshots\/notes\.txt is not a folder/);
  });
});

test("a kept folder that is the newest snapshot's month, or later, fails: the newest is served from the data folder and not kept twice", () => {
  withData("2026-10-31", { "2026-10": "2026-10-31" }, (dir) => assert.match(cli(dir).out, /snapshots\/2026-10 is not earlier than the newest snapshot \(2026-10\)/));
  withData("2026-10-31", { "2026-11": "2026-11-30" }, (dir) => assert.equal(cli(dir).status, 1));
});

test("a failed run writes no index", () => {
  withData("2026-12-31", { "2026-10": "2026-09-30" }, (dir) => {
    cli(dir);
    assert.equal(readKept(dir).kept.length, 0);
    assert.match(indexProblems(dir).join("\n"), /2026-10/);
    assert.throws(() => readFileSync(join(dir, "snapshots", "index.json")));
  });
});

test("the index must list exactly the sound folders: one missing, one extra, an index that is not JSON, and a folder with no index each fail", () => {
  withData("2026-12-31", { "2026-10": "2026-10-31", "2026-11": "2026-11-30" }, (dir) => {
    assert.match(indexProblems(dir).join("\n"), /index\.json is missing, and 2 snapshot/);
    writeIndex(dir);
    assert.deepEqual(indexProblems(dir), []);
    writeFileSync(join(dir, "snapshots", "index.json"), JSON.stringify({ snapshots: [{ month: "2026-10", snapshot: "2026-10-31" }] }));
    assert.match(indexProblems(dir).join("\n"), /lists \[2026-10 2026-10-31\], but the sound folders are \[2026-10 2026-10-31, 2026-11 2026-11-30\]/);
    writeFileSync(
      join(dir, "snapshots", "index.json"),
      JSON.stringify({ snapshots: [{ month: "2026-10", snapshot: "2026-10-31" }, { month: "2026-11", snapshot: "2026-11-30" }, { month: "2026-09", snapshot: "2026-09-30" }] }),
    );
    assert.match(indexProblems(dir).join("\n"), /lists/);
    writeFileSync(join(dir, "snapshots", "index.json"), "not json");
    assert.match(indexProblems(dir).join("\n"), /not readable JSON/);
  });
});

test("the public-build check fails when a kept folder is malformed or the index disagrees, and passes when they agree", () => {
  const dist = mkdtempSync(join(tmpdir(), "dist-"));
  try {
    mkdirSync(join(dist, "_astro"));
    writeFileSync(join(dist, "index.html"), `<html><astro-island component-url="/_astro/Entry.AbCd1234.js"></astro-island></html>`);
    writeFileSync(join(dist, "_astro", "Entry.AbCd1234.js"), "export const a = 1;");
    mkdirSync(join(dist, "data", "snapshots", "2026-10"), { recursive: true });
    writeFileSync(join(dist, "data", "manifest.json"), JSON.stringify({ latest_snapshot: "2026-12-31" }));
    writeFileSync(join(dist, "data", "snapshots", "2026-10", "manifest.json"), JSON.stringify({ latest_snapshot: "2026-10-31" }));
    const check = () => spawnSync(process.execPath, [checker, dist], { encoding: "utf8" });
    const noIndex = check();
    assert.equal(noIndex.status, 1);
    assert.match(noIndex.stderr, /index\.json is missing/);
    writeIndex(join(dist, "data"));
    const clean = check();
    assert.equal(clean.status, 0, clean.stderr);
    writeFileSync(join(dist, "data", "snapshots", "2026-10", "manifest.json"), JSON.stringify({ latest_snapshot: "2026-09-30" }));
    assert.match(check().stderr, /snapshots\/2026-10\/manifest\.json is the snapshot of 2026-09-30/);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});
