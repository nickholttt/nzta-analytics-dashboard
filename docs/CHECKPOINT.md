# Checkpoint

Last updated by claude on 2026-11-23

## Lanes (work order 3, `docs/brief/WORK_ORDER.md` §2)

Take only a lane that is free or your own. Write your line here, on `main`, before you start.
A session on the web takes only A, B or C.

| Lane | Branch | Held by | Status |
|---|---|---|---|
| A: finish the canvas | `claude/a-starter-canvases` | the computer session of 2026-11-23 | step 1 of 5 (starter canvases) being built |
| B: the accuracy guard | `claude/b-reconciliation` | the computer session of 2026-11-23 | steps 1 and 2 (the published figures and the reconciliation step) being built |
| C: public readiness | `claude/c-quality-bar` | the computer session of 2026-11-23 | the visitor-test kit is committed; the quality bar's checks are next |
| D: December refresh | none yet | the computer only | waiting on NZTA: the daily runs to 22 November built nothing |

## Where we left off

- 2026-11-23, the first session of work order 3 (D-148). #117 saves the order, archives work
  order 2 and adds this table. Nothing else is merged yet.
- Work order 2 merged #111 to #116: the canvas's build steps 1 to 4 (one chart with drop
  zones, the chart-type picker, several charts, save and share).

## Open pull requests

#117 (work order 3 saved; docs only), merging when its checks are green.

## The queue, lane by lane (the order's §2 has each lane's "done when")

**A, finish the canvas.**
1. Starter canvases: Explore's groups as three or four canvases in config; Explore's page
   becomes the list of them.
2. One generated sentence under every chart, lines, bands and the map among them; a ranking
   and a grid move theirs under the chart.
3. Build folded into the canvas: a Build link opens as a canvas of one chart, "My questions"
   become canvases, old links keep working, then Build's page goes. CLAUDE.md's "Two
   surfaces" opening changes in that pull request.
4. Dark mode, checked on real chart colours.
5. First load under 3 s (3.93 s on 20 November): fonts subset or the system stack; the
   editor split from the chart renderer. Before and after reported.

**B, the accuracy guard.**
1. `data/reference/published_figures.csv`, seeded for January 2025 to October 2026 from the
   MIA, vstat and Stats NZ, only with figures read on the source's own page.
2. The reconciliation step in every build, writing `reconciliation.json`; warns past a row's
   tolerance, fails the build past a hard limit. A contract change: its own record (D-149).
3. Shown in full on `/status` and in short on the Differences page.
4. Each month, one pull request adding the new month's published rows (high risk).
5. The open gap to the MIA measured by scope, vehicle type and month.

**C, public readiness.**
1. About, Differences and Feedback linked from the canvas; `go-public.md` as numbered
   clicks; a private dry run.
2. The quality bar on every page (the order lists it), with a plain-English lint, a
   no-tracking test and a performance budget checked in CI.
3. One design pass by an opus sub-agent that has not seen the work.
4. The visitor-test kit: written (`docs/visitor-test/`), on the lane's branch.

**D, the December refresh.** November's build and archive; the month's published figures;
the dashboard usage-column check (D-134); fix what breaks. The month's true registrations
need the user's dashboard export.

## Parked until the user says otherwise

Colour's own table (D-144); more SUV slices (D-145, D-117); further hybrid work (D-110,
D-119); new segment schemes (D-103); new fields, datasets and privacy tables; drawing a
hidden cell over time (D-130); the query service (D-091); the narrative engine beyond the
canvas's sentences (D-102).

## Questions for the user (parked; none stops the work)

1. **The site's name and web address** (`config/site.json`, search `TO DECIDE`), and the
   About page's gaps. They are yours; there is no default.

## Decided for the user (unreviewed)

- D-148: how the order reads onto hard rules 7 and 8; three sub-agents at once with lane D
  the lead's own; `reconciliation.json` read as approved for a cube release.
- The visitor-test kit's five tasks are starter questions 1, 2, 4 and 9 and the acceptance
  question.
- Carried from work order 2 (listed in #114 to #116 and D-147): the canvas's layout and
  controls, no new dependency, and `public/data` refreshed from a dry run on 20 November.

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` (work order 3) from CHECKPOINT. Take a free lane
from its Lanes table (on the web: only A, B or C). Its §1 carries work order 2's §3: you may
merge into `main` in this session under those rules, and nothing in work order 2's §4 is
touched. Do not stop for questions; park what needs me and keep going.
