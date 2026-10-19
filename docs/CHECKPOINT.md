# Checkpoint

Last updated by claude on 2026-10-19

## Where we left off

- 8 October 2026 gate run passed: green, built, committed snapshot 2026-09 (`docs/STATE.md`).
- The user answered on 2026-10-19 (D-027): the UI comes back to Claude; agents may push their own
  branches; Gemini's extras stay as a clearly labelled sense-check area, and any part of no value
  is documented and deleted.
- Done: `/inspector` replaced by an internal `/sense-check` page of 14 plain tables; the
  international benchmark deleted, with its contents recorded in D-028.
- Done: `model-leaderboard` blocked on step 1b again (D-029); blocked panels drop the horizon
  toggle and unfillable notes; triage heading no longer claims 9 presets.
- Done: caveats 1 and 7 say only what the data shows (D-030), checked against the raw 2026-08 pull.
- Done: `/method` checked line by line against METRICS.md, config, the reference CSVs and the
  renderers; thresholds now read from config; April 2020 figures re-measured from the cube (D-031).
- Done: caveat 2's "shares hold up" checked against the 2026-08 and 2026-09 snapshots and found
  wrong; caveat 2 and the share notes now say uneven scrappage skews older shares (D-032).

## Open pull requests waiting on the user

Merge them in this order:

1. `claude/bootstrap`: CHECKPOINT.md, STATE.md as a snapshot, D-026, D-027, AGENTS.md rule 7.
2. `claude/sense-check`: D-028. Into `ui/explore`, stacked on the first, so its diff shows the
   first's commits until that one is merged.
3. `claude/model-leaderboard`: D-029. Into `claude/sense-check`; once #2 is merged, it needs its
   base changed to `ui/explore` before it can be merged there.
4. `claude/caveats-wording`: D-030. Into `claude/model-leaderboard`; same base change once #3 is
   merged.
5. `claude/method-page`: D-031. Into `claude/caveats-wording`; same base change once #4 is merged.
6. `claude/caveat-scrappage`: D-032. Into `claude/method-page`; same base change once #5 is merged.

PR 1: https://github.com/nickholttt/nzta-analytics-dashboard/pull/1 · PR 2: https://github.com/nickholttt/nzta-analytics-dashboard/pull/2 ·
PR 3: https://github.com/nickholttt/nzta-analytics-dashboard/pull/3 ·
PR 4: https://github.com/nickholttt/nzta-analytics-dashboard/pull/4 ·
PR 5: https://github.com/nickholttt/nzta-analytics-dashboard/pull/5 ·
PR 6: https://github.com/nickholttt/nzta-analytics-dashboard/pull/6

## Work queue (in order)

1. **Finish the `ui/explore` review** (now Claude's, D-027).
   - Scope: correct METRICS.md's April 2020 truck baseline and pre-1990 wording (STATE "Known
     issues" 2).
     Then add to `/method` what the charts show but no page explains: event markers (solid, dashed,
     dotted, shaded), the "All other" series, and the labels for unmatched and unrecorded values.
     Done: `model-leaderboard` (PR 3, D-029), caveats 1 and 7 (PR 4, D-030), `/method` (PR 5, D-031),
     caveat 2 (PR 6, D-032).
   - Done when: each is fixed or recorded as a decision, in one PR per concern.
2. **8 November 2026 gate run.**
   - Scope: `docs/playbooks/check-monthly-run.md`. Fast-forward local `main` to `origin/main` first.
   - Done when: green/built/committed reported. If clean, the freeze lifts.
3. **POST_GATE A1**: pair slice `import_status` x `age_at_registration_band` (`POST_GATE.md`).
   Unblocks `used-import-age` and `age-distribution-moving-hole`.
4. **POST_GATE A2**: step 1b `registrations_flow` (Stats NZ TPT). Unblocks cohort survival.
5. **POST_GATE A3**: promote `segment_group`.
6. **POST_GATE B1–B3**: the three logged build fixes, one commit.
7. **Reconcile docs** (STATE "Docs that contradict code" 3–5): README, build-order wording, stack.
8. **When `ui/explore` is ready**: a PR from it into `main` (the user merges; it touches no frozen
   path, checked 2026-10-19 with `git diff --stat origin/main...ui/explore` on the frozen paths).

## Questions for the user

None open.

## Prompt for the next session

/start. Read `docs/STATE.md` and this file. Check whether the six PRs were merged. If it is on or
after 8 November 2026, run `docs/playbooks/check-monthly-run.md` first. Otherwise take queue item 1.
