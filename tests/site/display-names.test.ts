// How a value is named as a person writes it (src/lib/displayNames.ts, config/display_names.json, data/reference/display_names.csv): a make in ordinary
// case, a model with only its make cased, the words for the two conditions, and the file held to the brand registry so an exception can never rename a brand.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { titleCase, labeller, displayRows, conditionOrder, conditionWords } = await import("../../src/lib/displayNames.ts");
const { builtDisplayNames, displayConfig } = await import("../../src/lib/displayNamesBuild.ts");
const { readReference } = await import("../../src/lib/readReference.mjs");
const { slugsFor } = await import("../../src/lib/answerSlug.ts");
type DisplayNames = import("../../src/lib/displayNames.ts").DisplayNames;

const config = { reference: "x.csv", rules: { make: "title_case" }, compound: { model: ["make"] } };
const rows = (records: Record<string, string>[]) => displayRows(records) ?? [];
const names = (records: Record<string, string>[] = []): DisplayNames => ({ rows: rows(records), config });
const row = (field: string, value: string, display: string, phrase = "") => ({ field, value, display, phrase, note: "" });
const plain = (_f: string, v: string) => v.split("|").join(" ");
const sep = (f: string) => (f === "model" ? "|" : undefined);
const make = (n: DisplayNames | undefined, values: string[] = []) => labeller(n, sep, () => values, plain);

test("the rule writes a make in ordinary case, keeping hyphens, spaces and joined words readable", () => {
  for (const [raw, shown] of [["MERCEDES-BENZ", "Mercedes-Benz"], ["ROLLS-ROYCE", "Rolls-Royce"], ["LAND ROVER", "Land Rover"], ["ALFA ROMEO", "Alfa Romeo"], ["TOYOTA", "Toyota"], ["LYNK & CO", "Lynk & Co"]] as const) {
    assert.equal(titleCase(raw), shown);
  }
});

test("a make with no row of its own is shown by the rule, so a new make needs no edit", () => {
  assert.equal(make(names()).label("make", "NEWCOMER"), "Newcomer");
});

test("a row wins over the rule", () => {
  const n = make(names([row("make", "BMW", "BMW"), row("make", "MCLAREN", "McLaren")]));
  assert.equal(n.label("make", "BMW"), "BMW");
  assert.equal(n.label("make", "MCLAREN"), "McLaren");
});

test("a compound value cases only its make part and keeps the model as registered", () => {
  const n = make(names([row("make", "BMW", "BMW")]));
  assert.equal(n.label("model", "FORD|RANGER"), "Ford RANGER");
  assert.equal(n.label("model", "TOYOTA|COROLLA CROSS"), "Toyota COROLLA CROSS");
  assert.equal(n.label("model", "BMW|X5"), "BMW X5");
  assert.equal(n.tail("model", "FORD|RANGER"), "RANGER");
});

test("a reserved token, and a field with no rule, is shown as it is held", () => {
  const n = make(names());
  assert.equal(n.label("make", "__UNMAPPED__"), "__UNMAPPED__");
  assert.equal(n.label("powertrain_group", "BEV"), "BEV");
  assert.equal(n.label("model", "__OTHER__"), "__OTHER__");
});

test("two values that would read the same are each shown as the register holds them", () => {
  const n = make(names(), ["ACME", "Acme", "OTHER"]);
  assert.equal(n.label("make", "ACME"), "ACME");
  assert.equal(n.label("make", "Acme"), "Acme");
  assert.equal(n.label("make", "OTHER"), "Other");
});

test("with no file, every value reads as it did before", () => {
  assert.equal(make(undefined).label("make", "TOYOTA"), "TOYOTA");
  assert.equal(make(undefined).label("model", "FORD|RANGER"), "FORD RANGER");
});

test("the conditions come with their words, in the file's order", () => {
  const n = names([row("import_status", "NZ New", "New", "new vehicles"), row("import_status", "Used Import", "Used imports", "used imports"), row("make", "BMW", "BMW")]);
  assert.deepEqual(conditionOrder(n, "import_status"), ["NZ New", "Used Import"]);
  assert.deepEqual(conditionWords(n, "import_status", "Used Import"), { label: "Used imports", phrase: "used imports" });
  assert.equal(conditionWords(n, "import_status", "Unlisted"), undefined);
});

// The real file, held to the brand registry.
const registry = (readReference as (n: string) => Record<string, string>[] | undefined)("brand_registry.csv") ?? [];
const makes = registry.map((r) => r.make_canonical);
const real = builtDisplayNames();

test("the file and the registry are both there", () => {
  assert.ok(makes.length > 50);
  assert.ok(real && real.rows.length > 0);
  assert.equal(displayConfig.reference, "display_names.csv");
});

test("every exception names a make in the registry, and its display is the make in other case: it can never rename a brand", () => {
  for (const r of real!.rows.filter((x) => x.field === "make")) {
    assert.ok(makes.includes(r.value), `${r.value} is not in the registry`);
    assert.equal(r.display.toUpperCase(), r.value, `${r.value} would be renamed`);
  }
});

test("every make with a word of three letters or fewer, or a word with no vowel, has an explicit row", () => {
  const explicit = new Set(real!.rows.filter((r) => r.field === "make").map((r) => r.value));
  for (const make of makes) {
    const words = make.split(/[\s\-]+/).filter((w) => /[A-Z]/.test(w));
    const risky = words.some((w) => w.length <= 3 || !/[AEIOU]/.test(w));
    if (risky) assert.ok(explicit.has(make), `${make} needs a row in display_names.csv`);
  }
});

test("every make in the registry reads as a unique, non-empty name, and the addresses do not change", () => {
  const n = labeller(real, sep, (f) => (f === "make" ? makes : []), plain);
  const shown = makes.map((m) => n.label("make", m));
  assert.ok(shown.every((s) => s.length > 0));
  assert.equal(new Set(shown).size, makes.length);
  const slugs = slugsFor(makes);
  assert.equal(slugs.get("TOYOTA"), "toyota");
  assert.equal(slugs.get("MERCEDES-BENZ"), "mercedes-benz");
});

test("the real names read as a person writes them", () => {
  const n = labeller(real, sep, (f) => (f === "make" ? makes : []), plain);
  for (const [raw, shown] of [["TOYOTA", "Toyota"], ["BMW", "BMW"], ["KIA", "Kia"], ["MG", "MG"], ["MERCEDES-BENZ", "Mercedes-Benz"], ["LYNK & CO", "Lynk & Co"], ["UD TRUCKS", "UD Trucks"], ["MCLAREN", "McLaren"], ["XPENG", "Xpeng"]] as const) {
    assert.equal(n.label("make", raw), shown);
  }
  assert.equal(n.label("model", "FORD|RANGER"), "Ford RANGER");
  assert.equal(n.label("import_status", "NZ New"), "New");
  assert.equal(n.label("import_status", "Used Import"), "Used imports");
});
