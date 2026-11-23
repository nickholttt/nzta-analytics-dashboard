# State

Last updated by claude on 2026-11-23

A snapshot of now. History is in git and `docs/DECISIONS.md`; the queue and the Lanes table are in
`docs/CHECKPOINT.md`. The direction is the user's work order 3, `docs/brief/WORK_ORDER.md` (D-148): four
lanes at once, public-ready by 12 December 2026. It keeps work order 2's process rules (D-147).

## Live now

- **The pipeline** runs on `main` in GitHub Actions, tried every day (D-064). The last build is the
  forced run of 17 November (snapshot 2026-10; release `cube-2026-10`, 99 files); the daily runs to 22
  November were green and built nothing. The next build is the first to publish the current fleet.
- **The archive** (private, `nickholttt/nzta-register-archive`): one release, `snapshot-2026-10`.
- **Datasets**: `registrations_surviving` (vehicles still registered); `registrations_flow` and
  `registrations_flow_wider` (true registrations from January 2021, from the user's dashboard exports in
  `data/supplied/`, D-097); `registrations_cars_long_run` (Stats NZ's cars from 1961); `fleet` (the
  vehicles registered today by current use and type, small counts hidden, D-135, D-141).
- **The accuracy guard** (D-149, #122): every build sets the figures in
  `data/reference/published_figures.csv` (336, January 2025 to October 2026: the MIA, the MTA's
  vstat, Stats NZ) beside ours and writes `reconciliation.json`. A figure past its tolerance warns; two
  independent sources well past theirs in one month, on the same side, stop the build. A dry run of
  October: 335 pass, 1 warns. The site does not show it yet.
- **The site's code is on `main`; nothing is deployed** (`CLOUDFLARE_PAGES_PROJECT` is unset). Pages:
  Explore, Canvas, Build, Method, Caveats, About (a draft), Feedback, Differences, and a not-found page.
- **Explore** is a list of four starter canvases (`config/starter_canvases.json`, #118, #119), holding
  15 of the 19 live charts with their question titles. **The canvas** (`/canvas`): up to 12 charts, all
  of it in the address; fields dragged or chosen onto zones; the chart type chosen among those that fit,
  the rest greyed with a reason; **My canvases** kept and pinned in the browser. Every chart has one
  generated sentence under it, from `config/narrative/chart_sentences.json` (#121).
- **Build** still has its own page (a measure, values, filters, a second field as a grid; "My
  questions", D-125, D-131). One rule table says which of the six shapes fit (D-100).
- **Every pull request** also builds the public site and checks it (`public-site-checks`, #120): plain
  English, no tracking or third-party requests, each page's title, description and social card, and a
  performance budget (`config/performance_budget.json`).

## Current step

Work order 3, four lanes (CHECKPOINT has the table and each lane's queue). A: steps 1 and 2 of 5 done.
B: items 1 and 2 of 5. C: item 4 and the checks of item 2. D: waiting on NZTA. The engine is frozen for
features, lane B's reconciliation apart (D-148).

## In progress (all claude; nothing by gemini)

- No lane is held. The lane worktrees `nzta-lane-a`, `-b` and `-c` stay beside the repo, each on a merged
  branch with nothing uncommitted. They have no `.venv`; pipeline commands there use the main folder's.
- Worktrees with work that is not on `main`: `nzta-screens` (narrative drafts, **uncommitted**, D-102);
  `nzta-segments` (an untracked draft scheme file, D-103); `nzta-notes` (the closed board proposal).

## Raw files on this computer (gitignored)

- `data/raw/2026-08/`, `data/raw/2026-10/20261113T045017Z` (5,926,990 rows, 36 fields), the
  dashboard exports and Stats NZ's series. No local file holds `VIN11` or `POSTCODE`.
- `public/data` was refreshed on 20 November from a dry-run build of the October pull (111 files, all
  five datasets); it has no `reconciliation.json`. The copy it replaced is `public/data.previous`.

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
7. New vehicles on the default scope read 1.4% to 3.1% under the MIA's total (October 2026 and 2025, and
   each year to October); on the wider scope 0.02% to 0.19% under; passenger vehicles within 0.1%.
   Measured 2026-11-23, not yet written up on the site (lane B item 5).
8. The no-tracking check does not read an unquoted attribute value that follows a quoted one. The
   accuracy guard only warns on a fault confined to one kind of figure (`docs/CUBE_SCHEMA.md`).

## Where docs and code disagree (noted, not changed)

- `docs/brief/MASTER_BRIEF.md` knows no canvas; the order wins. `CLAUDE.md` opens with "Two
  surfaces"; it changes when Build is folded into the canvas (D-148).
- `docs/DATA_MAP.md` lists ten places where it disagrees with other files, fixed as each field is touched.
- `AGENTS.md` §Commands still gives the site's tests as 484 and the public build as 10 scripts.

## Blocked or waiting on the user

Nothing stops the work. Waiting on the user: the site's name and address and the About page's gaps; the
MIA's months before October 2026 (members only); the retaken dashboard history; the Cloudflare clicks.

## How to run

`AGENTS.md` §Commands has the verified commands. The site's tests: 572 passed on 2026-11-23.

- NZTA's dashboard blocks automated readers: it is read only from files the user supplies.
- The public checks, after the public build: `node scripts/check-plain-english.mjs`,
  `check-no-tracking.mjs`, `check-page-metadata.mjs`, `check-performance-budget.mjs --report`.
- Headless screenshots and the axe scan: `playwright-core` and `axe-core` in a scratch folder, with
  `chrome-headless-shell` from `%LOCALAPPDATA%\ms-playwright`; serve a build with `npx astro preview`.
- Before a high-risk pull request, run every test file that builds a cube, not a subset.
- Before a merge: wait for `Checks` on the pull request's newest commit, in a command of its own; never
  merge while a Monthly build is running; never work around a refused merge.
