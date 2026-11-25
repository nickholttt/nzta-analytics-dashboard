// A value's name as a person writes it, for the pages worked out when the site is built (config/display_names.json, data/reference/display_names.csv):
// a make in ordinary case (Toyota, not TOYOTA), and the words for the two conditions a first registration is counted under. Pure and free of any
// domain word: the rules are config's, the exceptions are the file's (CLAUDE.md invariant 1), so a new make needs no edit here, and with no row of
// its own it reads by the rule. The value itself, in addresses, in the data and in the canvas, is unchanged.
import { isReservedValue } from "./chartSentence";

export type DisplayRow = { field: string; value: string; display: string; phrase: string; phrase_one?: string; note?: string };
export type DisplayConfig = { reference: string; rules: Record<string, string>; compound: Record<string, string[]> };
export type DisplayNames = { rows: readonly DisplayRow[]; config: DisplayConfig };

// Lower case, then a capital on the first letter and on each letter after a space, hyphen, slash, full stop, apostrophe or opening bracket.
export const titleCase = (value: string): string => value.toLowerCase().replace(/(^|[\s\-/.'(])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());

export function displayRows(records: readonly Record<string, string>[] | undefined): DisplayRow[] | undefined {
  if (!records) return undefined;
  return records.map((r) => ({ field: r.field, value: r.value, display: r.display, phrase: r.phrase, phrase_one: r.phrase_one, note: r.note }));
}

const overrideOf = (names: DisplayNames, field: string, value: string) => names.rows.find((r) => r.field === field && r.value === value && r.display !== "");

// A value's label by the file and the rules, where it has one: nothing where the field has neither a row for it nor a rule. `separator` is the field's
// own, for a compound value; the leading parts take their own fields' rules and the rest stays as the register holds it.
function labelOf(names: DisplayNames, field: string, value: string, separator: string | undefined): string | undefined {
  if (isReservedValue(value)) return undefined;
  const row = overrideOf(names, field, value);
  if (row) return row.display;
  const heads = names.config.compound[field];
  if (heads && separator && value.includes(separator)) {
    const parts = value.split(separator);
    return parts.map((part, i) => (i < heads.length ? (labelOf(names, heads[i], part, separator) ?? part) : part)).join(" ");
  }
  return names.config.rules[field] === "title_case" ? titleCase(value) : undefined;
}

// Everything a page needs to name the values of fields: the label of a value, and for a compound value the part after the leading ones (a model with its
// brand left off). `valuesOf` gives the values a field holds in the build, so two that would read the same are each left as the register holds them, and
// `plain` is how a value reads where nothing here names it.
export type Labeller = { label: (field: string, value: string) => string; tail: (field: string, value: string) => string };

export function labeller(
  names: DisplayNames | undefined,
  separators: (field: string) => string | undefined,
  valuesOf: (field: string) => readonly string[],
  plain: (field: string, value: string) => string,
): Labeller {
  const shared = new Map<string, Set<string>>();
  const clash = (field: string): Set<string> => {
    let out = shared.get(field);
    if (out) return out;
    out = new Set();
    if (names) {
      const seen = new Map<string, string[]>();
      for (const value of new Set(valuesOf(field))) {
        const label = labelOf(names, field, value, separators(field));
        if (label !== undefined) seen.set(label, [...(seen.get(label) ?? []), value]);
      }
      for (const group of seen.values()) if (group.length > 1) for (const v of group) out.add(v);
    }
    shared.set(field, out);
    return out;
  };
  const label = (field: string, value: string) => {
    const named = names && !clash(field).has(value) ? labelOf(names, field, value, separators(field)) : undefined;
    return named ?? plain(field, value);
  };
  const tail = (field: string, value: string) => {
    const separator = separators(field);
    const heads = names?.config.compound[field];
    if (!heads || !separator || !value.includes(separator)) return label(field, value);
    return value.split(separator).slice(heads.length).join(" ") || label(field, value);
  };
  return { label, tail };
}

// The words a condition is shown with: its label (a column, a button), its phrase (inside a sentence) and its phrase for a count of one.
export const conditionWords = (names: DisplayNames | undefined, field: string, value: string): { label: string; phrase: string; phraseOne?: string } | undefined => {
  const row = names?.rows.find((r) => r.field === field && r.value === value && r.display !== "" && r.phrase !== "");
  return row ? { label: row.display, phrase: row.phrase, ...(row.phrase_one ? { phraseOne: row.phrase_one } : {}) } : undefined;
};

// The values of a field the file names words for, in the file's order: the order the conditions are shown in.
export const conditionOrder = (names: DisplayNames | undefined, field: string): string[] => (names?.rows ?? []).filter((r) => r.field === field && r.phrase !== "").map((r) => r.value);
