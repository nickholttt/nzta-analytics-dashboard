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
| `data/reference/brand_registry.csv` | 91 makes → parent group → owner country → heritage country |
| `data/reference/events.csv` | 52 NZ policy/macro/OEM events, 40 source-verified |
| `data/reference/powertrain_map.csv` | NZTA motive power → canonical powertrain |
| `data/reference/segment_map.csv` | Coarse segment seed — **validate before trusting** |
| `data/reference/model_registry.csv` | Exceptions only (renames, badge twins, match traps) |

## Known gaps

- 12 events are `verified=false` and excluded from the build. Dates need
  confirming: COVID boundaries, chip shortage window, OCR cycles, Tesla
  and MG entry dates, Honda agency start, Takata recall scope.
- `segment_map.csv` is deliberately coarse. NZTA codes some SUV bodies as
  utility, so it will misclassify until validated against real data.
- No pipeline code, no frontend. That's the build.

## Licence

NZTA registration data is CC BY 4.0. Attribution is required in the site
footer and in every CSV export.
