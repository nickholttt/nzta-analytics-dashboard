// A file the reader cannot decode is told apart from a file that did not arrive (src/lib/unreadable.ts).
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { UNREADABLE_DATA, isUnreadableForm } from "../../src/lib/unreadable.ts";

test("hyparquet's own error for a codec it has no decoder for is recognised, and its wording is still in the library", () => {
  const library = readFileSync(new URL("../../node_modules/hyparquet/src/datapage.js", import.meta.url), "utf8");
  const message = /throw new Error\(`(parquet unsupported compression codec)/.exec(library)?.[1];
  assert.ok(message, "hyparquet no longer says this: update isUnreadableForm");
  assert.equal(isUnreadableForm(new Error(`${message}: BROTLI`)), true);
});

test("a failed fetch or any other error is not taken for an unreadable file", () => {
  assert.equal(isUnreadableForm(new Error("public/data/cube/x.parquet: HTTP 404")), false);
  assert.equal(isUnreadableForm(new TypeError("Failed to fetch")), false);
  assert.equal(isUnreadableForm("parquet unsupported compression codec"), false);
});

test("the sentence for it gives no reload advice and names no codec", () => {
  assert.match(UNREADABLE_DATA, /will not help/);
  assert.doesNotMatch(UNREADABLE_DATA, /zstd|snappy|gzip|brotli|lz4|codec/i);
});
