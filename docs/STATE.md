# State

Last updated by gemini on 2026-09-13

Branches at time of writing: `main` and `origin/main` at `ba304d2`. The shared-context commit sits on
`claude/shared-agent-context`, and `ui/explore` (checked out) was fast-forwarded to it so both agents
see these files where the UI work happens. Nothing was pushed.

## Done

- **Build step 1 pipeline** (`registrations_surviving`) is on GitHub. Forced run 34646200411 built a
  cube byte-identical to a local build; unforced run 34648180201 skipped the build as designed. Both
  green, 2026-09-11. 38 tests pass locally (2026-09-13).
- **Reference data** Part 2: brand promotions, ARCHION ownership, `as_at`, `mild_hybrid_models.csv`
  with coverage (D-009 to D-011).
- **Events**: 54 rows, 50 verified. Four are unverified on purpose (Honda and Mercedes-Benz agency
  starts, the semiconductor window, the weak yen). Don't guess dates to clear them.
- **Local reference UI** (d788e41..ba304d2, pushed): mix, trend and distribution renderers, preset
  triage, two share guards, config-driven mix defaults, concentration chart. Preset canon in
  `config/presets.json`: 26 presets, 8 live / 17 blocked / 1 invalid.
- **Shared agent context** (branch `claude/shared-agent-context`): AGENTS.md, this file,
  DECISIONS.md, playbooks, skill wrappers.
- **Agent skills sync**: Claude's 8 playbook skills imported to `.agents/skills/` (Antigravity
  customization root) and `.gemini/skills/` in the workspace.
- **UI verification**: Local dev server verified via Chrome DevTools MCP rendering all live charts
  cleanly on `http://127.0.0.1:4321/`.
- **UI step 1 ("design only")**: Reviewed and approved by the user.
- **UI step 2 ("Three-tier Explore page & canon cut 26 → 9")**: Done (2026-09-13).
  - Canon reshaped in `config/presets.json` to 9 presets across 3 tiers (D-020, D-024).
  - Merged `brand-share` and `parent-group-share` behind a config-driven `granularity_options` toggle in `PresetPanel.tsx`.
  - Three-tier layout with masthead tier anchors implemented on `/` (`src/pages/index.astro`).
  - Canon triage table confirms: `9 presets · 1 invalid · 3 blocked · 5 live` with 0 disagreements.
  - Verified with TypeScript typecheck, `astro build`, and 38 pytest tests (all green).
- **UI step 3 ("Methodology & Data Caveats pages with shared layout")**: Done (2026-09-13).
  - Created shared `src/layouts/Layout.astro` with site-level header navigation (Explore, Methodology, Data Caveats), snapshot timestamp, and footer attribution.
  - Created `/method` (`src/pages/method.astro`) from `docs/METRICS.md` covering grains (survivors vs flow vs stock), vehicle scope, core measures, percentage point rule, suppression guards (including April 2020 lockdown case study), top-5 concentration, mild hybrid bounds, and estimation principles.
  - Created `/caveats` (`src/pages/caveats.astro`) covering registration vs sale (MIA differences), survivor bias, 2007 `vehicle_year` break, what TLA means, why regional view was cut, "Built in" vs "Brand nationality", and mild hybrid coverage limits.
  - Added prose typography tokens and table styles to `src/styles/site.css`.
  - Verified clean Astro build (3 static HTML pages) and browser verification via Chrome DevTools MCP.

## In progress

- **UI step 4 of 5, URL State & Deep Linking**. Owner: gemini, at the user's direction.
  Files touched in UI steps:
  - `src/layouts/Layout.astro`, `src/pages/method.astro`, `src/pages/caveats.astro`
  - `config/presets.json`, `src/lib/config.ts`, `src/components/PresetPanel.tsx`, `src/pages/index.astro`
  - `src/components/DistributionChart.tsx`, `EventList.tsx`, `MixChart.tsx`, `PlotFigure.tsx`,
    `PresetTriage.tsx`, `TrendChart.tsx`
  - `src/lib/measures.ts`, `src/lib/theme.ts`, `src/styles/site.css`
  - `package.json`, `package-lock.json`
- **POST_GATE.md reorder**. Written by claude at the user's direction; committed on
  `ui/explore` at the user's request on 2026-09-13:
  inserts A2 (step 1b `registrations_flow` as the unlock for cohort survival) and renumbers the
  `segment_group` promotion to A3.

## Next up

User's order on `ui/explore`, one step at a time, each stop-and-show:

1. URL state: anchors plus chart options (preset selection, granularity, smoothing).
2. Mobile polish & touch optimization.

Findings already reported to the user (2026-09-13), for the UI steps:

- `brand-vs-built` needs only a renderer: owner_country `Japan` and built_in `JAPAN` are both in the
  1-D slices. The gap opened over 2000–2012 and has held at 9–13 pp since. It is a **net** gap; a
  gross gap would need a pair slice.
- `manifest.json` `used_import_age_trailing.shares` already carries the trailing-12-month used-import
  age distribution, so a single-period `used-import-age` could render without the frozen pair slice.
- Colour: the line palette has 8 colours (validated all-pairs for colour blindness). No palette carries
  14 series, so series past 8 are grey context lines.
- UI verification in earlier sessions used a headless Chromium (Playwright) installed **outside** the
  repo, driving `npm run dev`. It is not in the repo, and adding one is the user's call.

Then, by date:

- **8 October 2026**: check the scheduled run (`docs/playbooks/check-monthly-run.md`) and report
  green/built/committed.
- **8 November 2026**: same. If both are clean, the freeze lifts. POST_GATE A1 → A2 → A3, then B1–B3.

## Blocked

- **Freeze** on pipeline, workflow, cube schema, tests and reference data until the 8 November 2026
  run passes (AGENTS.md hard rule 2).
- **Docs contradict code. Needs the user; not reconciled:**
  1. `README.md` says "No application code yet" and "No frontend yet. The pipeline covers build step 1
     only". `pipeline/` and a working site in `src/` exist.
  2. `CLAUDE.md` build order says to prove the Action runs unattended two months running "before
     building any UI", and that step 3 renders `mix` and `trend` only. A UI with a `distribution`
     renderer was built on 2026-09-12, before any scheduled run (D-014).
  3. `CLAUDE.md` §Stack names Cloudflare Pages and TanStack Table. Neither is in the repo, and
     `astro.config.mjs` says "Local reference tool only". This may be plan, not contradiction.
     Confirm.
- **Open questions for the user:**
  - D-020 lists `shaken-clock` among the cut presets, but no preset has that id in
    `config/presets.json`. D-024 records what it was meant to be; confirm the id.
  - Should the shared-context commit also go to `main` now (docs only, outside the frozen paths),
    or wait for the freeze to lift?
  - Which Gemini client is in use? Only Antigravity's data directories exist under `~/.gemini/`;
    no `gemini` CLI is on the PATH.
- **Not verified this session:** `npm install` and venv creation from scratch; whether the Gemini
  client reads `~/.gemini/GEMINI.md` and `./AGENTS.md` automatically; the PowerShell form of
  `UPDATE_GOLDEN=1`; the `public/data` swap in `docs/playbooks/refresh-public-data.md` step 4.
