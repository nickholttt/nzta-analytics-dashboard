# Checkpoint

Last updated by claude on 2026-11-25 (the session of 25 November)

## Lanes (work order 3, `docs/brief/WORK_ORDER.md` §2)

Take only a lane that is free or your own. Write your line here, on `main`, before you start. On the web: A, B or C.

| Lane | Branch | Held by | Status |
|---|---|---|---|
| A: finish the canvas | none | free | all five steps and the user's three design choices of 2026-11-25 merged (#142, #143, #144); nothing queued |
| B: the accuracy guard | none | free | Market type's rules and its test merged (#146, D-154), not built; next is building the field, after the user's answers (questions 2 to 4) |
| C: public readiness | none | free | items 1 to 3 merged and the private dry run done; what is left is the user's four items |
| D: December refresh | none yet | the computer only | waiting on NZTA: the daily runs to 25 November built nothing |

## Where we left off

- 2026-11-25: #141 to #146 merged; none open (lane A's three design choices; lane B's D-154).

## The queue, lane by lane (the order's §2 has each lane's "done when")

**A, finish the canvas.** Nothing queued. Small and safe: drop three unused decompressors from the Parquet
reader (about 5 KB); remove the old Build screen's words (STATE 8). The design pass's other findings stay
parked (#140's description lists them).

**B, the accuracy guard** (the user's order of 2026-11-25; D-154 has the detail).
1. Build Market type on the register datasets (high risk). It needs an ordered-rules derive kind, a
   register dataset holding the five vehicle types (`registrations_surviving` holds two), the unmapped
   guard, a coverage figure for the SUV rule and the data map entry. The dashboard datasets wait for lane D.
2. One "New registrations" dataset on the five vehicle types with vehicle type as a filter (question 2).
3. Range-extended electric vehicles askable apart from plug-in hybrids: they are apart only in
   `powertrain_detail`, which no field reads. Mild hybrids are already a value of Powertrain.
4. Then guard vstat's light commercial on the register basis with a real tolerance (22 rows are exempt).
5. Each month, one pull request adding the month's published rows (`docs/playbooks/add-published-figures.md`).
6. Write up the measured gap on the Differences page (its MIA section still gives 16 November's figures).
- Detailed segments (size with price bands) stay parked: no list prices; if offered, labelled as ours.
- Follow-ups: a check on `restated_from` (STATE 7); September 2025's MIA total has no row.

**C, public readiness.** The user's four items: the name, the address, the About page's gaps, the
Cloudflare clicks (`docs/playbooks/go-public.md`). After the name: redraw the social cards.

**D, the December refresh.** November's build and archive; its published figures; the usage-column check
(D-134). When NZTA publishes November the user gives `DASHBOARD_EXPORT_METHOD.md`: use it to retake the
dashboard history with "GVM group" and "CC grouping - vehicle" (user, 2026-11-24).

## Parked until the user says otherwise

Colour's own table (D-144); more SUV slices (D-145, D-117); further hybrid work (D-110, D-119); new
segment schemes (D-103); new privacy tables; drawing a hidden cell over time (D-130); the query service
(D-091), which a 3 s first chart on a fact-table link needs; the narrative engine beyond the canvas's
sentences (D-102); a measure worked out from two others (STATE 4).

## Questions for the user (parked; none stops the work)

1. **The site's name and web address** and the About page's gaps (`config/site.json`).
2. **The earlier message on one "New registrations" dataset did not reach the session of 2026-11-25.**
   Read from the later one: the two dashboard datasets become one on the five vehicle types. Recommended:
   confirm, or send it again. Until then they stay two.
3. **Motor caravans and special purpose vehicles up to 3,500 kg** are Other, as the user's words leave
   them. NZTA's class puts 860 of the 862 since January 2025 with light goods vehicles, and the published
   commercial figures are closer with them in Light commercial (D-154). They stay Other unless told.
4. **A passenger model the SUV file does not classify** (19.1% of new passenger vehicles) is Passenger, as
   the user's words say; invariant 4 would make it unmapped. Recommended: a value of its own for
   "not classified", so Passenger means models known to be cars. The file stays as written unless told.

## Decided for the user (unreviewed)

- #142: the chart's title stays the heading; notes are not shortened. #143: colour is per field and
  value. #144: the panel is 20rem; zones pin during a drag; the canvas's style budget is 9,400 bytes.
- D-154: Market type is kept beside vehicle type; people movers are Passenger; a ute is Light commercial
  by its body; the SUV file's rows count at any confidence; no catch-all rule.
- D-148 to D-153 and the canvas choices of 2026-11-23 and 24 are still unreviewed (their records say which).

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` (work order 3) from CHECKPOINT. Take a free lane from its
Lanes table (on the web: only A, B or C). Its §1 carries work order 2's §3: you may merge into `main` in
this session under those rules, and nothing in work order 2's §4 is touched. Do not stop for questions;
park what needs me and keep going.
