// Where a mix chart should start by default.
//
// A chart over all time crushes its story into the right of the frame whenever the dimension spent
// decades with a single category: powertrain is petrol alone until the 1960s and petrol-and-diesel
// until 2009. The start is chosen from composition rather than from a fixed number of years or from
// denominator size — the first month the dimension had something to show, and kept showing it.
//
// The test measures diversity, so it only means anything where the category set is small. On a
// high-cardinality dimension diversity is saturated from the first month with any data at all and
// the test never binds, which is why config restricts it by cardinality rather than applying it
// everywhere. Thresholds live in config/presets.json; nothing here is domain-specific.
import { chartDefaults } from "./config";
import type { Dimension } from "./config";
import { TRAILING_MONTHS } from "./measures";
import { monthAt, monthIndex } from "./sentences";
import type { SliceRow } from "./data";

const rules = chartDefaults.mix_default_start;

export const appliesTo = (dimension?: Dimension) =>
  Boolean(dimension?.cardinality && rules.applies_to_cardinality.includes(dimension.cardinality));

const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");

// The rolling mix at each month: shares over the trailing window, so the count of categories above
// the line does not flicker with monthly noise. Windows thinner than the precision floor, or missing
// a month, produce nothing — the same rule the rolling share uses.
function rollingMix(rows: SliceRow[], minDenominator: number) {
  const denominators = new Map<number, number>();
  const counts = new Map<string, Map<number, number>>();
  for (const r of rows) {
    if (isReserved(r.value)) continue;
    const at = monthIndex(r.month);
    denominators.set(at, r.denominator);
    let byMonth = counts.get(r.value);
    if (!byMonth) counts.set(r.value, (byMonth = new Map()));
    byMonth.set(at, r.n);
  }
  // Counts laid out by calendar month, so a window is a run of cells and not a lookup of twelve strings per value.
  const months = [...denominators.keys()].sort((x, y) => x - y);
  const origin = months[0];
  const span = months.length ? months[months.length - 1] - origin + 1 : 0;
  const dense = [...counts.values()].map((byMonth) => {
    const cells = new Float64Array(span);
    for (const [at, n] of byMonth) cells[at - origin] = n;
    return cells;
  });
  const out: { month: string; shares: number[] }[] = [];
  for (const at of months) {
    const from = at - (TRAILING_MONTHS - 1);
    if (from < origin) continue;
    let total = 0;
    let missing = false;
    for (let m = from; m <= at; m++) {
      const d = denominators.get(m);
      if (d === undefined) {
        missing = true;
        break;
      }
      total += d;
    }
    if (missing || total < minDenominator) continue;
    out.push({
      month: monthAt(at),
      shares: dense.map((cells) => {
        let n = 0;
        for (let m = from; m <= at; m++) n += cells[m - origin];
        return n / total;
      }),
    });
  }
  return out;
}

// The first month from which the composition test holds continuously for sustain_months. A run that
// holds briefly and lapses is not a start: powertrain clears the line for one month in 1960 and five
// in 1977 before the run that begins in 2009 and never breaks.
// The start an all-time mix chart opens on, when it is later than the first month with data. The panel
// labels its range options from it and the chart draws from it, so both name the same month.
export function compositionStart(rows: SliceRow[], dimension: Dimension | undefined, minDenominator: number): string | undefined {
  if (!appliesTo(dimension) || rows.length === 0) return undefined;
  const first = rows.reduce((m, r) => (r.month < m ? r.month : m), rows[0].month);
  const start = defaultStartMonth(rows, minDenominator);
  return start && start > first ? start : undefined;
}

export function defaultStartMonth(rows: SliceRow[], minDenominator: number): string | undefined {
  const mix = rollingMix(rows, minDenominator);
  const qualifies = mix.map((m) => m.shares.filter((s) => s > rules.min_share).length >= rules.min_categories);
  for (let i = 0; i + rules.sustain_months <= qualifies.length; i++) {
    if (qualifies.slice(i, i + rules.sustain_months).every(Boolean)) return mix[i].month;
  }
  return undefined;
}
