// @ts-check
import { fileURLToPath } from "node:url";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

function ssrSourceReload() {
  return {
    name: "ssr-source-reload",
    enforce: "post",
    /** @param {{ file: string; server: { ws: { send: (payload: { type: string }) => void } } }} param0 */
    handleHotUpdate({ file, server }) {
      if (!/\.tsx?$/.test(file)) return;
      server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), ssrSourceReload()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },
});
