# Checkpoint

Last updated by claude on 2026-10-21

## Where we left off

- 8 October 2026 gate run passed: green, built, committed snapshot 2026-09 (`docs/STATE.md`).
- The user answered on 2026-10-19 (D-027): the UI comes back to Claude; agents may push their own
  branches; Gemini's extras stay as a clearly labelled sense-check area, and any part of no value
  is documented and deleted.
- Done 2026-10-19 to 2026-10-21, each in its own open PR and decision record (D-028 to D-040; PRs
  #2 to #16, listed below): `/sense-check` replaces `/inspector`; `model-leaderboard` blocked on 1b;
  caveats 1, 2 and 7 and `/method` checked against the data and code; METRICS.md figures re-measured;
  mix charts draw every group; `concentration` and `brand-share` notes and events; EVENTS_LAYER.md
  rendering rules match the code; mix key, event bands and marker labels fixed at 320px (marker
  numbering can now differ between phone and desktop, D-039); README, CLAUDE.md and AGENTS.md
  describe the repo as it is (D-040).
- 2026-10-21: the user had Claude merge #1–#16 and answered the scope questions (D-041): build the
  visitor-facing Explore page, then the sentence builder; an interactive platform, easy to understand,
  less restricted than VSTATS; local dev build only until 8 November. First PR done:
  `claude/public-explore`, then `claude/explore-copy-controls` (D-042).
- 2026-10-21: the user agreed that frozen-path work may be built on branches before the gate, kept off
  `main` until it passes (D-043, AGENTS.md rule 2).
- 2026-10-21: the Build page, PR #21 (D-044). Share only; 13 sentences draw at 320px and 1280px.
  An independent review found 7 issues: 6 fixed, 1 recorded in D-044.
- 2026-10-21: builder PR B, PR #22 (D-045). "12-month ranking" on `/build` for brand; league presets keep
  their ranking (former STATE known issue 1). Manufacturer group does not rank: `dimensions.json` calls it
  medium cardinality. An independent review found 6 points, all addressed.
- 2026-10-21: PR #23 (D-046). Capped mix charts draw "Not recorded" and "No reference match" as their own
  grey line, not inside "All other" (former STATE known issue 5); the builder caps country where built at 10.
  It changes `brand-share` on Explore: a "No reference match" row and line; uncapped charts are unchanged.
- Still frozen until the gate, found along the way: the `kgm-rename` mechanism, a 63-character event
  title, and the 0.29 percentile comment in `config/measures.json` (queue item 5).

## Open pull requests waiting on the user

1. #17 `claude/notes-after-merge`: STATE and CHECKPOINT after #1–#16 were merged. Into `ui/explore`.
2. #18 `claude/public-explore`: D-041. `/` shows visitors only the charts that draw; diagnostics move to
   the internal `/status`. Into `claude/notes-after-merge`; change its base to `ui/explore` once #17 is
   merged.
3. #19 `claude/explore-copy-controls`: D-042. One row of time options per chart, plain visitor wording.
   Into `claude/public-explore`; same base change once #18 is merged.
4. #20 `claude/pipeline-branch-rule`: D-043. AGENTS.md rule 2 lets frozen-path work be built on branches
   before the gate. Into `claude/explore-copy-controls`.
5. #21 `claude/sentence-builder`: D-044. The Build page `/build`, with seven decisions listed at the top
   of the PR. Into `claude/pipeline-branch-rule`.
6. #22 `claude/builder-league`: D-045. A 12-month brand ranking on `/build`, and league presets keep their
   ranking. Into `claude/sentence-builder`.
7. #23 `claude/reserved-values`: D-046. Reserved values keep their own line on capped mix charts; the builder
   caps country where built. Into `claude/builder-league`.

## Work queue (in order)

1. **8 November 2026 gate run.**
   - Scope: `docs/playbooks/check-monthly-run.md`. Fast-forward local `main` to `origin/main` first.
   - Done when: green/built/committed reported. If clean, the freeze lifts.
   From item 2 on, the work may be built before the gate on branches from `main` with PRs into `main`
   left unmerged until the gate passes (D-043); the gate run itself is still checked on its day.
2. **POST_GATE A1**: pair slice `import_status` x `age_at_registration_band` (`POST_GATE.md`).
   Unblocks `used-import-age` and `age-distribution-moving-hole`.
3. **POST_GATE A2**: step 1b `registrations_flow` (Stats NZ TPT). Unblocks cohort survival.
4. **POST_GATE A3**: promote `segment_group`.
5. **POST_GATE B1–B3**: the three logged build fixes, one commit.
   Separately, one commit: move each `public_copy` entry in `config/presets.json` onto its dataset or
   dimension in `config/dimensions.json` (a public definition, label or note) and drop the block (D-042).
   Separately, one commit: correct `$min_share_of_trailing_median_comment` in `config/measures.json`
   to the D-033 figures (1st percentile 0.67 among months that clear 200; next-lowest after April 2020
   is 0.55). Done when the comment matches METRICS.md.
   Separately, after A1 and A2 merge: widen the builder (D-044) with "of [all / new / used] vehicles"
   (A1's pair slices), counts and models (A2), each a `builder` config edit, and drop the matching
   "Not offered yet" lines.
   Separately: decide whether `parent_group` should be high cardinality in `config/dimensions.json`, so
   the builder can rank manufacturer groups (D-045); one config edit, with screenshots of every chart it
   touches.
   Separately, one commit: settle `kgm-rename`'s mechanism against EVENTS_LAYER.md (STATE known
   issue 2); the registry merge means it marks no artefact, so the doc's rename example may be the
   part to change. Same commit or the next: shorten the 63-character title (known issue 3).
6. **When `ui/explore` is ready**: a PR from it into `main` (the user merges; it touches no frozen
   path, checked 2026-10-19 with `git diff --stat origin/main...ui/explore` on the frozen paths).

## Questions for the user

None open.

## Prompt for the next session

/start. Read `docs/STATE.md` and this file. If it is on or after 8 November 2026, take queue item 1 (the gate
run, `docs/playbooks/check-monthly-run.md`) first. Otherwise take queue item 2 (POST_GATE A1) on a `claude/`
branch cut from `main`, with its PR into `main` left unmerged until the gate passes (D-043).
