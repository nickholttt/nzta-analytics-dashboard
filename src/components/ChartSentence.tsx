// The one sentence under a chart. The chart works the sentence out from the figures it draws (src/lib/chartSentence.ts) and hands it here;
// the panel keeps it, so the chart's figure can point at it (aria-describedby) and a chart shown as a table is followed by it too.
import { createContext, useContext, useEffect } from "react";
import "../styles/chart-sentence.css";
import type { RecordingScope } from "../lib/recordingChange";
import { narrowedSentence } from "../lib/chartSentence";
import { chartSentences } from "../lib/chartWords";
import { TableOnlyContext } from "./FiguresContext";

export type SentenceApi = {
  // The id of the sentence's paragraph, for the figure to name in aria-describedby.
  id: string;
  // The sentence the chart on show has registered, if it has one.
  text: string | undefined;
  // The chart counts only some of the vehicles: a condition the visitor set, or one its field implies. Its sentence then says so.
  narrowed: boolean;
  set: (text: string | undefined) => void;
  // Whether a change in how the data is recorded lies between two months: undefined until the events are loaded (invariant 7).
  recording: (from: string, to: string, scope?: RecordingScope) => boolean | undefined;
};

export const SentenceContext = createContext<SentenceApi | null>(null);

// The answer to "can these two months be compared": yes only where the events are loaded and none changed the recording between them.
export function useComparable(): (from: string, to: string, scope?: RecordingScope) => boolean {
  const api = useContext(SentenceContext);
  return (from, to, scope) => api?.recording(from, to, scope) === false;
}

// Registers the chart's sentence with the panel and draws it, unless the chart is shown as a table: the panel then draws it under the table.
export function ChartSentence({ text }: { text: string | undefined }) {
  const api = useContext(SentenceContext);
  const tableOnly = useContext(TableOnlyContext);
  const set = api?.set;
  // Said in full once, here: what the panel keeps, and what the figure and the table point at, is the sentence as the reader sees it.
  const shown = text && api?.narrowed ? narrowedSentence(chartSentences, text) : text;
  useEffect(() => {
    set?.(shown);
    return () => set?.(undefined);
  }, [shown, set]);
  if (!shown || tableOnly) return null;
  return (
    <p className="chart-sentence" id={api?.id}>
      {shown}
    </p>
  );
}
