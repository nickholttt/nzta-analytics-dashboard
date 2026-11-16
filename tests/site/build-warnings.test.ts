// The internal status page shows the warnings a build recorded in its manifest, as the pipeline wrote them, with the snapshot and
// the time the cube was generated; a manifest with none says so, and one with no list at all says that instead (D-112). The text
// of a warning is never changed here, and no domain value is named.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const { generatedLabel, warningsMeta, warningsView } = await import("../../src/lib/buildWarnings.ts");
const manifest = (extra: object = {}) => ({ latest_snapshot: "2026-10-31", generated_at: "2026-11-14T23:09:41Z", ...extra });

test("the warnings come back as written and in the order the manifest has them", () => {
  const written = ["b: first, with a <tag> & a % sign", "a: second\nwith a line break", "c: third"];
  const view = warningsView(manifest({ warnings: written }));
  assert.deepEqual(view.warnings, written);
  assert.equal(view.snapshot, "2026-10-31");
  assert.equal(view.generated, "2026-11-14 23:09 UTC");
  assert.equal(warningsMeta(view), "Snapshot 2026-10-31 · generated 2026-11-14 23:09 UTC · 3 warnings");
});

test("one warning is counted in the singular", () => {
  assert.equal(warningsMeta(warningsView(manifest({ warnings: ["only"] }))), "Snapshot 2026-10-31 · generated 2026-11-14 23:09 UTC · 1 warning");
});

test("a build with no warning says so, and is not mistaken for a manifest with no list", () => {
  const none = warningsView(manifest({ warnings: [] }));
  assert.deepEqual(none.warnings, []);
  assert.match(warningsMeta(none), /· no warnings$/);
  for (const absent of [undefined, null, "a string", { a: 1 }]) {
    const unknown = warningsView(manifest({ warnings: absent }));
    assert.equal(unknown.warnings, null, String(absent));
    assert.match(warningsMeta(unknown), /· no warnings list in this manifest$/);
  }
});

test("an entry that is not text is shown as its JSON, not dropped", () => {
  assert.deepEqual(warningsView(manifest({ warnings: ["a", { k: 1 }, 2] })).warnings, ["a", '{"k":1}', "2"]);
});

test("the generated time reads in UTC to the minute, and a time written any other way is shown as it is", () => {
  assert.equal(generatedLabel("2026-11-14T23:09:41Z"), "2026-11-14 23:09 UTC");
  assert.equal(generatedLabel("2026-11-14T23:09:41.250Z"), "2026-11-14 23:09 UTC");
  assert.equal(generatedLabel("2026-11-14T23:09Z"), "2026-11-14 23:09 UTC");
  assert.equal(generatedLabel("2026-11-14T23:09:41+13:00"), "2026-11-14T23:09:41+13:00");
  assert.equal(generatedLabel("yesterday"), "yesterday");
});

test("only the internal status page reads the warnings: no other file in src names them", () => {
  const found = readdirSync(new URL("../../src", import.meta.url), { recursive: true, encoding: "utf8" })
    .filter((f) => /\.(astro|tsx?|jsx?)$/.test(f))
    .filter((f) => /buildWarnings|BuildWarnings|\.warnings/.test(readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8")))
    .map((f) => f.replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(found, ["components/PresetTriage.tsx", "lib/buildWarnings.ts", "pages/status.astro"]);
  assert.match(readFileSync(new URL("../../src/pages/status.astro", import.meta.url), "utf8"), /<BuildWarnings client:only="react" \/>/);
});
