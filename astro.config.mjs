import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// A page whose chart is an island fetches the island's script only when the page's own inline script runs, and each
// script then names the ones it imports: a chain of requests, each waiting a round trip for the one before it. This
// reads the built pages, finds every island's scripts and everything they import, and tells the browser about all of
// them in the page's head, along with the manifest the island's first act is to read. No dependency; it only adds links.
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

// Local reference tool only: the dev server serves public/data as the pipeline built it.
export default defineConfig({
  integrations: [react(), preloadIslands()],
  server: { host: "127.0.0.1", port: 4321 },
  // The dev toolbar overlays the page and lands in every screenshot.
  devToolbar: { enabled: false },
});
