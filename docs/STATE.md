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
| `main` | origin `e3246bb` | the pipeline and the bot's 2026-09 snapshot; `ui/explore` not merged into it |
| `ui/explore` | origin `3c10716` | everything below plus PRs #1–#16, merged by Claude at the user's request on 2026-10-21 |
| `claude/notes-after-merge` | origin | the notes after the merge. PR #17 into `ui/explore` |
| `claude/public-explore` | origin | `/` for visitors, diagnostics on `/status` (D-041). PR #18 into `claude/notes-after-merge` |
| `claude/explore-copy-controls` | origin | one row of time options, plain visitor wording, `public_copy` (D-042). PR #19 into `claude/public-explore` |
| `claude/pipeline-branch-rule` | origin | AGENTS.md rule 2 exception for branches before the gate (D-043). PR #20 into `claude/explore-copy-controls` |

PRs #1–#16 were merged into `ui/explore` in order with merge commits; their 16 remote branches are
deleted. Local copies of those branches and the local `ui/explore` (behind origin) were left as they
were: fast-forwarding local `ui/explore` was refused by the session's permission check. No CI runs on
pull requests; the only workflow is the monthly build.

## In progress

- Claude: the visitor-facing site (D-041), local only until the 8 November gate. Open PRs #17 (notes),
  #18 (`claude/public-explore`) stacked on it, and #19 (`claude/explore-copy-controls`) on that.
- The UI on `ui/explore` is Claude's from 2026-10-19 (D-027, superseding D-025).

## What `ui/explore` contains (merged 2026-10-21; the user has not reviewed the pages)

Pages `/`, `/method`, `/caveats`, and the internal `/sense-check` (replaces `/inspector`) and, on
`claude/public-explore`, `/status` (D-041). Explore canon of 10 presets in three groups, URL state and permalinks, mobile
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
5. `src/components/PresetPanel.tsx` hides the time row when `preset.dataset !== "used_imports"`: a
   dataset id in code, against invariant 1 (found 2026-10-21, D-042). No live preset uses that
   dataset; move the rule into config when a preset does.

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

Fixed on `claude/reconcile-docs` (D-040): README describes the repo as it is (pipeline, local UI,
the files that exist, who commits a run's output); `CLAUDE.md` keeps its plan and notes that Cloudflare
Pages and TanStack Table are planned, that the UI was built ahead of the build order (D-014), and lists
`src/`; `AGENTS.md` lists `LeagueChart` among the renderers. Docs only.

## Blocked or waiting on the user

- **Freeze** on `pipeline/`, `.github/workflows/`, `config/dimensions.json`, `config/measures.json`,
  `config/pipeline.json`, `data/reference/*`, `pipeline/expected_schema.json`, `pipeline/tests/`,
  `docs/CUBE_SCHEMA.md` until the **8 November 2026** run passes (AGENTS.md hard rule 2). Since
  2026-10-21 (D-043) that work may be built on branches from `main`, unmerged until the gate passes.
- Older open questions: what `shaken-clock` in D-020 refers to; which Gemini client is in use.

## How to run

`AGENTS.md` §Commands has the verified commands (Git Bash; `gh` by full path). Rechecked
2026-10-21: `.venv` Python 3.13.7 and Node v22.19.0 work on this drive (`F:`); typecheck and
build pass on `claude/brand-share-events`. Pipeline tests were not re-run (no pipeline change). Headless
screenshots use `playwright-core` from a scratch folder with the Chromium already installed under
`%LOCALAPPDATA%\ms-playwright`; nothing is added to the repo.
