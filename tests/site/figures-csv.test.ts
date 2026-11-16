// The file of figures a visitor downloads (src/lib/figures.ts, D-111): how it is written, and that for real questions the file holds the
// table the page shows, cell for cell. The table is made by leagueTable (src/lib/league.ts), which the page draws and the file writes.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { cellText, csvField, figuresCsv, figuresFileName, plainNumber, safeText } = await import("../../src/lib/figures.ts");
const { leagueRows, leagueTable, rankingGuard } = await import("../../src/lib/league.ts");
const { rankingText, rankingWindows, rankingWords } = await import("../../src/lib/sentences.ts");
const { phrases } = await import("../../src/lib/config.ts");
const { minDenominator, pct, shareChange } = await import("../../src/lib/measures.ts");

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const header = {
  question: "A question, with a comma",
  counted: "Only vehicles where a is “x” are counted.",
  dataset: "A dataset",
  snapshot: "2026-10-31",
  source: "Source: a file.",
  attribution: "Data sources: a body, licensed CC BY 4.0.",
  address: "https://example.test/build?build.measure=count&build.by=x",
};

// A small reader of the file, written to the RFC's rules: quoted fields, doubled quotation marks, line breaks inside quotes.
function parse(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") (row.push(field), (field = ""));
    else if (c === "\r" && text[i + 1] === "\n") (row.push(field), rows.push(row), (row = []), (field = ""), i++);
    else field += c;
  }
  assert.ok(field === "" && row.length === 0, "the file ends with a line break");
  return rows;
}
// The table of a file: the rows after the lines that start with "# ".
const tableOf = (rows: string[][]) => rows.filter((r) => !r[0].startsWith("# "));
const notesOf = (rows: string[][]) => rows.filter((r) => r[0].startsWith("# ")).map((r) => r[0]);

test("a figure is written as a plain number: no thousands separator, a full stop, a minus sign, no unit", () => {
  assert.equal(plainNumber("1,234"), 1234);
  assert.equal(plainNumber("12.3%"), 12.3);
  assert.equal(plainNumber("+4.0 pp"), 4);
  assert.equal(plainNumber("−1.2 pp"), -1.2);
  assert.equal(plainNumber("±0.0 pp"), 0);
  assert.equal(plainNumber("#3"), undefined);
  assert.equal(plainNumber("—"), undefined);
  assert.equal(plainNumber("suppressed"), undefined);
});

test("a text that a spreadsheet would read as a formula is written as text, and only such a text", () => {
  for (const bad of ["=1+1", "+1", "-1", "@A1", "\tx", "\rx"]) assert.equal(safeText(bad), `'${bad}`, JSON.stringify(bad));
  for (const fine of ["Ford", "A-1", "1+1", "Not recorded", ""]) assert.equal(safeText(fine), fine);
  assert.equal(csvField('a "b", c'), '"a ""b"", c"');
  assert.equal(csvField("two\nlines"), '"two\nlines"');
  assert.equal(csvField("plain"), "plain");
});

test("the file's name is built from the question, safely", () => {
  assert.equal(figuresFileName("The number of vehicles by brand: A, B", "2026-10-31"), "the-number-of-vehicles-by-brand-a-b-2026-10-31.csv");
  assert.equal(figuresFileName("Tōyota / Ford? <>:\"|*", "2026-10-31"), "toyota-ford-2026-10-31.csv");
  assert.equal(figuresFileName("???", "2026-10-31"), "figures-2026-10-31.csv");
  assert.ok(figuresFileName("x".repeat(500), "2026-10-31").length < 100);
  assert.doesNotMatch(figuresFileName("../../etc/passwd", "2026-10-31"), /[\\/:]/);
});

test("the writer: a header block, then the table; CRLF; quoting; the formula guard; a reserved value's label; greyed and withheld figures", () => {
  const figures = {
    period: "Oct 2026",
    columns: [{ name: "Value", text: true }, { name: "Share", unit: "percent" as const }, { name: "Vehicles", unit: "count" as const }, { name: "Change", unit: "points" as const }],
    rows: [
      ['Make, "Model"', "12.3%", "1,234", { text: "+1.5 pp", mark: "greyed" as const, reason: "Fewer than 200 vehicles behind this figure" }],
      ["=HYPERLINK(1)", { text: "suppressed", csv: null, mark: "withheld" as const, reason: "Too few" }, "5", { text: "—", csv: null, mark: "withheld" as const, reason: "No year before" }],
      ["Not recorded", "0.0%", "0", "−0.1 pp"],
    ],
  };
  const text = figuresCsv(header, figures, phrases);
  assert.ok(text.endsWith("\r\n"));
  assert.equal(text.replace(/\r\n/g, "").includes("\n") || text.replace(/\r\n/g, "").includes("\r"), false, "every line break is CRLF");
  assert.notEqual(text.charCodeAt(0), 0xfeff, "the byte order mark is added by the download, not the writer");
  const rows = parse(text);
  const notes = notesOf(rows);
  assert.equal(notes[0], "# Question: A question, with a comma", "a line with a comma is a quoted field, and reads back as written");
  assert.ok(notes.includes("# What is counted: Only vehicles where a is “x” are counted."));
  assert.ok(notes.includes("# Period: Oct 2026"));
  assert.ok(notes.includes("# Dataset: A dataset"));
  assert.ok(notes.includes("# Snapshot: 2026-10-31"));
  assert.ok(notes.includes("# Source: a file."));
  assert.ok(notes.includes(`# Attribution: ${header.attribution}`));
  assert.ok(notes.includes(`# Address: ${header.address}`));
  assert.ok(notes.some((n) => /^# Counts are whole numbers of vehicles\./.test(n)));
  const marks = notes.find((n) => n.startsWith("# Greyed or withheld"));
  assert.equal(
    marks,
    "# Greyed or withheld: Change, greyed: fewer than 200 vehicles behind this figure; Share, withheld: too few; Change, withheld: no year before. A blank cell has no figure; it is never a zero.",
  );
  assert.deepEqual(tableOf(rows), [
    ["Value", "Share (%)", "Vehicles", "Change (percentage points)", "Greyed or withheld"],
    ['Make, "Model"', "12.3", "1234", "1.5", "Change: greyed, fewer than 200 vehicles behind this figure"],
    ["'=HYPERLINK(1)", "", "5", "", "Share: withheld, too few; Change: withheld, no year before"],
    ["Not recorded", "0", "0", "-0.1", ""],
  ]);
  // A table with nothing greyed or withheld says so, and has no column for it.
  const clean = parse(figuresCsv(header, { ...figures, rows: [figures.rows[2]] }, phrases));
  assert.ok(notesOf(clean).includes("# No figure in this file is greyed or withheld. A blank cell has no figure; it is never a zero."));
  assert.deepEqual(tableOf(clean)[0], ["Value", "Share (%)", "Vehicles", "Change (percentage points)"]);
  // A table whose own column says why (a Note column) is not given another.
  const noted = parse(figuresCsv(header, { ...figures, columns: [...figures.columns, { name: "Note", text: true, carriesMarks: true }], rows: figures.rows.map((r) => [...r, "n"]) }, phrases));
  assert.deepEqual(tableOf(noted)[0], ["Value", "Share (%)", "Vehicles", "Change (percentage points)", "Note"]);
});

test("the download adds the byte order mark, makes the file in the browser from the rows it holds, and sends nothing", () => {
  const panel = read("src/components/PresetPanel.tsx");
  assert.ok(panel.includes('new Blob(["\\uFEFF", figuresCsv('));
  assert.ok(panel.includes("text/csv;charset=utf-8"));
  assert.doesNotMatch(panel.slice(panel.indexOf("const handleDownload"), panel.indexOf("const actionsBlock")), /fetch\(|XMLHttpRequest|sendBeacon/);
  // Every renderer hands the panel the table it draws.
  for (const file of ["LeagueChart", "MixChart", "GeoChart", "FiguresTable"]) assert.match(read(`src/components/${file}.tsx`), /useFigures\(/, file);
  assert.match(read("src/components/TrendChart.tsx"), /<FiguresTable/);
  assert.match(read("src/components/DistributionChart.tsx"), /<FiguresTable/);
});

// ---- Three real questions: the file holds the page's table, cell for cell ----

const FLOOR = 50;
const BASIS = "Ranked by vehicles {window}";
const PICKED_HEADINGS = undefined;
const rowsOf = (w: { month: string; total: number; brands: Record<string, number> }) =>
  Object.entries(w.brands).map(([value, n]) => ({ month: w.month, value, n, denominator: w.total }));

function table(rows: { month: string; value: string; n: number; denominator: number }[], end: string, span: number, first: string, topN: number, showYear: boolean) {
  const latest = "2026-10";
  const { currentFrom, priorFrom, priorTo } = rankingWindows(end, span);
  const text = rankingText(phrases, { basis: BASIS, span, end, latest, covers: { first, last: latest } });
  const result = leagueRows({ rows, currentFrom, end, priorFrom, priorTo, hasPrior: text.hasPrior, topN, nameOf: (v) => v, yearFloor: FLOOR });
  const floor = minDenominator("share");
  const guard = rankingGuard({ floor, currentDenom: result.currentDenom, priorDenom: result.priorDenom, hasPrior: text.hasPrior, ...rankingWords(phrases, { span, end, latest }), single: span === 1, phrases });
  const signed = (x: number) => `${x > 0.0005 ? "+" : x < -0.0005 ? "−" : "±"}${Math.abs(x * 100).toFixed(Math.abs(x) * 100 < 10 ? 1 : 0)}%`;
  return leagueTable(result.items, {
    hasPrior: text.hasPrior,
    showYear,
    guard,
    floor,
    valueHeading: "Brand",
    countHeading: "Vehicles",
    headings: PICKED_HEADINGS,
    words: { noYearAgo: phrases.no_year_ago, yearTooFew: phrases.year_too_few, shareChangeNoPrior: phrases.share_change_no_prior, notRankedBefore: phrases.not_ranked_before },
    format: { count: (n) => n.toLocaleString("en-NZ"), pct, shareChange, yearChange: signed },
  });
}

// What a reader sees in a cell, taken to the figure it states by rules written here and not in the writer.
const shown = (text: string) => text.replace(/^#/, "").replace(/[,%+]/g, "").replace(/\s*pp$/, "").replace(/^±/, "").replace("−", "-");

function check(name: string, t: { columns: { name: string; unit?: string; text?: boolean }[]; rows: unknown[][] }, expectMarks: boolean) {
  const rows = parse(figuresCsv(header, { period: "x", columns: t.columns as never, rows: t.rows as never }, phrases));
  const body = tableOf(rows);
  const marked = t.rows.some((r) => r.some((c) => typeof c !== "string" && (c as { mark?: string }).mark));
  assert.equal(marked, expectMarks, `${name}: whether anything is greyed or withheld`);
  assert.equal(body.length, t.rows.length + 1, `${name}: one line for each row of the page's table, and the heading`);
  t.rows.forEach((row, i) => {
    row.forEach((cell, j) => {
      const text = cellText(cell as never);
      const written = body[i + 1][j];
      const c = cell as { mark?: string; csv?: unknown };
      if (c.mark === "withheld") assert.equal(written, "", `${name} row ${i} column ${t.columns[j].name}: a withheld figure is blank, never zero`);
      else if (j === 1) {
        // The move: the arrow and the places it shows, as a signed number; a dash is no move; new is new.
        const places = text.startsWith("▲") || text.startsWith("▼") ? Number(text.slice(1).replace("+", "")) : 0;
        assert.equal(written, text === "New" ? "New" : String(places), `${name} row ${i}: move ${text}`);
      } else if (t.columns[j].text || j === 2) assert.equal(written, text, `${name} row ${i} column ${t.columns[j].name}`);
      else if (c.csv === "New") assert.equal(written, "New");
      else assert.equal(Number(written), Number(shown(text)), `${name} row ${i} column ${t.columns[j].name}: ${text}`);
    });
  });
  return body;
}

test("real question 1: battery-electric vehicles by brand over the last 12 months, with a year before: the file is the page's table", () => {
  const cases = JSON.parse(read("tests/site/fixtures/league-cases.json"));
  const t = table([...rowsOf(cases.bev.prior), ...rowsOf(cases.bev.current)], "2026-10", 12, "1927-02", 25, false);
  assert.equal(t.rows.length, 25);
  const body = check("bev", t, true);
  assert.deepEqual(body[0], ["Rank", "Move", "Brand", "Share (%)", "Change in share (percentage points)", "Vehicles", "Rank a year before", "Greyed or withheld"]);
  assert.equal(body[1][2], "TESLA");
  // The brands with no rank a year before are blank there, with the reason in the last column.
  const newcomer = body.find((r) => r[1] === "New") as string[];
  assert.equal(newcomer[6], "");
  assert.equal(newcomer[7], "Rank a year before: withheld, not ranked in the same months a year earlier.");
});

test("real question 2: hydrogen vehicles by brand, three vehicles in the window: every share and change greyed, withheld cells blank with their reason", () => {
  const cases = JSON.parse(read("tests/site/fixtures/league-cases.json"));
  const rows = cases.hydrogen.map((r: { month: string; make: string; n: number }) => ({ month: r.month, value: r.make, n: r.n, denominator: r.n }));
  const t = table(rows, "2026-10", 12, "1927-02", 15, true);
  const body = check("hydrogen", t, true);
  assert.deepEqual(body[0].slice(0, 8), ["Rank", "Move", "Brand", "Vehicles", "Change on a year ago (%)", "Share (%)", "Change in share (percentage points)", "Rank a year before"]);
  assert.equal(body[0][8], "Greyed or withheld");
  assert.match(body[1][8], /Share: greyed, fewer than 200 vehicles behind this figure/);
  assert.match(body[1][8], /Change on a year ago: withheld, the same month a year earlier has too few vehicles to compare with/);
  assert.equal(body[1][4], "", "a change on a year ago under the floor is blank, not zero");
});

test("real question 3: a ranking of 1926 with a tie, a value new in the window and no earlier rank", () => {
  const fixture = JSON.parse(read("tests/site/fixtures/league-1926.json"));
  const t = table(fixture.rows, "1926-12", 12, "1912-01", 15, false);
  const body = check("1926", t, true);
  assert.deepEqual(body.slice(1).map((r) => [r[0], r[2]]), [["1", "FORD"], ["2", "DODGE"], ["3", "AUSTIN"], ["3", "CHEVROLET"], ["3", "MORRIS"], ["6", "FIAT"]]);
  assert.equal(body[1][1], "New", "no rank a year before: new, with its rank before blank");
  assert.equal(body[1][body[0].indexOf("Rank a year before")], "");
  assert.equal(body[2][1], "0", "the same place: a move of zero, which is a figure and not blank");
});
