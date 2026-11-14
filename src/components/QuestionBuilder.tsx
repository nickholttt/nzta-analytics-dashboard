// The Build page: a visitor asks their own question, what to measure, broken down by what, comparing which values,
// among which vehicles, and the charts that answer it are drawn by the same panel as Explore (D-058, D-059). The
// question lives in the address bar, so the panel's "Copy link" shares it.
import { useEffect, useMemo, useRef, useState } from "react";
import { builderSpec, dimensionLabel } from "../lib/config";
import { MAX_VALUES, builderPresets, questionParams, readQuestion, settle, viewsFor } from "../lib/builder";
import type { Question, Vocabulary } from "../lib/builder";
import { factView, loadManifest, loadSlice } from "../lib/data";
import type { SliceRow } from "../lib/data";
import { addMonths } from "../lib/measures";
import { count } from "../lib/readout";
import PresetPanel, { reservedLabel } from "./PresetPanel";

// The chart's own settings in the address bar. A new question clears them, so its charts open on their defaults.
const CHART_PARAMS = ["period", "range", "smoothing"];
// Values filled in when a count is broken down and none are chosen yet: a count draws one line per value.
const STARTING_VALUES = 5;
const SUGGESTIONS = 8;
const VIEW_LABELS: Record<string, string> = { mix: "Lines over time", geo: "Map", distribution: "Bars by band", league: "Ranking", trend: "Line" };

const valueLabel = reservedLabel;
const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");
// Focus moves after React has drawn the change, so the element it moves to exists.
const focusSoon = (find: () => HTMLElement | null | undefined) => requestAnimationFrame(() => find()?.focus());

type ValueOption = { value: string; recent: number; total: number };

// Every value of a breakdown, largest in the last 12 months first, then largest over all time: what a visitor most
// likely wants is at the top, and a value that has gone (a brand no longer sold) is still there to find. Counted
// among the vehicles the question's other conditions keep, so the list matches what the chart will show.
async function valueOptions(dataset: string, dimension: string, where: Record<string, string[]>): Promise<ValueOption[]> {
  const filtered = Object.values(where).some((kept) => kept.length > 0);
  const [rows, manifest] = await Promise.all([
    filtered ? factView(dataset, dimension, undefined, where) : loadSlice(dataset, dimension),
    loadManifest(),
  ]);
  const latest = manifest.latest_snapshot.slice(0, 7);
  const from = addMonths(latest, -11);
  const byValue = new Map<string, ValueOption>();
  for (const r of rows as SliceRow[]) {
    const o = byValue.get(r.value) ?? { value: r.value, recent: 0, total: 0 };
    o.total += r.n;
    if (r.month >= from && r.month <= latest) o.recent += r.n;
    byValue.set(r.value, o);
  }
  return [...byValue.values()].filter((o) => o.total > 0).sort((a, b) => b.recent - a.recent || b.total - a.total || a.value.localeCompare(b.value));
}

function useValueOptions(dataset: string, dimension: string, where: Record<string, string[]>) {
  const [options, setOptions] = useState<ValueOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const whereKey = JSON.stringify(where);
  useEffect(() => {
    let current = true;
    setOptions(null);
    setFailed(false);
    valueOptions(dataset, dimension, JSON.parse(whereKey)).then(
      (o) => current && setOptions(o),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [dataset, dimension, whereKey]);
  return { options, failed };
}

function ValuePicker({
  dataset,
  dimension,
  noun,
  chosen,
  where,
  onChange,
  max,
  emptyHint,
}: {
  dataset: string;
  dimension: string;
  noun: string;
  chosen: string[];
  where: Record<string, string[]>;
  onChange: (values: string[]) => void;
  max?: number;
  emptyHint?: string;
}) {
  const { options, failed } = useValueOptions(dataset, dimension, where);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const inputId = `find-${dimension}`;
  const full = max !== undefined && chosen.length >= max;
  const filtered = Object.values(where).some((kept) => kept.length > 0);
  const matches = useMemo(() => {
    if (!options) return [];
    const q = query.trim().toLowerCase();
    return options.filter((o) => !chosen.includes(o.value) && (!q || valueLabel(o.value).toLowerCase().includes(q))).slice(0, SUGGESTIONS);
  }, [options, query, chosen]);
  // The search box, or the picker itself once it is full and the box has gone, so focus is never dropped to the page.
  const refocus = () => focusSoon(() => input.current ?? box.current);

  return (
    <div className="picker" ref={box} tabIndex={-1}>
      {chosen.length > 0 ? (
        <ul className="chips" aria-label={`Chosen ${noun} values`}>
          {chosen.map((v) => (
            <li key={v}>
              {valueLabel(v)}
              <button
                type="button"
                aria-label={`Remove ${valueLabel(v)}`}
                onClick={() => {
                  onChange(chosen.filter((x) => x !== v));
                  refocus();
                }}
              >
                <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                  <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : emptyHint ? (
        <p className="picker-hint">{emptyHint}</p>
      ) : null}
      {failed ? (
        <p className="picker-hint">The values to choose from did not load. Reload the page to try again.</p>
      ) : full ? (
        <p className="picker-hint">Up to {max} can be compared at once. Remove one to add another.</p>
      ) : (
        <>
          <label className="picker-find" htmlFor={inputId}>
            Search {noun}
          </label>
          <input id={inputId} ref={input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          {options === null ? (
            <p className="picker-hint">Loading…</p>
          ) : matches.length === 0 ? (
            <p className="picker-hint">
              {query.trim()
                ? `Nothing matches “${query.trim()}”${filtered ? " among the vehicles the conditions keep" : ""}.`
                : options.length === 0
                  ? filtered
                    ? "The other conditions keep no vehicles, so there is nothing to choose from."
                    : "There is nothing to choose from."
                  : "Every value is chosen."}
            </p>
          ) : (
            <ul className="suggestions" aria-label={query.trim() ? `Matching “${query.trim()}”` : "The largest in the last 12 months"}>
              {matches.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange([...chosen, o.value]);
                      setQuery("");
                      refocus();
                    }}
                  >
                    <span className="suggestion-name">{valueLabel(o.value)}</span>
                    <span className="suggestion-figure">
                      {o.recent > 0 ? `${count(o.recent)} first registered in the last 12 months` : `${count(o.total)} still registered`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const without = (where: Record<string, string[]>, dimension: string) => Object.fromEntries(Object.entries(where).filter(([d]) => d !== dimension));

export default function QuestionBuilder({ vocabulary }: { vocabulary: Vocabulary }) {
  const { dataset } = vocabulary;
  const [question, setQuestion] = useState<Question>(() =>
    settle(vocabulary, typeof window === "undefined" ? {} : readQuestion(window.location.search)),
  );
  // The question as it stands now, for work that finishes later (a list of values arriving) and must build on the
  // latest question, not the one it started from.
  const latest = useRef(question);
  latest.current = question;
  const [adding, setAdding] = useState("");
  const addSelect = useRef<HTMLSelectElement>(null);
  const measure = vocabulary.measures.find((m) => m.id === question.measure) ?? vocabulary.measures[0];
  const breakdown = measure.dimensions.find((d) => d.id === question.by);
  const countsLines = measure.id === "count" || builderSpec.measures.find((m) => m.id === measure.id)?.parts?.includes("count");
  const presets = useMemo(() => builderPresets(question, valueLabel), [question]);
  const views = useMemo(() => viewsFor(question), [question]);
  const filterLabel = (id: string) => vocabulary.filters.find((f) => f.id === id)?.label ?? dimensionLabel(id) ?? id;
  // A link can name a condition this data cannot apply. It stays in the question, where it blocks the chart, but the
  // lists of values are counted among the conditions that can be applied.
  const canApply = (id: string) => vocabulary.filters.some((f) => f.id === id);
  const applicable = (where: Record<string, string[]>) => Object.fromEntries(Object.entries(where).filter(([d]) => canApply(d)));

  const ask = (next: Partial<Question>) => {
    const settled = settle(vocabulary, { ...latest.current, ...next });
    latest.current = settled;
    setQuestion(settled);
    const url = new URL(window.location.href);
    // Both charts' settings go: the first chart's are scoped by the builder's id, a second chart's by its own.
    for (const k of [...url.searchParams.keys()]) {
      if (k.startsWith(`${builderSpec.id}.`) || k.startsWith(`${builderSpec.id}-`)) url.searchParams.delete(k);
    }
    for (const [k, v] of questionParams(settled)) url.searchParams.append(k, v);
    for (const p of CHART_PARAMS) url.searchParams.delete(`${builderSpec.id}.${p}`);
    window.history.replaceState(null, "", `${url.pathname}?${url.searchParams}${url.hash}`);
  };

  // A count broken down draws one line per chosen value, so with none chosen it starts on the largest few among the
  // vehicles the conditions keep. Applied only if the question is still waiting for them when the list arrives.
  const whereKey = JSON.stringify(applicable(question.where));
  const awaitingValues = Boolean(countsLines && question.by && question.values.length === 0 && breakdown?.values);
  // The question whose starting values were looked for and not found: nothing was first registered in the last 12
  // months among the vehicles its conditions keep.
  const startKey = `${question.by}|${whereKey}`;
  const [noStartFor, setNoStartFor] = useState<string | null>(null);
  useEffect(() => {
    const by = question.by;
    if (!awaitingValues || !by) return;
    let current = true;
    valueOptions(dataset, by, JSON.parse(whereKey)).then((options) => {
      const now = latest.current;
      if (!current || now.by !== by || now.values.length > 0) return;
      const top = options.filter((o) => !isReserved(o.value) && o.recent > 0).slice(0, STARTING_VALUES).map((o) => o.value);
      if (top.length) ask({ values: top });
      else setNoStartFor(startKey);
    });
    return () => {
      current = false;
    };
    // ask reads the latest question through its ref; these are what decide whether starting values are needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingValues, question.by, dataset, whereKey]);

  const unusedFilters = vocabulary.filters.filter((f) => f.id !== question.by && !(f.id in question.where));
  const addCondition = () => {
    const id = adding;
    if (!id) return;
    setAdding("");
    // A condition with no value chosen keeps every vehicle, so it is held on the page until it has one.
    setQuestion((q) => ({ ...q, where: { ...q.where, [id]: [] } }));
    focusSoon(() => document.getElementById(`find-${id}`));
  };

  return (
    <>
      <form className="question" aria-label="Build a question" onSubmit={(e) => e.preventDefault()}>
        <p className="sentence-text">
          {builderSpec.lead}{" "}
          <select aria-label="What to show" value={measure.id} onChange={(e) => ask({ measure: e.target.value, view: null })}>
            {vocabulary.measures.map((m) => (
              <option key={m.id} value={m.id}>
                {m.phrase}
              </option>
            ))}
          </select>
          {measure.dimensions.length > 0 ? (
            <>
              {measure.joiner ? ` ${measure.joiner} ` : " "}
              <select
                aria-label="Broken down by"
                value={question.by ?? ""}
                onChange={(e) => ask({ by: e.target.value === "" ? null : e.target.value, values: [], view: null })}
              >
                {measure.allowsTotal ? <option value="">all of them together</option> : null}
                {measure.dimensions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.phrase}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </p>

        {breakdown?.values ? (
          <fieldset className="question-part">
            <legend>Compare</legend>
            <ValuePicker
              dataset={dataset}
              dimension={breakdown.id}
              noun={filterLabel(breakdown.id).toLowerCase()}
              chosen={question.values}
              where={applicable(question.where)}
              max={MAX_VALUES}
              onChange={(values) => ask({ values })}
              emptyHint={countsLines ? undefined : "Showing the largest, with the rest as All other. Choose values to compare only those."}
            />
          </fieldset>
        ) : null}

        {vocabulary.filters.length > 0 ? (
          <fieldset className="question-part">
            <legend>Only vehicles where</legend>
            {Object.keys(question.where).length === 0 ? <p className="picker-hint">Every vehicle is counted. Add a condition to narrow it.</p> : null}
            {Object.entries(question.where).map(([d, kept]) => (
              <div className="condition" key={d}>
                <div className="condition-head">
                  <span className="condition-name">{filterLabel(d)}</span>
                  <button
                    type="button"
                    className="button-quiet"
                    aria-label={`Remove the condition on ${filterLabel(d).toLowerCase()}`}
                    onClick={() => {
                      ask({ where: without(question.where, d) });
                      focusSoon(() => addSelect.current);
                    }}
                  >
                    Remove this condition
                  </button>
                </div>
                {canApply(d) ? (
                  <ValuePicker
                    dataset={dataset}
                    dimension={d}
                    noun={filterLabel(d).toLowerCase()}
                    chosen={kept}
                    where={applicable(without(question.where, d))}
                    onChange={(values) => ask({ where: { ...question.where, [d]: values } })}
                  />
                ) : (
                  <p className="picker-hint">
                    This link asks for only the vehicles where “{filterLabel(d)}” is {kept.join(" or ")}. This data cannot apply that condition, so no chart
                    is drawn. Remove the condition to see the chart without it.
                  </p>
                )}
              </div>
            ))}
            {unusedFilters.length > 0 ? (
              <div className="condition-add">
                <label htmlFor="add-condition">Add a condition on</label>
                <select id="add-condition" ref={addSelect} value={adding} onChange={(e) => setAdding(e.target.value)}>
                  <option value="">Choose…</option>
                  {unusedFilters.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <button type="button" className="button-quiet" onClick={addCondition} disabled={!adding}>
                  Add
                </button>
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {views.length > 1 ? (
          <div className="toggle" role="radiogroup" aria-label="Show as">
            {views.map((v, i) => (
              <label key={v}>
                <input
                  type="radio"
                  name="question-view"
                  checked={(question.view ?? views[0]) === v}
                  onChange={() => ask({ view: i === 0 ? null : v })}
                />{" "}
                {VIEW_LABELS[v] ?? v}
              </label>
            ))}
          </div>
        ) : null}
      </form>

      {/* Keyed by the question, so a new question remounts each panel and reads its cleared settings. */}
      {presets.map((p) =>
        // A number by a breakdown is one line per chosen value. With none chosen there is no such chart to draw, and
        // the total alone would sit under a title that promises a breakdown.
        awaitingValues && p.measure === "count" ? (
          <section className="panel" key={p.id} aria-live="polite">
            <header className="panel-head">
              <h3 className="panel-question">{p.question}</h3>
            </header>
            {noStartFor === startKey ? (
              <div className="callout blocked">
                <span className="callout-label">Nothing to draw yet</span>
                Nothing was first registered in the last 12 months
                {Object.keys(question.where).length ? " among the vehicles the conditions keep" : ""}, so there is no largest to start
                from. Choose values under Compare to draw a line for each.
              </div>
            ) : (
              <p className="meta">Finding the largest to start from…</p>
            )}
          </section>
        ) : (
          <PresetPanel key={`${p.id}:${String(questionParams(question))}`} preset={p} audience="public" anchored={false} />
        ),
      )}

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
