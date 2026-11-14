# NZ Vehicle Registration Analytics — Project Brief

An analytics site built on NZTA open data. Two surfaces: **Explore**
(question-titled charts, each a starting point) and **Build** (a question
builder: any measure, any values of any dimension, any filters, any period,
answered from a precomputed fact table, D-058, D-059). No hand-written
reports or commentary, and no SQL console. The only prose about the data is
generated from neutral phrase templates (invariant 8, D-062).

Audience: people who are not data analysts, answering questions like
"how has the percentage of BEVs grown since introduction" or "how has
manufacturer origin shifted over the last decade" without touching a
multi-gigabyte CSV. And people who are: analysts, the trade and informed
buyers, who today download the register, clean it, filter it and redraw
it by hand every month. Explore sets the stage for the first group. Build
is the full engine for the second, and must bend to any question the
data can honestly answer (D-062).

## The goal

Be the place people go for a reliable answer about New Zealand's vehicle
market. A visitor asks one question and gets one clear answer, the evidence
for it, and the freedom to dig further. Nothing is on the page that does
not bear on the question (D-062).

How every page reads:

1. **The answer first.** A sentence and a figure, then one chart.
2. **One question per view.**
3. **Only what bears on the question.** Events scoped to it, a few
   generated statements chosen by a published rule, a few related
   questions. The limits are config.
4. **A caveat is one line with a link**, not a paragraph.
5. **Defaults do the work.** A visitor can change every setting and needs
   to change none.
6. **Every figure is one step from its definition, its source and its
   snapshot date.**
7. **Everything can be asked; little is shown until it is asked for.**
   Every field, dataset and vehicle type the register carries becomes
   askable, subject to privacy, invariant 4 and data quality.
8. **A field is defined before it is askable.** The data map
   (`docs/DATA_MAP.md`) gives every field its meaning, its coverage, what
   it can be used for, and how it relates to other fields. Build offers
   only what the map defines.
9. **A saved question keeps itself up to date.** A link redraws on the
   newest month with no work from the visitor, or stays pinned to a
   snapshot when a figure is being quoted.

The order of work for this stage is in `docs/brief/MASTER_BRIEF.md`.

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
   exactly six renderers (see §Shapes) and no seventh is permitted without
   an explicit decision.

3. **Events are append-only data.** `data/reference/events.csv`. Adding the
   2031 policy change is a CSV row. No code, no deploy logic, no migration.

4. **Every dimension must be derivable** from NZTA source fields plus a
   reference lookup, deterministically, with no per-month human curation.
   If a dimension needs someone to hand-classify rows each month, it does
   not ship.

   A lookup keyed on canonical make and model is a reference lookup, not
   hand classification. Examples are a model-level segment and a launch
   price. Such a lookup must guard its coverage the way make does:
   - an unmatched nameplate becomes `__UNMAPPED__`;
   - the trailing-window guard warns, then aborts;
   - the dimension is live only above its coverage threshold.

   It is maintained when a new nameplate appears, never row by row
   (D-062).

5. **The pipeline fails loudly.** Schema drift, missing months, row-count
   collapse and unmapped values above a threshold all abort the run and
   leave the last good build deployed. Silent degradation is the main way
   a project like this dies.

6. **The browser never sees a vehicle row.** The stage reads files the
   pipeline precomputes: slices and a fact table of counts
   (`docs/CUBE_SCHEMA.md`). The workbench asks a hosted query service,
   which:
   - answers only with aggregates;
   - answers only for fields the data map makes public;
   - takes a structured question, never SQL, from the browser.

   If the service is down, the stage still works (D-062).

   (Planned: no service is chosen or built. Today Build reads the
   precomputed fact table in the browser, D-058.)

7. **Never present a measurement artefact as market behaviour.** Some
   events changed how the data is recorded, not what people bought. See
   the `mechanism` column in `events.csv` and the rules in
   `docs/EVENTS_LAYER.md`.

8. **Words are data, and are written once.** Every sentence about the
   data comes from a phrase template in config, filled with facts that
   generic, per-shape code computes. That covers chart takeaways,
   subtitles, story text and accessible descriptions.
   - Rendering is deterministic. No model writes text at run time, and
     the same view on the same snapshot always gives the same sentence.
   - A template names no domain value, figure or year.
   - A template says what the data shows, never why. Causal and judgement
     words are a linted list.
   - A sentence that cannot be filled, or that rests on a suppressed
     value, is dropped, not softened.

   This generalises `note_template` (`src/lib/notes.ts`). See
   `docs/NARRATIVE.md` (D-062).

   (Planned: today only `note_template` works this way. `/caveats` and
   `/method` still state figures and names by hand; they move to
   templates when the narrative engine is built, D-062.)

---

## Shapes

The only six renderers. Every preset and every builder output maps to one.
Shape is **inferred** from measure + dimension. Where more than one shape
fits the question, the visitor may switch among those that fit; they never
get a shape that does not fit, and there is no seventh. The sixth, `matrix`,
was approved by the user on 2026-11-14 (D-083); its renderer is planned.

| Shape | Renderer | Triggered by |
|---|---|---|
| `mix` | share lines / 100% stacked area | measure = `share`, dimension is categorical |
| `trend` | line, optional 12-month rolling overlay | measure = `count` or `rolling_12m`, over time |
| `league` | ranked horizontal bar + rank delta | measure = `count`/`share`, single period, high-cardinality dimension |
| `distribution` | histogram / ridgeline over time | dimension is an ordered band (age, engine size, vehicle age) |
| `geo` | choropleth by region/TA | dimension = `region` |
| `matrix` | grid: one field down the side, one across the top, a shaded count, share or average in each cell | two fields crossed, neither of them time |

Which shapes fit a question is decided by one rule table in config. It
reads each field's kind from the data map (category, ordered band, number,
time, place) and how many values it has. No field lists its own charts.
Every question fits at least one shape, and a table of the figures is
always available (D-062).

A shape's look comes from the design system, not from the renderer. A
visual variant chosen by config inside a shape (such as the ridgeline inside
`distribution`) is not a new shape. A new variant is still a decision
(D-062).

---

## Stack

- Astro + React islands, static output, deployed to Cloudflare Pages
  (planned: nothing is deployed yet; the site runs locally, D-014)
- Observable Plot for all six shapes
- TanStack Table (virtualised) for league tables (planned: not yet a
  dependency; `LeagueChart` draws a Plot bar chart over a plain,
  non-virtualised rank table; no Explore preset is a live league, and the
  Build page ranks brands over 12 months, D-045)
- Python + DuckDB for the pipeline, run in GitHub Actions: tried every day,
  building each month once (D-064)
- Static files for the stage, at no runtime cost. A hosted query service
  for the workbench (planned: not chosen or built; today everything is
  static files, D-058). The browser reads published data only through
  `src/lib/data.ts` (three Astro files also import the manifest at build
  time), which is where the service plugs in (D-062)

---

## Repo layout

```
config/
  dimensions.json     # what users can break down by, with each dimension's derive rule
  measures.json       # what users can measure
  presets.json        # the Explore canon, as data
  pipeline.json       # source field bindings, thresholds, detection rules
  narrative/          # planned (D-062): phrase templates, verb bands, banned words
data/reference/
  brand_registry.csv  # make -> parent group -> brand origin  (hand-maintained)
  powertrain_map.csv  # NZTA motive power -> canonical powertrain
  segment_map.csv     # vehicle type + body + GVM -> segment  (coarse: SUV is not derivable from register fields)
  tla_region.csv      # territorial authority -> region (straddling districts flagged)
  import_status_map.csv  # NZTA import status -> label, fleet-entry and scope flags
  vehicle_scope.csv   # which NZTA vehicle types count (in_scope)
  sentinels.csv       # raw values that mean "undefined", per field
  model_registry.csv  # EXCEPTIONS ONLY - renames, badge twins, match traps
  mild_hybrid_models.csv  # which hybrid nameplates are mild or full, with basis and confidence
  events.csv          # 54 policy/macro/OEM events for the annotation layer
  model_segment.csv   # planned (D-062): canonical make + model -> VFACTS-style segment, with basis and confidence
docs/
  DATA_SOURCES.md     # endpoints, cadence, field traps, licence
  METRICS.md          # exact measure definitions
  CUBE_SCHEMA.md      # the precomputed output contract
  EVENTS_LAYER.md     # annotation, mechanism classes, pull-forward design
  MODEL_AND_AGE.md    # age-at-registration + derived model launch dates
  NARRATIVE.md        # planned (D-062): facts, phrase sets, neutrality rules, tests
  DATA_MAP.md         # planned (D-062): every source field: meaning, coverage, uses, privacy class, relations
  brief/MASTER_BRIEF.md  # direction and order of work for the current stage
data/snapshots/        # committed: one small aggregate per snapshot, never raw rows
data/state/            # committed: last_good.json, what the next run's guardrails compare against
pipeline/
  expected_schema.json  # live field list captured once; asserted every run
  __main__.py          # python -m pipeline {init-schema | run | build}
  tests/               # golden contract, guardrails, invariant #1 scan
.github/workflows/
  monthly-build.yml    # tried daily; builds each month once; keeps each built cube as a release and the whole register in a private archive
  checks.yml           # the pipeline tests on every pull request
  deploy.yml           # builds the public site from the newest cube release and uploads it to Cloudflare Pages
.github/deploy/        # the deploy's upload tool (wrangler), pinned by its own lockfile
.claude/agents/        # Claude Code sub-agent definitions, each naming its model (D-062, D-085)
src/                   # the local reference UI: pages, renderers (components/), cube and config readers (lib/)
public/geo/            # committed: region outlines for the map (Stats NZ, CC BY 4.0), written by scripts/
scripts/               # maintainer scripts run by hand, never by the pipeline
```

---

## Build order

1. Pipeline: ingest → normalise → emit cube for **one** dataset
   (`registrations_surviving`: vehicles first registered in month M that
   are still registered at the snapshot), committing a small aggregate of
   every snapshot to `data/snapshots/`. Prove the Action runs unattended
   two months running before building any UI.
   - 1b. `registrations_flow` from the Stats NZ TPT series: true monthly
     first registrations. Never on the same chart as
     `registrations_surviving`.
2. Cube contract locked (`docs/CUBE_SCHEMA.md`), with a golden-file test.
3. Explore surface, rendering `mix` and `trend` presets only.
4. Events layer over those charts.
5. Build surface (the sentence).
6. Remaining shapes: `league`, `distribution`, `geo`.
7. Fleet (stock) dataset and cohort survival.
8. Age at registration, derived model launch dates, pipeline lag.
9. The data map: every source field defined, with its coverage, uses,
   privacy class and relations to other fields.
10. The full engine: Build over every field the map makes public, with
    saved questions that update themselves.
11. Answer pages: a page per brand, model, powertrain, segment and region,
    and a latest-month page, each built from config and generated
    statements (invariant 8).
12. What the industry expects: a model-level segment that separates SUVs
    (invariant 4), heavy vehicles and motorcycles, and registrations as
    first observed in each snapshot.
13. Only when a visitor's question needs it: launch prices and context
    series.

This is the plan's order. At the user's direction a local reference UI
was built before step 1's two unattended runs, and with more than `mix`
and `trend` (D-014); it is not deployed. The current step and what has
been built ahead of it are in `docs/STATE.md`.

---

## Three field traps that will bite you

Read `docs/DATA_SOURCES.md` and `docs/MODEL_AND_AGE.md` before writing any
transform. The short version:

1. `vehicle_year` is **not** model year, and there is no model year field
   in the register. For NZ-new vehicles first registered from 2007 it is
   the NZ registration year, so their age at registration is always 0. For
   used imports it is a year from the vehicle's life overseas. Before 2007
   it is inconsistent. Verified against the data: `docs/MODEL_AND_AGE.md` §1.
2. `ORIGINAL_COUNTRY` (country of origin) is where the vehicle was
   **manufactured**, not the brand's nationality. Label it "Built in". Brand
   nationality comes from `brand_registry.csv`.
3. `submodel` is free text. Never aggregate on it.

---

## Sub-agents (Claude Code)

- Every definition in `.claude/agents/` names its model in `model:` (an
  alias or a full model id) and, where Claude Code supports it, its
  `effort:`. A missing `model:` and `model: inherit` are not allowed, and a
  test checks this (D-062): `pipeline/tests/test_agents.py`, run on every
  pull request (D-085).
- A sub-agent spawned without a definition is given its model explicitly.
- Reviews stay independent (D-057, D-061). The reviewer gets the work and
  the spec, never the author's reasoning.

---

## Non-goals

- Hand-written commentary or reports. Statements generated under
  invariant 8 are not commentary: they say what the data shows, never why
- Matching MIA's published figures (different basis — say so, don't chase it)
- Vehicle-level lookup or VIN search. `VIN11` is kept in the private
  archive only and is never published itself; a field derived from it may
  be published once it has been checked against the data. `POSTCODE` is
  kept in the private archive only; postcode figures wait for the Stage 2
  privacy review, and then only as area totals above a minimum count.
  `CHASSIS7` and `ENGINE_NUMBER` are never pulled (D-076)
- Predicting or forecasting
- Any interpretation of *why* an inflection happened beyond placing a
  dated event marker next to it
