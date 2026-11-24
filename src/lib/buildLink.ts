// A link made for the Build page, as the canvas address that opens the same chart. The canvas is the only builder: a chart on it is a Build
// question under an id of its own (src/lib/canvas.ts), so a Build link needs only its parameters renamed. This module is pure and imports
// nothing, so the page that sends a visitor on (src/pages/build.astro) carries a few hundred bytes of script, not the site's config; what
// it needs to know of config comes in as rules (src/lib/buildLinkRules.ts). It names no field, measure, dataset or value.

export type BuildLinkRules = {
  // The Build page's scope in an address (`build.by`), and the canvas's scope, with the prefix of a chart's id (`c1`).
  from: string;
  canvas: string;
  prefix: string;
  // The view that ranks: a question of two parts is one chart in it (a ranking has both in one table), and in a grid.
  ranking: string;
  // For each measure drawn as one chart for each of its parts, the parts, in the order Build drew them.
  parts: Record<string, string[]>;
  // The names of a chart's own settings (a time range, a month): the Build page kept the first part's under its own scope and a later part's
  // under the scope with the part's id.
  settings: string[];
};

const MEASURE = "measure";
const VIEW = "view";
const SECOND = "by2";
const SIZE = "size";
const FULL = "full";
const CHARTS = "charts";

// The query string, with its `?`, of the canvas that holds the chart or charts the Build link draws: its question, its settings, a pin, and
// the view it chose, which the canvas reads as the chart type where the question still has that view (src/lib/canvas.ts, settleChart). A Build link with no parameter of Build's is the Build page's own opening question, which is the canvas's: no
// query. What the link names that the data lacks is not judged here: the canvas settles it as it settles any link and says what it left out.
export function canvasSearchFromBuild(search: string, rules: BuildLinkRules): string {
  const params = new URLSearchParams(search);
  const scope = `${rules.from}.`;
  if (![...params.keys()].some((k) => k.startsWith(scope))) return "";
  const view = params.get(`${scope}${VIEW}`) ?? "";
  const parts = rules.parts[params.get(`${scope}${MEASURE}`) ?? ""];
  // One chart for each part, as the Build page drew them, unless the question is a ranking or a grid, which draw the first part alone.
  const drawn = parts && view !== rules.ranking && !params.get(`${scope}${SECOND}`) ? parts : parts ? [parts[0]] : [undefined];
  const ids = drawn.map((_, i) => `${rules.prefix}${i + 1}`);
  const out = new URLSearchParams({ [`${rules.canvas}.${CHARTS}`]: ids.join(",") });
  drawn.forEach((measure, i) => {
    const id = ids[i];
    if (measure !== undefined) out.set(`${id}.${MEASURE}`, measure);
    for (const [key, value] of params) {
      if (key.startsWith(scope)) {
        const name = key.slice(scope.length);
        // The question is the same for every part, but each part is a measure of its own; the first part's settings are the page's own and a
        // later part has its own below.
        const own = name === MEASURE ? measure === undefined : i === 0 || !rules.settings.includes(name);
        if (own) out.append(`${id}.${name}`, value);
      } else if (i > 0 && key.startsWith(`${rules.from}-${drawn[i]}.`)) {
        const name = key.slice(rules.from.length + 2 + (drawn[i] as string).length);
        if (rules.settings.includes(name)) out.append(`${id}.${name}`, value);
      }
    }
    // The Build page drew a chart across the page.
    if (ids.length === 1) out.set(`${id}.${SIZE}`, FULL);
  });
  return `?${out}`;
}
