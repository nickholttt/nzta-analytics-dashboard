// The two notes a chart by the powertrain field carries about hybrids: how far the mild line is identified, and, for a dataset that
// does not divide its hybrids at all, that they are shown undivided. Pure, so a test runs the panel's own logic on a fixture manifest.
// The words are templates in config/presets.json (defaults.phrases); no powertrain is named here, the names come in as arguments.
import { fillTemplate } from "./sentences";

export type CoverageBasis = { window_months?: number; coverage_stated_confidence: number | null; coverage_high_confidence_only: number | null };

// The build's block for one dataset (docs/CUBE_SCHEMA.md, mild_hybrid_identification_coverage). mild_split_published says whether the
// dataset divides its hybrids at all; a manifest built before the field existed does not have it, and then they are divided.
export type HybridCoverage = {
  label: string;
  all_time: CoverageBasis;
  trailing: CoverageBasis;
  mild_split_published?: boolean;
  publish_split_at_trailing_high_confidence_coverage?: number;
};

export const splitPublished = (coverage?: HybridCoverage): boolean => coverage?.mild_split_published !== false;

export type HybridPhrases = {
  identification_coverage: string;
  identification_coverage_internal: string;
  identification_coverage_whole: string;
  mild_split_withheld: string;
  mild_split_withheld_internal: string;
};

export type HybridNotes = {
  // The note on how far the mild line is identified. Absent where the dataset does not divide its hybrids, or the line is not drawn.
  coverage?: string;
  // The note that this dataset's hybrids are shown undivided, with the caveat that explains it linked after it.
  withheld?: string;
};

export function hybridNotes(input: {
  coverage?: HybridCoverage;
  // The chart is by the field that carries the hybrid values.
  onPowertrain: boolean;
  // The mild value is among the rows the chart draws, with vehicles.
  mildDrawn: boolean;
  // The view is narrowed to part of the dataset (a filter of its own or a condition).
  narrowed: boolean;
  internal: boolean;
  // The names the notes speak of, from config: the mild value and the value that holds the hybrids undivided.
  mildValue: string;
  undividedValue: string;
  phrases: HybridPhrases;
  percent: (x: number) => string;
}): HybridNotes {
  const { coverage, onPowertrain, mildDrawn, narrowed, internal, mildValue, undividedValue, phrases, percent } = input;
  if (!coverage || !onPowertrain) return {};
  if (!splitPublished(coverage)) {
    const threshold = coverage.publish_split_at_trailing_high_confidence_coverage;
    const trailingHigh = coverage.trailing.coverage_high_confidence_only;
    const template = internal && threshold !== undefined && trailingHigh !== null ? phrases.mild_split_withheld_internal : phrases.mild_split_withheld;
    return {
      withheld: fillTemplate(template, {
        value: undividedValue.toLowerCase(),
        trailing_high: trailingHigh === null ? undefined : percent(trailingHigh),
        threshold: threshold === undefined ? undefined : percent(threshold),
      }).text,
    };
  }
  if (!mildDrawn) return {};
  return {
    coverage: [
      fillTemplate(internal ? phrases.identification_coverage_internal : phrases.identification_coverage, {
        label: coverage.label,
        value: mildValue.toLowerCase(),
        window: coverage.trailing.window_months,
        trailing: percent(coverage.trailing.coverage_stated_confidence ?? 0),
        all_time: percent(coverage.all_time.coverage_stated_confidence ?? 0),
        trailing_high: percent(coverage.trailing.coverage_high_confidence_only ?? 0),
        all_time_high: percent(coverage.all_time.coverage_high_confidence_only ?? 0),
      }).text,
      ...(narrowed ? [phrases.identification_coverage_whole] : []),
    ].join(" "),
  };
}
