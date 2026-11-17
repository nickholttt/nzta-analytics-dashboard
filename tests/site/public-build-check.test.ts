// The public-build check (scripts/check-public-build.mjs, AGENTS.md) must fail when a script a page reaches names a chunk the output
// does not hold, and only then. These run it on small output folders made in a temporary directory.
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../scripts/check-public-build.mjs", import.meta.url));

// An output with one page, one entry script, and the scripts given: name -> source. The entry imports each of them, so each is reached.
function check(entry: (imported: string[]) => string, others: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "public-build-"));
  try {
    mkdirSync(join(dir, "_astro"));
    writeFileSync(join(dir, "index.html"), `<html><astro-island component-url="/_astro/Entry.AbCd1234.js"></astro-island></html>`);
    writeFileSync(join(dir, "_astro", "Entry.AbCd1234.js"), entry(Object.keys(others)));
    for (const [name, source] of Object.entries(others)) writeFileSync(join(dir, "_astro", name), source);
    const run = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
    return { status: run.status, out: run.stdout + run.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const importing = (names: string[]) => names.map((n) => `import "./${n}";`).join("\n");

test("a clean output passes", () => {
  const run = check(importing, { "react.Zz9Yy8Xx.js": "export const a = 1;" });
  assert.equal(run.status, 0, run.out);
});

test("a file whose name holds a dot passes when it exists, even when a script lists it in a map of plain strings", () => {
  const dotted = "Page.astro_astro_type_script_index_0_lang.Q1w2E3r4.js";
  const run = check((n) => `${importing(n)}\nconst deps = ["_astro/${dotted}"];`, { [dotted]: "export const a = 1;" });
  assert.equal(run.status, 0, run.out);
});

test("text that is only a file name in shape, such as a config file's name, is not a missing file", () => {
  const run = check(
    (n) => `${importing(n)}\nconst a = "astro.config.js", b = 'vite.config.js', c = \`./tailwind.config.js\`, d = "config/presets.js", e = "notes.abcdefghi.js";`,
    { "react.Zz9Yy8Xx.js": "export const a = 1;" },
  );
  assert.equal(run.status, 0, run.out);
});

test("a chunk a reached script names in a form the prune step does not read, but that the output lacks, fails by name", () => {
  const run = check((n) => `${importing(n)}\nconst deps = ["_astro/MatrixChart.Gone4567.js"];`, { "react.Zz9Yy8Xx.js": "export const a = 1;" });
  assert.equal(run.status, 1);
  assert.match(run.out, /Entry\.AbCd1234\.js names MatrixChart\.Gone4567\.js, which is not in the output/);
});

test("a missing file whose name holds a dot is named whole", () => {
  const run = check((n) => `${importing(n)}\nconst deps = ["./Page.astro_x_lang.Gone4567.js"];`, { "react.Zz9Yy8Xx.js": "export const a = 1;" });
  assert.equal(run.status, 1);
  assert.match(run.out, /names Page\.astro_x_lang\.Gone4567\.js, which is not in the output/);
});
