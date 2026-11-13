# Checkpoint

Last updated by claude on 2026-11-14

## Where we left off

- 2026-11-14, seventh session.
  - **The user's answers** (D-080): merge #45; open `ui/explore` into `main`, have it reviewed
    and ask for the merge by number; show the old and new text of hard rules 7 and 8 and wait for
    a yes; force October only after `ui/explore` is in `main` and after a yes; the dashboard on
    "ready"; nothing becomes public without asking.
  - **#45 is in `ui/explore`** (`50caa55`), which now contains `main`. **#46 is open,
    `ui/explore` into `main`**: `Checks` green, reviewer agreed with follow-ups (queue 5).
  - **The public build passes against the released cube**, as `Deploy` will run it after the
    merge (the reviewer could not build): 5 pages, no link to an internal page. That cube has no
    fact table, so Build draws its default question and offers no conditions (STATE, issue 4).
  - **What a forced run of October does was read, not run** (D-080): the release's file is
    replaced, the state committed again, the archive's file kept, and nothing uploaded.

## Open pull requests waiting on the user (1)

- **#46** `ui/explore` into `main`: say "merge 46".

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
   skip, green, with "Source unchanged". If one says the source changed after October was built,
   tell the user before any forced run: it would build the changed register. At NZTA's December
   refresh: a build with the fact table, its release, the deploy start, an archive of 37 fields.
3. **The deploy, each step asked for:**
   - **On "merge 46"**: merge commit; `ui/explore` is the user's branch and is not deleted. Then
     watch the `Deploy` run that push starts: it should build the site from `cube-2026-10` and
     upload nothing. Then open `claude/explore-in-main-notes` into `main` (it is cut from
     `ui/explore`, so after the merge it differs from `main` only by its own commits), adding to
     it first: `docs/CUBE_SCHEMA.md`'s "not yet on `main`"; `deploy.yml`'s two comments about
     "before ui/explore reaches main"; AGENTS.md's "Branches" entry for `ui/explore`; STATE's
     lines the merge makes stale; and, only on the user's yes, hard rules 7 and 8 with a record.
   - **The forced run of October, on the user's yes** (question 3): `gh workflow run "Monthly
     build" --ref main -f force=true`, after reading the newest daily run's summary. Then check:
     the release's file holds `facts/`; the state commit; the archive job stopped at "already
     archived"; `Deploy` uploaded nothing; Build's conditions on a build from the new release.
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
   - #46's: CLAUDE.md says "a test checks" each sub-agent definition's model, and neither the
     test nor `.claude/agents/` exists; `deploy.yml`'s check for links to internal pages misses
     a single-quoted or templated path and an island reading `INTERNAL_PAGES` in the browser;
     `LeagueChart.tsx` tests `dimension.id === "model"` and splits on the pipeline's `"|"`;
     `docs/brief/STAGE_0_REPORT.md` line 398 shows a temp path with the Windows short user name.
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

1. **May #46 merge?** It puts the site's code on `main`; `Deploy` then builds the site on each
   push and uploads nothing. Say "merge 46". Recommend yes. With no answer it stays open.
2. **The new text of hard rules 7 and 8.** Rule 7 lists merges that are all done and a forced
   run that was used. Proposed: "Don't push to `main` or merge into it without the user's word
   in that session, naming the pull request. A merge into `main` also needs green checks and a
   reviewer sub-agent that has not seen the author's reasoning. A forced Monthly build, and
   anything that makes something public, is asked for each time." The lines on agents' own
   branches and on `gh` stay. Rule 8 lets the site be built ahead "as a local dev build only
   until the 8 November 2026 gate passes". Proposed: the site may be built ahead of the build
   order; the gate passed (D-066); deploying it is Stage 1 of the brief, and each step that makes
   it public is asked for. Say "yes to 7 and 8", or change the words. No answer: both stay.
3. **May October be forced once #46 is in `main`?** It **replaces** the file in the public
   release `cube-2026-10` with one that also holds the fact table (D-080 has the rest). A copy of
   today's file stays in run 43374803222's artifact until 11 February 2027. Say "force October".
   Recommend yes if the site should be public before December; otherwise wait for NZTA's
   refresh. With no answer, no forced run.

Also the user's: whether `ui/explore` is kept once it is in `main` (new work would branch from
`main`); and the brief's §12: the `matrix` shape; running cost; the About page; name and domain.

## Prompt for the next session

/start. Read `docs/STATE.md`, this file, and D-080 in `docs/DECISIONS.md`. Check first: whether
#46 is merged and what `main` is; the newest `Monthly build` runs and whether NZTA has changed
the register; that `CLOUDFLARE_PAGES_PROJECT` is still unset. Then the queue, with the user's
answers. Merge into `main` only with a green check, a reviewer that has not seen your reasoning,
and the user's word in the session; if Claude Code refuses a merge, say so and do not work around
it. No forced run and no reworded hard rule without the user's yes in the session.
