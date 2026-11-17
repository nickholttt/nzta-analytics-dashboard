# Checkpoint

Last updated by claude on 2026-11-17

## Where we left off

- 2026-11-14 and 15, eighth session, the first of work order 1: #47 to #59 merged (D-082 to
  D-095). October was forced once; no second forced run is allowed (D-082).
- 2026-11-16 and 17, ninth session. **Merged, #60 to #80** (#63 was closed unmerged). The
  user's answers are D-096 and D-106.
- 2026-11-17, tenth session: the user answered the parked questions (D-120). CLAUDE.md's two
  sentences about the grid and Plot are corrected, and its layout lists what exists (#81).
  **Merged: #81, #82, #84, #85** (#83 was closed and rebuilt as #85). `incoming/` is deleted.
- **Figures set beside published ones.** New vehicles on the wider scope: within 0.06% of the
  MIA's for October 2026, older months about 1% lower, cause not established (D-105, D-113).
  vstat (the Motor Trade Association's) equals ours for October 2026 (D-118). The 98 SUV-file
  entries that could be set beside the FCAI's published sample all agree (D-117).
- **What official sources settled on 17 November** (kept here until a piece uses each):
  - Mild or full: every authority read asks whether the motor can move the car alone (in
    METRICS, D-119). ACEA counts mild hybrids as hybrids, the UK's SMMT under petrol and
    diesel, the MIA in one "Hybrids" bucket; the FCAI's rule was not found.
  - No New Zealand government dataset classes models as SUVs (Rightcar and EECA's label site
    have no download; Clean Car Standard model data comes by request, with no body type).
  - Vehicle class MC is four-wheel drive plus four of five measured clearances and angles (the
    Rule's table as a certifier's 2010 sheet reproduces it): no SUV flag. Class labels: queue item 0.
  - Stats NZ's series leaves out re-registered vehicles and differs from NZTA's by timing; no
    publisher states how it revises past months.

## The user's direction of 16 November (D-104)

"keep working on the engine, it needs to be flawless, the public can wait"; consult what is
published about the New Zealand market. Claude's reading, unreviewed: engine first, no proposal
to launch early, each measure recomputed and set beside published New Zealand sources.

## Open pull requests

None. Two branches are being built (STATE, "In progress").

## The queue, in order

Done this session: the class labels (#85, D-121); the three fields as breakdowns and the
acceptance question with one swapped in, package F's done-when (#82, D-122); the SUV file's
second slice (#84, D-123).
1. **Hybrids and mild hybrids as one figure** (D-124, being built): a roll-up dimension from
   `powertrain_map.csv`'s group column, set beside the MIA's. A golden contract change.
2. **"My questions"** (D-125, being built): saved in the browser, redrawn on the newest month,
   able to be pinned; a pin holds the window, never another snapshot's figures.
3. **The SUV file's next slice** (D-123, "left"): people movers and sports cars; whether the
   register holds the Levorg Layback as LEVORG and the Impreza XV as IMPREZA; three sizes each
   for cars and SUVs from cited length and width against the FCAI's footprint bands; a rule
   per dataset; then the wiring and its guard. 61 rows are still `medium`: the sites refuse.
4. **Colour**, in a narrower table of counts of its own (a contract change; costs in D-116).
5. **Small engine follow-ups**: Tank to unresolved (a golden contract change); a reader that
   refuses a malformed reference row; the X-Trail row's basis; the dataset guard on a filtered
   dataset (D-118); the fixture harness's fields; a seats average. From #82's review: a notice
   for a link naming a value the data no longer holds; the three fields' notes cut to a line;
   class with segment group recorded in the data map; the service prototype's `unknown`.
6. **The rest of package F**: power and transmission; owner fields, private until small cells
   are hidden (D-096); the first owner table is shown to the user before any build publishes
   it, and the `region` slice takes the floor of 10 then (D-120); "My questions"; the
   related-fields note.
7. **Paused, uncommitted, behind `main`:** package H's narrative spec (D-102; worktree
   `nzta-screens`). D-103's draft scheme file is untracked in `nzta-segments`.

## Left in the packages

- **A.** Follow-ups (D-088, D-089): a digest of the rows the archive job pulls; dependencies
  pinned by hash and a draft-then-publish release step (after December's build); admin bypass
  on `production` (the user's); a second scope for events; a lookup refusing a blank value.
- **B.** Each month, as soon as the dashboard has it: the user's export, `python -m pipeline
  supply`, a `--dry-run` build, a pull request with the store's two files (D-097). **C.** The
  user's own Stats NZ export replaces the fetched copy.
- **D.** First load (#64, D-099): Explore's first chart 4.6 s, a Build answer 6.6 s on a phone,
  against 3 s; the fact table is 28.7% larger since #79 and is not timed again (question 2).
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
   sentence; the retaken dashboard history, due in Downloads (the user, 17 November: still
   to come).

Answered on 17 November (D-120): trade lists are a private check only, none reached through
the user's work is used at all; both readings of the chart rule stay; a change to the committed
counts may be followed by one forced build of the current month; the hybrid line stands.

## Decided for the user (unreviewed records in `docs/DECISIONS.md`)

D-082, D-085 to D-095 (the eighth session). This session: the readings in D-096, D-104 and
D-106 (with the MIT licence), and D-097 to D-101, D-105 and D-107 to D-119 (D-119's line is
now the user's). The tenth session: the readings in D-120, and CLAUDE.md's layout brought up
to date. Not yet in a record: the three sizes in queue item 3.

## How reviews run (the user, 17 November: reviews were costing 500K tokens and more)

One fresh reviewer per pull request. The builder's brief carries a checklist of what reviewers
kept finding; the reviewer gets the evidence and three to five things to test; a mechanical
fix is checked by the lead against the reviewer's stated remedy. Three sub-agents at once.

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` from CHECKPOINT's queue, in its order. Its §2
still stands: you may merge this work order's pull requests into `main` in this session when
checks are green and an independent reviewer agrees, and nothing in its §3 is touched. Do not
stop for questions; park what needs me and keep going. D-104 stands: the engine first and
right; check figures against published sources. Run reviews as CHECKPOINT says.

Check first: `git worktree list` and `git status` in each (`nzta-screens` and `nzta-segments`
hold uncommitted files: read before touching); open pull requests; the `Monthly build` runs
since 16 November; `CLOUDFLARE_PAGES_PROJECT` still unset. No local path in a doc or commit.
