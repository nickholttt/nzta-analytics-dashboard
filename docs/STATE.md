# State

Last updated by claude on 2026-11-14

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`. The direction is the user's standing work order,
`docs/brief/WORK_ORDER.md` (D-082), over `docs/brief/MASTER_BRIEF.md` (D-062).

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs on `main` in GitHub Actions.
  - `main` is `9596c60`, the merge of #48. The last build is the forced run 43374803222
    (snapshot 2026-10; 5,926,990 rows); its cube is the release `cube-2026-10`, which has no
    fact table.
  - **The build is tried every day** at 06:17 UTC (D-064, D-070). The first daily run is
    14 November 2026; it had not started when this was written (06:10 UTC that day).
  - **The fact table is on `main`** (#41, D-078), without the owner's region. The next build
    writes it.
  - **The archive job** keeps each built month's whole register in the private repository
    `nickholttt/nzta-register-archive`. It holds one release, `snapshot-2026-10`, with two
    files, read back on 2026-11-14: `mvr-2026-10.parquet` (39,298,142 bytes) and
    `mvr-2026-10-vin11-postcode.parquet` (55,125,916 bytes).
  - `Checks` tests every pull request into `main`.
- **The site's code is on `main`** since #46. `Deploy` builds it from the newest cube release
  and uploads nothing. **Nothing is deployed**: the variable `CLOUDFLARE_PAGES_PROJECT` is
  unset (checked 2026-11-14). The site is seen locally (`npm run dev`, 127.0.0.1:4321).
- **Six sub-agent definitions** in `.claude/agents/`, each naming its model;
  `pipeline/tests/test_agents.py` checks it on every pull request (D-085). A definition written
  in a session may not load until the next: until then a spawn names its model by hand.
- **Six shapes are allowed** (D-083): `matrix` is approved and has no renderer yet.
- **Events**: 54 rows, 50 verified; four are unverified on purpose. Don't guess dates.

## Current step

**Work order 1, packages A to D, with E's profiling started.** One report at the end; a
blocked item is parked in CHECKPOINT and the next package goes on (D-082).

## In progress (all claude; nothing by gemini)

Unpushed work sits in git worktrees in the session's scratch folder: `git worktree list`
shows them, and each branch below is a local branch of this repository.

| Branch | Where | What | State |
|---|---|---|---|
| `claude/stage1-pages` | #49, the second checkout `../nzta-screens` | About, feedback and corrections, why figures differ; `go-public` and `visitor-test` playbooks (D-086) | Checks green; an independent review is running |
| `claude/site-follow-ups` | this folder | CHECKPOINT's small site follow-ups; these notes | A sonnet worker is mid-way; not pushed |
| `claude/pipeline-follow-ups` | a worktree | CHECKPOINT's small pipeline and workflow follow-ups | A sonnet worker is mid-way; not pushed |
| `claude/registrations-flow` | a worktree | Package B, pipeline half: `python -m pipeline supply`, the store, the `registrations_flow` dataset | A sonnet worker is mid-way; not pushed |
| `claude/flow-definition` | a worktree | Package B: the dataset defined in METRICS, the dashboard's fields in the data map | One commit, not pushed. D-087 is appended once #49 has merged (it follows D-086) |

- **A profile of every register field** (package E) is being written by a sonnet worker to
  gitignored `data/staging/profiles/2026-10/` (`REPORT.md` and CSV files).
- **The build plans** for package B's pipeline half and package C are in gitignored
  `data/staging/work-order/` (`spec-B-pipeline.md`, `spec-C-statsnz.md`).

## Branches and pull requests (checked 2026-11-14)

- `main`: origin `9596c60`. Merged this session: #47 (`6b69fcc`) and #48 (`9596c60`).
- `ui/explore` is deleted on GitHub (all of it was in `main`; no history rewritten). The local
  branch of that name remains and is far behind.
- **1 open pull request: #49** `claude/stage1-pages` into `main`.

## Raw files on this computer (gitignored)

- `data/raw/2026-08/20260911T093818Z`: 5,905,376 rows, the 17 bound fields.
- `data/raw/2026-10/20261113T045017Z`: 5,926,990 rows, 36 fields. Pulled by hand (D-066).
- `data/raw/nzta-dashboard/`: the user's exports of NZTA's registrations dashboard (D-084).
  - `history/nzta-first-registrations-2021-01_to_2026-10.csv`: 70 months, 991,274 rows,
    1,883,786 vehicles, 133,320,124 bytes.
  - `2021-01/nzta-first-registrations-2021-01.csv`: 17,221 rows, 30,011 vehicles.
  - `2026-10/`: the first hand export (a spreadsheet), NZTA's page as HTML, screenshots (D-075).
- `data/raw/statsnz/2026-11-14/TPT052601.csv`: Stats NZ's monthly series, January 1961 to
  September 2026, 26 series, 95,024 bytes. Fetched read-only from Infoshare for building and
  testing (the work order §2); the user's own hand export replaces it (D-065).
- **No local file holds `VIN11` or `POSTCODE`.** The archive's 35-field file is read into a
  scratch folder for a check and deleted after.
- **Copies:** a backup folder on the project's own disk holds both register pulls (SHA-256
  checked 2026-11-13) and both dashboard CSV files (checked 2026-11-14). The user's Downloads
  folder still holds two
  more copies of the history file, byte for byte the same; they are the user's to delete.

## Known issues

1. First load at phone width is slow: `/` first chart 6.1 s, all six 13.4 s; `/build` 5.4 s
   (local production build, throttled, 2026-10-22). Not measured since. Package D measures it
   again and makes the cheapest fix.
2. "Area Outside Region" (Stats NZ's name for the Chatham Islands) reaches visitors as is.
3. On a filtered powertrain chart the mild hybrid coverage note states the whole dataset's
   coverage, not the filtered vehicles'.
4. **The released cube, `cube-2026-10`, has no fact table**, so the public build's Build page
   offers no conditions. A forced run of October or December's refresh ends this.
5. Commits before #47 still hold paths from the user's computer (D-081); history stays as is.
6. **Half of the fact table's rows count one vehicle** (50.2% of rows, 7.1% of vehicles, on the
   2026-10 dry run). Whether a minimum count is wanted is for the Stage 2 privacy review.
7. `/method` and `/caveats` state figures by hand; they fall a month behind at each refresh
   until the narrative engine (package H).
8. No dark theme. Other small faults seen in screenshots: `claude/site-follow-ups`.

## Where docs and code disagree (noted, not changed)

- CLAUDE.md and AGENTS.md say six shapes; five have renderers, and `src/lib/resolve.ts` still
  says "all five". The `matrix` renderer is package F.
- `docs/brief/MASTER_BRIEF.md` still calls `matrix` proposed, says Plot draws "all five
  shapes", and keeps the cap of five waiting pull requests. The work order wins (its §5); the
  brief is updated with the final report (its §6).
- `config/dimensions.json` still describes `registrations_flow` as planned from Stats NZ's
  series. It is now the dashboard's dataset (D-084); `claude/registrations-flow` changes it.
- `docs/METRICS.md` on `main` says the same until `claude/flow-definition` merges.
- Events are scoped without regard to a preset's filter (`src/lib/events.ts`); on the
  follow-ups list.
- D-058 says the register has "no owner data": corrected by D-078, and D-058 is not edited.
- D-061 stopped chosen values being ranked and D-062 allows it: the code follows D-061 until
  package F.
- NZTA's page says an inactive vehicle is one "registered and registration cancelled in the
  same month". The data says `INACTIVE` means since removed from the register (measured
  2026-11-14; `claude/flow-definition`).

## Blocked or waiting on the user

Nothing stops the work. Parked for the final report (CHECKPOINT, questions): where the
converted dashboard data may live; the About page's six gaps and the site's name; whether the
monthly export takes mass and engine-size groupings; the Stats NZ hand export; the Cloudflare
steps; the privacy classes.

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). On what is now
`main`: the pipeline tests pass in `Checks` (#48's run, 1 min 26 s on GitHub's runner); locally
they take 7 to 9 minutes. `tsc --noEmit` exit 0 and `astro build` were last run on the tree of
#46.

- `python -m pipeline archive --snapshot YYYY-MM` pulls NZTA's live register (about 186
  requests) and writes nothing committed.
- NZTA's website and its registrations dashboard block automated readers. Don't work around
  it: the dashboard is read only from files the user supplies. NZTA's open data service and
  Stats NZ's Infoshare both answer.
- Headless screenshots: `playwright-core` 1.64.1 in a scratch folder, `executablePath` set to
  Chromium headless shell 1248 under `%LOCALAPPDATA%\ms-playwright`. Serve a build with
  `npx astro preview --port N` and stop it with `npx astro preview stop`. The Build page's
  question is in the address bar: `/build/?build.measure=share_and_count`
  `&build.by=parent_group&build.value=BYD`; a condition is `&build.where.<dimension>=<value>`.
- In Git Bash, prefix commands whose arguments start with `/` with `MSYS_NO_PATHCONV=1`, and
  write any script that holds quotes, backticks or backslashes to a file first.
- A sub-agent that needs its own copy of the repository gets a worktree made by hand
  (`git worktree add`); Claude Code's own isolated worktree failed to start in this folder.
  A worktree has no `.venv` or `node_modules`: use this folder's Python by its full path, and
  `../nzta-screens` (which has `node_modules`) for a second site worker.
- If Claude Code's permission check refuses a merge into `main`, say so and do not work around
  it (hard rule 7).
