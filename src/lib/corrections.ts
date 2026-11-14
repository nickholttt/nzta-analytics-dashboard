// The public corrections log, from config/corrections.json. A row that does not have the shape below fails the
// build, so a half-filled row never reaches the site. Adding a correction is one row of data and no code.
import doc from "../../config/corrections.json";

export type Correction = { date: string; wrong: string; changed: string; link: string };

const FIELDS: (keyof Correction)[] = ["date", "wrong", "changed", "link"];

export function readCorrections(rows: unknown): Correction[] {
  if (!Array.isArray(rows)) throw new Error("corrections: config/corrections.json must hold a list under \"corrections\"");
  const out = rows.map((row, i) => {
    for (const field of FIELDS) {
      const value = (row as Record<string, unknown> | null)?.[field];
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`corrections: row ${i + 1} has no text in "${field}"`);
      }
    }
    const r = row as Correction;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || Number.isNaN(Date.parse(`${r.date}T00:00:00Z`))) {
      throw new Error(`corrections: row ${i + 1} has the date "${r.date}"; write it as YYYY-MM-DD`);
    }
    if (!/^https:\/\/\S+$/.test(r.link)) {
      throw new Error(`corrections: row ${i + 1} has the link "${r.link}"; it must be an https address`);
    }
    return r;
  });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export const corrections = readCorrections(doc.corrections);
