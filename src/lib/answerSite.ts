// The answer pages of this build, worked out once for every page file that asks (the layout's footer, the pages themselves and the front page's
// tables): the built site runs them in one process, and the slices are read and worked through a single time.
import manifest from "../../public/data/manifest.json";
import { answerPagesSite } from "./answerPagesBuild";
import type { Site } from "./answerPages";
import type { Manifest } from "./data";
import { readPublished } from "./publishedFiles.mjs";

let site: Promise<Site | undefined> | undefined;

export const builtAnswerSite = (): Promise<Site | undefined> => (site ??= answerPagesSite(manifest as unknown as Manifest, readPublished));
