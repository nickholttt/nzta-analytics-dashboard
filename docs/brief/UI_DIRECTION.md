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

## The user's answer to the first proposal (2026-11-27, later the same day)

> 1, i need you to think of our initial goal of flexibility and giving people the power to decide. It looks
> good at the moment, but I think we can really make a difference and beat how vstat designed their platform
>
> 2, install impeccable skill again if not available or rerun all applicable skills, going from essentially
> a start to polish.
>
> 3, merge 170, 171, 172, 173, 174, 175.

## The user's acceptance (2026-11-27, a third message)

> Im happy with the initial design. do a pass which optimises views for web and desktop explicitly. It needs
> to look good on both. make sure on dekstop spacing is relevant and no weird gaps are left. [...]
>
> 1, go for now, it looks good enough.
> 2, merge 176.
> 3, install it.
>
> Also tell me how to set up cloudflare to get this site somewhat live

Claude's reading: the design and its structure are accepted for building (D-163); "for now" is read as
leave to change it later. The layout pass was done on the proposal the same day: the gaps the user marked
on a desktop screenshot (the empty end of a card's control row, the dead area beside the first chart, a
half-empty second row in a card's foot) are closed, measured at 1024, 1280 and 1440 px, with no sideways
scroll at 320, 390, 768, 1024, 1280 or 1440 px. Impeccable's hook is on for this project.

## Where it has got to (2026-11-27, end of day)

- **Nothing in `src/` has changed.** The design is accepted (D-163, over D-162); lane F builds it.
- The proposal was remade twice. In its third version every page is a canvas someone started for the
  visitor: one bar recounts the whole page (what is counted, over which period, ending in which month, only
  which powertrain); every card states its answer, then offers a field picker with a line defining each
  field and a row of chart types, and recounts where it stands; cards are added and removed with an undo;
  the page is kept in the browser; the full editor is the same card with the field list beside it. It is a
  working page outside the repository, drawn with the October 2026 build's figures.
- The Impeccable design skill was installed for the maintainer's user (no hook) and run from its first
  step: `PRODUCT.md`, the surface brief with its direction contract (`.impeccable/surfaces/`), its
  detector (6 findings, 4 fixed, 2 read as false by two reviewers), a critique (25 of 40), an audit (13 of
  20; every text colour passes 4.5 to 1), a finish review ("fix", eight material fixes), one fix batch, a
  verdict pass (seven resolved, one partial, three regressions), a second batch and a second verdict pass
  (the three regressions resolved, none new), and `DESIGN.md`.
- Open for the build: a filter on any field and a card's own condition; an address that carries the page's
  choices; a light and heavy vehicle switch (waits for data); change shown in vehicles as well as per cent;
  one colour per value from reference data. Not done: a real phone, Safari, a screen reader.
- vstat's tokens and style, read from its stylesheet as mirrored on 25 November, are written up in the
  private study folder beside the earlier design notes, with stock shadcn's for comparison.

## What the proposal keeps from `CLAUDE.md`

Every invariant, the six shapes and the rule table (a card offers only the chart types the table allows),
sentences from templates, no vehicle row in the browser, no tracking and no third-party requests (the site
serves its own type), existing canvas and Build links, and the first chart inside 3 seconds on the phone
profile. Nothing in it needs a change to a hard rule. Two things it changes, each for the owner to confirm:
the typefaces (Geist in place of the two now shipped) and direction shown by an arrow in ink, not by green
and red.
