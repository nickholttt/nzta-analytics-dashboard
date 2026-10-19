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
- Where docs and code disagree, the page follows the code as it runs, and the disagreement is listed
  in STATE: `docs/EVENTS_LAYER.md` says market-scope events default to "collapsed behind a single
  'show events' toggle, on by default" (self-contradictory; the code hides them until the button is
  pressed), and says to cluster "by year" beyond 8 markers (the code clusters by distance on the axis,
  widening until at most 8 remain).
- Consequences: `/method` now covers every mark a mix chart draws. Changing a reserved label or the
  remainder label in code changes the page with it. `EVENTS_LAYER.md` is not edited here.
- Status: decided by Claude (unreviewed)
