// The chart being edited, as its question: the chart type, then the six zones (what is counted, the measure, the breakdown, a second
// one, the filters, the period). A field dragged from the list is dropped on a zone; the zone says, while the field is held over it,
// what the drop would do or why it cannot take it. Every change goes through the canvas, which settles the question as the Build page
// does, so the pane never holds a question the data cannot answer.
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MAX_VALUES, RANKING, questionParams, withValues } from "../../lib/builder";
import type { Question, Vocabulary } from "../../lib/builder";
import { TABLE, bestType, canvasSpec, chartTypes, datasetLabel, fieldLabel, measureLabel, say, verdict, zoneLabel } from "../../lib/canvas";
import type { CanvasChart, CanvasField, Zone } from "../../lib/canvas";
import { chartDefaults, findDataset, lowerLabel } from "../../lib/config";
import type { Manifest } from "../../lib/data";
import { ValuePicker, focusSoon, valueLabel } from "../ValuePicker";
import type { Refusal } from "./Canvas";

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

type Props = {
  all: Vocabulary;
  chart: CanvasChart;
  manifest: Manifest | undefined;
  dragging: CanvasField | null;
  refusal: Refusal | null;
  onAsk: (next: Partial<Question>) => void;
  onSet: (next: Partial<Pick<CanvasChart, "type" | "table" | "width">>) => void;
  onPut: (zone: Zone, field: CanvasField) => void;
  onRemoved: (field: string, zone: Zone) => void;
  onPeriodSlot: (element: HTMLElement | null) => void;
  onStatus: (text: string) => void;
};

export default function ChartPane({ all, chart, manifest, dragging, refusal, onAsk, onSet, onPut, onRemoved, onPeriodSlot, onStatus }: Props) {
  const q = chart.question;
  const v = all.datasets.find((d) => d.dataset === q.dataset) ?? all.datasets[0];
  const m = v.measures.find((o) => o.id === q.measure) ?? v.measures[0];
  const breakdown = m.dimensions.find((d) => d.id === q.by);
  const second = m.dimensions.find((d) => d.id === q.by2);
  const canApply = (id: string) => v.filters.some((f) => f.id === id);
  const applicable = (where: Record<string, string[]>) => Object.fromEntries(Object.entries(where).filter(([d]) => canApply(d)));
  // Which list of values is open: a zone's, or a filter's by its field.
  const [openValues, setOpenValues] = useState<string | null>(null);
  const best = bestType(q);
  const type = chart.type ?? best;
  // The question as one text, to tell one question from the next.
  const asked = `${String(questionParams(q, chart.id))}|${q.values.join("|")}`;

  const box = (zone: Zone, children: ReactNode) => (
    <ZoneBox zone={zone} dragging={dragging} refused={refusal?.zone === zone ? refusal.reason : undefined} verdictOf={(field) => verdict(all, q, zone, field)} onPut={onPut}>
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

  return (
    <section className="chart-pane" aria-labelledby="canvas-pane-title">
      <h2 className="pane-title" id="canvas-pane-title">
        {say("pane_chart")}
      </h2>

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
    </section>
  );
}
