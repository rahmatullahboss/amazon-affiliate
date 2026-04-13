# Blog Scheduling And Tracking Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scheduled blog publishing, make missing tracking coverage easy to find in admin, and allow safe force delete for tags by remapping linked products to the marketplace default tag.

**Architecture:** Extend `blog_posts` with a `scheduled` lifecycle and `scheduled_for` timestamp, then reuse the existing hourly worker cron to publish due posts. Keep missing-tracking detection in existing admin dashboard/tracking routes, and implement tag force-delete as a server-side remap-and-delete operation that requires an active replacement default tag in the same marketplace.

**Tech Stack:** React Router admin UI, Hono routes, Cloudflare Workers, D1, existing hourly cron, Vitest API/unit tests

---

### Task 1: Add blog scheduling data model

**Files:**
- Create: `migrations/0020_blog_scheduling.sql`
- Modify: `server/services/blog.ts`
- Modify: `app/utils/blog.ts`
- Test: `test/api/blogs.test.ts`

- [ ] **Step 1: Write the failing migration-aware test expectations**

```ts
it("persists scheduled posts with scheduled_for and status", async () => {
  const response = await app.request(
    new Request("http://localhost/api/blogs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        title: "Scheduled test",
        content: "Body",
        status: "scheduled",
        scheduled_for: "2026-04-13T06:00:00.000Z",
      }),
    }),
    env
  );

  expect(response.status).toBe(201);

  const row = await env.DB.prepare(
    "SELECT status, scheduled_for FROM blog_posts WHERE slug = ?"
  )
    .bind("scheduled-test")
    .first<{ status: string; scheduled_for: string | null }>();

  expect(row?.status).toBe("scheduled");
  expect(row?.scheduled_for).toBe("2026-04-13T06:00:00.000Z");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/api/blogs.test.ts`
Expected: FAIL because `scheduled`/`scheduled_for` are not supported yet.

- [ ] **Step 3: Add the migration**

```sql
ALTER TABLE blog_posts ADD COLUMN scheduled_for TEXT;

CREATE TABLE blog_posts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image_key TEXT,
  cover_image_alt TEXT,
  cta_label TEXT,
  cta_url TEXT,
  cta_disclosure TEXT,
  seo_title TEXT,
  seo_description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'published')),
  generation_source TEXT NOT NULL DEFAULT 'manual',
  generation_provider TEXT,
  generation_topic TEXT,
  generation_focus_asin TEXT,
  generation_marketplace TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  scheduled_for TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
```

- [ ] **Step 4: Preserve existing data during the table rebuild**

```sql
INSERT INTO blog_posts_new (
  id, title, slug, excerpt, content, cover_image_key, cover_image_alt,
  cta_label, cta_url, cta_disclosure, seo_title, seo_description, status,
  generation_source, generation_provider, generation_topic, generation_focus_asin,
  generation_marketplace, is_featured, is_deleted, published_at, scheduled_for,
  created_at, updated_at, deleted_at
)
SELECT
  id, title, slug, excerpt, content, cover_image_key, cover_image_alt,
  cta_label, cta_url, cta_disclosure, seo_title, seo_description, status,
  generation_source, generation_provider, generation_topic, generation_focus_asin,
  generation_marketplace, is_featured, is_deleted, published_at, scheduled_for,
  created_at, updated_at, deleted_at
FROM blog_posts;

DROP TABLE blog_posts;
ALTER TABLE blog_posts_new RENAME TO blog_posts;
```

- [ ] **Step 5: Update shared blog types**

```ts
export const BLOG_STATUSES = ["draft", "scheduled", "published"] as const;

export interface BlogPostRecord {
  // existing fields...
  status: BlogStatus;
  scheduled_for: string | null;
}
```

- [ ] **Step 6: Update client summary types**

```ts
export interface BlogPostSummary {
  // existing fields...
  status: "draft" | "scheduled" | "published";
  scheduled_for?: string | null;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- test/api/blogs.test.ts`
Expected: PASS for the new scheduling persistence case.

- [ ] **Step 8: Commit**

```bash
git add migrations/0020_blog_scheduling.sql server/services/blog.ts app/utils/blog.ts test/api/blogs.test.ts
git commit -m "feat: add blog scheduling schema"
```

### Task 2: Add API validation and admin UI for scheduled posts

**Files:**
- Modify: `server/schemas/index.ts`
- Modify: `server/routes/blogs.ts`
- Modify: `app/routes/admin/blogs.tsx`
- Test: `test/api/blogs.test.ts`

- [ ] **Step 1: Write the failing API validation tests**

```ts
it("rejects scheduled posts without scheduled_for", async () => {
  const response = await app.request(
    new Request("http://localhost/api/blogs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        title: "Bad schedule",
        content: "Body",
        status: "scheduled",
      }),
    }),
    env
  );

  expect(response.status).toBe(400);
});

it("rejects scheduled posts in the past", async () => {
  const response = await app.request(
    new Request("http://localhost/api/blogs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        title: "Past schedule",
        content: "Body",
        status: "scheduled",
        scheduled_for: "2020-01-01T00:00:00.000Z",
      }),
    }),
    env
  );

  expect(response.status).toBe(400);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/api/blogs.test.ts`
Expected: FAIL because schedule validation does not exist yet.

- [ ] **Step 3: Extend create/update schemas**

```ts
const blogStatusSchema = z.enum(["draft", "scheduled", "published"]);

const scheduledForSchema = z
  .string()
  .datetime()
  .optional()
  .nullable();
```

- [ ] **Step 4: Add route-level validation for schedule rules**

```ts
function validateScheduledFields(input: {
  status: "draft" | "scheduled" | "published";
  scheduled_for?: string | null;
}) {
  if (input.status !== "scheduled") {
    return null;
  }

  if (!input.scheduled_for) {
    throw new HTTPException(400, {
      message: "Scheduled posts require a future publish time.",
    });
  }

  if (new Date(input.scheduled_for).getTime() <= Date.now()) {
    throw new HTTPException(400, {
      message: "Scheduled publish time must be in the future.",
    });
  }
}
```

- [ ] **Step 5: Persist `scheduled_for` on create and update**

```ts
const scheduledFor =
  payload.status === "scheduled" ? payload.scheduled_for ?? null : null;

const publishedAt =
  payload.status === "published"
    ? payload.published_at || new Date().toISOString()
    : null;
```

- [ ] **Step 6: Add admin form state and controls**

```ts
interface BlogFormState {
  // existing fields...
  status: "draft" | "scheduled" | "published";
  scheduled_for: string;
}
```

```tsx
{form.status === "scheduled" ? (
  <label className="block">
    <span className="mb-2 block text-sm font-medium text-[#f0f0f5]">Publish time</span>
    <input
      type="datetime-local"
      value={form.scheduled_for}
      onChange={(event) =>
        setForm((current) => ({ ...current, scheduled_for: event.target.value }))
      }
      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[#f0f0f5]"
      required
    />
  </label>
) : null}
```

- [ ] **Step 7: Add scheduled badge and filter handling in the admin list**

```tsx
const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "scheduled" | "published">("all");
```

```tsx
<option value="scheduled">Scheduled</option>
```

- [ ] **Step 8: Run tests**

Run: `npm test -- test/api/blogs.test.ts`
Expected: PASS for schedule validation and persistence.

- [ ] **Step 9: Commit**

```bash
git add server/schemas/index.ts server/routes/blogs.ts app/routes/admin/blogs.tsx test/api/blogs.test.ts
git commit -m "feat: add scheduled blog admin flow"
```

### Task 3: Auto-publish due scheduled posts in the hourly worker flow

**Files:**
- Modify: `server/services/blog-generation.ts`
- Modify: `workers/app.ts`
- Test: `test/api/blogs-ai.test.ts`

- [ ] **Step 1: Write the failing scheduler test**

```ts
it("publishes due scheduled blog posts during the scheduler run", async () => {
  await env.DB.prepare(
    `INSERT INTO blog_posts (title, slug, content, status, scheduled_for, is_deleted)
     VALUES ('Scheduled post', 'scheduled-post', 'Body', 'scheduled', '2026-04-11T00:00:00.000Z', 0)`
  ).run();

  await runScheduledBlogMaintenance(env);

  const row = await env.DB.prepare(
    "SELECT status, published_at FROM blog_posts WHERE slug = ?"
  )
    .bind("scheduled-post")
    .first<{ status: string; published_at: string | null }>();

  expect(row?.status).toBe("published");
  expect(row?.published_at).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/api/blogs-ai.test.ts`
Expected: FAIL because no scheduled publish job exists yet.

- [ ] **Step 3: Add a helper that publishes due rows**

```ts
export async function publishDueScheduledBlogPosts(env: AppEnv["Bindings"]) {
  await env.DB.prepare(
    `UPDATE blog_posts
     SET status = 'published',
         published_at = COALESCE(scheduled_for, datetime('now')),
         updated_at = datetime('now')
     WHERE is_deleted = 0
       AND status = 'scheduled'
       AND scheduled_for IS NOT NULL
       AND scheduled_for <= datetime('now')`
  ).run();
}
```

- [ ] **Step 4: Run that helper from the scheduled worker flow before draft generation**

```ts
await publishDueScheduledBlogPosts(c.env);
const result = await generateScheduledBlogDraft(c.env);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/api/blogs-ai.test.ts`
Expected: PASS for due-post publishing.

- [ ] **Step 6: Commit**

```bash
git add server/services/blog-generation.ts workers/app.ts test/api/blogs-ai.test.ts
git commit -m "feat: auto-publish scheduled blog posts"
```

### Task 4: Add missing tracking finder in dashboard and tracking page

**Files:**
- Modify: `app/routes/admin/dashboard.tsx`
- Modify: `app/routes/admin/tracking.tsx`
- Test: `test/api/redirect.test.ts`

- [ ] **Step 1: Write the failing detection-oriented test**

```ts
it("returns no CTA URL when no active primary tag exists for the marketplace", async () => {
  const result = await resolveBlogAmazonCtaUrl({
    db: env.DB,
    ctaUrl: "https://dealsrky.com/deals/B07SG4V2T5",
    generationFocusAsin: null,
    generationMarketplace: "US",
  });

  expect(result).toBeNull();
});
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `npm test -- test/api/redirect.test.ts`
Expected: PASS or FAIL depending on current helper behavior; use it as a guard while changing finder UI logic.

- [ ] **Step 3: Extract shared coverage logic**

```ts
const supportedMarketplaces = ["US", "CA", "UK", "DE", "IT", "FR", "ES"];

function findMissingPrimaryMarketplaces(items: TrackingId[]) {
  const covered = new Set(
    items
      .filter((item) => item.is_active === 1 && (item.is_site_primary === 1 || item.is_default === 1))
      .map((item) => item.marketplace)
  );

  return supportedMarketplaces.filter((marketplace) => !covered.has(marketplace));
}
```

- [ ] **Step 4: Render the dashboard summary with direct action link**

```tsx
{missingPrimaryMarketplaces.length > 0 ? (
  <Link to="/admin/tracking" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
    <p className="m-0 text-xs font-bold uppercase tracking-[0.18em] text-red-200">Tracking Alert</p>
    <p className="mt-2 mb-0 text-sm text-red-100">
      Missing active primary coverage: {missingPrimaryMarketplaces.join(", ")}
    </p>
  </Link>
) : null}
```

- [ ] **Step 5: Add a dedicated missing-tracking action block on the tracking page**

```tsx
{missingPrimaryMarketplaces.length > 0 ? (
  <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
    <p className="m-0 text-xs font-bold uppercase tracking-[0.18em] text-red-200">Missing Tracking</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {missingPrimaryMarketplaces.map((marketplace) => (
        <span key={marketplace} className="rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-100">
          {marketplace}
        </span>
      ))}
    </div>
  </div>
) : null}
```

- [ ] **Step 6: Run focused verification**

Run: `npm run build`
Expected: PASS with dashboard and tracking pages rendering the new finder.

- [ ] **Step 7: Commit**

```bash
git add app/routes/admin/dashboard.tsx app/routes/admin/tracking.tsx test/api/redirect.test.ts
git commit -m "feat: add missing tracking finder"
```

### Task 5: Add force delete with auto-remap to marketplace default tag

**Files:**
- Modify: `server/routes/tracking.ts`
- Modify: `app/routes/admin/tracking.tsx`
- Modify: `server/routes/portal.ts`
- Test: `test/api/portal-tracking.test.ts`

- [ ] **Step 1: Write the failing force-delete tests**

```ts
it("force deletes a tag and remaps linked products to the marketplace default tag", async () => {
  await env.DB.prepare(
    `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
     VALUES (1, 1, 'old-us-20', 'US', 0, 1), (2, 1, 'default-us-20', 'US', 1, 1)`
  ).run();

  await env.DB.prepare(
    `INSERT INTO agent_products (agent_id, product_id, tracking_id)
     VALUES (1, 101, 1)`
  ).run();

  const response = await app.request(
    new Request("http://localhost/api/tracking/1?force=1", {
      method: "DELETE",
      headers: { Authorization: "Bearer test-token" },
    }),
    env
  );

  expect(response.status).toBe(200);
});
```

```ts
it("blocks force delete when no replacement default tag exists", async () => {
  const response = await app.request(
    new Request("http://localhost/api/tracking/1?force=1", {
      method: "DELETE",
      headers: { Authorization: "Bearer test-token" },
    }),
    env
  );

  expect(response.status).toBe(400);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- test/api/portal-tracking.test.ts`
Expected: FAIL because delete still hard-blocks usage.

- [ ] **Step 3: Add server-side remap logic**

```ts
const replacement = await c.env.DB.prepare(
  `SELECT id, tag
   FROM tracking_ids
   WHERE marketplace = ?
     AND is_active = 1
     AND (is_default = 1 OR is_site_primary = 1)
     AND id != ?
   ORDER BY is_default DESC, is_site_primary DESC
   LIMIT 1`
)
  .bind(current.marketplace, id)
  .first<{ id: number; tag: string }>();
```

- [ ] **Step 4: Remap linked rows before delete**

```ts
await c.env.DB.batch([
  c.env.DB.prepare(
    `UPDATE agent_products
     SET tracking_id = ?
     WHERE tracking_id = ?`
  ).bind(replacement.id, id),
  c.env.DB.prepare("DELETE FROM tracking_ids WHERE id = ?").bind(id),
]);
```

- [ ] **Step 5: Add explicit force-delete UI with confirmation**

```tsx
<button
  type="button"
  onClick={() => {
    const confirmed = window.confirm(
      `Force delete this ${trackingId.marketplace} tag? Linked products will move to the default ${trackingId.marketplace} tag.`
    );

    if (confirmed) {
      void handleDelete(trackingId.id, { force: true });
    }
  }}
>
  Force Delete
</button>
```

- [ ] **Step 6: Update response messaging**

```ts
return c.json({
  message: `Moved ${usage.count} linked mappings to default ${current.marketplace} tag and deleted old tag.`,
});
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- test/api/portal-tracking.test.ts`
Expected: PASS for remap and blocking cases.

- [ ] **Step 8: Commit**

```bash
git add server/routes/tracking.ts server/routes/portal.ts app/routes/admin/tracking.tsx test/api/portal-tracking.test.ts
git commit -m "feat: add safe force delete for tracking tags"
```

### Task 6: Final verification and deployment

**Files:**
- Modify: `app/routes/admin/blogs.tsx`
- Modify: `server/routes/blogs.ts`
- Modify: `server/routes/tracking.ts`
- Modify: `app/routes/admin/tracking.tsx`
- Modify: `app/routes/admin/dashboard.tsx`
- Modify: `workers/app.ts`
- Test: `test/api/blogs.test.ts`
- Test: `test/api/blogs-ai.test.ts`
- Test: `test/api/portal-tracking.test.ts`

- [ ] **Step 1: Run focused test suites**

Run:

```bash
npm test -- test/api/blogs.test.ts
npm test -- test/api/blogs-ai.test.ts
npm test -- test/api/portal-tracking.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Deploy from the clean worktree**

Run:

```bash
cp app/routes/admin/blogs.tsx /tmp/amazon-affiliate-deploy-2X2cmn/app/routes/admin/blogs.tsx
cp app/routes/admin/tracking.tsx /tmp/amazon-affiliate-deploy-2X2cmn/app/routes/admin/tracking.tsx
cp app/routes/admin/dashboard.tsx /tmp/amazon-affiliate-deploy-2X2cmn/app/routes/admin/dashboard.tsx
cp server/routes/blogs.ts /tmp/amazon-affiliate-deploy-2X2cmn/server/routes/blogs.ts
cp server/routes/tracking.ts /tmp/amazon-affiliate-deploy-2X2cmn/server/routes/tracking.ts
cp workers/app.ts /tmp/amazon-affiliate-deploy-2X2cmn/workers/app.ts
cp migrations/0020_blog_scheduling.sql /tmp/amazon-affiliate-deploy-2X2cmn/migrations/0020_blog_scheduling.sql
cd /tmp/amazon-affiliate-deploy-2X2cmn && npm run build && npm run deploy
```

Expected: successful build and Wrangler deploy output with a new worker version id.

- [ ] **Step 4: Verify live behavior**

Run:

```bash
curl -I https://dealsrky.com/blog
curl -s https://dealsrky.com/api/health
```

Expected:

- blog routes still serve
- health endpoint remains healthy

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add blog scheduling and tracking admin safety tools"
```
