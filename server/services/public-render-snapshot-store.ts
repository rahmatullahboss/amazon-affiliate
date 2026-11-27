// Local experiment: immutable revision-keyed snapshots in shared object storage.
export const PUBLICATION_SNAPSHOT_TTL_MS = 72 * 60 * 60 * 1000;
type RenderStore = Pick<Cache,"match"|"put"> & { has(input:RequestInfo|URL,minRemainingMs?:number):Promise<boolean> };
function objectKey(input:RequestInfo|URL):string {
  const url=new URL(input instanceof Request?input.url:String(input));
  return "public-render-v1/"+encodeURIComponent(url.origin)+url.pathname+"/"+encodeURIComponent(url.search);
}
// Durable mode keeps one slot per deployment and canonical document URL. The full
// revision identity is stored alongside the body; old or competing writes can only miss.
function snapshotIdentity(input:RequestInfo|URL,durable:boolean):{key:string;identity:string}|null {
  const identity=objectKey(input);
  if(!durable)return {key:identity,identity};
  const url=new URL(input instanceof Request?input.url:String(input));
  const version=url.searchParams.get('__render_version'),revision=url.searchParams.get('__render_revision');
  if(!version||!/^[a-zA-Z0-9_-]{1,100}$/.test(version)||!revision||!(/^(?:0|[a-f0-9]{32})(?:-(?:0|[a-f0-9]{32})){2}$/).test(revision))return null;
  url.searchParams.delete('__render_revision');
  return {key:'durable/'+objectKey(url),identity};
}
export function createRenderSnapshotStore(bucket:R2Bucket,options:{durable?:boolean}={}):RenderStore {
  const durable=options.durable===true;
  return {
    // A scheduled publisher only needs existence and current metadata here.
    // Avoid downloading/canceling an entire HTML body for every unchanged slot.
    async has(input,minRemainingMs=0){
      const slot=snapshotIdentity(input,durable);
      if(!slot)return false;
      const object=await bucket.head(slot.key);
      const metadata=object?.customMetadata;
      if(!metadata?.expiresAt||!Number.isFinite(Number(metadata.expiresAt))||Number(metadata.expiresAt)<=Date.now()+minRemainingMs||!metadata.headers||(durable&&metadata.identity!==slot.identity))return false;
      try{
        const headers=new Headers(JSON.parse(metadata.headers));
        return /^text\/html(?:;|$)/i.test(headers.get('content-type')??'');
      }catch{return false}
    },
    async match(input){
      const slot=snapshotIdentity(input,durable);
      if(!slot)return undefined;
      const object=await bucket.get(slot.key);
      if(!object)return undefined;
      const metadata=object.customMetadata;
      if(!metadata?.expiresAt||!Number.isFinite(Number(metadata.expiresAt))||Number(metadata.expiresAt)<=Date.now()||!metadata.headers||(durable&&metadata.identity!==slot.identity)){
        await object.body.cancel().catch(()=>undefined);
        return undefined;
      }
      try{
        const headers=new Headers(JSON.parse(metadata.headers));
        if(durable)headers.set('Cache-Control',`public, max-age=${Math.max(0,Math.min(300,Math.floor((Number(metadata.expiresAt)-Date.now())/1000)))}`);
        return new Response(object.body,{status:200,headers});
      }
      catch{await object.body.cancel().catch(()=>undefined);return undefined}
    },
    async put(input,response){
      const slot=snapshotIdentity(input,durable);
      if(!slot||response.status!==200||!response.body||!/^text\/html(?:;|$)/i.test(response.headers.get('content-type')??'')||['set-cookie','vary','location'].some(h=>response.headers.has(h)))return;
      const headers=JSON.stringify([...response.headers.entries()]);
      const metadata={headers,expiresAt:String(Date.now()+(durable?PUBLICATION_SNAPSHOT_TTL_MS:300000)),...(durable?{identity:slot.identity}:{})};
      // Keep combined metadata bounded; unknown/oversized documents use ordinary SSR.
      if(new TextEncoder().encode(JSON.stringify(metadata)).length>1800)return;
      // R2 requires a known-length body. Bound buffering for oversized HTML.
      const reader=response.body.getReader(),chunks:Uint8Array[]=[];
      let size=0;
      try{
        for(;;){
          const {done,value}=await reader.read();
          if(done)break;
          size+=value.byteLength;
          if(size>512*1024){await reader.cancel();return}
          chunks.push(value);
        }
      }finally{reader.releaseLock()}
      const bytes=new Uint8Array(size);let offset=0;
      for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
      await bucket.put(slot.key,bytes,{
        httpMetadata:{contentType:"text/html"},
        customMetadata:metadata
      });
    }
  };
}
