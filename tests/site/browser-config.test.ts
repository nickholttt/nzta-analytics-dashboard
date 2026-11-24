// What the browser is given of the config files it reads in part (scripts/browser-config.mjs): the keys it reads exist in the file, the cut keeps
// those and nothing else, and every key src/lib/config.ts reads from the pipeline config is among them.
//   node --test "tests/site/browser-config.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-expect-error a plain module with no types
import { BROWSER_PARTS, cutConfig } from "../../scripts/browser-config.mjs";

const read = (path: string) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")) as Record<string, unknown>;

test("every key the browser is given exists in its file, and the cut holds those keys and no others", () => {
  for (const [path, keys] of Object.entries(BROWSER_PARTS) as [string, string[]][]) {
    const doc = read(path);
    const cut = cutConfig(doc, keys, path);
    assert.deepEqual(Object.keys(cut).sort(), [...keys].sort(), path);
    for (const key of keys) assert.deepEqual(cut[key], doc[key]);
    assert.ok(JSON.stringify(cut).length < JSON.stringify(doc).length, `${path} is cut to less than the whole`);
  }
});

test("a key the file lacks stops the build, naming it", () => {
  assert.throws(() => cutConfig({ a: 1 }, ["a", "b"], "x.json"), /x\.json has no key b/);
});

test("every key src/lib/config.ts reads from the pipeline config is one the browser is given", () => {
  const source = readFileSync(new URL("../../src/lib/config.ts", import.meta.url), "utf8");
  const reads = new Set([...source.matchAll(/(?<![\w/.])pipeline\.(?!json\b)([a-z_]+)/g)].map((m) => m[1]));
  assert.ok(reads.size > 0, "config.ts reads something from the pipeline config");
  for (const key of reads) assert.ok((BROWSER_PARTS["config/pipeline.json"] as string[]).includes(key), `config.ts reads pipeline.${key}, which the browser is not given: add it to scripts/browser-config.mjs`);
});
