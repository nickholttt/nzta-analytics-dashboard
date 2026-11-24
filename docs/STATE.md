# State

Last updated by claude on 2026-11-25 (the session of 25 November)

A snapshot of now. History is in git and `docs/DECISIONS.md`; the queue and the Lanes table are in
`docs/CHECKPOINT.md`. The direction is work order 3, `docs/brief/WORK_ORDER.md` (D-148; D-147's rules).

## Live now

- **The pipeline** runs on `main` in GitHub Actions, tried every day (D-064). The last build is the
  forced run of 17 November (snapshot 2026-10; release `cube-2026-10`); the daily runs to 24 November
  were green and built nothing. The next build is the first to publish the current fleet. The private
  archive (`nickholttt/nzta-register-archive`) holds one release, `snapshot-2026-10`.
- **Datasets**: `registrations_surviving`; `registrations_flow` and `registrations_flow_wider` (from
  January 2021, D-097); `registrations_cars_long_run` (from 1961); `fleet` (D-135, D-141).
- **The accuracy guard** (D-149 to D-153): every build sets 389 published figures beside ours. Past its
  tolerance a figure warns; two independent sources well past theirs in a month, or one passenger,
  commercial or total figure 5% or more from ours, stop the build. A source restating its own figure by
  5% or more warns and is listed on `/status`; it stops the build only when ours is 5% or more from both
  its figures (D-153, #135). The MIA's 59 rows link to its own site (6), GoAuto (45), Autofile (1),
  Autotrader NZ (1) and Scoop (6; D-152, #134). Dry run on `main`, 2026-11-24: 388 pass, 1 warns.
- **Market type is defined and tested, not built** (D-154, #146): nothing reads `market_type_map.csv`.
- **The site's code is on `main`; nothing is deployed** (`CLOUDFLARE_PAGES_PROJECT` is unset). Pages:
  Explore, Canvas, Method, Caveats, About (a draft), Feedback, Differences and a not-found page.
- **The canvas is the only builder** (#132). An old Build link opens on the canvas, drawing the same
  chart (`/build` is a redirect page); questions saved on the old page are carried into My canvases once.
  Explore lists four starter canvases. A canvas holds up to 12 charts, all of it in the address. Each
  chart's generated sentence is its headline, with its method notes under the chart (#142); a value
  keeps one colour across a page (#143); the field list is inside the chart's one editing panel (#144).
- **Light and dark** (#133): the device setting decides; a toggle on every page overrides it, kept in the
  browser only when it differs from the device. **First load** (phone profile, median of 5, 2026-11-25):
  the canvas's first chart 2,988 and 3,037 ms in two runs; fonts 39 KB; charts load before the editor.
- **A notice on every page** once a whole month has ended that the site does not show (#137); the
  comparison tables on Differences fit a phone (#136).
- **Every pull request** builds the public site and checks it: plain English, no tracking, each page's
  metadata, and a performance budget lowered to what the site now ships. **The go-public steps** are
  numbered clicks in `docs/playbooks/go-public.md` (#130), checked against `deploy.yml`.

## Current step

Work order 3 (CHECKPOINT has the table). A: done, with the user's three design choices of 2026-11-25.
B: the user's order of 2026-11-25 (Market type, one New registrations dataset); the rules are tested,
the field is next. C: the user's four items are left. D: waiting on NZTA.

## In progress (all claude; nothing by gemini)

- No lane is held. The worktrees `nzta-lane-a`, `nzta-lane-b` and `nzta-lane-c` are detached on `main`,
  clean; `nzta-lane-b` has no `node_modules`, `.venv` or raw data (it reads the main folder's).
- Worktrees with work that is not on `main`: `nzta-screens` (narrative drafts, **uncommitted**, D-102);
  `nzta-segments` (an untracked draft scheme file, D-103); `nzta-notes` (the closed board proposal).

## Raw files on this computer (gitignored)

- `data/raw/2026-08/`, `data/raw/2026-10/20261113T045017Z` (5,926,990 rows, 36 fields), the dashboard
  exports and Stats NZ's series. No local file holds `VIN11` or `POSTCODE`. `public/data` is the dry-run
  build of 2026-11-24 on `main`; a local build copies `public/data.previous` into `dist/` (delete it there).

## Known issues

1. First load is at the 3 s line, not safely under it (medians from 2.86 to 3.07 s over seven runs). A
   link that reads the fact table is bound by its data (the acceptance question: 6.5 s).
2. No link draws a map today (the owner's region table hides small counts), so the map's dark colours
   and its sentence have been seen only with made-up figures; nor a chart pinned to a kept snapshot.
3. A page left open across a monthly refresh draws new figures under the old snapshot date.
4. Three Explore charts are on no starter canvas (one needs "last 12 months" for bands, two a measure
   worked out from two others). "Area Outside Region" (the Chatham Islands) reaches visitors as is.
   Mild hybrids are identified for about 80% of hybrids at high confidence (D-110, D-119).
5. `/method`, `/caveats` and `/differences` are hand-written and fall behind at each refresh; the
   Differences page's MIA section still gives 16 November's figures (lane B, item 5).
6. The no-tracking check (#131 fixed unquoted values) still misses rarer spellings (#131's review lists
   them) and allows `localStorage` anywhere in the build. The site writes none of these.
7. `restated_from` is filled by hand and nothing checks the earlier figure: a wrong one would quiet the
   single-figure limit on that row (D-153). The review of each month's rows is the guard.
8. Not tested: Safari, and a real screen reader on the comparison tables. Words the old Build screen
   alone showed are still in `config/presets.json`; `narrowingNotes` in `src/lib/builder.ts` is unused.

## Where docs and code disagree (noted, not changed)

- `docs/brief/MASTER_BRIEF.md` knows no canvas; the order wins. The order puts the sentence under the
  chart; the user's answer of 2026-11-25 put it above, as the headline, and the code follows that.
- `docs/DATA_MAP.md` lists ten places where it disagrees with other files, fixed as each field is touched.
- vstat prints its October 2026 totals on its page; their rows still say "added up" (the figures are equal).

## Blocked or waiting on the user

Nothing stops the work. Waiting on the user (CHECKPOINT): the site's name and address and the About page's
gaps; the Cloudflare clicks; `DASHBOARD_EXPORT_METHOD.md`; three questions on Market type and the datasets.

## How to run

`AGENTS.md` §Commands has the verified commands. The site's tests: 653 passed on 2026-11-25.

- NZTA's dashboard blocks automated readers: it is read only from files the user supplies.
- The public checks, after the public build: `node scripts/check-plain-english.mjs`, and the same for
  `check-no-tracking`, `check-page-metadata` and `check-performance-budget` (`--report`).
- Headless screenshots and the axe scan: `playwright-core` and `axe-core` in a scratch folder, with
  `chrome-headless-shell` from `%LOCALAPPDATA%\ms-playwright`; serve a build with `npx astro preview`.
- Before a high-risk pull request, run every test file that builds a cube. Before a merge, wait for
  `Checks` on the newest commit in a command of its own; never merge during a Monthly build.
