// Import this first in a test that runs the site's modules: `import "./support/register.mjs"`, then import them with
// `await import(...)` so the loader is in place before they are read.
import { register } from "node:module";

register("./loader.mjs", import.meta.url);
