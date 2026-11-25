// The period windows a page lists its figures over (config/windows.json): the newest month, the last 3 months, the last 12 months and the year to
// date. Pure: it names no field, value or year, so tests/site/ runs it with Node's own test runner.
//
// A window is a list of months ending with the newest month of the build. Its figure is the sum of its months and its change is on the same months
// a year earlier, each month less 12, so the two are like for like. A window has a figure only where every one of its months is a month of the
// dataset: a missing month is never read as zero.
import configDoc from "../../config/windows.json";
import { addMonths, monthIndex, monthRange } from "./sentences";

export type WindowDef = { id: string; months?: number; year_to_date?: boolean; canvas_period: string };
export type WindowsConfig = { windows: WindowDef[]; default: Record<string, string>; mover_minimum_per_month: number };
export const windowsConfig = configDoc as unknown as WindowsConfig;

export type Window = {
  id: string;
  // Its position among the windows: the value of its radio input is `w` and this.
  index: number;
  months: string[];
  // The same months a year earlier, in the same order.
  prior: string[];
  canvasPeriod: string;
  // Whether the window is the year to date, which a sentence says as a range of months and not as a count of them.
  yearToDate: boolean;
};

// The months of a window ending with `latest`: the last N, or January of the newest month's year to the newest month.
export function windowMonths(def: WindowDef, latest: string): string[] {
  if (def.year_to_date) return monthRange(`${latest.slice(0, 4)}-01`, latest);
  return def.months && def.months > 0 ? monthRange(addMonths(latest, 1 - def.months), latest) : [];
}

// Every window of the configuration for a build whose newest month is `latest`; none where `latest` is not a month.
export function windowsFor(latest: string, config: WindowsConfig = windowsConfig): Window[] {
  if (Number.isNaN(monthIndex(latest))) return [];
  return config.windows.map((def, index) => {
    const months = windowMonths(def, latest);
    return { id: def.id, index, months, prior: months.map((m) => addMonths(m, -12)), canvasPeriod: def.canvas_period, yearToDate: def.year_to_date === true };
  });
}

// The window a surface opens on.
export const defaultWindow = (windows: readonly Window[], surface: string, config: WindowsConfig = windowsConfig): Window | undefined =>
  windows.find((w) => w.id === config.default[surface]) ?? windows[0];

// Whether every month of the list is a month the dataset holds.
export const complete = (months: readonly string[], has: (month: string) => boolean): boolean => months.length > 0 && months.every(has);

// The sum of a month-by-month count over the months: nothing where any month is missing (undefined) or hidden (null), never a zero in their place.
export function sumOver(months: readonly string[], at: (month: string) => number | null | undefined): number | undefined {
  let total = 0;
  for (const m of months) {
    const n = at(m);
    if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
    total += n;
  }
  return months.length > 0 ? total : undefined;
}

// The phrase a window is said in: a month ("in Oct 2026"), a count of months to a month ("in the 3 months to Oct 2026"), or, for the year to date, the range of
// its months ("from Jan 2026 to Oct 2026"). The words are the caller's, from the site's phrases and config.
export type WindowSaid = { month: (month: string) => string; span: (end: string, months: number) => string; range: (start: string, end: string) => string };
export function windowPhrase(months: readonly string[], yearToDate: boolean, said: WindowSaid): string {
  const end = months[months.length - 1];
  if (yearToDate && months.length > 1) return said.range(months[0], end);
  return months.length === 1 ? said.month(end) : said.span(end, months.length);
}

// The months a window covers as a range ("Aug 2026 to Oct 2026"), or the month alone for a window of one.
export const windowRange = (months: readonly string[], say: (start: string, end: string) => string, one: (month: string) => string): string =>
  months.length === 1 ? one(months[0]) : say(months[0], months[months.length - 1]);
