# Checkpoint

Last updated by claude on 2026-11-14

## Where we left off

- 2026-11-14, eighth session: the first of work order 1 (`docs/brief/WORK_ORDER.md`, D-082).
  - **Merged:** #47 (the reworded rules) and #48 (the order saved; D-082 to D-085; six sub-agent
    definitions and their check). `ui/explore` is deleted on GitHub.
  - **The user's dashboard files** are in `data/raw/nzta-dashboard/` and the backup folder.
    They add up to every total the user gave (D-084).
  - **Compared with the register** (read-only, D-087, on `claude/flow-definition`): the history
    adds 82,335 vehicles (4.4%) since removed; `ACTIVE` means still on the register; the
    register's `VEHICLE_USAGE` is today's usage, the dashboard's an earlier one.
  - **Stats NZ's series** is on disk, fetched read-only (STATE, raw files).
  - **Workers were mid-way when these notes were written** (STATE, In progress). Their branches
    are local and unpushed. Read `git worktree list` and each branch's log before anything
    else: a branch may be finished and waiting only for its push, review and merge.
  - **October's forced run: not decided.** The first daily run (14 November, 06:17 UTC) had not
    started. Read it first (prompt below).

## Open pull requests (1)

- **#49** `claude/stage1-pages` into `main`: checks green, review running. claude merges it
  under D-082 when the reviewer agrees.

## Work queue: the work order's packages, in order

- **A. Housekeeping.** Done: #47, `ui/explore`, the start-up checks. Left:
  - the forced run of October, once, only if the most recent daily run says "Source
    unchanged" (D-082). Then check: the release's file holds `facts/`; the state commit; the
    archive job stopped at "already archived"; `Deploy` uploaded nothing.
  - `claude/site-follow-ups` and `claude/pipeline-follow-ups`: finish, review, merge. Each
    item not done needs its reason written here.
- **B. True registrations from the dashboard.**
  - `claude/flow-definition`: append D-087 (after D-086), push, review, merge.
  - `claude/registrations-flow` (plan: `data/staging/work-order/spec-B-pipeline.md`): the
    `supply` command, a local store under gitignored `data/supplied/`, the dataset built
    through the register's own code, guardrails. Then one commit adding the alias `LANDROVER`
    to `brand_registry.csv`.
  - Then the site half: the dataset in Build and Explore; "how many were registered last
    month, and is that up or down on a year ago", by make and model; completeness (survivors ÷
    registrations, by vehicle type and import status; needs a `vehicle_type` dimension on both
    datasets, a golden change). A flow series never shares a chart with survivors.
- **C. Stats NZ's long-run series** (plan: `data/staging/work-order/spec-C-statsnz.md`), after
  B's pipeline half: `supply statsnz_tpt`, the dataset `registrations_cars_long_run`, the
  long-run chart, completeness for cars from July 1975, the hand-export playbook.
- **D. The rest of Stage 1.** #49 covers the pages and the two playbooks. Left: first load
  measured at phone width on a production build, the cheapest fix, measured again (target: a
  first answer under 3 seconds).
- **E. The data map.** The profile is being written to `data/staging/profiles/2026-10/`. Then
  an opus editor writes `docs/DATA_MAP.md` in full, the config form with schema tests, and the
  chart rule table that Build's shape choice reads.
- **F. The full engine**, **G. the query service** (measure and propose only), **H. labels,
  words, topic pages**, **I. what the industry expects**: not started. The order has each
  one's "done when".
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
   and what it promises about advertising, cookies and tracking. With no answer the page
   stays a marked draft.
3. **The site's name.** Five proposals, none checked for availability: Rego Counts; On the
   Register; First Registered; NZ Vehicle Facts; The Fleet Book. Recommend "Rego Counts":
   plain, local, and it says what the site holds. With no answer the gap stays.
4. **Should the monthly dashboard export also take the mass and engine-size groupings**, and
   the history be taken again with them? Without them, true registrations cannot be split
   into cars, utes, vans and trucks, or by engine size. Recommend yes, when convenient. With
   no answer those breakdowns stay on survivors only.
5. **The Stats NZ hand export.** A read-only copy fetched on 14 November is used for local
   builds. The steps for exporting it by hand go in a playbook with package C. Recommend
   doing it once to confirm the steps. With no answer local builds keep the fetched copy and
   nothing of it is committed.
6. **Going public:** `docs/playbooks/go-public.md` (#49) has the Cloudflare steps. Not started.

## Decided for the user this session (each is in DECISIONS, unreviewed)

1. Hard rule 7 carries the order's merge rule as a marked, temporary passage; rule 8 says the
   steps are the order's packages; rule 4's golden diff is shown in the pull request (D-082).
2. Six sub-agent definitions by kind of work, and a test for them (D-085).
3. The three pages' wording, their words in config, the corrections log as data, feedback by
   a link to GitHub issues, links in the footer (D-086).
4. `registrations_flow` counts the same kinds of vehicle as the survivors dataset (in-scope
   types, new and used), not everything in the export; `Vehicle Status` is defined from the
   data, not from NZTA's page; completeness is not shown by model (D-087).
5. Stats NZ's series was fetched once, read-only, so package C can be built and tested before
   the user's hand export exists (the order §2). Nothing of it is committed.
6. The converted dashboard data stays local and gitignored until question 1 is answered.

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` from where CHECKPOINT says. Its §2 still stands:
you may merge this work order's pull requests into `main` in this session when checks are
green and an independent reviewer agrees, and nothing in its §3 is touched. Do not stop for
questions; park what needs me and keep going.

Check first: `git worktree list` and the log of every `claude/` branch not on GitHub (work
from the last session may be finished and unpushed); what #49 is; the `Monthly build` runs
since 14 November: what the daily runs said and whether a forced run followed (none is allowed
unless the most recent daily run said "Source unchanged", and only one, ever); that
`CLOUDFLARE_PAGES_PROJECT` is still unset. No path from the user's computer in a doc, a commit
or a pull request.
