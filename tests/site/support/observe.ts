// What the site draws for every question it can form, read from the real modules: for each preset in the canon (each
// granularity, each period the time row can name) the shape and the periods that turn it into a ranking, and for each
// question the Build page can form (each measure, each breakdown it offers, no chosen values, one and two) the shapes
// it may be switched between and what each chart is drawn as. tests/site/shapes.test.ts compares this with
// tests/site/fixtures/shape-defaults.json, so a change to how a shape is chosen shows as a difference a reviewer reads.
import "./register.mjs";

const config = await import("../../../src/lib/config.ts");
const resolve = await import("../../../src/lib/resolve.ts");
const builder = await import("../../../src/lib/builder.ts");

type Entry = { shape?: string; kind?: string; parts?: string[]; derived?: boolean; id: string; dimensions: Record<string, string> };

// The breakdowns a built measure offers: its own, or for a measure made of parts the ones every part offers.
function offeredBy(m: Entry): string[] {
  if (!m.parts) return Object.keys(m.dimensions);
  const parts = m.parts.map((id) => config.builderSpec.measures.find((x) => x.id === id) as Entry);
  return Object.keys(parts[0].dimensions).filter((d) => parts.every((p) => d in p.dimensions));
}

export function observe(): Record<string, string> {
  const out: Record<string, string> = {};
  const shapeOf = (p: ReturnType<typeof builder.builderPresets>[number]) => resolve.inferShape(p, config.findDimension(p.dimension), config.findMeasure(p.measure));

  for (const p of config.presets) {
    for (const g of p.granularity_options?.map((o) => o.id) ?? [null]) {
      out[`explore ${p.id} ${g ?? "-"} ranking`] = resolve.rankingPeriods(resolve.presetView(p, g)).join(",");
      for (const period of [undefined, ...config.periods.map((x) => x.id)]) {
        const view = resolve.presetView(p, g, period);
        out[`explore ${p.id} ${g ?? "-"} ${period ?? "default"}`] = shapeOf(view);
      }
    }
  }

  const dataset = config.builderSpec.dataset;
  for (const m of config.builderSpec.measures as unknown as Entry[]) {
    const measure = config.findMeasure(m.id) as unknown as Entry | undefined;
    const total = !m.parts && !m.derived && (measure?.shape === "trend" || measure?.kind === "count");
    for (const by of [...(total ? [null] : []), ...offeredBy(m)]) {
      for (const picked of by && !m.derived ? [0, 1, 2] : [0]) {
        const question = { dataset, measure: m.id, by, values: ["a", "b"].slice(0, picked), where: {}, view: null };
        const key = `build ${m.id} ${by ?? "-"} picked=${picked}`;
        const views = builder.viewsFor(question);
        out[`${key} views`] = views.join(",");
        for (const view of [null, ...views]) {
          out[`${key} view=${view ?? "-"}`] = builder
            .builderPresets({ ...question, view })
            .map((p) => `${shapeOf(p)} ${p.period} ranking[${resolve.rankingPeriods(p).join(",")}]`)
            .join(" | ");
        }
      }
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}
