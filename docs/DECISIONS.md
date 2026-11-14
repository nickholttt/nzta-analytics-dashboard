# Decisions

Append-only. Never edit or delete an entry. If a decision changes, add a new entry that supersedes
the old one and names it by number.

Every entry states its **basis**:

- **commit**: taken from that commit's message and the files it changed, read on 2026-09-13.
- **doc**: taken from the named file in this repo.
- **user (Claude memory)**: the user said it to Claude in an earlier session. It was recorded only in
  Claude's private memory and appears in the repo for the first time here. Treat it as true, but
  confirm with the user before relying on it for something irreversible.
- **inferred — confirm**: reconstructed from a commit subject alone, with no stated rationale.

New entries use this template:

```
## D-NNN YYYY-MM-DD — <decision in one line>
- Agent: claude | gemini | user
- Basis: ...
- Context: ...
- Decision: ...
- Consequences: ...
```

---

## D-001 2026-09-11 — The starter kit is the specification
- Agent: user
- Basis: commit 33e92c6; doc CLAUDE.md, README.md
- Decision: CLAUDE.md's seven design invariants, the five shapes, the stack and the build order govern
  the project. Domain knowledge lives in `data/reference/*.csv` and `config/*.json`, never in code.
- Consequences: `pipeline/tests/test_invariants.py` scans `pipeline/*.py` for hardcoded domain values.

## D-002 2026-09-11 — LF line endings everywhere; parquet is binary
- Agent: claude
- Basis: commit 9e57a61
- Context: the pipeline and golden-file tests run on Linux. A Windows checkout with autocrlf could make
  a golden file differ from what CI sees.
- Decision: `.gitattributes` sets `* text=auto eol=lf` and `*.parquet binary`.

## D-003 2026-09-11 — Reference maps keyed on NZTA's actual spellings; no SUV segment
- Agent: claude
- Basis: commits 77ad55f, 1d6bd2d
- Context: the seed maps matched no rows. SUVs are recorded as station wagons, HEIGHT is 0 on passenger
  rows, and CLASS MC was tested as a proxy and rejected.
- Decision: `segment_map.csv` is coarse (Car / Ute / Van / Truck / Other) and has no SUV segment.

## D-004 2026-09-11 — The snapshot measures survivors, so it is named registrations_surviving
- Agent: claude
- Basis: commit 22eca15
- Context: the register holds only vehicles still registered, so grouping it by first-registration
  month counts survivors, not registrations.
- Decision: `first_registrations` is renamed `registrations_surviving`. `registrations_flow` (Stats NZ
  TPT) is added as build step 1b. `volume-trend` moves to `registrations_flow`, because a survivors
  count shrinks the past.

## D-005 2026-09-11 — Age measures scoped to used imports
- Agent: claude
- Basis: commit 8d106be
- Context: NZ-new age at registration is 0 by construction from 2007.
- Decision: `genuinely_new_share` and `freshness` are deleted, and `median_import_age` applies to
  `used_imports` only.

## D-006 2026-09-11 — Pipeline design: Python + DuckDB, staged, publish only if every guardrail passes
- Agent: claude
- Basis: commits 6298234, 6010b05
- Decision: `python -m pipeline {init-schema | run | build}`. The pull is paged by OBJECTID ranges and
  ingested one page at a time into a disk-backed DuckDB. Everything is written to `data/staging/`
  first; `public/data`, the snapshot archive and `data/state` are written only when every guardrail
  passes. `pipeline/expected_schema.json` is captured once and asserted on every run.
- Consequences: the cube contract in `docs/CUBE_SCHEMA.md` is locked by
  `pipeline/tests/test_golden.py`.

## D-007 2026-09-11 — Monthly GitHub Actions run on the 8th, committing snapshot and state
- Agent: claude
- Basis: commits 8435869, 97e6297, 5599d3e; doc `.github/workflows/monthly-build.yml`
- Context: NZTA last edited the 2026-08 snapshot on 3 September. The 8th leaves a margin, and a later
  refresh makes a run skip rather than fail.
- Decision: cron `17 6 8 * *`. The run skips when the change key is unchanged. On a build it commits
  `data/snapshots/` and `data/state/` as github-actions[bot] with `[skip ci]`. Peak memory is
  recorded on every run.

## D-008 2026-09-11 — Trailing-12-month unmapped guards for make and powertrain
- Agent: claude
- Basis: inferred — confirm (commit 0093e69 subject only; rationale not read)
- Decision: make and powertrain carry an unmapped-rate guard over the trailing 12 months as well as
  the all-time guard.

## D-009 2026-09-11 — Brand promotions: recording artefacts in every year, genuine splits from the split year
- Agent: claude, approved by user
- Basis: commits 3628f76, 9e4c9e9, efbe4ef, 40932ba; approval from user (Claude memory)
- Decision: MINI, LEXUS, INFINITI, ABARTH and JEEP (under CHRYSLER) are promoted in every vehicle
  year. Genuine brand splits apply only from the split year: RAM >= 2011, FUSO >= 2003, UD >= 2010,
  ALPINE >= 2017, GENESIS >= 2017 (used imports only). `model_registry.csv` holds exceptions only.

## D-010 2026-09-12 — Mild hybrids identified by nameplate in their own reference file
- Agent: claude
- Basis: commits 3d730f7, 8bf272c, 28bbd60
- Context: NZTA's hybrid codes don't say mild or full, and three model_registry rules had caught about
  a third of mild hybrids while the category looked complete.
- Decision: `mild_hybrid_models.csv` classifies nameplates as mild, full or unresolved, with a basis
  and a confidence. Identification coverage is published at stated and high-confidence-only levels,
  with a warning below 70% trailing. Subaru e-Boxer stays unresolved.

## D-011 2026-09-12 — Brand ownership is "as at today", not versioned; as_at records verification
- Agent: claude
- Basis: commits 5258d20, c5623ba; doc README.md §Maintenance
- Decision: FUSO and HINO belong to ARCHION from 1 April 2026. Ownership is not versioned over time,
  and the `as_at` column records when a row was last checked (a blank means never checked). A
  non-ISO `as_at` aborts the build.

## D-012 2026-09-12 — GitHub Actions moved to Node 24 versions
- Agent: claude
- Basis: commit 6805cf3; comment in `.github/workflows/monthly-build.yml`
- Context: GitHub removes Node 20 from its runners on 23 September 2026.

## D-013 2026-09-12 — Freeze until the unattended-run gate; deferred work lives in POST_GATE.md
- Agent: user
- Basis: commit 006fb8d; doc POST_GATE.md; freeze extent from user (Claude memory)
- Decision: the gate is the scheduled runs on 8 October and 8 November 2026 completing clean and
  unattended. Until both pass, pipeline code, the workflow, the cube schema, tests and reference data
  are frozen. Work that touches them is logged in `POST_GATE.md` (Part A cube changes, then the Part
  B build fixes).

## D-014 2026-09-12 — A local reference UI before the gate
- Agent: claude, at the user's direction
- Basis: commit d788e41; direction from user (Claude memory)
- Decision: Astro + React islands + Observable Plot at the repo root, dev server only (no deploy),
  reading `public/data`. Three renderers (mix, trend, distribution) are chosen by the shape inferred
  from measure and dimension.
- Consequences: this runs ahead of CLAUDE.md's build order, which says to prove two unattended runs
  before building any UI and to render only mix and trend at step 3. See the contradictions listed
  under Blocked in `docs/STATE.md`.

## D-015 2026-09-12 — The share measure has two suppression guards
- Agent: claude
- Basis: commit 2fae3f1; doc docs/METRICS.md §Two suppression guards
- Context: in April 2020 Hyundai Motor Group showed 16.9% on a denominator of 1,542. It cleared the
  200-vehicle floor, but the month was unrepresentative (lockdown), not imprecise.
- Decision: `min_denominator` 200 (precision) and `min_share_of_trailing_median` 0.33
  (representativeness). A month trips on either. The argument lives in METRICS.md so nobody removes
  the second guard as redundant.

## D-016 2026-09-12 — Every preset carries status and requires; the UI cross-checks them
- Agent: claude
- Basis: commit dff061f; doc `config/presets.json` `$status`
- Decision: status is `live`, `blocked` or `invalid`, and `requires` names every outstanding
  deliverable. The UI shows a disagreement between authored status and what the cube resolves as a
  warning. When a dataset lands, re-run the triage before building the chart.

## D-017 2026-09-12 — Mix-chart defaults are driven by config
- Agent: claude
- Basis: commit f4256fa
- Decision: top-N ranked over the trailing window. Trailing (rolling) share is the default, with
  monthly as a toggle. The default start is the first sustained multi-category month (thresholds in
  `presets.json` `mix_default_start`). Event markers go in lanes.

## D-018 2026-09-12 — Derived measures render through the existing five shapes via a registry
- Agent: claude
- Basis: commit 1d1d0ed
- Decision: derived series are registered by measure id in `src/lib/derived.ts`, and
  `src/lib/resolve.ts` reads that registry, so a derived measure without a renderer reports as blocked.
  `top_5_share` (the concentration chart) was the first. No sixth renderer.

## D-019 2026-09-12 — POST_GATE Part A ordering
- Agent: user
- Basis: commit 5da1acf; doc POST_GATE.md (working tree, uncommitted as of 2026-09-13)
- Decision: A1 pair slice `import_status` x `age_at_registration_band` first after 8 November. The
  uncommitted working tree inserts A2 (step 1b `registrations_flow`, the unlock for cohort survival)
  and moves the `segment_group` promotion to A3.

## D-020 2026-09-13 — UI work continues on ui/explore with a hard boundary; canon cut from 26 to 9
- Agent: user
- Basis: user (Claude memory). Not yet reflected in `config/presets.json`, which still holds 26 presets.
- Decision: branch `ui/explore`. Out of bounds on it: `pipeline/`, `.github/workflows/`,
  `config/dimensions.json`, `config/measures.json`, `data/reference/*`, `public/data` contents.
  `config/presets.json` is in bounds (the pipeline, workflow and tests never read it). Planned canon:
  Tier 1 brand-owner-origin, powertrain-mix, new-vs-used, used-import-age; Tier 2 brand-share merged
  with parent-group-share, concentration, segment-mix; Tier 3 age-distribution-moving-hole,
  cohort-survival. Cut: engine-size, regional-volume, regional-age, regional-powertrain, model-league,
  shaken-clock, pipeline-lag.
- Note: `shaken-clock` is not an id in the current `presets.json`. Confirm what it refers to.

## D-021 2026-09-13 — Design system: Source Serif 4 + IBM Plex Sans, 8-colour line palette
- Agent: claude, at the user's direction
- Basis: user (Claude memory); uncommitted working tree (`src/lib/theme.ts`, `src/styles/site.css`,
  `package.json`)
- Decision: questions are set in Source Serif 4 and everything else in IBM Plex Sans (via
  `@fontsource-variable`). Paper `#f8f7f3`. Eight line colours; series past eight are grey context
  lines. The first `colour_slots_by_trailing` (5) slots go by trailing share, the rest by peak share.
- Status: shown for review, not approved or committed as of 2026-09-13.

## D-022 2026-09-13 — GitHub API access through the gh CLI only
- Agent: user
- Basis: user (Claude memory)
- Decision: use `gh` (`C:\Program Files\GitHub CLI\gh.exe`, not on the Git Bash PATH) for runs, logs
  and dispatch. Never extract or use the Git Credential Manager token. Confirm before pushing to main
  during the freeze.

## D-023 2026-09-13 — Shared agent protocol for Claude Code and Gemini
- Agent: claude, at the user's direction
- Basis: this commit
- Decision: `AGENTS.md`, `docs/STATE.md`, this file and `docs/playbooks/` are the shared context. The
  global protocol lives between `BEGIN/END SHARED AGENT PROTOCOL` markers in `~/.claude/CLAUDE.md` and
  `~/.gemini/GEMINI.md`. `.claude/skills/*` are thin wrappers over the playbooks.

## D-024 2026-09-13 — Reasons for the canon cut in D-020
- Agent: user
- Basis: user (Claude memory)
- Decision: the presets D-020 cuts, and why:
  - `engine-size`: cut (no reason recorded beyond the cut).
  - `regional-volume`, `regional-age`, `regional-powertrain`: the TLA is the owner's current address,
    not where the vehicle was registered.
  - `model-league`: survivors data with 68% all-time model coverage. It comes back with step 1b
    (`registrations_flow`).
  - `shaken-clock`: its prediction was wrong; fold what remains into `used-import-age`.
  - `pipeline-lag`: fragile.
- Also in D-020: `brand-share` and `parent-group-share` merge behind a granularity toggle, and
  `segment-mix` is retitled honestly, because SUV is not answerable (D-003).

## D-025 2026-09-13 — UI work on ui/explore handed to Gemini
- Agent: user
- Basis: user instruction in the Claude session of 2026-09-13
- Decision: the user continues the UI steps (docs/STATE.md, Next up) with Gemini, starting from
  Claude's uncommitted design step. Claude does not edit those files unless handed them back.

## D-026 2026-10-19 — Adopt docs/CHECKPOINT.md; keep decisions in this one file
- Agent: claude
- Basis: global protocol `~/.claude/CLAUDE.md`, version 2026-10-12
- Context: the global protocol was revised on 2026-10-12. It adds `docs/CHECKPOINT.md` (the
  handoff and the only home of the work queue), makes `docs/STATE.md` a snapshot under 150 lines,
  and expects one decision record per file under `docs/decisions/`.
- Options considered: (1) adopt all three, migrating D-001..D-025 into `docs/decisions/`;
  (2) adopt CHECKPOINT.md and the STATE.md shape, keep this single append-only file;
  (3) change nothing. (1) rewrites 25 records whose bases cite this file, and the protocol lets a
  repo relax a global rule. (3) leaves the repo out of step with the protocol both agents now read.
- Decision: (2). New records keep this file's template. STATE.md was rewritten as a snapshot; its
  "Next up" moved to CHECKPOINT.md.
- Consequences: Gemini should read CHECKPOINT.md for the queue. Moving to `docs/decisions/` later
  is a mechanical split.
- Status: decided by Claude (unreviewed)

## D-027 2026-10-19 — UI work on ui/explore returns to Claude; agents may push their own branches
- Agent: user
- Basis: user instruction in the Claude session of 2026-10-19
- Decision: supersedes D-025. Claude now owns the UI files on `ui/explore`, starting with the
  review findings in `docs/STATE.md`. Agents may push `claude/*` / `gemini/*` branches and open
  pull requests (AGENTS.md hard rule 7). Gemini's extras (inspector, market drilldown, complexity
  benchmark) are kept as a clearly labelled sense-check area, or, where Claude judges a part of
  no value, documented and deleted.

## D-028 2026-10-19 — Gemini's extras become one internal /sense-check page; the international benchmark is deleted
- Agent: claude, under D-027
- Basis: this commit; files read at `057aa01`
- Context: `/inspector` held three extras: a body-type inspector (`DataInspector.tsx`), a market
  drilldown with eight tabs (`MarketDrilldown.tsx`) and an international complexity benchmark
  (`ComplexityBenchmark.tsx`). Their data (`src/data/inspector_data.json`,
  `market_intelligence.json`, `country_silhouettes.json`) was extracted from the register by hand
  on 2026-09-13 and the queries were not saved. The code hardcoded makes, models and powertrains
  (invariant #1), carried written takeaways (a non-goal), and the main charts linked into it.
- Options considered: (1) keep all of it as it was, behind a label: leaves invariant #1 broken in
  code and the commentary in place. (2) Keep the NZ figures as plain tables on one internal page,
  with every name in a data file, and delete what can't be checked. (3) Delete everything: loses
  figures that do help check the charts (body type by model, concentration by year).
- Decision: (2).
  - `/sense-check` (`src/pages/sense-check.astro`) renders 14 tables from `src/data/sense_check.json`.
    It is `noindex`, out of the main navigation, linked only from the footer and from caveat 7, and
    headed with what the data is and isn't. The page names no domain value in code.
  - The NZ figures were copied unchanged into that file (only `MAKE|MODEL` keys are shown as
    `MAKE MODEL`), with a definition for each table that says
    what was checked against the cube on 2026-10-19: powertrain December 2023 and January 2024
    within 0.5%; ute yearly totals within 3% of the Ute segment across all import statuses (the
    inspector had labelled them "new utes", which was wrong); China-owned market total and NZ-new
    make counts for 2025 within 0.1%. MAZDA BT-50 is 0 in every year, which suggests a missed model
    match.
  - Hand classifications (market segment, SUV yes/no, origin of new makes) are kept but labelled.
  - Links from `MixChart`, `LeagueChart`, the Explore page and caveat 7 into `/inspector` are gone.
- Deleted, and what it held (recover any of it with `git show 057aa01:<path>`):
  - **The international complexity benchmark** (`src/components/ComplexityBenchmark.tsx`, 1,197
    lines; `src/data/country_silhouettes.json`; the `benchmark_*`, `international_benchmark` and
    `active_brands_by_country` keys of `market_intelligence.json`). For the USA, China, Japan,
    Australia and NZ, each year 2015–2025: new-vehicle volume, number of active brands, units per
    brand, brands per million people, with a year slider and a log-scale chart. 2025 values as
    stored: USA 16.1M / 38 brands, China 32.1M / 160, Japan 4.5M / 50, Australia 1.2M / 76, NZ
    134K / 82 (NZ-new). Sources were named (BEA and NADA; CAAM and CPCA; JADA and Zenkeijikyo;
    FCAI / VFACTS; NZTA) but no retrieval was recorded. Also brand rosters per country (38, 80 of
    160, 50, 76, 82 makes), country silhouettes, a "dealership viability simulator" (cars per week
    across an eight-dealer network, with a verdict) and four paragraphs on why NZ is fragmented
    (1998 tariff removal, right-hand drive, the Clean Car Discount, multi-franchise dealer groups).
    Deleted because only the NZ figures can be checked against this project's data, the rest
    can't be traced, and the simulator and explanations are commentary. The NZ part (make counts,
    concentration, volume bands, new makes) is kept as tables.
  - The drilldown's and inspector's written takeaways ("Toyota's paradox", "Coalface Truth", the
    Ranger-vs-Hilux claim), its Observable Plot charts (the tables carry the same figures), and a
    "platform roadmap" proposing `model_segments.csv`, which is not in `POST_GATE.md`.
  - Smaller pieces not carried into the tables: the inspector's separate `ute_rivalry` extract
    (Ranger and Hilux by year, with figures that differ from `ute_timeline`, e.g. 2015 Ranger 6,122
    against 6,420, so it probably counted a different scope; not checked), each make's
    `total_all` / `total_recent` and each segment's `total`, and the volume bands' names and
    descriptions.
- Consequences: these tables can't be refreshed. If one is needed for real, rebuild it as a
  pipeline output and a preset. Whether `/sense-check` ships when the site is deployed is open.
- Status: decided by Claude (unreviewed)

## D-029 2026-10-19 — model-leaderboard waits on step 1b again; the league renderer stays
- Agent: claude, under D-027
- Basis: this commit; D-024; `config/presets.json`, `src/lib/resolve.ts`, `docs/DATA_SOURCES.md` §C
  read on 2026-10-19
- Context: D-024 cut `model-league` until step 1b (`registrations_flow`), because survivors data
  names only the top 300 models and covers about 68% of all-time volume. On `ui/explore` Gemini
  brought it back as `model-leaderboard`, live on `registrations_surviving` over the latest year,
  drawn by a new `LeagueChart`. League is build-order step 6, ahead of the current step.
- Options considered: (1) leave it live: overrides a user decision. (2) Mark it `blocked` but keep
  `registrations_surviving`: the resolver finds the dataset and dimension live, so the panel would
  show "Status out of date" for good. (3) Point it at `registrations_flow` and mark it `blocked`:
  the resolver agrees, and the panel says what it waits on. (4) Delete the preset and `LeagueChart`:
  loses a correctly specified question and a renderer for one of the five allowed shapes.
- Decision: (3). `requires` names step 1b and a model breakdown in it. `LeagueChart` and the
  `league` entry in the resolver's rendered shapes stay, with no live preset using them: D-024 cut
  the chart for its data, not its shape.
- Consequences: the TPT series is described as counts "by type" (`docs/DATA_SOURCES.md` §C), so it
  probably has no model breakdown (inferred — confirm when step 1b is built). If so, this preset
  needs rewriting rather than unblocking, as `presets.json` `$status.on_unblocking` already says.
  Keeping an unused renderer runs ahead of the build order; it is Gemini's existing code, not new
  work.
- Status: decided by Claude (unreviewed)

## D-030 2026-10-19 — Caveats 1 and 7 say only what the data shows
- Agent: claude, under D-027
- Basis: this commit; the raw pull `data/raw/2026-08/20260911T093818Z` (snapshot 2026-08-31) read
  on 2026-10-19; `docs/METRICS.md` §Grain; `docs/DATA_SOURCES.md` §E; `data/reference/events.csv`
- Context: caveat 1 said the platform measures "first registrations recorded by NZTA"; the charts
  count survivors (D-004). Caveat 7 cited "statutory Land Transport rules" defining a station wagon
  by its shape, and an MIA figure of "over 50%" SUVs, and neither was checked. Caveat 1 also said MIA
  counts "dealer delivery handovers" and that dealers "frequently" pre-register to hit targets.
- Options considered: (1) look up the Land Transport rule and an MIA release to source the claims:
  needs outside sources the site doesn't otherwise depend on, and the point of the caveat holds
  without them. (2) Keep only what the register and the repo's docs show. (3) Leave the wording
  and mark it unchecked: leaves a wrong definition on the page.
- Decision: (2).
  - Caveat 1 uses the METRICS.md survivors definition and points to caveat 2. Pre-registration is
    put as something that can happen, with the end of the Clean Car Discount (31 December 2023,
    `events.csv`) as the example. MIA is described as DATA_SOURCES §E does: it counts vehicles
    delivered to buyers, so the figures won't match and aren't adjusted to.
  - Caveat 7 states what was counted in the raw pull: 5,905,376 rows, 27 body types, none SUV;
    station wagon shares 98.9% (RAV4), 98.2% (CX-5), 99.7% (Outlander). "Mostly", not "almost
    always": of the nine models the sense-check extract classed as SUVs, the LandCruiser is 84.2%
    and the CR-V 78.3% station wagon. The statutory-rule and MIA-share claims are gone.
- Consequences: caveat 7's figures are as at the 2026-08 snapshot and won't update themselves; they
  are dated on the page. The branch is stacked on `claude/model-leaderboard` because PR 2 also
  edits `caveats.astro`.
- Status: decided by Claude (unreviewed)

## D-031 2026-10-19 — /method restates METRICS.md in plain words, with its thresholds read from config
- Agent: claude, under D-027
- Basis: this commit; `docs/METRICS.md`; `config/measures.json`, `config/presets.json` (`defaults`),
  `config/pipeline.json` (`hybrid_classification`); `data/reference/vehicle_scope.csv`,
  `import_status_map.csv`, `powertrain_map.csv`; `src/lib/measures.ts`, `src/components/MixChart.tsx`,
  `TrendChart.tsx`, `PresetPanel.tsx`; the local cube `public/data` (snapshot 2026-08-31), queried on
  2026-10-19.
- Context: `src/pages/method.astro` was written by Gemini on `ui/explore` and differed from METRICS.md
  and the code. It said shares "hold up" under scrappage (unchecked, STATE known issue 1); described
  the April 2020 vehicles as "essential commercial utilities, refrigerated transport, and emergency
  services" (not in the data); called the 16.9% reading "precise to within 11 standard errors" (METRICS
  says eleven standard errors *above normal*); gave a coverage figure as "currently" true; said
  out-of-scope rows are kept in "raw" snapshots (they are kept in the snapshot aggregates); said
  re-registrations are "mostly lapsed trailers"; left out change on a year ago; and described flow and
  stock as if charts used them.
- Options considered: (1) render METRICS.md itself as the page: one source, but it is written for
  developers ("enforce in the formatter", "anyone tempted to collapse them"). (2) Hand-written plain
  copy, checked against METRICS.md, with every threshold read from config at build time so the numbers
  cannot drift. (3) Patch only the wrong sentences: leaves the hardcoded thresholds to drift again.
- Decision: (2).
  - Figures in the April 2020 case study were re-measured from the cube and dated to the 2026-08
    snapshot: 1,542 against a median of 22,108; Hyundai Motor Group 261 (16.9%) against 5.9% over the
    12 months before; NZ New 63.6% against 54.3%, trucks 6.8% against 2.5%, vans 6.2% against 4.5%.
    The baselines are the 12 months before, the guard's own window, not METRICS.md's "months either
    side".
  - The survivors entry states what scrappage can do to an older share (lower it, if a group is
    scrapped faster) without claiming it does or does not. Whether it does is STATE known issue 1.
  - The measures table adds the two figures the mix charts show (12-month share, change on the
    12 months before), defined as `measures.ts` computes them, and the guards' scope as the code
    applies it (precision floor on the window's total; representativeness guard on monthly shares only).
  - After an independent review: the top-5 line divides by every vehicle, unmatched makes included
    (`src/lib/derived.ts`), and unmatched makes are 21.6% of vehicles in the 1950s, 20.9% in the 1960s,
    13.6% in the 1970s and 5.2% in the 1980s (cube, 2026-08), so the page warns that this holds the
    early line down. The mild hybrid label rule is the stated-confidence figure, all time and trailing
    (`pipeline/metrics.py`), not either confidence level. The fleet-entry rule applies to survivors and
    flow; re-registrations count only in stock. Measures no live chart uses are said to be unused.
  - Left out of this change: the page does not explain event markers, the "All other" series, or the
    labels for unmatched and unrecorded values. Queued in CHECKPOINT.
- Consequences: the case-study figures will not update themselves. METRICS.md still says trucks were
  "~2.3%" either side of April 2020 and that "almost all" months under 200 are before 1990; measured
  2026-10-19: 2.5% over the 12 months before (2.9% in March and in May 2020), and all 493 are before
  1990. Left for a METRICS.md pass (STATE known issues).
- Status: decided by Claude (unreviewed)

## D-032 2026-10-19 — Shares on survivors data are skewed by uneven scrappage, and the site says so
- Agent: claude, under D-027
- Basis: this commit; `data/snapshots/2026-08.parquet` and `origin/main:data/snapshots/2026-09.parquet`
  (snapshots 2026-08-31 and 2026-09-30), queried with DuckDB on 2026-10-19: for
  `vehicle_type = 'PASSENGER CAR/VAN'`, the sum of `n` per `registration_year` and group in each
  snapshot, and the change between them.
- Context: caveat 2 (`src/pages/caveats.astro`) said shares "hold up" under scrappage because it thins
  each cohort's total along with each brand; the brand-share notes in `config/presets.json` said the
  same with a hedge (STATE known issue 1). That holds only if every group leaves the register at the
  same rate.
- Measured: the net fall in vehicles still registered over the one month between snapshots, within
  the same first-registration year, differs by group. 2015 cohort: used imports 0.72% (90,359 to
  89,708), NZ New 0.17% (86,483 to 86,340); petrol 0.47%, diesel 0.17%; makes from 0.22% (Holden)
  to 0.75% (Nissan) among the ten largest (Land Rover 0.00%, Lexus 0.09% and Jeep 0.14% sit below
  that range among makes over 1,000). 2018 cohort: used imports 0.54%, NZ New 0.08%. The direction
  reverses for older cohorts: 1990–2000, NZ New fell faster (1997: 0.88% against 0.46%); from 2001
  used imports fall faster. All vehicle types together show the same direction from 2010. Every gap
  is many times the binomial standard error at these cohort sizes. It is a net change (anything
  returning to the register is netted off), over one month only.
- Options considered: (1) Keep "share holds up" with the hedge: contradicted by the data. (2) Say
  shares are skewed, give the measured one-month rates, and say the size of the skew for a given month
  is not yet known: true and checkable. (3) Extrapolate the one-month rates to a cumulative bias per
  month: rates vary with age and one month is not a trend, so the number would be invented.
- Decision: (2). Caveat 2 gives the 2015 figures, dated to the two snapshots, says the direction is
  not the same in every cohort, and claims no growth with age. The brand-share and parent-group notes
  say groups leave the register at different rates, so older months lean towards longer-lasting ones.
  `new-vs-used`, the live chart with the largest measured gap, gets a note saying recent cohorts
  understate the used share and some older ones run the other way. Notes carry no figures, so they
  cannot drift.
  - After an independent review: the make range is qualified to the ten largest makes; "the older the
    month, the more" is dropped because the 1990s cohorts reverse; and step 1b is no longer said to
    measure the brand lean, because TPT is split only by vehicle type and new / ex-overseas
    (`docs/DATA_SOURCES.md` §C).
- Consequences: caveat 2's figures will not update themselves. `brand-owner-origin` and `segment-mix`
  carry no such note; caveat 2 covers them. The size of the skew becomes measurable once cohort
  survival exists, for new against used only (step 1b, POST_GATE A2). For makes, no source counts first
  registrations, so the snapshot archive can track attrition only from 2026-08 onward.
- Status: decided by Claude (unreviewed)

## D-033 2026-10-19 — METRICS.md's April 2020 case and threshold figures are re-measured against the cube
- Agent: claude, under D-027
- Basis: this commit; the local cube `public/data/cube/registrations_surviving/` (snapshot
  2026-08-31), queried with DuckDB on 2026-10-19. A month's denominator is `max(denominator)` per
  month in `import_status.parquet`; a window's baseline is the sum of `n` over the sum of
  denominators.
- Context: D-031 found METRICS.md's "~2.3%" truck baseline and "almost all" pre-1990 wording wrong
  and left them for a METRICS.md pass (STATE known issue 2). Re-measuring the whole passage found
  more: NZ New "~51%" either side (measured 54.3% over the 12 months before, 55.1% over the 12 after);
  Hyundai Motor Group's "4.5–7.5% band either side" (5.9% over the 12 months before; monthly share
  across the 12 months either side 4.2% to 9.4%); and "0.33 sits well clear of ordinary seasonal
  variation, whose 1st percentile is 0.29", which contradicts itself. 0.29 (measured 0.286) is the
  1st percentile of the ratio across all months with any history, including the sparse ones under
  200. Among the 702 months that clear 200 with 12 months before them, it is 0.67 (0.67497), and the
  next-lowest after April 2020 (0.07) is November 1985 at 0.55. Confirmed unchanged: 493 of 1,195 months
  under 200, the latest February 1970; 1,542 against a median of 22,108; 261 of 1,542; standard error
  0.95pp; trucks 2.5% and vans 4.5% over the 12 months before; every threshold from 0.2 to 0.5 picks
  only April 2020 among months that clear 200 (0.6 adds November 1985 and July 2023).
- Options considered: (1) Fix only the two figures STATE named: leaves three more wrong figures in
  the same paragraph. (2) Re-measure every figure in the two-guards section, give before and after
  baselines so "either side" has a basis, and date the figures to the snapshot. (3) Drop the figures
  and keep only the argument: the figures are the argument for the second guard.
- Decision: (2). The table shows the 12 months before (the guard's window, matching `/method`) and
  the 12 months after. "Essential-goods vehicles, not a market" becomes "more trucks, more vans, more
  NZ-new: not the mix of a normal month", because the data shows body types, not what the vehicles
  were for (the same reason D-031 dropped `/method`'s description).
  - After an independent review: the 1st percentile is 0.67, not 0.68 (0.67497 had been rounded
    twice). "Every threshold from 0.2 to 0.5 selects the same single month across all 1,195" is
    true only among months that clear 200; on its own the guard trips in 5 months at 0.2, 12 at 0.33
    and 28 at 0.5, every extra one under 200 and already suppressed, so the text now says so.
    "Lowest after April 2020" became "next-lowest", since November 1985 is earlier. The Share row
    says the representativeness guard applies to monthly shares only (`MixChart.tsx`, `!rolling`),
    as `/method` already does.
- Consequences: METRICS.md and `/method` now agree on every April 2020 figure. The comment
  `$min_share_of_trailing_median_comment` in `config/measures.json` still says the 1st percentile is
  0.29 and that 0.33 sits well clear of it; the file is frozen until the 8 November 2026 gate, so the
  fix is queued in CHECKPOINT for after it. The figures will drift slightly with each snapshot.
- Status: decided by Claude (unreviewed)

## D-034 2026-10-19 — /method explains event markers, "All other" and the labels for values with no name
- Agent: claude, under D-027
- Basis: this commit; `src/components/MixChart.tsx`, `src/lib/events.ts`, `src/components/EventList.tsx`,
  `src/components/PresetPanel.tsx`, `config/presets.json` and `config/pipeline.json` as they run on
  this branch; `public/data/events.json` and the local cube (snapshot 2026-08-31), queried on
  2026-10-19.
- Context: CHECKPOINT queue item 1's last open scope. The charts draw marks no page explained: four
  event styles (solid rule at `date_start`, dotted faint rule at `announced_date`, shaded band to
  `date_end`, dashed darker rule for `mechanism = measurement`), numbered cluster labels such as
  "3 (2)", a hidden-by-default set of market-wide events, an "All other" line, and the labels
  "Not recorded", "No reference match" and "Other (beyond the cap)". Only `MixChart` draws markers or
  "All other"; the concentration chart routes to `TrendChart` and draws neither. Measured: 50 events
  published, 1 measurement, 13 windowed, 22 with an announcement date, 18 market-wide. In the cube,
  `__UNMAPPED__` is 26,427 of 4,502,964 vehicles (0.59%) on make, parent group and owner country;
  `__UNDEFINED__` is 89 on segment; import status has none.
- Options considered: (1) A key drawn on each chart: costs space on every chart, including at 320px,
  for marks most readers meet rarely. (2) A section on `/method`, with the labels, counts and caps
  read from the same constants and config the charts use, so it cannot drift from them. (3) Leave it
  to the event list's own text: that explains events, not lines, and only once opened.
- Decision: (2). `ALL_OTHER` (MixChart) and `RESERVED_LABELS` (PresetPanel) become named exports so
  the page reads them; nothing else in the components changes. The page says a marker gives a date,
  not a cause (invariant 7 and the non-goals). The two counts are dated to the August 2026 snapshot,
  like the April 2020 case study, and will drift.
  - After an independent review: the brand chart (`brand-share`) has no `events: true`, so the
    scope example now uses the import-status chart, and the page no longer implies every mix chart
    carries markers. On a chart without `top_n`, `series` is the trailing-12-month ranking filtered
    to `n > 0` (`MixChart.tsx`), so a group with no vehicles in the last 12 months has no line in
    any year while still counting in the denominator. Today that hides one group: segment
    `__UNDEFINED__`, 89 vehicles, the latest first registered February 2022. The page says so; the
    renderer fix is queued as its own item. "Buyers often react to an announcement" is dropped as
    a claim about behaviour.
- Where docs and code disagree, the page follows the code as it runs, and the disagreement is listed
  in STATE: `docs/EVENTS_LAYER.md` says market-scope events default to "collapsed behind a single
  'show events' toggle, on by default" (self-contradictory; the code hides them until the button is
  pressed), and says to cluster "by year" beyond 8 markers (the code clusters by distance on the axis,
  widening until at most 8 remain).
- Consequences: `/method` now covers every mark a mix chart draws. Changing a reserved label or the
  remainder label in code changes the page with it. `EVENTS_LAYER.md` is not edited here.
- Status: decided by Claude (unreviewed)

## D-035 2026-10-19 — A mix chart without top_n draws every group with vehicles in its drawn window
- Agent: claude, under D-027
- Basis: this commit; `src/components/MixChart.tsx` and `src/pages/method.astro` on this branch; the
  local cube (snapshot 2026-08-31) queried on 2026-10-19; headless screenshots of the four live mix
  charts at 320px and 1280px, default range and all time, before and after.
- Context: STATE known issue 3, found under D-034. Without `top_n`, `series` was the
  trailing-12-month ranking filtered to `n > 0`, so a group with no vehicles in the last 12 months had
  no line in any year while its vehicles still counted in the denominator, and the lines could add up
  to less than 100%. On the live charts this hid one group: segment `__UNDEFINED__` ("Not recorded"),
  89 vehicles in 81 months from 1957-04 to 2022-02.
- Options considered: (1) Draw every group with vehicles anywhere in the preset's period: a group
  present only before the default start would draw as a flat zero line and fill the key with 0.0%
  rows in the default view. (2) Draw every group with vehicles in the drawn window (the set event
  scoping already uses), and pick colour candidates from the whole period, so switching to all time
  cannot hand an earlier group a colour that pushes a later one down the palette. (3) Leave it and
  keep the `/method` sentence: the chart would keep under-drawing a group it counts.
- Decision: (2). With `top_n` nothing changes: the trailing ranking still picks the kept groups and
  the rest is "All other". Without it, the series are the trailing ranking followed by any other group
  with vehicles in the drawn window (in rolling mode, reaching 11 months before it, since the first
  rolling point rests on them), sorted by raw value; the key sorts them by share anyway. Reserved
  tokens still never take a colour. `/method` drops the sentence about the missing line and says that
  on a chart without `top_n` every group with vehicles in the period shown gets one; the segment
  example now says the 89 vehicles (at most three in a month) stay near zero except in greyed months.
  - After an independent review: the first `/method` wording claimed "one or two in a month" (2002-01
    has three) and did not exclude `top_n` charts; both corrected. The rolling reach-back and a
    `Set` lookup were added.
- Measured: the keys of `brand-owner-origin`, `new-vs-used` and `brand-share` are identical before
  and after at both widths and both ranges. `segment-mix` gains a grey "Not recorded" line and a key
  row (0.0%, ±0.0 pp); the five named segments keep their colours. No console errors, no sideways
  scroll at 320px.
- Consequences: a group that stops appearing keeps a line, at zero, for as long as its vehicles fall
  inside the drawn window, and a key row reading 0.0%. With a high-cardinality dimension and no
  `top_n` (possible once the Build surface exists), every group in the window draws; most will be thin
  grey lines. Because colour candidates come from the whole period, a group present only before the
  default start can hold a palette slot in the default view while drawing no line there, leaving a
  drawn group grey. That is the price of colours that never change with the range toggle; no live
  chart is affected (checked: no group in owner country, import status or segment other than
  `__UNDEFINED__` has its last vehicle before the trailing window).
- Status: decided by Claude (unreviewed)

## D-036 2026-10-21 — The concentration note says what a falling top-5 share can mean, not only one cause
- Agent: claude, under D-027
- Basis: this commit; `config/presets.json` and `src/pages/method.astro` on this branch; headless
  screenshots of the `concentration` panel at 320px and 1280px on the built site.
- Context: STATE known issue 4. The note ended "A falling line means more brands competing". A
  falling top-5 share means brands outside the five hold more of the total. That can be new brands
  arriving, or the brands already there splitting the market more evenly; the line cannot tell the
  two apart. `/method` already says only "the largest groups hold less of the total".
- Options considered: (1) Drop the sentence: the note would no longer help a non-analyst read the
  direction of the line. (2) Match `/method` word for word ("the largest groups hold less of the
  total"): accurate, but "groups" is the general term `/method` needs and reads oddly on a chart
  titled for brands. (3) Say what a fall means and name both readings, without picking one.
- Decision: (3). The sentence is now "A falling line means the largest brands hold less of the
  market: more brands may be competing, or the same brands may be sharing it more evenly." The
  question title "Is the market getting more crowded?" is unchanged: "crowded" covers both readings.
  - After an independent review: the note now also says that in the early decades makes with no
    match in the brand list count in the total but never take a place, which holds the line down.
    `/method` already gives this recording effect; without it the note invited reading the whole line
    as market behaviour (invariant 7). The sentence carries no figure, so it cannot drift.
- Consequences: none outside the note. `/method` and METRICS.md needed no change.
- Status: decided by Claude (unreviewed)

## D-037 2026-10-21 — brand-share shows its make-scoped events
- Agent: claude, under D-027
- Basis: this commit; `config/presets.json`, `src/lib/events.ts`, `src/components/MixChart.tsx` and
  `public/data/events.json` (snapshot 2026-08-31) on this branch; headless screenshots of
  `brand-share` at 320px and 1280px, default 10 years, all time and parent group, with the event list
  expanded.
- Context: STATE known issue 3. `brand-share` had no `events: true`, so the 8 published events scoped
  to `make` (Tesla 2017-02, Toyota agency model 2018-03, MG 2019-04, Holden Commodore 2019-12, Holden
  retired 2021-01, BYD entry 2022-07, KGM rename 2024-03, BYD range 2026-01) appeared on no chart. The
  only other live chart on `make` is `concentration`, a trend of one derived line; `TrendChart` draws
  no events.
- Options considered: (1) Leave them off: the agency-model measurement warning, which exists so a
  reader does not take Toyota's 2018 step as buying behaviour (invariant 7), would never be shown.
  (2) Turn them on and check the markers fit before deciding. (3) Show only events for makes with a
  line of their own: needs a renderer change, and would hide the Holden exit, which is part of why
  "All other" moves.
- Decision: (2), then on. All 8 fall inside the default 10-year window and draw as 8 separate
  markers; lanes keep the labels apart at 320px. On all time the axis spans 1912 to 2026, so events
  less than about 27 months apart merge even under the cap of 8: 4 markers, "1 (3)" (Tesla, Toyota,
  MG), "2 (2)" (both Holden), "3 (2)" (BYD entry, KGM) and "4" (BYD range). Every event keeps its own
  rule and list entry. The Toyota rule is dashed and
  its entry carries the measurement warning, including on all time, where it shares a label with two
  supply events. Under the parent group granularity no marker shows,
  because no published event is scoped to `brand_group`. No console errors, no sideways scroll.
  - After an independent review: the first draft said nothing clusters on all time; the screenshot
    shows 4 markers, as above.
- Consequences: Holden, MG, Tesla and KGM have no line of their own in the default view, so their
  markers point at changes inside "All other"; each entry in the list names the brand. `kgm-rename`
  is `mix` in `events.csv`, while EVENTS_LAYER.md calls a brand renaming `measurement`; the registry
  already merges SSANGYONG and KG MOBILITY into KGM, so the chart shows no step either way, and its
  summary says so. The file is frozen until the 8 November gate (STATE known issue).
- Status: decided by Claude (unreviewed)

## D-038 2026-10-21 — EVENTS_LAYER.md's rendering rules describe the code as it runs
- Agent: claude, under D-027
- Basis: this commit; `src/lib/events.ts`, `src/components/MixChart.tsx`, `src/components/EventList.tsx`,
  `src/lib/resolve.ts`, `config/pipeline.json` (`events`) and `pipeline/events.py`, read on
  `claude/brand-share-events` on 2026-10-21; D-034 and D-037.
- Context: STATE known issue 4, found under D-034. `docs/EVENTS_LAYER.md` said market-scope events
  default to "collapsed behind a single 'show events' toggle, on by default" (it cannot be both) and
  that beyond 8 markers events "cluster by year and expand on tap". Reading the code for this found
  three more rules it does not follow: the marker label was to be the event's title ("what happened,
  and when"), its summary and source were to sit in a tooltip, and the measurement warning was to be
  in that tooltip. The code numbers the markers and puts title, dates, summary, source and warning in
  a list under the chart; there is no tooltip. `/method` already follows the code (D-034).
- Options considered: (1) Change the code to the doc: market events on by default would add up to
  18 events (all 18 published market-wide events, on an all-time chart) to every chart that carries
  events, burying the scoped ones the doc exists to show; "by year" gives one cluster per year, and
  the 50 published events fall in 13 distinct years, so it cannot meet the cap of 8 on its own, while
  on a 10-year axis it merges events 11 months apart; titles as labels (the longest published is 63
  characters) would collide at 320px (inferred, not tried). (2) Change the doc to the code, keeping the hard rule's substance: the
  label and the list say what happened and when, never why. (3) Leave the disagreement listed in
  STATE: the doc is what an agent reads before touching the layer, and it would keep pointing them at
  behaviour nobody wants.
- Decision: (2). Rules rewritten: charts opt in with `"events": true` and only the mix renderer draws
  markers; scope matches the dimension through `scope_dimension_aliases` and the values present in the
  period drawn; filters are not yet considered because no live chart applies one, and must be once one
  can; market events are off until the reader presses "Show N market-wide events"; windowed events are
  a band plus the start rule; at most 8 numbered markers, merged by distance on the time axis (2%,
  widening until at most 8 remain), labelled on the first event, every event keeping its own rule and
  list entry, up to 4 lanes. The hard-rule bullets, the `summary` column note and the measurement
  paragraph now name the list, not a tooltip. The rename example under `measurement` is left for the
  `kgm-rename` item (STATE known issue 3).
  - After an independent review: the grouping rule is stated exactly (within 2% of the group's
    first event, widened ×1.6 per step); the lane gap (7.5%) and wrap-around, the announcement rule,
    and the measurement warning in the list were added; three unchanged lines that contradicted the
    code were corrected (`title` "shown on the marker", `expected_effect` "used to decide default
    visibility" — nothing in the site reads it — and "any time-series chart").
- Consequences: no code or page changes. The doc now states the current renderer's behaviour,
  including four constants in `src/lib/events.ts` (2%, ×1.6, 7.5%, 4 lanes) and `MAX_MARKERS`;
  changing them there means changing this doc too. Found while checking, not fixed here: the published
  title "Electronic stability control required on all new light vehicles" is 63 characters, over the
  schema's 60 (`events.csv` is frozen); and windowed bands ending after the latest snapshot
  (`ccs-charges-cut`, `ccs-targets-aligned-australia`) are drawn without clipping, so they may spill
  past the chart's right edge (not yet seen in a screenshot). Whether market events should default on remains a design question
  the user can reopen; the doc now says why they are off.
- Status: decided by Claude (unreviewed)

## D-039 2026-10-21 — Event marker labels are laid out in pixels and kept inside the frame
- Agent: claude, under D-027
- Basis: this commit; `src/lib/events.ts`, `src/components/MixChart.tsx`, `src/components/PlotFigure.tsx`;
  headless measurement of every chart on `/` that carries events, at 320px and 1280px, default range
  and all time, with and without market-wide events (2026-10-21, cube snapshot 2026-09).
- Context: STATE known issues 4 and 5. Lanes were given to labels less than 7.5% of the time axis
  apart. A label is a fixed number of pixels wide, so 7.5% cleared it at 1280px but not at 320px (about
  18px of a 236px frame, against a 23.5px `4 (3)`), and a fifth crowded label wrapped back to the first
  lane. Measured before: 6 overlapping label pairs (4 on `powertrain-mix`, 1 on `new-vs-used` in each
  range), all at 320px with market-wide events shown; 28 labels reaching past the frame, mostly into
  the 16px right margin at 320px. A label centred on a date before the chart's first month would print
  in the left margin; not reachable on this cube.
- Options considered: (1) A wider fixed fraction: still a fraction, so it either over-clusters
  desktops or under-clears phones. (2) More lanes at narrow widths: each lane takes 15px from a
  240–300px-tall chart, and a pile-up can still exceed any fixed number. (3) Lay out in pixels against
  the frame, and when labels cannot fit in 4 lanes, cluster harder (the same ×1.6 step the 8-marker
  cap already uses). Every label fits, nothing wraps, and the chart keeps its height; the cost is that
  marker numbering depends on width. (4) Abbreviate or hide labels at narrow widths: the number is the
  only link from a rule to its list entry. For the edge: (a) clamp the label inside the frame, (b)
  right- or left-align it at the edges, (c) drop the label when its date is outside the window.
  (a) and (b) look the same; (a) is one rule for both edges. (c) would leave a straddling band with
  no number.
- Decision: (3) and (a). `layoutMarkers` replaces `markersFor` and `assignLanes`: each label is 7px a
  character plus a 4px gap, centred on its date, slid inward to stay inside the frame, and placed in
  the lowest free lane by left edge; if a label needs a fifth lane, the grouping is redone with a wider
  merge. `PlotFigure` reports its width so the list under the chart is laid out at the same width and
  numbers its entries as the chart does. Before the width is known (first render), labels are grouped
  for the 8-marker cap alone, as before.
  - After an independent review: grouping now reads the same clamped position as placement, so events
    that began before the chart group at its first month (five such events and three inside now draw
    as `1 (5)` plus three markers, not one marker); and the widening stops once every event is in one
    group, so a `date_start` that does not parse (the pipeline checks only that it is present) cannot
    loop forever. Both checked in a scratch copy of `layoutMarkers`.
- Consequences: measured after: 0 overlapping pairs, 0 labels outside the frame or the svg, no
  sideways scroll, no console errors. `powertrain-mix` with market-wide events shows 6 markers at
  320px (8 at 1280px); the other charts' marker counts are unchanged. A pile of 30 monthly events in
  the last 30 months of a 16-year axis lays out as 3 markers in 3 lanes at 60, 120 and 236px and 7 markers
  at 1000px, all 30 events kept (scratch check of `layoutMarkers`). Numbering on a phone can differ
  from a desktop's; `/method` says so. `docs/EVENTS_LAYER.md` rendering rules updated. The 7px
  character width is the measured width of a numeral at 11px semibold, wider than the space and
  brackets; a font change would need it re-measured.
- Status: decided by Claude (unreviewed)

## D-040 2026-10-21 — README describes the repo as it is; CLAUDE.md keeps its plan and says where the repo departs from it
- Agent: claude, under D-027
- Basis: this commit; `README.md`, `CLAUDE.md`, `config/presets.json`, `data/reference/`,
  `pipeline/build.py`, `src/components/LeagueChart.tsx`, `package.json`, and `git ls-tree origin/main`,
  read on 2026-10-21; D-014.
- Context: STATE "Docs that contradict code" 5–7. README said "No application code yet" and "No
  frontend yet", but `pipeline/` and `src/` exist on `main` and on `ui/explore`. It also listed 26
  presets in 7 groups (there are 10 in 3 tiers on `ui/explore`), omitted `mild_hybrid_models.csv`,
  `config/pipeline.json`, `AGENTS.md` and the working docs, and said a run "commits" the snapshot and
  state (the workflow commits them; the run writes them, the snapshot only if that month has none).
  `CLAUDE.md`'s build order says no UI before two unattended runs, and its stack names Cloudflare
  Pages and TanStack Table, neither of which is in the repo.
- Options considered: (1) Rewrite `CLAUDE.md`'s build order and stack to match the repo: the brief is
  the user's plan, and the plan has not changed (deploying and adding TanStack are still intended as
  far as any record shows); rewriting it would erase the plan to fix a status question. (2) Leave
  `CLAUDE.md` alone and list the gap in STATE indefinitely: every agent reads the brief first and
  would keep finding the same contradiction. (3) Keep the plan's wording and add short notes saying
  what is planned and pointing to D-014 and `docs/STATE.md` for where the repo actually is. README is
  not a plan, so it is corrected outright.
- Decision: (3) for `CLAUDE.md`: "(planned …)" on the Cloudflare Pages and TanStack Table lines, a
  paragraph after the build order naming D-014, and `src/` added to the repo layout. README rewritten
  where wrong: the opening, the file table (adds `AGENTS.md`, `POST_GATE.md`, the working docs,
  playbooks, `config/pipeline.json`, `mild_hybrid_models.csv`, `pipeline/`, `src/`; the presets row
  states no count, since the canon changes), the known gaps, what a run writes and who commits it, and
  how to run the site. Preset and event counts are left out of README where they drift; the event
  count (54, 50 verified) was re-counted and kept.
  - After an independent review: the `CLAUDE.md` TanStack note says `LeagueChart` draws a Plot bar
    chart over a plain, non-virtualised rank table (it had said only "a plain table"); README names
    all eight playbooks; and `AGENTS.md`'s architecture list adds `LeagueChart.tsx`, which exists but
    was missing from the renderers built so far.
- Consequences: docs only. None of the edited lines is a design invariant or one of the five shapes
  (AGENTS.md hard rule 1). If the user has dropped Cloudflare Pages or TanStack Table, the "(planned)"
  notes become wrong and the lines should go instead.
- Status: decided by Claude (unreviewed)

## D-041 2026-10-21 — The Explore page is built for visitors now, local only until the 8 November gate; diagnostics move to /status
- Agent: user (scope and timing), claude (how)
- Basis: user's answers on 2026-10-21 to CHECKPOINT questions 1–3: "1, a. 2, basic charts, if any. We
  are essentially trying to remove the restrictions vstat is doing. Let the users have an interactive
  platform to explore the data while being easy to understand. 3, dev build is local only until 8
  november. We should have a lot of the work done, if not all before then. Nov 8 is just the
  verification." This commit; `src/pages/index.astro`, `src/pages/status.astro`,
  `src/components/PresetPanel.tsx`, `config/presets.json`.
- Context: `/` mixed what a visitor reads with what an agent checks: a "Canon triage" section, panels
  for charts that cannot be drawn listing config paths, status badges (`invalid`), preset spec lines,
  and "note will drift" warnings. AGENTS.md hard rule 8 said not to build ahead of the current step
  (build step 1).
- Decision (user): build the visitor-facing Explore page first (option a), then the sentence builder;
  aim for an interactive platform that is easy to understand and less restricted than VSTATS; dev
  build local only until 8 November, with most of the work done before then. Hard rule 8 gets an
  exception for the visitor-facing site.
- Decision (Claude, unreviewed): one renderer path with an `audience` prop on `PresetPanel`, not a
  second component, so the public and internal views cannot drift. `/` shows each group from
  `config/presets.json` with only the presets whose default view draws against this build (decided at
  build time with `resolvePreset`), and drops a group left with none; the group's `title` and `lead`
  moved from `index.astro` into the config, so the page layout is data (invariant 2). Public panels
  leave out status badges, the blocking and drift callouts, the spec line, and a note with a value the
  build did not supply; a filter that cannot be applied becomes "This chart includes every vehicle, not
  only “Light passenger”: the data can't be narrowed that way yet." The new internal `/status`
  (noindex, footer link) carries the triage table and every preset with its full diagnostics. Group
  labels drop "Tier N ·". "Copied link!" becomes "Link copied" (no exclamation marks in product copy).
  - After an independent review: the build-time filter and the panel share `presetView` (first
    granularity option, the preset's own period), so a preset shown on `/` is the view the panel draws;
    if a visitor's own choice (a URL period, another option) cannot be drawn, public mode says "This
    view can't be drawn from the data yet. Choose another option above." instead of an empty panel.
    The powertrain dimension's note names a manifest key; `config/dimensions.json` is frozen, so a
    preset may carry `public_dimension_note`, which replaces the dimension's note on `/` only
    (`powertrain-mix` does). After the gate it can move onto the dimension (CHECKPOINT queue). The
    filter sentence no longer assumes the filter is a vehicle type. Links to `/#triage` and to hidden
    presets now land at the top of `/`; nothing is deployed, so no outside link carries them.
- Options considered for "basic charts, if any": show the six charts that draw (five live and
  `powertrain-mix` with its plain filter notice), or only the five live ones. Six: the filter notice
  says plainly what the chart includes, and the chart answers its question for all vehicle types.
- Consequences: visitors see 6 charts in 2 sections; the fleet section returns when one of its charts
  can draw. Measured headless at 320px and 1280px: 6 panels and 6 charts on `/`, no badges, spec lines,
  any of "Tier", "preset", "config/", "cube", "invalid", "blocked", "manifest", ".json" or a
  snake_case identifier in the page text, no sideways scroll; `/status` shows
  all 10 panels. The site has no dark theme (no `prefers-color-scheme` in `src/styles/site.css`). Open:
  whether pipeline work (POST_GATE A1–A3) may also be built on branches before 8 November without being
  merged to `main` (CHECKPOINT question 1).
- Status: user decided scope and timing; implementation decided by Claude (unreviewed)

## D-042 2026-10-21 — One row of time options per chart, and visitor wording in a public_copy block
- Agent: claude, under D-041
- Basis: this commit; `src/components/PresetPanel.tsx`, `src/components/MixChart.tsx`,
  `src/lib/composition.ts`, `config/presets.json`, `src/styles/site.css`; headless checks of `/` on
  2026-10-21.
- Context: CHECKPOINT queue item 1, from D-041's screenshots. Every all-time mix chart showed two
  controls that both said "All time": the panel's horizon row (3, 5, 10 years, All time) and the chart's
  own "From Jun 1937 / All time". The dataset definition said "first registered in month M"; the owner
  country eyebrow read "Brand owned from"; a bare "#" was the permalink; the notes under mix charts
  stated the start rule and the rolling share in maintainer terms ("categories", "trailing", "computed in
  the browser"). The definition and the label live in `config/dimensions.json`, frozen until the gate.
- Options considered: for the controls, (1) relabel the chart's toggle and keep two rows: two
  controls still change the same axis; (2) one row in the panel, which the chart reads: chosen. For
  the wording, (1) a field per preset, as D-041 did for one note: the same dataset definition would be
  repeated on every preset; (2) one `public_copy` block keyed by dataset and dimension id: chosen, and it
  supersedes D-041's `public_dimension_note`; (3) wait for the gate: visitors would read "month M" until
  then.
- Decision: the panel's time row reads "3 years, 5 years, 10 years", then, on a mix chart that opens
  later than its first month of data, "Since <month>" and "All records" (otherwise "All time"). "All
  records" keeps the `range=all` URL parameter the chart used, so old links still work. The start month
  comes from one helper, `compositionStart`, used by both the panel and the chart. Toggle options wrap
  at narrow widths, with the separators drawn as 1px gaps so every wrapped option keeps its border.
  `public_copy` gives visitors a plain dataset definition ("Each month counts the vehicles first
  registered in New Zealand that month that are still registered on the snapshot date"; the month is
  `FIRST_NZ_REGISTRATION_MONTH`, `config/pipeline.json`), "Country of the brand's owner", and the
  powertrain note. The permalink is a "Copy link to this chart" button. Visitors get plain versions of
  the start rule, the rolling share, the grey-months note (with a link to `/method`) and the mild hybrid
  coverage line (stated-confidence figures only); `/status` keeps the exact wording. "Granularity"
  becomes "Show by" for screen readers.
- Consequences: measured headless on `/`: every chart has one time row; three all-time mix charts open
  late, two reading "Since Jun 1937" and one "Since Oct 2009", each with "All records"; picking it
  draws from Jan 1912, writes `?<id>.range=all`, and survives a reload. 0 of 39 toggle options clipped at
  320px or 1280px. No "month M", "Brand owned from", "manifest", ".json" or snake_case identifier in
  the page text. A first draft of the start-rule sentence said "before that one group was almost
  everything", which the rule does not test (powertrain had two large groups before 2009); it now states
  the rule. The `public_copy` block is a holding place: after the gate its entries belong on the
  datasets and dimensions (CHECKPOINT queue).
  - After an independent review: three visitor sentences said more than the code does and were
    corrected. A gap blanks every point whose 12-month window holds it, not just that month; the mild
    hybrid figure is "at least" (unresolved hybrids count as missed); a collapsed month is not "too few
    to read" but "may not describe a normal month". The start rule names the 12-month window it tests.
    Wrapped toggle options centre their text at 640px and below. The copy button falls back to "The
    address bar now links to this chart" when the clipboard is missing or refuses (checked headless both
    ways). `public_copy` also covers `nz_new` and `used_imports`, so no visitor definition says "month
    M". The `.panel-anchor` and `.badge.copied` styles, now unused, are removed. Not changed: `preset.dataset !== "used_imports"` in
  `PresetPanel.tsx` names a dataset in code (invariant 1), found while reading; listed in STATE.
- Status: decided by Claude (unreviewed)

## D-043 2026-10-21 — Frozen-path work may be built on branches before the gate, kept off main until it passes
- Agent: user (the rule), claude (the terms)
- Basis: the user's "yes" on 2026-10-21 to CHECKPOINT question 1 ("may pipeline work (POST_GATE A1–A3)
  be built and tested on `claude/` branches before 8 November, kept off `main` until the gate passes?
  ... no local `pipeline run`"), after "Nov 8 is just the verification" (D-041).
- Context: AGENTS.md hard rule 2 froze `pipeline/`, workflows, the frozen configs, reference data,
  schema, tests and the cube schema until the 8 November run passes, so that the gate verifies the code
  that ran on 8 October. The monthly Action runs `main` only.
- Options considered: (1) keep the freeze: the four hidden charts and the builder's later options wait
  until after 8 November. (2) Allow the work on branches, unmerged until the gate passes: the Action keeps
  running exactly what ran on 8 October, so the gate still verifies it. (3) Allow merging to `main`
  before the gate: the 8 November run would test new code, and the gate would no longer mean two clean
  runs of the same pipeline.
- Decision: (2). Branches are cut from `main` (the pipeline's home), not from `ui/explore`, and their
  PRs into `main` stay unmerged until the gate passes; nothing on a frozen path reaches `main` or
  `ui/explore` before then. Tests and `pipeline build <saved pull> --dry-run` may run locally (they write
  only gitignored `data/staging/`, AGENTS.md); `pipeline run` and `init-schema` still may not, and golden
  changes still follow rule 4 (deliberate, one cube change per commit, diff shown to the user).
- Consequences: AGENTS.md rule 2 carries the exception. POST_GATE A1–A3 and B1–B3 can be ready for
  review before 8 November. UI work that needs a new slice waits for its pipeline PR to merge after the
  gate, or is built against a dry-run cube and marked so.
- Status: user decided the rule; terms decided by Claude (unreviewed)

## D-044 2026-10-21 — The Build page: a sentence of what the cube can honestly answer, share only for now
- Agent: claude, under D-041 (the user asked for the sentence builder after Explore: "an interactive
  platform, easy to understand, less restricted than VSTATS", local only until 8 November)
- Basis: this branch (`claude/sentence-builder`); `src/lib/builder.ts`, `src/components/SentenceBuilder.tsx`,
  `src/pages/build.astro`, `config/presets.json` `builder`; headless checks of `/build` on 2026-10-21.
- Context: build step 5. The cube has one dataset, `registrations_surviving`, with 13 live
  one-dimensional slices (`manifest.json`, 2026-09 snapshot). Renderers exist for mix, trend, league and
  distribution, not geo. CHECKPOINT left four things to settle: whether counts are offered, how the
  sentence reads, URL state, and reusing `PresetPanel` so Build and Explore cannot drift.
- Options considered:
  - Counts: (1) offer "the number" and "the 12-month running total": on vehicles still registered, older
    months are thinned by scrappage, so a count reads as sales, which is what `brand-share`'s note and
    D-024 already refuse. (2) Share only, saying on the page that counts wait for true monthly
    registrations: chosen.
  - What the sentence may say: (1) a hand-written list of sentences: drifts from the cube. (2) every
    dimension the cube has: would offer `model` (68% all-time coverage on survivors, D-024 holds it for
    step 1b) and `region` (no geo renderer; the TLA is the owner's current address, D-024). (3) each
    measure lists the dimensions it may be split by, with the words the sentence uses, and of those only
    the ones `resolvePreset` says draw are offered, worked out at build time as the Explore page does:
    chosen.
  - Time: (1) a period blank in the sentence: a second time control beside the panel's row (D-042 made
    it one row). (2) the panel's existing time row: chosen.
  - Drawing: (1) a builder renderer: a second path that drifts. (2) `PresetPanel` takes a preset object
    as well as an id: chosen. The built preset has id `build`, so the URL helpers scope its parameters
    (`?build.measure=…&build.by=…&build.period=…`) and "Copy link to this chart" shares it.
- Decision: `/build` reads "Show [the share of vehicles] by [breakdown]" or "Show [the share of the 5
  largest] [brands | manufacturer groups]" (the concentration measure). Share is offered by powertrain,
  whether new or used, vehicle type, brand (top 10), manufacturer group (top 14), brand owner's country,
  brand's original country, country where built, vehicle age, engine size and age when registered here.
  Powertrain is drawn across every in-scope vehicle; Explore's `powertrain-mix` asks for light
  passenger vehicles only and shows the same chart with a "What this chart includes" warning. The
  sentence says "vehicles", so the builder needs no warning. A distribution opens on 5 years, because summing all
  time mixes eras whose records differ (MODEL_AND_AGE §1); distribution charts now get the time row
  (none is live on Explore, so `/` is unchanged). A "Not offered yet" list under the chart names counts,
  new-only or used-only, models and regions, each with its reason. Notes come from the same places as on
  Explore, plus, from the `builder` block, a share-not-volume note, a concentration note, and what the
  canon presets say about four dimensions (SUVs recorded as station wagons; new and used leaving the
  register at different rates; ownership as at today for owner country and manufacturer group), kept
  there so Explore does not show them twice. Visitor notes are added for the two age dimensions (age on
  the snapshot date; the year is less consistent for NZ-new vehicles before 2007) and for country where
  built. A new sentence clears the chart's period, range and smoothing, so each opens on its own defaults.
  The copied link carries no `#build`, so opening it does not scroll the sentence out of view.
- Consequences:
  - Measured headless: all 13 sentences draw at 320px and 1280px, with no console errors and no sideways
    scroll; a reloaded address reopens the same chart and time range; switching measure keeps the
    breakdown when the new measure offers it. `/` and `/status` draw as before (6 charts each).
  - Country where built is not recorded for 98% of vehicles first registered before November 1985 that
    are still registered, and for almost none from December 1985 (measured on the 2026-09 cube). With a
    top-10 cap, `MixChart` folds reserved values into "All other", so that gap read as "All other" near
    100%. Country where built is therefore uncapped (46 values, so a long key) and carries a note on the
    gap. The fold itself is unchanged and also applies to `brand-share`'s early months (STATE known issue).
  - Phrases are at most 24 characters, so each fits a 320px line (296px of text at 22px; the longest
    measures 245px in Chromium), including in browsers without `field-sizing`, which size a select to
    its longest option. "Age when first registered here" reads "age when registered here"; the dataset
    definition under the heading says "first registered".
  - After an independent review: the four canon caveats above were missing from built charts; vehicle age
    did not say "on the snapshot date"; the time range carried over only when it differed from the
    previous chart's default; the copied link scrolled past the sentence; the panel's h3 followed the h1
    directly; three phrases were clipped at 320px even in Chromium. All fixed and rechecked headless.
    Only Chromium was run; Firefox and Safari were not.
  - When the gate lifts the freeze: "of [all / new / used] vehicles" needs POST_GATE A1's pair slices;
    counts and models need A2 (`registrations_flow`). Each is a `builder` config edit plus that data.
- Status: decided by Claude (unreviewed)

## D-045 2026-10-21 — A 12-month ranking in the time row, wherever the breakdown ranks
- Agent: claude, CHECKPOINT queue item 1 (builder PR B), stacked on D-044
- Basis: this branch (`claude/builder-league`); `src/lib/resolve.ts` `rankingPeriods`, `src/components/PresetPanel.tsx`,
  `src/components/LeagueChart.tsx`, `config/presets.json` `builder.ranking_period`; headless checks on 2026-10-21.
- Context: `LeagueChart` existed, but no live chart reached it. The time row offered 3, 5 and 10 years and all
  time, none of 12 months or less, so a league preset switched to a line chart with no way back (STATE known
  issue 1), and the builder could not draw a ranking at all.
- Options considered:
  - Where the option comes from: (1) the time row offers 12 months on every chart: a 12-month line chart of
    shares is a thin chart, and on a breakdown that does not rank it would add nothing. (2) A panel prop the
    Build page sets: a second rule outside config. (3) A preset may name a `ranking_period`; the row offers it,
    and the preset's own period, only where `inferShape` makes that period a league: chosen. Shape stays
    inferred from measure and dimension (CLAUDE.md §Shapes); the builder sets `ranking_period` from config.
  - Explore: (1) give `brand-share` the ranking too: a question-titled chart would answer a different question
    under its title. (2) Leave canon presets as they are unless they open as a league: chosen. `/` is unchanged.
  - Manufacturer group: `config/dimensions.json` calls it medium cardinality, so it does not infer a league.
    Changing that is a frozen-file change, so it stays a line chart; reconsider after the gate.
  - Counts on the ranking: (1) keep LeagueChart's share/count toggle: the Build page says counts on this
    dataset read as sales (D-044). (2) Bars follow the measure; the count toggle appears only when the measure
    is not share: chosen. The table keeps a "Still registered" column, the count each rank and share is made
    of; the review flagged it against D-044, and it stays because a ranking with its base hidden cannot be
    checked. Its wording says first registered in the window and still registered.
- Decision: on `/build`, "Show the share of vehicles by brand" offers "12-month ranking" after the spans. It draws
  `LeagueChart` over the last 12 months with the move against the 12 months before; any other span returns to
  the lines, and a new breakdown that cannot rank opens on its default. A canon preset whose own period makes
  it a league now has that period in its row. LeagueChart's wording is plain (the value column takes the
  breakdown's visitor label, "Move", "Still registered", "Change in share", "Rank 12 months before"; "places",
  not "spots"; the unchanged dash reads "Same place" to a screen reader), its up, down and new colours meet AA
  contrast on the page background, and the grey-months note is left off a ranking, which greys no month. The
  button names the window `LeagueChart` ranks (12 months, `chart_defaults.trailing_window_months`), not the
  period's own length. Switching a "Show by" option to a view that cannot rank resets the period to the default.
- Consequences:
  - Measured headless at 320px and 1280px: brand offers the ranking; manufacturer group, the concentration
    measure and powertrain do not; ranking, reload, back to all time, and ranking then switching to
    manufacturer group all behave; no console errors, no sideways scroll; `/` draws its 6 charts with the
    same time rows as before; `/status` draws its 10 panels. A scratch league preset on `/` (added to a copy of
    `presets.json` and removed) opened on its ranking, went to 5 years and came back.
  - At 320px the ranking table scrolls sideways inside its own box; the page does not.
  - Only Chromium was run.
  - An independent review found six points: counts on a share ranking (kept, reworded, above), the window
    misstated, a label that could disagree with the window, a "Show by" switch leaving no period checked, the
    bare dash, and stale docs (`CLAUDE.md`'s "no league preset is live", STATE known issue 1). All addressed.
- Status: decided by Claude (unreviewed)

## D-046 2026-10-21 — Reserved values keep their own line on a capped mix chart (supersedes the fold)
- Agent: claude, CHECKPOINT queue item 1 (STATE known issue 5)
- Basis: this branch (`claude/reserved-values`); `src/components/MixChart.tsx`; `config/presets.json`
  `builder.top_n`; the 2026-09 cube measured with DuckDB; headless screenshots on 2026-10-21.
- Context: on a mix chart with `top_n`, `MixChart` drew the kept values and "All other", and "All other" was
  the month's total minus the kept values, so "Not recorded" and "No reference match" were folded into it.
  Without `top_n` the same tokens already drew as their own context-grey lines. The fold made a gap in the
  record read as a market of small groups: D-044 left country where built uncapped (46 rows in its key)
  for that reason, and `brand-share` on all time showed unmatched makes as "All other".
- Options considered:
  - (1) Keep the fold and say so in a note: the line still shows the wrong thing.
  - (2) Draw each reserved value with vehicles in the drawn window as its own line, as uncapped charts do,
    and make "All other" what is left after the kept and reserved values: chosen. One rule on both kinds of
    chart.
  - (3) A distinct style for reserved lines (dashed, say): a new visual rule on every mix chart; not needed
    to fix the fold, and reviewable on its own.
- Decision: (2), for the tokens that mark what the record could not place (`__UNDEFINED__` "Not recorded",
  `__UNMAPPED__` "No reference match"). The pipeline's beyond-the-cap token (`__OTHER__`, a model past the
  cube's model cap) is a group too small to name, so it stays in "All other". Reserved lines take the context grey and no direct label, as on uncapped charts; the key
  lists them by their figure, with "All other" still pinned last. The builder caps country where built at 10.
- Consequences:
  - Measured on the 2026-09 cube, rolling 12-month shares over windows of 200+ vehicles: "All other" peaks
    at 74.7% (1959-07) on brand, top 10, where it was 92.4% (1957-08); on manufacturer group, top 14, 68.2%
    (1957-09), was 87.9% (1952-04). "No reference match" peaks at 30.8% (1951-07) on both. On country where
    built capped at 10, "All other" would have peaked at 99.9% folded; it peaks at 31.6% (1988-01), and "Not
    recorded" at 99.8% (1977-01).
  - Headless, 320px and 1280px, every mix chart on `/`, `brand-share` in all four brand and group views, and
    the builder's brand, group and country sentences: the SVG of every uncapped chart is identical before and
    after (brand owner's country, powertrain, new and used, segment; concentration is a trend). Brand and
    manufacturer group gain a "No reference match" key row (0.1% over the last 12 months); manufacturer group's "All
    other" goes from 11.7% to 11.6%. Country where built's key goes from 46 rows to 12 ("All other" 3.2%).
    No console errors, no sideways scroll.
  - A reserved line shares the context grey with series beyond the eight palette colours (on brand, Subaru
    and BYD), so on the plot it is told apart by the key, as on uncapped charts already.
  - An independent review found no correctness bug (no negative remainder: in every month of the three slices
    the denominator equals the sum of n). It flagged `__OTHER__` (now kept in the remainder, above) and that on
    a period shorter than the key's 12-month windows a reserved value with vehicles only outside the drawn
    window is taken out of "All other" without a key row of its own; kept values already behave this way and
    no live chart has such a period.
- Status: decided by Claude (unreviewed). Supersedes the fold described in D-044's consequences.

## D-047 2026-10-22 — Pair slices: one schema, the whole month as denominator, listed per dataset in pipeline.json
- Agent: claude, CHECKPOINT queue item 2 (POST_GATE A1), under D-043
- Basis: branch `claude/pair-slice-import-age` (a pull request into `main`, unmerged until the 8 November gate):
  `pipeline/build.py`, `pipeline/outputs.py`, `pipeline/contract.py`, `config/pipeline.json`, `docs/CUBE_SCHEMA.md`, the
  golden and guardrail tests; dry-run rebuilds of the saved August pull on 2026-10-22.
- Context: `used_imports` and `nz_new` are `registrations_surviving` filtered by import status (`config/dimensions.json`),
  and the cube carried one-dimensional slices only, so `used-import-age` and `age-distribution-moving-hole` could not be
  served. `docs/CUBE_SCHEMA.md` named the path `pairs/{dataset}/{dim_a}__{dim_b}.parquet` and a list of candidate pairs,
  but no schema, no denominator rule and no place in config for the list.
- Options considered:
  - What to emit: (1) the filtered datasets as their own 1-D cubes (`cube/used_imports/...`): simplest to read, but each
    filtered dataset multiplies every slice, and a filter by another dimension (powertrain within light passenger,
    POST_GATE A3) needs a pair anyway. (2) Pair slices, as CUBE_SCHEMA planned: chosen.
  - Columns: (1) named after the two dimensions: self-describing, but each file would have its own schema to lock.
    (2) Fixed `a_value` and `b_value`, the file name saying which dimension is which: chosen; one `PAIR_COLUMNS`.
  - Denominator: (1) the filtered subset's month total: saves the browser a sum, but a pair's rows would then depend on
    which side is filtered. (2) The dataset's whole month, as in a 1-D slice: chosen. A pair is then its two 1-D slices
    split further, which a test checks (summed over either side it gives that side's slice in every count, and `fc_sum`
    to within its per-row rounding); a filtered share is `n` over the summed `n` of the filter value that month.
  - Where the list lives: `config/pipeline.json` `datasets.<id>.pairs`, beside the dataset's `require`, not
    `config/dimensions.json` (the Build vocabulary).
- Decision: as above. An entry that is not two different dimension ids, a pair listed twice in either order, or a
  dimension the dataset cannot derive aborts; a pair whose dimension is not live this run waits, as the dimension does
  (`not_live_pairs` and a warning). The manifest lists `live_pairs` per dataset, and the site reads that list. Only the
  pair A1 names is emitted; CUBE_SCHEMA keeps the other seven as candidates and adds this one, as POST_GATE A1 asked.
- Consequences: the golden contract gains a `pairs` section and two manifest keys; every 1-D slice is unchanged. On the
  August pull the pair holds 15,791 rows, 91,558 bytes, and matches both 1-D slices exactly. The state file is
  unchanged: a pair can drop out only when a dimension does, which already aborts if it was live. An independent review
  of the stack found no corruption; its points on validation (non-string entries, reversed duplicates) and wording ("row
  for row" holds for the counts, not for the rounded `fc_sum`) were folded into the commit.
- Status: decided by Claude (unreviewed)

## D-048 2026-10-22 — Pull requests run the pipeline tests on the runner the monthly build uses
- Agent: claude, under D-043
- Basis: branch `claude/pr-checks` (a pull request into `main`): `.github/workflows/checks.yml`; `monthly-build.yml` and
  STATE ("No CI runs on pull requests") read on 2026-10-22.
- Context: pipeline changes were first tested on Linux by the monthly run, after they had merged. POST_GATE B3 makes the
  golden test compare `payload_bytes`, the bytes the build writes, and this machine has no Linux to check them on (no
  WSL and no container runtime, checked 2026-10-22).
- Options considered: (1) leave Linux testing to the monthly run: a change that breaks there fails that month's build.
  (2) A workflow on pull requests running the monthly build's test step on the same runner, read-only: chosen. (3) Also
  build the site in CI: `astro build` needs `public/data`, which is gitignored; left for the deploy item (CHECKPOINT 8).
- Decision: `checks.yml` runs on `pull_request` from any base, so stacked pull requests are tested too, with
  `contents: read`, the same checkout and setup-python versions, Python 3.13, pip cache and pytest line as
  `monthly-build.yml`. It never pulls from the source.
- Consequences: a change to a frozen path, built on a branch before the gate (D-043); it reaches `main` after 8 November.
  Until then it runs on the pull requests whose head contains it, which is the pipeline stack. Free on a public
  repository. UI pull requests are still not tested in CI.
- Status: decided by Claude (unreviewed)

## D-049 2026-10-22 — A brand renaming is a measurement event, even where the registry hides the step
- Agent: claude, CHECKPOINT queue item 5 (STATE known issue 2)
- Basis: branch `claude/post-gate-fixes` (the `events.csv` commit); `docs/EVENTS_LAYER.md` §Why `mechanism` matters;
  `data/reference/brand_registry.csv`; D-037.
- Context: `kgm-rename` was `mix`, while EVENTS_LAYER.md names a brand renaming as its example of `measurement`. The
  registry maps SSANGYONG and KG MOBILITY to KGM, so the make series shows no step.
- Options considered: (1) keep `mix` and change the doc's example: `mix` ("composition shifted within an unchanged
  total") does not describe a renaming either, and it is the label a reader could take for market behaviour (invariant
  7). (2) `measurement`, doc unchanged: chosen. The recorded make changed, not the market. The warning ("this reflects a
  change in how the data was recorded, not a change in the market") is true of a renaming whether or not the line steps,
  and the row's summary says why it does not. (3) A new mechanism value: the enum is the schema; not needed.
- Decision: (2). The same commit shortens the 63-character ESC title to "Stability control required on all new light
  vehicles" (52; STATE known issue 3).
- Consequences: on `brand-share`, the KGM marker draws as a dashed, darker rule with the measurement warning in its list
  entry. `expected_effect` stays `none`.
- Status: decided by Claude (unreviewed)

## D-050 2026-10-22 — Manufacturer group is high cardinality, so a 12-month window ranks it
- Agent: claude, CHECKPOINT queue item 5 (the question D-045 left open)
- Basis: branch `claude/post-gate-fixes` (the `config/dimensions.json` commit); the 2026-08 cube; `src/lib/resolve.ts`
  `inferShape` and `src/lib/composition.ts`; headless screenshots on 2026-10-22 with that branch's `dimensions.json` in a
  scratch worktree over the dry-run cube.
- Context: D-045 left manufacturer group a mix chart on `/build` because `dimensions.json` called it medium; `inferShape`
  draws a league only for high and very high cardinality.
- Measured: 43 named groups in the 2026-08 cube, every one with vehicles in the last 12 months, the 14 largest holding
  88.3% of those vehicles (`__UNMAPPED__`, 212 vehicles, besides). For comparison, make has 99 values (high), country
  where built 46 (medium), region 18 (medium).
- Options considered: (1) leave medium: the Build page ranks brands but not manufacturer groups. (2) High, for
  `parent_group` only: chosen; a 12-month window ranks like brands, and longer periods are unchanged. (3) A count
  threshold in code: cardinality is config, and a threshold would also turn country where built (46) into a ranking,
  which asks a different question.
- Decision: (2). The pipeline never reads cardinality, so the cube and the golden contract are unchanged.
- Consequences: measured headless, `/build` "the share of vehicles by manufacturer group" offers "12-month ranking":
  Toyota Group 29.9%, Nissan Motor 7.6%, Mazda Motor Corporation 7.0% (up one place), Ford Motor Company 6.7% (down one),
  Mitsubishi Motors 6.6%. Explore's `brand-share`, manufacturer group view, keeps its 10-year line chart and its time
  row. No sideways scroll at 320px. The composition start applies to low cardinality only, so nothing else moves. The
  `$ranking_period_comment` in `config/presets.json` says manufacturer group stays a mix chart: correct it when this
  merges.
- Status: decided by Claude (unreviewed)

## D-051 2026-10-22 — The golden build reads frozen events, so adding an event is not a contract change
- Agent: claude, CHECKPOINT queue item 5 (POST_GATE B3), after an independent review
- Basis: branch `claude/post-gate-fixes` (the B1-B3 commit): `pipeline/tests/test_golden.py`,
  `pipeline/tests/fixtures/events.csv`, `docs/CUBE_SCHEMA.md`; design invariant 3.
- Context: B3 asked the golden test to stop dropping `payload_bytes`, so that a change in what the site downloads never
  passes unnoticed. `payload_bytes` counts `events.json`, and the golden built it from the live
  `data/reference/events.csv`. With B3 as written, every new event row would fail the golden test, and a row committed
  straight to `main` would fail the next monthly run's test step, so nothing would build that month. Invariant 3 says
  adding an event is one CSV row. An independent review found this; the first build of the stack had needed a golden
  update for an `events.csv` edit.
- Options considered: (1) drop `payload_bytes` again: undoes B3. (2) Leave `events.json` out of the compared size: the
  golden would still miss a change in how `events.json` is written. (3) Build the golden with a frozen copy of six real
  rows (windowed, market-wide, make-scoped, import-status and measurement events, and one unverified row) and lock the
  `events.json` it produces in the contract: chosen. The live file is still validated by every guardrail test's build
  and by every run.
- Decision: (3).
- Consequences: the golden's `payload_bytes` is 31,487, measured with the five verified fixture events. A change to how
  `events.json` is written (a column published, a field renamed) now fails the golden. The fixture will drift from the
  live file; that is intended.
- Status: decided by Claude (unreviewed)

## D-052 2026-10-22 — "Change this chart" opens an Explore chart on the Build page, and every renderer shares one readout
- Agent: claude, CHECKPOINT queue item 7
- Basis: branch `claude/explore-build-together`: `src/lib/builder.ts` (`builderChoiceFor`, `builderHref`),
  `src/components/PresetPanel.tsx`, `src/lib/readout.ts` and the four renderers; headless checks on 2026-10-22 against
  the 2026-08 cube.
- Context: item 7 asked for a "change this chart" link on each Explore chart the builder can express, opening `/build`
  with the sentence filled in, and the same hover readout in all four renderers. Before, the mix chart's tooltip gave
  series, month and share; the trend line month, value and the top five; the distribution only band and figure, with no
  period or vehicles; the league rank, count, share, move and change.
- Options considered:
  - Which charts get the link: (1) every chart: `powertrain-mix` asks for light passenger vehicles, which the sentence
    cannot say, so its link would open a different chart. (2) Only views the builder draws exactly: its dataset, a
    measure it offers with this breakdown, the same cap on named values, no filter, not composite, and a built sentence
    that draws: chosen.
  - What the link carries: (1) the sentence only. (2) The sentence and the time range shown, left out where it equals
    the sentence's own default: chosen, so the chart opens as the reader left it. Smoothing is not carried: the chart
    holds it, not the panel.
  - The readout: (1) align each renderer's own text by hand: four copies drift apart again. (2) One helper that fixes
    the order and wording, each renderer passing what it knows: chosen.
- Decision: as above. The link reads "Change this chart", beside "Copy link to this chart", and names the chart's
  question for screen readers (`aria-describedby`), so six identical links can be told apart. Every readout reads: what
  the point is; the period it covers; the figure with the vehicles behind it ("39.8% · 2,282 of 5,732 vehicles"); why it
  is greyed, if it is; then anything only that chart has.
- Consequences: measured headless at 320px and 1280px: five of the six Explore charts carry the link (not
  `powertrain-mix`); `brand-share` follows its "Show by" choice; two followed links landed on the same sentence and time
  range. Readout fields by renderer: mix (series; month, or "12 months to" a month; share · n of base; greyed reason),
  trend (the derived measure's label; month; share · n of base; greyed reason; the five largest), distribution
  (breakdown and band; the span; share · n of base; greyed when the window is thin), league (rank and name; the span;
  share · n of base; move; change in share). A greyed point now says which guard greyed it. No console errors, no
  sideways scroll. Only Chromium was run.
- Status: decided by Claude (unreviewed)

## D-053 2026-10-22 — The site serves filtered datasets and preset filters from pair slices, built against a dry-run cube
- Agent: claude, under D-043 (the site's side of POST_GATE A1 and A3)
- Basis: branch `claude/pair-views`: `src/lib/data.ts` (`narrowPair`, `loadView`), `src/lib/resolve.ts` (`servedFrom`,
  `findPair`, the view source), `src/lib/notes.ts`, `src/components/PresetPanel.tsx`, `src/components/DistributionChart.tsx`,
  `config/presets.json`; headless checks on 2026-10-22 against the published 2026-08 cube, and against a dry-run cube
  with both pairs plus A3's `config/dimensions.json` in a scratch worktree.
- Context: the pipeline branches emit pair slices (D-047) and `segment_group` (POST_GATE A3). The site read 1-D slices
  only, so `used_imports` could not be served and `powertrain-mix`'s filter was described, not applied. STATE known
  issue 4: `PresetPanel` hid the time row for the dataset id "used_imports", in code.
- Options considered:
  - Where narrowing happens: (1) in each renderer. (2) Once, where rows are loaded, so the renderers keep reading slice
    rows: chosen.
  - Which filter a view takes: a pair is two-dimensional, so one. The dataset's own filter first, since without it the
    chart is a different dataset, then the preset's first filter.
  - A missing pair: a filtered dataset draws nothing, since its base would be a different chart; a preset filter draws
    the chart un-narrowed and says so, as before.
  - `used-import-age`'s measure: (1) count, as authored. (2) Share: chosen. On survivors data a count reads as sales
    (D-044), and the chart's time row now reaches back years, where scrappage thins counts.
  - `age-distribution-moving-hole`: with pairs it would draw one all-time histogram, which smears the moving cutoff
    across the years it moved through. A resolver rule blocks any preset with `animate_by` until a renderer draws a
    distribution year by year.
  - The time row: a preset's own period becomes a span of its own when it is none of the spans and does not rank the
    chart (`used-import-age`: "12 months, 3 years, 5 years, 10 years, All time"). This replaces the dataset id in code.
- Decision: as above. Authored statuses stay as they are: they describe the published cube, which has no pairs until the
  pipeline branches merge after the gate. `/status` then shows "Status out of date" for `used-import-age` and
  `powertrain-mix`, which is the signal to flip them.
- Consequences: against the published cube, Explore is unchanged (six charts, the same time rows) and every preset
  resolves to its authored status. Against the dry-run cube: `used-import-age` draws on Explore (91,521 used imports
  over the last 12 months, 59% aged 9 to 13); `powertrain-mix` applies its filter, its key matching the light-passenger
  shares computed in DuckDB (hybrid 37.9%, petrol 37.8%, BEV 8.9%, diesel 4.8%, against diesel's 16.7% across all
  vehicles) and opening in Aug 2009 instead of Oct 2009; `age-distribution-moving-hole` stays blocked. Found while
  checking and fixed on the same branch: the grey-months note no longer appears on distributions, which grey a whole
  window or nothing, and at 320px a distribution labels every step-th band so labels do not run together (age when
  first registered: 0, 3 ... 18, 25+). Not changed: on a filtered powertrain chart the mild hybrid coverage note gives
  the whole dataset's coverage, not light passenger vehicles' alone.
- Status: decided by Claude (unreviewed)

## D-054 2026-10-22 — The map: Stats NZ's coastline-clipped region outlines, refreshed by a script, offered on the Build page only
- Agent: claude, CHECKPOINT queue item 10
- Basis: branch `claude/geo-map`: `scripts/region-boundaries.mjs`, `public/geo/nz-regions.json`,
  `src/components/GeoChart.tsx`, `config/presets.json` (`builder`); Stats NZ's ArcGIS items "REGC2023" and "Regional
  Council 2025" (owner StatsNZGeospatial) and the data.govt.nz catalogue entries "Regional Council 2023 Clipped
  (generalised)" and "Regional Council 2025 Clipped" (both CC BY 4.0), read on 2026-10-22; headless checks of `/build`
  against the 2026-08 cube.
- Context: item 10 asked for the fifth renderer, for region; a New Zealand region boundary file, with its source and
  licence on record; and the Build page's "Regions" not-offered line turned into a note shown with region charts.
- Options considered:
  - Source: (1) Stats NZ's definitive Regional Council 2025 layer: CC BY 4.0 on its ArcGIS item, but its regions run
    out to the 12-mile territorial limit (Auckland 16,156 km² against 4,940 km² of land), so the map's coastline would
    sit in the sea. (2) Stats NZ's coastline-clipped 2023 layer on its own ArcGIS service ("REGC2023"): the same 17
    region codes as 2025; the series is CC BY 4.0 on data.govt.nz, though the ArcGIS item states no licence of its
    own: chosen. (3) Natural Earth (public domain): coarser, older names. (4) Stats NZ's Datafinder export: needs an
    account, so no script can fetch it.
  - Keeping it current: a script in a new top-level `scripts/` folder, run by hand, rather than a hand-made file. It
    fetches the outlines, simplifies them for a chart a few hundred pixels wide, winds them as D3 expects, leaves off
    the Chatham Islands (they lie across the 180th meridian, so a map fitted to them spans the globe), and refuses to
    write unless every region matches `data/reference/tla_region.csv` by code and name.
  - Where the map appears: (1) an Explore preset: D-024 cut the regional presets because the TLA is the owner's current
    address, and bringing one back is the user's call. (2) The Build page only, with that reason as the region note:
    chosen.
  - What it measures: share over the period, which largely follows where people live. Registrations per resident need
    population figures (`docs/METRICS.md`, Per capita), which the cube does not carry.
  - Projection: transverse Mercator on 173°E, the central meridian of New Zealand's own NZTM2000.
- Decision: as above. "Show the share of vehicles by owner's region" opens on the last 12 months, with the time row's
  usual spans; the table beside the map is also the chart's text equivalent.
- Consequences: the file is 75,957 bytes (16 regions, 4,155 points) and is fetched only by a map. The Chatham Islands
  ("Area Outside Region", 4 vehicles in the last 12 months) and "Not recorded" are in the table, not on the map, and the
  chart says so. Measured on the 2026-08 cube over the last 12 months: Auckland 44.3%, Canterbury 13.3%, Waikato 9.0%;
  over all time Auckland holds 31.9%. Under the map: "Region outlines: Stats NZ, Regional Council 2023 (clipped), CC BY
  4.0." That the ArcGIS copy carries the catalogue's licence is inferred: confirm. "Area Outside Region" is Stats NZ's
  name for the Chatham Islands; a visitor-facing name would need a value-label setting in config, not built here.
- Status: decided by Claude (unreviewed)

## D-055 2026-10-22 — Deploying to Cloudflare Pages: how the cube reaches the site (proposed)
- Agent: claude, CHECKPOINT queue item 8. Proposed only: deploys and platform consoles need the user (stop list), and
  item 8 waits for the 8 November gate (D-041, AGENTS.md rule 8).
- Basis: `.github/workflows/monthly-build.yml`, `src/pages/index.astro`, `src/pages/build.astro`, `.gitignore`, and the
  repository's artifacts (`gh api .../actions/artifacts`), read on 2026-10-22; `CLAUDE.md` §Stack (Cloudflare Pages).
- Context, as checked:
  - The site reads `public/data` when it is built (`index.astro` and `build.astro` import `public/data/manifest.json`)
    and when it runs, and `public/data` is gitignored.
  - The monthly build already uploads the cube it builds as an artifact, `public-data-<snapshot>`, kept 90 days:
    `public-data-2026-09` (1,219,368 bytes, expires 2027-01-06) and `public-data-2026-08` (expires 2026-12-10). A run
    that finds the source unchanged builds nothing and uploads nothing.
  - The site's code is on `ui/explore`, not `main`, and workflows run from `main`, so `ui/explore` must reach `main`
    first (CHECKPOINT item 6).
  - The production build is 2.9 MB in all, the cube included (measured on 2026-10-22).
- Options:
  - (A) Cloudflare Pages' own Git integration builds every push to `main`, with the cube committed to the repository by
    the monthly run. Fewest moving parts, but about 1.3 MB of binary Parquet joins git history each built month, and a
    rule changes: `public/data` stops being gitignored.
  - (B) A `deploy.yml` workflow that builds the site on GitHub's runner and uploads it with Cloudflare's `wrangler pages
    deploy` (Direct Upload). Triggers: a push to `main` that touches the site, the end of a successful monthly build,
    and by hand. The cube comes from the newest `public-data-*` artifact. Simple, but if no build runs for 90 days
    (three unchanged months) the artifact expires and a site change cannot deploy.
  - (C) As (B), but the monthly build also attaches the cube to a GitHub release, `cube-<snapshot>`, which does not
    expire, and `deploy.yml` takes the newest release. One more step in the monthly workflow; nothing binary in git.
- Recommendation: (C). It keeps `public/data` out of git, the cube that is deployed is always the one a monthly run
  built and checked, and the site and the data can each redeploy without the other.
- What the user would do (Cloudflare console and GitHub settings, production): create a Pages project for Direct Upload
  and choose its name (it becomes `<name>.pages.dev`); create an API token limited to Cloudflare Pages: Edit on the
  account; add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions secrets. Exact steps follow once an
  option is chosen.
- Open with it: whether `/status` and `/sense-check`, internal pages linked from the footer and marked noindex, ship
  with a public deploy (D-028 left this open).
- Status: proposed, awaiting the user

## D-056 2026-10-22 — Deploy by D-055's option (C), without the internal pages
- Agent: user (the choice), claude (the details)
- Basis: the user's answer on 2026-10-22 to CHECKPOINT question 2 ("do what you recommend"); branch
  `claude/deploy-workflow` (`.github/workflows/deploy.yml`, a release step in `monthly-build.yml`); `src/lib/site.ts`,
  `src/layouts/Layout.astro` and `src/pages/caveats.astro` on `claude/deploy-proposal`; checks on 2026-10-22.
- Decision (user): option (C) of D-055, which this accepts. Each built monthly run keeps its cube as a GitHub release,
  and a deploy workflow builds the site from the newest one and uploads it to Cloudflare Pages. `/status` and
  `/sense-check` stay off the public site.
- Decision (Claude, unreviewed), the details:
  - The monthly build attaches `public-data.tar.gz` to a release `cube-<snapshot>`; a second build of the same
    snapshot replaces the file.
  - `deploy.yml` runs after a successful monthly build on `main`, on a push to `main` that changes the site, and by
    hand. It takes the newest `cube-*` release by name, or, before the first release exists, the newest unexpired
    `public-data-*` artifact. It builds with `INTERNAL_PAGES=false`, which drops every link to the internal pages, and
    removes the two pages from the build. It uploads with `wrangler` 4.148.0 (released 2026-10-06, pinned) to the
    Pages project named by the repository variable `CLOUDFLARE_PAGES_PROJECT`, `nz-vehicle-registrations` if unset.
    Without the `CLOUDFLARE_API_TOKEN` secret it builds and stops, so it checks the build until the upload is set up.
  - Permissions: read only (contents, and actions for the artifact); the Cloudflare secrets reach only the upload step.
- Consequences: nothing runs before the 8 November gate passes, the pipeline stack with `claude/deploy-workflow` on top
  merges into `main`, and `ui/explore` reaches `main` (CHECKPOINT item 4). Checked locally on 2026-10-22: the
  workflow's cube step, run with `gh` against this repository, found no release and took `public-data-2026-09`
  (snapshot 2026-09-30); the public build from it has four pages and no link to an internal page, and in a preview
  `/status` and `/sense-check` return 404 while every chart on `/` and the map draw with no console errors. Not
  checkable before the merge: the release step, and the upload itself. The user's console steps follow the gate:
  create a Pages project for Direct Upload (named `nz-vehicle-registrations`, or set `CLOUDFLARE_PAGES_PROJECT`), an
  API token limited to Cloudflare Pages: Edit, and the two GitHub secrets.
- Status: user decided option (C) and the internal pages; the details are decided by Claude (unreviewed)

## D-057 2026-10-22 — What the independent review of the six pushed branches changed
- Agent: claude, CHECKPOINT queue item 1
- Basis: three read-only sub-agent reviews on 2026-10-22 of `claude/explore-build-together` to
  `claude/deploy-proposal` and of `claude/deploy-workflow`; the fix commits on those branches, each checked as its
  message says (headless Chromium at 320px and 1280px, axe-core 4.10.3, `tsc --noEmit`, `astro build`, the pipeline's
  workflow test).
- Context: the global rules ask for an independent review before a pull request opens. Each real finding was fixed on
  the branch that introduced it, and that branch was merged forward into the ones stacked on it: no rebase and no force
  push, since the branches were already pushed.
- Decision, by branch:
  - `claude/pair-views`: a chart narrowed by a preset filter says so after its definition ("Only “Light passenger”
    vehicles are counted."), rather than in a callout, which would style a scope as a warning. The visitor note for age
    when first registered says longer spans count survivors, rather than `used-import-age` losing its longer spans:
    D-053 chose to offer every span, and D-032 is to say what the data does. A view that loads no rows shows "Nothing
    to draw" instead of drawing.
  - `claude/a11y-pass`: trend and distribution charts end with "The figures behind this chart", a disclosure holding
    every drawn month or band, built only when opened, rather than a visible table, which would put up to 1,195 rows
    under the concentration chart.
  - `claude/geo-map`: a square-root colour scale, which keeps the legend continuous (a binned scale was the other
    option), with borders in muted ink. Each region's readout is its shape's own title, the browser's tooltip, rather
    than Plot's tip, which snapped to the nearest region's centre; it looks unlike the other charts' readouts and does
    not show on a touch screen, where the table serves. An outline the data does not name is left unshaded and named.
    The credit links CC BY 4.0 and says the outlines were simplified. The table heads its counts "Still registered".
    The region note says owners are placed by district. The script finds the Chatham Islands by geometry, not by code.
  - `claude/deploy-workflow`: the cube release follows the state commit and runs on `main` only. `deploy.yml` stops
    before building on a ref without `src/lib/site.ts`, uploads from `main` only, groups runs per ref, takes the newest
    published `cube-YYYY-MM` release that holds `public-data.tar.gz`, and fails if the public build links to an
    internal page. Wrangler is pinned by its own lockfile in `.github/deploy/` rather than as a site devDependency:
    installed it is 184 MB, which every local install would carry for a tool only the deploy uses.
  - `claude/deploy-proposal`: a 404 page, so that Cloudflare Pages answers an unknown address with a 404.
- Corrections to earlier entries: D-056 said nothing runs before `ui/explore` reaches `main`, but the push that merges
  the pipeline stack would have started `deploy.yml` on `main`'s old reference page; the site check now stops it.
  D-056's "`/status` and `/sense-check` return 404" held only for a preview: on Cloudflare Pages, without a 404 page,
  both would have returned Explore with a 200. D-054's outline file is now 76,017 bytes (was 75,957): the same 16
  regions and 4,155 points, with a longer source line.
- Not taken: the map draws a share whatever the measure, but no configured sentence sends another measure to it. The
  status page's script still ships in the public build, unlinked and holding no data. The deploy is one job, not a
  build job and an upload job, and its actions keep major-version tags as `monthly-build.yml` does (D-012). Keeping the
  Cloudflare secrets in a GitHub environment limited to `main` is offered with the console steps (CHECKPOINT item 7)
  rather than required by the workflow. A filtered trend's readout would name "All vehicles", but no trend preset has
  a filter.
- Consequences: the six pull requests carry these fixes. On the published 2026-08 cube, Explore changes only by the
  concentration chart's disclosure; the Build page gains the disclosure on distributions, the age note's sentence and
  the map's changes. The narrowed-chart line shows once a build carries the pairs (D-053).
- Status: decided by Claude (unreviewed)

## D-058 2026-10-22 — Free exploration: one fact table the browser aggregates, and a question builder over it (proposed)
- Agent: claude, at the user's request: "the underlying platform of this site must let users create their own story";
  their example was BYD and Geely registrations over time, by share and by count.
- Basis: measured on 2026-10-22 from the staged build of the saved 2026-08 pull (`data/staging/work.duckdb`, table
  `dims`), copied to a scratch folder; the npm registry; Cloudflare's Pages docs ("Serving Pages", updated 2026-10-10,
  and "Limits"); a throwaway prototype timed in headless Chromium. Nothing in the repo was changed by the measurements.
- Context: why the site is not flexible. The data was never the limit: `make` and `parent_group` are in the published
  cube by month since 1912 (BYD 15,155 still registered, Geely Holding 25,951). The limits are design choices:
  1. The brief chose them: Build is "a constrained sentence-builder", there is no SQL console, and the shape is
     inferred so "the user never picks a chart type" (CLAUDE.md).
  2. The cube holds one dimension per file, plus pairs added one at a time (D-047). A question that crosses
     dimensions, such as BYD among battery EVs in Auckland, has no file until the pipeline adds that pair, and each pair
     is a pipeline change behind the gate.
  3. The builder picks a dimension, never values: a visitor cannot name BYD and Geely Holding, and high-cardinality
     dimensions are cut to a top N with the rest folded (D-050).
  4. The builder offers share only (D-044).
  5. Explore is a fixed canon of presets.
- Measured:
  - A fact table of `registrations_surviving`: rows grouped by month and eleven dimensions (make, parent group, owner
    country, model as capped by the pipeline, powertrain, import status, region, segment, built in, engine size band,
    age at registration band) with a count. 1,729,052 rows summing to 4,502,964, the dataset's row count; BYD and Geely
    Holding total the same as the cube. 5.45 MB as Parquet with zstd, 7.31 MB with snappy.
  - Column sizes, snappy: model 1.37 MB, region 1.09, age band 1.00, count 0.94, engine band 0.85, built in 0.53,
    powertrain 0.44, segment 0.37, import status 0.34, make 0.13, parent group 0.11, owner country 0.08, month 0.01.
    The BYD and Geely question needs month, parent group and count: 1.06 MB.
  - Prototype: BYD and Geely Holding, monthly count and share since 2018, served locally with brotli. "Phone" is the
    STATE known issue 1 profile (390px, 150 ms latency, 1.6 Mbps, CPU slowed four times).
    - DuckDB-Wasm 1.32.0: the engine is 34.2 MB (5.2 MB brotli), and the first query fetches its Parquet extension from
      extensions.duckdb.org (about 8 s). Drawn after 12.3 s on desktop and 60.8 s on the phone profile; a second,
      different query took 20 ms.
    - hyparquet 1.31.5 (already a site dependency) and plain JavaScript: drawn after 2.7 s on desktop and 33.5 s on
      the phone profile, 29.1 s of it downloading the whole 7.3 MB file.
    - Both gave BYD 6,145 and Geely Holding 2,740 of 234,328 vehicles in the 12 months to August 2026.
  - Cloudflare Pages: 25 MiB at most per file; a range request gets the whole file with a 200, not a 206.
- Options considered:
  - Engine:
    - (a) DuckDB-Wasm (MIT): full SQL and the fastest repeat queries. Its engine file is over Pages' 25 MiB, so it would
      load from a CDN, and it fetches extensions from duckdb.org: two outside services. Slowest first load. Its last
      stable release is 1.32.0 (December 2025); npm's `latest` tag is a dev build. Mosaic (`@uwdata/vgplot` 0.34.0,
      BSD-3) builds on it and carries the same costs. Not chosen.
    - (b) Perspective 3.8.0 (FINOS, Apache-2.0): a pivot engine with a complete pivot-and-chart interface, about 3.3 MB
      of Wasm, reading Arrow rather than Parquet. Its interface is built for analysts. A candidate for a later
      "pivot table" view for power users, not the main surface.
    - (c) Graphic Walker 0.5.3 (Kanaries, Apache-2.0): Tableau-style drag and drop over Vega-Lite, about 400 KB gzipped
      by its docs, which advise server-side computation above about 100,000 rows, so it would sit on our own
      aggregation. Drag and drop asks a visitor to know what a field and an encoding are. Not chosen.
    - (d) Server BI (Superset, Metabase): needs a server and a running cost, which the brief rules out.
    - (e) hyparquet with our own aggregation, drawn by Observable Plot: both already dependencies, no outside service,
      fits Pages. Chosen.
  - Delivery without range requests: the fact table published as one file per column, in the same row order, so a
    question downloads only its columns (1.06 MB for the example). The existing small cube files stay for Explore's
    first paint.
  - Surface: a question builder. Measure: count, share, or both as two charts one above the other (never two axes).
    Compare: any values of any dimension, found by typing (BYD, Geely Holding, a model, a region). Filter: by any other
    dimension. Time: month, quarter or year, with or without 12-month rolling, over any range. A table view, a CSV of
    exactly what is drawn, and a link that reopens the view. Drawn by the existing renderers, with the shape inferred
    and switchable among the shapes that fit the question. The events layer and the definition line on every view.
- Decision: proposed; needs the user's approval because it changes hard rules (below).
- Consequences:
  - Hard rules it changes: CLAUDE.md's "constrained sentence-builder" becomes a question builder; §Shapes' "the user
    never picks a chart type" becomes "the shape is inferred, and the visitor may switch among the shapes that fit";
    invariant 6 keeps "the browser never scans raw data" (the fact table holds counts, no vehicle rows), with
    "precompute everything" read as "precompute the fact table". The five renderers stay; no sixth.
  - The fact table is a cube contract change (`docs/CUBE_SCHEMA.md`, pipeline outputs, golden test), frozen until the
    8 November gate; built before it on a branch from `main` (D-043). The builder is UI work (D-041).
  - Risks: cells as small as one vehicle (the source register is already public vehicle by vehicle, with no owner
    data); free comparison makes `registrations_surviving` easier to misread as sales, so every view keeps its
    definition line. First load on the phone profile for a three-column question is estimated at 5 to 6 s from 1.06 MB
    at 1.6 Mbps: not measured.
  - Not built or measured: the per-column split, the builder, and the parent-group and owner-country columns as
    browser-side lookups from `brand_registry.csv` instead of stored columns.
  - The look-and-feel board of 2026-10-22 (CHECKPOINT) is set aside: the user judged the site's flexibility, not its
    look, to be the problem.
- Status: proposed

## D-059 2026-10-22 — The user approves D-058's three rule changes
- Agent: user ("1, do all three", answering CHECKPOINT question 2 in session).
- Basis: this session.
- Context: D-058 proposed free exploration and listed three changes to hard rules.
- Decision: all three are approved. (a) Build becomes a question builder in place of the constrained sentence.
  (b) Where more than one of the five shapes fits a question, the visitor may switch among them; the shape is still
  inferred first, and no sixth is added. (c) The pipeline publishes a fact table of counts, one file per column, beside
  the slices. CLAUDE.md's opening, invariant 6 and §Shapes are reworded to match in the same commit.
- Consequences: D-058's status becomes accepted through this entry (D-058 itself is not edited). The fact table is
  pipeline work, built on `claude/fact-table` from `claude/deploy-workflow` and unmerged until the 8 November gate
  (D-043); the builder is UI work on the UI stack (D-041). The golden contract changes with the fact table and is shown
  to the user (AGENTS.md hard rule 4).
- Status: accepted, decided by user

## D-060 2026-10-22 — The question builder: what it asks, and the choices inside it
- Agent: claude, building D-058 under D-059.
- Basis: branches `claude/fact-table` (the fact table) and `claude/question-builder`; headless checks on 2026-10-22
  against a dry-run build of the saved 2026-08 pull that carries the fact table.
- Context: D-059 approved a question builder over a fact table. These are the choices made building it that a
  reviewer could want to reverse.
- Decision:
  - A question is a measure, a breakdown, the values of that breakdown to compare, and conditions ("Only vehicles
    where"), each a dimension and the values it keeps. Values and conditions are summed in the browser from the fact
    table (`factView` in `src/lib/data.ts`); a question with neither reads the slices, as before.
  - Measures: share, number (count), share and number (two charts, one above the other, never two axes), and the
    share of the 5 largest. Count is offered now, with the note that these are vehicles still registered, not sales,
    and that older months are thinned by scrappage; D-044 had withheld it. Models are offered, with the existing note
    on the model cap.
  - A count broken down draws one line per chosen value (the trend renderer, extended to several lines: still the
    trend shape). With none chosen it starts on the five largest in the last 12 months, which the visitor can change.
    A share with no values chosen draws the canon's mix chart, the largest values with the rest as All other.
  - At most 8 values at once: the palette has eight colours that stay distinguishable (`src/lib/theme.ts`).
  - A question that names values opens on 10 years (`period_when_comparing` in `config/presets.json`), not all time:
    most named values have little history before that. The time row still offers all time.
  - Count lines take colours by vehicles in the last 12 months, largest first, the rule the mix chart uses for its
    first slots, so a value wears the same colour on the share and the count chart.
  - "Show as" offers lines over time beside a map or a distribution, where a share is broken down by region or a
    band: the only places a second shape fits today. A ranking stays in the time row, as before (D-045).
  - Value lists come from the 1-D slices, largest in the last 12 months first, then largest over all time, so a brand
    no longer sold can still be found by typing.
  - A condition on a dimension the fact table lacks, or the config does not define, blocks the chart rather than
    being dropped: a chart quietly missing a filter answers a different question. So Explore's light-passenger
    powertrain chart offers no "Change this chart" link until `segment_group` is defined in `config/dimensions.json`
    (pull request #28).
  - The question lives in the address bar (`build.measure`, `build.by`, a `build.value` per value, a
    `build.where.<dimension>` per kept value, `build.view`), so "Copy link" shares it. Explore's links use the same form.
  - The old sentence builder (`SentenceBuilder.tsx`) is removed; `builder.ts` keeps its role with a question in place
    of a choice.
- Not done: a 12-month running total on count comparisons (the trend renderer offers it to `rolling_12m` presets
  only); events scoped to a parent group appear only where their scope matches the breakdown; aggregation runs on the
  main thread, not in a worker; first load of a fact-table question has not been measured at the phone profile.
- Consequences: the Build page answers questions such as BYD and Geely Holding, by share and by number, over time, or
  the share of BYD, Tesla and Toyota among battery EVs. On the 2026-08 dry run each drew in about 1.6 to 2.5 s
  headless at 1280px and 390px against the local dev server, with no console errors and no sideways scroll.
- Status: decided by Claude (unreviewed)

## D-061 2026-10-22 — What the independent review of the fact table and the question builder changed
- Agent: claude. A sub-agent that had not seen the work reviewed both branches (`claude/fact-table`,
  `claude/question-builder`) and found 13 problems; each was checked and fixed on the branch it belongs to.
- Basis: headless checks on 2026-10-22 at 1280px and 320px against the 2026-08 dry run with the fact table: seven
  questions, axe (WCAG 2.1 A and AA) with no violations, no console errors, no sideways scroll; the fact-table, golden
  and pair tests (24 passed).
- Decision, site:
  - A number broken down always draws lines (trend), whatever the breakdown's own shape: the map and the distribution
    draw shares only, so "the number of vehicles by owner's region" had drawn a share map. "Show as" applies to the
    share chart only. This extends D-060.
  - Chosen values are never ranked: a ranking of three hand-picked brands read as their place in the market.
  - Count copy says what is counted: "Vehicles first registered each month, still registered", and "N first
    registered in the last 12 months" beside each value, not "N in the last 12 months".
  - The fact table's view has every month, with a denominator of 0 where the conditions keep nothing, so a narrow
    count runs through true zeros instead of breaking; a share there is still left blank.
  - Starting values and the figures beside each suggestion are counted among the vehicles the other conditions keep.
  - Values from the address bar are de-duplicated and capped at 8. A condition on the breakdown itself becomes the
    values compared instead of being dropped. Both charts' settings clear when the question changes.
  - Late work (starting values arriving) builds on the question as it is then, not as it was when it started, so a
    condition added meanwhile is kept.
  - "Add a condition on" is a select and an Add button: a select that acted on change added a condition per arrow key.
    Focus returns to the search box after a value is added or removed, and to the select after a condition is removed;
    each remove button names its condition; remove targets are 44px.
  - A small count's axis ticks are whole vehicles.
- Decision, pipeline: an empty `facts` list aborts (it reached DuckDB as a syntax error); a table whose dimensions are
  all waiting holds the month totals alone; a new test adds copies of one vehicle and checks they share a row, since no
  fixture vehicle shared a cell and a table that stopped grouping would have passed.
- Status: decided by Claude (unreviewed)

## D-062 2026-11-13 — CLAUDE.md for the next stage: the goal, generated narrative, model-level lookups, explicit sub-agent models

- Agent: user, with Claude (claude.ai planning session; CLAUDE.md drafted there and reviewed by the user)
- Basis: user, in session on 2026-11-13. CLAUDE.md as on `claude/question-builder` (`06d727e`); `docs/brief/MASTER_BRIEF.md`;
  vstat.mta.org.nz read on 2026-11-13.
- Context: the user set the direction for the next stage:
  - the site should be the go-to place for reliable information on New Zealand's vehicle market, and visitors
    should digest an answer "without getting bogged down in irrelevant data";
  - everything the register carries should be askable, with visitors in control;
  - explanatory text must stay neutral and need no hand-writing per snapshot: "sets of phrases which explain the
    situation, with placeholders infilled with facts like brands, percentages or powertrains, built once";
  - a VFACTS-style segmentation and launch RRPs, which the register cannot supply;
  - infrastructure stays open until a prototype exists;
  - Claude Code sub-agents set their own model and never inherit the lead's.

  Several of these touch CLAUDE.md's invariants and non-goals, which AGENTS.md hard rule 1 says only the user may change.
- Options considered:
  1. Leave CLAUDE.md alone and record the direction only in the brief. Every agent reads CLAUDE.md first, so it
     would keep finding the direction in conflict with the non-goals ("written commentary") and with invariant 4.
  2. Reword the invariants broadly to fit the direction. That would loosen the rules that keep the site correct
     to fix a scope question.
  3. Make narrow, tagged edits, and state the goal once where every agent reads it.
- Decision: (3).
  - Audience: a second group is named beside non-analysts: analysts, the trade and informed buyers, who today
    download, clean, filter and redraw the register by hand every month. Explore sets the stage; Build is the
    full engine and must bend to any question the data can honestly answer.
  - New §The goal: one question, one clear answer, the evidence, the freedom to dig; nothing on the page that does
    not bear on the question. Nine rules for how a page reads (answer first; one question per view; only what
    bears on it; one-line caveats; defaults do the work; every figure one step from definition, source and
    snapshot; everything askable, little shown until asked; a field is defined in the data map before it is
    askable; a saved question keeps itself up to date).
  - Opening: no hand-written reports or commentary. The only prose about the data is generated (invariant 8).
  - Invariant 4 gains a paragraph. A lookup keyed on canonical make and model is a reference lookup, provided it
    guards coverage as make does: `__UNMAPPED__`, a trailing guard, live only above a threshold. It is maintained
    when a nameplate appears, never row by row.
  - Invariant 8 (new): words are data. Phrase templates in config are filled with facts computed by generic
    per-shape code, rendered deterministically with no model at run time. Templates carry no domain value,
    figure or year, say what and never why, and drop a sentence they cannot fill. It generalises `note_template`.
    A "(planned)" note says where the repo departs from it today: `/caveats` and `/method` state figures and
    names by hand (the D-040 convention).
  - §Shapes: which shapes fit a question comes from one rule table in config, read against each field's kind and
    number of values in the data map; no field lists its own charts; a table of figures is always available. A
    shape's look comes from the design system. A config-chosen variant inside a shape is not a sixth shape, and
    a new variant is still a decision.
  - Invariant 6 and §Stack (user, 2026-11-13: "a web page, desktop and mobile, with data being hosted and
    queried"): invariant 6 becomes "the browser never sees a vehicle row". The stage stays on precomputed
    files. The workbench asks a hosted query service that answers only with aggregates, only for fields the
    data map makes public, and never takes SQL from the browser. "No database, no API server, no runtime cost"
    now describes the stage only. Both carry a "(planned)" note: no service is chosen or built.
  - Chosen values may be ranked, labelled as ranked among the values the visitor picked, with one step to the
    same ranking over every value. This supersedes that point of D-061. (The user asked Claude to decide,
    2026-11-13; the user's own example question needs it.)
  - §Repo layout: planned `config/narrative/`, `model_segment.csv`, `docs/NARRATIVE.md`, `docs/DATA_MAP.md`,
    `docs/brief/MASTER_BRIEF.md` and `.claude/agents/`.
  - §Build order: steps 9 to 13 (the data map; the full engine; answer pages; what the industry expects; the rest
    only when a question needs it).
  - New §Sub-agents: an explicit `model:` in every definition, no `inherit`, checked by a test. Reviews stay
    independent.
  - Non-goals: "written commentary" becomes "hand-written commentary", with generated statements excluded.
    VIN11, CHASSIS7 and ENGINE_NUMBER never reach a published file.
- Consequences:
  - AGENTS.md hard rule 1 says "seven design invariants"; change it to "eight" in the same commit.
  - D-003 stands: `segment_map.csv` keeps no SUV segment. The model-level segment is a separate dimension.
  - Launch prices are allowed by invariant 4's new paragraph but are not planned work (the brief parks them).
  - `model_segment.csv`, `config/narrative/` and their pipeline, test and contract changes sit on frozen paths.
    They follow D-043 until the gate has passed, and each golden change follows hard rule 4.
  - A hosted query service has a running cost and must be kept up, which the project has avoided until now.
    Which service, its cost and its limits are a later decision on measurements (the brief, Stage 2).
  - Invariant 1 is enforced for `pipeline/*.py` only. A scan of `src/` and of templates is owed before
    invariant 8 can be called enforced.
  - Nothing is built by this entry. The work is queued through CHECKPOINT from the brief.
  - Reversing it: revert this commit. No code depends on it yet.
- Status: accepted, decided by user (when the user commits it with CLAUDE.md)

## D-063 2026-11-13 — The archive: keep each month's whole snapshot, every field, as one file outside git (proposed)
- Agent: claude, for the user to decide (the brief, Stage 0 item 4).
- Basis: measured on 2026-11-13 in a scratch folder: `data/snapshots/2026-08.parquet` and `2026-09.parquet` from
  `origin/main`; the staged build of the saved 2026-08 pull (`data/staging/work.duckdb`, table `src`, 5,905,376 rows,
  opened read-only); 83,951 rows first registered from August to October 2026, pulled once from NZTA's service at
  every field but the three identifiers (`POSTCODE` among them; the rows were deleted after sizing); Stats NZ's table
  `TPT052601` (D-065). Nothing in the repo was changed by the measurements. All sizes are Parquet with zstd, rows
  sorted.
- Context:
  - What a run keeps today: `data/snapshots/YYYY-MM.parquet`, counts by first-registration month, import status,
    vehicle type, motive power and make (279,294 rows and 531,545 bytes for 2026-08). The rows it pulled go with the
    runner. The cube is an artifact for 90 days, and a release once #35 merges.
  - What is lost when NZTA refreshes: the register **as it stood** at that month's end, at anything finer than that
    aggregate. Later snapshots still hold the month's registrations, less the vehicles removed since (0.16% in
    August's first month), and as they are recorded then, not as they were. What cannot be rebuilt is the snapshot
    itself: which vehicles were on the register that day by model, region or segment (what survival is computed
    from), each month as first observed, and any of the 23 fields the pull does not take.
  - A snapshot that is never built is not archived at all, at any grain (D-064).
- Measured:
  - **How much a month moves after it is first seen**, in the one month that can be measured. August 2026 held
    24,949 vehicles in the 2026-08 snapshot and 24,908 a month later: 41 fewer (0.16%). NEW fell 24 of 15,238 and
    USED 16 of 9,022. By make, 15 of 273 moved and none rose; Toyota fell most, 16 of 6,906. At the archive's own
    grain the cells differ by 65 vehicles in all, with 4 cells higher. The thirteen months before August each fell
    by 0.04% to 0.12%.
  - **Against Stats NZ**, cars, August 2026 as first seen: 9,136 NEW passenger cars/vans against Stats NZ's 9,138
    (99.98%), and 8,156 USED against 8,159 (99.96%). Stats NZ's figures come from NZTA's register too, so this shows
    two readings of one source agreeing, not an independent check.
  - **(a) The newest months at every bound field** (16, without `OBJECTID`), as rows: 1 month 24,949 rows, 96 KB;
    3 months 74,926 rows, 247 KB; 12 months 293,935 rows, 946 KB. Grouped into counts they are no smaller (3 months:
    41,370 groups, 237 KB). At every field but the identifiers (36), the three months to October 2026 are 651 KB:
    2.56 times the same rows at the bound fields (255 KB), or 2.17 times without `POSTCODE` (552 KB).
  - **(b) The whole-snapshot aggregate, widened.** With model: 1,056,643 rows, 4.6 MB. With district: 1,737,943 rows,
    2.7 MB. With body type and gross mass (what segment is derived from): 1,172,879 rows, 2.8 MB. With model and
    district: 3,041,829 rows, 9.0 MB. With all four: 3,801,887 rows, 14.0 MB.
  - **(c) The whole snapshot at the bound fields, as rows:** 22.6 MB (65.7 MB unsorted). Grouped into counts over the
    same fields: 4,219,010 groups, 21.4 MB, so an aggregate at this grain saves nothing. At every field but the
    identifiers and `POSTCODE`: **about 49 MB, an estimate** (22.6 MB times the 2.17 measured on the newest three
    months only; about 58 MB with `POSTCODE`).
- Options considered:
  1. (a) alone: commit the newest few months at every field. Small: 0.65 MB a run for three months. It gives
     registrations as first observed and nothing else: no survival by model, region or segment. At every field it is
     row-level data in git, which `data/snapshots/` has never held. A missed run loses that month's first
     observation; three missed runs in a row lose the month.
  2. (b) alone: widen the committed aggregate. 9 to 14 MB a month in git is 110 to 170 MB a year, too much for a
     repository meant to last ten years. It also fixes today's choice of fields: whatever is left out is lost.
  3. (c): keep the whole snapshot as one file, outside git. Everything in (a) and (b) can be computed from it later,
     at any grain, including for fields not yet bound. This goes further than the brief's (c), "the raw bound
     columns": the pull itself widens from 17 fields to 36.
  4. (c), with the committed aggregate left exactly as it is, because the guardrails compare with it.
- Decision: proposed, option 4.
  - Each built run writes the whole snapshot to one Parquet file: every source field except `VIN11`, `CHASSIS7`,
    `ENGINE_NUMBER`, `OBJECTID` and, until the user decides its privacy class, `POSTCODE` (`docs/DATA_MAP.md`); values
    as NZTA records them; rows sorted.
  - **Where the file is kept is the user's choice**, because it holds one row per vehicle:
    - (i) a release in a **private** GitHub repository, written by the run with a token kept as a secret.
      Recommended: it can be made public later, and publishing cannot be taken back. The repository and the token
      are the user's to set up. Not tested.
    - (ii) a public release on this repository, beside the cube (#35's release step).
    - (iii) nowhere on GitHub: the user downloads it from the run's artifact by hand within 90 days.
  - A month's file is never replaced (D-064).
  - Nothing else is widened now. Registrations as first observed (the brief, Stage 4) and survival by model, region
    and segment are built from these files when their stage comes.
- Consequences:
  - **If the file is public, vehicles can be followed from month to month.** NZTA publishes one current snapshot. A
    series of monthly files with the same fine fields (make, model, submodel, model codes, engine size, vehicle
    year, first-registration month, colour) would let one vehicle be picked out in each, showing its owner's
    district, usage and industry class changing over time. `docs/DATA_MAP.md` classes those three as public only
    above a minimum count, and CLAUDE.md's non-goals rule out vehicle-level lookup. That is why (i) is recommended.
    Under (ii) the file should leave out or coarsen the owner fields, which costs survival by district.
  - CLAUDE.md's "never raw rows" is said of `data/snapshots/` and invariant 6 of the browser; neither forbids a
    private file. The data is NZTA's open data under CC BY 4.0, and the file carries NZTA's attribution.
  - It changes `pipeline/`, `config/pipeline.json`, `.github/workflows/monthly-build.yml` and the tests: frozen
    paths, built under D-043. The published cube should not change (inferred — confirm when built), so no golden
    change is expected.
  - **It cannot reach `main` quickly.** It builds on the pipeline stack (#26 to #29, #35), so it waits for the user
    to lift the freeze and merge five pull requests in order, and it adds one more to a queue the brief wants
    held to five.
  - Not measured: the run's time and memory with a 36-field pull. On 8 October the run took 7m20s and peaked at
    2,546 MiB of 15,989 MiB with 17 fields. Per row the wider pull is more than twice the bytes.
  - GitHub allows 2 GiB per release file and sets no total (GitHub's documentation; not re-read this session).
  - A release can be deleted by hand and has no history. A second copy is the user's to keep.
  - **The 2026-10-31 snapshot.** The register holds it until NZTA's December refresh. A dispatched run (the user's
    decision) archives it at today's grain only. Capturing it at every field through the pipeline afterwards would
    take a forced rebuild of a month already built, which D-064's rule exists to stop. A one-off pull by hand into
    gitignored `data/raw/` is the practical way to keep it, and the user's to approve.
  - The 2026-09-30 snapshot was kept only as the committed aggregate. The 2026-08-31 snapshot survives at the 17
    bound fields in the saved local pull (`data/raw/2026-08/`, 177 MB, on one disk).
  - Reversing it: stop writing the file and delete the releases. Nothing reads them yet.
- Status: proposed

## D-064 2026-11-13 — The monthly run: try every day, build each month once, fail loudly when a month is missed (proposed)
- Agent: claude, for the user to decide (the brief, Stage 0 item 5).
- Basis: read on 2026-11-13: the three Monthly build runs' logs and the two cube artifacts' manifests (`gh`); NZTA's
  service, asked once with the run's own change-detection query from a scratch script that writes nothing;
  `.github/workflows/monthly-build.yml` and `pipeline/fetch.py` on `origin/main`.
- Context:
  - The run is set for the 8th at 06:17 UTC. The 8 November run (42484367432) was scheduled, green and skipped:
    "Source unchanged since the last good build (snapshot 2026-09-30)". 38 tests passed; 1m17s; peak memory 1,015 MiB.
  - NZTA refreshed the register the next day. The service's last edit is 2026-11-09 09:50 UTC, it now holds
    5,926,990 rows with 28,864 first registered in October 2026, and its change key differs from the last good one. A
    run today would build 2026-10.
  - The refresh has come later each month: the 2026-08 snapshot was last edited on 3 September, 2026-09 on 6 October,
    2026-10 on 9 November. GitHub started both scheduled runs about seven hours after the set time (13:25 and
    13:19 UTC).
  - Nothing tells anyone. A skip is a green run, so the site would stay a month behind until 8 December. If NZTA
    refreshes again before the next run, that snapshot is never built: `data/snapshots/` would have no 2026-10, the
    survival series would have a gap, and October would first be seen a month late.
- Options considered:
  1. Leave the schedule; the user dispatches by hand when a run skips. Costs nothing to build. It depends on someone
     noticing a green run that did nothing, which is how this month was missed.
  2. A window: daily from the 3rd to the 14th (the brief's example). 12 runs a month. It covers every refresh seen so
     far, with five days to spare after the latest. The window's edges are a guess from three months, and the refresh
     has moved three days later each month.
  3. Every day. One schedule line, no edge to tune, and a refresh is picked up within a day whenever it lands, which
     is what the brief's Fresh measure asks for (live within 2 days). About 30 runs a month, each 1m17s when it skips
     (measured on 8 November, 51 s of it the tests). It also runs the tests daily, so a broken dependency shows before
     the real run.
  4. Two runs, the 8th and the 15th. Fewer runs, but a month behind for up to a week, and still a guess.
- Decision: proposed, option 3, with two rules that a retry needs:
  - **Each month is built once.** With one run a month a snapshot could not be rebuilt by accident. With a daily run it
    could: if NZTA edits the register again in the same month, the change key differs and today's code would rebuild
    the same snapshot and overwrite its archive. So once a snapshot month is built, a later change to the source in
    that month is reported in the run summary and not built, unless the run is forced. This keeps
    `docs/DATA_SOURCES.md`'s rule: store every monthly snapshot and never overwrite.
  - **A missed month fails the run.** From the 15th, a run that finds the last good snapshot older than the previous
    month end fails with a message naming the missing month. Invariant 5 already says a missing month aborts; this
    applies it to the month that never arrived. A failed scheduled run should reach the user by GitHub's
    notification email (inferred — confirm: it depends on the user's notification settings). As drafted it fails
    every day until the month is built; whether once is enough is settled when it is built.
- Consequences:
  - It changes `.github/workflows/monthly-build.yml`, `pipeline/fetch.py`, a threshold in `config/pipeline.json` (the
    day the alarm starts) and their tests: all frozen paths. Built under D-043 on a branch from `main`, with a pull
    request that stays unmerged until the user lifts the freeze.
  - Runner time: about 40 minutes a month of skips (30 × 1m17s) plus one build (7m20s on 8 October). GitHub does not
    charge for standard runners on public repositories (GitHub's published terms; not re-read this session).
  - The Actions list gains about 30 green entries a month. The playbook's "built or skipped" check reads the same.
  - The first build of a month wins. If NZTA publishes a faulty refresh and corrects it days later, the correction
    needs a forced run, which is the user's to start.
  - The gate's wording ("the scheduled monthly runs on 8 October and 8 November") describes the old schedule. This
    entry does not change what the gate was.
  - Not decided here: whether October 2026 is built by a dispatch now. That is the user's (STATE, Blocked).
  - Reversing it: restore the one schedule line; the two rules are harmless with a monthly run.
- Status: proposed

## D-065 2026-11-13 — True registration totals from Stats NZ's Infoshare series now (drafted for the user to accept)
- Agent: claude, drafting the user's direction of 2026-11-13 (the brief §7) with the facts checked. The source and
  the hand export are the user's; the corrections and the option to script the fetch are Claude's.
- Basis: read on 2026-11-13: Infoshare (`infoshare.stats.govt.nz`), walked by a scratch script through its own browse
  pages, and table `TPT052601` exported from it as CSV; `stats.govt.nz/about-us/copyright/`;
  `stats.govt.nz/tools/we-are-changing-our-data-tools`; the Aotearoa Data Explorer's catalogue;
  `data/snapshots/2026-08.parquet` and `2026-09.parquet` on `origin/main`. Details: `docs/DATA_SOURCES.md` §C.
- Context:
  - The register holds survivors, so a count by first-registration month is not a count of registrations, and older
    months shrink (measured below). CLAUDE.md build step 1b planned `registrations_flow` from Stats NZ's transport
    series. On 2026-10-22 the series had no API and the user chose to wait for the Data Explorer. On 2026-11-13 the
    user chose to use it now.
  - What the series is: "New and Ex-Oseas Motor Vehicles Registered by Type (Monthly)", file `TPT052601`, table
    reference `TPT001AA`, last updated 19 October 2026, "Source: NZ Transport Agency". The cars total runs from
    January 1961 to September 2026.
  - What it does not have, which the brief's §7 table assumes it does:
    - New and ex-overseas are split **for cars only**, and only from July 1975. "New Cars and Station Wagons Total"
      and the seven engine-size bands all include the ex-overseas cars (August 2026: the bands sum to the total,
      17,297). Commercial vehicles (ten gross-mass bands), buses and motorcycles are not split.
    - There are no trailers, no brands, no fuels and no regions.
    - It publishes a month about two weeks after NZTA's service has it, on the one month observed: September 2026
      was in the service by 6 October and in the series on 19 October. On 13 November it has no October.
  - Where the two can be compared they agree. Cars, August 2026: Stats NZ 9,138 new and 8,159 ex-overseas; our
    2026-08 snapshot, taken days after the month ended, 9,136 `NEW` and 8,156 `USED` passenger cars/vans (99.98% and
    99.96%). Both come from NZTA's register, so this is agreement between two readings, not an independent check.
    For the nine months of 2026 in the 2026-09 snapshot the share runs from 98.8% to 99.98%.
  - Survivors of older years, cars, 2026-09 snapshot as a share of Stats NZ's registrations, new then ex-overseas:
    2025 99.2% and 98.0%; 2022 97.4% and 89.8%; 2018 94.8% and 73.8%; 2014 88.5% and 58.3%; 2010 76.9% and 34.8%;
    2005 50.1% and 17.0%; 2000 24.2% and 7.7%; 1990 5.6% and 2.3%. These assume Stats NZ's "cars and station wagons"
    and NZTA's "passenger car/van" have meant the same vehicles throughout, which was checked for 2026 only.
  - Licence: CC BY 4.0. Stats NZ's statement for adapted content: "This work is based on/includes Stats NZ's data
    which are licensed by Stats NZ for reuse under the Creative Commons Attribution 4.0 International licence."
  - Infoshare has no API and no stable link to a table: the address changes each session. It exports CSV. Stats NZ
    plans to replace it with the Data Explorer's time series in 2027; the Explorer's catalogue holds no transport
    series today (913 dataflows).
- Options considered (how the series is fetched):
  1. Keep waiting for the Data Explorer. No totals until 2027 at the earliest. Superseded by the user's direction.
  2. A hand export: the user downloads the CSV from Infoshare each month and a maintainer script checks it and writes
     the file the pipeline reads, as `scripts/region-boundaries.mjs` does for the map. The user's direction. One hand
     step a month.
  3. The maintainer script fetches it: one command that walks Infoshare's browse pages, asks for the CSV, checks it and
     writes the file. It worked on 2026-11-13 from a short scratch script. No clicking, but it drives a web form that
     is being retired, and whether Stats NZ's terms allow automated use of Infoshare was not checked.
  4. Figure.NZ's copy. A third party, behind Stats NZ, with edited headings. Not chosen.
- Decision (for the user to accept): the Stats NZ series is the source of true monthly totals now, by option 2: a
  maintainer script run by hand on a hand export, never by the pipeline. Option 3 can replace the hand step if the
  user wants it and the terms allow it.
  - It supersedes the 2026-10-22 choice to wait for the Data Explorer. When the series reaches the Explorer only the
    fetch changes.
  - Three sources, three jobs, never on one chart (the brief §7): Stats NZ for totals and the long-run volume;
    registrations as first observed for detail going forward (D-063); survivors for detail in the past.
  - Completeness is shown and never used to scale a figure. It can be shown for cars, new and ex-overseas, from July
    1975. For commercial vehicles and motorcycles it waits until Stats NZ's classes are lined up with NZTA's vehicle
    types, which is not done: August 2026 has 474 "New Motor Cycles" against 452 `NEW` motorcycles, and 3,548 total
    commercial vehicles (buses included) against 3,221 `NEW` and `USED` goods vehicles. It cannot be shown for
    trailers.
  - Every chart and CSV that uses the series carries Stats NZ's statement beside NZTA's attribution.
- Consequences:
  - The brief's §7 table says "Vehicle type and new/used only" and "January 1961 onward". Both are narrower in fact
    (above). The user updates the brief.
  - The newest month has no Stats NZ figure at first. The headline count for that month has to come from the
    register as first observed or wait. Which is the user's choice when the headline is designed (the brief,
    Stage 1 item 4).
  - The pipeline reading the file, the `registrations_flow` dataset and its cube files are frozen-path work under
    D-043 and a contract change under hard rule 4. Where the downloaded file lives in the repo is decided with that
    work.
  - `docs/DATA_SOURCES.md` §C is rewritten with what was read; the monthly check keeps looking for the series in the
    Explorer.
  - Not checked: whether Stats NZ revises past months of the series (the export shows no status flags).
  - Nothing is built by this entry.
- Status: proposed; accepted when the user says so

## D-066 2026-11-13 — The user's answers to Stage 0: October is built, the gate has passed, the freeze is lifted; D-063 to D-065 accepted
- Agent: user, answering the ten decisions of `docs/brief/STAGE_0_REPORT.md` by number in the session that followed
  it. Recorded by claude.
- Basis: this session. The run, its log and its commit were read with `gh` and `git fetch`; the hand pull was
  checked page by page after it was saved.
- Context: Stage 0 left ten decisions with the user, the first five tied to NZTA's December refresh.
- Decision, in the report's numbering:
  1. **October 2026 is built.** The user had claude start one unforced Monthly build on `main`. Run 43367551467
     (`workflow_dispatch`, `main` at `e3246bb`): success; 38 tests passed; built snapshot 2026-10-31 from 5,926,990
     rows with no warnings; peak memory 2,431 MiB of 15,982 MiB; 291 s. The bot committed
     `a5fb60c Snapshot 2026-10 [skip ci]`. Artifact `public-data-2026-10` expires 2027-02-11.
  2. **The gate has passed and the freeze is lifted**, the user having made both conditional on that run being green.
     This ends the freeze of D-013 and D-020 and changes AGENTS.md hard rule 2, which is rewritten in the same
     commit as this entry. D-043's exception is no longer needed. Work on the pipeline paths still reaches `main`
     only through a branch and a pull request the user merges. The new wording keeps `pipeline run` and
     `init-schema` as things not run locally, as AGENTS.md §Commands already says; the user did not speak to that.
  3. **D-063 is accepted**, with its files kept in releases in a private GitHub repository: the Stage 0 report's
     option (a), which is D-063's own (i). The user sets up the repository and the token (D-067; the steps are in
     `docs/brief/STAGE_1_REPORT.md` §4).
  4. **October is pulled by hand.** `data/raw/2026-10/20261113T045017Z` (gitignored): 5,926,990 rows in 186 pages,
     348,353,175 bytes, 36 of the 40 fields. `VIN11`, `CHASSIS7`, `ENGINE_NUMBER` and `POSTCODE` were not asked for.
     `OBJECTID` is included, as in every pull, because the pipeline pages by it. Its change key equals the one the
     run committed, so both read the same register.
  5. **The August and October raw pulls are to be copied to a backed-up folder.** The user's message left the folder
     as a placeholder, so nothing is copied yet.
  6. **D-064 is accepted**: option 3 (run every day) with both rules (each month is built once; a missed month fails
     the run).
  7. **D-065 is accepted**, by its option 2: the user exports the series from Infoshare by hand each month.
  8. **NZTA's registrations dashboard is read from one hand export** (the brief, Stage 1 item 6). The user asked
     what to export; the steps are in the Stage 1 report §5. That it should be October 2026, taken before
     1 December, is claude's recommendation, not the user's word (inferred: the dashboard was not seen; its listing
     says it shows the most recent calendar month). `docs/DATA_SOURCES.md` §D's rule stands until the user decides,
     after the export is read, whether it becomes a source.
  9. **`POSTCODE` is never published, never pulled and never archived.**
  10. **CLAUDE.md's three untagged changes are accepted** as they are: "static" dropped from the first sentence, the
      `segment_map.csv` comment, and "monthly" dropped from the first non-goal.
- Consequences:
  - The five pipeline pull requests (#26 to #29, #35) may merge, in order, when the user has reviewed them.
    `ui/explore` keeps the old hard rule 2 until #36 merges. `main` has no AGENTS.md until `ui/explore` merges into
    it, and its `POST_GATE.md` still describes the freeze.
  - D-064 and D-063 are queued to be built (CHECKPOINT). Neither is on `main` yet, so November's snapshot depends
    on the 8 December run or a dispatch, and is kept at every field only by another hand pull.
  - D-063's whole-snapshot file leaves out `POSTCODE` for good, not "until the user decides".
  - The playbooks and the two skills that still describe the freeze are out of date (STATE).
- Status: accepted, decided by user

## D-067 2026-11-13 — The archive's repository, token and secret: the names the setup steps use
- Agent: claude, for D-063's option (i) as the user accepted it in D-066.
- Basis: this session. GitHub's pages were not seen; the permission a release needs, the need for one commit and who
  can download a public repository's artifacts are from GitHub's documentation as claude knows it, not re-read
  (inferred — confirm when D-063 is built).
- Context: the user asked for the setup steps before D-063 is built, so the names have to be fixed now for the build
  to match them.
- Options considered:
  1. A fine-grained personal access token limited to the one private repository, with Contents: read and write.
     Chosen: the narrowest token that can create a release there.
  2. A classic token with `repo` scope. Not chosen: it can write to every repository the user owns.
  3. A GitHub App. Not chosen: more to set up and maintain than one token for one step.
  4. No token: the run uploads the file as an artifact and the user moves it. Not chosen: an artifact of a public
     repository can be downloaded by anyone signed in to GitHub, which is the publication D-063 avoids.
- Decision:
  - The private repository is `nickholttt/nzta-register-archive`, created with a README so that a release has a
    commit to attach to.
  - The token is fine-grained, named `nzta-archive-write`, limited to that repository, Contents: read and write,
    expiring 12 November 2027.
  - The monthly run reads it as the secret `ARCHIVE_REPO_TOKEN`. Whether that is an environment secret (an
    environment `archive` that only `main` can use; recommended) or a repository secret is the user's choice at
    step 3 of the setup, and D-063's workflow step is built to match.
  - The archive file is never uploaded as an artifact of this repository.
- Consequences:
  - The archive step is to be built so that an expired token fails it and the run says why (invariant 5). Whether
    a failed archive step also holds back the month's commit is settled when D-063 is built.
  - If the secret is an environment secret, only a job that names the environment can read it, and GitHub records a
    deployment each time such a job runs (GitHub's "Managing environments" page, read by the reviewer on
    2026-11-13). So the archive step belongs in a job of its own that runs only when a month is built: otherwise the
    daily run (D-064) would record a deployment a day, and a forced run from a branch other than `main` could not
    start.
  - The release's tag and the file's name are chosen when D-063 is built.
  - Reversing it: delete the secret and the token. Renaming anything is a one-line change before D-063 merges.
- Status: decided by Claude (unreviewed)

## D-068 2026-11-13 — What claude may do without asking again: merge the pipeline stack and D-064 and D-063 under a reviewer, one forced run, the archive repository; and the user's three answers
- Agent: user, in the first message of the session that followed `docs/brief/STAGE_1_REPORT.md`. Recorded by claude.
- Basis: this session, the user's message. The backup was checked by claude (below).
- Context: the Stage 1 report left three questions (CHECKPOINT questions 1 to 3) and twenty open pull requests, every
  merge the user's. The user does not follow the technical detail and asked claude to do as much as it can, with
  anything left to the user given one small step at a time.
- Options considered:
  1. The user merges every pull request by hand (the rule until now: AGENTS.md's `main` line and hard rules 2 and 7;
     the brief's §9, "The user merges; the lead never merges"). Not kept: the user cannot judge the diffs, so the
     merges would wait on a review the user cannot give.
  2. claude merges on its own judgement. Not chosen by the user.
  3. claude merges only when the pull request's checks are green and a reviewer sub-agent that has not seen claude's
     reasoning agrees, stopping at the first problem. Chosen by the user.
- Decision:
  - **The user's answers.**
    1. The raw pulls' backup is a folder outside the repo (its path was removed, D-081). claude checks both pulls
       are there and complete and copies anything missing. Checked on 2026-11-13: 373 files (186 for 2026-08, 187 for 2026-10), 524,915,027 bytes,
       every file's SHA-256 equal to the original's; nothing was missing. It is on the same physical disk as the
       project, so it is a second copy, not yet a backup.
    2. Secrets: 3a, for the archive and for Cloudflare. Each lives in an environment that only `main` can use.
    3. Yes: claude pulls November by hand, as it did October, if the archive is not on `main` when NZTA refreshes.
  - **What claude may now do without asking again.**
    1. Merge the pipeline stack (#26, #27, #28, #29, #35) into `main`, in order, each as a merge commit, only if
       its checks are green and a reviewer sub-agent that has not seen claude's reasoning agrees. Stop at the first
       problem.
    2. Then, if claude and the reviewer judge it safe, dispatch one forced run on `main`, to run the new code and
       the release step against October while NZTA still holds it; check it and report the result.
    3. Create the private repository `nzta-register-archive` and the environment `archive`, limited to `main`.
    4. Build D-064, then D-063, open their pull requests, and merge them into `main` under the rule in 1.
    5. The site stack: send the user screenshots of the main screens, at phone and desktop width, from the top of
       the stack. When the user says go, merge #17 to #34 into `ui/explore`, in order, from the command line.
       `ui/explore` is not merged into `main` without asking first.
  - **What only the user does**, walked through one step at a time, each waiting for "done": creating the archive
    token and putting it where it is needed (it is never pasted into a chat); exporting October from NZTA's
    registrations dashboard before 1 December.
  - **Never without asking:** anything that cannot be undone, anything that makes the site public, anything that
    costs money, any change to the invariants or the chart shapes.
- Consequences:
  - This changes AGENTS.md's `main` line and hard rules 2 and 7, with the user's approval in the message itself, and
    the brief's §9 line; all are amended in the same commit as this entry.
  - It is not a general licence. It names five pull requests, two decisions to build, one run, one repository and
    one environment. Any other merge into `main`, any second forced run and `ui/explore` into `main` are still
    asked for.
  - A merge can be reverted; the bot's commit from a forced run can be reverted; a release can be deleted. A deleted
    branch is restored from its pull request's page.
  - The Cloudflare secrets go in an environment limited to `main`, so `deploy.yml`'s upload job must name that
    environment before the first deploy. `deploy.yml` (#35) reads them as repository secrets today; that is changed
    before the deploy step of Stage 1, not in #35.
  - Reversing it: the user says so; the three AGENTS.md lines and the brief's line go back to "the user merges".
- Status: accepted, decided by user

## D-069 2026-11-13 — The user's answers after the pipeline stack: the archive token is stored, the backup is off the disk, the fact table may merge under D-068's rule
- Agent: user, in the first message of the fourth session of 2026-11-13, answering CHECKPOINT's questions. Recorded by
  claude.
- Basis: this session, the user's messages; the secret's presence was read with `gh`.
- Context: CHECKPOINT left the archive token and two questions with the user.
- Decision:
  1. **The archive token exists and is stored.** The user made it in seven steps, one at a time, and never showed
     it to claude. As the user reported it: fine-grained, named `nzta-archive-write`, limited to
     `nzta-register-archive`, Contents: read and write (Metadata: read-only added by GitHub), expiring
     **13 November 2027**, the latest date GitHub offered, not D-067's 12 November. Read by claude:
     `ARCHIVE_REPO_TOKEN` is a secret of the environment `archive` (created 2026-11-13T06:20:34Z), the environment
     still allows only `main`, and no repository-level secret exists. Whether the token works is not known until
     the first archive run.
  2. **The raw pulls are copied off the project's disk**: "backed up to a separate OneDrive" (the user's word; not
     checked by claude, which has no reason to read the user's OneDrive).
  3. **claude may merge `claude/fact-table` into `main` under the same rule as the pipeline stack**: a merge commit,
     only with a green check and the agreement of a reviewer sub-agent that has not seen claude's reasoning.
  - The same message asked for D-064, D-063, the screenshots of the site stack, and the reviewers' follow-up on the
    Cloudflare upload, with a stop and report after them.
- Consequences:
  - AGENTS.md hard rule 7 gains the fact table's pull request, with the user's approval in the message itself; it is
    amended in the same commit as this entry.
  - The token's expiry is a date the user has to remember: a reminder for early November 2027. An expired token
    fails the archive job, which says so (D-071).
  - Reversing 3: the user says so, and the rule 7 line goes back.
- Status: accepted, decided by user

## D-070 2026-11-13 — D-064 as built: what the daily run decides, and the choices D-064 left open
- Agent: claude, building D-064 (accepted in D-066) as D-068 allows. Pull request #37.
- Basis: this session. The code and tests were written and run here; the reviewer's finding was reproduced by the
  reviewer and fixed; month counts were read from `data/state/last_good.json` on `main` and the three files in
  `data/snapshots/`.
- Context: D-064 fixed three things (run every day; each month is built once; a missed month fails the run from the
  15th) and left others to the build.
- Options considered and decision, point by point:
  1. **The alarm fails every day until the month is built**, not once. Failing once would need the run to remember
     it had failed, and a run cannot write state without committing. Daily failure is hard to miss and stops by
     itself.
  2. **Whether the source changed is read from the row count and the digest, not from the snapshot date in the
     key.** That date is capped by the day of the fetch, so it can move on the first of a month while the register
     has not. Comparing the whole key (the old code) would have built a new month from an unchanged register.
  3. **A month is a snapshot month only if it holds a month of registrations**: at least 1% of the median of the
     twelve months before it (`snapshot.min_share_of_trailing_median`). This came from the independent review of
     #37, which refused the first version: with an edit by NZTA inside a built month and a few rows dated in the
     following month, the run would have built those rows as a month once the cap passed them, and then refused the
     real refresh as a rebuild. Other fixes considered: cap the snapshot at the month before the service's last
     edit (not chosen: an edit early in the next month, before the refresh, passes it, and it needs the source's
     time zone); keep the uncapped latest month in the key (not chosen: it fails when one refresh has such rows and
     the next has none). Measured: the lowest real month, 2020-04, held 7.0% of its trailing median; the next
     lowest, 2023-07, 58%. None of the three snapshots so far holds a row dated after its month.
  4. **The build starts the deploy, only when it built a month** (STATE known issue 10). `deploy.yml` no longer
     follows every successful run: a skip is a success, so that was a deploy a day. Not chosen: leave the trigger
     and have the deploy ask whether its trigger built (a Deploy run every day, each to say "nothing to do").
     The start is a job of its own with `actions: write` and no checkout.
  5. **The workflow keeps the name "Monthly build".** It builds one month at a time; the playbooks, the skills and
     the cube artifacts' history use the name.
  6. **The alarm's day is counted in UTC, must be 1 to 28, and never stops a run that builds**: an overdue month is
     committed, and the next run that builds nothing reports the month still missing.
  7. **The advice to force a rebuild is given only where a forced run would build.** A forced run on an unchanged
     row count is stopped by the existing check "the source changed without advancing".
- Consequences:
  - About 30 runs a month; a skip took 1m17s on 8 November. The Actions list fills with green skips.
  - Not caught: a register holding 1% or more of a normal month dated after its own month, and edited again at any
     time after it was built, is built as the following month once the cap passes it, and the real refresh is then
     refused as a rebuild. Stated in `docs/CUBE_SCHEMA.md`. The reviewer's second pass confirmed it and agreed to
     merge with it written down; only a check on the service's last-edit date would close it fully.
  - The first build of a month wins. A corrected refresh needs a forced run, which is the user's to start (D-064).
  - GitHub switches a schedule off after 60 days without activity in a public repository (GitHub's documentation as
     claude knows it; not re-read). The bot's monthly commit is activity, so this bites only after two months
     with no build, by which time the alarm has been failing for weeks.
  - Whether a failed scheduled run reaches the user by email depends on the user's GitHub notification settings
     (inferred — confirm).
  - Reversing it: restore the one schedule line and the `workflow_run` trigger; the rules are harmless monthly.
- Status: decided by Claude (unreviewed)

## D-071 2026-11-13 — D-063 as built: the archive job pulls for itself; the file, its name, and what happens when it fails
- Agent: claude, building D-063 (accepted in D-066, names in D-067) as D-068 allows. Pull request #38.
- Basis: this session. The code and tests were written and run here. The file was written once from the saved
  2026-10 hand pull and read back. The archive job has not run: it can only run on `main`.
- Context: D-063 expected the build's own pull to widen to 36 fields and the build to write the file. D-067 then put
  the token in an environment only `main` can use and said the archive step belongs in a job of its own. The two do
  not fit: the file cannot pass from the build job to another job, because an artifact of a public repository can be
  downloaded by anyone signed in to GitHub (D-067), and D-063 forbids that.
- Options considered:
  1. One job does everything and names the environment. Not chosen: a deployment is recorded every day the run is
     tried, the token sits in the job that installs the pipeline's dependencies and runs the build, and a run
     started on any branch but `main` could not start.
  2. A first job decides whether to build and a second, naming the environment, pulls, builds, commits, releases
     and archives. Not chosen: the token is still in the build's job, and the proven build is restructured.
  3. The build job is left as it is and a separate job pulls the register again for the archive. Chosen.
  4. Encrypt the file to a key the archive job holds and pass it as an artifact. Not chosen: a second secret and a
     key to manage, for the sake of one pull a month.
- Decision:
  - **A job `archive` in `monthly-build.yml`**, after `build`, on `main` only, naming the environment `archive`. It
    runs when the build built a month, or when a run is started by hand with the new input `archive` ticked.
  - **It pulls the register itself**, at every field of `pipeline/expected_schema.json` except
    `register_archive.never_pulled` in `config/pipeline.json` (`VIN11`, `CHASSIS7`, `ENGINE_NUMBER`, `POSTCODE`). The
    build's pull stays at its 17 bound fields, so the cube cannot change. The field list comes from the expected
    schema, not the live service: a field NZTA adds is not archived until the schema is captured again on purpose.
    A name in `never_pulled` that the schema does not hold aborts, so a misspelling cannot let a field through.
  - **It archives only the register that was built**: it goes ahead only while the live register has the row count
    and digest in `data/state/last_good.json`, and labels the file with that state's month.
  - **The file**: release `snapshot-YYYY-MM` in `nickholttt/nzta-register-archive`, one file `mvr-YYYY-MM.parquet`,
    zstd, rows sorted on every column, the row id left out, values as NZTA records them. NZTA's attribution, the
    snapshot date, the row count, the source's last edit and the digest are in the Parquet file's own metadata.
  - **Never replaced**: the job looks first and stops, green, if the month's file is there. Nothing uploads with
    `--clobber`.
  - **A failed archive does not hold back the month** (the question D-067 left open). The build's commit and cube
    release are done before the archive job starts. The run is red. The retry is a run started by hand with
    `archive` ticked: the build job skips, and the archive job archives the last built snapshot if the register
    still holds it.
  - **A missing or refused token fails the job before anything is pulled**, and says which.
  - `python -m pipeline archive --from-pull <dir>` writes the same file from a pull saved on disk, for a month
    pulled by hand (D-068 answer 3).
- Consequences:
  - One more pull of the register a month, in a second job. Measured from the saved 2026-10 hand pull on the
    development machine: 5,926,990 rows at 35 fields, 39,298,142 bytes (D-063 estimated about 49 MB), 524 s with
    other test runs going. The job's time and memory on the runner are not measured; it reports both.
  - If NZTA refreshes between a failed archive and its retry, that month's archive is lost and the job says so. The
    committed aggregate still holds the month at five dimensions.
  - The archive job installs the pipeline's two pinned dependencies (duckdb, pytest) in the job that holds the
    token. The token is given only to the two steps that call `gh`. It can write to one private repository.
  - GitHub records a deployment to `archive` each time the job starts, about once a month.
  - October 2026 can be archived as soon as this is on `main`, by a run started by hand with `archive` ticked,
    while NZTA still holds it. Otherwise from the hand pull with `--from-pull` and an upload by hand.
  - Reversing it: delete the job and the command; delete the releases. Nothing reads them yet.
- Status: decided by Claude (unreviewed)

## D-072 2026-11-13 — The Cloudflare upload is a job of its own behind the environment `production`, switched on by a variable
- Agent: claude, on the user's instruction in the session (D-069), doing the follow-up the reviewers of #35 raised
  (STATE known issue 11) and D-068's answer 2. Pull request #39.
- Basis: this session. The environment was created with `gh` and read back. The workflow parses and its tests pass.
  No upload has run: there is no Cloudflare project or secret, and `main` has no public site yet.
- Context: `deploy.yml` read the Cloudflare secrets as repository secrets and uploaded in the job that installs the
  site's dependencies. The user chose an environment only `main` can use (D-068 answer 2).
- Options considered:
  1. Add `environment:` to the existing single job. Not chosen: the site's whole dependency tree would still be
     installed beside the token, and every run, uploading or not, would be recorded as a deployment.
  2. Two jobs, the upload job starting on every run on `main` and stopping politely when the secrets are missing.
     Not chosen: GitHub records a deployment to the environment when the job starts, so the repository would show
     "deployed to production" for deploys that never happened.
  3. Two jobs, the upload job starting only when deploying is switched on. Chosen. The switch has to be something
     the build job can see, and it cannot see an environment's secrets, so it is a repository variable.
- Decision:
  - **The environment is `production`**: created 2026-11-13, limited to the branch `main`, holding no secret.
  - **`build`** builds the site and reads no secret. **`upload`** names `production`, runs only on `main`, checks out
    only `.github/deploy`, installs only the pinned upload tool, takes the built site from the build job and
    uploads it.
  - **Deploying is switched on by the repository variable `CLOUDFLARE_PAGES_PROJECT`**, set to the Pages project's
    name. The workflow's default project name is gone. Until the variable is set the site is built and the run
    stops, green, as before.
  - **Once it is switched on, missing secrets fail the run.**
  - The built site passes between the jobs as an artifact kept one day, uploaded only when it is about to be
    published.
- Consequences:
  - The deploy's console steps (CHECKPOINT) change: the two secrets go in the environment `production`, not the
    repository, and one step is added, setting the variable, which claude can do with `gh` on the user's word.
  - Merging #39 into `main` is not among the merges D-068 and D-069 name: it is asked for.
  - Reversing it: restore the single job; delete the environment.
- Status: decided by Claude (unreviewed)

## D-073 2026-11-13 — The user's word on the merges: #37, #38 and #39 into `main`, the site stack into `ui/explore`; and the first archive run
- Agent: user, in a message later in the fourth session of 2026-11-13, after Claude Code's permission check had
  refused claude's merge of #37. Recorded by claude.
- Basis: this session, the user's message; the merges, the run and its log were read with `gh` and `git fetch`.
- Context: #37, #38 and #39 were built and reviewed and nothing was merged (CHECKPOINT as it stood). The user had the
  screenshots of the site stack.
- Decision, in the user's words where short:
  1. "Merge 37 now." Merged as `693ecf3`.
  2. Merge #38 only once its independent reviewer agrees; if not, fix it and get a second review first. The
     reviewer agreed to `3ba6e01`, with follow-ups. claude added the first two before merging (the job refuses a
     repository that is not private; a half-uploaded file is not an archive), the same reviewer agreed to
     `aa7db27`, the check was run again against `main` with #39 in it, and it merged as `d50bfc6`.
  3. "Yes: merge 39 under the same rule." Its reviewer had agreed; merged as `b507d53`.
  4. "Site stack: go." #17 to #25 and #30 to #34 merged into `ui/explore`, in order, each as a merge commit, each
     pointed at `ui/explore` first so it carried only its own change. No conflict. `ui/explore` is `a3ec1f3`, the same
     tree as the top of the stack. `ui/explore` is not merged into `main` without asking first.
  5. Fix the stale words on `/method` and `/caveats` and the phone ranking table on top, before anything is public
     (D-074).
  6. Once #38 is on `main`, start the archive-only run for October and report. **Run 43382023139: the build job
     skipped as it should; the archive job failed at its first step**, before pulling anything: "the token in
     ARCHIVE_REPO_TOKEN cannot reach nickholttt/nzta-register-archive". GitHub answered 404, not 401: the token is
     valid and cannot see the repository. The likeliest cause is that the repository was not selected when the
     token was made; a fine-grained token's repositories can be edited without making a new one. Nothing was
     uploaded.
  7. Then the walk-through of NZTA's dashboard export, one step at a time.
- Consequences:
  - `main` is `d50bfc6`: the daily run, the build-once rule, the missed-month alarm, the archive job and the
    two-job deploy are live. The first scheduled daily run is 14 November 2026, 06:17 UTC.
  - The merged branches are deleted here and on GitHub: the three pipeline branches and the fourteen of the site
    stack. Each can be restored from its pull request's page.
  - October's whole snapshot is not archived until the token can see the repository and the run is started again
    with `archive` ticked. NZTA holds October until its December refresh; the hand pull is the fallback
    (`pipeline archive --from-pull`).
  - Reversing a merge: `git revert -m 1 <merge commit>` on a branch and a pull request, on the user's word.
- Status: accepted, decided by user

## D-074 2026-11-13 — What the screenshots called for: the hand-written figures recomputed for October, plain words on `/caveats`, and the ranking table on a phone
- Agent: claude, on the user's instruction in D-073 (item 5). Pull request #40 into `ui/explore`.
- Basis: this session. The figures were recomputed from the `cube-2026-10` release and the 2026-10 register (the
  file written from the hand pull), and again by the reviewer, who was given neither claude's values nor its
  reasoning. The ranking was measured headless at seven widths.
- Context: the screenshots of the site stack (STATE known issue 10 as it stood) showed `/method` and `/caveats`
  quoting August figures beside an October site, a sentence that was no longer true, internal references shown to
  visitors, a chart label the charts do not use, and a ranking table that hid two columns on a phone with nothing
  to say it scrolls.
- Options considered and decision:
  1. **The hand-written figures are recomputed for October and stay hand-written and dated.** Not chosen: compute
     them when the site is built. That is the narrative engine's job (D-062, invariant 8), and doing a piece of it
     here would be a second way of writing sentences. Not chosen: leave them dated August. They read as stale
     beside "Snapshot 31 October 2026". One dated comparison is left as it is, between the August and September
     snapshots on `/caveats`: no September register exists to move it on.
  2. **`/method` says "The powertrain charts split out mild hybrids"** in place of "No live chart splits out mild
     hybrids today". **`/caveats` says "Explore has no regional charts. The map on Build a chart shows each region's
     share of vehicles, with this caveat under it"** in place of the decision numbers, and "a count of every
     vehicle first registered each month" in place of "build step 1b". All three are true of the site as built and
     will go false silently if the site changes; they are the kind of sentence the narrative engine replaces.
  3. **`/caveats` reads the two chart labels it quotes from config**, and the build fails if config has no such
     dimension.
  4. **The ranking table's columns are reordered at every width**: Rank, Move, the breakdown, Share, Change in share,
     Still registered, Rank before. The share comes before the count, as in the map's table, so a phone shows the
     ranking without scrolling. Not chosen: hide columns on a phone (figures would be out of reach there).
  5. **Headings stay on one line, and the last reads "Rank before"**, with "in the 12 months" kept for a screen
     reader. The blank gap under the chart was the header row made tall by a heading wrapping in a narrow column.
  6. **A box that scrolls sideways shows a shadow at the edge with more beyond it**, on every such box, and under the
     ranking a line says so in words. The line shows only while the table is wider than its box, which is measured:
     the reviewer found a fixed breakpoint showed it with nothing to scroll.
- Consequences:
  - The figures are a month behind again after each refresh, until the narrative engine (STATE known issue 9).
  - Not done from the screenshots: the map legend's "0%" label outside the chart box; the dense grey band before
    1970 on the concentration chart; a dark theme (STATE known issue 10).
  - `claude/question-builder` changes `src/styles/site.css` near line 272 only; this change is near line 808.
  - Reversing it: revert the pull request's merge in `ui/explore`.
- Status: decided by Claude (unreviewed)

## D-075 2026-11-13 — NZTA's registrations dashboard, read from one hand export: what it is, how it compares, and whether it becomes a source (proposed)
- Agent: claude, for the user to decide (the brief, Stage 1 item 6; D-066 item 8).
- Basis: this session. The user opened the dashboard and saved, into gitignored
  `data/raw/nzta-dashboard/2026-10/`: three screenshots, NZTA's page as HTML, and one export
  (`89cff00a-3572-4b37-990d-c77df9a01368.xlsx`, 4,263,616 bytes). claude read the saved page and the export; it did
  not open NZTA's site or the dashboard. The register figures are from the 2026-10 archive file.
- Context: `docs/DATA_SOURCES.md` §D says of this dashboard "do not automate" and "never build a dependency on it".
  Nobody here had seen it. The site has no count of every vehicle first registered each month: Stats NZ's series
  (D-065) gives totals for new and ex-overseas cars and commercials, with no make or model.
- What it is (NZTA's page, and the screenshots):
  - A Qlik report builder, "First registration", at `qap.nzta.govt.nz`. The visitor ticks up to 12 of 34 dimensions,
    filters by month, and exports the table.
  - It holds vehicles "with a date of first ownership within the past five years": the month list runs from
    January 2021 to October 2026 (the user read it). It is updated at the start of each month and is "a snapshot of
    the data at the end of every month". Past months can change: vehicles are added or removed and a registration
    month can be updated. It includes "a subset of reregistered vehicles".
  - Licence: "This data and its accompanying information are released under a Creative Commons Attribution 4.0
    International licence".
  - Dimensions the open register does not have: **Owner type** (Individual, Company, Other), Physical town, Vehicle
    status (active, inactive, reversed), and groupings of engine size, mass and motive power. It also offers
    "VIN - first 11" and "Physical post code", which were not ticked (D-066 item 9; CLAUDE.md's non-goals).
  - The page carries NZTA's own history of what `vehicle_year` has meant, period by period, a user guide (PDF), and
    a link to NZTA's make and model cleansing code on GitHub. None is read into the docs yet.
- Measured, October 2026, twelve dimensions (body type, country of origin, import status, make, model, motive power,
  owner type, territorial authority, vehicle status, vehicle type, vehicle usage, vehicle year):
  - The export is whole: 6,509 rows, 68 districts by import status across the columns, cells summing to 28,896, the
    figure the dashboard shows. Every vehicle is ACTIVE.
  - The register holds 28,864 vehicles first registered in October 2026: 32 fewer (0.11%). By import status, the
    dashboard against the register: NEW 18,657 and 18,665; USED 9,259 and 9,259; RE-REG 807 and 767; SCRATCH 173
    and 173. By vehicle type and import status, 35 of 41 groups are identical. The differences: 40 re-registered
    vehicles the dashboard counts in October and the register does not (18 motorcycles, 17 passenger cars, 5 goods
    vehicles), and 8 fewer NEW (passenger cars 8 fewer, a trailer more, a motorcycle fewer). The cause of the 8 is
    not known.
  - Owner type: Company 14,724, Individual 13,923, Other 249.
- Options considered:
  1. Leave it unused, as §D says. It costs nothing. The site then has no true monthly registrations by make or model
     for any month before the first one it archives itself.
  2. Use it for the newest month only. Not worth it: for the newest month it agrees with the register to 0.11%.
  3. Use its history as the detail of `registrations_flow`: every vehicle first registered in each month from
     January 2021, by make, model, motive power, import status, district and owner type, exported by hand. Stats NZ's
     series stays the source of totals before 2021 (D-065). Never automated: the user exports, as with Infoshare.
- Decision: proposed, option 3, in two steps, each on the user's word.
  - First a test, which costs one export: one old month (January 2021) at the same twelve dimensions, compared with
    the register's survivors for that month. It shows what the history holds (the vehicles since scrapped) and
    whether an old month exports whole.
  - Then, if it holds, the backfill: the 70 months, a year at a time, and one export a month from then on.
- Consequences:
  - It would change `docs/DATA_SOURCES.md` §D from "never build a dependency on it" to "a hand export, never
    automated", which is the user's decision, and it needs a decision record of its own with the dataset's
    definition (`docs/METRICS.md`) before any chart uses it. A flow series never goes on the same chart as
    survivors (CLAUDE.md, build step 1b).
  - Past months in the dashboard change, so a month exported once is that month as first exported; a later export
    of the same month can differ. The export date belongs with every file.
  - It depends on the user's time each month, and on NZTA keeping the dashboard and its window: the window is "the
    past five years", so January 2021 may drop out. The backfill is worth doing soon if at all.
  - Owner type is askable only once the data map defines it (the goal's point 8).
  - Whether "VIN - first 11" and "Physical post code" may be used is a separate question the user raised in this
    session: the licence allows it; D-066 item 9 and CLAUDE.md's non-goals forbid it on privacy grounds until the
    user changes them (CHECKPOINT, question 1).
  - Reversing it: stop exporting; nothing published reads it yet.
- Status: proposed

## D-076 2026-11-13 — `VIN11` and `POSTCODE` are kept in the private archive only and neither is published; October gets a second file
- Agent: user, answering CHECKPOINT question 1 in the first message of the fifth session of 2026-11-13. Recorded by
  claude, with the choices claude made building it marked as such.
- Basis: this session, the user's message. The change, its tests and October's file were written, run and read back
  here; the upload was read back with `gh`.
- Context: D-066 item 9 ruled `POSTCODE` never published, never pulled and never archived, and CLAUDE.md's non-goals
  kept `VIN11`, `CHASSIS7` and `ENGINE_NUMBER` out of every published file. The archive (D-063, D-071) left all four
  out. In the fourth session the user asked whether the postcode and the VIN prefix may be used; NZTA's licence
  (CC BY 4.0) allows it. October was archived at 35 fields, and NZTA replaces October early in December.
- Options considered:
  1. Leave both out (D-066 item 9). Not kept: once NZTA refreshes, a month's postcodes and VIN prefixes are gone, and
     nothing finer than a district, and nothing read from the VIN, can ever be derived for that month.
  2. Keep both and publish postcode totals now. Not chosen by the user: publishing waits for the privacy review.
  3. Keep both in the private archive only and publish neither. Chosen by the user.
- Decision, in the user's words where short:
  1. `POSTCODE` and `VIN11`: "keep both in the private archive only. Publish neither."
  2. `VIN11` itself is never published, "only what is derived from it, after you check it against the data".
  3. Postcode figures "wait for the Stage 2 privacy review, and then only as area totals above a minimum count".
  4. `CHASSIS7` and `ENGINE_NUMBER` "stay out entirely".
  5. For October, the two fields are added "as an additional file"; the file already archived is not replaced.
  6. This supersedes D-066 item 9, and the field lists of D-063 and D-071 as far as these two fields go. CLAUDE.md's
     non-goal and `docs/DATA_MAP.md` are changed in the same commit as this entry.
- As built (decided by Claude, unreviewed), pull request #42 into `main`:
  - `register_archive.never_pulled` in `config/pipeline.json` is `CHASSIS7` and `ENGINE_NUMBER`. No pipeline code or
    workflow changes: the archive job already takes every field of the expected schema but those.
  - The build's own pull stays at its 17 bound fields, so neither field can reach the cube, the committed aggregate
    or a published file. A test fails if either is ever bound.
  - **October's additional file is a whole register at 37 fields**, `mvr-2026-10-vin11-postcode.parquet`, in the
    release `snapshot-2026-10` beside `mvr-2026-10.parquet`. Not chosen: a file of the two columns alone. The first
    file keeps no row id, so two columns could not be matched to its rows.
  - It was written on the development machine by `python -m pipeline archive --snapshot 2026-10` from the branch,
    which pulls NZTA's live register and goes ahead only while it has the row count and digest of the built month,
    and uploaded with `gh` under the user's login, without `--clobber`. Not chosen: the workflow's archive job. It
    runs only on `main`, stops when the month has a file, and would have needed a merge and a change of its own for
    one file.
  - The local pull and the local file were deleted once the upload's SHA-256 matched, so the two fields are in the
    private archive and nowhere else.
- Measured, 2026-11-13:
  - The pull: 5,926,990 rows at 38 fields in 151.6 s. The file: 5,926,990 rows, 37 fields, 55,125,916 bytes (the
    35-field file is 39,298,142). 13 min 7 s in all, with three other heavy jobs running.
  - `VIN11`: 4,811,252 vehicles have one (81.2%), every one 11 characters, 200,725 distinct.
  - `POSTCODE`: 5,638,818 vehicles have one above zero (95.1%); 1,331 distinct values in the file (the data map
    counted 1,330 on the live service; whether the one more is a zero standing for "not recorded" was not checked
    before the local file was deleted). NZTA records it as a number, so one that starts with zero arrives without
    it: 152 postcodes, holding 885,064 vehicles, are below 1000.
  - The release, read back: both files `uploaded`; the new file's SHA-256 is `25f0a20d…5041ce`, equal to the local
    file's before it was deleted. The repository is private.
  - The independent reviewer of #42 (not shown claude's reasoning) agreed with follow-ups, none blocking, and ran
    the whole suite: 86 passed.
- Consequences:
  - Until #42 is on `main` the archive job leaves the two fields out. If NZTA refreshes first, November is archived
    at 35 fields and needs a second file by hand, as October did, while NZTA still holds it.
  - The private archive is more sensitive than it was: a VIN prefix beside a postcode narrows a vehicle to very
    few. The repository must stay private; the job already refuses one that is not.
  - Nothing is derived from `VIN11` yet, and nothing has been checked against the data. What it can give (a model
    year, a factory) is Stage 2 work, read from the archive's file.
  - The minimum count for postcode totals is not set; it is the Stage 2 privacy review's to set.
  - `pipeline archive --from-pull` now refuses both saved pulls (August has 17 fields, October 36): a pull saved by
    hand must take all 38.
  - The user did not speak to the dashboard's own "VIN - first 11" and "Physical post code" dimensions (D-075).
    They stay unticked in every export.
  - Reversing it: put the two names back in `never_pulled` and delete October's second file. Files already written
    with the fields stay until deleted by hand.
- Status: accepted, decided by user; the points under "As built" decided by Claude (unreviewed)

## D-077 2026-11-13 — The user's answers on the dashboard, the `ui/explore` merges and the queue; what the reviews changed; and the fact table held for a question
- Agent: user, in the first message of the fifth session of 2026-11-13 (answers 2 and 3 and the instruction that
  follows them; answer 1 is D-076). Recorded by claude, with what claude did and decided marked as such.
- Basis: this session, the user's message; the merges and checks were read with `gh` and `git fetch`; the reviewers'
  reports; headless checks at 320, 390 and 1280px; the saved October export and NZTA's saved page (nothing of
  NZTA's was opened).
- Decision, the user's:
  1. **The dashboard: yes to the January 2021 test export**, walked through one step at a time. It is not yet agreed
     as a source: first the user wants to know how many exports the whole history from January 2021 needs, how
     long that takes, and whether several months fit in one export.
  2. **Yes: claude merges the question builder and the two preset corrections into `ui/explore`** once each has a
     reviewer's agreement.
  3. **Then the queue: the fact table, then the deploy steps.** Asked first: `ui/explore` into `main`, and anything
     that becomes public. Plain words, and one step at a time for anything the user must do.
- What was done:
  - **The question builder is in `ui/explore`** (#43, merge `c367672`). Its independent reviewer first refused it,
    for three faults: a link's condition on a field the fact table lacks was dropped without a word, so the chart
    drew a wider question; two buttons were under 44px; a number by a breakdown with no values drew the total alone
    under a title promising a breakdown. All fixed (`7646a0d`). The second pass agreed, and found a hand-typed link
    with a condition named like a built-in property crashed the page: fixed (`05f9cf4`) and checked headless by
    claude, not re-reviewed. Every figure the reviewer recomputed from the Parquet files matched the page.
  - **The two preset corrections are in `ui/explore`** (#44, merge `85b7dd6`): `used-import-age` and `powertrain-mix`
    are live and the ranking period comment follows D-050. Its reviewer agreed and recomputed both charts' figures.
    One line more than asked: `age-distribution-moving-hole` no longer says it waits for a pair the cube carries.
  - **The fact table is reviewed and not merged** (#41): brought up to date with `main` by a merge commit, 95 tests
    passed, `Checks` green, and its reviewer agreed with follow-ups. A dry-run build of the saved 2026-10 pull gave
    a table of 1,734,417 rows over 13 dimensions, 3.8 MB, and every existing slice, pair and `events.json` (17
    files) byte-identical to the released `cube-2026-10`.
- Decided by Claude (unreviewed):
  1. **The fact table's merge is held for the user**, though D-069 and the user's message allow it. The reviewer
     measured, on the 2026-08 table, that 65% of its rows count one vehicle: 25% of all vehicles, and 17% of the
     last 12 months', are alone in their row, and each row carries the owner's region beside the model, the month
     and the vehicle's bands. D-058 called this risk "cells as small as one vehicle" in a register that is "already
     public vehicle by vehicle, with no owner data". The last part was wrong: region is where the owner lives.
     Options: (a) merge as it is, since every column is a coarsening of a field NZTA itself publishes per vehicle
     (district, not region), so a reader learns nothing NZTA does not already publish (the reviewer's reading, not
     checked against the live register); (b) leave `region` out of the table until the Stage 2 privacy review,
     which costs Build its conditions on region and its count comparisons between regions, while the region map
     still draws from its slice; (c) a minimum cell size, which breaks the table's totals and is new design. Not
     chosen without the user: once `main` has the table, the next build publishes it in a public release, which
     cannot be taken back, and the user's rule in this session is that anything becoming public is asked first and
     that owner location finer than a district is published only above a minimum count. Recommended: (b).
  2. **The preset corrections are merged though `ui/explore` alone cannot yet draw one of them rightly.**
     `ui/explore`'s `config/dimensions.json` has no `segment_group`, so there `powertrain-mix` would draw without
     its light-passenger filter, with a warning, until `ui/explore` meets `main`. They were checked on a local test
     merge with `main`. Not chosen: hold them until that merge (STATE asked for them before it, and the site is
     built from `main`).
  3. **A condition that cannot be applied stays in the question and blocks the chart**, with its row saying why and
     how to remove it. Not chosen: drop it and say so in a notice (the chart would still answer a different
     question from the link's).
  4. **A number by a breakdown with no values chosen draws nothing** and says it is finding the largest to start
     from, or that there is none. Not chosen: the total line with a corrected title (the question asked for a
     breakdown).
- The dashboard arithmetic, for the user's decision (measured from the October export and NZTA's saved page;
  times are estimates, since no export has been timed):
  - The history is 70 months, January 2021 to October 2026. One month an export is 70 exports.
  - October's export is 6,509 rows by 263 columns (ten fields down the side; district by import status across the
    top), 4.3 MB.
  - Several months can go in one export in principle: NZTA's page says the reporting period can be "select months",
    and "Registration MMM-YYYY" is one of the 34 dimensions, so each row can say its month. It takes one of the
    twelve places, so one of October's twelve gives way. A year at a time is 6 exports. A year would be about
    78,000 rows by 263 columns, some 12 times October's file. Whether the dashboard exports that is not known:
    NZTA's page says only that "export times will increase if you include more data". The test settles it.
  - NZTA says the dashboard holds "the past five years"; January 2021 is already older than that, so 2021 may drop
    out at any refresh (inferred — confirm).
- Consequences:
  - Open follow-ups, none blocking (the reviewers' claims): the question builder's are listed on #43; the fact
    table's are in CHECKPOINT (its total check compares two counts of the same table, so it cannot fail; one golden
    test would crash on a dataset with no `facts`; two figures in `docs/CUBE_SCHEMA.md` disagree).
  - `ui/explore` into `main` will conflict in `README.md` only (tested with `git merge-tree`).
  - The public site's Build page needs a cube with a fact table. `cube-2026-10` has none.
  - Reversing a merge into `ui/explore`: `git revert -m 1 <merge commit>` on a branch, and a pull request.
- Status: accepted, decided by user (the three answers); the four points under "Decided by Claude" unreviewed

## D-078 2026-11-13 — The user's answers: the fact table leaves out the owner's region until the Stage 2 privacy review; #42 and #36 merge; the dashboard's first step waits for the user; and D-058's "no owner data" is corrected
- Agent: user, in the first message of the sixth session of 2026-11-13. Recorded by claude, with what claude did and
  decided marked as such.
- Basis: this session, the user's message. The dry runs, the tests and the headless checks were run here; the merges
  and checks were read back with `gh`; the reviewer's report.
- Decision, the user's, in the user's words where short:
  1. "The fact table: (b). Leave owner's region out until the Stage 2 privacy review, then merge #41 under the usual
     rule. Correct the earlier decision record that said it held no owner data."
  2. "Merge 42. Merge 36."
  3. The dashboard's step 1: the user does it, with Claude in the browser, when free the next day, and is walked
     through it "one step at a time when I say I'm ready".
  4. "Then carry on with the queue. Ask me before ui/explore goes into main or anything becomes public."
- **Correction to D-058.** Its risks say the source register is "already public vehicle by vehicle, with no owner
  data". The last four words are wrong. `TLA` is the district of the vehicle's registered owner, `region` is derived
  from it (`tla_region.csv`), and NZTA's own definition is "the region where the registered owner is based" (its
  dashboard page, read into `docs/DATA_MAP.md` this session). The table D-058 measured listed region among its
  dimensions. D-058 is not edited (this file is append-only): read its risk as "cells as small as one vehicle, in a
  register that is public vehicle by vehicle and gives each owner's district". The data map's first reading of privacy
  classes already puts `TLA` among the fields that are public only above a minimum count when crossed with fine
  vehicle detail.
- What was done:
  - **#42 is merged into `main`** (merge commit `a0c1943`), and its branch and worktree are deleted. From the next
    build the archive job keeps `VIN11` and `POSTCODE` (D-076).
  - **The fact table carries no `region`** (`claude/fact-table`, commit `489e2c3`): the word is out of `facts` in
    `config/pipeline.json`, whose comment says why; the golden contract was regenerated for that change alone (11
    lines added, 232 removed: the table's `region` file, the rows that differed only by region, `region` in
    `facts.dimensions`, and `payload_bytes` 37,998 to 37,545; no slice, pair or event changed).
  - **The earlier reviewer's follow-ups are done** (commits `488399b`, `809bcbd`, `f7c97b5`): the total check; the
    golden test over a dataset with no fact table; `docs/CUBE_SCHEMA.md`'s figures re-measured and its manifest
    example made to agree; two claims the pipeline's code does not show marked.
  - **#41 is merged into `main`** (merge commit `f78e3e1`, head `7d3f2f8`), on the user's word in this session, with
    `Checks` green and the reviewer's agreement; its branch and worktree are deleted.
- Measured, 2026-11-13, from dry runs that publish nothing:
  - The 2026-10 pull: exit 0 in 11 min 3 s. The fact table is 641,618 rows over 12 dimensions in 1,726,119 bytes as
    14 files; with region it was 1,734,417 rows and 3,885,012 bytes. `payload_bytes` is 3,149,458. Every slice, pair
    and `events.json` (17 files) is byte-identical to the released `cube-2026-10`.
  - Rows that count one vehicle: 321,973, which is 50.2% of rows and 7.1% of vehicles; among the last 12 months'
    vehicles, 4.6%. With region: 1,124,745 rows, 64.8% of rows and 24.9% of vehicles; last 12 months, 16.8%.
  - The 2026-08 pull: the build stops with exit 2 at the comparison with the last good build, which is October's
    since the forced run, after its files are staged. Its fact table is 643,414 rows in 1,736,400 bytes.
  - The whole test suite: 98 passed in 397 s. The new abort test fails on the code before its commit.
  - The Build page, a local build of `ui/explore` with October's dry-run files, headless at 390 and 1280 px: region is
    not offered as a condition, nor as a breakdown of a count; "the share of vehicles by owner's region" still draws,
    from the slice; a link carrying a region condition draws nothing and says why, with a link that removes the
    condition; a brand comparison and a new-or-used condition draw as before; no page scrolls sideways.
- The independent review of #41 (a reviewer not shown claude's reasoning): "agree with follow-ups" on `f7c97b5`. It
  recomputed every figure above from the October dry run and found them equal, found nothing about an owner left in
  the table, and found the golden change to be the removal of `region` alone. What it raised, and what was done
  (commits `84ae0cf`, `7d3f2f8`):
  - The total check was described as counted "before any reference lookup is joined on", which was false: `rows`
    is itself built by joining the scope, brand, model, hybrid and engine lookups. And it proved a gap that `main`
    already had: a vehicle type listed twice in `vehicle_scope.csv` counted each of its vehicles twice, in the slices
    too, with no abort. Fixed: both scope files abort on a repeated key, with a test that fails on the old code; the
    comment and `docs/CUBE_SCHEMA.md` now say what is counted from where.
  - A dimension named after the table's working row-order column would have been written as row numbers: the name
    is reserved. The manifest example's `payload_bytes` was smaller than the fact table inside it: re-measured.
  - Left open (CHECKPOINT): no test in the repo builds a second dataset without `facts` (the reviewer did, by hand,
    and the guard holds).
  - The same reviewer, on `7d3f2f8`: "agree". It reran its probes (the repeated scope row aborts; a dimension named
    after the row-order column aborts), found the golden contract untouched by the two commits, and ran the golden,
    guardrail and invariant tests: 67 passed. `Checks` was green on `7d3f2f8`. Its smaller points are in CHECKPOINT.
- Decided by Claude (unreviewed):
  1. **The total check compares the written file with a count of `rows`.** The counts are read back from
     `n.parquet` and compared with the dataset's vehicles counted from `rows`, before the dimension lookups are
     joined on. Not chosen: counting from `src`, before every lookup (the dataset's own conditions come from the
     scope lookups, so that count cannot be made without them; their keys are guarded instead).
  2. **Nothing in code stops `region` being listed again.** The config comment and `docs/CUBE_SCHEMA.md` say why it
     is out, and putting it back changes the golden contract, which is shown to the user (hard rule 4). Not chosen:
     a list of withheld dimensions in config that aborts the run (a second line in the same file protects little
     more than the first).
  3. **The `region` slice stays, and Build still offers "the share of vehicles by owner's region" from it.** That is
     (b) as CHECKPOINT put it to the user: "the region map still draws".
  4. **#36 was merged last**, with this entry and the session's notes in it, where the user's message lists it second.
     Not chosen: merge it first and open a second notes pull request the same hour.
- Consequences:
  - **The next build publishes the fact table** in that month's cube release, which is public and cannot be taken
    back. It carries the vehicle and its brand only.
  - Build cannot narrow by region or compare regions by number. A saved link with a region condition draws nothing
    and says why; that row names the field by its id, "region", not its label (a follow-up).
  - Half of the table's rows still count one vehicle. Whether a minimum count is wanted regardless, and what the
    `region` slice's own small cells call for, are the Stage 2 privacy review's. The slice's small cells were not
    measured this session.
  - AGENTS.md's dry-run command names the 2026-08 pull with "exit 0"; that build now stops with exit 2 (STATE).
  - Putting `region` back after the review: one word in `facts`, the golden regenerated and shown, the doc's
    figures re-measured.
- Status: accepted, decided by user (the four answers); the four points under "Decided by Claude" unreviewed

## D-079 2026-11-13 — `VIN11` checked against the data: no model year for used imports, one for about four in ten NZ-new vehicles; nothing is derived from it
- Agent: claude, doing CHECKPOINT queue item 6 on the user's "carry on with the queue" (sixth session of 2026-11-13).
- Basis: measured in this session from the private archive's `mvr-2026-10-vin11-postcode.parquet` (SHA-256
  `25f0a20d…5041ce`, as in D-076), downloaded with `gh` into a scratch folder and deleted after the check. Counts only;
  no VIN was written anywhere. The figures and the method are in `docs/DATA_MAP.md`, "`VIN11` checked against the data".
- Context: D-076 keeps `VIN11` in the private archive and allows only what is derived from it to be published, "after
  you check it against the data". It named two things a VIN might give: a model year (the tenth character) and a
  factory (the eleventh). `vehicle_year` is not a model year (`docs/MODEL_AND_AGE.md` §1), so a model year would be new.
- Measured (5,926,990 vehicles, every vehicle type):
  - 4,811,252 have a `VIN11`, each 11 characters; 494 hold a character a VIN does not allow.
  - 1,675,639 (34.8%) start `7A`: 83.5% of the used imports that have one, 2.3% of the NZ-new. These are VINs
    assigned in New Zealand (inferred — confirm against NZTA's VIN rules), and their tenth character is not a year: on
    the largest prefix it equals the first NZ registration year on none of 1,313,576 vehicles.
  - Of the 3,135,613 manufacturer VINs, the tenth character is a year code on 66.9% and a zero on 32.9%.
  - Among NZ-new vehicles first registered from 2010 with a manufacturer's VIN (2,198,959): 34.2% are of makes whose
    VINs mostly carry no year code; 38.0% are of 112 makes where the decoded year is within one of the registration
    year on 95% or more; 7.5% of makes at 80% to 95%; 20.2% of makes where a valid-looking character agrees on under
    80%, so is not a year.
  - The eleventh character: "built in" is the commonest country of the vehicle's three-character prefix on 93.1%, and
    of the prefix and the eleventh character together on 95.1%.
  - `POSTCODE`, while the file was open: 288,172 vehicles hold zero and none is empty, so the 1,331st value D-076 could
    not account for is the zero that stands for "not recorded"; 1,330 postcodes are above zero, 154 of them with fewer
    than 5 vehicles and 237 with fewer than 20.
- Options considered:
  1. A model year for every vehicle, read from the tenth character. Not chosen: it would be wrong for the NZ-assigned
     third, absent for the third of manufacturer VINs that hold a zero, and wrong for the makes where the character
     is not a year.
  2. A model year only for the makes or prefixes shown to use a year code, through a reference lookup with a coverage
     guard (invariant 4). Not built: it would cover about four in ten NZ-new vehicles and almost no used import, so it
     could not be a market-wide breakdown, only a field for some makes. Whether that is wanted is the user's, in
     Stage 2.
  3. Derive nothing now and record what was found. Chosen.
- Decision (decided by Claude, unreviewed): nothing is derived from `VIN11`. The data map records the check. No factory
  field is derived either: the repo has no table of plant codes, and the eleventh character adds two points to what
  the prefix already says about "built in".
- Consequences:
  - Nothing published changes, and the archive keeps the field (D-076), so option 2 stays open for any month archived.
  - The `7A` prefix is a second sign of a vehicle that arrived without a manufacturer's VIN. It mostly repeats the
    import status, and is not used.
  - The check was made once, by scratch scripts. If a field is ever derived, the check becomes a maintainer script in
    `scripts/` first, run against each month's file.
- Status: decided by Claude (unreviewed)

## D-080 2026-11-14 — The user's answers: #45 merges; `ui/explore` into `main` is reviewed and asked for by number; hard rules 7 and 8 are shown before they are reworded; October is forced only after a yes; nothing becomes public without asking
- Agent: user (the answers), claude (the record and what was read)
- Basis: the user's message of 2026-11-14, answering CHECKPOINT's three questions; `.github/workflows/monthly-build.yml`,
  `pipeline/fetch.py` and `pipeline/guardrails.py` as read that day; `gh` read-backs of the release and the variables.
- Context: #45 had joined `main` and `ui/explore` and waited. The next steps of the deploy each reach further than a
  branch: the site's code on `main`, a second build of a month already released, and the text of two hard rules.
- Decision (user):
  1. Merge #45. Then open `ui/explore` into `main`, have it reviewed, and ask for that merge by number.
  2. Before AGENTS.md hard rules 7 and 8 are reworded, the user is shown the old and the new text in plain words and
     says yes. Until then both stand as written.
  3. A forced run of October comes after `ui/explore` is in `main`. First the user is told what it does to the existing
     release `cube-2026-10` (replaced, kept or refused), and says yes if anything would be overwritten.
  4. The dashboard export starts when the user says "ready".
  5. Nothing becomes public without asking. Anything the user must do is given in plain words, one step at a time.
- What a forced run of October does, as read (not run):
  - `pipeline run --force` builds whatever the register is on that day. If NZTA has not touched it, the month is built
    again from the same source. If it has, and the row count moved, the changed register is built as October; if it
    changed without the row count moving, the build stops (exit 2) and nothing is written.
  - On a build: `data/snapshots/2026-10.parquet` and `data/state/last_good.json` are committed again to `main`; the
    release `cube-2026-10` is kept and its one file, `public-data.tar.gz`, is **replaced** (`gh release upload
    --clobber`). The file it replaces is not kept by the release; a copy is in the 90-day artifact of run 43374803222.
  - The new file holds the fact table, which no public file has held: counts only, of which half the rows count one
    vehicle (STATE, known issues).
  - The archive job finds `mvr-2026-10.parquet` already in the private release and stops: a month's file is never
    replaced. `Deploy` is started and builds the site; it uploads nothing while `CLOUDFLARE_PAGES_PROJECT` is unset.
- Options considered: none by claude; these are the user's answers. Point 5 is taken to cover the forced run whether or
  not NZTA has changed the register, because either way a public release's file changes.
- Consequences:
  - #45 was merged on the user's word (`50caa55`), and #46 opened from `ui/explore` into `main`.
  - Hard rules 7 and 8 are not touched by #46. The proposed text is in CHECKPOINT until the user answers.
  - No forced run is started on the strength of an earlier permission (D-068's one forced run is spent).
- Status: accepted, decided by user; the reading of point 5 is claude's (unreviewed)

## D-081 2026-11-14 — The user's second answers: #46 merges; hard rules 7 and 8 are reworded as proposed; October is forced only if the daily run reports the source unchanged; no path from the user's computer stays in the docs
- Agent: user (the answers), claude (the record)
- Basis: the user's second message of 2026-11-14, answering the three questions of D-080's session; AGENTS.md as it
  stood; `gh` read-backs of #46 and of the `Deploy` run its merge started.
- Context: #46 was open, green and reviewed. Hard rule 7 listed exceptions that were all spent (the merges of D-068 and
  D-069, one forced run, #17 to #34 into `ui/explore`), and rule 8 named a gate that had passed (D-066). The reviewer
  of #46 had found a temp-folder path holding the Windows short user name in a committed report.
- Decision (user):
  1. "Merge 46." Done as a merge commit: `main` is `a41c2cf`, the same tree as `ui/explore`. The `Deploy` run of that
     push (43420177311) built the site from `cube-2026-10`, 7 pages, and uploaded nothing; the environment
     `production` has no deployment.
  2. "Yes to 7 and 8, as proposed." Rule 7 now reads: no push to `main` and no merge into it without the user's word in
     that session, naming the pull request; a merge into `main` also needs green checks and a reviewer that has not
     seen the author's reasoning; a forced Monthly build, and anything that makes something public, is asked for each
     time. The lines on agents' own branches and on `gh` are kept. Rule 8 keeps "don't build ahead of the current
     step" and D-041's exception for the site, and drops "as a local dev build only until the 8 November 2026 gate
     passes": the gate passed (D-066), deploying is Stage 1 of the brief, and each step that makes the site public is
     asked for.
  3. October is forced on one condition: only if the daily run of 14 November reports the source unchanged. claude
     reads that run first and tells the user what it said. If NZTA has changed the register, nothing is forced and
     December's refresh is waited for.
  4. The follow-up pull request removes the temp-folder path from `docs/brief/STAGE_0_REPORT.md` and any other path
     from the user's computer in the docs, and they are kept out from now on.
- Options considered: none for 1 to 3; the text of 2 is the proposal the user was shown (CHECKPOINT of `a2700f5`).
  For 4, decided by claude:
  - What counts: a path that shows the user's folders, drive layout or user name. Not counted, and kept: the standard
    install location of `gh`, which the commands need; `%LOCALAPPDATA%`-style and `~`-style paths, which name no
    one; paths relative to the repo; and `D:\nzta-archive`, an example the reports tell the user to replace.
  - This file is append-only, and D-068 named the backup folder's path. The user's instruction covers "the docs", so
    that one path is replaced in place by a description, and nothing else in D-068 is touched. Not chosen: leaving it
    because the file is append-only, which would keep the one path the user asked to have removed.
  - The commits that held the paths stay in the repository's history. Removing them would mean rewriting published
    history, which was not asked for and is not done.
- Consequences:
  - AGENTS.md carries the new rules 7 and 8, its "Branches" section says the site is on `main`, and its "Environment"
    section carries the rule on paths.
  - The backup folder's path is kept in claude's private memory, not in the repo.
  - A later session forces nothing on the strength of point 3: it is one run, tied to one day's report.
- Status: accepted, decided by user; the reading of point 4 (what counts, and the edit inside D-068) decided by Claude
  (unreviewed)

## D-082 2026-11-14 — Work order 1: what claude may do without asking, what it never does, and one report at the end
- Agent: user (the order), claude (the record)
- Basis: the user's message of 2026-11-14, saved unchanged as `docs/brief/WORK_ORDER.md` (commit `31dd24f`); AGENTS.md
  hard rules 7 and 8 as they stood after #47.
- Context: hard rule 7 asked for the user's word, by number, before every merge into `main`, and rule 8 for a stop and
  a report after every step. The brief's §10 capped the pull requests waiting on the user at five. The user wants the
  rest of the brief built across many sessions without being asked step by step.
- Decision (user), the order's §1 to §4:
  1. **Merges.** claude may merge a pull request of this work order into `main`, as a merge commit, when its checks
     are green, an independent reviewer agrees, it is inside the order's packages, and it touches nothing on the
     "never" list below. If Claude Code's own permission check refuses a merge, it is not worked around: the pull
     request stays open, the next package is stacked on it, and the user is given one batch line to say.
  2. **Also allowed:** merge #47 and delete `ui/explore` on GitHub, history untouched; one forced run of October, once,
     only if the most recent daily run reports the source unchanged; a hand pull of November if the archive job has
     not stored it within two days of NZTA's December refresh; creating, changing and deleting claude's own branches
     and pull requests; anything read-only against NZTA's open data service, Infoshare and the private archive.
  3. **Never without asking:** making the site public or publishing a new kind of data; anything that costs money or
     creates an account; anything that cannot be undone (deleting data, rewriting history, replacing an archived
     file); publishing an owner field (district, region, usage, industry class, owner type), postcode or anything
     derived from `VIN11` (building and testing them privately is allowed); changing CLAUDE.md's invariants,
     non-goals or shapes beyond what the order states; working around NZTA's block on automated readers; a second
     forced run.
  4. **No stopping for questions.** A choice not on the "never" list is taken by claude, recorded as "decided by
     Claude (unreviewed)", and listed in the final report. A blocked item is parked in CHECKPOINT with a
     recommendation and what happens with no answer. One report, when every package is done or parked.
  5. **The limit of five waiting pull requests is replaced** by point 1 (the brief §10 and §12 question 3).
  6. **Sub-agents:** only the lead spawns; each names its model; haiku for bulk rule-like work, sonnet for research,
     data engineering, pages and most code, opus for definitions, the data map, segmentation, the narrative spec,
     design and every independent review. The definitions and their check are D-085.
  7. **Nothing is public yet**, so definitions, names and layouts may change freely, each change recorded.
- Options considered: none; these are the user's instructions. Decided by claude, in recording them:
  - Hard rule 7 gets the amendment as a marked passage "for the life of work order 1", and its old text is kept, so
    the rule returns to what it was when the order closes without a further edit of its sense. Not chosen: rewriting
    the rule outright, which would outlive the order.
  - Hard rule 8 gets one sentence: during the order the steps are its packages, worked down the list with the
    (parallel) ones beside the one before, and one report at the end. The user did not name rule 8; "one report, at
    the end" (§1.3) cannot hold beside "a stop-and-report after each".
  - Hard rule 4 asks for a golden diff "shown to the user". The order has claude merge without stopping, so during
    the order the diff is shown in the pull request's description and listed in the final report. Not chosen:
    stopping for each golden change, which the order rules out; or dropping the showing.
- Consequences:
  - Done on 2026-11-14 on this authority: #47 merged (`6b69fcc`), `ui/explore` deleted on GitHub (all of it was in
    `main`; no history rewritten).
  - The memory of earlier sessions holds: on 2026-11-13 Claude Code's permission check refused a merge the docs
    allowed until the user said it in the session. The order says so in its own first message and in the "continue"
    message for later sessions.
  - A later session reads the order and CHECKPOINT, not this entry, for where the work stands.
- Status: accepted, decided by user; the three readings above decided by Claude (unreviewed)

## D-083 2026-11-14 — A sixth shape, `matrix`, is approved
- Agent: user
- Basis: the work order §4.1; the brief §6 ("A sixth shape is proposed") and §12 question 1.
- Context: CLAUDE.md allowed exactly five renderers and AGENTS.md hard rule 1 said "No sixth renderer". Once any field
  can be crossed with any other, a question such as brand by segment in one period fits none of the five.
- Decision (user): `matrix` is the sixth shape: a grid with one field down the side, one across the top, and a shaded
  count, share or average in each cell. CLAUDE.md's Shapes section and invariant 2, and AGENTS.md hard rule 1, say
  six. There is no seventh without a decision.
- Options considered (the brief §6): keep to five and draw crossed fields as small charts side by side or a table.
  Not chosen by the user. A table of the figures stays available for every question.
- Consequences:
  - The renderer is not built by this entry. It is package F's "second breakdown", and the chart rule table
    (package E) is what offers it: for two fields crossed, neither of them time.
  - It is drawn with Observable Plot, like the other five, and takes its look from the design system.
  - The brief also says a matrix "draws two numbers against each other, each cut into bands". That is the same grid
    with two ordered bands as its fields, not a seventh shape.
- Status: accepted, decided by user

## D-084 2026-11-14 — NZTA's registrations dashboard becomes a source: true registrations from January 2021, from the user's hand exports
- Agent: user (the decision and the exports), claude (the checks and the record)
- Basis: the work order §4.2, accepting D-075's option 3; the two files the user supplied, read on 2026-11-14 with a
  scratch script (DuckDB, counts only).
- Context: D-075 proposed the dashboard's history as the detail of true first registrations, after a test of one old
  month. `docs/DATA_SOURCES.md` §D said "never build a dependency on it". The user ran the test and the backfill.
- Decision (user): the dashboard is a source for registrations from January 2021.
  - **How it is fetched.** Not by the pipeline and not by claude. A Claude session in the user's own Chrome browser
    reads the dashboard's data engine and saves a CSV: a long table, one row per combination of the twelve
    dimensions, with a `Vehicles` count. `VIN - first 11` and `Physical post code` are not taken. Each month the same
    export is taken for the newest month. NZTA's block on automated readers is not worked around from this side.
  - **Where the files live:** gitignored `data/raw/nzta-dashboard/<YYYY-MM>/` for one month and
    `data/raw/nzta-dashboard/history/` for the backfill, with a copy in the user's backup folder.
  - Stats NZ's series stays the source of true totals before 2021 (D-065).
- Measured on 2026-11-14 (every figure equals the one the user gave):
  - January 2021 (`nzta-first-registrations-2021-01.csv`, 2,151,173 bytes): 17,221 rows, 30,011 vehicles. By import
    status: NEW 18,082; USED 10,542; RE-REG 1,217; SCRATCH 170. By owner type: Individual 18,863; Company 10,737;
    Other 411. By vehicle status: ACTIVE 27,041; INACTIVE 2,970.
  - The history (`nzta-first-registrations-2021-01_to_2026-10.csv`, 133,320,124 bytes, taken 14 November 2026): 70
    months, 991,274 rows, 1,883,786 vehicles. By year: 2021 370,014; 2022 355,210; 2023 332,105; 2024 290,504; 2025
    282,525; 2026 to October 253,428. Every `Vehicles` value is a whole number above zero and no header row is
    repeated inside the file. January 2021 inside it is the same 17,221 rows and 30,011 vehicles; October 2026 is
    28,896 vehicles, the figure of D-075.
  - Across the history: NEW 1,134,695; USED 682,892; RE-REG 55,135; SCRATCH 11,064. ACTIVE 1,802,934; INACTIVE
    80,852. Individual 1,045,469; Company 810,118; Other 28,199.
  - The export was taken as six yearly exports joined, because the engine cuts an export off at 5,000,000 cells (the
    user's account; each year's rows and total matched the engine's own count).
- Options considered: D-075's three. The user chose option 3.
- Consequences:
  - `docs/DATA_SOURCES.md` §D is rewritten: a hand export, never automated, in place of "never build a dependency".
  - The dataset, its definition in `docs/METRICS.md`, its guardrails and the maintainer script that checks and
    converts each file are the work order's package B. A flow series never shares a chart with survivors.
  - **Owner type is in the files and is not published** until the Stage 2 privacy review (the order §3). The
    territorial authority in these files is the owner's district and is held back the same way.
  - Past months in the dashboard can change, so each file is that month as exported on its date; the export date is
    kept with the file.
  - It rests on the user's export each month and on NZTA keeping the dashboard and its five-year window.
  - Two more copies of the history file, byte for byte the same, are still in the user's Downloads folder. They are
    the user's to delete.
- Status: accepted, decided by user

## D-085 2026-11-14 — Six sub-agent definitions, each naming its model, and a test on every pull request
- Agent: claude
- Basis: the work order §1.5; CLAUDE.md §Sub-agents (D-062), which marked both as planned; the brief §10's table.
- Context: no `.claude/agents/` definition existed, so every sub-agent was spawned ad hoc with its model given by
  hand, and nothing checked it.
- Options considered:
  1. One definition per job in the brief's table (about fifteen). Many would be used once.
  2. A few definitions by kind of work, each with the model the user named for that kind. Chosen: fewer files to
     keep right, and the brief's jobs each fall under one.
  3. No definitions, the model given at each spawn. Leaves the rule unenforced.
- Decision: six definitions in `.claude/agents/`:
  - `reviewer` (opus, read-only tools): independent review; gets the work and the spec, never the author's reasoning.
  - `data-engineer` (sonnet): pipeline, maintainer scripts, reference files, guardrails.
  - `page-builder` (sonnet): the site.
  - `researcher` (sonnet, read-only tools): profiling, comparing sources, reading runs, measuring pages.
  - `definitions-editor` (opus): the data map, definitions, privacy classes, the segment scheme, the narrative spec,
    design direction.
  - `bulk-worker` (haiku): bulk, rule-like work with a checkable result.
  - Each also names its `effort:`. Builders do not push, merge or edit STATE, CHECKPOINT or this file; they report
    to the lead.
  - The check is `pipeline/tests/test_agents.py`: every definition has a `name:` equal to its file name, a
    `description:`, and a `model:` that is an alias (haiku, sonnet, opus, fable) or a full model id; a missing model
    and `inherit` fail; an `effort:` must be one Claude Code knows. It also proves that it refuses five bad
    definitions. It sits with the pipeline tests because `checks.yml` already runs that folder on every pull
    request, so no workflow changes.
- Consequences:
  - A definition written during a session may not be loaded until the next one; until then a spawn names its model
    by hand, as CLAUDE.md already requires.
  - A review of a contract or invariant change may still be given to a stronger model at the spawn.
  - Reversing it: delete the folder and the test; CLAUDE.md's line returns to "planned".
- Status: decided by Claude (unreviewed)

## D-086 2026-11-14 — Three public pages (About, feedback and corrections, why figures differ), their words in config, and a corrections log as data
- Agent: claude
- Basis: the work order §5.D and §4.5; the brief §9, Stage 1 item 3; the pages as built on `claude/stage1-pages`, checked
  headless at 390 and 1280 px and with axe (no violations on the three pages at 390 px).
- Context: the site had no page saying who runs it, how to report a wrong figure, or why its figures differ from
  others'. The user has not decided the site's name, its address, or what the About page says about them.
- Options considered:
  1. Where the shared words live: in each page; or one config file. Chosen: `config/site.json`, so the footer's
     attribution and the About page's licence line are written once, and the user fills every gap in one place.
  2. The About page's gaps: leave the sections out until decided; or show each as a marked gap. Chosen: each gap is
     the text `[TO DECIDE: ...]` in `config/site.json`, highlighted on the page, and the page says it is a draft while
     any is left. One search for `TO DECIDE` finds them all.
  3. The corrections log: a hand-edited page; a file in `data/reference/`; or a file in `config/`. Chosen:
     `config/corrections.json`, a list of `date`, `wrong`, `changed`, `link`. It is not pipeline input, so it stays
     off the pipeline paths. The build fails on a row with a missing field, a date not written YYYY-MM-DD or a link
     that is not https. The log is empty and the page says no correction has been made yet.
  4. Feedback: a form; an email address; or a link to the repository's issues. Chosen: a plain link to GitHub issues.
     No embed, script or tracking, and no service to set up.
  5. Where the links go: the header; or the footer. Chosen: a footer group, so the four-link header does not crowd a
     phone.
  6. What the About page says about advertising, cookies and tracking. The code has none of the three. A statement
     that it never will is a promise the site makes to its visitors, so it is a gap for the user, not a sentence
     claude writes.
- Decision: as chosen above. `/differences` states no figure, year or brand: it says what each source counts
  (registrations are not sales; survivors are not registrations; the industry association counts deliveries and its
  figures are not open; other sites read NZTA's dashboard), each point linking to its definition.
  - **Invariant 8.** `/differences` is hand-written text about what the data counts, as `/method` and `/caveats`
    are. CLAUDE.md's "planned" note under invariant 8 names only those two. `/differences` is in the same position:
    it states definitions, no figure and no reason, and it moves onto templates with them when the narrative engine
    is built (package H). CLAUDE.md's invariants are not edited here; whether its note should name the page is the
    user's.
  - "A vehicle can be registered before it is sold" rests on D-030 and the caveat already on `/caveats`, which the
    page links.
- Consequences:
  - The user fills six gaps in `config/site.json` before the site goes public: the site's name, its address, who
    runs it, how to reach them, any connection to the motor industry, and what it promises about advertising,
    cookies and tracking. `docs/playbooks/go-public.md` says so.
  - `/differences` says other sites read the dashboard "rather than the open register this site reads". When the
    true-registrations dataset (package B) reaches the site, that sentence changes with it.
  - `docs/playbooks/go-public.md` lists the Cloudflare steps. None is started, and its console wording is marked
    "inferred - confirm": nobody here has seen Cloudflare's screens. The project's name is the user's to choose
    first, because it becomes the public address; it says where an early upload would be public and to stop there;
    and it says to stop at any request for payment.
  - The link to GitHub issues shows the repository owner's account name on the public site, which partly answers
    "who runs it" before the user has decided what the About page says. It is put to the user with the About gaps.
  - The attribution line and the About page name NZTA only. Both change when Stats NZ's series (package C) or the
    dashboard's dataset (package B) reaches the site.
  - `docs/playbooks/visitor-test.md` carries the ten starter questions, the acceptance question, the pass rule and a
    record sheet. No question has been tested.
  - Reversing it: delete the three pages, the two config files and the footer group.
- Status: decided by Claude (unreviewed)

## D-087 2026-11-14 — `registrations_flow` is defined: what it counts, what the history adds, what Vehicle Status means, and that the register's usage is today's
- Agent: claude
- Basis: a read-only comparison on 2026-11-14 by a sub-agent (sonnet): the user's history export (D-084) against the
  register as at 31 October 2026, read from the private archive's 35-field file into a scratch folder and deleted
  after (it holds no `VIN11` or postcode). Counts only, by DuckDB. The work order §5.B and §5.E.
- Context: D-084 made the dashboard a source. Before a dataset is built its definition has to say what it counts
  (CLAUDE.md, the goal's point 8), and the work order asks for four things by name: that past months can change, that
  it includes some re-registrations, what "Vehicle Status" means, and whether usage describes a vehicle at first
  registration or today.
- Measured:
  - The file is clean: no duplicate row, no key repeated with a different count, no month missing, no empty cell;
    January 2021's own file equals its months in the history row for row.
  - All vehicle types and statuses, 70 months: dashboard 1,883,786; register 1,801,451; 82,335 (4.4%) more, of which
    80,852 are marked `INACTIVE` and the rest are vehicles the dashboard counts as still registered and the register
    does not hold for those months.
    By import status, dashboard then register: USED 682,892 and 639,331; NEW 1,134,695 and 1,105,432; RE-REG 55,135
    and 46,898; SCRATCH 11,064 and 9,790. By vehicle type the most are passenger cars and vans (46,682) and trailers
    and caravans (20,960); the highest rate is mopeds (19.5%).
  - In-scope types, NEW and USED: dashboard 1,483,403; register 1,434,392. Survivors as a share, by year: 2021 93.3%;
    2022 95.1%; 2023 96.7%; 2024 97.8%; 2025 98.9%; 2026 99.8%.
  - `ACTIVE` vehicles against the register: 1,802,934 and 1,801,451, between 8 fewer and 65 more in any month.
    January 2021: 27,041 and 27,035. The `INACTIVE` share by year of first registration: 8.77%, 6.66%, 4.48%, 2.19%,
    1.03%, 0.24%.
  - The register never holds more than the dashboard in a month's total. It holds more in a few small cells (new
    vehicles in October 2026, 8 more; motor caravans in nine months counted by month and vehicle type, one or two
    more).
  - A step between October and November 2023, across every vehicle type and status: survivors as a share rise from
    95.7% to 97.3%, and the dashboard's inactive share falls from 4.21% to 2.62%. Most of it is trailers (91.1% to
    98.3%). Within the dataset's scope the two months are 97.0% and 97.4% (the reviewer's measure).
  - Values: body type, country, import status and vehicle type are the same sets in both; one make is spelled two
    ways in the dashboard; the dashboard's model names are finer for some nameplates; its usage list is 20 values to
    the register's 8. Rental share of passenger cars, the dashboard's `ACTIVE` vehicles then the register: October
    2026 25.1% and 25.3%; January 2025 3.89% and 1.64%; January 2023 7.63% and 2.18%; January 2021 1.45% and 0.21%.
  - Measured again by the reviewer of the pull request, independently, from the same two files: every figure above
    matched. Three in the docs were restated to what both measures support: the share of vehicles whose make and
    model appear in the register (98.2%), the share mapped by the brand registry (over 99.8%), and the goods vehicles
    whose class depends on mass (about 18%). The reviewer also measured the owner-type figures and the
    tourism/leisure and rental shares now in `docs/DATA_MAP.md`; the vehicle-trader shares there come from a separate
    profile of the register made the same day.
- Options considered:
  1. Which vehicles the dataset counts. (a) Everything in the export, re-registrations and every vehicle type. It
     would match the dashboard's own total and nobody else's, and could not be set beside survivors. (b) In-scope
     types, new and used only: the rule `registrations_surviving` uses. Chosen: completeness then compares like with
     like, and the scope changes for both in one place when heavy vehicles and motorcycles get their own areas
     (package I).
  2. `Vehicle Status`. (a) Take NZTA's page at its word ("cancelled in the same month"). (b) Define it from the data.
     Chosen (b): the page's wording cannot produce a share that rises to 9.9% over five years. The doc quotes both.
  3. Whether to drop `INACTIVE` vehicles. No: they are the registrations the register has lost, which is the point of
     the dataset.
  4. Completeness by model. Not offered: the two sources name some models differently, so a model's count in one
     is not always the same vehicles as in the other.
  5. The November 2023 step. Shown as it is and not explained: its cause is not known, and the site says what the
     data shows, never why.
  6. The dataset's name. `registrations_flow` was planned for Stats NZ's series (CLAUDE.md build step 1b,
     `docs/DATA_SOURCES.md` §C). It now names the dashboard's dataset, which is the one with make and model that
     starter question 1 needs; the Stats NZ dataset is named when it is built (package C). CLAUDE.md's step 1b and
     §C are changed to say so. Not chosen: a new name for the dashboard's dataset, leaving `registrations_flow`
     for a series that has no make or model.
  7. The moment the export shows. Not "the day of the export": NZTA says the dashboard is a snapshot at the end of
     each month, updated at the start of the next. The definition says "at its latest monthly update before the
     export was taken".
- Decision: `docs/METRICS.md` defines the dataset and completeness as above; `docs/DATA_MAP.md` gets the dashboard's
  thirteen fields, each with how it lines up with the register and a proposed privacy class, and settles the usage
  trap for `VEHICLE_USAGE`: the register's is the latest recorded usage (tested for rental only). `INDUSTRY_CLASS`
  looks current too and `Owner Type` looks as first registered; both rest on weaker evidence and neither is proven.
- Consequences:
  - The pipeline build of the dataset is a separate change (`docs/CUBE_SCHEMA.md`); these docs describe what it
    must produce.
  - The site's finer vehicle type and class (cars, utes, vans, trucks; light and heavy), engine size and fuel
    consumption cannot be asked of true registrations; NZTA's own vehicle type and body type can. The export has
    no gross mass or engine size. The dashboard offers groupings of both (NZTA's page, D-075). Whether the monthly export takes them,
    and the history is taken again, is a question for the user (CHECKPOINT).
  - "Who is buying" (starter question 7) is better asked of the dashboard's usage and owner type than of the
    register's, for any month but the newest. Both are owner fields and are not published before the Stage 2
    privacy review.
  - The make spelled two ways needs an alias in `brand_registry.csv`: one commit, with the build.
  - Not checked: why the dashboard holds more re-registered vehicles than the register; the cause of the 2023 step;
    the taxi difference; whether owner type is as first registered.
- Status: decided by Claude (unreviewed)

## D-088 2026-11-14 — The pipeline's small follow-ups: clearer aborts, three workflow hardenings, and what is left until it can be tried on the runner
- Agent: claude
- Basis: the work order §5.A; the follow-ups listed in CHECKPOINT (the reviews of #37 to #41 and the pipeline stack);
  the code and tests on `claude/pipeline-follow-ups`; the whole suite, 111 passed locally. The review comments on
  #37, #38 and #39 could not be read back from GitHub, so the items were taken as CHECKPOINT words them.
- Context: earlier reviews left a list of small faults in the pipeline and its workflows. The daily build must not
  break, and December's refresh is the next real build, so a workflow was changed only where a test or the pull
  request's own `Checks` run covers the change.
- Decision, pipeline (none changes what a build writes for valid input; the golden contract is untouched):
  1. An abort names its real cause: a fact column named `month`, `n` or `rid` is refused for its name; an events
     enum row that lists no values is blamed on the table, not on every event; a pair naming a dimension id that
     contains the file-name separator is refused.
  2. A test builds a second dataset with no fact table. `FACT_ROW_ORDER` sits with the other contract constants.
  3. The missed-month alarm day refuses `true`, which Python counts as day 1.
  4. **A run that builds nothing reports the last built month** as its `snapshot` output, not the source's month
     capped by today's date. Only the archive job reads that output; an archive started by hand on the 1st of a
     month then finds the month it must match. A run that builds is unchanged.
  5. `docs/CUBE_SCHEMA.md` lists the checks on the model registry and the mild hybrid file; `docs/METRICS.md` says
     both share guards test a pair slice's filtered base.
- Decision, workflows:
  6. `checks.yml`: the checkout does not keep the job's token (`persist-credentials: false`).
  7. `deploy.yml`: dependencies are installed without running their install scripts (`npm ci --ignore-scripts`;
     tried on a copy of the site on Windows, where the public build then succeeded; not yet run on GitHub's
     runner before the trial run recorded below); a re-run of the whole workflow may replace the `site` artifact
     (`overwrite: true`); and the check for links to internal pages matches single-quoted, templated and relative
     paths of the site's own, and not another site's address that holds the same word (an event's source link in
     `events.json` can).
- Left, each with its reason and what the change would be:
  - **The alarm runs only on runs that build nothing.** Deliberate: a build of an older month must still be
    committed, and the next day's run raises the alarm. Not changed.
  - **A digest of the rows the archive job pulls.** It would recompute the service's grouped counts from the pulled
    rows and compare them with the change key. It cannot be checked against the live service from a test, and a
    mismatch would fail the archive; it is built against a saved pull and tried by hand first.
  - **Pipeline dependencies pinned by hash.** Needs a compiled requirements file with hashes for Linux and
    `--require-hashes` in three jobs. A mistake breaks the daily build; it is tried on a pull request's `Checks`
    run, on its own, after December's build.
  - **A release left with no file by a failed upload.** A failed upload already fails its step loudly, and
    `Deploy` skips a release that has no cube file. The fix would create the release as a draft, upload, then
    publish it. It changes the release step of the daily build and cannot be tried without a real build, so it waits
    until after December's build.
  - **Admin bypass on the `production` environment** is a GitHub setting, the user's to change.
- Consequences:
  - `Deploy` was run on the branch before the merge (run 43566884149, started by hand): the site built on GitHub's
    runner with the changed install, and the upload job was skipped, as it is for any branch but `main`.
  - Merging this starts `Deploy` on `main`, because the workflow file is in its own paths. It builds the site and
    uploads nothing: the Cloudflare variable is unset.
  - `docs/CHECKPOINT.md` item 5's pipeline entries are each done here or carry a reason above. The file itself is
    rewritten with the site follow-ups' pull request (#52), not in this one. Two entries it also listed are not
    code: D-063's and D-064's headings still read "(proposed)" because this file is append-only (D-066 records
    that both were accepted); and no island reads `INTERNAL_PAGES` in the browser today (checked by the reviewer of
    the site follow-ups), so that entry is closed.
  - Reversing any one: each is its own commit.
- Status: decided by Claude (unreviewed)

## D-089 2026-11-14 — The site's small follow-ups: visitor wording moves onto the dimensions, a filter narrows event markers only in part, and what is left
- Agent: claude
- Basis: the work order §5.A; the follow-ups listed in CHECKPOINT (the reviews of #40, #43, #45 and #46); the code as
  read and as run headless at 390 and 1280 px on `claude/site-follow-ups`.
- Context: earlier reviews left a list of small faults on the site. Each was read against the code before anything
  was changed; one turned out not to be a fault, and one turned out to be half of one.
- Decision:
  1. **Visitor wording lives on the dimension.** The `public_copy` block in `config/presets.json` is gone. In
     `config/dimensions.json` a dimension may carry `public_label` and `public_note`, and a dataset
     `public_definition`: the words a visitor sees, beside the ones `/status` shows. The wording is unchanged. This
     is the move D-042 intended. Not chosen: leaving it in the presets file, where a dimension's words sat apart
     from the dimension.
  2. **A ranking reads a compound value's separator from config** (`key_separator` on the dimension). The code no
     longer names one dimension or one separator (invariant 1). The pipeline does not read that key: it joins the
     parts with the cube contract's constant, and a new test (`pipeline/tests/test_site_config.py`) holds the two
     equal.
  3. **A preset's filter narrows event markers only in part.** A chart tests an event's values against the rows it
     draws, and a filtered preset draws the filtered rows, so an event whose values have no vehicles left is not
     shown. But an event names one dimension: an event about heavy electric vehicles, scoped to the electric
     powertrain, is still marked on a chart of light passenger vehicles. `docs/EVENTS_LAYER.md` now says both. The
     follow-up from #45's review stays open (below); the first reading here, that it was no fault at all, was wrong,
     and the pull request's reviewer showed why with a row of `events.csv` dated July 2027.
  4. **Build:** a condition Build cannot apply is named by its label; a condition with no value yet survives a
     change elsewhere; the address is rewritten to the settled question when a link is read; a failed load of the
     starting values says so; the empty panel carries the dataset's definition.
  5. **The ranking table's line** names only the columns that are cut off or off the screen, the share column
     included on a narrow phone. **The map legend's** first label sits inside the chart box.
  6. **A chart with very many points draws.** Share or count by model over all time threw "Maximum call stack size
     exceeded" and drew nothing; the highest value is now found by reducing over the points.
- Left, each with its reason:
  - **An event cannot say which vehicles of a value it concerns.** It needs a second scope on an event (for example
    the vehicle class it applies to), a change to `events.csv`'s schema and to how the pipeline checks it. No chart
    shows a wrong marker today: the one event known to be affected is dated July 2027. It is on the work queue.
  - **A model's name shows as its two parts joined by the separator** everywhere in Build but the ranking (chips,
    suggestions, line labels, the panel's title). It was so before; it is visible now that share by model draws. It
    is fixed with "labels as data" (package H), where every value gets one display label.
  - **A heading level is skipped on `/build/`** (axe: `heading-order`, moderate; the same on `main` before this
    change). It is fixed with the page's redesign (package H).
  - **The grey band before 1970 on "Is the market getting more crowded?"** is what the data shows: months with too
    few surviving vehicles for a share, drawn grey on purpose, and the chart's note says so. Quietening it is a
    design choice for package H, not a fix.
  - **The status page's script chunk in the public build.** Astro emits it from the import whatever the page does
    at run time. Removing it needs a route filter in `astro.config.mjs` or a step in `deploy.yml`. It is unlinked
    and holds no data; it waits for package D's first-load work, which measures what the public build ships.
  - **A value in a link that is not in the data** shows as a chip and can draw an empty line; and **removing the
    last chosen value refills the five largest.** Both are choices about how Build behaves, and both are settled
    with package F's rework of chosen values.
  - **A share by model draws every named model** (300 lines and a 300-row table). It draws; whether it should is
    for the chart rule table (package E), which decides what fits a breakdown with many values.
- Consequences:
  - `config/dimensions.json` has three new optional keys. The pipeline does not read them (checked by reading
    `derive.py` and `outputs.py`), so the cube and the golden contract do not change.
  - The address rewrite also adds the default question to a bare `/build/` address.
  - What the browser downloads, public build, before and after (the reviewer's measure, gzipped): the Explore
    panel's script 72 bytes more, the question builder's 205 more, a shared runtime chunk 123 fewer: about 154
    bytes more in all (about 650 uncompressed).
  - Checked headless after the review: the brand and model rankings' line at 320, 390, 480 and 640 px.
  - Reversing any one: each is its own commit.
- Status: decided by Claude (unreviewed)

## D-090 2026-11-14 — The data map is finished: a new config file beside `dimensions.json`, privacy classes proposed for the user, two roll-ups dropped, and what "moves together" will mean
- Agent: claude (the definitions editor, a sub-agent on opus), doing the work order's package E, its
  data-map part. The chart rule table, Build reading it, the association figures each build and any
  binding are other work.
- Basis: a read-only profile of the register as at 31 October 2026, run on 2026-11-14 on the private
  archive's 35-field file (`mvr-2026-10.parquet`), two bases: the in-scope dataset (S, 4,520,476
  vehicles) and the whole register (W, 5,926,990). Its report and tables are in gitignored
  `data/staging/profiles/2026-10/`. For `VIN11` and `POSTCODE`, D-076 and D-079; for the dashboard's
  columns, D-087; for `OBJECTID`, `CHASSIS7` and `ENGINE_NUMBER`, the first pass of 2026-11-13.
  `pipeline/tests/test_data_map.py`, `test_invariants.py` and `test_agents.py` run on the branch:
  all passed. Branch `claude/data-map` (pull request #53), commits `9f657e8`, `9440007`, `0f62008`,
  and, after the independent review, `39c2e6f` and `307d24c`.
- Context: CLAUDE.md's goal, point 8: "A field is defined before it is askable." The first pass
  (Stage 0) counted every field on the whole register and left five things open: meanings not checked
  against the data; coverage on the whole register only; coded values listed but not defined; no
  relation measured; and whether the machine-readable form extends `config/dimensions.json` or is a
  new file. The work order (§5.E) asks for all of it, and for the privacy classes as a proposal.
- Options considered:
  1. **Where the machine-readable form lives.**
     - (a) Extend `config/dimensions.json`. Not chosen. That file is the pipeline's build vocabulary:
       each entry is a dimension with a `derive` block, and a dimension without one is reported as not
       live in every build's manifest (`derive.applicable`), so 23 unbound fields would change the
       manifest and the golden contract. It also describes derived dimensions (powertrain, segment,
       region), not source fields; one source field feeds several dimensions and one dimension reads
       several fields.
     - (b) A CSV in `data/reference/`. Not chosen: uses, guards and relations are nested, and
       `data/reference/` is pipeline input under hard rule 5 (one commit per file).
     - (c) **A new file, `config/data_map.json`**, one entry per source field and dashboard column.
       Chosen. `dimensions.json` stays the list of what Build offers today; a field reaches it only by
       being bound and given a derive block. The new file is read by nothing in the build, so the cube
       and the golden contract do not change.
  2. **What the file holds.** Measured figures go stale every month, so they are left out: they live
     in `docs/DATA_MAP.md` and, later, in a per-build output. The file holds what is stable: kind,
     few or many values (threshold in config: 8, the number of line colours the site can tell apart,
     D-060), uses, guards, who a field is recorded for, its forms of "not recorded" and which of them
     `sentinels.csv` lacks, privacy class, binding, relations, and a one-line definition.
  3. **How the tests find which fields a dimension reads.** (a) A list per dimension in the map.
     Not chosen: it would drift from the derive blocks. (b) **Read the derive blocks generically**:
     any string in a block that is a logical field of `config/pipeline.json`, plus, per derive kind,
     the fields the kind reads without naming them (`derive_reads` in the map, as paths into
     `pipeline.json`), plus make and model wherever motive power is read (the hybrid
     classification rewrites motive power from them). Chosen. The check covers fact-table columns,
     pairs, every dimension's slice and the committed snapshot aggregate (`snapshot_archive.group_by`).
     The `region` slice, which reads the owner's district and is public, is recorded as an exception
     on the `TLA` entry (`published_exceptions`, naming D-078 and the outputs it covers: the slice
     only), not in code. **That exception rests on D-078's point 3, which was Claude's reading of the
     user's option ("the region map still draws"), decided by Claude and unreviewed**; the work order
     §3, written later, names region among the fields not published without asking. Recording it as
     an exception describes what is published today; it does not approve it, and whether the slice
     stays is put to the user.
  4. **The privacy enum.**
     - (a) The brief's three classes as they stand: public; public above a minimum count; never
       published. Not chosen: it has no place for "held until the user approves the review", which
       the work order requires, and it puts never-pulled fields beside fields the archive keeps.
     - (b) Two classes, published or not, with every nuance in prose. Not chosen: a test could not
       tell a field held for the review from one never published, and Build could not say why a
       field is missing.
     - (c) One class per decision record. Not chosen: too fine to read, and it would change with
       every decision.
     - (d) **Four classes, each with flags the code reads** (published, pulled, pending review):
       proposed public; not published before the review; never published; never pulled. A held field
       also says what is proposed for after the review (a minimum count; area totals above a minimum
       count; derived fields only). Chosen.
  5. **The roll-ups.** The profile tested nine dependencies on S and the same nine on W, plus district
     to region; two of the first pass's claims failed and are dropped:
     body type to vehicle type (4 of 13 S body types sit under both vehicle types, 41,952 vehicles off
     the commoner one) and road transport code to industry class (19 of 20 codes under more than one
     class, 3,565 of 57,232 vehicles off). Kept: district to region (`tla_region.csv`, a best fit for
     seven straddling districts); class to vehicle type on S only (1 vehicle of 4,286,433 disagrees;
     not on W); make to manufacturer group and owner country (by construction); model to make only as
     the site's make-and-model pair (the raw name sits under more than one make for 1,427 of 28,000 S
     models). The two model codes are not clean keys (1,329 and 4,915 S codes with more than one make
     and model).
  6. **What "moves together with" means on the site.**
     - (a) Asserted pairs written by hand (the brief's example, "colour and vehicle weight"). Not
       chosen: the brief asks for measured, and that example measures weak (0.14).
     - (b) Mutual information or a correlation coefficient. Not chosen: most fields are categories,
       and neither gives one 0-to-1 scale across fields with different numbers of values as simply.
     - (c) Show every pair's figure. Not chosen: pairs true by definition (class and vehicle type,
       1.00) would read as findings, and a list of numbers is not a note a visitor can use.
     - (d) **Bias-corrected Cramér's V between two fields on the in-scope dataset, computed each build
       (not by this work), with the pairs true by definition or by construction listed in the map and
       never offered.** Chosen. For any other strong pair the workbench shows one neutral line (the two
       fields move together; holding one fixed may change the answer), with the figure one step away,
       and never a reason. The threshold and the wording are config, set by the work that builds it.
- Decision:
  - `docs/DATA_MAP.md` is rewritten as the finished map: 40 register fields and 13 dashboard columns,
    each with meaning, kind, values, uses, coverage, not recorded, traps, proposed privacy class and
    relations, then the relations in full, the order for binding, the files it disagrees with, and
    notes for the work that builds on it.
  - `config/data_map.json` is the machine-readable form, and `pipeline/tests/test_data_map.py` keeps
    it whole and true to `pipeline/expected_schema.json`, `config/pipeline.json` (bindings, guards,
    never-pulled list), `config/dimensions.json` and `sentinels.csv`. It fails if a fact-table
    column, a pair, a dimension's slice or the committed snapshot aggregate reads a held field other
    than through a recorded exception (today only the `region` slice). While the classes are
    proposed it also fails if an approval is recorded without a decision, if an owner field or a
    field derivable only from `VIN11` is marked published, if free text is offered as a breakdown or
    filter, or if an exception reaches past the outputs its decision covers or into the fact table.
    It does not see a published file written by any other route.
  - **The privacy classes are proposed, for the user** (`approval.privacy_classes` is `proposed`):
    - Proposed public (31 register fields, 10 dashboard columns): everything that describes the
      vehicle, the two model codes and submodel included (never offered as breakdowns).
    - Not published before the review (5 register, 3 dashboard): `TLA` and `region` from it,
      `POSTCODE`, `VEHICLE_USAGE`, `INDUSTRY_CLASS`, `ROAD_TRANSPORT_CODE`; `Owner Type`,
      `Territorial authority`, `Vehicle usage`. Proposed for after it: public above a minimum count;
      the postcode as area totals above a minimum count.
    - Never published: `VIN11` (a derived field only once checked and approved), `OBJECTID`.
    - Never pulled: `CHASSIS7`, `ENGINE_NUMBER`.
  - **What the user is asked to approve:** the vehicle fields as public; what the owner fields become
    after the review, and the minimum count; whether the public `region` slice stays the one
    exception; the postcode's rule; and whether vehicles may be matched between two archive files,
    privately, to settle whether usage and industry class are today's values.
  - The trap the work order names is settled as far as the data allows: `VEHICLE_USAGE` reads as
    today's (D-087; shown for rental, other values not tested, taxi does not fit); `INDUSTRY_CLASS` is at least partly today's (the vehicle-trader share falls
    from 3.6% for October 2026 to 0.2% to 0.5% for months more than a year old, NZ-new passenger cars,
    S). Two snapshots of the same vehicles would settle both.
- Contradictions with existing files (noted in `docs/DATA_MAP.md`, none changed):
  - `config/dimensions.json` still calls `registrations_flow` Stats NZ's series, "planned: build step
    1b"; D-087 gave the name to the dashboard's dataset.
  - `sentinels.csv`'s notes carry 2026-08 counts that the October profile does not match in three
    places.
  - The bound engine band "4.0 L and over" has no upper limit: 382 S engine sizes above 20,000 cc,
    which are not real, land in it.
  - The bound fuel-consumption guard (above 0, at most 60) is wider than the profile's proposed 0.1
    to 30 (83 S values above 30).
  - `segment_map.csv`'s goods rows start at 1 kg, so the 1 kg placeholder (1,477 S vehicles, types
    not split) can place a goods vehicle in a light class.
  - `docs/brief/MASTER_BRIEF.md` §6 gives body type to vehicle type as a roll-up, "colour and vehicle
    weight" as an example of moving together (measured 0.14, weak), and `CHASSIS7` and
    `ENGINE_NUMBER` as never published (they are never pulled).
  - `docs/CUBE_SCHEMA.md` lists `powertrain__region` among the pairs that may be added; it reads the
    owner's district.
  - CLAUDE.md's repo layout marks `docs/DATA_MAP.md` "planned" and does not list
    `config/data_map.json`; the brief's §4 calls the map a first pass.
  - The published `region` slice and the work order's §3 (above, option 3).
  - The profile's report gives 107 used imports with a transmission and with an MVMA code;
    `coverage.csv` gives 116 and 131 (107 is the count with all three NZ-new fields).
- Consequences:
  - Nothing published changes: no binding, no pipeline change, no golden change.
  - Adding to `sentinels.csv` a form that a field's `not_recorded` already lists fails
    `test_data_map.py` until that field's `sentinels_pending` is updated in the same commit. A form
    the map does not list passes unseen; the map's lists are only as complete as the profile.
  - Binding a field into the fact table puts a new kind of data in the monthly cube release, which is
    public: the work order's §3 asks first even for a vehicle field. A field bound can only split the
    table's rows, so the share of vehicles alone in a row stays the same or rises (on the 2026-10 dry
    run, 50.2% of rows count one vehicle, holding 7.1% of vehicles, D-078).
  - The chart rule table and Build read `kind`, `cardinality` and `uses` from the new file; the method
    page reads `definition`.
  - Reversing it: delete `config/data_map.json` and its test; `docs/DATA_MAP.md`'s history is in git.
- Status: decided by Claude (unreviewed). The privacy classes: proposed, for the user; they bind
  nothing until the user approves them.
