import { defineConfig, devices } from "@playwright/test";

const persist = process.env.DEALSRKY_QA_PERSIST;
if (!persist || !/^\/tmp\/dealsrky-browser-[a-zA-Z0-9]+\/state$/.test(persist)) {
  throw new Error("Run the isolated catalog browser QA script, not the shared dev database.");
}
export default defineConfig({
  testDir: "../e2e",
  testMatch: "catalog-cpu.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: persist + "/../results",
  use: { baseURL: "http://127.0.0.1:5174" },
  projects: [
    {name:"chromium",use:{...devices["Desktop Chrome"]}},
    {name:"mobile-chrome",use:{...devices["Pixel 5"]}},
  ],
  webServer: {
    command: `npx --no-install wrangler dev --config build/server/wrangler.json --local --persist-to ${persist} --ip 127.0.0.1 --port 5174 --inspector-port 0`,
    cwd: process.cwd(),
    url: "http://127.0.0.1:5174/api/health",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
