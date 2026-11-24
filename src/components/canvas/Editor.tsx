// The canvas's editing tools: the pane of the chart being edited (its type and zones), the field list, and the dialog that asks where a chosen
// field goes. They are a file of their own, loaded once the first chart is drawn (Canvas.tsx), so a link to a canvas gets its charts before the
// tools to change them. The state they share with the charts (the question, a field being dragged, a refusal) stays with the canvas; what only
// they use (the field chosen without dragging) lives here.
import { useState } from "react";
import type { Question, Vocabulary } from "../../lib/builder";
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
      <div className="canvas-editor" id="canvas-editor">
        <ChartPane key={pane.chart.id} {...pane} onPut={onPut} />
        <FieldList all={pane.all} question={pane.chart.question} groups={groups} onDragStart={onDragStart} onDragEnd={onDragEnd} onChoose={setAdding} />
      </div>
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
