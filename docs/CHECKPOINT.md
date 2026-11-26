# Checkpoint

Last updated by claude on 2026-11-27 (#170 to #175 merged on the user's word; the UI proposal remade so that every page is a canvas the visitor can re-ask, D-162; Impeccable installed and run on it; nothing built in `src/`)

## Lanes (work order 3, `docs/brief/WORK_ORDER.md` §2; lane E and items 1 to 13: `docs/brief/WORK_ORDER_3_ADDITIONS.md`)

Take only a lane that is free or your own. Write your line here, on `main`, before you start. On the web: A, C or E's site work.

| Lane | Branch | Held by | Status |
|---|---|---|---|
| A: finish the canvas | none | closed into F | #170, #171 and #172 merged. No further polish of the current screens: what is left of A is built in lane F's new UI |
| B: the accuracy guard and the datasets | none | free (the computer for anything needing raw data) | Market type merged (#173, D-161). Next: item 3. One pipeline pull request at a time |
| C: public readiness | none | free | waits for lane F. The address is vcore.co.nz (registered); the name's spelling is asked |
| D: December refresh | none yet | the computer only | waiting on NZTA: the daily runs to 25 November built nothing new |
| E: classification, the latest month, findability | none | free | the next classification batch can start: #173 is merged (the contract test no longer moves with the nameplate file) |
| F: the new UI for vcore.co.nz | `claude/f-design-context` | the computer | the third proposal is with the user (D-162); the branch holds the product record and the direction contract. Build starts on their word, as `claude/f-*` branches |

## The queue (plans are kept outside the repository, on the computer; each B item is a high-risk pull request with one independent review)

**F, once the user accepts the design** (D-162; `PRODUCT.md`; the direction contract in `.impeccable/surfaces/`).
One pull request each: foundations (tokens, Geist, the shell and shared parts); the card, one component that holds a
question and can re-ask itself over `src/lib/canvas.ts` and the rule table; the six renderers to one set of marks; the
market page as a started canvas; brand, model and powertrain pages likewise, with brand against brand; search; the
full editor; the data pages, the quality bar and a private preview.

**B, in this order.**
2. Done: Market type (#173, D-161). Not on New registrations until the dashboard history is retaken with the GVM
   group (lane D); then the register-basis guard on vstat's light commercial figures.
3. Item 8's build side: each build writes a classification review file and `/status` shows it.
4. Item 5, figures as first observed: later exports kept as differences, a revisions file on `/status`,
   and `supply --retake --dry-run` for December's comparison with the 14 November export.
5. Item 12: range-extended electric vehicles as a value of Powertrain.
6. vstat's buyer mix in the guard (warn only). Averages from the register (fuel consumption, power, each
   with its coverage) and where used imports came from (the user, 2026-11-26: yes).
7. **Location (the user, 2026-11-26, by name; the plan and its re-check are private files).** Four pull requests,
   each with a privacy record: (a) the under-10 hiding lifted on the region table and the Current use pair, Method's
   promise reworded; (b) district on the register datasets, with a map; (c) new registrations by district, keeping
   vehicle type only where no set of vehicles can be placed in a district (over 5% folded goes back to the user);
   (d) postcode: every count, by year, by powertrain group, a map; only the current snapshot's tables are deployed.
8. Changes of registered person (`ownership_changes`, approved 2026-11-26). **Its counts are not committed
   until the licence line on NZTA's page is read (the user parked that).**
9. Each month's published rows; on Differences, that the register plus the dashboard's inactive vehicles
   rebuilds true registrations to within 19 vehicles over 34 months.

**A, folded into F's pages.** The brand and model pages' "who registered them" table (12 months, New and Used
imports side by side, at least 200 vehicles for a share); Market type, year to date and "New entry" on the canvas;
pages for used-import age, heavy vehicles and motorcycles; a brand's place over time; the site-tests job's cube.

**C.** After F: the name's spelling, About gaps, Cloudflare clicks and the domain. The address is vcore.co.nz.

**D.** November's build and archive; its published figures; the usage-column check (D-134). The user gives
`DASHBOARD_EXPORT_METHOD.md`; the retake adds "GVM group" and keeps the buyer fields (a whole re-supply).

## Parked until the user says otherwise

Detailed segments with price bands; colour's own table (D-144); further hybrid work (D-110, D-119); new segment schemes (D-103); the query service (D-091); the narrative engine (D-102); #140's other findings; the Existing fleet table by make, model and district; industry class and road transport code.

## Questions for the user (none stops the work)

0. **The new UI's design**: accept the third proposal and its structure ("go"), or say what to change. Default: nothing of it is
   built. And the name as written: vcore, Vcore or VCORE. Default: "vcore" in text, VCORE on the plate mark.
1. **Merge** the lane F context pull request (docs and context files only) once it is open and green.
2. **After #173: build October again** so the published cube gains Market type? It is a forced build that
   the standing exception does not cover. Default: no; November's build carries it.
3. **Market type's coverage levels**: warn under 75% placed, not live under 70% (today 98.69%). Default: kept.
4. **December's retake** asks for 13 fields against a limit of 12. Recommended: "CC grouping - vehicle" waits.
5. **D-158**: `contract_version` 2 (default: 1); retiring `in_scope` (default: kept). Not sent: the NZTA email.

## Decided for the user (unreviewed; each is in its pull request or record)

- D-148 to D-160; the choices listed in #142 to #169; #152's five low-confidence judgements; the location plan's three.
- 26 November: the choices listed in #170 to #173 (D-161). 27 November: the five readings in UI_DIRECTION; D-162's
  structure; the proposal's choices (a number-plate mark, arrows not green and red, monotone curves); Impeccable
  installed for the user without its hook; `PRODUCT.md` written from the brief without an interview.

## Prompt for the next session

/start. Read `docs/brief/UI_DIRECTION.md` and D-162. If I have accepted the design, build lane F's first pull
request (foundations); if not, take lane B's item 3. Merge what I have named. Park what needs me.
