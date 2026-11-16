// Every preset in the canon against what this build can serve. The point is that the gap is in front
// of you: a preset that cannot render is listed with what it is waiting on, not quietly left out.
//
// `BuildWarnings` (D-112) is here, not in a file of its own, so the status page adds no island: a third island entry made the
// public build split the preset panel's script into a 121-byte re-export and the real one, a request more for the Explore page.
import { useEffect, useState } from "react";
import { presetGroups } from "../lib/config";
import type { PresetStatus } from "../lib/config";
import { warningsMeta, warningsView } from "../lib/buildWarnings";
import type { WarningsView } from "../lib/buildWarnings";
import { loadManifest } from "../lib/data";
import type { Manifest } from "../lib/data";
import { resolvePreset } from "../lib/resolve";

const ORDER: PresetStatus[] = ["invalid", "blocked", "live"];

// The warnings the build that made this cube recorded, at the top of the status page: the pipeline's own text, as written and
// in the order it raised them. The manifest is read as the triage table reads it (one fetch, shared).
export function BuildWarnings() {
  const [view, setView] = useState<WarningsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadManifest().then((m) => setView(warningsView(m)), (e) => setError(String(e)));
  }, []);

  if (error) return <div className="callout blocked">{error}</div>;
  if (!view) return <p>Loading…</p>;

  return (
    <>
      <p className="meta">{warningsMeta(view)}</p>
      {view.warnings === null ? (
        <div className="callout warning">
          <span className="callout-label">Not recorded</span>
          This manifest has no list of warnings, so whether the build raised any is not known.
        </div>
      ) : view.warnings.length === 0 ? (
        <p>The build raised no warnings.</p>
      ) : (
        <div className="callout warning">
          <span className="callout-label">Raised by the build</span>
          <ul>
            {view.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default function PresetTriage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadManifest().then(setManifest, (e) => setError(String(e)));
  }, []);

  if (error) return <div className="callout blocked">{error}</div>;
  if (!manifest) return <p>Loading…</p>;

  const rows = presetGroups.flatMap((group) =>
    group.presets.map((preset) => ({ group, preset, resolution: resolvePreset(preset, manifest) })),
  );
  const counts = ORDER.map((s) => ({ status: s, n: rows.filter((r) => r.preset.status === s).length }));
  const disagreements = rows.filter((r) => r.resolution.statusDisagreement);

  return (
    <>
      <p className="meta">
        {rows.length} presets · {counts.map((c) => `${c.n} ${c.status}`).join(" · ")} · snapshot {manifest.latest_snapshot}
      </p>

      {disagreements.length > 0 ? (
        <div className="callout warning">
          <span className="callout-label">Status out of date</span>
          <strong>{disagreements.length} authored statuses no longer match this build.</strong>
          <ul>
            {disagreements.map((r) => (
              <li key={r.preset.id}>
                <code>{r.preset.id}</code>: {r.resolution.statusDisagreement}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="meta">Every authored status matches what this build resolves.</p>
      )}

      <div className="table-scroll" role="region" aria-label="Every preset and what it waits on" tabIndex={0}>
      <table className="triage">
        <thead>
          <tr>
            <th>Preset</th>
            <th>Status</th>
            <th>Question</th>
            <th>Waiting on</th>
          </tr>
        </thead>
        <tbody>
          {ORDER.flatMap((status) =>
            rows
              .filter((r) => r.preset.status === status)
              .map(({ group, preset, resolution }) => (
                <tr key={preset.id} className={status}>
                  <td>
                    <code>{preset.id}</code>
                    <br />
                    <span className="meta">{group.label}</span>
                  </td>
                  <td>
                    <span className={`badge ${status}`}>{status}</span>
                    {preset.type ? (
                      <>
                        <br />
                        <span className="meta">{preset.type}</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {preset.question}
                    <br />
                    <span className="meta">
                      {preset.dataset ?? "composite"} · {preset.derived ?? preset.measure ?? "—"}
                      {preset.dimension ? ` · ${preset.dimension}` : ""} · {resolution.shape}
                    </span>
                  </td>
                  <td>
                    {preset.requires?.length ? (
                      <ul>{preset.requires.map((r) => <li key={r}>{r}</li>)}</ul>
                    ) : (
                      <span className="meta">—</span>
                    )}
                  </td>
                </tr>
              )),
          )}
        </tbody>
      </table>
      </div>
    </>
  );
}
