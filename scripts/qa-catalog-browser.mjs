// Isolated, local-only browser acceptance against the actual production build.
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const root=mkdtempSync("/tmp/dealsrky-browser-");
const persist=join(root,"state");
const env={...process.env,DEALSRKY_QA_PERSIST:persist,NODE_OPTIONS:"--require="+join(process.cwd(),"test/support/loopback-network.cjs")};
function run(args) {
  const result=spawnSync("npx",["--no-install",...args],{env,encoding:"utf8",maxBuffer:12*1024*1024,timeout:180000});
  if(result.stdout) process.stdout.write(result.stdout.slice(-5000));
  if(result.stderr) process.stderr.write(result.stderr.slice(-4000));
  if(result.error || result.status!==0) throw new Error(args.slice(0,4).join(" ")+" failed: "+(result.error?.message??result.status));
}
try {
  run(["wrangler","d1","migrations","apply","dealsrky-db","--local","--persist-to",persist]);
  run(["wrangler","d1","execute","dealsrky-db","--local","--persist-to",persist,"--file","test/support/catalog-browser-fixture.sql"]);
  run(["playwright","test","--config","test/support/catalog-playwright.config.ts"]);
} finally {
  // Only remove the disposable directory created by this invocation.
  rmSync(root,{recursive:true,force:true});
}
