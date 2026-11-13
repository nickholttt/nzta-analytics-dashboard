# Playbook: test the site with people who are not analysts

CHECKPOINT queue item 9. The site is for people who are not data analysts (`CLAUDE.md`), so the test is whether
such people can answer the brief's kind of question unaided, and what they take away. The user picks and runs the
sessions; an agent turns the notes into fixes or queue items.

## Setup

- Three to five people who do not work with data. One at a time, about 20 minutes each.
- The site: the deployed preview once item 8 is done; until then the local dev server (`docs/playbooks/local-ui-dev.md`)
  on the user's laptop.
- Half the sessions on a phone, half on a laptop.
- Start each person on `/`. Do not explain the site, the charts or the words. Ask them to think aloud.

## Tasks

Read each aloud as written. Note how long it takes, the first place they go, and what they answer.

1. "How has the share of battery electric vehicles grown since they first appeared?"
2. "Over the last ten years, have more of the brands we register come from Chinese-owned companies?"
3. "Do more vehicles arrive new or second-hand than ten years ago?"
4. "Which brands have gained the most ground over the last year?"
5. "Make a chart of the share of vehicles by engine size over the last five years."
6. "Where do the owners of vehicles registered in the last year live?"

Then ask: "What does one of these charts count: sales, registrations, or something else?" (the site counts vehicles
first registered in a month that are still registered today, not sales).

## What to watch for

- Wrong turns: Explore against Build, the time row, "Show by", "Change this chart".
- Misreadings: a share read as a count; survivors read as sales; a 12-month rolling share read as a single month;
  greyed months, "All other", "Not recorded" or event markers taken for something they are not.
- Words they stop at or skip.
- On a phone: anything that is hard to tap, or that they scroll past.

## Record

One row per person and task:

| person | task | answered? (alone / with help / no) | time | what they said | misreadings or stumbles |
|---|---|---|---|---|---|

Then list each finding once, with how many people hit it. An agent fixes what it can and queues the rest in
`docs/CHECKPOINT.md`, each with the evidence (who, which task, what they said).
