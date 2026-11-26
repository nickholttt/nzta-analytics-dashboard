# State

Last updated by claude on 2026-11-26 (the third session of that day)

A snapshot of now. History is in git and `docs/DECISIONS.md`; the queue and the Lanes table are in
`docs/CHECKPOINT.md`. The direction: `docs/brief/WORK_ORDER.md` (D-148) and `WORK_ORDER_3_ADDITIONS.md`.

## Live now

- **The pipeline** runs on `main` in GitHub Actions, tried every day (D-064). The last build is the
  forced run of 26 November 03:51 UTC, which rebuilt snapshot 2026-10 (release `cube-2026-10`) after
  #167: 98 files, byte for byte the dry run #167 was reviewed on but for the manifest's timestamp. The
  private archive (`nickholttt/nzta-register-archive`) holds one release, `snapshot-2026-10`, untouched.
- **Datasets**: `registrations_surviving` (five vehicle types, D-157: 4,615,306 vehicles); `fleet`;
  `new_registrations` (first registrations from January 2021, new and used, D-158); `registrations_cars_long_run`.
- **Buyer type is published** (#167, D-159) on `new_registrations`: a slice, a pair with new or used, a
  narrow fact table with brand and model. No cell is hidden; it is never beside where an owner lives, and
  the build aborts on a configuration that would put it there. The store still drops the district.
- **The accuracy guard** (D-149 to D-153): every build sets 389 published figures beside ours; a figure
  past its tolerance warns, and the hard limits stop the build. The rebuilt October: 388 pass, 1 warns.
- **Market type is defined and tested on `main`, not built there** (D-154, D-155); #173 builds it.
- **The site's code is on `main`; nothing is deployed** (`CLOUDFLARE_PAGES_PROJECT` is unset). Pages:
  Explore, Canvas, Method, Caveats, About (a draft), Feedback, Differences, a not-found page, and script-free
  generated pages for 64 brands, 265 models and 6 powertrains. A sitemap waits for `about.site_address`.
- **The home page opens with the latest month** (#153), new and used imports apart (#161), over four
  periods (#162, `config/windows.json`), switched with radio inputs and CSS.
- **The canvas is the only builder** (#132). A chart by buyer type starts on new vehicles, a condition the
  visitor can remove (#169, D-160). Its first chart is held (D-156): a pull request fails over 3.0 s on
  the phone profile; `Checks` read 2.7 s on #172. Every pull request builds and checks the public site.

## Current step

Four pull requests are open and waiting on the user's word (CHECKPOINT): #170, #171, #172 on lane A,
#173 on lane B. After them: the brand and model pages' buyer table (A), then B's queue.

## In progress (all claude; nothing by gemini)

- **#170**, `claude/a-latest-month-buyers`: the latest month's block by buyer type, read from the pair.
  **#171**, `claude/a-all-panel-phone`, stacked on it: wide tables on a phone. Both in `nzta-lane-c`.
- **#172**, `claude/a-narrow-tables` (worktree `nzta-lane-a`): the canvas reads the narrow fact tables, so
  buyer type crosses with brand, model and the rest, and colour is usable on the survivors. Reviewed.
- **#173**, `claude/b-market-type` (worktree `nzta-lane-b`, no tooling of its own): Market type live on
  `registrations_surviving` and `fleet` (D-161). High risk; reviewed. The cube gains it at the next build.
- Worktrees with work that is not on `main`: `nzta-screens` (narrative drafts, **uncommitted**, D-102);
  `nzta-segments` (an untracked draft scheme file, D-103); `nzta-notes` (the closed board proposal).
- Private, on the computer: the vstat study; the "Existing fleet" workbooks with a plan; the location
  plan; the site design for buyer type (its last piece is not built). Playbooks: `monthly.md`, `go-public.md`.

## Raw files on this computer (gitignored)

- `data/raw/2026-08/`, `data/raw/2026-10/20261113T045017Z` (5,926,990 rows, 36 fields), the dashboard
  exports and Stats NZ's series; none holds `VIN11` or `POSTCODE`. The main folder's `public/data` is the
  release `cube-2026-10` as rebuilt on 26 November (with buyer type).
- `data/raw/geo/`: two map sources no build reads yet (Stats NZ's territorial authorities, CC BY 4.0; Open
  NZ Postcodes v2026.11.01). The dashboard history's yearly totals file, rebuilt for #167, is with the exports.

## Known issues

1. A link that reads the fact table is bound by its data (the acceptance question: 6.5 s first chart).
   No link draws a map today (the region table hides small counts); nor a chart pinned to a kept snapshot.
2. A page left open across a monthly refresh draws new figures under the old snapshot date. Three Explore
   charts are on no starter canvas. "Area Outside Region" reaches visitors as is.
3. `/method`, `/caveats` and `/differences` are hand-written and fall behind at each refresh. The
   no-tracking check misses rarer spellings (#131); nothing checks a `restated_from` figure (D-153). The
   site's tests that read built data are skipped in `Checks` (the site-tests job downloads no cube).
4. Not tested: Safari, a real screen reader, a browser without `:has()` (the period and new-or-used
   switches rest on it). A chosen period is not kept in the address. A brand page's HTML doubled with #162.
5. The canvas has no year to date and no "New entry" in its ranking. Range-extended electric vehicles are
   counted with plug-in hybrids. A buyer-type chart's title and sentence do not say it counts new vehicles.
6. On `main` the latest month's All tables are cut at the card's edge on a phone with no cue (#171 fixes
   most; after it the powertrain table at 12 months is still 11 px wide at 390 px, with a cue).
7. With #173, a chart of SUV or Passenger over many years shows the nameplate list's coverage too (D-161).

## Where docs and code disagree (noted, not changed)

- `docs/brief/MASTER_BRIEF.md` knows no canvas; the order wins. `docs/DATA_MAP.md` lists ten disagreements,
  fixed as each field is touched. The stub dataset `ownership_changes` says "vehicles"; it counts changes.
  D-144, D-159 and D-160 say the site does not read the narrow tables: true when written; #172 reads them.

## Blocked or waiting on the user

Waiting on the user (CHECKPOINT): the word to merge #170 to #173; whether October is built again; D-158's
questions; the NZTA email; the Existing fleet licence line; the site's four items; `DASHBOARD_EXPORT_METHOD.md`.

## How to run

`AGENTS.md` §Commands has the verified commands. On 2026-11-26: the site's tests on #172's branch, with
the site built on the rebuilt cube, 933 passed; the pipeline suite on #173's branch, 3,618 passed.

- Claude Code refuses a merge into `main` without the user's word in that session's own messages (also
  after a compacted conversation). It is asked for, never worked around.
- A cube is published only from a Monthly build on `main`: a change that renames a dataset the pages read
  cannot pass the public-site checks before it merges (D-158). A forced build of the month already built
  needs no asking only after the counts in `data/supplied/` changed on `main` (D-120); any other is asked for.
- NZTA's sites block automated readers: they are read only from files the user supplies. The timed
  first-chart check by hand (`node scripts/check-first-load.mjs`) varies by more than its margin on
  this computer: trust the runner's figure.
- Before a high-risk pull request, run every test file that builds a cube. Before a merge, wait for
  `Checks` on the newest commit in a command of its own; never merge during a Monthly build.
