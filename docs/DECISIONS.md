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

## D-091 2026-11-14 — The query service: its question format and checks are specified, a local prototype is measured, and one way of hosting it is proposed for the user
- Agent: claude (the work by a sub-agent on opus; this record by the lead)
- Basis: the work order §5.G; CLAUDE.md invariant 6; the brief §9, Stage 2 item 2; `docs/QUERY_SERVICE.md` and
  `docs/brief/QUERY_SERVICE_PROPOSAL.md` on `claude/query-service`; measurements made on 2026-11-14 on this computer
  against the 2026-10 dry-run cube; providers' pricing pages read that day.
- Context: Build answers a question by downloading columns of the fact table and summing them in the browser (D-058).
  CLAUDE.md plans a hosted service that takes a structured question and returns only the rows a chart needs. The
  work order asks for the format, a local prototype, measurements and a proposal, and for nothing to be provisioned.
- Decision (by Claude, unreviewed), what is built:
  1. **The question is Build's address-bar form** (D-060), so a link, a saved question and a request are one thing.
     Two keys are added to the form for later use: a second breakdown (for the `matrix` shape) and a snapshot to pin
     to. Chart settings are not part of the stored question.
  2. **What a service checks:** every field is defined in `config/dimensions.json`, live in the manifest, carried by
     the fact table and not withheld; values are passed as parameters, never written into a query; a question over a
     limit is refused, never cut short; a minimum-count rule has its hook, and no field has a rule yet.
  3. **A local prototype** in `scripts/query_service_prototype/` (Python's own HTTP server and DuckDB; no new
     dependency), with 59 tests, among them that it answers only with counts, refuses a field that is not public,
     treats a value carrying SQL as a value, and refuses a question over each limit. The hostile and limit cases
     live in a data file (`cases.json`), so a later implementation can be run against the same cases. It is a
     maintainer's tool run by hand, not part of the pipeline or the deploy.
  4. **The seam in `src/lib/data.ts`**, switched by a build-time setting that is off by default. With it off the
     site makes the same requests as before and ships 147 bytes more of compressed script (measured). When the
     service is on and not answering, Explore still draws and Build says so plainly; it does not fall back silently.
- Measured (medians of three runs; the phone profile is the one D-058 used; the service ran on the same computer as
  the browser, so its figures are a floor, not a forecast):
  - First answer on the phone, today's static files then the local service, for questions naming 3, 5 and 8 fields:
    7.4 and 4.2 s; 8.9 and 5.0 s; 11.6 and 5.0 s. Downloaded: 1,024 and 511 KB; 1,218 and 516 KB; 1,671 and 531 KB.
  - On a desktop: 0.72 and 0.42 s; 0.82 and 0.66 s; 0.96 and 1.21 s.
  - Neither side meets the 3 second target on the phone: about 460 KB of what the service side downloads is the
    page's own code and fonts.
- Proposed, for the user to decide (`docs/brief/QUERY_SERVICE_PROPOSAL.md` has the options, the figures and their
  sources): a function deployed with the site on Cloudflare, on its paid plan at US$5 a month, running the same sums
  the browser runs today. Its risk is memory, so the first step would be a short trial on Cloudflare. The other
  options: no service (no cost; the slowest); a small container (about US$5 to US$15 a month, or free within one
  provider's free tier, with a wait of a few seconds after a quiet spell); a managed analytics database (nothing to
  several hundred dollars a month depending on traffic). Several of these figures are estimates and are marked so.
- Consequences:
  - Nothing is provisioned, no account is created and nothing is spent. Build keeps reading the static fact table.
  - The largest saving on first load is not the service: it is the page's own code and fonts, which package D's
    first-load work measures and trims.
  - The prototype's tests are not run by `Checks`, which runs `pipeline/tests` only.
  - The sub-agent ran a review of its own. That is not the independent review the merge needs; the lead ran one,
    which re-measured the timings (within a few tenths of a second on the phone), read the providers' pricing pages
    and found the quoted prices on them, and asked for the tests and citations added since.
  - The recommended option would sum in JavaScript, not in the DuckDB engine that was measured, and its checks
    would be written a second time: the shared cases are there to hold the two to the same answers.
  - Reversing it: delete the two docs, the prototype folder and the seam (one setting and one branch in `data.ts`).
- Status: what is built, decided by Claude (unreviewed); the hosting choice and any spending, proposed, for the user

## D-092 2026-11-14 — `registrations_flow` is built: a maintainer's `supply` command, a local store, and the dataset run through the register's own code
- Agent: claude (the build by a sub-agent on sonnet, to the lead's plan; this record by the lead)
- Basis: the work order §5.B; D-084 (the source) and D-087 (the definition); the code and tests on
  `claude/registrations-flow`; the whole suite, 254 passed locally with `main` merged in; real runs on 14 and 15 November 2026 (New Zealand time): `supply` on the user's two
  files, then `python -m pipeline build <the saved October pull> --dry-run`, exit 0 in 741 s, publishing nothing; an
  independent review, whose points are taken below.
- Context: the dashboard's export is a table of counts on the user's computer. The pipeline builds from one row per
  vehicle, pulled from NZTA's service, and runs unattended on GitHub. The work order asks for the export to be its
  own dataset, with guardrails (every month present, totals match, no month replaced silently), checked and converted
  by a maintainer script, and never fetched by the pipeline.
- Options considered:
  1. **Where the check-and-convert step lives.** (a) A stand-alone script in `scripts/`. (b) A command of the pipeline's
     own program, `python -m pipeline supply <source> <file>`, run by hand. Chosen (b): one tested code path, the same
     config loader, and no column name of the export in code. It is still a maintainer's step: no workflow runs it
     and it fetches nothing.
  2. **How the dataset is built.** (a) New code that sums the export's counts into slices. (b) Turn each counted row
     back into that many vehicle rows, named as the register's fields, and run the register's own normalise, derive,
     metrics and output code. Chosen (b): sentinels, scope, brand aliases, the model registry, the hybrid
     classification, the model cap and every unmapped guard then apply to both datasets identically, and nothing can
     drift between them. It costs build time (the dry run went from about 11 minutes to about 12 to 15).
  3. **Where the converted data lives.** (a) Committed to this public repository. (b) The private archive. (c) A local
     folder, gitignored. Chosen (c) for now, `data/supplied/`: (a) publishes a new kind of data, which the work order
     keeps for the user; (b) needs a secret in the build. It is the user's question (CHECKPOINT).
  4. **A build with no store.** (a) Abort. (b) Build everything else and say plainly that the dataset was not built.
     Chosen (b), because GitHub's runs have no store today and must keep working: the manifest carries
     `not_built` with the reason, and a warning is printed. A dataset that WAS built in the last good run and whose
     store has since gone aborts the build, so it can never drop out silently.
  5. **The dataset's clock.** Its latest month is the last month in its store, not the register's snapshot month. A
     store older than the register warns and names the missing month; a store newer than the register aborts.
  6. **Breakdowns the export cannot support** are decided from the source's field list, not from a list of names: a
     dimension whose derive block reads a field the source lacks is not live, with the reason in the manifest.
  7. **Age when first registered** applies to this dataset (decided by the lead after the build): the export carries
     the vehicle year and the month, and every vehicle year in it is one the register holds (D-087). **Vehicle age**
     (years since the vehicle year, as at the snapshot) does not: an age today for a vehicle no longer on the register
     is not a sound figure, so that dimension now applies to the survivors datasets only.
  8. **The owner columns** (`Owner Type`, `Territorial authority`, `Vehicle usage`) must be in the file, so a changed
     export is noticed, and are dropped before anything is stored. A test asserts the store has none of them.
- Decision: as chosen above. Also decided in the build, each reversible:
  - a file's header is checked as a set of columns, not their order;
  - the export's date must be on or after the last day of its last month;
  - a month already stored is left alone when a new file gives the same rows; a different month aborts unless it is
    named with `--replace`, and a replacement is recorded in the store's ledger with both totals, dates and file
    hashes;
  - a month whose total in the store moves by more than 2% against the last good build aborts, unless a replacement
    of that month is in the ledger from a file taken on or after the day of that build (the file's taken date
    decides, not the day it was supplied: an older export supplied late does not excuse its month). The comparison
    is of the store's own totals, kept in the state file, so an edit to a scope file cannot trip it;
  - the ledger records the store file's hash, and `supply` and the build both refuse a store and a ledger that do
    not belong together; both files are written under temporary names and the ledger is put in place last. The
    ledger also records, for each file supplied, the totals it was checked against, or that none were given;
  - a column listed as private can never be mapped to a stored field: `supply` and the build both refuse such a
    config;
  - every dataset's manifest entry gains `latest_month`;
  - the site treats a dataset the manifest marks as not built as absent (one commit in `src/lib/`): without it the
    site's own build failed on the manifest GitHub's builds will write, which the independent review found.
- Golden contract changes, each its own commit with its reason: (1) the dataset appears in the manifest as not built,
  with one warning, and `latest_month` is added to the survivors dataset's entry (six lines; no slice, pair, fact or
  events file changes); (2) the definition's wording, one line (D-087's sentence).
- Measured on the real run:
  - `supply` on the history file: 3.8 s; all seven of the user's totals matched; the store is 1,929,698 bytes of
    counts (426,732 rows after the owner columns are summed away, from 991,274 in the file) and a ledger of 18,238
    bytes (17,750 before it recorded the store's hash and each file's checked totals). The January 2021 file then reported "unchanged" and wrote nothing.
  - The dataset: 1,483,403 vehicles over 70 months, January 2021 to October 2026 (the figure D-087 measured
    independently). Live: powertrain, brand and its three groupings, built in, new or used, age when first
    registered, model. Not live, each with its reason: vehicle type and class (no gross mass), region (no district),
    engine size (none), imported from and vehicle age (do not apply).
  - Unmapped makes: 0.131% of in-scope vehicles after the alias `LANDROVER` was added to `brand_registry.csv`
    (0.159% before). Powertrain, built in and new or used: none unmapped. No guard warned or aborted.
  - The 300 named models cover 95.0% of the trailing 12 months and 88.9% of all 70.
  - The fact table: 129,103 rows over nine dimensions. Files: slices 130,219 bytes, fact table 345,774 bytes. The
    whole payload is 3,625,451 bytes against a budget of 8,000,000.
  - One warning: mild hybrids are identified for 62.7% of this dataset's hybrids at high confidence over the
    trailing 12 months, under the 70% the pipeline warns at (the survivors dataset is above it).
  - The survivors dataset is unchanged: 4,520,304 vehicles over 1,197 months.
- Consequences:
  - GitHub's builds say the dataset is not built until the user decides where the store may live. The site must read
    `not_built` before treating a dataset as present.
  - Each month the user's export is added with one command (`docs/playbooks/supply-dashboard-month.md`).
  - The month-change guard compares with the last good state, which a dry run does not write, so it has run only in
    tests.
  - The state file GitHub's builds commit gains one empty entry, `supplied_totals`, beside `latest_month` in the
    manifest; nothing reads it while there is no store.
  - A local build that publishes with the store present writes the dataset into the state file. That file is the
    Action's to commit (hard rule 3); if a local copy were committed, GitHub's builds would abort for want of the
    store. The playbook and AGENTS.md say to build with `--dry-run` after supplying a month.
  - The mild hybrid coverage on this dataset is below the pipeline's warning level; the powertrain label already
    says "identified" (`docs/METRICS.md`). It is listed in the work queue.
  - Reversing it: remove the dataset's entry from `config/pipeline.json`; the `supply` command and the store then
    feed nothing.
- Status: decided by Claude (unreviewed)

## D-093 2026-11-15 — True registrations on the site: a group in Explore, a choice of what Build counts, a ranking for any month, and completeness as a chart of its own
- Agent: claude (the build by a sub-agent on sonnet, to the lead's plan; this record by the lead)
- Basis: the work order §5.B's "done when"; D-087 (the definition and completeness) and D-092 (the dataset); the code
  on `claude/flow-site`; a local build on the dry-run cube of D-092, checked headless at 320, 390 and 1280 px; an
  independent review, which compared five months and four rankings with the cube's files (all matched) and whose
  points are taken below.
- Context: `registrations_flow` existed in the cube and nowhere on the site. The work order asks that the site answer
  "how many vehicles were registered last month, and is that up or down on a year ago" from true registrations, by
  make and model, for any month since January 2021; that completeness be shown and never used to scale a figure;
  and that a flow series never share a chart with survivors.
- Options considered:
  1. **Where the new charts sit in Explore.** (a) First on the page, since it answers starter question 1. (b) Last,
     drawn only when scrolled to. Chosen (b) for now: first load is already slow (STATE), and a first group that
     reads a second dataset would add to it. It moves up when the home page is rebuilt around the latest month
     (package H). The user may want (a) sooner.
  2. **How Build offers the dataset.** (a) A second page. (b) A choice inside the question: "Counting: vehicles
     still registered / true registrations". Chosen (b): one builder, one set of definitions; the fields, values,
     conditions and periods offered follow the chosen dataset's manifest entry. The address carries
     `build.dataset` only when it is not the first dataset, so every existing link means what it meant.
  3. **A chosen month.** (a) Only for the new dataset. (b) For every ranking on the site. Chosen (b): the ranking's
     window can end on any month (`<preset>.month` in the address), and a one-month ranking sits beside the
     12-month one wherever a chart already ranks or offers a ranking.
  4. **Completeness.** (a) Two lines, survivors and registrations, on one chart. Ruled out: a flow series never
     shares a chart with survivors. (b) A ratio computed in the browser from the two datasets' slices for the same
     dimension and month, on a chart of its own. Chosen (b), declared in config (numerator dataset, denominator
     dataset, dimension, its own definition and note). Months under the share guards' floor are left out. A value
     above 100% is drawn as it is. Its axis starts where the data does, and the chart says so.
  5. **A build without the dataset** (GitHub's builds today). The group shows one plain message from config and no
     controls; Build offers no choice; nothing else changes. A link that asks Build to count a dataset the build
     does not have, or to break down by a field the chosen dataset does not have, is answered with a one-line notice
     saying what was asked and what is shown instead, never silently.
  6. **Where the sentences are built.** (a) In the chart components. (b) In one module with no imports
     (`src/lib/sentences.ts`), from templates in config. Chosen (b) after the review found three faults in (a): a
     garbled hover line, an answer that changed with the window drawn, and a ranking line describing a comparison
     that did not exist. The change on a year ago is now read from every month the dataset has, whatever window is
     drawn, and a sentence that cannot be filled takes its plain form.
- Decision: as chosen above. New in config: on a dataset, `public_label`, `words` (what its charts count),
  `source_note`, `not_built_message` and `shows_year_change`; `builder.datasets` and `builder.notices`;
  `groups[].defer`; `preset.answer` (the sentence above a chart); `defaults.phrases` and
  `defaults.year_change_measure`; and the derived measure's `numerator_dataset`, `denominator_dataset`,
  `total_label`, `definition` and `note_template`. The answer line, the hover line, the ranking's lines and the
  notices are templates. The change on a year ago is withheld when its base is under 50, as `docs/METRICS.md` says,
  and is rounded by one rule in the sentence and the hover (one decimal under 10%, whole above), stated on
  `/method`. The answer sits directly under the question. A time window is offered only where it draws something
  different from the others.
- Tests, new with this change:
  - `config/narrative/rules.json` lists the placeholders each kind of template may use and the causal and
    judgement words none may contain; `pipeline/tests/test_site_config.py` checks every new template against it
    (fillable placeholders, no digit or year, no banned word), and that the datasets and measures the new config
    names exist. This is the first file of the narrative config CLAUDE.md plans.
  - `tests/site/sentences.test.ts`: eleven tests, run with Node's own test runner and no new dependency
    (`node --test "tests/site/*.test.ts"`). The sentence module decides for itself, from the rows it is given, what the
    year-ago figure is and whether earlier figures exist; the charts pass it the dataset's whole rows, and two of
    the tests read the two chart components' source to check that. Each of the three faults the review found, put
    back in the module or in a component as it was, fails a test. A deliberate edit that narrows the rows before
    they are passed would not be caught: the module trusts the rows it is given. They are not in `Checks` yet: that is a workflow
    change, queued with the chart rules. `tests/` is a new top-level folder.
- Measured on the local build:
  - March 2021, June 2023 and October 2026: the site shows 26,333, 40,598 and 23,554 vehicles registered, the
    totals in the cube's file. Completeness shows 92.9%, 97.0% and 100.0%; computed from the two datasets' files:
    92.92%, 97.03% and 100.03%.
  - What the browser downloads at phone width, before and after: the home page to its first chart, 18 requests and
    983,654 bytes, then 17 and 934,603 (the old model chart no longer loads at the start); Build to its first
    answer, 12 requests and 509,627 bytes, then 12 and 516,704.
  - axe: the home page is clean at both widths; Build has the one heading-order finding it had before (D-089).
  - Not covered by a test, checked in the browser only: Build's two notices (the first version of them vanished
    when Build chose its own starting values, which the review caught; a notice is now cleared only by the
    visitor's own change), and any route by which a component might bypass the sentence module altogether.
- Consequences:
  - Starter question 1 is answered from true registrations on a local build, and starter question 5 (which models
    lead) is answered for the first time: the model ranking that was blocked since D-029 is live on this dataset.
  - Completeness is shown in total and by new or used. By NZTA's vehicle type, which the work order also asks for,
    it waits for that dimension on both datasets, a pipeline change with a golden change of its own (CHECKPOINT).
    Its chart carries its own definition, with both datasets' definitions in its notes.
  - A chart that already ranks, or offers a ranking, gains a one-month ranking beside the 12-month one, on every
    dataset. A chart that had no ranking is unchanged.
  - A link to a chart far down the page now loads it and scrolls to it, deferred or not.
  - `/method` has plain sections on true registrations and completeness; `/differences` no longer says the site
    reads only the open register; the footer's attribution names the dashboard beside the register.
  - `config/dimensions.json` and `config/measures.json` gained site-only keys. The pipeline does not read them
    (the golden and data-map tests pass).
  - Reversing it: remove the Explore group and `builder.datasets` from `config/presets.json`; the code then offers
    nothing new.
- Status: decided by Claude (unreviewed)

## D-094 2026-11-15 — `registrations_cars_long_run` is built: Stats NZ's series as a second kind of supplied source, cars from January 1961
- Agent: claude (the build by a sub-agent on sonnet, to the lead's plan; the definition and this record by the lead)
- Basis: the work order §5.C; D-065 (accepted by the user in D-066); D-092 (the supplied-source code it builds on);
  the code and tests on `claude/statsnz-long-run`; the whole suite, 426 passed locally with `main` merged in;
  a real run on 2026-11-15: `supply` on the series exported on 14 November 2026, then a dry-run build of the saved
  October pull with both stores present, exit 0 in 707 s, publishing nothing.
- Context: D-065 made Stats NZ's Infoshare series the source of true monthly totals before 2021, by a hand export
  and a maintainer command. The series is a table of counts by month, not rows of vehicles, so it cannot go through
  the vehicle-row path `registrations_flow` uses. No hand export was on disk; the work order allows read-only access
  to Infoshare, and a copy was fetched once on 14 November for building and testing.
- Options considered:
  1. **How the series enters the build.** (a) A separate script that writes slices directly. (b) A second kind of
     supplied source, a series, sharing the store, the ledger and their checks with the first kind (counted rows).
     Chosen (b): the hash check, the temporary-name writes, "not built when the store is absent", "abort if a built
     dataset's store vanishes" and the per-dataset latest month are one piece of code for both.
  2. **Which series become a dataset.** (a) All 26. (b) Cars only. Chosen (b): Stats NZ's commercial, bus and
     motorcycle classes are not lined up with NZTA's vehicle types (D-065). The others are kept in the store.
  3. **The dataset's breakdowns.** (a) The two Stats NZ publishes, each on its own: new or ex-overseas, and its
     seven engine bands, each from July 1975. (b) Those, and a fact table crossing them. Chosen (a): Stats NZ
     publishes the two separately, so no figure exists for the cross, and a table would invent one.
  4. **Months before a breakdown starts.** (a) Leave the months out of that breakdown. (b) Carry the month's cars as
     "not recorded". Chosen (b): the slice then adds up to the month's total, and nothing is guessed.
  5. **Where the published bands do not add up to the published total** (two months). One car short (May 1976): the
     car is "not recorded". One car over (July 1975): (a) trim one band so they add up; (b) scale the bands; (c)
     leave the month out of the breakdown; (d) show the bands as published and name the month in the manifest.
     Chosen (d): (a) and (b) would change figures Stats NZ published, and (c) would hide a month that exists. Any
     other month where the bands exceed the total aborts, so a new disagreement is seen and decided, not absorbed.
  6. **The names of the two origin values.** (a) Stats NZ's own words, "new" and "ex-overseas". (b) The labels
     `import_status_map.csv` gives new and used imports. Chosen (b), so the dataset can be set beside the survivors
     by new or used without a mapping in the site; Stats NZ's word stays in the definition and the notes. Which
     series feeds which, and that new cars are the total less the ex-overseas series, is config.
  7. **Revisions.** (a) Take whatever a later export says. (b) Refuse a changed past month outright. (c) Refuse it
     unless it is accepted on the command line, and record an accepted one in the ledger. Chosen (c): (a) lets a
     figure already shown change with nobody deciding it, and (b) would leave a real correction by Stats NZ out for
     good. The build's month guard for this source allows no change at all without an accepted revision.
  8. **A damaged file.** An export with a break in its month rows (a blank line, a mistyped month) was at first read
     up to the break and accepted, dropping every later month; the independent review found it. The footer must now
     start on the line straight after the last month, and no later line may look like a row of the table; otherwise
     the command stops and names the line.
  9. **Which dimensions apply.** The two new dimensions name the dataset in `applies_to`. The register's
     dimensions are not edited: a series source carries none of the fields they read, so they are not live for it,
     with that reason, by the rule D-092 added. Not chosen: an `applies_to` list on every register dimension, which
     would have to be edited for every dataset added later.
- Decision: as chosen above. New: `python -m pipeline supply statsnz_tpt <csv>`; `pipeline/series.py`; the derive
  kind `series`; `data/reference/statsnz_series.csv` (the 26 headers, verbatim, with their group and role); the
  config block `supplied.statsnz_tpt` (the table's title and reference, the month format, the month from which the
  totals must add up, the attribution statement); the dataset and its two dimensions; `derive_reads.other_source_kinds`
  in `config/data_map.json`, so the data map's check skips dimensions that read no register field.
- Golden contract change, one commit with its reason: the dataset appears in the manifest as not built, with one
  warning; the survivors dataset's `not_live` gains the two new dimensions ("does not apply to this dataset"). No
  slice, pair, fact or events file changes, and `payload_bytes` is the same.
- Measured on the real run:
  - `supply`: 1.3 s; 789 months, January 1961 to September 2026; 16,432 figures; a store of 36,897 bytes and a ledger
    of 168,115 bytes. Three warnings, all for months before 1998, where Stats NZ's own totals and parts disagree:
    eleven disagreements in seven distinct months: the two car months above; five months of the commercial total;
    four of the commercial total with buses.
  - The dataset: 9,050,400 cars over 789 months. August 2026: 9,138 new and 8,159 ex-overseas, the figures D-065 read
    from Infoshare. Not recorded: 971,960 cars over 174 months on new or ex-overseas; 971,961 over 175 months on
    engine size.
  - The payload is 3,653,345 bytes, 27,894 more (two slices, 7,770 and 20,124 bytes), against a budget of 8,000,000.
  - The other two datasets are unchanged: 51 staged files are byte-identical to the build of D-092, and their
    manifest entries differ only in the two new `not_live` lines.
  - One new warning: the series ends at September 2026 and the register at October.
- Consequences:
  - GitHub's builds mark this dataset not built, as they do `registrations_flow`, until the store question is
    answered (CHECKPOINT). The user's own hand export replaces the fetched copy; the steps are in
    `docs/playbooks/supply-statsnz-series.md`, with the clicks that were read from the pages but not made in a
    browser marked "inferred - confirm".
  - The site does not show the dataset yet: the long-run chart with Stats NZ's attribution beside NZTA's, and
    completeness for cars from July 1975, are the next piece of package C. The site builds with the new manifest
    entry, built or not (checked on this branch).
  - In July 1975 the engine-band slice's counts add up to one more than the month's total; that month is the one
    listed exception to the slice rule.
  - Not checked: whether Stats NZ revises past months; whether its terms say anything about scripted access to
    Infoshare (the pages read are silent); the name the browser gives the exported file.
  - Sharing the store's code between the two kinds changed one message of the dashboard source: when more than six
    months are missing, the warning gives their count and range, not every month. Nothing else it writes changed.
  - The publisher's name in messages comes from config. A dimension that reads a series must name its datasets, and
    the build stops before reading anything if one does not.
  - Reversing it: remove the dataset's entry from `config/pipeline.json`; the command and the store then feed nothing.
- Status: decided by Claude (unreviewed)

## D-095 2026-11-15 — NZTA's vehicle type becomes a dimension, so completeness can be shown by vehicle type and, for cars, set against Stats NZ's count
- Agent: claude (the build by a sub-agent on sonnet, to the lead's plan; this record by the lead)
- Basis: the work order §5.B ("completeness ... by vehicle type and import status") and §5.C ("completeness for cars
  from July 1975"); D-087, D-090, D-092, D-094; the code and tests on `claude/vehicle-type-dimension`; the whole suite,
  421 passed locally before `main` was merged in and 434 on the tip (the reviewer's run); a real dry-run build of the saved October pull with both stores, exit 0 in 12 min 48 s,
  publishing nothing.
- Context: completeness was shown in total and by new or used only (D-093). The cube had no breakdown by NZTA's own
  vehicle type: `segment` is the site's finer split (cars, utes, vans, trucks) and needs gross vehicle mass, which
  the dashboard's export does not carry, so true registrations could not be split by any kind of vehicle at all.
  The data map proposes `VEHICLE_TYPE` as public (D-090); it was already bound, to decide scope.
- Options considered:
  1. **Where the dimension's values come from.** (a) The register's own capitals. (b) A lookup on
     `vehicle_scope.csv`, the file that already decides scope, with a new `label` column. Chosen (b): one file
     says both whether a type counts and what it is called, so the two cannot drift, and a type brought into scope
     later needs no new label. A test holds the dimension to the scope lookup's file, key and field.
  2. **Its name.** `segment` is already labelled "Vehicle type". Chosen: "Registered as", for maintainers and
     visitors alike, with a note that it is not the car, ute, van and truck split (a ute can be registered as a
     passenger vehicle). `segment` is not renamed. A first choice of "NZTA's type of vehicle" for visitors was
     dropped at review: Build would have listed it beside "Vehicle type".
  3. **The fact tables.** On `registrations_flow` it is added: it is the only way to ask true registrations by kind
     of vehicle together with brand or powertrain. On `registrations_surviving` it was to be added only if it grew
     the table by under 5% in rows: it grew it by none (the type is settled by columns already there), and by 2.4%
     in bytes, so it is added.
  4. **Survivors by vehicle type and new or used.** A pair slice, `import_status__vehicle_type`, in the order the
     existing pairs use. True registrations need no pair: their fact table carries both columns.
- Decision: as chosen above. Labels, for the two types in scope: "Passenger cars and vans" and "Goods vans, trucks
  and utes"; every other type has a label too, for the day it is brought into scope.
- Golden contract changes, each its own commit with its reason: (1) the dimension: a new slice and a new fact column
  for the survivors dataset, and its manifest lines; (2) the pair: one new file and one manifest line. No other file
  of the golden build changes. The true-registrations dataset is not in the golden build (it has no store there).
- Measured on the real run:
  - Survivors: 3,617,895 passenger cars and vans and 902,409 goods vehicles (4,520,304 in all). True registrations:
    1,218,768 and 264,635 (1,483,403).
  - The survivors fact table: 641,618 rows before and after; 1,726,119 bytes, then 1,768,391. The true-registrations
    fact table: 129,103 rows, then 131,260; 345,774 bytes, then 358,930. The pair: 3,366 rows, 25,038 bytes.
  - The payload: 3,653,345 bytes, then 3,752,999, against a budget of 8,000,000.
  - Every other staged file of the survivors and long-run datasets is byte-identical to the build of D-094; the
    true-registrations fact files were rewritten because the table gained a column.
  - Completeness by vehicle type and new or used (survivors ÷ true registrations): January 2021, passenger new
    97.8%, passenger used 85.5%, goods new 97.6%, goods used 94.7%; June 2023, 98.7%, 94.7%, 98.7%, 97.6%; October
    2026, 100.07% for new passenger vehicles (the 8 vehicles of D-087) and 100.0% for the other three.
  - NZTA's passenger type against Stats NZ's cars, survivors as a share, new then ex-overseas: March 1976, 3.9% and
    0.3%; March 1990, 5.7% and 2.3%; March 2005, 49.8% and 16.0%; March 2015, 90.5% and 61.6%; August 2026, 99.8% and
    99.6%. For August 2026, true registrations of the passenger type are 99.88% of Stats NZ's cars.
- Consequences:
  - Completeness by vehicle type from January 2021 can be drawn by the site with no further pipeline work.
  - For cars before 2021 the figure is a ratio of two sources that name their classes differently (NZTA's
    "passenger car/van", Stats NZ's "cars and station wagons"), checked against each other for 2026 only (D-065).
    `docs/METRICS.md` says so, and the site must say so beside the chart.
  - The next build on GitHub publishes the new slice, pair and fact column for the survivors dataset in the cube
    release. They hold almost nothing the release does not already show: each value of `segment_group` belongs to
    one of the two types, so the new slice follows from that one, but for 88 goods vehicles whose segment is
    undefined, which this dimension now places. (`segment` itself does not settle the type: utes, vans and "other"
    each hold both.) On that ground it was not put to the user as a new kind of data; it is listed for them in
    the final report.
  - Build offers the new field as a condition on both datasets as soon as a cube carries the column, because
    Build's conditions follow the fact table.
  - Reversing it: remove the dimension from `config/dimensions.json` and the two config lists; two golden changes back.
- Status: decided by Claude (unreviewed)

## D-096 2026-11-16 — The user's answers to the parked questions: where supplied counts live, the About page, the privacy classes and the owner rule
- Agent: user (the answers), claude (the record, and the readings marked as claude's)
- Basis: the user's message of 2026-11-16, answering the ten questions in `docs/CHECKPOINT.md` as it stood on
  2026-11-15; `config/data_map.json`, `docs/DATA_MAP.md` and `pipeline/tests/test_data_map.py` as changed with this
  record; `config/site.json`. A search of `src/` on 2026-11-16 found no cookie, browser storage or analytics code.
- Context: work order 1 parked ten questions rather than stop (D-082). The privacy classes of the data map were a
  proposal (D-090), so the order's §3 kept every owner field unpublished; the About page was a draft with six gaps
  (D-086); both supplied stores sat on the user's computer only (D-092, D-094).
- Decision (user), by the question's number:
  1. **Where the converted counts live:** option (a), a small file of counts in this public repository, with no
     owner field. The same for Stats NZ's series. How it is done is D-097, in its own pull request.
  2. **The About page.** The site's name is parked: the user has no name they like yet. Contact: through
     nickholt.co.nz. Connection to the motor industry, to be added "for the meantime": the user works at the
     Colonial Motor Company as a Systems Analyst. Privacy: no tracking "or anything" right now, to be looked at again closer to
     going live. The web address stays a gap.
  3. **Privacy classes.** (a) The 31 register fields and 10 dashboard columns that say nothing of an owner are
     public. (b) Owner fields: only in tables of one or two fields, with small cells hidden, at a minimum of 10
     vehicles. (c) The `region` slice already published stays. (d) Postcode totals: not now.
  4. **Vehicles may be matched privately between two months' archive files**, to settle whether usage and industry
     class are as first registered or as now.
  5. **The monthly dashboard export also takes the mass and engine-size groupings**, and the history is taken again.
     The retaken history will arrive in the user's Downloads folder; that part waits until it does.
  6. **The query service** is decided after package D's trim is measured.
  7. **True registrations move first on the home page**, when the home page is rebuilt (package H).
  8. **The Stats NZ hand export and going public:** later.
  9. **The repository's "About" line on GitHub:** as proposed: "Plain answers about New Zealand's vehicle market,
     from NZTA and Stats NZ open data. Work in progress; not public yet." Set on 2026-11-16.
  10. **The code's licence:** not answered. The message left the three options standing, so the question stays open.
- How each was recorded, and claude's readings (unreviewed):
  1. **The classes are marked approved** (`approval` in `config/data_map.json` names this record). The class ids
     change with it: `proposed_public` becomes `public`, `not_published_before_review` becomes `owner_restricted`,
     and the flag `pending_review` becomes `restricted`. Options: keep the old ids (no churn, but an approved class
     would still be called proposed); rename (chosen: a name that is false is worse than a one-off rename, and only
     the map's own test read them).
  2. **The owner rule is data**: `owner_rule` in `config/data_map.json` holds the outputs it allows (a slice or a
     pair, never the fact table), the minimum count of 10, and `enforced: false`.
  3. **Approval alone publishes nothing** (claude's reading). The pipeline does not hide small cells today, so
     until it does (package F) every owner field stays out of every published file, and a test holds that while
     `enforced` is false. The other reading, that the answer lets owner fields be published at once, was not taken:
     the rule the user chose cannot be kept by a pipeline that cannot hide a cell. Whether the user wants to see
     the first owner-field table before it is published is asked in the final report.
  4. **The `region` slice stays exactly as it is**, with no minimum count (claude's reading of "it stays"). Whether
     it takes the minimum of 10 once the pipeline can hide cells is a question for the user then; applying it would
     change a published slice.
  5. **A table of one or two fields is read as a slice or a pair** (claude's reading): a slice is one field by
     month, a pair is two. The month is not counted as a field. The fact table and the committed snapshot aggregate
     cross many fields, so no owner field joins either: the map's test refuses an owner field in any output the
     rule does not name, whatever the field's class or exceptions say (the reviewer of #60 showed that the first
     version of the test did not).
  5a. **"Not now" for postcode totals is data too**: `owner_rule.not_published` names `POSTCODE`, and the test
     refuses it in every output. It leaves the list only on the user's word, in a new record.
  6. **Nothing derived from `VIN11` is covered** by the answers, so D-076 stands: only after a check against the
     data and the user's approval.
  7. **The About page's privacy sentence states what is true today**, not a promise: "Today it carries no
     advertising, sets no cookies and does not track its visitors." The user's words were about now, with the
     question to be looked at again before going live; the go-public playbook says so. Three gaps are left (the
     site's name, its address, and who runs it, which the message did not answer), so the page still says it is a
     draft.
  8. **The match between archive files waits for a second month**: the archive holds October only. It is done when
     November's file is stored (December).
  9. **The export's new groupings wait for the retaken file.** `python -m pipeline supply` refuses a file whose
     header is not the configured one, so the playbook and `config/pipeline.json` change together, when the file
     shows what the columns are called.
- Consequences:
  - Nothing new is published by this record. What a build writes is unchanged; the golden contract is unchanged.
  - CLAUDE.md's non-goals still say postcode figures "wait for the Stage 2 privacy review". The user's answer is
     "not now", which that wording still covers; CLAUDE.md is not edited (the order's §3).
  - Package F binds the owner fields privately, builds the hiding of small cells, and only then sets `enforced`.
  - Reversing the renames: three ids in `config/data_map.json` and one line in its test.
- Status: accepted (the user's answers); the readings above are decided by Claude (unreviewed)

## D-097 2026-11-16 — The two supplied stores are committed to the repository, so GitHub's builds make `registrations_flow` and `registrations_cars_long_run`
- Agent: claude (the build by a sub-agent, to the lead's brief; the home of the data is the owner's decision, the design inside it is Claude's)
- Basis: the owner's answer of 2026-11-16 to CHECKPOINT question 1, option (a): the converted counts of the two
  hand-supplied sources may live in this public repository, as a small file of counts with no owner field, and the same
  answer covers Stats NZ's series; D-092 (option 3, the store's home, and option 4, a build with no store), D-094, D-065;
  an independent review of the first version of this work, whose points on the model field, the replacement excuse and
  the playbooks are taken below; the owner's decision on the trade's basis (D-105, D-106) for the vehicle types whose
  model is kept; the code and tests on `claude/supplied-counts`; the whole suite, 511 passed in 17 min 27 s at the branch tip; a dry-run build of the saved
  October pull from a clean checkout of the branch (nothing but what is committed), 2026-11-16 and 17.
- Context: until now both stores sat only in the gitignored `data/supplied/` on the owner's computer, so GitHub's
  builds marked both datasets `not_built`, and D-092 and AGENTS.md said a state file built with them must never be
  committed, because GitHub's builds had no store and would abort. The owner has now allowed the files in the
  repository. A file merged into `main` can never be taken out of its history, so the committed files hold no more
  than a build needs.
- Options considered:
  1. **Where the files live.** (a) Where the config already says, `data/supplied/<id>/`, by lifting the ignore. (b) A
     new folder, with config and code moved. (c) A release asset or the private archive, fetched by the build.
     Chosen (a): nothing moves, `supply` already writes there, and a local build and a GitHub build read the very same
     paths. (b) is a rename that buys nothing; (c) adds a download and a secret to a build whose point is to need
     neither.
  2. **Format.** (a) The Parquet file and JSON ledger the stores already are. (b) CSV. Chosen (a): the first version of
     the dashboard store (426,732 rows) was 38,801,866 bytes as CSV (3,125,391 gzipped) against 1,929,698 as Parquet,
     and DuckDB reads Parquet as the build does. Readable diffs come from the ledger, which is text with one block per
     month: a month added is a few new lines. The Parquet file is sorted by month, so a month added extends it at the
     end; measured on the first version: two versions of the store (with and without October 2026) packed by git
     together took 1.94 MiB, about one version, so a month adds little history.
  3. **One store or two.** (a) The committed file is the store, and `supply` is what writes it. (b) A fuller private
     store beside it, tied to the committed one by a check. Chosen (a): no fuller store exists. `supply` sums the three
     owner columns away before it writes anything, and nothing in the pipeline reads them afterwards (they are used to
     check the header and the uniqueness of the export's rows, then dropped), so nothing built privately from them is
     lost. The full export stays in gitignored `data/raw/` on the owner's computer. If a private store of the owner
     columns is ever built (the Stage 2 review), it should record the committed store's `store_sha256` and monthly
     totals and be checked against the ledger, which already holds both.
  4. **What a store lagging the register does.** Read from the code (`supplied.check_clock`, `build.build_supplied`)
     and proved by tests for a lag of one and of two months: a store whose last month is before the register's
     snapshot month adds a warning that names the missing months, and everything else is built and published (the
     survivors dataset's files byte-identical to a build with no store). Nothing else in the build looks at the lag.
     Not changed. A store AHEAD of the register aborts, by D-092 option 5; also not changed, because the register is
     the clock and that is D-092's decision. When it can be reached, read from `fetch.plan`: the Monthly build builds
     only when the register's change key differs and its snapshot month has moved on, and builds each month once. So a
     store month committed before the register's refresh is waiting when the build runs and is published with it, and
     the stop can be reached only by a forced run, a first run with no state, or a register refresh older than the store.
  5. **The first GitHub build with the stores.** `last_good.json` holds neither dataset (and has no `supplied_totals`
     key at all: it was written before D-092). Every guard reads those through `.get` with an empty default, so a
     dataset appearing for the first time is accepted and then sits in the state; the next build guards it (a month
     total that moved, a store that vanished). Proved by a test, not changed.
  6. **Keeping owner fields out.** (a) Rely on `supply` dropping them. (b) Also test the committed files. Chosen (b): a
     test reads the held columns from `config/data_map.json` (the dashboard fields whose privacy class is not a
     published one, or whose group is an owner group), adds the register field each mirrors, its logical name and what
     it rolls up to, and fails if any appears as a column, as a key or text of the ledger, or in the bytes of either
     file. A second test fails if the data map holds back a column that `private_columns` does not drop. The list is
     data, not code.
  7. **Terms.** (a) Docs only. (b) Also in the file. Chosen (b): `supply` writes a `source` block (publisher, licence,
     attribution, origin, from `config/pipeline.json`) at the head of each ledger, so the licence travels with the
     file. The dashboard's attribution statement is new wording written here, not NZTA's; Stats NZ's is the one D-094
     already carried.
  8. **Replacing a whole store.** (a) Let `supply` rewrite a store whose columns changed. (b) Refuse, say so, and
     document removing both files and supplying the whole new history in one commit. Chosen (b): it is the existing
     "no month is replaced silently" rule applied to a change of grain, and a refused file writes nothing. Tests prove
     that a refused file changes no byte and that a rebuilt store is held to the month-total guard of the last good
     build. Gap: a rebuilt store has an empty `replaced` list, so a month the new export restates by more than 2%
     cannot be excused. When a store is damaged, restoring the two files from git comes before supplying again, which
     starts a new ledger and drops the `replaced` history.
  9. **What the dashboard store keeps of the model.** The first version held every model of every vehicle type: 58,164
     values, 40,692 of them on one vehicle, and 150,993 of 426,732 rows were trailers or caravans (the two trailer types), whose model is
     free text typed at registration and sometimes reads like a name. (a) Keep it all. (b) Drop the rows the dataset
     never counts. (c) Keep the rows and store the model as not recorded where the dataset does not read it, summing
     the rows that become identical. Chosen (c): every vehicle type's counts by month, status, body, power, make,
     country and year stay askable later, and nothing the build publishes changes (it reads the model of in-scope
     re-registered vehicles, now blank, only on rows it then leaves out). The rule is data: the dataset it follows
     (`registrations_flow`), the field (`model`) and a column of `vehicle_scope.csv` that widens the vehicle types
     (`trade_scope`, the types the trade's total of new vehicles counts: the two in scope and buses, motor caravans and
     special purpose vehicles, D-105 and D-106). A model is kept where the vehicle type is in the default scope or
     `trade_scope` and the import status is one the dataset counts; every other row's model is not recorded. The store
     writes NULL for it, as it does for any empty cell: the build reads NULL as undefined and the cube shows it as
     `__UNDEFINED__` (`docs/CUBE_SCHEMA.md`). Not chosen: writing the cube's token as text, which the build would read
     as a model name. The scope the store was written under (the pairs counted, every value the scope files knew and the
     widening column) is in the ledger; the build and `supply` refuse a store written under another, and say to supply the
     whole history again from the raw exports (the playbook). The scope flags are written once, in `normalise.scope_flags`,
     and a test holds them to the flags the build sets in SQL.
  10. **A restated month the last good build has not seen.** The month-change guard excused a replacement only if its
     export's `taken` date was on or after the last good build's day. The owner can export on the 2nd, the build can
     land on the 3rd with the store a month behind, and the owner can commit the restated month on the 4th: the next
     build then compared with the state of the 3rd, did not excuse the replacement and aborted the unattended run.
     (a) Excuse by date only. (b) Also excuse a recorded replacement or revision that describes the file the ledger now
     cites for that month when the state records a different file for it. Chosen (b): the state now keeps the SHA-256
     of the file each supplied month came from (`supplied_files`), so "the last build has not seen this file" is a fact
     and not a date. An unrecorded replacement, or one that describes another file, still excuses nothing. A state with
     no `supplied_files` (one written before this) treats every recorded replacement of the current file as unseen.
- Decision: as chosen above. New: the `source` and `outside_scope` blocks in each ledger; `supply` refuses a store whose
  columns or scope are not the configured ones, with a plain message; `.gitignore` no longer ignores the stores and
  ignores their `.new` names; the `trade_scope` column of `vehicle_scope.csv` (its own commit); `supplied_files` in the
  state; `pipeline/tests/test_stores_in_repo.py`. Commits: the reference column, this record with the code, config and
  tests, then each store with the docs that describe it.
- Golden contract: no change. The golden tests build with an empty store, and the manifest does not read the new ledger
  blocks. The state file gains `supplied_files`, which the golden files do not hold.
- What a reader of the public repository now learns that the cube does not show: the dashboard store is a full cross
  of the public vehicle fields (import status, vehicle type, body type, motive power, make, country of origin, vehicle
  year, vehicle status) by month with a count, for every vehicle type, including vehicles since deregistered (the dataset
  counts first registrations; the cube's fact table publishes one column at a time). Model names are in it only for
  the types in scope or in the trade's scope; no owner, district or usage field is in it in any form. Of its 306,771 rows
  180,859 (59.0%) count a single vehicle, so a rare nameplate of a given year, country and month is visible as one vehicle.
  The register's own open data is finer still.
- Measured:
  - Committed: dashboard store 843,345 bytes (306,771 rows, 70 months, 1,883,786 vehicles) and ledger 20,199 bytes;
    Stats NZ store 36,897 bytes (16,432 figures, 789 months, 26 series) and ledger 168,500 bytes; 1,068,941 bytes in
    all. The first version of the dashboard store was 1,929,698 bytes in 426,732 rows, with 58,164 distinct models and
    291,975 rows (68.4%) on a single vehicle; now 2,758 distinct models remain and 180,859 rows (59.0%) count a single
    vehicle. The vehicles are the same: 1,883,786, and each vehicle type's total by month equals the export's (a test).
    97,112 rows (377,319 vehicles) carry no model. The Stats NZ Parquet file has the same SHA-256 as the store it
    replaces; its ledger differs only by the new `source` block.
  - A dry-run build of the saved October pull from a clean checkout of the branch: exit 0 in 636 s (10 min 36 s, with the test suite running
    beside it); 59 staged files, 58 byte-identical to the `public/data` of the build before this branch (the same
    pull, made from the untrimmed store), and the manifest differing only in `generated_at`, so the trim changed no
    built figure; the staged archive is byte-identical to `data/snapshots/2026-10.parquet`. Peak working set of the
    build process 3.03 GB, sampled every 5 s on the owner's computer; GitHub's peak is not measured (the Monthly build's
    summary reports it).
- Consequences:
  - The next daily run that finds the register changed builds both datasets on GitHub, publishes them in the cube
    release and the next deploy, and writes them into `last_good.json`. A run that finds the source unchanged builds
    nothing, so until NZTA's next refresh (or a forced run, asked for each time) the published cube does not change.
  - A month the owner commits after the register's build for the month has landed is not published until the next
    month's build: one month late. The playbook says to supply and commit a month as soon as the dashboard has it,
    ideally before NZTA's register refresh.
  - Each month the owner supplies a file, runs the tests and commits the two store files together; the Checks
    workflow fails a pull request that changes one without the other.
  - If the vehicle scope changes in any way (not only when it widens: a narrowing, or a row added for a value NZTA
    has not used before, counts too; the reviewer of #66 found the first wording too narrow), the build
    stops with the instruction to supply the history again; the raw exports in `data/raw/` must be kept for that.
  - The Monthly build's time and memory grow by what the two datasets cost (a dry run took 11 min 3 s without them on
    2026-11-13 and 12 min 21 s to 13 min 15 s with them). The workflow allows 45 minutes.
  - Reversing it: `git rm` the two folders and restore the ignore line; builds then say `not_built` again, but a
    `last_good.json` that already holds the datasets would abort them, as D-092 says. The history of `main` keeps
    the committed files.
- Status: decided by Claude (unreviewed), inside the owner's decision of 2026-11-16

## D-098 2026-11-16 — The long-run cars and completeness by vehicle type are on the site: a group of three charts, one more completeness chart, and a missing dataset said in words
- Agent: claude (the build by a sub-agent, to the lead's brief; this record by that sub-agent for the lead to check)
- Basis: the work order §5.C and §5.B's leftover; D-065, D-087, D-093, D-094, D-095; `docs/METRICS.md`; `docs/CUBE_SCHEMA.md` (Supplied sources, `exceeds_total`); the code and tests on `claude/long-run-charts`; a local build on the cube of D-095 (all three datasets), checked headless at 320, 390 and 1280 px, axe (WCAG 2.1 A and AA) on `/`, `/method/`, `/status/` and `/build/`, and a build with the long-run dataset's manifest entry removed.
- Context: the site drew neither of Stats NZ's two series (the monthly count of cars from 1961, and its split into new and ex-overseas from July 1975) nor completeness by NZTA's vehicle type. A cube built before the dataset existed (GitHub's, until December) has no manifest entry for it, which the page treated as "not in the cube": it drew nothing, with no word.
- Options considered:
  1. **Where the long-run charts sit.** (a) Beside the true-registrations group. (b) A group of their own, after it, deferred like it. Chosen (b): the datasets differ, so a build with one and not the other says so for each; nothing moves on the home page (the owner wants true registrations first only when it is rebuilt). The completeness-by-type chart sits in the true-registrations group.
  2. **Three long-run charts or one with options.** Chosen three presets: the total with a month's answer; the split into new and ex-overseas; cars still registered against the count. One question each. The group is called "The long run"; no question carries a year (the file's own evergreen test).
  3. **The split's shape.** (a) A mix (shares), whose "Not recorded" line would sit at 100% before the split. (b) A trend with one count line per value, the months before the split left blank. Chosen (b): the counts show the used-import years, and a gap says "not recorded" more plainly than a share. A count by a low-cardinality dimension with no chosen values now draws one line per value (the same trend renderer; no seventh shape). The blank months get a grey band, the sentence `defaults.phrases.not_recorded`, a row reading "Not recorded" in the table of figures, and the same sentence in the chart's text label.
  4. **`exceeds_total`.** The site reads each dimension's list from the manifest, never by summing, and says each month under the chart with the parts as published and the total unadjusted. It is empty for new or ex-overseas, so nothing shows today; the engine bands (July 1975) have no chart. The sentence is drawn on the count-by-value chart only, since that is where parts are read against a total.
  5. **Cars still registered against Stats NZ's count.** Its own derived measure (`cars_still_registered` in `config/measures.json`), not a variant of `completeness`, and no word of its text says completeness (a test holds it, D-095). The numerator is the register's survivors of the passenger type, new or used, got by narrowing through the pair slice; the denominator is the long-run count by new or ex-overseas, whose two values carry the same names. Its total line is the passenger-type survivors over all of Stats NZ's cars. A line is drawn over every month of its window and breaks at a month a guard or the not-recorded rule leaves out, never joining the months either side; a month standing alone between gaps is drawn as a dot (radius 2.5, the line's colour). It is drawn from July 1975: a month in which the denominator's source records nothing of the breakdown is not drawn on any ratio chart, and the chart says where the breakdown begins (`phrases.breakdown_starts`). Not chosen: drawing the total back to 1961, which the doc does not claim. The caveat is one line with a link to a new `/method` section, from a `caveat` object on the measure; the notes under the chart keep only the guards, and `show_dataset_definitions: false` stops them repeating the two datasets' definitions. "Recorded from ... on" shows only when the window reaches the first month.
  6. **A ratio chart is chosen by what a measure names, not by its id.** Any derived measure with `numerator_dataset` and `denominator_dataset` is drawn by the ratio chart; `completenessSeries` is renamed `ratioSeries`. The measure may give `numerator_dimension` and `numerator_narrowed_to` (through a pair slice).
  7. **Completeness by vehicle type and new or used.** One new chart of five lines (all, and each of the two types crossed with new or used), not a chart by type alone and a second by status. The numerator is the survivors' pair slice, the denominator the true-registrations fact table, each value named "type · status" by one shared function (`src/lib/cross.ts`); a preset's `cross` field names the second dimension. The existing chart by new or used stays. Not chosen: a chart by type alone, which the crossed chart's lines make redundant.
  8. **Stats NZ's statement.** Beside NZTA's basis note on every chart of the dataset, from the manifest's `supplied.attribution` through the dataset's `source_note`; not in the site's footer, which names NZTA only (`config/site.json`). The footer is a choice for the owner.
  9. **A dataset the cube has no entry for.** Treated as not built, in the dataset's own words, wherever config has a `not_built_message` for it (long-run, and true registrations too).
  10. **Two notes of the pipeline half's were shortened.** The `public_note`s of `car_origin` and `car_engine_band` no longer say "from July 1975 only; before that the month is not recorded": the chart now says it from the data (a hand-written year is not a generated sentence). Both keys are site-only. Build's "not offered yet" line about Stats NZ's series was reworded: the Explore page draws it "where this build carries it", since GitHub's builds will not until December.
  11. **After review.** A count line's legend shows a last-12-months figure only when all twelve months are recorded (a partial sum is not shown). A count chart's unit line now reads the dataset's `words` ("Cars registered for the first time each month"), which also changes the unit line on a count drawn for the other datasets, Build's included. A reserved token on either side of a crossed value keeps the whole value reserved.
- Decision: as chosen above. New in config: `defaults.phrases.not_recorded`, `breakdown_starts`, `exceeds_total`; the long-run dataset's `public_label`, `public_definition`, `source_note`, `not_built_message`, `words` and `shows_year_change`; the derived measure; the group `long-run` (deferred) and three presets; the preset `registrations-completeness-by-type`; the `caveat` kind in `config/narrative/rules.json` and `pipeline/tests/test_site_config.py`, which also checks a ratio's numerator dimensions exist. No pipeline code, no golden file and no cube file changes.
- Tests, new: `tests/site/not-recorded.test.ts`, `ratio-charts.test.ts` and `cross.test.ts` (19 tests at first; 43 in the folder after the review); the site-config tests, 135 in all. Not covered by a test, checked in the browser: the drawn grey band and the figures table.
- Measured on the local build:
  - What the browser downloads on first load at 390 px, before and after: `/` 17 requests, 937,071 bytes, then 17 and 939,404 (+2,333: the config and code in the shared chunks, no new request); `/build/` 12 and 519,187, then 12 and 521,369 (+2,182). Both deferred groups add no data file.
  - The long-run total for September 2026 reads 21,257, up 22% on 17,435 a year earlier. The cars-still-registered chart's table reads the files' own cells: 3.9% and 0.3% (March 1976), 5.7% and 2.3% (March 1990), 49.8% and 15.9% (March 2005), 90.5% and 61.6% (March 2015), 99.8% and 99.6% (August 2026). D-095 and an earlier METRICS gave 16.0% for March 2005; that was a rounding slip: 2,107 survivors over Stats NZ's 13,211 cars is 15.949%, so 15.9% is right (D-095 itself is append-only and stays).
  - Completeness by type and status: January 2021 97.6%, 94.7%, 97.8%, 85.5% (goods new, goods used, passenger new, passenger used); June 2023 98.7%, 97.6%, 98.7%, 94.7%; October 2026 100.0%, 100.0%, 100.1%, 100.0%. All equal D-095's.
  - The register's used passenger cars reach 27.8% of Stats NZ's ex-overseas count in April 1986 (77 of 277), against 0.3% in 1976, and the line is high through 1986 and 1987. It does not look like cars surviving, so the chart's caveat and `/method` say it is not a survival rate and can move with how each source classes a car. Drawn as it is: a later start or a higher floor to hide it has no principled basis.
  - axe: no violations on the four pages at 390 and 1280 px, with and without the dataset in the manifest. Nothing scrolls sideways at 320, 390 or 1280 px.
- Consequences:
  - GitHub's builds show the long-run group as one plain message until a cube carries the dataset (December, with the stores question). The by-type completeness chart waits for the same fact table the true-registrations group does.
  - Build does not offer the long-run dataset: it has no fact table, so a question on it could not take chosen values or conditions.
  - `/method` gained two sections, written by hand like the rest of the page (the narrative engine will take them over).
  - Reversing it: remove the `long-run` group, the preset `registrations-completeness-by-type` and the derived measure from config; the code then draws nothing new. The resolver's treatment of a missing entry is independent and can stay.

## D-099 2026-11-16 — First load: the page's own code and processor work trimmed, Explore fetches only its first chart on load, the public build drops the internal pages' scripts; the 3 second target is not met and what is left is mostly the data files
- Agent: claude
- Basis: the work order §5.D; STATE known issues 1 and 7; D-091 (the phone profile and what "first answer" means) and
  `docs/QUERY_SERVICE.md`; measurements made on 2026-11-16 on this computer against the 2026-10 dry-run cube with all three
  datasets, by `scripts/measure-first-load.mjs`; the commits of `claude/first-load`. This file has no separate index, so
  the heading is the record's index line.
- Context: a Build question's first answer took 7.4 to 11.6 s on the phone profile, about 460 KB of each page was its own
  code and fonts, and the public build still shipped the status page's script. The target is a first answer under 3 s.
- Method (D-091's, recorded so the figures compare): headless Chromium (headless shell 1248, `playwright-core` 1.64.1, outside
  the repository); a new visitor each run (empty cache); 390 x 844 px, 150 ms added latency, 1.6 Mbps down, 750 kbps up
  (not recorded in D-091; the value `docs/QUERY_SERVICE.md` set), processor slowed four times. The built site is served by
  the script's own static server, which stands in for Cloudflare Pages as D-091's did: page, script, style and JSON gzipped,
  Parquet and fonts as they are, an ETag and `Cache-Control: public, max-age=0, must-revalidate`. `astro preview` is not
  used for the figures: it sends nothing compressed. A KB is 1,024 bytes; bytes are what Chrome reports crossing the
  network, headers included. "First answer" is the time from the start of navigation until the page has drawn the charts it
  draws on its own: both charts of a Build question and, for Explore, its first chart (the others no longer load at once).
  Five runs each, the median and the range. The Build links are the 3-field and 8-field questions of
  `docs/QUERY_SERVICE.md` (`scripts/first-load-pages.json`). The method reproduced D-091: its 3-field question took
  7.4 s [7.2 to 8.4], here 7.59 s [7.43 to 7.74]; its 8-field question 11.6 s, here 11.12 s.
- Measured, before and after (production build, phone profile, five runs each). The "before" is the build of `main` at the start of
  this work. The "after" is on the merged code (`main` with #60 and #61 taken in), measured on 2026-11-16 after the merge; the
  figures of the branch before the merge are under "At the merge" below:

  | Page | First answer before | after | Bytes before | after | Code / fonts / data before | after | Requests before | after |
  |---|---|---|---|---|---|---|---|---|
  | Explore, first chart (home) | 7.98 s [7.00 to 9.26] | 4.61 s [4.46 to 4.68] | 916 KB | 538 KB | 300 / 165 / 452 KB | 240 / 165 / 133 KB | 17 | 13 |
  | Explore, first chart drawn on a page opened at a chart's link (`/#...`) | 6.94 s [6.80 to 7.11] | 4.70 s [4.48 to 5.21] | 916 KB | 538 KB | 300 / 165 / 452 KB | 240 / 165 / 133 KB | 17 | 13 |
  | Build, 3 fields | 7.59 s [7.43 to 7.74] | 6.58 s [6.29 to 6.84] | 1,035 KB | 975 KB | 304 / 165 / 566 KB | 244 / 165 / 566 KB | 16 | 16 |
  | Build, 8 fields | 11.12 s [10.86 to 11.15] | 10.32 s [10.29 to 10.54] | 1,681 KB | 1,621 KB | 304 / 165 / 1,212 KB | 244 / 165 / 1,212 KB | 21 | 21 |

  - The home page's "before" is one build measured two ways. Ended at its first chart (above): 7.98 s. Ended when all
    seven charts it drew on load were drawn, as the first run did: 18.07 s [16.52 to 19.36], with its first chart at
    9.53 s [7.27 to 10.64]. The spread before is wide because seven charts shared one connection and one processor.
  - The linked-chart row measures the first chart drawn on a page opened at a chart's link, not that chart's own figure: the
    script counted any chart, and on that page the first chart and the linked one load together, so the figure may be the
    page's first chart. The script now takes a `target` (a panel's id) in `scripts/first-load-pages.json` and, when present,
    waits for that panel's own figure; this row was taken before that change and has not been re-measured.
  - "Code" is the page, its styles and its scripts. The fonts are the same two files either side (168,584 bytes).
  - Build's data is the same bytes before and after: the fact-table columns the question names, 379,113 bytes of them
    the count column.
  - The pages look the same: screenshots at 390 and 1280 px before and after (home, a linked chart, both Build
    questions); and the markup of every chart on the home page and the linked page, after all the page's charts were
    scrolled into view and with Plot's random ids removed, is identical for ten charts of eleven. The eleventh (the last
    true-registrations chart) did not load when scrolled to in the old build and does now. Both Build questions' charts
    and text are identical.
- What each change saved. These are medians of three runs on the phone profile made as each change landed, so they are
  indicative, not the five-run figures above; the order is the order they were made in.
  1. **Only the zstd decoder** (`src/lib/data.ts`): every column chunk of the cube is zstd (327 chunks, all files checked),
     hyparquet reads snappy and uncompressed pages itself, and `hyparquet-compressors` shipped brotli, gzip and lz4
     decoders too. 64.4 KB less compressed script on every page that reads data (home 307,237 to 242,815 bytes of code,
     a Build page 311,522 to 247,097; read on a desktop run, where bytes do not vary). The time of this change alone was
     not measured on the phone.
  2. **Explore fetches only its first chart on load** (`src/lib/loadGate.ts`, `PresetPanel`, `index.astro`): a deferred
     panel starts once the first has its rows and it is within one screen of the visible page. Data fetched before the
     first chart is drawn: 462 KB to 171 KB on the home page. Time on its own: none (10.2 s against 9.5 s, within the
     spread): the processor, not the connection, was the limit (next).
  3. **Processor work on a chart's first draw** (six commits: a number formatter made once; month keys parsed without
     splitting, labelled once and converted once per distinct month; month ranges stepped by number; the rolling mix's
     windows summed over cells laid out by month; the mix chart's counts looked up by value then month). A profile of the
     home page's first draw, processor slowed four times, network not throttled, development build, showed
     `toLocaleString` building a formatter on every call as the largest single cost, then month arithmetic, then
     string-keyed lookups. Time to the first chart on that profile: 10.7 s, then 7.8, 5.2 and 4.1 s after the successive
     commits. On the phone profile with the network, home went from 10.2 s to 5.4 s with all six. The strings and shares
     are unchanged (tests; the rolling mix compared with its previous version on 200 random series with gaps, repeated
     rows and reserved values).
  4. **Telling the browser what the island needs** (`astro.config.mjs`, a build step; no dependency): every script an
     island imports listed as `modulepreload` in the page's head, and the manifest preloaded. Hand-patched first: Build
     7.23 to 6.56 s. Implemented: home 5.43 to 4.59 s, Build 7.39 to 6.78 s.
  5. **The public build's scripts** (`astro.config.mjs`, `scripts/check-public-build.mjs`): see below. No time effect.
- Tried and not kept (each measured):
  - **One chunk per renderer shape**, loaded when a view of that shape is resolved: Plot's core (84 KB compressed) is
    needed by every shape and the shape-specific code is small. Code went up by 1 to 6 KB and requests from 17 to 26;
    nothing was saved.
  - **Opening the Explore gate when the first chart's figure is drawn** rather than when its rows are in: 4.59 to 4.64 s.
  - **The serif's file without its optical-size axis** (`source-serif-4/wght.css`, 50.8 KB against 122.4 KB): home 4.59 to
    4.24 s [3.7 to 4.5], Build 6.78 to 6.62 s. It draws every heading in a different cut, heavier and wider, which a
    visitor would see (screenshots made), so it was reverted. It is one import line if the owner wants the saving.
- What the fonts cost: with the font files refused, home 3.94 s against 4.59 and Build 6.04 s against 6.78 (three runs
  each; the page draws in its fallback fonts). About 0.65 to 0.75 s on every first visit. Not changed: delaying the fonts
  until the first chart draws would show the fallback until then, on every visit unless a flag remembers they are cached,
  and the swap would land while the visitor reads. That is a visible choice, so it is the owner's.
- Known issue 7, the status page's script: `INTERNAL_PAGES=false npx astro build` now removes `status/` and `sense-check/`
  itself, and every script in `_astro` that no remaining page reaches (a page names it, or a reached script imports it,
  statically or dynamically). `node scripts/check-public-build.mjs` checks the output: exit 0 and "6 scripts" on this
  build; on the public build as it was before this work it exits 1 naming `_astro/PresetTriage.Dd44jqz5.js`; on a build
  with the internal pages it names both folders. The deploy's `rm -rf dist/status dist/sense-check` is now a no-op and
  stays. The deploy runs the check (see "At the merge" below); the first version of this work did not. In a preview of the public build
  `/status/`, `/sense-check/`, an unknown address and the removed script return 404; the internal build's `/status` still
  draws (axe clean at 390 and 1280 px).
- Where the time goes now (after, phone profile, medians):
  - **Explore's first chart, 4.61 s** (the split below was measured before the merge, at 4.15 s). The last byte of the page's scripts and styles is at 2.28 s and of the fonts at
    2.45 s (402 KB through a 200 KB/s link is 2.0 s); the island then starts, asks for one 67 KB file and draws, which is
    the 1.7 s to the answer. Fonts refused, 3.94 s. Data is 94 KB of 496 KB before the merge, 133 KB of 538 KB after.
  - **Build, 3 fields, 6.58 s** (split measured before the merge, at 6.75 s). Code and fonts are done at 2.3 to 2.5 s; the last data byte is at 5.65 s; the sums and
    the draw take the 1.1 s after it. **Data is 566 KB of 975 KB (58%); with 8 fields, 1,212 KB of 1,621 KB (75%).** At
    this link's 200 KB/s the data alone is 2.8 s for the 3-field question and 6.1 s for the 8-field one, before any code
    or font. So no change to the page's own code can bring a Build question under 3 s here: with no script and no font at
    all, the 3-field question's data would still take most of the 3 s.
- **The target of 3 s is not met** on any page measured: Explore's first chart 4.61 s, the first chart on a page opened at a chart's link 4.70 s, Build 6.58 s
  and 10.32 s. Explore is within reach by trimming bytes (fonts about 0.7 s; the serif file 0.2 to 0.35 s; the React
  runtime, 66 KB compressed of the 240 KB of code, would need a dependency decision; not measured). Build needs less
  data: a hosted service answers in 41 to 62 KB where the static columns take 566 to 1,212 KB (D-091), or the files get
  lighter (a pipeline change, not made here: no file or format was touched). For the owner's parked question, arithmetic
  and not a measurement: D-091's service-side figure for the 3-field question (4.2 s, with about 62 KB, or 0.3 s, more
  code and fonts than now) would be about 3.9 s today, so a service alone would not reach 3 s either, without the fonts or
  a smaller runtime as well.
- Decisions a reviewer could want reversed (each is one commit or a few lines):
  1. The figures come from the script's own gzip server, not `astro preview` and not Cloudflare. Cloudflare Pages is
     assumed to compress text (gzip or brotli) and to apply `_headers`; neither is verified (nothing is deployed). A
     brotli figure was not measured.
  2. The Explore page is judged on its first chart, not on all the charts it draws, because it no longer draws them all
     at once. Every chart but the page's first is now deferred, so a group's own `defer` in `config/presets.json` is
     redundant and left (its comment in `config.ts` says so). A deferred chart says it loads as you scroll, then that it is
     loading; before, a chart waiting for its rows said nothing.
  3. The gate opens when the first chart has its rows; a deferred panel then starts when it is within one viewport height
     (`rootMargin` 100%) of the visible page. A first chart that fails, or has nothing to draw, opens it at once.
  4. Only the zstd decoder is taken from `hyparquet-compressors`. A cube written in a codec other than zstd, snappy or
     uncompressed fails with hyparquet's "unsupported compression codec", and the chart says that its data is in a form the page cannot read and that
     reloading will not help (changed at review, below; at first it said only that its data did not load). The
     pipeline writes zstd (`docs/CUBE_SCHEMA.md`).
  5. `astro.config.mjs` now holds two build steps, `preloadIslands` and `prunePublicBuild`, and names `/data/manifest.json`
     and the two internal folders. They read the built output and add no dependency.
  6. `public/_headers` lets a browser keep `/_astro/*` (content-hashed names) for a year. It affects repeat visits only,
     has not been seen working, and is in no figure above.
  7. Edits in code another branch may be changing: `PresetPanel.tsx` (the gate and a loading line, about 20 lines),
     `MixChart.tsx` (the counts' lookup, about 10 lines), `composition.ts` (one function), `sentences.ts`, `measures.ts`,
     `data.ts`, `readout.ts`, `index.astro`. They change no output.
  8. `scripts/` gains `measure-first-load.mjs` (its browser library stays outside `package.json`), `first-load-pages.json`
     and `check-public-build.mjs`; `AGENTS.md` and `docs/playbooks/run-checks.md` say how to run them.
- Not done or not verified: no run on Cloudflare; no brotli figure; the first draw's processor cost was profiled in a
  development build, so its split is indicative; no repeat-visit figures (D-091 had some; `_headers` would change them);
  320 px was not screenshotted (390 and 1280 were, with axe, and no page scrolls sideways at either); on a phone the Build
  page's chart sits below the question picker, so its first answer is drawn below the fold.
- Found on the way (axe; identical before and after the speed work): on the Build page `label-content-name-mismatch`
  (serious) on the "Remove this condition" buttons, whose accessible name, "Remove the condition on ...", does not contain
  their visible words (2 nodes with the 3-field question, 7 with the 8-field); and `heading-order` (moderate), STATE known
  issue 6. Explore (the home page and a linked chart) and the internal status page have no violations.
- Consequences: STATE known issues 1 and 7 and the first-load line of CHECKPOINT package D change (the lead updates them);
  the brief's "Fast" row cites 6.1 s, now 4.61 s (Explore) and 6.58 s (Build). The monthly build and the cube are
  untouched.
- Reversing it: each commit of `claude/first-load` stands alone; the gate and the loading line are one commit, the preload
  step and the pruning step are two.
- At the merge of main (2026-11-16): the branch took in #60 and #61 (a merge commit). The only conflict was this file: D-096
  and D-098 from main are kept, in number order, before this record; STATE, CHECKPOINT and README are main's, unedited here.
  No code conflicted. #61's new group "The long run" is deferred under the gate like every chart but the first, and was
  checked in a browser at 390 and 1280 px: on load, in those runs, it fetched nothing from the group (the second review saw a far chart fetched on load in
  3 of 7 loads, below), and when scrolled to all three of its
  charts, the ratio chart with its lone-month dots among them, draw. That check found a fault of the gate's own: a panel
  counted as near the screen if it had ever been, and while the page's islands mount every panel is briefly near the
  top, so at 390 px the group's first chart was fetched on load. A panel now counts by its latest position (a commit of its
  own). #61's code added no cost on the first chart's path that was worth an optimisation, so none was made.
  - Re-measured after the merge (above): home first chart 4.61 s against 4.15 s before it. The same-session comparison says
    that is the computer, not the code: the pre-merge build of this branch measured 4.58 s and 4.59 s and the merged one 4.62 s
    and 4.52 s, in alternating runs of four. The merged page carries 2.6 KB more script (245,925 bytes of code against
    243,341), and its data before the first chart is drawn varies from 97 to 137 KB between runs, by whether the second
    chart's 57 KB file lands first; it is not something #61 added.
  - The Build question's accessible-name finding is fixed (`label-content-name-mismatch`: the button's name is now "Remove this
    condition: <field>", containing the words it shows; `tests/site/accessible-names.test.ts` holds it and fails on the old
    wording). Build's axe result is now `heading-order` only (STATE known issue 6).
  - The deploy now runs `node scripts/check-public-build.mjs` in the build job, after the public build and before the site is
    handed to the upload job, so a leaked internal page or an unreached script fails the deploy; the workflow also reruns when
    the check changes (`paths`). `pipeline/tests/test_workflow.py` holds the order. Nothing new is pinned.
  - 320 px: no horizontal scroll on the home page or a Build question (the page is as wide as the screen at every scroll position tried); the one table the check flagged, a chart's key, is 296 px wide there.
- At review (#64, 2026-11-16): an independent comparison of this branch with main found no figure, string, table cell or chart
  geometry changed apart from the button's new name, and asked for the following, each its own commit.
  - **Wording**: the deploy-check sentence and the linked-chart row, corrected above. The script takes a `target` panel id
    (the pages file sets it for the linked chart) for the next measurement.
  - **Waiting and arrival**: only a chart that is being fetched has a live region, named by `aria-labelledby` its question; the
    same element becomes "The chart has loaded." (hidden from the eye) when its rows arrive, so a polite status reads it once.
    A chart not yet asked for says "loads as you scroll" in plain, non-live text, and the internal page has no live regions,
    so a page never speaks for every chart at once. Read in the accessibility tree: two regions on the home page on load in that reading (a far chart is sometimes fetched on load
    too, and then has its own),
    each named by its question, each announcing once. Chosen over putting the answer sentence in a live region (it would
    read a long sentence at each draw, and the Build page redraws on every setting).
  - **Unreadable data**: a file in a codec the reader has no decoder for says so without advice to reload and without naming
    a codec (`src/lib/unreadable.ts`).
  - **Edges of the month functions**: a malformed or missing month has no index (NaN, so a range is empty, as before) and
    `monthAt` gives an empty string, not "NaN-undefined". `monthRange` moved to `sentences.ts`; the rolling mix and `monthKey`
    moved, unchanged, to `rolling.ts` and `monthkey.ts` so tests reach them. Tests are seeded and fast: 3,000 ranges, 2,500
    series against a plain version, 2,000 months. The remainder cache in `MixChart` is inside a hook and has no test of its own.
  - **Codecs**: `config/pipeline.json` `site_reader.codecs` lists what the site's reader can decode (zstd, snappy, uncompressed);
    `pipeline/tests/test_parquet_codecs.py` checks every published file against it, and `tests/site/reader-codecs.test.ts` checks
    `data.ts` agrees. The writers for the archive and the supplied stores are not read by the site and are not checked.
  - **One source for the internal folder names**: `scripts/internal-pages.json`, read by `astro.config.mjs` and the check.
    `deploy.yml` keeps its own link-check pattern, which its test exercises against sample text, so it still names them.
  - After these, the home page (scrolled so every chart loads) and four Build questions render the same text, tables, links,
    labels and chart markup as before them, with the status regions set aside.
- At the second review (#64): a chart far down the page is sometimes fetched on load (3 of 7 loads without
  scrolling: one chart of the long-run group at 390 px, two other charts' files at 1280 px). Before the charts
  draw, every panel is a short placeholder, so the whole page can sit within the near-screen margin when the gate
  opens. Every chart still loads when scrolled to; none was found stuck. Not fixed here: the gate should look at
  a panel's position again after the first chart has drawn. It costs a first visit some bytes, not correctness.
- Status: decided by Claude (unreviewed)

## D-100 2026-11-16 — The chart rules: one table in config says which shapes fit a question, and Build and the resolver read it
- Agent: claude
- Basis: the work order §5.E ("one rule table in config that returns the shapes that fit a question, best first"; "Build's
  shape choice reads the rule table"); CLAUDE.md, Shapes; D-059, D-061, D-050, D-083, D-090; the code on
  `claude/chart-rules`; the site tests, 30 passed; the pipeline tests that read `config/dimensions.json` and
  `config/measures.json`, 239 passed, and `test_golden.py`, 5 passed; headless checks of the Build, Explore and status pages on 2026-11-16.
- Context: the choice of shape was scattered. `inferShape` read a `shape_hint` on each dimension, a `shape` on each
  measure, a preset's `shape_override` and the dimension's cardinality; `viewsFor` hardcoded which alternatives a
  visitor may switch to; `allowsTotal` read the measure's `shape` a third time. A dimension or a measure listing its own
  chart is what CLAUDE.md forbids.
- Options considered:
  1. **The table's form.** (a) First matching rule wins, and returns the whole ordered answer. (b) Every matching rule
     adds its shapes, in rule order. Chosen (a): the order of the rules is the whole logic, a reader gets the answer
     from one row, and a catch-all as the last row cannot add a shape to a question that has a better one. With (b) the
     catch-all would have offered a line chart beside a map.
  2. **Its facts.** Six, all generic: the kind of measure (count, share, average, ratio), the kind of the field the
     question breaks down by (the data map's words) and how many values it has (few, some, many), one window or over
     time, how many values the visitor picked (none, one, several), and the kind of a second field crossed with the first.
     A rule names no field, measure, dataset, reference value or period; a test fails if one does.
  3. **Where a dimension's kind comes from.** (a) Read the data map by field. Not possible alone: a dimension is often a
     lookup or a band over one or more fields (a powertrain is a lookup over motive power, a vehicle age a band over a
     year), the map describes register fields, and several dimensions read none (Stats NZ's series). (b) A `kind` the
     dimension states about itself in `config/dimensions.json`, in the map's words, with a test against the map where
     the dimension is a plain binding of one field (a raw field or a lookup on one: its kind must match; a field the map
     calls few must be `low`; a raw field the map calls many must not be; a band must be cut from a number or a year).
     Chosen (b). A dimension says what it is (a category, an ordered band, a place), never which chart it gets.
  4. **Few or many.** (a) The data map's two classes (at most 8 values, or more). (b) The manifest's actual count of
     values, where the build has it. (c) The dimension's own `cardinality`, already in config, with the table's
     `value_classes` mapping it to few, some or many. Chosen (c). It is the dimension's own recorded judgement of whether
     its list is ranked, not a count and not checked against one: six dimensions marked low have more than the data map's 8
     values (measured at review: 23, 15, 12, 10, 10 and 9), and D-050 ranks manufacturer group (44) and not the country a
     vehicle was built in (46), so (a) would turn that country into a ranking and (b) would need the manifest in the
     browser before any shape can be chosen. `some` is the class for what is
     more than a palette's worth and is not ranked. Nothing is renamed: `composition.ts` reads the same key.
  5. **Measure kinds.** The measure states a `kind` (`count`, `share`, `average` or `ratio`), as the dimension does. A
     change on a year ago, a combined share and the share still registered are ratios; the running total is a count.
  6. **A pin.** `shape_override` stays, and the resolver now reports a preset that pins a shape the table does not
     list for its question as `invalid`, which stops it drawing. Build still pins a count by a breakdown to lines
     (D-061), which fits.
  7. **Whether a count by a breakdown should follow the table too.** It would rank, for one window with no values chosen,
     as the Explore preset for models does, and Build would offer a 12-month ranking of a count by brand for the moments
     before its five starting values arrive. Not chosen: D-060 and D-061 say a count by a breakdown is lines. Reversing
     it is deleting the pin in `presetFor`.
  8. **`shape_hint` and the measure's `shape`.** Removed. The pipeline never reads either: no `.py` file names them, no
     test does, and `pipeline/tests/golden/contract.json` has neither, so the cube's output contract is untouched.
- Decision: as chosen above. `config/chart_rules.json` holds the six shapes, the facts and their words, `value_classes`,
  `needs_breakdown` (the kinds of measure that mean nothing for all vehicles together, which is how Build decides
  whether to offer "no breakdown") and six rules, in order: two fields crossed (a matrix); a share by a place (a map,
  then lines); a share by an ordered band (a distribution, then lines); one window of a long list with nothing picked,
  asked as a count or a share (a ranking); a share by a category (lines of shares); anything else (a line).
  `src/lib/shapes.ts` reads it. `inferShape` takes the first shape that fits and has a renderer; `viewsFor` is the
  shapes that fit and have a renderer, or none when there is one. `RENDERED_SHAPES` stays in `src/lib/resolve.ts`,
  exported, as the one place that knows which shapes have a renderer; the table may name `matrix` and it is never
  offered. A table of the figures is not a rule: every renderer already gives one (a disclosure on the trend and the
  distribution, a key table by the lines and the map, the ranking as a table), and a test reads each renderer's source
  for it.
- Compared before and after (`tests/site/fixtures/shape-defaults.json`, run by `tests/site/shape-defaults.test.ts`
  against the site's real modules): all 13 presets in the canon, 15 views counting the choice of brand or group and of
  brand or model, each at its own period and at all six periods, with the periods that turn it into a ranking (120
  figures); and every question the Build page can form, 123 (each measure, each breakdown it offers, and no breakdown
  for a count, with no values chosen, one and two), each with the shapes it may be switched between (21 offer a switch)
  and what each is drawn as (288 figures). **No difference.** The fixture was written from the code before the change.
- Differences that no visitor can reach, listed because the table is not the old code line for line:
  - A count or an average by a place or an ordered band is a line, not a map or a distribution (the table lists the map
    and the distribution for a share only, because they draw shares only, D-061). No preset and no Build question
    asked it: Build pinned counts to lines.
  - A ranking is for a count or a share, with nothing picked. Before, any measure by a long list over one window ranked,
    and a question with picked values could. Only a ratio (the combined share) was affected, and its preset pins a line.
  - A share with no breakdown is a line, not lines of shares. It is not offered (`needs_breakdown`) and no preset asks it.
  - A preset or a view that pins a shape the table does not list is now `invalid`. None does today: a test walks the
    canon and every Build question and finds each pin in the table at every period the time row can offer (3 years, 5
    years, 10 years, all time, the chart's own period and the periods that rank it). It does not hold at the 12-month and
    1-month periods for a count pinned to lines with nothing picked: there the table gives a ranking, and the pin would be
    reported invalid. The time row never offers those periods to such a count, so it cannot be reached.
- Measured, at 390 and 1280 px against a preview of the 2026-10 dry-run cube, before and after: the Build page for a
  share by a place (map and lines both drawn), a share by an ordered band (bars and lines both drawn), a share by brand
  (and its 12-month ranking), the same for true registrations, a count of two brands, and the share of the five largest,
  and the Explore and status pages: the same radio buttons, the same time options, every chart drawn, no console error,
  no sideways scroll, no axe violation (WCAG 2.1 A and AA), on both builds. JavaScript the Build page loads: 817,868 to
  821,655 bytes (+3,787); all of the site's JavaScript, 820,573 to 824,360 bytes raw (+0.46%) and 302,732 to 304,213
  gzipped (+1,481), because the table ships to the browser. Nothing else a visitor downloads changed.
- Amended after the independent review of #62, which found five things true and the rest to say plainly:
  1. **A live preset crosses two fields** (`registrations-completeness-by-type`: vehicle type crossed with new or used,
     a line for each combination over time), and the facts had always said nothing was crossed. `crossed_with` is now the
     kind of the preset's `cross`; the `crossed` rule fires only for one window, so a crossing over time stays a line
     (a test holds that preset to `trend`, live). Two figures change as a result: that preset at 12 months and at 1 month
     now fits only a grid, has no renderer, and resolves `blocked`, where it had resolved a line. The time row does not
     offer those periods to it.
  2. **What "few" means.** The first text said a few is at most the data map's threshold. That is false for six
     dimensions (option 4). The classes are the dimension's judgement of whether its list is ranked; the comments in
     `config/chart_rules.json` and the playbook say so. No `cardinality` was changed: other code reads `low`.
  3. **Vocabulary.** A share is one part of a whole with a figure for each value of the breakdown; a ratio is one figure set
     against another that is not part of such a whole (a change on a year ago, the share still registered, the combined
     share of the largest few, which is one figure for the group, not a share of each value). A breakdown of kind `free_text`
     or `identifier` currently falls to a line; the data map forbids such a field as a breakdown, and a test holds that no
     dimension Build offers or a preset uses is either.
  4. **Kinds.** A test ties the table's `by` and `crossed_with` words to the data map's kinds, and checks each dimension's
     kind against how it is derived (a brand, a model or a range lookup is a category; a band is an ordered band; a place is
     a lookup). The nine kinds no field-by-field check reaches were read by hand: `make`, `parent_group`, `owner_country`,
     `heritage_country`, `model` and `car_origin` (a category: unordered names, two values for the last), `segment` (a
     category: car, ute, van, truck and the like), `car_engine_band` (ordered: seven engine-size bands) and `segment_group`
     (a category, with some doubt: light passenger, light commercial, heavy commercial and other run from light to heavy in
     part, but passenger against commercial is not an order).
  5. **The fixture** now records the resolver's verdict (live, blocked or invalid) beside each shape, and covers every
     dataset Build offers, not only the default. It was regenerated: 296 existing figures gained only their verdict, 2
     changed (item 1), 142 were unchanged (the ranking periods and the switches), and 288 were added (Build on the other two
     datasets). The verdicts are given by a build in which every dimension is live, so they show the resolver's own
     judgement, not a build's coverage: 16 are blocked, for the two presets that were already (a distribution drawn year
     by year, which nothing draws, and cohort survival, whose dataset is not built) and for item 1's two.
- Items for the owner's ruling, deviations from what CLAUDE.md says:
  - (a) CLAUDE.md says the table reads "how many values it has". It reads the dimension's own `cardinality` judgement
    instead. For the ranking decision that is still a field deciding its chart under another key. It was kept so that
    nothing a visitor sees changes (D-050 ranks one long list and not another of about the same length).
  - (b) CLAUDE.md's Shapes table triggers `geo` on a region and `distribution` on an ordered band whatever the measure.
    The table gives a count by a place, and an average by an ordered band, a line only, because the map and the
    distribution draw shares only (D-061): a renderer limit written as a fit rule. When they learn to draw counts, the rule
    is one row.
- Consequences:
  - A new shape fit, or a new kind of field, is a row in `config/chart_rules.json` and a `kind` on a dimension. A new
    dimension needs its `kind` and `cardinality`, and a test fails without them.
  - `matrix` is offered the day it has a renderer: add it to `RENDERED_SHAPES`. The `crossed` rule fires for a crossing
    looked at in one window; a crossing over time (the preset that crosses vehicle type with new or used) is a line for each
    combination and stays a line. Build has no second breakdown, so its questions never fire it until it does.
  - The tests run the site's real modules under Node through a loader in `tests/site/support/` that adds extensions, JSON
    import attributes and `import.meta.env`, and strips TypeScript with `module.stripTypeScriptTypes`, which Node marks
    experimental (Node 22.19 here). A Node that drops it needs the loader changed, nothing else.
  - Reversing it: restore `shape_hint` and `shape` in the two config files and the old `inferShape` and `viewsFor` from
    git; delete `config/chart_rules.json` and `src/lib/shapes.ts`. The cube, the golden file and the pipeline do not change.
- Status: decided by Claude (unreviewed)

## D-101 2026-11-16 — Pull requests also run the site's tests, its typecheck and the query service prototype's tests
- Agent: claude
- Basis: the work order §5.E's last item (the site's tests in CI); D-048 (the pipeline's checks), D-056, D-057 (the deploy
  workflow's Node setup and cube download), D-091 (the query service prototype), D-100 (the site tests this runs);
  `.github/workflows/checks.yml`; local runs of each step in a clean copy of the branch with no `.astro` and no
  `public/data`, on 2026-11-16. Nothing was run on GitHub: the workflow's syntax was checked with js-yaml and the
  workflow test, `pipeline/tests/test_workflow.py`, passes.
- Context: `checks.yml` ran only `pipeline/tests`. The site's tests (`tests/site/`), the typecheck and the query service
  prototype's tests were run by hand, so a change to the site reached `main` untested on Linux.
- Options considered:
  1. **Where the site's steps run.** (a) A second job in `checks.yml` that needs only Node: chosen. It runs beside the
     pipeline job, so a pull request waits for the longer of the two, not their sum. (b) Steps in the pipeline job: no
     second runner to start, but the job would wait for the pipeline's tests, which run for several minutes, before it
     said anything about the site.
  2. **The order for the typecheck.** The check needs the types Astro writes. (a) `astro build` first: also needs a
     cube, and is the slowest step. (b) A hand-written `env.d.ts` for `import.meta.env`: a file to keep true. (c) `astro
     sync`, which writes `.astro/types.d.ts` and nothing else, with no cube: chosen. Without it the check fails on
     `import.meta.env` in two files (measured: two errors); with it, none.
  3. **TypeScript.** It is not a dependency of the site (AGENTS.md). (a) `npx -y -p typescript` as the docs run it: it
     would fetch whichever version is newest on the day, so a new release could fail a pull request that changed
     nothing. (b) Add it as a dev dependency: a new dependency, so a decision for the user, and a lockfile change. (c)
     The same `npx` pinned to the version this was written against, 7.0.2: chosen. Moving it is one line.
  4. **The query service prototype's tests.** They answer from a built cube and skip all 59 tests without one, which
     would pass a run that tested nothing. (a) Skip them in CI. (b) Build the fixture cube the golden test builds: heavy.
     (c) Download the newest published cube release, as `deploy.yml` does (3,110,970 bytes), and fail if there is none:
     chosen. The step also fails if the release has no fact table (`public/data/facts`), which the tests skip without, and if
     the summary of the run says any test skipped (found on review: a release without `facts/` would have passed with all 59
     skipped). Each failure was run locally: with the fact table, 59 passed; with it moved away, exit 1; with one test marked
     skipped, "58 passed, 1 skipped" and exit 1. Against that cube, with only `pipeline/requirements.txt` installed, all 59 pass. They are a step of the
     pipeline job, not of the new one, because that job already has Python and DuckDB, so the site job needs neither.
  5. **When they run.** On every pull request, as the pipeline's do. Path filters would keep a docs-only pull request
     from running them but would also hide the checks from a branch protection rule that requires them. Not chosen.
  6. **Actions.** `actions/checkout@v7`, `actions/setup-node@v7`, Node 22, npm cached, `npm ci --ignore-scripts`, each as
     `deploy.yml` has them; no new action. The new job has no write permission and keeps no token in the checkout.
- Decision: as chosen above.
- Cost, from local runs of each step in a clean copy (this computer, not a runner; the runner's start, checkout, and
  cache restore are not measured): `npm ci` 11.9 s, `astro sync` 8.9 s, the typecheck 3.3 s, the site's 30 tests 1.0 s:
  about 25 s of work in the new job. The prototype's step adds 1.4 s to download the cube and 19 to 20 s to test:
  about 22 s on the pipeline job. A repository that is public runs on GitHub's standard runners at no charge
  (D-048; inferred, confirm); otherwise a push is about one billed minute for the new job and up to one more on the pipeline job, since each job rounds up to
  whole minutes. A new push cancels the earlier run (`concurrency`).
- Consequences:
  - A change to the site that breaks the typecheck, a site test or the shape defaults (D-100) fails the pull request.
  - The prototype's tests run against the newest cube release, not the cube the branch would build. A change to the
    cube's contract and to the service in one pull request can fail them until the next release carries the change.
  - If branch protection lists required checks, `site-tests` is a new name to add. (Not known from here.)
  - Reversing it: delete the `site-tests` job and the prototype step from `checks.yml`.
- Amended at the second review of #62: the step that runs the prototype's tests pipes their output to `tee`, and a
  workflow step's default shell has no `pipefail`, so a failing test passed the step. The step now names
  `shell: bash` and sets `pipefail`.
- Status: decided by Claude (unreviewed)

## D-104 2026-11-16 — The user's direction: the engine comes first and must be right; the public site waits; figures are checked against outside sources
- Agent: user (the direction), claude (the record, and the reading marked as claude's)
- Basis: two messages from the user on 2026-11-16, during the ninth session. The first asked for a plain status:
  what is built, how ready the public site is, whether the figures match published articles and sites, and whether
  vehicles are segmented as the trade's published classifications do. The second, in the user's words: "keep working
  on the engine, it needs to be flawless, the public can wait. We have one shot to be trusted and used by the
  masses so dont skim out on making it right. Make sure you refernce things online about the nz market if things
  arent looking right or you havent probed a specific metric as the nz market is complex and a tangled behavioural
  change mess".
- Context: claude had offered to swap the work order's packages F (the full engine) and H (the home page, the words,
  the topic pages) to reach a public site sooner. No comparison of the site's figures with figures published
  elsewhere had been made: CLAUDE.md lists matching the MIA's figures as a non-goal ("different basis — say so,
  don't chase it"), and that had been read as a reason not to look.
- Decision (user):
  1. The order of the work order stands: the engine before the public-facing packages. Going public can wait.
  2. Correctness is not traded for speed. The engine is to be right before it is seen.
  3. Where a figure looks wrong, or a measure has not been probed, published sources about the New Zealand market
     are consulted.
- How it is carried out (claude's reading, unreviewed):
  1. **An audit of the engine**: every measure Build can answer is recomputed from the register's rows by a checker
     that has not seen the site's code, and compared with what the site shows. What differs is a bug until shown
     otherwise.
  2. **A comparison with published figures** (the MIA's monthly figures, the Ministry of Transport's, the used
     import trade's, published counts of electric vehicles): ours, theirs, the gap, and whether its cause is
     established, likely or unexplained. This is not chasing a match, which stays a non-goal: a gap is measured and
     explained, never closed by adjusting a figure. What it finds goes to `/differences` and `docs/METRICS.md`.
  3. **Each field bound in package F** is checked against the data and against what is published about how it is
     recorded before Build offers it.
  4. NZTA's own website still blocks automated readers and is not worked around (the order's §3).
- Consequences: package F is next after the pieces in review; H's and I's first pieces, already begun (D-102,
  D-103), are finished as specifications and proposals, and their building follows F. The offer to swap is withdrawn.
- Status: accepted (the user's direction); the reading of how to carry it out is decided by Claude (unreviewed)

## D-105 2026-11-16 — The site's figures set beside published ones: what was measured, and three statements corrected
- Agent: claude (the comparison by a research sub-agent on sonnet; our figures recomputed by the lead; this record
  by the lead)
- Basis: the user's question of 2026-11-16, whether the figures match published articles and sites, and D-104. Our
  figures: the dashboard counts of the export of 14 November 2026, recomputed by the lead with DuckDB on 2026-11-16
  (every figure of ours in `docs/METRICS.md`, "Set beside published figures"). Published figures: the MIA's own
  page, whose four images for October 2026 the lead read; AutoTalk's reports (autotalk.co.nz), read by the
  sub-agent on 2026-11-16 and **not re-read by the lead**: 78 figures with their addresses are in the sub-agent's
  working files, outside the repository.
- Context: nobody had laid the site's figures beside published ones. `docs/DATA_SOURCES.md` §E said the MIA "counts
  vehicles delivered to buyers" and that the numbers "will not match", and `/differences` and `/caveats` repeated
  it, adding that the MIA's figures could not be lined up with the site's.
- What was found:
  1. **October 2026 agrees.** True registrations of new vehicles are 15,109 once buses, motor caravans and special
     purpose vehicles are counted, against the MIA's 15,118 (-0.06%). Passenger: 11,824 against 11,833. Commercial:
     3,285 against 3,285 (2,805 light plus 480 heavy). AutoTalk's tables for the month, made from NZTA's data, equal
     ours in every count the sub-agent compared: the total, the year to date, the top ten brands and models,
     passenger and commercial, and used imports (8,285).
  2. **The default scope is 1.4% to 3.9% under the published totals compared** (the months in `docs/METRICS.md`).
     The MIA's commercial count meets ours once those three vehicle types are added, to the vehicle in October
     2026 and within 1.7% in the other months compared, wider on the whole in older months; `vehicle_scope.csv` leaves them out ("Not explicitly
     decided. Out by default."). No definition of the MIA's was read.
  3. **Older months sit lower**, by 0.4% or less for 2025 and 2026, up to 0.5% for 2024 and about 1% for 2021 and
     2022, against the MIA, AutoTalk and Stats NZ alike. The gap against Stats NZ moves with the share of a
     month's vehicles marked `INACTIVE` (0.95 over 69 months, recomputed by the lead); both grow with a month's
     age. The cause is not established.
  4. **Two figures have a likely account, and one has none.** AutoTalk's 2025 battery electric total is ours with
     the three extra types to 0.3% (203 electric buses); its plug-in hybrid total is ours without 190
     range-extended electric vehicles to 0.3% (found by the reviewer of #65, recomputed by the lead). One
     used-import figure for October 2025 is unexplained.
  5. **The "delivered to buyers" statement has no support** in anything read. It came with the starter kit's
     first commit and was carried by D-030 to `/caveats` and by the record of the three pages to `/differences`;
     this record supersedes those parts. The MIA's page calls its figures "New vehicle registrations", in a
     table whose columns are headed "Sales".
- Options considered:
  1. **What to do with the scope gap.** (a) Bring the three types into scope now. (b) Leave the scope as it is,
     say plainly on `/differences` what it leaves out, and put the choice to the user. Chosen (b): changing
     `vehicle_scope.csv` changes every figure on the site and the golden contract, and whether the site should
     count as the trade does is the user's to say. The engine's next package makes each vehicle type askable, which
     is what a total on the trade's basis needs.
  2. **What the pages say.** (a) Keep "counts differently" with no measurement. (b) State figures on the page. (c)
     State what was measured in words, with no figure, year or month. Chosen (c): `/differences` is hand-written
     until the narrative engine (D-086), and a figure written there goes stale each month. The figures are in
     `docs/METRICS.md`, dated.
  3. **Whether to keep the sub-agent's 78-row table in the repository.** Not kept: the lead did not re-read its
     sources, and one column paraphrases what each source counts. The rows that matter are in `docs/METRICS.md`
     with our side recomputed.
- Decision: `docs/METRICS.md` gains "Set beside published figures". `/differences`, `/caveats` and
  `docs/DATA_SOURCES.md` §E drop the "delivered to buyers" statement and say what was measured. No figure, scope
  or definition changes.
- Consequences:
  - Matching the MIA stays a non-goal (CLAUDE.md): a gap is measured and explained, never closed by adjusting.
  - Open for the user (CHECKPOINT): whether buses, motor caravans and special purpose vehicles join the default
    scope, or a total on the trade's basis is offered beside it.
  - Open for the engine's audit and package F: the three unexplained figures; what the vehicles missing from older
    months are; a split of light from heavy commercial, which needs the export's mass grouping (D-096, item 5).
  - Not compared: the Ministry of Transport's statistics and the MIA's brand and model lists (not readable by an
    automated reader, and for members, in that order).
- Status: decided by Claude (unreviewed)

## D-106 2026-11-16 — The user's answers of the evening of 16 November: a total on the trade's basis, the code's licence, who runs the site
- Agent: user (the answers), claude (the record, the licence chosen on the user's word, and the readings marked)
- Basis: the user's message of 2026-11-16, answering three questions put that evening, in the user's words: "1, b.
  2, do what you reccomend. 3, individual". The questions as put: (1) should the site count new vehicles as the
  trade does: (a) bring buses, motor caravans and special purpose vehicles into the default scope, (b) keep the
  scope and offer a total on the trade's basis beside it, (c) leave it with the page saying why; (2) the licence
  for the code: MIT, Apache 2.0 or none; (3) who runs the site, for the About page: a name, or "an individual".
- Context: D-105 measured the site's true registrations of new vehicles at 1.4% to 3.9% under the published
  totals compared; the MIA's commercial count meets the site's once three vehicle types the default scope leaves
  out are added. The README said no
  licence was chosen (D-096, item 10, left open). The About page had three gaps.
- Decision (user):
  1. **The default scope stays, and a total of new vehicles on the trade's basis is offered beside it.**
  2. **The licence is claude's recommendation.**
  3. **The About page says the site is run by "an individual".**
- What claude chose on the user's word (unreviewed):
  1. **The MIT licence.** Options: none (all rights reserved; nobody may reuse the code, which sits badly with a
     public repository built on open data); Apache 2.0 (permissive, with a patent grant and more conditions on
     notices); MIT (permissive, one short page, the commonest for a project of this kind). Chosen MIT: the simplest
     to read and to comply with, and nothing here has a patent question that Apache's grant would settle. A
     licence already granted cannot be withdrawn for copies taken under it; a later version of the code can carry
     another.
  2. **The copyright line** reads "the nzta-analytics-dashboard authors", not a person's name, in keeping with
     the user's answer that the site is run by an individual. The repository's history already shows who wrote it.
  3. **What the licence covers:** the project's own code and reference files. Not the data: what comes from NZTA
     or Stats NZ, as committed aggregates, outlines or build output, stays under CC BY 4.0 with its attribution.
     The README says so.
  4. **How the trade's basis is expressed** (claude's reading): as data, a column `trade_scope` in
     `data/reference/vehicle_scope.csv` naming the types the trade's total counts: the two in the default scope
     and `BUS`, `MOTOR CARAVAN` and `SPECIAL PURPOSE VEHICLE`. The evidence is D-105: with those three added to new
     goods vehicles, October 2026's commercial count is the MIA's to the vehicle (3,080 + 71 + 129 + 5 = 3,285).
     Building the total is the first piece of package F. The column is added in its own commit on the branch of
     the committed counts (D-097), which needs it to know which vehicle types' model names to keep.
- Consequences: the About page has two gaps left (the site's name and its address). The total on the trade's basis
  never replaces a default figure and is never used to scale one; it is named for what it counts.
- Status: accepted (the user's answers); the choices above are decided by Claude (unreviewed)

## D-107 2026-11-16 — The audit's site-side fixes: a rule for ties, what the guards do, and the wording that did not say what the site does
- Agent: claude
- Basis: the independent audit of the question engine, asked for in D-104 (the owner: it "needs to be flawless" before anything goes public). It recomputed 34,693 of the site's figures from the raw register rows: 34,618 agree exactly, 74 are withheld on both sides, 1 differs. No count is wrong. The one figure that differs is a rank a year before (Build, share of the brands by 12 months, `build.where.powertrain=BEV`, DONGFENG: #44). The rest is a missing rule for ties, and wording and definitions that did not say what the site does. The pipeline-side findings (a nameplate missing from the mild hybrid reference file, the mild split's threshold per dataset, ties at the model cap) are other work on another branch and are not in this record. Code: `src/lib/ranking.ts`, `src/lib/config.ts`, `src/components/{LeagueChart,MixChart,GeoChart,TrendChart,PresetPanel,QuestionBuilder}.tsx`, `src/lib/{derived,notes}.ts`, `src/pages/caveats.astro`; config: `config/{presets,dimensions}.json`, `config/narrative/rules.json`; docs: `docs/METRICS.md`; tests: `tests/site/{ranking,coverage-note,value-words}.test.ts`.
- Context and the decisions, by item:
  1. **Ties.** The league sorted by count only, so tied entries took ranks in the order the data arrived, and their rank a year before and their move followed that accident. Options: (a) **shared ranks**, the usual competition ranking (1, 2, 2, 4), tied entries listed alphabetically; (b) a stable tie-break with distinct ranks (alphabetical position: 1, 2, 3, 4). Chosen (a), the owner's brief: a tie is a fact about the counts, and (b) invents a difference of one place between two entries the data cannot tell apart, which a move then shows as a change. Cost of (a): the next rank skips (4 after 2, 2), and a reader may wonder where #3 went. **One consequence to read before the audit's case is closed:** under (a) DONGFENG's rank a year before is **#41**, not #42. Forty brands stand above the four on 3 vehicles, so all four read #41. #42 is DONGFENG's position by the alphabet (CITROEN 41, DONGFENG 42), which is what (b) would give. The old site showed #44 because DONGFENG arrived fourth of the four. Two other rows in the same table change by the same cause (ZEEKR's earlier rank #32 to #30, FARIZON's #34 to #33).
     - Applies to: the league's current and earlier ranks and every move (`LeagueChart`); the choice of which values a share-over-time chart names when it keeps only its largest (`MixChart`); the order of the map's table (`GeoChart`) and of the five names in the top-5 readout (`derived.ts`).
     - Order within a tie: alphabetical by the name shown, with `Intl.Collator("en")`, and by raw key if two values show one name. The same order, by the name shown, is used wherever the site sorts by size without showing a rank: the share-over-time chart's cut at its largest values, its lines' colours by size and by peak, its key, the order of the labels at the end of its lines, the single-measure trend's colours, the map's table and the top-5 readout's names. Those are orders, not ranks: no rank is shown. (The first version of this branch ordered the line chart and the map by the raw key, which differs from the name shown for reserved values and for models; review of #67 asked for the name, and the panel now hands the charts one label function per dimension that keeps its identity, so ordering by it costs no recompute.) **On a chart capped at its largest values, a tie at the cut can now name a different value than before.**
     - A list cut at a number of places (top 10, 15, 25) is cut after sorting, so a tie across the cut shows the alphabetically first of the tied entries and omits the rest. Not changed: showing the whole tie would make the list longer than the number asked for.
     - **The largest five.** The combined count of the five largest values is the same whichever of several tied values is called fifth, so a tie at fifth place cannot change that figure. It could change which five names the readout lists; they now follow the same order. Not tested against the data: the argument is arithmetic. Colours by size are orders too and have the same tie-break (the first version left them on count only).
  2. **What the guards do** (`docs/METRICS.md`, "What a tripped guard does"). The doc said a share is "suppressed by both guards" and to "suppress rather than round to zero". The site greys a guarded month and still prints its figure. The decision is the first version of the charts (D-014, commit d788e41: "the share guard greys months under 200 vehicles rather than dropping or zeroing them"), the guards D-015, and `/method`'s "Greyed, not zeroed" D-031. METRICS now says, place by place, what the code does. **Where the code and the decision disagree, nothing was changed:** (i) a ranking applies neither guard, so its shares and moves print at any base; (ii) the key under a share chart, and the table of figures under a bar chart or the map, print "suppressed" in place of the figure, where the decision says to grey it. Also written: the representativeness guard cannot fire when any of the 12 months before is missing or fewer than 12 exist, nor when the median is zero (as the code does); a share inside a condition takes the narrowed set as its denominator (the core definition now says so, and the page already says "Only vehicles where ... are counted").
  3. **The coverage note on a narrowed chart.** It quoted the whole dataset's identification coverage as if it were the chart's. Options: (a) say so on a narrowed view; (b) leave the note off a narrowed view. Chosen (a): the figure is true of the dataset and tells a reader how far to trust the mild line wherever it appears; (b) would remove the one caveat a reader of that line needs. No coverage is computed in the browser. The words were hand-written in `PresetPanel.tsx`, with a domain name in a `.tsx` file, so they moved to `config/presets.json` (`defaults.phrases.identification_coverage*`) and the placeholders they use are listed in `config/narrative/rules.json`. A view is narrowed when a filter of its own or a Build condition applies. The internal page's note says "the high-confidence classifications alone", since "only" is a banned word.
  4. **`/caveats`.** Three sentences were stale (the site does count what was first registered, by make and model, for the months NZTA's registrations dashboard covers). Reworded with no figure, year or month; section 1 now says which charts count what. Nothing else on the page was found untrue by the audit's notes. Its own figures (5,926,990 rows, 27 body types, the RAV4, CX-5 and Outlander shares) agree with the audit and are dated or unchanged. They still go stale as the register moves.
  5. **Small wording.** The model-cap note takes the count the dataset ranks by from the dataset's own words (`words.cap_count`); the note template reads `{words.cap_count}`. A model reads as words (`valueWords`, `src/lib/config.ts`: the dimension's separator becomes a space) in the table of figures, the key, hover readouts, the value picker (chips, suggestions, and the search, which now matches the words), the conditions sentence and the top-5 readout. Addresses and data keep the raw key. The dimension's `help` line was reworded to say the same, though the site does not read it.
  6. **`rules.max_filters`.** `config/dimensions.json` said 2. No reader exists in the site, its tests, the pipeline or the docs, and Build applies three or more conditions. Removed rather than set to a number nothing enforces; the comment says there is no limit (D-062, the work order). `chart_type_is_user_selectable` beside it is also read by nothing and was left.
  7. **Definitions written down** in `docs/METRICS.md`, each from what the code does: "the last 12 months" and "the 12 months before" are counted back from each dataset's own newest month; a goods vehicle with a gross mass of zero reads "Not recorded" (confirmed on the current local build: 88 vehicles carry the reserved value for not recorded on the segment dimension, none the one for no reference match; `sentinels.csv` says such a vehicle "matches no segment_map row" and the audit's notes call it unmapped, which describes the reference lookup, not the value the cube carries); a model of a make with no reference match keeps the raw make in its key. The tie at the 300-model cap is not defined here: it is the pipeline piece.
- Checked: the shape defaults fixture is unchanged; 22 views (every Explore chart on the home page and six Build questions) were read headless on a build of `origin/main` and a build of this branch; of 14,766 strings and cells 14,755 are identical once a model is read as words, and the 11 that differ are the tied ranks and their moves in the audit's table (6), two tied rows of the key under the powertrain charts exchanging places (4), and the new sentence under the narrowed powertrain chart (1). Before the fix, a model's raw key in the models' table headings and captions was a further 12.
- Consequences: a reader of a tied ranking sees the same rank twice; the rank after skips. A reviewer who would rather have distinct alphabetical ranks changes `rankByCount` in `src/lib/ranking.ts` (one function) and the METRICS paragraph. Open for the lead: the two places where the code differs from the decision (item 2), whether a ranking should apply the guards, and the axe finding on `/build/` (`label-content-name-mismatch` on the condition's remove button), which `main` has and pull request #64 fixes.
- Review of #67 (the independent review confirmed the tie rule row for row and found no changed count), and what changed in answer. Choices a reviewer could want reversed:
  1. **Whether a ranking has a year-before comparison** is decided by the dataset's own months, not by which months a narrowed slice has rows for. Under a condition a month with no vehicles has no rows, and the old check took it for a month the dataset lacks: the hydrogen ranking (Build, share of the brands, last 12 months, condition on that powertrain) said "There are no figures a year earlier" and still printed DAF's rank a year before, #2, because only the Move column checked the flag. Now: the comparison exists when the earlier window lies wholly inside the months the dataset covers, and then the rank a year before, the move, the change in share and the change on a year ago show together, an absent month counting as zero; otherwise none of the four shows. The dataset's first month is the start of its supplied file, or for the register its count of months back from its newest. The register's earliest months are sparse, so that month is later than its true first (1927-02 against 1912-01 at the 2026-10 snapshot); no window a ranking compares reaches either. The check lives in `rankingText` (`src/lib/sentences.ts`) and the rows in one tested function, `leagueRows` (`src/lib/league.ts`), which the component calls. A change on a year ago is still withheld where the earlier count is under the measure's floor (the hydrogen case: 3).
  2. **Every other place that asks for a figure a year earlier,** examined: the answer sentence and the hover on a monthly count read whole-month rows with one row per month, zeros included (the fact table's rows with no breakdown), so a month with nothing is a zero there and a month before the dataset is absent: no change. The key under a share chart sums its two 12-month windows with absent months as zero, so it is right under a condition; its change would be computed against a partial window only for a dataset under 24 months old, which no build has: not changed. The top-5 readout makes no year comparison. **Found, not changed:** a share over time drawn as a 12-month share, under a condition, leaves a gap wherever a month in its window has no rows (the rolling share needs every month's denominator, and a month with nothing kept has none); inside the dataset's months that month is zero. It is the same mistake in a figure that is not a year-earlier comparison, so it is listed for the lead.
  3. **The identification-coverage templates** name no value: the name comes in as `{value}` from the hybrid block of config, and `pipeline/tests/test_site_config.py` now fails any template that names a value or label from the reference files or a band in `config/dimensions.json` (`ordinary_words` in `config/narrative/rules.json` lists exceptions; none today). The lint covers the templates it already collected, not a dimension's `note_template` or `public_note`.
  4. **The coverage note** appears only where its line is drawn: the value must be among the rows the chart draws.
  5. **A tie across the top-N cut** now has a sentence from a template (`defaults.phrases.tie_beyond_cut`): how many entries beyond the list share the last rank shown. The list still shows the alphabetically first.
  6. **METRICS** says all reserved values take no place in a ranking.
- Second review of #67, and what changed in answer (added; the entries above stand as decided):
  1. **The register's first month.** Item 1 above took the dataset's first month from the manifest's `months`, which is the number of months that have rows (1,197 for the register), not a span: it gave 1927-02 where the register's first month is 1912-01. It never admitted a comparison that is not there, but it blocked real ones, and the sentence above that no compared window reaches that month was wrong: the month picker offers 1926-12, and a ranking of 1926 against 1925 (six of 1925's twelve months have rows, 22 vehicles) said "There are no figures a year earlier". Now a dataset with no supplied start has as its first month the earliest month in which it has rows, read from data the view already loads (`loadFirstMonth` in `src/lib/data.ts`): the fact table's month column for a question that reads it, the pair slice a narrowed view was cut from, otherwise the rows; no field was added to the manifest. A month after the first with no rows is zero. With the query service answering a question the table is not read and the rows' own first month stands, which can be later than the true one where a condition empties the early months: it blocks a comparison that exists and never admits one that does not. The test that encoded the derived month is replaced by one on the earliest month with rows and by the 1926-12 case with its counts (`tests/site/league.test.ts`, `tests/site/fixtures/league-1926.json`).
  2. **What the template lint covers.** `pipeline/tests/test_site_config.py` now has no length floor: every value and label in the reference files (brands, parent groups, countries, powertrains, segments, vehicle types, import statuses, regions, the Stats NZ labels) and every band label is matched as a whole word, ignoring case, with a simple plural; a test shows it catching a short name, a plural and another case. `ordinary_words` in `config/narrative/rules.json` holds the one plain word the templates needed, "Car", for the long-run dataset's own word for what it counts; no other template was flagged. **It covers** the templates the file already collected: a preset's answer, the phrases, the builder notices, each dataset's words, source note and not-built message, and the ratio measures' note, unit note, table label and caveat. **It does not cover** a dimension's `public_note`, `note`, `help` or `note_template`, a preset's own `note`, or model names (which come from the data). Those already name values or use a listed word today, all before this branch: the powertrain dimension's notes (hybrid, mild hybrid), the presets `brand-owner-origin` and `new-vs-used`, many `help` texts, and the model dimension's `note_template`. They are left for the narrative work (D-062) and were not rewritten here.
  3. **The note under a 12-month share chart** said a point is left blank "when any of its 12 months is missing from the data". Under a condition a month in which nothing is kept has no rows and is not missing, it holds no vehicles. The rolling share was not changed (it is its own piece: a window with such a month is still left blank, where the month is zero). The sentence now says what the chart does: blank when any of its months has no vehicles in what is counted, or is missing. Both notes (public and internal) moved from the component into `defaults.phrases` as templates with the number of months as a placeholder. `/caveats` now says the Stats NZ series is split by new and ex-overseas and by engine size for part of its span.
- Third review of #67 (added): with a month of no vehicles now read as zero, an earlier window can lie inside the dataset's
  months and hold no vehicles at all under a condition. The change in share was then taken against a share of 0%, which does
  not exist (0 of 0 vehicles): one brand of hydrogen vehicles in a single month read "+100.0 pp". `leagueRows` now leaves the
  change in share undefined when the earlier window's denominator is zero, so the column shows a dash; the entry still reads
  as new. Where the earlier window has vehicles, an entry absent then had a share of zero and its change is its whole share.
  The lint also does not read `events.csv`, so a template naming an event or a policy would pass; no template does.
- Status: decided by Claude (unreviewed)

## D-108 2026-11-16 — The audit's pipeline findings: hybrid nameplates the dashboard spells differently, the mild split withheld under its threshold, the model cap's tie rule, a narrower scope refusal, and which unmapped rate is which
- Agent: claude (a sub-agent, to the lead's brief)
- Basis: D-104 (the owner's direction that the engine be right and that published sources be consulted), the independent
  audit that recomputed 34,693 of the site's figures from the raw rows (34,618 agree, 74 withheld on both sides, 1 differs
  and is fixed elsewhere) and its notes on the pipeline's side; D-092, D-095, D-097 and D-010; the saved October pull and
  the committed dashboard counts; the code and tests on `claude/audit-pipeline-fixes`; public pages read on 2026-11-16,
  named below.
- Context: the audit found no wrong count. On the pipeline's side it found five things, each fixed or settled here.
- Decision, by item:
  1. **Hybrid nameplates.** Measured on the 2026-10 snapshot, the hybrids that matched no row of
     `mild_hybrid_models.csv` (a code that maps to Hybrid, and no row) were 177 of the register's 91,264 in the last 12
     months (2,803 all time) and 4,832 of true registrations' 91,614 (10,351 all time); the rows marked unresolved hold
     2,894 and 2,905 more. In true registrations 4,650 of the 4,832 were Toyota's Corolla Cross (4,582 new, 68 used): the
     dashboard names it, the register records it as COROLLA, which already has a row (METRICS.md already says the
     dashboard splits it). Seven rows for full hybrids and one for mild were added, in one commit with the file.
     Trailing coverage, stated and at high confidence: register 83.0% and 78.9% to 83.5% and 79.3%; true registrations
     66.0% and 62.7% to 83.5% and 79.2%. All time: register 80.4% and 61.6% to 83.1% and 63.6%; true registrations 72.2%
     and 59.7% to 83.0% and 68.5%. Hybrids reclassified: register 2,393 all time (107 in the last 12 months), true
     registrations 10,035 (4,757). Full hybrids stay under Hybrid, so no powertrain line moves for them. The
     Mercedes-Benz C 200 (37 used imports on each dataset, 13 in the last 12 months, vehicle years 2018 to 2022) moves
     from Hybrid to Mild hybrid: the one published change.
  2. **The mild split.** Read from the code, the 70% figure only raised a build warning (the label rule uses the 95%
     `complete_at_coverage`); nothing withheld a split. Now each dataset is judged on its own trailing coverage at high
     confidence against `publish_split_at_trailing_high_confidence_coverage` (0.70). Under it the dataset counts its mild
     hybrids as Hybrid (`undivided_powertrain`) in every slice, pair and fact table, the manifest says
     `mild_split_published: false` and the build warns once. Both datasets are above it after item 1, so both publish.
  3. **Ties at the model cap.** The code already ranked by count, then by key. The rule is now written (the key that
     sorts first in byte order is named) and tested. Survivors: no tie at the boundary (75, then 72). True
     registrations: two models with 75 vehicles at ranks 300 and 301, and the cube already names the one that sorts
     first. No published file changes.
  4. **The scope refusal.** `scope_problems` now refuses only when a pair the ledger records as blanked is counted now,
     or a field the ledger says was blanked is no longer trimmed (or the ledger or the rule is missing, which cannot be
     judged). Anything else warns. `supply` trims new months to the ledger's recorded scope. This replaces D-097's
     consequence that any change to the scope refuses the store and needs the history again; D-097 itself is unchanged.
  5. **Unmapped rates.** Documented in CUBE_SCHEMA.md: the guard and `unmapped_rates` count every in-scope row in `dims`
     (0.7123% on 4,634,954), the cube and the site count the dataset's vehicles (0.58% of 4,520,304). The guard is
     unchanged.
- Sources read for item 1 (public pages, read 2026-11-16; nothing about this project was sent to any site):
  - Toyota Corolla Cross: Toyota NZ (https://www.toyota.co.nz/showroom/corolla-cross/: 2.0 litre hybrid, 146 kW system);
    CarExpert NZ (https://www.carexpert.co.nz/toyota/corolla-cross/gxl/features-and-specs: an 83 kW transmission-integrated
    motor generator, an e-CVT, a lithium-ion battery, a rear motor on 4x4); Wikipedia
    (https://en.wikipedia.org/wiki/Toyota_Corolla_Cross: Japan's 1.8 litre 2ZR-FXE and the 2.0 litre M20A-FXS hybrids are
    power-split). Full, high. No mild version is listed in any of them; Japanese used imports are the same family.
  - Toyota Prius c and Prius v: https://en.wikipedia.org/wiki/Toyota_Prius_C (power-split full hybrid, the Aqua) and
    https://en.wikipedia.org/wiki/Toyota_Prius_v (Hybrid Synergy Drive, 60 kW traction motor). Full, high.
  - Kia Niro Plus: Motoring NZ (https://motoringnz.com/news/2022/8/4/niro-plus-to-join-kia-choices: 1.6 litre, 32 kW
    motor, six-speed dual-clutch, 104 kW combined) and CarExpert NZ for the Niro
    (https://www.carexpert.co.nz/kia/niro/powertrain-and-performance: HEV charge sustaining, 1.3 kWh battery). Full, high.
  - Hyundai Staria and Staria Load: Hyundai Europe (https://www.hyundai.com/eu/en/models/new-staria-hybrid.html:
    full-parallel hybrid, 54 kW motor), heise (https://heise.de/-11121348), Hyundai NZ
    (https://www.hyundai.co.nz/-refreshed-hyundai-staria-range-introduces-new-hybrid-option-and-flagship-lounge: a 1.6 T-GDi
    hybrid, type not named). Full, medium: the type comes from the European pages.
  - BAIC X55: Driven Car Guide (https://www.drivencarguide.co.nz/news/baic-new-zealands-entry-level-x55-suv-goes-hybrid/:
    1.5 litre engine, 160 kW motor, 1.82 kWh battery, "full hybrid"). Full, medium: one trade-press source.
  - GWM H7: Driven Car Guide (https://www.drivencarguide.co.nz/reviews/gwm-haval-h7-first-drive-apex-predator-hybrid/:
    a dedicated hybrid transmission, a 1.53 kWh battery, the plug-in a separate variant). Full, medium: it does not use
    the words full hybrid.
  - Lexus ES: Autotrader NZ (https://autotrader.co.nz/news/lexus-es-hybrid-and-ev-arrives-this-year-how-much: the ES 300h,
    "latest hybrid drivetrain"). Full, medium: it names no type; every earlier ES hybrid is Lexus Hybrid Drive.
  - Mercedes-Benz C 200: vision-mobility
    (https://vision-mobility.de/en/news/clean-diesels-48-volt-gasoline-engines-this-is-how-the-facelifted-c-class-drives-2290.html:
    a belt-driven starter-generator, "EQ Boost", on the 1.5 litre, up to 10 kW added and 12 kW recovered; it does not call
    it a mild hybrid, and a 2.0 litre C 200 also exists). Mild, medium.
  - Tried and not usable: Toyota Japan's Corolla Cross page (404), Kia's global Niro Plus page (404), CarExpert's and
    WhichCar's EQ Boost pages (403), Kia NZ's Niro Plus brochure (a PDF the reader could not extract).
- Options considered:
  - *Item 1, where the fix goes.* (a) Rows in `mild_hybrid_models.csv` for the dashboard's spellings. (b) An alias in
    `model_registry.csv` that renames COROLLA CROSS to COROLLA in the dashboard. Chosen (a): the registry makes one
    nameplate one name, and here the register cannot be split (it records the Cross as COROLLA), so (b) would merge two
    models in the dashboard's published model figures and change them; (a) changes none. The hybrid file is keyed on the
    dataset's own spelling already (D-010).
  - *Which nameplates to add.* Every one with 10 or more hybrids in the last 12 months on either dataset, or 100 or more
    over all months, whose type a public source settled: ten nameplates in eight rows. Not added: Mercedes-Benz E-Class
    (6 new in the window, a mix of mild and plug-in, which a source could not separate), CLS, AMG, Audi A3 and A8, BMW 120,
    Volvo V60 and the rest, at six or fewer each in the window. They are not marked unresolved either: a row says a call
    was looked at.
  - *Item 2, the figure.* (a) Trailing coverage at stated confidence. (b) Trailing at high confidence. (c) Both and the
    all-time figure. Chosen (b): it is never above (a) and is what the existing warning used. The all-time figure is below
    70% on the register because of the Honda IMA call (63.6% after this work), which METRICS.md already says to read with
    care; it is not a reason to withhold the recent split.
  - *Item 2, one threshold or two.* Reusing `warn_below_...` would make its name false; a second key at the same value lets
    the warning level rise above the withholding one. Chosen a second key.
  - *Item 3.* (a) Keep the key that sorts first, as the code did. (b) Extend the cap to every tied model. Chosen (a): the
    cap is a published number and (b) makes it depend on the data (301 values here).
  - *Item 4, what `supply` does under a changed scope.* (a) Trim new months to today's scope. (b) To the ledger's. Chosen
    (b): under (a) a month supplied again would differ from the stored one, and a pair that narrowed and later widened
    would hide blanked months behind a ledger that says they were kept.
- Choices a reviewer could want reversed:
  1. The C 200 is classified mild at medium confidence on a source that does not itself say mild hybrid; it moves 37
     vehicles per dataset. Removing its row restores them to Hybrid.
  2. Five of the eight rows are medium confidence (Staria, X55, H7, ES, C 200). Full hybrids are not counted in coverage
     by confidence, so this affects only the C 200 row.
  3. The split is judged on trailing coverage at high confidence at 70%, the figure METRICS.md already named; a window with
     no hybrid is not withheld.
  4. A withheld dataset folds every Mild hybrid vehicle into Hybrid, including the Hilux and Land Cruiser diesels that the
     code mapping calls mild. It does not occur today; if it did, the ute hybrid share would jump, which is why the mapping
     exists.
  5. The golden fixture's register is under the threshold, so the golden now shows the withheld case and the published
     case is held by a test.
  6. The manifest keeps `label` unchanged when the split is withheld; the site has to read `mild_split_published`.
  7. A ledger with no record of its trim, or a config with no rule where the ledger has one, still refuses.
  8. The guard's unmapped rate was documented, not changed, and the cube's was not made the guard's.
  9. METRICS.md had no model-cap paragraph; a short one ("Named models") was added.
- Consequences: true registrations' mild split is published on a trailing 79.2% at high confidence; the dashboard history
  never needs supplying again for a new vehicle type or import status; the site, on another branch, must show that a
  dataset's split can be withheld.
- Added by the lead before review: the Mercedes-Benz C 200 row moves 37 vehicles a dataset from Hybrid to Mild hybrid, and its
  first source did not use the words. A second reading on 2026-11-16 (Wikipedia's articles on the W205 and the W206, by a
  sub-agent that read the pages) found the C 200's M264 engine with EQ Boost listed as a mild hybrid (MHEV), no C 200 as a
  full or plug-in hybrid (the plug-ins were badged C 300 e and C 350 e), and a 2.0 litre C 200 without the 48 V system before
  the 2018 facelift, which would not be recorded as a hybrid. The maker's own press kit was not reached; the row stays at
  medium confidence and now cites both sources.
- Left for the site (not in this change): a dataset whose split is withheld (`mild_split_published: false`) shows its hybrids
  undivided, and the site should say so beside the chart. No dataset is in that state today.
- At review (#68): agreed, with nothing to fix first. Left open, in order: (1) a dataset can flip between published and
  withheld from one build to the next, which rewrites its whole history of the two values, and nothing announces the flip
  itself (the state does not hold the flag); on true registrations the margin is 14,271 of 18,011 at high confidence, so
  about 2,400 more unknown hybrids in the window would do it. (2) The comparison uses the figure rounded to four decimals,
  so 69.995% publishes; no test sits exactly at the threshold. (3) A full call leaves the denominator whatever its
  confidence, so the four medium-confidence full rows count in the "high confidence" figure (about 0.4 points). (4) The
  cap's tie test uses keys that sort the same under any collation.
- Status: decided by Claude (unreviewed)

## D-109 2026-11-17 — Months in which nothing is counted: one rule for the windowed figures, a ranking's precision floor, reserved values in Build, the load gate, and the hybrid split said
- Agent: claude
- Basis: the owner's direction that the question engine "needs to be flawless" before anything goes public (D-104); what D-107 left open for the site: a 12-month share under a condition (D-107, second review item 2), a ranking that applies neither share guard (D-107 item 2), the load gate (D-099, second review), a reserved value in Build's value picker (seen in a screenshot), and the manifest's two new fields about the hybrid split (pull request #68, not on `main` when this was written). Code: `src/lib/{shareline,rolling,measures,league,sentences,reserved,hybrid,loadGate,builder,composition,readout,config,data}.ts`, `src/components/{MixChart,TrendChart,LeagueChart,PresetPanel,QuestionBuilder}.tsx`, `src/styles/site.css`, `src/pages/caveats.astro` (one anchor); config: `config/presets.json`, `config/narrative/rules.json`; docs: `docs/METRICS.md`; tests: `tests/site/{zero-months,load-gate,reserved-values,hybrid-split}.test.ts` and changes to `league`, `rolling`, `coverage-note`, `not-recorded`, `ratio-charts`, fixture `zero-months.json`. Nothing under `pipeline/`, `data/reference/`, `config/pipeline.json` or `.github/` was touched.
- Context and the decisions, by item:
  1. **A month in which a condition keeps nothing is zero in a window, inside the dataset's months.** The rule D-107 set for rankings is now stated once (`docs/METRICS.md`, "Months in which nothing is counted") and every windowed figure reads it: a month inside the dataset's months (its first month, as `loadFirstMonth` gives it or its supplied start, to its newest) with no rows is zero; a month outside them is missing; a window with no vehicles at all has no share (blank, never 0%); both guards see the true window. The panel hands the charts `covers` (first and last month); where it is not known, nothing is inside and the old behaviour stands. The arithmetic moved out of `MixChart` into `src/lib/shareline.ts` (and `counted` and `windowTotal` in `measures.ts`), so a test runs the code the chart draws.

     | Windowed figure | Before | Now |
     |---|---|---|
     | Rolling 12-month share (the line, its hover, the peak that colours the lines) | a window with any month absent was blank | an absent month inside the dataset is zero; blank if the window reaches outside the dataset or holds no vehicles |
     | Precision floor on that share | not applied where a month was absent (the window was blank) | the window's vehicles, zeros included: under 200 is greyed, drawn where there is a figure |
     | Representativeness floor (monthly share; top-5 share) | could not fire if any of the 12 months before was absent | the median is of the true 12 months; a month with no rows of its own is not greyed |
     | Key under a share chart (last 12 months, change on the 12 before) | already right inside the dataset (absent months summed as zero) | the same; and a window that reaches outside the dataset's months has no figure and says so (no build has such a dataset; a test only) |
     | A count's 12-month running total, the count line, the last year in a count's key | a window with a month absent from the view's rows was broken | zero inside the dataset; a month outside it, or one the source does not record, still breaks it |
     | Largest-five share | monthly, no window: a month with no vehicles has no share | the same; only its representativeness median reads the rule |
     | Default start of an all-time share chart (`rollingMix`) | same blank-window rule | reads the rule; a window of no vehicles gives nothing even at a floor of 0 (it gave NaN) |
     | A ranking's year before; the change on a year ago | already right (D-107) | unchanged |

     The reference in the seeded test `tests/site/rolling.test.ts` was changed on purpose, for the absent months (it skipped a window with a month it had no row for) and for the window of no vehicles (it gave NaN); a month whose rows all carry a reserved value stays without a denominator there, as before. The note under a 12-month share is a template that says what is true now (`defaults.phrases.rolling_share_note`, and its internal twin).
     - **Proof against `origin/main`** (headless; the home page scrolled so every chart loads, five Build questions with no condition and eight with conditions; strings, table cells and chart marks compared). (The claim that nothing changes on Build with no condition holds for the questions tried and is corrected in "Review of #69", below.) **On the home page three all-time charts do change, and this is the change a reviewer should look at**: the register has 181 months with no vehicles still registered (the last is Jun 1945), so the windows that contain them are now drawn. 693 more points on the brand-owner chart, 350 on the new-or-used chart, 315 on the segment chart, all between Dec 1912 and May 1946, all with under 200 vehicles in the window so all greyed, none changed and none removed. Each of the 1,358 equals a DuckDB recomputation from the cube's slices (zeros for the absent months), and the set of windows with an absent month in DuckDB is exactly the set that changed. With conditions: hydrogen vehicles by brand 255 points (was 0), one model's registrations by new or used on true registrations 88 (was 0), one small brand by powertrain 2,960 (was 40), CNG vehicles by brand on true registrations 69 (was 0); each checked the same way (0 mismatches, 0 windows missed). Charts that chose their values (the table has a row for every month) or have every month (a truck brand by powertrain) are unchanged. The axis of a chart that gains points changes with them (a 5% axis becomes 100%), and the suggestion lists lose the value in item 3.
  2. **A ranking's precision floor.** The floor is the share measure's own (200 vehicles), read against the total of the window ranked, as everywhere else a window is tested (the key, the bar chart, the map; `/method` says so): not 12 times 200. The definitions settle it, so the reading that greys more was not taken. Where the window ranked holds fewer vehicles, every share and every change in share is greyed (grey text, grey bars where they show shares, the hover reading carrying the reason) with one sentence from a template; where only the earlier window is under the floor, only the changes in share are greyed, with a sentence of their own. An earlier window with no vehicles gives no change at all, so nothing is greyed. Nothing is hidden. The floor is the share measure's whichever measure the chart counts, because a ranking's table prints shares anyway. Read headless on the hydrogen ranking (3 vehicles): "This ranking rests on 3 vehicles in the last 12 months, fewer than the 200 needed to read a share reliably, so its shares and changes in share are greyed."
  3. **Reserved values in Build.** What the build holds, by field (vehicles): not recorded on the long-run cars' two fields (971,961 and 971,960), country built in (94,207 still registered; 205 registered), region (6,693), segment and vehicle class (88), model (4,108); no reference match on brand, manufacturer group, brand owner's country and brand's original country (26,433 still registered; 1,753 registered); beyond the cap on model only (1,438,361; 164,020). Before: every one was offered, as a value to compare and as a condition. Options: (a) leave all three; (b) drop all three; (c) drop only beyond the cap. Chosen (c). Not recorded and no reference match are true of the vehicles they hold, so counting them, comparing them or keeping only them is a fair question (data quality is one). Beyond the cap is where a cap puts the values below it: not a group of vehicles, and it moves with the cap's basis. It is no longer offered in either role (a ranking already gave it no place). A link that names it is not refused: the value is left out, the address is corrected and a sentence from config says so (`builder.notices.left_out`). A condition left with no value keeps every vehicle and is held empty on the page, as a condition with no value yet is; the notice is what says so.
  4. **The load gate.** The gate now opens when the first chart's figure is in the page (with a fallback of four seconds if none appears), and each deferred panel that was taken for near reads where it is two frames later and loads only if it is within a screen of the visible part (the observer's own margin). Proved headless, ten loads each at 390 and 1280 px without scrolling, the data files requested. Before (`origin/main`): at 390, far charts' files in 1 or 2 of 10 loads (true registrations' powertrain, segment, brand, new-or-used) beside the first chart's and the second panel's pair (7 of 10); at 1280, new-or-used in 9 and true registrations' powertrain in 1 of 10, and the second panel's pair in all ten. Now: only the first chart's file, `cube/registrations_surviving/owner_country.parquet`, in all 20 loads, and nothing from any other group. Every chart still loads: scrolled to (15 of 15 at both widths), a link to `/#cars-still-registered` (it draws), tabbing to it (focus reached it and it drew), and with no IntersectionObserver (15 of 15). The second panel and those after it, which were being fetched at once, are now fetched on scrolling near them.
  5. **The hybrid split withheld.** The site reads `mild_split_published` and `publish_split_at_trailing_high_confidence_coverage` (absent means published). On a chart by powertrain of a dataset that withholds the split: one sentence from a template says its hybrids are shown undivided, with a link to the caveat (`/caveats#mild-hybrid-limits`, an anchor added to the existing heading); the mild value is not relabelled and the coverage note does not appear. The internal page adds the figure and the level. The name of the undivided value comes from config (`hybrid_classification.undivided_powertrain` where the pipeline gives it, else `source_hybrid.value`, which `main` has). Tested on fixture manifests, and shown headless on a copy of the build with its manifest edited. No dataset is in that state.
- Checked: `npx astro build`, `tsc --noEmit`, 133 site tests (106 on `main`), `test_site_config.py`, `test_data_map.py` and `test_invariants.py`, the public build and `scripts/check-public-build.mjs` (exit 0, 6 scripts). Screenshots at 390 and 1280 px of a chart whose gap is filled, the hydrogen ranking and Build's value picker, read. axe on `/` (no violation) and on `/build/` (one: `heading-order`, which `origin/main` has too), at both widths; no horizontal scroll.
- Choices a reviewer could want reversed:
  1. The register's 181 empty months are months of zero, so the home page's three all-time charts draw greyed points in 1912 to 1946 they did not. Reversing: give `covers.first` a later value for the register (it comes from `loadFirstMonth`), or start the all-time share charts later.
  2. A ranking's floor is 200 on the window's total, for a month and for twelve months alike (not 2,400 for twelve).
  3. The floor a ranking reads is the share measure's, not the preset's measure.
  4. A ranking under the floor greys, where D-107 item 2 notes the other places suppress; the table has "Greyed:" as hidden text for a screen reader.
  5. Beyond the cap is dropped from Build, not recorded and no reference match kept; a link that names it is corrected with a notice, not refused.
  6. A condition left empty by that stays on the page and widens the question visibly, with the notice, instead of blocking the chart.
  7. The key under a share chart shows a phrase ("No figure: the window starts before the data does") for a window outside the dataset, not "suppressed".
  8. The gate opens on the first figure being drawn, with a 4 second fallback; a panel's nearness is its place within one screen above or below, as before, read two frames after the gate opens.
  9. Where the split is withheld, the powertrain dimension's own hand-written note in config still says mild hybrids are picked out by model name, and `/caveats` and `/method` speak of the mild classification as always done. Not changed: they are not templates, and belong with the narrative work (D-062).
  10. A monthly count of a total under a condition now reads zero for a month with no rows inside the dataset (it was a gap) on a view whose rows lack that month.
- Review of #69 (the independent review recomputed the rule on four views of its own and matched every drawn point; the ranking floor, the reserved values and the load gate work as specified). It found two things to fix, and three small ones. What changed in answer:
  1. **What the newly drawn greyed points reach was wider than said above.** The sentence "with no condition, on Build nothing changes except the note's wording" held only for the five Build questions I tried (none was the register's share by brand over all time), and "only All records changes" was wrong for Explore. The register's greyed points (Dec 1912 to May 1946, each resting on under 200 vehicles) also appear on Build with no condition over long spans (share by brand gained 2,100 points; powertrain, new or used and brand owner gained some), and on the default view of two Explore charts: "Which countries own the brands we register?" and "Cars, utes, vans or trucks?" open on "Since Jun 1937" and gained 63 greyed points a line (Nov 1940 to May 1946). (The first review named the second chart wrongly, and this note repeated it until the second review; the largest-five chart opens in Jan 1912 and gained no points.) They stretched the axis (78% to 90% on the brand-owner chart; 78% to 100% on Build's share by brand) and squeezed the lines that mean something. The rule stands and the points stay: a wartime month with nobody still registered is a true zero. **The fix is the axis: the vertical axis of a share-over-time chart is set by the points drawn in colour; greyed points are drawn within the frame and clipped at its edge** (`axisTop` in `src/lib/shareline.ts`, used by the share lines and by the top-5 share line; the grey line is clipped; the hover reading sits at the frame's edge but gives the figure in full; the table of figures is unchanged). Where nothing is in colour the axis is set by what there is, as before. Checked for the other charts: a count line carries no share guard, so nothing on it is greyed; the bar chart, the map and a ranking grey all their bars or none (their scale is by all of them, or, greyed, by what there is). A sentence in the grey note, from a template (`grey_beyond_scale`) with no value or figure, says a greyed figure above the scale is cut off at its edge.
     - **Proof**, head against `origin/main` (which has no site change since the base compared above), the vertical-axis tick texts of every Explore chart at its default view (15) and of Build's share by brand, by powertrain, by new or used and by brand owner over all time, at 390 and 1280 px (38 chart views): identical on all but one. Before this fix, 3 of those views at each width differed (the brand-owner chart on Explore and on Build, and Build's share by brand: 0 to 60% became 0 to 80% or 100%).
     - **The one that differs: "Is the market getting more crowded?" (Explore, `concentration`).** On `main` its axis runs 0 to 100% (ticks 0, 20, 40, 60, 80, 100%) because it was itself set by greyed points: the early months with a handful of vehicles, where the five largest brands hold all of them. Now its axis is set by the points in colour (ticks 0 to 60%, the top near 78%), so the line since 1970 fills the frame, and the early greyed spikes are cut off at the top edge. A change in how the chart reads, and it is the one to look at; it follows the rule this review asked for and is not caused by the zero-month rule. Screenshots at 390 and 1280 px were read.
  2. **With a split withheld the chart said two contradicting things.** The powertrain dimension's `public_note` (and its internal `note`) speak of a mild hybrid line and "the note below", which are not there when the dataset does not divide its hybrids. A dimension's note may now carry a condition from a short list in code (`split_published`, `src/lib/dimensionNote.ts`) and the note to read when it does not hold (`public_note_otherwise`, `note_otherwise`), or none. Config gives the powertrain dimension "NZTA does not record whether a hybrid is mild or full." for a withheld split; no dimension id or value is in code. Tested on fixture manifests: withheld, the chart has the sentence about undivided hybrids and not the old note; published or no flag, the old note and the coverage note as before. A test fails on a condition name the list does not know.
  3. **`covers`** is now one object until the preset, the build or the first month changes (`useMemo` in the panel, from `datasetCovers` in `src/lib/resolve.ts`).
  4. **The earlier-window sentence for one month** reads "The earlier month … holds 30 vehicles": two templates (`ranking_thin_prior`, `ranking_thin_prior_month`), chosen by the ranking's span, neither with a figure.
  5. **The test the review named as the most important gap**: that the panel hands the charts the dataset's own first and last month, for an all-time register view, a supplied dataset and one defined as another filtered, through the pure `datasetCovers` (`tests/site/covers.test.ts`); and that the panel takes it from there, once, for the share chart, the trend chart and the default start.
  - Choice a reviewer could want reversed: greyed points above the axis are cut off at its edge rather than drawn as a clipped spike or a marker; and the hover reading for one sits at the edge (the figure it gives is the true one). Not done: `/caveats` and `/method` still speak of the mild classification as always applied (they wait for the narrative work).
- Second review of #69 (added): agreed. Left open: where a chart's coloured points are few, they alone set the axis and most
  of the greyed picture is cut off (share by powertrain for one small brand over all time: 8 coloured months set the axis at
  70%, and 391 of 1,449 greyed points are above it; every one is under the floor, the note says greyed figures are cut off,
  and the hover gives them). A fairer rule would let the coloured points set the axis only where they are a fair part of
  what is drawn. Not done here.
- Status: decided by Claude (unreviewed)

## D-110 2026-11-17 — The four things D-108's review left open: a flip of the mild split is announced, the split is judged on the whole counts, the stricter coverage figure says what it counts, and the tie test tells byte order from a locale's
- Agent: claude (a sub-agent, to the lead's brief)
- Basis: D-104 (the engine must be right before anything is public), D-108 and its "At review (#68)" note; the code and tests on
  `claude/split-flip-guard`; the saved October pull and the committed dashboard counts, read with a scratch script that calls the
  pipeline's own functions and writes nothing in the repository.
- Context: #68 withholds a dataset's mild hybrid split when its trailing coverage at high confidence is under
  `publish_split_at_trailing_high_confidence_coverage` (0.70). Its review agreed and left four things open.
- Decision, by item:
  1. **A flip is announced.** `data/state/last_good.json` gains `mild_split`: for each built dataset that has a coverage block,
     `published` and `trailing_high_confidence_coverage` (the figure it was judged on, null when the window held no hybrid). A
     build whose answer differs from the state's adds one warning: the dataset, the direction, the figure in the last good build
     and in this one, the threshold, and what changes for a reader (Mild hybrid disappears from, or reappears in, every slice,
     pair and fact table, Hybrid moves by the same amount, no total moves, and a figure quoted from the earlier build no longer
     matches). **A flip warns in both directions and does not stop the run.** A state with no `mild_split` (every state written
     before this), a dataset first built, and a record that is not in the written shape are not compared; the build records it.
     The golden file is unchanged: it is built with no state and the manifest gains nothing.
  2. **The exact edge.** The split is judged on the whole counts (identified at high confidence or by the code mapping, over
     identified mild plus unknown), not on the figure rounded to four decimals. A division of whole counts is correctly rounded,
     so a ratio exactly at the threshold compares equal to it: at the threshold publishes, one vehicle under does not. The
     manifest's figure stays rounded; the warning level (`warn_below_...`) uses the counts too. Tests build the counts from the
     configured threshold: exactly at it, one under, one over, and 139,999 of 200,000, whose rounded figure reads 0.7 while its
     counts are under it (it published before).
  3. **What "high confidence only" counts. Superseded by the lead's choice, in "After the report" below; this is what the
     author first did and measured.** Read from the code and METRICS.md: the numerator is `mild` rows at the high level plus
     vehicles identified by the code mapping alone; the denominator is identified mild plus unknown, at both levels; the stated
     figure's numerator is every identified mild vehicle. METRICS.md named only `mild` rows as demoted and said nothing of `full`
     rows, which the code leaves out of the denominator whatever their confidence. The definition is silent, so METRICS.md now
     states what the code computes and a test holds it; no computation and no published figure changes. The effect is **not
     the 0.4 points the review estimated**: measured on the 2026-10 snapshot, counting the medium-confidence full rows as unknown
     takes the trailing figure at high confidence from 79.3% to 74.0% on the register (1,272 vehicles; 14,241 of 17,961 becomes
     14,241 of 19,233) and from 79.2% to 74.0% on true registrations (1,275; 14,271 of 18,011 becomes 14,271 of 19,286), and the
     all-time figure from 63.6% to 60.1% and from 68.5% to 64.5%. Neither dataset would fall under 70%, so neither would flip.
     On true registrations 2,376 more unidentified hybrids in the window would cross 70% today (14,271 of 18,011); under the
     stricter count it would be 1,101.
  4. **The cap's tie test.** DuckDB's default collation is binary (`current_setting('default_collation')` is empty, nothing in the
     pipeline sets one), so `ORDER BY count(*) DESC, key` already breaks a tie in byte order. No code behaviour and no published
     file changes. The test now uses keys that DuckDB's own en_US collation orders differently (an upper and a lower case letter,
     a digit and the separator, the two cases of one letter, and all of them with a space), asserts that before it asserts the
     answer, and asserts the default collation is binary; with the ORDER BY changed to a locale collation all eight cases fail.
     CUBE_SCHEMA.md now states the order exactly: it had said digits before upper before lower, which left out that `|` sorts
     after letters and that a space and most punctuation come before digits.
- Options considered:
  - *Item 1, warn or stop.* (a) Warn on every flip. (b) Stop the run on a flip to withheld, warn on a flip back. (c) Stop on
    either. (d) Warn, and require a margin to flip back (hysteresis). Chosen (a). A flip to withheld is the safe direction: the
    build has judged its own split unreliable, and stopping would keep last month's split published (the very split judged
    unreliable) and hold the new month back with it; the run is tried every day (D-064), so it would stop every day until a
    maintainer changed a reference file or the threshold. The unmapped-make guard's pattern, "warns, then aborts", protects against
    publishing a wrong figure; here the wrong figure is the one a stop would leave in place. A flip to published means the figure
    reached the threshold, through new data or a deliberate edit, and the warning is enough to make the rewrite of history seen.
    The cost of (a) is that the warning is read only by someone looking at the Action's log or the manifest. (b) was the closest:
    it would stop a build that wrongly collapsed the identification, which the warning also reports, at the price above. (d)
    changes the meaning of "at or above the threshold publishes" and was not asked for. A dataset hovering at 70% will flip, and
    warn, each month it crosses.
  - *Item 1, what the state keeps.* (a) The flag only. (b) The flag and the figure. (c) Also the threshold. Chosen (b), so the
    warning can name both figures; (c) would let the warning say a threshold change caused the flip, and a threshold edit is a
    reviewed commit, so it was left out.
  - *Item 1, where the flag lives.* In the state, not the manifest: the manifest already says the current answer, and the golden
    contract and the site read it, so a second field there would be a contract change for no reader.
  - *Item 2.* (a) Compare the unrounded ratio. (b) Keep the rounded comparison and document it. Chosen (a): it makes the rule as
    written ("at or above") true, and (b) would document a behaviour with no reason behind it.
  - *Item 3.* (a) Document what the code computes. (b) Count a full row at medium or low confidence as unknown at high confidence
    only. Chosen (a), by the rule in the brief (reversed by the lead after the report; see below): the definition is specific about `mild` rows and silent about `full`, so the code
    does not depart from it, and (b) would change two published figures by five points. Weighed for (b): the manifest says the
    stricter figure shows "how much it rests on medium- and low-confidence classifications", and a medium full call is one; a wrong
    one hides a mild vehicle under Hybrid. Weighed against: no medium or low full row carries an override today (the three full
    rows that do are high confidence), so none moves a vehicle between powertrain values. Also not done: publishing the full rows
    by confidence in the manifest, which would show the five points to a reader and is an additive contract change.
  - *Item 4.* (a) Leave the code and strengthen the test. (b) Add `COLLATE BINARY` to the ORDER BY. Chosen (a): the order is
    already byte order, a test asserts the default, and an explicit collation would change nothing today.
- Choices a reviewer could want reversed:
  1. A flip warns in both directions and never stops the run.
  2. The first build after this merges compares nothing: the committed state has no `mild_split`, so a flip in that very build is
     not announced. The build after it is.
  3. The state keeps the figure rounded to four decimals, as the manifest has it, not the counts.
  4. The standing "not published" warning keeps its wording and its rounded figure, so at the edge it can read "70.0% ... below
     70%". Putting the counts in it would change the golden manifest, whose fixture register is withheld.
  5. At high confidence only, a full row below the high level stays in the denominator as unidentified (the lead's choice,
     below; the author had left it out). Reversing it moves the published high-confidence figures by five points, and the
     margin on true registrations from 1,101 back to 2,376 unidentified hybrids.
  6. The tie test needs DuckDB's en_US collation (the bundled ICU) to prove its keys discriminate.
- Consequences: a monthly build that flips a dataset's split prints one warning in the Action's log and the manifest;
  `mild_split` is a new key in the state the Action commits; a dataset exactly at the threshold publishes; METRICS.md and
  CUBE_SCHEMA.md say what the code does. The only published figures that move are the manifest's high-confidence coverage
  figures (item 3, as adopted below); the order of the cap and the exact edge move nothing.
- Left for the site (not in this change): when `mild_split_published` is false, or has just changed, a flip rewrites the figures
  the site shows for every month at once.
- After the report (the lead, 2026-11-17): the lead adopted the stricter count in item 3, in a later commit. The reason: a
  figure described as "counting high-confidence classifications only" that treats 1,272 medium-confidence full calls as certain
  is not what its name says, and the threshold rests on it. METRICS.md already demotes a `mild` row below high confidence to
  unknown; a `full` row below it is treated the same way for the same reason, since if such a call is wrong a mild hybrid has
  been missed. So at high confidence only, a vehicle matched by a `full` row below the high level stays in the denominator as
  not identified; a `full` row at the high level leaves it as before; the stated figure and every assignment of a powertrain
  value are unchanged, and the confidence levels come from config. Measured with the pipeline's own code on the 2026-10 pull
  and the committed dashboard counts, and then in a dry-run build of the saved pull (the manifest agrees to the figure): the
  trailing figure at high confidence went from 79.3% to 74.0% on the register (14,241 of 17,961 to 14,241 of 19,233) and from
  79.2% to 74.0% on true registrations (14,271 of 18,011 to 14,271 of 19,286); all time from 63.6% to 60.1% and from 68.5% to
  64.5%; the stated figures (83.5%, 83.5%, 83.1%, 83.0%) did not move. Neither dataset flips: both still publish. The margin on
  true registrations falls from 2,376 to 1,101 more unidentified hybrids in the window, so keeping `mild_hybrid_models.csv`
  current matters more. Two limits: the manifest's `identified_full` is not split by confidence, so the figure at high
  confidence only cannot be rebuilt from the manifest alone (adding that split would be an additive contract change, not done);
  and a window with no mild or unknown hybrid but some `full` rows below the high level reads 0% at high confidence only and
  is withheld, where it was not before. The fixture register of the golden file has one such `full` call, so its figure went
  from 0.3333 to 0.25 (the only golden change).
- Status: decided by Claude (unreviewed)

## D-111 2026-11-17 — The question builder, package F's site side: ranking the values a visitor chose, conditions as removable lines, and the file of figures
- Agent: claude
- Basis: the work order's package F (`docs/brief/WORK_ORDER.md` §5.F: "rank chosen values, labelled 'ranked among the N you picked', with the full ranking one step away (D-062)"; "any number of conditions, each a removable line"; "CSV of exactly what is on screen, with attribution") and its acceptance question; the owner's direction that the engine "needs to be flawless" (D-104). D-061 stopped chosen values being ranked because a ranking of a few picked values would read as their place in the market; D-062 allowed it if labelled, with one step to the ranking of every value. Code: `src/lib/{builder,league,resolve,sentences,figures,scope,readout,config}.ts`, `src/components/{QuestionBuilder,LeagueChart,PresetPanel,MixChart,GeoChart,DistributionChart,TrendChart,FiguresTable,FiguresContext}.ts(x)`; config: `config/chart_rules.json`, `config/presets.json`, `config/narrative/rules.json`; docs: `docs/METRICS.md`; tests: `tests/site/{conditions,ranked-picked,figures-csv}.test.ts` and changes to `shapes`, `value-words`, fixture `shape-defaults.json`. Nothing under `pipeline/`, `data/reference/`, `config/pipeline.json` or `.github/` was touched.
- Context and the decisions, by item:
  1. **Ranking the values a visitor chose.**
     - *What the page says (config templates, no value or figure in any):* above the chart, "Ranked among the 3 you picked: each rank is a place among those 3, not among every brand." The leader: "BYD has the most of the 3 you picked: 3,513 vehicles first registered in the last 12 months that are still registered." (level at the top: "A and B are level at the top of the 3 you picked: each has …"; none with vehicles: "No vehicles were counted … for any of the 3 you picked, so there is nothing to rank."). Values that take no place are named: "No vehicles were counted in the last 12 months for BYD, so they take no place in the ranking." (the wording for not recorded and for no reference match is in the review of #71, item 8). The column heads are "Rank of 3" and "Rank of 3 a year before".
     - *What a share is a share of.* Options: (a) a share of the values picked, summing to 100%; (b) a share of everything counted under the conditions, as the site's rule says a share's denominator is (`docs/METRICS.md`), labelled; (c) show no share. Chosen (b). A share of the picked values alone is exactly the reading D-061 feared (a few brands' shares summing to 100% look like the market), and it would be a second definition of a share on one site. The column is headed "Share of all counted", and a sentence says "Each share is of all 20,662 vehicles that meet the conditions in the last 12 months, not of the 3 you picked, so those shares do not add up to the whole." (a variant for no conditions). The shares of the picked values therefore sum to less than 100%; the rows and their denominators are `leagueRows`' own.
     - *"You picked".* Where a count by a breakdown opens, the page fills in starting values (D-061); they sit in the picker as chosen values and the visitor can remove them, so the label says "you picked" for them too. The owner's wording was kept over "chosen" (one template to change if reversed).
     - *Where it fits: the rule table.* Two rules in `config/chart_rules.json` after `ranking`: a count, or a share, of a category with a long list over one window with several values picked gives league first (then trend for a count, mix for a share). They need `values: many`, so the picked ranking exists exactly where the ranking of every value does (a short list such as powertrain is not ranked, picked or not, which keeps "the full ranking is one step away" true everywhere it is offered). One value picked has nothing to rank and stays lines. An average is not ranked.
     - *Is it the default?* No. A question that names values opens on lines over ten years, as before (D-061, `period_when_comparing`); the ranking is a view the visitor switches to (a text control beside the search box's label, "Rank the 3 you picked"; address `build.view=league`), opening on the last 12 months (`period_by_shape.league`), where the time row offers only the one-month and 12-month windows, since a span of years is not one window (`fitsPin`, which the resolver and the panel share; a test holds every pinned view in Build to it). Options weighed: make the ranking the default of any one-period question with values picked: but a Build question has no period of its own (the period is the chart's setting), so the only one-period question is one the visitor has already asked for. A time-row route (as the ranking of every value has) was rejected for chosen values: two ways in would leave the "Show as" radio saying Line while the chart is a ranking.
     - *The full ranking one step away:* "Rank every brand instead" (under the picks) keeps the picks in the question and the address and ranks every value under the same conditions and window (`build.rank=all`; the chart's settings, the window and month, are kept); "Back to the 3 you picked" restores the chart. Focus moves to the other button. Leaving the ranking view, or fewer than two values, leaves the full ranking. A link that names `rank=all` without the ranking view is not read as one.
     - *Reuse.* The rows are `leagueRows` and the guard `rankingGuard`, unchanged: shared ranks, alphabetical ties, the year before from the dataset's own months (a month with nothing counted is zero), the thin-ranking grey and sentence, reserved values take no place. `pickedSummary` names the leaders and the picked values with no place. A measure of two parts (share and number) is one ranking in this view, which holds both. A count by a breakdown is pinned to lines unless the ranking is asked for.
     - *Fixture delta (`UPDATE_SHAPE_DEFAULTS=1`).* 728 entries became 764: 18 changed and 36 were added, all for questions with two values picked on the three breakdowns that have a long list (brand, manufacturer group, model) on both datasets, for share, count and share and number: the 18 "views" entries that changed went from nothing to "mix,league" or "trend,league", and the 36 entries added are (the question drawn as the ranking: "league live latest_year ranking[latest_year,latest_month]"; and drawn as lines, "mix live 10y" or "trend live 10y", the same as the question already drew). No Explore entry, no question with none or one value picked, and no question drawn with no view moved.
  2. **Conditions.** Already so: a visitor could add a condition on every field the fact table has (the limit `max_filters` was removed earlier), each its own line with a remove button named "Remove this condition: <field>" (its visible words are in its name), and several values read "is “A” or “B”" in a sentence that lists every condition. Not so, fixed: the same question had different addresses and sentences by the order its conditions and values were added in (now fields by id, values by text, in `cleanWhere`); removing the last value of a condition left an empty line that kept everything (now the line goes, and focus goes to "Add a condition on"; a condition just added stays empty until its first value). The sentence that lists conditions moved from the panel to `src/lib/scope.ts` with its wording unchanged, so it can be tested and written into the file of figures. Its words are code, not config: the lint bans "only" from templates, and the sentence was already hand-written (D-062 plans to move it). Tests: every field as a condition draws; several values; four conditions listed; one address for two orders; the address reads back; the line goes with its last value.
  3. **The file of figures.** One button, "Download the figures (CSV)", on every chart's actions (Explore and Build use one panel, so both have it, on every shape). Each renderer builds its table once as a `Figures`, and the page's table and the file are made from it; the ranking's table is now `leagueTable`, which the page draws from. The file is made in the browser from the rows the chart already holds: no request (measured: 0 on the click), no vehicle row (invariant 6).
     - *Form.* UTF-8 with a byte order mark, CRLF, fields quoted where they hold a comma, quotation mark or line break. Numbers are plain: counts whole, shares as percentages written as numbers (the heading says "Share (%)"), changes in share in percentage points, months as `YYYY-MM`, a minus as "-". A text starting with `=`, `+`, `-` or `@` (or a tab or return) gets an apostrophe in front. Options for the notes: a separate file or sheet; a header block of "# " lines; a trailing block. Chosen the "# " lines above the table: one file, a spreadsheet shows them as text above the table, and a program reads past them with its comment character set to "#". (First written with a note that holds a comma quoted as any field is, so that it started with a quotation mark; the review of #71 showed that no reader that skips comment lines recognises such a line, so the notes are now written unquoted: see "Review of #71", item 1.) Lines: the question as the page states it, what is counted (the definition and the conditions' sentence), the period, the dataset, the snapshot, the source note (where the dataset has one), the site's attribution, the address that redraws it, how figures are written, and one line on marked figures.
     - *Marks.* A greyed figure is written, with its reason; a withheld one (the page's dash or "suppressed") is a blank cell with its reason, never zero. The reasons are in a last column ("Greyed or withheld") only where some figure is marked and no column already says why (the trend's "Note" column). The line names each column, kind and reason.
     - *What "the table on screen" is for each shape.* A ranking: its table. A line chart: "The figures behind this chart" (every month). A share over time (mix): the table under it, its last-12-months summary with the change on the 12 before; the monthly shares are in no table on the page, so are not in the file. A map and a distribution: their tables. The file name is the question, in lower-case words, then the snapshot's date.
  4. **The acceptance question**, results below.
- **The acceptance question, on both datasets (headless, 1280 px; CSVs downloaded and compared with DuckDB counts from the fact table's column files).** Window: Nov 2025 to Oct 2026 (the last 12 months); the year before is Nov 2024 to Oct 2025. A: "Ford, Toyota and BYD only, one powertrain, one segment": battery electric (BEV), segment Car. B: Diesel, Ute. True registrations carry no segment in their fact table, so the page offers "Registered as" (`vehicle_type`) in its place, and that field is swapped in: passenger cars and vans for A, goods vans, trucks and utes for B. The page offers only the fields a dataset carries.

  | Dataset, conditions | Everything counted | FORD | TOYOTA | BYD | The page's sentence |
  |---|---|---|---|---|---|
  | Still registered, BEV and Car | 20,662 | 67 (#3, 0.3%) | 639 (#2, 3.1%) | 3,513 (#1, 17.0%) | "BYD has the most of the 3 you picked: 3,513 vehicles first registered in the last 12 months that are still registered." |
  | Still registered, Diesel and Ute | 20,423 | 8,621 (#1, 42.2%) | 3,070 (#2, 15.0%) | none: not ranked | FORD leads; "No vehicles were counted in the last 12 months for BYD, so they take no place in the ranking." |
  | True registrations, BEV and passenger cars and vans | 20,709 | 76 (#3) | 639 (#2) | 3,517 (#1) | BYD leads |
  | True registrations, Diesel and goods vans, trucks and utes | 29,385 | 9,438 (#1) | 6,545 (#2) | none: not ranked | FORD leads |

  Each of the four was also run as the full ranking (`build.rank=all`, top 15; TESLA leads both BEV questions, with 4,205 on the still-registered one; FORD leads both Diesel ones). The eight downloaded files were compared with DuckDB row by row (name, rank, count, share to the shown decimal, rank a year before, change in share, and for true registrations the change on a year ago, withheld under the floor of 50): 0 mismatches in all eight. A page's table was also compared with its file cell by cell for those eight and nine other pages (a mix, a map, a distribution, lines of chosen values, a total, a ranking of every value under the thin guard, the top-5 share, a share by brand with two values picked, and the home page's first chart): 0 mismatches; every file opened with the byte order mark, had no line break but CRLF, and made no request on the click.
- Checked: `npx astro build`, `tsc --noEmit`, 169 site tests (146 on `main`; 23 new: 6 conditions, 9 ranked-picked, 8 figures-csv), `test_site_config.py`, `test_data_map.py` and `test_invariants.py` (397 passed), the public build and `scripts/check-public-build.mjs` (exit 0, 6 scripts). Headless at 320, 390 and 1280 px: the acceptance question's ranking, the full ranking, a question with four conditions (one with two values), one with a value that takes no place, true registrations; screenshots read; axe (WCAG 2.1 A and AA, best practice) on each: one violation, `heading-order`, which `origin/main` has too (D-109); no horizontal scroll; no console error. Keyboard: the two ranking buttons and the condition lines reached and operated with Tab and Enter, a visible 2px outline, focus moved as designed. **Against `origin/main`'s build** (the home page, nine Build questions with no value picked (share by brand, powertrain, region and engine size, brand over 12 months with and without a condition, top-5 share, a total count, true registrations by brand) and two with two values picked; at 390 and 1280 px; every text line, every table cell and the count of chart marks): the only difference is the new button "Download the figures (CSV)", and, on the two questions with two values picked, the new "Ranking" choice.
- Choices a reviewer could want reversed:
  1. A share in the ranking of chosen values is a share of everything counted, not of the values picked; the column and a sentence say so. Reversing is a template and one argument, but it would put a second definition of a share on the site.
  2. The ranking of chosen values is offered, never the default; it opens on the last 12 months.
  3. It exists only where the ranking of every value does (`values: many`): a short list (powertrain, segment) is not ranked even when values are picked.
  4. (Reversed in the review of #71, item 2.) The page said "you picked" also of the starting values it fills in; it now says "shown" of its own and "you picked" only of the visitor's.
  5. A chosen value with no vehicles, or a reserved one, is named as not ranked, and N still counts it.
  6. The full ranking keeps the picks in the question and the address (`build.rank=all`) rather than dropping them.
  7. A count by a breakdown is lines unless the ranking is asked for; the ranking draws one chart for a measure of two parts.
  8. The conditions are written in one order in the address and the sentence (fields by id, values by text); the page lists a visitor's in the order added.
  9. The last value off a condition removes its line.
  10. The file's notes are "# " lines above the table, not a separate sheet; each is written unquoted, so a spreadsheet may carry a sentence into the cells to the right at its commas (review of #71, item 1).
  11. A percentage is written as a number with the unit in the heading, not as a proportion or with a % sign.
  12. A greyed figure is written, not blanked; a withheld one is blank with a reason. A last column is added only where some figure is marked.
  13. For a mix chart the file is its 12-month summary, the table the page shows; the monthly shares are not offered as a table or a file.
  14. The scope sentence ("Only vehicles where … are counted.") stays hand-written in code (`src/lib/scope.ts`); the template lint bans its first word.
  15. The ranking's bar toggle is named "Show bars as", so the page has one "Show as".
- Not done: the monthly figures behind a mix chart as a table and a file; saved questions; a ranking of an ordered band or a place by chosen value (the rule table gives none); a way to download the tied entries beyond a cut (the page says how many).
- Review of #71 (the independent review recomputed the acceptance question and six cases of its own and compared 42 files with their pages: no mismatch). What it found, and what changed in answer:
  1. **The file's notes could not be skipped.** Every note was written through the CSV quoting, so a note with a comma began with a quotation mark and a program that skips lines starting with "#" read it as data (pandas' `comment="#"` failed on the acceptance file). Options: keep the quoting (a spreadsheet then shows each note in one cell); write the notes unquoted (every note starts with "# " and is skipped; a spreadsheet may carry a note across cells at its commas); word the notes without commas. Chosen the second: the readers that skip comments are the ones the docs promised, and a spreadsheet user can read a sentence across cells. A note never holds a line break (one is written as a space). A test reads a produced file with a comment-skipping reader written in the test and gets exactly the table. The header comment in `src/lib/figures.ts`, `docs/METRICS.md` and the form paragraph above say what is true.
  2. **"You picked" was said of values the visitor never picked.** (a) The page's own starting values are not the visitor's: a question tracks `pageValues`; where they are the page's, every sentence, heading and button says "shown", from templates (`ranking_shown_*`, `ranking_switch_*`, `ranking_back_*`, `ranking_all_note_*`), and "you picked" only for the visitor's; the legend of the picker reads "Compare, the page's choice". (b) They follow the question: the page's values are the five with the most vehicles in the last 12 months under the current dataset, breakdown and conditions, looked for again when any of them changes, and kept once the visitor adds or removes one. The address says which: no `build.value` means the page's own, and a value in the address is the visitor's, so an older link, which named the values the page had written, keeps its values and now counts them as the visitor's. The ranking view of the page's values is a link too (`build.view=league` with no values): a count waiting for its values keeps the view. Options for the address: a marker parameter (`build.values=page`); the absence of `build.value`. Chosen the absence: a link that names nothing asks for the page's choice, which is what it already meant. Not done: the page's values are chosen over the last 12 months of the dataset, whatever window a ranking of them is of (a past month the address names does not move them).
     Walk, headless at 320, 390 and 1280 px: `/build/?build.measure=count&build.by=make` opens with five brands and an address with no values; adding the condition powertrain = BEV replaces them with the five largest under it; switching to Ranking says "Ranked among the 5 shown" and the leader sentence says "of the 5 shown"; adding one brand makes the values the visitor's and the address names them; the page then says "you picked".
  3. **The line on marks misnamed columns and doubled a full stop.** It now uses the file's heading ("Share of all counted (%)", "Rank of 3 a year before") and drops a reason's own full stop; both are tested.
  4. **The attribution was the site's NZTA line on every file.** Each dataset has its own statement in config (`attribution` in `config/dimensions.json`: the register's, the dashboard's, and for Stats NZ's series a template over the statement the supplied store carries). A file credits the datasets it draws on and no other; a chart that divides one dataset by another credits both (the file lists each as a line of its own). Checked on a register chart, true registrations, a long-run chart and two charts of two datasets (completeness, cars still registered). Every dataset a chart or the builder draws on is held by a test to have a statement.
  5. **The answer first.** In the ranking of some values, and in the ranking of every value asked for from it (`build.rank=all`), the leader's sentence and figure come straight under the question, and the definition, links and time range follow, as the trend's do. The ranking of every value reached otherwise (a share by brand over 12 months) is unchanged: it has no answer sentence. The "Show as" row is gone for the ranking: the switch is a text control on the row of the search box's label ("Rank the 3 you picked", "Show lines instead", "Rank every brand instead") and takes no row of its own. Measured against `origin/main` at 320 and 390 px, the top of the chart for a question with two brands chosen and for one with the page's own values is the same (0 px difference; the previous commit's row and a note under the picker had pushed it 22 and 96 px); the ranking of every value over 12 months with no values is the same too.
  6. **A ranking link that names a range a ranking cannot have** (`…build.view=league&build.period=5y`): the address is corrected to the window drawn and one sentence says so ("This link named the range “Last 5 years”, which a ranking cannot have, so the ranking is of “Last 12 months”."). This applies to any chart whose shape is pinned.
  7. **Nothing to rank:** one sentence in place of the empty chart and table.
  8. **Wording.** Each kind of value that takes no place is said as what is true of it (no vehicles in the window; the source records no value; the value is recorded but matches no entry in the reference). The leader is said with the dataset's own words for what it counts ("3,513 vehicles first registered in the last 12 months that are still registered"; `leader_count` in the dataset's words). A change on a year ago withheld in a ranking of twelve months says "the earlier window, the same 12 months a year earlier", not a month (one month keeps the month's words).
  9. **A reason only the file gave.** The page now says, under the table of a ranking, what a dash in the rank a year before, in the change in share and in the change on a year ago means where the reason is not said elsewhere, and the file says the same words: one source (`leagueTable`'s notes).
  10. **Smaller.** The top-5 share's table has two number columns, "Vehicles" and "Of all vehicles", on the page and in the file (it was one column reading "745 of 1,133"); this changes that page's table. The comment on the formula guard says a program may show the apostrophe. `$value_classes_comment` names the rules that read `values`. The new phrases are indented as their neighbours. The numbers of the fixture delta above are corrected.
  11. **Tests.** The header block is built by a pure function (`src/lib/figuresHeader.ts`) and tested for a register chart, true registrations, a long-run chart and a chart of two datasets; the ranking's cells are read by column key (`cellAt`), not position; the tests that matched source text for the byte order mark, the sentences and the remove button are behaviour tests (`withByteOrderMark`, the templates, `removeConditionLabel`); the page's own values have a test for the address, the round trip and the wording. What is still read from source: that each renderer registers its table (`useFigures`), since a component cannot be rendered in these tests.
  - Choices a reviewer could want reversed, added: the page's own values are absent from the address; their note is the picker's legend, not a sentence; the switch to the ranking is a text control beside the search box's label, not a radio; the notes are unquoted; the full ranking of a question with no values has no answer sentence; the page's starting values look at the last 12 months of the dataset.
- Status: decided by Claude (unreviewed)

## D-112 2026-11-17 — A build's warnings reach someone who is not already looking: the Monthly build's summary page lists them, worst first, and the internal status page shows the manifest's
- Agent: claude (a sub-agent, to the lead's brief)
- Basis: D-104 (the engine must be right before anything is public), D-108, D-110 and the review of #70, which found that a flip of the
  mild hybrid split is in the manifest's `warnings` and the Action's log and nowhere a person looks; `pipeline/fetch.py`,
  `.github/workflows/monthly-build.yml` and `src/pages/status.astro` as they stood on `main` at #70.
- Context: before this, `print_summary` sent every warning to standard error, and only a run that builds nothing wrote to the run's
  summary page (`report`). No page of the site read `manifest.warnings`. On true registrations the margin of the split is about
  1,100 unidentified hybrids (D-110), so a flip is near, and a flip rewrites a dataset's whole history of two values.
- Decision, by item:
  1. **The summary page.** A build that ran (`run`, and a build by hand with `GITHUB_STEP_SUMMARY` set) appends to the page a heading
     with the snapshot month and the count, then a list of the warnings, or one line, "No warnings in the YYYY-MM build.", when
     there are none. The code writes it (`fetch.print_summary` through the `--github-summary` the workflow already passes), so
     the workflow and `test_workflow.py` are unchanged. Standard error keeps every warning, in the order raised. The text ends with
     a blank line, because the next step writes a line to the same page and would otherwise be read as part of the last item.
  2. **The order.** From a small explicit list in `config/pipeline.json` (`run_summary.warning_order`): each group is a label and a
     phrase the warnings of that kind contain. First, what rewrites published history (a split flip: "Every month of the
     dataset's history changes"); second, what stops a later build if it grows (an unmapped guard above its warning level: "the
     run aborts above"); then every warning no group claims, in the order the build raised them. Within a group, the order
     raised. Each listed warning of a group carries the group's label; the rest carry none. The code knows no domain value; the
     phrases are in config, as the thresholds are.
  3. **A page that cannot be written** is one line on standard error and never fails the run: the build has published and its
     state is waiting for the steps after it to commit, and a failed run would stop them. It does warn, because a page that
     silently stays empty is the thing this change is for.
  4. **The internal status page** (`/status`, not in the public build) lists the manifest's warnings at its top, each as the pipeline
     wrote it and in the manifest's order, with the snapshot and the time the cube was generated; with none it says so. It reads
     the manifest in the browser as the page already does (`loadManifest`, shared with the triage table, one fetch). The component
     is a named export of `PresetTriage.tsx`, not a file of its own. (The first version of this record gave the wrong reason: the
     121-byte `PresetPanel.*.js` re-export is already in `main`'s public build.) What a separate island really costs, measured by
     building both ways: the public build gains a seventh script, a new `resolve.*.js` chunk of about 21 KB split out of the shared
     runtime chunk (`jsx-runtime.*.js`, 182,345 bytes without it, 161,191 with), and both Explore and Build load it, a request more
     for each. No public page shows a warning (a test lists every file in `src` that names them). The page already shows pipeline text as it is: a dataset's `not_built` reason, in the list of what blocks
     a chart (`resolve.ts`, shown by `PresetPanel` when internal), and what each preset requires; so invariant 8's rule, which is
     about sentences a visitor reads, is not engaged.
- Options considered:
  - *Where the summary is written.* (a) By the code, to the path the workflow already passes. (b) By a new workflow step that reads
    `public/data/manifest.json` and appends its warnings (a few lines of shell or Node). (c) By both. Chosen (a): no workflow
    change, the ordering is tested in Python with the other warnings, and a build by hand shows the same page where a runner
    sets the variable. (b) would put the order in shell, or in a second implementation, and needs a test of a workflow step; it
    also reads a manifest that exists only when the step before it succeeded.
  - *How the order is decided.* (a) A phrase list in config, matched against the warning's text (chosen). (b) Make each warning
    structured (a kind and a text) in the manifest: a contract change, a golden change and a change for every reader of
    `warnings`, for an order. (c) Tag each warning in memory where it is raised (a string that carries a rank): invisible, lost
    by any copy or concatenation of the string. (d) Order by
    something measured, such as how close a figure is to its limit: the warnings carry no common figure. (a)'s cost is that the
    groups depend on the wording of two warnings. That is contained: a warning whose wording stops matching moves to the end of
    the list, never out of it, and the tests build each of these warnings (a flip in both directions and the guard, from real
    builds) and fail if one stops being claimed by its group.
  - *What to put first.* The brief names a split flip first, then a guard above its warning level, then the rest. Not done: ranking
    the rest (a dimension that stopped being live, a count that deviates, a source that lags); they are one group, in the order
    raised.
  - *The status page.* (a) A section at the top, from the manifest the page already loads in the browser (chosen). (b) Read the
    manifest at build time in the page's frontmatter: the page's other panels read it in the browser, and a build-time read would
    freeze the page at the cube of the build, where the browser reads the cube the page is served with. (c) The same ordering as the
    summary page, read from config in the browser: a second implementation of the order for a list that is short. Chosen manifest
    order, as written.
  - *Failing on a page that cannot be written.* (a) Never fail, warn on standard error (chosen). (b) Fail: it would turn a published,
    good build into a red run with its state uncommitted. (c) Fail quietly: no.
- Choices a reviewer could want reversed:
  1. The order comes from two phrases in config that match the text of the warnings, not from a field of the warning.
  2. A page that cannot be written warns on standard error and does not fail the run.
  3. The summary page repeats warnings that the manifest and standard error already have; the manifest and standard error are
     unchanged.
  4. The status page lists the warnings in the manifest's order, not the summary page's.
  5. A build by hand writes to the page only where `GITHUB_STEP_SUMMARY` is set; `run` writes to the path of `--github-summary`,
     not to the variable.
  6. Warning text is shown with a newline collapsed to a space and `&`, `<` and `>` escaped, so one warning cannot break the list.
  7. The list says "Worst first: ..." under it when there is more than one warning.
  8. The playbook's way to find the hybrids that count against the figure is a committed maintainer script
     (`scripts/unmatched_hybrids.py`, tested on the fixture register), not a block of code in the playbook. It calls the
     pipeline's own functions, so it can break when they change; the test is what says so. After the review of #72 it no longer
     writes its own filter or its own high-confidence rule: the dataset's row set and the conditions come from
     `metrics.hybrid_conditions` and `metrics.hybrid_base`, which `hybrid_coverage` also uses (no figure changes: the golden test
     passes), and the script exits with a message when its list differs from the figure's denominator less its numerator. A window
     with nothing to divide prints that and exits 0; an unreadable store, a folder that is not a pull and a pull with no pages are
     a message and a non-zero exit. It reproduced D-110's figures on
     the saved 2026-10 pull and the committed store (14,241 of 19,233 and 14,271 of 19,286).
  9. `BuildWarnings` shares `PresetTriage.tsx` to keep the public build's scripts as they were, at the price of a file that
     holds two components.
- Not done: a build that aborts writes none of its warnings anywhere (its aborts are the failure, and the manifest is staged, not
  published); a run that builds nothing does not show the source's own warnings (a discovery fallback, a column gained; some are
  printed on standard error as they arise); no public page says that a month's split has just changed (D-110's "left for the site").
  Next steps the review of #72 suggested, not done: a run that aborts on a guardrail writes its reason to the summary page (today
  the reason is in the log and the red run only); the source-discovery fallback warning as a group of its own in
  `run_summary.warning_order`, so it is not buried among the rest. The escaping covers `<`, `>` and `&` only: other Markdown
  characters in a warning can change its formatting but cannot inject HTML, and no warning carries a make or model name today (a
  future one that does should be checked).
- Consequences: a green Monthly build whose split flipped shows it on its summary page, first in the list. `config/pipeline.json` gains
  `run_summary`. `manifest.warnings`, the golden contract and the workflow are unchanged. `/status` gains a section. The playbook
  names where the warnings are and what to do about a flip.
- Status: decided by Claude (unreviewed)

## D-113 2026-11-17 — True registrations on the wider scope: a second dataset, a passenger-or-commercial dimension, seven brand rows, and what was checked
- Agent: claude (a sub-agent, to the lead's brief)
- Basis: D-106 (the owner decided that the default scope stays and a total of new vehicles on the trade's basis is offered
  beside it; every choice of how is the author's), D-105 (the measured agreement of counts), D-104 (the engine right
  before anything is public, checked against published sources), D-087, D-092, D-095, D-097, D-108 and D-110; the committed
  dashboard counts and the saved 2026-10 pull; public pages read on 2026-11-17, named below.
- Context: `vehicle_scope.csv` already marked, in `trade_scope`, the five types the trade's total counts, and the committed
  store already keeps a model for them. Nothing counted them. This piece builds the pipeline half; the site's half (charts,
  Build's choice of what is counted, wording on pages) is another piece.
- Decision, by item:
  1. **A second dataset, `registrations_flow_wider`.** Same source, same code, same import-status rule as
     `registrations_flow`; only the vehicle types differ (`trade_scope` in place of `in_scope`). New and used alike; a count of
     new vehicles is a condition on `import_status`, which is the site's work. Words (config): label "New registrations, wider
     scope", public label "True registrations, wider scope", and a definition that says it "counts the same vehicles as true
     registrations and also buses, motor caravans and special purpose vehicles". It names no organisation and claims nothing
     about anyone's definition. The mechanism is data: `scope.vehicle.also` in `config/pipeline.json` lists each wider scope as
     a flag of `rows` and the column it reads, and a dataset's `require` names exactly one scope flag, which now decides the
     rows of its `dims` table and its hybrid coverage (both read the default scope only before). A `require` naming none or two
     aborts the build.
  2. **Passenger or commercial, `trade_group`.** A new column of `vehicle_scope.csv` (own commit) and a lookup dimension, as
     D-095 did NZTA's vehicle type. `scope_group` could not serve: it holds ten per-type groups (bus, goods, motorhome, machinery
     ...), not two. Values `Passenger` (passenger cars and vans) and `Commercial` (every other type of the wider scope); a type
     outside it has none and never reaches the dataset. The dimension applies to the new dataset only.
  3. **Dimensions, slices, pairs, fact table.** Flow's dimensions wherever the field exists for the added types, plus
     `trade_group`: eleven live, eight not (four need fields the dashboard lacks, four apply to other datasets), as for flow. No
     pairs, as flow has none. The fact table is carried: the dataset's payload is 527,573 bytes with it (slices 140,695 and the
     table 386,878, 136,452 rows) and 140,695 without; the whole cube goes from 3,753,258 to 4,281,132 bytes (+14.1%) against an
     8,000,000 byte budget. Build can only ask a dataset that has a fact table.
  4. **Coverage of the lookups on the added types** (tables in `docs/METRICS.md`). Powertrain: no motive power of the added types
     lacks a row. Hybrids: 33 vehicles all time (1 in the trailing window), 1 without a row (a Hino 500); the dataset's trailing
     high-confidence coverage under D-110's count is 14,271 of 19,286 (74.0%), the default scope's to the vehicle but one
     hybrid, so its split is published, with the same 1,101-vehicle margin. Brands: the added types' vehicles with no brand
     match were 1,078 of 16,767 new vehicles all time (6.43%) and 309 of 2,982 in the trailing window (10.36%), against 0.11% and
     0.13% for the default scope. Seven rows were added (CRRC, YUTONG, ZHONGTONG, LIEBHERR, ALEXANDER DENNIS, ELDDIS, MARCOPOLO),
     bringing those to 371 (2.21%) and 76 (2.55%); the wider dataset's trailing guard rate went from 0.26% to 0.16%
     (0.5% warns, 2% aborts). Nothing else about the added types derives to no match or not recorded at a rate unlike the
     default scope's. **Rule used for which makes:** 10 or more vehicles of the added types all time or 4 or more in the trailing
     window, and a public source that settles the parent group and the owner's country. Four met the volume and stay unmatched
     (BCI 27, GROVE 14, TEREX 13, YANGTSE MOTOR GROUP 12); FACTORY BUILT (306) is not a brand.
  5. **The existing datasets.** `registrations_flow` and `registrations_cars_long_run`: every slice, pair and fact file is
     byte-identical to a build of `origin/main` (tested by building with and without the dataset in the fixture, and by the
     dry run). `registrations_surviving` differs where the seven rows move **two vehicles**: one first registered in 2017-12 from
     no reference match to ELDDIS (Thor Industries, United States, United Kingdom), one in 2013-02 to ALEXANDER DENNIS (NFI
     Group, Canada, United Kingdom). Its make, manufacturer group, owner's country and original country slices change in those
     two months and in no other cell; its fact table's rows reorder, and the guard's unmapped makes fall from 33,016 to 33,014 of
     4,634,954. No guard of an existing dataset reads another dataset's rows (`dims` is rebuilt for each dataset from its own
     scope flag); a test holds the manifest entries equal with and without the new dataset. The manifests of the existing
     datasets gain one line each: `trade_group` "does not apply to this dataset" in `not_live`.
  6. **Guards and state.** The store checks (months, rows, totals, no gap, no month replaced silently, 2% month change), the
     emptied-month check, the unmapped guards (on the dataset's own rows), the split's rule and its flip record, and the model cap
     with its tie rule all apply, through the same code. The committed state has never seen the dataset: the first build that
     has it is accepted (tested, by a state with every trace of it removed), and the next compares (tested: a month total that
     moved, an emptied month, a flipped split, a dataset that vanishes). `last_good.json` was not touched. New: the build refuses a
     store whose ledger trimmed the model of a (type, status) pair that any dataset reading it counts, not only the dataset the
     trim names (a second dataset could count what the first never did and its model dimension would read "not recorded").
  7. **Checked against what is published.** The wider dataset's new vehicles by month, read from its built fact table, equal the
     "plus three types" column of D-105's table in all eleven periods to the vehicle (March 2021 15,301 ... October 2026 15,109;
     2021 163,796; 2024 128,392; 2025 137,604), and October 2026 is Passenger 11,824 and Commercial 3,285, as D-105 found. A test
     sums the committed store over the types and statuses the dataset counts, from the Parquet file with the scope files read
     in Python, and compares every month with the built dataset's, so it cannot drift from its source silently.
- Sources read for item 4 (public pages, read 2026-11-17; nothing about this project was sent to any site; read by sub-agents and
  by the author for two, then recorded in each row's `notes`):
  - CRRC: Wikipedia (CRRC: the parent is CRRC Group, state-owned; Zhuzhou CRRC Times Electric), crrcgc.cc/en. The pages do not
    say which subsidiary builds the buses sold under the name; the row rests on the make being the group's own name.
  - YUTONG: Wikipedia (Yutong), en.yutong.com. No shareholder above it is named; taken as its own group.
  - ZHONGTONG: Wikipedia (Zhongtong Bus; Shandong Heavy Industry), zhongtongbuses.com. The ownership statement is the August 2018
    acquisition; the maker's site names no owner.
  - LIEBHERR: Wikipedia and liebherr.com (shareholders, history). The Swiss seat rests on Wikipedia.
  - ALEXANDER DENNIS: Wikipedia (Alexander Dennis; NFI Group), alexander-dennis.com. NFI's own site refused the reader.
  - ELDDIS: Wikipedia (Elddis, Hymer, Thor Industries) and thorindustries.com (lists elddis among Erwin Hymer Group's brands).
    No one page states the whole chain; the Elddis article is flagged out of date and does not mention Thor.
  - MARCOPOLO: Wikipedia (en, pt). No controlling shareholder named; its own site refused the reader.
  - Not settled, so left unmatched: BCI (no owner named), GROVE (founding place), TEREX (founding place), YANGTSE MOTOR GROUP
    (no owner named). The reports were the sub-agents' claims: the author re-read the Thor page and the Liebherr article.
- Options considered:
  - *The shape.* (a) A second dataset. (b) A flag on `registrations_flow` that widens its scope. (c) Slices only, on the existing
    dataset. Chosen (a). A dataset has its own manifest entry, guards, fact table and state, so every check that protects a
    dataset protects this one, and each count is the definition of one thing (D-106: the default stays and a total is offered
    beside it). (b) would make one dataset's meaning depend on a switch, change every figure of the default when set, and mix
    the two in one set of guards; (c) could not hold a vehicle type the default dataset does not count without changing it.
    Cost of (a): a dataset that counts the default's vehicles again, so the two must never be added (METRICS says so), and 14.1%
    more payload.
  - *The name.* `registrations_flow_wider` (id) and "True registrations, wider scope" (public). Rejected: anything with "MIA",
    "trade" or "industry" in the public words (a claim about someone's definition), and "total" (it is not a count of new vehicles
    alone). The id and a column say "trade" in config only, where D-106 already put it.
  - *The group.* (a) A new column `trade_group`. (b) Roll `scope_group` up. (c) A dimension with a literal group map in config.
    Chosen (a): a reference file, one column, one commit; (b) cannot be honest (ten values); (c) puts domain values in config
    outside the reference files.
  - *The fact table.* Carried (item 3), because the cost is 3.7% of the payload for the slices and 10.3% for the table, and
    without it Build could not ask the dataset at all.
  - *Where `trade_group` applies.* This dataset only. Offering it on `registrations_flow` would add files to a dataset the brief
    leaves as it was; for flow it would hold two values already told apart by `vehicle_type`.
  - *Which makes.* (a) Only the added types' makes by the rule in item 4. (b) Also the whole wider dataset's largest unmatched
    makes (CAN-AM 246, YAMAHA 214, SINOTRUK 195, PONTIAC 106, PLYMOUTH 99 ...). Chosen (a): (b) is the default scope's coverage, which
    passes its guard and would move more cells of the existing datasets.
- Choices a reviewer could want reversed:
  1. The dataset id and the public wording (item 1); `Passenger` and `Commercial` as the two values.
  2. `trade_group` on this dataset only (item 2); the effect is that the existing datasets cannot be asked passenger or commercial.
  3. The brand rule's thresholds (10 all time or 4 trailing) and the choice to restrict it to the added types.
  4. YUTONG, MARCOPOLO and CRRC are matched with no shareholder above them named (each its own group), ZHONGTONG on a 2018
     statement, ELDDIS through a chain no one page states. A row can be deleted to restore "no reference match".
  5. The two vehicles of `registrations_surviving` that move are accepted, not avoided.
  6. The new refusal for a store trimmed narrower than a second dataset counts (item 6).
  7. The new `not_live` line in the manifest of every other dataset.
  8. LIEBHERR's owner country is Switzerland (the group's seat) and heritage Germany; ALEXANDER DENNIS's heritage is the United
     Kingdom; MARCOPOLO's region is "Other".
- Consequences: the golden contract gains the dataset's `not_built` entry and its warning (the fixture has no store). A mild
  split flip is announced for the new dataset as for the others. The site piece needs: the dataset id and wording above, the
  dimension `trade_group` (live there only), the condition `import_status` = the new-vehicle label to make "new vehicles on the
  wider scope", and the guard that the two true-registrations datasets are never on one chart.
- Status: decided by Claude (unreviewed)

## D-114 2026-11-17 — The sixth shape: `matrix` has a renderer, and Build gets a second breakdown
- Agent: claude
- Basis: D-083 (the user's approval of the shape); the work order §5.F ("a second breakdown, drawn as the `matrix` shape"); the brief §6; D-100 (the rule table: its `crossed` rule and what its review said must change when the shape has a renderer); D-098 (the preset that crosses two fields over time, which stays lines); D-107, D-109 and D-111 (ties, zero months, the precision floor on a window, reserved values, the page's own values, the file of figures); the owner's direction that the engine "needs to be flawless" (D-104). Code: `src/lib/{matrix,sentences,builder,resolve,shapes,data,figures,config}.ts`, `src/components/{MatrixChart,PresetPanel,QuestionBuilder}.tsx`, `src/styles/site.css`; config: `config/presets.json`, `config/narrative/rules.json`; tests `tests/site/{matrix,matrix-build,matrix-colour}.test.ts`; docs: `docs/METRICS.md` ("A grid of two fields"), `docs/playbooks/change-preset.md`, CLAUDE.md and AGENTS.md (one sentence each).
- Context: the shape was approved and the rule table already returned it for two fields crossed in one window, but nothing drew it, so the site never offered it. Build had one breakdown. A question such as brand by segment, or powertrain by whether a vehicle came new or used, fitted none of the five shapes.
- The design, by the eleven points of the brief, with what was weighed:
  1. **What a cell holds and what is shaded.** Options: (a) a count only; (b) a share of the whole grid only; (c) a share of the row or of the column only; (d) the visitor chooses among vehicles, a share of all, of the row, of the column. Chosen (d), as four buttons ("Each cell shows"), because the three shares answer different questions ("which segment does each brand sell most in" is a row share; "which brand leads each segment" a column share) and a grid that offered one would silently answer the other. The default is the least misleadable: **vehicles** where the question counts vehicles, and **a share of all** where it asks for a share, because a share of all is the site's one rule for a denominator (everything counted under the conditions in the window, `docs/METRICS.md`) and a count has no base. A row share and a column share extend that rule on purpose (a row's value acts as a condition on the denominator), which METRICS says, as the page and the file do in a sentence. An Explore preset may open on a row or column share (`cell_basis`): the two added do, on a column share, because that is their question. No average: no measure of that kind exists today, and none was invented. Options for the totals: shares of the whole in the last row and column (a marginal share), or counts. Chosen counts always, headed "All" where the cells are vehicles and "Vehicles" where they are shares: the file's columns then hold one unit each except one row, which the file says, and every share's base is on the page. The marginal shares (the overall mix, to read a row against) are not shown; adding them is a row and a column.
  2. **Which values appear on each side.** The visitor's picks (up to the side's lines), or the values with the most vehicles in the window, 10 rows and 8 columns (`defaults.matrix`), ordered by count with ties alphabetical (D-107, `ranking.ts`); every other value in one line, **All other**, so the totals are the conditions' totals and nothing is left out (the other option, saying the rest is left out, leaves a total that is not the conditions' total). A tie at the cut shows the alphabetically first and a sentence says how many more are level. "Not recorded" and "no reference match" are real vehicles: each is a line of its own after the named values and takes no place; "beyond the cap" (a cap's remainder) is never a line, always in All other, and All other says so. An ordered band (age, engine size) is shown whole in its own order and never cut or ranked, because a gap in an ordered scale reads as a finding. Row and column totals are the conditions' totals and are shown.
  3. **The window.** The rule table's: one month or the last 12 months (the time row offers "Last 12 months" and "Latest month", and a month choice, as a ranking does); no span of years. `isWindowShape` (`src/lib/shapes.ts`) reads "a shape every rule lists only for one period" from the table, so the time row's windows are the table's and not a list in code. A crossing over time stays lines: D-098's preset still resolves to `trend`, live (a test holds it). Build offers no lines over time for a crossing: that is a line per combination, which a visitor would have to choose combinations for, so it is left to presets and said under "Not offered yet".
  4. **Small cells and guards.** A count has no floor (as everywhere). A share is read against the share measure's floor on **its own base**: the grid for a share of all, the row for a row share, the column for a column share, as D-109 reads a ranking's window. A share under it is greyed, not hidden (drawn on a flat grey with its figure, left out of the scale), with a sentence and the file's reason. A share whose base has no vehicles has no value: a dash, a blank in the file with its reason, never 0%. A cell with no vehicles in a base that has some is zero. A cell that "cannot exist" is a structural zero, which the data cannot tell from a real one; so Build does not offer the crossings where it would be nothing but (below, point 8), rather than drawing a grid of them and calling each zero a finding.
  5. **Colour.** A sequential scale of six steps from the design tokens (`--scale-1` to `--scale-6`, with `--scale-ink-N` printed on each, and `--thin-wash` for greyed cells), from paper toward the accent and then deeper. The ink flips from dark to light between steps 4 and 5, skipping the mid-tones where neither ink reaches 4.5 to 1. A step is a fraction of the largest figure among the shaded cells, whatever the basis: **one shade means one figure everywhere in the grid**. Options: shade each row (or column) to its own largest, for a row or column share: rejected, because the same shade would mean 30% in one row and 90% in another. All other and the totals are not shaded, so a total that adds many values does not set the scale; a zero, a greyed or valueless share is not shaded either. The legend gives each step's range in the cell's own unit. Every cell prints its figure, so colour is never alone. Contrast, from the tokens, of the figure printed against its step: 13.63, 10.83, 8.13, 5.25, 5.89, 9.24 to 1 (steps 1 to 6; the lowest is 5.25, step 4), 6.58 to 1 for a greyed cell's ink (`--ink-2`) on `--thin-wash`, and 4.8 to 1 for a dash on paper. A test reads the tokens from the stylesheet and holds each to 4.5 to 1.
  6. **Small screens.** Options: (a) fewer columns by default on a narrow screen, the rest in All other; (b) a scrollable table with a first column that stays, and a stated hint; (c) transposing so the longer list runs down. Chosen (b). (a) would make what the page says (the largest combination, what All other holds) depend on the screen, against invariant 8's "the same view on the same snapshot gives the same sentence". (c) changes the question's own order. The grid scrolls inside its own labelled, focusable region; its first column is sticky; a line says "The grid scrolls sideways" only while it does; the page itself does not scroll sideways at 320, 390 or 1280 px (measured).
  7. **The answer first.** One sentence: the combination of two named values with the most vehicles in the window ("The largest combination is brand X and powertrain Y: 5,059 vehicles first registered in Oct 2026 that are still registered"), in the dataset's own words for what it counts; where several are level, they are listed. It is the same fact whatever the cells show, because the largest *share* is a thin row's 100% (one hydrogen vehicle). Reserved values and All other take no place. The notes under it say what a cell holds (the share's base), how each side was chosen, what All other holds, what is greyed; each is a template in config (`matrix_*`), lint-clean (no value, figure or year, nothing about why).
  8. **Build's second breakdown.** "Show the share of vehicles by powertrain **and by** [no second breakdown | vehicle type | ...]". It is offered for a field when the dataset's fact table carries both, the measure is not derived, and the pair is not nested; a field cannot be crossed with itself. Options for the nested pairs: leave them (a model by its brand is a diagonal of one), or stop them (the brief says the workbench "stops a field being crossed with its own parent"). Stopped, from `builder.cannot_cross`: make and each of manufacturer group, brand-owner's country and brand's original country; manufacturer group and owner country; model and each of make, manufacturer group, owner country and original country; vehicle class and vehicle type. Each was checked on the 2026-10 fact tables of both datasets: each value of the first appeared under exactly one value of the second, except that two models of the survivors and one of true registrations appear under two brands (a near-diagonal, so the pairs with model are stopped all the same); the data map's `rolls_up_to` gives only make to group and country and model to make, so the rest are measured, said so in the config's comment, and a hand-kept list, not derived. A field used as a condition and also chosen as a breakdown becomes the values chosen for that side, as it does for the first breakdown. Picks are per side (`build.value`, `build.value2`, up to a side's lines); with none, the grid shows the largest in the window, so the page's own values of D-111 do not arise: nothing is filled in and nothing is in the address. Address: `build.by2`, `build.value2` (repeated); an address without them reads as before, and one that names a second breakdown the question cannot have is corrected and said. "Swap rows and columns" and "Remove the second breakdown" are buttons; remove returns focus to the choice. A share-and-number question is one grid, since a cell can hold either. The views the rule table gives a crossing in one window: `matrix`, which is the one shape, so there is nothing to switch.
  9. **The rule table and the facts.** `questionFacts` reports `crossed_with` from a preset's `dimension2` (Build's second breakdown, and an Explore grid's) as it did from `cross`. `matrix` is in `RENDERED_SHAPES`, which a test now holds equal to the panel's own `shape === ` branches (the two places that "has a renderer" lived). The ratio preset that crosses vehicle type with new or used (D-098) is **still blocked at the two windows**, and no longer for "no renderer": the grid draws counts and shares of vehicles in two fields of one dataset, and that is a ratio of two datasets, which it does not draw, so the resolver says so (`canDraw`), and the time row does not offer those windows (`rankingPeriods`). D-100's review had expected `matrix blocked` to become `matrix live` for it at two unreachable periods; drawing it live would have meant a verdict of live for a view the panel cannot draw. Fixture delta (`UPDATE_SHAPE_DEFAULTS=1`): **no existing entry changed, 176 were added** (160 for the 80 Build questions with a second breakdown, each breakdown crossed with the next field the measure offers that can be crossed with it, on both datasets; 16 for the two Explore grids), and the two `matrix blocked` entries are as they were.
  10. **The table of figures and the CSV.** The grid is its own table, with the last row and column; the file is that table cell for cell, a wide grid being rows by columns as on the page. `Figures` gained `notes`, lines written above the table after the period: what a cell holds, how each side was chosen, what All other holds, what is greyed, and that the last row and column are vehicles. A greyed share is written with its reason, a share with no value is blank with its reason.
  11. **Explore presets.** Two, as data: "How does the mix of powertrains differ from one kind of vehicle to the next?" (vehicles still registered, powertrain by vehicle type, last 12 months, each cell a share of its column) and the same for new and used true registrations ("... between new and used registrations", powertrain by whether new or used). Both are honest on today's data and short lists (no cut, no All other, no hidden row). Not added: brand's original country by powertrain (the brief's other example); two were enough to show both datasets. Placed in "Market structure" and "True registrations", deferred like the others.
- **Renderer, and a departure from the stack line.** CLAUDE.md says "Observable Plot for all six shapes". The grid is an HTML table drawn from the tokens, not a Plot figure. Plot's `cell` and `text` marks make one SVG image, which a screen reader reads as a picture with a label and no row or column headers; the figures would then have to be said twice (the picture and a table below it), the first column could not stay put when the grid scrolls on a phone, and the text would not reflow with the reader's type size. A table has headers, keyboard scrolling in a labelled region, copy and paste, and is the table of figures itself. If the stack line must hold, `src/lib/matrix.ts` (the model and the table) is unchanged and the view is a Plot `cell` mark over it, with the table in the disclosure the other renderers use. The renderer is loaded only when a grid is drawn (`React.lazy`).
- Measured (headless Chrome, a build of the 2026-10 cube; scratch folder, nothing from this computer in the repository):
  - **Every figure against the data.** Six crossings, each at all four cell choices: on the survivors, powertrain by vehicle type (small), brand by vehicle type (a long list: ten rows, All other of 84 brands, and "No reference match" as a line), model by powertrain with a condition (used imports; 302 models, so the cut and the rest), brand by powertrain in one earlier month (July 2026); on true registrations, brand by powertrain (a long list) and manufacturer group by powertrain in one month with three groups and three powertrains picked on each side. Every cell, row total, column total and share was recomputed from the fact table's column files with DuckDB, independently of the site's code (its own ranking, cut, rest and shares), and compared with the rendered table and with the downloaded file: **4,892 cells compared (the rendered table's and the file's), 0 differences**. Not exercised against the data: "not recorded" as a line of its own (the six windows have no vehicle with it; the unit tests do), a share of a row with no vehicles, and an ordered band on a side (shown on screen only).
  - Headless at 320, 390 and 1280 px: Build with a second breakdown added, swapped and removed (focus lands on the swap button, then on the choice), three grids (a small one; a wide one, 23 age bands by 8 brands and All other; one with greyed rows, a month of brand by powertrain as a share of its row) and a grid with a value picked that has one vehicle (a greyed 100%) and the two Explore grids: no console error, no sideways scroll of the page, axe (WCAG 2.1 A and AA, best practice) clean on the Explore page and on a Build grid except `heading-order`, which the page on `origin/main` has too (D-109).
  - **Nothing else moved.** The Explore page and nine Build questions (a count and a share by brand, a share by powertrain, a count of all vehicles, a share and number of three brands with a condition, a map, a distribution, a ranking of two chosen values on true registrations, the share of the five largest) were rendered on a public build of `origin/main` and on this branch's, and the text, table rows, tables and mark counts of every chart panel compared: 25 panels identical, the only difference the two new Explore panels. The Build page's own differences are the new choice "and by" in the sentence and one added line under "Not offered yet".
  - **What the browser downloads, on the phone profile** (`scripts/measure-first-load.mjs`, 3 runs, a public build, gzip as the stand-in for the host): Explore, code 258,056 to 262,398 bytes (+4,342), 12 requests before and after, first answer 4,561 ms [4,456 to 4,690] to 4,632 ms [4,542 to 4,952]; the Build question of three brands and two conditions, code 262,689 to 267,830 bytes (+5,141), 16 requests before and after, first answer 6,815 ms [6,749 to 6,856] to 6,838 ms [6,740 to 6,887]. The growth is the words (about fifty templates in `config/presets.json`, which every page's script carries) and the logic in the resolver, the builder and the data reader. The grid itself is a script of its own, 11,851 bytes raw and 4,520 gzipped, fetched only when a grid is drawn (on Explore, when a grid's panel comes near the screen; on Build, with a second breakdown). A first version of Build's page imported one constant from the grid's module and fetched it too (one more request); it is moved. The public build reports 7 scripts, where `main` has 6.
  - **A fault found on the way.** Vite writes a lazy import with backquotes around the path. The public build's removal of scripts no page reaches (`astro.config.mjs`) and `scripts/check-public-build.mjs` both looked only for double quotes, so the grid's script was deleted from the public output while the check passed, and the two Explore grids' panels disappeared. Both now read backquotes and single quotes too. A script that cannot be fetched (offline, or replaced by a deploy) now shows "This chart did not load" in the panel, where before the panel would have gone silently.
- Choices a reviewer could want reversed:
  1. The grid is an HTML table, not Plot (the departure above).
  2. The default of a share question is a share of all; a count is vehicles. A row share and a column share are one click away and are in the address.
  3. Totals are counts of vehicles in every mode; no marginal shares.
  4. Shade steps are fractions of the largest cell (2%, 6%, 15%, 35%, 65%, 100%), six steps, one scale for the whole grid, in config.
  5. All other and the totals are not shaded and do not set the scale.
  6. 10 rows and 8 columns by default; picks up to those numbers.
  7. A narrow screen scrolls the grid, with the same content as a wide one; no transposing.
  8. "Not recorded" and "no reference match" are lines of their own; "beyond the cap" is only in All other.
  9. The answer is the largest combination by vehicles, whatever the cells show.
  10. Build stops nine nested pairs of fields (a hand-kept list in config, measured), and offers no lines over time for a crossing.
  11. The ratio preset that crosses two fields over time stays blocked at the two windows, with a reason, rather than becoming "live".
  12. A share that rounds to 0.0% but is not zero is printed 0.0% and shaded in the lowest step, so it is told from a true zero (unshaded) by its shade; the file writes the rounded figure.
  13. Two Explore grids, both opening on a share of the column.
  14. The words are some fifty templates in config (`matrix_*`, `build_second_*`, one notice `by2`, one line under "Not offered yet"); "All other" is a constant in code, as the mix chart's is, and "Greyed: " is a literal, as the ranking's is.
- Tests: the site's 225 pass (191 on `main`, 34 new: 19 of the grid's computation and table, 12 of Build's second breakdown, 2 of the colours, one that holds `RENDERED_SHAPES` equal to the panel's branches); `test_site_config.py`, `test_data_map.py` and `test_invariants.py`, 628 pass; `tsc --noEmit` clean; `astro build`, the public build and `check-public-build.mjs` (exit 0, 7 scripts).
- Not done: the nested-pair list is not derived from the data map; a grid's marginal shares; a grid over time; a grid of region or vehicle age (the fact table does not carry them); a median or a mean in a cell (no such measure); a related-fields note from the data map beside a crossing; saved questions; the query service is not asked for a grid (it reads the table, as for any crossed view). `docs/DATA_MAP.md` and the brief still say the shape has no renderer or that Plot draws all of them: not edited here.
- Follow-up, 2026-11-17, after the review of #75 (claude). The text above is left as written; where it no longer describes the code, this says what does.
  1. **The answer (point 7, choice 9).** It was the largest combination among the lines shown, which the cut could make false (a pair of 25 named as the largest while a row of 99 sat in All other; the largest of the picked values named when a larger pair had been left out). It is now worked out over every named pair in the window, and where the visitor picked values on a side it is the largest among those and the sentence says so (`matrix_leader_picked`, `matrix_leaders_picked`, as D-111 did for a ranking among picks). Its row and column are always shown: a value the cut would have put in All other is shown as well, out of its place, and a sentence says so. Options for that last step: leave the answer pointing at something the grid does not show (rejected: a statement the reader cannot find reads as a mistake); show only the first of several level leaders (chosen: if every one were shown, a grid of ones would grow without limit). Tests are the reviewer's two examples.
  2. **One printed figure (point 10, choice 12).** The page printed `toFixed(1)`, the file `Math.round(x * 10) / 10` and the shade `Math.round(x * 1000)`, which differ at an exact half-tenth (3 of 2,000 printed 0.1% and was written 0.2; 23 of 80 printed 28.7% and was stepped as 28.8%). The file and the step are now read from the printed figure; a test sweeps fractions of eight bases (and the two named cases) and compares the file with the page. Choice 12 is reversed: a share that is more than nothing and prints as 0.0% is printed **<0.1%** and written `<0.1`, with a note on the page and in the file, and a true zero stays 0.0% and 0. Options: "0" against "0.0%" (the file could not tell them apart), "0%" against "<0.1%" (a zero in a column of one-decimal shares reads as an error). It is still shaded in the lowest step.
  3. **Greyed (point 4).** "Drawn on a flat grey" was told from the lightest step by colour alone (1.03 to 1). A greyed share is now slanted and on a hatched grey, and the legend says "Grey, hatched and slanted". The type reaches 4.5 to 1 over the hatch lines (tested, with the dash on paper, 4.8 to 1).
  4. **Ordered bands (point 2).** A picked band kept the order of size; it now keeps its own. "Shown whole" was not true of a band with no vehicles in the window, which was dropped: every band the data has under the conditions, in any month, is now a line, zeros included, and a band the data never has is not. Build's hint for such a field says every value is shown.
  5. **`builder.cannot_cross` (point 8).** The text above says "vehicle class and vehicle type". In Build's words that is `segment_group` and `segment`, which are **not** nested (4 of 6 segments have more than one class), and the entry was `["segment_group", "vehicle_type"]`, which are (vehicle_type is NZTA's "registered as", a condition and never a breakdown). The entry could never fire and is removed; the list is eight pairs, and the comment says what was measured. The other eight are as described.
  6. **The public build's check (the fault found on the way).** `scripts/check-public-build.mjs` used the same pattern as the pruning in `astro.config.mjs`, so a form of lazy import both missed was missed by both. It now also reads every file name of the form `Name.Hash.js` anywhere in a script the pages reach, in any quotes or none, and fails naming any the output does not hold. Shown on a scratch copy of the public output with the grid's script deleted: main's check exits 0 ("every script is reached"), the new check exits 1 naming `MatrixChart.<hash>.js`, and the new guard alone, run with main's reach pattern, exits 1; on the real output it exits 0 (7 scripts).
  7. Smaller: a sentence that cannot be filled is dropped (invariant 8); the legend shows only the steps a cell uses; a failed fetch of the grid's script says reload and any other error says the chart could not be drawn; `build.value2` without `build.by2` is said, and the notice for a second breakdown a question cannot have (which the page computed but did not show) is shown; the remaining visitor-facing words (the second breakdown's label, the grid's region label and eyebrow, the legend's range, the two load texts) are config, and the mix chart's "All other" and the grid's are one constant. The pin test in `shapes.test.ts` now asserts what can fail: a shape of any period at every period, a window shape at the windows it is offered. Twelve tests were added (237 now).
- Second follow-up, 2026-11-17, after the review agreed to merge and left five small items (claude). Nothing above is edited.
  1. **The public build's guard (follow-up point 6).** Its pattern for a chunk's name read only the part after the last dot, so a file whose name holds dots (Astro names a page's script `Page.astro_astro_type_script_index_0_lang.<hash>.js`) was reported missing while present, and read ordinary text (`"astro.config.js"`, `"vite.config.js"`) as a missing file. It now reads a whole file name, starting after a quote, a slash or `./`, with the hash exactly eight characters of the base64url alphabet (every `.js` in the real output has eight; read from it, not assumed). It still reads no syntax, so it still catches what the prune step's pattern cannot. Proved on a scratch copy of the public output: a dotted name that exists passes, a script holding `"astro.config.js"` and `"vite.config.js"` passes, and the grid's script deleted while a reached script names it in a plain string fails by name. `tests/site/public-build-check.test.ts` (new, five tests) runs the script on small folders made in a temporary directory; three of the five fail on the old pattern. The scripts had no test before; this one fits `node --test`, so it is run with the site's. `AGENTS.md` now says 7 scripts (the grid's script is the seventh).
  2. **A level leader named but not shown (follow-up point 1).** With several pairs level at the top, only the first had its row and column kept on the grid, while the sentence named all of them and METRICS said the answer could always be found there. Options: (a) keep the row and column of every level leader up to a small limit, and say when more are level than are shown; (b) keep the behaviour and make the sentence say that some of the pairs it names are in All other. Chosen (b): (a) needs a limit that is a number someone must choose, still needs (b)'s sentence for the pairs past it, and grows the grid for a tie. (b) is true whatever the tie: each leader now carries `inRest` (its row or its column is not a line of its own, read from the lines of the grid as drawn), and when any does, two config templates (`matrix_leaders_rest_one`, `matrix_leaders_rest`) add "One of these is counted in All other, not in a cell of its own." or the count of them. A single leader is always on the grid (it is the one kept), so its sentence is unchanged. A test makes a tie whose second pair's row the limit cuts (it is in All other; the sentence says one) and one with none cut (no addition). METRICS says exactly this.
  3. **The answer beside a reserved line (design point 7, choice 9).** The rule is right: "Not recorded" and "No reference match" take no place, so they are never the largest combination. The words were not: "The largest combination is ..." can sit above a grid whose reserved line holds more. The four templates (`matrix_leader`, `matrix_leaders`, `matrix_leader_picked`, `matrix_leaders_picked`) now say "of two named values". Options: add a second sentence naming the larger reserved line (rejected: it is a figure about a line the answer is not about, and invariant 8 prefers the one fact), or change the words so the sentence is true as written (chosen). Still no domain value, figure, year or cause in a template; `test_site_config.py` passes.
  4. **"With no gap" (design point 2, first follow-up point 4).** The sentence said the scale had no gap, but a band the data never has under the conditions was not a line, so a band in the middle of the scale could be skipped (the first follow-up chose to leave out a band the data never has). Options: (a) drop "with no gap" and say what is shown; (b) show every band from the first to the last that occurs, with a line of zeros for one between with none. The full ordered list is in config (`bands` of the dimension, already what the side's order is read from, no guess), so (b) is available and chosen: it is what a reader of an ordered scale expects, and a skipped band reads as a finding. Bands before the first or after the last the data has are still not lines (a zero line at either end says nothing and a wide field would be mostly zeros). `chooseSide` takes the slice of the order between the first and last place that occurs; the sentences (`matrix_rows_ordered`, `matrix_columns_ordered`) now say "from the first to the last the data has ... with no value left out in between", and Build's hint for such a field says the same. The test that had a band in the middle left out (the first follow-up's) now has it as a line of zeros, and a new case holds that the ends are cut, one band alone is one line, and a value the order does not know follows. METRICS says exactly this.
  5. Smaller: a blank line between the pin test and the next test in `shapes.test.ts`; the redundant `"Q,,,0,"` assertion in `matrix.test.ts` was already gone (only `"Q,,,"` is checked). The site's tests were 244 after the second pass (237 on `main`: 5 for the public-build check, 1 for level leaders, 1 for the answer beside a reserved line; the ordered-band test was rewritten, not added) and are 250 after the third (points 6 to 9: 1, 3, 1, 1). The shape-defaults fixture did not move.
  6. **A false sentence about a side (third pass, after the reviewer's tests of the above; on `main` since the first follow-up).** `MatrixChart` counted a side's value lines for "Columns: the N values with the most vehicles", which counts the line kept out of its rank for the largest combination: with columns of 119, 30, 30 and 20 cut at two and the leader in the last, the page said 3 while the third had fewer than the one cut, and the next sentence said it was shown out of its place. The count now lives in the model (`Side.shown` in `matrix.ts`, so a test needs no rendering) and leaves the kept line out; the component reads it. Test: that case, the count 2, the kept value, and both sentences from the real templates.
  7. **The public build's check, again (third pass).** (a) A hash of another length was ignored, so a change of the build tool's hash would have switched the guard off without a word; (b) a quoted string whose middle part is eight characters (`"lodash.debounce.js"`, `"/vendor/chart.registry.js"`) was read as a missing file. Read from the real output, a script names another in exactly two forms: `"./Name.<hash>.js"` (an import; the lazy one in backquotes) and `"_astro/Name.<hash>.js"` in Vite's dependency map (the page's HTML uses `/_astro/...`, which the first pattern already reads). The guard now matches only a name that follows a quote and then `./`, `_astro/` or `/_astro/`; and it fails, naming the file, for any `.js` in the output's script folder that is not `Name.<8 base64url characters>.js`. Options for (a): raise the hash length to "any" (rejected: it brings back (b)'s false failures) or fail on the shape (chosen). Scratch proof on the real public output: the two strings pass (exit 0, 7 scripts); an added `late.AbCdEfGhIj.js` fails by name; the grid's script deleted fails by name. Three tests added to `public-build-check.test.ts` (8 in all); two of the three fail on the previous script.
  8. **"Not recorded" bands set the end of an ordered scale (third pass; follows from point 4).** The order config gives a field ends with its flagged values (`unknown` on three bands, and `none` and `unknown` on engine size), so the first-to-last padding ran to the end of the order whenever one such vehicle was present. How the repo knows which are which: a band definition in `config/dimensions.json` that carries a flag (`unknown`, `no_engine`) has no `min` and no `max`; every real band has at least one. Options: read the flags by name (rejected: `no_engine` is a domain word, and a new flag would need code), or read "has no range" (chosen: generic, no value or flag named in code; a test holds that in config every such band ends its list and every list has a ranged band). `bandScale` (`matrix.ts`) returns the order and the unplaced values; `chooseSide` takes the first and last place only among the others, and the unplaced follow in their order (when they have vehicles). Test: an order ending in two such values, with and without the marker.
  9. **One and many (third pass).** "All other holds 1 further ... values" and "1 not shown have as many vehicles" were wrong for a count of one. `matrix_rest_further` and the two tie templates now have one-value forms (`matrix_rest_further_one`, `matrix_rows_tie_one`, `matrix_columns_tie_one`), chosen in `matrixSentences` by the count, as the thin-row templates already are. Test: both forms of each. Not changed, noticed: "the {shown} {field} values ..." in the side sentences also reads "the 1 ... values" when one value stands on a side; left for the lead to decide (a one-value side is a degenerate grid).
- Status: decided by Claude (unreviewed)

## D-115 2026-11-17 — Rows of the mild hybrid file raised to high confidence only where a maker's or its New Zealand distributor's own page states the system, and what was looked at and left
- Agent: claude (a sub-agent, to the lead's brief)
- Basis: D-104 (the engine must be right, checked against published sources), D-108, D-110 and D-112; `data/reference/mild_hybrid_models.csv`,
  `docs/METRICS.md` and `docs/MODEL_AND_AGE.md` §1; the saved 2026-10 pull and the committed dashboard store, read with
  `scripts/unmatched_hybrids.py` and a scratch script that calls the pipeline's own functions and writes nothing in the repository;
  public pages read on 2026-11-17, named below (nothing about this project was sent to any site). Corrected in place after the review of #74
  (the record is new in that pull request).
- Context: the split is published while at least 70% of a dataset's trailing hybrids are identified at high confidence. On 2026-10 true
  registrations stood at 14,271 of 19,286 (74.00%) with room for 1,101 more unidentified hybrids, and the register at 14,241 of
  19,233 (74.04%). The owner's direction is that coverage is never raised by guessing, so a row goes to high only when a primary source
  (a maker's or its New Zealand distributor's own page, release or specification sheet, or a government source) states the system for the
  nameplate as sold in the market the row matches; a trade-press report alone, or a dealership's stock listing, stays at medium.
- Options considered:
  - *Raise every large row.* Rejected: the count of vehicles is not evidence.
  - *Raise the Honda IMA rows (Fit 358, Freed 136, CR-Z 66, Insight 52, Spike 21, Shuttle 9 in the window) to high.* Rejected: Honda's
    own release for the Fit Hybrid names the 1.3 litre i-VTEC with IMA and does not say mild or full, and a 2010 MONOist report (read
    through a summary of a garbled copy of the page) says the Fit Hybrid enters EV driving at low speeds, which the file's own wording
    for IMA (an assist motor that cannot drive the car) does not cover. The rows stay at medium; the Fit rows' notes now say so.
  - *Split Honda Fit year 2013 and Honda Shuttle year 2015 on engine size.* Not possible in the file: no match column reads engine
    capacity, and the dashboard store (true registrations) has no such field. See "left" below.
  - *Classify Subaru's e-Boxer.* Rejected: see "left".
- Decision, changed (true registrations, the window Nov 2025 to Oct 2026, then all time; the register in brackets):
  1. **Chery Tiggo 4 Pro, New Zealand new only**, 663 (662) in the window, 807 (805) all time: full at medium to full at high. Chery New
     Zealand's launch release says "the new series-parallel hybrid has a 1.5-litre petrol engine"
     (https://chery.co.nz/news/chery-unveils-tiggo-4-hybrid-efficient-performance-meets-everyday-value); Autotrader NZ's report of the
     launch gives a 71 kW petrol engine, a 150 kW electric motor and a 1.83 kWh battery and does not mention plugging in
     (https://autotrader.co.nz/news/tiggo-4-range-expands-with-a-pair-of-hybrids). The maker does not write "full hybrid"; the call rests
     on a series-parallel layout being one whose motor drives the wheels, which is the file's line for full. That the release's Tiggo 4
     Hybrid is the car recorded as TIGGO 4 PRO is **inferred from the data, not shown by a source**: TIGGO 4 PRO is the only Tiggo 4
     spelling in either dataset, and its PETROL HYBRID vehicles begin in 2025-08, about when Chery NZ's hybrid spec sheet was published
     (its file path is dated 2025-07). The row now has `match_import_status` NZ New, because both sources are New Zealand-market. The one
     used import (vehicle year 2026, registered 2026-10, on both datasets) therefore matches no row and counts as unknown (it counted as
     full at high before this correction).
  2. **Nissan X-Trail, PETROL HYBRID, used imports, vehicle years 2015 to 2021**, 366 (364) in the window, 2,346 (2,321) all time: full
     at medium to full at high. Nissan's global newsroom release of 6 April 2015 describes the Japanese X-Trail Hybrid as Nissan's
     "one-motor two-clutch parallel hybrid system", in which the motor drives the wheels, one clutch separates it from the engine and EV
     mode driving is available at high speeds (https://global.nissannews.com/en/releases/150407-01-e). Nissan's release of 20 July 2022
     for the next-generation X-Trail says the Japan model becomes "a dedicated e-POWER model" with sales from 25 July 2022
     (https://global.nissannews.com/en/releases/nissan-launches-the-all-new-x-trail-in-japan); the 2015 generation's hybrid was therefore
     first registered in Japan no later than 2022, and the next generation's cars carry 2022 and later. The high row stops at 2021
     because the register's engine sizes show 2022 holding both generations (checked on the saved pull; the first version of this record
     capped at 2022). Used-import PETROL HYBRID X-Trails on the register by vehicle year and engine size: every year from 2015 to
     2021 is about 1990 to 1999 cc (2020: 97 at 1997 cc, 1 at 1990; 2021: 29 at 1997 cc, 2 at 1990) apart from three strays (2015: one
     at 1905 and one at 1977; 2017: one at 9197, a typing error); **2022 has 4 at 1997 cc (the 2015 hybrid's 2.0 litre) and 2 at 1497 cc
     (the next generation's 1.5 litre)**, and the 2024 vehicle is also 1497 cc. The store has no engine size and no match column reads
     one, so the year cannot be split. The other two PETROL HYBRID X-Trail rows, both Used Import: vehicle year 2014 or earlier stays
     full at medium (2 vehicles each, none in the window); vehicle year **2022 or later is unresolved at low** (7 vehicles all time
     on the register and 7 on true registrations; 5 in the window on each: 4 of vehicle year 2022 and the 2024 one; one recorded code
     is not evidence, and the next generation's cars among them are not the car the 2015 release describes). A New Zealand-new or re-registered X-Trail recorded as PETROL HYBRID
     now matches no row: none exists on true registrations; the register has 9 re-registered ones, none in the window, which
     `scripts/unmatched_hybrids.py` would list if one entered it. What the figure counts: of the register's 2,339 X-Trail petrol hybrids
     all time, 2,330 are used imports; 2,321 of those are in the high row, 2 in the medium row and 7 in the unresolved row (an earlier
     version of this record said 2,337 of 2,339 are at high; that counted every status and had no upper year). True registrations: all
     2,355 are used imports, 2,346 / 2 / 7.
  3. **Foton Tunland**, 56 (56) in the window and all time: mild at medium to mild at high. Foton New Zealand's Tunland page
     (https://www.foton.co.nz/trucks/tunland) names the powertrain "Aucan Diesel 48V Mild Hybrid".
  4. **Notes only, no classification changed:** Honda Fit (the IMA row and the year 2013 row), KGM Torres, Tank, BAIC X55 and the
     Subaru row have a better-evidenced note.
- Decision, kept at medium after review: **BAIC B30**, 397 (396) in the window and all time (the model has been on sale since 2025-12):
  unresolved at low to full at **medium**. The page that says "a full hybrid system" is one Armstrong's dealership's stock listing for
  one vehicle (https://www.armstrongs.co.nz/our-vehicles/make-baic/model-b30/dealership-armstrongs-baic-christchurch/new-vehicle/3866304):
  it will go when the car sells, it does not say Armstrong's is the distributor, and the same group's Auckland listing says only "hybrid".
  That Armstrong's is BAIC's New Zealand distributor is from Armstrong's own buyer's guide of 25 August 2026
  (https://www.armstrongs.co.nz/?p=26056), which calls the car a "self-charging hybrid" and a petrol-electric system, without saying full.
  No BAIC New Zealand or distributor model page, release or specification sheet stating the type was found
  (https://autotrader.co.nz/showroom/baic/baic-set-for-nz-launch-announces-first-two-models is Autotrader NZ's report of the
  announcement and says "hybrid assistance"). The row is no longer unresolved because a New Zealand distributor listing, two reviews
  (Driven Car Guide: the petrol engine mainly a generator) and the guide agree on a self-charging hybrid that drives on its motor at low
  speed; it counts against the high-confidence figure until a durable page names the type.
- Decision, looked at and left:
  - **Subaru XV, Impreza, Forester, Crosstrek** (739, 166, 484, 73): unresolved at low, unchanged. Subaru Europe's page on the e-BOXER
    (https://subaru.eu/subarumagazine/edition-2/e-boxer) says it is "a hybrid system that uses electric power from a compact battery
    and motor to assist the engine", that the car is powered by the electric motor when starting from a standstill or moving slowly, and
    that it "can reach up to 40km/h in electric mode" depending on the car and the battery; it uses neither "mild" nor "full". Search
    results described press coverage calling it a mild hybrid (not read). It fits neither of the file's lines cleanly: the motor can
    move the car, which the file's wording for mild says it cannot, and the engine is the main source of drive, which a full hybrid is
    not. The decision for the owner is a definition, not more evidence: if the file's mild line is "no electric-only driving", e-Boxer
    is full, and the Honda Fit IMA may be too; if it is "the motor is not the main source of drive", e-Boxer is mild, and so are the
    IMA cars. Either way it moves about 1,462 vehicles (Subaru) in the window on true registrations.
  - **Honda Fit year 2013** (536 on true registrations, 532 on the register), **Shuttle year 2015** (144, 142), **Freed year 2016** (14, 14):
    the generations overlap inside the year and the year field is a year from the car's life overseas (`MODEL_AND_AGE.md` §1), so the
    guard bands stay. On the register, engine capacity would settle it: of the 532 Fit 2013 vehicles, 286 are 1.4 to 1.6 litres (the
    i-DCD engine) and 246 are under 1.4 litres (the IMA engine); all 142 Shuttle 2015 vehicles are 1.4 to 1.6 litres. But no match column
    reads engine capacity and true registrations has no such field, so the larger dataset could not use it, and a column is a code
    change, which this brief did not allow. Side finding on the register: the Fit `full` row from vehicle year 2014 holds 24 vehicles
    under 1.4 litres in the window (2 more in 2015), and the year 2012 `mild` row holds 36 of 1.4 to 1.6 litres; few, and not changed.
  - **Honda IMA rows** (Fit 358, Freed 136, CR-Z 66, Insight 52, Spike 21, Shuttle 9, Civic 1, Jazz 1): medium, unchanged, as above.
  - **Suzuki Swift (Used Import), Solio, Bandit, Delica** (235, 64, 2, 20): unresolved, unchanged. Trade-press search results give the
    Japanese Swift's mild hybrid (ZC53S) and full hybrid (ZC43S, added July 2017) as sold together from 2017, so no year bound separates
    them; Solio and Delica have the same overlap. I read no Suzuki page for the split.
  - **KGM Torres** (62): full at medium, unchanged. KGM New Zealand's page (https://www.kgm.co.nz/torres-hybrid) gives a 1.5 litre turbo
    engine and dual motors delivering 150 kW through an e-DHT, with no type named. That KGM says the car runs EV-only is from Auto
    Trader NZ's report.
  - **Tank** (41): full at medium, unchanged, and two New Zealand sources disagree. Driven Car Guide's launch report calls the Tank 300
    hybrid "a full hybrid" able to drive on electric power alone for short distances, with a 78 kW motor; GWM's New Zealand dealer Ingham,
    in its plug-in launch release, calls the non-plug-in range "mild hybrid" (https://www.inghamdriven.nz/gwm/news/59/1372/). The review
    asked for the row to move to unresolved at low, as the Subaru row does. **That change was made and not kept**: the golden contract's
    fixture holds one GWM Tank hybrid row, so the move changes the golden manifest (`test_cube_matches_golden` fails), and a golden
    change is a deliberate act of its own commit (`UPDATE_GOLDEN`), which this brief did not allow. For the lead: the move is one row of
    the file plus a golden update. It moves no count against the high-confidence figure (full at medium and unresolved both count
    against it), and it lowers stated trailing coverage by 41 vehicles in the denominator on true registrations and the register
    (about 0.2 percentage points), because an unresolved row is unknown at stated confidence and a full row leaves the denominator.
  - **BAIC X55** (34): full at medium, unchanged. Armstrong's X55 pages found list only the petrol; Driven Car Guide says BAIC calls the
    powertrain "RE-HEV".
  - **Hyundai Staria Load** (25), **Lexus ES** (19), **GWM H7** (14), **BMW ActiveHybrid and BMW 3 and 5 series** (42), **Audi A6** (20),
    **Skoda Kodiaq** (13), **Mercedes-Benz C 200 and S 400** (22), **Volkswagen Golf** (5): unchanged. No maker or distributor page
    stating the type for the market the rows match was read: Lexus NZ's pages are script-rendered and gave no hybrid text; BMW Group's
    press pages redirect to a landing page; no GWM or Hyundai page beyond D-108's was found; Audi's A6 page
    (https://www.audi.com/en/the-new-audi-a6-avant-business-class-meets-sports-elite-16487/fuel-efficient-and-high-performance-mhev-plus-technology-16495)
    says the 3.0 TFSI has the 48 V mild hybrid and the 2.0 TFSI at launch had none, so it does not settle the 2.0 litre cars the row
    also catches. Skoda, Mercedes-Benz and Volkswagen were not searched.
  - **Nameplates with no row** (76 on true registrations in the window, 75 and the Tiggo used import; Mercedes-Benz E-Class 6, Audi A3 5,
    BMW 120 5, Volvo V60 5, Audi A8 4 and a tail of one to three each): no row added. The E-Class (all new, 2025 and 2026) is probably the
    E 200 with a 48 V system, but the one New Zealand page read said nothing of its powertrain, and the others carry several systems
    under one name.
- Choices a reviewer could want reversed:
  1. The Chery call rests on "series-parallel" meaning a motor that can drive the wheels, which the maker does not write out, and on
     TIGGO 4 PRO being the release's Tiggo 4 Hybrid, which is inferred from the data.
  2. The X-Trail upper year 2021 is from the register's engine sizes for 2022 and the next generation's launch date, not from a
     statement that the old hybrid stopped; true registrations cannot show engine size, so its 2022 cars (the same 6 in the dashboard
     store) are left unresolved with the register's.
  3. The Honda IMA rows stay at medium although most press and the file's own wording call IMA mild.
  4. The B30 is full at medium on a listing and a guide that both stop short of "full hybrid" in the distributor's own durable text.
  5. Tank stays full at medium, against the review's request, because of the golden contract (above).
  6. Notes were added to rows that did not change, so the record of why they stayed is in the file.
- Not done: no code change was made; a match column for engine capacity would settle the Fit 2013 and Shuttle 2015 rows on the register
  only, and is not recommended unless the store gains the field. The Subaru decision is the owner's. The Tank move needs a golden update.
  A dry run of the whole build was not made (the targeted tests and the golden test were).
- Consequences: on the 2026-10 snapshot, trailing coverage at high confidence goes from 14,241 of 19,233 (74.04%) to 14,297 of 18,207
  (78.52%) on the register, from 14,271 of 19,286 (74.00%) to 14,327 of 18,257 (78.47%) on true registrations, and from 14,271 of 19,286 (74.00%, D-113) to 14,327 of 18,257 (78.47%) on the wider dataset
  `registrations_flow_wider`; the room before 70% goes from 1,111 to 2,217, from 1,101 to 2,210, and from 1,101 to 2,210. Stated trailing coverage goes from 83.5% to
  85.4% on the register (85.35%) and from 83.5% to 85.3% on true registrations and the wider dataset (85.31%). All-time at high confidence
  goes from 60.1% to 62.7% (register: 46,115 of 73,554), from 64.5% to 67.6% (true registrations: 46,157 of 68,279) and to 67.6% on the
  wider dataset (46,158 of 68,281); all-time stated coverage is 83.5% on each. Vehicles in the window still counting against the
  figure: 3,910 on the register (2,503 unresolved at low, 636 full at medium, 700 mild at medium, 71 with no row), 3,930 on true
  registrations and on the wider dataset (2,513, 637, 704, 76); they were 4,992 and 5,015. Against the review's figures for the B30 at
  medium alone and the X-Trail high row to 2021 (true registrations and the wider dataset 14,327 of 18,257, 78.47%, room 2,210; register
  14,297 of 18,207, 78.52%, room 2,217; the register's used-import X-Trails 2,321 at high, 2 at medium, 7 unresolved) these are the same. No powertrain line
  moves: the Foton row has no override, and the full calls leave a vehicle under Hybrid. The golden contract is unchanged.
- Status: decided by Claude (unreviewed)

## D-116 2026-11-17 — Three register fields bound on the wide fact table: the assembly flag, NZTA's class code, and seats in bands
- Agent: claude (a sub-agent, to the lead's brief)
- Basis: the work order §5.F (bind fields in the map's order, each with its sentinels and guards: first the ones every vehicle has); D-104 (the engine right before anything is public; every field checked against the data before it is offered); D-096 (the privacy classes: the three fields are public); D-058 and D-062 (the fact table); D-078 (what the table leaves out); D-113 (a dimension that exists for one kind of source only); the saved 2026-10 pull, measured on 2026-11-17 by the pipeline's own code, read-only, and by a dry run of the build.
- Context: `NZ_ASSEMBLED`, `CLASS` and `NUMBER_OF_SEATS` are recorded for every vehicle and were defined in the data map but not bound, so Build could not ask for them. The dashboard export and the Stats NZ table carry none of the three. This is the pipeline half; what the site offers is another branch's work.
- Decision, by item:
  1. **Three dimensions of `registrations_surviving`, each with a slice and a fact-table column.** `nz_assembled` ("Imported or assembled here": a lookup on `NZ_ASSEMBLED` through `nz_assembled_map.csv`), `nzta_class` ("NZTA class code": a lookup on `CLASS` through `class_map.csv`) and `seats_band` ("Seats": the data map's bands of `NUMBER_OF_SEATS`, no reference file). The logical field names are `nz_assembled`, `nzta_class` and `seats`. They are not live for the other three datasets by the rule every register-only dimension already uses (`derive.applicable`: the source does not carry the field), with no `applies_to`. The manifest entries of those datasets gain three `not_live` lines each and none of their 49 files changes. No pipeline code changed.
  2. **Reserved values.** `NZ_ASSEMBLED`: `UNKNOWN` is a sentinel under that field alone, so it reads `__UNDEFINED__`; no NULL occurs. `CLASS`: NULL only, and `sentinels.csv` lists nothing for the field, because `NA` is a class (a test holds it). `NUMBER_OF_SEATS`: `0` is a sentinel under that field alone; a count above 60 is outside the guard; both land in the `unknown` band and the manifest counts them apart (`counts.bands.seats_band`: `source_sentinel` 8,408, `out_of_bands` 207, `source_missing` 0).
  3. **Guards.** `nz_assembled` and `nzta_class` join `make` and `powertrain` in `abort_on_unmapped`: a raw value the reference file does not hold is `__UNMAPPED__`, counted against the whole run (abort above 2%) and the trailing 12 months (warn above 0.5%, abort above 2%), published with its headroom. On the 2026-10 pull both have 0 unmapped of 4,634,954 in-scope rows and of 240,711 in the trailing window (headroom 92,699 and 4,814 rows). A band has no unmapped value, so `seats_band` has no such guard; its guard is the band edge (1 to 60), and the data map's guard for the field moves from "proposed" to "bound". Tests: a new raw value is unmapped; one vehicle fewer than the abort needs builds with a warning and its headroom, and the next one aborts; a code added to the reference file maps with no other change.
  4. **When each can honestly be charted over time.** No new mechanism: the reserved "not recorded" value (or the `unknown` band) plus the dimension's `public_note`, as `built_in` does. `nz_assembled` from December 1995 (9 of 1,388 unknown that month; no month from January 1996 above 1%). `nzta_class` from March 2002 (0.64% blank that month; February 2002 is the last month above 1%; 591 of 4,166,149 blank from March 2002); for NZ-new vehicles alone the last month above 1% is July 2002. `seats_band` up to December 1993 and from December 1995 (more than 1% of a month's vehicles have no seats in the 23 months January 1994 to November 1995). The build does not stop a chart at those months; the reserved value shows the gap, and whether the site cuts a chart there is the site's decision.
  5. **The class labels are the codes.** The Land Transport Rules' table of vehicle classes is on legislation.govt.nz, which answered an automated reader with HTTP 403 on 2026-11-17 (the search page, and the Road User Rule 2004 in two address forms). NZTA's own site blocks automated readers and was not tried (hard rule). The Gazette notice of the proposed Rule (2001-au6674, read 2026-11-17) holds no class table. An industry body's information sheet that reproduces the table was found, but its text could not be read, and it is not a primary source. So `class_map.csv`'s `label` is the code and its `source` column says "none read"; the data map keeps the meanings marked inferred. Filling the labels in later is one column of one file.
  6. **Colour is left for a narrower table.** As a fact-table column `BASIC_COLOUR` is 1,324,975 bytes, +75% of the table, and makes an existing brand-by-powertrain question 40% heavier (the lead's measurements before this piece; not repeated here).
- Options considered:
  - *Where the three go.* (a) The wide fact table (chosen). (b) A second, narrower table for the new fields. (c) Slices only. Chosen (a): together the three add 508,158 bytes to the table (+28.7%) and 86,449 to the slices, 594,607 in all (+13.9%), and the payload is 4,875,739 bytes, 60.9% of the 8,000,000 budget. (b) is the right place for colour (item 6): a question downloads every column it names plus `month` and `n`, and every column added splits the rows every question reads. (c) would leave Build unable to cross the fields with anything. Measured one at a time on the baseline table, rows grow by 1,800 (`nz_assembled`), 26,304 (`nzta_class`) and 87,953 (`seats_band`), and by 113,968 together; the share of rows counting one vehicle goes from 50.2% to 54.8%, holding 9.2% of the vehicles (7.1% before). The 15 columns already there grow by 188,781 bytes together.
  - *Labels for the class codes.* (a) The code itself, the meaning marked inferred (chosen). (b) Labels from memory or from the industry body's summary. Rejected: from memory is forbidden, and a secondary source I could not read is no better. (c) Not binding the field. Rejected: the codes are a real breakdown, and a label is one column to fill in later.
  - *Which class codes the map holds.* (a) Every code on the whole register, 21 (chosen). (b) The 7 on the cube's vehicles. (a) lets a vehicle type brought into scope later (buses, trailers, mopeds) appear without tripping the guard on day one; (b) would abort the build then. The cost of (a) is 14 rows no vehicle of the dataset uses today.
  - *Seats.* (a) Bands only (chosen). (b) Also a sum and a count per cell for an average or median. Left for later: the lead measured it at 942 KB more; I did not re-measure it. The map's `uses` still lists average and median for the field, with its guard, so a later piece needs no map change.
  - *The name of the assembly flag.* "Imported or assembled here", not "where assembled": it is NZTA's flag; 88% (28,721 of 32,564) of the vehicles marked assembled here record Japan as where they were built, so it says nothing about a place.
  - *Where each guard lives.* The unmapped guard is the existing `abort_on_unmapped` list; the seats guard is the bands in `dimensions.json`, which a test holds equal to the data map's guard. A new `valid_*` block in `pipeline.json` was weighed and not added: it would be a second place for the same two numbers.
  - *Fixtures.* The 62 fixture rows gain the three fields' values, so the golden contract holds each dimension's real behaviour (an `NA`, a zero, a 61, a blank), at the cost of rewriting every line of the fixture file in each of the three commits.
- Measured, and where it differs from the brief:
  - Every count in the brief reproduced on the saved pull (4,520,304 vehicles): `NZ_ASSEMBLED` 4,302,878 / 184,862 / 32,564; `CLASS` MA 3,018,620, NA 701,637, MC 414,717, NB 72,774, NC 67,963, MB 8,848, LE 1,702, NULL 234,043; seats bands 201,636 / 364,527 / 3,402,655 / 441,525 / 101,346 / 8,615 unknown (8,408 + 207). The three single-field row counts of the fact table reproduced exactly.
  - The brief's monthly figures for class (54% January 2000, 10.8% December 2000, 2.2% December 2001, 0.6% March 2002) are for all vehicles; NZ-new alone is higher (83.0%, 15.2%, 3.1%, 0.98%).
  - Seats: the zeros are not all in 1994 and 1995. Of 8,408, 8,368 were first registered from January 1994 to December 1995, 34 before 1994 and 6 in 1998 to 2001 (the brief said none from January 1996).
  - Vehicles marked imported built up that record New Zealand as where they were built: 238 (the brief said 210). 616 used imports are marked assembled here, as in the brief. Vehicles marked assembled here, first registered each year from 2016 to 2025: 28 to 103 (all statuses), 17 to 70 NZ-new.
  - Class and vehicle type on the cube: MA, MB, MC and LE under passenger cars and vans, NA, NB and NC under goods vehicles, one MA under a goods vehicle. For goods vehicles NA is at or under 3.5 t for 701,555 of 701,637 (9 above, 73 with no mass), NB between 3.5 and 12 t for 72,772 of 72,774, NC over 12 t for all 67,963.
  - A dry run on 2026-11-17: exit 0 in 705 s, one warning (the Stats NZ store ends at 2026-09), 18 live dimensions on `registrations_surviving`. Files: 83 before, 89 after (six new: three slices, three fact-table columns); 67 byte-identical, including all 49 files of the other three datasets and all 18 existing slices and pairs of this dataset; the 15 existing fact-table columns and the manifest differ.
- Choices a reviewer could want reversed:
  1. The dimension ids, labels and logical field names (item 1), and the label "Imported or assembled here".
  2. `nz_assembled` and `nzta_class` in `abort_on_unmapped`, so a new raw value stops the build at 2% rather than only taking the dimension out (item 3).
  3. Class labels equal to the codes (item 5), and the 21-code map.
  4. Seats guard moved to "bound" in the data map though it sits in the bands (item 3).
  5. The three in the wide table now, colour later (item 6).
  6. No live-from date for any dimension: the gap shows as `__UNDEFINED__` or `unknown` and in the public note (item 4). A mechanism that cut a dimension's chart at a date was weighed and not built, as nothing needs it yet.
  7. The `public_note` wording of each dimension, including that the class note says "NA is a class of light goods vehicle", which rests on this data (701,555 of its 701,637 goods vehicles at or under 3.5 t) and not on a definition.
  8. The fixtures' rewrite (above).
- Consequences: The site, unchanged, offers the three new dimensions only as filters: `src/lib/builder.ts` builds its list of filters from the dimensions in the dataset's `facts` that config defines, and a breakdown needs a phrase for the dimension in `config/presets.json` (`builder.measures[].dimensions`), which this branch does not touch. A later site piece can add those phrases, should refuse to cross `nzta_class` with `vehicle_type` (the class rolls up to the type on this dataset, `config/data_map.json`), and should show `seats_band`'s `unknown` as the gap it is. `docs/DATA_MAP.md` and `config/data_map.json` mark the three bound. The reference files `CLAUDE.md`'s repo layout lists gain two, `data/reference/nz_assembled_map.csv` and `data/reference/class_map.csv` (not edited here). Not done: colour, seats as a mean or median, labels for the class codes, a live-from mechanism.
- Status: decided by Claude (unreviewed)
