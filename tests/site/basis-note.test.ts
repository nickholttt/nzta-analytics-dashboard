// The last line under a chart says what its dataset's figures are not (CLAUDE.md invariant 8: words are data). Each dataset carries its own, in
// config/dimensions.json, and no code holds a sentence of it. Through the real config.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";

const { builderSpec, datasetBasisNote, findDataset, presets } = await import("../../src/lib/config.ts");

// Every dataset a visitor can reach: the ones Build offers and the ones an Explore preset is drawn from.
const offered = [...new Set([...builderSpec.datasets, ...presets.flatMap((p) => (p.dataset ? [p.dataset] : []))])];

test("every dataset Build or Explore offers has a basis note", () => {
  assert.ok(offered.length >= 4, "the datasets are found");
  for (const id of offered) assert.ok(datasetBasisNote(id), `${id}: no basis note`);
});

test("a dataset that is another one filtered says what its base says", () => {
  const filtered = ["nz_new", "used_imports"].map((id) => findDataset(id)).filter((d) => d?.base);
  assert.ok(filtered.length > 0);
  for (const d of filtered) assert.equal(datasetBasisNote(d?.id), findDataset(d?.base)?.basis_note);
});

test("a table of the register as it stands is not told it counts registrations", () => {
  const stock = findDataset("fleet");
  assert.ok(stock?.basis_note);
  assert.doesNotMatch(stock.basis_note, /registrations/i);
  assert.notEqual(stock.basis_note, findDataset("registrations_surviving")?.basis_note);
});

test("no basis note is in code: the panel reads it from the dataset, and no .ts, .tsx or .astro file holds a sentence of one", () => {
  const panel = readFileSync(new URL("../../src/components/PresetPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /datasetBasisNote\(effectivePreset\.dataset\)/);
  assert.doesNotMatch(panel, /BASIS_NOTE/);
  const notes = offered.map((id) => datasetBasisNote(id) as string);
  const walk = (dir: URL): string[] =>
    readdirSync(dir).flatMap((name) => {
      const child = new URL(name, dir);
      return statSync(child).isDirectory() ? walk(new URL(`${name}/`, dir)) : /\.(ts|tsx|astro)$/.test(name) ? [child.pathname] : [];
    });
  const method = readFileSync(new URL("../../src/pages/method.astro", import.meta.url), "utf8");
  assert.match(method, /d.basis_note/, "the method page lists the notes from config");
  for (const file of walk(new URL("../../src/", import.meta.url))) {
    const text = readFileSync(decodeURIComponent(file).replace(/^\/([A-Za-z]:)/, "$1"), "utf8");
    for (const note of notes) assert.ok(!text.includes(note), `${file}: holds a basis note`);
  }
});
