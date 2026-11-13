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
| Build site | `npx astro build` | 1 page built to `dist/`. No npm `build` script exists |
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
  build, the bot commits `data/snapshots/` and `data/state/` with `[skip ci]`.
- `src/pages/index.astro` hosts React islands. `src/lib/config.ts` loads `config/*.json`, `data.ts`
  reads `public/data` (hyparquet), and `resolve.ts` checks a preset against what the cube contains.
  `derived.ts` registers browser-computed series. `src/components/{Mix,Trend,Distribution,League}Chart.tsx`
  are the renderers built so far (of the five allowed shapes), and `PresetTriage.tsx` lists every
  preset with what blocks it.
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
