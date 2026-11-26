// The list a visitor chooses a field's values from: the values chosen, a search box, and the largest suggested first. Shared by the
// Build page and the canvas, so a brand is found and chosen the same way on both (D-058, D-111).
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { say as canvasSay } from "../lib/canvas";
import { datasetWords, valueWords } from "../lib/config";
import { isChoosable } from "../lib/reserved";
import { ServiceError, datasetLatestMonth, factView, loadManifest, loadSlice, tableHolding } from "../lib/data";
import type { SliceRow } from "../lib/data";
import { TRAILING_MONTHS, addMonths } from "../lib/measures";
import { fillNote } from "../lib/notes";
import { count } from "../lib/readout";
import { reservedLabel } from "./PresetPanel";

const SUGGESTIONS = 8;

// A value as the page reads it: a reserved value in its own words, a compound value (a model) as words.
export const valueLabel = (v: string, dimension?: string) => valueWords(dimension, reservedLabel(v));
// Focus moves after React has drawn the change, so the element it moves to exists.
export const focusSoon = (find: () => HTMLElement | null | undefined) => requestAnimationFrame(() => find()?.focus());

export type ValueOption = { value: string; recent: number; total: number };

// Values filled in when a count is broken down and none are chosen yet: a count draws one line per value, so the page starts on the
// largest few of the last 12 months, never a reserved value (not recorded, no reference match).
const STARTING_VALUES = 5;
const isReserved = (v: string) => v.startsWith("__") && v.endsWith("__");
export const startingValues = (options: readonly ValueOption[]): string[] =>
  options.filter((o) => !isReserved(o.value) && o.recent > 0).slice(0, STARTING_VALUES).map((o) => o.value);

// Every value of a breakdown, largest in the last 12 months first, then largest over all time: what a visitor most
// likely wants is at the top, and a value that has gone (a brand no longer sold) is still there to find. Counted
// among the vehicles the question's other conditions keep, so the list matches what the chart will show.
export async function valueOptions(dataset: string, dimension: string, where: Record<string, string[]>, snapshot?: string): Promise<ValueOption[]> {
  const filtered = Object.values(where).some((kept) => kept.length > 0);
  // Counted among the conditions, the list is summed from the one fact table that holds the field and every condition's field (a narrow table where the
  // wide one lacks one of them), so it is the table the chart reads.
  const [rows, manifest] = await Promise.all([
    filtered
      ? tableHolding(dataset, [dimension, ...Object.entries(where).filter(([, kept]) => kept.length > 0).map(([d]) => d)], snapshot).then((table) => factView(dataset, dimension, undefined, where, undefined, snapshot, table))
      : loadSlice(dataset, dimension, snapshot),
    loadManifest(snapshot),
  ]);
  const latest = datasetLatestMonth(manifest, dataset);
  const from = addMonths(latest, -(TRAILING_MONTHS - 1));
  const byValue = new Map<string, ValueOption>();
  for (const r of rows as SliceRow[]) {
    // A hidden count has no number to add, and a period that is not broken down has no value (D-139).
    if (r.hidden || r.notBrokenDown) continue;
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

export function ValuePicker({
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
  idPrefix = "find",
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
  // The start of the search box's id, where a page holds more than one picker for a field (a canvas of several charts).
  idPrefix?: string;
}) {
  const { options, failed } = useValueOptions(dataset, dimension, where, snapshot);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const inputId = `${idPrefix}-${dimension}`;
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
            <p className="picker-hint">{canvasSay("picker_loading")}</p>
          ) : matches.length === 0 ? (
            <p className="picker-hint">
              {query.trim()
                ? canvasSay(filtered ? "picker_no_match_filtered" : "picker_no_match", { query: query.trim() })
                : options.length === 0
                  ? canvasSay(filtered ? "picker_none_filtered" : "picker_none")
                  : canvasSay("picker_all_chosen")}
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
export const say = (template?: string) => fillNote(template ?? "", { months: TRAILING_MONTHS }).text;
