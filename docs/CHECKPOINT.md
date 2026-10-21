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
- Still frozen until the gate, found along the way: the `kgm-rename` mechanism, a 63-character event
  title, and the 0.29 percentile comment in `config/measures.json` (queue item 7).

## Open pull requests waiting on the user

1. #17 `claude/notes-after-merge`: STATE and CHECKPOINT after #1–#16 were merged. Into `ui/explore`.
2. #18 `claude/public-explore`: D-041. `/` shows visitors only the charts that draw; diagnostics move to
   the internal `/status`. Into `claude/notes-after-merge`; change its base to `ui/explore` once #17 is
   merged.
3. `claude/explore-copy-controls`: D-042. One row of time options per chart, plain visitor wording.
   Into `claude/public-explore`; same base change once #18 is merged.

## Work queue (in order)

1. **Build surface (the sentence builder)**, build step 5. Plan first: what the cube
   can answer today (one dataset, one-dimensional slices) and how the sentence maps onto it.
2. **Small `ui/explore` fix**, stacked on the newest UI branch: the time-horizon toggle on a league chart (STATE known
   issue 1). No live preset is a league, so check it by pointing a scratch copy of a preset at a
   league shape, not by editing `config/presets.json` for good. Done when switching horizon on a
   league chart keeps it a league, and mix and trend charts behave as before.
3. **8 November 2026 gate run.**
   - Scope: `docs/playbooks/check-monthly-run.md`. Fast-forward local `main` to `origin/main` first.
   - Done when: green/built/committed reported. If clean, the freeze lifts.
4. **POST_GATE A1**: pair slice `import_status` x `age_at_registration_band` (`POST_GATE.md`).
   Unblocks `used-import-age` and `age-distribution-moving-hole`.
5. **POST_GATE A2**: step 1b `registrations_flow` (Stats NZ TPT). Unblocks cohort survival.
6. **POST_GATE A3**: promote `segment_group`.
7. **POST_GATE B1–B3**: the three logged build fixes, one commit.
   Separately, one commit: move each `public_copy` entry in `config/presets.json` onto its dataset or
   dimension in `config/dimensions.json` (a public definition, label or note) and drop the block (D-042).
   Separately, one commit: correct `$min_share_of_trailing_median_comment` in `config/measures.json`
   to the D-033 figures (1st percentile 0.67 among months that clear 200; next-lowest after April 2020
   is 0.55). Done when the comment matches METRICS.md.
   Separately, one commit: settle `kgm-rename`'s mechanism against EVENTS_LAYER.md (STATE known
   issue 3); the registry merge means it marks no artefact, so the doc's rename example may be the
   part to change. Same commit or the next: shorten the 63-character title (known issue 4).
8. **When `ui/explore` is ready**: a PR from it into `main` (the user merges; it touches no frozen
   path, checked 2026-10-19 with `git diff --stat origin/main...ui/explore` on the frozen paths).

## Questions for the user

1. "Nov 8 is just the verification": may pipeline work (POST_GATE A1–A3, which unblock the four hidden
   charts) be built and tested on `claude/` branches before 8 November, kept off `main` until the gate
   passes? It changes AGENTS.md hard rule 2. Recommendation: yes, branches only, nothing merged to
   `main` and no local `pipeline run`. Default: the freeze stays as written.

## Prompt for the next session

/start. Read `docs/STATE.md` and this file. Take queue item 1 on a `claude/` branch stacked on the
newest open UI branch. If it is on or after 8 November 2026, run
`docs/playbooks/check-monthly-run.md` first.
