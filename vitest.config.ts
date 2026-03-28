import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  plugins: [
    cloudflareTest({
       // This will pull in bindings from wrangler.jsonc including D1 and KV.
      wrangler: { configPath: "./wrangler.jsonc" },
      main: "./test/setup.worker.ts"
    }),
  ],
  test: {
    // Tests are expected to be placed under test/unit or other non-e2e folders.
    include: ["test/unit/**/*.{test,spec}.ts", "test/api/**/*.{test,spec}.ts"],
    setupFiles: ["./test/setup.db.ts"],
    environment: "node", // vitest-pool-workers takes over the environment.
  },
});
