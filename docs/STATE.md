# State

Last updated by claude on 2026-11-16

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`. The direction is the user's standing work order,
`docs/brief/WORK_ORDER.md` (D-082), over `docs/brief/MASTER_BRIEF.md` (D-062).

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs on `main` in GitHub Actions.
  - `main` is the merge of #60.
  - **The last build is the forced run 43637172195** (14 November 2026; snapshot 2026-10;
    5,926,990 rows; no warning): the one forced run the work order allowed. The release
    `cube-2026-10` holds its cube, with the fact table. `Deploy` uploaded nothing.
  - **The build is tried every day** at 06:17 UTC (D-064, D-070); the run of 15 November
    said "Source unchanged".
  - **The archive**: the private repository `nickholttt/nzta-register-archive` holds one
    release, `snapshot-2026-10`, two files (the second holds `VIN11` and `POSTCODE`).
- **`registrations_flow` is built wherever its store is** (#55, D-092): true first
  registrations from the user's exports of NZTA's dashboard, January 2021 on, through
  `python -m pipeline supply` and the register's own code. The store is on this computer only
  (gitignored `data/supplied/`), so GitHub's builds mark the dataset `not_built`.
- **`registrations_cars_long_run` is built wherever its store is** (#57, D-094): Stats NZ's
  count of cars first registered each month, January 1961 on. The site does not show it yet.
- **NZTA's vehicle type is a dimension** on the two datasets built from vehicle rows (#58,
  D-095), with a pair on the survivors. The next build on GitHub writes it for the survivors.
- **The site shows true registrations on a local build** (#56, D-093): a group in Explore
  and a choice of what Build counts. On a build without the dataset it says so plainly.
- **The site's code is on `main`**, with `/about` (a draft; three gaps left for the user, D-096),
  `/feedback` (a corrections log, empty) and `/differences` (#49). `Deploy` builds the public
  site from the newest cube release and uploads nothing. **Nothing is deployed**: the
  variable `CLOUDFLARE_PAGES_PROJECT` is unset (checked 2026-11-16).
- **The data map is finished** (#53, D-090), and **its privacy classes are approved** (the
  user, 2026-11-16, D-096): vehicle fields are public; an owner field only in a table of one
  or two fields with cells under 10 vehicles hidden, and none until the pipeline can hide
  them (package F); the `region` slice stays; postcode totals are not published for now.
- **The query service is specified, prototyped and proposed** (#54, D-091); nothing is provisioned.
- **Events**: 54 rows, 50 verified; four are unverified on purpose. Don't guess dates.

## Current step

**Work order 1.** A, B, G, the first part of E and C's pipeline half are done. In hand: C's
charts, D's first load. Then the rest of E, F, H and I. One report at the end (D-082).

## In progress (all claude; nothing by gemini)

Three branches, each in its own worktree (`git worktree list`), started 2026-11-16; none
has a pull request yet. (#60, the user's answers of 16 November, D-096, is merged.)

- `claude/stores-in-repo` (D-097): both supplied sources' counts as files in the repository.
  `pipeline/supplied.py`, `pipeline/series.py`, their tests, `data/supplied/`, AGENTS.md,
  `docs/CUBE_SCHEMA.md`, `docs/DATA_SOURCES.md`, two playbooks.
- `claude/long-run-charts` (D-098): package C's charts, completeness by vehicle type.
  `config/presets.json`, `src/lib/derived.ts`, `src/lib/resolve.ts`, renderers, `tests/site/`.
- `claude/first-load` (D-099): package D's first-load trim and the status page's chunk.
  `astro.config.mjs`, the layout, fonts, `src/lib/data.ts`.

- **This folder's `public/data`** (gitignored) is the dry-run build of #58: three datasets.
  Also local: both stores in `data/supplied/`; the data map's field profile in `data/staging/`.

## Raw files on this computer (gitignored)

- `data/raw/2026-08/20260911T093818Z`: 5,905,376 rows, the 17 bound fields.
- `data/raw/2026-10/20261113T045017Z`: 5,926,990 rows, 36 fields. Pulled by hand (D-066).
- `data/raw/nzta-dashboard/`: the user's exports of NZTA's registrations dashboard (D-084).
  - `history/`: January 2021 to October 2026, 991,274 rows, 1,883,786 vehicles; `2021-01/`:
    January 2021 alone; `2026-10/`: the first hand export, NZTA's page, screenshots (D-075).
- `data/raw/statsnz/2026-11-14/TPT052601.csv`: Stats NZ's monthly series, 1961-01 to 2026-09,
  fetched read-only from Infoshare; the user's own hand export replaces it later (D-065).
- **No local file holds `VIN11` or `POSTCODE`.**
- **Copies:** a backup folder on the project's own disk holds both register pulls and both
  dashboard CSV files (SHA-256 checked); two more of the history file are in Downloads.

## Known issues

1. First load at phone width is slow: a Build question's first answer takes 7.4 to 11.6 s
   (local, throttled, 2026-11-14, D-091). About 460 KB of each page is its own code and fonts.
2. "Area Outside Region" (the Chatham Islands) reaches visitors as is. On a filtered powertrain
   chart the mild hybrid coverage note states the whole dataset's coverage.
3. Mild hybrids are identified for 62.7% of `registrations_flow`'s hybrids at high confidence
   over the trailing 12 months, under the 70% the pipeline warns at (D-092).
4. **Half of the fact table's rows count one vehicle** (50.2% of rows, 7.1% of vehicles, on the
   2026-10 dry run). It holds no owner field; the user's minimum of 10 is for owner fields (D-096).
5. `/method`, `/caveats` and `/differences` are hand-written; the first two state figures and
   fall a month behind at each refresh until the narrative engine (package H; D-086).
6. In Build a model's name shows as its two parts joined by `|` everywhere but the ranking; a
   share by model draws 300 lines; `/build/` skips a heading level; no dark theme (D-089).
7. The public build still ships the status page's script chunk, unlinked, holding no data.
8. The site's tests (`tests/site/`) and the query service prototype's tests are run by hand:
   `Checks` runs `pipeline/tests` only. Commits before #47 hold local paths (D-081).

## Where docs and code disagree (noted, not changed)

- CLAUDE.md and AGENTS.md say six shapes; five have renderers, and `src/lib/resolve.ts` still
  says "all five". The `matrix` renderer is package F.
- `docs/brief/MASTER_BRIEF.md` still calls `matrix` proposed, says Plot draws "all five
  shapes", and keeps the cap of five waiting pull requests. The work order wins (its §5); the
  brief is updated with the final report (its §6).
- CLAUDE.md's repo layout still marks `docs/DATA_MAP.md` as planned and does not list
  `config/data_map.json`, `config/narrative/`'s first file, `data/supplied/`, `tests/site/` or
  `data/reference/statsnz_series.csv`.
- An event marker can appear on a chart whose filter excludes the vehicles the event is about
  (`docs/EVENTS_LAYER.md`, D-089). No chart shows a wrong marker today.
- D-058 says the register has "no owner data": corrected by D-078, and D-058 is not edited.
- D-061 stopped chosen values being ranked; D-062 allows it. The code follows D-061 until F.
- NZTA's page says an inactive vehicle is one "registered and registration cancelled in the
  same month". The counts say `INACTIVE` behaves as since removed (`docs/METRICS.md`, D-087).
- `docs/DATA_MAP.md` lists ten places where it disagrees with other files (an engine band
  with no upper limit; a fuel guard looser than the profile supports; stale counts in
  `sentinels.csv`'s notes). Each is fixed when its field is next touched (package F).
- CLAUDE.md's non-goals say postcode figures "wait for the Stage 2 privacy review". The user's
  answer is "not now" (D-096); CLAUDE.md is not edited (the order's §3).

## Blocked or waiting on the user

Nothing stops the work (CHECKPOINT, questions). Waiting on the user: the code's licence;
who runs the site, its name and address (the About page's gaps); the retaken dashboard
history, due in the user's Downloads folder. Waiting on a date: matching vehicles between
two months' archive files needs November's file (December).

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). `Checks` runs
the pipeline tests in about two minutes (#60). In a fresh worktree on 2026-11-16: `astro build`
10 pages, then `tsc --noEmit` exit 0 (the build writes the types it needs), the site's 11 tests.

- NZTA's website and its registrations dashboard block automated readers. Don't work around
  it: the dashboard is read only from files the user supplies. NZTA's open data service and
  Stats NZ's Infoshare both answer.
- After supplying a month, build with `--dry-run`: a publishing local build writes the
  dataset into `data/state/last_good.json`, which only the Action commits (hard rule 3).
- Headless screenshots: `playwright-core` 1.64.1 in a scratch folder, `executablePath` set to
  `chrome-headless-shell.exe` in `chromium_headless_shell-1248\chrome-headless-shell-win64`
  under `%LOCALAPPDATA%\ms-playwright`. Serve a build with `npx astro preview --port N` and
  stop it with `npx astro preview stop`. The Build page's question is in the address bar:
  `/build/?build.measure=share&build.by=make`; a condition is
  `&build.where.<dimension>=<value>`; what is counted is `&build.dataset=<id>`.
- In Git Bash, prefix commands whose arguments start with `/` with `MSYS_NO_PATHCONV=1`.
  Write any script that holds quotes or backslashes to a file; never feed `python -` from a
  heredoc (it can hang and leave a process behind).
- A sub-agent that needs its own copy of the repository gets a worktree made by hand
  (`git worktree add`). A worktree has no `.venv` or `node_modules`: give it this folder's
  Python by its full path; a second checkout beside this folder has `node_modules`.
- Before a merge: wait for the `Checks` run on the pull request's newest commit, in a command
  of its own, and only then merge; and never merge while a Monthly build is running (it
  commits to `main` at its end). If Claude Code's permission check refuses a merge into
  `main`, say so and do not work around it (hard rule 7).
