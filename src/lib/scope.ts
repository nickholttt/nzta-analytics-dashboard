// The sentence that says which vehicles a built question counts: every condition, each with all of its values. Pure, so a test
// runs the sentence the panel shows, and the file of figures (src/lib/figures.ts) repeats it word for word.
export type Condition = { dimension: string; values: string[] };

// field: a field in the words a sentence uses; value: one value of it as a reader sees it, without the quotation marks.
export function conditionsSentence(
  conditions: readonly Condition[],
  field: (dimension: string) => string,
  value: (dimension: string, value: string) => string,
): string | undefined {
  const kept = conditions.filter((c) => c.values.length > 0);
  if (kept.length === 0) return undefined;
  const lines = kept.map((c) => `${field(c.dimension)} is ${c.values.map((v) => `“${value(c.dimension, v)}”`).join(" or ")}`);
  return `Only vehicles where ${lines.join(", and ")} are counted.`;
}
