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
import { TRAILING_MONTHS, addMonths, monthRange } from "./measures";
import type { SliceRow } from "./data";

const rules = chartDefaults.mix_default_start;

export const appliesTo = (dimension?: Dimension) =>
  Boolean(dimension?.cardinality && rules.applies_to_cardinality.includes(dimension.cardinality));

const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");

// The rolling mix at each month: shares over the trailing window, so the count of categories above
// the line does not flicker with monthly noise. Windows thinner than the precision floor, or missing
// a month, produce nothing — the same rule the rolling share uses.
function rollingMix(rows: SliceRow[], minDenominator: number) {
  const cell = new Map<string, number>();
  const denominators = new Map<string, number>();
  for (const r of rows) {
    if (isReserved(r.value)) continue;
    cell.set(`${r.month}|${r.value}`, r.n);
    denominators.set(r.month, r.denominator);
  }
  const months = [...denominators.keys()].sort();
  const values = [...new Set(rows.filter((r) => !isReserved(r.value)).map((r) => r.value))];
  const out: { month: string; shares: number[] }[] = [];
  for (const month of months) {
    const from = addMonths(month, -(TRAILING_MONTHS - 1));
    if (from < months[0]) continue;
    const window = monthRange(from, month);
    if (window.some((m) => denominators.get(m) === undefined)) continue;
    let total = 0;
    for (const m of window) total += denominators.get(m) as number;
    if (total < minDenominator) continue;
    out.push({ month, shares: values.map((v) => window.reduce((s, m) => s + (cell.get(`${m}|${v}`) ?? 0), 0) / total) });
  }
  return out;
}

// The first month from which the composition test holds continuously for sustain_months. A run that
// holds briefly and lapses is not a start: powertrain clears the line for one month in 1960 and five
// in 1977 before the run that begins in 2009 and never breaks.
export function defaultStartMonth(rows: SliceRow[], minDenominator: number): string | undefined {
  const mix = rollingMix(rows, minDenominator);
  const qualifies = mix.map((m) => m.shares.filter((s) => s > rules.min_share).length >= rules.min_categories);
  for (let i = 0; i + rules.sustain_months <= qualifies.length; i++) {
    if (qualifies.slice(i, i + rules.sustain_months).every(Boolean)) return mix[i].month;
  }
  return undefined;
}
