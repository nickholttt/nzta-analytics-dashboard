// Tests for the sentences the site writes about the data (src/lib/sentences.ts), run with Node's own test runner:
//   node --test "tests/site/*.test.ts"
// They read the real phrase templates from config, so a template that stops producing a sentence fails here. The last
// group reads the charts' source to check they hand the module whole rows and use what it returns.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addMonths, answerLine, count, fillTemplate, hoverLine, monthLabel, monthsOf, percent, rankingText, sayBadMonth, sayOffChart } from "../../src/lib/sentences.ts";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const json = (path: string) => JSON.parse(read(path));
const presets = json("config/presets.json");
const dimensions = json("config/dimensions.json");
const phrases = presets.defaults.phrases;
const answer = presets.groups.flatMap((g: { presets: { answer?: never }[] }) => g.presets).find((p: { answer?: unknown }) => p.answer).answer;
const words = dimensions.datasets.find((d: { shows_year_change?: boolean }) => d.shows_year_change).words;
const FLOOR = 50;

type Row = { month: string; denominator: number };

// A dataset with every month from 2021-01 to 2026-10: 20,000 in each month of 2022, 21,000 in 2023-11, 23,554 otherwise.
function monthly(): Row[] {
  const rows: Row[] = [];
  for (let y = 2021; y <= 2026; y++)
    for (let k = 1; k <= 12; k++) {
      const month = `${y}-${String(k).padStart(2, "0")}`;
      if (month > "2026-10") continue;
      rows.push({ month, denominator: y === 2022 ? 20000 : month === "2023-11" ? 21000 : 23554 });
    }
  return rows;
}
const withMonth = (rows: Row[], month: string, denominator: number) => rows.map((r) => (r.month === month ? { ...r, denominator } : r));

test("hoverLine reads like the answer sentence: direction, size, then the month", () => {
  const rows = withMonth(monthly(), "2025-10", 21091);
  const line = hoverLine(phrases, rows, "2026-10", FLOOR);
  assert.equal(line, "Up 12% on Oct 2025 (21,091)");
  assert.doesNotMatch(line, /Up on/);
});

test("hoverLine says a missing year-ago month and a too-small one in different words", () => {
  assert.equal(hoverLine(phrases, monthly(), "2021-06", FLOOR), "No figures a year earlier to compare with");
  assert.equal(hoverLine(phrases, withMonth(monthly(), "2025-10", 10), "2026-10", FLOOR), "The same month a year earlier has too few vehicles to compare with");
});

test("answerLine reads the year-ago month from the rows it is given, and a window-limited set of rows loses it", () => {
  const all = monthly();
  const full = answerLine(answer, all, "2023-11", FLOOR);
  assert.equal(full?.sentence, "In Nov 2023, 21,000 vehicles were registered, up 5.0% on Nov 2022, when 20,000 were.");
  assert.equal(full?.figure, "21,000");
  const windowed = all.filter((r) => r.month >= "2023-11");
  assert.equal(answerLine(answer, windowed, "2023-11", FLOOR)?.sentence, "In Nov 2023, 21,000 vehicles were registered.");
  assert.equal(monthsOf(all)[0], "2026-10");
  assert.equal(monthsOf(all).length, 70);
});

test("answerLine gives the plain form only for a missing or under-floor year-ago month", () => {
  assert.equal(answerLine(answer, monthly(), "2021-06", FLOOR)?.sentence, "In Jun 2021, 23,554 vehicles were registered.");
  assert.equal(answerLine(answer, withMonth(monthly(), "2025-10", 10), "2026-10", FLOOR)?.sentence, "In Oct 2026, 23,554 vehicles were registered.");
});

test("answerLine says unchanged, and a fall", () => {
  assert.equal(answerLine(answer, monthly(), "2025-06", FLOOR)?.sentence, "In Jun 2025, 23,554 vehicles were registered, the same as in Jun 2024, when 23,554 were.");
  assert.equal(answerLine(answer, monthly(), "2022-06", FLOOR)?.sentence, "In Jun 2022, 20,000 vehicles were registered, down 15% on Jun 2021, when 23,554 were.");
});

const ranking = (end: string, span: number, rows: Row[] = monthly()) =>
  rankingText(phrases, { basis: words.ranking_basis, span, end, latest: "2026-10", monthsPresent: rows.map((r) => r.month) });

test("rankingText decides from the rows that a June 2021 ranking has no earlier figures, and does not describe a comparison", () => {
  const { text, hasPrior } = ranking("2021-06", 1);
  assert.equal(hasPrior, false);
  assert.doesNotMatch(text, /compares each rank|Jun 2020/);
  assert.equal(text, "Ranked by vehicles first registered in Jun 2021. There are no figures a year earlier, so no move or change is shown.");
});

test("rankingText names the months an earlier window covers when the rows have them", () => {
  assert.deepEqual(ranking("2023-11", 1), {
    hasPrior: true,
    text: "Ranked by vehicles first registered in Nov 2023. The move compares each rank with the same month a year earlier (Nov 2022).",
  });
  assert.equal(
    ranking("2026-10", 12).text,
    "Ranked by vehicles first registered in the last 12 months (Nov 2025 to Oct 2026). The move compares each rank with the same 12 months a year earlier (Nov 2024 to Oct 2025).",
  );
  // A 12-month ranking ending before the data has 12 earlier months has no comparison either.
  assert.equal(ranking("2021-12", 12).hasPrior, false);
});

test("a month the address names that is not shown, or is off the drawn range, is said", () => {
  assert.equal(sayBadMonth(phrases.bad_month, "2019-01", "2026-10"), "The address asked for 2019-01, which this chart has no figures for, so Oct 2026 is shown.");
  assert.equal(sayBadMonth(phrases.bad_month, "2026-10", "2026-10"), undefined);
  assert.equal(sayBadMonth(phrases.bad_month, undefined, "2026-10"), undefined);
  assert.equal(sayOffChart(phrases.month_off_chart, "2021-06", "2023-11", "2026-10"), "Jun 2021 is outside the time range drawn here, so it is not marked on the chart. Choose a longer range to see it.");
  assert.equal(sayOffChart(phrases.month_off_chart, "2024-01", "2023-11", "2026-10"), undefined);
});

test("one rule writes a proportion, and a template that cannot be filled is known", () => {
  assert.equal(percent(0.117), "12%");
  assert.equal(percent(0.057), "5.7%");
  assert.deepEqual(fillTemplate("a {x} and {y.z}", { x: "1" }), { text: "a 1 and ?", unresolved: ["y.z"] });
});

// The charts' own use of the module: these read source, because the components need a browser to run.
const trend = read("src/components/TrendChart.tsx");
const league = read("src/components/LeagueChart.tsx");

test("TrendChart hands the sentence functions the dataset's whole rows and writes no hover wording of its own", () => {
  assert.match(trend, /answerLine\(preset\.answer, rows,/);
  assert.match(trend, /hoverLine\(phrases, rows,/);
  assert.doesNotMatch(trend, /"Up on"|"Down on"|"Same as"|Up on|Down on/);
  assert.doesNotMatch(trend, /answerLine\([^)]*(points|window)/i);
});

test("LeagueChart takes whether there are earlier figures from rankingText, never from a value of its own", () => {
  assert.match(league, /rankingText\(phrases,/);
  assert.match(league, /const hasPrior = ranking\.hasPrior;/);
  assert.doesNotMatch(league, /hasPrior\s*[:=]\s*true/);
});

test("count writes a whole number with the group separator, rounded, as toLocaleString does", () => {
  for (const n of [0, 1, 999, 1000, 21091, 1234567.4, 1234567.5, -2500, 0.4]) assert.equal(count(n), Math.round(n).toLocaleString("en-NZ"));
  assert.equal(count(21091), "21,091");
});

test("addMonths moves a month key across year ends in either direction, and monthLabel reads it as a reader would", () => {
  assert.equal(addMonths("2026-10", 1), "2026-11");
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(addMonths("2026-10", -11), "2025-11");
  assert.equal(addMonths("2026-10", 0), "2026-10");
  assert.equal(addMonths("1961-01", 789), "2026-10");
  assert.equal(monthLabel("2026-08"), "Aug 2026");
  assert.equal(monthLabel("2026-08"), "Aug 2026");
});
