# NZ Vehicle Registration Analytics — starter kit

Domain research, reference data and configuration for a static analytics
site built on NZTA open data. No application code yet: this is the part
that can't be generated, and it's what Claude Code should read first.

**Start at `CLAUDE.md`.**

## What's here

| File | What it is |
|---|---|
| `CLAUDE.md` | Project brief. Design invariants, stack, build order, field traps. |
| `docs/DATA_SOURCES.md` | Endpoints, cadence, licence, and the field definitions that will mislead you |
| `docs/METRICS.md` | Exact definition of every figure the site can display |
| `docs/CUBE_SCHEMA.md` | The pipeline → browser contract, with guardrails |
| `docs/EVENTS_LAYER.md` | The annotation layer: mechanism classes, pull-forward detection |
| `docs/MODEL_AND_AGE.md` | Age-at-registration measures and derived model launch dates |
| `config/dimensions.json` | The dimensions and datasets the builder allows |
| `config/measures.json` | Core and derived measures, with suppression thresholds |
| `config/presets.json` | 26 question-titled charts across 7 groups |
| `data/reference/brand_registry.csv` | Make → parent group → owner country → heritage country, with make-level limitations noted |
| `data/reference/events.csv` | 54 NZ policy/macro/OEM events, 50 source-verified |
| `data/reference/powertrain_map.csv` | NZTA motive power → canonical powertrain |
| `data/reference/segment_map.csv` | Vehicle type + body + GVM → Car / Ute / Van / Truck / Other. Coarse on purpose: SUVs are not derivable |
| `data/reference/tla_region.csv` | Territorial authority → region, with districts that straddle regions flagged |
| `data/reference/import_status_map.csv` | NZTA import status → label, and whether it counts as entry to the fleet |
| `data/reference/vehicle_scope.csv` | Which NZTA vehicle types are in scope. Guardrail rates are measured on in-scope rows |
| `data/reference/sentinels.csv` | Raw values, per field, that mean "undefined" and become `__UNDEFINED__` |
| `data/reference/model_registry.csv` | Exceptions only (renames, badge twins, match traps) |

## Known gaps

- 4 events are `verified=false` and excluded from the build: the Honda
  and Mercedes-Benz agency starts (no source gives the start month), the
  semiconductor shortage window (no source dates its start or end), and
  the weak yen period (a currency level, better as a series than an
  event). Each row's `notes` records what was checked.
- `segment_map.csv` is coarse on purpose. The register records most SUVs
  as station wagons, so Car vs SUV cannot be derived and there is no SUV
  segment.
- No frontend yet. The pipeline covers build step 1 only.

## Running the pipeline

```
python -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
python -m pytest pipeline/tests           # golden contract, guardrails, invariant #1 scan
python -m pipeline run                    # check the source; pull and build only if it changed
python -m pipeline build data/raw/YYYY-MM/<timestamp> --dry-run   # rebuild a saved pull, publish nothing
python -m pipeline init-schema            # once, deliberately: capture pipeline/expected_schema.json
```

A run writes `public/data/` (gitignored) and, only on success, commits
`data/snapshots/YYYY-MM.parquet` and `data/state/last_good.json`. Any
failed guardrail exits non-zero and leaves both untouched.
`.github/workflows/monthly-build.yml` runs it on the 8th of each month;
`docs/DATA_SOURCES.md` explains the timing.

## Maintenance

- Ownership changes are `brand_registry.csv`'s main decay risk, and every
  `owner_country` and `parent_group` chart inherits them: Volvo moved to
  Geely, and Fuso and Hino moved to ARCHION in April 2026. `as_at` is the
  date a row's ownership was last verified; blank means not checked since
  the starter kit. Recheck the oldest and blank rows when a brand changes
  hands. Ownership is deliberately not versioned over time: the charts
  answer who owns these brands now, and say so.

## Licence

NZTA registration data is CC BY 4.0. Attribution is required in the site
footer and in every CSV export.
