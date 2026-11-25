// The answer pages of this build, worked out once for every page file that asks (the layout's footer, the pages themselves and the front page's
// tables): the built site runs them in one process, and the slices are read and worked through a single time. The manifest is read as the other
// published files are, from the folder the site is built from, and not imported: a checkout with no build in it (the typecheck on a pull request)
// has no such file, and then there are no answer pages.
import { answerPagesSite } from "./answerPagesBuild";
import type { Site } from "./answerPages";
import type { Manifest } from "./data";
import { readPublished } from "./publishedFiles.mjs";

let site: Promise<Site | undefined> | undefined;

function builtManifest(): Manifest | undefined {
  const file = readPublished("manifest.json");
  if (!file) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(file)) as Manifest;
  } catch {
    return undefined;
  }
}

export const builtAnswerSite = (): Promise<Site | undefined> =>
  (site ??= (async () => {
    const manifest = builtManifest();
    return manifest ? answerPagesSite(manifest, readPublished) : undefined;
  })());
