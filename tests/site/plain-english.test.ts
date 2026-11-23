// The plain English lint (scripts/check-plain-english.mjs, config/narrative/plain_english.json) is a public-readiness guard: it must
// stay clean on the site as it is, and it must fail when a page or a config word holds a term of the project's own workings.
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error a plain module with no types
import { configWords, findHits, loadRules, pageWords } from "../../scripts/plain-english.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const script = fileURLToPath(new URL("../../scripts/check-plain-english.mjs", import.meta.url));
const rules = loadRules(repoRoot);

// A built output of one page, run through the real check against the real config. The page's words are the only thing that changes.
function lintPage(body: string, head = "<title>Page</title>") {
  const dir = mkdtempSync(join(tmpdir(), "plain-english-"));
  try {
    mkdirSync(join(dir, "_astro"));
    mkdirSync(join(dir, "page"));
    writeFileSync(join(dir, "page", "index.html"), `<!DOCTYPE html><html><head>${head}</head><body><main>${body}</main></body></html>`);
    const run = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
    return { status: run.status, out: run.stdout + run.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("a clean page passes, with the real config's words checked beside it", () => {
  const run = lintPage("<h1>Registrations</h1><p>Vehicles first registered each month.</p>");
  // The config's own words are held to the rules too; a hit there fails this case, which is the point of running it here.
  assert.equal(run.status, 0, run.out);
});

test("a decision number, a dataset id and an internal word in a page's text fail it, each named", () => {
  const dataset = [...rules.ids].find((id: string) => id.includes("_"));
  assert.ok(dataset, "config holds no id with an underscore, so the id rule would check nothing");
  const run = lintPage(`<p>The fact table, decided in D-062, is read as ${dataset}.</p>`);
  assert.equal(run.status, 1, run.out);
  assert.match(run.out, /fact table/);
  assert.match(run.out, /decision number/);
  assert.match(run.out, /internal id/);
});

test("the page's alt text, aria-label, title and description are read too", () => {
  const run = lintPage(
    `<img alt="the cube" src="/x.png"><button aria-label="Open the manifest">Open</button>`,
    `<title>The pipeline</title><meta name="description" content="Slices of the guardrail">`,
  );
  assert.equal(run.status, 1, run.out);
  for (const word of ["cube", "manifest", "pipeline", "slice", "guardrail"]) assert.match(run.out, new RegExp(word, "i"), `${word} was not found`);
});

test("the words an island is handed are read, and a lone value in them is not a sentence", () => {
  const props = JSON.stringify({ label: [0, "Counted from the cube"], key: [0, "powertrain_group"] }).replace(/"/g, "&quot;");
  const run = lintPage(`<astro-island props="${props}"></astro-island>`);
  assert.equal(run.status, 1, run.out);
  assert.match(run.out, /island props label/);
  assert.doesNotMatch(run.out, /island props key/);
});

test("a template's placeholder is fine in config and is a hit on a page", () => {
  const inConfig = findHits(rules, "config", "Chart {number} added.", true, true);
  assert.deepEqual(inConfig, []);
  const onPage = findHits(rules, "page", "Chart {number} added.", true, false);
  assert.equal(onPage.length, 1);
  assert.equal(onPage[0].rule, "unfilled placeholder");
});

test("a config sentence that names a banned term or an id is found, with where it is", () => {
  const dir = mkdtempSync(join(tmpdir(), "plain-english-config-"));
  try {
    mkdirSync(join(dir, "config", "narrative"), { recursive: true });
    const rulesFile = JSON.parse(readFileSync(join(repoRoot, "config/narrative/plain_english.json"), "utf8"));
    writeFileSync(join(dir, "config/narrative/plain_english.json"), JSON.stringify({ ...rulesFile, config_files: ["config/words.json"], allow: [] }));
    writeFileSync(join(dir, "config/pipeline.json"), JSON.stringify({ datasets: { some_dataset: {} } }));
    writeFileSync(join(dir, "config/words.json"), JSON.stringify({ $note: "the cube", group: { help: "Counted from some_dataset, a slice of the cube." }, formula: "a slice of the cube" }));
    const local = loadRules(dir);
    const hits = configWords(local, dir).flatMap((w: { source: string; text: string }) => findHits(local, w.source, w.text, /\s/.test(w.text), true));
    assert.deepEqual(hits.map((h: { rule: string }) => h.rule).sort(), ["cube", "internal id", "slice"]);
    assert.ok(hits.every((h: { source: string }) => h.source === "config/words.json > group.help"), "the note and the skipped key were read");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a real exception is allowed only with a reason, and every entry in the list is still needed", () => {
  for (const entry of rules.allow) {
    assert.ok(entry.rule && entry.in, `an allow entry names its rule and where: ${JSON.stringify(entry)}`);
    assert.ok(typeof entry.reason === "string" && entry.reason.length > 20, `the allow entry for ${entry.rule} in ${entry.in} has no reason`);
  }
  // Staleness is the script's own check: it fails on an entry that matches nothing, and runs in the first test on the built page.
  const words = pageWords(`<title>About</title><p>TO DECIDE</p>`);
  assert.ok(words.some((w: { text: string }) => w.text.includes("TO DECIDE")));
});

test("an allow entry that matches nothing fails the check", () => {
  const dir = mkdtempSync(join(tmpdir(), "plain-english-stale-"));
  try {
    mkdirSync(join(dir, "config", "narrative"), { recursive: true });
    mkdirSync(join(dir, "dist", "_astro"), { recursive: true });
    const rulesFile = JSON.parse(readFileSync(join(repoRoot, "config/narrative/plain_english.json"), "utf8"));
    const stale = { rule: "cube", in: "config/words.json > old.help", reason: "A sentence that has since been reworded and no longer holds the word." };
    writeFileSync(join(dir, "config/narrative/plain_english.json"), JSON.stringify({ ...rulesFile, config_files: ["config/words.json"], allow: [stale] }));
    writeFileSync(join(dir, "config/pipeline.json"), JSON.stringify({ datasets: {} }));
    writeFileSync(join(dir, "config/words.json"), JSON.stringify({ old: { help: "Plain words." } }));
    writeFileSync(join(dir, "dist", "index.html"), "<!DOCTYPE html><html><head><title>Page</title></head><body><p>Plain words.</p></body></html>");
    const run = spawnSync(process.execPath, [script, join(dir, "dist"), "--repo", dir], { encoding: "utf8" });
    assert.equal(run.status, 1, run.stdout + run.stderr);
    assert.match(run.stderr, /matches nothing any more/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
