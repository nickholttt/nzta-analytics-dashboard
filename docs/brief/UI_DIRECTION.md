# The public site's UI: the user's direction of 2026-11-27

The user's three messages of 2026-11-27, unchanged, below the first line. They sit over
`docs/brief/WORK_ORDER.md` (work order 3) wherever the two disagree. What follows them is claude's
reading and the state of the work, each marked as such.

---

> The site vcore.co.nz has been registered for this site. I will set up as directed. Right now nothing we
> have made so far will be uploaded to vcore. we need to build a perfect ui with intention. all we have
> done so far is prove the engine, but its still not perfect

> Document the same design tokens/style as the vstat site we ripped (not our clone), then use impeccable
> skill to audit, review, and critique the UI and UX. I also like the look of how https://ui.shadcn.com/
> looks with graphs

> The shadcn site isnt loading right for you, its a massive repo of design references. You need you need
> to find another way to look at it

---

## Claude's reading (unreviewed; each line can be reversed by the user)

1. The site built so far is the engine's proof. It is not published. The public site at `vcore.co.nz` is a
   new UI, designed before it is built.
2. Work order 3's date (public-ready by 12 December 2026) no longer governs going public: inferred, confirm.
   Lane A's remaining polish of the current screens stops, and lane C's switch waits for the new UI. The
   engine lanes (B, D, E's classification) carry on as queued: "its still not perfect" is read as the engine
   too.
3. The look the user wants is stock shadcn/ui (Geist, neutral greys, soft cards, its chart conventions),
   which is also what the MTA's vstat is built on. shadcn/ui is open source; the MTA's colours, logo and
   wording are not ours to use.
4. "impeccable" is not a skill installed for this session. The audit and critique were done with the
   installed design critique and accessibility review skills, by a reviewer that had not seen the author's
   reasoning.
5. The site's name is read as "vcore": inferred from the address, confirm how it is written.

## Where it has got to (2026-11-27)

- **Nothing in `src/` has changed.** No design is accepted yet.
- A working proposal exists outside the repository, as a private page and a folder on the maintainer's
  computer: three screens (the market page, a brand page, the canvas) at phone and desktop width in both
  themes, drawn with the October 2026 build's figures, with the audit of the current site, the principles,
  what stays and a build order of eight pull requests.
- The proposal was reviewed once, independently: every text colour pair passes 4.5 to 1; 16 findings, of
  which the cheap ones are fixed in the proposal and four are left for the build (a light and heavy vehicle
  switch, change in vehicles as well as per cent, brand share over time, one colour per value on every page).
- vstat's tokens and style, read from its stylesheet as mirrored on 25 November, are written up in the
  private study folder beside the earlier design notes, with stock shadcn's for comparison.

## What the proposal keeps from `CLAUDE.md`

Every invariant, the six shapes and the rule table, sentences from templates, no vehicle row in the browser,
no tracking and no third-party requests (the site serves its own type), existing canvas and Build links, and
the first chart inside 3 seconds on the phone profile. Nothing in it needs a change to a hard rule. Two
things it changes that a record will be written for when the first build pull request opens: the typefaces
(Geist in place of the two now shipped) and direction shown by an arrow in ink, not by green and red.
