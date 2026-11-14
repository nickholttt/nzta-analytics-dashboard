# Playbook: test the site with people who are not analysts

CHECKPOINT queue item 9; `docs/brief/MASTER_BRIEF.md` §1 (the "Answerable" measure) and §2 (the starter questions and
the acceptance question). The site is for people who do not work with data (`CLAUDE.md`), so the test is whether such
people can answer these questions unaided and say what the figure counts. The user picks and runs the sessions; an
agent turns the notes into fixes or queue items. **No question has been tested.** Nothing here says any passes.

## Setup

- Five people who do not work with data. The measure is "4 of 5" (brief §1). One at a time, about 20 minutes each.
- The site: the deployed site once `docs/playbooks/go-public.md` is done; until then the local dev server
  (`docs/playbooks/local-ui-dev.md`) on the user's laptop.
- Half the sessions on a phone, half on a laptop.
- Do not explain the site, the charts or the words. Ask the person to think aloud. Time each question from the
  moment you finish reading it.

## What counts as a pass

A person passes a question when all three are true:

1. **Unaided**: they got to an answer without you pointing, hinting or reading the page to them.
2. **Under a minute**: from the end of the question to a stated answer.
3. **They say correctly what the figure counts**: asked "what is that figure counting?", they say, in their own
   words, what the page says (for example vehicles first registered in a month and still registered at the snapshot,
   not sales). A right number with a wrong account of what it counts is a fail.

A question passes overall when 4 of 5 people pass it. A question marked "not answerable today" is read aloud anyway:
the pass is that the person finds the page says so, and does not read a different figure as the answer.

## The questions

The page to start from is where you put the person. Start everyone on the page shown, without naming it. The
"Today" column is the brief's reading (§2, as of 2026-11-14) of whether the site can answer it; re-check it against
`docs/brief/MASTER_BRIEF.md` before each round.

| # | Say aloud | Start from | Today (brief §2) |
|---|---|---|---|
| 1 | "How many vehicles were registered last month, and is that up or down on a year ago?" | `/` (Explore) | Partly: survivors, not registrations |
| 2 | "Which brands lead, and who is gaining or losing?" | `/` | Yes |
| 3 | "How is one brand doing, against another?" | `/` | Yes, in Build |
| 4 | "What share are electric, plug-in and hybrid vehicles now, and how has that changed?" | `/` | Yes, once #28 lands |
| 5 | "Which models lead?" | `/` | No: blocked |
| 6 | "Are SUVs taking over from cars?" | `/` | No: SUVs count as cars |
| 7 | "Who is buying: households, businesses, rental fleets?" | `/` | No: not bound |
| 8 | "Where do used imports come from, and how old are they?" | `/` | Partly |
| 9 | "What is happening in my region?" | `/` | Partly: Build only |
| 10 | "How old is the fleet, and how long do vehicles last?" | `/` | No: not built |
| A | The acceptance question, read as written: "Among Ford, Toyota and BYD only, which brand has the most registrations, for one chosen powertrain and one chosen vehicle segment?" | `/build` | Partly: see the brief's measure "Bends" |

For A, also check the brief's four conditions on the answer: it draws at 320 px and at 1280 px, it can be shared as
a link, it downloads as CSV, and it redraws by itself on the next snapshot. The last cannot be seen in one session:
record it as untested until a second snapshot exists. Then ask A again with another field swapped in for powertrain
or segment, as the brief says.

After each question ask: "What is that figure counting?" (the site counts vehicles first registered in a month that
are still registered today, not sales, unless the page says otherwise).

## What to watch for

- Wrong turns: Explore against Build, the time row, "Show by", "Change this chart".
- Misreadings: a share read as a count; survivors read as sales; a 12-month rolling share read as a single month;
  greyed months, "All other", "Not recorded" or event markers taken for something they are not.
- Whether they find the pages that explain the figures: `/method`, `/caveats`, `/differences`.
- Words they stop at or skip.
- On a phone: anything hard to tap, or that they scroll past.

## Record

One sheet per person. Copy this table, one row per question. Time in seconds. For "unaided", "says what it counts" and
"pass", write Y or N.

| person | device | # | unaided (Y/N) | seconds | said what it counts (Y/N) | pass (Y/N) | what they said | stumbles |
|---|---|---|---|---|---|---|---|---|
| | | 1 | | | | | | |
| | | 2 | | | | | | |
| | | 3 | | | | | | |
| | | 4 | | | | | | |
| | | 5 | | | | | | |
| | | 6 | | | | | | |
| | | 7 | | | | | | |
| | | 8 | | | | | | |
| | | 9 | | | | | | |
| | | 10 | | | | | | |
| | | A | | | | | | |

Then a summary table, filled after the last person:

| # | people who passed (of 5) | meets 4 of 5? |
|---|---|---|

List each finding once, with how many people hit it. An agent fixes what it can and queues the rest in
`docs/CHECKPOINT.md`, each with the evidence (who, which question, what they said). The measure's first real number
goes in `docs/brief/MASTER_BRIEF.md` §1 only after the sessions have run.
