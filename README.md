# NZ Vehicle Registration Analytics

A static analytics site built on NZTA open data: domain research,
reference data and configuration, a Python + DuckDB pipeline that builds
monthly in GitHub Actions, and a local reference UI (Astro, React,
Observable Plot). Nothing is deployed.

**Start at `AGENTS.md`, then `CLAUDE.md` (the project brief).** What is
built and what is in progress is in `docs/STATE.md`.

## What's here

| File | What it is |
|---|---|
| `AGENTS.md` | For any coding agent: how to run and test, hard rules, what needs the user's approval |
| `CLAUDE.md` | Project brief. Design invariants, stack, build order, field traps. |
| `POST_GATE.md` | Work queued until the 8 November 2026 scheduled run passes |
| `docs/STATE.md`, `docs/CHECKPOINT.md`, `docs/DECISIONS.md` | What is true now, the work queue, and why things are the way they are |
| `docs/playbooks/` | Step-by-step guides: checks, the local UI, a cube rebuild, the monthly run check, adding an event, changing a preset or reference data, and the session handoff |
| `docs/DATA_SOURCES.md` | Endpoints, cadence, licence, and the field definitions that will mislead you |
| `docs/METRICS.md` | Exact definition of every figure the site can display |
| `docs/CUBE_SCHEMA.md` | The pipeline → browser contract, with guardrails |
| `docs/EVENTS_LAYER.md` | The annotation layer: mechanism classes, pull-forward detection |
| `docs/MODEL_AND_AGE.md` | Age-at-registration measures and derived model launch dates |
| `config/dimensions.json` | The dimensions and datasets the builder allows |
| `config/measures.json` | Core and derived measures, with suppression thresholds |
| `config/presets.json` | The Explore canon: question-titled charts in three tiers, each marked live, blocked or invalid with what it requires |
| `config/pipeline.json` | Source field bindings, guardrail thresholds, events settings |
| `data/reference/brand_registry.csv` | Make → parent group → owner country → heritage country, with make-level limitations noted |
| `data/reference/events.csv` | 54 NZ policy/macro/OEM events, 50 source-verified |
| `data/reference/powertrain_map.csv` | NZTA motive power → canonical powertrain |
| `data/reference/segment_map.csv` | Vehicle type + body + GVM → Car / Ute / Van / Truck / Other. Coarse on purpose: SUVs are not derivable |
| `data/reference/tla_region.csv` | Territorial authority → region, with districts that straddle regions flagged |
| `data/reference/import_status_map.csv` | NZTA import status → label, and whether it counts as entry to the fleet |
| `data/reference/vehicle_scope.csv` | Which NZTA vehicle types are in scope. Guardrail rates are measured on in-scope rows |
| `data/reference/sentinels.csv` | Raw values, per field, that mean "undefined" and become `__UNDEFINED__` |
| `data/reference/model_registry.csv` | Exceptions only (renames, badge twins, match traps) |
| `data/reference/mild_hybrid_models.csv` | Which hybrid nameplates are mild or full, with basis and confidence |
| `pipeline/` | The pipeline: fetch, normalise, derive, metrics, guardrails, outputs, and its tests |
| `src/` | The local reference UI: pages, chart renderers, and the code that reads `public/data` |

## Known gaps

- 4 events are `verified=false` and excluded from the build: the Honda
  and Mercedes-Benz agency starts (no source gives the start month), the
  semiconductor shortage window (no source dates its start or end), and
  the weak yen period (a currency level, better as a series than an
  event). Each row's `notes` records what was checked.
- `segment_map.csv` is coarse on purpose. The register records most SUVs
  as station wagons, so Car vs SUV cannot be derived and there is no SUV
  segment.
- The pipeline covers build step 1 only (`registrations_surviving`).
- The site is a local reference UI; nothing is deployed.

## Running the pipeline

```
python -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
python -m pytest pipeline/tests           # golden contract, guardrails, invariant #1 scan
python -m pipeline run                    # check the source; pull and build only if it changed
python -m pipeline build data/raw/YYYY-MM/<timestamp> --dry-run   # rebuild a saved pull, publish nothing
python -m pipeline init-schema            # once, deliberately: capture pipeline/expected_schema.json
```

A run that builds writes `public/data/` (gitignored),
`data/state/last_good.json` and, if that month has none yet,
`data/snapshots/YYYY-MM.parquet`. Any
failed guardrail exits non-zero and leaves all three untouched.
`.github/workflows/monthly-build.yml` runs it on the 8th of each month and
commits the snapshot and state; `docs/DATA_SOURCES.md` explains the timing.
Because `run` rewrites committed files, leave it to the workflow unless
you mean to (`AGENTS.md`).

## Running the site

```
npm install
npm run dev        # http://127.0.0.1:4321/, reads public/data (see docs/playbooks/local-ui-dev.md)
```

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
