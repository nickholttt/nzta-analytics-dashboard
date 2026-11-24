# Checkpoint

Last updated by claude on 2026-11-25 (the session begun on 2026-11-24, its second)

## Lanes (work order 3, `docs/brief/WORK_ORDER.md` §2)

Take only a lane that is free or your own. Write your line here, on `main`, before you start. On the web: A, B or C.

| Lane | Branch | Held by | Status |
|---|---|---|---|
| A: finish the canvas | none | free | all five steps merged (#132, #133, #138); milestone 1's "done when" met; what is left is the user's design choices (question 3) |
| B: the accuracy guard | none | free | items 1 to 3 and the user's answers of 2026-11-24 merged (#134, #135); next is item 5, the write-up |
| C: public readiness | none | free | items 1 to 3 merged (#130, #131, #136, #137, #140) and the private dry run done; what is left is the user's four items |
| D: December refresh | none yet | the computer only | waiting on NZTA: the daily runs to 23 November built nothing |

## Where we left off

- 2026-11-24 to 25, second session (lanes A and C, the user's answers on B): #129 to #140 merged; none open.

## The queue, lane by lane (the order's §2 has each lane's "done when")

**A, finish the canvas.** Nothing is queued until the user answers question 3. Small and safe: drop three
unused decompressors from the Parquet reader (about 5 KB); remove the old Build screen's words (STATE 8).

**B, the accuracy guard.**
4. Each month, one pull request adding the month's rows (high risk; `docs/playbooks/add-published-figures.md`).
   The MIA's come from its media release or a report that credits it (D-151, D-152). November's go with lane D.
5. Write up the measured gap on the Differences page: its hand-written MIA section gives 16 November's
   figures; the month-by-month ones are in the comparison beside it. Say what is measured, not why.
- Follow-ups: a check that a filled `restated_from` is what the row's figure was before the change
  (STATE 7); vstat's October 2026 totals labelled "added up"; September 2025's MIA total has no row.

**C, public readiness.** The user's four items: the name, the address, the About page's gaps, the
Cloudflare clicks (`docs/playbooks/go-public.md`). After the name: redraw the social cards
(`scripts/make-social-cards.mjs`). When wanted: say so when a page left open draws a newer month than it
was built for (STATE 3); close the tracking check's old gaps and hold `localStorage` to named keys (STATE 6).

**D, the December refresh.** November's build and archive; its published figures (lane B, item 4); the
usage-column check (D-134). When NZTA publishes November the user gives `DASHBOARD_EXPORT_METHOD.md`:
use it to retake the dashboard history with "GVM group" and "CC grouping - vehicle", then guard light
commercial against vstat with a real tolerance in place of the 22 exempt rows (user, 2026-11-24).

## Parked until the user says otherwise

Colour's own table (D-144); more SUV slices (D-145, D-117); further hybrid work (D-110, D-119); new
segment schemes (D-103); new fields, datasets and privacy tables; drawing a hidden cell over time
(D-130); the query service (D-091), which a 3 s first chart on a fact-table link needs; the narrative
engine beyond the canvas's sentences (D-102); a measure worked out from two others (STATE 4).

## Questions for the user (parked; none stops the work)

1. **The site's name and web address** and the About page's gaps (`config/site.json`).
2. **D-153's reading of the restatement rule.** A restated row stops the build only when our figure is
   5% or more from both the source's new figure and its earlier one; "gaps between a source's figure and
   ours still stop it" could be read as the new figure alone. Recommended: keep it as built (the other
   reading stops the build on every large restatement). It stays unless the user says otherwise.
3. **The design pass's larger findings** (the session's report lists all). The three that matter most:
   a value keeps one colour across a page of charts (today colour follows rank); the editing panels take
   nearly half the desktop width; the sentence sits under the chart with method notes above it (the
   order of 2026-11-23 put it under). Recommended: do the first, fold the field list into the chart
   panel for the second, leave the third. None is started until the user says.

## Decided for the user (unreviewed)

- D-152: GoAuto's credit line counts as crediting the MIA; Autotrader NZ carries one row. D-153: the
  "both figures" rule (question 2); the earlier figure is entered by hand.
- #132: a Build link for "share and number" opens as two charts. #133: the theme choice is kept in the
  browser only when it differs from the device. #137: "being refreshed" means a month is due and not
  here yet. #138: the fonts are cut-down files in the repository, renamed inside ("NZVR Sans", "NZVR
  Serif") as their licence requires; charts after the first wait until the first is drawn.
- #140: one quiet "selected" style for toggles and chips, and the design pass's other cheap fixes.
  D-148 to D-151 and the canvas choices of 2026-11-23 are still unreviewed (their records say which).

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` (work order 3) from CHECKPOINT. Take a free lane from its
Lanes table (on the web: only A, B or C). Its §1 carries work order 2's §3: you may merge into `main` in
this session under those rules, and nothing in work order 2's §4 is touched. Do not stop for questions;
park what needs me and keep going.
