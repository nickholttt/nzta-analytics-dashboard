# State

Last updated by claude on 2026-11-17

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`. The direction is the user's standing work order,
`docs/brief/WORK_ORDER.md` (D-082), over `docs/brief/MASTER_BRIEF.md` (D-062).

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs on `main` in GitHub Actions.
  - **The last build is the forced run 43637172195** (14 November 2026; snapshot 2026-10;
    5,926,990 rows; no warning): the one forced run the work order allowed. The release
    `cube-2026-10` holds its cube, with the fact table. `Deploy` uploaded nothing.
  - **The build is tried every day** at 06:17 UTC (D-064, D-070). The newest run seen on
    17 November is the 16th's ("Source unchanged").
  - **The archive**: the private repository `nickholttt/nzta-register-archive` holds one
    release, `snapshot-2026-10`, two files (the second holds `VIN11` and `POSTCODE`).
- **`registrations_flow`** (#55, D-092): true first registrations from the user's exports of
  NZTA's dashboard, January 2021 on. **Its counts are committed** in `data/supplied/` (#66,
  D-097): no owner field, and a model name only for vehicle types a total counts. GitHub's
  next build of a new month builds it; the release `cube-2026-10` does not hold it.
- **`registrations_cars_long_run`** (#57, D-094; Stats NZ's cars, 1961 on): the same.
- **`registrations_flow_wider`** (#73, D-113): true registrations with buses, motor caravans
  and special purpose vehicles too. On the site (#77, D-118): Build's third choice, two charts.
- **NZTA's vehicle type is a dimension** (#58, D-095), and on the register dataset so are the
  assembly flag, the class and seats in bands (#79, D-116): breakdowns in Build, and the
  acceptance question passes with one swapped in (#82, D-122). A class reads as NZTA's label
  with its code, from the table the user supplied (#85, D-121).
- **The site shows true registrations and the long run on a local build** (#56, #61; D-093,
  D-098): a group in Explore and a choice of what Build counts; cars first registered each
  month from 1961, and cars still registered set against Stats NZ's count (not a survival
  rate). A build without a dataset says so in place of its charts.
- **The site's code is on `main`**, with `/about` (a draft; two gaps left for the user, D-106),
  `/feedback` (a corrections log, empty) and `/differences` (#49). `Deploy` builds the public
  site from the newest cube release and uploads nothing. **Nothing is deployed**: the
  variable `CLOUDFLARE_PAGES_PROJECT` is unset (checked 2026-11-16).
- **First load is trimmed** (#64, D-099): Explore fetches its first chart, then those near the
  screen; the public build drops what no page reaches, and the deploy checks that first.
- **The engine was audited against the register's rows** (2026-11-16): of 34,693 figures one
  differed, a tie in a ranking. Fixed since (#67 to #69): ties, and a month with nothing counted.
- **Build ranks the values a visitor picks**, labelled as among those picked, and every chart
  downloads its figures as CSV (#71, D-111). The owner's acceptance question passes.
- **Build crosses two fields**, drawn as the sixth shape, `matrix`: a shaded grid with totals,
  as vehicles or a share of all, of the row or of the column (#75, D-114). Two Explore grids.
- **SUV or car per nameplate** is a reference file nothing reads yet (#78, #84; D-117, D-123):
  179 nameplates, 47 rows on a maker's own page.
- **Which shapes fit a question is one rule table** (#62, D-100): `config/chart_rules.json`,
  read by Explore and Build. `Checks` also runs the site's tests and the prototype's (D-101).
- **The data map is finished** (#53, D-090), and **its privacy classes are approved** (the
  user, 2026-11-16, D-096): vehicle fields are public; an owner field only in a table of one
  or two fields with cells under 10 vehicles hidden, and none until the pipeline can hide
  them (package F); the `region` slice stays, and takes the floor of 10 when the first owner
  table is published, which the user sees first (D-120); no postcode totals for now.
- **The query service** is proposed, not provisioned (#54, D-091). **Events**: 54 rows, 50
  verified; four are unverified on purpose. Don't guess dates.

## Current step

**Work order 1**, engine first (the user, D-104). A, B, C and G are done on a local build, and
E but for two pipeline items. Packages F and I are in hand: CHECKPOINT, "The queue".

## In progress (all claude; nothing by gemini)

- Being built, not pushed: `claude/hybrid-rollup` (worktree `nzta-notes`; hybrids as one
  figure, D-124; cut from the closed #83's branch, so its commits are re-made on `main` before
  it is pushed). **#86** `claude/my-questions` (`nzta-firstload`; D-125): open, in review.
- `claude/narrative-spec` (D-102; `nzta-screens`, **uncommitted**): `config/narrative/`.
  D-103's draft scheme file sits untracked in `nzta-segments`.

## Raw files on this computer (gitignored)

- `data/raw/2026-08/20260911T093818Z`: 5,905,376 rows, the 17 bound fields.
- `data/raw/2026-10/20261113T045017Z`: 5,926,990 rows, 36 fields. Pulled by hand (D-066).
- `data/raw/nzta-dashboard/`: the user's exports of NZTA's registrations dashboard (D-084):
  `history/` (January 2021 to October 2026, 1,883,786 vehicles), `2021-01/`, `2026-10/`.
- `data/raw/statsnz/2026-11-14/TPT052601.csv`: Stats NZ's monthly series, 1961-01 to 2026-09,
  fetched read-only from Infoshare; the user's own hand export replaces it later (D-065).
- **No local file holds `VIN11` or `POSTCODE`.**
- **Copies:** a backup folder on the project's disk holds both pulls and both dashboard files.

## Known issues

1. First load at phone width is slow (local, throttled, 2026-11-16, D-099): Explore's first
   chart 4.61 s, a Build answer 6.58 to 10.32 s, against a target of 3 s. Build waits on its
   data: 566 KB to 1,212 KB of fact table, beside about 410 KB of code and fonts.
2. "Area Outside Region" (the Chatham Islands) reaches visitors as is. A link that names a
   band's old `unknown` value, or a class by its bare code, now matches nothing and says nothing.
3. Mild hybrids are identified for about 80% of each dataset's hybrids at high confidence
   over 12 months (D-110's count; 74% before #74 and #80, D-115, D-119). Under 70% a dataset
   shows its hybrids undivided and the build warns (#72): about 2,600 more would do it.
4. **Over half of the fact table's rows count one vehicle** (54.8% of rows, 9.2% of vehicles,
   D-116); no owner field in it (D-096). It grew 28.7% with three fields; not re-timed on a phone.
5. `/method`, `/caveats` and `/differences` are hand-written; the first two state figures and
   fall a month behind at each refresh until the narrative engine (package H; D-086).
6. A share by model draws 300 lines; `/build/` skips a heading level; no dark theme (D-089).
   Notes in config that no lint reads name a value or say why (D-107, D-109; for H). Printing
   or searching a page before scrolling reaches only the charts that have loaded (D-099).
7. New vehicles read 1.4% to 3.9% under published totals on the default scope and 0.06% to
   1.3% under on the wider one, wider in older months, cause not established (D-105, D-113).

## Where docs and code disagree (noted, not changed)

- `docs/brief/MASTER_BRIEF.md` still calls `matrix` proposed, says Plot draws "all five
  shapes", keeps the cap of five waiting pull requests, and says D-061 stops chosen values
  being ranked (Build ranks them since #71, D-111). The work order wins (its §5); the brief is
  updated with the final report (its §6).
- An event marker can appear on a chart whose filter excludes the vehicles the event is about
  (`docs/EVENTS_LAYER.md`, D-089). No chart shows a wrong marker today.
- D-058 says the register has "no owner data": corrected by D-078, and D-058 is not edited.
- NZTA's page says an inactive vehicle is one "registered and registration cancelled in the
  same month". The counts say `INACTIVE` behaves as since removed (`docs/METRICS.md`, D-087).
- `docs/DATA_MAP.md` lists ten places where it disagrees with other files (an engine band
  with no upper limit; a fuel guard looser than the profile supports; stale counts in
  `sentinels.csv`'s notes). Each is fixed when its field is next touched (package F).
- CLAUDE.md's non-goals say postcode figures "wait for the Stage 2 privacy review". The user's
  answer is "not now" (D-096); CLAUDE.md is not edited (the order's §3).

## Blocked or waiting on the user

Nothing stops the work (CHECKPOINT, questions). Waiting on the user: the site's name and
address; the retaken dashboard history; the query service, after the engine's audit (D-120). Waiting on a
date: matching vehicles between two months' archive files needs November's file (December).

## How to run

`AGENTS.md` §Commands has the verified commands. `Checks` runs both suites in about six minutes.

- NZTA's website and its registrations dashboard block automated readers. Don't work around
  it: the dashboard is read only from files the user supplies. NZTA's open data service and
  Stats NZ's Infoshare answer; the Ministry of Transport's site refuses automated readers.
- After supplying a month, build with `--dry-run`: a publishing local build writes the
  dataset into `data/state/last_good.json`, which only the Action commits (hard rule 3).
- Headless screenshots: `playwright-core` 1.64.1 in a scratch folder, `executablePath` set to
  `chrome-headless-shell.exe` in `chromium_headless_shell-1248\chrome-headless-shell-win64`
  under `%LOCALAPPDATA%\ms-playwright`. Serve a build with `npx astro preview --port N` and
  stop it with `npx astro preview stop`. The Build page's question is in the address bar:
  `/build/?build.measure=share&build.by=make`; a condition is
  `&build.where.<dimension>=<value>`; what is counted is `&build.dataset=<id>`.
- In Git Bash, prefix commands whose arguments start with `/` with `MSYS_NO_PATHCONV=1`. Write
  any script that holds quotes or backslashes to a file and run it with `python -I` (a stray
  file in the scratch folder can shadow a module); never feed `python -` from a heredoc.
- A sub-agent that needs its own copy of the repository gets a worktree made by hand
  (`git worktree add`). A worktree has no `.venv` or `node_modules`: give it this folder's
  Python by its full path; a second checkout beside this folder has `node_modules`.
- Before a merge: wait for the `Checks` run on the pull request's newest commit, in a command
  of its own, and only then merge; and never merge while a Monthly build is running (it
  commits to `main` at its end). If Claude Code's permission check refuses a merge into
  `main`, say so and do not work around it (hard rule 7).
