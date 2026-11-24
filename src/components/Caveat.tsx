// A method note a chart owes its reader: how its values are ranked, what is left out, what a grey mark means. On a card of the canvas the notes are
// not drawn where the chart draws them but gathered by the panel into one list under the chart and its table (the card's headline is the sentence,
// and nothing but the title, the sentence and the controls stands between the top of the card and the chart). Where there is no such list (the
// internal status page) a note is drawn in place, as it always was.
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// undefined: no list, draw in place. null: the card's list is not on the page yet. An element: the list to draw into.
export const CaveatSlotContext = createContext<HTMLElement | null | undefined>(undefined);

export function Caveat({ children }: { children: ReactNode }) {
  const slot = useContext(CaveatSlotContext);
  if (slot === undefined) return <p className="chart-unit">{children}</p>;
  return slot ? createPortal(<li className="chart-card-caveat">{children}</li>, slot) : null;
}
