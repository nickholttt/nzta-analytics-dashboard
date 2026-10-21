// The Build page: a sentence whose blanks are choices, and the chart it describes, drawn by the same
// panel as Explore. The choices live in the address bar, so the panel's "Copy link" shares the chart.
import { useMemo, useState } from "react";
import { builderSpec } from "../lib/config";
import { builderPreset, settle } from "../lib/builder";
import type { BuilderOption, Choice } from "../lib/builder";
import { getParam, setParam } from "../lib/url";
import PresetPanel from "./PresetPanel";

export default function SentenceBuilder({ options }: { options: BuilderOption[] }) {
  const id = builderSpec.id;
  const fallback = settle(options);
  const [choice, setChoice] = useState<Choice>(() => settle(options, getParam(id, "measure", ""), getParam(id, "by", "")));
  const preset = useMemo(() => builderPreset(choice), [choice]);
  const measure = options.find((o) => o.id === choice.measure) ?? options[0];

  const choose = (measureId: string, dimensionId: string) => {
    const next = settle(options, measureId, dimensionId);
    setChoice(next);
    setParam(id, "measure", next.measure, fallback.measure);
    setParam(id, "by", next.dimension, fallback.dimension);
  };

  return (
    <>
      <form className="sentence" aria-label="Build a chart" onSubmit={(e) => e.preventDefault()}>
        <p className="sentence-text">
          {builderSpec.lead}{" "}
          <select aria-label="What to show" value={choice.measure} onChange={(e) => choose(e.target.value, choice.dimension)}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.phrase}
              </option>
            ))}
          </select>
          {measure.joiner ? ` ${measure.joiner} ` : " "}
          <select aria-label="Split by" value={choice.dimension} onChange={(e) => choose(choice.measure, e.target.value)}>
            {measure.dimensions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.phrase}
              </option>
            ))}
          </select>
        </p>
      </form>

      {/* Keyed by the choice, so a new sentence opens on its own defaults while the time range in the
          address bar carries over. */}
      <PresetPanel key={`${choice.measure}:${choice.dimension}`} preset={preset} audience="public" />

      {builderSpec.not_offered.length > 0 ? (
        <section className="not-offered" aria-labelledby="not-offered-head">
          <h2 id="not-offered-head" className="eyebrow">
            Not offered yet
          </h2>
          <ul className="notes">
            {builderSpec.not_offered.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
