// The no-script switch with two choices (src/components/ViewSwitch.astro, src/styles/view-switch.css), on the built pages when dist/ is there: the period inputs carry values
// that the condition rules never match, the default period's input is checked and its panels are the ones marked as the default, and every windowed panel names both choices.
// This holds the markup's logic, not the look.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const built = existsSync(join("dist", "index.html")) && existsSync(join("dist", "brand", "toyota", "index.html"));
const page = (path: string) => readFileSync(join("dist", path, "index.html"), "utf8");

// The panels of a switch: [data-view, data-win, has data-win-default].
const panels = (html: string) => [...html.matchAll(/<div class="vs-panel"([^>]*)>/g)].map((m) => ({ view: /data-view="(\d+)"/.exec(m[1])?.[1], win: /data-win="(w\d+)"/.exec(m[1])?.[1], isDefault: /data-win-default/.test(m[1]) }));
const checked = (html: string, name: string) => [...html.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map((m) => m[0]).filter((t) => t.includes(`name="${name}"`) && /\bchecked\b/.test(t)).map((t) => /value="([^"]*)"/.exec(t)?.[1]);

for (const [path, scope, defaultWindow, blocks] of [["", "lm-view", "w0", 6], ["brand/toyota", "ap-scope", "w2", 3], ["powertrain/bev", "ap-scope", "w2", 4]] as const) {
  test(`${path || "the front page"}: the default period is checked, and its three panels in each block are marked as the default`, { skip: !built }, () => {
    const html = page(path);
    assert.deepEqual(checked(html, `${scope}-win`), [defaultWindow]);
    assert.deepEqual(checked(html, scope), ["0"], "the first count is chosen");
    const all = panels(html);
    assert.equal(all.length, blocks * 12, "every block has a panel for each period and each count");
    assert.ok(all.every((p) => p.view !== undefined && p.win !== undefined));
    const marked = all.filter((p) => p.isDefault);
    assert.equal(marked.length, blocks * 3);
    assert.ok(marked.every((p) => p.win === defaultWindow));
    // the period inputs are never read as a count: their values are not the digits the count rules match
    const periodValues = [...html.matchAll(/name="[^"]*-win"[^>]*value="([^"]*)"/g)].map((m) => m[1]);
    assert.ok(periodValues.length >= 4 && periodValues.every((v) => /^w\d$/.test(v)));
  });
}

test("a table with one choice (the index) has no period and marks no default period", { skip: !built }, () => {
  const html = page("brands");
  assert.equal(panels(html).filter((p) => p.win !== undefined).length, 0);
  assert.deepEqual(checked(html, "ap-league-view"), ["0"]);
});
