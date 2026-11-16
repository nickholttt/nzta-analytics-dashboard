// A Parquet file the reader cannot decode, as opposed to a file that did not arrive. Reloading cannot mend it, so it has
// its own plain sentence, which names no codec. Pure, so tests/site/ runs it with Node's own test runner.
export const UNREADABLE_DATA =
  "The data for this chart is in a form this page cannot read, so the chart cannot be drawn. Reloading the page will not help.";

// hyparquet's own wording for a page in a codec it was given no decoder for (src/lib/data.ts says which it has).
export const isUnreadableForm = (e: unknown): boolean => e instanceof Error && /unsupported compression codec/i.test(e.message);
