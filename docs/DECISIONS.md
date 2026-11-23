# Decisions

The why behind choices the code alone does not show. Append-only: never edit or delete a record. If
a decision changes, add a new record that supersedes the old one and names it by number.

- **D-001 to D-140** are in [`docs/decisions/archive-001-140.md`](decisions/archive-001-140.md),
  moved there unchanged on 2026-11-20 at the user's word (work order 2, §2 rule 5; D-147). The index
  below lists each by number, date and title. Read the index, and open an archived record only when
  the work touches it: search the archive for `## D-NNN`.
- **Records from D-141 on** follow the index, in the order they were appended.
- D-102, D-103 and D-143 have no record. The numbers were taken by drafts that have not merged:
  D-102 and D-103 by the paused narrative and segment drafts of work order 1's package H, D-143 by
  the board proposal of #105, closed without merging (D-147). They are not reused.

**When to write a record** (work order 2, §2 rule 1): only when an invariant, the data contract, a
published figure or privacy changes, or when the user needs to see the choice. Everything else is
one line in the pull request description.

New records use this template. The basis is a commit, a doc in this repo, the user's word with its
date, or "inferred — confirm"; the full legend heads the archive.

```
## D-NNN YYYY-MM-DD — <decision in one line>
- Agent: claude | gemini | user
- Basis: ...
- Context: ...
- Decision: ...
- Consequences: ...
```

---

## Index of archived decisions, D-001 to D-140

- D-001 2026-09-11 — The starter kit is the specification
- D-002 2026-09-11 — LF line endings everywhere; parquet is binary
- D-003 2026-09-11 — Reference maps keyed on NZTA's actual spellings; no SUV segment
- D-004 2026-09-11 — The snapshot measures survivors, so it is named registrations_surviving
- D-005 2026-09-11 — Age measures scoped to used imports
- D-006 2026-09-11 — Pipeline design: Python + DuckDB, staged, publish only if every guardrail passes
- D-007 2026-09-11 — Monthly GitHub Actions run on the 8th, committing snapshot and state
- D-008 2026-09-11 — Trailing-12-month unmapped guards for make and powertrain
- D-009 2026-09-11 — Brand promotions: recording artefacts in every year, genuine splits from the split year
- D-010 2026-09-12 — Mild hybrids identified by nameplate in their own reference file
- D-011 2026-09-12 — Brand ownership is "as at today", not versioned; as_at records verification
- D-012 2026-09-12 — GitHub Actions moved to Node 24 versions
- D-013 2026-09-12 — Freeze until the unattended-run gate; deferred work lives in POST_GATE.md
- D-014 2026-09-12 — A local reference UI before the gate
- D-015 2026-09-12 — The share measure has two suppression guards
- D-016 2026-09-12 — Every preset carries status and requires; the UI cross-checks them
- D-017 2026-09-12 — Mix-chart defaults are driven by config
- D-018 2026-09-12 — Derived measures render through the existing five shapes via a registry
- D-019 2026-09-12 — POST_GATE Part A ordering
- D-020 2026-09-13 — UI work continues on ui/explore with a hard boundary; canon cut from 26 to 9
- D-021 2026-09-13 — Design system: Source Serif 4 + IBM Plex Sans, 8-colour line palette
- D-022 2026-09-13 — GitHub API access through the gh CLI only
- D-023 2026-09-13 — Shared agent protocol for Claude Code and Gemini
- D-024 2026-09-13 — Reasons for the canon cut in D-020
- D-025 2026-09-13 — UI work on ui/explore handed to Gemini
- D-026 2026-10-19 — Adopt docs/CHECKPOINT.md; keep decisions in this one file
- D-027 2026-10-19 — UI work on ui/explore returns to Claude; agents may push their own branches
- D-028 2026-10-19 — Gemini's extras become one internal /sense-check page; the international benchmark is deleted
- D-029 2026-10-19 — model-leaderboard waits on step 1b again; the league renderer stays
- D-030 2026-10-19 — Caveats 1 and 7 say only what the data shows
- D-031 2026-10-19 — /method restates METRICS.md in plain words, with its thresholds read from config
- D-032 2026-10-19 — Shares on survivors data are skewed by uneven scrappage, and the site says so
- D-033 2026-10-19 — METRICS.md's April 2020 case and threshold figures are re-measured against the cube
- D-034 2026-10-19 — /method explains event markers, "All other" and the labels for values with no name
- D-035 2026-10-19 — A mix chart without top_n draws every group with vehicles in its drawn window
- D-036 2026-10-21 — The concentration note says what a falling top-5 share can mean, not only one cause
- D-037 2026-10-21 — brand-share shows its make-scoped events
- D-038 2026-10-21 — EVENTS_LAYER.md's rendering rules describe the code as it runs
- D-039 2026-10-21 — Event marker labels are laid out in pixels and kept inside the frame
- D-040 2026-10-21 — README describes the repo as it is; CLAUDE.md keeps its plan and says where the repo departs from it
- D-041 2026-10-21 — The Explore page is built for visitors now, local only until the 8 November gate; diagnostics move to /status
- D-042 2026-10-21 — One row of time options per chart, and visitor wording in a public_copy block
- D-043 2026-10-21 — Frozen-path work may be built on branches before the gate, kept off main until it passes
- D-044 2026-10-21 — The Build page: a sentence of what the cube can honestly answer, share only for now
- D-045 2026-10-21 — A 12-month ranking in the time row, wherever the breakdown ranks
- D-046 2026-10-21 — Reserved values keep their own line on a capped mix chart (supersedes the fold)
- D-047 2026-10-22 — Pair slices: one schema, the whole month as denominator, listed per dataset in pipeline.json
- D-048 2026-10-22 — Pull requests run the pipeline tests on the runner the monthly build uses
- D-049 2026-10-22 — A brand renaming is a measurement event, even where the registry hides the step
- D-050 2026-10-22 — Manufacturer group is high cardinality, so a 12-month window ranks it
- D-051 2026-10-22 — The golden build reads frozen events, so adding an event is not a contract change
- D-052 2026-10-22 — "Change this chart" opens an Explore chart on the Build page, and every renderer shares one readout
- D-053 2026-10-22 — The site serves filtered datasets and preset filters from pair slices, built against a dry-run cube
- D-054 2026-10-22 — The map: Stats NZ's coastline-clipped region outlines, refreshed by a script, offered on the Build page only
- D-055 2026-10-22 — Deploying to Cloudflare Pages: how the cube reaches the site (proposed)
- D-056 2026-10-22 — Deploy by D-055's option (C), without the internal pages
- D-057 2026-10-22 — What the independent review of the six pushed branches changed
- D-058 2026-10-22 — Free exploration: one fact table the browser aggregates, and a question builder over it (proposed)
- D-059 2026-10-22 — The user approves D-058's three rule changes
- D-060 2026-10-22 — The question builder: what it asks, and the choices inside it
- D-061 2026-10-22 — What the independent review of the fact table and the question builder changed
- D-062 2026-11-13 — CLAUDE.md for the next stage: the goal, generated narrative, model-level lookups, explicit sub-agent models
- D-063 2026-11-13 — The archive: keep each month's whole snapshot, every field, as one file outside git (proposed)
- D-064 2026-11-13 — The monthly run: try every day, build each month once, fail loudly when a month is missed (proposed)
- D-065 2026-11-13 — True registration totals from Stats NZ's Infoshare series now (drafted for the user to accept)
- D-066 2026-11-13 — The user's answers to Stage 0: October is built, the gate has passed, the freeze is lifted; D-063 to D-065 accepted
- D-067 2026-11-13 — The archive's repository, token and secret: the names the setup steps use
- D-068 2026-11-13 — What claude may do without asking again: merge the pipeline stack and D-064 and D-063 under a reviewer, one forced run, the archive repository; and the user's three answers
- D-069 2026-11-13 — The user's answers after the pipeline stack: the archive token is stored, the backup is off the disk, the fact table may merge under D-068's rule
- D-070 2026-11-13 — D-064 as built: what the daily run decides, and the choices D-064 left open
- D-071 2026-11-13 — D-063 as built: the archive job pulls for itself; the file, its name, and what happens when it fails
- D-072 2026-11-13 — The Cloudflare upload is a job of its own behind the environment `production`, switched on by a variable
- D-073 2026-11-13 — The user's word on the merges: #37, #38 and #39 into `main`, the site stack into `ui/explore`; and the first archive run
- D-074 2026-11-13 — What the screenshots called for: the hand-written figures recomputed for October, plain words on `/caveats`, and the ranking table on a phone
- D-075 2026-11-13 — NZTA's registrations dashboard, read from one hand export: what it is, how it compares, and whether it becomes a source (proposed)
- D-076 2026-11-13 — `VIN11` and `POSTCODE` are kept in the private archive only and neither is published; October gets a second file
- D-077 2026-11-13 — The user's answers on the dashboard, the `ui/explore` merges and the queue; what the reviews changed; and the fact table held for a question
- D-078 2026-11-13 — The user's answers: the fact table leaves out the owner's region until the Stage 2 privacy review; #42 and #36 merge; the dashboard's first step waits for the user; and D-058's "no owner data" is corrected
- D-079 2026-11-13 — `VIN11` checked against the data: no model year for used imports, one for about four in ten NZ-new vehicles; nothing is derived from it
- D-080 2026-11-14 — The user's answers: #45 merges; `ui/explore` into `main` is reviewed and asked for by number; hard rules 7 and 8 are shown before they are reworded; October is forced only after a yes; nothing becomes public without asking
- D-081 2026-11-14 — The user's second answers: #46 merges; hard rules 7 and 8 are reworded as proposed; October is forced only if the daily run reports the source unchanged; no path from the user's computer stays in the docs
- D-082 2026-11-14 — Work order 1: what claude may do without asking, what it never does, and one report at the end
- D-083 2026-11-14 — A sixth shape, `matrix`, is approved
- D-084 2026-11-14 — NZTA's registrations dashboard becomes a source: true registrations from January 2021, from the user's hand exports
- D-085 2026-11-14 — Six sub-agent definitions, each naming its model, and a test on every pull request
- D-086 2026-11-14 — Three public pages (About, feedback and corrections, why figures differ), their words in config, and a corrections log as data
- D-087 2026-11-14 — `registrations_flow` is defined: what it counts, what the history adds, what Vehicle Status means, and that the register's usage is today's
- D-088 2026-11-14 — The pipeline's small follow-ups: clearer aborts, three workflow hardenings, and what is left until it can be tried on the runner
- D-089 2026-11-14 — The site's small follow-ups: visitor wording moves onto the dimensions, a filter narrows event markers only in part, and what is left
- D-090 2026-11-14 — The data map is finished: a new config file beside `dimensions.json`, privacy classes proposed for the user, two roll-ups dropped, and what "moves together" will mean
- D-091 2026-11-14 — The query service: its question format and checks are specified, a local prototype is measured, and one way of hosting it is proposed for the user
- D-092 2026-11-14 — `registrations_flow` is built: a maintainer's `supply` command, a local store, and the dataset run through the register's own code
- D-093 2026-11-15 — True registrations on the site: a group in Explore, a choice of what Build counts, a ranking for any month, and completeness as a chart of its own
- D-094 2026-11-15 — `registrations_cars_long_run` is built: Stats NZ's series as a second kind of supplied source, cars from January 1961
- D-095 2026-11-15 — NZTA's vehicle type becomes a dimension, so completeness can be shown by vehicle type and, for cars, set against Stats NZ's count
- D-096 2026-11-16 — The user's answers to the parked questions: where supplied counts live, the About page, the privacy classes and the owner rule
- D-097 2026-11-16 — The two supplied stores are committed to the repository, so GitHub's builds make `registrations_flow` and `registrations_cars_long_run`
- D-098 2026-11-16 — The long-run cars and completeness by vehicle type are on the site: a group of three charts, one more completeness chart, and a missing dataset said in words
- D-099 2026-11-16 — First load: the page's own code and processor work trimmed, Explore fetches only its first chart on load, the public build drops the internal pages' scripts; the 3 second target is not met and what is left is mostly the data files
- D-100 2026-11-16 — The chart rules: one table in config says which shapes fit a question, and Build and the resolver read it
- D-101 2026-11-16 — Pull requests also run the site's tests, its typecheck and the query service prototype's tests
- D-104 2026-11-16 — The user's direction: the engine comes first and must be right; the public site waits; figures are checked against outside sources
- D-105 2026-11-16 — The site's figures set beside published ones: what was measured, and three statements corrected
- D-106 2026-11-16 — The user's answers of the evening of 16 November: a total on the trade's basis, the code's licence, who runs the site
- D-107 2026-11-16 — The audit's site-side fixes: a rule for ties, what the guards do, and the wording that did not say what the site does
- D-108 2026-11-16 — The audit's pipeline findings: hybrid nameplates the dashboard spells differently, the mild split withheld under its threshold, the model cap's tie rule, a narrower scope refusal, and which unmapped rate is which
- D-109 2026-11-17 — Months in which nothing is counted: one rule for the windowed figures, a ranking's precision floor, reserved values in Build, the load gate, and the hybrid split said
- D-110 2026-11-17 — The four things D-108's review left open: a flip of the mild split is announced, the split is judged on the whole counts, the stricter coverage figure says what it counts, and the tie test tells byte order from a locale's
- D-111 2026-11-17 — The question builder, package F's site side: ranking the values a visitor chose, conditions as removable lines, and the file of figures
- D-112 2026-11-17 — A build's warnings reach someone who is not already looking: the Monthly build's summary page lists them, worst first, and the internal status page shows the manifest's
- D-113 2026-11-17 — True registrations on the wider scope: a second dataset, a passenger-or-commercial dimension, seven brand rows, and what was checked
- D-114 2026-11-17 — The sixth shape: `matrix` has a renderer, and Build gets a second breakdown
- D-115 2026-11-17 — Rows of the mild hybrid file raised to high confidence only where a maker's or its New Zealand distributor's own page states the system, and what was looked at and left
- D-116 2026-11-17 — Three register fields bound on the wide fact table: the assembly flag, NZTA's class code, and seats in bands
- D-117 2026-11-17 — SUV or car, per nameplate: the first slice of `model_segment.csv`, the maker's own categorisation as its rule, and nothing wired
- D-118 2026-11-17 — The wider scope of true registrations on the site: a third thing to count in Build, two charts in Explore, a list that keeps it off other datasets' charts, what `/differences` now says, and a note on hybrids
- D-119 2026-11-17 — Where the line between mild and full hybrid is drawn, and Subaru's hybrids classed under it
- D-120 2026-11-17 — The user's answers of 17 November: trade lists stay a private check, two CLAUDE.md sentences corrected, class labels supplied, the owner table shown first, a supplied month may rebuild the current month, the hybrid line stands
- D-121 2026-11-17 — NZTA's vehicle class labels: the table the owner supplied is checked against the register and put in `class_map.csv`
- D-122 2026-11-17 — The three fields of D-116 as breakdowns of Build: a class is not crossed with the type it rolls up to, a banded field's unknown band is "Not recorded", and a share says it is of all vehicles
- D-123 2026-11-17 — SUV or car, per nameplate: the second slice of `model_segment.csv`, 25 rows raised to `high` on makers' own pages, ten nameplates added, three classes changed, nothing wired
- D-124 2026-11-17 — Hybrids, full or mild, as one figure: the powertrain group as a roll-up dimension of every dataset that has the powertrain, named in plain words, and read beside two published October figures
- D-125 2026-11-17 — "My questions": a saved question is a Build link kept in the browser, and a pin holds a window, never a past snapshot's figures
- D-126 2026-11-17 — The user's three changes opening the eleventh session: the region slice takes the small-cell rule now, a pinned link is to load its snapshot's cube release, and the axles field is checked before it is offered
- D-127 2026-11-17 — The small-cell rule: the `region` slice hides cells under 10 vehicles, a second rule limits what a total gives away of a hidden cell, a month in which no cell would stay visible is not broken down, and the build reads the slice back before it publishes it
- D-128 2026-11-17 — Power in bands and the gearbox in four groups: the two register fields recorded for NZ-new vehicles only, bound on the wide fact table
- D-129 2026-11-17 — What `NUMBER_OF_AXLES` records: a count of axles on heavy vehicles, zero or two on light ones whatever the vehicle, so the field is withdrawn from every use for now
- D-130 2026-11-18 — The site never turns a hidden count into a number: a slice with a hidden cell is refused, and a question over a protected dimension is blocked before it loads
- D-131 2026-11-17 — A pinned link reads its own snapshot's figures where the deploy has kept that snapshot's cube
- D-132 2026-11-18 — Build offers power and the gearbox as breakdowns, and a question by a field recorded only for some vehicles starts narrowed to where it is recorded, says so, and lets the visitor take the condition away
- D-133 2026-11-18 — Two follow-ups to D-130: the reserved-value test must compare, and a ratio's second dataset is checked for the same fields as the first
- D-134 2026-11-18 — The user's answers of 18 November: October is forced and rebuilt, the first owner table is the fleet by usage as it is today, and what the dashboard's usage column records is settled before any table of usage at first registration
- D-135 2026-11-18 — The vehicles registered today: a stock dataset (`fleet`) of the usage the register records now, by vehicle type, built privately; and the rule for a table of two fields with an owner field
- D-136 2026-11-18 — Each build writes how strongly every pair of a dataset's dimensions moves together, and marks the pairs that are not findings
- D-137 2026-11-18 — Four site follow-ups: a link naming a value the data does not hold is told so, a field's note under a chart is one line with a link to the whole of it, the template lint reads My questions' words and those lines, and the pinned line learns the first month the chart loads
- D-138 2026-11-18 — The user's end state for the site: a self-serve analytics canvas, noted for when the UI work starts, with nothing changed now
- D-139 2026-11-18 — The site draws a table written under the small-cell rule, with its hidden cells hidden, and offers the vehicles registered today in Build
- D-140 2026-11-18 — Vehicle use in two forms: "Current use" over today's register, and "Registered as", the use at first registration, from the dashboard if it records it and from the archive from now on, with the changes between them tracked privately

---

## Records since the archive

## D-141 2026-11-18 — The user approves publishing the first owner table: "Current use" over today's register, alone and by vehicle type, with three wording fixes
- Agent: user (the approval), claude (the record)
- Basis: D-096 and D-120 (the first table of an owner field is shown to the user, as figures and screenshots, before any
  pull request that would let a build publish it); D-134 (the table asked for); D-135 and D-139 (the table built and
  drawn, on branches that were not pushed); D-140 (the label "Current use"). On 2026-11-18 the user was shown, in the
  session, the one-field table (eight values, nothing hidden), the two-field table by vehicle type with its four hidden
  cells and what someone with every published total could narrow each to, and screenshots of the ranking and of the grid
  at desktop and phone width. Claude asked: "(a) Yes, both the ranking and the grid by vehicle type, with the three wording
  fixes above. (b) Only the ranking (usage alone, where nothing is hidden). (c) Not yet."
- Decision (user), word for word: "1, a".
- What it covers (Claude's reading, unreviewed): the build may publish `cube/fleet/vehicle_usage.parquet` under the
  one-field small-cell rule and `pairs/fleet/vehicle_usage__vehicle_type.parquet` under the two-field rule, and the site
  may draw them, with three wording fixes made first: the vehicle-type breakdown is not called "type registered as" (the
  words "Registered as" are kept for use at first registration, D-140); the note "Registrations recorded by NZTA. Not the
  same as vehicle sales." is not shown under a table of the register as it stands; and a window is not called "in Oct
  2026" for a table with one period. It covers no other owner field and no other table of this one: usage by month or year
  of first registration, industry class, district and postcode stay unpublished (D-134, D-096). The data map's exception
  for `VEHICLE_USAGE` names D-135 and now this record.
- Figures as approved (re-checked on 2026-11-18 against the staged build of the 2026-10 pull: its manifest, `cube/fleet/*.parquet` and
  `pairs/fleet/*.parquet`): the fleet is 5,926,990 vehicles, in one period, 2026-10. By current use: Private passenger
  4,623,180; Other goods 849,790; Other 161,521; Licensed goods transport 137,507; Rental 77,977; Taxi or commercial
  passenger 40,669; Agricultural 29,957; Emergency 6,389 (eight values, none hidden). In the pair by vehicle type, 48 cells
  hold vehicles and four are hidden: Licensed goods transport and Taxi or commercial passenger, each on Mopeds and on
  Motorcycles, holding 137 vehicles together. One was hidden by the first rule and three by the line rule. The narrowest
  range the totals leave a hidden cell has a spread of 15 (largest less smallest). The pair and both slices carry no fuel
  figure (D-135 item 6).
- Status: accepted (the user's approval); the reading above is decided by Claude (unreviewed)

## D-142 2026-11-18 — Two follow-ups to D-139: a share against a hidden line total says the total is hidden, and a ranking of a dataset of one period shows every value
- Agent: claude (a sub-agent, to the lead's brief)
- Basis: D-130 (a hidden count never reads as zero or as a number); D-139 items 4 and 5 (the ranking and the grid of a dataset of one period); the review of pull request #101; CLAUDE.md invariant 8. Code: `src/lib/matrix.ts` (`gridTable`), `src/lib/league.ts` (`rankingLimit`), `src/components/MatrixChart.tsx`, `src/components/LeagueChart.tsx`; tests: `tests/site/matrix-hidden.test.ts`, `tests/site/league-hidden.test.ts`.
- Context: (1) The pipeline hides every cell on a line whose total is hidden (`pipeline/pair_cells.py` rule 2, enforced by `check_pair`), so no published grid has a shown cell on such a line, and a share there sits on a hidden cell and reads as hidden. If one ever reached the grid, a share against that total would have been withheld with the reason "This row holds no vehicles, so it has no share", on the page for a screen reader and in the downloaded file, reading a hidden total as zero. This is a guard, not a live fault (as D-133 put its own fix). (2) The ranking of a dataset of one period took the starting cut of a ranking over time, 15 values, and dropped the rest with no line to say so. The fleet's fields have 8 and 14 values, so no published table is cut yet; a field of more values would be.
- Decision: (1) A share whose base is a hidden line total is withheld with a new reason, from two phrase templates in `defaults.phrases` (`matrix_no_share_row_hidden`, `matrix_no_share_column_hidden`: "This row's total is hidden, so a share of it cannot be shown."), which name no value and pass the template lint. A published total of nothing keeps the old reason. The hidden legend now also shows for a hidden column total, and the total row carries the hidden mark as the body does. (2) `rankingLimit` gives every value for a dataset of one period, the number chosen for values a visitor picked, and the visitor's cut over time.
- Options considered: (1) mark those shares "hidden" like a hidden count (not chosen: in the case guarded against, the cell's own count would be shown, so it is the share that has no base, and the file's column of reasons says so more exactly); say nothing about why (not chosen: a bare dash would let the old reading come back). (2) Keep the cut and add an "All other" line (not chosen: D-139 item 5 refuses a line that holds hidden and shown counts together, and the ranking has no published total for the rest); keep the cut and say where it ends (not chosen: the control that sets it is not drawn for one period, and every value is a short list).
- Choices a reviewer could want reversed: the mark is `withheld`, not `hidden`; a dataset of one period shows all its values, so a field of many values draws a long chart and table; no sentence says how many line totals are hidden (the legend and the reasons do).
- Consequences: `docs/METRICS.md` states both rules. The pipeline cannot write the grid case, so it was checked on a copy of the built site with one usage total set to hidden and seven extra vehicle types written into the copy, never on the repository's data.
- Status: decided by Claude (unreviewed)

## D-146 2026-11-18 — The deploy finds the newest cube past the first hundred releases, and fails before the upload when the output passes the host's limits
- Agent: claude
- Basis: D-131 (a pinned link reads its own snapshot's cube; its leftovers: "the newest cube step reads one page of releases; the host's limits are unchecked"); D-057 and D-072 (the deploy); CLAUDE.md invariant 5 (fail loudly). Cloudflare Pages' limits page (developers.cloudflare.com/pages/platform/limits/, "Last updated Sep 5, 2026", read 2026-11-18): "Cloudflare Pages sites can contain up to 20,000 files on the Free plan."; "The maximum file size for a single Cloudflare Pages site asset is 25 MiB."; no limit on a deploy's total size is stated. The release `cube-2026-10`, measured 2026-11-18: 99 files, 5,238,163 bytes, the largest 423,284 bytes.
- Context: `deploy.yml`'s step "The newest cube" read one page of a hundred releases, so from the hundred-and-first monthly release on it would build the site from an older cube; the step that keeps earlier snapshots already read every page. Each kept snapshot adds a cube's files to the deploy, and nothing checked the total against what the host serves.
- Decision: (1) "The newest cube" reads every page (`--paginate`) and sorts the tags once all pages are read, as the earlier-snapshots step does. (2) `scripts/host-limits.mjs` holds the two limits, quoted from the page, and `check-public-build.mjs`, which runs after the build and before anything is handed to the upload job, fails naming the count or the file when the output holds more than 20,000 files or a file over 25 MiB. The workflow reruns when the limits file changes.
- Options considered: limits in the workflow's shell (not chosen: the check would run only on GitHub and could not be tested on a small folder); a total-size check (not chosen: the page states none); keeping fewer snapshots now (not chosen: at 99 files a snapshot, the Free plan holds the site and on the order of two hundred kept months, an estimate from one release; nothing needs dropping yet). The paid plans' 100,000 files need a setting and money, which is the user's.
- Consequences: a deploy that would pass the host's limits stops before the upload, with the cause. Tests: `tests/site/host-limits.test.ts` (failed before the module existed), `pipeline/tests/test_workflow.py` (the new test failed on the old workflow).
- Status: decided by Claude (unreviewed)

## D-144 2026-11-18 — Colour is bound, and it sits in a second, narrower fact table of its own, not in the wide one
- Agent: claude
- Basis: D-116 (item 6: as a column of the wide table `BASIC_COLOUR` was 1,324,975 bytes, +75%, and made an existing question 40% heavier, the lead's measurements; option "where the three go" (b): a second, narrower table is the right place for colour); D-058 and D-062 (the fact table); D-078 and D-096 (an owner field is in a slice or a pair only); D-090 (the data map); the saved 2026-10 pull, measured on 2026-11-18 by the pipeline's own code and by a dry run of the build (`docs/CUBE_SCHEMA.md`, *Narrow fact tables* and *Size budget*).
- Context: the lead asked for colour to be bound without making every question heavier, with the design fixed beforehand. What was left to measure was which dimensions the narrow table carries.
- Options considered:
  1. **Which dimensions the narrow table carries**, measured by writing each set with the build's own code on the 2026-10 pull (4,520,304 vehicles; every total checked against the vehicles). Colour alone: 13,111 rows, 34,438 bytes. Colour and make: 195,877 rows, 294,287 bytes. Adding one to colour and make: vehicle type 238,971 rows, 368,985 bytes; powertrain in five groups 224,388 rows, 353,976 bytes; import status 259,377 rows, 395,915 bytes. Also measured: the full powertrain, 278,443 rows, 441,723 bytes (over the limit of about 400 KB); and colour, make, vehicle type and import status together, 309,915 rows, 483,990 bytes (over). Colour with vehicle type, import status and powertrain group and no make: 44,775 rows, 81,109 bytes. Chosen: colour, make and the powertrain in five groups. Why: it adds the least to colour and make (59,689 bytes, against 74,698 for vehicle type and 101,628 for import status), it is the smallest of the three sets and leaves 46,024 bytes under 400 KB, and the powertrain is the field the brief's example questions turn on (the share of battery electric vehicles). Not chosen: import status (colour of new against used), because its set leaves 4,085 bytes of headroom; vehicle type, because it costs more than the powertrain groups for a field that has two values on this dataset (`docs/DATA_MAP.md`). The lead's earlier figure for colour with make was about 276 KB; this run measured 294,287 bytes, and the difference is not explained here.
  2. **A table per field in the wide folder, or a separate dataset.** The narrow tables sit under `facts/{dataset}/narrow/{id}/`, listed in the dataset's `facts` block of the manifest, so the dataset's vehicles, scope, months and slices are the same ones; a separate dataset would have repeated the dataset's definition, its guards and its totals.
  3. **Config shape.** `narrow_facts` on the dataset, a list of `{id, dimensions}`; the table's id is a folder name. The alternative, a flat list of dimension names, cannot hold more than one table.
  4. **The owner refusal covers narrow tables too.** The check that refuses an owner dimension in `facts` (piece one of this work) also reads every `narrow_facts` list, up front, because a narrow table crosses fields all the same.
  5. **Labels.** (a) The register's own words, as NZTA writes them in upper case, with no reference file (chosen): the same as `built_in` and the other raw dimensions, and nothing in the 14 values needs a mapping. (b) A reference file of readable labels: not chosen now; adding one later changes the published values, so it would be a contract change of its own.
  The limit of about 400 KB in item 1 is the lead's brief for this piece, not a measured budget.
- Decision: colour is a raw dimension, `colour` ("Colour as recorded"), a slice of `registrations_surviving` and not a column of the wide table; its narrow table, `colour`, carries `colour`, `make` and `powertrain_group`. NULL reads not recorded; no other form was found among the 14 values and 6 NULLs of the whole 2026-10 pull (5,926,990 rows), so `sentinels.csv` has none and there is no reference file. Narrow tables get the wide table's validation, row and sort rules, total check and manifest entry (`facts.narrow.{id}`). The golden contract changed twice, one change per commit.
- Consequences: the payload on the 2026-10 pull is 5,759,161 bytes (72.0% of the budget), of which the `colour` slice is 87,187 bytes and the narrow table 353,976. The wide table is unchanged. The site does not read the narrow table; a later site piece must read `facts.narrow` and answer a question from the narrow table only when every field it names is in it (a field that is only in the wide table cannot be crossed with colour). `scripts/kept-snapshots.mjs` scans only the top-level files of `facts/{dataset}/`, so a narrow table is not covered by its owner scan; the build's refusal is what holds the rule for it. The query service prototype loads the wide table's columns only. For the lead: `AGENTS.md`'s dry-run row is not updated here (this dry run: exit 0 in 14 min 17 s, 111 staged files, payload 5,759,161 bytes, the same two warnings: the Stats NZ store ends at 2026-09, and the fleet has no earlier total to compare with).
- Status: decided by Claude (unreviewed). The dimension set of the narrow table is the choice most likely to be reversed; it is one line of `config/pipeline.json` and a contract change.

## D-145 2026-11-18 — SUV or car, per nameplate: the third slice of `model_segment.csv`, the review's leftovers from #84, the next nameplates without a row, and the `medium` rows retried
- Agent: claude (a sub-agent, to the lead's brief)
- Basis: D-117 (the file's rule, its confidence levels, its list of what is left); D-123 (how sources rank, the maker's own page first; what refused; "What is left"; the review of #84 and its leftovers); invariant 4; AGENTS.md hard rules 5 and 6. The saved 2026-10 pull of the register and the committed dashboard store, read on 2026-11-18 with `scripts/segment_coverage.py` and with a scratch script that builds both datasets' rows once and writes nothing in the repository. The register's free-text submodel was looked at, never used as a basis. Public pages read on 2026-11-18 through the fetch tool, which answers a question about a page rather than returning it: every fragment quoted in a basis is as that tool returned it, and the Japanese fragments are quoted untranslated. Nothing about this project was sent to any site. Files: `data/reference/model_segment.csv`, `docs/METRICS.md` ("SUV or car, by nameplate").
- Context: D-123 left four points from the review of #84 for the next slice, named the eleven largest nameplates still without a row, and left 61 rows at `medium`. This slice takes those three, in that order, and asks only what D-117 asked: SUV or car.
- Decision, by item:
  1. **The review's leftovers from #84.**
     - *Levorg Layback.* No model and no submodel on the register says LAYBACK. Subaru Japan's lineup page (https://www.subaru.jp/carlineup/, read 2026-11-18) now lists レイバック under "SUV" and レイバック（S:HEV） under "ハッチバック/ワゴン", and レヴォーグ under "ハッチバック/ワゴン". The register holds 11 LEVORG vehicles of vehicle year 2023 or 2024 (the Layback's years), 8 of them first registered in the trailing window, all used imports from Japan, all petrol, ten of 1795 cc and one of 2387 cc; any of them could be a Layback and none can be told apart. The row stays `car` at `high`; its note says so.
     - *Impreza XV.* The register records the 2010 to 2012 Impreza XV as IMPREZA: submodels such as "HATCH XV AUTO" (vehicle years 2010 and 2011) and "XV" are on IMPREZA vehicles, and so are "XV" and "XV HYBRID" up to vehicle year 2020, after the XV became a name of its own (the register's XV has 17,022 vehicles). IMPREZA of vehicle years 2010 to 2012, by year of first registration in New Zealand: 2009 to 2012 NZ-new 656 (1, 248, 225, 182) and used imports 15; 2013 to 2026 used imports 7,406; 8,077 in all, 407 in the trailing window. Looking at the submodel only: 1,407 of the register's 36,750 IMPREZA vehicles, and 166 of the 2,741 in the trailing window, have a submodel holding "XV"; many submodels are blank, so this is a floor, and no figure in the file rests on it. The XVs under IMPREZA span vehicle years 2010 to 2020, so no year bound separates them, and the match columns read no submodel. After the review of #109 the row goes from `car` `high` to `car` `medium` (the lead's call): the file classes the XV `suv`, so the name covers both kinds and no match column separates them, which the rule would make `unresolved`, as for the Corolla; `car` at `medium` was taken as the simpler option, and no minority threshold is added to the rule. Its note says so.
     - *Toyota's catalogue pages.* Re-read on 2026-11-18, they hold class words for more generations than the notes said. Alphard and Vellfire: "ミニバン" in every section from May 2008, not only from 2015. Estima: "ミニバン" in the sections of 1997 to 1999 and of 2006 to 2019. Noah, Voxy and Esquire: the Voxy page's sections run from 2005 and the Noah page's from 2008, each calling the car a minivan except two Voxy sections that name no kind. Sienta: "ミニバン" from 2003, not only from 2017. Vitz: "5ドアハッチバック" in the second generation (2005 to 2010), "コンパクトカー" alone in the third. The notes and bases say so. No class changes. The Prius and Corolla notes were checked and hold.
     - *Range Rover.* Land Rover Japan's large SUV page says in its own text "居住性、快適性、多用途性について語られることが多い、ラージサイズSUV。" and "現代の多様なライフスタイルにお応えする、レンジローバー、ディフェンダー、ディスカバリー。" (re-read 2026-11-18): it does call the Range Rover's group SUVs. The note is corrected; the row stays `suv` at `high`.
     - *"Compact car".* The rule's bodies are hatchbacks, sedans, wagons, coupes, convertibles and people movers. Toyota's catalogue calls the Aqua "コンパクトクラスのハイブリッドカー" in every section from 2011 to 2026 and names no body; the Vitz's third generation (every one of the 605 trailing VITZ vehicles is of vehicle year 2011 or later) is "コンパクトカー" only; the Yaris's Japanese page says "新世代コンパクトカー" and names no body. A word that names no body does not place a nameplate, so neither page is a `high` source for these vehicles. `TOYOTA,AQUA|VITZ` goes from `car` `high` to `car` `medium`, its body now from Wikipedia's "Toyota Aqua" and "Toyota Vitz" articles (read 2026-11-18; both hatchbacks), and the maker's page still does not call either an SUV. `TOYOTA,YARIS` goes from `car` `high` to `car` `medium`: Toyota New Zealand's hatchback page covers its NZ-new vehicles, 39.9% of the register's trailing vehicles, under the 80% line. After the review of #109 the same reading lowers `MAZDA,MAZDA3|MAZDA2` from `car` `high` to `car` `medium`: Mazda Japan's range page gives the MAZDA3 FASTBACK "コンパクト・スポーツ" and the MAZDA2 "コンパクト", which name no body; only the MAZDA3 SEDAN's "セダン" does, and no match column separates the sedan from the hatchback, so no sedan row is split off; Mazda New Zealand's hatchback placement covers the NZ-new 59.6% (889 of 1,491) of the register's trailing vehicles, under the 80% line. `docs/METRICS.md` states the reading in the rule.
     - *"Sports car".* After the review of #109: `TOYOTA,86` rests on Toyota's catalogue's "スポーツカー", and `SUBARU,BRZ` on Subaru New Zealand's "Car" and Subaru Japan's "スポーツ/セダン" heading. "Sports car" is read as naming the coupe and convertible bodies the file will group as sports cars (D-117's planned class). It differs from "compact car" because a sports car is never an SUV body, while a compact car can be either. Both rows keep `high`; `docs/METRICS.md` states the reading in the rule.
  2. **The next nameplates without a row** (D-123 "What is left" 2), re-measured first on 2026-11-18 (trailing, flow / register): Toyota bZ4X Touring 173 / 173, Denza B5 172 / 172, Cupra Terramar 169 / 169, Toyota Auris 169 / 169, Geely EX2 168 / 168, Omoda O9 168 / 168, Denza B8 166 / 165, Jeep Wrangler 165 / 165, Forthing Taikon 163 / 163, Toyota Porte 161 / 160, Suzuki E VITARA 106 / 106; every one the same as D-123's flow count. Ten rows, eleven entries:
     - `high` on the maker's or distributor's own page: Toyota bZ4X Touring `suv` (Toyota New Zealand's release of 8 January 2026, "an electric SUV designed for exploration"); Suzuki E VITARA `suv` (Suzuki New Zealand's SUV page); Omoda O9 `suv` (Omoda & Jaecoo New Zealand, "Omoda 9 SHS", "Super Hybrid SUV"; the page's listing image is named "O9-Listing"); Cupra Terramar `suv` (CUPRA's New Zealand site, "Sporty Medium SUV", operated by Espana Motors Limited by its footer); Geely EX2 `car` (Geely New Zealand, "Electric Hatch"); Toyota Auris `car` (Toyota's catalogue, "5ドアハッチバックモデル"); Toyota Porte `car` (Toyota's catalogue, "ハイトワゴン", a tall wagon, as the Spade was in D-123). Each is 100% covered by the page's market in the register's trailing window: the first five are all NZ-new, the two Toyota used imports all from Japan.
     - `medium`: Denza B5 and B8 `suv` (one row; the New Zealand motoring press, "super-hybrid SUVs"; a Denza dealer's pages say "4X4" and not SUV; no Denza New Zealand site was found); Forthing Taikon `suv` (the New Zealand motoring press, "a mid-size SUV"; Forthing New Zealand's site returned HTTP 500 and its model pages HTTP 404); Jeep Wrangler `suv` (Jeep New Zealand's page is titled "4x4 SUV" and covers the NZ-new 28.5% of the register's trailing vehicles; Jeep Japan's page, for the 67.9% from Japan, calls it an off-roader, "オフローダー", without saying SUV).
     - The Suzuki VITARA row's open question is answered: every trailing VITARA in both datasets is petrol (184 in the dashboard, 183 on the register) and every E VITARA electric, so the VITARA vehicles are the earlier Vitara, not the e VITARA. The row stays `suv` at `medium`, on Wikipedia for the earlier car.
  3. **The `medium` rows, retried only where the site had not refused before** (D-123's refusing sites, HTTP 403, were not retried, with one slip named under "Sources that could not be read"). Raised to `high` (2 rows): Volkswagen Golf `car` (Volkswagen Japan's Golf page, titled "Golf | ハッチバック | フォルクスワーゲン公式", covers the 51.7% from Japan, which with the New Zealand hatchback page's 43.4% is 95.1% of the register's trailing vehicles); Leapmotor C10 and B10 `suv` (Leapmotor New Zealand's model pages, "Electric Family SUV" and "Electric SUV" in their titles and "a spacious and welcoming SUV" in the C10's text; all NZ-new). Their basis now a page read, still `medium`, a press page: Dongfeng Box and Vigo, GAC Aion V (the press page was a search listing in D-123). Tried and not raised, each note saying so: Toyota's catalogue for the C-HR, Land Cruiser and Avensis (a model-selection form with no sections); BMW New Zealand and MINI New Zealand (timed out again, the third time for each); Audi Japan, not tried in D-123 (HTTP 403 now); Mazda Japan's CX-3 page (HTTP 404); Nissan Japan's X-Trail page (no text). Not tried this time: Honda Japan's non-SUV models, Suzuki Japan, Mazda Japan's former names and the Nissan Japan pages other than the X-Trail's, whose pages gave no class or no text in D-123; Lexus Japan has no CT page (D-123).
  4. **One `unresolved` row found on a page read for item 2**: Geely Starray EM-i and EX5, `unresolved` `low` to `suv` `high`. Geely New Zealand's models page (https://www.geely.nz/models, read 2026-11-18 for the EX2) gives the EX5 "SUV · All-electric" and the Starray EM-i "SUV · Super Hybrid (plug-in)"; both are all NZ-new (986 of 986 trailing vehicles on the register). D-117 had read no Geely page that names a class. It is its own commit so it can be undone alone; it is outside the brief's three items.
- Options considered:
  1. **"Compact car".** (a) Not a body, so not a placement (chosen): the rule names six bodies and the review of #84 asked for the confidence to be weighed against them. (b) Take "car means not an SUV" to let any word for a car place a nameplate as `car`, which keeps the three rows `high`: rejected, because it widens the rule by reading, and a maker's "compact car" says nothing about whether the car is an SUV.
  2. **Impreza holding XVs** (at least 6% of the trailing IMPREZA vehicles, 166 of 2,741, carry XV in a free-text field). (a) Keep `car` `high` and say what the register holds: the first version of this record, reversed after the review of #109, since the rule makes a name covering both kinds that the match columns cannot separate `unresolved` and does not exempt a minority. (b) `car` at `medium`, the reason in the note (chosen, the lead's call, as the simpler option). (c) `unresolved` for the whole name, as the rule reads, or for vehicle years 2010 to 2020, where the XVs fall (2,591 of the 2,741 trailing IMPREZA vehicles): not chosen. (d) A match on submodel: rejected, the submodel is free text and is never aggregated. (e) A minority threshold in the rule: not added.
  3. **Levorg Layback.** (a) Keep `car` `high` (chosen): no vehicle on the register is shown to be a Layback. (b) `unresolved` from vehicle year 2023 (11 vehicles, 8 trailing): rejected for want of any vehicle shown to be one; it is a one-row change if the lead prefers the guard.
  4. **Jeep Wrangler.** (a) `suv` `medium` (chosen): the New Zealand page calls it an SUV, the Japanese page an off-roader, which is not one of the car bodies, so the pages do not disagree on SUV against car; the New Zealand page covers 28.5%. (b) `unresolved`: rejected, since no maker's page places it among cars.
  5. **The Denza dealer's "4X4"** against the press's "SUV": `suv` at `medium` (chosen), on the press page; "4X4" names a drive, not a body, and the dealer is not the distributor.
- Measured (2026-11-18; the 2026-10 snapshot; the saved pull of the register and the committed dashboard store; passenger vehicles; trailing is November 2025 to October 2026; `scripts/segment_coverage.py` before the first commit and after the last, and a scratch computation from both datasets' built rows after each commit, which agrees with the script to the vehicle):
  - Rows: 124 for 181 entries (179 pairs) before; 134 for 192 entries (190 pairs) after. Rows by class and confidence before: `suv` 30 high, 28 medium; `car` 17 high, 33 medium; `unresolved` 16 low. After: `suv` 36 high, 30 medium; `car` 17 high, 36 medium; `unresolved` 15 low.
  - Vehicles with a row, trailing: `registrations_flow` 182,710 (90.86%) before, 184,490 of 201,088 (91.75%) after; `registrations_surviving` 182,212 (90.93%) before, 183,990 of 200,387 (91.82%) after. Classified (`suv` or `car`): flow 84.59% to 85.97%, register 82.29% to 83.67%. All time with a row: flow 83.61% to 84.12%, register 62.00% to 62.58%. At `high`, by trailing vehicles: flow 40.82% to 34.29%, register 37.82% to 31.29%; the fall is the Aqua, Vitz, Yaris, Mazda3, Mazda2 and Impreza (item 1), which hold 16,438 of the register's trailing vehicles, more than the rows raised to `high` add.
  - Beside the published figures (NZ-new): April 2025, our `suv` rows 4,501 of 6,073 passenger vehicles, 74.1% to 91.8% (the MIA's three SUV segments at least 79.1%); June 2026, 8,007 of 13,411 vehicles of all types in `registrations_flow_wider`, 59.7% to 69.1% (AfMA's at least 60.7%). The published figure is inside our range at both dates; nothing was adjusted. The June count includes 51 vehicles that the dashboard records as goods vehicles under a make and model with an `suv` row; it did in D-117 and D-123 too, unstated, and `docs/METRICS.md` now says so.
  - The detail is in `docs/METRICS.md`.
- Choices a reviewer could want reversed:
  1. "Compact car" read as naming no body, which lowers the Aqua, Vitz, Yaris and Mazda3 and Mazda2 to `medium`.
  2. Impreza `car` at `medium` rather than `unresolved`, although the register's IMPREZA holds XVs; Levorg kept `car` `high` although the LEVORG of 2023 on could hold Laybacks.
  3. CUPRA's New Zealand site taken as the distributor's from its name and its footer ("Website operated by Espana Motors Limited"), with no statement read that Espana Motors distributes CUPRA.
  4. Omoda O9 matched to the page's "Omoda 9 SHS", with the listing image's name "O9-Listing" as the link.
  5. The bZ4X Touring raised on Toyota New Zealand's news release, since its model page names no class in its text.
  6. The Porte `car` on "ハイトワゴン" (tall wagon), as the Spade.
  7. Jeep Wrangler `suv` `medium` rather than `unresolved`; Denza B5 and B8 `suv` `medium` on the press page against the dealer's "4X4".
  8. The Geely row changed outside the brief's three items.
- Consequences:
  - Nothing changes for a visitor or in any build: no build reads the file.
  - For the lead's `docs/STATE.md` and `docs/CHECKPOINT.md`: the file has three slices and 134 rows; the review's leftovers from #84 are done; the next nameplates are those below. `CLAUDE.md`'s layout line ("two slices", D-117, D-123) describes two slices.
  - `docs/DATA_MAP.md` cites the file and holds no count of it; it is unchanged.
- What is left:
  1. The next nameplates without a row (trailing, flow): Mazda Biante 159, Audi A3 157, Honda e:N1 156, Volkswagen Polo 156, Nissan Sylphy 152, Mitsubishi Mirage 151, Audi A5 147, MINI Aceman 147, Toyota Hiace 145 (a van registered as a passenger vehicle, for the piece that handles vans), Lexus LX 144.
  2. The 66 `medium` rows, by what holds each back (a row can have more than one reason): the maker's site refused (Ford, MG, Tesla, Honda New Zealand, Mitsubishi New Zealand's model pages, Audi New Zealand and Japan, Volvo, Mercedes-Benz New Zealand and Japan, Lexus New Zealand's model pages) or timed out (BMW, MINI); the maker's page served no class or no text (Toyota's catalogue for the C-HR, Land Cruiser, Avensis and Prius from 2009; Nissan Japan; Honda Japan's non-SUV models; Suzuki Japan; Mazda Japan's former names); the maker's page names no body (Aqua and Vitz, Yaris, Mazda3 and Mazda2); a primary page covers under 80% of the vehicles (Jeep Wrangler, 28.5%, whose Japanese page says off-roader); coverage only, the other market's page giving no class (Toyota C-HR, Subaru Outback, and also Mazda CX-3, the Nissan X-Trail row, Suzuki Ignis and Swift); one name holding more than one kind (Impreza, with the XV) or series (Land Cruiser); or a press, dealer or search page only (Denza, Forthing, Dongfeng, GAC, BAIC).
  3. The 15 `unresolved` rows, among them BYD Atto 2, Sealion 5 and 6, whose New Zealand site could be read and was not tried in this slice.
  4. D-117's items 1 to 3, unchanged: the size bands, people movers and sports cars as classes of their own, and the pipeline wiring; and a per-dataset rule for COROLLA.
- Sources that could not be read (2026-11-18): BMW New Zealand's model page and MINI New Zealand's site (timed out, each the third time); Audi Japan's model page (HTTP 403); Forthing New Zealand's home page (HTTP 500) and Taikon pages (HTTP 404); a Denza New Zealand site (www.denza.co.nz did not resolve; denza.com's certificate did not match its name; one Denza dealer's B8 page returned HTTP 404); Mazda Japan's CX-3 page (HTTP 404); Nissan Japan's X-Trail page (no text); Toyota's catalogue pages for the C-HR, Land Cruiser and Avensis (a model-selection form only); www.omodajaecoo.co.nz (did not resolve; the same site without "www" was read). One slip: a request was sent to Honda New Zealand's home page, a site that refused in D-117 and was not to be retried; it refused again (HTTP 403) and nothing from it is used.
- Tests: `pipeline/tests/test_model_segment.py` (21) passes after each commit. Nothing else was run.
- Status: decided by Claude (unreviewed)

## D-147 2026-11-20 — Work order 2: lean process rules, the canvas page's rules in CLAUDE.md, and D-001 to D-140 moved to an archive
- Agent: user
- Basis: the user's message of 2026-11-20, saved unchanged as `docs/brief/WORK_ORDER.md` by #112 (commit `4ea4f9a`), which merges before this record does. The order it replaces is then `docs/brief/archive/WORK_ORDER_1.md`.
- Context: the order's own words: two-thirds of the commits since 14 November changed only notes, the tests had grown to twice the size of the code, and every change went through a review agent and a decision record. The engine is good enough; effort now goes into what a visitor can see.
- Decision (the user's, in the order):
  1. Work order 2 replaces work order 1. The engine is frozen for features: its §1 lists the only engine work allowed and what is parked.
  2. The process rules of its §2 "replace the old ones", and CLAUDE.md and AGENTS.md are to carry rules 1 to 7. A decision record is written only when an invariant, the data contract, a published figure or privacy changes, or when the user needs to see the choice. Reviews go by risk: one independent reviewer, one round, for pipeline code, the data contract, published files, privacy and workflows; no reviewer for the site, copy and docs, where the checks and screenshots at 390 and 1280 px stand in; docs merge when the checks pass. Tests are added only for data correctness, privacy, the data contract and the canvas's own logic. The notes are updated once a session. Sub-agents run on sonnet by default, haiku for bulk work, and opus only for high-risk reviews and the canvas's interaction design, three at once at most. Sessions are short.
  3. What claude may do without asking (its §3, said "in this message, in this session", and again in a later session by the order's "continue" message): merge into `main`, as a merge commit, when the checks are green and finished, the review rule in §2 for its risk is met, it is inside the work order, and it touches nothing in §4; where Claude Code's permission check refuses a merge, not work around it, stack the next work on top and give the user one line; create and delete its own branches and pull requests; run anything read-only against NZTA's open data service, Stats NZ's Infoshare and the private archive; and one forced run of November, only if the December refresh's build fails for a reason that has been fixed, and only once. Never without asking (its §4): anything public (the Cloudflare switch, the repository's visibility, a new kind of data in a release); anything that costs money or creates an account; anything that cannot be undone (deleting data, rewriting history, replacing an archived file); publishing an owner field beyond the "Current use" table, postcode, or anything derived from `VIN11`; and changing CLAUDE.md's invariants beyond what §5 approves.
  4. This file is reorganised (§2 rule 5), the user approving "this reorganisation of an append-only file": D-001 to D-140 moved unchanged to `docs/decisions/archive-001-140.md`, an index of them here, and new records after it.
  5. CLAUDE.md gains the canvas page's rules in the user's exact wording (the order's §5): a canvas page may hold several charts, and "One question per view" applies to each chart; the visitor chooses the chart type from the types the rule table says fit, and one that does not fit is shown greyed with a one-line reason, never drawn; and five rules still hold (the browser never sees a vehicle row, the small-cell rules, every sentence from a template, every figure one step from its definition, source and snapshot, a flow series never on a chart with survivors).
- Claude's readings and choices inside it (unreviewed):
  - How the order reads onto AGENTS.md's hard rules, which the order does not name. #112 rewrites hard rule 7's merge paragraph to the order's §3 and §4, with the review rule of §2, and takes out work order 1's amendment (that rule said the amendment would go when the order closed). It rewrites hard rule 8 so that the steps are the order's two milestones, and hard rule 4 so that a golden change's diff is shown in the pull request's description. A hard rule changes only with the user's approval: the approval read here is the order's "these replace the old ones" and its §3 and §4, and the user may say the reading is wrong.
  - `pipeline/tests/test_data_map.py` reads the archive as well as this file, so a decision the data map names is still checked to have a record, and an index line alone does not count as one (this pull request, #111).
  - In #112 the `definitions-editor` sub-agent moves from opus to sonnet (rule 6); the lead names opus when it asks for the canvas's interaction design.
  - #105 (the board proposal, D-143) was closed without merging on 2026-11-20. The order does not name it: Claude reads the order's §5 as answering the proposal's three questions.
  - No final report of work order 1 is written. D-082 asked for one report at the end of that order; the order that replaces it says "No stage report files" and that the session report is the summary, and Claude reads that as closing work order 1 without one.
- Consequences: D-082 (what claude may do under work order 1) is superseded by this record. D-104 (the engine first) and D-138 (the canvas as the end state) are read with it.
- Status: accepted for items 1 to 5, the user's own words in the order. The readings and choices listed under Claude's are decided by Claude (unreviewed).

## D-148 2026-11-23 — Work order 3: four lanes worked in parallel, the accuracy guard, and Build folded into the canvas
- Agent: user
- Basis: the user's message of 2026-11-23, saved unchanged as `docs/brief/WORK_ORDER.md` in the first commit of this pull request. The order it replaces is then `docs/brief/archive/WORK_ORDER_2.md`.
- Context: the order's own words: public-ready by 12 December 2026, meaning everything done except the four things only the user can do (the name, the web address, the About gaps and the Cloudflare clicks), with November's figures on the site.
- Decision (the user's, in the order):
  1. Work order 3 replaces work order 2 and keeps its §1 (the engine frozen for features), §2 (the process rules), §3 (what claude may do without asking, merging into `main` among it, said again "in this message") and §4 (never without asking).
  2. The work runs in up to four lanes at once, each on its own branch and worktree: A, finish the canvas (starter canvases, a generated sentence under every chart, Build folded into the canvas, dark mode, first load under 3 s); B, the accuracy guard (`data/reference/published_figures.csv`, a reconciliation step after every build that writes `reconciliation.json`, shown in full on `/status` and in short on the Differences page, and the open gap to the MIA measured); C, public readiness (milestone 2, a quality bar checked on every page, one design pass by an opus sub-agent, a visitor-test kit); D, the December refresh. The lead is the integrator, and no two lanes edit the same file in the same session. `docs/CHECKPOINT.md` opens with a Lanes table, and a session takes only a lane that is free or its own.
  3. A session started on the web takes only lanes A, B or C, reads its site data from the newest public cube release or the test fixtures, and never builds from raw data, touches the private archive or needs a secret.
  4. Build is folded into the canvas, the user approving: a Build link opens as a canvas of one chart, "My questions" become canvases, old Build links keep working, and Build's page goes once every link redirects. This answers CHECKPOINT's parked question 2.
- Claude's readings and choices inside it (unreviewed):
  - How the order reads onto AGENTS.md's hard rules, which it does not name. Hard rule 7's merge paragraph now names work order 3, on the order's §1 ("§3: what you may do without asking, including merging into `main` under those rules. I am saying so in this message"). Hard rule 8's steps are now the four lanes, not two milestones in order. A hard rule changes only with the user's approval: the approval read here is the order's §1 and §2, and the user may say the reading is wrong.
  - "Up to four lanes at once" is read with work order 2's rule 6, which the order keeps: at most three sub-agents at once. Lanes A, B and C each get one; lane D is the lead's own, and is mostly waiting.
  - Lane B is new engine work under a freeze. It is read as allowed because the order asks for it by name. `reconciliation.json` is a new published file, so it is a change to the data contract: it gets its own record, a golden change shown in its pull request, and the high-risk review. The order's "Show it ... as a short public section on the Differences page" is read as the user's approval for the file to be in a cube release, where work order 2's §4 would otherwise park "a new kind of data in a release".
  - CLAUDE.md still opens with "Two surfaces: Explore and Build". It is changed in the pull request that folds Build into the canvas, not before.
- Consequences: D-147 stands for the process rules and is read with this record. The one forced run of November (work order 2's §3) is still available, once.
- Status: accepted for items 1 to 4, the user's own words in the order. The readings and choices listed under Claude's are decided by Claude (unreviewed).
