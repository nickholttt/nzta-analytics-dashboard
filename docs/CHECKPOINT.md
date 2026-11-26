# Checkpoint

Last updated by claude on 2026-11-26 (a second session that day: #166 merged; buyer type built, reviewed and open as #167; the user's word on location data, with a plan; the scratch files moved off the system drive)

## Lanes (work order 3, `docs/brief/WORK_ORDER.md` §2; lane E and items 1 to 13: `docs/brief/WORK_ORDER_3_ADDITIONS.md`)

Take only a lane that is free or your own. Write your line here, on `main`, before you start. On the web: A, C or E's site work.

| Lane | Branch | Held by | Status |
|---|---|---|---|
| A: finish the canvas | `claude/b-buyer-type-site` (worktree `nzta-lane-a`) | the computer | buyer type's site side, stacked on #167: a design is written (private), nothing built. The rest is under "A" below |
| B: the accuracy guard and the datasets | `claude/b-buyer-type` (worktree `nzta-lane-b`), #167 | the computer, until #167 merges | buyer type built and reviewed (D-159), checks green; waiting on the user's word. One pipeline pull request at a time |
| C: public readiness | none | free | what is left is the user's four items |
| D: December refresh | none yet | the computer only | waiting on NZTA: the daily runs to 25 November built nothing |
| E: classification, the latest month, findability | none | free | waits for Market type's build (B3); 98.64% classified against a 98% target |

## The queue (plans are kept outside the repository, on the computer; each B item is a high-risk pull request with one independent review)

**B, in this order.**
1. Done: item 1, one "New registrations" dataset (#164, D-158).
2. **Buyer type: #167, open, reviewed, green** (D-159). The store keeps owner type and usage at registration
   and still drops the district; a slice, a pair with new or used, a narrow fact table with brand and model.
   All 389 published figures unchanged. Next, each the user's word: merge; force October's build (it is
   what publishes the files); then the site pull requests from the design (the canvas saying "new vehicles
   only" first: today it counts new and used together, 51.9% private against about 27% for new alone;
   then the latest month, then brand and model pages); then vstat's buyer mix in the guard (warn only).
3. Build Market type on the register datasets (D-154, D-155): a generic `ordered_rules` derive kind;
   `model_segment.csv` read by the build; unmapped stops the build; a published coverage figure.
4. Item 8's build side: each build writes a classification review file and `/status` shows it.
5. Item 5, figures as first observed: later exports kept as differences, a revisions file on `/status`,
   and `supply --retake --dry-run` for December's comparison with the 14 November export.
6. Item 12: range-extended electric vehicles as a value of Powertrain.
7. Averages from the register (fuel consumption, power, each with its coverage) and where used imports
   came from (the user, 2026-11-26: yes).
8. **Location (the user, 2026-11-26, by name; the plan and its independent re-check are private files).**
   Four pull requests, each with a privacy record: (a) the under-10 hiding lifted on the region table
   and the Current use pair, Method's promise reworded; (b) district on the register datasets, with a map;
   (c) new registrations by district, keeping vehicle type only where no set of vehicles can be placed in
   a district (measured: 1.7% of vehicles folded into "other vehicle types"; the stricter rule the
   re-check asked for is measured first, and over 5% goes back to the user); (d) postcode: every count,
   by year with old years as one line, postcode by powertrain group by year, a postcode map. Then the
   site. Only the current snapshot's postcode tables are deployed. Credits go in the page footer.
9. Changes of registered person (`ownership_changes`, approved 2026-11-26). **Its counts are not committed
   until the licence line on NZTA's page is read (the user parked that).**
10. Each month's published rows; on Differences, that the register plus the dashboard's inactive vehicles
    rebuilds true registrations to within 19 vehicles over 34 months.

**A.** After buyer type's site side: year to date in the canvas; "New entry" in its ranking; pages for
used-import age, heavy vehicles and motorcycles; a brand's place over time.

**C.** The user's four items: name, address (it turns the sitemap on), About gaps, Cloudflare clicks.

**D.** November's build and archive; its published figures; the usage-column check (D-134). The user gives
`DASHBOARD_EXPORT_METHOD.md`; the retake adds "GVM group" and keeps the buyer fields (a whole re-supply).

## Parked until the user says otherwise

Detailed segments with price bands; colour's own table (D-144); further hybrid work (D-110, D-119); new segment schemes (D-103); the query service (D-091); the narrative engine (D-102); #140's other findings; the Existing fleet table by make, model and district; industry class and road transport code.

## Questions for the user (none stops the work)

1. **#167**: the word to merge it and to force October's build ("merge 167 and force the build"). The table
   by month and the canvas screenshots were shown in the session of 2026-11-26.
2. **December's retake** would ask for 13 fields against a limit of 12. Recommended: "CC grouping - vehicle" waits.
3. **D-158's open questions**: `contract_version` 2 (default: stays 1); retiring `in_scope` (default: kept).
4. Not sent: the email to NZTA. Parked: the Existing fleet page's licence line. Open: the site's name,
   address and About gaps.

## Decided for the user (unreviewed; each is in its pull request or record)

- D-148 to D-158 and the choices listed in #142 to #164; D-159 and the choices listed in #167 (among them:
  buyer type by brand and model in a table of its own; a new owner type or usage value stops the build on
  the first vehicle; Method's hidden-counts wording). #152's five low-confidence judgements.
- Location plan: the stricter district rule; old years as one line in the postcode tables; place names from a list with no formal licence.

## Prompt for the next session

/start. Continue work order 3 and its additions from CHECKPOINT: #167 first (merge and forced build need my
word), then buyer type's site side. Merge rules as before. Do not stop for questions; park what needs me.
