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
- Done: METRICS.md's two-guards section re-measured on the 2026-08 cube; five figures corrected,
  including the self-contradicting 0.29 percentile, which is also in frozen `config/measures.json` (D-033).
- Done: `/method` explains event markers, clusters and scope, the "All other" line, line colours and
  the three labels for values with no name, reading labels and caps from code and config (D-034).
  The review found a renderer gap and two smaller issues, queued below.
- Done: mix charts without `top_n` draw every group with vehicles in the drawn window, so segment
  "Not recorded" has a line; `/method` updated in the same PR (D-035).

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

PR 1: https://github.com/nickholttt/nzta-analytics-dashboard/pull/1 · PR 2: https://github.com/nickholttt/nzta-analytics-dashboard/pull/2 ·
PR 3: https://github.com/nickholttt/nzta-analytics-dashboard/pull/3 ·
PR 4: https://github.com/nickholttt/nzta-analytics-dashboard/pull/4 ·
PR 5: https://github.com/nickholttt/nzta-analytics-dashboard/pull/5 ·
PR 6: https://github.com/nickholttt/nzta-analytics-dashboard/pull/6 ·
PR 7: https://github.com/nickholttt/nzta-analytics-dashboard/pull/7 ·
PR 8: https://github.com/nickholttt/nzta-analytics-dashboard/pull/8 ·
PR 9: https://github.com/nickholttt/nzta-analytics-dashboard/pull/9

## Work queue (in order)

1. **Small `ui/explore` fixes**, one PR each: `concentration` note wording (known issue 4); whether
   `brand-share` gets `events: true` (known issue 3: check how many make markers it would show
   first); `docs/EVENTS_LAYER.md` rendering rules brought into line with the code (known issue 5).
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
7. **Reconcile docs** (STATE "Docs that contradict code" 6–8): README, build-order wording, stack.
8. **When `ui/explore` is ready**: a PR from it into `main` (the user merges; it touches no frozen
   path, checked 2026-10-19 with `git diff --stat origin/main...ui/explore` on the frozen paths).

## Questions for the user

None open.

## Prompt for the next session

/start. Read `docs/STATE.md` and this file. Check whether the nine PRs were merged. If it is on or
after 8 November 2026, run `docs/playbooks/check-monthly-run.md` first. Otherwise take queue item 1.
