# Checkpoint

Last updated by claude on 2026-11-28, mid-afternoon (D-170: vcore.co.nz has the narrower location rule and top-five brand lists, on the user's word; the map's second round and fixes to the rest of the preview are being built; nothing in `src/`, the pipeline or the published data changed)

## Lanes (work order 3, `docs/brief/WORK_ORDER.md` §2; lane E and items 1 to 13: `docs/brief/WORK_ORDER_3_ADDITIONS.md`)

Take only a lane that is free or your own. Write your line here, on `main`, before you start. On the web: A, C or E's site work.

| Lane | Branch | Held by | Status |
|---|---|---|---|
| A: finish the canvas | none | closed into F | No further polish of the current screens: what is left of A is built in lane F's new UI |
| B: the accuracy guard and the datasets | none | free (the computer for anything needing raw data) | Next: set and forget in the form D-167 leaves, the queue's B1. One pipeline pull request at a time |
| C: public readiness | none | the user | vcore.co.nz shows the preview from a Pages project of its own, attached by the user on 27 November: open, not for search results (D-166). The site in `src/` is not public |
| D: December refresh | none yet | the computer only | waiting on NZTA: the daily runs to 25 November built nothing new |
| E: classification, the latest month, findability | none | free | the next classification batch can start |
| F: the new UI for vcore.co.nz | none | claude, in the preview (outside the repository) | The preview's controls are rebuilt and its Areas pages built (D-168); the build is on vcore.co.nz. The rebuild in `src/` starts after the experts' session |

## The queue (plans are kept outside the repository, on the computer; each B item is a high-risk pull request with one independent review)

**Now: the experts' session, 28 or 29 November, on vcore.co.nz (D-166).** Being built in the preview (D-170): the
map's second round and fixes to the rest. Afterwards: write down what each expert called out; a wrong figure first.

**B, set and forget (D-164, in the form D-167 leaves), in this order.**
1. **The month as first read**, frozen, in a wider committed aggregate at a path of its own (model, body, a weight
   class, the motive power code as recorded; no owner field), built by the Action; the privacy tests cover the
   new file; a self-check that can stop a month. It starts at November 2026 unless question 2 says October.
   Done when: a month built this way equals the five-field aggregate of that month, with no hand export.
2. **The MIA's powertrain groups** as a lookup on the motive power code as NZTA recorded it, before the
   mild-hybrid list rewrites it. Done when: the build, not the raw pull, gives October's 4,722 hybrids.
3. **Light vehicles the default; heavy vehicles and motorcycles datasets of their own**: 3,500 kg on the
   first-read figures. Done when: October 2026 gives light commercial 2,805 and heavy 480.
4. **Brands and models with no hand work**: Honda CRV with CR-V; GWM as registered (D-165); `SUBMODEL` bound so
   the Corolla Cross and Prado are told by a derived key; an unmatched make under NZTA's own name and a
   catch-all value wait for the wording in question 2.
5. Item 8's build side (a classification review file on `/status`); vstat's buyer mix in the guard (warn
   only); averages from the register; where used imports came from.
6. **Location (the user, 26 and 27 November, by name; the plan is a private file).** Shown first in the preview
   (D-166), brands by year included. For the site, four pull requests, each with a privacy record: (a) the
   under-10 hiding lifted; (b) district on the register; (c) new registrations by district; (d) postcode.
7. Changes of registered person (`ownership_changes`, approved 2026-11-26). **Its counts are not committed
   until the licence line on NZTA's page is read (the user parked that).**

**F, after the feedback** (D-163 over D-162; `PRODUCT.md`, `DESIGN.md`, `.impeccable/surfaces/`). One pull request
each: foundations; the card over `src/lib/canvas.ts` and the rule table; the six renderers to one set of marks; the
market page; brand, model and powertrain pages with brand against brand; search; the full editor; the data pages.

**D.** November's build and archive; its figures; the usage-column check (D-134).

## Parked until the user says otherwise

Detailed segments with price bands; colour's own table (D-144); further hybrid work (D-110, D-119); new segment schemes (D-103); the query service (D-091); the narrative engine (D-102); #140's other findings; the Existing fleet table by make, model and district; industry class and road transport code.

## Questions for the user (none stops the work)

1. **The next build to vcore.co.nz** (the map's second round, D-170). It goes to the development copy first and to
   the domain on your word. Default: the domain keeps the build of 28 November.
2. **After the session:** comparing areas side by side on the map; splitting the preview's data file so pages load
   less. Recommended: the first. Default: neither is started.
3. **Lane B, before the piece that needs each is built (D-167):** one series from two sources (the dashboard to
   the seam, the register after), the seam marked; rental from the register's usage, an owner field; the wording
   of invariants 4 and 5 for an unmatched make and a catch-all value; one forced run so the series starts at
   October. Recommended: yes to the first three, no forced run. Default: none is built.
4. **The dashboard export**: still the only source of private against business buyers; nothing is fetched. Standing:
   build October again after #173 (default: no); Market type's coverage levels; D-158's two; the NZTA email.

## Decided for the user (unreviewed; each is in its pull request or record)

- D-148 to D-163; the choices listed in #142 to #176; #152's five low-confidence judgements; the location plan's three.
- 27 November, D-164: a standalone preview, not a rebuild in two days. In the preview only: light vehicles are
  the dashboard's passenger vehicles and the register's light commercial, added; CRV with CR-V; "Business" for
  Company; Powertrains opens on passenger vehicles in the MIA's groups; a brand or model page opens on used
  imports where the subject is all but wholly one.
- 27 November, D-165: the preview on a Pages project apart from the site's, its name kept out of the repository.
- D-166 to D-168: two Pages projects; crawlers let in so the noindex is read; the forms lane B is left in; in the preview: postcodes by grouped counts, regions as groups of districts, one filter set for the visit, three sections.

## Prompt for the next session

/start. Read D-164 to D-168 and `docs/brief/UI_DIRECTION.md`. If the session with the experts has happened, start
from what they said: fix a wrong figure before anything else. If not, carry on with the preview work in the queue.
