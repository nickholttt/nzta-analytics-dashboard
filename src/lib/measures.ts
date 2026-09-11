// Measures computed in the browser from n and denominator (docs/CUBE_SCHEMA.md, docs/METRICS.md).
import { findMeasure, shareChangeUnit } from "./config";

export const minDenominator = (measureId?: string) => findMeasure(measureId)?.guards?.min_denominator ?? 0;

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

// Every share change goes through this formatter: 10% to 15% is +5.0 pp, never +50%.
export function shareChange(delta: number): string {
  if (shareChangeUnit !== "percentage_points") throw new Error(`unsupported share change unit: ${shareChangeUnit}`);
  const v = delta * 100;
  const sign = v > 0.05 ? "+" : v < -0.05 ? "−" : "±";
  return `${sign}${Math.abs(v).toFixed(1)} pp`;
}

export function addMonths(key: string, k: number): string {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export const monthDate = (key: string) => new Date(`${key}-01T00:00:00Z`);

export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addMonths(k, 1)) out.push(k);
  return out;
}

// dimensions.json names periods but gives them no length, and presets use two ids it does not list
// (latest_year, latest_month). The lengths are therefore defined here.
const PERIOD_MONTHS: Record<string, number> = { "10y": 120, "5y": 60, "3y": 36, latest_year: 12, latest_month: 1 };

export function periodWindow(periodId: string | undefined, first: string, latest: string) {
  if (!periodId || periodId === "all") return { from: first, to: latest };
  const months = PERIOD_MONTHS[periodId];
  if (!months) throw new Error(`period "${periodId}" has no length`);
  const from = addMonths(latest, -(months - 1));
  return { from: from < first ? first : from, to: latest };
}

// Sum of n and of denominator over a month range, for trailing-window shares.
export function windowShare(
  from: string,
  to: string,
  nFor: (month: string) => number | undefined,
  denominatorFor: (month: string) => number | undefined,
) {
  let n = 0;
  let d = 0;
  for (const m of monthRange(from, to)) {
    const den = denominatorFor(m);
    if (den === undefined) continue;
    d += den;
    n += nFor(m) ?? 0;
  }
  return { n, denominator: d };
}
