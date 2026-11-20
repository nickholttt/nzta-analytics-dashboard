// The canvas page: charts a visitor builds by putting fields into each chart's zones (work order 2 section 5; D-138, D-147). Each
// chart is a Build question drawn by the same panel as every other chart on the site; what a field may do in a zone, which chart types
// fit, and the address are src/lib/canvas.ts. The whole canvas lives in the address bar, so the link is the page.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Question, Vocabulary } from "../../lib/builder";
import { canvasAddress, changeChart, fieldLabel, readCanvas, say, settleCanvas, verdict, withFittingTypes, zoneLabel } from "../../lib/canvas";
import type { Canvas as CanvasState, CanvasChart, CanvasField, CanvasFieldGroup, Zone } from "../../lib/canvas";
import { loadManifest } from "../../lib/data";
import type { Manifest } from "../../lib/data";
import { focusSoon } from "../ValuePicker";
import AddMenu from "./AddMenu";
import ChartCard from "./ChartCard";
import ChartPane from "./ChartPane";
import FieldList from "./FieldList";

// At this width and over, the chart's zones and the field list sit beside the charts; under it they open below the chart being edited.
const WIDE = "(min-width: 64rem)";

function useWide(): boolean {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const listen = () => setWide(query.matches);
    query.addEventListener("change", listen);
    return () => query.removeEventListener("change", listen);
  }, []);
  return wide;
}

// A refused drop, kept in the zone it was refused by until the visitor does something else.
export type Refusal = { chart: string; zone: Zone; reason: string };

export default function Canvas({ vocabulary: all, groups }: { vocabulary: Vocabulary; groups: CanvasFieldGroup[] }) {
  const [canvas, setCanvas] = useState<CanvasState>(() => settleCanvas(all, typeof window === "undefined" ? [] : readCanvas(window.location.search)));
  const [selected, setSelected] = useState<string>(() => canvas.charts[0]?.id ?? "");
  // The build as served, for the checks that need it (whether a chart type can be drawn). Null when it could not be read.
  const [manifest, setManifest] = useState<Manifest | null | undefined>(undefined);
  // What the page last did, for a screen reader: one polite line for the whole canvas.
  const [status, setStatus] = useState("");
  const [dragging, setDragging] = useState<CanvasField | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  // The field a visitor chose without dragging, waiting to be told where it goes.
  const [adding, setAdding] = useState<CanvasField | null>(null);
  // Where the selected chart's time row is drawn: the Period zone.
  const [periodSlot, setPeriodSlot] = useState<HTMLElement | null>(null);
  const wide = useWide();
  // Under the wide layout the editor opens below the chart when asked for.
  const [open, setOpen] = useState(false);

  const latest = useRef(canvas);
  latest.current = canvas;
  const built = manifest ?? undefined;

  const write = useCallback((next: CanvasState, changed: ReadonlySet<string>) => {
    const address = `${window.location.pathname}?${canvasAddress(window.location.search, next, changed)}${window.location.hash}`;
    if (address !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, "", address);
  }, []);

  // The address is corrected where the link is read, and a chart type the build cannot draw gives way once the build is known.
  useEffect(() => {
    write(latest.current, new Set());
    loadManifest().then(
      (m) => {
        setManifest(m);
        const fitted = withFittingTypes(latest.current, m);
        const changed = new Set(fitted.charts.filter((c, i) => c.type !== latest.current.charts[i].type).map((c) => c.id));
        if (changed.size === 0) return;
        latest.current = fitted;
        setCanvas(fitted);
        write(fitted, changed);
      },
      () => setManifest(null),
    );
  }, [write]);

  // One chart changed. reset: the change makes it another chart (its question or its type), so its own settings in the address go.
  const replace = useCallback(
    (chart: CanvasChart, reset: boolean) => {
      const next = { charts: latest.current.charts.map((c) => (c.id === chart.id ? chart : c)) };
      latest.current = next;
      setCanvas(next);
      write(next, new Set(reset ? [chart.id] : []));
    },
    [write],
  );

  const chartOf = (id: string) => latest.current.charts.find((c) => c.id === id);

  // The visitor changed a chart's question. A change the page makes itself (its starting values arriving) keeps the chart's settings and
  // what the page last said.
  const ask = useCallback(
    (id: string, next: Partial<Question>, byVisitor = true) => {
      const chart = chartOf(id);
      if (!chart) return;
      replace(changeChart(all, chart, next, built), byVisitor);
      if (byVisitor) setRefusal(null);
    },
    [all, built, replace],
  );

  const set = useCallback(
    (id: string, next: Partial<Pick<CanvasChart, "type" | "table" | "width">>) => {
      const chart = chartOf(id);
      if (!chart) return;
      replace({ ...chart, ...next }, next.type !== undefined && next.type !== chart.type);
      setRefusal(null);
    },
    [replace],
  );

  // A field put into a zone of a chart, by a drop or from the menu: the question changes where the zone takes the field, and the page
  // says what happened either way.
  const put = useCallback(
    (id: string, zone: Zone, field: CanvasField) => {
      const chart = chartOf(id);
      if (!chart) return;
      const v = verdict(all, chart.question, zone, field);
      if (!v.ok) {
        setRefusal({ chart: id, zone, reason: v.reason });
        setStatus(say("status_refused", { reason: v.reason }));
        return;
      }
      // The month put in the period changes nothing by itself: the period is chosen there, so the page says so and goes to the choice.
      if (zone === "period") {
        setRefusal(null);
        setStatus(say("status_period"));
        focusSoon(() => document.querySelector<HTMLElement>(".period-slot input:checked") ?? document.querySelector<HTMLElement>(".period-slot input"));
        return;
      }
      ask(id, v.change);
      const names = { field: field.label, zone: zoneLabel(zone) };
      setStatus(v.replaces ? say("status_replaced", { ...names, other: fieldLabel(v.replaces) }) : say("status_added", names));
    },
    [all, ask],
  );

  const removed = useCallback((field: string, zone: Zone) => setStatus(say("status_removed", { field: fieldLabel(field), zone: zoneLabel(zone) })), []);

  const current = canvas.charts.find((c) => c.id === selected) ?? canvas.charts[0];
  const editorShown = wide || open;

  const editor = current ? (
    <div className="canvas-editor" id="canvas-editor">
      <ChartPane
        all={all}
        chart={current}
        manifest={built}
        dragging={dragging}
        refusal={refusal?.chart === current.id ? refusal : null}
        onAsk={(next) => ask(current.id, next)}
        onSet={(next) => set(current.id, next)}
        onPut={(zone, field) => put(current.id, zone, field)}
        onRemoved={removed}
        onPeriodSlot={setPeriodSlot}
        onStatus={setStatus}
      />
      <FieldList
        all={all}
        question={current.question}
        groups={groups}
        onDragStart={(field) => {
          // A new field in hand: what the last one was told no longer stands in its zone.
          setRefusal(null);
          setDragging(field);
        }}
        onDragEnd={() => setDragging(null)}
        onChoose={setAdding}
      />
    </div>
  ) : null;

  return (
    <div className={`canvas${wide ? " wide" : ""}`} data-dragging={dragging ? "" : undefined}>
      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>
      <div className="canvas-charts">
        {canvas.charts.map((chart, i) => (
          <ChartCard
            key={chart.id}
            all={all}
            chart={chart}
            number={i + 1}
            of={canvas.charts.length}
            selected={chart.id === current?.id}
            wide={wide}
            editorOpen={chart.id === current?.id && editorShown}
            periodSlot={chart.id === current?.id && editorShown ? periodSlot : null}
            onEdit={() => {
              setSelected(chart.id);
              setOpen(chart.id === current?.id ? !open : true);
            }}
            onPageValues={(values) => ask(chart.id, { values, pageValues: true }, false)}
          />
        ))}
      </div>
      {editorShown ? editor : null}
      {adding && current ? (
        <AddMenu
          all={all}
          question={current.question}
          field={adding}
          onPut={(zone) => {
            put(current.id, zone, adding);
            setAdding(null);
          }}
          onClose={() => setAdding(null)}
        />
      ) : null}
    </div>
  );
}
