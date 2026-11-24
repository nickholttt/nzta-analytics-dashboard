// Chart colours and chart chrome, for each theme. Plot writes colours into SVG attributes and interpolates
// a colour scale in script, neither of which can read CSS custom properties, so they live here. The surface, ink
// and rule values of both palettes mirror src/styles/site.css, its light tokens and its two dark blocks, and
// tests/site/theme-tokens.test.ts fails if they drift. Nothing here names a domain value: each renderer decides
// which series takes which slot (the mix chart: colour_slots_by_trailing in config/presets.json). A renderer
// takes the palette of the theme that applies from usePalette (src/lib/useTheme.ts) and redraws when it changes.

// LIGHT. Eight line colours, validated with the dataviz skill's validate_palette.js on the paper surface with
// --pairs all, because lines cross and any two can meet: worst colour-blind separation dE 8.9 (target 8),
// worst normal-vision dE 16.7 (floor 15), every colour at least 3:1 against paper. The order is part of
// the validation: every prefix is as distinct as it can be, so a two-series chart gets the two most
// distinct colours. Re-run the validator before changing any value or the order.
//
// Why eight and not fourteen: no set of colours can carry fourteen lines. A search over every in-gamut
// colour in the lightness band finds at most nine that stay distinguishable under colour blindness when
// all pairs count; at fourteen the best achievable separation is dE 6.6 colour-blind and 12.8 normal.
// Series past the eighth are drawn as grey context lines, named in the key and the tooltip.
//
// DARK. The same eight slots, chosen again for the dark paper (#16171a), because a colour that holds on light paper
// does not hold on dark. Slot 1 stays the accent family (the accent is #6f86ee in dark too); the rest were found by a
// search over every in-gamut colour with lightness 0.50 to 0.74 and chroma 0.11 to 0.19 that reaches 3:1 on the raised
// paper, scored on all pairs, then ordered so every prefix is as distinct as it can be. Validated with the dataviz
// skill's validate_palette.js, --mode dark --surface #16171a --pairs all (the same method and measure as the light set,
// OKLab dE x100, Machado 2009 simulation): worst colour-blind separation dE 8.1 (target 8), worst normal-vision dE 15.2
// (floor 15), lowest contrast 3.77:1 on paper and 3.42:1 on the raised paper (floor 3). One thing differs from the
// validator's own dark defaults: its lightness band is 0.48 to 0.67, and inside it the best set found for all pairs
// reached only dE 7.7 colour-blind and 14.4 normal, so the band is widened to 0.74 and the validator's band line fails
// for four colours by design. Re-run the validator before changing any value or the order.
const SERIES_LIGHT = ["#3049ba", "#ec5a79", "#a37f03", "#872884", "#236e43", "#8b6ec2", "#089f99", "#b82e02"];
const SERIES_DARK = ["#6f86ee", "#f98a20", "#248860", "#ae48b8", "#e18db0", "#b46220", "#25bce5", "#75b96a"];

export type ThemeName = "light" | "dark";

export interface Palette {
  theme: ThemeName;
  series: readonly string[];
  paper: string;
  paper2: string;
  ink: string;
  ink2: string;
  ink3: string;
  rule: string;
  ruleStrong: string;
  // The remainder is what is left over, not a competitor: neutral ink, never a palette colour.
  remainder: string;
  // Series beyond the palette: present, named on hover and in the key, but recessive.
  context: string;
  // Months under a suppression guard: a quiet line over a quiet band, drawn rather than dropped.
  suppressedLine: string;
  suppressedBand: string;
  // A windowed event's active period: the ink, drawn at EVENT_WINDOW_OPACITY over the surface, so the band is a neutral in either theme.
  eventWindow: string;
  // The tooltip's surface and edge.
  tipFill: string;
  tipStroke: string;
  // The lowest end of a map's colour scale; the highest end is the first series colour.
  scaleLow: string;
}

const LIGHT: Palette = {
  theme: "light",
  series: SERIES_LIGHT,
  paper: "#f8f7f3",
  paper2: "#f0eee8",
  ink: "#1b1c1f",
  ink2: "#4b4d53",
  ink3: "#6b6d73",
  rule: "#e2dfd6",
  ruleStrong: "#c9c5ba",
  remainder: "#6b6d73",
  context: "#bdb9ae",
  suppressedLine: "#cfcbc1",
  suppressedBand: "#ecebe6",
  eventWindow: "#1b1c1f",
  tipFill: "#f8f7f3",
  tipStroke: "#c9c5ba",
  scaleLow: "#e3e6f3",
};

const DARK: Palette = {
  theme: "dark",
  series: SERIES_DARK,
  paper: "#16171a",
  paper2: "#1f2024",
  ink: "#ececea",
  ink2: "#c1c2c7",
  ink3: "#9a9ca3",
  rule: "#2b2d32",
  ruleStrong: "#41444b",
  remainder: "#9a9ca3",
  context: "#6b6e76",
  suppressedLine: "#686b73",
  suppressedBand: "#212328",
  eventWindow: "#ececea",
  tipFill: "#1f2024",
  tipStroke: "#41444b",
  scaleLow: "#262d4d",
};

export const PALETTES: Record<ThemeName, Palette> = { light: LIGHT, dark: DARK };

// How many series get a colour of their own, in either theme.
export const SERIES_COUNT = SERIES_LIGHT.length;

export const FONT_TEXT = "'NZVR Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";

export const EVENT_WINDOW_OPACITY = 0.06;
export const LINE_WIDTH = 2;
export const THIN_LINE_WIDTH = 1.25;

export const PLOT_FONT_SIZE = "12px";

export const plotStyle = (pal: Palette) => ({
  fontFamily: FONT_TEXT,
  fontSize: PLOT_FONT_SIZE,
  color: pal.ink3,
  background: "transparent",
  overflow: "visible",
});

export const tipStyle = (pal: Palette) => ({ fill: pal.tipFill, stroke: pal.tipStroke, fontSize: 12, textPadding: 8 });

// A chart that is not a lead has one of two heights: the narrow one up to WIDE_CHART_FROM px of width, the wide one from there. They leave a plot
// of about 220 px (phone) and 300 px (a full card) between the margins. The canvas reserves the same two heights before a figure is drawn
// (src/styles/canvas.css, .chart-reserved), so the page does not move when it arrives: change the numbers there with these.
// Lead charts carry the page, so they are taller for the same width, clamped so a wide screen does not produce a letterbox.
export const MIN_CHART_HEIGHT = 280;
export const WIDE_CHART_HEIGHT = 360;
export const WIDE_CHART_FROM = 520;
export function chartHeight(width: number, lead = false) {
  if (!lead) return width >= WIDE_CHART_FROM ? WIDE_CHART_HEIGHT : MIN_CHART_HEIGHT;
  return Math.round(Math.max(300, Math.min(500, width * 0.44)));
}

// A ranked bar is a fixed thickness with a fixed gap, so the plot grows with the number of bars and a few bars are never stretched to fill a
// height meant for many. The ends of bars (ranked, bands) are rounded by the same radius.
export const BAR_THICKNESS = 28;
export const BAR_GAP = 12;
export const BAR_RADIUS = 4;
export const barRows = (bars: number) => bars * (BAR_THICKNESS + BAR_GAP);

export const xTicks = (width: number) => Math.max(3, Math.floor(width / 110));

export const seriesColour = (pal: Palette, index: number) => (index < SERIES_COUNT ? pal.series[index] : pal.context);
export const hasOwnColour = (index: number) => index < SERIES_COUNT;
