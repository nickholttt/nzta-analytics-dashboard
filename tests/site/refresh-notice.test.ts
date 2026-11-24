// The notice that a whole month has ended which the site does not show yet: the first day it is due and the month it names
// (src/lib/refreshNotice.ts), the script that shows it, run from its own text as the page carries it, and its words (config/site.json).
//   node --test "tests/site/*.test.ts"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import "./support/register.mjs";

const { refreshDue, revealRefreshNotice } = await import("../../src/lib/refreshNotice.ts");
const { fillTemplate } = await import("../../src/lib/sentences.ts");
const root = fileURLToPath(new URL("../..", import.meta.url));
const site = JSON.parse(readFileSync(join(root, "config/site.json"), "utf8"));
const rules = JSON.parse(readFileSync(join(root, "config/narrative/rules.json"), "utf8"));

test("the notice is due on the first day of the month after the one the snapshot does not cover", () => {
  // A snapshot on the last day, mid-month and on the first day all behave the same: October is covered, November is missing, 1 December is due.
  for (const snapshot of ["2026-10-31", "2026-10-15", "2026-10-01"]) {
    const result = refreshDue(snapshot);
    assert.equal(result?.due, "2026-12-01", snapshot);
    assert.equal(result?.month, "2026-11", snapshot);
    assert.equal(result?.label, "Nov 2026", snapshot);
  }
});

test("the year end rolls into the next year, in both steps", () => {
  assert.deepEqual(refreshDue("2026-12-31"), { due: "2027-02-01", month: "2027-01", label: "Jan 2027" });
  assert.deepEqual(refreshDue("2026-11-30"), { due: "2027-01-01", month: "2026-12", label: "Dec 2026" });
});

test("a 31-day month and a 28-day month: the day of the snapshot does not matter, only its month", () => {
  assert.deepEqual(refreshDue("2026-01-31"), { due: "2026-03-01", month: "2026-02", label: "Feb 2026" });
  assert.deepEqual(refreshDue("2026-02-28"), { due: "2026-04-01", month: "2026-03", label: "Mar 2026" });
  // 29 February exists in a leap year, and only then.
  assert.deepEqual(refreshDue("2028-02-29"), { due: "2028-04-01", month: "2028-03", label: "Mar 2028" });
  assert.equal(refreshDue("2026-02-29"), null);
});

test("a date that is not a real day gives no notice", () => {
  for (const bad of ["", "soon", "2026-10", "2026-13-01", "2026-00-10", "2026-10-32", "2026-04-31", "26-10-31", "2026-10-31T00:00:00Z", " 2026-10-31", null, undefined, 20261031]) {
    assert.equal(refreshDue(bad), null, `${JSON.stringify(bad)} is not a snapshot date`);
  }
});

// A stand-in for the page: one notice, hidden, carrying a due date.
function page(due: string | null, hidden = true) {
  const attributes = new Map<string, string>(due === null ? [] : [["data-refresh-due", due]]);
  const notice = {
    hidden,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    removeAttribute: (name: string) => void (name === "hidden" && (notice.hidden = false)),
  };
  return { notice, doc: { querySelector: (selector: string) => (selector === "[data-refresh-due]" && due !== null ? notice : null) } };
}

// The page carries the function's own text, so that is what runs here.
const carried = new Function(`return (${revealRefreshNotice})`)() as (doc: unknown, now: Date) => void;
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 30);

test("the script shows the notice on the due date and after it, from the visitor's own date, and not before", () => {
  const cases: [Date, boolean][] = [
    [local(2026, 11, 30, 23), false],
    [local(2026, 12, 1, 0), true],
    [local(2026, 12, 1, 12), true],
    [local(2027, 1, 15), true],
    [local(2026, 10, 31), false],
    [local(2025, 12, 31), false],
  ];
  for (const [now, shown] of cases) {
    const { notice, doc } = page("2026-12-01");
    carried(doc, now);
    assert.equal(notice.hidden, !shown, now.toString());
  }
});

test("the script does nothing for a missing or malformed due date, and no notice on the page is no error", () => {
  for (const due of [null, "", "tomorrow", "2026-12", "2026-12-1"]) {
    const { notice, doc } = page(due);
    carried(doc, local(2030, 1, 1));
    assert.equal(notice.hidden, true, `${JSON.stringify(due)}`);
  }
});

test("the script uses nothing outside its parameters and the browser: no request, no storage", () => {
  const text = revealRefreshNotice.toString();
  for (const word of ["fetch", "XMLHttpRequest", "localStorage", "sessionStorage", "cookie", "sendBeacon", "import"]) assert.doesNotMatch(text, new RegExp(word), word);
});

test("the notice's words fill from the month and the date alone, and say what is so, not why: no figure, no cause, no promise of a day", () => {
  const { label, text } = site.refresh_notice;
  assert.ok(label && text);
  for (const [what, words] of [["label", label], ["text", text]] as const) {
    const bare = words.replace(/\{[^}]*\}/g, " ");
    assert.doesNotMatch(bare, /\d/, `${what} holds a digit`);
    for (const word of rules.banned_words) assert.doesNotMatch(bare.toLowerCase(), new RegExp(`\b${word}\b`), `${what} holds "${word}"`);
  }
  const used = [...text.matchAll(/\{([a-z_]+)(?:\|[a-z]+)?\}/g)].map((m) => m[1]);
  assert.ok(used.length > 0 && used.every((name) => rules.placeholders.refresh_notice.includes(name)), "a placeholder the code does not fill");
  const filled = fillTemplate(text, { month: "Nov 2026", date: "2026-10-31" });
  assert.deepEqual(filled.unresolved, []);
  assert.match(filled.text, /Nov 2026/);
  assert.match(filled.text, /31 October 2026/);
  assert.doesNotMatch(filled.text, /\b(will|expect|soon|published (it|them|the)|has published|have published|delay|late)\b/i);
});
