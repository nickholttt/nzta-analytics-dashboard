// What the internal status page says about the warnings a build recorded (`manifest.warnings`, docs/CUBE_SCHEMA.md,
// Warnings). The pipeline's own words, as it wrote them and in the order it raised them: this is a page for the
// maintainer, which already shows pipeline text (a dataset's `not_built` reason), and no public page uses this.

export type WarningsView = {
  snapshot: string;
  generated: string;
  // null when the manifest has no list at all (not the same as an empty one: "none were raised" is a claim).
  warnings: string[] | null;
};

type ManifestLike = { latest_snapshot: string; generated_at: string; warnings?: unknown };

// "2026-11-14T23:09:41Z" reads "2026-11-14 23:09 UTC". A time written any other way is shown as it is, not guessed at.
export const generatedLabel = (generatedAt: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?Z$/.exec(generatedAt);
  return match ? `${match[1]} ${match[2]} UTC` : generatedAt;
};

export const warningsView = (manifest: ManifestLike): WarningsView => ({
  snapshot: manifest.latest_snapshot,
  generated: generatedLabel(manifest.generated_at),
  warnings: Array.isArray(manifest.warnings) ? manifest.warnings.map((w) => (typeof w === "string" ? w : JSON.stringify(w))) : null,
});

// The line under the heading: which cube, when it was made, and how many warnings it carries.
export const warningsMeta = (view: WarningsView): string => {
  const count =
    view.warnings === null
      ? "no warnings list in this manifest"
      : view.warnings.length === 0
        ? "no warnings"
        : `${view.warnings.length} ${view.warnings.length === 1 ? "warning" : "warnings"}`;
  return `Snapshot ${view.snapshot} · generated ${view.generated} · ${count}`;
};
