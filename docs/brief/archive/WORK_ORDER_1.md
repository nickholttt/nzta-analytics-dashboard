/start

# Work order 1: the big push

This message is a standing work order. Carry it out across as many sessions as it takes, without
stopping to ask me step by step. Save this whole message, unchanged, as
`docs/brief/WORK_ORDER.md` in your first commit, so later sessions can read it.

Explain everything you report to me in plain words. I do not follow the technical detail.

---

## 1. How to work from now on

1. **Do not stop for questions.** Where a choice is needed and it is not on the "never without
   asking" list (§3), take your own recommendation, record it as a decision marked "decided by
   Claude (unreviewed)", and keep going. List every such choice in the final report.
2. **A blocked item never stops the rest.** If something needs me, park it, write it in
   `docs/CHECKPOINT.md` under "Questions for the user" with your recommendation and what happens
   with no answer, and move to the next package.
3. **One report, at the end.** Stop and report only when every package below is done or parked.
   A short progress line at the end of each session is enough until then.
4. **Sessions.** When a session runs long, `/wrap`, and write the next session's prompt. I will
   start the next one with the short "continue" message at the bottom of this order.
5. **Work in parallel.** Use sub-agents for independent packages. Only you spawn them. Every
   sub-agent names its model explicitly; never `inherit`. Create the `.claude/agents/`
   definitions and the check that enforces this now (CLAUDE.md marks both as planned).
   - haiku: bulk, rule-like work.
   - sonnet: research, data engineering, page building, most code.
   - opus: definitions, the data map, segmentation, the narrative spec, design, every
     independent review.
6. **Quality bar for every pull request:**
   - small, one purpose, tests added or updated;
   - a golden contract change is one per commit, with the reason;
   - a reviewer sub-agent that has not seen your reasoning agrees before merge;
   - a change to what the browser downloads is measured at phone width before and after;
   - pages checked headless at 390 and 1280 px, axe clean;
   - CLAUDE.md's eight invariants hold. Nothing domain-specific in code.
7. **Nothing is public yet,** so definitions, names and layouts may still change freely. Record
   each change; do not treat today's figures as published.

---

## 2. What you may do without asking again

Record this section as a decision. It amends AGENTS.md hard rule 7 for the life of this work
order, and I approve that amendment here.

- **Merge into `main`.** You may merge any pull request that belongs to this work order into
  `main`, as a merge commit, when all of these hold: its checks are green; an independent
  reviewer agrees; it is inside the packages in §5; and it touches nothing on the list in §3.
  I am saying so in this message, in this session.
  - If Claude Code's own permission check still refuses a merge, do not work around it. Leave
    the pull request open, build the next package on a branch stacked on top of it, and carry
    on. Give me one line in the report, such as "merge 51, 52, 53", and I will say it.
- **Merge 47.** Delete `ui/explore` on GitHub. Leave the old commits as they are; do not rewrite
  history.
- **One forced run of October**, once, only if the most recent daily run reports the source
  unchanged. Read that run first. If NZTA has changed the register, do not force; wait for
  December's refresh.
- **Hand pulls.** Pull November by hand if the archive job has not stored it within two days of
  NZTA's December refresh.
- **Create, change and delete branches and pull requests of your own.**
- **Run anything read-only** against NZTA's open data service, Stats NZ's Infoshare and the
  private archive.

---

## 3. Never without asking me

Park these; do not do them.

- Anything that makes the site public (the Cloudflare switch) or publishes a new kind of data.
- Anything that costs money or creates an account.
- Anything that cannot be undone: deleting data, rewriting history, replacing an archived file.
- Publishing an owner field (district, region, usage, industry class, owner type), postcode, or
  anything derived from `VIN11`. Building and testing them privately is allowed.
- Changing CLAUDE.md's invariants, non-goals or the shapes, beyond what this order states.
- Working around NZTA's block on automated readers from your side. The dashboard is read only
  from files I give you (§4).
- A second forced run.

---

## 4. My answers to the open questions

Treat each as decided by me.

1. **A sixth shape, `matrix`: approved.** A grid with one field down the side, one across the
   top, and a shaded count, share or average in each cell. Update CLAUDE.md's Shapes section
   and AGENTS.md hard rule 1 to say six, and record it.
2. **NZTA's registrations dashboard becomes a source** for registrations from January 2021
   (D-075 option 3). The test passed:
   - January 2021 exported whole: 17,221 rows, 30,011 vehicles, the same total the dashboard
     shows. It includes 2,970 vehicles now INACTIVE, so the history holds vehicles since
     removed.
   - By import status: NEW 18,082; USED 10,542; RE-REG 1,217; SCRATCH 170. By owner type:
     Individual 18,863; Company 10,737; Other 411.
   - The file is `nzta-first-registrations-2021-01.csv` in my Downloads folder. Move it to
     `data/raw/nzta-dashboard/2021-01/`.
   - **How it is fetched:** Claude in my Chrome browser (a claude.ai session, not you) reads
     the dashboard's own data engine and saves a CSV. It is a long table: one row per
     combination, a "Vehicles" count column, and the same twelve dimensions as October. No
     pivot. `VIN - first 11` and `Physical post code` are not taken.
   - **The full history is downloaded:** `nzta-first-registrations-2021-01_to_2026-10.csv` in
     my Downloads folder, taken on 14 November 2026. Move it to
     `data/raw/nzta-dashboard/history/` and copy it to my backup folder.
     - 70 months, January 2021 to October 2026; 991,274 rows; 1,883,786 vehicles;
       133,320,124 bytes.
     - Columns: `Registration month` (text such as "Jan 2021"), then the twelve dimensions,
       then `Vehicles`.
     - Vehicles by year, to check it against: 2021 370,014; 2022 355,210; 2023 332,105;
       2024 290,504; 2025 282,525; 2026 (to October) 253,428.
     - It was taken as six yearly exports joined into one file, because the dashboard's engine
       cuts an export off at 5,000,000 cells. Each year's rows and total matched the engine's
       own count, with no warning.
     - If the file is not there, build B against January 2021 and October 2026 and park the
       rest.
   - Each month from now on, the same export is taken for the newest month.
   - Record the method in `docs/DATA_SOURCES.md` §D, replacing "never build a dependency".
3. **True totals before 2021 come from Stats NZ** by hand export (D-065, already accepted).
4. **The limit of five pull requests waiting on me is replaced** by §2: you merge under the
   rule, or give me one batch line.
5. **The About page, the site's name and the domain are not decided.** Draft the About page
   with clear placeholders, propose five names, and park both.
6. **Going public is not part of this order.** Prepare everything up to the Cloudflare switch
   and park the switch.

---

## 5. The packages, in order

Work down the list. Packages marked (parallel) can run beside the one before. Each has a "done
when". `docs/brief/MASTER_BRIEF.md` has the detail for each; where this order and the brief
differ, this order wins, and you update the brief to match.

### A. Start-up checks and housekeeping
- Read STATE and CHECKPOINT. Check: whether #47 is merged; what the daily runs since
  14 November said; whether any forced run happened; that the private archive still holds
  October's two files; that the Cloudflare variable is unset.
- Do the §2 items: merge 47, delete `ui/explore`, the forced October run if its condition holds.
- Clear CHECKPOINT item 5's small follow-ups in two or three pull requests.
- **Done when:** `main` carries the reworded rules, a cube with the fact table exists or is
  waiting on December, and the follow-up list is empty or each item has a reason to stay.

### B. True registrations since 2021, from the dashboard (the most valuable package)
- Read the dashboard files. Check each adds up to the dashboard's own monthly totals.
- Compare January 2021 and October 2026 with the register's survivors for those months, from
  the archive: by import status, vehicle type and make. Report what the history adds.
- Define the dataset in `docs/METRICS.md` and the data map: what it counts, that past months
  can change, that it includes some re-registrations, and what "Vehicle Status" means.
- Build it as its own dataset (CLAUDE.md build step 1b's detail), with guardrails: every month
  present, totals match, no month replaced silently. A maintainer script checks and converts
  each file I supply. It is never fetched by the pipeline.
- Owner type stays private until the Stage 2 privacy review (§3).
- Add completeness: for each month since January 2021, survivors as a share of registrations,
  by vehicle type and import status. Shown, never used to scale a figure.
- A flow series never shares a chart with survivors.
- **Done when:** the site can answer "how many vehicles were registered last month, and is that
  up or down on a year ago" from true registrations, by make and model, for any month since
  January 2021, on a local build.

### C. Stats NZ's long-run series (parallel)
- D-065 as accepted: the maintainer script, the file's home, the dataset, the long-run volume
  chart, and completeness for cars from July 1975.
- If the hand export is not on disk, write the script and the steps I follow, and park the data.
- **Done when:** a local build draws registrations back to 1961 for cars, with Stats NZ's
  attribution beside NZTA's.

### D. The rest of Stage 1 (parallel)
- Three pages: About (draft with placeholders), feedback and corrections with a public
  corrections log, and "why these figures differ from others".
- First load: measure at phone width on a production build, make the cheapest fix, measure
  again. Target: first answer under 3 seconds.
- Update `docs/playbooks/visitor-test.md` with the brief's starter questions and the acceptance
  question, ready for me to run.
- Prepare the Cloudflare steps as a numbered list for me, one click each. Do not start them.
- **Done when:** everything in Stage 1 is built except what needs me.

### E. The data map, finished (the foundation for everything after)
- All 40 register fields and every dashboard field: meaning checked against the data, kind,
  how many values, uses (break down by, filter by, measure), coverage by dataset and period,
  who it is recorded for, sentinels, traps.
- Settle the open trap: do `VEHICLE_USAGE` and `INDUSTRY_CLASS` describe the vehicle at first
  registration or today? Use the dashboard's history against the register.
- Privacy class for every field, as a proposal for me. Until I approve, owner fields are built
  privately and not published.
- Relations: rolls up to; derived from; recorded only for; follows a vehicle over time; and
  **moves together with**, measured between every pair of public fields from the archive file
  and written out each build.
- The machine-readable form in config, read by Build, the pipeline and the method page.
- **The chart rules:** one rule table in config that returns the shapes that fit a question,
  best first, from each field's kind and number of values. No field lists its own charts.
  Tests: every combination resolves to at least one shape; a table of figures always fits.
- **Done when:** `docs/DATA_MAP.md` is complete, the config form exists with schema tests, and
  Build's shape choice reads the rule table.

### F. The full engine: more fields, and a workbench that bends
- Bind fields in the map's order, each with its sentinels and guards, as fact-table columns
  and slices: first the ones every vehicle has (colour, seats, where assembled, class), then
  the NZ-new-only ones (power, transmission), then the rest. Owner fields are bound but kept
  out of published files.
- Numbers as measures: averages from a sum and a count per cell, as fuel consumption already
  is; medians from bands.
- Workbench features:
  - rank chosen values, labelled "ranked among the N you picked", with the full ranking one
    step away (D-062);
  - a second breakdown, drawn as the `matrix` shape;
  - any number of conditions, each a removable line;
  - "My questions": saved in the browser, no account, each redrawing on the newest month, each
    able to be pinned to a snapshot;
  - the related-fields note from the data map;
  - CSV of exactly what is on screen, with attribution.
- **The acceptance question must pass** at 390 and 1280 px, as a shareable link, with a CSV:
  "Among Ford, Toyota and BYD only, which brand has the most registrations, for one chosen
  powertrain and one chosen vehicle segment?" Then again with a field bound in this package
  swapped in.
- **Done when:** the acceptance question passes both ways on a local build.

### G. The query service: measure and propose only (parallel with F)
- Write the question format (it is the address-bar form Build already uses) and what a service
  must check and return.
- Build a local prototype behind `src/lib/data.ts`. Measure first and repeat answers for
  questions naming 3, 5 and 8 fields, at phone and desktop width, against today's static files.
- Compare at least two ways of hosting it: monthly cost, cold starts, the monthly refresh,
  what happens when it is down.
- Propose one. Provision nothing. This is a parked decision for me, with real figures.
- **Done when:** the proposal is written and the prototype runs locally.

### H. Answers for everyone: labels, words, topic pages
- Labels as data: one display label for every value people see.
- The narrative engine (CLAUDE.md invariant 8): write `docs/NARRATIVE.md`, then build it for
  `mix`, `trend`, `league` and `matrix`. Facts per shape, guards on every fact, a published
  salience order, phrase sets in config, a banned-word list, and the tests the brief lists.
  Move `/method` and `/caveats` onto it so they stop going stale.
- Topic pages from a config template: one per brand, model, powertrain, segment and region.
  Three to five charts at most, events scoped to the value, links a level up and down.
- A latest-month page, fully generated.
- Search: one box that finds any value of any field.
- A home page: the search box, the latest-month headline, the starter questions.
- Design: produce two directions as screenshots at 390 and 1280 px with first-load figures.
  Tokens and layout only; Observable Plot stays; shadcn's charts are the style reference. Build
  with the calmer one and park the choice for me.
- **Done when:** a non-analyst could answer the brief's starter questions 1 to 4 from the home
  page on a local build, and no sentence about the data is hand-written.

### I. What the industry expects
- SUVs: propose a model-level segment scheme (names, boundaries, rules), then assign the
  nameplates covering 95% of recent volume, each with basis and confidence, reviewed by a
  second agent. Build it as a coverage-guarded dimension on a branch. It goes live only when I
  approve the scheme.
- Models: the model leaderboard on true registrations since 2021.
- Heavy vehicles and motorcycles as their own topic areas with their own defaults.
- The fleet: stock, age and survival (CLAUDE.md build steps 7 and 8), using the archive.
- **Done when:** every starter question in the brief reads "Yes" on a local build, or has a
  stated reason it cannot.

---

## 6. The final report

One message, plain words, in this order:

1. What a visitor can now do that they could not before, in a few lines.
2. What was built, package by package, with "done" or "parked and why".
3. **Decided for you:** every choice you made on my behalf, numbered, one line each.
4. **Need you:** numbered. Each with options, your recommendation, and what happens with no
   answer. Put the merge batch line first if there is one.
5. The measures from the brief §1, with real numbers.
6. Update `docs/brief/MASTER_BRIEF.md` (§4 and §12), STATE and CHECKPOINT to match.

---

## 7. The "continue" message for later sessions

I will start each later session with this:

> /start. Continue `docs/brief/WORK_ORDER.md` from where CHECKPOINT says. Its §2 still stands:
> you may merge this work order's pull requests into `main` in this session when checks are
> green and an independent reviewer agrees, and nothing in its §3 is touched. Do not stop for
> questions; park what needs me and keep going.
