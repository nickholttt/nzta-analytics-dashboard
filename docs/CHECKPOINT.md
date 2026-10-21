# Checkpoint

Last updated by claude on 2026-10-19

## Where we left off

- 8 October 2026 gate run passed: green, built, committed snapshot 2026-09 (`docs/STATE.md`).
- Gemini finished UI steps 2–5 and several extras on `ui/explore` on 2026-09-13. Nobody has
  reviewed them, and the branch has never been pushed.
- This session created this file (required by the global protocol of 2026-10-12) and rewrote
  `docs/STATE.md` as a snapshot, on `claude/bootstrap`. Docs only.

## Open pull requests waiting on the user

None on GitHub. `claude/bootstrap` is committed locally, not pushed (see question 2).

## Work queue (in order)

1. **Review `ui/explore`.**
   - Goal: decide what of Gemini's UI work stays.
   - Scope: STATE "Known issues" 1–5. Most likely outcome: keep the canon, method and caveats
     pages, URL state and mobile work; remove or rebuild the inspector, drilldown and benchmark.
   - Done when: the user has decided per item, and the agent they pick has made the change.
   - Decisions: D-020, D-024, D-025, D-026.
2. **8 November 2026 gate run.**
   - Goal: confirm the second unattended run.
   - Scope: `docs/playbooks/check-monthly-run.md`. Fast-forward local `main` to `origin/main` first.
   - Done when: green/built/committed reported. If clean, the freeze lifts.
3. **POST_GATE A1**: pair slice `import_status` x `age_at_registration_band` (`POST_GATE.md`).
   Unblocks `used-import-age` and `age-distribution-moving-hole`.
4. **POST_GATE A2**: step 1b `registrations_flow` (Stats NZ TPT). Unblocks cohort survival.
5. **POST_GATE A3**: promote `segment_group`.
6. **POST_GATE B1–B3**: the three logged build fixes, one commit.
7. **Reconcile docs** (STATE "Known issues" 6–8): README, build-order wording, stack wording.

## Questions for the user

1. **What happens to Gemini's extras on `ui/explore`?** The inspector, market drilldown and
   complexity benchmark break invariant #1, sit outside the pipeline, and add commentary the brief
   rules out. Options: (a) remove them and keep the rest; (b) rebuild any you want as presets fed
   by the cube; (c) keep them as a separate, clearly labelled side project. Recommendation: (a),
   then (b) only for a question you want answered. Default if no answer: nothing is touched; they
   stay unmerged on `ui/explore`.
2. **May Claude push its own `claude/*` branches?** `AGENTS.md` doesn't say, and the global rule
   is to ask. Recommendation: yes for `claude/*`, never `main`. Default: push nothing.
3. **Does the UI move to Claude, or stay with Gemini (D-025)?** Recommendation: hand it to
   Claude for the review fix-ups in item 1, since Claude did the design step. Default: Claude
   leaves those files alone.

## Prompt for the next session

/start. Read `docs/STATE.md` and this file. If the user answered the questions above, act on
them. If it is on or after 8 November 2026, run `docs/playbooks/check-monthly-run.md` first.
