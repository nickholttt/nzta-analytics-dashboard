# State

Last updated by claude on 2026-10-22

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`.

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs monthly on `main` in GitHub Actions.
  - 8 October 2026 scheduled run 37784177375: green, unattended. 38 tests passed, pulled
    5,916,165 rows (snapshot 2026-09-30), built, no warnings, and the bot committed
    `e3246bb Snapshot 2026-09 [skip ci]`. First of the two gate runs: **passed**.
  - Each built run also uploads the cube as an artifact for 90 days: `public-data-2026-09` (expires
    2027-01-06) and `public-data-2026-08` (expires 2026-12-10), checked 2026-10-22.
- **Nothing is deployed.** The site is a local reference UI (`npm run dev`, 127.0.0.1:4321).
- **Events**: 54 rows, 50 verified. Four are unverified on purpose (Honda and Mercedes-Benz agency
  starts, the semiconductor window, the weak yen). Don't guess dates to clear them.

## Branches and pull requests (checked 2026-10-22)

- `main`: origin `e3246bb`, the pipeline and the bot's 2026-09 snapshot. Local `main` is behind it
  (`ba304d2`); branch from `origin/main`.
- `ui/explore`: origin `3c10716`, PRs #1–#16 merged on 2026-10-21.
- **UI stack**, each PR into the one before, the first into `ui/explore`: #17 `notes-after-merge`,
  #18 `public-explore`, #19 `explore-copy-controls`, #20 `pipeline-branch-rule`, #21
  `sentence-builder`, #22 `builder-league`, #23 `reserved-values`, #24 `prototype-queue`, #25
  `pipeline-decisions`, #30 `explore-build-together`, #31 `pair-views`, #32 `a11y-pass`, #33
  `geo-map`, #34 `deploy-proposal`. No CI runs on this stack: `checks.yml` is not on it. It touches
  no frozen path (checked 2026-10-22).
- **Pipeline stack**, into `main`, unmerged until the gate (D-043): #26 `pr-checks`, #27
  `pair-slice-import-age` (POST_GATE A1), #28 `segment-group` (A3), #29 `post-gate-fixes`, #35
  `deploy-workflow`. Checks green on Linux on 2026-10-22: #26–#29, and #35 (55 tests passed).
- All branch names above are `claude/...`. No PR has been merged since 2026-10-21.

## In progress

- `claude/look-and-feel` (claude, from `claude/deploy-proposal`): look-and-feel planning. Only
  these notes so far; the direction waits on the user (CHECKPOINT question 2).
- The pre-gate pipeline work (#26–#29, #35) waits on the 8 November gate.

## What the open pull requests add (unreviewed by the user)

- #25–#29: pair slices (D-047), CI on pull requests (D-048), `kgm-rename` as measurement (D-049),
  manufacturer group high cardinality (D-050), golden built from frozen events (D-051), B1–B3,
  event schema checks, `segment_group`.
- #30 (D-052): "Change this chart" on Explore charts the builder can say; one hover readout for all
  four renderers.
- #31 (D-053, D-057): the site reads pair slices, so `used-import-age` and a filtered
  `powertrain-mix` draw once a build carries the pairs; a narrowed chart says so; the time row keeps
  a preset's own period; a view with no rows says "Nothing to draw".
- #32 (D-057): every chart named for screen readers; trend and distribution charts carry a table
  of their figures behind a disclosure; scrolling tables take keyboard focus; a visitor-test
  playbook.
- #33 (D-054, D-057): the map on the Build page, from Stats NZ's clipped region outlines, with a
  square-root scale, per-region hover titles and a CC BY 4.0 credit.
- #34 (D-055 to D-057): the public build (`INTERNAL_PAGES=false`) with no link to `/status` or
  `/sense-check`, a not-found page, the deploy decisions and their docs.
- #35 (D-056, D-057): the monthly build keeps each cube as a release `cube-<snapshot>` after
  committing its state; `deploy.yml` builds the public site and uploads it from `main` only, once the
  Cloudflare secrets exist; wrangler is pinned by its own lockfile in `.github/deploy/`.
- The independent review of #30–#35 (three sub-agents, 2026-10-22) and what it changed: D-057.

## Known issues

1. First load at phone width is slow. Local production build, 390px, 150 ms latency, 1.6 Mbps,
   CPU slowed four times, cold cache, median of three (2026-10-22): `/` first chart 6.1 s, all six
   13.4 s, 776 KB; `/build` 5.4 s, 486 KB. Hydrating panels on visibility made the first chart
   later (8.2 s), so it was not kept. Not measured on a deployed site: nothing is deployed.
2. "Area Outside Region" (Stats NZ's name for the Chatham Islands) reaches visitors as is, in the
   map's table. A visitor name needs a value-label setting in config.
3. On a filtered powertrain chart the mild hybrid coverage note states the whole dataset's
   coverage, not the filtered vehicles'.
4. Once #29 meets `ui/explore`, `config/presets.json` `$ranking_period_comment` is wrong (it says
   manufacturer group stays a mix chart, D-050). Correct it in that merge.
5. `used-import-age` (blocked) and `powertrain-mix` (invalid) are authored against the published
   cube. A build carrying #27 and #28 makes them draw; flip them to live then (`/status` will flag
   them).
6. On `main` until `ui/explore` merges: `METRICS.md` has the old representativeness-guard
   figures, and #29's `config/measures.json` comment has D-033's.
7. The public build still ships the status page's script chunk, unlinked and holding no data
   (D-057).

Fixed on open branches and so not repeated here: everything the review found (D-057); the
`measures.json` comment, `kgm-rename`, the 63-character event title and the `used_imports` id in
`PresetPanel` (#29, #31); earlier fixes are in D-028 to D-046.

## Blocked or waiting on the user

- **Freeze** on `pipeline/`, `.github/workflows/`, `config/dimensions.json`, `config/measures.json`,
  `config/pipeline.json`, `data/reference/*`, `pipeline/expected_schema.json`, `pipeline/tests/`,
  `docs/CUBE_SCHEMA.md` until the **8 November 2026** run passes (AGENTS.md hard rule 2). Work on
  them is built on branches from `main` and stays unmerged until then (D-043).
- **Step 1b** (`registrations_flow`, POST_GATE A2) waits until Stats NZ's Aotearoa Data Explorer
  carries the TPT series; Infoshare has no API (`docs/DATA_SOURCES.md` §C). The user chose on
  2026-10-22 to wait; the monthly check looks each month (2026-10-22: no transport series).
- **Deploy** (CHECKPOINT, the deploy item): built (D-056, D-057). After the gate and the merges, the
  user does the Cloudflare and GitHub setup from numbered steps. One question is open: where the
  Cloudflare secrets live (CHECKPOINT question 1).
- **Visitor tests**: the user picks the people (`docs/playbooks/visitor-test.md`).
- Older open questions: what `shaken-clock` in D-020 refers to; which Gemini client is in use.

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). Checked on
2026-10-22: `.venv` Python 3.13.7 and Node v22.19.0; `npx -y -p typescript tsc --noEmit` fetches
TypeScript 7.0.2 and exits 0; `astro build` builds 7 pages; `pipeline/tests/test_workflow.py`
passes. `data/staging/build` holds a dry-run cube of the saved August pull with both pair slices,
used to test #31; a dry run of that pull aborts on two comparisons with the committed September
state, as expected, but still stages its output there.

Headless checks use `playwright-core` 1.64.1 and `axe-core` 4.10.3 from a scratch folder, with
`executablePath` set to Chromium headless shell 1248 under `%LOCALAPPDATA%\ms-playwright`; nothing
is added to the repo. Wait until every chart panel has drawn before auditing: a fixed delay misses
charts at 1280px. In Git Bash, prefix commands whose arguments start with `/` or hold `ref:path`
with `MSYS_NO_PATHCONV=1`, or they reach git and node as Windows paths.
