// What the site draws for every question it can form, read from the real modules: for each preset in the canon (each
// granularity, each period the time row can name) the shape, the resolver's verdict and the periods that turn it into a
// ranking, and for each question the Build page can form, on each dataset it offers (each measure, each breakdown it
// offers, no chosen values, one and two) the shapes it may be switched between and what each chart is drawn as, with the
// resolver's verdict. tests/site/shape-defaults.test.ts compares this with tests/site/fixtures/shape-defaults.json, so a
// change to how a shape is chosen, or a pin that stops fitting, shows as a difference a reviewer reads.
import "./register.mjs";

const config = await import("../../../src/lib/config.ts");
const data = await import("../../../src/lib/data.ts");
const resolve = await import("../../../src/lib/resolve.ts");
const builder = await import("../../../src/lib/builder.ts");

type Entry = { kind?: string; parts?: string[]; derived?: boolean; id: string; dimensions: Record<string, string> };
export type BuildQuestion = { key: string; question: import("../../../src/lib/builder.ts").Question };

// A build in which every dimension is live, with every pair and a fact table, for every dataset that holds counts. The
// resolver's verdict on a question is then its own (a pin that does not fit, a shape with no renderer), not a build's
// coverage, which the pipeline decides and a test cannot know.
export function everythingBuilt() {
  const dimensions = config.dimensions.map((d) => d.id);
  const pairs = dimensions.flatMap((a) => dimensions.filter((b) => b !== a).map((b) => `${a}${data.PAIR_SEPARATOR}${b}`));
  const entry = { live_dimensions: dimensions, live_pairs: pairs, facts: { dimensions } };
  const held = config.datasets.filter((d) => !d.base && (d.grain === "flow" || d.grain === "survivors"));
  return { datasets: Object.fromEntries(held.map((d) => [d.id, entry])) } as unknown as import("../../../src/lib/data.ts").Manifest;
}

// The breakdowns a built measure offers: its own, or for a measure made of parts the ones every part offers.
function offeredBy(m: Entry): string[] {
  if (!m.parts) return Object.keys(m.dimensions);
  const parts = m.parts.map((id) => config.builderSpec.measures.find((x) => x.id === id) as Entry);
  return Object.keys(parts[0].dimensions).filter((d) => parts.every((p) => d in p.dimensions));
}

// Every question the Build page can form, on every dataset it offers: each measure, each breakdown it offers (and none,
// where the measure can be asked of all vehicles together), with no values chosen, one and two.
export function buildQuestions(): BuildQuestion[] {
  const list: BuildQuestion[] = [];
  for (const dataset of config.builderSpec.datasets) {
    for (const m of config.builderSpec.measures as unknown as Entry[]) {
      const measure = config.findMeasure(m.id) as unknown as Entry | undefined;
      const total = !m.parts && !m.derived && measure?.kind === "count";
      for (const by of [...(total ? [null] : []), ...offeredBy(m)]) {
        for (const picked of by && !m.derived ? [0, 1, 2] : [0]) {
          list.push({ key: `build ${dataset} ${m.id} ${by ?? "-"} picked=${picked}`, question: { dataset, measure: m.id, by, values: ["a", "b"].slice(0, picked), where: {}, view: null } });
        }
      }
    }
  }
  // The same questions with a second breakdown: each breakdown crossed with the next one the measure offers that can be crossed with it, as a grid.
  for (const dataset of config.builderSpec.datasets) {
    for (const m of config.builderSpec.measures as unknown as Entry[]) {
      if (m.derived) continue;
      const offered = offeredBy(m);
      offered.forEach((by, at) => {
        const by2 = [...offered.slice(at + 1), ...offered.slice(0, at)].find((d) => builder.canCross(by, d));
        if (by2) list.push({ key: `build ${dataset} ${m.id} ${by}+${by2} picked=0`, question: { dataset, measure: m.id, by, values: [], by2, values2: [], where: {}, view: null } });
      });
    }
  }
  return list;
}

export function observe(): Record<string, string> {
  const out: Record<string, string> = {};
  const manifest = everythingBuilt();
  const drawn = (p: ReturnType<typeof builder.builderPresets>[number]) => {
    const resolution = resolve.resolvePreset(p, manifest);
    return `${resolution.shape} ${resolution.status}`;
  };
  for (const p of config.presets) {
    for (const g of p.granularity_options?.map((o) => o.id) ?? [null]) {
      out[`explore ${p.id} ${g ?? "-"} ranking`] = resolve.rankingPeriods(resolve.presetView(p, g)).join(",");
      for (const period of [undefined, ...config.periods.map((x) => x.id)]) {
        out[`explore ${p.id} ${g ?? "-"} ${period ?? "default"}`] = drawn(resolve.presetView(p, g, period));
      }
    }
  }
  for (const { key, question } of buildQuestions()) {
    const views = builder.viewsFor(question);
    out[`${key} views`] = views.join(",");
    for (const view of [null, ...views]) {
      out[`${key} view=${view ?? "-"}`] = builder
        .builderPresets({ ...question, view })
        .map((p) => `${drawn(p)} ${p.period} ranking[${resolve.rankingPeriods(p).join(",")}]`)
        .join(" | ");
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}
