# Checkpoint

Last updated by claude on 2026-11-13

## Where we left off

- 2026-11-13, fourth session.
  - **The user's answers** (D-069): the archive token is stored; the backup is off the disk; the
    fact table may merge under D-068's rule.
  - **Built, reviewed and merged into `main` on the user's word** (D-073): #37, the daily run
    (D-064, D-070; its reviewer refused the first version and agreed to the fix); #39, the
    Cloudflare upload behind the environment `production` (D-072); #38, the archive (D-063, D-071).
    `main` is `d50bfc6`.
  - **The site stack is in `ui/explore`** (`a3ec1f3`): #17 to #25 and #30 to #34, in order, on the
    user's "go", after the screenshots.
  - **The archive run for October failed at its first step** (run 43382023139): the token cannot
    see the archive repository. Nothing was pulled or uploaded.
  - **The fixes the screenshots called for are #40**, into `ui/explore` (D-074).
  - The merged branches and their worktrees are deleted.
- 2026-11-13, third session: the pipeline stack merged, the forced run, the archive's home (D-068).
- 2026-11-13, earlier: Stage 0, D-062 to D-066, the Stage 1 report.

## Open pull requests waiting on the user (2)

- **#40** `claude/site-words` into `ui/explore`: the stale words and the ranking table. Merged
  when its reviewer agrees (the user asked for these fixes on top of the stack).
- **#36** `claude/next-stage-brief` into `claude/question-builder`: these notes. It waits for the
  question builder's pull request.

## Work queue (in order)

1. **The archive token's access** (the user, one step at a time): on the token's page, Repository
   access, add `nzta-register-archive`. Then claude starts `Monthly build` on `main` with only
   `archive` ticked (the user asked for this run, D-073), checks the release `snapshot-2026-10`
   in the private repository and the job's time and memory, and reports. If the token cannot be
   edited, the user makes a new one and replaces the secret.
2. **The October export from NZTA's dashboard** (the user, before 1 December; the Stage 1 report
   §5), one step at a time, into `data/raw/nzta-dashboard/2026-10/`. Then read it and propose
   whether it becomes a source.
3. **Finish #40**: its reviewer's verdict, fixes if any, merge into `ui/explore`.
4. **On top of `ui/explore`, before `ui/explore` meets `main`:** open
   `claude/question-builder`'s pull request into `ui/explore`; a commit correcting
   `$ranking_period_comment` and flipping `used-import-age` and `powertrain-mix` to live (STATE
   issues 4 and 5). Merging these into `ui/explore` is the user's word.
   **`ui/explore` into `main`: ask first.**
5. **Open `claude/fact-table`'s pull request into `main`**, with five lines; merge it under
   D-068's rule (D-069): green check, a reviewer that has not seen claude's reasoning, and the
   user's word in that session, because Claude Code refuses a merge into `main` without it.
6. **Watch the first daily runs** (from 14 November, `docs/playbooks/check-monthly-run.md`), and
   the first real build and archive at NZTA's December refresh. If the archive is still not
   working then, claude pulls November by hand at 36 fields (allowed, D-068) and writes the file
   with `pipeline archive --from-pull`.
7. **The rest of Stage 1** (the brief §9), each on the user's word:
   - Deploy. Numbered console steps, all production: a Cloudflare Pages project for Direct Upload
     named `nz-vehicle-registrations`; an API token limited to Cloudflare Pages: Edit; the secrets
     `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` **in the environment `production`**; then
     the switch, the repository variable `CLOUDFLARE_PAGES_PROJECT` set to the project's name
     (claude sets it with `gh` on the user's word). With the secrets but not the variable, every
     run is green and nothing deploys. Making the site public is asked for first.
   - About, feedback and corrections, and "why these figures differ" pages.
   - The Stats NZ series (D-065): a maintainer script over the user's hand export.
   - Visitor tests (`docs/playbooks/visitor-test.md`) and first load measured on the deployed site.
8. **Small corrections:** the freeze wording in four playbooks, two skills, `README.md` and
   `POST_GATE.md`; move each `public_copy` entry onto `config/dimensions.json` (D-042); the rest
   of what the screenshots showed (STATE issue 10); and the reviewers' follow-ups, none blocking
   (their claims):
   - The pipeline stack's: a failed release upload could leave a release with no file;
     `persist-credentials: false` in `checks.yml`; `pipeline/events.py` blames the CSV when an
     enum row parses to no values; `docs/METRICS.md` does not say the share guards apply to a pair
     slice's filtered base; `write_pairs` accepts a dimension id containing `__`.
   - #37's: the alarm-day check accepts `true` as day 1 and runs only on runs that build nothing.
   - #38's: check the digest of the pulled rows, not only their count, after the archive's pull;
     pin the pipeline's dependencies by hash; take the archive job's month from the state file,
     not from the build job's output; say in the playbook that a failed cube release also skips
     the archive (done in this branch's playbook).
   - #39's: turn off admin bypass on `production`; let a full re-run replace the `site` artifact;
     try `npm ci --ignore-scripts` for the upload tool.
9. **Stages 2 to 5 of the brief**, each on the user's word.
10. **Kept from the old queue, unplaced by the brief:** `age-distribution-moving-hole`; a visitor
    name for "Area Outside Region"; a per-capita map.

## Questions for the user

1. **What does the token's page show under Repository access?** Asked in the session; the fix is
   one tick. With no answer October is archived from the hand pull by hand, or not at all.
2. **May claude merge the question builder and the two preset corrections into `ui/explore` once
   each has a reviewer's agreement,** as it did the site fixes? Recommend yes. With no answer
   their pull requests are opened and wait.

Also the user's, from the brief's §12: the `matrix` shape; the acceptable running cost; the limit
of five pull requests; the About page; the name and domain. And two pages NZTA's site would not
show an automated reader (the Stage 0 report §6).

## Prompt for the next session

/start. Read `docs/STATE.md`, this file, and D-068 to D-074 in `docs/DECISIONS.md`. Check first:
what `main` and `ui/explore` are; the newest `Monthly build` runs (the daily run started on 14
November) and whether NZTA has refreshed; whether the private repository has a release
`snapshot-2026-10`; whether `data/raw/nzta-dashboard/2026-10/` holds the user's export; whether #40
is merged. Then take the queue in order. Merge into `main` only what D-068 and D-069 name, only
with a green check, a reviewer that has not seen your reasoning, and the user's word in the
session; if Claude Code refuses a merge, say so and do not work around it. Do not start a forced
run without asking.
