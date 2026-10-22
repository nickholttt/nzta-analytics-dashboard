# Checkpoint

Last updated by claude on 2026-10-22

## Where we left off

- The 8 October gate run passed (`docs/STATE.md`); the 8 November run is the second.
- 2026-10-22, third session: the user asked to plan the visitor site's look and feel. Headless
  screenshots of `/` and `/build` at 390px and 1280px; a private design board (claude.ai
  artifact Q29nmEBkCn6Svb4jutwq6Q, figures from the local August 2026 cube) shows three
  directions: A, today's long scroll refined; B, a one-chart workbench where the builder's sentence
  drives every chart and the Explore questions are starting points; C, a grid of question cards.
  Nothing in the repo changed except these notes. Waiting on question 2.
- 2026-10-22, second session: the old queue item 1 is done. Three independent sub-agent reviews of
  the six pushed branches; every real finding fixed on the branch that introduced it and merged
  forward, with no rebase or force push; the choices and the points not taken are in D-057. Six pull
  requests opened: #30–#34 on the UI stack, #35 on the pipeline stack. Checked: every new commit
  typechecks and builds; headless at 320px and 1280px on each UI branch head (axe, console, sideways
  scroll, every "Change this chart" link); #35 by CI.
- 2026-10-22, first session: #26–#29 built on `main`'s side; step 1b blocked for lack of a source.
  The user's answers: step 1b waits for the Stats NZ Data Explorer; deploy by D-055's option (C)
  without the internal pages (D-056); the region map stays on the Build page.
- Earlier: the UI is Claude's (D-027); the visitor site is local only until the gate (D-041);
  frozen-path work is built on branches before it (D-043); the Build page is D-044 to D-046.

## Open pull requests waiting on the user

UI stack, merged in order into `ui/explore` (as each merges, retarget the next to `ui/explore`):

1. #17 `claude/notes-after-merge`: STATE and CHECKPOINT after #1–#16.
2. #18 `claude/public-explore`: the visitor Explore page and `/status` (D-041).
3. #19 `claude/explore-copy-controls`: one time row, visitor wording (D-042).
4. #20 `claude/pipeline-branch-rule`: AGENTS.md rule 2's exception (D-043).
5. #21 `claude/sentence-builder`: the Build page (D-044).
6. #22 `claude/builder-league`: the 12-month ranking (D-045).
7. #23 `claude/reserved-values`: reserved values on their own line (D-046).
8. #24 `claude/prototype-queue`: the prototype's queue items. Docs only.
9. #25 `claude/pipeline-decisions`: D-047 to D-051 and the step 1b finding. Docs only.
10. #30 `claude/explore-build-together`: "Change this chart" and one readout (D-052).
11. #31 `claude/pair-views`: the site reads pair slices (D-053, D-057).
12. #32 `claude/a11y-pass`: screen readers, tables of figures, the visitor-test playbook (D-057).
13. #33 `claude/geo-map`: the map on the Build page (D-054, D-057).
14. #34 `claude/deploy-proposal`: the public build, a not-found page, D-055 to D-057, these notes.

Pipeline stack, into `main`. **Do not merge before the 8 November run passes**:

15. #26 `claude/pr-checks`: tests on every pull request (D-048).
16. #27 `claude/pair-slice-import-age`: POST_GATE A1, pair slices (D-047).
17. #28 `claude/segment-group`: POST_GATE A3.
18. #29 `claude/post-gate-fixes`: B1–B3, the `measures.json` comment, `events.csv`, event schema
    checks, manufacturer group's cardinality (D-049 to D-051).
19. #35 `claude/deploy-workflow`: the cube release and `deploy.yml` (D-056, D-057). It may merge
    before `ui/explore` reaches `main`: until then `deploy.yml` stops before building.

## Work queue (in order)

1. **8 November 2026 gate run.** Scope: `docs/playbooks/check-monthly-run.md`, step 1b's source
   check included. Fast-forward local `main` to `origin/main` first. Done when: green, built or
   skipped, and committed are reported. If clean, the freeze lifts.
2. **Merging after the gate.** The user merges the UI stack into `ui/explore` and the pipeline stack
   into `main`, each in order. When #29 meets `ui/explore`, correct `$ranking_period_comment`
   (STATE known issue 4).
3. **`ui/explore` into `main`** (the user merges; it touches no frozen path, checked 2026-10-22).
4. **Once a monthly build carries #27 and #28**: flip `used-import-age` and `powertrain-mix` to live
   (STATE known issue 5); in one commit, move each `public_copy` entry onto `config/dimensions.json`
   and drop the block (D-042); size and add the `import_status` pairs that "of [all / new / used]
   vehicles" needs on the Build page (one pair per dimension, a pipeline config change each), then
   widen the builder (D-044).
5. **Step 1b, POST_GATE A2.** Waits until the TPT series reaches Stats NZ's Data Explorer (the
   user's choice); the monthly check looks each month. When it appears, plan the dataset.
6. **Deploy.** Built (D-056, D-057). After items 1 to 3, give the user numbered console steps, one
   at a time, all production: a Cloudflare Pages project for Direct Upload named
   `nz-vehicle-registrations` (or set the repository variable `CLOUDFLARE_PAGES_PROJECT`) with `main`
   as its production branch; an API token limited to Cloudflare Pages: Edit; the GitHub secrets
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, placed as question 1 decides. Then run
   `deploy.yml` by hand on `main`. Done when a `pages.dev` URL serves `/` and `/build` from a
   monthly run's cube, `/status` returns 404 with the not-found page, and first-load time is
   measured there at phone width.
7. **Visitor sessions and first-load speed.** Visitor sessions (the user runs them:
   `docs/playbooks/visitor-test.md`); first-load time on the deployed site; first-load speed (STATE
   known issue 1): small first-paint files per chart, which `docs/CUBE_SCHEMA.md` already plans
   (`presets/{preset_id}.json`), or a lighter bundle. Measure before and after, at phone width.
8. **`age-distribution-moving-hole`.** The distribution drawn year by year (a ridgeline inside the
   distribution shape) with its events. Re-triage the preset first (`presets.json` `$status`).
   UI work, so it may be built before the gate (D-041), as a local build only.
9. **Look and feel (question 2).** Once the user picks a direction: a decision record, then a
   plan in reviewable pieces on `claude/look-and-feel` (cut from `claude/deploy-proposal`). UI
   work, so it may be built before the gate (D-041), local only. Done when the chosen direction
   draws from the real cube at 320px and 1280px and the user has seen it.
10. **Map follow-ups.** A visitor name for "Area Outside Region" (STATE known issue 2); a
   per-capita map needs a population reference file (`docs/METRICS.md`, Per capita).

## Questions for the user

1. **Where the Cloudflare secrets live.** (a) Repository secrets: the workflow works as it is, and
   it already uploads only from `main`. (b) A GitHub environment limited to `main`: safer, because
   a workflow edited on another branch could not read them; `deploy.yml` needs one line
   (`environment:`) and the secrets go into the environment. I recommend (b). If there is no answer,
   I write the console steps for (a) and the workflow stays as it is.

2. **Which look-and-feel direction.** A (today's long scroll, refined), B (one-chart workbench:
   the sentence drives the chart, the questions are starting points) or C (grid of question
   cards), or a mix. I recommend B: it is the "flexible exploration tool" the brief aims at, keeps
   Explore and Build as two ways into one chart view, and needs no new renderer. With no answer,
   nothing is built.

## Prompt for the next session

/start. Read `docs/STATE.md` and this file. If it is on or after 8 November 2026, take item 1 (the
gate run) first. Before then, everything open waits on the user, except items 8 to 10, which are UI
work that may be built ahead of the gate as local builds.
