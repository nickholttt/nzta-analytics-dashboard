# Work order 3: the user's additions of 2026-11-25

The user's message of 2026-11-25, unchanged, below the line. It answers the questions of that day's
report (D-154), adds items 5 to 7 to lanes B and D, and opens lane E. It sits under
`docs/brief/WORK_ORDER.md`, whose rules it keeps. The earlier message of the same day (Market type and
its test) is quoted in D-154.

---

/start. Continue docs/brief/WORK_ORDER.md (work order 3) from CHECKPOINT.
Merge rules as before. Do not stop for questions; park what needs me.

ANSWERS TO YOUR LAST REPORT
1. Confirmed: the two dashboard datasets become one "New registrations"
   covering the five vehicle types (passenger car/van, goods, bus, motor
   caravan, special purpose), new and used, with vehicle type as a
   filter. Old links keep working. Update the guard, starters, sentences
   and Differences page; show before and after against every published
   figure.
2. Motor caravans up to 3,500 kg are Light commercial: the industry files
   them under their base vehicle, and NZTA's class agrees. Special
   purpose vehicles up to 3,500 kg follow their NZTA class (NA → Light
   commercial). Anything left stays Other. Re-run the comparison table.
3. Passenger models the SUV file does not classify get their own Market
   type value, "Not yet classified". The comparison with published
   "passenger including SUV" figures sums Passenger, SUV and Not yet
   classified.
4. Hold first load: the canvas's first chart must not get slower than
   3.0 s on the throttled profile; add it to the performance check.

STILL TO DO FROM BEFORE (my earlier message did not reach you)
5. Figures as first observed: from November 2026, keep each month as
   first seen in that month's dashboard export, and track later changes as
   revisions on /status. When December's export lands, compare it with
   the 14 November export month by month and report what each past month
   lost or gained, and of what kind.
6. Draft a short email for me to StatisticalAnalysis@nzta.govt.nz asking
   what is removed from past months on the registrations dashboard and
   whether figures as first published are kept, with our measured gaps as
   evidence. Do not send it.
7. When the GVM retake lands (lane D), apply Market type to true
   registrations and guard light and heavy commercial.

THEN LANE E, IN ORDER
8. Classification review queue. After each build, list nameplates with
   no class and 20+ registrations in the last 3 months, low-confidence
   rows, and nameplates whose register fields conflict with
   model_segment.csv (NZTA class MC marked as a car, a UTILITY body
   registered as passenger, a van with 10+ seats). An agent proposes a
   class with public evidence (the maker's NZ site first); I approve in
   one batch. Tie-break rule in docs: maker's NZ category, then body type
   and NZTA class, then a recorded low-confidence judgement. Start with
   the highest-volume nameplates in "Not yet classified". Target 98% of
   the last 12 months' new passenger registrations classified; show
   coverage on /status.
9. A latest-month page as the home page's first section: the month's
   total and change on a year ago, new versus used, top brands and models,
   largest movers, the powertrain and market-type split. All generated
   from templates, each figure linked to its definition, each chart
   opening in the canvas.
10. Findability: a sitemap, and static generated pages per brand and per
   model above a minimum volume (a sentence, a small table, a link into
   the canvas). Check page weight against the budget.
11. Used imports in the accuracy guard: the Vehicle Importers
   Association's public monthly figures, read from its own pages, with the
   same rules as the MIA rows.
12. Range-extended EVs as a value a visitor can ask for, apart from
   plug-in hybrids.
13. docs/playbooks/monthly.md: every monthly task in order, with what is
   automated and what needs me, so a month takes me 15 minutes.
