# Checkpoint

Last updated by claude on 2026-11-16

## Where we left off

- 2026-11-14 and 15, eighth session, the first of work order 1: #47 to #59 merged (D-082 to
  D-095). October was forced once; no second forced run is allowed (D-082).
- 2026-11-16, ninth session.
  - **Merged:** #60, the user's answers (D-096). #61, package C's charts and completeness
    by vehicle type (D-098). #62, the chart rules and the site's tests in `Checks` (D-100,
    D-101). #64, the first-load trim (D-099). #65, the comparison with published figures
    and three more answers (D-105, D-106). #66, the supplied counts as files (D-097). #67,
    the audit's site-side fixes (D-107).
  - **The site's figures were set beside published ones** (D-105): October 2026 agrees with
    the MIA to 0.06% once three vehicle types the site leaves out are counted; older months
    sit about 1% lower, cause not established. Range-extended electric vehicles sit with
    plug-in hybrids here and apparently not in AutoTalk's count.
  - **The user answered three more questions** (D-106): a total on the trade's basis beside
    the default scope; the MIT licence for the code; the site is run by "an individual".
  - **The engine was audited** against the register's rows: of 34,693 figures, one differs,
    a tie in a ranking ("Work in hand", 2).

## The user's direction of 16 November (D-104)

The user's words: "keep working on the engine, it needs to be flawless, the public can wait";
"dont skim out on making it right"; and to consult what is published online about the New
Zealand market where things do not look right or a measure has not been probed.

Claude's reading, unreviewed (D-104): the work order's order stands, with the engine before
the public-facing packages and no proposal to launch early; each measure is recomputed
independently of the site's code; figures are compared with published New Zealand sources.

## Open pull requests (none)

## Work in hand, in the order to pick it up

1. **What the engine's audit found** (D-104, D-107). A checker recomputed 34,693 of the
   site's figures from the register's rows and the dashboard export: 34,618 agree, 74 are
   withheld on both sides, 1 differs (a tie in a ranking). No count is wrong.
   - On the site's side, done (#67): equal counts share a rank; a ranking's comparison with
     a year earlier is decided by the dataset's own months, and a month with no vehicles
     under a condition is zero; METRICS says what each guard does; the coverage note;
     `/caveats`; models read as words; a lint against naming a value in a template.
   - Next on the site: a 12-month share under a condition (a gap today); guards in a ranking.
   - On the pipeline's side, in hand on `claude/audit-pipeline-fixes` (D-108): hybrid
     nameplates the dashboard spells differently are missing from `mild_hybrid_models.csv`
     (coverage reads 66.0%); the mild split is drawn below METRICS' 70%; ties at the model cap.
     Also: any change to the scope files refuses the committed counts until the history is
     supplied again, even a row for a new NZTA value; refuse only what the trim depends on.
2. The untrimmed first version of the counts stays reachable on GitHub through the closed #63.
3. **Package F**, each field checked against the data and published sources before Build
   offers it. First: a total of new vehicles on the trade's basis beside the default scope
   (the user, D-106; `trade_scope` in `vehicle_scope.csv`). Then: colour, seats, where
   assembled, class; power and transmission; owner
   fields last, unpublished until the pipeline hides small cells (D-096). Then ranked chosen
   values, the `matrix` renderer, any number of conditions, "My questions", the
   related-fields note, CSV of what is on screen, the acceptance question both ways.
4. **Paused, half written, uncommitted:** package H's narrative spec (D-102; worktree
   `nzta-screens`, `claude/narrative-spec`: `config/narrative/` files and a lint test, no
   `docs/NARRATIVE.md` yet) and package I's proposed segment scheme (D-103; worktree
   `nzta-segments`, `claude/model-segments`: one reference file so far). Both are behind `main`.

## Left in the packages

- **A.** Follow-ups (D-088, D-089): a digest of the rows the archive job pulls; dependencies
  pinned by hash and a draft-then-publish release step (after December's build); admin
  bypass on `production` (the user's); two Build behaviours for chosen values (F); `/build/`
  skips a heading (H); a second scope for events; a lookup refusing a blank value at build.
- **B.** Each month, as soon as the dashboard has it: the user's export, `python -m pipeline
  supply`, a `--dry-run` build, a pull request with the store's two files (D-097). A store
  rebuilt whole cannot yet excuse a month it restates by more than 2% (`supply` needs an
  option). **C.** The user's own Stats NZ export replaces the fetched copy.
- **D.** First load is trimmed (#64): Explore's first chart 7.98 s to 4.61 s, a Build answer
  7.59 s to 6.58 s, on the phone profile. The 3-second target is not met; Build waits on its
  data (question 2). Left: the linked chart's own time; a far chart is sometimes fetched on load.
- **E.** The pipeline writing the "moves together" figures each build; `sentinels.csv`
  gaining the map's forms as each field is bound; the rule table checking `uses.break_down`.
- **The final report** (the order §6), with `docs/brief/MASTER_BRIEF.md` §4 and §12 updated.
  Keep `README.md`'s "What it can answer today" and "Not there yet" lists true as work lands.

## Questions for the user (parked; none stops the work)

1. **The site's name and web address** (`config/site.json`, search `TO DECIDE`): parked by
   the user. The About page stays a marked draft until both are filled.
2. **The query service** (`docs/brief/QUERY_SERVICE_PROPOSAL.md`), now that the trim is
   measured (D-099): a Build answer still takes 6.6 to 10.3 s on a phone, nearly all of it
   the data download. A paid function (about US$5 a month), or lighter files at no cost.
   Recommend deciding after the engine's audit. With no answer nothing is spent.
3. **The first owner-field table** (package F; D-096): see it before a build publishes it?
   Recommend yes. And should the `region` slice then take the minimum of 10? Recommend yes.
   With no answer: built locally only, shown in the final report; the slice stays as it is.
4. **Two readings of CLAUDE.md's chart rule** (D-100): a list is ranked by the field's own
   recorded judgement, not a count of its values; a count by a region draws lines, not a
   map. Recommend keeping both. With no answer both stay.
5. **A month supplied after the register's build is not published until the next month's
   build.** May a change to the committed counts rebuild the current month? It is a forced
   run, asked for each time today. Recommend yes, for that case only. With no answer: no.
6. **Later, by the user's word:** the Stats NZ hand export; going public; the privacy
   sentence, read again before going live; the retaken dashboard history, due in Downloads.

## Decided for the user (unreviewed records in `docs/DECISIONS.md`)

D-082, D-085 to D-095 (the eighth session). This session: the readings in D-096, D-104 and
D-106 (with the MIT licence), and D-097, D-098, D-099, D-100, D-101, D-105 and D-107.

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` from where CHECKPOINT says ("Work in hand", in its
order). Its §2 still stands: you may merge this work order's pull requests into `main` in this
session when checks are green and an independent reviewer agrees, and nothing in its §3 is
touched. Do not stop for questions; park what needs me and keep going. D-104 stands: the
engine first and right; check figures against published sources.

Check first: `git worktree list`, and `git status` in each worktree (two hold uncommitted
work); the open pull requests; the `Monthly build` runs since 15 November (no forced run is
left); that `CLOUDFLARE_PAGES_PROJECT` is still unset. Run three or four sub-agents at once,
no more: the account's usage limit stopped six on 16 November. No path from the user's
computer in a doc, a commit or a pull request.
