# Checkpoint

Last updated by claude on 2026-11-16

## Where we left off

- 2026-11-14 and 15, eighth session, the first of work order 1: #47 to #59 merged (D-082 to
  D-095). October was forced once; no second forced run is allowed (D-082).
- 2026-11-16, ninth session.
  - **Merged:** #60, the user's answers (D-096): privacy classes approved, three About gaps
    filled. #61, package C's charts and completeness by vehicle type (D-098). #62, package
    E's chart rules, with the site's tests in `Checks` (D-100, D-101).
  - **The site's figures were set beside published ones** (D-105): October 2026 agrees with
    the MIA to 0.06% once three vehicle types the site leaves out are counted; older months
    sit about 1% lower, cause not established. Three figures are unexplained.
  - **The sub-agents stopped twice at the account's usage limit**; "Work in hand" says where.

## The user's direction of 16 November (D-104)

The user's words: "keep working on the engine, it needs to be flawless, the public can wait";
"dont skim out on making it right"; and to consult what is published online about the New
Zealand market where things do not look right or a measure has not been probed.

Claude's reading, unreviewed (D-104): the work order's order stands, with the engine before
the public-facing packages and no proposal to launch early; each measure is recomputed
independently of the site's code; figures are compared with published New Zealand sources.

## Open pull requests

- #64 `claude/first-load` (D-099): the first-load trim. Checks pass; **not yet reviewed**
  (its reviewer stopped at the usage limit). It has not taken in #62: merge `main` first.
- #65 `claude/published-comparison` (D-105): **not yet reviewed.**

## Work in hand, in the order to pick it up

1. **The supplied counts as files** (D-097; #63 was closed unmerged). In the main folder, on
   `claude/stores-in-repo`, with uncommitted edits (`config/pipeline.json`,
   `pipeline/build.py`, `pipeline/normalise.py`, `pipeline/supplied.py`): the store keeps a
   model name only for vehicle types the dataset counts; a replaced month the last good
   state does not yet reflect is excused; playbooks. Then a clean branch
   `claude/supplied-counts` from `main`, so no commit that reaches `main` ever held the
   untrimmed file. The first pushed version stays reachable on GitHub through #63.
2. **Review and merge #64 and #65.**
3. **The engine's audit** (D-104): every measure recomputed from the register's rows, then
   compared with what the built site shows. Stopped in its first phase, reading definitions.
   The built site for it is the worktree `nzta-audit`.
4. **Package F**, each field checked against the data and published sources before Build
   offers it. Order: colour, seats, where assembled, class; power and transmission; owner
   fields last, unpublished until the pipeline hides small cells (D-096). Then ranked chosen
   values, the `matrix` renderer, any number of conditions, "My questions", the
   related-fields note, CSV of what is on screen, the acceptance question both ways.
5. **Paused, half written, uncommitted:** package H's narrative spec (D-102; worktree
   `nzta-screens`, `claude/narrative-spec`: `config/narrative/` files and a lint test, no
   `docs/NARRATIVE.md` yet) and package I's proposed segment scheme (D-103; worktree
   `nzta-segments`, `claude/model-segments`: one reference file so far). Both are behind `main`.

## Left in the packages

- **A.** Follow-ups, each with its reason in D-088 or D-089: a digest of the rows the archive
  job pulls; dependencies pinned by hash and a draft-then-publish release step (after
  December's build); admin bypass on `production` (the user's); two Build behaviours for
  chosen values (F); a model's name shows its separator, `/build/` skips a heading (H); a
  second scope for events; a lookup should refuse a blank value at build time.
- **B.** Each month: the user's export, `python -m pipeline supply`, a `--dry-run` build.
- **C.** The user's own Stats NZ export replaces the fetched copy.
- **D.** First load is in #64: Explore's first chart 7.98 s to 4.61 s, a Build answer 7.59 s
  to 6.58 s, on the phone profile. The 3-second target is not met; Build waits on its data.
- **E.** The pipeline writing the "moves together" figures each build; `sentinels.csv`
  gaining the map's forms as each field is bound; the rule table checking `uses.break_down`.
- **The final report** (the order §6), with `docs/brief/MASTER_BRIEF.md` §4 and §12 updated.
  Keep `README.md`'s "What it can answer today" and "Not there yet" lists true as work lands.

## Questions for the user (parked; none stops the work)

1. **The code's licence:** none (all rights reserved), MIT or Apache 2.0. The owner's to
   choose. With no answer the README keeps saying no licence is chosen.
2. **The About page's three gaps** (`config/site.json`, search `TO DECIDE`): the site's name,
   its web address, and who runs it. With no answer the page stays a marked draft.
3. **The query service** (`docs/brief/QUERY_SERVICE_PROPOSAL.md`), now that the trim is
   measured (D-099): a Build answer still takes 6.6 to 10.3 s on a phone, nearly all of it
   the data download. A paid function (about US$5 a month), or lighter files at no cost.
   Recommend deciding after the engine's audit. With no answer nothing is spent.
4. **Should the site count new vehicles as the trade does?** (D-105.) The default scope leaves
   out buses, motor caravans and special purpose vehicles, which the MIA counts as
   commercial, so the site's total reads 1.4% to 3.9% under the MIA's. (a) Bring the three
   into scope. (b) Keep the scope and offer a total on the trade's basis beside it. (c) Leave
   it, with the page saying why. Recommend (b). With no answer: (c).
5. **The first owner-field table** (package F; D-096): see it before a build publishes it?
   Recommend yes. And should the `region` slice then take the minimum of 10? Recommend yes.
   With no answer: built locally only, shown in the final report; the slice stays as it is.
6. **Two readings of CLAUDE.md's chart rule** (D-100): a list is ranked by the field's own
   recorded judgement, not a count of its values; a count by a region draws lines, not a
   map. Recommend keeping both. With no answer both stay.
7. **A month supplied after the register's build is not published until the next month's
   build.** May a change to the committed counts rebuild the current month? It is a forced
   run, asked for each time today. Recommend yes, for that case only. With no answer: no.
8. **Later, by the user's word:** the Stats NZ hand export; going public; the privacy
   sentence, read again before going live; the retaken dashboard history, due in Downloads.

## Decided for the user (unreviewed records in `docs/DECISIONS.md`)

D-082, D-085 to D-095 (the eighth session). This session: D-096's readings of the answers;
D-097 (how the committed counts are laid out, guarded and trimmed); D-098 (the long-run
charts); D-099 (the trim); D-100 and D-101 (the chart rules; CI); D-104's reading of the
direction; D-105 (the comparison, and three statements about the MIA corrected).

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` from where CHECKPOINT says ("Work in hand", in its
order). Its §2 still stands: you may merge this work order's pull requests into `main` in this
session when checks are green and an independent reviewer agrees, and nothing in its §3 is
touched. Do not stop for questions; park what needs me and keep going. D-104 stands: the
engine first and right; check figures against published sources.

Check first: `git worktree list`, and `git status` in each worktree (three hold uncommitted
work); the open pull requests; the `Monthly build` runs since 15 November (no forced run is
left); that `CLOUDFLARE_PAGES_PROJECT` is still unset. Run few sub-agents at once: the
account's usage limit stopped six on 16 November. No path from the user's computer in a doc,
a commit or a pull request.
