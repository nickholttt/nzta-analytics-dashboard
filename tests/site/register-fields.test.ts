// The three register fields bound in D-116 (the assembly flag, NZTA's class code, seats in bands) as breakdowns of Build, and what they
// need that a plain category does not: a pair that is never crossed because one rolls up to the other (D-122), and a gap shown as the gap
// it is. Through the real vocabulary, settle and readingNotes over a build in which every field is live (tests/site/support/observe.ts).
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { everythingBuilt } from "./support/observe.ts";

const config = await import("../../src/lib/config.ts");
const builder = await import("../../src/lib/builder.ts");
const { fillTemplate } = await import("../../src/lib/sentences.ts");

const NEW = ["nz_assembled", "nzta_class", "seats_band"];
const manifest = everythingBuilt();
const [vocabulary] = builder.builderVocabulary(manifest).datasets;
const all = { datasets: [vocabulary] };
const measure = (id: string) => {
  const m = vocabulary.measures.find((x) => x.id === id);
  assert.ok(m, `the builder offers ${id}`);
  return m;
};

test("each of the three is offered as a breakdown of a share, a count and the two together, with words, and chosen values", () => {
  for (const id of ["share", "count", "share_and_count"]) {
    for (const field of NEW) {
      const option = measure(id).dimensions.find((d) => d.id === field);
      assert.ok(option, `${id} by ${field}`);
      assert.ok(option.phrase.length > 0 && option.values, `${id} by ${field} has words and takes chosen values`);
    }
  }
  // A measure made of a ratio of the largest few offers none of them: it is about brands.
  const derived = vocabulary.measures.find((m) => m.derived);
  assert.ok(derived && NEW.every((f) => !derived.dimensions.some((d) => d.id === f)));
});

test("each of the three is also a second breakdown, for the others and for the fields that already were", () => {
  const share = measure("share");
  for (const field of NEW) {
    const option = share.dimensions.find((d) => d.id === field);
    assert.ok(option && option.with.length > 0, `${field} can be crossed with something`);
    assert.ok(option.with.includes("powertrain") && share.dimensions.find((d) => d.id === "powertrain")?.with.includes(field), `${field} and powertrain`);
    const q = builder.settle(all, { dataset: vocabulary.dataset, measure: "share", by: "powertrain", by2: field, values: [], where: {}, view: null });
    assert.equal(q.by2, field, `${field} is kept as the second breakdown`);
    const [preset] = builder.builderPresets(q);
    assert.equal(preset.dimension2, field);
  }
});

test("a phrase exists in config for each breakdown the builder offers, and the sentence reads them", () => {
  for (const field of NEW) {
    const q = builder.settle(all, { dataset: vocabulary.dataset, measure: "share", by: field, values: [], where: {}, view: null });
    assert.equal(q.by, field);
    const phrase = measure("share").dimensions.find((d) => d.id === field)?.phrase as string;
    assert.ok(builder.questionText(q, "share").toLowerCase().includes(phrase.toLowerCase()), builder.questionText(q, "share"));
  }
  assert.ok(config.builderSpec.measures.every((m) => !m.derived || NEW.every((f) => !(f in m.dimensions))));
});

// ---- a class is never set beside the type it rolls up to (D-122) ----

const { rollUps, nested } = await import("../../src/lib/nesting.ts");
const dataMap = JSON.parse((await import("node:fs")).readFileSync(new URL("../../config/data_map.json", import.meta.url), "utf8"));
const field = (name: string, bound: string | null, to: string[] = []) => ({ name, bound, relations: { rolls_up_to: to.map((t) => ({ to: t })) } });
const dim = (id: string, derive: { kind: string; field?: string }) => ({ id, derive });

test("a field the data map says rolls up to another is nested under it, in either order, and so is a field read from the same one alone", () => {
  const ups = rollUps(dataMap.fields, config.dimensions as never);
  assert.ok(nested(ups, "nzta_class", "vehicle_type") && nested(ups, "vehicle_type", "nzta_class"));
  // trade_group is vehicle_type looked up again, so a class is under it too.
  assert.ok(nested(ups, "nzta_class", "trade_group"));
  // The map's other roll-ups, through any number of steps: a model under its brand under its group.
  assert.ok(nested(ups, "model", "make") && nested(ups, "make", "parent_group") && nested(ups, "model", "parent_group"));
  // A field read from several (a vehicle type from type, body and weight) is not the field its parts roll up to.
  assert.ok(!nested(ups, "nzta_class", "segment") && !nested(ups, "nzta_class", "segment_group"));
  assert.ok(!nested(ups, "nzta_class", "seats_band") && !nested(ups, "nzta_class", "nz_assembled"));
  assert.ok(!nested(ups, "vehicle_type", "trade_group"), "two readings of one field do not roll up to each other; config.builder.cannot_cross lists that pair");
});

test("the rule on a map of its own: direct, through steps, a field read from one field, one read from several, and a loop", () => {
  const map = [field("A", "a", ["B"]), field("B", "b", ["c"]), field("D", "d")];
  const dims = [dim("a", { kind: "raw", field: "a" }), dim("a_looked_up", { kind: "lookup", field: "a" }), dim("b", { kind: "raw", field: "b" }), dim("c", { kind: "brand" }), dim("d", { kind: "raw", field: "d" }), dim("ab", { kind: "range_lookup" })];
  const ups = rollUps(map, dims);
  assert.deepEqual([...(ups.get("a") ?? [])].sort(), ["b", "c"]);
  assert.deepEqual([...(ups.get("a_looked_up") ?? [])].sort(), ["b", "c"], "a lookup of a field rolls up wherever the field does");
  assert.ok(nested(ups, "c", "a") && !nested(ups, "d", "a") && !nested(ups, "ab", "b"));
  const loop = rollUps([field("A", "a", ["B"]), field("B", "b", ["A"])], [dim("a", { kind: "raw", field: "a" }), dim("b", { kind: "raw", field: "b" })]);
  assert.ok(nested(loop, "a", "b"), "a loop in a map ends");
  // A target the map does not hold, and a field with no dimension, add nothing.
  assert.equal(rollUps([field("A", "a", ["nothing"]), field("Z", null, ["a"])], dims).size, 0);
});

test("Build does not cross a class with the type it rolls up to, either way round, nor offer the pair; every other pair it did offer it still does", () => {
  assert.equal(builder.canCross("nzta_class", "vehicle_type"), false);
  assert.equal(builder.canCross("vehicle_type", "nzta_class"), false);
  assert.equal(builder.canCross("nzta_class", "trade_group"), false);
  // Neither is offered to cross with a class even when it is offered at all.
  const spec = config.builderSpec.measures.filter((m) => !m.derived && !m.parts);
  const before = spec.map((m) => m.dimensions);
  try {
    for (const m of spec) m.dimensions = { ...m.dimensions, vehicle_type: "registered as", trade_group: "passenger or commercial" };
    const [offeredNow] = builder.builderVocabulary(manifest).datasets;
    for (const id of ["share", "count"]) {
      const options = offeredNow.measures.find((m) => m.id === id)?.dimensions ?? [];
      const cls = options.find((d) => d.id === "nzta_class");
      const type = options.find((d) => d.id === "vehicle_type");
      assert.ok(cls && type, `${id}: both fields are breakdowns in this test`);
      assert.ok(!cls.with.includes("vehicle_type") && !cls.with.includes("trade_group") && !type.with.includes("nzta_class"), `${id}: not crossed`);
      assert.ok(cls.with.includes("powertrain") && cls.with.includes("seats_band") && type.with.includes("powertrain"), `${id}: still crossed with the rest`);
    }
    // A link that asks for the pair is answered with a question that is valid, and says so once.
    const asked = { dataset: vocabulary.dataset, measure: "share", by: "nzta_class", by2: "vehicle_type", values: [], values2: [], where: {}, view: null };
    const settled = builder.settle({ datasets: [offeredNow] }, asked);
    assert.equal(settled.by, "nzta_class");
    assert.equal(settled.by2, undefined);
    const note = builder.readingNotes({ datasets: [offeredNow] }, asked, settled);
    assert.ok(note.by2 && note.by2.asked.length > 0);
    assert.match(fillTemplate(config.builderSpec.notices.by2, note.by2).text, /^This link asked for a second breakdown by .+, which this question cannot have\. It shows the question without one\.$/);
    const swapped = { ...asked, by: "vehicle_type", by2: "nzta_class" };
    assert.equal(builder.settle({ datasets: [offeredNow] }, swapped).by2, undefined, "the other way round");
  } finally {
    spec.forEach((m, i) => (m.dimensions = before[i]));
  }
});

test("as the page stands, a link that asks for a class by a type of vehicle lands on a valid question and says why in one line", () => {
  const asked = builder.readQuestion("?build.measure=share&build.by=nzta_class&build.by2=vehicle_type");
  const settled = builder.settle(all, asked);
  assert.equal(settled.by, "nzta_class");
  assert.equal(settled.by2, undefined);
  assert.ok(builder.readingNotes(all, asked, settled).by2);
  assert.ok(builder.builderPresets(settled).every((p) => p.dimension === "nzta_class" && !p.dimension2));
});

test("a label reads in a sentence with its first letter lower, and an acronym at its start is left as written", () => {
  assert.equal(config.lowerLabel("Country where built"), "country where built");
  assert.equal(config.lowerLabel("NZTA class code"), "NZTA class code");
  assert.equal(config.lowerLabel("Engine size (Stats NZ bands)"), "engine size (Stats NZ bands)");
  assert.equal(config.lowerLabel(""), "");
  // The field's own label starts with an acronym, whatever else config calls it.
  const classLabel = config.dimensionLabel("nzta_class") as string;
  assert.equal(config.lowerLabel(classLabel), classLabel);
  // The sentence a link that names a second breakdown the question cannot have is answered with.
  const asked = { dataset: vocabulary.dataset, measure: "share", by: "powertrain", by2: "nzta_class", values: [], where: {}, view: null };
  const note = builder.readingNotes({ datasets: [{ ...vocabulary, measures: [{ ...measure("share"), dimensions: measure("share").dimensions.map((d) => ({ ...d, with: [] })) }] }] }, asked, builder.settle(all, { ...asked, by2: null }));
  assert.equal(note.by2?.asked, measure("share").dimensions.find((d) => d.id === "nzta_class")?.phrase ?? classLabel);
});
