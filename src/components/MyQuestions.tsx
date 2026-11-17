// My questions (D-125): save the question on screen, list the saved ones, open, rename, pin, remove, export as links, clear. A thin face over
// src/lib/saved.ts: what is kept, how it is read back and what a pin says are decided there and in src/lib/pin.ts. The words are config
// (builder.keep). Nothing is sent anywhere; the list lives in this browser's storage, and where that is blocked the page says so and Build
// works as it does without it.
import { useEffect, useMemo, useRef, useState } from "react";
import keepWords from "../../config/my_questions.json";
import { readQuestion, settle } from "../lib/builder";
import type { Vocabulary } from "../lib/builder";
import type { Manifest } from "../lib/data";
import { fillNote } from "../lib/notes";
import { canPin, pinNote, servedMonth } from "../lib/pin";
import { MAX_SAVED, STORAGE_KEY, add, browserStorage, exportLinks, hrefOf, load, persist, pinEntry, questionQuery, remove, rename } from "../lib/saved";
import type { Loaded, Saved } from "../lib/saved";

const words = keepWords;
const say = (template: string, context: Record<string, unknown> = {}) => fillNote(template, context).text;
const focusSoon = (find: () => HTMLElement | null | undefined) => requestAnimationFrame(() => find()?.focus());
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

type Props = {
  all: Vocabulary;
  // The snapshot this page serves; null until its manifest has loaded.
  served: Manifest | null;
  // The question on screen, in the words the page titles it with: what a new entry is called until the visitor renames it.
  title: string;
  // The month the question on screen is pinned to, if it is.
  snapshot: string | undefined;
  // Whether the question on screen can be pinned (src/lib/pin.ts, canPin).
  pinnable: boolean;
  onPin: (month: string | undefined) => void;
};

export default function MyQuestions({ all, served, title, snapshot, pinnable, onPin }: Props) {
  const [loaded, setLoaded] = useState<Loaded>(() => load(browserStorage()));
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
      if (e.key === STORAGE_KEY || e.key === null) setLoaded(load(browserStorage()));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Read the list as it is now, change it, keep it. False where the browser would not keep it.
  const change = (fn: (items: Saved[]) => Saved[]): boolean => {
    const storage = browserStorage();
    const fresh = load(storage);
    const next = fresh.state === "ok" ? fn(fresh.items) : fresh.items;
    if (fresh.state !== "ok" || !persist(storage, next)) {
      setLoaded({ state: "unavailable", items: [], unreadable: 0 });
      setStatus(words.save_failed);
      return false;
    }
    setLoaded({ state: "ok", items: next, unreadable: fresh.unreadable });
    return true;
  };

  const save = () => {
    const query = questionQuery(window.location.search);
    if (query === undefined) return;
    const entry: Saved = { id: newId(), name: title, query, saved: new Date().toISOString() };
    const outcome: { added?: ReturnType<typeof add> } = {};
    if (!change((items) => (outcome.added = add(items, entry)).items)) return;
    const { result, entry: kept } = outcome.added ?? { result: "added" as const };
    setStatus(result === "full" ? say(words.status_full, { max: MAX_SAVED }) : say(result === "exists" ? words.status_exists : words.status_saved, { name: kept?.name ?? title }));
  };

  const pinHere = () => {
    onPin(snapshot ? undefined : served ? servedMonth(served) : undefined);
    setStatus(say(snapshot ? words.status_unpinned : words.status_pinned, { name: title }));
  };

  const pinOne = (item: Saved, pinned: boolean) => {
    if (!served) return;
    if (change((items) => pinEntry(items, item.id, pinned ? null : servedMonth(served)))) {
      setStatus(say(pinned ? words.status_unpinned : words.status_pinned, { name: item.name }));
    }
  };

  const removeOne = (item: Saved) => {
    if (!change((items) => remove(items, item.id))) return;
    setStatus(say(words.status_removed, { name: item.name }));
    focusSoon(() => heading.current);
  };

  const finishRename = (item: Saved) => {
    if (draft.trim() !== "" && change((items) => rename(items, item.id, draft))) setStatus(say(words.status_renamed, { name: draft.trim() }));
    setEditing(null);
    focusSoon(() => document.getElementById(`rename-${item.id}`));
  };

  const clearAll = () => {
    setConfirmClear(false);
    if (!change(() => [])) return;
    setStatus(words.status_cleared);
    focusSoon(() => heading.current);
  };

  const copy = () => {
    const text = exported.current?.value ?? "";
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => setStatus(words.status_copied),
        () => {
          setStatus(words.status_copy_failed);
          exported.current?.select();
        },
      );
    } else {
      setStatus(words.status_copy_failed);
      exported.current?.select();
    }
  };

  // Each entry's question as the page settles it, to say what its pin means against the snapshot served now and whether it can be pinned.
  const info = useMemo(
    () =>
      new Map(
        loaded.items.map((item) => {
          const q = settle(all, readQuestion(`?${item.query}`));
          return [item.id, { note: served ? pinNote(q, served)?.text : undefined, pinned: Boolean(q.snapshot), pinnable: served ? canPin(q, served) : false }] as const;
        }),
      ),
    [loaded.items, all, served],
  );
  const available = loaded.state === "ok";

  return (
    <section className="my-questions" aria-labelledby="my-questions-head">
      <h2 id="my-questions-head" className="eyebrow" tabIndex={-1} ref={heading}>
        {words.heading}
      </h2>
      <p className="meta">{words.intro}</p>
      <p className="meta">{words.browser_only}</p>
      <div className="saved-actions">
        {available ? (
          <button type="button" className="button-quiet" onClick={save}>
            {words.save}
          </button>
        ) : null}
        {served && (pinnable || snapshot) ? (
          <button type="button" id="pin-toggle" className="button-quiet" onClick={pinHere}>
            {snapshot ? words.unpin : say(words.pin, { date: served.latest_snapshot })}
          </button>
        ) : null}
      </div>
      {served && !pinnable && !snapshot ? <p className="meta">{words.pin_unavailable}</p> : null}
      <p className="meta saved-status" role="status">
        {status}
      </p>

      {!available ? (
        <p className="callout warning">{words.unavailable}</p>
      ) : (
        <>
          {loaded.unreadable > 0 ? <p className="callout warning">{say(words.unreadable, { count: loaded.unreadable })}</p> : null}
          {loaded.items.length === 0 ? (
            <p className="picker-hint">{words.empty}</p>
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
                        <label htmlFor={`name-${item.id}`}>{words.rename_label}</label>
                        <input id={`name-${item.id}`} value={draft} maxLength={120} onChange={(e) => setDraft(e.target.value)} autoFocus />
                        <button type="submit" className="button-quiet">
                          {words.rename_save}
                        </button>
                        <button
                          type="button"
                          className="button-quiet"
                          onClick={() => {
                            setEditing(null);
                            focusSoon(() => document.getElementById(`rename-${item.id}`));
                          }}
                        >
                          {words.rename_cancel}
                        </button>
                      </form>
                    ) : (
                      <>
                        <a className="saved-name" href={hrefOf(item)}>
                          {item.name}
                        </a>
                        <p className="meta">{say(words.saved_on, { date: item.saved.slice(0, 10) })}</p>
                        {info.get(item.id)?.note ? <p className="meta saved-pin">{info.get(item.id)?.note}</p> : null}
                        {served && !info.get(item.id)?.pinned && !info.get(item.id)?.pinnable ? <p className="meta">{words.pin_unavailable}</p> : null}
                        <div className="saved-actions">
                          <button
                            type="button"
                            id={`rename-${item.id}`}
                            className="button-quiet"
                            aria-label={`${words.rename}: ${item.name}`}
                            onClick={() => {
                              setDraft(item.name);
                              setEditing(item.id);
                            }}
                          >
                            {words.rename}
                          </button>
                          {served && (info.get(item.id)?.pinned || info.get(item.id)?.pinnable) ? (
                            <button
                              type="button"
                              className="button-quiet"
                              aria-label={`${info.get(item.id)?.pinned ? words.unpin_one : words.pin_one}: ${item.name}`}
                              onClick={() => pinOne(item, Boolean(info.get(item.id)?.pinned))}
                            >
                              {info.get(item.id)?.pinned ? words.unpin_one : words.pin_one}
                            </button>
                          ) : null}
                          <button type="button" className="button-quiet" aria-label={`${words.remove}: ${item.name}`} onClick={() => removeOne(item)}>
                            {words.remove}
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>

              <details className="saved-export">
                <summary>{words.export_summary}</summary>
                <label htmlFor="saved-links">{words.export_label}</label>
                <textarea id="saved-links" ref={exported} readOnly rows={Math.min(12, loaded.items.length * 3)} value={exportLinks(loaded.items, window.location.origin)} />
                <button type="button" className="button-quiet" onClick={copy}>
                  {words.copy}
                </button>
              </details>

              {confirmClear ? (
                <div className="saved-actions" role="group" aria-label={words.clear_confirm}>
                  <span>{words.clear_confirm}</span>
                  <button type="button" className="button-quiet" onClick={clearAll}>
                    {words.clear_yes}
                  </button>
                  <button
                    type="button"
                    className="button-quiet"
                    autoFocus
                    onClick={() => {
                      setConfirmClear(false);
                      focusSoon(() => document.getElementById("clear-list"));
                    }}
                  >
                    {words.clear_no}
                  </button>
                </div>
              ) : (
                <div className="saved-actions">
                  <button type="button" id="clear-list" className="button-quiet" onClick={() => setConfirmClear(true)}>
                    {words.clear}
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
