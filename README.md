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
| `config/dimensions.json` | The 14 dimensions and 5 datasets the builder allows |
| `config/measures.json` | 4 core measures + 4 derived, with suppression thresholds |
| `config/presets.json` | 26 question-titled charts across 7 groups |
| `data/reference/brand_registry.csv` | Make → parent group → owner country → heritage country, with make-level limitations noted |
| `data/reference/events.csv` | 52 NZ policy/macro/OEM events, 40 source-verified |
| `data/reference/powertrain_map.csv` | NZTA motive power → canonical powertrain |
| `data/reference/segment_map.csv` | Vehicle type + body + GVM → Car / Ute / Van / Truck / Other. Coarse on purpose: SUVs are not derivable |
| `data/reference/tla_region.csv` | Territorial authority → region, with districts that straddle regions flagged |
| `data/reference/import_status_map.csv` | NZTA import status → label, and whether it counts as entry to the fleet |
| `data/reference/vehicle_scope.csv` | Which NZTA vehicle types are in scope. Guardrail rates are measured on in-scope rows |
| `data/reference/sentinels.csv` | Raw values, per field, that mean "undefined" and become `__UNDEFINED__` |
| `data/reference/model_registry.csv` | Exceptions only (renames, badge twins, match traps) |

## Known gaps

- 12 events are `verified=false` and excluded from the build. Dates need
  confirming: COVID boundaries, chip shortage window, OCR cycles, Tesla
  and MG entry dates, Honda agency start, Takata recall scope.
- `segment_map.csv` is coarse on purpose. The register records most SUVs
  as station wagons, so Car vs SUV cannot be derived and there is no SUV
  segment.
- No pipeline code, no frontend. That's the build.

## Licence

NZTA registration data is CC BY 4.0. Attribution is required in the site
footer and in every CSV export.
