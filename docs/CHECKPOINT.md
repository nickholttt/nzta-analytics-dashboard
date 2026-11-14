# Checkpoint

Last updated by claude on 2026-11-14

## Where we left off

- 2026-11-14, eighth session: the first of work order 1 (`docs/brief/WORK_ORDER.md`, D-082).
  - **Merged:** #47 to #53: the reworded rules; the order saved with D-082 to D-085 and the
    sub-agent definitions; three public pages (D-086); `registrations_flow` defined (D-087);
    the pipeline's and the site's follow-ups (D-088, D-089); the data map finished (D-090).
    `ui/explore` is deleted on GitHub.
  - **True registrations are built on a branch** (#55): 1,483,403 vehicles over 70 months,
    from the user's dashboard files; the real dry-run build passed. The site half is being
    built on `claude/flow-site`, in this folder.
  - **Branches in hand** (STATE, In progress): #54 and #55 in review, `claude/flow-site` local
    and unpushed. Read `git worktree list` and each branch's log before anything else.
  - **October's forced run: not decided.** GitHub had not started the first daily run by
    07:19 UTC on 14 November. Read it first (prompt below).
  - **One slip:** #50 was merged a minute before its last check finished; it then passed.

## Open pull requests (2)

- **#55** `claude/registrations-flow` into `main`: in review. Two golden changes, shown in it.
- **#54** `claude/query-service` into `main`: in review. Its proposal is the user's to decide.

claude merges each under D-082 once its reviewer agrees, its checks are green on its newest
commit, and its decision record (drafted in its description) is appended: D-091, then D-092.

## Work queue: the work order's packages, in order

- **A. Housekeeping.** Done, but for:
  - the forced run of October, once, only if the most recent daily run says "Source
    unchanged" (D-082). Then check: the release's file holds `facts/`; the state commit; the
    archive job stopped at "already archived"; `Deploy` uploaded nothing.
  - Follow-ups left, each with its reason in D-088 or D-089: a digest of the rows the archive
    job pulls; dependencies pinned by hash and a draft-then-publish release step (both after
    December's build); admin bypass on the `production` environment (the user's); the status
    page's script chunk (with D's first-load work); a value in a link that is not in the data,
    and the refill of the five largest (package F); a share by model draws 300 lines (E's
    chart rules); a model's name shows its separator, and `/build/` skips a heading (H).
  - **A second scope for events** (D-089), so a filtered chart can leave out an event about
    vehicles it does not count. A change to `events.csv`'s schema.
- **B. True registrations.** #55, then `claude/flow-site` (plan:
  `data/staging/work-order/spec-B-site.md`): the dataset in Explore and Build, a chosen month,
  completeness as its own chart. Then NZTA's vehicle type as a dimension on both datasets (a
  golden change), so completeness can be shown by vehicle type. Mild hybrids are identified
  for 62.7% of this dataset's hybrids at high confidence, under the 70% warning level.
- **C. Stats NZ's long-run series** (plan: `data/staging/work-order/spec-C-statsnz.md`), on the
  supplied-source code of #55: `supply statsnz_tpt`, the dataset, the long-run chart,
  completeness for cars from July 1975, the hand-export playbook.
- **D. The rest of Stage 1.** Left: first load. #54 measured it: 7.4 to 11.6 s to a Build
  answer on the phone profile, and about 460 KB of each page is its own code and fonts.
  Trim those, measure again (target: a first answer under 3 seconds).
- **E. The data map.** Done (#53). Left: the chart rule table in config with Build's shape
  choice reading it (site tests can run on Node's own test runner, with a job in
  `checks.yml`); the pipeline writing the "moves together" figures each build; and
  `sentinels.csv` gaining the forms the map lists, field by field, as each is bound.
- **F. The full engine.** Not started. The map's binding order: colour, seats, where
  assembled, class; then power and transmission; owner fields last and unpublished.
- **G. The query service.** #54. Nothing is provisioned.
- **H. Labels, words, topic pages** and **I. what the industry expects**: not started.

## Questions for the user (parked; none stops the work)

1. **Where may the converted dashboard data live?** (a) A small file of counts in this public
   repository, with no owner field. (b) The private archive, fetched by the build. (c) Local
   only. Recommend (a). With no answer: (c), so GitHub's builds and any deployed site have no
   true registrations.
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
6. **The query service** (`docs/brief/QUERY_SERVICE_PROPOSAL.md`, #54): a function on
   Cloudflare's paid plan, about US$5 a month, tried first for memory; or no service and
   lighter files, at no cost. Recommend deciding after package D's trim is measured. With no
   answer Build keeps reading static files and nothing is spent.
7. **The Stats NZ hand export** and **going public** (`docs/playbooks/go-public.md`): not
   started; a fetched copy of the series serves local builds meanwhile.

## Decided for the user this session (each is in DECISIONS, unreviewed)

1. The order's merge rule in hard rule 7, as a temporary passage; rules 4 and 8 (D-082).
2. Six sub-agent definitions and their test (D-085). The three pages (D-086).
3. `registrations_flow` counts what the survivors dataset counts; `Vehicle Status` is read
   from the counts; the name moves from Stats NZ's series to the dashboard's dataset (D-087).
4. Three workflow hardenings (D-088); visitor wording on the dimensions (D-089).
5. The data map's config file, its tests, the roll-ups dropped (D-090).
6. Still in drafts on #54 and #55: how the dataset is built and guarded; the prototype.
7. Stats NZ's series was fetched once, read-only; the converted dashboard data stays local.

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` from where CHECKPOINT says. Its §2 still stands:
you may merge this work order's pull requests into `main` in this session when checks are
green and an independent reviewer agrees, and nothing in its §3 is touched. Do not stop for
questions; park what needs me and keep going.

Check first: `git worktree list` and the log of every `claude/` branch not on GitHub; the open
pull requests; the `Monthly build` runs since 14 November: what the daily runs said and
whether a forced run followed (none is allowed unless the most recent daily run said "Source
unchanged", and only one, ever); that `CLOUDFLARE_PAGES_PROJECT` is still unset. No path from
the user's computer in a doc, a commit or a pull request.
