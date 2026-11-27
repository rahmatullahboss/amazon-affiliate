// Disposable, loopback-only built Worker acceptance and CPU experiment.
// No production traffic, database access, or cloud provisioning.
import {mkdtempSync,rmSync} from "node:fs";
import {join} from "node:path";
import {spawn,spawnSync} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(join(process.cwd(),"package.json"));
if(!process.cwd().endsWith("/.worktrees/dealsrky-publication-first-20261127"))throw Error("Wrong local workspace");
const root=mkdtempSync("/tmp/dealsrky-publication-qa-"),persist=join(root,"state");
const env={...process.env,CI:"1",NODE_OPTIONS:"--require="+join(process.cwd(),"test/support/loopback-network.cjs")};
const useProfiler=process.argv.includes("--profile");
const assetSdk=process.argv.includes("--asset-sdk");
const config=assetSdk?"test/support/wrangler.publication-browser-qa.json":"test/support/wrangler.publication-cron-qa.json";
const port=5177,inspector=9238,base="http://127.0.0.1:"+port;
const paths=Array.from({length:100},(_,i)=>"/deals/P"+String(i+1).padStart(9,"0"));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let worker,ws,logs="";
function run(args){
 const r=spawnSync("npx",["--no-install",...args,"--config",config],{env,encoding:"utf8",timeout:60000,maxBuffer:8*1024*1024});
 if(r.error||r.status!==0)throw Error("Local fixture failed: "+(r.error?.message??r.stderr?.slice(-1500)));
}
async function poll(url){
 for(let i=0;i<100;i++){
  try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});if(r.ok)return r}catch{}
  if(worker?.exitCode!==null)throw Error("Worker stopped: "+logs.slice(-1500));
  await sleep(250);
 }
 throw Error("Local endpoint not ready: "+url+"; recent logs: "+logs.slice(-3000));
}
const qa=(ok,label)=>{if(!ok)throw Error("Acceptance failed: "+label)};
async function get(path,extra={}){
 const r=await fetch(base+path,{headers:{accept:"text/html","user-agent":"DealsRkyLocalPublicationQA",...extra},redirect:"manual",signal:AbortSignal.timeout(20000)});
 return {status:r.status,hit:r.headers.get("x-publication-render")==="HIT",body:await r.text(),headers:r.headers};
}
function contract(doc){
 const html=doc.body;
 const title=html.match(/<title>(.*?)<\/title>/s)?.[1];
 const canon=html.match(/<link\b[^>]*rel="canonical"[^>]*>/)?.[0];
 const heading=html.match(/<h1\b[^>]*>(.*?)<\/h1>/s)?.[1];
 const hrefs=[...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m=>m[1]);
 qa(title&&canon&&heading&&hrefs.some(h=>h.includes("qa-fixture-us-20")),"complete title/canonical/heading/affiliate");
 const securityHeaders=Object.fromEntries(["cache-control","x-frame-options","x-content-type-options","referrer-policy","permissions-policy"].map(name=>[name,doc.headers.get(name)]));
 qa(securityHeaders["x-frame-options"]==="DENY"&&securityHeaders["x-content-type-options"]==="nosniff"&&securityHeaders["referrer-policy"]==="strict-origin-when-cross-origin"&&securityHeaders["permissions-policy"]?.includes("camera=()")&&securityHeaders["cache-control"]?.includes("no-store"),"document response security policy");
 return JSON.stringify({title,canon,heading,hrefs,securityHeaders});
}
try{
 run(["wrangler","d1","migrations","apply","dealsrky-db","--local","--persist-to",persist]);
 // Explicit local-only admission of the held pilot schema. Ordinary production
 // migrations must never see these two files until separate release approval.
 for(const file of ["0034_public_render_scope_revision.sql","0035_public_render_publication.sql"]){
  run(["wrangler","d1","execute","dealsrky-db","--local","--persist-to",persist,"--file","pilot/publication/migrations/"+file]);
 }
 run(["wrangler","d1","execute","dealsrky-db","--local","--persist-to",persist,"--file","test/support/catalog-browser-fixture.sql"]);
 run(["wrangler","d1","execute","dealsrky-db","--local","--persist-to",persist,"--file","test/support/publication-browser-fixture.sql"]);
 const review="Overview: "+("Synthetic buyer guidance about controls and safety limits. ".repeat(8))+"\n\nDetails: "+("Check retailer pricing, specifications and availability. ".repeat(8));
 const images=JSON.stringify(Array.from({length:8},(_,i)=>"https://example.invalid/synthetic-qa-product-"+i+".webp"));
 const quote=v=>"'"+v.replace(/'/g,"''")+"'";
 run(["wrangler","d1","execute","dealsrky-db","--local","--persist-to",persist,"--command","UPDATE products SET review_content="+quote(review)+",product_images="+quote(images)+" WHERE id BETWEEN 85001 AND 85100"]);
 worker=spawn("npx",[...(assetSdk?["--yes","wrangler@4.110.0"]:["--no-install","wrangler"]),"dev","--config",config,"--local","--persist-to",persist,"--ip","127.0.0.1","--port",String(port),"--inspector-port",useProfiler?String(inspector):"0","--test-scheduled","--var","PUBLIC_RENDER_PUBLICATION:on","--var","PUBLIC_APP_URL:"+base],{env,stdio:["ignore","pipe","pipe"],detached:true});
 for(const stream of [worker.stdout,worker.stderr])stream.on("data",b=>{logs=(logs+b.toString()).slice(-150000)});
 await poll(base+"/robots.txt");
 let call=async()=>({profile:null});
 if(useProfiler){
 const targets=await (await poll("http://127.0.0.1:"+inspector+"/json/list")).json();
 const target=targets.find(x=>x.webSocketDebuggerUrl&&x.type==="node")??targets.find(x=>x.webSocketDebuggerUrl);
 if(!target)throw Error("No local inspector");
 const address=new URL(target.webSocketDebuggerUrl);
 qa(["localhost","127.0.0.1","[::1]"].includes(address.hostname),"local inspector");
 address.hostname="127.0.0.1";address.port=String(inspector);
 const WS=require("ws");ws=new WS(address,{origin:"http://127.0.0.1:"+inspector});
 await new Promise((resolve,reject)=>{ws.once("open",resolve);ws.once("error",reject)});
 let seq=0;const pending=new Map();
 ws.on("message",e=>{const msg=JSON.parse(e.toString());if(pending.has(msg.id)){const [resolve,reject]=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(Error(msg.error.message)):resolve(msg.result)}});
 call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,[resolve,reject]);ws.send(JSON.stringify({id,method,params}))});
 await call("Profiler.enable");await call("Profiler.setSamplingInterval",{interval:1000});
 }
 const active=profile=>{if(!profile)return null;const frames=new Map(profile.nodes.map(n=>[n.id,n.callFrame?.functionName]));return (profile.samples??[]).reduce((sum,id,i)=>sum+(["(idle)","(root)","(program)"].includes(frames.get(id))?0:(profile.timeDeltas?.[i]??1000)),0)/1000};
 for(let i=0;i<5;i++){const doc=await get(paths[0]);qa(doc.status===200&&!doc.hit,"no request-time write")}
 const contracts=new Map();
 async function sample(label,expectHit){
  await call("Profiler.start");const begin=performance.now();
  let totalBytes=0,hits=0;
  for(const path of paths){
   const doc=await get(path);
   qa(doc.status===200&&doc.hit===expectHit,label+" "+path);
   if(expectHit){qa(contracts.get(path)===contract(doc),"SSR contract parity "+path);qa(doc.headers.get("cache-control")?.includes("no-store"),"fresh visibility guard");}
   else contracts.set(path,contract(doc));
   if(doc.hit)hits++;totalBytes+=Buffer.byteLength(doc.body);
  }
  const {profile}=await call("Profiler.stop");
  const row={phase:label,requests:paths.length,hits,meanSampledCpuMs:profile?active(profile)/paths.length:null,meanHtmlBytes:totalBytes/paths.length,elapsedMs:Math.round(performance.now()-begin)};
  console.log(JSON.stringify(row));return row;
 }
 const ssr=await sample("ordinary-SSR-before-publication",false);
 const marker=()=>[...logs.matchAll(/\[PUBLICATION_RENDER\]\s+(\{[^\n]+\})/g)];
 let generated=0,unchanged=0;
 await call("Profiler.start");const began=performance.now();
 for(let i=0;i<13;i++){
  const before=marker().length;
  const scheduledEndpoint="/cdn-cgi/handler/scheduled";
  const r=await fetch(base+scheduledEndpoint+"?cron="+encodeURIComponent("*/5 * * * *"),{signal:AbortSignal.timeout(30000)});
  const callbackBody=await r.text();
  qa(r.ok,"real scheduled callback "+r.status+" "+callbackBody.slice(0,300)+"; local logs: "+logs.slice(-2500));
  for(let j=0;j<120&&marker().length<=before;j++)await sleep(100);
  const matches=marker();qa(matches.length>before,"publisher log");
  const result=JSON.parse(matches.at(-1)[1]);qa(result.failed===0&&result.hidden===0&&result.checked<=8,"bounded successful batch");
  generated+=result.generated;unchanged+=result.unchanged;
 }
 const {profile}=await call("Profiler.stop");
 qa(generated===100,"100 documents generated");
 console.log(JSON.stringify({phase:"scheduled-publication",batches:13,generated,unchanged,meanSampledCpuMs:profile?active(profile)/100:null,elapsedMs:Math.round(performance.now()-began)}));
 const hit=await sample("publication-hit-100-unique",true);
 // Measure the unchanged steady-state scheduler, not just document serving.
 await call("Profiler.start");
 const idleBatches=5;
 for(let i=0;i<idleBatches;i++){
   const previous=marker().length;
   const r=await fetch(base+"/cdn-cgi/handler/scheduled?cron="+encodeURIComponent("*/5 * * * *"),{signal:AbortSignal.timeout(30000)});
   qa(r.ok,"idle scheduled callback");await r.text();
   for(let j=0;j<120&&marker().length<=previous;j++)await sleep(100);
   qa(marker().length>previous,"idle publisher log");
   const result=JSON.parse(marker().at(-1)[1]);
   qa(result.checked===0&&result.generated===0&&result.unchanged===0&&result.failed===0,"no unnecessary per-page checks");
 }
 const {profile:idleProfile}=await call("Profiler.stop");
 console.log(JSON.stringify({phase:"idle-scheduler",batches:idleBatches,checked:0,generated:0,meanSampledCpuMs:idleProfile?active(idleProfile)/idleBatches:null}));
 const cookie=await get(paths[0],{cookie:"qa_session=synthetic"});
 qa(cookie.status===200&&!cookie.hit&&contract(cookie)===contracts.get(paths[0]),"cookie SSR fallback");
 const excluded=await get("/deals/Q000000001?market=US");
 qa(excluded.status===200&&!excluded.hit,"nonenrolled SSR");
 const bypass=await get(paths[0],{"cache-control":"no-cache"});
 qa(bypass.status===200&&!bypass.hit&&contract(bypass)===contracts.get(paths[0]),"explicit no-cache SSR");
 // Verify mutations against the same compiled Worker, not a mock.
 const mutate=sql=>run(["wrangler","d1","execute","dealsrky-db","--local","--persist-to",persist,"--command",sql]);
 mutate("UPDATE products SET title='Publication changed QA' WHERE id=85001");
 const changed=await get(paths[0]);qa(changed.status===200&&!changed.hit&&changed.body.includes("Publication changed QA"),"changed title rejects old snapshot");
 const before=marker().length;
 const refresh=await fetch(base+"/cdn-cgi/handler/scheduled?cron="+encodeURIComponent("*/5 * * * *"),{signal:AbortSignal.timeout(30000)});
 qa(refresh.ok,"dirty regeneration scheduled");await refresh.text();
 for(let j=0;j<120&&marker().length<=before;j++)await sleep(100);
 qa(marker().length>before,"dirty batch completion");
 const fresh=await get(paths[0]);qa(fresh.status===200&&fresh.hit&&fresh.body.includes("Publication changed QA"),"updated HTML published");
 if(process.argv.includes("--browser")){
  if(!assetSdk){
  // Same disposable persistence and Worker code; only enable the asset router
  // after local cron acceptance. No cron calls through the asset proxy.
  try{ws?.close()}catch{}
  ws=undefined;
  if(worker?.pid){process.kill(-worker.pid,"SIGTERM");await new Promise(resolve=>{if(worker.exitCode!==null)resolve();else worker.once("exit",resolve)});}
  await sleep(500);
  logs="";
  worker=spawn("npx",["--no-install","wrangler","dev","--config","test/support/wrangler.publication-browser-qa.json","--local","--persist-to",persist,"--ip","127.0.0.1","--port",String(port),"--inspector-port","0"],{env,stdio:["ignore","pipe","pipe"],detached:true});
  for(const stream of [worker.stdout,worker.stderr])stream.on("data",b=>{logs=(logs+b.toString()).slice(-150000)});
  await poll(base+"/robots.txt");
  }
  const assetProbe=await get(paths[0]);
  console.log(JSON.stringify({assetEnabledProbe:{status:assetProbe.status,hit:assetProbe.hit,hasChangedTitle:assetProbe.body.includes("Publication changed QA")}}));
  const {chromium,devices}=await import("@playwright/test");
  const browser=await chromium.launch({headless:true});
  try{
   for(const [name,options] of [["desktop",devices["Desktop Chrome"]],["mobile",devices["Pixel 5"]]]){
    const page=await browser.newPage(options);const errors=[];
    page.on("pageerror",e=>errors.push(e.name));
    // Playwright request routing disables the browser cache, sending no-cache
    // and Pragma to the document. Block external traffic at Chromium's network
    // layer instead, while leaving local document navigation untouched.
    const cdp=await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setBlockedURLs",{urls:["https://*","http://example.invalid/*"]});
    const response=await page.goto(base+paths[0],{waitUntil:"domcontentloaded"});
    const requestHeaders=await response?.request().allHeaders()??{};
    console.log(JSON.stringify({browser:name,status:response?.status(),hit:response?.headers()["x-publication-render"]??null,accept:requestHeaders.accept,cacheControl:requestHeaders["cache-control"]??null,pragma:requestHeaders.pragma??null,cookiePresent:Boolean(requestHeaders.cookie),destination:requestHeaders["sec-fetch-dest"]??null}));
    qa(response?.status()===200&&response.headers()["x-publication-render"]==="HIT",name+" asset-enabled document HIT; local decision: "+logs.slice(-2200));
    await page.getByRole("heading",{name:"Publication changed QA",exact:true}).waitFor();
    const link=page.getByRole("link",{name:"Continue to Amazon",exact:true}).first();
    const href=await link.getAttribute("href");qa(href&&new URL(href).searchParams.get("tag")==="qa-fixture-us-20",name+" affiliate");
    await page.waitForFunction(()=>Boolean(window.__reactRouterContext),null,{timeout:10000});
    await page.evaluate(()=>{window.__publicationQaNavigation=true});
    await page.locator("footer").getByRole("link",{name:"Home",exact:true}).click();
    await page.waitForURL(base+"/");
    qa(await page.evaluate(()=>window.__publicationQaNavigation===true),name+" hydrated client navigation");
    qa(errors.length===0,name+" page errors "+errors.join(","));
    console.log(JSON.stringify({browser:name,documentHit:true,hydratedNavigation:true,affiliate:true,pageErrors:errors.length}));
    await page.close();
   }
  }finally{await browser.close()}
 }
 mutate("UPDATE tracking_ids SET tag='qa-publication-updated-20' WHERE id=82001");
 const affiliate=await get(paths[0]);qa(affiliate.status===200&&!affiliate.hit&&affiliate.body.includes("qa-publication-updated-20")&&!affiliate.body.includes("qa-fixture-us-20"),"affiliate revision rejects stale snapshot");
 mutate("UPDATE products SET is_adult=1 WHERE id=85001");
 const hidden=await get(paths[0]);qa(hidden.status===302&&!hidden.hit&&!hidden.body.includes("Publication changed QA"),"visibility stale snapshot rejection");
 console.log(JSON.stringify({pass:true,generated,firstVisitHitCount:hit.hits,contractParity:100,ordinarySSRMeanMs:ssr.meanSampledCpuMs,publicationMeanMs:hit.meanSampledCpuMs,mutationFallback:true,browser:process.argv.includes("--browser"),localOnly:true}));
}finally{
 try{ws?.close()}catch{}
 if(worker?.pid){try{process.kill(-worker.pid,"SIGTERM")}catch{}await sleep(400)}
 rmSync(root,{recursive:true,force:true});
}
