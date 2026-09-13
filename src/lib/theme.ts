// Chart colours and chart chrome. Plot writes colours into SVG attributes, which cannot read CSS custom
// properties, so they live here. The surface, ink and rule values mirror src/styles/site.css and must
// change with it. Nothing here names a domain value: each renderer decides which series takes which
// slot (the mix chart: colour_slots_by_trailing in config/presets.json).

// Eight line colours, validated with the dataviz skill's validate_palette.js on the paper surface with
// --pairs all, because lines cross and any two can meet: worst colour-blind separation dE 8.9 (target 8),
// worst normal-vision dE 16.7 (floor 15), every colour at least 3:1 against paper. The order is part of
// the validation: every prefix is as distinct as it can be, so a two-series chart gets the two most
// distinct colours. Re-run the validator before changing any value or the order.
//
// Why eight and not fourteen: no set of colours can carry fourteen lines. A search over every in-gamut
// colour in the lightness band finds at most nine that stay distinguishable under colour blindness when
// all pairs count; at fourteen the best achievable separation is dE 6.6 colour-blind and 12.8 normal.
// Series past the eighth are drawn as grey context lines, named in the key and the tooltip.
export const SERIES = ["#3049ba", "#ec5a79", "#a37f03", "#872884", "#236e43", "#8b6ec2", "#089f99", "#b82e02"];

export const PAPER = "#f8f7f3";
export const PAPER_2 = "#f0eee8";
export const INK = "#1b1c1f";
export const INK_2 = "#4b4d53";
export const INK_3 = "#6b6d73";
export const RULE = "#e2dfd6";
export const RULE_STRONG = "#c9c5ba";

// The remainder is what is left over, not a competitor: neutral ink, never a palette colour.
export const REMAINDER = INK_3;
// Series beyond the palette: present, named on hover and in the key, but recessive.
export const CONTEXT = "#bdb9ae";
// Months under a suppression guard: a quiet line over a quiet band, drawn rather than dropped.
export const SUPPRESSED_LINE = "#cfcbc1";
export const SUPPRESSED_BAND = "#ecebe6";
// A windowed event's active period.
export const EVENT_WINDOW = "#eee3c6";

export const FONT_TEXT = "'IBM Plex Sans Variable', 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";

export const LINE_WIDTH = 2;
export const THIN_LINE_WIDTH = 1.25;

export const plotStyle = {
  fontFamily: FONT_TEXT,
  fontSize: "12px",
  color: INK_3,
  background: "transparent",
  overflow: "visible",
};

export const tipStyle = { fill: PAPER, stroke: RULE_STRONG, fontSize: 12, textPadding: 8 };

// Lead charts carry the page, so they are taller for the same width. Heights are clamped so a wide
// screen does not produce a letterbox and a narrow one keeps a readable plot.
export function chartHeight(width: number, lead = false) {
  const [ratio, min, max] = lead ? [0.44, 300, 500] : [0.34, 240, 380];
  return Math.round(Math.max(min, Math.min(max, width * ratio)));
}

export const xTicks = (width: number) => Math.max(3, Math.floor(width / 110));

export const seriesColour = (index: number) => (index < SERIES.length ? SERIES[index] : CONTEXT);
export const hasOwnColour = (index: number) => index < SERIES.length;
