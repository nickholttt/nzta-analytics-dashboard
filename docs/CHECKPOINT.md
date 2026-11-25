# Checkpoint

Last updated by claude on 2026-11-25 (the second session of 25 November)

## Lanes (work order 3, `docs/brief/WORK_ORDER.md` §2; lane E and items 1 to 13: `docs/brief/WORK_ORDER_3_ADDITIONS.md`)

Take only a lane that is free or your own. Write your line here, on `main`, before you start. On the web: A, B, C or E's site work.

| Lane | Branch | Held by | Status |
|---|---|---|---|
| A: finish the canvas | none | free | item 4 merged (#151, D-156); nothing queued |
| B: the accuracy guard and the datasets | none | free | items 2 and 3 merged (#150, D-155), the survivors on five vehicle types (#156, D-157); next is item 1 |
| C: public readiness | none | free | what is left is the user's four items |
| D: December refresh | none yet | the computer only | waiting on NZTA: the daily runs to 25 November built nothing |
| E: classification, the latest month, findability | `claude/e-classify-batch-1`, `claude/e-classify-corolla` | free; #152 and #154 wait for the user's "merge" | items 9, 10 and 13 merged (#153, #155, #149); item 8's first batches are open; 11 found nothing; 12 not started |

## Where we left off

- 2026-11-25, second session: #148 to #151, #153, #155 and #156 merged. Open for the user: #152, #154.

## The queue (item numbers are the additions'; each plan was written and accepted on 2026-11-25)

**B, in this order, each a high-risk pull request with one independent review.**
1. Item 1, one "New registrations" dataset: a new id, `new_registrations`, on the five vehicle types, new
   and used; both old ids retire and an old link is told by its id (a link to the narrower one comes
   back narrowed to its two types, so it draws the same figures, with a test). The guard's 389 rows,
   the starters, the sentences, the Differences page, `config/latest_month.json` and
   `config/answer_pages.json` follow. Before and after against every published figure. Two golden updates.
2. Build Market type on the register datasets: a generic `ordered_rules` derive kind; `model_segment.csv`
   read by the build (year and mass bounds together, one shared join for the script, the build and the
   derive); rules for the fleet's other nine vehicle types to a seventh value, "Other vehicle types";
   unmapped stops the build; a published coverage figure (live at 70% classified, warn under 75%, both
   config; raise the warning once #152 and #154 are in). Then guard vstat's light commercial on the
   register basis (22 rows are exempt today).
3. Item 8's build side: each build writes a classification review file (no class and 20 or more in 3
   months, low-confidence rows, the three conflicts, coverage by confidence) and `/status` shows it.
4. Item 5, figures as first observed: the store already keeps a month as first seen; later exports are
   kept as differences in a third committed file, a revisions file is published and listed on `/status`,
   and `supply --retake --dry-run` gives December's month-by-month comparison with the 14 November export.
5. Item 12: range-extended electric vehicles as a value of Powertrain (they are apart only in
   `powertrain_detail`, which no field reads). Item 7 waits for lane D's retake.
6. Each month's published rows; the Differences page's write-up (STATE 5).

**E.** After the user's word: merge #152, then retarget #154 to `main` and merge it. The next batch is the
113 small nameplates (0.8% of new passenger vehicles) and the low-confidence rows the user wants looked at.

**C.** The user's four items: the name, the address (it also turns the sitemap on), the About page's
gaps, the Cloudflare clicks. After the name: redraw the social cards.

**D.** November's build and archive; its published figures; the usage-column check (D-134). The user gives
`DASHBOARD_EXPORT_METHOD.md`; the retake adds "GVM group" and "CC grouping - vehicle" (item 7 follows).

## Parked until the user says otherwise

Detailed segments with price bands (no list prices); colour's own table (D-144); further hybrid work
(D-110, D-119); new segment schemes (D-103); the query service (D-091); the narrative engine beyond the
canvas's and the new pages' sentences (D-102); the design pass's other findings (#140).

## Questions for the user (parked; none stops the work)

1. **#152 and #154: "merge 152, 154" or changes.** The five low-confidence judgements to read first: Kia
   EV6, Kia Niro, Nissan Qashqai and MINI Aceman as SUV; Honda Jazz as car.
2. **The monthly dashboard export should cover the trailing 24 months**, not the new month alone, or a
   later change to a past month is never seen (item 5). Recommended: yes, from November's export.
3. **The survivors now count five vehicle types** (D-157, decided by claude): every figure from that
   dataset rises (1.56% over the last 12 months). Say "undo" before the next build if that is not wanted.
4. **The email to NZTA is drafted, not sent** (item 6); it is the user's to send.
5. **Used imports (item 11):** the importers' association publishes no monthly figures on its own pages.
   Does the user know where it does, or is vstat's used-import figure enough?
6. The site's name and web address and the About page's gaps (`config/site.json`).

## Decided for the user (unreviewed; each is in its pull request or record)

- D-155: class NA alone for special purpose vehicles. D-156: the timed check fails a pull request; a
  browser that cannot be installed is forgiven. D-157: widen the survivors; segment "Other" for the three
  added types. #153: movers by percentage change above 100 vehicles. #155: pages from 100 vehicles a year.
- D-148 to D-154 and the canvas choices of 2026-11-23 to 25 are still unreviewed.

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` (work order 3) and `docs/brief/WORK_ORDER_3_ADDITIONS.md`
from CHECKPOINT. Take a free lane. Merge rules as before. Do not stop for questions; park what needs me.
