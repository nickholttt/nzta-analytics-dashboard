// The rows of a ranking: each value's rank, its rank in the same months a year earlier, the move between them, its share and its
// change. Pure, so tests/site/ runs it with Node's own test runner; LeagueChart draws what this returns. The one ranking rule
// (shared ranks, alphabetical within a tie) is in ranking.ts; docs/METRICS.md, "Ranking and ties".
import { rankByCount } from "./ranking";
import { changeOnYear, fillTemplate, vehiclesText } from "./sentences";
import type { RankingThinPhrases } from "./sentences";

// The rows of a slice: one per month and value. Under a condition a month in which the condition keeps nothing has no rows, so
// an absent month inside the dataset's months is a month of zero vehicles, never a missing one.
export type LeagueSource = { month: string; value: string; n: number; denominator: number };

export type LeagueRow = {
  rank: number;
  // Null where there is no comparison at all (the earlier window is not wholly inside the dataset's months) or the value had no
  // vehicles in the earlier window.
  priorRank: number | null;
  rankDelta: number | null;
  value: string;
  name: string;
  n: number;
  share: number;
  priorN: number;
  priorShare: number;
  // Undefined where there is no earlier window to compare with, or the earlier window holds no vehicles at all in what is
  // counted: a share of no vehicles has no value, so there is nothing to take a change from.
  shareDelta: number | undefined;
  // The change in the count on the same months a year earlier, as a proportion; undefined where there is no comparison or the
  // earlier count is under the change-on-a-year-ago floor, which is the measure's own guard.
  yearChange: number | undefined;
};

export type LeagueInput = {
  rows: readonly LeagueSource[];
  currentFrom: string;
  end: string;
  priorFrom: string;
  priorTo: string;
  // Whether the earlier window lies wholly inside the months the dataset covers (rankingText). Only then is there a rank, a move
  // or a change a year earlier; together or not at all.
  hasPrior: boolean;
  topN: number;
  nameOf: (value: string) => string;
  yearFloor: number;
};

// A reserved value ("not recorded", "no reference match", "beyond the cap", and any other the cube reserves) is not a place.
export const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");

const months = (from: string, to: string) => {
  const out: string[] = [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  for (let k = fy * 12 + fm - 1; k <= ty * 12 + tm - 1; k++) out.push(`${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`);
  return out;
};

export function leagueRows(input: LeagueInput) {
  const { rows, currentFrom, end, priorFrom, priorTo, hasPrior, topN, nameOf, yearFloor } = input;
  const currentCounts = new Map<string, number>();
  const priorCounts = new Map<string, number>();
  const monthDenominators = new Map<string, number>();
  for (const r of rows) {
    if (!monthDenominators.has(r.month)) monthDenominators.set(r.month, r.denominator);
    if (r.month >= currentFrom && r.month <= end) currentCounts.set(r.value, (currentCounts.get(r.value) ?? 0) + r.n);
    else if (r.month >= priorFrom && r.month <= priorTo) priorCounts.set(r.value, (priorCounts.get(r.value) ?? 0) + r.n);
  }
  const total = (from: string, to: string) => months(from, to).reduce((sum, m) => sum + (monthDenominators.get(m) ?? 0), 0);
  const currentDenom = total(currentFrom, end);
  const priorDenom = total(priorFrom, priorTo);

  const rankedOf = (counts: Map<string, number>) =>
    rankByCount([...counts.entries()].filter(([value, n]) => !isReserved(value) && n > 0).map(([value, n]) => ({ value, name: nameOf(value), n })));
  const current = rankedOf(currentCounts);
  const priorRank = new Map(hasPrior ? rankedOf(priorCounts).map((e) => [e.value, e.rank]) : []);

  const items: LeagueRow[] = current.slice(0, topN).map(({ value, name, n, rank }) => {
    const before = priorRank.get(value) ?? null;
    const priorN = priorCounts.get(value) ?? 0;
    const share = currentDenom > 0 ? n / currentDenom : 0;
    const priorShare = priorDenom > 0 ? priorN / priorDenom : 0;
    return {
      rank,
      priorRank: before,
      rankDelta: before !== null ? before - rank : null,
      value,
      name,
      n,
      share,
      priorN,
      priorShare,
      shareDelta: hasPrior && priorDenom > 0 ? share - priorShare : undefined,
      yearChange: hasPrior ? changeOnYear(n, priorN, yearFloor)?.change : undefined,
    };
  });
  // Entries beyond the cut that share the last shown rank: the list shows the alphabetically first of a tie and drops the rest.
  const lastRank = items.length ? items[items.length - 1].rank : undefined;
  const tiedBeyond = lastRank === undefined ? 0 : current.slice(topN).filter((e) => e.rank === lastRank).length;
  return { items, currentDenom, priorDenom, tiedBeyond };
}

// Whether a ranking's base is too small to read a share from, and the one sentence that says how small (docs/METRICS.md, "A ranking
// and the precision floor"). The floor is the share's own, 200 vehicles, applied to a window's total as it is to a month's: a
// ranking of one month is read against the floor on that month's vehicles, and a ranking of twelve months on the twelve months'
// total, never on 12 times the floor (a window is tested as a whole everywhere else on the site: the key under a share chart, the
// bar chart, the map). A ranking is never hidden for it: its shares and its changes in share stay, greyed.
//   shares: the window the ranking ranks holds fewer vehicles than the floor, so every share is greyed, and so is every change in
//     share (a change reads this window's share).
//   changes: the changes in share are greyed: the window ranked is under the floor, or the earlier window it is compared with holds
//     some vehicles but fewer than the floor. An earlier window of no vehicles gives no change at all, so nothing is greyed there.
export function rankingGuard(input: {
  floor: number;
  currentDenom: number;
  priorDenom: number;
  hasPrior: boolean;
  window: string;
  priorDates: string;
  phrases: RankingThinPhrases;
}): { shares: boolean; changes: boolean; sentence: string | undefined } {
  const { floor, currentDenom, priorDenom, hasPrior, window, priorDates, phrases } = input;
  const shares = floor > 0 && currentDenom < floor;
  const earlier = floor > 0 && hasPrior && priorDenom > 0 && priorDenom < floor;
  const changes = shares || earlier;
  const sentence = shares
    ? fillTemplate(phrases.ranking_thin, { vehicles: vehiclesText(currentDenom), window, floor }).text
    : earlier
      ? fillTemplate(phrases.ranking_thin_prior, { vehicles: vehiclesText(priorDenom), prior: priorDates, floor }).text
      : undefined;
  return { shares, changes, sentence };
}
