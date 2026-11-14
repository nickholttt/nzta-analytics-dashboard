# State

Last updated by claude on 2026-11-15

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`. The direction is the user's standing work order,
`docs/brief/WORK_ORDER.md` (D-082), over `docs/brief/MASTER_BRIEF.md` (D-062).

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs on `main` in GitHub Actions.
  - `main` is the merge of #56, on `720523a` (the merge of #55).
  - **The last build is the forced run 43637172195** (14 November 2026, 20:22 UTC; snapshot
    2026-10; 5,926,990 rows; no warning). It was the one forced run the work order allowed, made
    after the daily run 43600595387 reported "Source unchanged". Its cube replaced the file of
    the release `cube-2026-10`, which now holds the fact table. Its state commit is `c418ab1`;
    the archive job did nothing (October was already archived); `Deploy` uploaded nothing.
  - **The build is tried every day** at 06:17 UTC (D-064, D-070). GitHub started the first
    daily run seven hours late.
  - **The archive**: the private repository `nickholttt/nzta-register-archive` holds one
    release, `snapshot-2026-10`, two files, unchanged (39,298,142 and 55,125,916 bytes; the
    second holds `VIN11` and `POSTCODE`).
  - `Checks` tests every pull request into `main` (the pipeline's tests only).
- **`registrations_flow` is built wherever its store is** (#55, D-092): true first
  registrations from the user's exports of NZTA's dashboard, January 2021 on, through
  `python -m pipeline supply` and the register's own code. The store is on this computer only
  (gitignored `data/supplied/`), so GitHub's builds mark the dataset `not_built`.
- **The site shows it on a local build** (#56, D-093): a group in Explore (the month's count
  against a year ago, brands and models ranked for any month, completeness, powertrain share)
  and a choice of what Build counts. On a build without the dataset it says so plainly.
- **The site's code is on `main`**, with `/about` (a draft with six gaps for the user),
  `/feedback` (a corrections log, empty) and `/differences` (#49). `Deploy` builds the public
  site from the newest cube release and uploads nothing. **Nothing is deployed**: the
  variable `CLOUDFLARE_PAGES_PROJECT` is unset (checked 2026-11-15).
- **The data map is finished** (#53, D-090): `docs/DATA_MAP.md`, `config/data_map.json`, tests.
  Its privacy classes are proposed, not approved; nothing is bound by it.
- **The query service is specified, prototyped and proposed** (#54, D-091): a local prototype
  behind a switch that is off. Nothing is provisioned.
- **Events**: 54 rows, 50 verified; four are unverified on purpose. Don't guess dates.

## Current step

**Work order 1.** A, B, G and the first part of E are done; C is being built. D's first-load
work, the rest of E, F, H and I are not started. One report at the end (D-082).

## In progress (all claude; nothing by gemini)

| Branch | What | State when this was written |
|---|---|---|
| `claude/statsnz-long-run` | Package C: `supply statsnz_tpt`, the dataset `registrations_cars_long_run` from Stats NZ's series (plan: `data/staging/work-order/spec-C-statsnz.md`) | A sonnet worker is mid-way, in a git worktree in the session's scratch folder (`git worktree list`); local, not pushed |

- **This folder's `public/data`** (gitignored) is the dry-run build of #55: both datasets.
  `data/supplied/nzta_dashboard/` (gitignored) is the converted store, with its ledger.
- Gitignored and local: the field profile behind the data map
  (`data/staging/profiles/2026-10/`) and the packages' plans (`data/staging/work-order/`).

## Branches and pull requests (checked 2026-11-15)

- Merged in this session: #47 to #56. **No pull request is open.**
- `ui/explore` is deleted on GitHub; a local branch of that name remains, far behind.

## Raw files on this computer (gitignored)

- `data/raw/2026-08/20260911T093818Z`: 5,905,376 rows, the 17 bound fields.
- `data/raw/2026-10/20261113T045017Z`: 5,926,990 rows, 36 fields. Pulled by hand (D-066).
- `data/raw/nzta-dashboard/`: the user's exports of NZTA's registrations dashboard (D-084).
  - `history/`: January 2021 to October 2026, 991,274 rows, 1,883,786 vehicles; `2021-01/`:
    January 2021 alone; `2026-10/`: the first hand export, NZTA's page, screenshots (D-075).
- `data/raw/statsnz/2026-11-14/TPT052601.csv`: Stats NZ's monthly series, January 1961 to
  September 2026, 26 series, 95,024 bytes. Fetched read-only from Infoshare for building and
  testing (the work order §2); the user's own hand export replaces it (D-065).
- **No local file holds `VIN11` or `POSTCODE`.**
- **Copies:** a backup folder on the project's own disk holds both register pulls and both
  dashboard CSV files (SHA-256 checked). The user's Downloads folder still holds two more
  copies of the history file; they are the user's to delete.

## Known issues

1. First load at phone width is slow: a Build question's first answer takes 7.4 to 11.6 s
   (local, throttled, 2026-11-14, D-091). About 460 KB of each page is its own code and fonts.
2. "Area Outside Region" (the Chatham Islands) reaches visitors as is. On a filtered powertrain
   chart the mild hybrid coverage note states the whole dataset's coverage.
3. Mild hybrids are identified for 62.7% of `registrations_flow`'s hybrids at high confidence
   over the trailing 12 months, under the 70% the pipeline warns at (D-092).
4. Commits before #47 still hold paths from the user's computer (D-081); history stays as is.
5. **Half of the fact table's rows count one vehicle** (50.2% of rows, 7.1% of vehicles, on the
   2026-10 dry run). Whether a minimum count is wanted is for the Stage 2 privacy review.
6. `/method`, `/caveats` and `/differences` are hand-written; the first two state figures and
   fall a month behind at each refresh until the narrative engine (package H; D-086).
7. In Build a model's name shows as its two parts joined by `|` everywhere but the ranking; a
   share by model draws 300 lines; `/build/` skips a heading level; no dark theme (D-089).
8. The public build still ships the status page's script chunk, unlinked, holding no data.
9. The site's own tests (`tests/site/`, Node's test runner) and the query service
   prototype's tests are run by hand: `Checks` runs `pipeline/tests` only.

## Where docs and code disagree (noted, not changed)

- CLAUDE.md and AGENTS.md say six shapes; five have renderers, and `src/lib/resolve.ts` still
  says "all five". The `matrix` renderer is package F.
- `docs/brief/MASTER_BRIEF.md` still calls `matrix` proposed, says Plot draws "all five
  shapes", and keeps the cap of five waiting pull requests. The work order wins (its §5); the
  brief is updated with the final report (its §6).
- CLAUDE.md's repo layout still marks `docs/DATA_MAP.md` as planned and does not list
  `config/data_map.json`, `config/narrative/`'s first file, `data/supplied/` or `tests/site/`.
- An event marker can appear on a chart whose filter excludes the vehicles the event is about
  (`docs/EVENTS_LAYER.md`, D-089). No chart shows a wrong marker today.
- D-058 says the register has "no owner data": corrected by D-078, and D-058 is not edited.
- D-061 stopped chosen values being ranked; D-062 allows it. The code follows D-061 until F.
- NZTA's page says an inactive vehicle is one "registered and registration cancelled in the
  same month". The counts say `INACTIVE` behaves as since removed (`docs/METRICS.md`, D-087).
- `docs/DATA_MAP.md` lists ten places where it disagrees with other files (an engine band
  with no upper limit; a fuel guard looser than the profile supports; stale counts in
  `sentinels.csv`'s notes). Each is fixed when its field is next touched (package F).
- A `region` slice is published, and the work order §3 names region among the fields not
  published without asking. It predates the order (D-078); keeping it is the user's question.

## Blocked or waiting on the user

Nothing stops the work. Parked for the final report (CHECKPOINT, questions).

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). On
2026-11-15: the pipeline tests, 254 passed locally in 650 s on what became #55, and they pass
in `Checks` in about 90 s; a dry-run build with the store, exit 0 in 741 s; on what became
#56, `tsc --noEmit` exit 0, `astro build` with and without the dataset, the site's 11 tests
(`node --test "tests/site/*.test.ts"`), and the new pages headless at 320, 390 and 1280 px.

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
