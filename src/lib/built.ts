// Whether a build lacks a dataset that config has words for a build without it. Pure, with no imports, so tests/site/ runs it.
// The manifest says so (`not_built`), or, for a cube built before the dataset existed, has no entry for it at all. With no
// entry and no words, the dataset is not "not built": it is not in the cube, and the resolver says that instead.
export const isUnbuilt = (entry: { not_built?: string } | undefined, hasNotBuiltWords: boolean): boolean =>
  entry ? Boolean(entry.not_built) : hasNotBuiltWords;

// The first month a dataset covers: the start of its supplied file where it has one, otherwise the earliest month in which the
// page has seen it hold vehicles (`earliestWithRows`, from the data the view loaded: data.ts, loadFirstMonth). Never derived from
// the manifest's `months`, which counts the months that have rows, not a span of months (the register's 1,197 reach back to 1912,
// not to 1927). Every month after the first, with or without rows, is inside the dataset: a month with no rows is zero. With no
// first month known, nothing is said to be inside the dataset.
export function datasetFirstMonth(entry: { supplied?: { months: { first: string } } } | undefined, earliestWithRows: string | undefined): string {
  return entry?.supplied?.months.first ?? earliestWithRows ?? "9999-12";
}
