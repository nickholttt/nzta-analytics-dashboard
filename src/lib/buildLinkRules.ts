// What the translation of a Build link (src/lib/buildLink.ts) needs from config, read where the site is built, so the page that sends a
// visitor on is handed plain data and does not carry the config itself.
import type { BuildLinkRules } from "./buildLink";
import { CHART_PARAMS, RANKING } from "./builder";
import { canvasSpec } from "./canvas";
import { builderSpec } from "./config";

export const buildLinkRules = (): BuildLinkRules => ({
  from: builderSpec.id,
  canvas: canvasSpec.id,
  prefix: canvasSpec.chart_prefix,
  ranking: RANKING,
  parts: Object.fromEntries(builderSpec.measures.flatMap((m) => (m.parts ? [[m.id, m.parts]] : []))),
  settings: CHART_PARAMS,
});
