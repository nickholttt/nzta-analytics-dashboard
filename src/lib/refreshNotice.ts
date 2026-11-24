// The notice that a whole calendar month has ended which the site does not show yet. The site's data is replaced whole, once a month, when
// NZTA publishes a month and the build lands it, so for a stretch after a month ends the newest figures are the month before. Every page
// says so in one line from the first day that is true: the first day of the month after the one that follows the snapshot's month (a
// snapshot of any day in October is overtaken on 1 December, when November has ended and is not here). The words are in config/site.json
// (refresh_notice); src/components/RefreshNotice.astro draws them, hidden, and the page carries revealRefreshNotice to show them.

import { addMonths, monthIndex, monthLabel } from "./sentences";

export type RefreshDue = {
  // The first day, as YYYY-MM-DD, on which the notice is due: the first day of the month after the month that is missing.
  due: string;
  // The month that is not here yet, as "YYYY-MM", and as the label the site's other sentences use for it.
  month: string;
  label: string;
};

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

// A date that is not a real YYYY-MM-DD (text, a month 13, 31 February) gives no notice rather than a wrong one.
export function refreshDue(snapshot: unknown): RefreshDue | null {
  const parts = typeof snapshot === "string" ? DAY.exec(snapshot) : null;
  if (!parts) return null;
  const [year, month, day] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const real = new Date(Date.UTC(year, month - 1, day));
  if (real.getUTCFullYear() !== year || real.getUTCMonth() !== month - 1 || real.getUTCDate() !== day) return null;
  const key = `${parts[1]}-${parts[2]}`;
  if (Number.isNaN(monthIndex(key))) return null;
  const missing = addMonths(key, 1);
  return { due: `${addMonths(key, 2)}-01`, month: missing, label: monthLabel(missing) };
}

// The script each page carries, written after the notice so it runs as the page is read and the notice is shown before the page below it is
// drawn: it does not appear after the visitor has begun reading and shift what they read. It is this function's own text (the page writes
// revealRefreshNotice.toString() into an inline script), so it must use nothing outside its parameters and the browser. It makes no request and
// keeps nothing: it removes `hidden` from the notice when the visitor's own date is on or after the date the notice carries. Without scripts the
// notice stays hidden, and the snapshot's date is always in the page's top bar.
export function revealRefreshNotice(doc: Document = document, now: Date = new Date()): void {
  const notice = doc.querySelector("[data-refresh-due]");
  const due = notice ? notice.getAttribute("data-refresh-due") : null;
  if (!notice || !due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return;
  const two = (n: number) => (n < 10 ? "0" : "") + n;
  const today = now.getFullYear() + "-" + two(now.getMonth() + 1) + "-" + two(now.getDate());
  if (today >= due) notice.removeAttribute("hidden");
}
