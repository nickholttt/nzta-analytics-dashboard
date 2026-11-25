# Checkpoint

Last updated by claude on 2026-11-26 (the long session of 25 and 26 November: #152, #154, #156 to #162 merged; October's cube rebuilt; the one-dataset change built, reviewed and open as #164)

## Lanes (work order 3, `docs/brief/WORK_ORDER.md` §2; lane E and items 1 to 13: `docs/brief/WORK_ORDER_3_ADDITIONS.md`)

Take only a lane that is free or your own. Write your line here, on `main`, before you start. On the web: A, C or E's site work.

| Lane | Branch | Held by | Status |
|---|---|---|---|
| A: finish the canvas | none | free | #161 and #162 merged (the study's site items a to d); what is left is under "A" below |
| B: the accuracy guard and the datasets | `claude/b-one-new-registrations` (worktree `nzta-lane-b`), #164 | the computer, until #164 merges | item 1 built and reviewed (D-158); waiting on the user's word to merge. The next item starts from `main` after that merge |
| C: public readiness | none | free | what is left is the user's four items |
| D: December refresh | none yet | the computer only | waiting on NZTA: the daily runs to 25 November built nothing |
| E: classification, the latest month, findability | none | free | items 8 (two batches, 98.7%), 9, 10 and 13 merged; 11 found nothing; 12 is in B's queue |

## The queue (item numbers are the additions'; plans were written and accepted on 2026-11-25 and are kept outside the repository, on the computer)

**B, in this order, each a high-risk pull request with one independent review.**
1. Item 1, one "New registrations" dataset (`new_registrations`, five vehicle types; both old ids retire; a
   link to the narrower one comes back narrowed to its two types): **#164, open, reviewed** (D-158). All
   389 published figures unchanged. Its public-site checks fail by design: the newest cube holds the old
   ids, and a cube is published only from `main`. The order, on the user's word: merge with that one job
   failing, force the monthly build at once, then run the public-site checks again on `main`.
2. Buyer type on the one dataset (the user, 2026-11-25: "do it but tell me where its used"; "we should be
   using it to its full extent instead of censoring it"): `supply` keeps owner type and usage; a buyer-type
   map as reference data (private, rental, company, other); no monthly cell is under 10. Shown on the
   canvas, the latest month, the brand and model pages and the accuracy check. A decision record (privacy).
3. Build Market type on the register datasets (D-154, D-155): a generic `ordered_rules` derive kind;
   `model_segment.csv` read by the build; "Other vehicle types" for the fleet's other nine types; unmapped
   stops the build; a published coverage figure. Then guard vstat's light commercial on the register basis.
4. Item 8's build side: each build writes a classification review file and `/status` shows it.
5. Item 5, figures as first observed: later exports kept as differences, a revisions file on `/status`,
   and `supply --retake --dry-run` for December's comparison with the 14 November export.
6. Item 12: range-extended electric vehicles as a value of Powertrain (apart only in `powertrain_detail`,
   which is not published; the powertrain note says they are counted with plug-in hybrids).
7. Changes of registered person (the user, 2026-11-26: `ownership_changes` approved by name, sale type in
   full). Source: NZTA's monthly "Existing fleet" workbooks (118 read privately, 2017-01 to 2026-10). Plan:
   a supplied store keeping every file's reading of every month; "as first published" the default, "as in
   NZTA's newest file" a second dataset; never on a chart with registrations; 100 vstat figures at 0%.
   **Its counts are not committed until the licence line on NZTA's page is read (the user parked that).**
8. Each month's published rows; on Differences, that the register plus the dashboard's inactive vehicles
   rebuilds true registrations to within 19 vehicles over 34 months. Item 7 waits for lane D's retake.

**A.** Year to date in the canvas (about seven places assume a fixed number of months; until then the
pages' year-to-date links are withheld); "New entry" in the canvas's ranking; pages for used-import age,
heavy vehicles and motorcycles; a brand's place over time. Parked: a chosen period kept in the address
(needs a script on reading pages).

**E.** The next classification batch: the 113 small nameplates (0.8% of new passenger vehicles).

**C.** The user's four items: name, address (it turns the sitemap on), About gaps, Cloudflare clicks.

**D.** November's build and archive; its published figures; the usage-column check (D-134). The user gives
`DASHBOARD_EXPORT_METHOD.md`; the retake adds "GVM group" (item 7 follows) and the buyer fields.

## Parked until the user says otherwise

Detailed segments with price bands; colour's own table (D-144); further hybrid work (D-110, D-119); new segment schemes (D-103); the query service (D-091); the narrative engine (D-102); #140's other findings; the Existing fleet table by make, model and district.

## Questions for the user (parked; none stops the work)

1. **Buyer type's fourth group**: NZTA's value is "Other" (there is no "Government" value). Default: show "Other".
2. **Small counts**: lifting the under-10 rule (region table, current-use pair) changes Method's promise; district
   counts are a new kind of data. Each needs the user's word by name. Default: both stay as they are.
3. **December's retake** would ask for 13 fields against a limit of 12. Recommended: "CC grouping - vehicle" waits.
4. **#164**: the word to merge it with its public-site job failing and to force October's rebuild straight after.
5. Taken as yes: the monthly dashboard export covers the trailing 24 months (item 5). Not sent: the email to NZTA
   (item 6). Parked: the Existing fleet page's licence line (B7). Open: the site's name, address and About gaps.

## Decided for the user (unreviewed; each is in its pull request or record)

- D-148 to D-157 and the choices listed in #142 to #162; D-158 and the seven choices listed in #164. #152's five low-confidence
  judgements (Kia EV6, Kia Niro, Nissan Qashqai, MINI Aceman as SUV; Honda Jazz as car). #162: a brand page's HTML doubled.

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` (work order 3) and `docs/brief/WORK_ORDER_3_ADDITIONS.md`
from CHECKPOINT. Take a free lane. Merge rules as before. Do not stop for questions; park what needs me.
