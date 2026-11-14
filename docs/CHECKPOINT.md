# Checkpoint

Last updated by claude on 2026-11-14

## Where we left off

- 2026-11-14, eighth session: the first of work order 1 (`docs/brief/WORK_ORDER.md`, D-082).
  - **Merged:** #47 to #52: the reworded rules; the order saved with D-082 to D-085 and the
    sub-agent definitions; three public pages (D-086); `registrations_flow` defined (D-087);
    the pipeline's and the site's follow-ups (D-088, D-089). `ui/explore` is deleted on GitHub.
  - **The user's dashboard files** add up to every total the user gave (D-084). Against the
    register: 82,335 more vehicles, of which 80,852 are marked as since removed (D-087).
    Stats NZ's series is on disk too, fetched read-only (STATE, raw files).
  - **Three branches were in hand when these notes were written** (STATE, In progress): one
    in review as #53, two local and unpushed. Read `git worktree list` and each branch's log
    before anything else: a branch may be waiting only for its push, review and merge.
  - **October's forced run: not decided.** GitHub had not started the first daily run by
    06:47 UTC on 14 November. Read it first (prompt below).
  - **One slip:** #50 was merged a minute before its last check finished; it then passed.

## Open pull requests (1)

- **#53** `claude/data-map` into `main`: in review. claude merges it under D-082.

## Work queue: the work order's packages, in order

- **A. Housekeeping.** Done, but for:
  - the forced run of October, once, only if the most recent daily run says "Source
    unchanged" (D-082). Then check: the release's file holds `facts/`; the state commit; the
    archive job stopped at "already archived"; `Deploy` uploaded nothing.
  - Follow-ups left, each with its reason in D-088 or D-089: a digest of the rows the archive
    job pulls; pipeline dependencies pinned by hash (tried on a pull request, after December's
    build); a draft-then-publish release step (after December's build); admin bypass on the
    `production` environment (the user's, on GitHub); the status page's script chunk in the
    public build (with D's first-load work); a value in a link that is not in the data, and the
    refill of the five largest (package F); a share by model draws 300 lines (package E's chart
    rules); a model's name shows its separator, and `/build/` skips a heading level (package H).
  - **A second scope for events** (D-089): an event should be able to say which vehicles it
    applies to, so a filtered chart can leave it out. A change to `events.csv`'s schema.
- **B. True registrations from the dashboard.**
  - `claude/registrations-flow`: finish, add D-090, review, merge. Then one commit adding the
    alias `LANDROVER` to `brand_registry.csv`. Its definition sentence in
    `config/dimensions.json` must match `docs/METRICS.md` ("at its latest monthly update before
    the export was taken").
  - Then the site half: the dataset in Build and Explore; "how many were registered last
    month, and is that up or down on a year ago", by make and model; completeness (its own
    chart; needs NZTA's vehicle type as a dimension on both datasets, a golden change). A flow
    series never shares a chart with survivors. `/differences` and the attribution line change
    with it (D-086).
- **C. Stats NZ's long-run series** (plan: `data/staging/work-order/spec-C-statsnz.md`), after
  B's pipeline half: `supply statsnz_tpt`, the dataset, the long-run chart, completeness for
  cars from July 1975, the hand-export playbook.
- **D. The rest of Stage 1.** Pages and playbooks are in (#49). Left: first load measured at
  phone width on a production build, the cheapest fix, measured again (target: a first answer
  under 3 seconds).
- **E. The data map.** #53: review, add its decision record, merge. Then two more pieces: the
  chart rule table in config with Build's shape choice reading it (site tests can run with
  Node's own test runner, which needs a job in `checks.yml`); and the pipeline writing the
  "moves together" figures each build.
- **F. The full engine.** Not started.
- **G. The query service.** `claude/query-service`: finish, review. The proposal is a parked
  decision for the user; nothing is provisioned.
- **H. Labels, words, topic pages** and **I. what the industry expects**: not started.
- **For the Stage 2 privacy review** (the user's): `region` in the fact table; a minimum count;
  postcode totals (D-076); a model year from `VIN11` (D-079); the privacy classes (package E).

## Questions for the user (parked; none stops the work)

1. **Where may the converted dashboard data live?** GitHub's runs can build true registrations
   only if they can read it. (a) Commit a small file of counts to this public repository, with
   no owner field, as `data/snapshots/` already is. (b) Keep it in the private archive and
   let the run fetch it. (c) Local only. Recommend (a). With no answer: (c), so a deployed
   site would not show true registrations.
2. **The About page** has six gaps in `config/site.json` (search `TO DECIDE`): the site's
   name, its address, who runs it, how to reach them, any connection to the motor industry,
   and what it promises about advertising, cookies and tracking. The feedback link already
   shows the GitHub account's name. With no answer the page stays a marked draft.
3. **The site's name**, which also decides the Cloudflare project's name and address. Five
   proposals, none checked for availability: Rego Counts; On the Register; First Registered;
   NZ Vehicle Facts; The Fleet Book. Recommend "Rego Counts". With no answer the gap stays.
4. **Should the monthly dashboard export also take the mass and engine-size groupings**, and
   the history be taken again with them? Without them, true registrations cannot be split
   into cars, utes, vans and trucks, or by engine size. Recommend yes, when convenient. With
   no answer those breakdowns stay on survivors only.
5. **The Stats NZ hand export.** A read-only copy fetched on 14 November is used for local
   builds. Recommend doing the export once by hand to confirm the steps (a playbook comes
   with package C). With no answer local builds keep the fetched copy; none of it is committed.
6. **Going public:** `docs/playbooks/go-public.md` has the Cloudflare steps. Not started.

## Decided for the user this session (each is in DECISIONS, unreviewed)

1. Hard rule 7 carries the order's merge rule as a marked, temporary passage; rule 8 says the
   steps are the order's packages; rule 4's golden diff is shown in the pull request (D-082).
2. Six sub-agent definitions by kind of work, and a test for them (D-085).
3. The three pages' wording, their words in config, the corrections log as data, feedback by
   a link to GitHub issues, links in the footer (D-086).
4. `registrations_flow` counts the same kinds of vehicle as the survivors dataset, not
   everything in the export; `Vehicle Status` is read from the counts, not from NZTA's page;
   completeness is its own chart and is not shown by model; the name `registrations_flow`
   moves from Stats NZ's series to the dashboard's dataset (D-087).
5. Three workflow hardenings (D-088); visitor wording on the dimensions (D-089); and which
   follow-ups are left, each with its reason.
6. Stats NZ's series was fetched once, read-only, so package C can be built before the user's
   hand export exists (the order §2). The converted dashboard data stays local and gitignored
   until question 1 is answered. Nothing of either is committed.

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` from where CHECKPOINT says. Its §2 still stands:
you may merge this work order's pull requests into `main` in this session when checks are
green and an independent reviewer agrees, and nothing in its §3 is touched. Do not stop for
questions; park what needs me and keep going.

Check first: `git worktree list` and the log of every `claude/` branch not on GitHub (work
from the last session may be finished and unpushed); the `Monthly build` runs since
14 November: what the daily runs said and whether a forced run followed (none is allowed
unless the most recent daily run said "Source unchanged", and only one, ever); that
`CLOUDFLARE_PAGES_PROJECT` is still unset. No path from the user's computer in a doc, a commit
or a pull request.
