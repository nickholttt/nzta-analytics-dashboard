import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// Local reference tool only: the dev server serves public/data as the pipeline built it.
export default defineConfig({
  integrations: [react()],
  server: { host: "127.0.0.1", port: 4321 },
  // The dev toolbar overlays the page and lands in every screenshot.
  devToolbar: { enabled: false },
});
