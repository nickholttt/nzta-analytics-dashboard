---
# Status: proposed on 2026-11-27. Recorded from the design proposal's prototype, kept outside the
# repository. Not yet accepted by the owner and not yet applied to src/.
name: vcore
description: Proposed design system for the vehicle registration analytics site, recorded from the design proposal's prototype.
colors:
  # Light theme (the base values)
  bg: "#fafafa"
  surface: "#ffffff"
  surface-2: "#f0f0f0"
  ink: "#0a0a0a"
  ink-2: "#404040"
  ink-3: "#6b6b6b"
  line: "#e5e5e5"
  line-strong: "#c4c4c4"
  control: "#8a8a8a"
  series-1: "#155dfc"
  series-2: "#ec5a79"
  series-3: "#a37f03"
  series-4: "#872884"
  series-5: "#236e43"
  series-6: "#8b6ec2"
  series-7: "#089f99"
  series-8: "#b82e02"
  # Dark theme
  bg-dark: "#0a0a0a"
  surface-dark: "#171717"
  surface-2-dark: "#262626"
  tab-on-dark: "#404040"
  ink-dark: "#fafafa"
  ink-2-dark: "#d4d4d4"
  ink-3-dark: "#a1a1a1"
  line-dark: "#2a2a2a"
  line-strong-dark: "#404040"
  control-dark: "#7a7a7a"
  series-1-dark: "#6f86ee"
  series-2-dark: "#f98a20"
  series-3-dark: "#248860"
  series-4-dark: "#ae48b8"
  series-5-dark: "#e18db0"
  series-6-dark: "#b46220"
  series-7-dark: "#25bce5"
  series-8-dark: "#75b96a"
typography:
  headline:
    fontFamily: "Geist, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.625rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  figure:
    fontFamily: "Geist, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.03em"
    fontFeature: "'tnum'"
  title:
    fontFamily: "Geist, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: "Geist, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
  plate:
    fontFamily: "'Geist Mono', ui-monospace, 'Cascadia Mono', Menlo, monospace"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.14em"
  mono-figure:
    fontFamily: "'Geist Mono', ui-monospace, 'Cascadia Mono', Menlo, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
rounded:
  inner: "6px"
  sm: "8px"
  card: "14px"
  pill: "999px"
spacing:
  control-gap: "8px"
  gutter: "16px"
  card-y: "14px"
  card-x: "20px"
  grid-gap: "20px"
  section: "36px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 13px"
    height: "36px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 13px"
    height: "36px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "14px 20px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 12px 0 34px"
    height: "36px"
  select:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 28px 0 10px"
    height: "34px"
  segmented:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "3px"
  segmented-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    padding: "3px 11px"
  field-picker:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-3}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 10px 0 12px"
    height: "40px"
  chart-type-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "40px"
  chart-type-tile-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
  count-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "11px 14px 12px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 6px 3px 9px"
  plate:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.plate}"
    rounded: "5px"
    padding: "0 9px 0 10px"
    height: "30px"
---

# Design System: vcore

This file records the proposed system. It was read off the design proposal's prototype, kept outside the
repository, on 2026-11-27. The owner accepted the design that day ("Im happy with the initial design"; "go
for now, it looks good enough"; D-163). It is not yet applied to `src/`. The site
as it stands ships a different look (a serif and IBM Plex Sans on warm paper, in `src/styles/site.css` and
`src/lib/theme.ts`). Until lane F's pull requests replace it, that code is the live system and this file is
the plan for its replacement. The name "vcore" is inferred from the site's address; how it is written is
not confirmed.

## Overview

**Creative North Star: "A canvas someone started for you"**

Every page is a set of cards that answer to the visitor. One bar says what the whole page counts and for which month, and each card states its answer and then offers its own controls, so any block can be asked another way where it stands. The look is stock shadcn/ui, which the owner pinned ("I also like the look of how https://ui.shadcn.com/ looks with graphs"): Geist, neutral greys with black as the primary, white cards with a soft edge. Geist is therefore deliberate, not a default.

The interface is grey and black so that the data can be the only colour. A series colour means a value in the data and nothing else. Direction is a small drawn arrow in ink. Words about the data are generated from templates and say what the figures show, never why.

Density is that of a working dashboard: 15px body text, 13px labels, compact controls at desktop width, and 44px touch targets at phone width. The one mark of its own is the wordmark, set as a New Zealand number plate.

**Key Characteristics:**
- Neutral greys and black for everything that is not data.
- Eight series colours per theme, used only for values in the data.
- One typeface, Geist, with Geist Mono for the plate and for figures in chart tooltips.
- White cards (14px radius) with a 1px edge and a faint shadow, on a near-white page.
- Every card carries its answer as a sentence, its own controls, its evidence, and its source, in that order.
- Selected means filled with ink; unavailable means a dashed edge and a one-line reason.
- Light and dark themes, and a layout that holds at 320px wide.

## Colors

A neutral grey scale carries the whole interface; colour appears only where it stands for a value in the data. All values are in the frontmatter. Each token has a light value and a dark value (the keys ending `-dark`).

### Primary
- **Ink** (`ink`, #0a0a0a light, #fafafa dark): the primary. Body text, headings, the primary button's fill, the selected state of segmented controls and chart-type tiles, the focus ring, the text selection, and the direction arrows.

### Secondary
- **Series 1 to 8** (`series-1` to `series-8`): the data palette. Blue leads (`series-1`): it draws a lone series, a ranked list's bars, and the first of several series. The rest are taken in order. A colour belongs to a value, not to a position on a chart: the five powertrain groups hold slots 1 to 5 on every page, and a brand in a comparison keeps its slot when another is removed.
- The dark set is a separate set of eight, not the light set lightened. A slot's hue can differ between themes (slot 2 is rose in light and orange in dark).
- Checks so far: the light set passed a colour-blind separation check on all pairs. The dark set passed separation, but four of its eight colours sit slightly outside that checker's lightness band on the dark card and are to be re-stepped when the charts are built. Every series colour is at least 3:1 against its card in both themes.

### Neutral
- **Page** (`bg`): the page behind the cards, and the text colour on ink fills.
- **Card** (`surface`): cards, controls, menus, tooltips.
- **Hover and inset** (`surface-2`): hover fills, the current destination in the top bar, the trough of the small segmented control.
- **Raised tab** (`tab-on-dark`): the selected option of the small segmented control in the dark theme. In light it is the card colour.
- **Secondary ink** (`ink-2`): supporting text, control labels at rest, legend text.
- **Quiet ink** (`ink-3`): captions, axis text, source lines, placeholders. Measured against its backgrounds at 4.68:1 to 5.33:1 in light and 5.86:1 to 7.66:1 in dark, so every text token passes 4.5:1.
- **Hairline** (`line`): card edges, row dividers, chart grid lines.
- **Rule** (`line-strong`): the heavier divider under table headings and above page sections, chart baselines, menu and tooltip edges.
- **Control edge** (`control`): the edge of every control at rest, darker than a hairline so a control reads as a control. On hover the edge becomes ink.

### Named Rules
**The Colour Is Data Rule.** A hue appears only where it stands for a value in the data: a line, a bar, a legend swatch. Controls, states, links, headings and emphasis are grey or ink.

**The Arrow In Ink Rule.** Direction is a small filled triangle in the text colour beside the figure, with "up" or "down" for screen readers. A rise is never green and a fall is never red.

**The One Colour Per Value Rule.** A value keeps its series slot across every card on a page and across pages. Removing a series does not recolour the others.

## Typography

**Display Font:** Geist (with system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Geist (the same family)
**Label/Mono Font:** Geist Mono (with ui-monospace, Cascadia Mono, Menlo, monospace), for the plate and for figures in chart tooltips only

**Character:** One plain sans at four weights (400, 500, 600, 700) does all the work. Hierarchy comes from weight and a short size scale, with slightly tightened tracking on headings and figures.

The prototype loads Geist from Google Fonts. The site makes no third-party requests, so it will serve the font files itself.

### Hierarchy
- **Headline** (600, 1.625rem, line height 1.25, tracking -0.02em; 1.4375rem at 640px and under): the page's answer sentence, or the subject's name on a brand page. One per page. Balanced wrapping, at most about 22em wide.
- **Figure** (700, 1.3125rem, line height 1.3, tracking -0.03em, tabular figures; 1.1875rem at 640px and under): the three counts under the headline, and the editor's page title at weight 600.
- **Title** (600, 1.0625rem, line height 1.4, tracking -0.01em): a card's answer sentence and section headings. Its second line, saying what is counted, is label size at weight 400 in quiet ink.
- **Body** (400, 0.9375rem, line height 1.5): running text, names in lists, top bar destinations (500).
- **Label** (500, 0.8125rem): buttons, segmented controls, chips, table cells (400), legends, notes.
- **Caption** (400, 0.75rem): control captions, table headings (500), source lines, rank moves, hints.
- **Plate** (Geist Mono 600, 1rem, tracking 0.14em, capitals): the wordmark only.

### Named Rules
**The Tabular Figures Rule.** Every number that can sit in a column or change in place uses tabular figures: counts, percentages, ranks, table cells, axis text.

**The Sentence Case Rule.** Headings, labels and buttons are sentence case with no added tracking. The plate is the only tracked capitals in the system.

## Layout

A centred column, 1200px at most, with a 16px gutter that respects the safe-area insets. The full editor widens to 1560px. Pages read top to bottom: top bar, the sticky scope bar, the answer, then cards.

- **The answer row:** two columns in a 5 to 7 ratio (36px column gap), aligned on their lower edge. Left: the headline. Right: the three count tiles. One line of small print runs full width under it. The page's first card comes next and spans both columns of the grid, with its chart and the last six points as a table side by side.
- **The card grid:** two equal columns with a 20px gap. A card can span both. Cards in a row are the same height, with the foot held to the bottom edge. Inside a wide card, a chart and its table sit side by side in a 3 to 2 ratio.
- **No stray gaps:** a card lays itself out by its own width (a container query), not the window's. Under 900px wide its chart-type tiles stretch to fill the row beside the field picker, and a line switch takes a full row of its own under 700px. At 900px and over the controls sit to the right of the sentence.
- **The editor:** three columns, a 216px field list, the card grid, and a 296px settings pane, with 16px gaps. Both panes stick below the scope bar.
- **Rhythm:** 8px between related controls, 14px by 20px inside a card, 20px between cards, 36px to 44px between page sections. No spacing custom properties exist in the prototype; these are the values it repeats.

Responsive behaviour, as built:
- **The scope bar is one row from 1024px up.** Its period control is a select on page-width bars; the segmented form appears only in the editor's wide bar at 1500px and over.
- **1240px and under:** the editor drops its field list. **1100px and under:** the editor's cards go to one column.
- **900px and under:** the answer row, the card grid and the list of starting questions go to one column. The editor's settings pane becomes a sheet that rises from the bottom edge, opened by a fixed button.
- **640px and under:** controls grow to 44px high (chart-type tiles to 48px), inputs take 16px text, the scope bar folds into one summary button that opens its controls, the field picker and the chart-type tiles go full width, card padding drops to 12px by 14px, and the less needed table columns are hidden.
- **360px and under:** the three count tiles stack, each as one row.

## Elevation & Depth

Nearly flat. Depth is shown first by tone (a white card on a near-white page, or a lighter grey card on black) and by a 1px edge. Two shadows exist, and each has one job.

### Shadow Vocabulary
- **Resting** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.05)`; 0.4 alpha in dark): cards, count tiles and editor panes.
- **Floating** (`box-shadow: 0 8px 24px rgb(0 0 0 / 0.14)`; 0.5 alpha in dark): things that sit over the page for a moment: the field picker's menu, search results, chart tooltips, the toast, the phone's edit button.
- **Selected ring** (`box-shadow: 0 0 0 1px` in ink, with an ink border): a pressed count tile and the chosen card in the editor. It is a state marker, not depth.

The scope bar is the one translucent surface: the page colour at 92% with an 8px backdrop blur and hairlines above and below, so content scrolling under it stays readable.

### Named Rules
**The Two Shadows Rule.** A surface at rest gets the resting shadow or none. Only something that floats over the page gets the floating shadow. No third level, no coloured shadow, no glow.

## Shapes

Soft rectangles at three sizes. Cards, panes and the "add a card" target take the large radius (14px). Every control takes the small radius (8px). Items inside a control or a menu, such as a menu row or a top bar destination, take 6px. Pills (999px) are for things that are tags, not controls: chips, the "only" marker, the fact tags on a brand page.

Edges are 1px. A solid edge in the control colour means "this can be used". A dashed edge means "not available here" (a chart type that does not fit, a field the data does not carry) or "empty, put something here" (a drop zone, the add target, an empty state). Legend swatches are 10px squares with a 3px radius; ranked bars are 10px high with fully rounded ends.

## Components

### Buttons
- **Shape:** 36px high, small radius (8px), 13px side padding, label type. 44px high at phone width.
- **Default:** card fill, control edge. Hover: the edge becomes ink.
- **Primary:** ink fill, page-colour text. One per group of actions ("Keep this page", "Save"). Hover: 88% opacity.
- **Icon button:** a 36px square with the same edge, for the theme switch.
- **Link button:** underlined text (1px, 3px offset, underline in quiet ink that darkens on hover), for actions in a card's source line such as "Remove".
- **Focus, everywhere:** a 2px ink outline with a 2px offset.

### Chips
- **Style:** a pill with the control edge, card fill, label type. In a comparison it leads with the series swatch and ends with a 24px round remove button (32px at phone width). The page's fixed subject has no remove button.
- **Tags:** the same pill without controls: fact tags (rule edge) and the "only" marker beside a headline (ink edge) when the page is filtered.

### Cards / Containers
- **Corner Style:** large radius (14px).
- **Background:** card colour on the page colour.
- **Shadow Strategy:** the resting shadow. See Elevation & Depth.
- **Border:** 1px hairline. Ink with the selected ring when chosen in the editor.
- **Internal Padding:** 18px top, 14px bottom, 20px sides (14px, 12px and 14px at phone width).
- **Anatomy, top to bottom:** the head, closed by a hairline: the answer first, as a title-size sentence with one quiet line saying what is counted, then the ask row (the field picker, the chart-type tiles, and where it applies a small switch for how a line is drawn). On a card 900px wide or more the ask row sits to the right of the sentence; on a narrower card it sits under it and fills the row. Then the evidence (a chart, a ranked list, a table or movers; a field with few, coloured values shows its mix as one bar above its ranking); a caption where one is owed; and the foot, always one row in caption type, closed above by a hairline: the source and "How this is counted" at the left, the card's actions ("Show 25", "Full editor", "Remove") at the right.

### Inputs / Fields
- **Search:** 36px high (44px at phone width), control edge, small radius, a 16px search icon inside the left edge. Results drop below as a floating menu of rows with a quiet kind label at the right.
- **Select:** 34px high (44px at phone width), control edge, small radius. Hover: the edge becomes ink.
- **Segmented control:** a row of options inside one control edge with 3px inner padding. The chosen option is filled with ink. A small variant has no edge and sits on the inset grey; its chosen option is raised to the card colour with a hairline ring and weight 600.
- **Field picker:** a 40px button with an ink edge reading "By" and the field's name in weight 600, with a chevron that turns when open. Its menu is 304px wide and lists each field with one caption line saying what it is, or why it cannot be asked.
- **Chart-type tiles:** 40px tiles, each a 16px line icon over an 11px label. Chosen: ink fill. Does not fit: dashed edge, quiet ink, no fill, and a one-line reason when pressed. It is never drawn.
- **Editor fields and drop zones:** a field is a 32px row with a grip icon; a zone is a dashed box holding pill "add" buttons.

### Navigation
- **Top bar:** the plate, then five destinations in body type at weight 500 (secondary ink; hover and current take the inset grey fill and ink text), then search and the theme switch at the right. At phone width the destinations take their own full-width row.
- **Scope bar:** sticky under the top bar. Four captioned controls: Month ending, Counting, Over, Only. At phone width it is one summary button reading the current choices, with "Change".
- **Breadcrumb:** label type in quiet ink, on subject pages.
- **Footer:** a small plate, the links about the data, and the source and licence line, in label type above a hairline.

### Count tiles
Three tiles under the headline carry New, Used imports and All, and switch the page between them. Each has a small radio dot and label, the count in figure type, and the change on a year earlier with its arrow. Pressed: ink edge, selected ring, filled dot.

### Ranked list
Each row is a rank number in quiet ink, the name over its bar, the count with its share beneath, and the change with its arrow. Rows are divided by hairlines. Bars are one colour (`series-1`) unless the field has fixed colours, because the label carries identity and the bar carries size. A rank move ("up 2", "new entry") sits beside the name in caption type.

### Tables
Label-size cells with tabular figures, right-aligned except the first column, which is weight 500. Headings are caption type in quiet ink over a rule; rows are divided by hairlines. A wide table scrolls inside its card. A trend column holds an 84px by 22px sparkline drawn in quiet ink with an ink end dot.

### Charts
The prototype draws line charts (one series, several series, shares over time), ranked lists, tables and movers. These marks are provisional until the six renderers are rebuilt in this system; distribution, geo and matrix are not yet drawn in it.
- **Lines:** 2px, round joins and caps, with a 4px end dot ringed in the card colour. A lone series has a soft fill beneath it in its own colour, fading from about a third opacity to nothing.
- **Curves:** monotone. The curve passes through each data point and never rises above or dips below the values either side of it.
- **Axes:** 11px tabular text in quiet ink, hairline grid lines, a rule for the baseline, year ticks along the bottom.
- **Labels:** several series are named at the line's end on wide charts, pushed apart so they never collide, and in a legend above the chart on a phone or beside a table.
- **Events:** a dashed vertical line in quiet ink with its date above, and a list of the marked events under the chart. No interpretation.
- **Reading a value:** pointing or touching shows a vertical rule and a tooltip: the month, then each series with its swatch and its figure in Geist Mono. Every chart card also offers Table as a chart type.
- **Limits seen in the build:** a chart of many values draws the five largest; a comparison holds six series at most.

### States
An empty or blocked card keeps its controls and shows a dashed box with one bold line naming the cause, one line saying what to do, and where they exist buttons that do it ("Remove the filter", "Ask by brand instead"). The toast is an ink bar at the bottom centre with page-colour text and, after a removal, an Undo.

### The plate
The wordmark is set as a number plate: capitals in Geist Mono at 0.14em tracking, a 2px edge, a 5px radius, and a fine inner line. It is 30px high in the top bar and 24px in the footer. In the dark theme the plate stays light with dark text.

### Motion
Colour, edge and shadow changes take 0.15s. When the scope bar recounts the page, the cards and count tiles fade up from 55% opacity over 0.22s. The phone's settings sheet slides in over 0.2s. Both use the same ease-out curve, `cubic-bezier(0.16, 1, 0.3, 1)`. With reduced motion set, all of it is off.

## Do's and Don'ts

### Do:
- **Do** open every card with its own controls, then its answer as a sentence, then the evidence, then the source line.
- **Do** keep hue for data. Use ink for selected, the control edge for available, and a dashed edge for unavailable or empty.
- **Do** show direction with the drawn arrow in the text colour, with "up" or "down" for screen readers.
- **Do** give a value the same series colour on every card and every page.
- **Do** use tabular figures for every number that sits in a column or changes in place.
- **Do** make controls 44px high at 640px and under, and keep the layout whole at 320px.
- **Do** build both themes from the tokens, and recheck series colours against the card in each theme (3:1 at least) and text against its background (4.5:1 at least).
- **Do** show a chart type that does not fit as a dashed, quiet tile with a one-line reason.
- **Do** take every sentence about the data from a template, and make it state what the chart beneath it draws.
- **Do** serve Geist and Geist Mono from the site itself.

### Don't:
- **Don't** use green and red, or any hue, to show a rise or a fall.
- **Don't** colour a control, a link, a heading or a state with a series colour.
- **Don't** add a seventh chart shape, or draw a shape the rule table says does not fit.
- **Don't** let a curve overshoot: no smoothing that rises above or dips below the data points.
- **Don't** add a third shadow level, a coloured shadow or a glow.
- **Don't** set labels in tracked capitals. The plate is the only one.
- **Don't** load fonts, scripts or anything else from a third party on the site.
- **Don't** write a sentence about the data by hand, or one that says why.
- **Don't** treat the dark series set as settled before it is re-stepped.
- **Don't** use the Motor Trade Association's colours, logo or wording.
