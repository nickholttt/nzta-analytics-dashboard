# Playbook: add or change a preset chart

Charts are data (invariant #2): a preset is an object in `config/presets.json` under
`groups[].presets[]`. `config/presets.json` is **allowed on `ui/explore`**, because the pipeline,
workflow and tests never read it (D-020). Check `docs/STATE.md` first: this file currently has
uncommitted changes owned by claude.

## Fields (as used by existing presets)

| Field | Meaning |
|---|---|
| `id` | stable slug |
| `question` | the chart title, as a plain question that the dataset can honestly answer |
| `status` | `live`, `blocked` or `invalid` (defined in the file's `$status` block) |
| `requires` | every outstanding deliverable, as prose; omit when `live` |
| `dataset`, `measure`, `dimension`, `period` | what to read; must exist in `config/dimensions.json` / `config/measures.json` |
| `derived` | a derived measure id that `src/lib/derived.ts` registers (instead of `measure`) |
| `shape_override` | forces one of the five shapes when inference isn't enough |
| `note_template` / `note` | a note on the chart. Any figure must come from `{dotted.path}` into the manifest, never typed in |

Shape is inferred from measure plus dimension. Never add a sixth renderer.

## Rules

- A preset that needs a **new dimension, measure or pair slice** changes `config/dimensions.json` or
  `config/measures.json`. Those are **frozen**, so the preset is `blocked` and `requires` names the
  deliverable. Don't work around it in code.
- The UI (`src/components/PresetTriage.tsx`, `src/lib/resolve.ts`) cross-checks the authored
  `status` against what the cube resolves and shows a warning when they disagree. A new preset must
  show no warning.
- No domain value in `src/`: labels, categories and thresholds come from config.

## Verify

```bash
npx -y -p typescript tsc --noEmit
npx astro build
npm run dev          # open http://127.0.0.1:4321/ and check the chart and the triage list
npx astro dev stop   # only if you started it
```

## Real example

`1d1d0ed Concentration: render top_5_share, the direct view of fragmentation` added this preset. It was
done before the freeze; today its `config/measures.json` part would be blocked:

```json
{
 "id": "concentration",
 "question": "Is the market getting more crowded?",
 "status": "live",
 "shape_override": "trend",
 "derived": "top_5_share",
 "dataset": "registrations_surviving",
 "dimension": "make",
 "period": "all",
 "note_template": "The combined share of the {measure.top_n} largest brands in each month. ..."
}
```

Files changed: `config/measures.json`, `config/presets.json`, `src/lib/derived.ts` (registers
`top_5_share`), `src/lib/resolve.ts`, `src/lib/measures.ts`, `src/lib/config.ts`,
`src/components/TrendChart.tsx`, `src/components/PresetPanel.tsx`, `src/pages/index.astro`.
