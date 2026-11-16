// A loader for the site's own tests. The site's modules are written for Vite and Astro, which add the `.ts` extension to
// a relative import, read a JSON file without an import attribute, fill in `import.meta.env` and accept all of
// TypeScript; Node's test runner does none of these. This does all four for the files under src/, so a test runs the
// real modules the pages run, not a copy of their logic.
import { stripTypeScriptTypes } from "node:module";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) return nextLoad(url, { ...context, importAttributes: { type: "json" } });
  if (!url.includes("/src/") || !url.endsWith(".ts")) return nextLoad(url, context);
  const { source } = await nextLoad(url, { ...context, format: "module" });
  const code = stripTypeScriptTypes(String(source), { mode: "transform" }).replaceAll("import.meta.env", "({})");
  return { format: "module", source: code, shortCircuit: true };
}
