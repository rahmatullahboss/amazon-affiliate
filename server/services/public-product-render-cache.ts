export function isPublicProductRenderEligible(request:Request):boolean {
 const url=new URL(request.url);
 return request.method==="GET" && /^\/deals\/[A-Z0-9]{10}$/.test(url.pathname)
   && (!url.search || /^\?market=(US|CA|UK|DE|IT|FR|ES)$/.test(url.search))
   && (request.headers.get("accept")??"").includes("text/html")
   && (!request.headers.has("sec-fetch-dest") || request.headers.get("sec-fetch-dest")==="document")
   && !["cookie","authorization","cf-access-jwt-assertion","range","if-none-match","if-modified-since","if-match","if-unmodified-since","if-range","pragma"].some(h=>request.headers.has(h))
   && !/no-cache|no-store|max-age\s*=\s*0/i.test(request.headers.get("cache-control")??"");
}
export function createPublicRenderKey(request:Request,version:string,revision:string):Request {
  const url=new URL(request.url);
  url.searchParams.append('__render_version',version);
  url.searchParams.append('__render_revision',revision);
  return new Request(url);
}
