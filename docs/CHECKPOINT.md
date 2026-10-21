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
- Still frozen until the gate, found along the way: the `kgm-rename` mechanism, a 63-character event
  title, and the 0.29 percentile comment in `config/measures.json` (queue item 6).

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
7. `claude/metrics-april-2020`: D-033. Into `claude/caveat-scrappage`; same base change once #6 is
   merged.
8. `claude/method-chart-key`: D-034. Into `claude/metrics-april-2020`; same base change once #7 is
   merged.
9. `claude/mix-all-groups`: D-035. Into `claude/method-chart-key`; same base change once #8 is
   merged.
10. `claude/concentration-note`: D-036. Into `claude/mix-all-groups`; same base change once #9 is
    merged.
11. `claude/brand-share-events`: D-037. Into `claude/concentration-note`; same base change once
    #10 is merged.
12. `claude/events-layer-rendering`: D-038, docs only. Into `claude/brand-share-events`; same base
    change once #11 is merged.
13. `claude/key-row-wrap`: CSS only, no decision record. Into `claude/events-layer-rendering`; same
    base change once #12 is merged.
14. `claude/event-band-clip`: `clip` on four Plot marks and one EVENTS_LAYER.md rule, no decision record.
    Into `claude/key-row-wrap`; same base change once #13 is merged.
15. `claude/marker-label-overlap`: D-039. Into `claude/event-band-clip`; same base change once #14
    is merged.
16. `claude/reconcile-docs`: D-040, docs only. Into `claude/marker-label-overlap`; same base change
    once #15 is merged.

PR 1: https://github.com/nickholttt/nzta-analytics-dashboard/pull/1 · PR 2: https://github.com/nickholttt/nzta-analytics-dashboard/pull/2 ·
PR 3: https://github.com/nickholttt/nzta-analytics-dashboard/pull/3 ·
PR 4: https://github.com/nickholttt/nzta-analytics-dashboard/pull/4 ·
PR 5: https://github.com/nickholttt/nzta-analytics-dashboard/pull/5 ·
PR 6: https://github.com/nickholttt/nzta-analytics-dashboard/pull/6 ·
PR 7: https://github.com/nickholttt/nzta-analytics-dashboard/pull/7 ·
PR 8: https://github.com/nickholttt/nzta-analytics-dashboard/pull/8 ·
PR 9: https://github.com/nickholttt/nzta-analytics-dashboard/pull/9 ·
PR 10: https://github.com/nickholttt/nzta-analytics-dashboard/pull/10 ·
PR 11: https://github.com/nickholttt/nzta-analytics-dashboard/pull/11 ·
PR 12: https://github.com/nickholttt/nzta-analytics-dashboard/pull/12 ·
PR 13: https://github.com/nickholttt/nzta-analytics-dashboard/pull/13 ·
PR 14: https://github.com/nickholttt/nzta-analytics-dashboard/pull/14 ·
PR 15: https://github.com/nickholttt/nzta-analytics-dashboard/pull/15 ·
PR 16: https://github.com/nickholttt/nzta-analytics-dashboard/pull/16

## Work queue (in order)

1. **Small `ui/explore` fix**, stacked on #16: the time-horizon toggle on a league chart (STATE known
   issue 1). No live preset is a league, so check it by pointing a scratch copy of a preset at a
   league shape, not by editing `config/presets.json` for good. Done when switching horizon on a
   league chart keeps it a league, and mix and trend charts behave as before.
2. **8 November 2026 gate run.**
   - Scope: `docs/playbooks/check-monthly-run.md`. Fast-forward local `main` to `origin/main` first.
   - Done when: green/built/committed reported. If clean, the freeze lifts.
3. **POST_GATE A1**: pair slice `import_status` x `age_at_registration_band` (`POST_GATE.md`).
   Unblocks `used-import-age` and `age-distribution-moving-hole`.
4. **POST_GATE A2**: step 1b `registrations_flow` (Stats NZ TPT). Unblocks cohort survival.
5. **POST_GATE A3**: promote `segment_group`.
6. **POST_GATE B1–B3**: the three logged build fixes, one commit.
   Separately, one commit: correct `$min_share_of_trailing_median_comment` in `config/measures.json`
   to the D-033 figures (1st percentile 0.67 among months that clear 200; next-lowest after April 2020
   is 0.55). Done when the comment matches METRICS.md.
   Separately, one commit: settle `kgm-rename`'s mechanism against EVENTS_LAYER.md (STATE known
   issue 3); the registry merge means it marks no artefact, so the doc's rename example may be the
   part to change. Same commit or the next: shorten the 63-character title (known issue 4).
7. **When `ui/explore` is ready**: a PR from it into `main` (the user merges; it touches no frozen
   path, checked 2026-10-19 with `git diff --stat origin/main...ui/explore` on the frozen paths).

## Questions for the user

None open.

## Prompt for the next session

/start. Read `docs/STATE.md` and this file. Check whether the sixteen PRs were merged. If it is on or
after 8 November 2026, run `docs/playbooks/check-monthly-run.md` first. Otherwise take queue item 1.
