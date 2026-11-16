// Which shapes fit a question: one rule table in config/chart_rules.json, read from the top, the first rule that
// matches giving the answer, best shape first (CLAUDE.md, Shapes; D-100). No field lists its own charts. This module
// knows no measure, field or value: a question is six facts, each a word from the table's own vocabulary.
import rulesDoc from "../../config/chart_rules.json";

export type FactName = "measure" | "by" | "values" | "span" | "picked" | "crossed_with";
// A fact the question cannot state is left out, and matches only a rule that does not mention it.
export type Facts = Partial<Record<FactName, string>>;
export type Rule = { id: string; when: Partial<Record<FactName, string | string[]>>; shapes: string[]; note?: string };
export type RuleTable = {
  shapes: string[];
  facts: Record<FactName, string[]>;
  value_classes: Record<string, string>;
  needs_breakdown: string[];
  rules: Rule[];
};

export const ruleTable = rulesDoc as unknown as RuleTable;

const matches = (rule: Rule, facts: Facts) =>
  (Object.entries(rule.when) as [FactName, string | string[]][]).every(([name, wanted]) => [wanted].flat().includes(facts[name] ?? ""));

// The shapes that fit, best first. The table's own last rule matches everything, so this is never empty for the table
// in config; a table passed in that lacks one gives an empty answer, and a test holds the real one to it.
export function shapesFor(facts: Facts, table: RuleTable = ruleTable): string[] {
  const rule = table.rules.find((r) => matches(r, facts));
  return rule ? rule.shapes : [];
}

// A dimension's `cardinality`, as the fact `values`.
export const valuesClass = (cardinality?: string, table: RuleTable = ruleTable): string => (cardinality && table.value_classes[cardinality]) || "few";

// Whether a kind of measure can be asked of all vehicles together, with no breakdown.
export const needsBreakdown = (kind?: string, table: RuleTable = ruleTable): boolean => Boolean(kind && table.needs_breakdown.includes(kind));

// Whether a shape is always a picture of one window and never of a series over time: every rule that lists it asks for one period. A ranking
// and a grid are, a line and a map are not. The time row offers a view of such a shape the one-month and 12-month windows, as one it can be
// brought back to.
export const isWindowShape = (shape: string, table: RuleTable = ruleTable): boolean => {
  const listing = table.rules.filter((r) => r.shapes.includes(shape));
  return listing.length > 0 && listing.every((r) => r.when.span === "one_period");
};
