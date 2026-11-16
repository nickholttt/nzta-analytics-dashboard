// Whether a build lacks a dataset that config has words for a build without it. Pure, with no imports, so tests/site/ runs it.
// The manifest says so (`not_built`), or, for a cube built before the dataset existed, has no entry for it at all. With no
// entry and no words, the dataset is not "not built": it is not in the cube, and the resolver says that instead.
export const isUnbuilt = (entry: { not_built?: string } | undefined, hasNotBuiltWords: boolean): boolean =>
  entry ? Boolean(entry.not_built) : hasNotBuiltWords;
