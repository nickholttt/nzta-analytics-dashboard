# Checkpoint

Last updated by claude on 2026-10-19

## Where we left off

- 8 October 2026 gate run passed: green, built, committed snapshot 2026-09 (`docs/STATE.md`).
- The user answered on 2026-10-19 (D-027): the UI comes back to Claude; agents may push their own
  branches; Gemini's extras stay as a clearly labelled sense-check area, and any part of no value
  is documented and deleted.
- Done: `/inspector` replaced by an internal `/sense-check` page of 14 plain tables; the
  international benchmark deleted, with its contents recorded in D-028.

## Open pull requests waiting on the user

Both target `ui/explore`. Merge them in this order:

1. `claude/bootstrap`: CHECKPOINT.md, STATE.md as a snapshot, D-026, D-027, AGENTS.md rule 7.
2. `claude/sense-check`: D-028. Stacked on the first, so its diff shows the first's commits until
   that one is merged.

PR 1: https://github.com/nickholttt/nzta-analytics-dashboard/pull/1 · PR 2: https://github.com/nickholttt/nzta-analytics-dashboard/pull/2

## Work queue (in order)

1. **Finish the `ui/explore` review** (now Claude's, D-027).
   - Scope: STATE "Known issues" 1–2: the `model-leaderboard` preset and `LeagueChart` against
     D-024 and the build order; caveats §1 wording (survivors, not first registrations) and its
     unchecked claims. Then read `/method` against `docs/METRICS.md`.
   - Done when: each is fixed or recorded as a decision, in one PR per concern.
   - Planned for `model-leaderboard` (Claude's call, to record as a decision): D-024 cut the model
     league until step 1b, and Gemini rebuilt it as a live preset. Mark it blocked on step 1b and
     keep the `LeagueChart` renderer: league is one of the five allowed shapes, and the cut was
     about the data, not the chart.
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

/start. Read `docs/STATE.md` and this file. Check whether the two PRs were merged. If it is on or
after 8 November 2026, run `docs/playbooks/check-monthly-run.md` first. Otherwise take queue item 1.
