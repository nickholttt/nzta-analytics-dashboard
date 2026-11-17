# Checkpoint

Last updated by claude on 2026-11-18

## Where we left off

- 2026-11-14 to 17, the eighth to tenth sessions of work order 1: #47 to #88 merged (D-082
  to D-125). October was forced on 14 November, and again on 17 November at the user's word
  (D-134); any further forced run is asked for each time, except after a change to the
  committed counts (D-120).
- **Figures set beside published ones.** New vehicles on the wider scope: within 0.06% of the
  MIA's for October 2026, older months about 1% lower, cause not established (D-105, D-113).
  vstat equals ours for October 2026 (D-118). Hybrids as one group, new passenger vehicles,
  October 2026: 4,978 of 11,824; Auto Trader has the same total and 4,859 "petrol hybrids";
  119 of our mild hybrids that month are one diesel nameplate; cause not claimed (D-124).
- 2026-11-17 and 18, eleventh session (D-126, D-134). **Merged: #90 to #99.** Axles withdrawn
  (D-129); a pinned link reads its own snapshot's cube (D-131); the `region` slice under the
  small-cell rule (D-127); power and the gearbox bound (D-128); the site refuses a table with
  hidden counts (D-130, D-133). **October forced again** (D-134): the release `cube-2026-10`
  now holds all four datasets and the `region` slice with small cells hidden, checked on the
  published file. It broke two prototype tests in `Checks`; #97 fixed them. Build offers
  power and the gearbox, starting with vehicles sold new (#96, D-132). The site follow-ups
  (#98, D-137): a link's absent value is told and dropped; field notes are one line.
- **Measured on 17 November for the next pieces** (a read-only profile of the saved 2026-10
  pull; restate each figure, re-measured, in the record of the piece that uses it):
  - Colour: 14 values, 5 blanks. A narrow table with make alone is about 276 KB; with make
    and segment group or import status about 370 KB; with make and powertrain 407 KB.

## Open pull requests

- None. #99 (D-136): each build writes how strongly every pair of public fields moves together.
- **Not pushed, on purpose:** `claude/fleet-usage-private` (D-135; `nzta-notes`), the first
  owner table, built; `claude/fleet-usage-private-site` (D-139; `nzta-firstload`), drawing it
  with hidden cells. Shown to the user before any push (D-120, D-134).

## The queue, in order

**The user's end state (D-138):** a self-serve, drag-and-drop chart canvas, not a page that
tells visitors what to look at. Nothing changes now; raise it first when UI work starts.

1. **The first owner table: the fleet by usage, "used as, today"** (the user, D-134): every
   vehicle in the snapshot, by usage and by usage and vehicle type, never by first
   registration; a one-period dataset with a two-field small-cell rule. Being built on the
   unpushed branch above. Then: the figures and headless screenshots to the user, and no pull
   request before the user's word. Industry class and district wait (D-134).
2. **What the dashboard's "Vehicle usage" column records** (the user, D-134): match vehicles
   between October's and November's archive files, privately, once the archive job stores
   November after NZTA's December refresh; report it before any table of usage at first
   registration.
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
   dataset (D-118); the fixture harness's fields; a seats average. Site: class with segment
   group recorded in the data map; the query service prototype's `unknown`, `build.snapshot`
   and `public_line` (D-137's follow-ups).
7. **The related-fields note** from the data map, in Build (package F's last site item),
   reading the figures D-136 writes.
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

## Decided for the user (unreviewed records in `docs/DECISIONS.md`)

D-082, D-085 to D-095 (the eighth session). The ninth: the readings in D-096, D-104 and D-106
(with the MIT licence), and D-097 to D-101, D-105 and D-107 to D-119 (D-119's line is now the
user's). The tenth: the readings in D-120, and D-121 to D-125. The eleventh: the readings in
D-126, D-134 and D-138, and D-127 to D-137. Not yet in a record: the three sizes in queue item 5.

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
