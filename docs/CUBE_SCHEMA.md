# Cube Schema

The contract between the pipeline and the site, locked by a golden-file
test (`pipeline/tests/test_golden.py`). The browser reads only these
artifacts.

## Why precompute

The builder is bounded by config — datasets × live dimensions × measures —
and that cross-product is small enough to compute entirely at build time,
so every user query becomes a lookup rather than a scan. This is the direct
payoff of a constrained builder: no query engine in the browser, instant
response, works on a phone, nothing to secure. No count of dimensions is
fixed in this document or anywhere else; see *Live dimensions*.

## Artifacts

```
/public/data/
  manifest.json                         # provenance, freshness, live dimensions, data-quality counts
  cube/
    {dataset}/{dimension}.parquet       # 1-D slices: one file per live dimension
  events.json                           # verified events only
  pairs/
    {dataset}/{dim_a}__{dim_b}.parquet  # later build step: only pairs used by filters
  presets/
    {preset_id}.json                    # later build step: fully resolved, for first paint
  reference/
    brand_registry.json                 # later build step: for the methodology panel
```

Build step 1 emits `manifest.json`, `cube/registrations_surviving/` and
`events.json`.

Pipeline state lives outside `/public/data` and is committed to the repo:

- `data/snapshots/YYYY-MM.parquet`: a small aggregate of every snapshot,
  never raw rows. The input to true flow and cohort survival.
- `data/state/last_good.json`: the last successful run's change key, row
  counts, per-month counts, live dimensions and moving cutoff. Every
  guardrail that compares against "the previous run" reads this file.

## Live dimensions

The dimension set is whatever has complete reference data, not a fixed
list. A dimension is live for a dataset in a run when all of these hold:

1. It applies to the dataset (no `applies_to` in `dimensions.json`, or the
   dataset is listed).
2. Every reference file its `derive` block needs exists.
3. Its unmapped rate on in-scope rows is at or below `max_unmapped_rate`
   in `config/pipeline.json`.

`manifest.json` lists the live dimensions per dataset, and the site reads
that list rather than assuming any dimension exists. A dimension may go
live in any run. A dimension that was live in the last good run and fails
rule 2 or 3 aborts the run: dimensions never silently drop out.

## Slice schema

| column | type | notes |
|---|---|---|
| `month` | date | first day of the month of first NZ registration |
| `dim_value` | string | the dimension value, or a reserved token |
| `n` | int32 | count |
| `denominator` | int32 | dataset total for that month, repeated |
| `fc_sum` | double, null | sum of valid combined fuel consumption (L/100km) over fuel-eligible rows, rounded to 3 decimals; null when `fc_n` is 0 |
| `fc_n` | int32 | fuel-eligible rows with a valid fuel-consumption value |
| `fc_eligible_n` | int32 | rows whose powertrain has a combustion engine: the coverage denominator |

Rows are sorted by `month`, then `dim_value`. A month with no rows in the
dataset is absent, never a row of zeros.

Derive `share`, `yoy`, `rolling_12m`, mean fuel consumption
(`fc_sum / fc_n`) and fuel-consumption coverage (`fc_n / fc_eligible_n`)
in the browser. Do not precompute them — it triples file size and makes the
suppression thresholds impossible to change without a rebuild.

### Reserved tokens

| token | meaning |
|---|---|
| `__UNDEFINED__` | Not recorded: the source value is empty or listed in `sentinels.csv`. |
| `__UNMAPPED__` | Recorded, but no reference row matches it (a make absent from `brand_registry.csv`). |
| `__OTHER__` | Recorded and mapped, but collapsed by a cardinality cap (a model beyond the cap). |

"Not recorded" and "no brand match" are different facts and never share a
token. Banded dimensions use their own `unknown` band from
`dimensions.json` instead, and the manifest counts each cause separately.

### Fuel consumption

`FC_COMBINED` is stored as text. A row is fuel-eligible when its powertrain
has `has_combustion_engine = true` in `powertrain_map.csv`; rows without an
engine never enter the coverage denominator, so electrification cannot
suppress the series. A value is valid when it parses as a number inside the
range in `config/pipeline.json` (above 0, at most 60 L/100km). Parse
failures and out-of-range values are excluded from `fc_sum` and `fc_n` and
counted separately in the manifest, as are values found on rows with no
engine.

### Model dimension

`dim_value` is `MAKE|MODEL` after brand aliases and `model_registry.csv`
overrides. The `cap` values (config: 300) with the most in-scope volume
over the **trailing 12 months** keep their value; everything else becomes
`__OTHER__`. The manifest records the cap, its basis, and the share of
trailing and all-time volume the kept values cover.

## Pair slices

Only generate `{dim_a}__{dim_b}` pairs that a preset or a plausible filter
actually needs. Generating every combination is wasteful and most are
never opened. Start with these and add on demand:

`powertrain__segment`, `powertrain__region`, `powertrain__import_status`,
`make__powertrain`, `owner_country__segment`, `built_in__make`,
`import_status__segment`

## manifest.json

```json
{
  "contract_version": 1,
  "generated_at": "2026-09-11T04:12:00Z",
  "latest_snapshot": "2026-08-31",
  "source": {
    "id": "mvr_feature_service",
    "item_id": "7b4df667d5014f1a93e6050b31d18407",
    "discovery": "search",
    "service_name": "MVR_Mar26",
    "service_url": "https://services.arcgis.com/.../FeatureServer/0",
    "data_last_edit": "2026-09-03T00:34:54Z",
    "fetched_at": "2026-09-11T04:01:00Z",
    "row_count": 5905376,
    "rows_pulled": 5905376,
    "in_scope_row_count": 4787000,
    "change_key": { "row_count": 5905376, "snapshot": "2026-08-31", "stats_sha256": "..." },
    "changed": true
  },
  "datasets": {
    "registrations_surviving": {
      "definition": "Vehicles first registered in month M that are still registered as at the snapshot date.",
      "rows": 4503000,
      "months": 1195,
      "live_dimensions": ["powertrain", "make", "..."],
      "not_live": { "imported_from": "does not apply to this dataset" },
      "unmapped_rates": { "make": 0.0062, "powertrain": 0.0 },
      "unmapped_guard": {
        "make": {
          "whole_run": { "rows": 4616861, "unmapped": 34735, "rate": 0.007524, "abort_above": 0.02, "headroom_rows": 57602 },
          "trailing": { "window_months": 12, "rows": 234372, "unmapped": 218, "rate": 0.00093,
                        "warn_above": 0.005, "abort_above": 0.02, "headroom_rows": 4469 }
        },
        "powertrain": { "whole_run": { "...": "same shape" }, "trailing": { "...": "same shape" } }
      },
      "coverage_trailing": { "window_months": 12, "fuel_consumption": 0.91, "dimensions": { "region": 0.998 } },
      "counts": {
        "no_registration_month": 172,
        "registration_after_snapshot": 0,
        "bands": {
          "age_at_registration_band": { "source_missing": 0, "source_sentinel": 0, "negative": 3800, "out_of_bands": 0 }
        },
        "fuel_consumption": { "parse_failures": 0, "out_of_range": 83, "on_no_engine": 0 },
        "alternative_fuel_differs": 5542
      },
      "model_cap": {
        "model": { "cap": 300, "basis": "trailing_12_months", "coverage_trailing": 0.95, "coverage_all_time": 0.80 }
      }
    }
  },
  "moving_cutoff_vehicle_year": 2012,
  "moving_cutoff_age": 14,
  "used_import_age_trailing": {
    "window_months": 12, "rows": 91000, "median": 10, "mode": 11,
    "cluster": [9, 13], "share_cluster": 0.60, "shares": { "0": 0.003, "31+": 0.001 }
  },
  "snapshot_archive": { "path": "data/snapshots/2026-08.parquet", "status": "new" },
  "warnings": []
}
```

This drives the freshness badge and the provenance panel. Every count is
published even when zero: a count that disappears is itself a silent
change. In `bands`, `source_missing` counts rows whose source field is
empty, `source_sentinel` counts source values listed in `sentinels.csv`
(for vehicle year, a year of 0), `negative` counts a negative derived
value, and `out_of_bands` counts a value no band covers.

`unmapped_guard` publishes both bases of each guarded dimension's unmapped
check with its thresholds, and `headroom_rows`: how many more rows could go
unmapped before the run aborts. How close a run came is visible, not just
whether it passed.

## Source discovery, snapshot date and change key

**Discovery.** Each run searches the ArcGIS portal for the register item
(query in `config/pipeline.json`) rather than trusting a pinned id. Exactly
one match is used. If the search fails or finds nothing, the run falls back
to the configured item id, records `"discovery": "fallback"` and warns
loudly. More than one match: the most recently modified is used, with a
warning.

**Snapshot date.** There is no snapshot field. `latest_snapshot` is the
last day of the earlier of the latest first-registration month in the
table and the month before the fetch. First registrations dated after that
are counted, excluded and warned about.

**Change key.** No file exists to hash, so the key is the composite of the
total row count, the snapshot date, and the sha256 of one canonical
grouped-statistics response: row counts by first-registration year,
first-registration month, import status and vehicle type, sorted and
serialised as canonical JSON. If the key equals the last good run's key,
the build is skipped: nothing is pulled, nothing is published, the run
succeeds.

## Guardrails — abort the run and keep the last good build

The build writes to a staging directory. It replaces `/public/data` and
commits new state only after every check passes. All failing checks are
reported together.

Source and schema:

- A column in `pipeline/expected_schema.json` is missing from the service,
  or its type has changed. New columns are a warning.
- The service does not resolve to exactly one table or layer.
- Rows pulled differ from the service's row count, or an OBJECTID repeats.
- A `VEHICLE_TYPE` or `IMPORT_STATUS` value is absent from
  `vehicle_scope.csv` or `import_status_map.csv`, so scope cannot be
  decided.
- A reference file is malformed: a key defined twice, overlapping ranges,
  or a `make_promotion` to a make that is not in `brand_registry.csv`.

Volume:

- In-scope source rows differ from the last good run by more than 2%. The
  fleet grows slowly; a jump means the source changed.
- A month that had at least 1,000 rows in the last good run now has none,
  or the snapshot month itself has none. Sparse early months are exempt,
  because scrapping the last surviving vehicle legitimately empties them.

Freshness:

- `latest_snapshot` is older than the last good run's.
- `latest_snapshot` and the total row count are both unchanged but the
  change key differs.

Mapping:

- Unmapped make above 2% of in-scope rows, on either of two bases: every
  in-scope row, or in-scope rows first registered in the trailing 12
  months. Both must pass.
- Unmapped powertrain above 2% of in-scope rows, on the same two bases.
- A dimension that was live in the last good run exceeds its unmapped
  threshold or loses a reference file.

The two bases catch different failures. The whole run tolerates old makes
nobody will map: months before 1990 run 3–30% unmapped, and a per-month
guard would trip on them. But the whole run dilutes anything new: at the
2026-08 snapshot it had 57,602 rows of headroom, a quarter of a year's
registrations, so a new brand missing from `brand_registry.csv` could
reach that scale unnoticed. The trailing basis catches it.

Events:

- A verified event has a scope outside the enum in `EVENTS_LAYER.md`, a
  `scope_value` that does not resolve through the vocabulary its dimension
  produces, no `date_start`, or no `source_url`.

Failing loudly is the point. A dashboard that quietly serves wrong numbers
is worse than one that is visibly stale.

## Warnings — the build continues, recorded in `manifest.warnings`

- Unmapped make or powertrain over the trailing 12 months is above 0.5% of
  in-scope rows: notice well before the 2% abort.
- The latest month's count deviates more than 50% from the median of the
  12 months before it.
- Source discovery fell back to the pinned item id, or found more than one
  candidate.
- The source gained columns.
- Some first registrations are dated after the snapshot month. They are
  counted and excluded.
- The moving cutoff was not detected, or its vehicle year differs from the
  last good run's. Its age is snapshot year minus that vehicle year, so it
  rises every year by construction; a changed vehicle year is the signal.
- A dimension that was not live last run still exceeds its unmapped
  threshold, or lacks a reference file, and stays excluded.
- `data/snapshots/YYYY-MM.parquet` already exists with different content.
  The first observation is kept.
- The payload exceeds the size budget.
- There is no last good state (first run), so previous-run comparisons were
  skipped.

## Size budget

Whole `/public/data` payload target: **under 8 MB**. Preset JSON under
40 KB each so the first paint needs no Parquet fetch at all.
