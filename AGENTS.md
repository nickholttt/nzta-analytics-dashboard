# AGENTS.md: NZ Vehicle Registration Analytics

For any coding agent (Claude Code, Gemini) arriving with no context. Read in this order:

1. This file.
2. `docs/STATE.md`: what's done, what's in progress and who owns it, what's blocked.
3. `CLAUDE.md`: the project brief (design invariants, the five chart shapes, build order, field
   traps). It is named for Claude but is **the brief for every agent**.
4. `docs/DECISIONS.md` before any change of direction, and `docs/playbooks/` for how to do things.

Everything below was checked on 2026-09-13 unless marked "inferred — confirm".

## What this is

A static analytics site on NZTA's open motor vehicle register. A Python + DuckDB pipeline pulls the
register monthly in GitHub Actions and precomputes a small "cube" of aggregates. An Astro + React +
Observable Plot site renders question-titled charts from that cube. Audience: non-analysts. No
forecasts, no commentary.

Current state: build step 1 (the `registrations_surviving` dataset) runs on GitHub. The site is a
**local reference UI only**; nothing is deployed. Repo: github.com/nickholttt/nzta-analytics-dashboard
(public). Default branch `main`.

## Environment

Verified on Windows 11: Python 3.13.7 in `.venv/`, Node v22.19.0, npm 10.9.3. CI uses Python 3.13 on
ubuntu-latest. On Linux or macOS, replace `.venv/Scripts/python.exe` with `.venv/bin/python`.

Commands are written for **Git Bash**. They also work in PowerShell except for the
`VAR=1 command` env prefix (use `$env:VAR = "1"` there), which was not run in PowerShell. The repo path
contains spaces (`F:\Users\Dev Environment\Desktop\nzta_analytics_dashboard`), so quote it.

## Commands

Run from the repo root.

| Purpose | Command | Verified result 2026-09-13 |
|---|---|---|
| Pipeline tests (as CI) | `.venv/Scripts/python.exe -m pytest pipeline/tests -q -p no:cacheprovider` | 38 passed, 170 s |
| Typecheck site | `npx -y -p typescript tsc --noEmit` | exit 0. TypeScript isn't a dependency, so plain `npx tsc` fails |
| Build site | `npx astro build` | 7 pages built to `dist/`, `404.html` among them (2026-10-22). No npm `build` script exists |
| Build the public site, as the deploy does (D-056) | Git Bash: `INTERNAL_PAGES=false npx astro build && rm -rf dist/status dist/sense-check` | 2026-10-22, against the 2026-08 cube: 5 pages left, none linking to `/status` or `/sense-check`; in a preview those two and any unknown address return 404 |
| Dev server | `npm run dev`, then `npx astro dev status` / `npx astro dev stop` | 200 on `http://127.0.0.1:4321/`. Runs in the background |
| Rebuild cube from a saved pull, publish nothing | `.venv/Scripts/python.exe -m pipeline build data/raw/2026-08/20260911T093818Z --dry-run` | exit 0, 397 s, output identical to `public/data`. Writes only gitignored `data/staging/` |
| Pipeline CLI help | `.venv/Scripts/python.exe -m pipeline --help` | lists `init-schema`, `run`, `build` |
| CI runs | Git Bash: `"/c/Program Files/GitHub CLI/gh.exe" run list --repo nickholttt/nzta-analytics-dashboard`; PowerShell: `& "C:\Program Files\GitHub CLI\gh.exe" run list --repo nickholttt/nzta-analytics-dashboard` | two green runs, 2026-09-11 |

Setup, **not re-run this session** (the environment already existed):
`python -m venv .venv && .venv/Scripts/pip install -r pipeline/requirements.txt` and `npm install`.

**Do not run locally without the user's go-ahead:**

- `python -m pipeline run` hits the live NZTA service and, when the source has changed, rewrites the
  committed `data/state/last_good.json` and `data/snapshots/`. That is the monthly Action's job.
- `python -m pipeline init-schema` overwrites `pipeline/expected_schema.json`, which every run asserts.
- `UPDATE_GOLDEN=1` rewrites `pipeline/tests/golden/contract.json`, which is a contract change.

## Branches in this repo

- `main`: what the monthly Action runs and commits to. Leave it alone during the freeze.
- `ui/explore`: the user's UI branch (it predates the `claude/`/`gemini/` naming rule). Its boundary
  is in hard rule 2 and D-020.
- New agent work: `claude/<topic>` or `gemini/<topic>`, branched from the branch the work belongs on.

## Architecture

- `config/*.json` and `data/reference/*.csv` hold **all** domain knowledge (brands, powertrains,
  events, thresholds). Code knows no domain value (invariant #1, enforced for `pipeline/*.py` by
  `pipeline/tests/test_invariants.py`).
- `pipeline/fetch.py` (`run`): discovers the ArcGIS service (`arcgis.py`, the only network code),
  asserts `expected_schema.json`, computes a change key, skips if it's unchanged, otherwise pulls
  pages to `data/raw/` (gitignored) and builds.
- `pipeline/build.py`: saved pages → DuckDB → `normalise.py` (sentinels, scope, brand overrides) →
  `derive.py` (dimensions per `config/dimensions.json`) → `metrics.py` → `guardrails.py` (compares
  with `data/state/last_good.json`) → `outputs.py`. It writes to `data/staging/` and promotes to
  `public/data/` only if every guardrail passes. Exit codes: 2 guardrail, 3 source, 4 DuckDB.
- The output contract (`public/data/manifest.json`, `cube/<dataset>/<dimension>.parquet`,
  `events.json`) is `docs/CUBE_SCHEMA.md`, locked by `pipeline/tests/test_golden.py`.
- `.github/workflows/monthly-build.yml`: cron 06:17 UTC on the 8th → tests → `pipeline run` → on a
  build, the bot commits `data/snapshots/` and `data/state/` with `[skip ci]`, then, on `main` only,
  keeps the cube as a release `cube-<snapshot>` (D-056, D-057). `checks.yml` runs the pipeline tests on
  every pull request (D-048). `deploy.yml` builds the public site from the newest cube release and
  uploads it to Cloudflare Pages, from `main` only and once its secrets exist; its upload tool, wrangler,
  is pinned by its own lockfile in `.github/deploy/` (D-057). The release step, `checks.yml`,
  `deploy.yml` and `.github/deploy/` are on the pipeline branches, which merge after the 8 November gate.
- `src/pages/index.astro` hosts React islands. `src/lib/config.ts` loads `config/*.json`, `data.ts`
  reads `public/data` (hyparquet), and `resolve.ts` checks a preset against what the cube contains.
  `derived.ts` registers browser-computed series. `src/components/{Mix,Trend,Distribution,League,Geo}Chart.tsx`
  are the five allowed shapes' renderers, and `PresetTriage.tsx` lists every preset with what blocks it.
- `scripts/region-boundaries.mjs` writes `public/geo/nz-regions.json`, the region outlines the map draws,
  from Stats NZ's coastline-clipped regional council boundaries (CC BY 4.0, D-054). Run by hand from the
  repository root when the boundaries change; it fails without writing if a region's code or name
  disagrees with `data/reference/tla_region.csv`.
- Charts are data: each preset is an object in `config/presets.json` (`groups[].presets[]`) with
  `status` (live/blocked/invalid) and `requires`.

## Hard rules: changing any of these needs the user's explicit approval

1. **CLAUDE.md's seven design invariants** and **the five shapes** (mix, trend, league, distribution,
   geo). No sixth renderer.
2. **Freeze until the 8 November 2026 scheduled run passes** (the gate is the 8 October and
   8 November runs, both clean and unattended; `POST_GATE.md`): no changes to `pipeline/`,
   `.github/workflows/`, `config/dimensions.json`, `config/measures.json`, `config/pipeline.json`,
   `data/reference/*`, `pipeline/expected_schema.json`, `pipeline/tests/`, `docs/CUBE_SCHEMA.md`.
   Post-gate work is queued in `POST_GATE.md`, in order. Source: user instruction (D-013, D-020);
   `config/pipeline.json` and `docs/CUBE_SCHEMA.md` are on this list by inference from "pipeline,
   workflow, cube schema and reference data" (inferred — confirm).
   Exception (user, 2026-10-21, D-043): work on these paths may be built and tested before the gate on
   `claude/`/`gemini/` branches cut from `main`, with pull requests into `main` that stay unmerged until
   the 8 November run passes. Nothing on those paths reaches `main`, or `ui/explore`, before then. Tests
   and `pipeline build <saved pull> --dry-run` may run locally; `pipeline run` and `init-schema` still
   may not, and a golden change still follows rule 4.
3. **Never hand-edit `data/snapshots/` or `data/state/`.** Only the monthly Action writes them.
4. **Golden changes are contract changes.** Regenerate `pipeline/tests/golden/contract.json` only
   deliberately, in the same commit as the change that causes it (one cube change per commit,
   `POST_GATE.md`), with the diff shown to the user.
5. **One commit per reference file**, with the docs that describe it changed in the same commit.
   Every commit must build, not just the branch tip.
6. **Resolve field meanings empirically** against the data before rewriting a doc. Surface counts
   for edge cases; never silently bucket.
7. **Don't push to `main`** without asking in that session. An agent may push its own branches
   (`claude/*`, `gemini/*`) and open pull requests from them (user, 2026-10-19). GitHub API access
   goes through `gh` only (full path above; not on the Git Bash PATH), never the Git Credential
   Manager token.
8. **Don't build ahead of the current step.** The user works in gated steps with a stop-and-report
   after each; the current step is in `docs/STATE.md`. Exception (user, 2026-10-21, D-041): the
   visitor-facing site (`src/`, `config/presets.json` and the docs that describe them) may be built
   ahead of the build order, as a local dev build only until the 8 November 2026 gate passes.
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
`change-reference-data`, `add-event`, `change-preset`, `session-handoff`.
