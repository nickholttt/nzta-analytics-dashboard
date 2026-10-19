# State

Last updated by claude on 2026-10-19

A snapshot of now. History is in git and `docs/DECISIONS.md`; the work queue is in
`docs/CHECKPOINT.md`.

## Live now

- **Pipeline, build step 1** (`registrations_surviving`) runs monthly on `main` in GitHub Actions.
  - 8 October 2026 scheduled run 37784177375: green, unattended. 38 tests passed, pulled
    5,916,165 rows (snapshot 2026-09-30), built, no warnings, and the bot committed
    `e3246bb Snapshot 2026-09 [skip ci]` (`data/snapshots/2026-09.parquet`, `data/state/last_good.json`).
    First of the two gate runs: **passed**.
  - Earlier runs: forced 34646200411 and unforced 34648180201, both green, 2026-09-11.
- **Nothing is deployed.** The site is a local reference UI (`npm run dev`, 127.0.0.1:4321).
- **Events**: 54 rows, 50 verified. Four are unverified on purpose (Honda and Mercedes-Benz agency
  starts, the semiconductor window, the weak yen). Don't guess dates to clear them.

## Branches (checked 2026-10-19)

| Branch | Where | What |
|---|---|---|
| `main` | local `ba304d2`, origin `e3246bb` | local is 1 commit behind (the bot's 2026-09 snapshot) |
| `ui/explore` | **local only, never pushed** | 15 commits on top of `ba304d2`: shared context, Claude's design step, Gemini's UI steps 2–5 and extras. Last commit 2026-09-13 |
| `claude/shared-agent-context` | local only | already contained in `ui/explore` |
| `claude/bootstrap` | local only | this notes refresh (docs only), branched from `ui/explore` |

No pull requests exist on GitHub (open or closed).

## In progress

- Nobody is actively editing. Gemini's UI files on `ui/explore` stay Gemini's until the user hands
  them back (D-025): `src/components/*`, `src/data/*`, `src/pages/*`, `src/layouts/*`, `src/lib/*`,
  `src/styles/site.css`, `config/presets.json`.

## What `ui/explore` contains (unreviewed by the user)

Pages `/`, `/method`, `/caveats`, `/inspector`. Explore canon of 9 presets in three tiers, URL state
and permalinks, mobile polish, time-horizon toggles, a `LeagueChart` renderer with a
`model-leaderboard` preset, a market drilldown workspace and an international "complexity
benchmark". Gemini reported typecheck, `astro build` and 38 tests green on 2026-09-13; not re-run
since.

## Known issues

On `ui/explore`, found 2026-10-19 by reading the code (not fixed; the files are Gemini's):

1. **Invariant #1**: brand, model and powertrain names are hardcoded in
   `src/components/ComplexityBenchmark.tsx`, `DataInspector.tsx`, `MarketDrilldown.tsx` and
   `LeagueChart.tsx` (e.g. "Ford Ranger vs Toyota Hilux").
2. **Invariants 4–6**: `src/data/inspector_data.json` (52 KB) and `market_intelligence.json`
   (219 KB) were extracted from the register by hand. No script in the repo produces them, so they
   will not refresh with the monthly run.
3. **Non-goals**: the drilldown and benchmark carry written commentary and explanations of *why*
   (structural analysis, dealership viability simulator, "Coalface Truth").
4. **Contradicts D-024**: `model-leaderboard` brings back the cut `model-league`, and the drilldown
   has a regional matrix although the regional views were cut (TLA is the owner's address).
   `LeagueChart` is build-order step 6, ahead of the current step.
5. **Outside data**: the benchmark's USA, China, Japan and Australia figures come from sources
   outside NZTA. Not checked this session.

Docs that contradict code (carried over, still unreconciled):

6. `README.md` says "No application code yet"; `pipeline/` and `src/` exist.
7. `CLAUDE.md` build order says no UI before two unattended runs; a UI was built 2026-09-12 (D-014).
8. `CLAUDE.md` §Stack names Cloudflare Pages and TanStack Table; neither is in the repo. Possibly
   plan, not contradiction.

## Blocked or waiting on the user

- **Freeze** on `pipeline/`, `.github/workflows/`, `config/dimensions.json`, `config/measures.json`,
  `config/pipeline.json`, `data/reference/*`, `pipeline/expected_schema.json`, `pipeline/tests/`,
  `docs/CUBE_SCHEMA.md` until the **8 November 2026** run passes (AGENTS.md hard rule 2).
- Review of `ui/explore`, including Known issues 1–5. Questions are in `docs/CHECKPOINT.md`.
- Older open questions: what `shaken-clock` in D-020 refers to; which Gemini client is in use.

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). Rechecked
2026-10-19: `.venv` Python 3.13.7 and Node v22.19.0 work on this drive (`F:`). Tests, typecheck
and build were not re-run this session (docs-only change).
