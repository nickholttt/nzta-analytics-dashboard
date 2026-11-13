# Checkpoint

Last updated by claude on 2026-11-13

## Where we left off

- 2026-11-13, second session: the user answered Stage 0's ten decisions (D-066). Report:
  `docs/brief/STAGE_1_REPORT.md`.
  - **October 2026 is built.** Run 43367551467, started on the user's instruction, green; the bot
    committed `a5fb60c Snapshot 2026-10` to `main`.
  - **The gate has passed and the freeze is lifted.** AGENTS.md hard rule 2 is rewritten (#36).
  - **D-063, D-064 and D-065 are accepted.** None is built.
  - **October was pulled by hand** at 36 fields into gitignored `data/raw/2026-10/`.
  - `POSTCODE` is never published, pulled or archived. CLAUDE.md's three untagged changes stand.
  - The user's corrected brief replaced `docs/brief/MASTER_BRIEF.md` (`8364e8f`).
  - **Stage 1 item 1:** a five-line summary of each open pull request, in merge order, five at a
    time (the report §6). Then stop and report, as asked. Nothing was merged.
  - An independent review (opus) checked the report against the pull requests before the stop.
- 2026-11-13, first session: Stage 0 of the brief (`docs/brief/STAGE_0_REPORT.md`), D-062 filed,
  D-063 to D-065 proposed, the data map's first pass.
- 2026-10-22: the question builder and the fact table were built and reviewed (D-058 to D-061) on
  `claude/question-builder` and `claude/fact-table`; neither has a pull request.

## Open pull requests waiting on the user (20)

Merge order, and five lines on each: `docs/brief/STAGE_1_REPORT.md` §6. Every merge is a merge
commit, then "Delete branch"; the next pull request should then point at the base by itself.

- **Batch 1, into `main`:** #26 tests on every pull request (D-048); #27 pair slices (D-047); #28
  `segment_group`; #29 B1–B3 and D-049 to D-051; #35 the cube release and `deploy.yml` (D-056).
- **Batch 2, into `ui/explore`:** #17 notes; #18 the visitor Explore page (D-041); #19 one time
  row, visitor wording (D-042); #20 D-043; #21 the Build page (D-044).
- **Batch 3:** #22 the 12-month ranking (D-045); #23 reserved values (D-046); #24 the prototype's
  queue; #25 D-047 to D-051; #30 "Change this chart" (D-052).
- **Batch 4:** #31 pair slices on the site (D-053); #32 screen readers and tables of figures; #33
  the map (D-054); #34 the public build (D-055 to D-057); then `claude/question-builder`'s pull
  request (not open yet); then #36, this branch.

## Work queue (in order)

1. **Batch 1 merges** (the user). As each merges: check the next pull request points at `main` and
   its check is green. After #35: check the `Deploy` run stopped before building, as designed.
   Done when `main` holds #26 to #29 and #35.
2. **Build D-064** (the daily run): the schedule, the build-once rule, the missed-month alarm from
   the 15th, tests. On a branch from `origin/main` once batch 1 is merged; before that, on top of
   `claude/deploy-workflow`, because #29 and #35 change the same two files. Settle STATE known
   issue 10 here. Done when CI is green on its pull request.
3. **Build D-063** (the archive), on top of D-064: the pull widens to 36 fields (never
   `POSTCODE`); each built run writes the whole snapshot as one Parquet file to a release in
   `nickholttt/nzta-register-archive`, using the secret `ARCHIVE_REPO_TOKEN` (D-067), never as an
   artifact; a month's file is never replaced. Measure the run's time and memory. Needs the user's
   setup and "3a" or "3b" (question 2). Done when CI is green and a dry run writes the file.
4. **The rest of the merges** (the user), batches 2 to 4. Open `claude/question-builder`'s pull
   request when #34 is merged and `claude/fact-table`'s when #35 is, each with five lines. Then
   a commit on the site stack correcting `$ranking_period_comment` (STATE issue 4), and
   `ui/explore` into `main`.
5. **November's snapshot.** If D-064 is not on `main` when NZTA refreshes in December, the 8
   December run or a dispatch builds it. If D-063 is not, it is kept at every field only by a
   hand pull like October's (question 3).
6. **The rest of Stage 1** (the brief §9, items 2 to 8), each on the user's word:
   - Deploy: numbered console steps, all production: a Cloudflare Pages project for Direct Upload
     named `nz-vehicle-registrations` with `main` as its production branch; an API token limited
     to Cloudflare Pages: Edit; the GitHub secrets `CLOUDFLARE_API_TOKEN` and
     `CLOUDFLARE_ACCOUNT_ID`, placed as question 2 decides. Done when a `pages.dev` address serves
     `/` and `/build` from a monthly run's cube and `/status` returns the not-found page.
   - About, feedback and corrections, and "why these figures differ" pages.
   - The Stats NZ series (D-065): a maintainer script over the user's hand export; the long-run
     volume and completeness for cars.
   - Read the user's export of NZTA's registrations dashboard
     (`data/raw/nzta-dashboard/2026-10/`) and propose whether it becomes a source.
   - Visitor tests (`docs/playbooks/visitor-test.md`) and first load measured on the deployed site.
7. **Small corrections the lifted freeze allows:** the freeze wording in the playbooks, skills,
   `README.md` and `POST_GATE.md` (STATE); once a build carries #27 and #28, flip
   `used-import-age` and `powertrain-mix` to live (STATE issue 5); move each `public_copy` entry
   onto `config/dimensions.json` (D-042).
8. **Stages 2 to 5 of the brief**, each on the user's word.
9. **Kept from the old queue, unplaced by the brief:** `age-distribution-moving-hole`; a visitor
   name for "Area Outside Region"; a per-capita map.

## Questions for the user

1. **Which backed-up folder do the August and October raw pulls go to?** Your answer 5 left
   `<YOUR BACKED-UP FOLDER>` unfilled. Give me a path and I run the three copy commands in the
   report §3, or run them yourself. With no answer they stay on one disk.
2. **Where do the secrets live: an environment only `main` can use, or repository secrets?** It
   decides step 3 of the archive setup (3a or 3b) and the Cloudflare secrets. Recommend the
   environment for both: a workflow on any other branch then cannot read them. With no answer I
   build for whichever the archive secret turns out to be, and write the Cloudflare steps the
   same way.
3. **May I pull November by hand, as I did October, if D-063 is not on `main` when NZTA
   refreshes in December?** Recommend yes: the same read-only pull, 36 fields, into
   `data/raw/2026-11/`. With no answer I ask again when the refresh lands.
4. **When do the two unopened pull requests open?** Recommend: each when the pull request below
   it has merged, so no more wait on you than now. With no answer, that.

Also yours, from the brief's §12: the `matrix` shape; the acceptable running cost; the limit of
five pull requests; the About page; the name and domain. And two pages NZTA's site would not show
an automated reader (the Stage 0 report §6).

## Prompt for the next session

/start. Read `docs/STATE.md`, this file and `docs/brief/STAGE_1_REPORT.md`. Check first what has
merged (`gh pr list`, `git log origin/main`), whether the secret `ARCHIVE_REPO_TOKEN` exists and
where, whether `data/raw/nzta-dashboard/2026-10/` holds the user's export, and whether NZTA has
refreshed again. Then take the first queue item the user's answers allow: support the merges, or
build D-064 and then D-063. Merge nothing, dispatch nothing, and pull nothing without the user's
word.
