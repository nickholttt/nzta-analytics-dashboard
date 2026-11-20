// Where to put a field, without dragging: the way in for a tap, a click and the keyboard. It lists the zones that hold fields, each
// ready to take the field or greyed with the reason it cannot, under the field's own definition. A dialog of the platform's, so focus
// is held inside it and goes back to the field when it closes.
import { useEffect, useRef } from "react";
import type { Question, Vocabulary } from "../../lib/builder";
import { FIELD_ZONES, say, verdict, zoneLabel } from "../../lib/canvas";
import type { CanvasField, Zone } from "../../lib/canvas";

type Props = {
  all: Vocabulary;
  question: Question;
  field: CanvasField;
  onPut: (zone: Zone) => void;
  onClose: () => void;
};

export default function AddMenu({ all, question, field, onPut, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  // The zone chosen, read when the dialog has closed: closing first hands focus back to the field before the page changes.
  const chosen = useRef<Zone | null>(null);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  const verdicts = FIELD_ZONES.map((zone) => ({ zone, v: verdict(all, question, zone, field) }));
  const reasons = verdicts.flatMap(({ v }) => (v.ok ? [] : [v.reason]));
  // A field no zone takes for one and the same reason says it once.
  const one = reasons.length === verdicts.length && new Set(reasons).size === 1 ? reasons[0] : null;

  return (
    <dialog
      ref={dialog}
      className="add-menu"
      aria-labelledby="canvas-add-title"
      onClose={() => (chosen.current ? onPut(chosen.current) : onClose())}
      onClick={(e) => {
        // A click on the backdrop, outside the box.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <div className="add-menu-box">
        <h2 id="canvas-add-title">{say("add_menu_title", { field: field.label })}</h2>
        <p className="add-menu-definition">{field.definition}</p>
        {one ? (
          <p className="add-menu-reason">{one}</p>
        ) : (
          <ul>
            {verdicts.map(({ zone, v }) => (
              <li key={zone}>
                <button
                  type="button"
                  className="add-menu-zone"
                  aria-disabled={v.ok ? undefined : "true"}
                  aria-describedby={v.ok ? undefined : `canvas-add-${zone}`}
                  onClick={() => {
                    if (!v.ok) return;
                    chosen.current = zone;
                    dialog.current?.close();
                  }}
                >
                  {zoneLabel(zone)}
                </button>
                {v.ok ? null : (
                  <p className="add-menu-reason" id={`canvas-add-${zone}`}>
                    {v.reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="button-quiet" onClick={() => dialog.current?.close()}>
          {say("add_menu_close")}
        </button>
      </div>
    </dialog>
  );
}
