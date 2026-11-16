// Whether a build lacks a dataset that config has words for a build without it. Pure, with no imports, so tests/site/ runs it.
// The manifest says so (`not_built`), or, for a cube built before the dataset existed, has no entry for it at all. With no
// entry and no words, the dataset is not "not built": it is not in the cube, and the resolver says that instead.
export const isUnbuilt = (entry: { not_built?: string } | undefined, hasNotBuiltWords: boolean): boolean =>
  entry ? Boolean(entry.not_built) : hasNotBuiltWords;

// The first month a dataset covers. A dataset made from a supplied file says it; for the register, which has no first month in the
// manifest, it is the month its count of months reaches back to from its last. The register's earliest months are sparse, so that
// month is later than its true first, far from any window a ranking compares. A dataset the manifest does not describe has no first
// month, and nothing is then said to be inside it.
export function datasetFirstMonth(entry: { months?: number; supplied?: { months: { first: string } } } | undefined, latest: string): string {
  if (entry?.supplied) return entry.supplied.months.first;
  if (entry?.months === undefined) return "9999-12";
  const [y, m] = latest.split("-").map(Number);
  const k = y * 12 + (m - 1) - (entry.months - 1);
  return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`;
}
