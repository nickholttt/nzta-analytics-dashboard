// A ranking with a hidden value (src/lib/league.ts, D-139): the hidden value has no count, no rank and no share, and is listed after the ranked ones with
// each of those cells marked hidden and blank in the file, never a zero; the shares of the others are shares of every vehicle; a leader is named only where no
// hidden count can match it; a period that is not broken down is said, not ranked; a dataset with one period has no move, change or rank before.
// Synthetic rows with made-up values. Nothing here is a figure of the register.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { leaderIsClear, leagueRows, leagueTable } = await import("../../src/lib/league.ts");
const { cellText, figuresCsv } = await import("../../src/lib/figures.ts");
const { fillTemplate } = await import("../../src/lib/sentences.ts");
const { phrases } = await import("../../src/lib/config.ts");
const { pct, shareChange } = await import("../../src/lib/measures.ts");

const MONTH = "2026-10";
const row = (value: string, n: number | undefined, extra: object = {}) => ({ month: MONTH, value, n: n ?? Number.NaN, denominator: 920, ...(n === undefined ? { hidden: true } : {}), ...extra });
const rows = [row("alpha", 600), row("beta", 300), row("gamma", undefined), row("delta", undefined)];
const input = { rows, currentFrom: MONTH, end: MONTH, priorFrom: "2025-10", priorTo: "2025-10", hasPrior: false, topN: 15, nameOf: (v: string) => v, yearFloor: 50 };

test("a hidden value is not ranked and not counted: it is listed apart, and the others keep their ranks and their share of every vehicle", () => {
  const r = leagueRows(input);
  assert.deepEqual(r.items.map((i) => [i.name, i.rank, i.n]), [["alpha", 1, 600], ["beta", 2, 300]]);
  assert.deepEqual(r.hidden.map((h) => h.name), ["delta", "gamma"], "in name order");
  assert.equal(r.currentDenom, 920, "the total still counts every vehicle");
  assert.ok(Math.abs(r.items[0].share - 600 / 920) < 1e-12, "a share is of every vehicle, hidden ones included");
  assert.equal(r.hiddenAtMost, 20, "the most a hidden value can hold is the total less the values shown");
  assert.equal(r.notBrokenDown, false);
});

test("a table with nothing hidden has no hidden list and no bound", () => {
  const r = leagueRows({ ...input, rows: [row("alpha", 600), row("beta", 320)] });
  assert.deepEqual(r.hidden, []);
  assert.equal(r.hiddenAtMost, 0);
});

test("a leader is named only where no hidden count can match it", () => {
  assert.equal(leaderIsClear(600, 20), true);
  assert.equal(leaderIsClear(20, 20), false, "level with what a hidden value could hold");
  assert.equal(leaderIsClear(10, 20), false);
  assert.equal(leaderIsClear(5, 0), true, "nothing hidden");
});

test("a period that is not broken down is reported, with no value to rank", () => {
  const r = leagueRows({ ...input, rows: [{ month: MONTH, value: "__NOT_BROKEN_DOWN__", n: 920, denominator: 920, notBrokenDown: true }] });
  assert.equal(r.notBrokenDown, true);
  assert.deepEqual(r.items, []);
  assert.deepEqual(r.hidden, []);
  assert.equal(r.currentDenom, 920);
});

const words = { noYearAgo: "No year", yearTooFew: "few", shareChangeNoPrior: "none", notRankedBefore: "not before" };
const hiddenWords = { text: "hidden", reason: "Counts under 10 are not shown." };
const table = (compares: boolean) => {
  const r = leagueRows(input);
  return leagueTable(r.items, {
    hasPrior: false, showYear: false, guard: { shares: false, changes: false }, floor: 200, valueHeading: "Field", countHeading: "Vehicles", words,
    format: { count: (n) => n.toLocaleString("en-NZ"), pct, shareChange, yearChange: String }, compares, hiddenValues: r.hidden, hiddenWords,
  });
};

test("the table lists a hidden value after the ranked ones with its rank, share and count each marked hidden and blank, never 0", () => {
  const t = table(true);
  assert.equal(t.rows.length, 4);
  const names = t.rows.map((r) => cellText(r[2]));
  assert.deepEqual(names, ["alpha", "beta", "delta", "gamma"]);
  const keyAt = (key: string) => t.columns.findIndex((c) => c.key === key);
  for (const hidden of t.rows.slice(2)) {
    for (const key of ["rank", "share", "count"]) {
      const cell = hidden[keyAt(key)];
      assert.ok(typeof cell !== "string");
      if (typeof cell === "string") continue;
      assert.equal(cell.mark, "hidden", key);
      assert.equal(cell.csv, null, `${key} is blank in the file`);
      assert.equal(cell.text, "hidden");
      assert.notEqual(cell.text, "0");
      assert.equal(cell.reason, hiddenWords.reason);
    }
  }
});

test("the file marks the hidden cells as hidden, in a column of reasons, and writes no count for them", () => {
  const t = table(true);
  const header = { question: "Q", counted: "A definition.", datasets: ["D"], snapshot: "2026-10-31", sources: [], attributions: [], address: "https://x.test/" };
  const text = figuresCsv(header, { period: "Oct 2026", columns: t.columns, rows: t.rows }, phrases);
  const lines = text.trim().split("\r\n");
  assert.ok(lines.some((l) => l.startsWith("# Snapshot: 2026-10-31")));
  assert.ok(lines.some((l) => l.startsWith("# What is counted: A definition.")));
  assert.ok(lines.some((l) => /^# Greyed, withheld or hidden: .*hidden/.test(l)), "the marks line names hidden");
  const body = lines.filter((l) => !l.startsWith("#") && /delta|gamma/.test(l));
  assert.equal(body.length, 2);
  for (const line of body) {
    assert.doesNotMatch(line, /,0,|,0$/, "no zero");
    assert.match(line, /Rank: hidden, counts under 10 are not shown.*Share \(%\): hidden.*Vehicles: hidden/, "the last column says which cells and why");
  }
  const alpha = lines.find((l) => /alpha/.test(l) && !l.startsWith("#")) as string;
  assert.doesNotMatch(alpha, /hidden/, "a shown value carries no mark");
});

test("a file without a hidden cell is worded as before: no mention of hidden", () => {
  const t = leagueTable(leagueRows({ ...input, rows: [row("alpha", 600), row("beta", 320)] }).items, {
    hasPrior: false, showYear: false, guard: { shares: false, changes: false }, floor: 200, valueHeading: "Field", countHeading: "Vehicles", words,
    format: { count: String, pct, shareChange, yearChange: String },
  });
  const header = { question: "Q", datasets: ["D"], snapshot: "2026-10-31", sources: [], attributions: [], address: "a" };
  assert.doesNotMatch(figuresCsv(header, { period: "p", columns: t.columns, rows: t.rows }, phrases), /hidden/i);
});

test("a table without the words for a hidden cell refuses to write one: nothing is left blank by accident", () => {
  const r = leagueRows(input);
  assert.throws(() =>
    leagueTable(r.items, { hasPrior: false, showYear: false, guard: { shares: false, changes: false }, floor: 200, valueHeading: "F", countHeading: "V", words, format: { count: String, pct, shareChange, yearChange: String }, hiddenValues: r.hidden }),
  );
});

test("a dataset of one period has no move, no change in share and no rank before; the columns that remain are rank, name, share and count", () => {
  const t = table(false);
  assert.deepEqual(t.columns.map((c) => c.key), ["rank", "name", "share", "count"]);
  for (const r of t.rows) assert.equal(r.length, 4, "every row has as many cells as columns");
});

test("the words about hidden counts are in config, fill from the least count, and say neither zero nor why", () => {
  for (const key of ["hidden_word", "hidden_reason", "hidden_ranking_note", "hidden_ranking_note_one", "not_broken_down", "hidden_link"] as const) {
    const text = fillTemplate(phrases[key], { minimum: 10, count: 2, window: "in Oct 2026", vehicles: "920 vehicles" });
    assert.deepEqual(text.unresolved, [], key);
    assert.doesNotMatch(text.text, /\b0\b|zero/i, key);
  }
  assert.match(fillTemplate(phrases.hidden_ranking_note, { minimum: 10, count: 2 }).text, /^2 values have a hidden count and no bar\. Counts under 10/);
});
