// The brands nearest a brand by volume: the pages' "beside its nearest rivals". Pure and free of any domain word. The set is fixed by the 12-month count of all
// vehicles and is the same for every window and condition, so the rows never reshuffle when a visitor changes either.

// A value and the `each` values next above it and below it in `ranked` (most vehicles first), in rank order. At either end of the list the set shifts so that
// `2 * each` rivals always show where the list is long enough. Nothing where the value is not in the list. A value with a hidden count is left out of `ranked` by
// the caller, so the next one stands in for it.
export function nearestRivals(value: string, ranked: readonly string[], each = 2): string[] | undefined {
  const i = ranked.indexOf(value);
  if (i < 0) return undefined;
  const want = each * 2;
  const last = ranked.length - 1;
  let from = Math.max(0, i - each);
  let to = Math.min(last, i + each);
  if (to - from < want) {
    if (from === 0) to = Math.min(last, want);
    else if (to === last) from = Math.max(0, last - want);
  }
  return ranked.slice(from, to + 1);
}

// The rival a brand's gap is stated against: the one just above it in the set, or just below it for the first in the set. Nothing for a set of one.
export function gapAgainst(value: string, set: readonly string[]): string | undefined {
  const i = set.indexOf(value);
  if (i < 0 || set.length < 2) return undefined;
  return i === 0 ? set[1] : set[i - 1];
}
