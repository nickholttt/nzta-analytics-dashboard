// The chart being edited, as its question: the chart type, then the six zones (what is counted, the measure, the breakdown, a second
// one, the filters, the period). A field dragged from the list is dropped on a zone; the zone says, while the field is held over it,
// what the drop would do or why it cannot take it. Every change goes through the canvas, which settles the question as the Build page
// does, so the pane never holds a question the data cannot answer.
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MAX_VALUES, RANKING, questionParams, withValues } from "../../lib/builder";
import type { Question, Vocabulary } from "../../lib/builder";
import { FIELD_ZONES, TABLE, WIDTHS, bestType, canvasSpec, chartQuestion, chartTypes, datasetLabel, fieldLabel, measureLabel, say, verdict, zoneLabel } from "../../lib/canvas";
import type { CanvasChart, CanvasField, Width, Zone } from "../../lib/canvas";
import { chartDefaults, findDataset, lowerLabel } from "../../lib/config";
import type { Manifest } from "../../lib/data";
import { pickerMonth } from "../../lib/kept";
import type { Owner } from "../../lib/kept";
import { ValuePicker, focusSoon, valueLabel } from "../ValuePicker";
import { useReading } from "../useReading";
import type { Refusal } from "./Canvas";

// The zones held at the top of the panel while a field is dragged: the ones a field is put into, and the period.
const PINNED_ZONES: readonly Zone[] = [...FIELD_ZONES, "period"];

const without = (where: Record<string, string[]>, dimension: string) => Object.fromEntries(Object.entries(where).filter(([d]) => d !== dimension));

// Focus goes to a zone when what had it is taken out of the zone, so it is never dropped to the page.
const toZone = (zone: Zone) => focusSoon(() => document.getElementById(`canvas-zone-${zone}`)?.closest<HTMLElement>("section"));

// One zone: its name, what a held field would do there, and what it holds.
function ZoneBox({
  zone,
  dragging,
  refused,
  verdictOf,
  onPut,
  children,
}: {
  zone: Zone;
  dragging: CanvasField | null;
  // The reason the last field put here was refused, until the visitor does something else.
  refused?: string;
  verdictOf: (field: CanvasField) => ReturnType<typeof verdict>;
  onPut: (zone: Zone, field: CanvasField) => void;
  children: ReactNode;
}) {
  // How many of the zone's elements the pointer is inside: an enter on a child comes before the leave of its parent.
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (dragging) return;
    depth.current = 0;
    setOver(false);
  }, [dragging]);
  const v = dragging ? verdictOf(dragging) : null;
  // What a drop here would do, or why the zone cannot take the field: laid over the zone while the field is held over it, so no zone
  // moves under the pointer.
  const held = over && v ? (v.ok ? say(`drop_${zone}`, { field: dragging?.label }) : v.reason) : null;
  return (
    <section
      className="zone"
      aria-labelledby={`canvas-zone-${zone}`}
      // Focus comes here when what had it is taken out of the zone (a field removed), so it is never dropped to the page.
      tabIndex={-1}
      data-accepts={v ? (v.ok ? "yes" : "no") : undefined}
      data-over={over && v ? "" : undefined}
      onDragEnter={(e) => {
        if (!dragging) return;
        e.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (!dragging) return;
        // The drop is always taken, so a field let go over a zone that refuses it is told why, not dropped in silence.
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        if (dragging) onPut(zone, dragging);
      }}
    >
      <h3 className="zone-label" id={`canvas-zone-${zone}`}>
        {zoneLabel(zone)}
        {v && !v.ok ? (
          <span className="zone-mark" aria-hidden="true">
            ⊘
          </span>
        ) : null}
      </h3>
      {held ? <p className={`zone-held ${v?.ok ? "fits" : "refuses"}`}>{held}</p> : null}
      {!dragging && refused ? <p className="zone-message refuses">{refused}</p> : null}
      {children}
    </section>
  );
}

type Choice = { id: string; label: string; tag?: string; reason?: string };

// A few choices as buttons, one pressed. A choice that cannot be made stays in place, greyed, and says why when it is tried: it is
// never made.
function Choices({
  label,
  choices,
  value,
  question,
  help,
  onChoose,
}: {
  label: string;
  choices: Choice[];
  value: string;
  // The question the choices are of: a reason shown for one question is not left standing over another.
  question: string;
  help?: string;
  onChoose: (id: string) => void;
}) {
  const [why, setWhy] = useState<string | null>(null);
  const refused = choices.find((c) => c.id === why && c.reason);
  useEffect(() => setWhy(null), [value, question]);
  const name = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <>
      <div className="choices" role="group" aria-label={label}>
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            className="choice"
            aria-pressed={c.id === value}
            aria-disabled={c.reason ? "true" : undefined}
            aria-describedby={c.reason ? `canvas-${name}-${c.id}` : undefined}
            onClick={() => (c.reason ? setWhy(c.id) : onChoose(c.id))}
          >
            {c.label}
            {c.tag ? <span className="choice-tag">{c.tag}</span> : null}
            {c.reason ? (
              <span className="visually-hidden" id={`canvas-${name}-${c.id}`}>
                {c.reason}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {refused ? (
        <p className="zone-message refuses" role="status">
          {refused.reason}
        </p>
      ) : help ? (
        <p className="choice-help">{help}</p>
      ) : null}
    </>
  );
}

// A field in a zone: its name, and a way to take it out where it can be.
function FieldChip({ field, zone, onRemove }: { field: string; zone: Zone; onRemove?: () => void }) {
  return (
    <div className="chip">
      <span className="chip-name">{fieldLabel(field)}</span>
      {onRemove ? (
        <button type="button" className="chip-remove" aria-label={say("remove_from", { field: fieldLabel(field), zone: zoneLabel(zone) })} onClick={onRemove}>
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

// stays: the chart is still the one being edited afterwards, so the button keeps the focus; otherwise the page sends focus to a card.
type Action = { id: string; label: string; reason?: string; stays?: boolean; run: () => void };

// What is done to the chart as one of the page's charts: moved, copied, removed. An action that cannot be done stays in place, greyed,
// and says why when it is tried, so the button a visitor is on never goes from under them.
function Actions({ actions }: { actions: Action[] }) {
  const [why, setWhy] = useState<string | null>(null);
  const refused = actions.find((a) => a.id === why && a.reason);
  return (
    <>
      <div className="chart-actions" role="group" aria-label={say("chart_actions")}>
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            className="button-quiet"
            data-action={a.id}
            aria-disabled={a.reason ? "true" : undefined}
            onClick={() => {
              setWhy(a.reason ? a.id : null);
              if (a.reason) return;
              a.run();
              // The pane moves with its chart where it sits below it, so the button is given the focus back.
              if (a.stays) focusSoon(() => document.querySelector<HTMLElement>(`.chart-actions [data-action="${a.id}"]`));
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      {refused ? (
        <p className="zone-message refuses" role="status">
          {refused.reason}
        </p>
      ) : null}
    </>
  );
}

type Props = {
  all: Vocabulary;
  chart: CanvasChart;
  // The chart's place on the canvas, from one, and how many charts the canvas holds.
  number: number;
  of: number;
  // The canvas holds as many charts as it may.
  full: boolean;
  manifest: Manifest | undefined;
  // The snapshot this page serves and the fields made from an owner field: a pinned chart's lists of values are counted in the kept
  // snapshot it reads from, where that snapshot can give them (src/lib/kept.ts, pickerMonth).
  served: Manifest | null | undefined;
  owner: Owner;
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
  // by: how many places, earlier (below none) or later.
  onMove: (by: number) => void;
};

export default function ChartPane({ all, chart, number, of, full, manifest, served, owner, dragging, refusal, onAsk, onSet, onPut, onRemoved, onPeriodSlot, onStatus, onDuplicate, onRemove, onMove }: Props) {
  const q = chart.question;
  const v = all.datasets.find((d) => d.dataset === q.dataset) ?? all.datasets[0];
  const m = v.measures.find((o) => o.id === q.measure) ?? v.measures[0];
  const breakdown = m.dimensions.find((d) => d.id === q.by);
  const second = m.dimensions.find((d) => d.id === q.by2);
  const canApply = (id: string) => v.filters.some((f) => f.id === id);
  const applicable = (where: Record<string, string[]>) => Object.fromEntries(Object.entries(where).filter(([d]) => canApply(d)));
  const reading = useReading(chartQuestion(chart), served, owner);
  const pickAt = (dimension: string, where: Record<string, string[]>) => pickerMonth(reading, q.dataset, dimension, where, owner);
  // Which list of values is open: a zone's, or a filter's by its field.
  const [openValues, setOpenValues] = useState<string | null>(null);
  const best = bestType(q);
  const type = chart.type ?? best;
  // The question as one text, to tell one question from the next.
  const asked = `${String(questionParams(q, chart.id))}|${q.values.join("|")}`;

  // A field let go over one of the pinned zones: once the drag is over, the panel is scrolled to where the zones were pinned, so the zone
  // dropped on stays in view with what the drop did, or why it could not. A drag let go anywhere else leaves the list where it was.
  const group = useRef<HTMLDivElement>(null);
  const dropped = useRef(false);
  const drop = (zone: Zone, field: CanvasField) => {
    dropped.current = PINNED_ZONES.includes(zone);
    onPut(zone, field);
  };
  useEffect(() => {
    if (dragging || !dropped.current) return;
    dropped.current = false;
    group.current?.scrollIntoView({ block: "nearest" });
  }, [dragging]);

  const box = (zone: Zone, children: ReactNode) => (
    <ZoneBox zone={zone} dragging={dragging} refused={refusal?.zone === zone ? refusal.reason : undefined} verdictOf={(field) => verdict(all, q, zone, field)} onPut={drop}>
      {children}
    </ZoneBox>
  );

  // The values of a field in a zone: what is chosen, said in a line, and the list to choose from behind a button.
  const values = (key: string, field: string, chosen: string[], summary: string, picker: ReactNode, alwaysOpen = false) => {
    const open = alwaysOpen || openValues === key;
    const said = chosen.length ? chosen.map((value) => valueLabel(value, field)).join(", ") : summary;
    return (
      <div className="zone-values">
        {said ? <p className="zone-values-summary">{said}</p> : null}
        {alwaysOpen ? null : (
          <button type="button" className="button-quiet" aria-expanded={open} onClick={() => setOpenValues(open ? null : key)}>
            {open ? say("values_done") : say("choose_values")}
          </button>
        )}
        {open ? picker : null}
      </div>
    );
  };

  const types = manifest ? chartTypes(all, q, manifest) : [];
  const fitting = types.filter((t) => t.fits);
  const typeChoices: Choice[] = [
    ...fitting.map((t) => ({ id: t.id, label: t.label, ...(t.best && fitting.length > 1 ? { tag: say("best_fit") } : {}) })),
    { id: TABLE, label: canvasSpec.table.label },
    ...types.filter((t) => !t.fits).map((t) => ({ id: t.id, label: t.label, reason: t.reason })),
  ];
  const shown = chart.table ? TABLE : type;
  const typeHelp = shown === TABLE ? canvasSpec.table.help : canvasSpec.chart_types.find((t) => t.id === shown)?.help;

  // No box of its own: the parts sit straight in the editing panel (Editor.tsx), so the zones that take a field can be held at the top of the
  // panel while a field is dragged from anywhere in the list under them.
  return (
    <>
      <Actions
        // A canvas of one chart has nowhere to move it and keeps it: it can be copied.
        actions={[
          ...(of > 1
            ? [
                { id: "earlier", label: say("move_earlier"), stays: true, run: () => onMove(-1), ...(number === 1 ? { reason: say("cannot_move_earlier") } : {}) },
                { id: "later", label: say("move_later"), stays: true, run: () => onMove(1), ...(number === of ? { reason: say("cannot_move_later") } : {}) },
              ]
            : []),
          { id: "duplicate", label: say("duplicate_chart"), run: onDuplicate, ...(full ? { reason: say("canvas_full", { number: canvasSpec.max_charts }) } : {}) },
          ...(of > 1 ? [{ id: "remove", label: say("remove_chart"), run: onRemove }] : []),
        ]}
      />

      {types.length > 0 ? (
        <section className="zone" aria-labelledby="canvas-zone-type">
          <h3 className="zone-label" id="canvas-zone-type">
            {say("chart_type")}
          </h3>
          <Choices
            label={say("chart_type")}
            choices={typeChoices}
            value={shown}
            question={asked}
            help={typeHelp}
            onChoose={(id) => {
              // The best fit is not written into the link: a chart that names no type follows its question.
              onSet(id === TABLE ? { table: true } : { type: id === best ? null : id, table: false });
              onStatus(say("status_type", { type: typeChoices.find((c) => c.id === id)?.label }));
            }}
          />
        </section>
      ) : null}

      {box(
        "dataset",
        <select className="zone-select" aria-label={say("dataset_label")} value={v.dataset} onChange={(e) => onAsk({ dataset: e.target.value })}>
          {all.datasets.map((d) => (
            <option key={d.dataset} value={d.dataset}>
              {d.label}
            </option>
          ))}
        </select>,
      )}

      {box(
        "measure",
        <Choices
          label={say("measure_label")}
          choices={[...v.measures.map((o) => ({ id: o.id, label: measureLabel(o) })), { id: "average", label: say("average"), reason: say("average_reason") }]}
          value={m.id}
          question={asked}
          onChoose={(id) => onAsk({ measure: id })}
        />,
      )}

      {/* The zones a field is put into. While a field is held they are pinned to the top of the panel (or of the window, where the panel opens
          below the chart), so every one of them can be reached from anywhere in the field list without the list moving under the pointer.
          Pinning moves nothing else: the group keeps its place in the panel. */}
      <div className="zone-group" ref={group} data-pinned={dragging ? "" : undefined}>
        {box(
          "by",
          q.by ? (
            <>
              <FieldChip
                field={q.by}
                zone="by"
                onRemove={
                  m.allowsTotal
                    ? () => {
                        onRemoved(q.by as string, "by");
                        onAsk({ by: null, values: [], by2: null, values2: [] });
                        toZone("by");
                      }
                    : undefined
                }
              />
              {breakdown?.values
                ? values(
                    "by",
                    q.by,
                    q.pageValues ? [] : q.values,
                    type === RANKING ? say("values_every") : say("values_page"),
                    <ValuePicker
                      dataset={q.dataset}
                      dimension={q.by}
                      noun={lowerLabel(fieldLabel(q.by))}
                      // The page's own starting values are not the visitor's: the list starts empty, and the first value chosen replaces them.
                      chosen={q.pageValues ? [] : q.values}
                      where={applicable(q.where)}
                      snapshot={pickAt(q.by, applicable(q.where))}
                      max={q.by2 ? chartDefaults.matrix.rows : MAX_VALUES}
                      onChange={(next) => onAsk({ values: next, pageValues: false })}
                      idPrefix={`${chart.id}-by`}
                    />,
                  )
                : null}
            </>
          ) : (
            <p className="zone-empty">{say("by_empty")}</p>
          ),
        )}

        {box(
          "by2",
          q.by2 ? (
            <>
              <FieldChip
                field={q.by2}
                zone="by2"
                onRemove={() => {
                  onRemoved(q.by2 as string, "by2");
                  onAsk({ by2: null, values2: [] });
                  toZone("by2");
                }}
              />
              {second?.values
                ? values(
                    "by2",
                    q.by2,
                    q.values2 ?? [],
                    say("values_page"),
                    <ValuePicker
                      dataset={q.dataset}
                      dimension={q.by2}
                      noun={lowerLabel(fieldLabel(q.by2))}
                      chosen={q.values2 ?? []}
                      where={applicable(q.where)}
                      snapshot={pickAt(q.by2, applicable(q.where))}
                      max={chartDefaults.matrix.columns}
                      onChange={(next) => onAsk({ values2: next })}
                      idPrefix={`${chart.id}-by2`}
                    />,
                  )
                : null}
            </>
          ) : (
            <p className="zone-empty">{say("by2_empty")}</p>
          ),
        )}

        {box(
          "where",
          Object.keys(q.where).length === 0 ? (
            <p className="zone-empty">{say("where_empty")}</p>
          ) : (
            Object.entries(q.where).map(([d, kept]) => (
              <div className="zone-filter" key={d}>
                <FieldChip
                  field={d}
                  zone="where"
                  onRemove={() => {
                    onRemoved(d, "where");
                    onAsk({ where: without(q.where, d) });
                    toZone("where");
                  }}
                />
                {canApply(d) ? (
                  values(
                    `where.${d}`,
                    d,
                    kept,
                    "",
                    <ValuePicker
                      dataset={q.dataset}
                      dimension={d}
                      noun={lowerLabel(fieldLabel(d))}
                      chosen={kept}
                      where={applicable(without(q.where, d))}
                      snapshot={pickAt(d, applicable(without(q.where, d)))}
                      onChange={(next) => {
                        onAsk({ where: withValues(q.where, d, next) });
                        // The last value taken away takes the filter with it.
                        if (next.length === 0) toZone("where");
                      }}
                      idPrefix={`${chart.id}-where`}
                    />,
                    // A filter with no value yet keeps every vehicle: its list is open until it has one.
                    kept.length === 0,
                  )
                ) : (
                  <p className="zone-message refuses">{say("filter_cannot_apply", { dataset: datasetLabel(q.dataset), field: fieldLabel(d) })}</p>
                )}
              </div>
            ))
          ),
        )}

        {box(
          "period",
          <>
            {findDataset(q.dataset)?.single_period ? <p className="zone-empty">{say("period_one")}</p> : null}
            <div className="period-slot" ref={onPeriodSlot} />
          </>,
        )}
      </div>

      <section className="zone" aria-labelledby="canvas-zone-width">
        <h3 className="zone-label" id="canvas-zone-width">
          {say("width_label")}
        </h3>
        <Choices
          label={say("width_label")}
          choices={WIDTHS.map((width) => ({ id: width, label: say(`width_${width}`) }))}
          value={chart.width}
          question={asked}
          help={say("width_help")}
          onChoose={(id) => onSet({ width: id as Width })}
        />
      </section>
    </>
  );
}
