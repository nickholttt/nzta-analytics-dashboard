// The canvas's editing tools: one panel holding the chart being edited (its type and zones) and the field list, and the dialog that asks
// where a chosen field goes. They are a file of their own, loaded once the first chart is drawn (Canvas.tsx), so a link to a canvas gets its
// charts before the tools to change them. The state they share with the charts (the question, a field being dragged, a refusal) stays with the canvas; what only
// they use (the field chosen without dragging) lives here.
import { useState } from "react";
import type { Question, Vocabulary } from "../../lib/builder";
import { say } from "../../lib/canvas";
import type { CanvasChart, CanvasField, CanvasFieldGroup, Zone } from "../../lib/canvas";
import type { Manifest } from "../../lib/data";
import type { Owner } from "../../lib/kept";
import AddMenu from "./AddMenu";
import type { Refusal } from "./Canvas";
import ChartPane from "./ChartPane";
import FieldList from "./FieldList";

type Props = {
  all: Vocabulary;
  chart: CanvasChart;
  number: number;
  of: number;
  full: boolean;
  manifest: Manifest | undefined;
  served: Manifest | null | undefined;
  owner: Owner;
  groups: CanvasFieldGroup[];
  dragging: CanvasField | null;
  refusal: Refusal | null;
  onAsk: (next: Partial<Question>) => void;
  onSet: (next: Partial<Pick<CanvasChart, "type" | "table" | "width">>) => void;
  onPut: (zone: Zone, field: CanvasField) => void;
  onRemoved: (field: string, zone: Zone) => void;
  onPeriodSlot: (element: HTMLElement | null) => void;
  onStatus: (text: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (by: number) => void;
  onDragStart: (field: CanvasField) => void;
  onDragEnd: () => void;
};

export default function Editor({ groups, onPut, onDragStart, onDragEnd, ...pane }: Props) {
  // The field a visitor chose without dragging, waiting to be told where it goes.
  const [adding, setAdding] = useState<CanvasField | null>(null);
  return (
    <>
      {/* One panel: the chart's settings and zones, then the fields to put in them, in one column beside the charts (a wide screen) or below
          the chart being edited. */}
      <section className="canvas-panel" id="canvas-editor" aria-labelledby="canvas-pane-title">
        <h2 className="pane-title" id="canvas-pane-title">
          {pane.of > 1 ? say("card_label", { number: pane.number }) : say("pane_chart")}
        </h2>
        <ChartPane key={pane.chart.id} {...pane} onPut={onPut} />
        <FieldList all={pane.all} question={pane.chart.question} groups={groups} onDragStart={onDragStart} onDragEnd={onDragEnd} onChoose={setAdding} />
      </section>
      {adding ? (
        <AddMenu
          all={pane.all}
          question={pane.chart.question}
          field={adding}
          onPut={(zone) => {
            onPut(zone, adding);
            setAdding(null);
          }}
          onClose={() => setAdding(null)}
        />
      ) : null}
    </>
  );
}
