// The kept snapshots a deploy unpacks beside the newest (scripts/kept-snapshots.mjs, D-131): what makes a folder sound, what the index must say,
// and that the public-build check fails when either is wrong. Run on folders made in a temporary directory.
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../scripts/kept-snapshots.mjs", import.meta.url));
const checker = fileURLToPath(new URL("../../scripts/check-public-build.mjs", import.meta.url));
const { SMALL_CELL_KEY, indexProblems, ownerTableProblems, problemsIn, readKept, realOwnerDimensions, uncoveredOwnerTables, withholdOwnerTables, writeIndex } = await import("../../scripts/kept-snapshots.mjs");

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

// A kept folder with tables for an owner dimension and for others, as a release holds them. `covered`: the entry the manifest gives each dataset's
// small_cells block for the owner dimension (undefined: the manifest has no such block).
const owner = realOwnerDimensions()[0];
const other = "plain_a";
const other2 = "plain_b";
const dataset = "ds";
function withKept(covered: unknown, run: (dir: string, folder: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "owner-"));
  try {
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ latest_snapshot: "2026-12-31" }));
    const folder = join(dir, "snapshots", "2026-10");
    const datasetEntry = covered === undefined ? {} : { [SMALL_CELL_KEY]: { [owner]: covered } };
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "manifest.json"), JSON.stringify({ latest_snapshot: "2026-10-31", datasets: { [dataset]: datasetEntry } }));
    for (const file of [
      `cube/${dataset}/${owner}.parquet`,
      `cube/${dataset}/${other}.parquet`,
      `pairs/${dataset}/${owner}__${other}.parquet`,
      `pairs/${dataset}/${other}__${owner}.parquet`,
      `pairs/${dataset}/${other}__${other2}.parquet`,
      `facts/${dataset}/${owner}.parquet`,
      `facts/${dataset}/n.parquet`,
      `facts/${dataset}/${other}.parquet`,
    ]) {
      mkdirSync(join(folder, file, ".."), { recursive: true });
      writeFileSync(join(folder, file), "x");
    }
    run(dir, folder);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const OWNER_FILES = [`cube/${dataset}/${owner}.parquet`, `facts/${dataset}/${owner}.parquet`, `pairs/${dataset}/${other}__${owner}.parquet`, `pairs/${dataset}/${owner}__${other}.parquet`].sort();

test("a kept folder whose manifest has no small_cells block loses every table of an owner dimension, and keeps every other file", () => {
  assert.ok(owner, "the data map needs an owner dimension");
  withKept(undefined, (dir, folder) => {
    assert.deepEqual(uncoveredOwnerTables(folder), OWNER_FILES);
    const run = cli(dir);
    assert.equal(run.status, 0, run.out);
    for (const file of OWNER_FILES) assert.match(run.out, new RegExp(`Withheld snapshots/2026-10/${file.replace(/[.]/g, "[.]")}`));
    for (const file of OWNER_FILES) assert.throws(() => readFileSync(join(folder, file)), file);
    for (const file of [`cube/${dataset}/${other}.parquet`, `pairs/${dataset}/${other}__${other2}.parquet`, `facts/${dataset}/n.parquet`, `facts/${dataset}/${other}.parquet`, "manifest.json"]) {
      assert.equal(readFileSync(join(folder, file), "utf8").length > 0, true, file);
    }
    assert.deepEqual(ownerTableProblems(dir), []);
  });
});

test("a kept folder whose manifest says the rule was applied to the owner dimension keeps its tables", () => {
  withKept({ minimum: 10 }, (dir, folder) => {
    assert.deepEqual(uncoveredOwnerTables(folder), []);
    const run = cli(dir);
    assert.equal(run.status, 0, run.out);
    assert.doesNotMatch(run.out, /Withheld/);
    for (const file of OWNER_FILES) assert.equal(readFileSync(join(folder, file), "utf8"), "x", file);
  });
});

test("an entry that is not a block under the dimension does not cover it", () => {
  for (const entry of [null, false, [], "applied"]) {
    withKept(entry, (_dir, folder) => assert.deepEqual(uncoveredOwnerTables(folder), OWNER_FILES, JSON.stringify(entry)));
  }
});

test("the script's own removal is one function and the check reads the same: withholdOwnerTables removes what ownerTableProblems names", () => {
  withKept(undefined, (dir) => {
    assert.equal(ownerTableProblems(dir).length, OWNER_FILES.length);
    assert.equal(withholdOwnerTables(dir).length, OWNER_FILES.length);
    assert.deepEqual(ownerTableProblems(dir), []);
  });
});

test("the public-build check fails when an owner table that the snapshot does not cover is put back, and names it", () => {
  withKept(undefined, (dir, folder) => {
    const dist = mkdtempSync(join(tmpdir(), "dist-"));
    try {
      mkdirSync(join(dist, "_astro"));
      writeFileSync(join(dist, "index.html"), `<html><astro-island component-url="/_astro/Entry.AbCd1234.js"></astro-island></html>`);
      writeFileSync(join(dist, "_astro", "Entry.AbCd1234.js"), "export const a = 1;");
      cpSync(dir, join(dist, "data"), { recursive: true });
      const check = () => spawnSync(process.execPath, [checker, dist], { encoding: "utf8" });
      assert.match(check().stderr, new RegExp(`snapshots/2026-10/cube/${dataset}/${owner}[.]parquet is a table of an owner field`));
      assert.equal(spawnSync(process.execPath, [script, join(dist, "data")], { encoding: "utf8" }).status, 0);
      const clean = check();
      assert.equal(clean.status, 0, clean.stderr);
      mkdirSync(join(dist, "data", "snapshots", "2026-10", "cube", dataset), { recursive: true });
      writeFileSync(join(dist, "data", "snapshots", "2026-10", "cube", dataset, `${owner}.parquet`), "x");
      assert.equal(check().status, 1);
      assert.match(check().stderr, /owner field/);
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  });
});
