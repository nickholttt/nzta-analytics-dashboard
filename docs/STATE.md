# State

Last updated by claude on 2026-11-24

A snapshot of now. History is in git and `docs/DECISIONS.md`; the queue and the Lanes table are in
`docs/CHECKPOINT.md`. The direction is the user's work order 3, `docs/brief/WORK_ORDER.md` (D-148): four
lanes at once, public-ready by 12 December 2026. It keeps work order 2's process rules (D-147).

## Live now

- **The pipeline** runs on `main` in GitHub Actions, tried every day (D-064). The last build is the
  forced run of 17 November (snapshot 2026-10; release `cube-2026-10`, 99 files); the daily runs to 22
  November were green and built nothing. The next build is the first to publish the current fleet.
- **The archive** (private, `nickholttt/nzta-register-archive`): one release, `snapshot-2026-10`.
- **Datasets**: `registrations_surviving` (vehicles still registered); `registrations_flow` and
  `registrations_flow_wider` (true registrations from January 2021, the user's dashboard exports in
  `data/supplied/`, D-097); `registrations_cars_long_run` (Stats NZ's cars from 1961); `fleet` (vehicles
  registered today by current use and type, small counts hidden, D-135, D-141).
- **The accuracy guard** (D-149 to D-151; #122, #126, #127): every build sets 389 published figures
  (`published_figures.csv`: the MIA's public releases, the MTA's vstat, Stats NZ; three sources a month,
  January 2025 to October 2026) beside ours and writes `reconciliation.json`. Past its tolerance a figure
  warns. The build stops on two independent sources well past theirs in a month, or on one passenger,
  commercial or total figure 5% or more from ours (147 rows). Dry run, 2026-11-24: 388 pass, 1 warns.
  **The site shows it** (#125) on the Differences page and `/status`, once a build writes the file.
- **The site's code is on `main`; nothing is deployed** (`CLOUDFLARE_PAGES_PROJECT` is unset). Pages:
  Explore, Canvas, Build, Method, Caveats, About (a draft), Feedback, Differences, and a not-found page.
- **Explore** is a list of four starter canvases (`config/starter_canvases.json`, #118, #119), holding
  15 of the 19 live charts. **The canvas** (`/canvas`): up to 12 charts, all of it in the address;
  fields dragged or chosen onto zones; the chart type chosen among those that fit, the rest greyed with
  a reason; **My canvases** kept in the browser; one generated sentence under every chart (#121).
- **Build** still has its own page (a measure, values, filters, a second field as a grid; "My
  questions", D-125, D-131). One rule table says which of the six shapes fit (D-100).
- **Every pull request** also builds the public site and checks it (`public-site-checks`, #120): plain
  English, no tracking, each page's title, description and social card, and a performance budget.

## Current step

Work order 3, four lanes (CHECKPOINT has the table and each lane's queue). A: steps 1 and 2 of 5 done.
B: items 1 to 3 of 5, and October's rows of item 4. C: item 4 and the checks of item 2. D: waiting on
NZTA. The engine is frozen for features, lane B's reconciliation apart (D-148).

## In progress (all claude; nothing by gemini)

- No lane is held. The lane worktrees `nzta-lane-a`, `-b`, `-b-site` and `-c` are each on a merged
  branch with nothing uncommitted. They have no `.venv`; pipeline commands there use the main folder's.
- Worktrees with work that is not on `main`: `nzta-screens` (narrative drafts, **uncommitted**, D-102);
  `nzta-segments` (an untracked draft scheme file, D-103); `nzta-notes` (the closed board proposal).

## Raw files on this computer (gitignored)

- `data/raw/2026-08/`, `data/raw/2026-10/20261113T045017Z` (5,926,990 rows, 36 fields), the
  dashboard exports and Stats NZ's series. No local file holds `VIN11` or `POSTCODE`.
- `public/data` (refreshed 20 November) has no `reconciliation.json`, so the local site says the
  comparison is not there yet. A dry-run build of 2026-11-24 that has it is in `data/staging/build` of
  `nzta-lane-b-site`; the swap waits on the user (the playbook says to ask).

## Known issues

1. First load on the throttled phone profile (2026-11-20, not measured since): the canvas's first chart
   3.93 s against a target of 3 s. Code was 306 KB and fonts 169 KB of a cold canvas.
2. The canvas has no dark theme. The map's sentence has not been seen with live data (the region table
   hides small counts), nor a chart pinned to a kept snapshot (no earlier cube).
3. On the canvas at 1280 px, 39 of 66 controls are smaller than 44 px (lane C's audit). A canvas link
   naming a measure or month the data lacks draws a default chart and says nothing.
4. Three Explore charts are on no starter canvas: the age of used imports (the canvas has no
   "last 12 months" for bands), and two that need a measure worked out from two others.
5. "Area Outside Region" (the Chatham Islands) reaches visitors as is. Mild hybrids are identified for
   about 80% of hybrids at high confidence (D-110, D-119).
6. `/method`, `/caveats` and `/differences` are hand-written and fall behind at each refresh.
7. Beside the MIA's public figures by month (2026-11-24, D-151): on the wider scope ours is 0.06% to
   0.56% under its total (21 months), 0.65% under to 0.01% over its passenger figure and 0% to 0.80%
   under its commercial figures (19 months each). The Differences page still gives 16 November's figures.
8. The no-tracking check does not read an unquoted attribute value that follows a quoted one. One source
   restating a covered figure by 5% or more stops the monthly build until its row is corrected (D-150).

## Where docs and code disagree (noted, not changed)

- `docs/brief/MASTER_BRIEF.md` knows no canvas; the order wins. `CLAUDE.md` opens with "Two
  surfaces"; it changes when Build is folded into the canvas (D-148).
- `docs/DATA_MAP.md` lists ten places where it disagrees with other files, fixed as each field is touched.
- `AGENTS.md` §Commands still gives the site's tests as 484 and the public build as 10 scripts.
- vstat prints its October 2026 totals on its page; their rows still say "added up" (the figures are equal).

## Blocked or waiting on the user

Nothing stops the work. Waiting on the user: the site's name and address and the About page's gaps; the
retaken dashboard history; the Cloudflare clicks; Scoop's notice and the `public/data` swap (CHECKPOINT).

## How to run

`AGENTS.md` §Commands has the verified commands. The site's tests: 595 passed on 2026-11-24.

- NZTA's dashboard blocks automated readers: it is read only from files the user supplies.
- The public checks, after the public build: `node scripts/check-plain-english.mjs`, and the same for
  `check-no-tracking`, `check-page-metadata` and `check-performance-budget` (`--report`).
- Headless screenshots and the axe scan: `playwright-core` and `axe-core` in a scratch folder, with
  `chrome-headless-shell` from `%LOCALAPPDATA%\ms-playwright`; serve a build with `npx astro preview`.
- Before a high-risk pull request, run every test file that builds a cube. Before a merge, wait for
  `Checks` on the newest commit in a command of its own; never merge during a Monthly build or round a refusal.
