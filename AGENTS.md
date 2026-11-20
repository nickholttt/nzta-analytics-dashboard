# AGENTS.md: NZ Vehicle Registration Analytics

For any coding agent (Claude Code, Gemini) arriving with no context. Read in this order, and no
more of each than the next step touches (work order 2, §2 rule 7):

1. This file.
2. `docs/STATE.md` and `docs/CHECKPOINT.md`: what is live, what is in progress and who owns it,
   the queue, what is parked for the user.
3. `docs/brief/WORK_ORDER.md`: the user's standing work order 2 of 2026-11-20 (the engine frozen
   for features, the process rules, what may be done without asking, what never is, the canvas
   and the go-public milestones). `docs/CHECKPOINT.md` says where it has got to.
4. `CLAUDE.md`: the project brief (design invariants, the six chart shapes, the canvas page's
   rules, how the work is done, field traps). It is named for Claude but is **the brief for
   every agent**.
5. `docs/DECISIONS.md`: its index. Open a record of D-001 to D-140, in
   `docs/decisions/archive-001-140.md`, only when the work touches it (search for `## D-NNN`).
   `docs/playbooks/` for how to do things.

Everything below was checked on 2026-09-13 unless marked "inferred — confirm".

## What this is

A static analytics site on NZTA's open motor vehicle register. A Python + DuckDB pipeline pulls the
register monthly in GitHub Actions and precomputes a small "cube" of aggregates. An Astro + React +
Observable Plot site renders question-titled charts from that cube. Audience: non-analysts. No
forecasts, no commentary.

Current state: build step 1 (the `registrations_surviving` dataset) runs on GitHub. The site's code
is on `main` since #46 (2026-11-14) and `Deploy` builds it there; **nothing is deployed**.
Repo: github.com/nickholttt/nzta-analytics-dashboard (public). Default branch `main`.

## Environment

Verified on Windows 11: Python 3.13.7 in `.venv/`, Node v22.19.0, npm 10.9.3. CI uses Python 3.13 on
ubuntu-latest. On Linux or macOS, replace `.venv/Scripts/python.exe` with `.venv/bin/python`.

Commands are written for **Git Bash**. They also work in PowerShell except for the
`VAR=1 command` env prefix (use `$env:VAR = "1"` there), which was not run in PowerShell. The repo's path
on the user's computer contains spaces, so quote it.

**No path from the user's computer goes into a doc, a commit message or a pull request** (user,
2026-11-14, D-081): nothing that shows their folders, drive layout or user name. Name a folder by
what it is, or give it relative to the repo root. `gh`'s standard install location is not one.

## Commands

Run from the repo root.

| Purpose | Command | Verified result 2026-09-13 |
|---|---|---|
| Pipeline tests (as CI) | `.venv/Scripts/python.exe -m pytest pipeline/tests -q -p no:cacheprovider` | 1,267 passed in 27 min 12 s (2026-11-18, on the small-cell branch before it and the power and gearbox branch merged; not run locally on `main` since); `Checks` runs it on every pull request in about five minutes |
| Typecheck site | `npx -y -p typescript tsc --noEmit` | exit 0. TypeScript isn't a dependency, so plain `npx tsc` fails |
| Site tests | `node --test "tests/site/*.test.ts"` | 484 passed (2026-11-20, with the canvas's tests; about 9 s when last timed); also run on every pull request (D-101) |
| Build site | `npx astro build` | 11 pages built to `dist/`, `/canvas` among them (2026-11-20). No npm `build` script exists |
| Build the public site, as the deploy does (D-056) | Git Bash: `INTERNAL_PAGES=false npx astro build && rm -rf dist/status dist/sense-check` | 2026-10-22, against the 2026-08 cube: 5 pages left, none linking to `/status` or `/sense-check`; in a preview those two and any unknown address return 404. Since D-099 the build itself drops those two folders and every script no remaining page reaches (`astro.config.mjs`), so the `rm` is a no-op kept for safety; the next row checks it |
| Check the public build's output | `node scripts/check-public-build.mjs` (after the public build) | exit 0 and "10 scripts" on 2026-11-20, with the canvas (7 on 2026-11-17; 6 on 2026-11-16, before the grid's script); on the build as it was before D-099 it exits 1 naming `_astro/PresetTriage.*.js` (known issue 7), and on a build with the internal pages it names both folders |
| Measure a page's first answer on the phone profile (D-099) | after the public build: `node scripts/measure-first-load.mjs --playwright <folder holding node_modules/playwright-core> --chrome <chrome-headless-shell executable> --out <scratch folder>`; flags `--runs`, `--pages`, `--profile desktop`, `--screens`, `--without-fonts` in the script's header | serves `dist/` itself, gzip as a stand-in for Cloudflare Pages, and visits the pages in `scripts/first-load-pages.json`; the library and the browser stay outside `package.json` |
| Dev server | `npm run dev`, then `npx astro dev status` / `npx astro dev stop` | 200 on `http://127.0.0.1:4321/`. Runs in the background |
| Rebuild cube from a saved pull, publish nothing | `.venv/Scripts/python.exe -m pipeline build data/raw/2026-10/20261113T045017Z --dry-run` | exit 0, 11 min 3 s (2026-11-13); every slice, pair and `events.json` identical to the release `cube-2026-10`. Writes only gitignored `data/staging/`. With the supplied store present it also builds `registrations_flow` (2026-11-15: exit 0 in 741 s (12 min 21 s), 1,483,403 vehicles over 70 months, nine live dimensions including `age_at_registration_band`, a fact table of 129,103 rows, payload 3,625,451 bytes, one warning: mild hybrid coverage 62.7%); with the Stats NZ store too (2026-11-15: exit 0 in 707 s (11 min 47 s), `registrations_cars_long_run` 9,050,400 cars over 789 months, 1961-01 to 2026-09, two live dimensions, two slices of 7,770 and 20,124 bytes, payload 3,653,345 bytes (+27,894), one added warning: the store ends at 2026-09 and the register at 2026-10; every other staged file, 51 of them, byte-identical to the build without it, and the manifest differs only by the new dataset, that warning and two `not_live` lines on the two older datasets); with NZTA's vehicle type as a dimension (D-095; 2026-11-15: exit 0 in 12 min 48 s, payload 3,752,999 bytes, the same two warnings); with the hybrid nameplates of D-108 (2026-11-16: exit 0 in 13 min 19 s, payload 3,753,258 bytes, one warning: the Stats NZ store ends at 2026-09; the mild hybrid coverage warning is gone, both datasets reading about 79% at high confidence then, and about 74% under D-110's stricter count: a dry run on 2026-11-17, exit 0, the same payload and the same one warning); with `registrations_flow_wider` (D-113; 2026-11-17: exit 0 in 10 min 47 s, 1,506,467 vehicles over 70 months, eleven live dimensions, a fact table of 136,452 rows, payload 4,281,132 bytes (+527,874), the same one warning; `registrations_flow` and `registrations_cars_long_run` byte-identical to the build without it, and `registrations_surviving` differing only where seven new brand rows move two vehicles); with the assembly flag, the class code and seats in bands (D-116; 2026-11-17: exit 0 in 705 s (11 min 45 s), `registrations_surviving` live with 18 dimensions, a fact table of 755,586 rows in 2,277,006 bytes (was 641,618 and 1,768,848), payload 4,875,739 bytes (+594,607), the same one warning; with the class labels and the powertrain in five groups (D-121, D-124; 2026-11-17: exit 0 in 13 min 9 s, 95 staged files, no fact table gaining a row, payload 4,912,106 bytes, the same one warning); every file of the other three datasets and every earlier slice and pair byte-identical, the manifest differing by three `not_live` lines on each of the other datasets and the new dimensions' entries on this one); with the small-cell rule on the `region` slice (D-127; 2026-11-18, on its branch: exit 0 in 12 min 31 s, 95 staged files, payload 4,904,114 bytes, the `region` slice 14,731 rows in 91,335 bytes with 3,963 hidden cells and 327 months not broken down, the same one warning); with power and the gearbox (D-128; 2026-11-18, on its branch: exit 0 in 11 min 30 s, 99 staged files, a fact table of 799,057 rows, payload 5,218,968 bytes, the same one warning); the two together have not been built locally on `main`; without a store the manifest says `not_built` and the rest is as before. The 2026-08 pull now stops with exit 2: it is older than the last good build |
| Pipeline CLI help | `.venv/Scripts/python.exe -m pipeline --help` | lists `init-schema`, `run`, `build`, `archive` and `supply` (2026-11-14) |
| Add a hand-exported file to the dashboard's store, which is committed (D-084, defined in D-087, D-097; `docs/playbooks/supply-dashboard-month.md`) | `.venv/Scripts/python.exe -m pipeline supply nzta_dashboard <file.csv> [--month YYYY-MM] [--taken YYYY-MM-DD] [--totals <totals.csv>] [--replace YYYY-MM ...]` | exit 0 in 4 s on the 70-month history (2021-01 to 2026-10): 70 months added, the seven totals checked, 1,929,698 bytes of Parquet and a 18,238-byte ledger in `data/supplied/nzta_dashboard/`; the one-month January 2021 file then reported that month unchanged and left the store's bytes identical (2026-11-14). Run again on 2026-11-16 into an empty folder, now that the store keeps the model only for vehicle types in the default or trade scope with a counted import status (D-097): 306,771 rows, 843,345 bytes of Parquet and a 20,199-byte ledger; the dataset's published files are byte-identical to the build from the untrimmed store (confirmed by a dry run on 2026-11-16: 58 of 59 staged files byte-identical, the manifest differing only by its timestamp, D-097). Commit the two files together. Never run by the Action |
| Add Stats NZ's hand-exported table to its store, which is committed (D-065, D-097; `docs/playbooks/supply-statsnz-series.md`) | `.venv/Scripts/python.exe -m pipeline supply statsnz_tpt <export.csv> [--taken YYYY-MM-DD] [--accept-revisions]` | exit 0 in 1.3 s on the saved export of 2026-11-14 (789 months, 1961-01 to 2026-09, last updated 19 October 2026): 16,432 figures, 36,897 bytes of Parquet and a 168,115-byte ledger in `data/supplied/statsnz_tpt/`, committed (D-097); three warnings, all about months before 1998 (the cars total differs from its seven bands in 2 months, by one vehicle each; the commercial total excluding buses from its ten bands in 5; the one including buses in 4); the same file again reported every month unchanged and left the bytes identical (2026-11-15); run again on 2026-11-16 into an empty folder: the same Parquet bytes, and the ledger (now 168,500 bytes) differs only by its `source` block. Commit the two files together. Never run by the Action |
| CI runs | Git Bash: `"/c/Program Files/GitHub CLI/gh.exe" run list --repo nickholttt/nzta-analytics-dashboard`; PowerShell: `& "C:\Program Files\GitHub CLI\gh.exe" run list --repo nickholttt/nzta-analytics-dashboard` | two green runs, 2026-09-11 |

Setup, **not re-run this session** (the environment already existed):
`python -m venv .venv && .venv/Scripts/pip install -r pipeline/requirements.txt` and `npm install`.

**Do not run locally without the user's go-ahead:**

- `python -m pipeline run` hits the live NZTA service and, when the source has changed, rewrites the
  committed `data/state/last_good.json` and `data/snapshots/`. That is the monthly Action's job.
- `python -m pipeline init-schema` overwrites `pipeline/expected_schema.json`, which every run asserts.
- `python -m pipeline build <pull>` without `--dry-run` writes the register's archive into `data/snapshots/` and
  every built dataset, supplied ones included, into `data/state/last_good.json`. Only the Action commits those
  (hard rule 3): the next GitHub build must compare with its own last build, not with a local one. After supplying a
  month, build with `--dry-run`.
- `UPDATE_GOLDEN=1` rewrites `pipeline/tests/golden/contract.json`, which is a contract change.

## Branches in this repo

- `main`: what the monthly Action runs and commits to, and, since #46 on 2026-11-14, the site. An
  agent merges into it only on the user's word in that session (hard rule 7).
- `ui/explore`: the user's UI branch (it predates the `claude/`/`gemini/` naming rule; its boundary
  was D-020). All of it is in `main` since #46; whether it is kept is the user's.
- New agent work: `claude/<topic>` or `gemini/<topic>`, branched from `main`.

## Architecture

- `config/*.json` and `data/reference/*.csv` hold **all** domain knowledge (brands, powertrains,
  events, thresholds). Code knows no domain value (invariant #1, enforced for `pipeline/*.py` by
  `pipeline/tests/test_invariants.py`).
- `pipeline/fetch.py` (`run`): discovers the ArcGIS service (`arcgis.py`, the only network code),
  asserts `expected_schema.json`, computes a change key, skips if it's unchanged, otherwise pulls
  pages to `data/raw/` (gitignored) and builds.
- `pipeline/privacy.py` and `pipeline/small_cells.py` (D-127): which dimensions read an owner field is worked out from
  `config/data_map.json`, and the slice of such a dimension (today the owner's region) is written with small counts hidden;
  the build reads the written file back and aborts, publishing nothing, if a hidden count could be worked out.
- `pipeline/build.py`: saved pages → DuckDB → `normalise.py` (sentinels, scope, brand overrides) →
  `derive.py` (dimensions per `config/dimensions.json`) → `metrics.py` → `guardrails.py` (compares
  with `data/state/last_good.json`) → `outputs.py`. It writes to `data/staging/` and promotes to
  `public/data/` only if every guardrail passes. Exit codes: 2 guardrail, 3 source, 4 DuckDB.
- `pipeline/supplied.py` and `pipeline/series.py`: `python -m pipeline supply`, by hand only, checks one CSV a maintainer exports and adds its
  months to the store `data/supplied/<id>/` (counts and a ledger), which is committed to the repository (D-097), so GitHub reads the same
  files as a local build. `build` then builds the datasets that name
  that source (`registrations_flow`) through the same normalise, derive and output code; for a source of kind `series`
  (`registrations_cars_long_run`, Stats NZ's table) it writes slices straight from the published series; no store, no
  dataset, and the manifest says so (`docs/CUBE_SCHEMA.md`, Supplied sources). A store that ends before the register's
  snapshot month warns and builds everything; one that ends after it aborts.
- The output contract (`public/data/manifest.json`, `cube/<dataset>/<dimension>.parquet`,
  `pairs/<dataset>/<a>__<b>.parquet`, `facts/<dataset>/<column>.parquet`, `events.json`) is
  `docs/CUBE_SCHEMA.md`, locked by `pipeline/tests/test_golden.py`.
- `.github/workflows/monthly-build.yml`: cron 06:17 UTC **every day** → tests → `pipeline run`,
  which builds each snapshot month once and, from the 15th, fails while the month before is still
  not built (D-064, D-070), and lists a build's warnings on the run's summary page, worst first
  (D-112) → on a build, the bot commits `data/snapshots/` and `data/state/` with
  `[skip ci]`, then, on `main` only, keeps the cube as a release `cube-<snapshot>` (D-056, D-057),
  starts `deploy.yml`, and a job `archive` keeps the whole register for the month as one Parquet
  file in the private repository `nzta-register-archive` (D-063, D-071). `checks.yml` runs the
  pipeline tests, and the site's tests, typecheck and the query service prototype's tests, on every pull request (D-048, D-101). `deploy.yml` builds the public site from the newest
  cube release and keeps every earlier cube release's files beside it for pinned links (D-131); a second job uploads it to Cloudflare Pages from `main` only, behind the environment
  `production`, once the repository variable `CLOUDFLARE_PAGES_PROJECT` switches it on (D-072); its
  upload tool, wrangler, is pinned by its own lockfile in `.github/deploy/` (D-057). All of it is on
  `main` since 2026-11-13 (#26 to #29, #35, #37 to #39), and the first release, `cube-2026-10`, exists.
- `src/pages/index.astro` hosts React islands; only its first chart fetches on load, the others wait on `src/lib/loadGate.ts` (D-099). `src/lib/config.ts` loads `config/*.json`, `data.ts`
  reads `public/data` (hyparquet), and `resolve.ts` checks a preset against what the cube contains.
  `derived.ts` registers browser-computed series. `src/components/{Mix,Trend,Distribution,League,Geo,Matrix}Chart.tsx`
  are the renderers of the six allowed shapes (`matrix`, approved in D-083, is a table drawn from the design tokens, D-114), and `PresetTriage.tsx` lists every preset with what blocks it, and (as `BuildWarnings`, D-112) the cube's own warnings, on the internal status page only.
- `src/pages/canvas.astro` hosts the canvas (work order 2, milestone 1; D-147): a page of charts a visitor builds by putting
  fields into each chart's zones. A chart on it is a Build question under an id of its own, drawn by `PresetPanel` with
  `frame="card"`. `src/lib/canvas.ts` is its logic, pure and tested (`tests/site/canvas.test.ts`): what a field may do in a zone
  and why not, which chart types fit a question and why the others do not (read off `config/chart_rules.json`), how charts are added,
  copied, removed and moved, a pin chart by chart (under `src/lib/pin.ts`), and the address a canvas is written to and read back from.
  `src/lib/savedCanvases.ts` is My canvases, kept in the browser under the rules of `src/lib/saved.ts`; `src/components/useReading.ts`
  decides which snapshot a pinned question reads from, for Build and for each chart of a canvas. `src/lib/canvasFields.ts` makes the field list from the data map where the page is built.
  `src/components/canvas/` is the screen; `config/canvas.json` holds its words, held to the template lint.
- `scripts/unmatched_hybrids.py` lists, for one dataset, the hybrids that count against its mild hybrid coverage at high
  confidence, by make and model. Run by hand when a build warns that the split flipped (`docs/playbooks/check-monthly-run.md`,
  D-112); it reads the repository and a saved pull and writes nothing.
- `scripts/region-boundaries.mjs` writes `public/geo/nz-regions.json`, the region outlines the map draws,
  from Stats NZ's coastline-clipped regional council boundaries (CC BY 4.0, D-054). Run by hand from the
  repository root when the boundaries change; it fails without writing if a region's code or name
  disagrees with `data/reference/tla_region.csv`.
- Charts are data: each preset is an object in `config/presets.json` (`groups[].presets[]`) with
  `status` (live/blocked/invalid) and `requires`.
- Shapes are inferred, not chosen per field: `config/chart_rules.json` is the one table that says which of the six
  fit a question, best first, from the kind of the measure and of the field, how many values it has and whether the
  question looks at one window or over time (`src/lib/shapes.ts`, `inferShape` and `viewsFor`; D-100). A preset may pin
  a shape only to one the table says fits. Dimensions and measures state their `kind`, never a chart.

## How the work is done

The seven process rules of work order 2 are in `CLAUDE.md`, "How the work is done" (D-147): when
a decision record is written, reviews by risk, which tests are added, the notes once a session,
the decisions index, which model does which work, and short sessions. They bind every agent, and
hard rules 7 and 8 below carry the merge rule and the steps that go with them.

## Hard rules: changing any of these needs the user's explicit approval

1. **CLAUDE.md's eight design invariants** and **the six shapes** (mix, trend, league, distribution,
   geo, matrix). No seventh renderer. The sixth, `matrix`, is the user's approval of 2026-11-14 (D-083).
2. **The freeze is lifted (user, 2026-11-13, D-066).** The gate was the 8 October and 8 November
   2026 scheduled runs, both clean and unattended (D-013, D-020); the user ruled it passed once the
   run of 13 November had built October. The paths it covered are the **pipeline paths**:
   `pipeline/`, `.github/workflows/`, `config/dimensions.json`, `config/measures.json`,
   `config/pipeline.json`, `data/reference/*`, `pipeline/expected_schema.json`, `pipeline/tests/`,
   `docs/CUBE_SCHEMA.md`. Work on them no longer waits for a date. It still reaches `main` only
   through a `claude/`/`gemini/` branch, cut from `main` or stacked on an open pipeline pull
   request, and a pull request merged as rule 7 allows. Tests and
   `pipeline build <saved pull> --dry-run` may run locally; `pipeline run` and `init-schema` are
   still not run locally (§Commands), and a golden change still follows rule 4.
3. **Never hand-edit `data/snapshots/` or `data/state/`.** Only the monthly Action writes them.
4. **Golden changes are contract changes.** Regenerate `pipeline/tests/golden/contract.json` only
   deliberately, in the same commit as the change that causes it (one cube change per commit,
   `POST_GATE.md`), with the diff shown to the user in the pull request's description (D-082,
   D-147).
5. **One commit per reference file**, with the docs that describe it changed in the same commit.
   Every commit must build, not just the branch tip.
6. **Resolve field meanings empirically** against the data before rewriting a doc. Surface counts
   for edge cases; never silently bucket.
7. **Don't push to `main` or merge into it** without the user's word in that session, naming the
   pull request ("merge N"). A merge into `main` also needs green, finished checks and the review
   its risk calls for (below). A forced Monthly build, and anything that makes
   something public, is asked for each time (user, 2026-11-14, D-081); the one exception is a
   forced build of the month already built after the committed counts in `data/supplied/` have
   changed on `main` (user, 2026-11-17, D-120). An agent may push its own
   branches (`claude/*`, `gemini/*`) and open pull requests from them (user, 2026-10-19). GitHub
   API access goes through `gh` only (full path above; not on the Git Bash PATH), never the Git
   Credential Manager token.

   **Review by risk** (user, 2026-11-20, D-147; `CLAUDE.md`, How the work is done, rule 2):
   - High risk (pipeline code, the data contract, published files, privacy, workflows, anything
     touching `main`'s data): one independent reviewer who has not seen the author's reasoning,
     briefed with the change and three to five things to test. One round; a fix gets a narrow
     re-check of that finding only.
   - Low risk (site, canvas, copy, docs): no reviewer agent. The checks must pass: typecheck,
     build, the tests that exist, an axe scan with nothing found, and screenshots at 390 and
     1280 px that the lead looks at.
   - Docs only: merge when the checks pass.

   **Under work order 2, and only for it** (`docs/brief/WORK_ORDER.md` §3 and §4; user,
   2026-11-20, D-147), in a session where the user says so, with the order itself or with its
   "continue" message (§8):
   - claude may merge a pull request of the order into `main`, as a merge commit, when its
     checks are green and finished, the review rule above is met for its risk, it is inside the
     order, and it touches nothing on the order's "never without asking" list.
   - If Claude Code's own permission check refuses a merge, it is not worked around: the next
     work is stacked on top, and the user is given one line, such as "merge 104, 105".
   - claude may create and delete its own branches and pull requests, and run anything
     read-only against NZTA's open data service, Stats NZ's Infoshare and the private archive.
   - One forced run of November is allowed, once, only if the December refresh's build fails
     for a reason that has been fixed.
   - **Never without asking** (the order's §4): anything public (the Cloudflare switch, the
     repository's visibility, a new kind of data in a release); anything that costs money or
     creates an account; anything that cannot be undone (deleting data, rewriting history,
     replacing an archived file); publishing an owner field beyond the "Current use" table,
     postcode, or anything derived from `VIN11`; changing CLAUDE.md's invariants beyond what
     the order's §5 approves.
8. **Don't build ahead of the current step.** The user works in gated steps; the current step is
   in `docs/STATE.md`. Under work order 2 the steps are its two milestones, in order: the canvas
   (its build order, one to six, merged as it goes), then ready to go public, stopping before
   the switch. **The engine is frozen for features**: the order's §1 lists the only engine work
   allowed and what is parked (D-147). A session ends with five lines at most; a milestone ends
   with a report (the order's §7).
   Exception (user, 2026-10-21, D-041): the
   visitor-facing site (`src/`, `config/presets.json` and the docs that describe them) may be built
   ahead of the build order. The gate that kept it a local build passed on 13 November 2026
   (D-066). Deploying it is Stage 1 of the brief (`docs/brief/MASTER_BRIEF.md`), and each step
   that makes it public is asked for (D-081).
9. **Never present a measurement artefact as market behaviour** (`docs/EVENTS_LAYER.md`,
   `mechanism` column).

## Traps (from CLAUDE.md; read `docs/DATA_SOURCES.md` and `docs/MODEL_AND_AGE.md` before any transform)

- `vehicle_year` is not model year. `ORIGINAL_COUNTRY` means "built in", not brand nationality.
  `submodel` is free text; never aggregate on it.
- `registrations_surviving` counts vehicles **still registered**, not registrations. Never put it on
  the same chart as `registrations_flow`.
- `.gitattributes` forces LF. Write files with `\n` line endings, or golden and byte comparisons drift
  (see POST_GATE B2).

## Playbooks

`docs/playbooks/`: `run-checks`, `local-ui-dev`, `refresh-public-data`, `check-monthly-run`,
`change-reference-data`, `add-event`, `change-preset`, `session-handoff`,
`supply-statsnz-series`.
