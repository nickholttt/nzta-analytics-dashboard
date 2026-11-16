// The file of figures a visitor downloads: exactly the table of figures the page shows (D-111). Pure, so tests/site/ runs it with Node's own
// test runner. A chart builds its table as a Figures (the rows and columns it draws, each cell with the text the page shows and, where
// the file needs it, the figure behind that text); the table on the page and this file are made from that one object, so they cannot
// differ. Nothing here reads a vehicle: the rows are the aggregates the chart already holds (invariant 6).
//
// The file: UTF-8 with a byte order mark and CRLF line endings, which is what a spreadsheet needs to open it correctly. It opens with
// lines that start with "# " (the question, the dataset, the snapshot, the attribution, the address that redraws it, how figures are
// written, which are greyed or withheld) and then the table itself, its header row first. A spreadsheet shows the lines above the table as
// text in its first column; a program that reads CSV skips them by setting its comment character to "#". A line that holds a comma
// is quoted as any field is, so such a line starts with a quotation mark in the file, and its text is as written.
import { fillTemplate } from "./sentences";

export type Mark = "greyed" | "withheld";
// How a column's figures are written in the file. count: whole vehicles; percent: a percentage as a plain number; points: a change in
// share in percentage points; month: a month as year-month; text: as shown.
export type Unit = "text" | "count" | "percent" | "points" | "month";

export type Column = {
  name: string;
  // The column is text on the page (set left); it is a figure otherwise, except the first, which names the row.
  text?: boolean;
  unit?: Unit;
  // The heading in the file, where it must say more than the page's heading (a unit, or what a month means).
  csvName?: string;
  // The column already says why a figure in its row is greyed (a "Note" column), so the file adds no column for it.
  carriesMarks?: boolean;
};

// text: what the page shows. csv: the figure or words to write instead of parsing the text; null writes nothing. mark and reason: the
// figure is greyed (shown, with a reason) or withheld (not shown, with a reason), which the file's marks line and last column say.
export type Cell = string | { text: string; csv?: string | number | null; mark?: Mark; reason?: string };

export type Figures = {
  // The months or period the figures are for, as the page says it.
  period: string;
  columns: Column[];
  rows: Cell[][];
};

export const cellText = (cell: Cell): string => (typeof cell === "string" ? cell : cell.text);

export type FiguresHeader = {
  question: string;
  counted?: string;
  dataset: string;
  snapshot: string;
  source?: string;
  attribution: string;
  address: string;
};

// The words of the file that are about the file, from config (defaults.phrases, figures_*).
export type FiguresPhrases = {
  figures_units: string;
  figures_marks: string;
  figures_marks_none: string;
  figures_mark_item: string;
  figures_greyed: string;
  figures_withheld: string;
  figures_marked_column: string;
};

const NUMBER_UNITS: Unit[] = ["count", "percent", "points"];
const MINUS = /[−–]/g;

// The figure a cell's text shows, as a plain number: no thousands separator, a full stop for the decimal point, a minus sign as "-",
// and the unit (a percent sign, "pp") dropped. Text that is not a figure (a dash, a word) is nothing: it is written as a blank cell.
export function plainNumber(text: string): number | undefined {
  const t = text.replace(MINUS, "-").replace(/\s|,/g, "").replace(/%|pp$/i, "").replace(/^\+/, "").replace(/^±/, "");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : undefined;
}

// A text that starts with a character a spreadsheet reads as the start of a formula is written with a single quotation mark in front,
// which a spreadsheet takes as "this is text" and does not show. Model names come from the data, so any value may do it.
const FORMULA_START = /^[=+\-@\t\r]/;
export const safeText = (text: string): string => (FORMULA_START.test(text) ? `'${text}` : text);

// A field, quoted where it holds a comma, a quotation mark or a line break, as RFC 4180 says.
export const csvField = (text: string): string => (/[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const csvLine = (fields: string[]) => fields.map(csvField).join(",");

// What a cell is in the file: a number as a plain number, text made safe, nothing for a figure that is not given.
function value(cell: Cell, unit: Unit | undefined): string {
  const given = typeof cell === "string" ? undefined : cell.csv;
  const text = cellText(cell);
  if (given === null) return "";
  if (typeof given === "number") return String(given);
  if (typeof given === "string") return safeText(given);
  if (unit && NUMBER_UNITS.includes(unit)) {
    const n = plainNumber(text);
    return n === undefined ? "" : String(n);
  }
  return safeText(text);
}

const heading = (c: Column) => c.csvName ?? (c.unit === "percent" ? `${c.name} (%)` : c.unit === "points" ? `${c.name} (percentage points)` : c.name);

// The cells the file marks, by column and kind, with each distinct reason: the one line that says which figures are greyed or withheld.
function marksLine(figures: Figures, phrases: FiguresPhrases): string {
  const seen = new Map<string, string>();
  for (const row of figures.rows) {
    row.forEach((cell, i) => {
      if (typeof cell === "string" || !cell.mark) return;
      const column = figures.columns[i];
      const key = `${column?.name}|${cell.mark}|${cell.reason ?? ""}`;
      if (!seen.has(key)) {
        const mark = cell.mark === "greyed" ? phrases.figures_greyed : phrases.figures_withheld;
        seen.set(key, fillTemplate(phrases.figures_mark_item, { column: column?.name ?? "", mark, reason: lowerFirst(cell.reason ?? "") }).text);
      }
    });
  }
  return seen.size === 0 ? phrases.figures_marks_none : fillTemplate(phrases.figures_marks, { list: [...seen.values()].join("; ") }).text;
}

// The whole file as text, without the byte order mark, which the download adds.
export function figuresCsv(header: FiguresHeader, figures: Figures, phrases: FiguresPhrases): string {
  const marked = figures.rows.some((row) => row.some((c) => typeof c !== "string" && c.mark));
  // A column of the reasons, only where some figure is marked and no column of the table already says why.
  const extra = marked && !figures.columns.some((c) => c.carriesMarks);
  const lines: string[] = [];
  const note = (label: string, text?: string) => text && lines.push(csvLine([`# ${label}: ${text}`]));
  note("Question", header.question);
  note("What is counted", header.counted);
  note("Period", figures.period);
  note("Dataset", header.dataset);
  note("Snapshot", header.snapshot);
  // The source note is a sentence that names itself ("Source: ..."), so it takes no label.
  if (header.source) lines.push(csvLine([`# ${header.source}`]));
  note("Attribution", header.attribution);
  note("Address", header.address);
  lines.push(csvLine([`# ${phrases.figures_units}`]));
  lines.push(csvLine([`# ${marksLine(figures, phrases)}`]));
  lines.push(csvLine([...figures.columns.map(heading), ...(extra ? [phrases.figures_marked_column] : [])]));
  for (const row of figures.rows) {
    const fields = row.map((cell, i) => value(cell, figures.columns[i]?.unit));
    if (extra) {
      const why = row.flatMap((cell, i) => (typeof cell === "string" || !cell.mark ? [] : [`${figures.columns[i]?.name}: ${cell.mark === "greyed" ? phrases.figures_greyed : phrases.figures_withheld}, ${lowerFirst(cell.reason ?? "")}`]));
      fields.push(safeText(why.join("; ")));
    }
    lines.push(csvLine(fields));
  }
  return lines.join("\r\n") + "\r\n";
}

// A name for the file from the question, safe on any system: lower-case letters and digits in words joined by hyphens, cut to a length
// that fits a path, then the snapshot's date so two snapshots of one question do not share a name.
export function figuresFileName(question: string, snapshot: string): string {
  const slug = question
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  const date = snapshot.replace(/[^0-9-]/g, "");
  return `${slug || "figures"}${date ? `-${date}` : ""}.csv`;
}
