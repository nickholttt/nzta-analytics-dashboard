# State

Last updated by claude on 2026-11-26 (the long session of 25 and 26 November)

A snapshot of now. History is in git and `docs/DECISIONS.md`; the queue and the Lanes table are in
`docs/CHECKPOINT.md`. The direction is work order 3, `docs/brief/WORK_ORDER.md` (D-148; D-147's rules),
with the user's additions of 2026-11-25, `docs/brief/WORK_ORDER_3_ADDITIONS.md` (items 1 to 13, lane E).

## Live now

- **The pipeline** runs on `main` in GitHub Actions, tried every day (D-064). The last build is the
  forced run of 25 November, which rebuilt snapshot 2026-10 (release `cube-2026-10`) after #156; the
  daily runs to 25 November were green and built nothing. The private archive
  (`nickholttt/nzta-register-archive`) holds one release, `snapshot-2026-10`.
- **Datasets**: `registrations_surviving` (five vehicle types since #156, D-157: 4,615,306 vehicles);
  `registrations_flow` and `registrations_flow_wider` (from January 2021, D-097; they become one,
  `new_registrations`, in #164, D-158, not merged); `registrations_cars_long_run` (from 1961);
  `fleet` (D-135, D-141).
- **The accuracy guard** (D-149 to D-153): every build sets 389 published figures beside ours. Past its
  tolerance a figure warns; two independent sources well past theirs in a month, or one passenger,
  commercial or total figure 5% or more from ours, stop the build. A restated figure warns (D-153).
  The rebuilt October: 388 pass, 1 warns.
- **Market type is defined and tested, not built** (D-154, D-155): `market_type_map.csv`, fifteen
  ordered rules. Nothing reads it. The SUV file classifies 98.7% of the last 12 months' new passenger
  vehicles (#152, #154; five judgements at low confidence).
- **The site's code is on `main`; nothing is deployed** (`CLOUDFLARE_PAGES_PROJECT` is unset). Pages:
  Explore, Canvas, Method, Caveats, About (a draft), Feedback, Differences, a not-found page, and
  generated pages for 63 brands, 260 models and 6 powertrains, with a brand index. None of the
  generated pages ships a script. A sitemap is written once `about.site_address` is set.
- **The home page opens with the latest month** (#153), with new and used imports apart (#161) and over
  four periods (#162): the month, 3 months, 12 months and the year to date, chosen with radio inputs
  and CSS, every view in the HTML. Each row has a change on the same months a year earlier, or "New
  entry". Brand pages set a brand beside its nearest rivals and, through a form, beside any brands in
  the canvas. The period windows are `config/windows.json`.
- **The canvas is the only builder** (#132). It has a 3-month period (#162) and no year to date. Its first
  chart is held (D-156): about 2.7 s on the phone profile here; a pull request fails over 3.0 s.
- **Every pull request** builds the public site and checks it (plain English, no tracking, metadata, the
  budget). **Playbooks:** the month is `docs/playbooks/monthly.md` (#149); going public is `go-public.md`.

## Current step

Merged of the additions: items 2, 3, 4, 8 (two batches), 9, 10, 13; 6 is drafted; 11 found nothing. Item 1 is
#164: built, reviewed, waiting on the user. Next on lane B: buyer type, Market type, figures as first observed.

## In progress (all claude; nothing by gemini)

- Lane B: #164, `claude/b-one-new-registrations` in the worktree `nzta-lane-b` (D-158). It holds `main`
  to 26dea07; the whole pipeline suite passed there (3,473 passed, 28 skipped); three independent reviews
  and their fixes are in. Its public-site checks fail by design on the kept cube (CHECKPOINT, B1).
- #164 is the only open pull request. The worktrees `nzta-lane-a`, `-c` and `-e` are detached on `main`.
  `nzta-lane-b` and `nzta-lane-e` have no `node_modules`, `.venv` or raw data.
- Worktrees with work that is not on `main`: `nzta-screens` (narrative drafts, **uncommitted**, D-102);
  `nzta-segments` (an untracked draft scheme file, D-103); `nzta-notes` (the closed board proposal).
- Private, on the computer: the study of vstat, and NZTA's 118 "Existing fleet" workbooks read, with a plan.

## Raw files on this computer (gitignored)

- `data/raw/2026-08/`, `data/raw/2026-10/20261113T045017Z` (5,926,990 rows, 36 fields), the dashboard
  exports and Stats NZ's series. No local file holds `VIN11` or `POSTCODE`. The main folder's `public/data`
  is the dry-run build of 2026-11-24, older than the rebuilt cube.

## Known issues

1. A link that reads the fact table is bound by its data (the acceptance question: 6.5 s first chart).
2. No link draws a map today (the region table hides small counts); nor a chart pinned to a kept snapshot.
3. A page left open across a monthly refresh draws new figures under the old snapshot date.
4. Three Explore charts are on no starter canvas. "Area Outside Region" reaches visitors as is.
5. `/method`, `/caveats` and `/differences` are hand-written and fall behind at each refresh.
6. The no-tracking check misses rarer spellings (#131); nothing checks a `restated_from` figure (D-153).
7. Not tested: Safari, a real screen reader, a browser without `:has()` (the period and new-or-used
   switches rest on it). A chosen period is not kept in the address.
8. A brand page's HTML doubled with #162: DOMContentLoaded up about 330 ms on the phone profile, first paint unchanged.
9. The canvas has no year to date (the pages' links for it are withheld) and no "New entry" in its ranking.
   Range-extended electric vehicles are counted with plug-in hybrids (the note says so).

## Where docs and code disagree (noted, not changed)

- `docs/brief/MASTER_BRIEF.md` knows no canvas; the order wins. The order puts the sentence under the
  chart; the user's answer of 2026-11-25 put it above, and the code follows that.
- `docs/DATA_MAP.md` lists ten places where it disagrees with other files, fixed as each field is touched.
- `config/dimensions.json` holds a stub dataset `ownership_changes` whose help says "vehicles"; the
  source counts changes. It is corrected when the dataset is built.

## Blocked or waiting on the user

Lane B's next items wait for #164 (they build on its dataset). Waiting on the user (CHECKPOINT): the word
to merge #164 with its public-site job failing and to force October's rebuild; the email to NZTA; the licence line on NZTA's Existing fleet page;
the name, address, About gaps and Cloudflare clicks; `DASHBOARD_EXPORT_METHOD.md` when NZTA publishes.

## How to run

`AGENTS.md` §Commands has the verified commands. The site's tests: 848 passed on 2026-11-26.

- NZTA's sites block automated readers: they are read only from files the user supplies.
- The timed first-chart check by hand: `node scripts/check-first-load.mjs` (AGENTS.md has its arguments).
- Before a high-risk pull request, run every test file that builds a cube (the whole `pipeline/tests/`
  takes about 40 minutes here). Before a merge, wait for `Checks` on the newest commit in a command of
  its own; never merge during a Monthly build.
