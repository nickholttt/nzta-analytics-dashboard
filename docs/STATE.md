# State

Last updated by claude on 2026-11-26 (the second session of that day)

A snapshot of now. History is in git and `docs/DECISIONS.md`; the queue and the Lanes table are in
`docs/CHECKPOINT.md`. The direction is work order 3, `docs/brief/WORK_ORDER.md` (D-148; D-147's rules),
with the user's additions of 2026-11-25, `docs/brief/WORK_ORDER_3_ADDITIONS.md` (items 1 to 13, lane E).

## Live now

- **The pipeline** runs on `main` in GitHub Actions, tried every day (D-064). The last build is the
  forced run of 25 November 19:31 UTC, which rebuilt snapshot 2026-10 (release `cube-2026-10`) after
  #164. The private archive (`nickholttt/nzta-register-archive`) holds one release, `snapshot-2026-10`.
- **Datasets**: `registrations_surviving` (five vehicle types, D-157: 4,615,306 vehicles);
  `new_registrations` (true first registrations from January 2021, five types, new and used, D-158; a
  link to either dataset it replaced still opens); `registrations_cars_long_run` (from 1961); `fleet`.
- **The accuracy guard** (D-149 to D-153): every build sets 389 published figures beside ours. Past its
  tolerance a figure warns; two independent sources well past theirs in a month, or one passenger,
  commercial or total figure 5% or more out, stop the build. The rebuilt October: 388 pass, 1 warns.
- **Market type is defined and tested, not built** (D-154, D-155): fifteen ordered rules that nothing
  reads. The SUV file classifies 98.64% of the last 12 months' new passenger vehicles (#152, #154).
- **The site's code is on `main`; nothing is deployed** (`CLOUDFLARE_PAGES_PROJECT` is unset). Pages:
  Explore, Canvas, Method, Caveats, About (a draft), Feedback, Differences, a not-found page, and
  generated pages for 64 brands, 265 models and 6 powertrains, with a brand index; none of those ships a
  script. A sitemap waits for `about.site_address`. The public build fails when the cube lacks a dataset
  the pages read.
- **The home page opens with the latest month** (#153), new and used imports apart (#161), over four
  periods (#162, `config/windows.json`), switched with radio inputs and CSS. Each row has a change on a
  year earlier, or "New entry". Brand pages set a brand beside its rivals, and any brands in the canvas.
- **The canvas is the only builder** (#132). It has a 3-month period (#162) and no year to date. Its first
  chart is held (D-156): about 2.7 s on the phone profile here; a pull request fails over 3.0 s.
- **Every pull request** builds and checks the public site. **Playbooks:** `monthly.md`, `go-public.md`.

## Current step

Buyer type is #167, open. After it on lane B: Market type, first-observed figures, location (CHECKPOINT).

## In progress (all claude; nothing by gemini)

- **#167, buyer type on New registrations (D-159)**: `claude/b-buyer-type` in the worktree `nzta-lane-b`,
  reviewed twice, checks green. On `main` the store holds no owner field and the cube no buyer type;
  after the merge the cube gains its files only when October is rebuilt (a forced build, the user's word).
- `claude/b-buyer-type-site` in `nzta-lane-a`, cut from #167's branch, its `public/data` that branch's
  staged build: #169 (D-160), open. `-c` and `-e` are detached, behind `main`; `-b` and `-e` have no tooling.
- Worktrees with work that is not on `main`: `nzta-screens` (narrative drafts, **uncommitted**, D-102);
  `nzta-segments` (an untracked draft scheme file, D-103); `nzta-notes` (the closed board proposal).
- Private, on the computer: the vstat study; NZTA's 118 "Existing fleet" workbooks with a plan; the
  location plan and its re-check; the site design for buyer type. Large scratch output goes to the data
  drive (18 GB was moved off the system drive on 2026-11-26).

## Raw files on this computer (gitignored)

- `data/raw/2026-08/`, `data/raw/2026-10/20261113T045017Z` (5,926,990 rows, 36 fields), the dashboard
  exports and Stats NZ's series. No local file holds `VIN11` or `POSTCODE`. The main folder's `public/data`
  is older than `new_registrations`: refresh it (the `refresh-public-data` skill) before running the site.
- `data/raw/geo/`: two map sources no build reads yet, Stats NZ's "Territorial Authority 2026 Clipped"
  (CC BY 4.0) and Open NZ Postcodes v2026.11.01 (unofficial shapes, CC0 with CC BY inputs).
- The yearly totals file for the dashboard's history was not on disk for #167's supply; it was rebuilt
  from the ledger's `totals_checked`. Keep it with the exports.

## Known issues

1. A link that reads the fact table is bound by its data (the acceptance question: 6.5 s first chart).
2. No link draws a map today (the region table hides small counts); nor a chart pinned to a kept snapshot.
3. A page left open across a monthly refresh draws new figures under the old snapshot date. Three Explore
   charts are on no starter canvas. "Area Outside Region" reaches visitors as is.
4. `/method`, `/caveats` and `/differences` are hand-written and fall behind at each refresh. The
   no-tracking check misses rarer spellings (#131); nothing checks a `restated_from` figure (D-153).
5. Not tested: Safari, a real screen reader, a browser without `:has()` (the period and new-or-used
   switches rest on it). A chosen period is not kept in the address.
6. A brand page's HTML doubled with #162: DOMContentLoaded up about 330 ms on the phone profile.
7. The canvas has no year to date and no "New entry" in its ranking. Range-extended electric vehicles are
   counted with plug-in hybrids. With #167 the canvas counts buyer type over new and used together.

## Where docs and code disagree (noted, not changed)

- `docs/brief/MASTER_BRIEF.md` knows no canvas; the order wins. `docs/DATA_MAP.md` lists ten disagreements,
  fixed as each field is touched. The stub dataset `ownership_changes` says "vehicles"; it counts changes.

## Blocked or waiting on the user

Lane B's next pipeline items wait for #167. Waiting on the user (CHECKPOINT): the word to merge #167 and
force October's build; D-158's two questions; the email to NZTA; the licence line on NZTA's Existing fleet
page; the name, address, About gaps and Cloudflare clicks; `DASHBOARD_EXPORT_METHOD.md`.

## How to run

`AGENTS.md` §Commands has the verified commands. The site's tests on #167's branch, 2026-11-26, against
its staged build: 869 passed, 4 skipped.

- Claude Code refuses a merge into `main` without the user's "merge N" in that session's own messages
  (also after a compacted conversation). It is asked for, never worked around.
- A change that renames or retires a dataset the pages read cannot pass the public-site checks before
  it merges: a cube is published only from a Monthly build on `main` (D-158, "The kept cube").
- NZTA's sites block automated readers: they are read only from files the user supplies. The timed
  first-chart check by hand is `node scripts/check-first-load.mjs` (AGENTS.md has its arguments).
- Before a high-risk pull request, run every test file that builds a cube (the whole `pipeline/tests/`
  takes about 40 minutes here). Before a merge, wait for `Checks` on the newest commit in a command of
  its own; never merge during a Monthly build.
