// A plain GET form always sends every field, so an address can carry an empty condition or value ("any powertrain", "no other brand"). The canvas reads that as
// no condition and no value, and writes the address back without it.
import "./support/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { realisticBuilt } from "./support/observe.ts";

const canvas = await import("../../src/lib/canvas.ts");
const builder = await import("../../src/lib/builder.ts");

const built = realisticBuilt();
const all = canvas.canvasVocabulary(builder.builderVocabulary(built));
const base = "canvas.charts=c1&c1.measure=count&c1.by=make&c1.dataset=registrations_flow&c1.type=league&c1.size=full";

test("an empty condition or an empty value is dropped when the address is read", () => {
  const q = builder.readQuestion(`${base}&c1.where.import_status=&c1.where.powertrain=&c1.value=&c1.value=ONE&c1.value=`, "c1");
  assert.deepEqual({ ...q.where }, {});
  assert.deepEqual(q.values, ["ONE"]);
  const plain = builder.readQuestion(`${base}&c1.where.import_status=NZ+New`, "c1");
  assert.deepEqual({ ...plain.where }, { import_status: ["NZ New"] });
});

test("a canvas opened from an address with empty fields asks what the address without them asks, and writes the shorter address back", () => {
  const withEmpty = `?${base}&c1.where.import_status=&c1.where.powertrain=&c1.value=`;
  const without = `?${base}`;
  const open = (search: string) => canvas.withFittingTypes(canvas.settleCanvas(all, canvas.readCanvas(search)), built);
  const a = open(withEmpty);
  const b = open(without);
  assert.deepEqual(a.charts[0].question, b.charts[0].question);
  assert.deepEqual([...canvas.canvasAddress(withEmpty, a)].sort(), [...canvas.canvasAddress(without, b)].sort());
  assert.ok(![...canvas.canvasAddress(withEmpty, a).keys()].some((k) => k.startsWith("c1.where.")));
});
