// The file of figures a visitor downloads (src/lib/figures.ts, D-111): how it is written, and that for real questions the file holds the
// table the page shows, cell for cell. The table is made by leagueTable (src/lib/league.ts), which the page draws and the file writes.
//   node --test "tests/site/*.test.ts"
import "./support/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { cellText, csvField, figuresCsv, figuresFileName, plainNumber, safeText, withByteOrderMark } = await import("../../src/lib/figures.ts");
const { leagueRows, leagueTable, rankingGuard } = await import("../../src/lib/league.ts");
const { rankingText, rankingWindows, rankingWords, yearTooFewText } = await import("../../src/lib/sentences.ts");
const { phrases } = await import("../../src/lib/config.ts");
const { minDenominator, pct, shareChange } = await import("../../src/lib/measures.ts");

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const header = {
  question: "A question, with a comma",
  counted: "Only vehicles where a is “x” are counted.",
  datasets: ["A dataset"],
  snapshot: "2026-10-31",
  sources: ["Source: a file."],
  attributions: ["Data source: a body, licensed CC BY 4.0."],
  address: "https://example.test/build?build.measure=count&build.by=x",
};

// A small reader of CSV, written to the RFC's rules: quoted fields, doubled quotation marks, line breaks inside quotes.
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
// What a program that reads CSV with a comment character does (pandas' comment="#", R's comment.char): drop each line that starts with "#" and
// read the rest as CSV. Written here, apart from the writer, so the file is held to what such a reader gets from it.
function readSkippingComments(text: string): string[][] {
  const kept = text.split("\r\n").filter((line, i, all) => !line.startsWith("#") && !(i === all.length - 1 && line === ""));
  return parse(kept.length ? kept.join("\r\n") + "\r\n" : "");
}
// The lines above the table, each as the one line it is.
const notesOf = (text: string) => text.split("\r\n").filter((line) => line.startsWith("#"));
const tableOf = readSkippingComments;

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

const figures = {
  period: "Oct 2026",
  columns: [
    { name: "Value", text: true },
    { name: "Share", csvName: "Share of all counted (%)", unit: "percent" as const },
    { name: "Vehicles", unit: "count" as const },
    { name: "Change", unit: "points" as const },
  ],
  rows: [
    ['Make, "Model"', "12.3%", "1,234", { text: "+1.5 pp", mark: "greyed" as const, reason: "Fewer than 200 vehicles behind this figure" }],
    ["=HYPERLINK(1)", { text: "suppressed", csv: null, mark: "withheld" as const, reason: "Too few vehicles to show." }, "5", { text: "—", csv: null, mark: "withheld" as const, reason: "The source does not record this breakdown in this month." }],
    ["Not recorded", "0.0%", "0", "−0.1 pp"],
  ],
};

test("the writer: a header block, then the table; CRLF; quoting; the formula guard; a reserved value's label; greyed and withheld figures", () => {
  const text = figuresCsv(header, figures, phrases);
  assert.ok(text.endsWith("\r\n"));
  assert.equal(text.replace(/\r\n/g, "").includes("\n") || text.replace(/\r\n/g, "").includes("\r"), false, "every line break is CRLF");
  assert.notEqual(text.charCodeAt(0), 0xfeff, "the byte order mark is added by the download, not the writer");
  const notes = notesOf(text);
  assert.equal(notes[0], "# Question: A question, with a comma", "a note is one line starting with the hash, whatever it holds");
  assert.ok(notes.includes("# What is counted: Only vehicles where a is “x” are counted."));
  assert.ok(notes.includes("# Period: Oct 2026"));
  assert.ok(notes.includes("# Dataset: A dataset"));
  assert.ok(notes.includes("# Snapshot: 2026-10-31"));
  assert.ok(notes.includes("# Source: a file."));
  assert.ok(notes.includes("# Attribution: Data source: a body, licensed CC BY 4.0."));
  assert.ok(notes.includes(`# Address: ${header.address}`));
  assert.ok(notes.some((n) => /^# Counts are whole numbers of vehicles\./.test(n)));
  assert.deepEqual(tableOf(text), [
    ["Value", "Share of all counted (%)", "Vehicles", "Change (percentage points)", "Greyed or withheld"],
    ['Make, "Model"', "12.3", "1234", "1.5", "Change (percentage points): greyed, fewer than 200 vehicles behind this figure"],
    ["'=HYPERLINK(1)", "", "5", "", "Share of all counted (%): withheld, too few vehicles to show; Change (percentage points): withheld, the source does not record this breakdown in this month"],
    ["Not recorded", "0", "0", "-0.1", ""],
  ]);
  // A table with nothing greyed or withheld says so, and has no column for it.
  const clean = figuresCsv(header, { ...figures, rows: [figures.rows[2]] }, phrases);
  assert.ok(notesOf(clean).includes("# No figure in this file is greyed or withheld. A blank cell has no figure; it is never a zero."));
  assert.deepEqual(tableOf(clean)[0], ["Value", "Share of all counted (%)", "Vehicles", "Change (percentage points)"]);
  // A table whose own column says why (a Note column) is not given another.
  const noted = figuresCsv(header, { ...figures, columns: [...figures.columns, { name: "Note", text: true, carriesMarks: true }], rows: figures.rows.map((r) => [...r, "n"]) }, phrases);
  assert.deepEqual(tableOf(noted)[0], ["Value", "Share of all counted (%)", "Vehicles", "Change (percentage points)", "Note"]);
});

test("a reader that skips the lines starting with the hash gets exactly the table, however the notes read", () => {
  // Notes with commas, quotation marks and a line break in the text, which no note may carry as a line break.
  const awkward = {
    ...header,
    question: 'Share of "A", "B" and C, by brand\nover time',
    counted: "Only vehicles where a is “x, y” or “z”, and b is “w” are counted.",
    attributions: ["Data source: A, B and C, licensed CC BY 4.0.", "This work includes data of D, licensed for reuse."],
    datasets: ["A dataset, long", "Another"],
  };
  const text = figuresCsv(awkward, figures, phrases);
  const lines = text.split("\r\n");
  const hashes = lines.filter((l) => l.startsWith("#"));
  assert.ok(hashes.length >= 10);
  // Every line that is a note starts with the hash, and no table line does: a line break in a note has not split it.
  assert.ok(hashes.every((l) => l.startsWith("# ")));
  assert.equal(hashes.filter((l) => l.startsWith("# Question: ")).length, 1);
  assert.ok(hashes[0].includes("over time"), "the line break became a space");
  const expected = [
    ["Value", "Share of all counted (%)", "Vehicles", "Change (percentage points)", "Greyed or withheld"],
    ...tableOf(figuresCsv(header, figures, phrases)).slice(1),
  ];
  assert.deepEqual(readSkippingComments(text), expected);
  assert.equal(readSkippingComments(text).length, figures.rows.length + 1, "the heading and the rows, nothing else");
  assert.deepEqual(notesOf(text).filter((n) => n.startsWith("# Attribution")).length, 2, "each attribution is a line of its own");
  assert.ok(notesOf(text).includes("# Datasets: A dataset, long and Another"));
});

test("the line on marks names the columns as the file does, and does not double a full stop", () => {
  const text = figuresCsv(header, figures, phrases);
  const line = notesOf(text).find((n) => n.startsWith("# Greyed or withheld")) as string;
  assert.equal(
    line,
    "# Greyed or withheld: Change (percentage points), greyed: fewer than 200 vehicles behind this figure; Share of all counted (%), withheld: too few vehicles to show; Change (percentage points), withheld: the source does not record this breakdown in this month. A blank cell has no figure; it is never a zero.",
  );
  for (const bad of ["..", ".;", ". ;", "..."]) assert.ok(!line.includes(bad), bad);
  assert.ok(line.includes("Share of all counted (%)") && !line.includes("Share,"), "the file's heading, not the page's");
  // The column of reasons beside the figures reads the same way.
  for (const row of tableOf(text).slice(1)) for (const cell of row) assert.ok(!cell.includes(".;") && !cell.endsWith("."), cell);
});

test("the download adds the byte order mark in front of the text, and nothing else", () => {
  const parts = withByteOrderMark("# a\r\n");
  assert.deepEqual(parts, ["\uFEFF", "# a\r\n"]);
  assert.equal(new TextEncoder().encode(parts.join("")).slice(0, 3).join(), "239,187,191", "UTF-8 bytes EF BB BF");
  // Every renderer hands the panel the table it draws (a component cannot be rendered here, so the wiring is read).
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
    words: { noYearAgo: phrases.no_year_ago, yearTooFew: yearTooFewText(phrases, span, end), shareChangeNoPrior: phrases.share_change_no_prior, notRankedBefore: phrases.not_ranked_before },
    format: { count: (n) => n.toLocaleString("en-NZ"), pct, shareChange, yearChange: signed },
  });
}

// What a reader sees in a cell, taken to the figure it states by rules written here and not in the writer.
const shown = (text: string) => text.replace(/^#/, "").replace(/[,%+]/g, "").replace(/\s*pp$/, "").replace(/^±/, "").replace("−", "-");

function check(name: string, t: { columns: { name: string; unit?: string; text?: boolean }[]; rows: unknown[][] }, expectMarks: boolean) {
  const body = tableOf(figuresCsv(header, { period: "x", columns: t.columns as never, rows: t.rows as never }, phrases));
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
  assert.equal(newcomer[7], "Rank a year before: withheld, not ranked in the same months a year earlier");
});

test("real question 2: hydrogen vehicles by brand, three vehicles in the window: every share and change greyed, withheld cells blank with their reason", () => {
  const cases = JSON.parse(read("tests/site/fixtures/league-cases.json"));
  const rows = cases.hydrogen.map((r: { month: string; make: string; n: number }) => ({ month: r.month, value: r.make, n: r.n, denominator: r.n }));
  const t = table(rows, "2026-10", 12, "1927-02", 15, true);
  const body = check("hydrogen", t, true);
  assert.deepEqual(body[0].slice(0, 8), ["Rank", "Move", "Brand", "Vehicles", "Change on a year ago (%)", "Share (%)", "Change in share (percentage points)", "Rank a year before"]);
  assert.equal(body[0][8], "Greyed or withheld");
  assert.match(body[1][8], /Share \(%\): greyed, fewer than 200 vehicles behind this figure/);
  assert.match(body[1][8], /Change on a year ago \(%\): withheld, the earlier window, the same 12 months a year earlier, holds too few vehicles to compare with/);
  assert.doesNotMatch(body[1][8], /same month a year earlier/, "a ranking of twelve months does not speak of a month");
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
