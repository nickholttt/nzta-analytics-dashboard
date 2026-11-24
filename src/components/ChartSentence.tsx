// The one sentence of a chart. The chart works the sentence out from the figures it draws (src/lib/chartSentence.ts) and hands it here. On a card of
// the canvas the panel draws it, once, as the card's headline above the chart; on the internal status page the chart draws it under itself. Either way
// the panel keeps it, so the chart's figure can point at it (aria-describedby) and a chart shown as a table is described by it too.
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
  // The chart on show has been drawn (its code has arrived and it has mounted): until then a card holds the room its headline will take.
  settled: boolean;
  settle: (drawn: boolean) => void;
  // The panel draws the sentence itself (a card of the canvas); the chart only registers it.
  drawnByPanel: boolean;
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

// Registers the chart's sentence with the panel and, where the panel does not draw it, draws it under the chart.
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
  if (!shown || tableOnly || api?.drawnByPanel) return null;
  return (
    <p className="chart-sentence" id={api?.id}>
      {shown}
    </p>
  );
}

// Told by the panel's renderer boundary once the chart's code has arrived and the chart is on show, so the room held for the headline is let go
// whether or not the chart has a sentence to put in it.
export function Drawn() {
  const settle = useContext(SentenceContext)?.settle;
  useEffect(() => {
    settle?.(true);
    return () => settle?.(false);
  }, [settle]);
  return null;
}
