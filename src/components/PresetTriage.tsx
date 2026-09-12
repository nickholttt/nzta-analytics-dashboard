// Every preset in the canon against what this build can serve. The point is that the gap is in front
// of you: a preset that cannot render is listed with what it is waiting on, not quietly left out.
import { useEffect, useState } from "react";
import { presetGroups } from "../lib/config";
import type { PresetStatus } from "../lib/config";
import { loadManifest } from "../lib/data";
import type { Manifest } from "../lib/data";
import { resolvePreset } from "../lib/resolve";

const ORDER: PresetStatus[] = ["invalid", "blocked", "live"];

export default function PresetTriage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadManifest().then(setManifest, (e) => setError(String(e)));
  }, []);

  if (error) return <div className="blocked">{error}</div>;
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
        <div className="warning">
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
    </>
  );
}
