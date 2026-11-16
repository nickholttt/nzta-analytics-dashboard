# Checkpoint

Last updated by claude on 2026-11-16

## Where we left off

- 2026-11-14 and 15, eighth session: the first of work order 1 (`docs/brief/WORK_ORDER.md`).
  - **Merged: #47 to #59.** The reworded rules; the order saved with D-082 to D-085 and the
    sub-agent definitions; three public pages (D-086); `registrations_flow` defined (D-087);
    the pipeline's and the site's follow-ups (D-088, D-089); the data map (D-090); the query
    service measured and proposed (D-091); true registrations built in the pipeline (D-092)
    and shown on the site (D-093); Stats NZ's cars since 1961 built in the pipeline (D-094);
    NZTA's vehicle type as a dimension (D-095); the repository's front page rewritten (#59).
  - **October was forced once**, after the daily run said "Source unchanged": the release
    `cube-2026-10` now holds the fact table. No second forced run is allowed (D-082).
  - **A visitor to a local build can now ask** how many vehicles were registered in any month
    since January 2021 and whether that is up or down on a year ago, by brand and by model.
- 2026-11-16, ninth session (in progress).
  - **The user answered the parked questions** (D-096, #60, merged): the privacy classes are approved,
    three of the About page's gaps are filled, and the repository's "About" line is set.
  - **Merged: #61**, package C's charts with completeness by vehicle type (D-098). Its
    review found the ratio chart joining a line across months it left out; fixed.
  - **Three pieces run in parallel**, one branch each: the supplied counts as files in the
    repository (D-097), package D's first-load trim (D-099), and package E's chart rules
    with the site's tests in `Checks` (D-100, D-101). STATE lists their files.
  - **Slips, recorded:** #50 merged a minute before its last check finished (it passed);
    a first reading that event markers respect a filter was wrong (D-089).

## Open pull requests (none)

## Work queue: the work order's packages, in order

- **The repository's front page** (the user, 2026-11-15): done (#59). Keep `README.md` true
  as packages land: its "What it can answer today" and "Not there yet" lists go stale first.
  The "About" line for the repository's sidebar is proposed to the user (question 9).
- **A. Housekeeping.** Done. Follow-ups left, each with its reason in D-088 or D-089: a
  digest of the rows the archive job pulls; dependencies pinned by hash and a
  draft-then-publish release step (both after December's build); admin bypass on
  `production` (the user's); the status page's script chunk (with D); two Build behaviours
  for chosen values (F); a share by model draws 300 lines (E's chart rules); a model's name
  shows its separator, and `/build/` skips a heading (H); a second scope for events; a
  lookup should refuse a blank value at build time, not only in a test (D-095's review).
- **B. True registrations.** Done on a local build. Left:
  - The site's tests (`tests/site/`) and the prototype's tests in `Checks` (a workflow
    change, with E's chart rules).
  - Each month: the user's export, then `python -m pipeline supply`
    (`docs/playbooks/supply-dashboard-month.md`), then a build with `--dry-run`.
- **C. Stats NZ's long-run series.** Done on a local build (#57, #61, D-098). Left: the
  user's own export replaces the fetched copy (`docs/playbooks/supply-statsnz-series.md`).
  Not done at review: #61's docs landed in its last commit, and one commit does not pass
  the site's tests alone (history was not rewritten).
- **D. The rest of Stage 1.** Left: first load. Measured (D-091): 7.4 to 11.6 s to a Build
  answer on the phone profile; about 460 KB of each page is its own code and fonts. Trim
  those, measure again (target: a first answer under 3 seconds). Then the status chunk.
- **E. The data map.** Done (#53). Left: the chart rule table in config with Build's shape
  choice reading it; the pipeline writing the "moves together" figures each build;
  `sentinels.csv` gaining the forms the map lists, as each field is bound.
- **F. The full engine.** Not started. The map's binding order: colour, seats, where
  assembled, class; then power and transmission; owner fields last and unpublished. Then
  ranked chosen values, the `matrix` shape, any number of conditions, "My questions", the
  related-fields note, CSV of what is on screen, and the acceptance question both ways.
- **G. The query service.** Done as asked: measured and proposed. Nothing is provisioned.
- **H. Labels, words, topic pages** and **I. what the industry expects**: not started.
- **The final report** (the order §6), with `docs/brief/MASTER_BRIEF.md` §4 and §12 updated.

## Questions for the user (parked; none stops the work)

Questions 1 to 9 of 15 November were answered on 16 November (D-096). Left:

1. **The code's licence.** The answer left the options standing: none (all rights reserved);
   MIT; Apache 2.0. No recommendation: it is the owner's to choose. With no answer the
   README keeps saying no licence is chosen.
2. **The About page's three gaps** (`config/site.json`, search `TO DECIDE`): the site's name
   (parked by the user), its web address (left as a gap by the user), and who runs it (a
   name, or "an individual": not answered). With no answer the page stays a marked draft.
3. **The query service** (`docs/brief/QUERY_SERVICE_PROPOSAL.md`): the user decides once
   package D's trim is measured (D-099 will hold the figures). Nothing is spent meanwhile.
4. **The first owner-field table.** The user's rule (one or two fields, cells under 10
   hidden) is built in package F. Does the user want to see the first such table before a
   build publishes it? Recommend yes. With no answer: it is built on a local build only and
   shown in the final report. And should the `region` slice then take the minimum of 10 too?
   Recommend yes. With no answer it stays as it is.
5. **Later, by the user's word:** the Stats NZ hand export; going public
   (`docs/playbooks/go-public.md`); the privacy sentence, read again before going live.
6. **The retaken dashboard history** (with the mass and engine-size groupings) arrives in
   the user's Downloads folder; the export's playbook and config change when it does.

## Decided for the user this session

Each is a record in `docs/DECISIONS.md`, marked unreviewed: D-082 (the two readings of hard
rules 4 and 8), D-085 (sub-agent definitions), D-086 (the three pages), D-087 (what
`registrations_flow` counts; `Vehicle Status` read from the counts), D-088 and D-089 (the
follow-ups taken and left), D-090 (the data map's config form), D-091 (the query service's
format and prototype), D-092 (how true registrations are built and guarded), D-093 (how the
site shows them), D-094 (Stats NZ's series: cars only, two breakdowns, no fact table), D-095
(NZTA's vehicle type as a dimension; cars against Stats NZ's count is not called
completeness), D-096 (the readings of the user's answers: approval alone publishes nothing;
a "table of one or two fields" is a slice or a pair; the `region` slice keeps no minimum). Also: Stats NZ's series was fetched once, read-only, and both converted
stores stay on this computer until question 1 is answered.

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` from where CHECKPOINT says. Its §2 still stands:
you may merge this work order's pull requests into `main` in this session when checks are
green and an independent reviewer agrees, and nothing in its §3 is touched. Do not stop for
questions; park what needs me and keep going.

Check first: `git worktree list` and the log of every `claude/` branch not on GitHub; the open
pull requests; the `Monthly build` runs since 15 November (no forced run is left: one was
used on 14 November); that `CLOUDFLARE_PAGES_PROJECT` is still unset. No path from the user's
computer in a doc, a commit or a pull request.
