# State

Last updated by claude on 2026-11-13

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`. The direction and order of work are in `docs/brief/MASTER_BRIEF.md` (D-062).

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs on `main` in GitHub Actions.
  - 8 October 2026 run 37784177375: scheduled, green, built snapshot 2026-09 (5,916,165 rows), and
    the bot committed `e3246bb Snapshot 2026-09 [skip ci]`.
  - 8 November 2026 run 42484367432: scheduled, green, **skipped** ("Source unchanged since the
    last good build"). 38 tests passed; peak memory 1,015 MiB. Nothing committed, as designed.
  - **NZTA refreshed the register on 9 November** (last edit 09:50 UTC; 5,926,990 rows; 28,864
    first registered in October). The 2026-10 snapshot is **not built**. A run now would build it.
    Checked on 2026-11-13 with the run's own change-detection query, writing nothing. If NZTA's
    December refresh comes first, that snapshot is never taken.
  - Cube artifacts: `public-data-2026-08` (expires 2026-12-10), `public-data-2026-09` (expires
    2027-01-06). No release exists.
- **Nothing is deployed.** The site is a local reference UI (`npm run dev`, 127.0.0.1:4321).
- **Events**: 54 rows, 50 verified. Four are unverified on purpose (Honda and Mercedes-Benz agency
  starts, the semiconductor window, the weak yen). Don't guess dates to clear them.

## Current step

**Stage 0 of the master brief is done and reported** (`docs/brief/STAGE_0_REPORT.md`). The next
stage starts when the user says which. Three decisions are proposed: D-063 (the archive), D-064
(the daily run), D-065 (Stats NZ). `docs/DATA_MAP.md` holds a first pass over all 40 source fields.

## In progress

- `claude/next-stage-brief` (claude, #36): docs only. `docs/brief/`, `docs/DATA_MAP.md`,
  `docs/DATA_SOURCES.md`, `docs/playbooks/check-monthly-run.md`, D-062 to D-065, STATE, CHECKPOINT.
  Pushed; nothing uncommitted. Nothing else is in progress by either agent.

## Branches and pull requests (checked 2026-11-13)

- `main`: origin `e3246bb`. Local `main` is behind it (`ba304d2`); branch from `origin/main`.
- `ui/explore`: origin `3c10716`, PRs #1–#16 merged on 2026-10-21. Nothing merged since.
- **20 open pull requests**, all `claude/...`, all unreviewed by the user:
  - **UI stack**, each into the one before, the first into `ui/explore`: #17 `notes-after-merge`,
    #18 `public-explore`, #19 `explore-copy-controls`, #20 `pipeline-branch-rule`, #21
    `sentence-builder`, #22 `builder-league`, #23 `reserved-values`, #24 `prototype-queue`, #25
    `pipeline-decisions`, #30 `explore-build-together`, #31 `pair-views`, #32 `a11y-pass`, #33
    `geo-map`, #34 `deploy-proposal`. No CI runs on this stack. It touches no frozen path.
  - **Pipeline stack**, each into the one before, the first into `main`: #26 `pr-checks`, #27
    `pair-slice-import-age`, #28 `segment-group`, #29 `post-gate-fixes`, #35 `deploy-workflow`.
    Checks green on all five. Unmerged until the freeze lifts (D-043).
  - **#36 `next-stage-brief`** into `claude/question-builder`: D-062, the master brief, and this
    report. Docs only.
- **Built, pushed, no pull request yet:**
  - `claude/question-builder` (`06d727e`, on top of `claude/deploy-proposal`): the question builder
    (D-058 to D-061). `claude/look-and-feel` is an ancestor of it with nothing of its own.
  - `claude/fact-table` (`92d451d`, on top of `claude/deploy-workflow`, worktree
    `../nzta-fact-table`): the fact table, one file per column. Frozen paths (D-043).

## What the open pull requests add

- #25–#29: pair slices (D-047), CI on pull requests (D-048), `kgm-rename` as measurement (D-049),
  manufacturer group high cardinality (D-050), golden built from frozen events (D-051), B1–B3,
  event schema checks, `segment_group`.
- #30 (D-052): "Change this chart" on Explore; one hover readout for all four renderers.
- #31 (D-053, D-057): the site reads pair slices; a narrowed chart says so; "Nothing to draw".
- #32 (D-057): charts named for screen readers; tables of figures; a visitor-test playbook.
- #33 (D-054, D-057): the region map on the Build page.
- #34 (D-055 to D-057): the public build without the internal pages; a not-found page.
- #35 (D-056, D-057): each cube kept as a release; `deploy.yml`; wrangler pinned.
- The independent reviews and what they changed: D-057 (#30–#35), D-061 (builder and fact table).

## Known issues

1. First load at phone width is slow. Local production build, 390px, 150 ms latency, 1.6 Mbps,
   CPU slowed four times, cold cache, median of three (2026-10-22): `/` first chart 6.1 s, all six
   13.4 s, 776 KB; `/build` 5.4 s, 486 KB. Not measured on a deployed site.
2. "Area Outside Region" (Stats NZ's name for the Chatham Islands) reaches visitors as is, in the
   map's table. A visitor name needs a value-label setting in config.
3. On a filtered powertrain chart the mild hybrid coverage note states the whole dataset's
   coverage, not the filtered vehicles'.
4. Once #29 meets `ui/explore`, `config/presets.json` `$ranking_period_comment` is wrong (D-050).
   Correct it in that merge.
5. `used-import-age` (blocked) and `powertrain-mix` (invalid) are authored against the published
   cube. A build carrying #27 and #28 makes them draw; flip them to live then.
6. On `main` until `ui/explore` merges: `METRICS.md` has the old representativeness-guard
   figures, and #29's `config/measures.json` comment has D-033's.
7. The public build still ships the status page's script chunk, unlinked and holding no data.
8. The monthly run has no retry and no alarm: a refresh that lands after it is missed silently
   (D-064 proposes the fix). The refresh came on 3 September, 6 October and 9 November.
9. The archive keeps five dimensions. Once NZTA refreshes, the register as it stood at a month's
   end cannot be read again at anything finer (D-063 proposes the fix). The month's vehicles stay
   in later snapshots; the snapshot itself, and the month as first observed, do not.

## Where docs and code disagree (noted, not changed)

- AGENTS.md hard rule 2 freezes "until the 8 November 2026 scheduled run passes". The run passed
  by `POST_GATE.md`'s wording (clean and unattended) but skipped. The brief says the freeze holds
  until this is resolved, so it is treated as holding until the user says otherwise.
- CLAUDE.md lists `docs/DATA_MAP.md` as planned. A first pass now exists, marked as unapproved.
- The brief's §4 and §7 differ from what Stage 0 found; the report lists each.
- D-061 stopped chosen values being ranked; D-062 allows it. The code still follows D-061.

## Blocked or waiting on the user

Ten decisions, each with options and a recommendation, in `docs/brief/STAGE_0_REPORT.md`. The
time-bound ones, before NZTA's December refresh:

- **Build October 2026**: the user dispatches a run on `main`. Agents do not dispatch.
- **Whether the gate has passed**, and so whether the freeze lifts and the merges can start.
- **The archive (D-063)**, where its files are kept, and a one-off pull of October at full detail.
- **Where the saved August raw pull is copied** (`data/raw/2026-08/`, 177 MB, on one disk).

Also waiting: D-064 and D-065; NZTA's registrations dashboard as a source; `POSTCODE`'s privacy
class; the Cloudflare secrets question (CHECKPOINT); visitor tests (the user picks the people);
the brief's §12 (the `matrix` shape, running cost, the pull request limit, the About page, a name).
Older: what `shaken-clock` in D-020 refers to; which Gemini client is in use.

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). Checked on
2026-10-22: `.venv` Python 3.13.7 and Node v22.19.0; `npx -y -p typescript tsc --noEmit` exits 0;
`astro build` builds 7 pages. Not re-run on 2026-11-13: this session changed docs only.

- `data/staging/work.duckdb` holds the staged build of the saved August pull (tables `src`, `rows`,
  `dims`). Open it read-only for measurements.
- `data/raw/2026-08/` holds only the 17 bound fields. To profile the others, ask NZTA's service
  with count queries (`pipeline/arcgis.py`'s client works from a scratch script and writes nothing).
- NZTA's website (`nzta.govt.nz`) answers automated readers with a block page. Don't work around
  it. Its open data account (`arcgis.com`, owner `Open.Data_NZTA`) and Infoshare both answer.
- Headless checks use `playwright-core` 1.64.1 and `axe-core` 4.10.3 from a scratch folder, with
  `executablePath` set to Chromium headless shell 1248 under `%LOCALAPPDATA%\ms-playwright`. Wait
  until every chart panel has drawn before auditing.
- In Git Bash, prefix commands whose arguments start with `/` or hold `ref:path` with
  `MSYS_NO_PATHCONV=1`, and never leave a bare `python -` in a command: it waits for input.
