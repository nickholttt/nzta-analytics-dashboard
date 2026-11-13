// The hover readout every renderer shows, so a point reads the same on any chart: what it is, the period it covers,
// its figure with the vehicles behind it, why it is greyed if it is, then anything only that chart has. Each renderer
// passes what it knows; the order and the wording are decided here.
import { TRAILING_MONTHS, monthLabel, pct } from "./measures";

export type Greyed = "thin" | "collapsed";

export type Readout = {
  name: string;
  period: string;
  share?: number;
  // The vehicles the figure counts and, for a share, the total it is a share of.
  n?: number;
  base?: number;
  greyed?: Greyed;
  minDenominator?: number;
  extra?: string[];
};

export const count = (n: number) => Math.round(n).toLocaleString("en-NZ");
const vehicles = (n: number) => `${count(n)} ${Math.round(n) === 1 ? "vehicle" : "vehicles"}`;

// Why a figure is greyed, in the same words in a readout and in a chart's table of figures.
export const greyedReason = (greyed: Greyed | undefined, minDenominator?: number) =>
  greyed === "thin"
    ? `Greyed: fewer than ${minDenominator ?? ""} vehicles behind this figure`
    : greyed === "collapsed"
      ? "Greyed: far fewer vehicles than the months before, so it may not describe a normal month"
      : "";

export const monthPeriod = (month: string, rolling = false) =>
  rolling ? `${TRAILING_MONTHS} months to ${monthLabel(month)}` : monthLabel(month);
export const spanPeriod = (from: string, to: string) => (from === to ? monthLabel(from) : `${monthLabel(from)} to ${monthLabel(to)}`);

export function readout(r: Readout): string {
  let figure = "";
  if (r.share !== undefined) {
    figure = pct(r.share);
    if (r.n !== undefined && r.base !== undefined) figure += ` · ${count(r.n)} of ${vehicles(r.base)}`;
  } else if (r.n !== undefined) figure = vehicles(r.n);
  return [r.name, r.period, figure, greyedReason(r.greyed, r.minDenominator), ...(r.extra ?? [])].filter(Boolean).join("\n");
}
