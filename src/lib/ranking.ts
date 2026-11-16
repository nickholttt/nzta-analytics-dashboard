// The one rule for ranking by a count, docs/METRICS.md "Ranking and ties": entries with the same count share a rank, the rank
// of the first of them (1, 2, 2, 4), and are listed in alphabetical order of the name a reader sees. Everything on the site that
// puts values in order of size, or says where one stands, goes through here, so the order never depends on the order the
// data happens to arrive in.
export type Countable = { value: string; name: string; n: number };

const collator = new Intl.Collator("en");

// Largest count first; equal counts alphabetically by the name shown, and by the raw value if two values show the same name,
// so the order is the same whatever order the entries came in.
export function byCountThenName(a: Countable, b: Countable): number {
  return b.n - a.n || collator.compare(a.name, b.name) || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0);
}

export function rankByCount<T extends Countable>(entries: T[]): (T & { rank: number })[] {
  const sorted = [...entries].sort(byCountThenName);
  let rank = 0;
  return sorted.map((entry, index) => {
    if (index === 0 || entry.n !== sorted[index - 1].n) rank = index + 1;
    return { ...entry, rank };
  });
}
