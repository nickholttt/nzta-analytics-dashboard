# State

Last updated by claude on 2026-11-23

A snapshot of now. History is in git and `docs/DECISIONS.md` (an index of D-001 to D-140, then
the records since); the queue and the Lanes table are in `docs/CHECKPOINT.md`. The direction is the user's work
order 3, `docs/brief/WORK_ORDER.md` (D-148): four lanes at once, public-ready by 12 December 2026.
It keeps work order 2's process rules (D-147).

## Live now

- **The pipeline** runs on `main` in GitHub Actions, tried every day (D-064). The last build
  is the forced run of 17 November (snapshot 2026-10; release `cube-2026-10`, 99 files). The
  daily runs to 22 November were green and built nothing, so there is no November build yet.
  The next build is the first to publish the current fleet, colour and the narrow table.
- **The archive** (private, `nickholttt/nzta-register-archive`): one release, `snapshot-2026-10`.
- **Datasets**: `registrations_surviving` (vehicles still registered); `registrations_flow`
  and `registrations_flow_wider` (true registrations from January 2021, from the user's
  dashboard exports, committed in `data/supplied/`, D-097); `registrations_cars_long_run`
  (Stats NZ's cars from 1961); `fleet` (the vehicles registered today by current use and
  type, small counts hidden, D-135, D-141).
- **The site's code is on `main`; nothing is deployed** (`CLOUDFLARE_PAGES_PROJECT` is
  unset). Pages: Explore, Canvas, Build, Method, Caveats, About (a draft; its gaps are the
  user's), Feedback, Differences.
- **The canvas** (`/canvas`; work order 2 milestone 1; #113 to #116): a page of up to 12
  charts, all of it in the address. A chart is built by dragging a field onto its zones or
  by choosing a field and saying where it goes; a zone that cannot take it says why. The
  chart type is chosen among those that fit; the rest are greyed with a reason. Charts are
  added, copied, removed, moved (buttons or dragging) and set to half or full width. **My
  canvases** keeps and pins canvases in the browser, under Build's rules. A chart says what
  its link asked for and did not get. Build steps 1 to 4 of 6 are done.
- **Build** asks one question (a measure, values, filters, a second field as a grid), with
  "My questions" kept in the browser and pinnable (D-125, D-131). **Explore** shows the canon.
  One rule table says which of the six shapes fit a question (D-100). The data map is
  finished and its privacy classes approved (D-090, D-096).

## Current step

Work order 3, four lanes in parallel (CHECKPOINT has the table and each lane's queue): A,
finish the canvas; B, the accuracy guard; C, public readiness; D, the December refresh. The
engine is frozen for features, lane B's reconciliation apart (D-148).

## In progress (all claude; nothing by gemini)

- Started 2026-11-23, a worktree and branch per lane, none merged: `nzta-lane-a` (starter
  canvases), `nzta-lane-b` (the reference files and the reconciliation step), `nzta-lane-c`
  (the visitor-test kit). Branches are in CHECKPOINT's Lanes table. The main folder holds
  nothing uncommitted.
- Worktrees with work that is not on `main`: `nzta-screens` (package H's narrative drafts,
  **uncommitted**: `config/narrative/`, D-102); `nzta-segments` (an untracked draft scheme
  file, D-103); `nzta-notes` (the closed board proposal's branch and its mockups).

## Raw files on this computer (gitignored)

- `data/raw/2026-08/`, `data/raw/2026-10/20261113T045017Z` (5,926,990 rows, 36 fields), the
  dashboard exports and Stats NZ's series. No local file holds `VIN11` or `POSTCODE`.
- `public/data` was refreshed on 20 November from a dry-run build of the October pull (exit 0
  in 835 s; 111 files, all five datasets). The copy it replaced is `public/data.previous`.

## Known issues

1. First load on the throttled phone profile (2026-11-20, median of five): the canvas's first
   chart 3.93 s; the acceptance question 7.32 s on the canvas and 7.49 s on Build; the target
   is 3 s. A cold canvas downloads 514 KB, of which code is 306 KB and fonts 169 KB.
2. The canvas has no dark theme, and no sentence under a lines, bands or map chart. A chart
   pinned to a kept snapshot has not been seen in a browser (no earlier cube release exists).
   Cards are tall, so dragging one past another scrolls the page; the Move buttons do the same.
3. "Area Outside Region" (the Chatham Islands) reaches visitors as is.
4. Mild hybrids are identified for about 80% of hybrids at high confidence (D-110, D-119).
5. `/method`, `/caveats` and `/differences` are hand-written and fall behind at each refresh.
6. A share by model draws 300 lines; `/build/` skips a heading level. New vehicles read 1.4%
   to 3.9% under published totals on the default scope, 0.06% to 1.3% on the wider (D-113).

## Where docs and code disagree (noted, not changed)

- `docs/brief/MASTER_BRIEF.md` knows no canvas; the order wins. `CLAUDE.md` opens with "Two
  surfaces"; it changes when Build is folded into the canvas (D-148).
- `docs/DATA_MAP.md` lists ten places where it disagrees with other files; each is fixed when
  its field is next touched.

## Blocked or waiting on the user

Nothing stops the work. Waiting on the user: the site's name and address and the About
page's gaps; the retaken dashboard history; the Cloudflare clicks. Waiting on a date: NZTA's
December refresh (November's build and archive, then the dashboard usage-column check).

## How to run

`AGENTS.md` §Commands has the verified commands. `Checks` took 12 to 13 minutes on 20 November.

- NZTA's website and its registrations dashboard block automated readers: the dashboard is
  read only from files the user supplies. NZTA's open data service and Stats NZ's Infoshare
  answer. After supplying a month, build with `--dry-run` (hard rule 3).
- Headless screenshots and the axe scan: `playwright-core` and `axe-core` in a scratch folder,
  with `chrome-headless-shell` from `%LOCALAPPDATA%\ms-playwright`. Serve a build with
  `npx astro preview --port N`; stop it with `npx astro preview stop`. In a headless drag,
  move the mouse in steps and keep both ends on screen; a button greyed with a reason needs
  `click({ force: true })`. A canvas link: `/canvas/?canvas.charts=c1&c1.measure=count&c1.by=make`.
- Before a merge: wait for `Checks` on the pull request's newest commit, in a command of its
  own; never merge while a Monthly build is running; never work around a refused merge.
