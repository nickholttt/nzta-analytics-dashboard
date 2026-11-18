// The rows of a ranking: each value's rank, its rank in the same months a year earlier, the move between them, its share and its
// change. Pure, so tests/site/ runs it with Node's own test runner; LeagueChart draws what this returns. The one ranking rule
// (shared ranks, alphabetical within a tie) is in ranking.ts; docs/METRICS.md, "Ranking and ties".
import type { Cell, Column } from "./figures";
import { nameOrder, rankByCount } from "./ranking";
import { NOT_RECORDED_TOKEN, NO_MATCH_TOKEN, changeOnYear, fillTemplate, markReason, vehiclesText } from "./sentences";
import type { RankingThinPhrases } from "./sentences";

// The rows of a slice: one per month and value. Under a condition a month in which the condition keeps nothing has no rows, so
// an absent month inside the dataset's months is a month of zero vehicles, never a missing one.
// hidden: the value's count is hidden by the small-cell rule, so it has no number (D-139). notBrokenDown: the row stands for a period the field does not
// break down: it is no value.
export type LeagueSource = { month: string; value: string; n: number; denominator: number; hidden?: boolean; notBrokenDown?: boolean };

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
  // A hidden value is not counted and not ranked: it is kept apart, so a sum that forgot to ask would not turn it into a zero (D-139).
  const hiddenValues = new Set<string>();
  let notBrokenDown = false;
  for (const r of rows) {
    if (!monthDenominators.has(r.month)) monthDenominators.set(r.month, r.denominator);
    if (r.notBrokenDown) {
      notBrokenDown ||= r.month >= currentFrom && r.month <= end;
      continue;
    }
    if (r.hidden) {
      if (r.month >= currentFrom && r.month <= end) hiddenValues.add(r.value);
      continue;
    }
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
  // The values whose count is hidden, in name order, and the most vehicles any one of them can hold: the window's total less every value shown. A
  // sentence that names who leads says so only where the leader has more than that (leaderIsClear).
  const hidden = [...hiddenValues].filter((v) => !isReserved(v)).map((value) => ({ value, name: nameOf(value) })).sort((a, b) => nameOrder(a.name, b.name));
  const visible = [...currentCounts.values()].reduce((sum, n) => sum + n, 0);
  return { items, currentDenom, priorDenom, tiedBeyond, hidden, hiddenAtMost: hidden.length ? currentDenom - visible : 0, notBrokenDown };
}

// Whether a value in first place is surely first: no hidden value can hold as many vehicles as it. A leader that a hidden count could equal or pass is
// not named (invariant 8: a sentence resting on a hidden value is dropped).
export const leaderIsClear = (leaderCount: number, hiddenAtMost: number): boolean => leaderCount > hiddenAtMost;

// The table of a ranking: its columns and rows as the page shows them, which the file of figures writes (src/lib/figures.ts). One place builds
// it, so the table on the page and the file are the same rows. The words and formatters come from the caller, which has the config.
export type LeagueTable = {
  hasPrior: boolean;
  showYear: boolean;
  guard: { shares: boolean; changes: boolean };
  floor: number;
  valueHeading: string;
  countHeading: string;
  // Headings that say the rank is among values chosen and what the share is a share of; absent for the ranking of every value.
  headings?: { rank: string; share: string; prior: string };
  words: { noYearAgo: string; yearTooFew: string; shareChangeNoPrior: string; notRankedBefore: string };
  // A table of one period (a dataset that has no other) has no earlier window to move from: no move, no change in share, no rank before (default true).
  compares?: boolean;
  // The values whose count is hidden, listed after the ranked ones with no rank, no share and no count, each cell marked hidden with the reason.
  hiddenValues?: readonly { name: string }[];
  hiddenWords?: { text: string; reason: string };
  format: { count: (n: number) => string; pct: (x: number) => string; shareChange: (x: number) => string; yearChange: (x: number) => string };
};

export const moveText = (rankDelta: number | null, hasPrior: boolean): string =>
  !hasPrior ? "—" : rankDelta === null ? "New" : rankDelta > 0 ? `▲ +${rankDelta}` : rankDelta < 0 ? `▼ ${rankDelta}` : "—";

export function leagueTable(items: readonly LeagueRow[], t: LeagueTable): { columns: Column[]; rows: Cell[][]; notes: { column: string; reason: string }[] } {
  const { hasPrior, floor, words, format } = t;
  const compares = t.compares !== false;
  const withheld = (reason: string): Cell => ({ text: "—", csv: null, mark: "withheld", reason });
  const count: Column = { key: "count", name: t.countHeading, unit: "count" };
  const year: Column = { key: "year", name: "Change on a year ago", unit: "percent" };
  const yearFirst = t.showYear && compares;
  const columns: Column[] = [
    { key: "rank", name: "Rank", csvName: t.headings?.rank, unit: "count" },
    ...(compares ? [{ key: "move", name: "Move", text: true } as Column] : []),
    { key: "name", name: t.valueHeading, text: true },
    ...(yearFirst ? [count, year] : []),
    { key: "share", name: "Share", csvName: t.headings ? `${t.headings.share} (%)` : undefined, unit: "percent" },
    ...(compares ? [{ key: "change", name: "Change in share", unit: "points" } as Column] : []),
    ...(yearFirst ? [] : [count]),
    ...(compares ? [{ key: "before", name: "Rank a year before", csvName: t.headings?.prior, unit: "count" } as Column] : []),
  ];
  const rows = items.map((item): Cell[] => {
    const move: Cell = !hasPrior
      ? withheld(words.noYearAgo)
      : item.rankDelta === null
        ? { text: "New", csv: "New" }
        : { text: moveText(item.rankDelta, hasPrior), csv: item.rankDelta };
    const yearChange: Cell = item.yearChange === undefined ? withheld(hasPrior ? words.yearTooFew : words.noYearAgo) : format.yearChange(item.yearChange);
    const share: Cell = t.guard.shares ? { text: format.pct(item.share), mark: "greyed", reason: markReason("thin", floor) } : format.pct(item.share);
    const shareChange: Cell =
      item.shareDelta === undefined
        ? withheld(hasPrior ? words.shareChangeNoPrior : words.noYearAgo)
        : t.guard.changes
          ? { text: format.shareChange(item.shareDelta), mark: "greyed", reason: markReason("thin", floor) }
          : format.shareChange(item.shareDelta);
    const before: Cell = hasPrior && item.priorRank !== null ? { text: `#${item.priorRank}`, csv: item.priorRank } : withheld(hasPrior ? words.notRankedBefore : words.noYearAgo);
    const n = format.count(item.n);
    return [
      { text: `#${item.rank}`, csv: item.rank },
      ...(compares ? [move] : []),
      item.name,
      ...(yearFirst ? [n, yearChange] : []),
      share,
      ...(compares ? [shareChange] : []),
      ...(yearFirst ? [] : [n]),
      ...(compares ? [before] : []),
    ];
  });
  // A value whose count is hidden has no rank, no share and no count: each of those cells says hidden and is blank in the file, never a zero.
  if ((t.hiddenValues?.length ?? 0) > 0 && !t.hiddenWords) throw new Error("a table with hidden values needs the words for a hidden cell");
  const hiddenCell = (): Cell => ({ text: t.hiddenWords?.text ?? "", csv: null, mark: "hidden", reason: t.hiddenWords?.reason });
  for (const value of t.hiddenValues ?? []) {
    rows.push([
      hiddenCell(),
      ...(compares ? [{ text: "—", csv: null } as Cell] : []),
      value.name,
      ...(yearFirst ? [hiddenCell(), withheld(words.noYearAgo)] : []),
      hiddenCell(),
      ...(compares ? [withheld(words.noYearAgo)] : []),
      ...(yearFirst ? [] : [hiddenCell()]),
      ...(compares ? [withheld(words.noYearAgo)] : []),
    ]);
  }
  // Why a dash stands where a figure would, for the reasons the page does not say elsewhere (a ranking with no year before says so once, in its
  // own sentence): the page gives each under the table and the file in its line on withheld figures.
  const seen = new Map<string, { column: string; reason: string }>();
  rows.forEach((row) =>
    row.forEach((cell, i) => {
      if (typeof cell === "string" || cell.mark !== "withheld" || !cell.reason || cell.reason === words.noYearAgo) return;
      const column = columns[i].csvName ?? columns[i].name;
      seen.set(`${column}|${cell.reason}`, { column, reason: cell.reason });
    }),
  );
  return { columns, rows, notes: [...seen.values()] };
}

// What a ranking of some values says about them: who stands first (all who share first place) and how many vehicles each has, and which of the
// values take no place, by the name a reader sees and by why: a value takes a place only when it has vehicles in the window and is not a
// reserved one (leagueRows), so the others are named, in groups a sentence can say truthfully (not recorded and no match in the reference
// are different facts about the vehicles, and "no vehicles" is a third).
export function pickedSummary(picked: readonly string[], items: readonly LeagueRow[], nameOf: (value: string) => string) {
  const placed = new Set(items.map((i) => i.value));
  const leaders = items.filter((i) => i.rank === 1);
  const unplaced = picked.filter((v) => !placed.has(v));
  const named = (keep: (v: string) => boolean) => unplaced.filter(keep).map(nameOf).sort(nameOrder);
  return {
    leaders: leaders.map((i) => i.name),
    leaderCount: leaders[0]?.n ?? 0,
    unranked: {
      notRecorded: named((v) => v === NOT_RECORDED_TOKEN),
      unmatched: named((v) => v === NO_MATCH_TOKEN),
      empty: named((v) => v !== NOT_RECORDED_TOKEN && v !== NO_MATCH_TOKEN),
    },
  };
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
  // The ranking is of one month, so its earlier window is one month and the sentence says "month", not "months".
  single: boolean;
  phrases: RankingThinPhrases;
}): { shares: boolean; changes: boolean; sentence: string | undefined } {
  const { floor, currentDenom, priorDenom, hasPrior, window, priorDates, single, phrases } = input;
  const shares = floor > 0 && currentDenom < floor;
  const earlier = floor > 0 && hasPrior && priorDenom > 0 && priorDenom < floor;
  const changes = shares || earlier;
  const sentence = shares
    ? fillTemplate(phrases.ranking_thin, { vehicles: vehiclesText(currentDenom), window, floor }).text
    : earlier
      ? fillTemplate(single ? phrases.ranking_thin_prior_month : phrases.ranking_thin_prior, { vehicles: vehiclesText(priorDenom), prior: priorDates, floor }).text
      : undefined;
  return { shares, changes, sentence };
}
