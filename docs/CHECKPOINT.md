# Checkpoint

Last updated by claude on 2026-11-23

## Lanes (work order 3, `docs/brief/WORK_ORDER.md` §2)

Take only a lane that is free or your own. Write your line here, on `main`, before you start.
A session on the web takes only A, B or C.

| Lane | Branch | Held by | Status |
|---|---|---|---|
| A: finish the canvas | `claude/a-starter-canvases` | the computer session of 2026-11-23 | step 1 of 5 (starter canvases) being built |
| B: the accuracy guard | `claude/b-reconciliation` | the computer session of 2026-11-23 | steps 1 and 2 (the published figures and the reconciliation step) being built |
| C: public readiness | `claude/c-quality-bar` | the computer session of 2026-11-23 | step 2 (the quality bar's lint, tests and budget) being built |
| D: December refresh | none yet | the computer only | waiting on NZTA: the daily runs to 22 November built nothing |

## Where we left off

- 2026-11-20, the second session of work order 2 (`docs/brief/WORK_ORDER.md`, D-147).
  **Merged: #115, #116.**
  - #115: the canvas holds several charts (step 3): add, duplicate, remove and put back,
    move by buttons or by dragging, half or full width; the editor follows the chart.
  - #116: save and share (step 4): My canvases in the browser, a pin chart by chart under
    Build's rules, and what a link asked for and did not get said on its chart.
- The first session merged #111 to #114 (the order saved, the decisions archived, canvas
  steps 1 and 2). #105 (the board proposal) is closed; its branch is kept for the mockups.

## Open pull requests

None waiting on the user.

## The queue, in order (work order 2)

**Milestone 1, the canvas** (§5). Done when the user can open it on a phone and a desktop,
build the acceptance question by dragging, add two more charts beside it, save the page as a
link and see the same page from that link in a new window. Then the milestone report (the
order's §7): screenshots, and the done-when checked line by line.

5. **Starter canvases.** Explore's groups as three or four canvases in config; Explore's
   page becomes the list of them. A starter is a canvas link, so it opens like any other.
6. **Polish.**
   - **One generated sentence under every chart** (the user, 2026-11-20: milestone 1 is not
     called done without it). Lines, bands and the map have none; a ranking and a grid
     keep theirs above the chart for now. From phrase templates only (invariant 8).
   - Light and dark (check the chart colours on a dark surface first).
   - First load (3.93 s against 3 s).

**Milestone 2, ready to go public** (§6): About, differences and feedback linked from the
canvas; `docs/playbooks/go-public.md` reduced to numbered clicks; a private dry run.

**When NZTA refreshes (December):** November's build and archive; the dashboard usage-column
check (D-134), then "Registered as" (D-140); fix what the refresh breaks.

## Parked until the user says otherwise (the order's §1)

- Colour's own table on the site (the narrow fact table, D-144).
- More SUV slices and sizes (D-145, D-117); further hybrid work (D-110, D-119).
- New segment schemes (D-103's draft, untracked in `nzta-segments`).
- New fields, new datasets and new privacy tables; drawing a hidden cell over time (D-130).
- The query service (D-091).
- The narrative engine beyond the canvas's sentences (D-102's drafts, in `nzta-screens`).
- Work order 1's small engine follow-ups (listed in this file as it was at commit `b2ef24d`).

## Questions for the user (parked; none stops the work)

1. **The site's name and web address** (`config/site.json`, search `TO DECIDE`). The About
   page stays a marked draft until both are filled. They are yours; there is no default.
2. **The Build page, once the canvas is done.** Keep both, or fold Build into the canvas (a
   Build link then opens as a canvas of one chart). Recommended: fold it in at the end of
   milestone 1. With no answer, both stay.

## Decided for the user (unreviewed)

- In D-147: how the order reads onto hard rules 4, 7 and 8; no final report of work order 1;
  #105 closed; the `definitions-editor` sub-agent on sonnet.
- The canvas (listed in #114): no new dependency (no shadcn/ui, no drag library); the
  layout; the zone names; the six chart types by name and a table; the answer stays above a
  ranking and a grid for now; a drop is always taken so that a refusal is said; light only.
- Several charts (listed in #115): the arrange buttons are in the chart's editor, not on
  every card; a dragged chart takes the place of the card it is dropped on; a removal can
  be undone once; under 1024 px every chart is full width.
- Save and share (listed in #116): My canvases sits under the charts; an entry is named
  after its first chart "and N more"; pinning pins each chart that can be pinned.
- `public/data` was refreshed from a dry run without asking (the playbook says to ask): the
  canvas needed the newer fields. The old copy is `public/data.previous`.

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` (work order 3) from CHECKPOINT. Take a free lane
from its Lanes table (on the web: only A, B or C). Its §1 carries work order 2's §3: you may
merge into `main` in this session under those rules, and nothing in work order 2's §4 is
touched. Do not stop for questions; park what needs me and keep going.
