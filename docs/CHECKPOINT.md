# Checkpoint

Last updated by claude on 2026-11-18

## Where we left off

- 2026-11-14 to 18, the eighth to eleventh sessions of work order 1: #47 to #102 merged (D-082
  to D-141). October was forced on 14 and 17 November at the user's word (D-134); any further
  forced run is asked for each time, except after a change to the committed counts (D-120).
- **Figures set beside published ones**: D-105, D-113 (the MIA), D-118 (vstat), D-124 (Auto
  Trader's hybrids), D-123 and D-145 (SUV shares inside our range).
- 2026-11-18, twelfth session. **Merged: #103, #104, #106, #107, #108.** A share against a
  hidden line total says so, and a one-period ranking shows every value (#104, D-142). The
  deploy reads every page of releases and stops before the upload past the host's limits
  (#106, D-146). The build refuses an owner field in any fact table (#107). **Colour** is
  bound, in a narrow fact table of colour, make and powertrain group (#108, D-144, a contract
  change). **The board proposal** for D-138 is written with mockups (#105, D-143) and parked.

## Open pull requests

- **#105** the board proposal (D-143): parked for the user; questions below. Mergeable; its
  review agreed. Merge only on the user's word about the proposal.
- **#109** the SUV file's third slice (D-145): its review asked for five fixes (Mazda2/3 and
  the Impreza to `medium`, "sports car" written into the rule, the CLASS cross-check scoped,
  main merged in); the builder was making them when this was written. Check the branch: if
  the fixes are in, push, watch `Checks`, re-check the fixes narrowly, merge.

## The queue, in order

**The user's end state (D-138):** a self-serve board of charts. #105 proposes how; raise it
first when UI or classification work starts.

1. **The site reads the narrow table** (D-144): Build answers a question from
   `facts.narrow` when every field it names is in one narrow table, and offers colour.
   Engine leftovers from the reviews of #107 and #108: `stock_configuration_problems` to read
   `narrow_facts`; `kept-snapshots.mjs`'s owner scan to cover `narrow/`; a `facts` entry that
   is not a string gives a TypeError, not the build's message; the manifest example in
   `docs/CUBE_SCHEMA.md` to show `facts.narrow`; `AGENTS.md`'s dry-run row (14 min 17 s,
   111 files, payload 5,759,161 bytes); the deploy's artifact fallback reads one page.
2. **What the dashboard's "Vehicle usage" column records** (D-134), then **"Registered as"**
   (D-140): match October's and November's archive files privately after NZTA's December
   refresh and report. If the usage is as at first registration, keep it and owner type in
   the store (the user's word first). Then a private ledger of each vehicle's first use.
3. **Drawing a hidden cell** (D-130 lists what it needs), only when a chart by the owner's
   region is wanted.
4. **The SUV file** after #109 (D-145 "What is left"): the next nameplates without a row
   (Mazda Biante, Audi A3, Honda e:N1, VW Polo, Nissan Sylphy and others); the `medium` and
   `unresolved` rows (BYD Atto 2 and Sealion 5/6 have a readable NZ site not yet tried);
   D-117 items 1 to 3 (three sizes each for cars and SUVs against the FCAI's footprint bands,
   people movers and sports cars as classes, the wiring and its guard); a rule for COROLLA.
5. **Small follow-ups.** Engine: Tank to unresolved (a golden change); a reader that refuses
   a malformed reference row; the X-Trail row's basis; the dataset guard on a filtered
   dataset (D-118); the fixture harness's fields; a seats average. Site: class with segment
   group recorded in the data map; the query service prototype's `unknown`, `build.snapshot`
   and `public_line` (D-137's follow-ups); the moderate axe `heading-order` on Build's
   `h3.panel-question`.
6. **The related-fields note** from the data map, in Build (package F's last site item),
   reading the figures D-136 writes.
7. **Paused, uncommitted, behind `main`:** package H's narrative spec (D-102; worktree
   `nzta-screens`). D-103's draft scheme file is untracked in `nzta-segments`.

## Left in the packages

- **A.** Follow-ups (D-088, D-089): a digest of the rows the archive job pulls; dependencies
  pinned by hash and a draft-then-publish release step (after December's build); admin bypass
  on `production` (the user's); a second scope for events; a lookup refusing a blank value.
- **B.** Each month: the user's export, `pipeline supply`, a `--dry-run` build, a pull request
  with the store's two files (D-097), one forced build if the month was built (D-120). **C.**
  The user's Stats NZ export. **D.** First load (D-099): 4.6 s and 6.6 s against 3 s; not
  timed since the table grew.
- **E.** `sentinels.csv` gaining the map's forms; the rule table checking `uses.break_down`.
- **The final report** (the order §6), with `docs/brief/MASTER_BRIEF.md` §4 and §12 updated.
  Keep `README.md`'s "What it can answer today" and "Not there yet" lists true as work lands.

## Questions for the user (parked; none stops the work)

1. **The board proposal (#105, `docs/brief/CANVAS_PROPOSAL.md`)**, three questions in it:
   which path (recommended: a board beside Build, starting with "Add to board"); shapes that
   do not fit a question (recommended: listed greyed with the reason, never drawn, which adds
   one sentence to CLAUDE.md's Shapes); which visual variants first (recommended: small
   multiples and a single figure). With no answer, nothing is built before package H is done.
2. **The site's name and web address** (`config/site.json`, search `TO DECIDE`): parked by
   the user. The About page stays a marked draft until both are filled.
3. **Later, by the user's word:** the query service (after the engine's audit, D-120); the
   Stats NZ hand export; going public; the privacy sentence; the retaken dashboard history.

## Decided for the user (unreviewed records in `docs/DECISIONS.md`)

D-082, D-085 to D-095 (the eighth session). The ninth: the readings in D-096, D-104 and D-106,
and D-097 to D-101, D-105 and D-107 to D-119. The tenth: the readings in D-120, and D-121 to
D-125. The eleventh: the readings in D-126, D-134, D-138, D-140, D-127 to D-137 and D-139.
The twelfth: D-142, D-144, D-145 (if #109 merges), D-146; #107's refusal reads every
dataset's `facts`, live or not (no record). D-143 is a proposal, not a decision.

## How reviews run (the user, 17 November: reviews were costing 500K tokens and more)

One fresh reviewer per pull request (sonnet for docs only). The builder's brief carries a
checklist of what reviewers kept finding; the reviewer gets the evidence and three to five
things to test; a mechanical fix is checked by the lead against the reviewer's stated remedy;
a fix that is new code gets a narrow re-check of the finding and the fix alone. Three
sub-agents at once, at most two on opus. Builders commit locally; the lead pushes and opens
the pull request (a builder told to push was refused by Claude Code's permission check on
18 November). Builders run only the tests that cover their change; `Checks` runs the rest.
Parallel branches each take a decision number the lead hands out, to avoid clashes.

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` from CHECKPOINT's queue, in its order. Its §2
still stands: you may merge this work order's pull requests into `main` in this session when
checks are green and an independent reviewer agrees, and nothing in its §3 is touched. Do not
stop for questions; park what needs me and keep going. D-104 stands: the engine first and
right, no proposal to launch early, figures set beside published ones. Reviews: as above.

Check first: `git worktree list` and `git status` in each (`nzta-screens` and `nzta-segments`
hold uncommitted files: read before touching; `nzta-suv` may hold #109's fixes); open pull
requests (#105 parked, #109); the `Monthly build` runs since 17 November (has NZTA refreshed:
is a November build or archive there? The next build is the first to publish the fleet,
colour and the narrow table); `CLOUDFLARE_PAGES_PROJECT` still unset. No local path in a doc
or commit.
