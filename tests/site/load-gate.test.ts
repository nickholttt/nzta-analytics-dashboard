// The order Explore fetches its charts in (src/lib/loadGate.ts, D-099): the gate, and where a panel is read to be near the screen.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { isNearScreen, openGate, whenGateOpens } = await import("../../src/lib/loadGate.ts");
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("a panel is near when it is within a screen's height above or below the visible part, and not otherwise", () => {
  const view = 800;
  assert.equal(isNearScreen({ top: 100, bottom: 600 }, view), true, "on the screen");
  assert.equal(isNearScreen({ top: 1600, bottom: 2100 }, view), true, "a screen below the bottom edge");
  assert.equal(isNearScreen({ top: 1601, bottom: 2100 }, view), false, "one pixel further");
  assert.equal(isNearScreen({ top: -1200, bottom: -800 }, view), true, "a screen above the top edge");
  assert.equal(isNearScreen({ top: -1200, bottom: -801 }, view), false);
  // A tall panel that spans the screen is near whatever its top and bottom are.
  assert.equal(isNearScreen({ top: -5000, bottom: 5000 }, view), true);
  // The page as it is laid out once the first chart has drawn: the panels that were all "near" while they were short placeholders
  // sit thousands of pixels down.
  for (const top of [2255, 2776, 4077, 8394]) assert.equal(isNearScreen({ top, bottom: top + 500 }, 844), false, String(top));
  assert.equal(isNearScreen({ top: 1700, bottom: 2200 }, 800, 2), true, "a wider margin");
});

test("a run waits for the gate, runs once when it opens, and runs at once after; a cancelled run does not run", () => {
  const ran: string[] = [];
  whenGateOpens(() => ran.push("waiting"));
  const cancel = whenGateOpens(() => ran.push("cancelled"));
  cancel();
  assert.deepEqual(ran, []);
  openGate();
  openGate();
  assert.deepEqual(ran, ["waiting"]);
  whenGateOpens(() => ran.push("after"));
  assert.deepEqual(ran, ["waiting", "after"]);
});

test("the panel opens the gate when the first chart is drawn, and reads where each deferred panel is again after the page has settled", () => {
  const panel = read("src/components/PresetPanel.tsx");
  // The first chart: its figure appearing opens the gate, with a fallback so a chart that never draws cannot hold the page back.
  assert.match(panel, /sentinel\.querySelector\("\[role=img\]"\)/);
  assert.match(panel, /new MutationObserver\(\(\) => drawn\(\) && openGate\(\)\)/);
  assert.match(panel, /setTimeout\(openGate, 4000\)/);
  // A deferred panel: after two frames, its place as laid out now, and without an observer the page's charts load as before.
  assert.match(panel, /isNearScreen\(sentinel\.getBoundingClientRect\(\), window\.innerHeight\)/);
  assert.match(panel, /typeof IntersectionObserver === "undefined" \|\|/);
  assert.match(panel, /setLooked\(\(n\) => n \+ 1\)/);
  // A link to a chart, and a chart that is not deferred, still load at once.
  assert.match(panel, /useState\(!defer \|\| linked\)/);
});
