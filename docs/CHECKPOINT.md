# Checkpoint

Last updated by claude on 2026-11-24

## Lanes (work order 3, `docs/brief/WORK_ORDER.md` §2)

Take only a lane that is free or your own. Write your line here, on `main`, before you start.
A session on the web takes only A, B or C.

| Lane | Branch | Held by | Status |
|---|---|---|---|
| A: finish the canvas | `claude/a-*` | the session on the computer of 2026-11-24 (its second) | steps 1 and 2 of 5 merged (#118, #119, #121); steps 3 to 5 and the milestone 1 report under way |
| B: the accuracy guard | `claude/b-*` | the same session, for the user's three answers below only | items 1 to 3 merged (#125, #126, #127); after the answers, next is item 5, the write-up |
| C: public readiness | `claude/c-*` | the session on the computer of 2026-11-24 (its second) | item 4 and the checks of item 2 merged (#120); items 1 to 3 and the dry run under way |
| D: December refresh | none yet | the computer only | waiting on NZTA: the daily runs to 22 November built nothing |

## Where we left off

- 2026-11-24, lane B only: #124 to #127 merged. No pull request is open.

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
4. Each month, one pull request adding the month's rows (high risk; `docs/playbooks/add-published-figures.md`).
   The MIA's come from its media release or a report that credits it (D-151). November's go with lane D.
5. Write up the measured gap on the Differences page: its hand-written MIA section gives 16 November's
   figures; the month-by-month ones are STATE known issue 7. Say what is measured, not why.
- Follow-ups: vstat's October 2026 totals are printed on its page but labelled "added up" (STATE);
  September 2025's MIA total ("14,000", perhaps exact) has no row; rows for `registrations_surviving`.

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

## The user's answers of 2026-11-24 (second session), being done

1. **Scoop:** keep the figures. Where the MIA's own site or a news outlet has the same release, link to
   that; keep a Scoop link only where nothing else exists.
2. **Swap `public/data`** for the dry-run build holding `reconciliation.json`: yes, then check the
   Differences page and `/status` in the browser with the real figures.
3. **A source restating its own figure by 5% or more** warns and is listed on `/status`; it does not
   stop the build. A gap between a source's figure and ours still stops it.
4. **Lane D:** when NZTA publishes November the user gives `DASHBOARD_EXPORT_METHOD.md`. Use it to retake
   the history with "GVM group" and "CC grouping - vehicle", then guard light commercial against vstat
   with a real tolerance.

## Decided for the user (unreviewed)

- D-150: a row with a tolerance of 5% or more and a stated reason is exempt from the 5% stop (vstat's
  22 light commercial rows); totals are covered too; vstat still counts as independent.
- D-151: Scoop's copies and reports that credit the MIA count as its public releases; later-release
  figures for March and June 2025; no row for a figure that may be rounded.
- #125: the public comparison shows passenger, commercial and total figures; models are on `/status`.
- D-148, D-149 and the canvas choices of 2026-11-23 are still unreviewed (their records say which).

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` (work order 3) from CHECKPOINT. Take a free lane from its
Lanes table (on the web: only A, B or C). Its §1 carries work order 2's §3: you may merge into `main` in
this session under those rules, and nothing in work order 2's §4 is touched. Do not stop for questions;
park what needs me and keep going.
