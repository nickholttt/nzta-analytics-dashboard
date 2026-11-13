# Checkpoint

Last updated by claude on 2026-11-13

## Where we left off

- 2026-11-13, sixth session.
  - **The user's answers** (D-078): the fact table leaves out the owner's region until the Stage 2
    privacy review; merge #42 and #36; the dashboard's first step is the user's, when they say
    they are ready; then the queue, asking before `ui/explore` goes into `main` or anything
    becomes public.
  - **#42 is in `main`** (`a0c1943`): the archive job keeps `VIN11` and `POSTCODE` from the next
    built month.
  - **#41, the fact table, is in `main`** (`f78e3e1`), without region. Its reviewer agreed twice
    (once with follow-ups, then on the fixes). October's dry run: 641,618 rows in 1.73 MB, and
    every slice byte-identical to `cube-2026-10`. The next build publishes the table.
  - **The review found a gap `main` already had**, now closed: a vehicle type listed twice in
    `vehicle_scope.csv` counted its vehicles twice with no abort.
  - **`VIN11` is checked against the data** (D-079): no model year for used imports, one for about
    four in ten NZ-new vehicles; nothing is derived. `POSTCODE`'s zero means "not recorded".
  - **NZTA's dashboard page is read into the docs**: its history of `vehicle_year` against the
    data (`docs/MODEL_AND_AGE.md` §1) and its definitions (`docs/DATA_MAP.md`). The make and
    model cleansing code it links to answers "Not Found" on GitHub.
  - Four playbooks and two skills no longer describe the freeze.
  - **#36 is in `ui/explore`** (`2236422`): these notes, D-062 to D-079.
  - **#45 is open into `ui/explore`**: `main` merged in, the two conflicts resolved, the stale
    docs brought up to date. Tests, typecheck, build and screens pass. Its reviewer agreed with
    follow-ups, none blocking; the ones that are docs on that branch are done.

## Open pull requests waiting on the user (1)

- **#45** `claude/explore-meets-main` into `ui/explore`: say "merge 45". After it, `ui/explore`
  into `main` has no conflict.

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
2. **Watch the first daily runs** (from 14 November, `docs/playbooks/check-monthly-run.md`): each
   should skip, green, with "Source unchanged". At NZTA's December refresh: the first build with
   the fact table, its cube release, the deploy start, and an archive file of 37 fields.
3. **The deploy, each step asked for:**
   - `ui/explore` into `main`. First "merge 45" (merge commit; delete the branch). Then open
     `ui/explore` into `main`: `Checks` must be green and a reviewer agree, and the user says
     "merge N". After it `Deploy` builds the site on every push to `main` and uploads nothing
     until the Cloudflare switch. AGENTS.md hard rules 7 and 8 still carry wording the day has
     overtaken; changing a hard rule's text needs the user's approval (question 1).
   - A cube with the fact table: NZTA's December refresh builds one, or a forced run of October
     does (ask).
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
   - #45's: event markers ignore a preset's filter, and `powertrain-mix` now has one
     (`src/lib/events.ts`); `docs/CUBE_SCHEMA.md` says `src/lib/data.ts` is not yet on `main`
     (correct it with `ui/explore` into `main`); D-063's and D-064's headings still read
     "(proposed)" though D-066 accepted them (the file is append-only; D-066 is the record).
   - The fact table's (#41): a test that builds a second dataset with no `facts`; the abort
     message for a reserved name (`month`, `n`, `rid`) reads as if the dimension were not
     derivable, and no test covers it; the Aborts list in `docs/CUBE_SCHEMA.md` does not name the
     hybrid file's and the model registry's checks; `FACT_ROW_ORDER` belongs in `contract.py`.
   - The question builder's, listed on #43: a value in a link that is not in the data draws as a
     zero line; the address bar is not rewritten until the first change; a condition with no
     value yet is lost on any other change; and five smaller ones. Also: a link's condition on a
     field Build cannot apply is named by its id, not its label.
   - Each `public_copy` entry onto `config/dimensions.json` (D-042); STATE issues 9 and 10.
   - The pipeline stack's: a failed release upload could leave a release with no file;
     `persist-credentials: false` in `checks.yml`; `pipeline/events.py` blames the CSV when an
     enum row parses to no values; `docs/METRICS.md` does not say the share guards apply to a
     pair slice's filtered base; `write_pairs` accepts a dimension id containing `__`.
   - #37's: the alarm-day check accepts `true` as day 1 and runs only on runs that build nothing.
     #38's: check the digest of the pulled rows, not only their count; pin the pipeline's
     dependencies by hash; take the archive job's month from the state file. #39's: turn off
     admin bypass on `production`; let a full re-run replace the `site` artifact; try
     `npm ci --ignore-scripts`. #40's: the line under the ranking names three columns whichever
     are hidden.
6. **The rest of Stage 1** (the brief §9): About, feedback and "why these figures differ" pages;
   the Stats NZ series (D-065); visitor tests; first load measured on the deployed site.
7. **Stages 2 to 5 of the brief**, each on the user's word. Kept from the old queue:
   `age-distribution-moving-hole`; a visitor name for "Area Outside Region"; a per-capita map.

## Questions for the user

1. **May #45 merge, and then `ui/explore` go into `main`?** That puts the site's code on
   `main`, so `Deploy` starts building the site on every push; nothing is public until the
   Cloudflare switch. (a) Yes: say "merge 45", and claude opens `ui/explore` into `main`, has it
   reviewed, and asks for that merge by number; with it, AGENTS.md hard rules 7 and 8 are
   reworded to drop the merges already done and the gate that has passed. (b) Not yet.
   Recommend (a). With no answer #45 stays open and nothing reaches `main`.
2. **A cube with the fact table: a forced run of October now, or wait for December's refresh?**
   The Build page of a deployed site needs one. A forced run publishes the fact table in a public
   release about three weeks sooner. Recommend waiting unless the site should go public before
   December. With no answer, no forced run.
3. **The dashboard, step 1**: say "ready" and it starts.

Also the user's (the brief's §12): the `matrix` shape; running cost; the About page; name and domain.

## Prompt for the next session

/start. Read `docs/STATE.md`, this file, and D-078 and D-079 in `docs/DECISIONS.md`. Check first:
what `main` and `ui/explore` are; the newest `Monthly build` runs (daily from 14 November) and
whether NZTA has refreshed; that the private repository's `snapshot-2026-10` still has two files.
Then take the queue in order with the user's answers. Merge into `main` only with a green check,
a reviewer that has not seen your reasoning, and the user's word in the session; if Claude Code
refuses a merge, say so and do not work around it. Do not start a forced run without asking.
