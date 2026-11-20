// The field list: every field the data map makes askable, in the canvas's groups, with a search box. A field is dragged onto a zone
// of the chart being edited, or chosen (a click, a tap, Enter) to be told where it goes. Its one-line definition shows while the
// pointer or the keyboard is on it; on a touch screen the menu a tap opens says it.
import { useState } from "react";
import type { Question, Vocabulary } from "../../lib/builder";
import { inUse, say, usable } from "../../lib/canvas";
import type { CanvasField, CanvasFieldGroup } from "../../lib/canvas";

type Props = {
  all: Vocabulary;
  // The question of the chart being edited: a field it cannot use anywhere is listed greyed.
  question: Question;
  groups: CanvasFieldGroup[];
  onDragStart: (field: CanvasField) => void;
  onDragEnd: () => void;
  onChoose: (field: CanvasField) => void;
};

export default function FieldList({ all, question, groups, onDragStart, onDragEnd, onChoose }: Props) {
  const [query, setQuery] = useState("");
  const [about, setAbout] = useState<CanvasField | null>(null);
  const needle = query.trim().toLowerCase();
  const shown = groups.map((g) => ({ ...g, fields: g.fields.filter((f) => !needle || f.label.toLowerCase().includes(needle)) })).filter((g) => g.fields.length > 0);

  return (
    <section className="field-list" aria-labelledby="canvas-fields-title">
      <h2 className="pane-title" id="canvas-fields-title">
        {say("pane_fields")}
      </h2>
      <label className="visually-hidden" htmlFor="canvas-field-search">
        {say("search_fields")}
      </label>
      <input id="canvas-field-search" className="field-search" type="search" placeholder={say("search_fields")} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      {shown.length === 0 ? <p className="zone-empty">{say("no_field_matches", { query: query.trim() })}</p> : null}
      {shown.map((g) => (
        <div className="field-group" key={g.id}>
          <h3 className="zone-label" id={`canvas-fields-${g.id}`}>
            {g.label}
          </h3>
          <ul aria-labelledby={`canvas-fields-${g.id}`}>
            {g.fields.map((f) => {
              const ok = usable(all, question, f);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    className="field"
                    data-kind={f.kind}
                    data-usable={ok ? undefined : "no"}
                    data-used={inUse(question, f.id) ? "" : undefined}
                    draggable
                    onDragStart={(e) => {
                      // Firefox starts a drag only where some data is set.
                      e.dataTransfer.setData("text/plain", f.label);
                      e.dataTransfer.effectAllowed = "copy";
                      onDragStart(f);
                    }}
                    onDragEnd={onDragEnd}
                    onClick={() => onChoose(f)}
                    onMouseEnter={() => setAbout(f)}
                    onFocus={() => setAbout(f)}
                  >
                    <span className="field-kind" aria-hidden="true" />
                    <span className="field-name">{f.label}</span>
                    {ok ? null : <span className="field-note">{say("field_not_here")}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="field-about">
        {about ? (
          <>
            <strong>{about.label}.</strong> {about.definition}
          </>
        ) : null}
      </p>
    </section>
  );
}
