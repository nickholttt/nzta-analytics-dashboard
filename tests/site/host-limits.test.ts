// The host's limits on what one deploy may hold (scripts/host-limits.mjs, D-146): the public-build check fails, naming the cause, when the
// output holds more files than the host serves or a file larger than it serves. Run on folders made in a temporary directory, with small
// limits, so the test does not write twenty thousand files.
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { HOST_LIMITS, hostLimitProblems } = await import("../../scripts/host-limits.mjs");

function folder(files: Record<string, number>) {
  const dir = mkdtempSync(join(tmpdir(), "host-limits-"));
  for (const [name, bytes] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, Buffer.alloc(bytes));
  }
  return dir;
}

test("the limits are the host's published ones: 20,000 files and 25 MiB a file", () => {
  assert.equal(HOST_LIMITS.max_files, 20000);
  assert.equal(HOST_LIMITS.max_file_bytes, 25 * 1024 * 1024);
});

test("an output inside both limits has no problem, counting files in every folder", () => {
  const dir = folder({ "index.html": 10, "data/snapshots/2026-10/manifest.json": 10, "_astro/a.js": 10 });
  try {
    assert.deepEqual(hostLimitProblems(dir, { max_files: 3, max_file_bytes: 10 }), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("one file more than the host serves fails, and says how many there are and the limit", () => {
  const dir = folder({ "index.html": 1, "data/a.parquet": 1, "data/snapshots/2026-09/b.parquet": 1 });
  try {
    const problems = hostLimitProblems(dir, { max_files: 2, max_file_bytes: 10 });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /3 files/);
    assert.match(problems[0], /2/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a file one byte over the limit fails, naming the file", () => {
  const dir = folder({ "index.html": 1, "data/facts/big.parquet": 11 });
  try {
    const problems = hostLimitProblems(dir, { max_files: 10, max_file_bytes: 10 });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /data[\\/]facts[\\/]big\.parquet/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
