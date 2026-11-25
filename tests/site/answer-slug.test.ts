// The address of a generated page (src/lib/answerSlug.ts): unique, stable and safe for every value of a field, whatever it holds: punctuation, spaces,
// slashes, accents, letters outside the Latin alphabet, a value that folds to nothing, a very long one, and two values that fold to the same text.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const { foldValue, slugCode, slugsFor, MAX_SLUG_TEXT } = await import("../../src/lib/answerSlug.ts");

const SAFE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

test("an ordinary value is its folded text: lower case, letters and digits, one hyphen for any run of anything else", () => {
  const s = slugsFor(["MAKE|MODEL 2", "A.B/C  D", "  Q&A  ", "X-1", "plain"]);
  assert.equal(s.get("MAKE|MODEL 2"), "make-model-2");
  assert.equal(s.get("A.B/C  D"), "a-b-c-d");
  assert.equal(s.get("  Q&A  "), "q-a");
  assert.equal(s.get("X-1"), "x-1");
  assert.equal(s.get("plain"), "plain");
});

test("accents and macrons come off and the address says nothing a visitor cannot type", () => {
  const s = slugsFor(["ŠKODA", "CITROËN", "Pōmare", "Mazdā"]);
  assert.equal(s.get("ŠKODA"), "skoda");
  assert.equal(s.get("CITROËN"), "citroen");
  assert.equal(s.get("Pōmare"), "pomare");
  assert.equal(s.get("Mazdā"), "mazda");
});

test("a letter with no plain form marks the address, so it cannot be another value's", () => {
  const s = slugsFor(["ØRSTED", "RSTED", "日本車", "車日本"]);
  assert.notEqual(s.get("ØRSTED"), s.get("RSTED"));
  assert.match(s.get("ØRSTED") as string, /^rsted-[0-9a-z]{7}$/);
  assert.match(s.get("RSTED") as string, /^rsted-[0-9a-z]{7}$/, "they fold to the same text, so each has its code");
  assert.equal(slugsFor(["ØRSTED"]).get("ØRSTED")?.startsWith("rsted-"), true, "a letter with no plain form is marked even where nothing shares its text");
  assert.notEqual(s.get("日本車"), s.get("車日本"), "values that fold to nothing each have an address of their own");
  assert.match(s.get("日本車") as string, /^x-[0-9a-z]{7}$/);
});

test("two values that fold to the same text each carry a code from the whole value, so neither is the other's; a value alone does not", () => {
  const s = slugsFor(["A-B|C", "A|B-C", "A B C", "alone"]);
  const three = [s.get("A-B|C"), s.get("A|B-C"), s.get("A B C")] as string[];
  assert.equal(new Set(three).size, 3);
  for (const slug of three) assert.match(slug, /^a-b-c-[0-9a-z]{7}$/);
  assert.equal(s.get("alone"), "alone");
});

test("an address does not change when other values come and go, unless they fold to the same text", () => {
  const before = slugsFor(["ALPHA", "BETA|ONE", "GAMMA"]);
  const after = slugsFor(["ZETA", "ALPHA", "BETA|TWO", "BETA|ONE", "DELTA", "GAMMA"]);
  for (const v of ["ALPHA", "BETA|ONE", "GAMMA"]) assert.equal(after.get(v), before.get(v), v);
  // The order the values are given in does not matter either.
  assert.deepEqual([...slugsFor(["B", "A", "C"])].sort(), [...slugsFor(["C", "B", "A"])].sort());
  // The code is the same value's on every run: a hash, with no table to keep.
  assert.equal(slugCode("FORD|RANGER"), slugCode("FORD|RANGER"));
  assert.notEqual(slugCode("FORD|RANGER"), slugCode("FORD|RANGER "));
});

test("a long value is cut and given its code, so two long values with the same start differ", () => {
  const start = "x".repeat(MAX_SLUG_TEXT + 20);
  const s = slugsFor([`${start}1`, `${start}2`]);
  const [a, b] = [...s.values()];
  assert.notEqual(a, b);
  for (const slug of s.values()) assert.ok(slug.length <= MAX_SLUG_TEXT + 8, slug);
});

test("every address is unique and safe in a path, for values of every kind at once", () => {
  const values = [
    "TOYOTA", "TOYOTA|HILUX", "TOYOTA|HIGHLANDER", "MERCEDES-BENZ", "MERCEDES BENZ", "MERCEDES|BENZ", "LAND ROVER", "LAND-ROVER", "LANDROVER",
    "A/B", "A\\B", "A?B#C", "A%2FB", "../etc", "..", ".", "", " ", "-", "--", "a--b", "ÅB", "AB", "Ä", "A", "日本", "ß", "SS", "İ", "I", "ǅ", "①", "1",
    "x".repeat(200), "x".repeat(200) + "y", "\u0000", "a\nb", "a b",
  ];
  const s = slugsFor(values);
  const slugs = [...s.values()];
  assert.equal(new Set(values).size, s.size);
  assert.equal(new Set(slugs).size, slugs.length, "no two values share an address");
  for (const slug of slugs) {
    assert.match(slug, SAFE, `"${slug}"`);
    assert.ok(slug.length <= MAX_SLUG_TEXT + 8, slug);
    assert.notEqual(slug, ".");
    assert.notEqual(slug, "..");
  }
});

test("folding says whether anything was lost", () => {
  assert.deepEqual(foldValue("Pōmare"), { text: "pomare", lossy: false });
  assert.equal(foldValue("日本").lossy, true);
  assert.equal(foldValue("a / b").lossy, false);
});

// ---- On the built data, where there is one ----

const here = new URL("../../public/data/", import.meta.url);
const haveData = existsSync(new URL("cube/new_registrations/model.parquet", here));

test("the addresses of every brand and model value the build holds are unique and safe", { skip: !haveData && "no built data in public/data" }, async () => {
  const { readSlice } = await import("../../src/lib/latestMonthBuild.ts");
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", here), "utf8"));
  const read = (relative: string) => {
    try {
      const bytes = readFileSync(new URL(relative, here));
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    } catch {
      return undefined;
    }
  };
  for (const dimension of ["make", "model"]) {
    const rows = (await readSlice(read, manifest, "new_registrations", dimension)) ?? [];
    const values = [...new Set(rows.map((r) => r.value))];
    assert.ok(values.length > 20, `${dimension}: values to check`);
    const s = slugsFor(values);
    assert.equal(new Set(s.values()).size, values.length);
    for (const slug of s.values()) assert.match(slug, SAFE);
  }
});
