// Tests for the sentences the site writes about the data (src/lib/sentences.ts), run with Node's own test runner:
//   node --test tests/site/
// They read the real phrase templates from config, so a template that stops producing a sentence fails here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fillTemplate, percent, sayAnswer, sayBadMonth, sayRanking, sayYearChange, yearChange } from "../../src/lib/sentences.ts";

const read = (path: string) => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const presets = read("config/presets.json");
const dimensions = read("config/dimensions.json");
const phrases = presets.defaults.phrases;
const yearPhrases = { up: phrases.year_up, down: phrases.year_down, same: phrases.year_same };
const answer = presets.groups.flatMap((g: { presets: { answer?: never }[] }) => g.presets).find((p: { answer?: unknown }) => p.answer).answer;
const words = dimensions.datasets.find((d: { shows_year_change?: boolean }) => d.shows_year_change).words;
const FLOOR = 50;

// A dataset with every month from 2021-01 to 2026-10: 20,000 in each month of 2022 and 2023-11 is 21,000.
function counts(): Map<string, number> {
  const m = new Map<string, number>();
  for (let y = 2021; y <= 2026; y++)
    for (let k = 1; k <= 12; k++) {
      const key = `${y}-${String(k).padStart(2, "0")}`;
      if (key > "2026-10") continue;
      m.set(key, y === 2022 ? 20000 : y === 2023 && k === 11 ? 21000 : 23554);
    }
  return m;
}

test("the hover reads like the answer sentence: direction, size, then the month", () => {
  const c = counts();
  c.set("2025-10", 21091);
  const change = yearChange((m) => c.get(m), "2026-10", FLOOR);
  assert.ok(change);
  const line = sayYearChange(yearPhrases, "2026-10", change);
  assert.equal(line, "Up 12% on Oct 2025 (21,091)");
  assert.doesNotMatch(line, /Up on/);
});

test("the answer is the same whatever window the chart draws", () => {
  const all = counts();
  const full = sayAnswer(answer, (m) => all.get(m), "2023-11", FLOOR);
  assert.equal(full?.sentence, "In Nov 2023, 21,000 vehicles were registered, up 5.0% on Nov 2022, when 20,000 were.");
  assert.equal(full?.figure, "21,000");
  // A caller that hands over only a 36-month window loses the year-ago month: that is what the chart must never do.
  const window = (m: string) => (m >= "2023-11" ? all.get(m) : undefined);
  assert.equal(sayAnswer(answer, window, "2023-11", FLOOR)?.sentence, "In Nov 2023, 21,000 vehicles were registered.");
});

test("the plain form of the answer is for a missing or under-floor year-ago month only", () => {
  const all = counts();
  assert.equal(sayAnswer(answer, (m) => all.get(m), "2021-06", FLOOR)?.sentence, "In Jun 2021, 23,554 vehicles were registered.");
  all.set("2025-10", 10);
  assert.equal(sayAnswer(answer, (m) => all.get(m), "2026-10", FLOOR)?.sentence, "In Oct 2026, 23,554 vehicles were registered.");
});

test("an unchanged month says so, and a fall says down", () => {
  const all = counts();
  assert.equal(
    sayAnswer(answer, (m) => all.get(m), "2025-06", FLOOR)?.sentence,
    "In Jun 2025, 23,554 vehicles were registered, the same as in Jun 2024, when 23,554 were.",
  );
  assert.equal(
    sayAnswer(answer, (m) => all.get(m), "2022-06", FLOOR)?.sentence,
    "In Jun 2022, 20,000 vehicles were registered, down 15% on Jun 2021, when 23,554 were.",
  );
});

const ranking = (over: object) =>
  sayRanking(phrases, { basis: words.ranking_basis, span: 1, end: "2021-06", latest: "2026-10", currentFrom: "2021-06", priorFrom: "2020-06", priorTo: "2020-06", hasPrior: false, ...over });

test("a ranking with no figures a year earlier does not describe a comparison", () => {
  const said = ranking({});
  assert.doesNotMatch(said, /compares each rank|Jun 2020|a year earlier \(/);
  assert.match(said, /no figures a year earlier/);
  assert.equal(said, "Ranked by vehicles first registered in Jun 2021. There are no figures a year earlier, so no move or change is shown.");
});

test("a ranking with an earlier window names the months it is compared with", () => {
  assert.equal(
    ranking({ span: 1, end: "2023-11", currentFrom: "2023-11", priorFrom: "2022-11", priorTo: "2022-11", hasPrior: true }),
    "Ranked by vehicles first registered in Nov 2023. The move compares each rank with the same month a year earlier (Nov 2022).",
  );
  assert.equal(
    ranking({ span: 12, end: "2026-10", currentFrom: "2025-11", priorFrom: "2024-11", priorTo: "2025-10", hasPrior: true }),
    "Ranked by vehicles first registered in the last 12 months (Nov 2025 to Oct 2026). The move compares each rank with the same 12 months a year earlier (Nov 2024 to Oct 2025).",
  );
});

test("a month the address names that is not shown is said", () => {
  assert.equal(sayBadMonth(phrases.bad_month, "2019-01", "2026-10"), "The address asked for 2019-01, which this chart has no figures for, so Oct 2026 is shown.");
  assert.equal(sayBadMonth(phrases.bad_month, "2026-10", "2026-10"), undefined);
  assert.equal(sayBadMonth(phrases.bad_month, undefined, "2026-10"), undefined);
});

test("one rule writes a proportion, and a template that cannot be filled is known", () => {
  assert.equal(percent(0.117), "12%");
  assert.equal(percent(0.057), "5.7%");
  assert.deepEqual(fillTemplate("a {x} and {y.z}", { x: "1" }), { text: "a 1 and ?", unresolved: ["y.z"] });
});
