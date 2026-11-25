import { defineConfig, devices } from "@playwright/test";

const persist = process.env.DEALSRKY_QA_PERSIST;
if (!persist || !/^\/tmp\/dealsrky-browser-[a-zA-Z0-9]+\/state$/.test(persist)) {
  throw new Error("Run the isolated catalog browser QA script, not the shared dev database.");
}
const port = Number(process.env.DEALSRKY_QA_PORT ?? 5174);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local QA port");
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "../e2e",
  testMatch: "catalog-cpu.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: persist + "/../results",
  use: { baseURL },
  projects: [
    {name:"chromium",use:{...devices["Desktop Chrome"]}},
    {name:"mobile-chrome",use:{...devices["Pixel 5"]}},
  ],
  webServer: {
    command: `npx --no-install wrangler dev --config build/server/wrangler.json --local --persist-to ${persist} --ip 127.0.0.1 --port ${port} --inspector-port 0`,
    cwd: process.cwd(),
    url: baseURL + "/api/health",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
