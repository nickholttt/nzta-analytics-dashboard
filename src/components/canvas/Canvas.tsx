// The canvas page: charts a visitor builds by putting fields into each chart's zones (work order 2 section 5; D-138, D-147). Each
// chart is a Build question drawn by the same panel as every other chart on the site; what a field may do in a zone, which chart types
// fit, how charts are added, copied, removed and moved, and the address are src/lib/canvas.ts. The whole canvas lives in the address
// bar, so the link is the page.
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { absentNotes, absentValues, linkNotices, settle, withoutValues } from "../../lib/builder";
import type { Question, Vocabulary } from "../../lib/builder";
import {
  addChart,
  canvasAddress,
  canvasSpec,
  changeChart,
  chartPreset,
  chartSettings,
  duplicateChart,
  fieldLabel,
  isFull,
  moveChart,
  readCanvas,
  removeChart,
  restoreChart,
  say,
  settleCanvas,
  verdict,
  withChartSettings,
  withFittingTypes,
  zoneLabel,
} from "../../lib/canvas";
import type { Canvas as CanvasState, CanvasChart, CanvasField, CanvasFieldGroup, ChartSettings, Zone } from "../../lib/canvas";
import { fieldValues, loadManifest } from "../../lib/data";
import type { Manifest } from "../../lib/data";
import { focusSoon, valueLabel } from "../ValuePicker";
import AddMenu from "./AddMenu";
import ChartCard, { cardId } from "./ChartCard";
import ChartPane from "./ChartPane";
import FieldList from "./FieldList";
import MyCanvases from "./MyCanvases";

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

// A chart just removed, with its place and its own settings, so that it can be put back until the canvas next changes.
type Removed = { chart: CanvasChart; index: number; settings: ChartSettings };

// Focus goes to a card when what had it has gone: a chart added, removed or put back.
const toCard = (chart: string) =>
  focusSoon(() => {
    const card = document.getElementById(cardId(chart));
    card?.scrollIntoView({ block: "nearest" });
    return card;
  });

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
  // The chart being dragged to another place, by its id.
  const [moving, setMoving] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Removed | null>(null);
  // Why the last chart asked for was not added, until the canvas changes.
  const [addRefused, setAddRefused] = useState(false);

  // What the link asked of each chart that the page could not give, said on the chart until the visitor changes it.
  const [notices, setNotices] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") return {};
    const told = readCanvas(window.location.search).map((a): [string, string[]] => [a.id, linkNotices(all, a.asked, settle(all, a.asked), valueLabel)]);
    return Object.fromEntries(told.filter(([, lines]) => lines.length > 0));
  });

  const latest = useRef(canvas);
  latest.current = canvas;
  const built = manifest ?? undefined;
  const latestBuilt = useRef(built);
  latestBuilt.current = built;

  const write = useCallback((next: CanvasState, changed: ReadonlySet<string>, search = window.location.search) => {
    const address = `${window.location.pathname}?${canvasAddress(search, next, changed)}${window.location.hash}`;
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

  // The canvas changed. changed: the charts that became other charts, whose own settings in the address go. search: the address to
  // write over, where it is not the page's own (a copy's settings, a chart put back).
  const commit = useCallback(
    (next: CanvasState, changed: ReadonlySet<string> = new Set(), search?: string) => {
      latest.current = next;
      setCanvas(next);
      write(next, changed, search);
    },
    [write],
  );

  // What the visitor did last no longer stands once they do something else: a refused drop, a chart that could be put back.
  const moveOn = useCallback(() => {
    setRefusal(null);
    setRemoved(null);
    setAddRefused(false);
  }, []);

  // One chart changed. reset: the change makes it another chart (its question or its type), so its own settings in the address go.
  const replace = useCallback(
    (chart: CanvasChart, reset: boolean) => commit({ charts: latest.current.charts.map((c) => (c.id === chart.id ? chart : c)) }, new Set(reset ? [chart.id] : [])),
    [commit],
  );

  const chartOf = (id: string) => latest.current.charts.find((c) => c.id === id);
  const placeOf = (id: string) => latest.current.charts.findIndex((c) => c.id === id) + 1;

  // The visitor changed a chart's question. A change the page makes itself (its starting values arriving) keeps the chart's settings and
  // what the page last said.
  const ask = useCallback(
    (id: string, next: Partial<Question>, byVisitor = true) => {
      const chart = chartOf(id);
      if (!chart) return;
      replace(changeChart(all, chart, next, built), byVisitor);
      if (!byVisitor) return;
      moveOn();
      setNotices(({ [id]: _told, ...others }) => others);
    },
    [all, built, replace, moveOn],
  );

  const set = useCallback(
    (id: string, next: Partial<Pick<CanvasChart, "type" | "table" | "width">>) => {
      const chart = chartOf(id);
      if (!chart) return;
      replace({ ...chart, ...next }, next.type !== undefined && next.type !== chart.type);
      moveOn();
    },
    [replace, moveOn],
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

  const fieldRemoved = useCallback((field: string, zone: Zone) => setStatus(say("status_removed", { field: fieldLabel(field), zone: zoneLabel(zone) })), []);

  // A link can name a value its dataset's own table of that field does not hold, which would match no vehicle and say nothing. Checked
  // once for each chart the link opened, as the Build page checks its question; the value is left out and the chart says so.
  useEffect(() => {
    for (const { id, question: asked } of latest.current.charts) {
      const filters = all.datasets.find((v) => v.dataset === asked.dataset)?.filters ?? [];
      const canApply = (d: string) => filters.some((f) => f.id === d);
      const readTable = (from: string, field: string, others: Record<string, string[]>) =>
        fieldValues(from, field, Object.values(others).some((kept) => kept.length > 0)).catch(() => undefined);
      absentValues(asked, canApply, readTable).then((absent) => {
        const now = chartOf(id);
        if (absent.length === 0 || !now || now.question.dataset !== asked.dataset) return;
        replace(changeChart(all, now, withoutValues(now.question, absent), latestBuilt.current, false), false);
        setNotices((before) => ({ ...before, [id]: [...(before[id] ?? []), ...absentNotes(asked.dataset, absent, valueLabel)] }));
      });
    }
    // Once, for the charts the link opened: replace and the closures read the latest canvas through its ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- The page's own changes: a chart added, copied, removed, put back or moved ----

  // A chart that has just joined the canvas is the one being edited, and has the focus.
  const joined = useCallback((id: string) => {
    setSelected(id);
    setOpen(true);
    toCard(id);
  }, []);

  const add = useCallback(() => {
    const made = addChart(all, latest.current);
    moveOn();
    if (!made) {
      setAddRefused(true);
      setStatus(say("canvas_full", { number: canvasSpec.max_charts }));
      return;
    }
    commit(made.canvas);
    joined(made.id);
    setStatus(say("status_chart_added", { number: placeOf(made.id) }));
  }, [all, commit, joined, moveOn]);

  const duplicate = useCallback(
    (id: string) => {
      const made = duplicateChart(latest.current, id);
      if (!made) return;
      moveOn();
      // The copy starts with the chart's own settings too: the same time range, the same month.
      commit(made.canvas, new Set(), withChartSettings(window.location.search, made.id, chartSettings(window.location.search, id)));
      joined(made.id);
      setStatus(say("status_chart_duplicated", { number: placeOf(made.id) }));
    },
    [commit, joined, moveOn],
  );

  const remove = useCallback(
    (id: string) => {
      const index = placeOf(id) - 1;
      const chart = chartOf(id);
      const next = removeChart(latest.current, id);
      if (!chart || next === latest.current) return;
      moveOn();
      setRemoved({ chart, index, settings: chartSettings(window.location.search, id) });
      commit(next);
      const neighbour = next.charts[Math.min(index, next.charts.length - 1)].id;
      setSelected(neighbour);
      setOpen(false);
      toCard(neighbour);
      setStatus(say("status_chart_removed", { number: index + 1 }));
    },
    [commit, moveOn],
  );

  const putBack = useCallback(() => {
    if (!removed) return;
    const next = restoreChart(latest.current, removed.chart, removed.index);
    moveOn();
    if (!next) return;
    commit(next, new Set(), withChartSettings(window.location.search, removed.chart.id, removed.settings));
    setSelected(removed.chart.id);
    toCard(removed.chart.id);
    setStatus(say("status_chart_restored", { number: placeOf(removed.chart.id) }));
  }, [commit, moveOn, removed]);

  // to: the place the chart is moved to, counted from none.
  const move = useCallback(
    (id: string, to: number) => {
      const next = moveChart(latest.current, id, to);
      if (next === latest.current) return;
      moveOn();
      commit(next);
      setStatus(say("status_chart_moved", { number: placeOf(id) }));
    },
    [commit, moveOn],
  );

  const current = canvas.charts.find((c) => c.id === selected) ?? canvas.charts[0];
  const editorShown = wide || open;
  const place = current ? canvas.charts.indexOf(current) : -1;
  // What the canvas is called when it is saved, until the visitor renames it: its first chart's title, and how many more it holds.
  const [first] = canvas.charts;
  const title = (first && chartPreset(first, (value) => valueLabel(value, first.question.by ?? undefined))?.question) || say("page_title");
  const name = canvas.charts.length > 1 ? say("default_name_more", { name: title, number: canvas.charts.length - 1 }) : title;

  const editor = current ? (
    <div className="canvas-editor" id="canvas-editor">
      <ChartPane
        key={current.id}
        all={all}
        chart={current}
        number={place + 1}
        of={canvas.charts.length}
        full={isFull(canvas)}
        manifest={built}
        dragging={dragging}
        refusal={refusal?.chart === current.id ? refusal : null}
        onAsk={(next) => ask(current.id, next)}
        onSet={(next) => set(current.id, next)}
        onPut={(zone, field) => put(current.id, zone, field)}
        onRemoved={fieldRemoved}
        onPeriodSlot={setPeriodSlot}
        onStatus={setStatus}
        onDuplicate={() => duplicate(current.id)}
        onRemove={() => remove(current.id)}
        onMove={(by) => move(current.id, place + by)}
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
          <Fragment key={chart.id}>
            <ChartCard
              all={all}
              chart={chart}
              number={i + 1}
              of={canvas.charts.length}
              selected={chart.id === current?.id}
              wide={wide}
              editorOpen={chart.id === current?.id && editorShown}
              periodSlot={chart.id === current?.id && editorShown ? periodSlot : null}
              moving={moving}
              notices={notices[chart.id] ?? []}
              onEdit={() => {
                setSelected(chart.id);
                setOpen(chart.id === current?.id ? !open : true);
              }}
              onPageValues={(values) => ask(chart.id, { values, pageValues: true }, false)}
              onMoveStart={() => setMoving(chart.id)}
              onMoveEnd={() => setMoving(null)}
              onMoveHere={() => {
                if (moving) move(moving, i);
                setMoving(null);
              }}
            />
            {!wide && open && chart.id === current?.id ? editor : null}
          </Fragment>
        ))}
        {removed ? (
          <p className="chart-removed">
            {say("removed_note")}{" "}
            <button type="button" className="button-quiet" onClick={putBack}>
              {say("put_back")}
            </button>
          </p>
        ) : null}
        <div className="chart-add">
          <button type="button" className="chart-add-button" aria-disabled={isFull(canvas) ? "true" : undefined} aria-describedby={addRefused ? "canvas-add-refused" : undefined} onClick={add}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {say("add_chart")}
          </button>
          {addRefused ? (
            <p className="zone-message refuses" id="canvas-add-refused">
              {say("canvas_full", { number: canvasSpec.max_charts })}
            </p>
          ) : null}
        </div>
        <MyCanvases name={name} />
      </div>
      {wide ? editor : null}
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
