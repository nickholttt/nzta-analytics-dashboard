# Checkpoint

Last updated by claude on 2026-11-14

## Where we left off

- 2026-11-14, seventh session.
  - **The user's answers** (D-080, D-081): merge #45 and #46; hard rules 7 and 8 reworded as
    proposed; October forced only if the daily run of 14 November reports the source
    unchanged; no path from the user's computer in the docs; the dashboard on "ready"; nothing
    becomes public without asking.
  - **#46 is in `main`** (`a41c2cf`, the same tree as `ui/explore`). The `Deploy` run of that
    push built the site from `cube-2026-10` and uploaded nothing. That cube has no fact table,
    so Build draws its default question and offers no conditions (STATE, issue 4).
  - **#47 is open into `main`**: the new rules 7 and 8, the paths removed, the lines #46 made
    stale, D-080, D-081 and these notes. Its reviewer agreed.
  - **What a forced run of October does was read, not run** (D-080): the release's file is
    replaced, the state committed again, the archive's file kept, and nothing uploaded.
  - **A check-in was scheduled in that session** for 20:07 NZDT on 14 November, to read the
    daily run and force October only if D-081's condition held. It lives only while that
    session is open. Nothing in the repo says whether it fired: check (prompt below).

## Open pull requests waiting on the user (1)

- **#47** `claude/explore-in-main-notes` into `main`: say "merge 47".

## Work queue (in order)

1. **The dashboard test export**, when the user says "ready", one step at a time (D-077). Step
   1: open the dashboard, set Month year to January 2021, and report the total it shows. Then the
   same twelve dimensions as October, exported into `data/raw/nzta-dashboard/2021-01/`, timed.
   Then try the whole of 2021 in one export, with "Registration MMM-YYYY" ticked in place of one
   dimension (choose which once January 2021 shows whether every vehicle is ACTIVE there too).
   Compare January 2021 with the register's survivors for that month from the archive file; write
   the comparison as a maintainer script in `scripts/` if the dashboard becomes a source. Report
   the measured count, time and fit, and ask whether it becomes a source. NZTA's page says the
   dashboard holds vehicles "with a date of first ownership within the past five years", so
   January 2021 may already be gone.
2. **Watch the daily runs** (from 14 November, `docs/playbooks/check-monthly-run.md`): each should
   skip, green, with "Source unchanged". At NZTA's December refresh: a build with the fact table,
   its release, the deploy start, an archive of 37 fields.
3. **The deploy, each step asked for:**
   - **The forced run of October** (D-081): only if the scheduled run of 14 November 06:17 UTC
     reported the source unchanged, and only once. If no forced run followed that day (`gh run
     list --workflow "Monthly build"`), the user's condition was for that run: tell the user
     what it said and ask again before forcing. If one did run, check: the release's file holds
     `facts/`; the state commit; the archive job stopped at "already archived"; `Deploy`
     uploaded nothing; Build's conditions on a build from the new release.
   - **On "merge 47"**: merge commit, delete the branch. It starts one `Deploy` run (the
     workflow's comments changed), which builds and uploads nothing.
   - Numbered console steps, all production: a Cloudflare Pages project for Direct Upload named
     `nz-vehicle-registrations`; an API token limited to Cloudflare Pages: Edit; the secrets
     `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment `production`; then the
     switch, the repository variable `CLOUDFLARE_PAGES_PROJECT` (claude sets it with `gh` on the
     user's word). Setting the variable is what makes the site public.
4. **For the Stage 2 privacy review** (the user's): whether `region` returns to the fact table
   and above what count; whether the table's one-vehicle rows (half of them) and the `region`
   slice's small cells need a minimum count (the slice's are not measured); postcode totals and
   their minimum (D-076); whether a model year for the makes whose VINs carry one is wanted (D-079).
5. **Small corrections and follow-ups, none blocking** (the reviewers' claims):
   - #46's: `deploy.yml`'s check for links to internal pages misses a single-quoted or templated
     path and an island reading `INTERNAL_PAGES` in the browser; `LeagueChart.tsx` tests
     `dimension.id === "model"` and splits on the pipeline's `"|"`. #47's: none left.
   - #45's: event markers ignore a preset's filter, and `powertrain-mix` has one
     (`src/lib/events.ts`); D-063's and D-064's headings still read "(proposed)" (D-066 accepted).
   - The fact table's (#41): a test that builds a second dataset with no `facts`; the abort
     message for a reserved name (`month`, `n`, `rid`) reads as if the dimension were not
     derivable, and no test covers it; the Aborts list in `docs/CUBE_SCHEMA.md` does not name the
     hybrid file's and the model registry's checks; `FACT_ROW_ORDER` belongs in `contract.py`.
   - The question builder's eight are listed on #43. Also: a link's condition on a field Build
     cannot apply is named by its id, not its label. Each `public_copy` entry onto
     `config/dimensions.json` (D-042); STATE issues 8 and 9.
   - The pipeline stack's: a failed release upload could leave a release with no file;
     `persist-credentials: false` in `checks.yml`; `pipeline/events.py` blames the CSV when an
     enum row parses to no values; `docs/METRICS.md` does not say the share guards apply to a
     pair slice's filtered base; `write_pairs` accepts a dimension id containing `__`.
   - #37's: the alarm-day check accepts `true` as day 1 and runs only on runs that build nothing.
     #38's: check the digest of the pulled rows, not only their count; pin the pipeline's
     dependencies by hash; take the archive job's month from the state file. #39's: turn off
     admin bypass on `production`; let a full re-run replace the `site` artifact; try `npm ci
     --ignore-scripts`. #40's: the line under the ranking names three columns whichever are hidden.
6. **The rest of Stage 1** (the brief §9): About, feedback and "why these figures differ" pages;
   the Stats NZ series (D-065); visitor tests; first load measured on the deployed site.
7. **Stages 2 to 5 of the brief**, each on the user's word. Kept from the old queue:
   `age-distribution-moving-hole`; a visitor name for "Area Outside Region"; a per-capita map.

## Questions for the user

1. **May #47 merge?** Docs and two workflow comments. Say "merge 47". Recommend yes. With no
   answer it stays open, and `main` keeps the old text of hard rules 7 and 8.
2. **Is `ui/explore` kept?** All of it is in `main`, and new work branches from `main`. (a) Keep
   it. (b) Delete it on GitHub; it can be recreated from `main`. Recommend (b), to leave one
   place to look. With no answer it stays.
3. **The dashboard, step 1**: say "ready" and it starts.

Also the user's: the Cloudflare steps, when the site should be public; and the brief's §12: the
`matrix` shape; running cost; the About page; name and domain.

## Prompt for the next session

/start. Read `docs/STATE.md`, this file, and D-080 and D-081 in `docs/DECISIONS.md`. Check first:
whether #47 is merged and what `main` is; the `Monthly build` runs since 14 November: what the
daily runs said, and whether a forced run followed; whether `cube-2026-10`'s file holds `facts/`;
that `CLOUDFLARE_PAGES_PROJECT` is still unset. Then the queue. Merge into `main` only with a
green check, a reviewer that has not seen your reasoning, and the user's word in the session; if
Claude Code refuses a merge, say so and do not work around it. No forced run without the user's
yes in the session. No path from the user's computer in a doc, a commit or a pull request.
