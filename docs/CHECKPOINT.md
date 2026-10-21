# Checkpoint

Last updated by claude on 2026-10-21

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
- Done: METRICS.md's two-guards section re-measured on the 2026-08 cube; five figures corrected,
  including the self-contradicting 0.29 percentile, which is also in frozen `config/measures.json` (D-033).
- Done: `/method` explains event markers, clusters and scope, the "All other" line, line colours and
  the three labels for values with no name, reading labels and caps from code and config (D-034).
  The review found a renderer gap and two smaller issues, queued below.
- Done: mix charts without `top_n` draw every group with vehicles in the drawn window, so segment
  "Not recorded" has a line; `/method` updated in the same PR (D-035).
- Done 2026-10-21: the `concentration` note names both readings of a falling top-5 share and the
  unmatched-make effect on the early decades (D-036).
- Done 2026-10-21: `brand-share` shows its 8 make-scoped events (D-037). Found while checking: the
  `kgm-rename` mechanism disagrees with EVENTS_LAYER.md (frozen file), and a key row wraps at 320px.
- Done 2026-10-21: `docs/EVENTS_LAYER.md`'s rendering rules describe the code as it runs (D-038).
  Found while checking: event bands may spill past the chart's right edge, and one title is over
  the 60-character limit (frozen file).
- Done 2026-10-21: the mix key keeps each swatch on its name's line at 320px (`claude/key-row-wrap`).
- Done 2026-10-21: event bands and rules stop at the chart's frame (`claude/event-band-clip`). Found
  while checking: marker labels pile up at 320px on `powertrain-mix` with market-wide events shown.
- Done 2026-10-21: marker labels never overlap and stay inside the frame, at 320px and 1280px
  (`claude/marker-label-overlap`, D-039). Numbering can now differ between phone and desktop widths.

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
PR 15: https://github.com/nickholttt/nzta-analytics-dashboard/pull/15

## Work queue (in order)

1. **8 November 2026 gate run.**
   - Scope: `docs/playbooks/check-monthly-run.md`. Fast-forward local `main` to `origin/main` first.
   - Done when: green/built/committed reported. If clean, the freeze lifts.
2. **POST_GATE A1**: pair slice `import_status` x `age_at_registration_band` (`POST_GATE.md`).
   Unblocks `used-import-age` and `age-distribution-moving-hole`.
3. **POST_GATE A2**: step 1b `registrations_flow` (Stats NZ TPT). Unblocks cohort survival.
4. **POST_GATE A3**: promote `segment_group`.
5. **POST_GATE B1–B3**: the three logged build fixes, one commit.
   Separately, one commit: correct `$min_share_of_trailing_median_comment` in `config/measures.json`
   to the D-033 figures (1st percentile 0.67 among months that clear 200; next-lowest after April 2020
   is 0.55). Done when the comment matches METRICS.md.
   Separately, one commit: settle `kgm-rename`'s mechanism against EVENTS_LAYER.md (STATE known
   issue 3); the registry merge means it marks no artefact, so the doc's rename example may be the
   part to change. Same commit or the next: shorten the 63-character title (known issue 4).
6. **Reconcile docs** (STATE "Docs that contradict code" 5–7): README, build-order wording, stack.
7. **When `ui/explore` is ready**: a PR from it into `main` (the user merges; it touches no frozen
   path, checked 2026-10-19 with `git diff --stat origin/main...ui/explore` on the frozen paths).

## Questions for the user

None open.

## Prompt for the next session

/start. Read `docs/STATE.md` and this file. Check whether the fifteen PRs were merged. If it is on or
after 8 November 2026, run `docs/playbooks/check-monthly-run.md` first. Otherwise take queue item 6
(reconcile docs): it touches no frozen path, so it need not wait for the gate. `README.md` first;
the `CLAUDE.md` build-order and stack lines describe the plan, so record any change in a decision.
