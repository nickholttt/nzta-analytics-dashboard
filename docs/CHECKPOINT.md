# Checkpoint

Last updated by claude on 2026-11-27 (D-164: a working preview for the user and automotive experts is built, outside the repository; the cause of the gap to the MIA is found; nothing in `src/`, the pipeline or the published data changed)

## Lanes (work order 3, `docs/brief/WORK_ORDER.md` §2; lane E and items 1 to 13: `docs/brief/WORK_ORDER_3_ADDITIONS.md`)

Take only a lane that is free or your own. Write your line here, on `main`, before you start. On the web: A, C or E's site work.

| Lane | Branch | Held by | Status |
|---|---|---|---|
| A: finish the canvas | none | closed into F | No further polish of the current screens: what is left of A is built in lane F's new UI |
| B: the accuracy guard and the datasets | none | free (the computer for anything needing raw data) | Next: set and forget, the queue's B1. One pipeline pull request at a time |
| C: public readiness | none | the user | The domain is active on Cloudflare (the user, 27 November). No Cloudflare login is on the computer: question 1. Nothing is public |
| D: December refresh | none yet | the computer only | waiting on NZTA: the daily runs to 25 November built nothing new |
| E: classification, the latest month, findability | none | free | the next classification batch can start |
| F: the new UI for vcore.co.nz | none | waiting on the experts' feedback | The stakeholder preview is built (D-164). The rebuild in `src/` starts after the session |

## The queue (plans are kept outside the repository, on the computer; each B item is a high-risk pull request with one independent review)

**Now: the session with automotive experts, 28 or 29 November.** The preview is a folder to upload, one file to
send, and a private hosted page. Afterwards: write down what each expert called out and fix a wrong figure first.

**B, set and forget (D-164), in this order.**
1. **The month as first read.** Each month's first registrations come from the register as first read after
   the month ends, and are frozen; the committed aggregate (`data/snapshots/`) is widened to carry model, body,
   weight class and motive power code; later reads are kept as differences. History before November 2026 stays
   on the dashboard export held. Done when: September and October 2026 rebuilt this way equal the committed
   aggregates (17,047 and 15,117 new), and November builds with no hand export.
2. **The MIA's powertrain groups** as a lookup on NZTA's motive power code, beside the site's own grouping;
   range-extended electric vehicles a value of their own. Done when: October 2026 passenger gives 4,722 hybrid.
3. **Light vehicles the default; heavy vehicles and motorcycles datasets of their own**, from Market type on
   the first-read figures. Done when: October 2026 gives light commercial 2,805 and heavy 480.
4. **Brands and models with no hand work**: a make no registry row matches shown under NZTA's own name; Honda
   CRV with CR-V; the Corolla Cross and Prado told from the register's submodel text, with a warning on a
   submodel no rule has seen; GWM as NZTA registers it (question 2).
5. Item 8's build side (a classification review file on `/status`); vstat's buyer mix in the guard (warn
   only); averages from the register; where used imports came from.
6. **Location (the user, 2026-11-26, by name; the plan is a private file).** Four pull requests, each with a
   privacy record: (a) the under-10 hiding lifted; (b) district on the register; (c) new registrations by
   district; (d) postcode.
7. Changes of registered person (`ownership_changes`, approved 2026-11-26). **Its counts are not committed
   until the licence line on NZTA's page is read (the user parked that).**

**F, after the feedback** (D-163 over D-162; `PRODUCT.md`, `DESIGN.md`, `.impeccable/surfaces/`). One pull request
each: foundations; the card over `src/lib/canvas.ts` and the rule table; the six renderers to one set of marks; the
market page; brand, model and powertrain pages with brand against brand; search; the full editor; the data pages.

**D.** November's build and archive; its figures; the usage-column check (D-134).

## Parked until the user says otherwise

Detailed segments with price bands; colour's own table (D-144); further hybrid work (D-110, D-119); new segment schemes (D-103); the query service (D-091); the narrative engine (D-102); #140's other findings; the Existing fleet table by make, model and district; industry class and road transport code.

## Questions for the user (none stops the work)

1. **Cloudflare.** No Cloudflare login is on this computer, so nothing was uploaded. Either run `npx wrangler
   login` in the terminal (it opens Cloudflare in the browser and asks to allow access; it changes nothing in
   the project) and say so, or upload the preview's site folder by hand in Workers & Pages. Recommended: the
   login. Default: nothing is uploaded, and the private hosted page is what the experts are shown.
2. **GWM as one brand.** NZTA registers Haval, Ora and Tank under the make GWM, and the MIA and vstat list
   GWM; the published data splits them out. Recommended: as registered. Default: the preview shows GWM as one
   brand and the published data is left alone until this is answered.
3. **The dashboard export.** It is no longer needed for light and heavy. It is still the only source of buyer
   type, and it is a hand export each month. Default: nothing is fetched; buyer type ends at October 2026.
4. Standing: build October again after #173 (default: no); Market type's coverage levels (default kept);
   D-158's two questions; the NZTA email is not sent.

## Decided for the user (unreviewed; each is in its pull request or record)

- D-148 to D-163; the choices listed in #142 to #176; #152's five low-confidence judgements; the location plan's three.
- 27 November, D-164: a standalone preview, not a rebuild in two days. In the preview only: light vehicles are
  the dashboard's passenger vehicles and the register's light commercial, added; GWM as registered; CRV with
  CR-V; "Business" for Company; Powertrains opens on passenger vehicles in the MIA's groups; a brand or model
  page opens on used imports where the subject is all but wholly one.

## Prompt for the next session

/start. Read D-164 and `docs/brief/UI_DIRECTION.md`. If the session with the experts has happened, start from
what they said: fix a wrong figure before anything else. If not, take lane B's item 1.
