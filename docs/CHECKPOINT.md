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
  - **October is archived.** The first run failed at its first step (the token could not see the
    repository); the user added the repository to the token; run 43383948013 wrote
    `snapshot-2026-10` to the private repository: 5,926,990 rows, 35 fields, 39,298,142 bytes.
  - **The site stack is in `ui/explore`**, #17 to #25 and #30 to #34, on the user's "go" after
    the screenshots; and **#40**, the fixes the screenshots called for (D-074), after its
    reviewer agreed twice. `ui/explore` is `e5dfc70`.
  - **NZTA's dashboard is read from the user's hand export** of October: it agrees with the
    register to 0.11% for the newest month, holds every month from January 2021, and has an
    owner type the register lacks. A proposal is written (D-075).
  - **The user asked whether `VIN11` and `POSTCODE` may be used** if NZTA's licence allows. It
    does (CC BY 4.0). Nothing is changed: it reverses D-066 item 9 and a non-goal (question 1).
  - The merged branches and their worktrees are deleted.
- 2026-11-13, third session: the pipeline stack merged, the forced run, the archive's home (D-068).
- 2026-11-13, earlier: Stage 0, D-062 to D-066, the Stage 1 report.

## Open pull requests waiting on the user (1)

- **#36** `claude/next-stage-brief` into `claude/question-builder`: these notes. It waits for the
  question builder's pull request.

## Work queue (in order)

1. **Watch the first daily runs** (from 14 November, `docs/playbooks/check-monthly-run.md`): each
   should skip, green, with "Source unchanged" on its summary page. Then the first real build,
   deploy start and archive at NZTA's December refresh.
2. **If the user says yes to question 2: the dashboard test export**, one step at a time as on
   2026-11-13: Month year set to January 2021, the same twelve dimensions, into
   `data/raw/nzta-dashboard/2021-01/`. Compare it with the register's survivors for that month
   (`dash_compare.py` was a scratch script: rewrite it as a maintainer script in `scripts/` if the
   dashboard becomes a source). Then propose the backfill.
3. **If the user says yes to question 1:** a decision record that supersedes D-066 item 9 with
   the rule for each field; `register_archive.never_pulled` in `config/pipeline.json`; and October
   with those fields before NZTA's December refresh. A month's file is never replaced, so that is
   a second file, by a decision of its own.
4. **On top of `ui/explore`, before `ui/explore` meets `main`:** open
   `claude/question-builder`'s pull request into `ui/explore`; a commit correcting
   `$ranking_period_comment` and flipping `used-import-age` and `powertrain-mix` to live (STATE
   issues 4 and 5). **`ui/explore` into `main`: ask first.**
5. **Open `claude/fact-table`'s pull request into `main`**, with five lines; merge it under
   D-068's rule (D-069): green check, a reviewer that has not seen claude's reasoning, and the
   user's word in that session, because Claude Code refuses a merge into `main` without it.
6. **Read into the docs what NZTA's page gives** (saved in `data/raw/nzta-dashboard/2026-10/`):
   its history of `vehicle_year` against `docs/MODEL_AND_AGE.md` §1; its field definitions against
   `docs/DATA_MAP.md`; and NZTA's make and model cleansing code (GitHub) against
   `brand_registry.csv` and `model_registry.csv`. Resolve differences against the data (hard rule 6).
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
     pin the pipeline's dependencies by hash; take the archive job's month from the state file.
   - #39's: turn off admin bypass on `production`; let a full re-run replace the `site` artifact;
     try `npm ci --ignore-scripts` for the upload tool.
   - #40's: the line under the ranking names three columns whichever are hidden.
9. **Stages 2 to 5 of the brief**, each on the user's word.
10. **Kept from the old queue, unplaced by the brief:** `age-distribution-moving-hole`; a visitor
    name for "Area Outside Region"; a per-capita map.

## Questions for the user

1. **May `POSTCODE` and `VIN11` be kept and used?** The licence allows it; D-066 item 9 and the
   brief's non-goals forbid it on privacy grounds. Recommend: postcode yes, kept in the private
   archive and published only as area totals above a minimum count; `VIN11` yes in the private
   archive only, to derive model year and factory, after checking it against the data. Wanted
   before NZTA's December refresh if October is to be kept with them. With no answer nothing
   changes.
2. **Does NZTA's dashboard become a source, exported by hand (D-075)?** Recommend yes, starting
   with one test export of January 2021. With no answer the October export stays on disk unused.
3. **May claude merge the question builder and the two preset corrections into `ui/explore` once
   each has a reviewer's agreement,** as it did the site fixes? Recommend yes. With no answer
   their pull requests are opened and wait.

Also the user's, from the brief's §12: the `matrix` shape; the acceptable running cost; the limit
of five pull requests; the About page; the name and domain. And two pages NZTA's site would not
show an automated reader (the Stage 0 report §6).

## Prompt for the next session

/start. Read `docs/STATE.md`, this file, and D-068 to D-075 in `docs/DECISIONS.md`. Check first:
what `main` and `ui/explore` are; the newest `Monthly build` runs (the daily run started on 14
November) and whether NZTA has refreshed; that the private repository still has
`snapshot-2026-10`. Then take the queue in order, with the user's answers to the three questions.
Merge into `main` only what D-068 and D-069 name, only with a green check, a reviewer that has
not seen your reasoning, and the user's word in the session; if Claude Code refuses a merge, say
so and do not work around it. Do not start a forced run without asking.
