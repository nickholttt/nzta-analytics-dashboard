# Checkpoint

Last updated by claude on 2026-11-24

## Lanes (work order 3, `docs/brief/WORK_ORDER.md` §2)

Take only a lane that is free or your own. Write your line here, on `main`, before you start.
A session on the web takes only A, B or C.

| Lane | Branch | Held by | Status |
|---|---|---|---|
| A: finish the canvas | none | free | steps 1 and 2 of 5 merged (#118, #119, #121); next is step 3, Build folded in |
| B: the accuracy guard | `claude/b-single-figure-limit`, then `claude/b-site-half` and `claude/b-mia-public` | claude, the session on the computer of 2026-11-24 | held: the user's four answers of 2026-11-24 (a 5% stop on one figure, added-up rows labelled, the MIA from its public releases only, vstat's label), then item 3 |
| C: public readiness | none | free | item 4 and the checks of item 2 merged (#120); next is item 1, the playbook |
| D: December refresh | none yet | the computer only | waiting on NZTA: the daily runs to 22 November built nothing |

## Where we left off

- 2026-11-23, the first session of work order 3: #117 to #122 merged. No pull request is open.

## The queue, lane by lane (the order's §2 has each lane's "done when")

**A, finish the canvas.**
3. Build folded into the canvas: a Build link opens as a one-chart canvas, "My questions" become canvases,
   old links keep working, then Build's page goes. CLAUDE.md's "Two surfaces" changes with it (D-148).
4. Dark mode, checked on real chart colours.
5. First load under 3 s (3.93 s on 20 November). Seen on 23 November: the whole of `config/pipeline.json`
   is in the browser's code, and a macron pulls in a second font file. Lower the budgets afterwards.
- Also A's, from lane C's audit: controls under 44 px on the canvas at 1280 px (`src/styles/canvas.css`);
  a link with an unknown measure or month draws a default chart and says nothing (`src/lib/canvas.ts`);
  "This chart could not be drawn." gives no next step; the heading level `/build/` skips.

**B, the accuracy guard.**
3. The site half: the full table on `/status`, and "How our figures compare" on the Differences page, in
   template words, with no comment on who is right. `public/data` needs a dry-run build to hold the file.
4. Each month, one pull request adding the month's rows (high risk; `docs/playbooks/add-published-figures.md`).
5. Write up the measured gap (STATE known issue 7): it is all in commercial vehicles and closes on the
   wider scope; why 2025 sits a little further under is not proven.
- Follow-ups: a fault confined to one kind of figure only warns (`docs/CUBE_SCHEMA.md`), so decide
  whether many warnings from two sources should stop a build; rows for `registrations_surviving`.

**C, public readiness.**
1. Milestone 2: `docs/playbooks/go-public.md` as numbered clicks; a private dry run; the refresh notice.
2. What the audit still fails (the canvas's are in A's list); the no-tracking check's miss (STATE 8).
3. One design pass by an opus sub-agent that has not seen the work, after A's dark mode.
- After the user names the site: redraw the social cards (`scripts/make-social-cards.mjs`).

**D, the December refresh.** November's build and archive; its published figures; the
usage-column check (D-134). True registrations need the user's dashboard export.

## Parked until the user says otherwise

Colour's own table (D-144); more SUV slices (D-145, D-117); further hybrid work (D-110, D-119); new
segment schemes (D-103); new fields, datasets and privacy tables; drawing a hidden cell over time
(D-130); the query service (D-091); the narrative engine beyond the canvas's sentences (D-102); a
measure worked out from two others on the canvas (three Explore charts wait on it, STATE 4).

## Questions for the user (parked; none stops the work)

1. **The site's name and web address** and the About page's gaps (`config/site.json`).
2. **The MIA's monthly figures before October 2026** are for members only. To add them, copy in each
   month's Total Industry, Light Passenger, Light Commercial and Heavy Commercial.
3. **Figures worked out from a source's page** (D-149): 264 vstat rows are its chart data added across
   powertrains, and two MIA rows add two of its figures; each says so. Kept unless the user says otherwise.

## Decided for the user (unreviewed)

- D-148: how the order reads onto hard rules 7 and 8; `reconciliation.json` in a cube release.
- D-149: two independent sources, not three, can stop a build; the tolerances; all three sources marked
  independent; a figure naming a value no longer held is not compared.
- The four starter canvases and their charts; the sentence templates; the public checks' rules and
  budgets (`config/performance_budget.json` and two more); the visitor test's five tasks.

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` (work order 3) from CHECKPOINT. Take a free lane from its
Lanes table (on the web: only A, B or C). Its §1 carries work order 2's §3: you may merge into `main` in
this session under those rules, and nothing in work order 2's §4 is touched. Do not stop for questions;
park what needs me and keep going.
