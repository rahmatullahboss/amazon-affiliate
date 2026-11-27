import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
       // This will pull in bindings from wrangler.jsonc including D1 and KV.
      remoteBindings: false,
      wrangler: { configPath: "./wrangler.jsonc" },
      main: "./test/setup.worker.ts",
      miniflare: {
         r2Buckets: { PUBLICATION_SNAPSHOTS: "local-publication-test" },
         bindings: {
           TEST_MIGRATIONS: await readD1Migrations("./migrations"),
           TEST_PUBLICATION_MIGRATIONS: await readD1Migrations("./pilot/publication/migrations"),
         },
       },
    })),
  ],
  test: {
    // Tests are expected to be placed under test/unit or other non-e2e folders.
    include: ["test/unit/**/*.{test,spec}.ts", "test/api/**/*.{test,spec}.ts"],
    setupFiles: ["./test/setup.db.ts"],
    environment: "node", // vitest-pool-workers takes over the environment.
  },
});
