# State

Last updated by claude on 2026-11-25 (the second session of 25 November)

A snapshot of now. History is in git and `docs/DECISIONS.md`; the queue and the Lanes table are in
`docs/CHECKPOINT.md`. The direction is work order 3, `docs/brief/WORK_ORDER.md` (D-148; D-147's rules),
with the user's additions of 2026-11-25, `docs/brief/WORK_ORDER_3_ADDITIONS.md` (items 1 to 13, lane E).

## Live now

- **The pipeline** runs on `main` in GitHub Actions, tried every day (D-064). The last build is the
  forced run of 17 November (snapshot 2026-10; release `cube-2026-10`); the daily runs to 25 November
  were green and built nothing. The next build is the first to publish the current fleet. The private
  archive (`nickholttt/nzta-register-archive`) holds one release, `snapshot-2026-10`.
- **Datasets**: `registrations_surviving` (two vehicle types; five once #156 is merged with a rebuild of
  October's cube, D-157); `registrations_flow` and `registrations_flow_wider` (from January 2021,
  D-097); `registrations_cars_long_run` (from 1961); `fleet` (D-135, D-141).
- **The accuracy guard** (D-149 to D-153): every build sets 389 published figures beside ours. Past its
  tolerance a figure warns; two independent sources well past theirs in a month, or one passenger,
  commercial or total figure 5% or more from ours, stop the build. A restated figure warns (D-153).
  Dry run on the 2026-10 pull, 2026-11-25: 388 pass, 1 warns.
- **Market type is defined and tested, not built** (D-154, D-155): `market_type_map.csv`, fifteen
  ordered rules to Passenger, SUV, Not yet classified, Light commercial, Heavy commercial or Other.
  Nothing reads it. The SUV file classifies 80.9% of new passenger vehicles on `main`; 98.7% with the
  two pull requests that wait for the user (#152, #154).
- **The site's code is on `main`; nothing is deployed** (`CLOUDFLARE_PAGES_PROJECT` is unset). Pages:
  Explore, Canvas, Method, Caveats, About (a draft), Feedback, Differences, a not-found page, and
  generated pages for 63 brands and 260 models with an index (#155). A sitemap is written at build time
  once `about.site_address` is set in `config/site.json`.
- **The home page opens with the latest month** (#153): the month's total and its change on a year
  earlier, new against used, top brands and models, movers and the powertrain split, each generated
  from templates and opening in the canvas. Its Market type block appears when the field is built.
- **The canvas is the only builder** (#132). Each chart's sentence is its headline (#142), a value keeps
  one colour across a page (#143), the field list is inside the one editing panel (#144).
- **First load is held** (D-156, #151): the canvas's first chart is about 2.7 s on the phone profile
  here (2.5 and 2.6 s on GitHub's runner). A pull request fails over 3.0 s (a timed step in `Checks`)
  or over the byte limit on the first chart's critical path.
- **Every pull request** builds the public site and checks it (plain English, no tracking, metadata, the
  budget). **Playbooks:** the month is `docs/playbooks/monthly.md` (#149); going public is `go-public.md`.

## Current step

The additions' items 2, 3, 4, 9, 10 and 13 are merged; 6 is drafted for the user; 11 found nothing to
add. Next on lane B: one "New registrations" dataset (item 1), then building Market type, then figures
as first observed (item 5). Lane E waits on the user's approval of #152 and #154.

## In progress (all claude; nothing by gemini)

- No lane is held. Open, each waiting for the user's word: #152 (`claude/e-classify-batch-1`), #154
  (`claude/e-classify-corolla`, stacked on it) and #156 (`claude/b-survivors-five-types`, reviewed).
- The worktrees `nzta-lane-a`, `-b`, `-c` are detached on `main`; `nzta-lane-e` holds the two open
  branches. `nzta-lane-b` and `nzta-lane-e` have no `node_modules`, `.venv` or raw data.
- Worktrees with work that is not on `main`: `nzta-screens` (narrative drafts, **uncommitted**, D-102);
  `nzta-segments` (an untracked draft scheme file, D-103); `nzta-notes` (the closed board proposal).

## Raw files on this computer (gitignored)

- `data/raw/2026-08/`, `data/raw/2026-10/20261113T045017Z` (5,926,990 rows, 36 fields), the dashboard
  exports and Stats NZ's series. No local file holds `VIN11` or `POSTCODE`. `public/data` is the dry-run
  build of 2026-11-24.

## Known issues

1. A link that reads the fact table is bound by its data (the acceptance question: 6.5 s first chart).
2. No link draws a map today (the owner's region table hides small counts); nor a chart pinned to a kept
   snapshot.
3. A page left open across a monthly refresh draws new figures under the old snapshot date.
4. Three Explore charts are on no starter canvas. "Area Outside Region" reaches visitors as is.
5. `/method`, `/caveats` and `/differences` are hand-written and fall behind at each refresh.
6. The no-tracking check still misses rarer spellings (#131's review); `restated_from` is filled by hand
   and nothing checks the earlier figure (D-153).
7. Not tested: Safari, a real screen reader. The brand and model pages wrap the month column on a phone.
8. The home page and the brand and model pages name the dashboard dataset in `config/latest_month.json`
   and `config/answer_pages.json`: both change with item 1's rename, or the front page's links vanish.
9. The Vehicle Importers Association publishes no monthly figures on its own pages (an annual one, on a
   border-entry basis), so the guard has no used-import source of its own (item 11).

## Where docs and code disagree (noted, not changed)

- `docs/brief/MASTER_BRIEF.md` knows no canvas; the order wins. The order puts the sentence under the
  chart; the user's answer of 2026-11-25 put it above, and the code follows that.
- `docs/DATA_MAP.md` lists ten places where it disagrees with other files, fixed as each field is touched.

## Blocked or waiting on the user

Nothing stops the work. Waiting on the user (CHECKPOINT): #152, #154 and #156; the email to NZTA; the
monthly export's trailing months; the name, address, About gaps and Cloudflare clicks;
`DASHBOARD_EXPORT_METHOD.md` when NZTA publishes November.

## How to run

`AGENTS.md` §Commands has the verified commands. The site's tests: 733 passed on 2026-11-25.

- NZTA's dashboard blocks automated readers: it is read only from files the user supplies.
- The timed first-chart check by hand: `node scripts/check-first-load.mjs` (AGENTS.md has its arguments).
- Before a high-risk pull request, run every test file that builds a cube (the whole `pipeline/tests/`
  takes about 36 minutes here). Before a merge, wait for `Checks` on the newest commit in a command of
  its own; never merge during a Monthly build.
