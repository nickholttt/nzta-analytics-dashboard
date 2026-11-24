import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { BROWSER_PARTS, cutConfig } from "./scripts/browser-config.mjs";

// A page whose chart is an island fetches the island's script only when the page's own inline script runs, and each
// script then names the ones it imports: a chain of requests, each waiting a round trip for the one before it. This
// reads the built pages, finds every island's scripts and everything they import, and tells the browser about all of
// them in the page's head, along with the manifest the island's first act is to read. No dependency; it only adds links.
// The drawing library (the chunk named "plot", below) is not imported by the island itself but by the renderer it loads once it knows a
// chart's shape; a page whose island mentions it gets it in the same breath, so it comes down beside the island's own code and not after it.
function preloadIslands() {
  const importsOf = (root, url, seen) => {
    if (seen.has(url)) return;
    seen.add(url);
    const source = readFileSync(join(root, url), "utf8");
    for (const [, relative] of source.matchAll(/(?:from|import)\s*"(\.\/[^"]+\.js)"/g)) importsOf(root, `/_astro/${relative.slice(2)}`, seen);
  };
  return {
    name: "preload-islands",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const root = fileURLToPath(dir);
        for (const file of readdirSync(root, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".html"))) {
          const path = join(root, file);
          const html = readFileSync(path, "utf8");
          const entries = [...html.matchAll(/(?:component-url|renderer-url)="(\/_astro\/[^"]+\.js)"/g)].map((m) => m[1]);
          if (entries.length === 0) continue;
          const scripts = new Set();
          for (const url of entries) importsOf(root, url, scripts);
          const drawing = readdirSync(join(root, "_astro")).filter((name) => /^plot\.[\w-]+\.js$/.test(name));
          if (drawing.some((name) => [...scripts].some((url) => readFileSync(join(root, url), "utf8").includes(name)))) for (const name of drawing) importsOf(root, `/_astro/${name}`, scripts);
          const links = [
            ...[...scripts].map((url) => `<link rel="modulepreload" href="${url}">`),
            `<link rel="preload" href="/data/manifest.json" as="fetch" crossorigin="anonymous">`,
          ].join("");
          writeFileSync(path, html.replace("</head>", `${links}</head>`));
        }
      },
    },
  };
}

// The public build (INTERNAL_PAGES=false, D-056) leaves out the internal pages. Dropping their folders from the output is
// not enough: the scripts only they used stay in _astro, unlinked, and are still downloaded by anyone who asks for them
// and counted in what the deploy uploads. So the pages go here, and then every script no remaining page reaches goes with
// them. A script is reached when a page names it, or a script that is reached imports it, statically or dynamically.
const INTERNAL_PAGE_FOLDERS = JSON.parse(readFileSync(new URL("./scripts/internal-pages.json", import.meta.url), "utf8")).folders;
function prunePublicBuild() {
  return {
    name: "prune-public-build",
    hooks: {
      "astro:build:done": ({ dir }) => {
        if (process.env.INTERNAL_PAGES !== "false") return;
        const root = fileURLToPath(dir);
        for (const folder of INTERNAL_PAGE_FOLDERS) rmSync(join(root, folder), { recursive: true, force: true });
        const reached = new Set();
        const reach = (url) => {
          if (reached.has(url)) return;
          reached.add(url);
          const source = readFileSync(join(root, url), "utf8");
          for (const [, relative] of source.matchAll(/(?:from|import)\s*\(?\s*["`'](\.\/[^"`']+\.js)["`']/g)) reach(`/_astro/${relative.slice(2)}`);
        };
        for (const file of readdirSync(root, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".html")))
          for (const [, url] of readFileSync(join(root, file), "utf8").matchAll(/"(\/_astro\/[^"]+\.js)"/g)) reach(url);
        for (const file of readdirSync(join(root, "_astro")).filter((f) => f.endsWith(".js")))
          if (!reached.has(`/_astro/${file}`)) rmSync(join(root, "_astro", file));
      },
    },
  };
}

// A config file the browser reads only in part reaches the client build as the part (scripts/browser-config.mjs). The pages are made from the whole
// file, which this leaves alone: it acts only where the browser's own code asks for the file.
function browserConfig() {
  const prefix = "\0browser-config:";
  return {
    name: "browser-config",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (options?.ssr) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      const file = resolved && Object.keys(BROWSER_PARTS).find((path) => resolved.id.replaceAll("\\", "/").endsWith(`/${path}`));
      return file ? `${prefix}${file}:cut` : null;
    },
    load(id) {
      if (!id.startsWith(prefix)) return null;
      const file = id.slice(prefix.length, -":cut".length);
      const doc = JSON.parse(readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), "utf8"));
      return `export default ${JSON.stringify(cutConfig(doc, BROWSER_PARTS[file], file))};`;
    },
  };
}

// The package that holds the decompressors for the Parquet reader (src/lib/data.ts takes only the zstd one from it) is not marked as free of
// side effects the way hyparquet and fzstd are, so the bundler keeps every codec it imports for the sake of their top-level code: the brotli
// decoder with its tables, the gzip and lz4 ones, and a Snappy decoder held as a text-encoded WebAssembly module. Saying here that its
// modules have none lets the bundler leave out what nothing uses, with no change to any file's contents or to what is read.
function unusedCompressors() {
  return {
    name: "unused-compressors",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (options?.ssr) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved && /[\\/]node_modules[\\/](?:hyparquet-compressors|hysnappy)[\\/]/.test(resolved.id) ? { ...resolved, moduleSideEffects: false } : null;
    },
  };
}

// Local reference tool only: the dev server serves public/data as the pipeline built it.
export default defineConfig({
  integrations: [react(), preloadIslands(), prunePublicBuild()],
  server: { host: "127.0.0.1", port: 4321 },
  vite: {
    plugins: [browserConfig(), unusedCompressors()],
    build: {
      // A font file is never folded into the stylesheet as text, however small: the stylesheet blocks the first paint, and a face the page
      // does not need would be in it all the same. Each is its own file, asked for only by a page whose text uses it.
      assetsInlineLimit: (file) => (file.endsWith(".woff2") ? false : undefined),
      rollupOptions: {
        output: {
          // The drawing library and the parts of d3 it uses are one file, named for what it is: the renderers of five shapes
          // (src/components/PresetPanel.tsx) import it, and a page whose first chart is one of them fetches it beside the page's own code.
          // The grid and every page without a chart never ask for it.
          manualChunks: (id) => (/node_modules\/(@observablehq\/plot|d3-[^/]+|internmap|delaunator|robust-predicates)\//.test(id) ? "plot" : undefined),
        },
      },
    },
  },
  // The dev toolbar overlays the page and lands in every screenshot.
  devToolbar: { enabled: false },
});
