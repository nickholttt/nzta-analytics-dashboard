// The parts of a config file the browser reads. A config file the browser reads only in part is cut to these keys in the client build
// (astro.config.mjs), so what the browser downloads is what it uses and not the whole file: the pipeline's own paths, thresholds and
// schedules are most of config/pipeline.json and are of no use to a page. The build that makes the pages (and every test) reads the whole file.
// The key of an entry is the file's path from the repository root; the keys are the file's top-level keys. A reader that takes another key
// must add it here (tests/site/browser-config.test.ts reads src/lib/config.ts for the keys it takes and fails when one is missing).
export const BROWSER_PARTS = {
  "config/pipeline.json": ["hybrid_classification", "events"],
};

// The document with only the keys named, in the order the file has them. A key the file lacks is an error: a part renamed in the file must not
// leave the browser with nothing where it reads it.
export function cutConfig(doc, keys, file = "the file") {
  const missing = keys.filter((k) => !Object.hasOwn(doc, k));
  if (missing.length) throw new Error(`${file} has no key ${missing.join(", ")}, which the browser reads (scripts/browser-config.mjs)`);
  return Object.fromEntries(Object.entries(doc).filter(([k]) => keys.includes(k)));
}
