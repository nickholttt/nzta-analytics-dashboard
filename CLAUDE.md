# NZ Vehicle Registration Analytics — Project Brief

A static analytics site built on NZTA open data. Two surfaces: **Explore**
(a fixed canon of question-titled charts) and **Build** (a constrained
sentence-builder). No reports, no commentary, no SQL console.

Audience: people who are not data analysts, answering questions like
"how has the percentage of BEVs grown since introduction" or "how has
manufacturer origin shifted over the last decade" without touching a
multi-gigabyte CSV.

---

## Design invariants

These exist so the platform is still correct and useful in 10 years.
Violating any of them is a bug, not a shortcut.

1. **Nothing domain-specific is hardcoded in code.** No powertrain, brand,
   country, policy, segment or event name appears in a `.ts`/`.tsx`/`.py`
   file. All of it lives in `data/reference/*.csv`. "BEV" is a value, not
   a concept the code knows about. When hydrogen or something unnamed
   becomes 20% of the market, that is a one-row CSV edit.

2. **Charts are data, not components.** A preset chart is a JSON object in
   `config/presets.json`. Adding a chart = adding an object. There are
   exactly five renderers (see §Shapes) and no sixth is permitted without
   an explicit decision.

3. **Events are append-only data.** `data/reference/events.csv`. Adding the
   2031 policy change is a CSV row. No code, no deploy logic, no migration.

4. **Every dimension must be derivable** from NZTA source fields plus a
   reference lookup, deterministically, with no per-month human curation.
   If a dimension needs someone to hand-classify rows each month, it does
   not ship.

5. **The pipeline fails loudly.** Schema drift, missing months, row-count
   collapse and unmapped values above a threshold all abort the run and
   leave the last good build deployed. Silent degradation is the main way
   a project like this dies.

6. **Precompute everything.** The browser never scans raw data. See
   `docs/CUBE_SCHEMA.md`.

7. **Never present a measurement artefact as market behaviour.** Some
   events changed how the data is recorded, not what people bought. See
   the `mechanism` column in `events.csv` and the rules in
   `docs/EVENTS_LAYER.md`.

---

## Shapes

The only five renderers. Every preset and every builder output maps to one.
Shape is **inferred** from measure + dimension. The user never picks a
chart type.

| Shape | Renderer | Triggered by |
|---|---|---|
| `mix` | share lines / 100% stacked area | measure = `share`, dimension is categorical |
| `trend` | line, optional 12-month rolling overlay | measure = `count` or `rolling_12m`, over time |
| `league` | ranked horizontal bar + rank delta | measure = `count`/`share`, single period, high-cardinality dimension |
| `distribution` | histogram / ridgeline over time | dimension is an ordered band (age, engine size, CO2) |
| `geo` | choropleth by region/TA | dimension = `region` |

---

## Stack

- Astro + React islands, static output, deployed to Cloudflare Pages
- Observable Plot for all five shapes
- TanStack Table (virtualised) for league tables
- Python + DuckDB for the pipeline, run in GitHub Actions on a monthly cron
- No database, no API server, no runtime cost

---

## Repo layout

```
config/
  dimensions.json     # what users can break down by
  measures.json       # what users can measure
  presets.json        # the Explore canon, as data
data/reference/
  brand_registry.csv  # make -> parent group -> brand origin  (hand-maintained)
  powertrain_map.csv  # NZTA motive power -> canonical powertrain
  segment_map.csv     # vehicle type + body + GVM -> segment  (coarse: SUV is not derivable)
  tla_region.csv      # territorial authority -> region (straddling districts flagged)
  import_status_map.csv  # NZTA import status -> label, fleet-entry and scope flags
  vehicle_scope.csv   # which NZTA vehicle types count (in_scope)
  sentinels.csv       # raw values that mean "undefined", per field
  model_registry.csv  # EXCEPTIONS ONLY - renames, badge twins, match traps
  events.csv          # 52 policy/macro/OEM events for the annotation layer
docs/
  DATA_SOURCES.md     # endpoints, cadence, field traps, licence
  METRICS.md          # exact measure definitions
  CUBE_SCHEMA.md      # the precomputed output contract
  EVENTS_LAYER.md     # annotation, mechanism classes, pull-forward design
  MODEL_AND_AGE.md    # age-at-registration + derived model launch dates
pipeline/
  (to build)
```

---

## Build order

1. Pipeline: ingest → normalise → emit cube for **one** dataset
   (`first_registrations`). Prove the Action runs unattended two months
   running before building any UI.
2. Cube contract locked (`docs/CUBE_SCHEMA.md`), with a golden-file test.
3. Explore surface, rendering `mix` and `trend` presets only.
4. Events layer over those charts.
5. Build surface (the sentence).
6. Remaining shapes: `league`, `distribution`, `geo`.
7. Fleet (stock) dataset and cohort survival.
8. Age at registration, derived model launch dates, pipeline lag.

---

## Three field traps that will bite you

Read `docs/DATA_SOURCES.md` and `docs/MODEL_AND_AGE.md` before writing any
transform. The short version:

1. `vehicle_year` is **not** model year, and there is no model year field
   in the register. For NZ-new vehicles first registered from 2007 it is
   the NZ registration year, so their age at registration is always 0. For
   used imports it is a year from the vehicle's life overseas. Before 2007
   it is inconsistent. Verified against the data: `docs/MODEL_AND_AGE.md` §1.
2. `country_of_origin` is where the vehicle was **manufactured**, not the
   brand's nationality. Label it "Built in". Brand nationality comes from
   `brand_registry.csv`.
3. `submodel` is free text. Never aggregate on it.

## Non-goals

- Written monthly commentary or reports
- Matching MIA's published figures (different basis — say so, don't chase it)
- Vehicle-level lookup or VIN search
- Predicting or forecasting
- Any interpretation of *why* an inflection happened beyond placing a
  dated event marker next to it
