/start

# Work order 3: finish the canvas, guard the figures, get ready to go public

This replaces work order 2 and keeps its process rules. Save this message, unchanged, as
`docs/brief/WORK_ORDER.md`, and move work order 2 to `docs/brief/archive/WORK_ORDER_2.md`, in
your first commit. Explain what you report to me in plain words.

**Target date:** public-ready by **12 December 2026**. That means everything done except the
four things only I can do: the name, the web address, the About gaps and the Cloudflare
clicks. NZTA's December refresh lands before then, and the site should go out with
November's figures.

---

## 1. What carries over from work order 2

- §1: the engine stays frozen for features. December's refresh and bug fixes are allowed.
- §2: the lean process rules (reviews by risk, tests only for data, privacy, contract and
  canvas logic, notes once per session, models, short sessions).
- §3: what you may do without asking, including merging into `main` under those rules. I am
  saying so in this message.
- §4: never without asking.

---

## 2. Work in parallel lanes

Run up to four lanes at once, each on its own branch and worktree, with sub-agents on sonnet
unless a lane says otherwise. You are the integrator: you merge, you resolve conflicts, and
no two lanes edit the same file in the same session.

At the top of `docs/CHECKPOINT.md`, keep a "Lanes" table: lane, branch, who holds it (this
session, or "cloud session" with its date), status. A session takes only a lane that is free
or its own. This lets a cloud session started from my phone and a session on my computer
work at the same time without colliding.

### Lane A: finish the canvas (milestone 1, steps 5 and 6)

1. **Starter canvases:** Explore's groups as three or four canvases in config. Explore's page
   becomes the list of them.
2. **One generated sentence under every chart,** from the phrase templates. That includes
   lines, bands and the map; a ranking and a grid move theirs under the chart too.
3. **Fold Build into the canvas** (I approve). A Build link opens as a canvas of one chart.
   "My questions" become canvases. Keep old Build links working. Remove Build's page once
   every link redirects.
4. **Dark mode,** checked on real chart colours.
5. **First load:** target 3 s for the first chart on the throttled phone profile.
   - Fonts are 169 KB: subset them or use the system font stack.
   - Code is 306 KB: split the canvas editor from the chart renderer, so a shared link draws
     before the editor loads.
   - Report before and after.

**Done when** milestone 1's "done when" is met, and the first chart draws in under 3 s, or
you have stated exactly what remains and why.

### Lane B: the accuracy guard (this is the trust case)

Every month, our figures are set beside published ones automatically, and any gap is caught
before a visitor sees it.

1. **`data/reference/published_figures.csv`**, one row per published figure, with:
   - source (MIA, MTA vstat, Stats NZ, or NZTA's dashboard);
   - its URL and the date read;
   - the month and the exact measure as the source defines it, such as "new passenger
     vehicles, MIA definition";
   - the figure;
   - the matching query in our terms (dataset, scope, filters);
   - the tolerance.

   **Seed it** with every month from January 2025 to October 2026 that the sources publish:
   - MIA's monthly totals (new passenger, new commercial, used imports);
   - vstat's monthly totals and top ten models;
   - Stats NZ's cars total.

   Read the sources with WebFetch, read-only. Never enter a figure you have not read from the
   source page; a gap stays a gap. Where a source can't be read automatically, list exactly
   what I should copy in, and park it.
2. **A reconciliation step** after every build: it runs each matching query, compares, and
   writes `reconciliation.json` with ours, theirs, the gap and its percentage, and pass, warn
   or fail.
   - It **warns** past a row's tolerance. It **fails the build** past a hard limit you
     propose, such as twice the tolerance for three sources at once, because that means our
     data is wrong, not theirs.
   - Known, explained differences (MIA counts differently; survivors are not registrations)
     are noted on the row, not hidden.
3. **Show it:** on `/status` in full, and as a short public "How our figures compare" section
   on the Differences page. That page states each source's definition, our figure, theirs
   and the gap, every month, with no comment on who is right.
4. **Each month:** when a build lands, open one pull request adding the new month's published
   rows. This is high risk under the review rules, because it guards published figures.
5. **Explain the open gap:** older months are about 1% below the MIA, cause unexplained.
   Measure it by scope, vehicle type and month, and state what you can prove. Don't guess.

**Done when** reconciliation runs in every build, the table holds 22 months for each
readable source, and the Differences page shows it.

### Lane C: public readiness (milestone 2, plus a quality bar)

1. **Milestone 2 as written:** the About, Differences and Feedback pages linked from the
   canvas; `docs/playbooks/go-public.md` reduced to numbered clicks; a private dry run.
2. **The public quality bar.** Check every page against it before calling the lane done:
   - phone first: 320, 390 and 1280 px, with no sideways scroll, and every tap target at
     least 44 px;
   - axe clean, keyboard only, a screen reader reads every chart's sentence and table;
   - empty, loading, error and "nothing matches" states, each with a plain sentence and a
     next step;
   - a 404 page and a "data is being refreshed" notice;
   - page titles, a description and a social card image for each page;
   - every figure one tap from its definition, source and snapshot date;
   - plain English: no internal terms (decision numbers, dataset ids, "fact table") in
     anything a visitor reads, checked by a lint;
   - no tracking, no cookies, no third-party requests, checked by a test;
   - a performance budget per page, written into config and checked in CI.
3. **A design pass once,** by an opus sub-agent that has not seen the work. Give it
   screenshots of every page at 390 and 1280 px, in light and dark, plus the brief: "calm,
   editorial, data-forward, shadcn charts as the style reference, brand-neutral". Fix what it
   finds that is cheap; list the rest for me with screenshots.
4. **A visitor-test kit for me:**
   - five tasks: the brief's starter questions plus the acceptance question;
   - a one-page script;
   - a form to note where each person got stuck.

   I will run it with real people.

**Done when** the quality bar passes on every page, and only my four items remain.

### Lane D: December refresh (when it lands)

Watch the daily runs. When NZTA refreshes:
- check November's build and archive;
- add the published figures (lane B);
- run the dashboard usage-column check (D-134), and record what it shows;
- fix what breaks.

The month's true registrations still need my dashboard export. Tell me in one line when it's
needed; the browser method can fetch it.

---

## 3. Working from the cloud as well as my computer

I may start sessions from my phone through Claude Code on the web, against this GitHub
repository. A cloud session:
- **takes only lanes A, B or C,** and only a lane that is free in the Lanes table;
- **gets its site data** from the newest public cube release (`gh release download`), or the
  test fixtures if that release lacks a field it needs. It never builds from raw data, never
  touches the private archive, and never needs a secret;
- **follows the same merge rules,** and writes its line in the Lanes table before it starts.

Lane D and anything needing raw data or the archive stay on my computer.

---

## 4. Reporting

- End of each session: five lines at most, one per lane touched, plus the Lanes table.
- End of each lane: its "done when" checked line by line, with screenshots for A and C, the
  comparison table for B, and anything parked for me with your recommendation.
- One merge line at the end if Claude Code refused any merge.

---

## 5. The "continue" message (computer or cloud)

> /start. Continue `docs/brief/WORK_ORDER.md` (work order 3) from CHECKPOINT. Take a free lane
> from its Lanes table (on the web: only A, B or C). Its §1 carries work order 2's §3: you may
> merge into `main` in this session under those rules, and nothing in work order 2's §4 is
> touched. Do not stop for questions; park what needs me and keep going.
