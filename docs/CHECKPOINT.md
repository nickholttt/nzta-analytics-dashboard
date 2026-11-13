# Checkpoint

Last updated by claude on 2026-11-13

## Where we left off

- 2026-11-13: the user set the next stage's direction. Filed on `claude/next-stage-brief` (#36):
  `docs/brief/MASTER_BRIEF.md`, the user's CLAUDE.md, D-062, and AGENTS.md's "eight" invariants.
  Then **Stage 0 of the brief, done and reported**: `docs/brief/STAGE_0_REPORT.md`.
  - The 8 November run was scheduled, green and skipped. NZTA refreshed the register on 9 November,
    so October 2026 is waiting to be built. Nothing was dispatched.
  - Measured: August 2026 moved 0.16% in its first month and matched Stats NZ's cars to 0.04%; the
    whole register is a 22.6 MB file at the bound fields, about 49 MB (estimate) at every field.
  - Proposed: D-063 (keep each month's whole snapshot as one private file), D-064 (run daily, build
    each month once, fail when a month is missed), D-065 (Stats NZ's Infoshare series now).
  - An independent review (opus) found twenty points; the real ones are fixed in the report and
    the decisions, and the report's last section says what was done outside the repo.
  - `docs/DATA_MAP.md`: a first pass over all 40 fields. `docs/DATA_SOURCES.md` §A and §C and the
    monthly playbook corrected with what was read.
  - Read vstat and Autotalk's StatsHub. Both had October on 1 November, from NZTA's registrations
    dashboard.
- 2026-10-22: the question builder and the fact table were built and reviewed (D-058 to D-061) on
  `claude/question-builder` and `claude/fact-table`; neither has a pull request. Before that:
  #30–#35 opened after three independent reviews (D-057); #26–#29 built on `main`'s side.
- Earlier: the UI is Claude's (D-027); the visitor site is local only until the gate (D-041);
  frozen-path work is built on branches before it (D-043).

## Open pull requests waiting on the user (20)

UI stack, merged in order into `ui/explore` (as each merges, retarget the next to `ui/explore`):
#17 notes after the merge; #18 the visitor Explore page (D-041); #19 one time row, visitor wording
(D-042); #20 AGENTS.md rule 2's exception (D-043); #21 the Build page (D-044); #22 the 12-month
ranking (D-045); #23 reserved values (D-046); #24 the prototype's queue; #25 D-047 to D-051; #30
"Change this chart" (D-052); #31 pair slices on the site (D-053); #32 screen readers and tables of
figures; #33 the map (D-054); #34 the public build (D-055 to D-057).

Pipeline stack, into `main`, in order. **Not before the user lifts the freeze**: #26 tests on every
pull request (D-048); #27 pair slices (D-047); #28 `segment_group`; #29 B1–B3 and D-049 to D-051;
#35 the cube release and `deploy.yml` (D-056).

#36 `claude/next-stage-brief` into `claude/question-builder`: D-062, the brief, Stage 0. Docs only.

## Work queue (in order)

1. **The user's time-bound decisions** (questions 1 to 5 below), before NZTA's December refresh.
   Done when October 2026 is built and committed on `main`, and the user has said whether the
   freeze is lifted.
2. **If the user accepts them, build D-064, then D-063** (frozen paths, D-043). D-064 on a branch
   from `origin/main`: the daily schedule, the build-once rule, the missed-month alarm, tests.
   D-063 on top of the pipeline stack (`claude/deploy-workflow`): the wider pull and the monthly
   file, kept where question 3 decides. Done when CI is green on each pull request. Neither can
   reach `main` until the user lifts the freeze and merges #26 to #29 and #35, so October (and
   probably November) is kept by a hand pull if question 4 says so.
3. **Stage 1 of the brief, when the user says so** (`docs/brief/MASTER_BRIEF.md` §9): ship what
   exists.
   - Merge support: the two stacks in order; when #29 meets `ui/explore`, correct
     `$ranking_period_comment` (STATE known issue 4); then `ui/explore` into `main`. The user
     merges. Open pull requests for `claude/fact-table` and `claude/question-builder`, each with a
     five-line summary. No more than five waiting at once, if the user confirms that limit.
   - Deploy: numbered console steps, one at a time, all production: a Cloudflare Pages project for
     Direct Upload named `nz-vehicle-registrations` with `main` as its production branch; an API
     token limited to Cloudflare Pages: Edit; the GitHub secrets `CLOUDFLARE_API_TOKEN` and
     `CLOUDFLARE_ACCOUNT_ID`, placed as question 11 decides. Done when a `pages.dev` address serves
     `/` and `/build` from a monthly run's cube and `/status` returns the not-found page.
   - About, feedback and corrections, and "why these figures differ" pages.
   - The Stats NZ series (D-065): headline count and completeness.
   - Visitor tests (`docs/playbooks/visitor-test.md`) and first load measured on the deployed site.
4. **Once a monthly build carries #27 and #28**: flip `used-import-age` and `powertrain-mix` to
   live (STATE known issue 5); move each `public_copy` entry onto `config/dimensions.json` (D-042).
5. **Stages 2 to 5 of the brief**, each on the user's word: the data map and the query service;
   the stage; what the industry expects; trust and reach.
6. **Kept from the old queue, unplaced by the brief:** `age-distribution-moving-hole` (the
   distribution drawn year by year); a visitor name for "Area Outside Region"; a per-capita map.

## Questions for the user

Options and reasoning for 1 to 10: `docs/brief/STAGE_0_REPORT.md`, "Decisions for you".

1. **Build October 2026 now?** Recommend: you dispatch one unforced run on `main`, before any merge.
2. **Has the gate passed?** Recommend: yes, once that run is green.
3. **The archive (D-063), and where its files are kept?** Recommend: accept, in a private GitHub
   repository's releases, without the identifiers and `POSTCODE`.
4. **Pull October by hand now?** Recommend: yes, into gitignored `data/raw/2026-10/`. It is the
   only practical way to keep that snapshot at every field.
5. **Where is the August raw pull copied?** Recommend: a backed-up folder you name, and wherever
   question 3 puts the monthly files.
6. **The daily run (D-064)?** Recommend: accept option 3 with its two rules.
7. **Stats NZ (D-065)?** Recommend: accept, with a hand export each month as the brief says. A
   scripted fetch worked, but Stats NZ's terms for automated use are not checked.
8. **NZTA's registrations dashboard as a source?** Recommend: export one month by hand so it can
   be read. `docs/DATA_SOURCES.md` §D stands until you say otherwise.
9. **`POSTCODE`'s privacy class?** Recommend: never published, and not pulled or archived.
10. **CLAUDE.md's three untagged changes?** Recommend: accept as they are.
11. **Where the Cloudflare secrets live** (from 2026-10-22). (a) Repository secrets. (b) A GitHub
    environment limited to `main`: safer; `deploy.yml` needs one line. Recommend (b). With no
    answer, the console steps are written for (a).

Also yours, from the brief's §12: the `matrix` shape; the acceptable running cost; the limit of
five pull requests; the About page; the name and domain. And two pages NZTA's site would not show
an automated reader: "Additions to the national vehicle fleet" and "Existing fleet" (the report,
§6).

## Prompt for the next session

/start. Read `docs/STATE.md`, this file and `docs/brief/STAGE_0_REPORT.md`. Check first whether
October 2026 has been built (`gh run list`, `git log origin/main`) and whether NZTA has refreshed
again. Then do what the user's answers allow: queue item 2 if D-063 and D-064 are accepted, and the
stage the user names. Change nothing on a frozen path outside D-043, merge nothing, dispatch nothing.
