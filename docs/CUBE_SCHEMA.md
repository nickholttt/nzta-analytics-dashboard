# Cube Schema

The contract between the pipeline and the site. Lock this early and test it
with a golden file. The browser reads only these artifacts.

## Why precompute

The builder is capped at 5 datasets × 12 dimensions × 4 measures. That
cross-product is small enough to compute entirely at build time, so every
user query becomes a lookup rather than a scan. This is the direct payoff
of a constrained builder: no query engine in the browser, instant response,
works on a phone, nothing to secure.

## Artifacts

```
/public/data/
  manifest.json                     # provenance + freshness
  cube/
    {dataset}/{dimension}.parquet   # the 1-D slices (60 files)
  pairs/
    {dataset}/{dim_a}__{dim_b}.parquet   # only the pairs used by filters
  presets/
    {preset_id}.json                # fully resolved, for instant first paint
  events.json                       # verified events only
  reference/
    brand_registry.json             # for the methodology panel
```

## Slice schema

| column | type | notes |
|---|---|---|
| `month` | date | first of month, snapshot-aligned |
| `dim_value` | string | the dimension value, or `__UNDEFINED__` |
| `n` | int32 | count |
| `denominator` | int32 | dataset total for that month, repeated |
| `co2_sum` | float, null | for derived means |
| `co2_n` | int32, null | coverage count |

Derive `share`, `yoy` and `rolling_12m` in the browser from `n` and
`denominator`. Do not precompute them — it triples file size and makes the
suppression thresholds impossible to change without a rebuild.

## Pair slices

Only generate `{dim_a}__{dim_b}` pairs that a preset or a plausible filter
actually needs. Generating all 66 combinations is wasteful and most are
never opened. Start with these and add on demand:

`powertrain__segment`, `powertrain__region`, `powertrain__import_status`,
`make__powertrain`, `owner_country__segment`, `built_in__make`,
`import_status__segment`

## manifest.json

```json
{
  "generated_at": "2026-09-05T04:12:00Z",
  "latest_snapshot": "2026-08-31",
  "sources": [
    { "id": "mvr_feature_service", "url": "...", "fetched_at": "...",
      "row_count": 4512338, "sha256": "...", "changed": true }
  ],
  "coverage": { "co2": 0.83, "region": 0.99, "make_mapped": 0.996 },
  "warnings": []
}
```

This drives the freshness badge and the provenance panel. It is also the
idempotency key: if every source `sha256` matches the previous run, skip
the build entirely.

## Guardrails — abort the run and keep the last good build

- Any expected column missing from the source
- Row count moves more than ±15% month on month
- Unmapped make values exceed 0.5% of rows
- A month appears with zero rows for a dataset that had rows last month
- `latest_snapshot` is older than the previous run's

Failing loudly is the point. A dashboard that quietly serves wrong numbers
is worse than one that is visibly stale.

## Size budget

Whole `/public/data` payload target: **under 8 MB**. Preset JSON under
40 KB each so the first paint needs no Parquet fetch at all.
