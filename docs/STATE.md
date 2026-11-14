# State

Last updated by claude on 2026-11-14

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`. The direction and order of work are in `docs/brief/MASTER_BRIEF.md` (D-062).

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs on `main` in GitHub Actions.
  - `main` is `a41c2cf`, the merge of #46. The last build is the forced run 43374803222 (snapshot
    2026-10; 5,926,990 rows); its cube is the release `cube-2026-10`, which has no fact table.
  - **The build is tried every day** at 06:17 UTC (D-064, D-070). It builds each month once; from
    the 15th a run that builds nothing fails while the month before is missing. The first daily
    run is 14 November 2026. NZTA's refresh has come on 3 September, 6 October and 9 November.
  - **The fact table is on `main`** (#41, D-078), without the owner's region. The next build
    writes it and publishes it in that month's cube release.
  - **The archive job** keeps each built month's whole register in the private repository, with
    `VIN11` and `POSTCODE` since #42 (D-063, D-071, D-076): 37 fields from the next built month.
  - `Checks` tests every pull request into `main`.
- **The site's code is on `main`** since #46 (2026-11-14). `Deploy` builds the public site from
  the newest cube release on each push that touches the site, and uploads nothing: run
  43420177311 built 7 pages from `cube-2026-10`, its upload job was skipped, and the environment
  `production` has no deployment.
- **Nothing is deployed.** The site is seen locally (`npm run dev`, 127.0.0.1:4321).
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

**Stage 1 of the master brief.** `main` holds the pipeline and the site. Next in the deploy, each
step asked for: **the forced run of October, only if the daily run of 14 November (06:17 UTC)
reports the source unchanged** (D-081); then the Cloudflare steps (CHECKPOINT). Nothing becomes
public without asking. The dashboard test export starts when the user says "ready".

## In progress (nothing by gemini)

- `claude/explore-in-main-notes` (claude, #47 into `main`, this folder): these notes, hard rules
  7 and 8 as approved, the paths from the user's computer removed, and the lines #46 made stale.
  Waits for "merge 47". This folder's `public/data` holds the 2026-10 dry run with the fact table.
- **A check-in is scheduled in claude's session of 14 November** for 20:07 NZDT that day: it
  reads the daily run and starts the forced run only if D-081's condition holds. It exists only
  while that session is open; if it did not fire, nothing was forced.
- `../nzta-screens`: a detached checkout of `ui/explore` at `85b7dd6`, kept from earlier
  screenshots; it can be removed. `../nzta-presets` is an empty folder Windows will not delete.

## Branches and pull requests (checked 2026-11-14)

- `main`: origin `a41c2cf`. The local branch of that name is one merge behind.
- `ui/explore`: origin `50caa55`; all of it is in `main` (#46, same tree). Kept: it is the
  user's branch. The local branch of that name is far behind.
- **1 open pull request: #47** `claude/explore-in-main-notes` into `main`: its reviewer agreed
  with follow-ups, none blocking, both done. Waits for "merge 47".
- Merged on 2026-11-14 on the user's word: #45 (branch deleted) and #46.

## Raw pulls on this computer (gitignored)

- `data/raw/2026-08/20260911T093818Z`: 5,905,376 rows, the 17 bound fields, 177 MB.
- `data/raw/2026-10/20261113T045017Z`: 5,926,990 rows, 36 fields (no `VIN11`, `CHASSIS7`,
  `ENGINE_NUMBER`, `POSTCODE`), 348 MB. Pulled by hand (D-066).
- **No local file holds `VIN11` or `POSTCODE`**: the archive's file was read into a scratch folder
  for the check of D-079 and deleted the same session.
- **Copies:** a backup folder on the project's own disk holds both pulls (SHA-256 checked
  2026-11-13); the user has also copied them to a separate OneDrive (the user's word).
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
4. **The released cube, `cube-2026-10`, has no fact table.** On the public build made from it
   (headless, 390 and 1280 px, 2026-11-14) Explore and Build's default question draw; Build offers
   no control for which vehicles to count, and a link with a condition shows "This view can't be
   drawn from the data yet". A forced run of October or December's refresh ends this.
5. The commits before #47 still hold paths from the user's computer (D-081): history is not
   rewritten.
6. The public build still ships the status page's script chunk, unlinked and holding no data.
7. **Half of the fact table's rows still count one vehicle** (50.2% of rows, 7.1% of vehicles, on
   the 2026-10 dry run). No column describes the owner any more; whether a minimum count is
   wanted anyway is for the Stage 2 privacy review, with the `region` slice's small cells.
8. `/method` and `/caveats` state figures by hand, recomputed for October (#40); they fall a
   month behind at each refresh until the narrative engine (D-062).
9. Seen in the screenshots and not fixed: the map's legend label "0%" hangs outside the chart
    box; "Is the market getting more crowded?" shows a dense grey band before 1970; no dark theme;
    a link's condition on a field Build cannot apply is named by its id ("region"), not its label.
10. The question builder's open follow-ups are on #43; the fact table's and the other reviewers'
    are in CHECKPOINT.

## Where docs and code disagree (noted, not changed)

- **Events are scoped without regard to a preset's filter** (`src/lib/events.ts`), and
  `powertrain-mix` applies one: its markers are chosen as if it counted every vehicle.
  `docs/EVENTS_LAYER.md` now says so; the code is not changed.
- Until #47 merges, `main` still has: the old text of hard rules 7 and 8; "not yet on `main`" in
  `docs/CUBE_SCHEMA.md`; and CLAUDE.md's "a test checks" each sub-agent definition's model, with
  no such test and no `.claude/agents/` yet.
- `deploy.yml`'s step "Is the public site here" can no longer be false on `main`; it is kept for
  a branch cut before #46.
- D-058 says the register has "no owner data": corrected by D-078, and D-058 is not edited.
- D-061 stopped chosen values being ranked and D-062 allows it: the code follows D-061.

## Blocked or waiting on the user

- **"merge 47"**. Whether `ui/explore` is kept. The Cloudflare console steps, when the user
  wants the site public (CHECKPOINT).
- **The dashboard test export**: the user starts it and says "ready" (user, 2026-11-14).
- Also waiting: visitor tests; the brief's §12; two NZTA pages an automated reader cannot open.

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). Checked on
2026-11-13, on what is now `main`: the pipeline tests, 98 passed in 397 s before the review's two
last commits, and the three test files they touch, 67 passed, after; `python -m pipeline build
<the 2026-10 pull> --dry-run`, exit 0 in 11 min 3 s. On the tree that is now `main`: the pipeline
tests, 100 passed in 520 s; `tsc --noEmit` exit 0; `astro build`, 7 pages; headless at 390 and
1280 px, every page and five Build questions; and on 2026-11-14 the public build as `Deploy`
does it against `cube-2026-10`, exit 0 and 5 pages, locally and in run 43420177311.

- `python -m pipeline archive --snapshot YYYY-MM` pulls NZTA's live register (about 186 requests)
  and writes nothing committed. It refuses unless the register still is the built month.
- `data/staging/work.duckdb` (this folder) holds the staged build of the saved August pull.
- NZTA's website (`nzta.govt.nz`) answers automated readers with a block page. Don't work around
  it. Its open data service and Infoshare both answer. Its registrations dashboard
  (`qap.nzta.govt.nz`) is read only from the user's hand exports.
- Headless screenshots: `playwright-core` 1.64.1 in a scratch folder, `executablePath` set to
  Chromium headless shell 1248 under `%LOCALAPPDATA%\ms-playwright`. Serve a build with `npx astro
  preview --port N`, wait until it answers, and stop it with `npx astro preview stop`.
  The Build page's question is in the address bar: `/build/?build.measure=share_and_count`
  `&build.by=parent_group&build.value=BYD&build.value=Geely%20Holding`; a condition is
  `&build.where.<dimension>=<value>`.
- In Git Bash, prefix commands whose arguments start with `/` with `MSYS_NO_PATHCONV=1`, and
  write any script that holds quotes, backticks or backslashes to a file first: a heredoc in the
  Bash tool can break on them.
- Claude Code's permission check refuses a merge into `main` unless the user has said so in the
  session's own messages. If it refuses, say so; do not work around it.
