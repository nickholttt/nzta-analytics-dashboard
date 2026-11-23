/start

# Work order 2: lean process, the canvas, then go-public readiness

This replaces work order 1. Save this message, unchanged, as `docs/brief/WORK_ORDER.md`, and
move the old one to `docs/brief/archive/WORK_ORDER_1.md`, in your first commit.

**Why it exists:** two-thirds of the commits since 14 November changed only notes. Tests grew to
twice the size of the code, and every change went through a review agent and a decision
record. The engine is good enough. From now on, effort goes into what a visitor can see.

Explain what you report to me in plain words.

---

## 1. The engine is frozen for features

The engine already has what the canvas needs: the fact table and slices, the data map, the
chart rule table, saved and pinned questions, the small-cell rules, true registrations and
Stats NZ.

**Allowed engine work, and only this:**
- fixing a bug, or a figure that is wrong;
- handling NZTA's December refresh: November's build, the archive, the dashboard usage-column
  check and change tracking as already queued, and fixing anything the refresh breaks;
- something the canvas cannot work without (say why in the pull request);
- converting the retaken dashboard history, if it arrives in my Downloads folder.

**Parked until I say otherwise:** colour's own table; more SUV slices and sizes; further hybrid
work; new segment schemes; new fields; the query service; new datasets; new privacy tables.
Leave each in CHECKPOINT's "Parked" list, in one line.

---

## 2. Process rules (these replace the old ones)

1. **Decision records:** write one only when an invariant, the data contract, a published
   figure or privacy changes, or when I need to see the choice. Everything else is one line in
   the pull request description.
2. **Reviews, by risk:**
   - **High risk** (pipeline code, data contract, published files, privacy, workflows,
     anything touching `main`'s data): one independent reviewer, briefed with the change and
     three to five things to test. One round. A fix gets a narrow re-check of that finding only.
   - **Low risk** (site, canvas, copy, docs): no reviewer agent. The checks must pass:
     typecheck, build, the tests that exist, axe clean, and screenshots at 390 and 1280 px that
     you look at yourself.
   - **Docs only:** merge when the checks pass.
3. **Tests:** add tests only for data correctness, privacy, the data contract, and the canvas's
   own logic (field to chart-type mapping, a saved canvas link loading back exactly). No golden
   or snapshot tests of UI defaults, colours or layouts. You may delete an existing test that
   only pins a cosmetic default when it blocks canvas work; say so in the pull request.
4. **Notes, once per session:** update STATE and CHECKPOINT at the end of a session only, never
   after each pull request. Keep CHECKPOINT under 80 lines and STATE under 100. The session
   report is the summary; do not also write it into a stage report file.
5. **Decisions file:** move D-001 to D-140 unchanged to `docs/decisions/archive-001-140.md`.
   The new `docs/DECISIONS.md` opens with an index (one line per archived decision: number,
   date, title) and then new records only. Change AGENTS.md's read order so a session reads
   the index, and opens an archived record only when the work touches it. I approve this
   reorganisation of an append-only file.
6. **Models:** lead on Opus at high effort. Sub-agents default to sonnet. Use haiku for bulk,
   rule-like work, and opus only for the high-risk reviews and the canvas's interaction design.
   At most three sub-agents at once. Every definition still names its model; never `inherit`.
7. **Sessions:** keep them short. `/wrap` after about two milestone steps, or when the session
   is long. Do not re-read whole docs at the start; read STATE, CHECKPOINT, this order and only
   what the next step touches.
8. **Update CLAUDE.md and AGENTS.md** to carry rules 1 to 7, in one small pull request.

---

## 3. What you may do without asking

I am saying these in this message, in this session.

- **Merge into `main`**, as a merge commit, when all of these hold:
  - the checks are green and finished;
  - the review rule in §2 for its risk is met;
  - it is inside this work order;
  - it touches nothing in §4.
- **If Claude Code's permission check refuses a merge,** do not work around it. Stack the next
  work on top, and give me one line at the end, such as "merge 104, 105".
- **Create and delete your own branches** and pull requests.
- **Run anything read-only** against NZTA's open data service, Stats NZ's Infoshare and the
  private archive.
- **One forced run of November,** only if the December refresh's build fails for a reason you
  have fixed, and only once.

## 4. Never without asking

Park these; do not do them.

- Anything public: the Cloudflare switch, the repository's visibility, a new kind of data in
  a release.
- Anything that costs money or creates an account.
- Anything that cannot be undone: deleting data, rewriting history, replacing an archived file.
- Publishing an owner field beyond the "Current use" table, postcode, or anything derived from
  `VIN11`.
- Changing CLAUDE.md's invariants beyond what §5 approves.

---

## 5. Milestone 1: the canvas (D-138)

**The aim:** a visitor builds their own page of charts by dragging fields, Power BI-style, from
everything the data map makes public. The site never decides what they look at.

**CLAUDE.md changes I approve for the canvas page.** Make them in one pull request with the
exact wording:
- A canvas page may hold several charts the visitor adds, arranges and removes. "One question
  per view" applies to each chart, not the page.
- The visitor chooses the chart type, from the types the rule table says fit. A chart that
  does not fit is shown greyed with a one-line reason, never drawn.
- These still hold:
  - the browser never sees a vehicle row;
  - the small-cell rules;
  - every sentence about the data comes from a template;
  - every figure is one step from its definition, source and snapshot;
  - a flow series never shares a chart with survivors.

**What the canvas does:**
1. **A field list** read from the data map's config, grouped (vehicle, origin, powertrain,
   time, place, current use) and searchable. Each field shows its one-line definition on hover
   or tap.
2. **Drop zones per chart:**
   - the measure (count, share, average where a number allows);
   - the main breakdown (axis or rows);
   - a second breakdown (series, colour or columns);
   - filters (any number, each removable);
   - the period;
   - the dataset (true registrations, still registered, current fleet).

   Dragging a field onto a zone it can't go in shows why.
3. **A chart-type picker** from the rule table, best fit first, with a table of figures always
   available. Use the six existing renderers. Add a chart type only if a common question
   cannot be drawn without it, and record that.
4. **The page:** add a chart, duplicate it, remove it, reorder by dragging, and choose one of
   two widths (half or full). On a phone the charts stack in one column, and "tap to add"
   replaces dragging.
5. **One generated sentence under each chart** from the phrase templates, and the source and
   snapshot line.
6. **Save and share:** the whole canvas lives in the link. "My canvases" are kept in the
   browser, each pinnable to a snapshot, the same as saved questions. Each chart offers CSV
   download with attribution.
7. **Starter canvases:** turn Explore's questions into three or four ready-made canvases a
   visitor can open and change. Explore's page becomes the list of them.
8. **The look:** calm and editorial, with shadcn's charts as the style reference, light and
   dark. Use shadcn/ui components for the controls if they fit the Astro React islands. Pick
   one direction yourself and keep it consistent; I will react to screenshots.
9. **Speed:** the canvas loads only the fact-table columns its charts use. Measure the first
   chart at phone width and report it.

**Build order:**
1. One chart with drop zones.
2. The chart-type picker.
3. Several charts.
4. Save and share.
5. Starter canvases.
6. Polish.

Merge as you go under §3.

**Done when** all of these are true on a local build:
- I can open the canvas on a phone and a desktop;
- I can build my question ("Among Ford, Toyota and BYD only, which brand has the most
  registrations, for one powertrain and one segment?") by dragging;
- I can add two more charts beside it, save the page as a link, open that link in a new
  window and see the same page;
- the screenshots are in the report.

---

## 6. Milestone 2: ready to go public (stop before the switch)

1. The About page, "why these figures differ" and feedback pages linked from the canvas, with
   the `TO DECIDE` gaps still marked.
2. `docs/playbooks/go-public.md` checked and reduced to numbered clicks for me: the Cloudflare
   project, the token, the two secrets, the switch.
3. A private dry run: a production build served locally, first load measured, every page
   checked at 390 and 1280 px.
4. **Done when** the only things left are mine: the name, the web address, the About gaps, and
   the Cloudflare clicks.

---

## 7. Reporting

- At the end of each session: five lines at most. What a visitor can now do, what is merged,
  what is next.
- At the end of each milestone: screenshots, the "done when" checked line by line, anything
  parked for me with your recommendation, and the merge line if there is one.
- No stage report files.

---

## 8. The "continue" message for later sessions

> /start. Continue `docs/brief/WORK_ORDER.md` (work order 2) from CHECKPOINT. Its §3 still
> stands: you may merge its pull requests into `main` in this session under its §2 and §3, and
> nothing in its §4 is touched. Do not stop for questions; park what needs me and keep going.
