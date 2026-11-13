# State

Last updated by claude on 2026-11-13

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`. The direction and order of work are in `docs/brief/MASTER_BRIEF.md` (D-062).

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs on `main` in GitHub Actions.
  - `main` is `d50bfc6`. The last build is the forced run 43374803222 (snapshot 2026-10;
    5,926,990 rows); its cube is the release `cube-2026-10`, which has no fact table.
  - **The build is tried every day** at 06:17 UTC (D-064, D-070). It builds each month once; from
    the 15th a run that builds nothing fails while the month before is missing. The first daily
    run is 14 November 2026. NZTA's refresh has come on 3 September, 6 October and 9 November.
  - **An archive job** keeps each built month's whole register in the private repository (D-063,
    D-071). On `main` it still leaves out `VIN11` and `POSTCODE`, until #42 merges (D-076).
  - `Checks` tests every pull request into `main`; `Deploy` stops before building (no
    `src/lib/site.ts` on `main`).
- **Nothing is deployed.** The site is a local reference UI (`npm run dev`, 127.0.0.1:4321).
- **The archive:** the private repository `nickholttt/nzta-register-archive` holds one release,
  `snapshot-2026-10`, with two files (read back with `gh` on 2026-11-13):
  - `mvr-2026-10.parquet`: 35 fields, 39,298,142 bytes.
  - `mvr-2026-10-vin11-postcode.parquet`: the same register at 37 fields, 55,125,916 bytes, pulled
    and uploaded by hand (D-076). `VIN11` and `POSTCODE` are in this file and nowhere else.
  - The environment `archive`, limited to `main`, holds `ARCHIVE_REPO_TOKEN` (the user's; expires
    13 November 2027).
- **The environment `production`** exists, limited to `main`, with no secret. `deploy.yml`'s
  upload job stays off until the variable `CLOUDFLARE_PAGES_PROJECT` is set (D-072).
- **Events**: 54 rows, 50 verified; four are unverified on purpose. Don't guess dates to clear them.

## Current step

**Stage 1 of the master brief.** In `ui/explore` (`85b7dd6`): the site stack, the site fixes (#40),
the question builder (#43) and the preset corrections (#44). Reviewed and waiting on the user: the
fact table (#41) and the archive's two fields (#42). The dashboard test export is agreed and
starts with the user's first step (CHECKPOINT).

## In progress

- `claude/next-stage-brief` (claude, #36 into `ui/explore`, this folder): docs only. Pushed.
- `claude/fact-table` (claude, #41 into `main`, worktree `../nzta-fact-table`): held for the
  user's answer on the owner's region (D-077). Its `data/staging/build` holds the dry-run cube of
  October with the fact table.
- `claude/archive-vin11-postcode` (claude, #42, worktree `../nzta-archive-fields`): waits for "merge 42".
- Nothing is in progress by gemini.
- `../nzta-screens` is a detached checkout of `ui/explore` (`85b7dd6`) with `node_modules`, a built
  `dist/`, and in `public/data` the 2026-10 cube **plus the dry run's fact table and manifest**, so
  the Build page can be looked at locally.
- `../nzta-presets` is an empty folder Windows would not delete ("resource busy"); git no longer
  knows it. Delete it by hand.

## Branches and pull requests (checked 2026-11-13)

- `main`: origin `d50bfc6`; local matches.
- `ui/explore`: origin `85b7dd6`. The local branch of that name is far behind; use `origin/ui/explore`.
- **3 open pull requests:**
  - **#41** `claude/fact-table` into `main`: `Checks` green, reviewer agreed with follow-ups.
  - **#42** `claude/archive-vin11-postcode` into `main`: `Checks` green, reviewer agreed with
    follow-ups, the ones that belong to it done.
  - **#36** `claude/next-stage-brief` into `ui/explore`: these notes. No check runs on pull
    requests into `ui/explore`.
- Merged today and deleted here and on GitHub: `claude/question-builder`, `claude/preset-corrections`.
- `origin/claude/look-and-feel` (`857a17b`) is an ancestor of `ui/explore` now; it can be deleted.

## Raw pulls on this computer (gitignored)

- `data/raw/2026-08/20260911T093818Z`: 5,905,376 rows, the 17 bound fields, 177 MB.
- `data/raw/2026-10/20261113T045017Z`: 5,926,990 rows, 36 fields (no `VIN11`, `CHASSIS7`,
  `ENGINE_NUMBER`, `POSTCODE`), 348 MB. Pulled by hand (D-066).
- **No local pull holds `VIN11` or `POSTCODE`**: the one made on 2026-11-13 was deleted once its
  file was in the private archive (D-076).
- **Copies:** `F:\nzta-data-backup` holds both pulls (SHA-256 checked 2026-11-13), on the
  project's own disk; the user has also copied them to a separate OneDrive (the user's word).
- `data/raw/nzta-dashboard/2026-10/`: the user's hand export of October (D-075): one spreadsheet
  (6,509 rows by 263 columns, 28,896 vehicles), NZTA's page as HTML, four screenshots.

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
8. **The fact table is close to row level** (the reviewer's measurement on the 2026-08 table):
   65% of its rows count one vehicle, with the owner's region beside the model and month. Held
   for the user (CHECKPOINT question 1).
9. `/method` and `/caveats` state figures by hand, recomputed for October (#40); they fall a
   month behind at each refresh until the narrative engine (D-062).
10. Seen in the screenshots and not fixed: the map's legend label "0%" hangs outside the chart
    box; "Is the market getting more crowded?" shows a dense grey band before 1970; no dark theme.
11. The question builder's open follow-ups are on #43; the other reviewers' are in CHECKPOINT.

## Where docs and code disagree (noted, not changed)

- **The freeze and who merges.** AGENTS.md (hard rules 2 and 7) is current on this branch only,
  until #36 merges. Still describing the freeze: `README.md`, `POST_GATE.md`, four playbooks
  (`change-reference-data`, `add-event`, `change-preset`, `session-handoff`) and two skills.
- `main`'s own CLAUDE.md still says "monthly cron" and has the old non-goal; this branch's is
  current (D-076).
- AGENTS.md hard rule 8's exception still reads "local dev build only until the 8 November 2026
  gate passes". The gate has passed; deploying is Stage 1, on the user's word.
- The brief's §4 says October is unbuilt and the freeze undecided: both are settled (D-066).
- D-058 says the register has "no owner data"; the fact table carries the owner's region (D-077).
- D-061 stopped chosen values being ranked and D-062 allows it: the code follows D-061.
- `docs/DATA_SOURCES.md` here has no section on the register archive; `main`'s has (#42 corrects it).

## Blocked or waiting on the user

- **CHECKPOINT's three questions**: the owner's region in the fact table; "merge 42"; and the
  first step of the dashboard test export.
- **`ui/explore` into `main`**, a forced run, and anything public: asked first.
- Also waiting: visitor tests; the brief's §12; two NZTA pages an automated reader cannot open.

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). Checked on
2026-11-13: the pipeline tests on `claude/fact-table` merged with `main`, 95 passed in 395 s with
other jobs running; `python -m pipeline build <the 2026-10 pull> --dry-run` there, exit 0 in
11 min 22 s; `python -m pipeline archive --snapshot 2026-10 --out <file>` from
`claude/archive-vin11-postcode`, 13 min 7 s; `tsc --noEmit` and `astro build` (7 pages) on
`ui/explore` with the question builder.

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
  `&build.by=parent_group&build.value=BYD&build.value=Geely%20Holding`.
- In Git Bash, prefix commands whose arguments start with `/` with `MSYS_NO_PATHCONV=1`, and
  write any script that holds quotes, backticks or backslashes to a file first: a heredoc in the
  Bash tool can break on them.
- To merge a stacked pull request: point it at its final base (`gh pr edit N --base <branch>`)
  before deleting the branch under it, then `gh pr merge N --merge`.
- Claude Code's permission check refuses a merge into `main` unless the user has said so in the
  session's own messages. If it refuses, say so; do not work around it.
