// The datasets the site's data-built pages read (config/latest_month.json for the front page's latest month, config/answer_pages.json for the
// brand, model and powertrain pages), against the manifest the public build was made from. Those pages are drawn only when their dataset is built:
// with one missing the build still exits 0 and simply makes no such pages (a cube kept from before a dataset was renamed gave a build of 11 pages
// where 347 were expected, and every other check passed). So this fails the public build instead, naming the config file and the dataset.
// Built-ins only, as check-public-build.mjs, which reads it.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PAGE_CONFIGS = ["config/latest_month.json", "config/answer_pages.json"];

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
};

// The problems with a public build's data folder (dist/data): none when it holds every dataset the page configs name and builds it.
export function pageDatasetProblems(dataFolder, repoRoot) {
  if (!existsSync(dataFolder)) return [];
  const manifest = readJson(join(dataFolder, "manifest.json"));
  if (!manifest || typeof manifest.datasets !== "object") return [`${dataFolder} has no readable manifest.json, so the pages built from it cannot be checked`];
  const problems = [];
  for (const file of PAGE_CONFIGS) {
    const dataset = readJson(join(repoRoot, file))?.dataset;
    if (typeof dataset !== "string") {
      problems.push(`${file} names no dataset`);
      continue;
    }
    const entry = manifest.datasets[dataset];
    if (!entry || entry.not_built) {
      problems.push(`${file} reads the dataset ${dataset}, which the data this site was built from does not hold: the pages it draws were not built. Rebuild the cube under this code, then build the site again.`);
    }
  }
  return problems;
}
