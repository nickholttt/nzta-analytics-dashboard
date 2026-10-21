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
| `ui/explore` | origin, pushed 2026-10-19 unchanged | 15 commits on top of `ba304d2`: shared context, Claude's design step, Gemini's UI steps 2–5 and extras |
| `claude/shared-agent-context` | local only | already contained in `ui/explore` |
| `claude/bootstrap` | origin | notes refresh and the user's answers (docs only). PR into `ui/explore` |
| `claude/sense-check` | origin | Gemini's extras fenced into `/sense-check` (D-028). PR into `ui/explore`, stacked on `claude/bootstrap` |
| `claude/model-leaderboard` | origin | `model-leaderboard` blocked on step 1b (D-029), blocked-panel tidy, triage heading. PR into `claude/sense-check` |
| `claude/caveats-wording` | origin | caveats 1 and 7 (D-030). PR into `claude/model-leaderboard` |
| `claude/method-page` | origin | `/method` checked against METRICS.md, config and code (D-031). PR into `claude/caveats-wording` |
| `claude/caveat-scrappage` | origin | caveat 2 and share notes: uneven scrappage skews shares (D-032). PR into `claude/method-page` |
| `claude/metrics-april-2020` | origin | METRICS.md April 2020 and threshold figures re-measured (D-033). PR into `claude/caveat-scrappage` |

No CI runs on pull requests; the only workflow is the monthly build.

## In progress

- Nobody is editing. Claude's seven branches are in open pull requests waiting on the user, merged
  in this order: [#1](https://github.com/nickholttt/nzta-analytics-dashboard/pull/1)
  (`claude/bootstrap`), [#2](https://github.com/nickholttt/nzta-analytics-dashboard/pull/2)
  (`claude/sense-check`), [#3](https://github.com/nickholttt/nzta-analytics-dashboard/pull/3)
  (`claude/model-leaderboard`), [#4](https://github.com/nickholttt/nzta-analytics-dashboard/pull/4)
  (`claude/caveats-wording`), [#5](https://github.com/nickholttt/nzta-analytics-dashboard/pull/5) (`claude/method-page`),
  [#6](https://github.com/nickholttt/nzta-analytics-dashboard/pull/6) (`claude/caveat-scrappage`), then
  [#7](https://github.com/nickholttt/nzta-analytics-dashboard/pull/7) (`claude/metrics-april-2020`).
- The UI on `ui/explore` is Claude's from 2026-10-19 (D-027, superseding D-025).

## What `ui/explore` contains (unreviewed by the user)

Pages `/`, `/method`, `/caveats`, and (on `claude/sense-check`) the internal `/sense-check`, which
replaces `/inspector`. Explore canon of 9 presets in three tiers, URL state and permalinks, mobile
polish, time-horizon toggles, and a `LeagueChart` renderer with a `model-leaderboard` preset.
On `claude/sense-check` 2026-10-19: typecheck exit 0 (`tsc` does not read `.astro` files;
`astro check` is not installed), `astro build` 4 pages, headless screenshots
of `/sense-check`, `/caveats` and `/` at 320px and 1280px with no console errors and no sideways
scroll.

## Known issues

On `ui/explore`, found 2026-10-19 by reading the code:

1. The time-horizon toggle offers no period of 12 months or less, so on a league chart it switches
   the shape to mix with no way back (`src/lib/resolve.ts` `inferShape`). Unreachable now: no live
   preset is a league. Fix before a league preset is unblocked.
2. `config/measures.json` (`$min_share_of_trailing_median_comment`) says 0.33 sits well clear of
   seasonality "whose 1st percentile is 0.29". 0.29 counts months under 200; among months that clear
   200 it is 0.67 (D-033). The file is frozen until the 8 November gate.

Fixed on `claude/metrics-april-2020` (D-033): METRICS.md's April 2020 baselines (trucks 2.5%, not
~2.3%; NZ New 54.3%, not ~51%), Hyundai's band, the pre-1990 wording and the 0.29 percentile, all
re-measured on the 2026-08 cube.

Fixed on `claude/caveat-scrappage` (D-032): caveat 2 and the brand-share notes no longer say shares
"hold up" under scrappage. Measured between the 2026-08 and 2026-09 snapshots, groups leave the
register at different rates (2015 cars: used imports 0.72% in a month, NZ New 0.17%).

Fixed on `claude/method-page` (D-031): `/method` drops the unchecked share claim, the invented April
2020 vehicle description and the stale coverage figure, and reads its thresholds from config.

Fixed on `claude/caveats-wording` (D-030): caveat 1 now describes survivors; caveat 7's unchecked
statutory-rule and MIA claims are replaced by body-type counts from the 2026-08 pull.

Fixed on `claude/model-leaderboard` (D-029): `model-leaderboard` points at `registrations_flow`
and is blocked, as D-024 cut it; `LeagueChart` stays unused.

Fixed on `claude/sense-check` (D-028): hardcoded names in the extras, the hand-extracted data
feeding pages that looked like findings, the commentary, and the international figures (deleted).

Docs that contradict code (carried over, still unreconciled):

3. `README.md` says "No application code yet"; `pipeline/` and `src/` exist.
4. `CLAUDE.md` build order says no UI before two unattended runs; a UI was built 2026-09-12 (D-014).
5. `CLAUDE.md` §Stack names Cloudflare Pages and TanStack Table; neither is in the repo. Possibly
   plan, not contradiction.

## Blocked or waiting on the user

- **Freeze** on `pipeline/`, `.github/workflows/`, `config/dimensions.json`, `config/measures.json`,
  `config/pipeline.json`, `data/reference/*`, `pipeline/expected_schema.json`, `pipeline/tests/`,
  `docs/CUBE_SCHEMA.md` until the **8 November 2026** run passes (AGENTS.md hard rule 2).
- Review and merge of the seven open pull requests (`docs/CHECKPOINT.md`).
- Older open questions: what `shaken-clock` in D-020 refers to; which Gemini client is in use.

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). Rechecked
2026-10-19: `.venv` Python 3.13.7 and Node v22.19.0 work on this drive (`F:`); typecheck and
build pass on `claude/sense-check`. Pipeline tests were not re-run (no pipeline change). Headless
screenshots use `playwright-core` from a scratch folder with the Chromium already installed under
`%LOCALAPPDATA%\ms-playwright`; nothing is added to the repo.
