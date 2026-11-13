# Checkpoint

Last updated by claude on 2026-11-13

## Where we left off

- 2026-11-13, third session: the user answered the three open questions and gave standing
  permissions (D-068).
  - **The backup is complete:** `F:\nzta-data-backup` holds both raw pulls, every file identical
    to the original. It is on the project's own disk.
  - **The pipeline stack is on `main`:** #26, #27, #28, #29, #35, in order, each a merge commit,
    each with a reviewer's agreement (five reviewers on opus, one per pull request, none given
    claude's reasoning) and a fresh green check against `main`. Before the first cube-changing
    merge, the whole stack was merged into a scratch copy of `main` and October was rebuilt there
    from the saved pull: same totals, no warnings.
  - **The one forced run is used:** 43374803222, green. It rebuilt October with the new code,
    committed `912cada` (state only) and made the first cube release, `cube-2026-10`.
  - **The archive's repository and environment exist**, empty of files and of the secret.
  - Then stop and report, as asked. D-064, D-063 and the screenshots are not started.
- 2026-11-13, second session: the user's Stage 0 answers (D-066); October built; the freeze
  lifted; the Stage 1 report (`docs/brief/STAGE_1_REPORT.md`).
- 2026-11-13, first session: Stage 0 of the brief, D-062 filed, D-063 to D-065 proposed.

## Open pull requests waiting on the user (15)

The site stack, into `ui/explore`, in this order: #17, #18, #19, #20, #21, #22, #23, #24, #25,
#30, #31, #32, #33, #34; then `claude/question-builder`'s pull request (not open yet); then #36,
this branch. Five lines on each: the Stage 1 report §6. The user says "go" after seeing the
screenshots, and claude merges #17 to #34 from the command line (D-068).

## Work queue (in order)

1. **The archive token** (the user, walked through one step at a time, each waiting for "done").
   The steps are the Stage 1 report §4, steps 2 and 3a; step 1 and the environment are done. Done
   when `gh api repos/nickholttt/nzta-analytics-dashboard/environments/archive/secrets` lists
   `ARCHIVE_REPO_TOKEN`.
2. **Build D-064** (the daily run) on `claude/daily-run` from `origin/main`: the schedule, the
   build-once rule, the missed-month alarm from the 15th, tests. Settle STATE known issue 10 here.
   Open its pull request; merge it under D-068's rule (green check, independent reviewer).
3. **Build D-063** (the archive), on top of D-064 or on `main` once D-064 is merged: the pull
   widens to 36 fields (never `POSTCODE`); each built run writes the whole snapshot as one Parquet
   file to a release in `nickholttt/nzta-register-archive`, in a job of its own that names the
   environment `archive` and reads `ARCHIVE_REPO_TOKEN` (D-067), never as an artifact; a month's
   file is never replaced. Measure the run's time and memory. Open its pull request; merge it
   under D-068's rule. Its first real run needs item 1.
4. **Screenshots of the site stack** for the user: the main screens (`/`, `/build`, the map, the
   ranking, the not-found page) at phone and desktop width, from the top of the stack (#34,
   `claude/deploy-proposal`), headless, against the `cube-2026-10` release so the pair charts
   draw. Then wait for "go".
5. **On "go": merge #17 to #34 into `ui/explore`**, in order, from the command line. Then open
   `claude/question-builder`'s pull request, and a commit correcting `$ranking_period_comment`
   and flipping `used-import-age` and `powertrain-mix` to live (STATE issues 4 and 5).
   **`ui/explore` into `main`: ask first.**
6. **Open `claude/fact-table`'s pull request into `main`**, with five lines. Merging it is not in
   D-068 (question 2).
7. **The October export from NZTA's dashboard** (the user, before 1 December; the Stage 1 report
   §5), one step at a time. Then read it and propose whether it becomes a source.
8. **November's snapshot.** If D-064 is not on `main` when NZTA refreshes in December, the
   8 December run or a dispatch builds it. If D-063 is not, claude pulls it by hand at 36 fields
   into `data/raw/2026-11/` (allowed, D-068) and copies it to `F:\nzta-data-backup`.
9. **The rest of Stage 1** (the brief §9), each on the user's word:
   - Deploy: before any Cloudflare secret exists, `deploy.yml`'s upload moves to a job that names
     an environment limited to `main` (D-068 answer 2; STATE issue 11). Then numbered console
     steps, all production: a Cloudflare Pages project for Direct Upload named
     `nz-vehicle-registrations`; an API token limited to Cloudflare Pages: Edit; the secrets
     `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in that environment. Making the site
     public is asked for first.
   - About, feedback and corrections, and "why these figures differ" pages.
   - The Stats NZ series (D-065): a maintainer script over the user's hand export.
   - Visitor tests (`docs/playbooks/visitor-test.md`) and first load measured on the deployed site.
10. **Small corrections:** the freeze wording in the playbooks, skills, `README.md` and
    `POST_GATE.md`; the reviewers' follow-ups (STATE issue 11); move each `public_copy` entry onto
    `config/dimensions.json` (D-042).
11. **Stages 2 to 5 of the brief**, each on the user's word.
12. **Kept from the old queue, unplaced by the brief:** `age-distribution-moving-hole`; a visitor
    name for "Area Outside Region"; a per-capita map.

## Questions for the user

1. **Where does a copy of the backup go that is not on the project's disk?** `F:\nzta-data-backup`
   is on the same disk as the project, so one failed disk loses both. Recommend: claude copies it
   to `E:\nzta-data-backup` (a different disk in the same computer), and the user also drags that
   folder into OneDrive or onto a USB drive, so one copy is outside the computer. With no answer
   it stays on one disk.
2. **May claude merge `claude/fact-table` into `main` under the same rule as the pipeline stack?**
   It is the fact table the question builder reads, and it changes the published cube. Recommend
   yes. With no answer claude opens the pull request and leaves the merge to the user.

Also the user's, from the brief's §12: the `matrix` shape; the acceptable running cost; the limit
of five pull requests; the About page; the name and domain. And two pages NZTA's site would not
show an automated reader (the Stage 0 report §6).

## Prompt for the next session

/start. Read `docs/STATE.md`, this file and D-068 in `docs/DECISIONS.md`. Check first: that `main`
is still `912cada` or what has moved it; whether the secret `ARCHIVE_REPO_TOKEN` is in the
environment `archive`; whether `data/raw/nzta-dashboard/2026-10/` holds the user's export; whether
NZTA has refreshed again. Then take the queue in order: the token walk-through if the user is
there, D-064, D-063, the screenshots. Merge only what D-068 names, only with a green check and a
reviewer that has not seen your reasoning. The forced run is used: ask before another.
