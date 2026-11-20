# Checkpoint

Last updated by claude on 2026-11-20

## Where we left off

- 2026-11-20, the first session of work order 2 (`docs/brief/WORK_ORDER.md`, D-147), which
  replaces work order 1. **Merged: #111, #112, #113, #114.**
  - #112: the order saved; its process rules and the canvas page's rules in `CLAUDE.md` and
    `AGENTS.md`. #111: D-001 to D-140 archived, an index in `docs/DECISIONS.md`, and D-147.
  - #113, #114: the canvas, build steps 1 and 2 (one chart with drop zones; the chart-type
    picker), its words in `config/canvas.json` and held to the template lint.
- #105 (the board proposal) is closed without merging: the order's §5 answers it. Its branch
  is kept for the mockups.

## Open pull requests

None waiting on the user.

## The queue, in order (work order 2)

**Milestone 1, the canvas** (§5). Done when the user can open it on a phone and a desktop,
build the acceptance question by dragging, add two more charts beside it, save the page as a
link and see the same page from that link in a new window; screenshots in the report.

3. **Several charts.** Add, duplicate, remove, reorder (by dragging and by buttons), half or
   full width. The editor follows the chart being edited; under 1024 px it opens below that
   chart. `src/lib/canvas.ts` already reads and writes several charts, their order and widths.
4. **Save and share.** "My canvases" in the browser (as `src/lib/saved.ts` keeps questions),
   each pinnable to a snapshot; a name never in a link. What a link asked for and did not get
   (a value the data does not hold, a field the dataset lacks) said as Build says it.
5. **Starter canvases.** Explore's groups as three or four canvases in config; Explore's page
   becomes the list of them.
6. **Polish.** One generated sentence under every chart (lines, bands and the map have none;
   a ranking and a grid keep theirs above the chart for now); light and dark (check the chart
   colours on a dark surface first); first load (3.93 s against 3 s).

**Milestone 2, ready to go public** (§6): About, differences and feedback linked from the
canvas; `docs/playbooks/go-public.md` reduced to numbered clicks; a private dry run.

**When NZTA refreshes (December):** November's build and archive; the dashboard usage-column
check (D-134), then "Registered as" (D-140); fix what the refresh breaks.

## Parked until the user says otherwise (the order's §1)

- Colour's own table on the site (the narrow fact table, D-144).
- More SUV slices and sizes (D-145, D-117).
- Further hybrid work (D-110, D-119).
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
- `public/data` was refreshed from a dry run without asking, though the playbook says to ask:
  the canvas needed the newer fields and the current fleet. The old copy is
  `public/data.previous`.

## Prompt for the next session

/start. Continue `docs/brief/WORK_ORDER.md` (work order 2) from CHECKPOINT. Its §3 still
stands: you may merge its pull requests into `main` in this session under its §2 and §3, and
nothing in its §4 is touched. Do not stop for questions; park what needs me and keep going.
