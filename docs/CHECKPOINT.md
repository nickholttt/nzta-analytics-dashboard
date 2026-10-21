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
  - Item 8: D-055 proposes how to deploy. Item 6 waits on the UI stack merging. Item 1 is on
    8 November.
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

1. **Review and open the five pushed UI branches.** Scope: an independent sub-agent review of the UI
   commits from `864afed` to `claude/deploy-proposal` (the 2026-10-22 one stopped at the spend
   limit); fix what is real; open the PRs stacked on #25: `explore-build-together`, `pair-views`,
   `a11y-pass`, `geo-map`, `deploy-proposal`, each into the one before; then a notes commit with
   their numbers. Done when: five PRs open and these notes list them.
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
6. **Step 1b, POST_GATE A2.** Waits on a source: question 1.
7. **Item 8, deploy.** After items 2 and 4, with the user's choice on D-055 (question 2): the
   workflow on a branch, then numbered console steps. Done when a preview URL serves `/` and
   `/build` from a monthly run's cube.
8. **Item 9's remainder.** Visitor sessions (the user runs them: `docs/playbooks/visitor-test.md`);
   first-load time on the deployed site; first-load speed (STATE known issue 1): small first-paint
   files per chart, which `docs/CUBE_SCHEMA.md` already plans (`presets/{preset_id}.json`), or a
   lighter bundle. Measure before and after, at phone width.
9. **`age-distribution-moving-hole`.** The distribution drawn year by year (a ridgeline inside the
   distribution shape) with its events. Re-triage the preset first (`presets.json` `$status`).
10. **Map follow-ups.** A visitor name for "Area Outside Region" (known issue 2); a per-capita map
    needs a population reference file (`docs/METRICS.md`, Per capita).

## Questions for the user

1. **Where step 1b's numbers come from.** Stats NZ's Aotearoa Data Explorer has no transport series
   yet, and Infoshare has no API (`docs/DATA_SOURCES.md` §C). Options: (a) wait, rechecking the
   Explorer each month; (b) you ask Stats NZ when the TPT tables reach the Explorer, and NZTA
   whether it publishes monthly first registrations as a download; (c) a monthly manual download,
   which ends the unattended pipeline. Recommendation: (b), with (a) meanwhile. Default: (a); step
   1b, counts and cohort survival stay parked.
2. **How to deploy (D-055).** (A) Cloudflare Pages builds from git, with the cube committed each
   month; (B) a deploy workflow taking the newest 90-day cube artifact; (C) as (B), with the cube
   also kept as a GitHub release. And: do `/status` and `/sense-check` ship publicly?
   Recommendation: (C), without the internal pages. Default: nothing is set up; nothing deploys
   before the gate in any case.
3. **A region map on Explore?** D-024 took regional charts off Explore because the region is the
   owner's current address. The map is on the Build page only, with that note. Recommendation: keep
   it there. Default: Build page only.

## Prompt for the next session

/start. Read `docs/STATE.md` and this file. Take queue item 1 first (review and open the five UI
branches). If it is on or after 8 November 2026, take item 2 (the gate run) first.
