# Checkpoint

Last updated by claude on 2026-11-13

## Where we left off

- 2026-11-13, fifth session.
  - **The user's answers** (D-076, D-077): `VIN11` and `POSTCODE` are kept in the private archive
    only and neither is published; the January 2021 dashboard test export goes ahead; claude
    merges the question builder and the preset corrections into `ui/explore` under a reviewer;
    then the fact table and the deploy steps, asking before `ui/explore` goes into `main` or
    anything becomes public.
  - **October has its second file in the private archive**: 5,926,990 rows at 37 fields,
    55,125,916 bytes, beside the first, which was not replaced. The local copies are deleted.
  - **#42 is open into `main`**: the archive job keeps the two fields from now on. Reviewer
    agreed; `Checks` green. Not merged: it is not among the merges D-068 names.
  - **The question builder is in `ui/explore`** (#43). Its reviewer refused it once (three
    faults, fixed), then agreed. **The preset corrections are in `ui/explore`** (#44).
    `ui/explore` is `85b7dd6`.
  - **#41, the fact table, is open into `main`, reviewed, green, and held**: its reviewer measured
    that 65% of its rows count one vehicle, with the owner's region beside the model (question 1).
  - **The dashboard arithmetic** is in D-077: 70 months; 70 exports one at a time, or 6 a year at
    a time if a year fits in one export, which the test will show.
- Earlier on 2026-11-13: D-066 to D-075 (the pipeline stack, the daily run, the archive, the site stack).

## Open pull requests waiting on the user (3)

- **#42** `claude/archive-vin11-postcode` into `main`: say "merge 42". Wanted before NZTA's
  December refresh.
- **#41** `claude/fact-table` into `main`: waits for the answer to question 1.
- **#36** `claude/next-stage-brief` into `ui/explore`: these notes, D-062 to D-077, CLAUDE.md and
  AGENTS.md as they now stand. Say "merge 36".

## Work queue (in order)

1. **The dashboard test export**, one step at a time (the user's yes, D-077). Step 1 is given in
   the session's report: open the dashboard, set Month year to January 2021, and report the
   total it shows. Then the same twelve dimensions as October, exported into
   `data/raw/nzta-dashboard/2021-01/`, timed. Then try the whole of 2021 in one export, with
   "Registration MMM-YYYY" ticked in place of one dimension (choose which once January 2021 shows
   whether every vehicle is ACTIVE there too). Compare January 2021 with the register's survivors
   for that month from the archive file; write the comparison as a maintainer script in
   `scripts/` if the dashboard becomes a source. Report the measured count, time and fit, and ask
   whether it becomes a source.
2. **Watch the first daily runs** (from 14 November, `docs/playbooks/check-monthly-run.md`): each
   should skip, green, with "Source unchanged". Then the first real build, deploy start and
   archive at NZTA's December refresh.
3. **On "merge 42"**: merge it as a merge commit; delete the branch and `../nzta-archive-fields`.
   If NZTA refreshes first, November's archive has 35 fields: pull the 37-field file by hand
   while NZTA still holds November (`python -m pipeline archive --snapshot 2026-11`, D-076).
4. **The fact table (#41), on the user's answer to question 1.** If region comes out: remove it
   from `facts` in `config/pipeline.json`, regenerate the golden deliberately (`UPDATE_GOLDEN=1`,
   the diff shown to the user), re-measure `docs/CUBE_SCHEMA.md`'s figures from a dry run, check
   the Build page still offers what the table carries, and have it reviewed again. With either
   answer, first do the reviewer's follow-ups: compare the table's total with an independent
   count (today it compares two counts of the same table and cannot fail); skip a dataset with
   no `facts` in the golden test; make the manifest example's row count agree with the measured
   one; mark the two claims in `docs/CUBE_SCHEMA.md` the code does not show. Then merge under
   D-068's rule, with the user's word in that session.
5. **Then the deploy, each step asked for:**
   - `ui/explore` into `main`: resolve `README.md` on a branch first (the only conflict).
   - A cube with the fact table: NZTA's December refresh builds one, or a forced run of October
     does (ask).
   - Numbered console steps, all production: a Cloudflare Pages project for Direct Upload named
     `nz-vehicle-registrations`; an API token limited to Cloudflare Pages: Edit; the secrets
     `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment `production`; then the
     switch, the repository variable `CLOUDFLARE_PAGES_PROJECT` (claude sets it with `gh` on the
     user's word). Setting the variable is what makes the site public.
6. **Check `VIN11` against the data** before anything derived from it is defined (D-076): what
   share is a 17-character VIN's first 11, whether the tenth character gives a model year that
   agrees with `vehicle_year` where that is known, and what the eleventh gives. Read the file
   from the private archive into a scratch folder and delete it after.
7. **Read into the docs what NZTA's page gives** (saved in `data/raw/nzta-dashboard/2026-10/`):
   its history of `vehicle_year`, its field definitions, and its make and model cleansing code,
   each resolved against the data (hard rule 6).
8. **Small corrections and follow-ups, none blocking** (the reviewers' claims):
   - The question builder's, listed on #43: a value in a link that is not in the data draws as a
     zero line; the address bar is not rewritten until the first change; a condition with no
     value yet is lost on any other change; and five smaller ones.
   - #42's: say in the playbook that a pull saved for `--from-pull` must take all 38 fields.
   - The freeze wording in four playbooks, two skills, `README.md` and `POST_GATE.md`; each
     `public_copy` entry onto `config/dimensions.json` (D-042); STATE issues 9 and 10.
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
9. **The rest of Stage 1** (the brief §9): About, feedback and "why these figures differ" pages;
   the Stats NZ series (D-065); visitor tests; first load measured on the deployed site.
10. **Stages 2 to 5 of the brief**, each on the user's word. Kept from the old queue:
    `age-distribution-moving-hole`; a visitor name for "Area Outside Region"; a per-capita map.

## Questions for the user

1. **Should the fact table carry the owner's region?** As built, 65% of its rows count one
   vehicle, each with the owner's region beside the model and month. (a) Merge as it is: NZTA
   already publishes each vehicle with its owner's district. (b) Leave region out until the Stage
   2 privacy review; Build then cannot narrow by region or compare regions by number, and the
   region map still draws. (c) A minimum cell size: new design. Recommend (b): publishing cannot
   be taken back, and adding region later is one line. With no answer #41 stays unmerged.
2. **"merge 42" and "merge 36"?** Recommend yes to both. With no answer neither merges, and
   November is archived without the two fields unless pulled by hand.
3. **The dashboard, step 1** (queue item 1): the total it shows for January 2021.

Also the user's (the brief's §12): the `matrix` shape; running cost; the About page; name and domain.

## Prompt for the next session

/start. Read `docs/STATE.md`, this file, and D-076 and D-077 in `docs/DECISIONS.md`. Check first:
what `main` and `ui/explore` are; the newest `Monthly build` runs (daily from 14 November) and
whether NZTA has refreshed; that the private repository's `snapshot-2026-10` still has two files.
Then take the queue in order with the user's answers. Merge into `main` only with a green check,
a reviewer that has not seen your reasoning, and the user's word in the session; if Claude Code
refuses a merge, say so and do not work around it. Do not start a forced run without asking.
