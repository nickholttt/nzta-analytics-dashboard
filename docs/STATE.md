# State

Last updated by claude on 2026-11-13

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`. The direction and order of work are in `docs/brief/MASTER_BRIEF.md` (D-062).

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs on `main` in GitHub Actions.
  - 13 November 2026 run 43367551467: started by claude on the user's instruction, unforced,
    green. It **built snapshot 2026-10** (5,926,990 rows, no warnings; peak memory 2,431 MiB), and
    the bot committed `a5fb60c Snapshot 2026-10 [skip ci]`.
  - Before it: 8 November, scheduled, green, skipped (NZTA refreshed the next day); 8 October,
    scheduled, green, built 2026-09.
  - The schedule is still the 8th of each month. The daily run is accepted (D-064) and not built.
    NZTA's refresh has come on 3 September, 6 October and 9 November.
  - Cube artifacts: `public-data-2026-08` (expires 2026-12-10), `public-data-2026-09` (expires
    2027-01-06), `public-data-2026-10` (expires 2027-02-11). No release exists.
- **Nothing is deployed.** The site is a local reference UI (`npm run dev`, 127.0.0.1:4321).
- **Events**: 54 rows, 50 verified. Four are unverified on purpose (Honda and Mercedes-Benz agency
  starts, the semiconductor window, the weak yen). Don't guess dates to clear them.

## Current step

**Stage 1 of the master brief, stopped after item 1** (`docs/brief/STAGE_1_REPORT.md`).

- **The freeze is lifted** (the user, D-066): the gate passed once the 13 November run was green.
  AGENTS.md hard rule 2 is rewritten on this branch.
- Item 0, the user's time-bound decisions: done, except copying the raw pulls (no folder named).
- Item 1: a five-line summary of each of the 20 open pull requests, in merge order, in batches of
  five. Merging is the user's. Nothing was merged.
- Items 2 to 8 are not started. D-063, D-064 and D-065 are accepted and not built.

## In progress

- `claude/next-stage-brief` (claude, #36): docs only. `docs/brief/`, `docs/DATA_MAP.md`,
  `docs/DATA_SOURCES.md`, AGENTS.md hard rule 2, D-062 to D-067, STATE, CHECKPOINT. Pushed; nothing
  uncommitted. Nothing else is in progress by either agent.

## Branches and pull requests (checked 2026-11-13)

- `main`: origin `a5fb60c`. Local `main` is behind it (`ba304d2`); branch from `origin/main`.
- `ui/explore`: origin `3c10716`, PRs #1–#16 merged on 2026-10-21. Nothing merged since.
- **20 open pull requests**, all `claude/...`, all unreviewed by the user, all mergeable. The merge
  order and a summary of each: `docs/brief/STAGE_1_REPORT.md` §6.
  - **Pipeline stack**, each into the one before, the first into `main`: #26 `pr-checks`, #27
    `pair-slice-import-age`, #28 `segment-group`, #29 `post-gate-fixes`, #35 `deploy-workflow`.
    Checks green on all five. **Batch 1: these merge first.**
  - **Site stack**, each into the one before, the first into `ui/explore`: #17 `notes-after-merge`,
    #18 `public-explore`, #19 `explore-copy-controls`, #20 `pipeline-branch-rule`, #21
    `sentence-builder`, #22 `builder-league`, #23 `reserved-values`, #24 `prototype-queue`, #25
    `pipeline-decisions`, #30 `explore-build-together`, #31 `pair-views`, #32 `a11y-pass`, #33
    `geo-map`, #34 `deploy-proposal`. No CI runs on this stack.
  - **#36 `next-stage-brief`** into `claude/question-builder`. Docs only.
- **Built, pushed, no pull request yet:**
  - `claude/question-builder` (`06d727e`, on top of `claude/deploy-proposal`): the question builder
    (D-058 to D-061). It goes between #34 and #36.
  - `claude/fact-table` (`92d451d`, on top of `claude/deploy-workflow`, worktree
    `../nzta-fact-table`): the fact table, one file per column. It goes after #35.
- A test merge of the two stacks' tops (`claude/next-stage-brief` with `claude/fact-table`) has no
  conflict.

## Raw pulls on this computer (gitignored, one disk, no other copy)

- `data/raw/2026-08/20260911T093818Z`: 5,905,376 rows, the 17 bound fields, 177 MB.
- `data/raw/2026-10/20261113T045017Z`: 5,926,990 rows, 36 fields (every field but `VIN11`,
  `CHASSIS7`, `ENGINE_NUMBER`, `POSTCODE`), 348 MB. Pulled by hand (D-066); the same register the
  run built from.
- No pull of September exists anywhere.

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
8. The monthly run has no retry and no alarm: a refresh that lands after it is missed silently.
   D-064 fixes it and is not built.
9. The committed archive keeps five dimensions. D-063 (one whole-snapshot file a month, kept
   privately) fixes it and is not built. Until it is on `main`, a month is kept at every field only
   by a hand pull.
10. `deploy.yml` (#35) starts after every successful monthly build, and a skip is a success. Under
    a daily run that is a deploy every day. Settle it when D-064 is built.

## Where docs and code disagree (noted, not changed)

- **The freeze.** AGENTS.md hard rule 2 says it is lifted, on this branch only. `ui/explore` keeps
  the old rule until #36 merges; `main` has no AGENTS.md until `ui/explore` merges into it.
  Still describing the freeze: `README.md`,
  `POST_GATE.md`, the playbooks `change-reference-data`, `add-event`, `change-preset`,
  `check-monthly-run` and `session-handoff`, and the skills `add-event`, `change-reference-data`
  and `check-monthly-run`. AGENTS.md is the rule; the rest is queued for correction.
- AGENTS.md hard rule 8's exception still reads "local dev build only until the 8 November 2026
  gate passes". The gate has passed; deploying is Stage 1 item 2, on the user's word.
- The brief's §4 says October is unbuilt and the freeze undecided. Both are settled (D-066). Its
  Stage 1 items 1 and 2 cite CHECKPOINT item numbers that have since moved: merge support is queue
  items 1 and 4, and the deploy is in item 6. The brief is the user's to update.
- CLAUDE.md lists `docs/DATA_MAP.md` as planned. A first pass exists, marked as unapproved.
- D-061 stopped chosen values being ranked; D-062 allows it. The code still follows D-061.

## Blocked or waiting on the user

- **A backed-up folder** for the August and October raw pulls: the answer left a placeholder.
- **The private archive**: the six setup steps in the Stage 1 report §4, and whether the token is
  an environment secret (3a) or a repository secret (3b). The same choice settles where the
  Cloudflare secrets live (CHECKPOINT question 2).
- **NZTA's registrations dashboard**: one export of October, before 1 December (the report §5).
- **Merging**: batch 1 first (#26, #27, #28, #29, #35).
- Also waiting: visitor tests (the user picks the people); the brief's §12 (the `matrix` shape,
  running cost, the pull request limit, the About page, a name); two NZTA pages an automated
  reader cannot open (the Stage 0 report §6). Older: what `shaken-clock` in D-020 refers to; which
  Gemini client is in use.

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). Checked on
2026-10-22: `.venv` Python 3.13.7 and Node v22.19.0; `npx -y -p typescript tsc --noEmit` exits 0;
`astro build` builds 7 pages. Not re-run on 2026-11-13: both sessions changed docs only.

- `data/staging/work.duckdb` holds the staged build of the saved August pull (tables `src`, `rows`,
  `dims`). Open it read-only for measurements.
- To profile a field, the October pull holds 36 of the 40. For the live register, ask NZTA's
  service with count queries (`pipeline/arcgis.py`'s client works from a scratch script and writes
  nothing).
- NZTA's website (`nzta.govt.nz`) answers automated readers with a block page. Don't work around
  it. Its open data account (`arcgis.com`, owner `Open.Data_NZTA`) and Infoshare both answer.
- Headless checks use `playwright-core` 1.64.1 and `axe-core` 4.10.3 from a scratch folder, with
  `executablePath` set to Chromium headless shell 1248 under `%LOCALAPPDATA%\ms-playwright`. Wait
  until every chart panel has drawn before auditing.
- In Git Bash, prefix commands whose arguments start with `/` or hold `ref:path` with
  `MSYS_NO_PATHCONV=1`, and never leave a bare `python -` in a command: it waits for input.
