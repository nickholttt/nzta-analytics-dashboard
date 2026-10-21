# State

Last updated by claude on 2026-10-21

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

## Branches (checked 2026-10-21)

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
| `claude/method-chart-key` | origin | `/method` explains event markers, "All other" and unnamed values (D-034). PR into `claude/metrics-april-2020` |
| `claude/mix-all-groups` | origin | mix charts without `top_n` draw every group in the drawn window (D-035). PR into `claude/method-chart-key` |
| `claude/concentration-note` | origin | `concentration` note names both readings of a falling line and the unmatched-make effect (D-036). PR into `claude/mix-all-groups` |
| `claude/brand-share-events` | origin | `brand-share` shows its 8 make-scoped events (D-037). PR into `claude/concentration-note` |
| `claude/events-layer-rendering` | origin | `docs/EVENTS_LAYER.md` rendering rules describe the code (D-038). PR into `claude/brand-share-events` |
| `claude/key-row-wrap` | origin | mix key keeps each swatch on its name's line at 320px. PR into `claude/events-layer-rendering` |
| `claude/event-band-clip` | origin | event bands and rules clipped to the chart's frame. PR into `claude/key-row-wrap` |
| `claude/marker-label-overlap` | origin | marker labels laid out in pixels, never overlapping, kept inside the frame (D-039). PR into `claude/event-band-clip` |

No CI runs on pull requests; the only workflow is the monthly build.

## In progress

- Nobody is editing. Claude's fifteen branches are in open pull requests waiting on the user, merged
  in this order: [#1](https://github.com/nickholttt/nzta-analytics-dashboard/pull/1)
  (`claude/bootstrap`), [#2](https://github.com/nickholttt/nzta-analytics-dashboard/pull/2)
  (`claude/sense-check`), [#3](https://github.com/nickholttt/nzta-analytics-dashboard/pull/3)
  (`claude/model-leaderboard`), [#4](https://github.com/nickholttt/nzta-analytics-dashboard/pull/4)
  (`claude/caveats-wording`), [#5](https://github.com/nickholttt/nzta-analytics-dashboard/pull/5) (`claude/method-page`),
  [#6](https://github.com/nickholttt/nzta-analytics-dashboard/pull/6) (`claude/caveat-scrappage`), then
  [#7](https://github.com/nickholttt/nzta-analytics-dashboard/pull/7) (`claude/metrics-april-2020`), then
  [#8](https://github.com/nickholttt/nzta-analytics-dashboard/pull/8) (`claude/method-chart-key`), then
  [#9](https://github.com/nickholttt/nzta-analytics-dashboard/pull/9) (`claude/mix-all-groups`), then
  [#10](https://github.com/nickholttt/nzta-analytics-dashboard/pull/10) (`claude/concentration-note`), then
  [#11](https://github.com/nickholttt/nzta-analytics-dashboard/pull/11) (`claude/brand-share-events`), then
  [#12](https://github.com/nickholttt/nzta-analytics-dashboard/pull/12) (`claude/events-layer-rendering`), then
  [#13](https://github.com/nickholttt/nzta-analytics-dashboard/pull/13) (`claude/key-row-wrap`), then
  [#14](https://github.com/nickholttt/nzta-analytics-dashboard/pull/14) (`claude/event-band-clip`), then
  [#15](https://github.com/nickholttt/nzta-analytics-dashboard/pull/15) (`claude/marker-label-overlap`).
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
3. `kgm-rename` is `mix` in `data/reference/events.csv`, but `docs/EVENTS_LAYER.md` names a brand
   renaming as a `measurement` example. `brand_registry.csv` already merges SSANGYONG and KG MOBILITY
   into KGM, so no chart shows a step (D-037). `events.csv` is frozen until the 8 November gate.
4. The published title "Electronic stability control required on all new light vehicles" is 63
   characters; the schema in `docs/EVENTS_LAYER.md` says at most 60. `events.csv` is frozen until
   the 8 November gate.

Fixed on `claude/marker-label-overlap` (D-039): event marker labels are laid out in pixels against the
chart's frame, cluster harder when they cannot fit in 4 lanes, and slide inward to stay inside the
frame, which also places the label of an event that starts before the chart (formerly known issues 4
and 5). Measured headless on every chart with events on `/`, 320px and 1280px, both ranges, with and
without market-wide events: 6 overlapping label pairs and 28 labels past the frame before, 0 and 0
after. `powertrain-mix` with market-wide events now shows 6 markers at 320px, 8 at 1280px.

Fixed on `claude/event-band-clip`: event window bands and event rules are clipped to the chart's frame. Before,
with market-wide events shown, `ccs-charges-cut` (ends 2027-12-31) and
`ccs-targets-aligned-australia` (2029-12-31) shaded past the right edge on all seven mix charts on
`/`, at 320px and 1280px; after, no unclipped mark lies outside the frame (headless measurement). Rules
were not outside the frame on this cube; the clip covers an event that starts before the chart.

Fixed on `claude/key-row-wrap`: the mix key's first cell is nowrap, so the swatch stays on its name's
line; names still wrap between words. Measured headless on all 64 key rows of `/`: 2 rows with a
swatch off its name's line at 320px before, 0 after; none at 1280px either way. Column 1 is up to 14px
wider at 320px, so some two-word names now fit on one line. LeagueChart's swatch cell was already nowrap.

Fixed on `claude/events-layer-rendering` (D-038): `docs/EVENTS_LAYER.md`'s rendering rules now
describe the code (market-wide events off until shown, clustering by distance on the axis, numbered
markers with an event list instead of title labels and a tooltip), and three other lines that
contradicted it are corrected. Docs only.

Fixed on `claude/brand-share-events` (D-037): `brand-share` shows the 8 make-scoped events, 8
markers on 10 years and 4 clusters on all time; Toyota's agency move keeps its dashed rule and
measurement warning. No markers under parent group (no event is scoped to `brand_group`).

Fixed on the earlier open branches (D-028 to D-036): each fix is in its decision record and pull
request, listed under In progress.

Docs that contradict code (carried over, still unreconciled):

5. `README.md` says "No application code yet"; `pipeline/` and `src/` exist.
6. `CLAUDE.md` build order says no UI before two unattended runs; a UI was built 2026-09-12 (D-014).
7. `CLAUDE.md` §Stack names Cloudflare Pages and TanStack Table; neither is in the repo. Possibly
   plan, not contradiction.

## Blocked or waiting on the user

- **Freeze** on `pipeline/`, `.github/workflows/`, `config/dimensions.json`, `config/measures.json`,
  `config/pipeline.json`, `data/reference/*`, `pipeline/expected_schema.json`, `pipeline/tests/`,
  `docs/CUBE_SCHEMA.md` until the **8 November 2026** run passes (AGENTS.md hard rule 2).
- Review and merge of the fifteen open pull requests (`docs/CHECKPOINT.md`).
- Older open questions: what `shaken-clock` in D-020 refers to; which Gemini client is in use.

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). Rechecked
2026-10-21: `.venv` Python 3.13.7 and Node v22.19.0 work on this drive (`F:`); typecheck and
build pass on `claude/brand-share-events`. Pipeline tests were not re-run (no pipeline change). Headless
screenshots use `playwright-core` from a scratch folder with the Chromium already installed under
`%LOCALAPPDATA%\ms-playwright`; nothing is added to the repo.
