# Checkpoint

Last updated by claude on 2026-11-17

## Where we left off

- 2026-11-14 and 15, eighth session, the first of work order 1: #47 to #59 merged (D-082 to
  D-095). October was forced once; no second forced run is allowed (D-082).
- 2026-11-16 and 17, ninth session. **Merged, #60 to #79** (#63 was closed unmerged). The
  user's answers are D-096 and D-106. Figures set beside published ones: within 0.06% of the
  MIA's for October 2026 on the wider scope, older months about 1% lower, cause not
  established (D-105, D-113); equal to vstat's for October 2026 (D-118).

## The user's direction of 16 November (D-104)

The user's words: "keep working on the engine, it needs to be flawless, the public can wait";
"dont skim out on making it right"; and to consult what is published online about the New
Zealand market where things do not look right or a measure has not been probed.

Claude's reading, unreviewed (D-104): the work order's order stands, engine first, with no
proposal to launch early; each measure is recomputed independently and set beside published
New Zealand sources.

## Open pull requests (none)

## Work in hand, in the order to pick it up

1. **What the engine's audit found** (D-104, D-107): of 34,693 figures recomputed from the
   register's rows and the dashboard export, 34,618 agree, 74 are withheld on both sides and
   1 differed (a tie in a ranking). No count was wrong. All of it is fixed:
   - On the site (#67, #69; D-107, D-109): equal counts share a rank; a month with nothing
     counted is zero in every windowed figure; a thin ranking greys and says so; the
     coverage note; `/caveats`; a lint against naming a value in a template; the load gate.
   - In the pipeline (#68, #70, #72; D-108, D-110, D-112): eight hybrid nameplates from
     published sources; a dataset under 70% shows its hybrids undivided, and a flip warns on
     the build's summary page and `/status`; a rule for the tie at the model cap.
   - Three more nameplates at high confidence on the maker's own page (#74, D-115): 74% to
     78.5%. Left: the rows D-115 kept; Tank (two sources disagree; moving it changes the
     golden contract); a reader that refuses a malformed reference row.
2. The untrimmed first version of the counts stays reachable on GitHub through the closed #63.
3. **Package F**, each field checked against the data and published sources before Build
   offers it. Done: ranking of chosen values, conditions, CSV (#71); the wider scope as a
   dataset and on the site (#73, #77; D-113, D-118); the `matrix` grid (#75, #76; D-114);
   three register fields as dimensions (#79, D-116). Next: offer them as breakdowns (class
   never crossed with vehicle type), class labels from the Rule's table, colour in a narrower
   table; power and transmission; owner fields last (D-096). Left: "My questions", the
   related-fields note, the question with a new field, hybrids and mild hybrids as one figure
   (D-118).
4. **Package I, first slice** (#78, D-117): SUV or car for 169 nameplates, 90% of recent
   passenger vehicles; 77 of 110 rows only medium; nothing reads the file; no disagreement in
   98 comparisons with the FCAI's published sample (a private check). Next: primary sources
   for the medium rows; three sizes from cited dimensions against the FCAI's footprint bands;
   people movers; a rule per dataset; then the wiring with its coverage guard.
5. **Paused, half written, uncommitted, behind `main`:** package H's narrative spec (D-102;
   worktree `nzta-screens`). D-103's draft scheme file is untracked in `nzta-segments`.

## Left in the packages

- **A.** Follow-ups (D-088, D-089): a digest of the rows the archive job pulls; dependencies
  pinned by hash and a draft-then-publish release step (after December's build); admin
  bypass on `production` (the user's); `/build/` skips a heading (H); a second scope for
  events; a lookup refusing a blank value at build.
- **B.** Each month, as soon as the dashboard has it: the user's export, `python -m pipeline
  supply`, a `--dry-run` build, a pull request with the store's two files (D-097). A store
  rebuilt whole cannot yet excuse a month it restates by more than 2% (`supply` needs an
  option). **C.** The user's own Stats NZ export replaces the fetched copy.
- **D.** First load (#64, D-099): Explore's first chart 4.6 s, a Build answer 6.6 s on a phone,
  against 3 s (question 2). Left: the linked chart's own time; a far chart fetched on load.
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
6. **CLAUDE.md still says `matrix`'s renderer "is planned" and that Plot draws all six
   shapes**; the grid is an HTML table (D-114). May Claude correct the two sentences? Recommend
   yes. With no answer they stay, and the table can become a Plot figure if you prefer.
7. **Subaru's e-Boxer cars are to be classed as full hybrids** (next piece; Claude's decision,
   unreviewed): the US Department of Energy and EPA, the UK's SMMT and Australia's Green Vehicle
   Guide draw the line at whether the motor can move the car alone. Veto to keep them unresolved.
8. **May a trade list (the FCAI's published sample, or one you can reach through work) be a
   source for a model's segment?** Today it is a private check only; recommend keeping that.
9. **Later, by the user's word:** the Stats NZ hand export; going public; the privacy
   sentence, read again before going live; the retaken dashboard history, due in Downloads.

## Decided for the user (unreviewed records in `docs/DECISIONS.md`)

D-082, D-085 to D-095 (the eighth session). This session: the readings in D-096, D-104 and
D-106 (with the MIT licence), and D-097 to D-101, D-105 and D-107 to D-118.

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
