// Local prototype. One primary-D1 read reproduces original marketplace selection.
const trimChars="char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)";
// Pull current scope identities once per scheduled batch rather than writing
// the enrollment queue repeatedly during every catalog mutation.
export function prepareDuePublicationPaths(db: D1Database, version: string, now: number, limit: number) {
  return db.prepare(`
    WITH chosen AS MATERIALIZED (
      SELECT e.*, substr(e.path,8,10) AS asin,
        COALESCE(
          (SELECT p.id FROM products p
            WHERE p.asin=substr(e.path,8,10) AND p.is_active=1 AND p.status='active' AND p.is_adult=0
              AND substr(e.path,18)<>'' AND p.marketplace COLLATE BINARY=substr(e.path,26)
            ORDER BY p.created_at DESC,p.id DESC LIMIT 1),
          (SELECT p.id FROM products p
            WHERE p.asin=substr(e.path,8,10) AND p.is_active=1 AND p.status='active' AND p.is_adult=0
            ORDER BY p.created_at DESC,p.id DESC LIMIT 1)
        ) AS selected_id
      FROM public_render_publication e
    ), identities AS MATERIALIZED (
      SELECT c.path,c.dirty_token,c.last_checked_at,c.next_check_at,c.checked_version,c.checked_revision,
        CASE WHEN c.selected_id IS NULL THEN 'hidden' ELSE
          COALESCE((SELECT revision FROM public_render_scope_revision WHERE kind='global' AND scope_key=''),'0') || '-' ||
          COALESCE((SELECT revision FROM public_render_scope_revision WHERE kind='asin' AND scope_key=c.asin),'0') || '-' ||
          CASE WHEN p.category IS NULL OR trim(p.category,${trimChars})=''
            THEN COALESCE((SELECT revision FROM public_render_scope_revision WHERE kind='fallback' AND scope_key=''),'0')
            ELSE COALESCE((SELECT revision FROM public_render_scope_revision WHERE kind='category' AND scope_key=p.category),'0')
          END
        END AS current_revision
      FROM chosen c LEFT JOIN products p ON p.id=c.selected_id
    )
    SELECT path,dirty_token,current_revision FROM identities
    WHERE checked_version<>?1 OR checked_revision<>current_revision OR next_check_at<=?2
    ORDER BY last_checked_at ASC,path ASC LIMIT ?3
  `).bind(version,now,limit);
}

export async function listDuePublicationPaths(db: D1Database, version: string, now: number, limit: number) {
  const { results } = await prepareDuePublicationPaths(db,version,now,limit).all<{path:string;dirty_token:string;current_revision:string}>();
  return results;
}

export async function readScopedRenderRevision(db:D1Database,request:Request):Promise<string|null>{
 const url=new URL(request.url),asin=url.pathname.split("/").at(-1);
 if(!asin||!/^[A-Z0-9]{10}$/.test(asin))return null;
 const market=url.searchParams.get("market")?.toUpperCase()??null;
 const row=await db.prepare(`
 WITH selected AS MATERIALIZED (
   SELECT category FROM products
   WHERE asin=?1 AND is_active=1 AND status='active' AND is_adult=0
   AND EXISTS(SELECT 1 FROM public_render_publication WHERE path=?3)
    ORDER BY CASE WHEN marketplace COLLATE BINARY=?2 THEN 0 ELSE 1 END,created_at DESC,id DESC LIMIT 1
 )
 SELECT
   COALESCE((SELECT revision FROM public_render_scope_revision WHERE kind='global' AND scope_key=''),'0') AS shared_revision,
   COALESCE((SELECT revision FROM public_render_scope_revision WHERE kind='asin' AND scope_key=?1),'0') AS asin_revision,
   CASE WHEN selected.category IS NULL OR trim(selected.category,${trimChars})=''
     THEN COALESCE((SELECT revision FROM public_render_scope_revision WHERE kind='fallback' AND scope_key=''),'0')
     ELSE COALESCE((SELECT revision FROM public_render_scope_revision WHERE kind='category' AND scope_key=selected.category),'0')
   END AS related_revision
 FROM selected
 `).bind(asin,market,url.pathname+url.search).first<{shared_revision:string;asin_revision:string;related_revision:string}>();
 if(!row)return null;
 const parts=[row.shared_revision,row.asin_revision,row.related_revision];
 return parts.every(x=>/^(?:0|[a-f0-9]{32})$/.test(x))?parts.join("-"):null;
}
