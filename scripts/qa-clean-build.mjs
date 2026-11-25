// Release gate: a successful exit code is not enough when esbuild logs errors.
// This script builds only; Wrangler is invoked with --dry-run, never deploys.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

function execute(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    env,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 12 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.error?.message ?? result.stderr?.slice(-3000) ?? result.stdout?.slice(-3000)}`);
  }
  return result;
}

const build = execute("npm", ["run", "build"], { ...process.env, CI: "1" });
const diagnostic = [build.stdout, build.stderr].join("\n");
if (/The build was canceled|Unexpected end of JSON input|\[plugin onEnd\]|✘ \[ERROR\]/i.test(diagnostic)) {
  throw new Error(`Build logged an esbuild error despite exit 0:\n${build.stderr.slice(-3000)}`);
}
const required = [
  "build/server/index.js",
  "build/server/wrangler.json",
  "build/client/assets",
];
for (const file of required) {
  if (!existsSync(file)) throw new Error(`Build artifact missing: ${file}`);
}
const dryRun = execute("npx", ["--no-install", "wrangler", "deploy", "--dry-run"]);
if (!dryRun.stdout.includes("--dry-run: exiting now.")) {
  throw new Error("Wrangler did not confirm a deploy dry run");
}
process.stdout.write("PASS clean CI build, artifacts and Wrangler dry-run. No deployment performed.\n");
