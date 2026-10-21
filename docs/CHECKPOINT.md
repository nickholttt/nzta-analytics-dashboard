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
- 2026-10-21: the user asked for the 16 PRs to be merged (done) and then for "the interface the user
  will actually see" to be built, with an explanation if unsure. Scope questions 1–3 below.
- Still frozen until the gate, found along the way: the `kgm-rename` mechanism, a 63-character event
  title, and the 0.29 percentile comment in `config/measures.json` (queue item 6).

## Open pull requests waiting on the user

None. PRs #1–#16 were merged into `ui/explore` in order on 2026-10-21, at the user's request, and
their branches deleted. `ui/explore` is not merged into `main`.

## Work queue (in order)

0. **Visitor-facing interface**, waiting on questions 1–3. Default if unanswered: question 1 (a).
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

1. What should "the interface the user will actually see" cover? (a) The public Explore page: only
   charts that draw, the triage list, blocked panels, status badges and the sense-check link moved to
   an internal page, and a copy and layout pass so it reads as a finished site. (b) (a) plus the
   Build surface, the sentence builder (build step 5). (c) Something else, such as a redesign.
   Recommendation (a) first, then (b) as its own PR. I read your message as lifting AGENTS.md hard
   rule 8 (don't build ahead of the step) for UI work only; the pipeline freeze stays.
2. Which charts should a visitor see before the gate? Five presets are live; a sixth, `powertrain-mix`,
   draws with its "light passenger" filter not applied (the page says so); four wait on pipeline work
   after 8 November. Recommendation: show the six, `powertrain-mix` with its notice; hide the four.
3. When does it go live? It needs `ui/explore` merged into `main` (your call) and Cloudflare Pages set
   up (your console, my steps). Recommendation: after the 8 November gate and your review of the
   pages. Default: nothing deployed until you say.

## Prompt for the next session

/start. Read `docs/STATE.md` and this file. If questions 1–3 are answered, build queue item 0 on a
`claude/` branch from `origin/ui/explore`. If it is on or after 8 November 2026, run
`docs/playbooks/check-monthly-run.md` first.
