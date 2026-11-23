# Playbook: test the site with people who are not analysts

The kit is in `docs/visitor-test/` (work order 3, lane C item 4):

- `script.md`: one page for the person running the session: what to say, the five tasks, what
  counts as a pass.
- `form.md`: one sheet per person, to note where they got stuck.

The user picks the people and runs the sessions. **No one has been tested yet**, and nothing
here says any task passes.

## Why these five tasks

The site is for people who do not work with data (`CLAUDE.md`). The brief's measure
"Answerable" is that 4 of 5 such people answer each starter question unaided, in under a
minute, and say correctly what the figure counts (`docs/brief/MASTER_BRIEF.md` §1 and §2).
The kit takes four of the brief's ten starter questions (1, 2, 4 and 9) and the acceptance
question. The other six can be swapped in; the brief's table says which the site can answer.

## Where to run it

The public site once `docs/playbooks/go-public.md` is done. Until then, a local build on the
user's laptop (`docs/playbooks/local-ui-dev.md`), and for the phone half, the same build
opened from a phone on the same network.

## Turning the forms into work

1. List each finding once, with how many people hit it and on which task.
2. Fix what is cheap and plainly wrong (a word, a tap target, a missing label). Each fix names
   the finding in its pull request.
3. Queue the rest in `docs/CHECKPOINT.md`, each with its evidence: who (by number), which
   task, what they said.
4. Write the measure's first real number into `docs/brief/MASTER_BRIEF.md` §1 only after the
   sessions have run.

Two things the kit cannot show in one session: that a saved canvas redraws by itself on the
next month, and that a pinned one keeps its figures. Both need a second snapshot.
