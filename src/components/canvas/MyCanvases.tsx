// My canvases: save the canvas on screen, copy its link, list the saved ones, open, rename, remove, export as links, clear. The face
// of src/lib/savedCanvases.ts over the rules of My questions (src/lib/saved.ts, D-125): nothing is sent anywhere, the list lives in this
// browser's storage, and where that is blocked the page says so and the canvas works as it does without it. A name is never in a link.
import { useEffect, useRef, useState } from "react";
import { say } from "../../lib/canvas";
import { MAX_NAME, MAX_SAVED, add, browserStorage, load, persist, remove, rename } from "../../lib/saved";
import type { Loaded, Saved } from "../../lib/saved";
import { CANVASES, canvasHref, canvasLinks, canvasQuery } from "../../lib/savedCanvases";
import { focusSoon } from "../ValuePicker";

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
const read = () => load(browserStorage(), CANVASES);

// Text put on the clipboard; false where the browser will not.
const copyText = (text: string): Promise<boolean> =>
  typeof navigator !== "undefined" && navigator.clipboard ? navigator.clipboard.writeText(text).then(() => true, () => false) : Promise.resolve(false);

// name: what the canvas on screen is called until the visitor renames its entry.
export default function MyCanvases({ name }: { name: string }) {
  const [loaded, setLoaded] = useState<Loaded>(read);
  // What the last action did, in a live region so a screen reader hears it.
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const exported = useRef<HTMLTextAreaElement>(null);

  // Another tab changing the list: read it again.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CANVASES.key || e.key === null) setLoaded(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Read the list as it is now, change it, keep it. False where the browser would not keep it.
  const change = (fn: (items: Saved[]) => Saved[]): boolean => {
    const storage = browserStorage();
    const fresh = load(storage, CANVASES);
    const next = fresh.state === "ok" ? fn(fresh.items) : fresh.items;
    if (fresh.state !== "ok" || !persist(storage, next, CANVASES)) {
      setLoaded({ state: "unavailable", items: [], unreadable: 0 });
      setStatus(say("saved_failed"));
      return false;
    }
    setLoaded({ state: "ok", items: next, unreadable: fresh.unreadable });
    return true;
  };

  const save = () => {
    const query = canvasQuery(window.location.search);
    if (query === undefined) {
      setStatus(say("saved_too_long"));
      return;
    }
    const entry: Saved = { id: newId(), name: name.slice(0, MAX_NAME), query, saved: new Date().toISOString() };
    const outcome: { added?: ReturnType<typeof add> } = {};
    if (!change((items) => (outcome.added = add(items, entry)).items)) return;
    const { result, entry: kept } = outcome.added ?? { result: "added" as const };
    if (result === "full") setStatus(say("status_saved_full", { number: MAX_SAVED }));
    else if (result === "exists") setStatus(say("status_saved_exists", { name: kept?.name ?? name }));
    else setStatus(say("status_saved", { name: kept?.name ?? name }));
  };

  const copyLink = () => copyText(window.location.href).then((ok) => setStatus(ok ? say("status_link_copied") : say("status_link_not_copied")));

  const copyList = () =>
    copyText(exported.current?.value ?? "").then((ok) => {
      if (!ok) exported.current?.select();
      setStatus(ok ? say("status_list_copied") : say("status_list_not_copied"));
    });

  const removeOne = (item: Saved) => {
    if (!change((items) => remove(items, item.id))) return;
    setStatus(say("status_saved_removed", { name: item.name }));
    focusSoon(() => heading.current);
  };

  const finishRename = (item: Saved) => {
    if (draft.trim() !== "" && change((items) => rename(items, item.id, draft))) setStatus(say("status_saved_renamed", { name: draft.trim() }));
    setEditing(null);
    focusSoon(() => document.getElementById(`canvas-rename-${item.id}`));
  };

  const clearAll = () => {
    setConfirmClear(false);
    if (!change(() => [])) return;
    setStatus(say("status_list_cleared"));
    focusSoon(() => heading.current);
  };

  const available = loaded.state === "ok";

  return (
    <section className="my-questions my-canvases" aria-labelledby="my-canvases-head">
      <h2 id="my-canvases-head" className="eyebrow" tabIndex={-1} ref={heading}>
        {say("saved_heading")}
      </h2>
      <p className="meta">{say("saved_intro")}</p>
      <p className="meta">{say("saved_browser_only")}</p>
      <div className="saved-actions">
        {available ? (
          <button type="button" className="button-quiet" onClick={save}>
            {say("saved_save")}
          </button>
        ) : null}
        <button type="button" className="button-quiet" onClick={copyLink}>
          {say("saved_copy_link")}
        </button>
      </div>
      <p className="meta saved-status" role="status">
        {status}
      </p>

      {!available ? (
        <p className="callout warning">{say("saved_unavailable")}</p>
      ) : (
        <>
          {loaded.unreadable > 0 ? <p className="callout warning">{say("saved_unreadable", { number: loaded.unreadable })}</p> : null}
          {loaded.items.length === 0 ? (
            <p className="picker-hint">{say("saved_empty")}</p>
          ) : (
            <>
              <ul className="saved-list">
                {loaded.items.map((item) => (
                  <li key={item.id} className="saved-item">
                    {editing === item.id ? (
                      <form
                        className="saved-rename"
                        onSubmit={(e) => {
                          e.preventDefault();
                          finishRename(item);
                        }}
                      >
                        <label htmlFor={`canvas-name-${item.id}`}>{say("saved_rename_label")}</label>
                        <input id={`canvas-name-${item.id}`} value={draft} maxLength={MAX_NAME} onChange={(e) => setDraft(e.target.value)} autoFocus />
                        <button type="submit" className="button-quiet">
                          {say("saved_rename_save")}
                        </button>
                        <button
                          type="button"
                          className="button-quiet"
                          onClick={() => {
                            setEditing(null);
                            focusSoon(() => document.getElementById(`canvas-rename-${item.id}`));
                          }}
                        >
                          {say("saved_rename_cancel")}
                        </button>
                      </form>
                    ) : (
                      <>
                        <a className="saved-name" href={canvasHref(item)}>
                          {item.name}
                        </a>
                        <p className="meta">{say("saved_on", { date: item.saved.slice(0, 10) })}</p>
                        <div className="saved-actions">
                          <button
                            type="button"
                            id={`canvas-rename-${item.id}`}
                            className="button-quiet"
                            aria-label={`${say("saved_rename")}: ${item.name}`}
                            onClick={() => {
                              setDraft(item.name);
                              setEditing(item.id);
                            }}
                          >
                            {say("saved_rename")}
                          </button>
                          <button type="button" className="button-quiet" aria-label={`${say("saved_remove")}: ${item.name}`} onClick={() => removeOne(item)}>
                            {say("saved_remove")}
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>

              <details className="saved-export">
                <summary>{say("saved_export")}</summary>
                <label htmlFor="saved-canvas-links">{say("saved_export_label")}</label>
                <textarea id="saved-canvas-links" ref={exported} readOnly rows={Math.min(12, loaded.items.length * 3)} value={canvasLinks(loaded.items, window.location.origin)} />
                <button type="button" className="button-quiet" onClick={copyList}>
                  {say("saved_copy_list")}
                </button>
              </details>

              {confirmClear ? (
                <div className="saved-actions" role="group" aria-label={say("saved_clear_confirm")}>
                  <span>{say("saved_clear_confirm")}</span>
                  <button type="button" className="button-quiet" onClick={clearAll}>
                    {say("saved_clear_yes")}
                  </button>
                  <button
                    type="button"
                    className="button-quiet"
                    autoFocus
                    onClick={() => {
                      setConfirmClear(false);
                      focusSoon(() => document.getElementById("canvas-clear-list"));
                    }}
                  >
                    {say("saved_clear_no")}
                  </button>
                </div>
              ) : (
                <div className="saved-actions">
                  <button type="button" id="canvas-clear-list" className="button-quiet" onClick={() => setConfirmClear(true)}>
                    {say("saved_clear")}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
