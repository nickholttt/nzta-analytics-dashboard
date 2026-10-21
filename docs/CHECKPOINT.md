# Checkpoint

Last updated by claude on 2026-10-22

## Where we left off

- The 8 October gate run passed (`docs/STATE.md`); the 8 November run is the second.
- 2026-10-22, a long session on queue items 1–10, doing what needed neither the gate nor the user:
  - Items 2, 4 and 5 built on `main`'s side as #26–#29, unmerged until the gate, Linux checks green.
    An independent review found no corruption; its real findings were folded in (D-051 among them).
  - Item 3 (step 1b) is blocked: no source can be fetched unattended (`docs/DATA_SOURCES.md` §C).
  - Items 7, 9 (all but the visitor sessions) and 10 built on the UI stack as five pushed branches.
    Their review stopped at the account's spend limit, so their PRs are not open yet.
  - Item 8: D-055 proposed how to deploy. Item 6 waits on the UI stack merging. Item 1 is on
    8 November.
- 2026-10-22, the user's answers: (1) step 1b waits for the Stats NZ Data Explorer, rechecked each
  month (`docs/playbooks/check-monthly-run.md`); (2) deploy by D-055's option (C), without the
  internal pages (D-056), now built: `claude/deploy-workflow` (the release step and `deploy.yml`,
  stacked on #29) and the public build on `claude/deploy-proposal`; (3) the region map stays on the
  Build page, checked at every time range and both widths.
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
8. #24 `claude/prototype-queue`: queue items 7–10. Docs only.
9. #25 `claude/pipeline-decisions`: D-047 to D-051 and the step 1b finding. Docs only.

Pipeline stack, into `main`. **Do not merge before the 8 November run passes**:

10. #26 `claude/pr-checks`: tests on every pull request (D-048).
11. #27 `claude/pair-slice-import-age`: POST_GATE A1, pair slices (D-047).
12. #28 `claude/segment-group`: POST_GATE A3.
13. #29 `claude/post-gate-fixes`: item 5. B1–B3, the `measures.json` comment, `events.csv`, event
    schema checks, manufacturer group's cardinality (D-049 to D-051).

## Work queue (in order)

1. **Review and open the six pushed branches.** Scope: an independent sub-agent review (the
   2026-10-22 one stopped at the spend limit) of the UI commits from `864afed` to
   `claude/deploy-proposal` and of `claude/deploy-workflow` (two commits on #29); fix what is real;
   open the UI PRs stacked on #25 (`explore-build-together`, `pair-views`, `a11y-pass`, `geo-map`,
   `deploy-proposal`, each into the one before) and `deploy-workflow` into `claude/post-gate-fixes`;
   then a notes commit with their numbers. Done when: six PRs open and these notes list them.
2. **8 November 2026 gate run.** Scope: `docs/playbooks/check-monthly-run.md`. Fast-forward local
   `main` to `origin/main` first. Done when: green/built/committed reported. If clean, the freeze
   lifts.
3. **Merging after the gate.** The user merges the UI stack into `ui/explore` and the pipeline stack
   into `main`, each in order. Then item 4.
4. **`ui/explore` into `main`** (the user merges; it touches no frozen path, checked 2026-10-19).
5. **Once a monthly build carries #27 and #28**: flip `used-import-age` and `powertrain-mix` to live
   (STATE known issue 5); correct `$ranking_period_comment` (known issue 4); in one commit, move
   each `public_copy` entry onto `config/dimensions.json` and drop the block (D-042); size and add
   the `import_status` pairs that "of [all / new / used] vehicles" needs on the Build page (one
   pair per dimension, a pipeline config change each), then widen the builder (D-044).
6. **Step 1b, POST_GATE A2.** Waits until the TPT series reaches Stats NZ's Data Explorer (the
   user's choice); the monthly check looks each month. When it appears, plan the dataset.
7. **Item 8, deploy.** Built (D-056). After items 2 to 4: give the user numbered console steps, one
   at a time (Cloudflare Pages project for Direct Upload, an API token limited to Pages: Edit, the
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets), then run `deploy.yml` by hand. Done
   when a `pages.dev` URL serves `/` and `/build` from a monthly run's cube, and first-load time is
   measured there at phone width.
8. **Item 9's remainder.** Visitor sessions (the user runs them: `docs/playbooks/visitor-test.md`);
   first-load time on the deployed site; first-load speed (STATE known issue 1): small first-paint
   files per chart, which `docs/CUBE_SCHEMA.md` already plans (`presets/{preset_id}.json`), or a
   lighter bundle. Measure before and after, at phone width.
9. **`age-distribution-moving-hole`.** The distribution drawn year by year (a ridgeline inside the
   distribution shape) with its events. Re-triage the preset first (`presets.json` `$status`).
10. **Map follow-ups.** A visitor name for "Area Outside Region" (known issue 2); a per-capita map
    needs a population reference file (`docs/METRICS.md`, Per capita).

## Questions for the user

None open. The three questions of 2026-10-22 were answered the same day (Where we left off).

## Prompt for the next session

/start. Read `docs/STATE.md` and this file. Take queue item 1 first (review and open the six pushed
branches). If it is on or after 8 November 2026, take item 2 (the gate run) first.
