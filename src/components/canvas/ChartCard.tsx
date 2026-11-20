// One chart on a canvas: a Build question drawn by the site's own panel, framed as a card. The card adds what a page of several charts
// needs (which chart is being edited, the way into its editor) and looks for a count's starting values as the Build page does.
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { questionParams } from "../../lib/builder";
import type { Vocabulary } from "../../lib/builder";
import { awaitsValues, canvasSpec, chartPreset, fieldLabel, say } from "../../lib/canvas";
import type { CanvasChart } from "../../lib/canvas";
import { TRAILING_MONTHS } from "../../lib/measures";
import PresetPanel from "../PresetPanel";
import type { CardWords } from "../PresetPanel";
import { startingValues, valueLabel, valueOptions } from "../ValuePicker";

const cardWords: CardWords = {
  about: say("about_figures"),
  snapshot: canvasSpec.words.snapshot_line,
  table: canvasSpec.table.label,
  tableLoading: say("table_loading"),
  download: say("download_csv"),
};

type Props = {
  all: Vocabulary;
  chart: CanvasChart;
  // The chart's place on the canvas, from one.
  number: number;
  // How many charts the canvas holds: a canvas of one has no need to say which is being edited.
  of: number;
  selected: boolean;
  // The zones and the field list sit beside the charts (a wide screen); otherwise they open below the chart from its own button.
  wide: boolean;
  editorOpen: boolean;
  // Where this chart's time row is drawn, while it is the one being edited.
  periodSlot: HTMLElement | null;
  onEdit: () => void;
  // The page's own starting values for a count with none chosen.
  onPageValues: (values: string[]) => void;
};

export default function ChartCard({ all, chart, number, of, selected, wide, editorOpen, periodSlot, onEdit, onPageValues }: Props) {
  const q = chart.question;
  const preset = useMemo(() => chartPreset(chart, (v) => valueLabel(v, chart.question.by ?? undefined)), [chart]);
  const awaiting = awaitsValues(all, chart);
  // The starting values are counted among the vehicles the chart's filters keep, as the list a visitor chooses from is.
  const filters = all.datasets.find((v) => v.dataset === q.dataset)?.filters ?? [];
  const whereKey = JSON.stringify(Object.fromEntries(Object.entries(q.where).filter(([d]) => filters.some((f) => f.id === d))));
  const startKey = `${q.dataset}|${q.by}|${whereKey}`;
  const [start, setStart] = useState<{ key: string; state: "none" | "failed" } | null>(null);
  useEffect(() => {
    const by = q.by;
    if (!awaiting || !by) return;
    let current = true;
    valueOptions(q.dataset, by, JSON.parse(whereKey)).then(
      (options) => {
        if (!current) return;
        const top = startingValues(options);
        if (top.length) onPageValues(top);
        else setStart({ key: startKey, state: "none" });
      },
      () => current && setStart({ key: startKey, state: "failed" }),
    );
    return () => {
      current = false;
    };
    // onPageValues reads the latest canvas itself; these are what decide whether starting values are needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaiting, q.dataset, q.by, whereKey]);

  // Keyed by the question and the type, so a changed chart is a new panel that reads its cleared settings from the address. Showing the
  // figures as a table is the same chart, and keeps them.
  const panelKey = `${chart.id}:${String(questionParams(q, chart.id))}:${q.values.join("|")}:${chart.type ?? ""}`;

  let headerEnd: ReactNode = null;
  if (!wide) {
    headerEnd = (
      <button type="button" className="button-quiet chart-card-edit" aria-expanded={editorOpen} aria-controls="canvas-editor" onClick={onEdit}>
        {editorOpen ? say("edit_done") : say("edit_chart")}
      </button>
    );
  } else if (!selected) {
    headerEnd = (
      <button type="button" className="button-quiet chart-card-edit" onClick={onEdit}>
        {say("edit_chart")}
      </button>
    );
  } else if (of > 1) {
    headerEnd = <span className="chart-card-tag">{say("editing")}</span>;
  }

  return (
    <article className="chart-card" data-width={chart.width} aria-current={selected && of > 1 ? "true" : undefined} aria-label={say("card_label", { number })}>
      {awaiting ? (
        <div className="chart-card-body">
          <header className="chart-card-head">
            <div className="chart-card-heading">
              <h2 className="chart-card-title">{preset?.question}</h2>
            </div>
            {headerEnd}
          </header>
          {start?.key === startKey ? (
            <div className="callout blocked">
              <span className="callout-label">{say("values_failed_label")}</span>
              {start.state === "failed" ? say("values_failed") : say("values_none", { months: TRAILING_MONTHS, field: q.by ? fieldLabel(q.by) : "" })}
            </div>
          ) : (
            <p className="meta" role="status">
              {say("finding_values")}
            </p>
          )}
        </div>
      ) : preset ? (
        <PresetPanel key={panelKey} preset={preset} frame="card" audience="public" anchored={false} controlsSlot={periodSlot} tableOnly={chart.table} headerEnd={headerEnd} cardWords={cardWords} />
      ) : null}
    </article>
  );
}
