---
version: 1
slug: "src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: ["src/pages/[...answer].astro","src/pages/canvas.astro"]
---

# Market, brand and model pages, and the canvas

Scope: the home page (the market), the generated brand, model and powertrain pages, and the canvas. Visitor
mode: Operate. Code-led: these are working screens.

Audience and job: `PRODUCT.md`, Users. The task on every page is the same: read the answer, then re-ask it.

Chosen structure, of three considered: every page is a canvas someone started for the visitor (chosen); an
ask bar first, with results as cards (not chosen: it opens empty and asks the public to phrase a query);
a persistent field rail beside every page (not chosen: heavy on a phone, and it reads as an analyst's tool).
Chosen by claude on 2026-11-27 without the decision page, from the owner's words that day: "think of our
initial goal of flexibility and giving people the power to decide". Unreviewed.

Unresolved: how the name is written; whether direction is shown by an arrow in ink (as built) or by colour;
a light and heavy vehicle switch, which waits for data.

## Direction contract

THESIS: No fixed pages. Every page is a set of cards that answer to the visitor: one bar recounts the whole
page, and each card carries two controls (by which field, drawn how) so it can be re-asked where it stands.
It refuses the category default of a report: fixed sections under a sidebar, each with its own few switches.

OWN-WORLD: Stock shadcn/ui. Geist for everything, Geist Mono for figures in tooltips and the plate. Neutral
greys with black as the primary; white cards, 14 px radius, a 1 px edge and the faintest shadow. Colour is
data only: a blue-led series palette checked for colour-blind separation. Direction is a small drawn arrow
in ink. The one mark of its own is the wordmark set as a New Zealand number plate.

STORY: The visitor reads one sentence that answers the page's question, sees New, Used imports and All side
by side, and learns from the first card that any block can be asked another way. They leave with a figure
they trust, or a page they made and kept.

FIRST VIEWPORT: Top bar (plate, five destinations, search). Scope bar: Counting, Over, Only. Left: the
answer as the page's heading, then three tiles that carry the three counts and switch between them. Right:
the first card, the trend over time, with its By and As controls in its header. The primary action is the
By control on that card.

FORM: the working dashboard of its category, made editable in place; position 1 of 3 on the list above.
seed: none (pinned) "I also like the look of how https://ui.shadcn.com/ looks with graphs"

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
