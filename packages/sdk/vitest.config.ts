import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@keynes/sdk": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      "@keynes/node-sqlite": fileURLToPath(
        new URL("../node-sqlite/src/adapter.ts", import.meta.url),
      ),
      "@keynes/postgres": fileURLToPath(
        new URL("../postgres/src/adapter.ts", import.meta.url),
      ),
    },
  },
});
