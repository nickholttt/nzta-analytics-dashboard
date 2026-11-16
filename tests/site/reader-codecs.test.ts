// The codecs the site's Parquet reader can decode are listed once, in config/pipeline.json ("site_reader"), and the
// pipeline checks every file it publishes against that list (pipeline/tests/test_parquet_codecs.py). This keeps the list
// and src/lib/data.ts, which holds the decoders, in agreement.
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

// hyparquet decodes these pages itself, with no decoder given to it.
const BUILT_IN = ["UNCOMPRESSED", "SNAPPY"];

test("every codec the pipeline may publish has a decoder in src/lib/data.ts, or is one hyparquet has built in", () => {
  const listed: string[] = JSON.parse(read("config/pipeline.json")).site_reader.codecs;
  const data = read("src/lib/data.ts");
  const given = /const compressors = \{([^}]*)\}/.exec(data)?.[1] ?? "";
  for (const codec of listed) {
    assert.ok(BUILT_IN.includes(codec) || new RegExp(`\\b${codec}\\s*:`).test(given), `${codec} is listed as readable but data.ts gives the reader no decoder for it`);
  }
});

test("data.ts gives the reader no decoder that the list does not name", () => {
  const listed: string[] = JSON.parse(read("config/pipeline.json")).site_reader.codecs;
  const given = /const compressors = \{([^}]*)\}/.exec(read("src/lib/data.ts"))?.[1] ?? "";
  for (const [, codec] of given.matchAll(/\b([A-Z0-9_]+)\s*:/g)) assert.ok(listed.includes(codec), `${codec} has a decoder in data.ts but is not in the list`);
});
