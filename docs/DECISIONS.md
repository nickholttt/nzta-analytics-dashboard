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
