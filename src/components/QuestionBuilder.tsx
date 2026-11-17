// The Build page: a visitor asks their own question, what to measure, broken down by what, comparing which values,
// among which vehicles, and the charts that answer it are drawn by the same panel as Explore (D-058, D-059). The
// question lives in the address bar, so the panel's "Copy link" shares it.
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { builderSpec, chartDefaults, datasetWords, dimensionLabel, findDataset, findDimension, lowerLabel, phrases, valueWords } from "../lib/config";
import { REST_NAME, isChoosable } from "../lib/reserved";
import { MAX_VALUES, RANKING, REMOVE_CONDITION, addressParams, builderPresets, isMonthKey, narrowingNotes, noteRemoved, questionParams, readQuestion, readingNotes, removeConditionLabel, settle, viewsFor, withValues } from "../lib/builder";
import type { Question, Vocabulary } from "../lib/builder";
import { ServiceError, datasetLatestMonth, factView, loadKeptSnapshots, loadManifest, loadSlice } from "../lib/data";
import type { Manifest, SliceRow } from "../lib/data";
import { canPin, servedMonth } from "../lib/pin";
import { pickerMonth, pinLine, readingFor } from "../lib/kept";
import type { Loaders, Owner, Reading } from "../lib/kept";
import { TRAILING_MONTHS, addMonths } from "../lib/measures";
import { fillNote } from "../lib/notes";
import { count } from "../lib/readout";
import { fillTemplate, pickedBuilderSentences } from "../lib/sentences";
import keepWords from "../../config/my_questions.json";
import MyQuestions from "./MyQuestions";
import PresetPanel, { reservedLabel } from "./PresetPanel";

// Values filled in when a count is broken down and none are chosen yet: a count draws one line per value.
const STARTING_VALUES = 5;
const SUGGESTIONS = 8;
const VIEW_LABELS: Record<string, string> = { mix: "Lines over time", geo: "Map", distribution: "Bars by band", league: "Ranking", trend: "Line" };

// A value as the page reads it: a reserved value in its own words, a compound value (a model) as words.
const valueLabel = (v: string, dimension?: string) => valueWords(dimension, reservedLabel(v));
const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");
// Focus moves after React has drawn the change, so the element it moves to exists.
const focusSoon = (find: () => HTMLElement | null | undefined) => requestAnimationFrame(() => find()?.focus());

type ValueOption = { value: string; recent: number; total: number };

// Every value of a breakdown, largest in the last 12 months first, then largest over all time: what a visitor most
// likely wants is at the top, and a value that has gone (a brand no longer sold) is still there to find. Counted
// among the vehicles the question's other conditions keep, so the list matches what the chart will show.
async function valueOptions(dataset: string, dimension: string, where: Record<string, string[]>, snapshot?: string): Promise<ValueOption[]> {
  const filtered = Object.values(where).some((kept) => kept.length > 0);
  const [rows, manifest] = await Promise.all([
    filtered ? factView(dataset, dimension, undefined, where, undefined, snapshot) : loadSlice(dataset, dimension, snapshot),
    loadManifest(snapshot),
  ]);
  const latest = datasetLatestMonth(manifest, dataset);
  const from = addMonths(latest, -(TRAILING_MONTHS - 1));
  const byValue = new Map<string, ValueOption>();
  for (const r of rows as SliceRow[]) {
    const o = byValue.get(r.value) ?? { value: r.value, recent: 0, total: 0 };
    o.total += r.n;
    if (r.month >= from && r.month <= latest) o.recent += r.n;
    byValue.set(r.value, o);
  }
  return [...byValue.values()].filter((o) => o.total > 0 && isChoosable(o.value)).sort((a, b) => b.recent - a.recent || b.total - a.total || a.value.localeCompare(b.value));
}

function failureHint(e: unknown): string {
  if (!(e instanceof ServiceError)) return "The values to choose from did not load. Reload the page to try again.";
  return e.down ? "The question service is not answering, so the values to choose from did not load. Try again in a few minutes." : e.message;
}

function useValueOptions(dataset: string, dimension: string, where: Record<string, string[]>, snapshot?: string) {
  const [options, setOptions] = useState<ValueOption[] | null>(null);
  // What the hint says when the list did not load: a file that failed, the query service not answering, or the
  // service's own sentence when it refused the question (trying again would not help).
  const [failed, setFailed] = useState<string | null>(null);
  const whereKey = JSON.stringify(where);
  useEffect(() => {
    let current = true;
    setOptions(null);
    setFailed(null);
    valueOptions(dataset, dimension, JSON.parse(whereKey), snapshot).then(
      (o) => current && setOptions(o),
      (e) => current && setFailed(failureHint(e)),
    );
    return () => {
      current = false;
    };
  }, [dataset, dimension, whereKey, snapshot]);
  return { options, failed };
}

function ValuePicker({
  dataset,
  dimension,
  snapshot,
  noun,
  chosen,
  where,
  onChange,
  max,
  emptyHint,
  note,
  aside,
  chosenLabel,
}: {
  dataset: string;
  dimension: string;
  // The kept snapshot (a month) the suggestions are counted in, where the question reads from one and it can answer for this field (pickerMonth).
  snapshot?: string;
  noun: string;
  chosen: string[];
  where: Record<string, string[]>;
  onChange: (values: string[]) => void;
  max?: number;
  emptyHint?: string;
  // A sentence under the chosen values (where they are the page's own), and controls beside the search box's label, which take no row of
  // their own.
  note?: string;
  aside?: ReactNode;
  // The name of the list of chosen values, where "chosen" would not be true of them.
  chosenLabel?: string;
}) {
  const { options, failed } = useValueOptions(dataset, dimension, where, snapshot);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const inputId = `find-${dimension}`;
  const full = max !== undefined && chosen.length >= max;
  const filtered = Object.values(where).some((kept) => kept.length > 0);
  const words = datasetWords(dataset);
  const matches = useMemo(() => {
    if (!options) return [];
    const q = query.trim().toLowerCase();
    return options.filter((o) => !chosen.includes(o.value) && (!q || valueLabel(o.value, dimension).toLowerCase().includes(q))).slice(0, SUGGESTIONS);
  }, [options, query, chosen, dimension]);
  // The search box, or the picker itself once it is full and the box has gone, so focus is never dropped to the page.
  const refocus = () => focusSoon(() => input.current ?? box.current);

  return (
    <div className="picker" ref={box} tabIndex={-1}>
      {chosen.length > 0 ? (
        <ul className="chips" aria-label={chosenLabel ?? `Chosen ${noun} values`}>
          {chosen.map((v) => (
            <li key={v}>
              {valueLabel(v, dimension)}
              <button
                type="button"
                aria-label={`Remove ${valueLabel(v, dimension)}`}
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
      {note ? <p className="picker-hint">{note}</p> : null}
      {failed ? (
        <p className="picker-hint">{failed}</p>
      ) : full ? (
        <>
          <p className="picker-hint">Up to {max} can be compared at once. Remove one to add another.</p>
          {aside ? <div className="picker-aside">{aside}</div> : null}
        </>
      ) : (
        <>
          <div className="picker-find-row">
            <label className="picker-find" htmlFor={inputId}>
              Search {noun}
            </label>
            {aside ? <div className="picker-aside">{aside}</div> : null}
          </div>
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
                    <span className="suggestion-name">{valueLabel(o.value, dimension)}</span>
                    <span className="suggestion-figure">
                      {o.recent > 0 ? `${count(o.recent)} ${say(words?.suggestion_recent)}` : `${count(o.total)} ${say(words?.suggestion_total)}`}
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

// A dataset's words, with the trailing window filled in.
const say = (template?: string) => fillNote(template ?? "", { months: TRAILING_MONTHS }).text;

const without = (where: Record<string, string[]>, dimension: string) => Object.fromEntries(Object.entries(where).filter(([d]) => d !== dimension));

const loaders: Loaders = { index: loadKeptSnapshots, manifest: loadManifest, slice: loadSlice };
const FROM_NEWEST: Reading = { kind: "served" };

// Where the question reads its figures from (src/lib/kept.ts): the newest snapshot at once for a question that is not pinned or is pinned to the
// snapshot served or ahead of it, and for one pinned to an earlier month once the index, that snapshot's manifest and the values chosen have been
// read. Undefined until then, and for a new question until it is read, so a chart is never drawn from one snapshot and then another.
function useReading(q: Question, served: Manifest | null | undefined, owner: Owner): Reading | undefined {
  const key = `${String(questionParams(q))}|${q.values.join("|")}|${q.values2?.join("|") ?? ""}`;
  const [decided, setDecided] = useState<{ key: string; reading: Reading } | null>(null);
  const latestQuestion = useRef(q);
  latestQuestion.current = q;
  const earlier = Boolean(served && isMonthKey(q.snapshot) && q.snapshot < servedMonth(served));
  useEffect(() => {
    if (!earlier || !served) return;
    let current = true;
    readingFor(latestQuestion.current, served, loaders, owner).then((reading) => current && setDecided({ key, reading }));
    return () => {
      current = false;
    };
    // The question is read through its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, earlier, served, owner]);
  if (!isMonthKey(q.snapshot) || served === null) return FROM_NEWEST;
  if (served === undefined) return undefined;
  if (!earlier) return FROM_NEWEST;
  return decided?.key === key ? decided.reading : undefined;
}

export default function QuestionBuilder({ vocabulary: all }: { vocabulary: Vocabulary }) {
  const [question, setQuestion] = useState<Question>(() =>
    settle(all, typeof window === "undefined" ? {} : readQuestion(window.location.search)),
  );
  // What the link asked for that the page could not give. Said until the visitor changes the question.
  const [notices, setNotices] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const asked = readQuestion(window.location.search);
    const note = readingNotes(all, asked, settle(all, asked), valueLabel);
    return [
      ...(note.dataset ? [fillNote(builderSpec.notices.dataset, note.dataset).text] : []),
      ...(note.by ? [fillNote(builderSpec.notices.by, note.by).text] : []),
      ...(note.by2 ? [fillNote(builderSpec.notices.by2, note.by2).text] : []),
      ...(note.value2 ? [builderSpec.notices.value2] : []),
      ...(note.snapshot ? [fillNote(builderSpec.notices.snapshot, note.snapshot).text] : []),
      ...(note.left_out ?? []).map((left) => fillNote(builderSpec.notices.left_out, left).text),
    ];
  });
  // The snapshot this page serves, to say what a pinned question is pinned to (src/lib/pin.ts).
  const [served, setServed] = useState<Manifest | null | undefined>(undefined);
  useEffect(() => {
    loadManifest().then(setServed, () => setServed(null));
  }, []);
  const ownerFields = useMemo(() => new Set(all.owner), [all]);
  const reading = useReading(question, served, ownerFields);
  // What the chosen dataset offers: its measures, and the conditions its fact table can apply.
  const vocabulary = all.datasets.find((v) => v.dataset === question.dataset) ?? all.datasets[0];
  const { dataset } = vocabulary;
  // The question as it stands now, for work that finishes later (a list of values arriving) and must build on the
  // latest question, not the one it started from.
  const latest = useRef(question);
  latest.current = question;
  const [adding, setAdding] = useState("");
  const addSelect = useRef<HTMLSelectElement>(null);
  const measure = vocabulary.measures.find((m) => m.id === question.measure) ?? vocabulary.measures[0];
  const breakdown = measure.dimensions.find((d) => d.id === question.by);
  const countsLines = measure.id === "count" || builderSpec.measures.find((m) => m.id === measure.id)?.parts?.includes("count");
  const presets = useMemo(() => builderPresets(question, (v) => valueLabel(v, question.by ?? undefined)), [question]);
  const views = useMemo(() => viewsFor(question), [question]);
  // Said while the question still holds the condition a breakdown's field calls for (D-132).
  const narrowed = useMemo(() => narrowingNotes(all, question), [all, question]);
  const pin = served && reading ? pinLine(question, served, reading) : undefined;
  const filterLabel = (id: string) => vocabulary.filters.find((f) => f.id === id)?.label ?? dimensionLabel(id) ?? id;
  // The other shapes a question may be drawn as are a choice of their own; the ranking is reached from the values, where it is about them.
  const otherViews = views.filter((v) => v !== RANKING);
  const noun = breakdown ? lowerLabel(filterLabel(breakdown.id)) : "";
  const own = !question.pageValues;
  const ranking = pickedBuilderSentences(phrases, {
    own,
    picked: question.values.length,
    field: noun,
    months: TRAILING_MONTHS,
    names: question.values.map((v) => valueLabel(v, question.by ?? undefined)),
  });
  // A link can name a condition this data cannot apply. It stays in the question, where it blocks the chart, but the
  // lists of values are counted among the conditions that can be applied.
  const canApply = (id: string) => vocabulary.filters.some((f) => f.id === id);
  const applicable = (where: Record<string, string[]>) => Object.fromEntries(Object.entries(where).filter(([d]) => canApply(d)));

  // The builder's settings in the address, replaced by the question's. A new question clears the charts' own settings
  // (the first chart's are scoped by the builder's id, a second chart's by its own); the first read keeps them.
  const writeAddress = (settled: Question, keepChart: boolean) => {
    const next = `${window.location.pathname}?${addressParams(window.location.search, settled, keepChart)}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, "", next);
  };
  // So a link that named something the page does not offer is corrected in the address where it is read, not only
  // after the first change.
  useEffect(() => writeAddress(latest.current, true), []);

  // fromVisitor: false for the page settling a question itself (starting values arriving), which must not clear what the
  // link was told.
  // keepChart: the chart's own settings stay in the address (the window a ranking is of), as when a ranking of the values chosen
  // becomes the ranking of every value and back.
  const ask = (next: Partial<Question>, fromVisitor = true, keepChart = false) => {
    const asked = { ...latest.current, ...next };
    // Ranking every value is a state of the ranking view only.
    if (next.view !== undefined && next.view !== RANKING) asked.rankAll = false;
    // Values the page chose follow the question: a new condition or measure sets them aside, and the page looks again.
    if (latest.current.pageValues && next.values === undefined && (next.where !== undefined || next.measure !== undefined)) asked.values = [];
    // A grid chooses its own lines, so the values the page filled in for the lines of a chart are set aside when the second breakdown is added.
    if (latest.current.pageValues && next.by2 && next.values === undefined) asked.values = [];
    // Another dataset carries other conditions and other values: the ones it does not carry go, and the chosen values start over.
    if (next.dataset && next.dataset !== latest.current.dataset) {
      const carried = all.datasets.find((v) => v.dataset === next.dataset)?.filters ?? [];
      asked.where = Object.fromEntries(Object.entries(asked.where).filter(([d]) => carried.some((f) => f.id === d)));
      asked.values = [];
    }
    // A condition with no value yet keeps every vehicle and has no place in the address, so settle drops it. It stays
    // on the page while the visitor changes something else, and goes only when they remove it.
    const held = Object.entries(asked.where ?? {}).filter(([d, kept]) => kept.length === 0 && canApply(d));
    // A condition the question had and the visitor took away stays away, though a breakdown would start the question with it (D-132).
    const settled = settle(all, noteRemoved(latest.current, asked));
    for (const [d] of held) if (d !== settled.by && !(d in settled.where)) settled.where[d] = [];
    latest.current = settled;
    if (fromVisitor) setNotices([]);
    setQuestion(settled);
    writeAddress(settled, keepChart);
  };

  // A count broken down draws one line per chosen value, so with none chosen it starts on the largest few among the
  // vehicles the conditions keep. Applied only if the question is still waiting for them when the list arrives.
  const whereKey = JSON.stringify(applicable(question.where));
  // A question read from a kept snapshot starts on that snapshot's largest values, not the newest's, so it shows what it showed when it was pinned.
  const keptFolder = reading?.kind === "kept" ? reading.month : undefined;
  // The suggestions under each picker are counted in the kept snapshot too, so they agree with the line above the chart; for a field the kept snapshot
  // cannot give them for, they stay the newest's.
  const pickAt = (dimension: string, where: Record<string, string[]>) => pickerMonth(reading, dataset, dimension, where, ownerFields);
  const awaitingValues = Boolean(countsLines && question.by && !question.by2 && question.values.length === 0 && breakdown?.values);
  // The question whose starting values were looked for and not found: nothing was first registered in the last 12
  // months among the vehicles its conditions keep.
  const startKey = `${question.dataset}|${question.by}|${whereKey}`;
  const [noStartFor, setNoStartFor] = useState<string | null>(null);
  // The question whose starting values could not be loaded at all.
  const [startFailedFor, setStartFailedFor] = useState<string | null>(null);
  useEffect(() => {
    const by = question.by;
    if (!awaitingValues || !by || reading === undefined) return;
    let current = true;
    valueOptions(dataset, by, JSON.parse(whereKey), keptFolder).then(
      (options) => {
        const now = latest.current;
        if (!current || now.by !== by || now.values.length > 0) return;
        const top = options.filter((o) => !isReserved(o.value) && o.recent > 0).slice(0, STARTING_VALUES).map((o) => o.value);
        if (top.length) ask({ values: top, pageValues: true }, false, true);
        else setNoStartFor(startKey);
      },
      () => current && setStartFailedFor(startKey),
    );
    return () => {
      current = false;
    };
    // ask reads the latest question through its ref; these are what decide whether starting values are needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingValues, question.by, dataset, whereKey, reading === undefined, keptFolder]);
  const words = datasetWords(dataset);

  const datasetInfo = findDataset(dataset);
  const datasetDefinition = datasetInfo?.public_definition ?? datasetInfo?.definition;
  const unusedFilters = vocabulary.filters.filter((f) => f.id !== question.by && f.id !== question.by2 && !(f.id in question.where));
  const addCondition = () => {
    const id = adding;
    if (!id) return;
    setAdding("");
    // A condition with no value chosen keeps every vehicle, so it is held on the page until it has one.
    setQuestion((q) => ({ ...q, where: { ...q.where, [id]: [] } }));
    focusSoon(() => document.getElementById(`find-${id}`));
  };

  // A line that applies only where a dataset is missing from the build is shown only there.
  const notOffered = builderSpec.not_offered.flatMap((line) =>
    typeof line === "string" ? [line] : all.datasets.some((v) => v.dataset === line.when_not_built) ? [] : [line.text],
  );

  return (
    <>
      {notices.map((text) => (
        <div className="callout warning" role="status" key={text}>
          <span className="callout-label">This link was changed</span>
          {text}
        </div>
      ))}
      <form className="question" aria-label="Build a question" onSubmit={(e) => e.preventDefault()}>
        {all.datasets.length > 1 ? (
          <p className="sentence-text">
            Counting{" "}
            <select className="dataset-select" aria-label="What is counted" value={dataset} onChange={(e) => ask({ dataset: e.target.value, view: null })}>
              {all.datasets.map((v) => (
                <option key={v.dataset} value={v.dataset}>
                  {v.label}
                </option>
              ))}
            </select>
          </p>
        ) : null}
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
              {breakdown && breakdown.with.length > 0 ? (
                <>
                  {" "}
                  {phrases.build_second_and}{" "}
                  <select
                    id="second-breakdown"
                    aria-label={phrases.build_second_label}
                    value={question.by2 ?? ""}
                    onChange={(e) => ask({ by2: e.target.value === "" ? null : e.target.value, values2: [], view: null })}
                  >
                    <option value="">{phrases.build_second_none}</option>
                    {breakdown.with.map((id) => (
                      <option key={id} value={id}>
                        {measure.dimensions.find((d) => d.id === id)?.phrase ?? id}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
            </>
          ) : null}
        </p>

        {question.by && question.by2 ? (
          <div className="picker-aside second-actions">
            <button
              type="button"
              id="swap-breakdowns"
              className="button-quiet"
              onClick={() => ask({ by: question.by2 as string, by2: question.by, values: question.values2 ?? [], values2: question.values, view: null })}
            >
              {phrases.build_second_swap}
            </button>
            <button
              type="button"
              className="button-quiet"
              onClick={() => {
                ask({ by2: null, values2: [], view: null });
                focusSoon(() => document.getElementById("second-breakdown"));
              }}
            >
              {phrases.build_second_remove}
            </button>
          </div>
        ) : null}

        {question.by && question.by2 ? (
          <>
            {[
              { id: question.by, legend: phrases.build_second_rows, chosen: question.values, max: chartDefaults.matrix.rows, set: (values: string[]) => ask({ values }) },
              { id: question.by2, legend: phrases.build_second_columns, chosen: question.values2 ?? [], max: chartDefaults.matrix.columns, set: (values: string[]) => ask({ values2: values }) },
            ].map((side) => (
              <fieldset className="question-part" key={side.legend}>
                <legend>
                  {side.legend}: {lowerLabel(filterLabel(side.id))}
                </legend>
                <ValuePicker
                  dataset={dataset}
                  dimension={side.id}
                  snapshot={pickAt(side.id, applicable(question.where))}
                  noun={lowerLabel(filterLabel(side.id))}
                  chosen={side.chosen}
                  where={applicable(question.where)}
                  max={side.max}
                  onChange={side.set}
                  emptyHint={fillTemplate(findDimension(side.id)?.kind === "ordered_band" ? phrases.build_second_hint_ordered : phrases.build_second_hint, { rest: REST_NAME }).text}
                />
              </fieldset>
            ))}
          </>
        ) : null}

        {breakdown?.values && !question.by2 ? (
          <fieldset className="question-part">
            <legend>Compare{own || question.values.length === 0 ? "" : `, ${ranking.pickerNote}`}</legend>
            {question.rankAll ? (
              <>
                <p className="picker-hint">{ranking.allNote}</p>
                <div className="picker-aside">
                  <button
                    type="button"
                    id="rank-picked"
                    className="button-quiet"
                    onClick={() => {
                      ask({ rankAll: false }, true, true);
                      focusSoon(() => document.getElementById("rank-all"));
                    }}
                  >
                    {ranking.back}
                  </button>
                  <button
                    type="button"
                    className="button-quiet"
                    onClick={() => {
                      ask({ view: null });
                      focusSoon(() => document.getElementById("rank-view"));
                    }}
                  >
                    {ranking.toLines}
                  </button>
                </div>
              </>
            ) : (
              <ValuePicker
                dataset={dataset}
                dimension={breakdown.id}
                snapshot={pickAt(breakdown.id, applicable(question.where))}
                noun={noun}
                chosen={question.values}
                where={applicable(question.where)}
                max={MAX_VALUES}
                onChange={(values) => ask({ values, pageValues: false })}
                emptyHint={countsLines ? undefined : "Showing the largest, with the rest as All other. Choose values to compare only those."}
                chosenLabel={own ? undefined : `${filterLabel(breakdown.id)} values shown`}
                aside={
                  views.includes(RANKING) ? (
                    question.view === RANKING ? (
                      <>
                        <button
                          type="button"
                          id="rank-all"
                          className="button-quiet"
                          onClick={() => {
                            ask({ rankAll: true }, true, true);
                            focusSoon(() => document.getElementById("rank-picked"));
                          }}
                        >
                          Rank every {noun} instead
                        </button>
                        <button
                          type="button"
                          className="button-quiet"
                          onClick={() => {
                            ask({ view: null });
                            focusSoon(() => document.getElementById("rank-view"));
                          }}
                        >
                          {ranking.toLines}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        id="rank-view"
                        className="button-quiet"
                        onClick={() => {
                          ask({ view: RANKING });
                          focusSoon(() => document.getElementById("rank-all"));
                        }}
                      >
                        {ranking.toRanking}
                      </button>
                    )
                  ) : undefined
                }
              />
            )}
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
                    aria-label={removeConditionLabel(filterLabel(d))}
                    onClick={() => {
                      ask({ where: without(question.where, d) });
                      focusSoon(() => addSelect.current);
                    }}
                  >
                    {REMOVE_CONDITION}
                  </button>
                </div>
                {canApply(d) ? (
                  <ValuePicker
                    dataset={dataset}
                    dimension={d}
                    snapshot={pickAt(d, applicable(without(question.where, d)))}
                    noun={lowerLabel(filterLabel(d))}
                    chosen={kept}
                    where={applicable(without(question.where, d))}
                    onChange={(values) => {
                      ask({ where: withValues(question.where, d, values) });
                      // The last value taken away takes the line with it, so focus goes to where a condition is added.
                      if (values.length === 0) focusSoon(() => addSelect.current);
                    }}
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

        {otherViews.length > 1 ? (
          <div className="toggle" role="radiogroup" aria-label="Show as">
            {otherViews.map((v, i) => (
              <label key={v}>
                <input
                  type="radio"
                  name="question-view"
                  checked={(question.view ?? otherViews[0]) === v}
                  onChange={() => ask({ view: i === 0 ? null : v })}
                />{" "}
                {VIEW_LABELS[v] ?? v}
              </label>
            ))}
          </div>
        ) : null}
      </form>

      {narrowed.map((text) => (
        <div className="callout curated" role="status" key={text}>
          <span className="callout-label">{builderSpec.notices.narrowed_label}</span>
          {text}
        </div>
      ))}

      {pin ? (
        <div className={pin.kind === "same" || pin.kind === "kept" ? "callout curated" : "callout warning"} id="pin-line">
          <span className="callout-label">{keepWords.pinned_label}</span>
          {pin.text}{" "}
          <button
            type="button"
            className="button-quiet"
            onClick={() => {
              ask({ snapshot: undefined }, true, true);
              focusSoon(() => document.getElementById("pin-toggle"));
            }}
          >
            {keepWords.unpin}
          </button>
        </div>
      ) : null}

      {/* Keyed by the question, so a new question remounts each panel and reads its cleared settings. A question pinned to an earlier month waits
          for the decision on where its figures come from, so no chart is drawn from one snapshot and then another. */}
      {reading === undefined ? (
        <section className="panel loading">
          <p className="meta" role="status">
            {keepWords.pin_reading}
          </p>
        </section>
      ) : null}
      {reading === undefined ? null : presets.map((p) =>
        // A number by a breakdown is one line per chosen value. With none chosen there is no such chart to draw, and
        // the total alone would sit under a title that promises a breakdown.
        awaitingValues && p.measure === "count" ? (
          <section className="panel" key={p.id} aria-live="polite">
            <header className="panel-head">
              <h3 className="panel-question">{p.question}</h3>
            </header>
            {datasetDefinition ? <p className="panel-definition">{datasetDefinition}</p> : null}
            {startFailedFor === startKey ? (
              <div className="callout blocked">
                <span className="callout-label">Nothing to draw yet</span>
                The values to start from did not load. Reload the page to try again.
              </div>
            ) : noStartFor === startKey ? (
              <div className="callout blocked">
                <span className="callout-label">Nothing to draw yet</span>
                {say(words?.none_recent)}
                {Object.keys(question.where).length ? " among the vehicles the conditions keep" : ""}, so there is no largest to start
                from. Choose values under Compare to draw a line for each.
              </div>
            ) : (
              <p className="meta">Finding the largest to start from…</p>
            )}
          </section>
        ) : (
          <PresetPanel key={`${p.id}:${String(questionParams(question))}:${question.values.join("|")}:${keptFolder ?? ""}`} preset={p} audience="public" anchored={false} snapshot={keptFolder} />
        ),
      )}

      <MyQuestions all={all} served={served ?? null} title={presets[0]?.question ?? ""} snapshot={question.snapshot} pinnable={served ? canPin(question, served) : false} onPin={(month) => ask({ snapshot: month }, true, true)} />

      {notOffered.length > 0 ? (
        <section className="not-offered" aria-labelledby="not-offered-head">
          <h2 id="not-offered-head" className="eyebrow">
            Not offered yet
          </h2>
          <ul className="notes">
            {notOffered.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
