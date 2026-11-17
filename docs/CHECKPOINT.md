# Checkpoint

Last updated by claude on 2026-11-17

## Where we left off

- 2026-11-14 to 17, the eighth to tenth sessions of work order 1: #47 to #88 merged (D-082
  to D-125). October was forced once; no second forced run is allowed (D-082), except after
  a change to the committed counts (D-120).
- **Figures set beside published ones.** New vehicles on the wider scope: within 0.06% of the
  MIA's for October 2026, older months about 1% lower, cause not established (D-105, D-113).
  vstat equals ours for October 2026 (D-118). Hybrids as one group, new passenger vehicles,
  October 2026: 4,978 of 11,824; Auto Trader has the same total and 4,859 "petrol hybrids";
  119 of our mild hybrids that month are one diesel nameplate; cause not claimed (D-124).
- 2026-11-17 and 18, eleventh session. The user changed three things (D-126). **Merged: #90**
  (D-126; D-129: `NUMBER_OF_AXLES` is a count only on heavy vehicles and is withdrawn from
  every use) **and #92** (D-131: a link pinned to an earlier month reads that snapshot's own
  cube, which the deploy keeps in the built site, less any owner table not written under the
  small-cell rule). `Deploy` ran clean on `main` after #92 and uploaded nothing; with one
  release, downloading a second is not yet proven on GitHub.
- **Measured on 17 November for the next pieces** (a read-only profile of the saved 2026-10
  pull; restate each figure, re-measured, in the record of the piece that uses it):
  - Colour: 14 values, 5 blanks. A narrow table with make alone is about 276 KB; with make
    and segment group or import status about 370 KB; with make and powertrain 407 KB.

## Open pull requests (each in independent review on 18 November)

- **#91** (D-127; `claude/small-cells`, worktree `nzta-audit`): the `region` slice under the
  small-cell rule. The review found a month shape that gave hidden cells away; fixed (a month
  with no visible cell is not broken down), re-measured, in re-check. **Merge this first.**
- **#93** (D-128; `claude/power-transmission`, `nzta-notes`): power in bands, the gearbox in
  four groups. Whichever of #91 and #93 merges second needs `main` merged in and the golden
  file regenerated in that merge commit (both change `payload_bytes` and the manifest).
- **#94** (D-130; `claude/hidden-cells-guard`, `nzta-firstload`): the site refuses a slice
  with hidden counts and blocks a question over a protected dimension. After #91 merges, run
  `node --test tests/site/hidden-cells-loader.test.ts`: its printed note must be gone.

## The queue, in order

1. **Power and transmission in Build** (package F): after #93, the two fields as breakdowns
   (config phrases, the "recorded for NZ-new vehicles only" note, the shape fixture).
2. **The first owner table** (D-096, D-120), after #91: built privately and shown to the
   user, as figures and screenshots, before a pull request that would publish it merges.
   Measured on 17 November: by month, 47.7% of district cells are under 10; over the latest
   12 months as one window, one cell each for district, region and industry class.
3. **Drawing a hidden cell** (D-130 lists what it needs), only when a chart by the owner's
   region is wanted. **The pinned link's leftovers** (D-131): the "newest cube" step reads one
   page of releases; the host's limits are unchecked (a kept snapshot adds about 3.2 MB).
4. **Colour**, in a narrow table of counts of its own (a contract change; costs above).
5. **The SUV file's next slice** (D-123, "left"): people movers and sports cars; whether the
   register holds the Levorg Layback as LEVORG and the Impreza XV as IMPREZA; three sizes each
   for cars and SUVs from cited length and width against the FCAI's footprint bands; a rule
   per dataset; then the wiring and its guard. 61 rows are still `medium`: the sites refuse.
6. **Small follow-ups.** Engine: Tank to unresolved (a golden change); a reader that refuses
   a malformed reference row; the X-Trail row's basis; the dataset guard on a filtered
   dataset (D-118); the fixture harness's fields; a seats average. Site: a notice for a link
   naming a value the data no longer holds (a band's `unknown`, a class by its bare code); the
   register fields' notes cut to a line; class with segment group recorded in the data map;
   the pinned line told the first month the panel loads, so the register's line can say its
   window is kept (D-125); the template lint reading `config/my_questions.json`; the query
   service prototype's `unknown` and `build.snapshot`.
7. **The related-fields note** from the data map, in Build (package F's last site item).
8. **Paused, uncommitted, behind `main`:** package H's narrative spec (D-102; worktree
   `nzta-screens`). D-103's draft scheme file is untracked in `nzta-segments`.

## Left in the packages

- **A.** Follow-ups (D-088, D-089): a digest of the rows the archive job pulls; dependencies
  pinned by hash and a draft-then-publish release step (after December's build); admin bypass
  on `production` (the user's); a second scope for events; a lookup refusing a blank value.
- **B.** Each month, as soon as the dashboard has it: the user's export, `python -m pipeline
  supply`, a `--dry-run` build, a pull request with the store's two files (D-097), then one
  forced build of that month if it was already built (D-120). **C.** The user's own Stats NZ
  export replaces the fetched copy.
- **D.** First load (#64, D-099): Explore's first chart 4.6 s, a Build answer 6.6 s on a phone,
  against 3 s; the fact table and Build's code have grown since and are not timed again.
- **E.** The pipeline writing the "moves together" figures each build; `sentinels.csv`
  gaining the map's forms as fields are bound; the rule table checking `uses.break_down`.
- **The final report** (the order §6), with `docs/brief/MASTER_BRIEF.md` §4 and §12 updated.
  Keep `README.md`'s "What it can answer today" and "Not there yet" lists true as work lands.

## Questions for the user (parked; none stops the work)

1. **The site's name and web address** (`config/site.json`, search `TO DECIDE`): parked by
   the user. The About page stays a marked draft until both are filled.
2. **The query service** (`docs/brief/QUERY_SERVICE_PROPOSAL.md`): the user decides after the
   full engine is audited again (D-120). Nothing is provisioned or spent until then.
3. **Later, by the user's word:** the Stats NZ hand export; going public; the privacy
   sentence; the retaken dashboard history (the user, 17 November: still to come).
4. **The release `cube-2026-10` holds the `region` slice with no cell hidden** (D-126). (a)
   Leave it. (b) "Force October" once the rule is on `main`, replacing the release.
   Recommended (b): a pinned link will read it. No answer: (a), and a pin skips its regions.

## Decided for the user (unreviewed records in `docs/DECISIONS.md`)

D-082, D-085 to D-095 (the eighth session). The ninth: the readings in D-096, D-104 and D-106
(with the MIT licence), and D-097 to D-101, D-105 and D-107 to D-119 (D-119's line is now the
user's). The tenth: the readings in D-120, and D-121 to D-125. The eleventh: the readings in
D-126, and D-127 to D-131. Not yet in a record: the three sizes in queue item 5.

## How reviews run (the user, 17 November: reviews were costing 500K tokens and more)

One fresh reviewer per pull request. The builder's brief carries a checklist of what reviewers
kept finding; the reviewer gets the evidence and three to five things to test; a mechanical
fix is checked by the lead against the reviewer's stated remedy; a fix that is new code gets a
narrow re-check of the finding and the fix alone. Three sub-agents at once. A branch stacked
on an open pull request is re-made on `main` if that pull request is closed.

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` from CHECKPOINT's queue, in its order. Its §2
still stands: you may merge this work order's pull requests into `main` in this session when
checks are green and an independent reviewer agrees, and nothing in its §3 is touched. Do not
stop for questions; park what needs me and keep going. D-104 stands: the engine first and
right, no proposal to launch early, figures set beside published ones. Reviews: as above.

Check first: `git worktree list` and `git status` in each (`nzta-screens` and `nzta-segments`
hold uncommitted files: read before touching); open pull requests; the `Monthly build` runs
since 16 November; `CLOUDFLARE_PAGES_PROJECT` still unset. No local path in a doc or commit.
