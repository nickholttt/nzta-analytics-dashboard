# Checkpoint

Last updated by claude on 2026-11-26 (a third session that day: #167, #169 and #168 merged on the user's word and October rebuilt with buyer type; #170 to #173 built, checked and open)

## Lanes (work order 3, `docs/brief/WORK_ORDER.md` §2; lane E and items 1 to 13: `docs/brief/WORK_ORDER_3_ADDITIONS.md`)

Take only a lane that is free or your own. Write your line here, on `main`, before you start. On the web: A, C or E's site work.

| Lane | Branch | Held by | Status |
|---|---|---|---|
| A: finish the canvas | `claude/a-latest-month-buyers` (#170), `claude/a-all-panel-phone` (#171, stacked on it), `claude/a-narrow-tables` (#172) | the computer, until they merge | all three open and green. Next: the brand and model pages' buyer table, which needs #170 and #172 on `main` |
| B: the accuracy guard and the datasets | `claude/b-market-type` (#173) | the computer, until #173 merges | Market type built and reviewed (D-161). One pipeline pull request at a time |
| C: public readiness | none | free | what is left is the user's four items |
| D: December refresh | none yet | the computer only | waiting on NZTA: the daily runs to 25 November built nothing new |
| E: classification, the latest month, findability | none | free | the next classification batch can start once #173 merges (the contract test no longer moves with the nameplate file) |

## The queue (plans are kept outside the repository, on the computer; each B item is a high-risk pull request with one independent review)

**B, in this order.**
1. Done: one "New registrations" dataset (#164, D-158); buyer type (#167, D-159), published by the forced
   build of 26 November: 388 of 389 published figures pass, 1 warns, as before.
2. **Market type: #173, open, reviewed, green** (D-161). Live on `registrations_surviving` and `fleet`;
   every other published file unchanged; 98.69% of the last 12 months' new passenger vehicles placed. Not
   on New registrations until the dashboard history is retaken with the GVM group (lane D); then the
   register-basis guard on vstat's light commercial figures.
3. Item 8's build side: each build writes a classification review file and `/status` shows it.
4. Item 5, figures as first observed: later exports kept as differences, a revisions file on `/status`,
   and `supply --retake --dry-run` for December's comparison with the 14 November export.
5. Item 12: range-extended electric vehicles as a value of Powertrain.
6. vstat's buyer mix in the guard (warn only). Averages from the register (fuel consumption, power, each
   with its coverage) and where used imports came from (the user, 2026-11-26: yes).
7. **Location (the user, 2026-11-26, by name; the plan and its re-check are private files).** Four pull
   requests, each with a privacy record: (a) the under-10 hiding lifted on the region table and the
   Current use pair, Method's promise reworded; (b) district on the register datasets, with a map; (c) new
   registrations by district, keeping vehicle type only where no set of vehicles can be placed in a
   district (over 5% folded goes back to the user); (d) postcode: every count, by year, by powertrain
   group, a map. Only the current snapshot's postcode tables are deployed. Credits go in the page footer.
8. Changes of registered person (`ownership_changes`, approved 2026-11-26). **Its counts are not committed
   until the licence line on NZTA's page is read (the user parked that).**
9. Each month's published rows; on Differences, that the register plus the dashboard's inactive vehicles
   rebuilds true registrations to within 19 vehicles over 34 months.

**A.** The brand and model pages' "who registered them" table (the design's last piece; 12 months, New
and Used imports side by side, a minimum of 200 vehicles for a share). Then: Market type on the canvas
for the fleet and a place it is shown; "new vehicles" in a buyer-type chart's title and sentence; year to
date in the canvas; "New entry" in its ranking; pages for used-import age, heavy vehicles and
motorcycles; a brand's place over time. Small: the cube download for the site-tests job (STATE, issue 9).

**C.** The user's four items: name, address (it turns the sitemap on), About gaps, Cloudflare clicks.

**D.** November's build and archive; its published figures; the usage-column check (D-134). The user gives
`DASHBOARD_EXPORT_METHOD.md`; the retake adds "GVM group" and keeps the buyer fields (a whole re-supply).

## Parked until the user says otherwise

Detailed segments with price bands; colour's own table (D-144); further hybrid work (D-110, D-119); new segment schemes (D-103); the query service (D-091); the narrative engine (D-102); #140's other findings; the Existing fleet table by make, model and district; industry class and road transport code.

## Questions for the user (none stops the work)

1. **Merges**, each green: "merge 170", then "merge 171" (stacked on 170); "merge 172"; "merge 173" (high
   risk; its description has the before and after, the golden's diff and the review).
2. **After #173: build October again** so the published cube gains Market type? It is a forced build that
   the standing exception does not cover. Default: no; November's build carries it.
3. **Market type's coverage levels**: warn under 75% placed, not live under 70% (today 98.69%). Default: kept.
4. **December's retake** asks for 13 fields against a limit of 12. Recommended: "CC grouping - vehicle" waits.
5. **D-158**: `contract_version` 2 (default: 1); retiring `in_scope` (default: kept). Not sent: the NZTA
   email. Parked: the Existing fleet licence line. Open: the site's name, address, About gaps.

## Decided for the user (unreviewed; each is in its pull request or record)

- D-148 to D-160 and the choices listed in #142 to #169. #152's five low-confidence judgements. The
  location plan's: the stricter district rule; old years as one line; place names from an unlicensed list.
- This session: "all of the previously mentioned pull requests" read as #167, #169, #168; October's forced
  build started under D-120 (the supplied counts had changed); the choices listed in #170 to #173 (D-161).

## Prompt for the next session

/start. Continue work order 3 and its additions from CHECKPOINT: merge what I have named, then the brand
and model pages' buyer table (lane A) and the next item of lane B. Do not stop for questions; park what needs me.
