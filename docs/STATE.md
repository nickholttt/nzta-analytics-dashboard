# State

Last updated by claude on 2026-11-13

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`. The direction and order of work are in `docs/brief/MASTER_BRIEF.md` (D-062).

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs on `main` in GitHub Actions.
  - `main` is `f78e3e1`. The last build is the forced run 43374803222 (snapshot 2026-10;
    5,926,990 rows); its cube is the release `cube-2026-10`, which has no fact table.
  - **The build is tried every day** at 06:17 UTC (D-064, D-070). It builds each month once; from
    the 15th a run that builds nothing fails while the month before is missing. The first daily
    run is 14 November 2026. NZTA's refresh has come on 3 September, 6 October and 9 November.
  - **The fact table is on `main`** (#41, D-078), without the owner's region. The next build
    writes it and publishes it in that month's cube release.
  - **The archive job** keeps each built month's whole register in the private repository, with
    `VIN11` and `POSTCODE` since #42 (D-063, D-071, D-076): 37 fields from the next built month.
  - `Checks` tests every pull request into `main`; `Deploy` stops before building (no
    `src/lib/site.ts` on `main`).
- **Nothing is deployed.** The site is a local reference UI (`npm run dev`, 127.0.0.1:4321).
- **The archive:** the private repository `nickholttt/nzta-register-archive` holds one release,
  `snapshot-2026-10`, with two files (read back with `gh` on 2026-11-13):
  - `mvr-2026-10.parquet`: 35 fields, 39,298,142 bytes.
  - `mvr-2026-10-vin11-postcode.parquet`: the same register at 37 fields, 55,125,916 bytes
    (D-076). `VIN11` and `POSTCODE` are in this file and nowhere else.
  - The environment `archive`, limited to `main`, holds `ARCHIVE_REPO_TOKEN` (the user's; expires
    13 November 2027).
- **The environment `production`** exists, limited to `main`, with no secret. `deploy.yml`'s
  upload job stays off until the variable `CLOUDFLARE_PAGES_PROJECT` is set (D-072).
- **Events**: 54 rows, 50 verified; four are unverified on purpose. Don't guess dates to clear them.

## Current step

**Stage 1 of the master brief.** `ui/explore` holds the site (the site stack, #40, the question
builder #43, the preset corrections #44) and these notes. `main` holds the pipeline with the fact
table. Next is the deploy, each step asked for, starting with `ui/explore` into `main`
(CHECKPOINT). The dashboard test export starts when the user says they are ready.

## In progress

- Nothing is in progress by claude or by gemini. No pull request is open.
- This folder is a detached checkout of `origin/ui/explore`. Start the next piece of work on a
  new branch from `origin/ui/explore` or `origin/main`.
- `../nzta-screens` is a detached checkout of `ui/explore` (`85b7dd6`) with `node_modules`, a built
  `dist/`, and in `public/data` the 2026-10 cube **plus the fact table and manifest of this
  session's dry run** (no region), so the Build page can be looked at locally.
- `../nzta-presets` is an empty folder Windows would not delete ("resource busy"); git no longer
  knows it. Delete it by hand.

## Branches and pull requests (checked 2026-11-13)

- `main`: origin `f78e3e1`; local matches.
- `ui/explore`: origin is the merge of #36 (`git rev-parse origin/ui/explore`). The local branch of
  that name is far behind; use `origin/ui/explore`.
- **No open pull request.** Merged today and deleted here and on GitHub: `claude/fact-table` (#41),
  `claude/archive-vin11-postcode` (#42), `claude/next-stage-brief` (#36); and `claude/look-and-feel`.

## Raw pulls on this computer (gitignored)

- `data/raw/2026-08/20260911T093818Z`: 5,905,376 rows, the 17 bound fields, 177 MB.
- `data/raw/2026-10/20261113T045017Z`: 5,926,990 rows, 36 fields (no `VIN11`, `CHASSIS7`,
  `ENGINE_NUMBER`, `POSTCODE`), 348 MB. Pulled by hand (D-066).
- **No local file holds `VIN11` or `POSTCODE`**: the archive's file was read into a scratch folder
  for the check of D-079 and deleted the same session.
- **Copies:** `F:\nzta-data-backup` holds both pulls (SHA-256 checked 2026-11-13), on the
  project's own disk; the user has also copied them to a separate OneDrive (the user's word).
- `data/raw/nzta-dashboard/2026-10/`: the user's hand export of October (D-075): one spreadsheet
  (6,509 rows by 263 columns, 28,896 vehicles), NZTA's page as HTML, four screenshots. The page is
  read into `docs/DATA_MAP.md` and `docs/MODEL_AND_AGE.md` §1.

## Known issues

1. First load at phone width is slow: `/` first chart 6.1 s, all six 13.4 s; `/build` 5.4 s (local
   production build, throttled, 2026-10-22). Not measured since, nor on a deployed site, nor for
   a question that reads the fact table.
2. "Area Outside Region" (Stats NZ's name for the Chatham Islands) reaches visitors as is.
3. On a filtered powertrain chart the mild hybrid coverage note states the whole dataset's
   coverage, not the filtered vehicles'.
4. **On `ui/explore` alone `powertrain-mix` draws without its light-passenger filter**, with a
   warning, because that branch's `config/dimensions.json` has no `segment_group`. It is right
   once `ui/explore` meets `main` (checked on a local test merge, D-077).
5. `ui/explore` into `main` conflicts in `README.md` only (`git merge-tree`, 2026-11-13).
6. On `main` until `ui/explore` merges: `METRICS.md` has the old representativeness-guard
   figures; `config/measures.json`'s comment has D-033's; no decision file, AGENTS.md or STATE.
7. The public build still ships the status page's script chunk, unlinked and holding no data.
8. **Half of the fact table's rows still count one vehicle** (50.2% of rows, 7.1% of vehicles, on
   the 2026-10 dry run). No column describes the owner any more; whether a minimum count is
   wanted anyway is for the Stage 2 privacy review, with the `region` slice's small cells.
9. `/method` and `/caveats` state figures by hand, recomputed for October (#40); they fall a
   month behind at each refresh until the narrative engine (D-062).
10. Seen in the screenshots and not fixed: the map's legend label "0%" hangs outside the chart
    box; "Is the market getting more crowded?" shows a dense grey band before 1970; no dark theme;
    a link's condition on a field Build cannot apply is named by its id ("region"), not its label.
11. The question builder's open follow-ups are on #43; the fact table's and the other reviewers'
    are in CHECKPOINT.

## Where docs and code disagree (noted, not changed)

- **The freeze.** AGENTS.md, the playbooks and the skills are current on `ui/explore`. Still
  describing the freeze: `README.md` and `POST_GATE.md`, left for the branch that resolves
  `README.md` for `ui/explore` into `main`.
- **AGENTS.md's dry-run command names the 2026-08 pull and "exit 0".** Since October became the
  last good build, that build stops with exit 2 at the comparison (its files are still staged).
  The 2026-10 pull gives exit 0 (11 min 3 s on 2026-11-13).
- AGENTS.md hard rule 7 still lists the merges D-068 allowed (all are done), and rule 8's exception
  still reads "until the 8 November 2026 gate passes" (it has; deploying is Stage 1, on the user's word).
- `main`'s own CLAUDE.md still says "monthly cron" and has the old non-goal; `ui/explore`'s is
  current (D-076).
- The brief's §4 says October is unbuilt and the freeze undecided: both are settled (D-066).
- D-058 says the register has "no owner data": corrected by D-078, and D-058 is not edited.
- D-061 stopped chosen values being ranked and D-062 allows it: the code follows D-061.
- `docs/DATA_SOURCES.md` on `ui/explore` has no section on the register archive; `main`'s has.
- `docs/CUBE_SCHEMA.md` on `ui/explore` does not describe the fact table; `main`'s does.

## Blocked or waiting on the user

- **`ui/explore` into `main`**, a forced run, and anything public: asked first (CHECKPOINT).
- **The dashboard test export**: the user starts it and says "ready".
- Also waiting: visitor tests; the brief's §12; two NZTA pages an automated reader cannot open.

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). Checked on
2026-11-13, on what is now `main`: the pipeline tests, 98 passed in 397 s before the review's two
last commits, and the three test files they touch, 67 passed, after; `python -m pipeline build
<the 2026-10 pull> --dry-run`, exit 0 in 11 min 3 s. `astro build` (7 pages) on `ui/explore` in
`../nzta-screens`.

- `python -m pipeline archive --snapshot YYYY-MM` pulls NZTA's live register (about 186 requests)
  and writes nothing committed. It refuses unless the register still is the built month.
- `data/staging/work.duckdb` (this folder) holds the staged build of the saved August pull.
- NZTA's website (`nzta.govt.nz`) answers automated readers with a block page. Don't work around
  it. Its open data service and Infoshare both answer. Its registrations dashboard
  (`qap.nzta.govt.nz`) is read only from the user's hand exports.
- Headless screenshots: `playwright-core` 1.64.1 installed in a scratch folder, `executablePath`
  set to Chromium headless shell 1248 under `%LOCALAPPDATA%\ms-playwright`. Serve a build with
  `npx astro preview --port N` (it runs in the background; stop it with `npx astro preview stop`).
  The Build page's question is in the address bar: `/build/?build.measure=share_and_count`
  `&build.by=parent_group&build.value=BYD&build.value=Geely%20Holding`; a condition is
  `&build.where.<dimension>=<value>`.
- In Git Bash, prefix commands whose arguments start with `/` with `MSYS_NO_PATHCONV=1`, and
  write any script that holds quotes, backticks or backslashes to a file first: a heredoc in the
  Bash tool can break on them.
- To merge a stacked pull request: point it at its final base (`gh pr edit N --base <branch>`)
  before deleting the branch under it, then `gh pr merge N --merge`.
- Claude Code's permission check refuses a merge into `main` unless the user has said so in the
  session's own messages. If it refuses, say so; do not work around it.
