# Master brief: from prototype to the go-to site

> **Repo:** `nickholttt/nzta-analytics-dashboard`. Aligned to `claude/question-builder` at `06d727e`
> (STATE and CHECKPOINT dated 2026-10-22) and `main` at `e3246bb`.
> **Location:** `docs/brief/MASTER_BRIEF.md`. CLAUDE.md names this file (D-062).
> **This replaces every earlier draft of this brief.**
> **Status:** a living document. The user updates §4, §5 and §12 as stages close.

---

## 0. How to use this brief (user notes; agents can skip this section)

1. On a docs branch from the UI stack's head, commit together:
   - this file;
   - the adjusted `CLAUDE.md`;
   - D-062 appended to `docs/DECISIONS.md`;
   - AGENTS.md hard rule 1's "seven" changed to "eight".
2. Open Claude Code in VS Code at the repo root. Lead model: **Fable 5.2, high effort**.
3. First message:

   > /start. Read `docs/brief/MASTER_BRIEF.md` in full. Do Stage 0 only. Change nothing on a frozen
   > path and merge nothing. Stop and report when Stage 0's "done when" is met, with every decision I
   > need to make set out as options and a recommendation.

4. After each stage, read the report, answer its questions, then say which stage is next.

---

## 1. The goal, and how we know we have reached it

**The goal** (CLAUDE.md §The goal): be the place people go for a reliable answer about New Zealand's
vehicle market. One question, one clear answer, the evidence for it, the freedom to dig further.
Nothing on the page that does not bear on the question.

**The frustration this ends.** Today, anyone with a question the published dashboards do not ask
must download the register, clean it, filter it and redraw it, and then do it all again next month.
This site does that work once, for every question, and keeps the answer current.

**One site, two layers, one set of definitions:**

| Layer | For | What it is |
|---|---|---|
| **The stage** (home, latest month, topic pages, Explore) | Anyone | A few well-chosen questions, each answered plainly. It shows what the data can do and invites the next question. |
| **The workbench** (Build) | Analysts, the trade, informed buyers, and anyone whose curiosity outruns the stage | The full engine: any measure, broken down by any field, for any chosen values, under any conditions, over any period. |

Every chart on the stage opens in the workbench. Both read the same data and the same definitions.
Both work on a phone and on a desktop.

**How it is served** (the user's direction, 2026-11-13; CLAUDE.md invariant 6):

- **The stage** reads small precomputed files. It is fast, costs nothing to run, and keeps working
  if anything else is down.
- **The workbench** asks a hosted query service. The browser sends a question and gets back only
  the handful of rows the chart needs, so a phone never downloads a table.
- **The register changes once a month,** so every answer can be kept and reused until the next
  snapshot. The same question asked twice is answered once.

**Where others stop:**

| Place | What it gives | What it leaves out |
|---|---|---|
| MTA vstat | Latest-month counts, year-on-year change, make, model, fuel, buyer type; month/quarter and month/YTD toggles | No filtering, search, comparison, export or shareable view; no region; definitions not stated on the page as read on 2026-11-13 |
| NZTA's own dashboard | Five years of first registrations, exportable, CC BY 4.0 | An analyst's tool; not built for phones; filters, not answers |
| MIA DataHub | The industry's own figures | Not open |
| Autotalk StatsHub | Not verified | The lead confirms in Stage 0 |

**Six measures.** A stage is not finished until the measures it touches are reported.

| Measure | Target | Today |
|---|---|---|
| **Bends** | The acceptance question in §2 and any like it can be asked, drawn, shared and downloaded without leaving the site | Partly: 13 fields, unmerged |
| **Stays current** | A saved question redraws on the newest month with no work from the visitor | Links redraw; nothing is deployed |
| **Answerable** | 4 of 5 people who do not work with data answer each starter question (§2) unaided, in under a minute, and say correctly what the figure counts | Not tested |
| **Fresh** | A new month is live within 2 days of NZTA's refresh | Latest snapshot is September while vstat shows October |
| **Fast** | First answer in under 3 s on the phone profile, on the stage and in the workbench (the user confirms the number) | 6.1 s first chart (STATE known issue 1) |
| **Traceable and neutral** | Every figure one step from its definition, source and snapshot; every sentence from a template; the same rules for every brand | Definitions yes; `/caveats` and `/method` are hand-written |

---

## 2. What visitors ask

**We cannot predict the questions.** So the test of the workbench is not a list of questions. It
is whether a question nobody planned for can be asked.

**The acceptance question** (the user's, 2026-11-13). A stage that touches the workbench is done
only when this draws at 320 px and 1280 px, can be shared as a link, downloads as CSV, and
redraws by itself on the next snapshot:

> Among Ford, Toyota and BYD only, which brand has the most registrations, for one chosen
> powertrain and one chosen vehicle segment?

Then the same question with any field the data map makes public swapped in for powertrain or
segment.

**Starter questions for the stage.** These set the stage; they are not the limit. Each row says
whether the site can answer it today.

| # | A question a visitor may arrive with | Today |
|---|---|---|
| 1 | How many vehicles were registered last month, and is that up or down on a year ago? | Partly: survivors, not registrations |
| 2 | Which brands lead, and who is gaining or losing? | Yes |
| 3 | How is one brand doing, against another? | Yes, in Build (D-060) |
| 4 | What share are electric, plug-in and hybrid vehicles now, and how has that changed? | Yes, once #28 lands |
| 5 | Which models lead? | No: `model-leaderboard` is blocked |
| 6 | Are SUVs taking over from cars? | No: SUVs count as cars (D-003) |
| 7 | Who is buying: households, businesses, rental fleets? | No: `VEHICLE_USAGE` is unbound |
| 8 | Where do used imports come from, and how old are they? | Partly: waits on pair slices (#27) |
| 9 | What is happening in my region? | Partly: Build only, by owner's address |
| 10 | How old is the fleet, and how long do vehicles last? | No: stock and survival are not built |

---

## 3. How every page reads

CLAUDE.md §The goal has the nine rules. What they mean in practice:

- **Answer first.** The top of every view is one generated sentence and one figure. The chart is
  the evidence.
- **Relevance is a rule, not a judgement.** What appears beside an answer is chosen by published,
  config-driven rules, the same for every brand:
  - events: only those whose scope meets the view (`EVENTS_LAYER.md` already does this);
  - statements: ranked by a salience order in config (§8), at most a few;
  - related questions: the next question in the same topic, and the same one a level up or down.
- **The workbench is as wide as the data; each view is as narrow as its question.** Offering
  every field is not showing every field. A view shows only the fields its question names.
- **Caveats shrink.** One line in place, the full form on `/method`. A page never opens with one.
- **The survivors problem is solved in the data, not in the copy** (§7).
- **Never a dead end.** Every view offers "Change this" and one or two next questions.

---

## 4. Where the project stands

From STATE and CHECKPOINT (2026-10-22), `origin/main`, and a read of the branches on 2026-11-13.
The lead confirms each item in Stage 0.

- **The gate.** The 8 October run passed. `origin/main` has **no 2026-10 snapshot commit**, so the
  8 November run skipped or failed. vstat shows October 2026 figures, which suggests NZTA's October
  data is out. The freeze holds until this is resolved.
- **Open pull requests: 19** (#17 to #35; #1 to #16 merged on 2026-10-21).
  - UI stack into `ui/explore`: #17 to #25 and #30 to #34 (14).
  - Pipeline stack into `main`: #26 to #29 and #35 (5).
  - `claude/fact-table`, `claude/look-and-feel` and `claude/question-builder` have no pull request
    recorded in STATE.
  - Every one is unreviewed by the user.
- **Nothing is deployed.**
- **Artifacts expire.** `public-data-2026-08` on **2026-12-10**; `public-data-2026-09` on 2027-01-06.
- **The workbench today.** Build (D-060, D-061) answers questions over a fact table of 13
  dimensions: count or share, chosen values, conditions, a period. It is close to the acceptance
  question already. Two things stand in the way:
  - it is unmerged;
  - D-061 stops chosen values being ranked, which the acceptance question asks for.
- **Fields.** 17 of 40 source fields are bound. The fact table carries counts only. No price
  field exists.
- **Archive grain.** `data/snapshots/` keeps counts by registration month, import status, vehicle
  type, motive power and make. Nothing finer can be recovered for a month once it has passed.
- **Enforcement gaps.** Invariant 1 is scanned in `pipeline/*.py` only. `/caveats` and `/method`
  state figures and brand names by hand.

---

## 5. What we are not doing now

Each item is parked with the condition that brings it back. Do not start one without the user.

| Parked | Why | Comes back when |
|---|---|---|
| Launch RRPs and price bands | Not in the register; costly research, easy to get wrong | The data map and workbench are live and price is still asked for |
| Context series (OCR, CPI, exchange rates, fuel) | Not in the register; invites causal reading | Visitor tests show people ask for it |
| Changing the chart engine | Observable Plot draws all five shapes | A shape cannot meet the design by tokens alone |
| A separate "stories" system | Topic pages and the latest-month page cover it | Those are live and something is still missing |
| More Explore presets | Ten is enough until people have been watched using them | After the first visitor tests |
| Pull-forward and payback estimates | Needs true registrations at detail | The first-observed series has a year of months |
| A large standing agent team | Review is the bottleneck, not build speed (§10) | Never as a default |

No longer parked (the user's direction, 2026-11-13):
- **the full extent of the register** is Stage 2 work, in the order the data map recommends;
- **the workbench is served by a hosted query service.** Which service is chosen in Stage 2, on
  measurements.

---

## 6. The data map (the foundation)

A field cannot be questioned until it is defined. The data map defines every one of the 40 source
fields and every derived field, and the workbench offers only what the map makes public.

**Two forms, one source:** `docs/DATA_MAP.md` for people, and a machine-readable form in config
that Build, the pipeline and the method page all read. Whether that extends
`config/dimensions.json` or is a new file is a decision to propose.

**For every field:**

| Entry | What it records |
|---|---|
| Meaning | A plain definition, checked against the data (AGENTS.md hard rule 6), and its traps |
| Kind | Category, ordered band, number, date or identifier |
| Uses | Break down by; filter by; measure (mean, median, total). A number can be both a measure and, banded, a breakdown |
| Coverage | How often it is filled, by dataset and by period; who it is recorded for (for example NZ-new only) |
| Privacy class | Public; public only above a minimum count; never published (`VIN11`, `CHASSIS7`, `ENGINE_NUMBER`) |
| Relations | See below |

**Relations between fields.** These are what stop a valid-looking question giving a misleading
answer, and what let a curious visitor find the next question.

| Relation | Example | What the workbench does with it |
|---|---|---|
| **Rolls up to** | model → make → parent group → owner country; district → region; body type → vehicle type | Offers drilling up and down; stops a field being crossed with its own parent |
| **Derived from** | segment from vehicle type, body type and gross mass | Says so on the definition line |
| **Recorded only for** | power and model code for NZ-new vehicles | Narrows the question to where the field exists, and says so |
| **Moves together with** | colour and vehicle weight | Measured, not asserted: the strength of association between every pair of public fields, computed each build and published. The workbench shows it as a neutral note and suggests the field to hold fixed. It never says why two fields move together. |

**Order of work:** all 40 fields are profiled and classified first (research, read-only). They
are bound in the order the map review recommends, each with its sentinels and guardrails.

### Which charts fit a question

No field lists its own charts. A list per field would be 40 lists to keep right, and it could not
say what fits when two fields meet. One rule table in config decides it for every field at once,
now and for fields not yet added.

**What the map records per field** (it already has a seed: `shape_hint` and `cardinality` in
`config/dimensions.json`):

| Property | Values | Example |
|---|---|---|
| Kind | category, ordered band, number, time, place | make is a category; age band is ordered; weight is a number; district is a place |
| How many values | few or many (the threshold is config) | powertrain is few; model is many |
| As a measure | can it be averaged, totalled, or only counted | weight can be averaged; colour can only be counted |

**What the rule table does.** It reads the question (the measure, each breakdown's kind, and
whether the question runs over time or looks at one period) and returns the shapes that fit, best
first. The first is drawn. The visitor may switch among the rest (D-059). A shape that does not
fit is never offered, so time can never land on a chart that shows parts of a whole.

| The question is | Fits, best first |
|---|---|
| A share, by a category, over time | `mix` |
| A count or an average, over time | `trend` |
| One period, by a category with many values | `league` |
| One period, by a category with few values | `league`; shares as parts of one bar |
| By an ordered band or a number | `distribution` |
| A share, by a place | `geo`, then `league` |
| Two fields crossed, neither of them time | `matrix` (proposed, below), or small charts side by side |
| Anything | A table of the figures, always |

**Tests:** every combination of measure, kinds and time mode resolves to at least one shape; each
row of the rule table has a fixture.

**A sixth shape is proposed: `matrix`.** Once every field can be crossed with every other, some
questions fit none of the five shapes: brand by segment in one period, or weight against power. A
`matrix` is a grid with one field down the side, one across the top, and a count, share or average
in each cell, shaded. It also draws two numbers against each other, each cut into bands. This
changes AGENTS.md hard rule 1, so it needs the user's explicit approval before any work.

---

## 7. True registrations (the user's direction, 2026-11-13)

Use what is available now; let the detail improve as our own archive grows. Three sources, three
jobs, each labelled for what it is and never mixed on one chart:

| Source | What it is | Detail | Covers | Job |
|---|---|---|---|---|
| **Stats NZ transport series** | True monthly first registrations, new and ex-overseas | Vehicle type and new/used only | January 1961 onward | The headline count; the long-run volume chart; the yardstick for the other two |
| **Registrations as first observed** | Each snapshot's newest months, archived when first seen | Every field | August 2026 onward, growing monthly | The detailed series, going forward |
| **Survivors** (`registrations_surviving`) | Vehicles first registered in a month and still registered | Every field | All history | Detail for the past, with its completeness shown |

- **Completeness is shown, never corrected.** For each month, vehicle type and new/used split,
  survivors ÷ the Stats NZ count says how much of what was registered we can still see. It is
  published beside older figures. No brand or model figure is ever scaled up by it: that would be
  an estimate presented as data (`METRICS.md`, estimation rules).
- **Stats NZ is not a stopgap.** It stays the source of true totals. If it later arrives through
  an API, only the fetch changes. What improves over time is detail, from our own archive.
- **How it is fetched for now:** a maintainer script run by hand from an Infoshare export, as
  `scripts/region-boundaries.mjs` is. This supersedes the 2026-10-22 choice to wait for the Data
  Explorer; record it as a decision by the user. The lead confirms Stats NZ's licence terms and
  the series' latest month before building.
- **Headline views default to where the data reads as registrations**, and say so in one line.

---

## 8. The narrative engine (outline for `docs/NARRATIVE.md`)

- **Facts** are computed per shape, never per value: latest value, change on a year ago (percentage
  points for shares), rank and rank change, leader, largest riser and faller, record high or low
  within valid history, new entrant to the top N.
- **Guards travel with facts:** both share guards, coverage, the dataset's grain, any
  `measurement` event in the window. A guarded fact produces no sentence.
- **Salience** decides which few facts are said, by an order in config. The order is published on
  `/method` and is the same for every value.
- **Phrase sets** live in `config/narrative/`: ordered variants per fact type, each a condition
  and a template. First match wins. Movement verbs map to magnitude bands in config.
- **Banned words** are a linted list: causal ("because", "due to", "driven by") and judgement
  ("soared", "dominated", "best").
- **Events are placed, never linked:** "{event.title} took effect in {month}."
- **It works on any workbench question,** not only presets: the facts come from the result, so an
  unplanned question still gets its sentence.
- **Failure:** an unresolved placeholder or no matching variant drops the sentence on the public
  site and reports it on `/status`.
- **Tests:** no domain value, digit or year in any template; every placeholder resolves; a golden
  render per variant; every live preset rendered against both committed snapshots and diffed.

---

## 9. The plan

Six stages. Each ends in a stop-and-report (AGENTS.md hard rule 8). Frozen-path work follows D-043
until the gate passes. The user merges; the lead never merges.

### Stage 0: land and protect (days, not weeks)

Read-only, apart from the docs commit in §0.

1. **The 8 November run.** `docs/playbooks/check-monthly-run.md`. Report triggered-by, built or
   skipped, committed or not. If it skipped and NZTA has since refreshed, ask the user for a
   dispatch; do not dispatch.
2. **Artifacts.** Give the user the exact commands to download `public-data-2026-08` and
   `public-data-2026-09`, and ask where the August raw pull should be copied.
3. **Measure how much a month moves after it is first seen.** From the two committed aggregates:
   August 2026 as counted in the 2026-08 snapshot against the same month in the 2026-09 snapshot,
   by import status and by make. Scratch folder only.
4. **Propose the archive decision** (status proposed), with measured sizes:
   - (a) each run archives the newest few months at every field: registrations as first observed;
   - (b) widen the whole-snapshot aggregate for survival by model, region and segment;
   - (c) keep the raw bound columns of each pull as a release asset.

   The aim is a decision before the **8 December** run. Every month at today's grain is lost.
5. **Propose a retry window** for the monthly run (for example daily from the 3rd to the 14th).
6. **Stats NZ.** Confirm the series, its latest month and its licence on Infoshare. Draft the
   decision in §7 for the user to accept. Also read and report, without building: NZTA's
   "Additions to the national vehicle fleet" and "Existing fleet" extracts (still published? in
   what form? what licence?).
7. **Start the data map** (§6): a first pass over all 40 fields from the saved August pull.
   Research only; nothing is bound.
8. **Read vstat and StatsHub** as a visitor would, against §2. One page of notes.

**Done when:** items 1 to 8 are reported, three decisions are proposed (archive, retry window,
Stats NZ), and the user has the artifact commands.

### Stage 1: ship what exists

The point is a public site. Nothing new is built except items 3 and 4.

1. **Merge support.** Follow CHECKPOINT items 2 to 4. Open pull requests for `claude/fact-table`
   and `claude/question-builder`. For each pull request give the user five lines: what it does,
   what to look at, what could go wrong.
2. **Deploy** (CHECKPOINT item 6), once the user answers question 1 there.
3. **Three small pages:**
   - **About:** who runs it, that it is a personal project, any connection the author has to the
     motor industry, no affiliation with NZTA, MIA or MTA, the CC BY 4.0 attribution;
   - **feedback and corrections** (GitHub issues is enough), with a public corrections log;
   - **"Why these figures differ from others":** registrations are not sales; survivors are not
     registrations; MIA counts differently.
4. **The Stats NZ series** (§7; CLAUDE.md build step 1b): the headline count and the completeness
   figures.
5. **Visitor tests** (`docs/playbooks/visitor-test.md`), with §2's starter questions and the
   acceptance question.
6. **First load** measured on the deployed site, and the cheapest fix made.

**Done when:** a public URL serves Explore and Build from a monthly run's cube, and the measures
have their first real numbers.

### Stage 2: the map and the engine

1. **Finish the data map** (§6): every field defined, classified and related. The user approves
   the privacy classes.
2. **Choose and build the query service** (CLAUDE.md invariant 6). Propose it as a decision, on
   measurements, before building:
   - **The question format.** The browser sends a structured question: measure, breakdowns,
     chosen values, conditions, period, snapshot. Never SQL. It is the same shape Build already
     keeps in the address bar (D-060), so a link, a saved question and a request are one thing.
   - **What the service checks.** Every field against the data map's public list; the
     minimum-count rule for fields that have one; a limit on how much one question may ask for.
   - **What it returns.** The rows the chart needs, with the definitions, caveats, snapshot and
     suppression flags that apply.
   - **Keeping answers.** Each answer is stored against its question and snapshot, and served
     from that store until the next snapshot.
   - **Candidates to measure** from a dry run of the saved August pull: at least two ways of
     hosting a query engine over the monthly Parquet files. For each, report first answer and
     repeat answer on the phone profile and a desktop for questions naming 3, 5 and 8 fields; the
     wait after a quiet spell; monthly cost; what the monthly refresh takes; what happens when it
     is down.
   - **The seam.** The service sits behind `src/lib/data.ts`. Build keeps working from the
     precomputed fact table until the service passes the acceptance question, then switches.
   - **Failure.** If the service is down, the stage still works and the workbench says so plainly.
3. **Bind the fields** in the map's order, each with its guardrails.
4. **Numbers as measures.** Means from a sum and a count per cell, as fuel consumption already is
   (`fc_sum`, `fc_n`); medians from bands. No median is computed from a mean.
5. **Workbench features:**
   - **rank chosen values** (decided, D-062): the chart says "ranked among the N you picked" and
     offers the same ranking over every value in one step;
   - **the chart rules** (§6): the rule table, its tests, and the shape switch reading from it;
   - **a second breakdown** (for example brand by segment): the `matrix` shape if the user
     approves it, otherwise small charts side by side or a table;
   - **conditions on any number of fields**, each shown as a removable line;
   - **"My questions":** saved in the browser, no account, each redrawing on the newest month, each
     able to be pinned to a snapshot, the list exportable as links;
   - **the related-fields note** from the map.

**Done when:** the acceptance question in §2 passes, with a field bound in this stage swapped in.

### Stage 3: the stage

1. **Labels as data.** One display label for every value people see (STATE known issue 2).
2. **Narrative engine** (§8): write `docs/NARRATIVE.md`, propose it, build it. Move `/caveats`
   and `/method` figures onto it.
3. **Topic pages:** a page per brand, model, powertrain, segment and region, each from a config
   template of questions with a hole for the value. The code knows no brand (invariant 1). Three
   to five charts at most; events scoped to the value; links a level up and down; "Change this"
   into the workbench.
4. **Latest month:** one generated page that answers starter question 1 and names the largest
   movers.
5. **Search:** one box that finds any value of any field and opens its topic page.
6. **Home page:** the search box, the latest-month headline, the starter questions.
7. **Design direction.** Two directions as screenshots at 320 px and 1280 px with first-load
   figures. Tokens and layout only. shadcn's charts are the style reference. The user picks.

**Done when:** visitor tests are re-run and starter questions 1 to 4 meet the Answerable target.

### Stage 4: what the industry expects

1. **SUVs:** `model_segment.csv`, keyed on canonical make and model. The user approves the
   scheme first. Fill in volume order; live only above its coverage threshold.
2. **Models:** the model leaderboard where the data reads as registrations.
3. **Registrations as first observed**, as a dataset, from Stage 0's archive.
4. **Heavy vehicles and motorcycles** as their own topic areas with their own defaults.
5. **Fleet, age and survival:** CLAUDE.md build order steps 7 and 8.

**Done when:** every row in §2 reads "Yes", or has a stated reason it cannot.

### Stage 5: trust and reach

1. **"What changed":** how a figure moved between snapshots.
2. **Cite and reuse:** copy-ready citation, chart image, CSV with attribution, an embed snippet.
3. **Glossary:** one plain definition per term, generated from the data map.
4. **The `src/` invariant scan** and the template lints, so invariants 1 and 8 are enforced.

---

## 10. Working rules

- **Process.** AGENTS.md's read order and nine hard rules bind. Decisions go in
  `docs/DECISIONS.md`, state in `docs/STATE.md`, the queue in `docs/CHECKPOINT.md`.
- **Review is the bottleneck.** Until the user says otherwise: **no more than five pull requests
  waiting on the user at once**, each with the five-line summary from Stage 1.
- **Measure before proposing**, in a scratch folder, as D-058 did.
- **Sub-agents** (CLAUDE.md §Sub-agents):
  - only the lead spawns;
  - every definition and every ad-hoc spawn names its model; never `inherit`;
  - the check for this is built under D-043, because `checks.yml` is on a frozen path;
  - a reviewer that has not seen the work reviews it before every stop (D-057, D-061).

| Stage | Sub-agents worth using | Model |
|---|---|---|
| 0 | run-checker; source-scout; landscape-reader | sonnet |
| 0 | archive-architect | opus |
| 0, 2 | field-profilers, one per group of related fields | sonnet |
| 2 | data-map editor (relations, privacy classes); engine-measurer | opus |
| 2, 3 | builders for the workbench and the pages | sonnet |
| 3 | narrative-architect; design-director | opus |
| 4 | segmentation-designer; mapping-reviewer | opus |
| 4 | segment-assigner (batches of nameplates) | sonnet, or haiku for exact matching |
| every stop | independent reviewer | opus; Fable 5.2 for contract or invariant changes |

Lead: Fable 5.2 at high effort; xhigh or max for the archive, data-map, engine and narrative
proposals.

---

## 11. Always stop and ask the user when

- anything under AGENTS.md hard rules 1 to 9 would change;
- something cannot be undone, or touches snapshots, history or anything public;
- a definition change would alter figures already shown;
- a field's privacy class is in doubt;
- wording comes near causation, or touches politics beyond dates and facts;
- there is a cost, licence or conflicting-source question;
- work would start on anything in §5.

---

## 12. Questions for the user

Settled on 2026-11-13: chosen values may be ranked (D-062); the workbench is served by a hosted
query service; "related fields" means measured association shown as a neutral note; true totals
come from Stats NZ now (§7).

Still open:

1. **A sixth shape, `matrix`** (§6): approve it, or keep to five shapes and use small charts and
   tables for crossed fields?
2. **Running cost:** what monthly cost is acceptable for the query service? Stage 2 reports the
   real figures.
3. **Pull requests:** is a limit of five waiting at once acceptable?
4. **About page:** what should it say about you and any industry connection?
5. **Name and domain.**
