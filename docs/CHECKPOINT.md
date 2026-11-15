# Checkpoint

Last updated by claude on 2026-11-15

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
  - **No branch is in hand.** The next item is the site half of package C (below).
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
  - The site: completeness by vehicle type and new or used, from the pair on the survivors
    and the true-registrations fact table (D-095; today it shows the total and new or used).
  - The site's tests (`tests/site/`) and the prototype's tests in `Checks` (a workflow
    change, with E's chart rules).
  - Each month: the user's export, then `python -m pipeline supply`
    (`docs/playbooks/supply-dashboard-month.md`), then a build with `--dry-run`.
- **C. Stats NZ's long-run series.** The pipeline half is done (#57). Left, on the site: the
  long-run chart for cars back to 1961 with Stats NZ's statement beside NZTA's attribution
  (it must read the manifest's `exceeds_total` and show "not recorded" months as such), and
  cars still registered against Stats NZ's count from July 1975, under its own name and with
  its caveat (`docs/METRICS.md`). The user's own export replaces the fetched copy
  (`docs/playbooks/supply-statsnz-series.md`).
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

1. **Where may the converted dashboard data live?** (a) A small file of counts in this public
   repository, with no owner field. (b) The private archive, fetched by the build. (c) Local
   only. Recommend (a). With no answer: (c), so GitHub's builds and any deployed site have no
   true registrations. The same answer serves Stats NZ's series.
2. **The About page's six gaps** (`config/site.json`, search `TO DECIDE`) **and the site's
   name**, which also names the Cloudflare project. Proposals, none checked for availability:
   Rego Counts; On the Register; First Registered; NZ Vehicle Facts; The Fleet Book. Recommend
   "Rego Counts". With no answer the page stays a marked draft.
3. **Privacy classes** (`docs/DATA_MAP.md`, proposed). (a) May the 31 vehicle fields and 10
   dashboard columns that say nothing of an owner be public? Recommend yes. (b) Owner fields
   after the review: never; only in one- and two-field tables with small cells hidden; or
   public. Recommend the middle one, with a minimum of 10 vehicles. (c) Does the `region`
   slice already published stay? Recommend yes. (d) Postcode totals: recommend not now. With
   no answer: owner fields stay unpublished and the region slice stays.
4. **May vehicles be matched privately between two months' archive files**, to settle whether
   usage and industry class are as first registered or as now? Recommend yes.
5. **Should the monthly dashboard export also take the mass and engine-size groupings**, and
   the history be taken again? Recommend yes. Without them true registrations cannot be split
   into cars, utes, vans and trucks.
6. **The query service** (`docs/brief/QUERY_SERVICE_PROPOSAL.md`): a function on Cloudflare's
   paid plan, about US$5 a month, tried first for memory; or no service and lighter files, at
   no cost. Recommend deciding after package D's trim is measured. With no answer Build keeps
   reading static files and nothing is spent.
7. **Where true registrations sit on the home page:** last, loaded when scrolled to.
   Recommend moving them first when the home page is rebuilt (package H).
8. **The Stats NZ hand export** and **going public** (`docs/playbooks/go-public.md`): not started.
9. **The repository's "About" line on GitHub** is empty. Proposed: "Plain answers about New
   Zealand's vehicle market, from NZTA and Stats NZ open data. Work in progress; not public yet."

## Decided for the user this session

Each is a record in `docs/DECISIONS.md`, marked unreviewed: D-082 (the two readings of hard
rules 4 and 8), D-085 (sub-agent definitions), D-086 (the three pages), D-087 (what
`registrations_flow` counts; `Vehicle Status` read from the counts), D-088 and D-089 (the
follow-ups taken and left), D-090 (the data map's config form), D-091 (the query service's
format and prototype), D-092 (how true registrations are built and guarded), D-093 (how the
site shows them), D-094 (Stats NZ's series: cars only, two breakdowns, no fact table), D-095
(NZTA's vehicle type as a dimension; cars against Stats NZ's count is not called
completeness). Also: Stats NZ's series was fetched once, read-only, and both converted
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
