# Checkpoint

Last updated by claude on 2026-11-13

## Where we left off

- 2026-11-13, fourth session: the user's three answers (D-069), then the build.
  - **The archive token is stored** as `ARCHIVE_REPO_TOKEN` in the environment `archive`, walked
    through in seven steps. It expires 13 November 2027.
  - **D-064 is built: #37 into `main`.** The reviewer refused the first version (a few rows dated
    after the register's month could have been built as a month), agreed to the fix, and the
    check is green on `10019e0` (D-070).
  - **D-063 is built: #38**, stacked on #37. The October file was written once from the saved
    hand pull to measure it: 39.3 MB, 35 fields (D-071).
  - **The Cloudflare upload is behind a main-only environment: #39**, stacked on #37. The
    environment `production` exists, limited to `main`, with no secret. Its reviewer agreed
    (D-072).
  - **The screenshots of the site stack are taken**: 14 images and a contact sheet, from the top
    of the stack against `cube-2026-10`. They are in the session's scratch folder, which does not
    last; `../nzta-screens` holds the built site to take them again. What they showed is STATE
    known issue 10.
  - **Nothing was merged.** Claude Code's permission check refused the merge of #37 twice, and
    claude stopped there. The user decides how the merges happen (Need you 1).
- 2026-11-13, third session: the pipeline stack merged, the forced run, the archive's home (D-068).
- 2026-11-13, earlier: Stage 0, D-062 to D-066, the Stage 1 report.

## Open pull requests waiting on the user (18)

- **#37** (D-064) into `main`: green, reviewer agrees. Waits only for the merge.
- **#38** (D-063) and **#39** (the deploy environment), each based on `claude/daily-run` so it
  shows only its own change. After #37 merges, each is pointed at `main`, closed and reopened so
  the check runs against `main`, then merged: #38 under D-068's rule, #39 only on the user's word.
- The site stack, into `ui/explore`, in this order: #17, #18, #19, #20, #21, #22, #23, #24, #25,
  #30, #31, #32, #33, #34; then `claude/question-builder`'s pull request (not open yet); then #36,
  this branch. The user says "go" after seeing the screenshots.

## Work queue (in order)

1. **Merge #37, then #38** (Need you 1). After #37: `gh pr edit 38 --base main`, close and reopen,
   wait for green, merge. Then delete the merged branches and their worktrees, and in one commit
   on this branch correct what describes the old schedule (STATE, "Where docs and code disagree").
2. **Archive October**, once #38 is on `main` and while NZTA still holds it: start `Monthly build`
   on `main` by hand with `archive` ticked and nothing else (`gh workflow run monthly-build.yml
   --ref main -f archive=true`). It builds nothing: the build job skips, the archive job proves
   the token, pulls, and writes `snapshot-2026-10`. Check the release, the job's time and memory,
   and report. If the token is refused the job says so; the user makes a new one.
3. **#39** on the user's word (Need you 3): point at `main`, reopen, green, merge.
4. **On "go": merge #17 to #34 into `ui/explore`**, in order, from the command line. Then open
   `claude/question-builder`'s pull request, and a commit correcting `$ranking_period_comment`
   and flipping `used-import-age` and `powertrain-mix` to live (STATE issues 4 and 5).
   **`ui/explore` into `main`: ask first.**
5. **Open `claude/fact-table`'s pull request into `main`**, with five lines; merge it under
   D-068's rule (D-069): green check, a reviewer that has not seen claude's reasoning.
6. **The October export from NZTA's dashboard** (the user, before 1 December; the Stage 1 report
   §5), one step at a time. Then read it and propose whether it becomes a source.
7. **November's snapshot.** With #37 on `main` the daily run builds it within a day of NZTA's
   refresh, and with #38 the archive job keeps it. Without #37, the 8 December run or a dispatch
   builds it; without #38, claude pulls it by hand at 36 fields into `data/raw/2026-11/` (allowed,
   D-068), copies it to `F:\nzta-data-backup`, and can write the file with `--from-pull`.
8. **The rest of Stage 1** (the brief §9), each on the user's word:
   - Deploy, after #39. Numbered console steps, all production: a Cloudflare Pages project for
     Direct Upload named `nz-vehicle-registrations`; an API token limited to Cloudflare Pages:
     Edit; the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` **in the environment
     `production`**; then the switch, the repository variable `CLOUDFLARE_PAGES_PROJECT` set to the
     project's name (claude sets it with `gh` on the user's word). With the secrets but not the
     variable, every run is green and nothing deploys. Making the site public is asked for first.
   - The pages' stale words seen in the screenshots (STATE issue 10) before the site is public.
   - About, feedback and corrections, and "why these figures differ" pages.
   - The Stats NZ series (D-065): a maintainer script over the user's hand export.
   - Visitor tests (`docs/playbooks/visitor-test.md`) and first load measured on the deployed site.
9. **Small corrections:** the freeze wording in the playbooks, skills, `README.md` and
   `POST_GATE.md`; move each `public_copy` entry onto `config/dimensions.json` (D-042); and the
   reviewers' follow-ups, none blocking (their claims):
   - The pipeline stack's: a failed release upload could leave a release with no file;
     `persist-credentials: false` in `checks.yml`; `pipeline/events.py` blames the CSV when an
     enum row parses to no values; `docs/METRICS.md` does not say the share guards apply to a pair
     slice's filtered base; `write_pairs` accepts a dimension id containing `__`.
   - #37's: the alarm-day check accepts `true` as day 1 and runs only on runs that build nothing.
   - #39's: turn off admin bypass on `production`; let a full re-run replace the `site` artifact;
     try `npm ci --ignore-scripts` for the upload tool.
10. **Stages 2 to 5 of the brief**, each on the user's word.
11. **Kept from the old queue, unplaced by the brief:** `age-distribution-moving-hole`; a visitor
    name for "Area Outside Region"; a per-capita map.

## Questions for the user

1. **How do #37 and #38 get merged?** D-068 lets claude merge them, but Claude Code itself refused
   the command. Either the user says "merge 37 and 38" in the next session and claude tries again
   (the refusal may be because this session's messages never said it in so many words), or the
   user merges #37 on GitHub: the green button's arrow, "Create a merge commit", "Confirm merge".
   Recommend the first, with the second as the fallback. With no answer they stay open: the
   schedule stays on the 8th and nothing is archived.
2. **"Go" for the site stack?** The screenshots are taken; the stale words on `/method` and
   `/caveats` (STATE issue 10) are in them. Recommend go: the words are fixed on top of the stack
   before anything is public. With no answer the fourteen stay open.
3. **May claude merge #39 into `main` under the same rule?** Its reviewer agreed. Recommend yes.
   With no answer it stays open, which costs nothing until the deploy is set up.

Also the user's, from the brief's §12: the `matrix` shape; the acceptable running cost; the limit
of five pull requests; the About page; the name and domain. And two pages NZTA's site would not
show an automated reader (the Stage 0 report §6).

## Prompt for the next session

/start. Read `docs/STATE.md`, this file, and D-068 to D-072 in `docs/DECISIONS.md`. Check first:
whether #37 is merged and what `main` is; whether NZTA has refreshed again; whether
`data/raw/nzta-dashboard/2026-10/` holds the user's export. Then take the queue in order. Merge
only what D-068 and D-069 name, only with a green check and a reviewer that has not seen your
reasoning; if Claude Code refuses a merge, say so and do not work around it. Do not start a forced
run without asking.
