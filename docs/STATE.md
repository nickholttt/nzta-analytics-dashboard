# State

Last updated by claude on 2026-11-18

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`. The direction is the user's standing work order,
`docs/brief/WORK_ORDER.md` (D-082), over `docs/brief/MASTER_BRIEF.md` (D-062).

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs on `main` in GitHub Actions.
  - **The last build is the forced run 44173471254** (17 Nov, D-134; snapshot 2026-10; one
    warning). Its release `cube-2026-10` (99 files) has no fleet, associations, colour or
    narrow table: those arrive with the next build.
  - **Tried every day** at 06:17 UTC (D-064, D-070); the last daily run listed, 17 November,
    found the source unchanged. None for 18 November had started when this was written.
  - **The archive**: the private repository `nickholttt/nzta-register-archive` holds one
    release, `snapshot-2026-10`, two files (the second holds `VIN11` and `POSTCODE`).
- **`registrations_flow`** (#55, D-092): true first registrations from the user's exports of
  NZTA's dashboard, January 2021 on. **Its counts are committed** in `data/supplied/` (#66,
  D-097): no owner field, and a model name only for vehicle types a total counts. In the
  release `cube-2026-10` since the forced run of 17 November.
- **`registrations_cars_long_run`** (#57, D-094; Stats NZ's cars, 1961 on): the same.
- **`registrations_flow_wider`** (#73, D-113): true registrations with buses, motor caravans
  and special purpose vehicles too. On the site (#77, D-118): Build's third choice, two charts.
- **NZTA's vehicle type is a dimension** (#58, D-095), and on the register dataset so are the
  assembly flag, the class (NZTA's label with its code, D-121) and seats in bands (#79, D-116):
  breakdowns in Build (#82, D-122). **Power in bands and the gearbox in four groups** too
  (#93, D-128), breakdowns starting with vehicles sold new (#96, D-132). **The powertrain
  rolls up to five groups**: hybrids, full or mild, as one share (#87, D-124).
- **The site shows true registrations and the long run on a local build** (#56, #61; D-093,
  D-098): a group in Explore and a choice of what Build counts; cars first registered each
  month from 1961, and cars still registered set against Stats NZ's count (not a survival
  rate). A build without a dataset says so in place of its charts.
- **The site's code is on `main`**, with `/about` (a draft; two gaps left for the user, D-106),
  `/feedback` (a corrections log, empty) and `/differences` (#49). `Deploy` builds the public
  site and uploads nothing. **Nothing is deployed**: `CLOUDFLARE_PAGES_PROJECT` is unset.
  First load is trimmed (#64, D-099). The deploy reads every page of releases and fails before
  the upload past the host's limits, 20,000 files and 25 MiB a file (#106, D-146).
- **The engine was audited against the register's rows** (2026-11-16): one of 34,693 figures
  differed (a tie); fixed in #67 to #69.
- **Build ranks the values a visitor picks**, labelled as among those picked, and every chart
  downloads its figures as CSV (#71, D-111). The owner's acceptance question passes.
- **"My questions"** (#86, D-125): a Build question saved in the browser, redrawn on the newest
  month, able to be pinned. **A link pinned to an earlier month reads that snapshot's own
  cube** where the deploy has kept it (#92, D-131); where it has not, it holds a window.
- **Build crosses two fields**, drawn as the sixth shape, `matrix`: a shaded grid with totals,
  as vehicles or a share of all, of the row or of the column (#75, D-114). Two Explore grids.
- **SUV or car per nameplate**: a file nothing reads yet (#84, D-117, D-123), 179 nameplates;
  a third slice is open as #109 (D-145).
- **One rule table says which shapes fit a question** (#62, D-100, `config/chart_rules.json`).
  Each build writes how strongly every pair of public fields moves together (#99, D-136).
- **Colour** (`colour`, "Colour as recorded") is a slice and sits in the first **narrow fact
  table**, colour by make by powertrain group, beside the wide one (#108, D-144; a contract
  change; dry run: payload 5,759,161 bytes, 72.0% of the budget). The site does not read the
  narrow table yet. **The build refuses an owner field in any fact table** before reading (#107).
- **The data map is finished** (#53, D-090), and **its privacy classes are approved** (the
  user, 2026-11-16, D-096): vehicle fields are public; an owner field only in a table of one
  or two fields with cells under 10 vehicles hidden, and none until the pipeline can hide
  them. **The `region` slice is published under the small-cell rule** (#91, D-127). **"Current
  use"** (vehicle usage) over today's register, alone and by vehicle type, is approved and on
  `main` (#100, #101; D-135, D-139, D-141): a stock dataset `fleet`, a two-field rule with an
  exact audit, hidden cells drawn as hidden; published from the next build. Every other
  owner field waits on the user. Axles have no use for now (#90, D-129).
- **The query service** is proposed, not provisioned (#54, D-091). **Events**: 54 rows, 50
  verified; four are unverified on purpose. Don't guess dates.

## Current step

**Work order 1**, engine first (D-104). A, B, C and G are done on a local build, and E but
for two pipeline items. F's done-when is met (#82); the rest of F and I: CHECKPOINT.

## In progress (all claude; nothing by gemini)

- #109 (`claude/suv-next-slice`, worktree `nzta-suv`): review fixes in progress or done; see
  CHECKPOINT. #105 (`claude/canvas-proposal`, `nzta-notes`): parked for the user.
- `nzta-audit` and `nzta-firstload` hold merged branches, nothing uncommitted.
- `claude/narrative-spec` (D-102; `nzta-screens`, **uncommitted**): `config/narrative/`.
  D-103's draft scheme file sits untracked in `nzta-segments`.

## Raw files on this computer (gitignored)

- `data/raw/2026-08/20260911T093818Z` (5,905,376 rows, 17 fields); `data/raw/2026-10/20261113T045017Z`
  (5,926,990 rows, 36 fields, pulled by hand, D-066); `data/raw/nzta-dashboard/` (the user's exports,
  D-084: `history/` January 2021 to October 2026, 1,883,786 vehicles); `data/raw/statsnz/2026-11-14/`
  (Stats NZ's series to 2026-09, from Infoshare; the user's own export replaces it, D-065).
- **No local file holds `VIN11` or `POSTCODE`.** A backup folder holds the pulls and exports.

## Known issues

1. First load at phone width is slow (local, throttled, 2026-11-16, D-099): Explore's first
   chart 4.61 s, a Build answer 6.58 to 10.32 s, against 3 s. Not timed since the table grew.
2. "Area Outside Region" (the Chatham Islands) reaches visitors as is.
3. Mild hybrids are identified for about 80% of hybrids at high confidence (D-110, D-119).
4. **Over half of the wide fact table's rows count one vehicle** (54.8%, D-116, before D-128).
5. `/method`, `/caveats` and `/differences` are hand-written; the first two state figures and
   fall a month behind at each refresh until the narrative engine (package H; D-086).
6. A share by model draws 300 lines; `/build/` skips a heading level; no dark theme (D-089).
   Notes in config that no lint reads name a value or say why (D-107, D-109; for H). Printing
   or searching a page before scrolling reaches only the charts that have loaded (D-099).
7. New vehicles read 1.4% to 3.9% under published totals on the default scope and 0.06% to
   1.3% under on the wider one, wider in older months, cause not established (D-105, D-113).

## Where docs and code disagree (noted, not changed)

- `docs/brief/MASTER_BRIEF.md` calls `matrix` proposed, says "all five shapes", keeps the cap of
  five waiting pull requests and says chosen values are not ranked (D-111 ranks them). The work
  order wins (§5); the brief is updated with the final report (§6).
- An event marker can sit on a chart whose filter excludes its vehicles (D-089); none does today.
- NZTA calls `INACTIVE` cancelled in the same month; the counts say since removed (D-087).
- D-058's "no owner data" is corrected by D-078. `docs/DATA_MAP.md` lists ten places where it
  disagrees with other files (an engine band with no upper limit; a looser fuel guard; stale
  counts in `sentinels.csv`'s notes). Each is fixed when its field is next touched.
- CLAUDE.md's non-goals say postcode figures "wait for the Stage 2 privacy review"; the user's
  answer is "not now" (D-096). Its layout lists neither the narrow fact table (D-144) nor the SUV
  file's later slices. CLAUDE.md is not edited during the order (§3).

## Blocked or waiting on the user

Nothing stops the work (CHECKPOINT, questions). Waiting on the user: the site's name and
address; the retaken dashboard history; the query service, after the engine's audit (D-120);
the board proposal (#105, D-143), parked with three questions.
Waiting on a date: what the dashboard's usage column records needs November's archive file.

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
