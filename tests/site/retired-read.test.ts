// A link that names a retired dataset (config/dimensions.json, retired_datasets) is read as the dataset it joined, narrowed to what the old one
// counted (src/lib/builder.ts, readRetired). These are the rules of the reader, on a made-up retired block, so no real dataset, field or value is
// named; the repository's own links are held to the real block in retired-links.test.ts. Run with Node's own test runner:
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { everythingBuilt } from "./support/observe.ts";

const builder = await import("../../src/lib/builder.ts");
const config = await import("../../src/lib/config.ts");

const [target] = config.datasets;
const OLD = "an_old_dataset_id";
const FIELD = "a_field";
const retired = {
  [OLD]: { to: target.id, label: "Old counts", where: { [FIELD]: ["x", "y"] } },
  plain: { to: target.id, label: "Plain old counts" },
};
const read = (query: string) => builder.readRetired(builder.readQuestion(`?${query}`, "c1"), retired);
const asked = (partial: Partial<import("../../src/lib/builder.ts").Question>) => builder.readRetired(partial, retired);

test("a retired id is read as the dataset it joined, with the old dataset's conditions, and says which id the link named", () => {
  const q = asked({ dataset: OLD, measure: "count", where: Object.assign(Object.create(null), {}) });
  assert.equal(q.dataset, target.id);
  assert.deepEqual({ ...q.where }, { [FIELD]: ["x", "y"] });
  assert.equal(q.retiredFrom, OLD);
});

test("a retired id with no conditions only changes the dataset", () => {
  const q = asked({ dataset: "plain", measure: "count", where: Object.assign(Object.create(null), { other: ["z"] }) });
  assert.equal(q.dataset, target.id);
  assert.deepEqual({ ...q.where }, { other: ["z"] });
  assert.equal(q.retiredFrom, "plain");
});

test("the link's own values for a narrowed field meet the old list by intersection, and with nothing in common the old list stands", () => {
  const w = (values: string[]) => Object.assign(Object.create(null), { [FIELD]: values });
  assert.deepEqual({ ...asked({ dataset: OLD, where: w(["y", "q"]) }).where }, { [FIELD]: ["y"] });
  assert.deepEqual({ ...asked({ dataset: OLD, where: w(["x", "y"]) }).where }, { [FIELD]: ["x", "y"] });
  assert.deepEqual({ ...asked({ dataset: OLD, where: w(["q"]) }).where }, { [FIELD]: ["x", "y"] });
  assert.deepEqual({ ...asked({ dataset: OLD, where: w([]) }).where }, { [FIELD]: ["x", "y"] });
});

test("a breakdown by the narrowed field keeps only the values the old dataset counted, in both positions", () => {
  const q = asked({ dataset: OLD, by: FIELD, values: ["x", "q"], by2: FIELD, values2: ["q", "y"], where: Object.assign(Object.create(null), {}) });
  assert.deepEqual(q.values, ["x"]);
  assert.deepEqual(q.values2, ["y"]);
  // A breakdown by another field is left alone.
  assert.deepEqual(asked({ dataset: OLD, by: "other", values: ["q"], where: Object.assign(Object.create(null), {}) }).values, ["q"]);
});

test("an id the block does not list is read as it is, and so is a link with no dataset, whatever the id looks like", () => {
  const same = { dataset: target.id, measure: "count" };
  assert.equal(asked(same), same);
  const none = { measure: "count" };
  assert.equal(asked(none), none);
  for (const id of ["constructor", "__proto__", "toString", "hasOwnProperty"]) assert.equal(asked({ dataset: id }).dataset, id, id);
});

test("an address that names a retired id is read through readQuestion, and with no block of config's own naming it, nothing changes", () => {
  const q = read(`c1.dataset=${OLD}&c1.measure=count&c1.by=&c1.where.${FIELD}=y`);
  assert.equal(q.dataset, target.id);
  assert.deepEqual({ ...q.where }, { [FIELD]: ["y"] });
  const live = builder.readQuestion(`?c1.dataset=${OLD}&c1.measure=count`, "c1");
  assert.equal(live.dataset, OLD, "an id config does not retire is left as the link wrote it");
  assert.equal(live.retiredFrom, undefined);
});

test("the address a page writes never carries what readRetired added: the retired id and its note are not in it", () => {
  const settled = builder.settle(builder.builderVocabulary(everythingBuilt()), { dataset: target.id, measure: "count", retiredFrom: OLD });
  assert.equal(settled.retiredFrom, undefined);
  const text = String(builder.questionParams(settled, "c1"));
  assert.ok(!text.includes(OLD));
});

test("a link to a retired id is told what became of it, in config's words: one sentence when it counted the same, another when it counted fewer vehicles", () => {
  const vocabulary = builder.builderVocabulary(everythingBuilt());
  const notices = config.builderSpec.notices;
  const label = (v: string) => v.toUpperCase();
  const narrowed = builder.settle(vocabulary, asked({ dataset: OLD, measure: "count", where: Object.assign(Object.create(null), {}) }));
  const [first] = builder.linkNotices(vocabulary, asked({ dataset: OLD, measure: "count", where: Object.assign(Object.create(null), {}) }), narrowed, label, retired);
  assert.ok(first.startsWith("This link was made for old counts"), first);
  assert.match(first, /X and Y/);
  assert.ok(first.includes(notices.retired_narrowed.split("{")[0]));
  const plainAsk = asked({ dataset: "plain", measure: "count", where: Object.assign(Object.create(null), {}) });
  const plain = builder.linkNotices(vocabulary, plainAsk, builder.settle(vocabulary, plainAsk), label, retired);
  assert.ok(plain[0].startsWith("This link was made for plain old counts, which is now "), plain[0]);
  assert.ok(!/X and Y/.test(plain[0]));
  // A link whose own condition keeps part of the old list is told that part, not the whole list the old dataset counted.
  const own = asked({ dataset: OLD, measure: "count", where: Object.assign(Object.create(null), { [FIELD]: ["y"] }) });
  const [part] = builder.linkNotices(vocabulary, own, builder.settle(vocabulary, own), label, retired);
  assert.match(part, /It keeps Y,/);
  assert.ok(!/X/.test(part), part);
  // A link that names no retired id is told nothing of one.
  const fine = { dataset: target.id, measure: "count", where: Object.assign(Object.create(null), {}) };
  assert.ok(builder.linkNotices(vocabulary, fine, builder.settle(vocabulary, fine), label, retired).every((n) => !n.startsWith("This link was made for")));
});
