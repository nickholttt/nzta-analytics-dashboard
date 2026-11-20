// A link that names a value its dataset's own table of that field does not hold (a band's old unknown token, a class by its bare code, a value only
// another dataset has): the value is found, left out, and one sentence says so (D-137). Through the real readers over a few rows of Parquet
// (tests/site/fixtures/mini-cube) served in place of the network, and the real builder functions with a stand-in for the table reader.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { everythingBuilt } from "./support/observe.ts";

const root = new URL("./fixtures/mini-cube/", import.meta.url);
globalThis.fetch = (async (url: string) => {
  const path = String(url).replace(/^\/data\//, "");
  try {
    const bytes = readFileSync(new URL(path, root));
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  } catch {
    return { ok: false, status: 404 };
  }
}) as never;

const config = await import("../../src/lib/config.ts");
const data = await import("../../src/lib/data.ts");
const builder = await import("../../src/lib/builder.ts");
const { NOT_RECORDED_TOKEN, fillTemplate } = await import("../../src/lib/sentences.ts");

const { builderSpec } = config;
const vocabulary = builder.builderVocabulary(everythingBuilt());
const [first, second] = builderSpec.datasets;
assert.ok(first && second, "the builder offers two datasets");
const banded = config.dimensions.find((d) => d.id === "seats_band");
assert.ok(banded);
const unknown = config.unrecordedBand(banded.id);
assert.ok(unknown);
const LONG_GONE = "a value no table holds";
const everything = () => true;
const base: import("../../src/lib/builder.ts").Question = { dataset: first, measure: "share", by: "make", values: [], where: {}, view: null };

// A stand-in for the table reader: each dataset's fields and the values their tables hold. It records what it was asked.
const reader = (tables: Record<string, Record<string, string[]>>) => {
  const asked: { dataset: string; dimension: string; others: string[] }[] = [];
  const read: import("../../src/lib/builder.ts").FieldValuesReader = async (dataset, dimension, others) => {
    asked.push({ dataset, dimension, others: Object.keys(others).sort() });
    const values = tables[dataset]?.[dimension];
    return values ? new Set(values) : undefined;
  };
  return { read, asked };
};

test("a value the table does not hold is found, as a breakdown's value and as a condition's, and a value it holds is not", async () => {
  const { read } = reader({ [first]: { make: ["A", "B"], powertrain: ["P", "Q"] } });
  const q = { ...base, values: ["A", LONG_GONE], where: { powertrain: ["Q", "gone too"] } };
  assert.deepEqual(await builder.absentValues(q, everything, read), [
    { dimension: "make", value: LONG_GONE },
    { dimension: "powertrain", value: "gone too" },
  ]);
  assert.deepEqual(await builder.absentValues({ ...base, values: ["A"], where: { powertrain: ["P", "Q"] } }, everything, read), [], "every value is in its table");
});

test("the second breakdown's values are judged too, and the page's own starting values are not", async () => {
  const { read } = reader({ [first]: { make: ["A"], powertrain: ["P"] } });
  const grid = { ...base, by2: "powertrain", values: ["A"], values2: ["P", LONG_GONE] };
  assert.deepEqual(await builder.absentValues(grid, everything, read), [{ dimension: "powertrain", value: LONG_GONE }]);
  assert.deepEqual(await builder.absentValues({ ...base, values: [LONG_GONE], pageValues: true }, everything, read), []);
});

test("a value is judged by the table of the question's own dataset: one that only another dataset holds is absent, and the other way round", async () => {
  const { read } = reader({ [first]: { powertrain: ["P"] }, [second]: { powertrain: ["P", "only here"] } });
  const where = { powertrain: ["only here"] };
  assert.deepEqual(await builder.absentValues({ ...base, dataset: first, where }, everything, read), [{ dimension: "powertrain", value: "only here" }]);
  assert.deepEqual(await builder.absentValues({ ...base, dataset: second, where }, everything, read), []);
});

test("the table is read among the other conditions only, so its own condition never decides which file is read", async () => {
  const { read, asked } = reader({ [first]: { make: ["A"], powertrain: ["P"], segment: ["S"] } });
  await builder.absentValues({ ...base, values: ["A"], where: { powertrain: ["P"], segment: ["S"] } }, everything, read);
  const seen = Object.fromEntries(asked.map((a) => [a.dimension, a.others]));
  assert.deepEqual(seen, { make: ["powertrain", "segment"], powertrain: ["segment"], segment: ["powertrain"] });
  // A condition with no value yet is not a condition, and a field the data cannot apply is not judged.
  const other = reader({ [first]: { make: ["A"], powertrain: ["P"] } });
  const found = await builder.absentValues({ ...base, values: ["A"], where: { powertrain: [], unreadable: [LONG_GONE] } }, (d) => d !== "unreadable", other.read);
  assert.deepEqual(found, []);
  assert.deepEqual(other.asked.find((a) => a.dimension === "make")?.others, [], "an empty condition is not among the others");
  assert.ok(!other.asked.some((a) => a.dimension === "unreadable"));
});

test("a table that cannot be read judges nothing", async () => {
  const { read } = reader({});
  assert.deepEqual(await builder.absentValues({ ...base, values: [LONG_GONE], where: { powertrain: [LONG_GONE] } }, everything, read), []);
});

test("the question without them keeps the other values, and a condition left with no value goes", () => {
  const q = { ...base, by2: "powertrain", values: ["A", LONG_GONE], values2: ["P", "X"], where: { segment: ["S", "T"], region: ["R"], held: [] } };
  const kept = builder.withoutValues(q, [
    { dimension: "make", value: LONG_GONE },
    { dimension: "powertrain", value: "X" },
    { dimension: "segment", value: "T" },
    { dimension: "region", value: "R" },
  ]);
  assert.deepEqual(kept.values, ["A"]);
  assert.deepEqual(kept.values2, ["P"]);
  assert.deepEqual(kept.where, { segment: ["S"], held: [] });
});

test("a link's old unknown band and a class by an unknown code are found in the real tables, and the link settles to a question that names neither", async () => {
  const read: import("../../src/lib/builder.ts").FieldValuesReader = async (dataset, dimension) => data.fieldValues(dataset, dimension, true);
  const link = builder.readQuestion(`?build.measure=share&build.by=${banded.id}&build.value=${unknown}&build.where.nzta_class=NO_SUCH_CODE`);
  const settled = builder.settle(vocabulary, link);
  assert.deepEqual(settled.values, [unknown], "settle keeps what it is told; the table decides");
  const absent = await builder.absentValues({ ...settled, dataset: "registrations_surviving" }, everything, read);
  assert.deepEqual(absent, [
    { dimension: banded.id, value: unknown },
    { dimension: "nzta_class", value: "NO_SUCH_CODE" },
  ]);
  const again = builder.settle(vocabulary, { ...link, ...builder.withoutValues(settled, absent) });
  assert.ok(![...builder.questionParams(again).values()].some((v) => v === unknown || v === "NO_SUCH_CODE"), "the address no longer names them");
  // The band is held under the not-recorded value now, which the same link may name.
  const named = await builder.absentValues({ ...base, dataset: "registrations_surviving", by: banded.id, values: [NOT_RECORDED_TOKEN] }, everything, read);
  assert.deepEqual(named, []);
});

test("the slice and the fact table hold the same values of a field, and neither holds the unknown band under its old name", async () => {
  // The fixture has a slice of the banded field only; the fact table has both.
  const bySlice = await data.fieldValues("registrations_surviving", banded.id, false);
  const byFacts = await data.fieldValues("registrations_surviving", banded.id, true);
  assert.deepEqual([...bySlice].sort(), [...byFacts].sort());
  assert.ok(bySlice.size > 1);
  assert.ok((await data.fieldValues("registrations_surviving", "nzta_class", true)).size > 1);
  assert.ok(!(await data.fieldValues("registrations_surviving", banded.id, false)).has(unknown));
  assert.ok((await data.fieldValues("registrations_surviving", banded.id, true)).has(NOT_RECORDED_TOKEN));
});

test("the sentence names the value, the field and the data, in the words of config", () => {
  const [text] = builder.absentNotes(first, [{ dimension: banded.id, value: unknown }], (v) => v);
  const field = (banded.public_label ?? banded.label).toLowerCase();
  const dataset = (config.findDataset(first)?.public_label ?? first).toLowerCase();
  assert.equal(text, fillTemplate(builderSpec.notices.absent, { asked: unknown, field, dataset }).text);
  assert.ok(text.includes(`“${unknown}”`) && text.includes(field) && text.includes(dataset));
  assert.doesNotMatch(text, /[{}]/);
});

test("the page runs the check once, against the question's own dataset, and says what it left out", () => {
  const page = readFileSync(new URL("../../src/components/QuestionBuilder.tsx", import.meta.url), "utf8");
  assert.match(page, /absentValues\(asked, canApply, readTable\)/);
  assert.match(page, /fieldValues\(from, field, /);
  assert.match(page, /ask\(withoutValues\(now, absent\), false, true, false\)/);
  // The page hands "not the visitor's" on to the rule every page that holds a question shares, which hands it to settleChange.
  assert.match(page, /changeQuestion\(all, latest\.current, next, canApply, removal\)/);
  const shared = readFileSync(new URL("../../src/lib/builder.ts", import.meta.url), "utf8");
  assert.match(shared, /settleChange\(all, current, asked, removal\)/);
  assert.match(page, /\.\.\.absentNotes\(asked\.dataset, absent, valueLabel\)/);
});

test("a condition dropped because its value is absent does not widen the question: the condition its breakdown calls for comes back, as for the same link without it", async () => {
  const [rule] = Object.values(builderSpec.narrowings);
  const field = "power_band";
  assert.ok(rule && vocabulary.narrowings?.[field]?.some((n) => n.dimension === rule.dimension), "the breakdown calls for the configured condition");
  const link = builder.readQuestion(`?build.measure=share&build.by=${field}&build.where.${rule.dimension}=Bogus`);
  const settled = builder.settle(vocabulary, link);
  assert.deepEqual(settled.where, { [rule.dimension]: ["Bogus"] }, "the link's own condition stands until the table says otherwise");
  const absent = await builder.absentValues(settled, everything, async () => new Set(["not Bogus"]));
  assert.deepEqual(absent, [{ dimension: rule.dimension, value: "Bogus" }]);
  const asked = { ...settled, ...builder.withoutValues(settled, absent) };
  const after = builder.settleChange(vocabulary, settled, asked, false);
  assert.deepEqual(after.where, { [rule.dimension]: [rule.value] });
  assert.equal(after.widened, undefined);
  const params = builder.questionParams(after);
  assert.deepEqual(params.getAll(`build.where.${rule.dimension}`), [rule.value]);
  assert.equal(params.has("build.widen"), false);
  assert.equal(builder.narrowingNotes(vocabulary, after).length, 1, "the sentence that says the question starts narrowed");
  // The same link without the condition settles to the same question.
  assert.deepEqual(builder.settle(vocabulary, builder.readQuestion(`?build.measure=share&build.by=${field}`)).where, after.where);
  // A removal by the visitor is still remembered as one.
  const removed = builder.settleChange(vocabulary, after, { ...after, where: {} }, true);
  assert.deepEqual(removed.widened, [rule.dimension]);
});
