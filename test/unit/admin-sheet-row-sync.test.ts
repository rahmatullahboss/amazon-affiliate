import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import * as productIngestionService from "../../server/services/product-ingestion";
import {
  syncAdminSheetRows,
  type AdminSheetSyncRowInput,
} from "../../server/services/admin-sheet-row-sync";

describe("admin sheet row sync", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();

    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active)
       VALUES (501, 'adminsheet', 'Admin Sheet', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (
         id, agent_id, tag, marketplace, is_default, is_site_primary, is_active
       ) VALUES
         (5001, 501, 'admin-us-20', 'US', 0, 1, 1),
         (5002, 501, 'admin-ca-20', 'CA', 0, 1, 1),
         (5003, 501, 'admin-es-21', 'ES', 0, 1, 1)`
    ).run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the marketplace site-primary tag when tracking_tag is blank", async () => {
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (6001, 'B0EXIST001', 'Existing Product', 'https://img.test/existing.jpg', 'US', 'active', 1)`
    ).run();

    const ensureSpy = vi.spyOn(productIngestionService, "ensureProductRecord");

    const result = await syncAdminSheetRows({
      db: env.DB,
      kv: env.KV,
      publicAppUrl: "https://dealsrky.com",
      rows: [
        {
          rowNumber: 2,
          asin: "B0EXIST001",
          marketplace: "US",
          trackingTag: null,
          customTitle: null,
        },
      ],
    });

    expect(ensureSpy).not.toHaveBeenCalled();
    expect(result.results[0]).toMatchObject({
      rowNumber: 2,
      status: "existing",
      resolvedTrackingTag: "admin-us-20",
      bridgePageUrl: "https://dealsrky.com/adminsheet/us/B0EXIST001",
      storefrontUrl: "https://dealsrky.com/adminsheet",
      redirectUrl: "https://dealsrky.com/go/adminsheet/us/B0EXIST001",
      orderLink: "https://dealsrky.com/deals/B0EXIST001",
    });

    const mapping = await env.DB.prepare(
      `SELECT agent_id, product_id, tracking_id
       FROM agent_products
       WHERE agent_id = 501 AND product_id = 6001`
    ).first<{ agent_id: number; product_id: number; tracking_id: number }>();

    expect(mapping).toEqual({
      agent_id: 501,
      product_id: 6001,
      tracking_id: 5001,
    });
  });

  it("preserves the existing mapping when the editable sheet tag is blank", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active)
       VALUES (503, 'custom-owner', 'Custom Owner', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (
         id, agent_id, tag, marketplace, is_default, is_site_primary, is_active
       ) VALUES (5006, 503, 'custom-owner-20', 'US', 1, 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (6010, 'B0BLANKTAG', 'Blank Tag Product', 'https://img.test/blank-tag.jpg', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES (503, 6010, 5006, 1)`
    ).run();

    const result = await syncAdminSheetRows({
      db: env.DB,
      kv: env.KV,
      publicAppUrl: "https://dealsrky.com",
      rows: [
        {
          rowNumber: 5,
          asin: "B0BLANKTAG",
          marketplace: "US",
          trackingTag: "",
          previousResolvedTrackingTag: "custom-owner-20",
          previousAgentSlug: "custom-owner",
          customTitle: null,
        },
      ],
    });

    expect(result.results[0]).toMatchObject({
      status: "existing",
      resolvedTrackingTag: "custom-owner-20",
      bridgePageUrl: "https://dealsrky.com/custom-owner/us/B0BLANKTAG",
    });

    const mapping = await env.DB.prepare(
      "SELECT agent_id, tracking_id FROM agent_products WHERE product_id = 6010 AND is_active = 1"
    ).first<{ agent_id: number; tracking_id: number }>();
    expect(mapping).toEqual({ agent_id: 503, tracking_id: 5006 });
  });

  it("recovers an existing website mapping when both sheet tracking fields are blank", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active)
       VALUES (504, 'recovered-owner', 'Recovered Owner', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (
         id, agent_id, tag, marketplace, is_default, is_site_primary, is_active
       ) VALUES (5007, 504, 'recovered-owner-20', 'US', 1, 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (6011, 'B0RECOVER1', 'Recovered Product', 'https://img.test/recovered.jpg', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES (504, 6011, 5007, 1)`
    ).run();

    const result = await syncAdminSheetRows({
      db: env.DB,
      kv: env.KV,
      publicAppUrl: "https://dealsrky.com",
      rows: [
        {
          rowNumber: 6,
          asin: "B0RECOVER1",
          marketplace: "US",
          trackingTag: null,
          previousResolvedTrackingTag: null,
          previousAgentSlug: null,
          customTitle: null,
        },
      ],
    });

    expect(result.results[0]).toMatchObject({
      status: "existing",
      resolvedTrackingTag: "recovered-owner-20",
      bridgePageUrl: "https://dealsrky.com/recovered-owner/us/B0RECOVER1",
    });
  });

  it("keeps the existing single tracking row when the sheet tag is unchanged", async () => {
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (6005, 'B0TAGSYNC1', 'Tag Sync Product', 'https://img.test/tag-sync.jpg', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES (501, 6005, 5001, 1)`
    ).run();

    const result = await syncAdminSheetRows({
      db: env.DB,
      kv: env.KV,
      publicAppUrl: "https://dealsrky.com",
      rows: [
        {
          rowNumber: 6,
          asin: "B0TAGSYNC1",
          marketplace: "US",
          trackingTag: "admin-us-20",
          previousResolvedTrackingTag: "admin-us-20",
          customTitle: null,
        },
      ],
    });

    expect(result.results[0]).toMatchObject({
      rowNumber: 6,
      status: "existing",
      resolvedTrackingTag: "admin-us-20",
    });

    const { results } = await env.DB.prepare(
      "SELECT id, tag FROM tracking_ids WHERE agent_id = 501 AND marketplace = 'US'"
    ).all<{ id: number; tag: string }>();
    expect(results).toEqual([{ id: 5001, tag: "admin-us-20" }]);

    const mapping = await env.DB.prepare(
      "SELECT tracking_id FROM agent_products WHERE agent_id = 501 AND product_id = 6005"
    ).first<{ tracking_id: number }>();
    expect(mapping?.tracking_id).toBe(5001);
  });

  it("switches the existing account to a new sheet tag without creating a duplicate account", async () => {
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (6007, 'B0TAGNEW01', 'New Tag Product', 'https://img.test/new-tag.jpg', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES (501, 6007, 5001, 1)`
    ).run();

    const result = await syncAdminSheetRows({
      db: env.DB,
      kv: env.KV,
      publicAppUrl: "https://dealsrky.com",
      rows: [
        {
          rowNumber: 8,
          asin: "B0TAGNEW01",
          marketplace: "US",
          trackingTag: "new-agent-tag-20",
          previousResolvedTrackingTag: "admin-us-20",
          customTitle: null,
        },
      ],
    });

    expect(result.results[0]).toMatchObject({
      rowNumber: 8,
      status: "existing",
      resolvedTrackingTag: "new-agent-tag-20",
      bridgePageUrl: "https://dealsrky.com/new-agent-tag/us/B0TAGNEW01",
    });

    const switchedTracking = await env.DB.prepare(
      `SELECT id, agent_id, tag, marketplace, is_default, is_active, is_portal_editable
       FROM tracking_ids
       WHERE id = 5001`
    ).first<{
      id: number;
      agent_id: number;
      tag: string;
      marketplace: string;
      is_default: number;
      is_active: number;
      is_portal_editable: number;
    }>();
    expect(switchedTracking).toMatchObject({
      id: 5001,
      agent_id: 501,
      tag: "new-agent-tag-20",
      marketplace: "US",
      is_default: 1,
      is_active: 1,
      is_portal_editable: 0,
    });

    const duplicateAgent = await env.DB.prepare(
      "SELECT id FROM agents WHERE slug = 'new-agent-tag-20'"
    ).first<{ id: number }>();
    expect(duplicateAgent).toBeNull();

    const mapping = await env.DB.prepare(
      "SELECT tracking_id FROM agent_products WHERE agent_id = 501 AND product_id = 6007"
    ).first<{ tracking_id: number }>();
    expect(mapping?.tracking_id).toBe(5001);

    const alias = await env.DB.prepare(
      "SELECT slug FROM agent_slug_aliases WHERE tracking_id = 5001 AND marketplace = 'US'"
    ).first<{ slug: string }>();
    expect(alias?.slug).toBe("new-agent-tag");
  });

  it("auto-creates an agent and tag for a brand-new explicit sheet tag", async () => {
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (6009, 'B0NEWAUTO1', 'Auto Agent Product', 'https://img.test/auto-agent.jpg', 'US', 'active', 1)`
    ).run();

    const result = await syncAdminSheetRows({
      db: env.DB,
      kv: env.KV,
      publicAppUrl: "https://dealsrky.com",
      rows: [
        {
          rowNumber: 10,
          asin: "B0NEWAUTO1",
          marketplace: "US",
          trackingTag: "freshagent-20",
          previousResolvedTrackingTag: null,
          customTitle: null,
        },
      ],
    });

    expect(result.results[0]).toMatchObject({
      rowNumber: 10,
      status: "existing",
      resolvedTrackingTag: "freshagent-20",
      bridgePageUrl: "https://dealsrky.com/freshagent/us/B0NEWAUTO1",
    });

    const agent = await env.DB.prepare(
      "SELECT id, name, slug, is_active FROM agents WHERE slug = 'freshagent'"
    ).first<{ id: number; name: string; slug: string; is_active: number }>();
    expect(agent).toMatchObject({
      name: "freshagent-20",
      slug: "freshagent",
      is_active: 1,
    });

    const tracking = await env.DB.prepare(
      "SELECT agent_id, tag, marketplace, is_active FROM tracking_ids WHERE tag = 'freshagent-20'"
    ).first<{ agent_id: number; tag: string; marketplace: string; is_active: number }>();
    expect(tracking).toMatchObject({
      agent_id: agent?.id,
      tag: "freshagent-20",
      marketplace: "US",
      is_active: 1,
    });
  });

  it("processes duplicate product rows sequentially in input order", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active)
       VALUES (505, 'duplicate-owner', 'Duplicate Owner', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (
         id, agent_id, tag, marketplace, is_default, is_site_primary, is_active
       ) VALUES (5008, 505, 'duplicate-old-20', 'US', 1, 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (6012, 'B0DUPSEQ01', 'Duplicate Product', 'https://img.test/duplicate.jpg', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES (505, 6012, 5008, 1)`
    ).run();

    const result = await syncAdminSheetRows({
      db: env.DB,
      kv: env.KV,
      publicAppUrl: "https://dealsrky.com",
      rows: [
        {
          rowNumber: 20,
          asin: "B0DUPSEQ01",
          marketplace: "US",
          trackingTag: "duplicate-first-20",
          previousResolvedTrackingTag: "duplicate-old-20",
          previousAgentSlug: "duplicate-owner",
          customTitle: null,
        },
        {
          rowNumber: 21,
          asin: "https://www.amazon.com/dp/B0DUPSEQ01",
          marketplace: "us",
          trackingTag: "duplicate-second-20",
          previousResolvedTrackingTag: "duplicate-old-20",
          previousAgentSlug: "duplicate-owner",
          customTitle: null,
        },
      ],
    });

    expect(result.results.map((item) => item.rowNumber)).toEqual([20, 21]);
    expect(result.results.map((item) => item.resolvedTrackingTag)).toEqual([
      "duplicate-first-20",
      "duplicate-second-20",
    ]);

    const tracking = await env.DB.prepare(
      `SELECT id, tag
       FROM tracking_ids
       WHERE agent_id = 505 AND marketplace = 'US' AND is_active = 1`
    ).first<{ id: number; tag: string }>();
    expect(tracking).toEqual({ id: 5008, tag: "duplicate-second-20" });

    const mapping = await env.DB.prepare(
      `SELECT tracking_id
       FROM agent_products
       WHERE agent_id = 505 AND product_id = 6012 AND is_active = 1`
    ).first<{ tracking_id: number }>();
    expect(mapping?.tracking_id).toBe(5008);
  });

  it("removes accidental wrapping quotes from a tracking tag", async () => {
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (6008, 'B0TAGQUOTE', 'Quoted Tag Product', 'https://img.test/quote.jpg', 'US', 'active', 1)`
    ).run();

    const result = await syncAdminSheetRows({
      db: env.DB,
      kv: env.KV,
      publicAppUrl: "https://dealsrky.com",
      rows: [
        {
          rowNumber: 9,
          asin: "B0TAGQUOTE",
          marketplace: "US",
          trackingTag: 'admin-us-20"',
          previousResolvedTrackingTag: "admin-us-20",
          customTitle: null,
        },
      ],
    });

    expect(result.results[0]).toMatchObject({
      rowNumber: 9,
      status: "existing",
      resolvedTrackingTag: "admin-us-20",
    });
  });

  it("writes a website-renamed tag back for the same agent without choosing another agent mapping", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active)
       VALUES (502, 'other-agent', 'Other Agent', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (
         id, agent_id, tag, marketplace, is_default, is_site_primary, is_active
       ) VALUES (5005, 502, 'other-agent-20', 'US', 1, 0, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (6006, 'B0TAGLIVE1', 'Live Tag Product', 'https://img.test/tag-live.jpg', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, is_active)
       VALUES
         (501, 6006, 5001, 1),
         (502, 6006, 5005, 1)`
    ).run();
    await env.DB.prepare(
      "UPDATE tracking_ids SET tag = 'admin-us-live-20' WHERE id = 5001"
    ).run();

    const result = await syncAdminSheetRows({
      db: env.DB,
      kv: env.KV,
      publicAppUrl: "https://dealsrky.com",
      rows: [
        {
          rowNumber: 7,
          asin: "B0TAGLIVE1",
          marketplace: "US",
          trackingTag: "admin-us-20",
          previousResolvedTrackingTag: "admin-us-20",
          previousAgentSlug: "adminsheet",
          customTitle: null,
        },
      ],
    });

    expect(result.results[0]).toMatchObject({
      rowNumber: 7,
      status: "existing",
      resolvedTrackingTag: "admin-us-live-20",
      bridgePageUrl: "https://dealsrky.com/adminsheet/us/B0TAGLIVE1",
    });

    const mapping = await env.DB.prepare(
      `SELECT tracking_id
       FROM agent_products
       WHERE agent_id = 501 AND product_id = 6006`
    ).first<{ tracking_id: number }>();
    expect(mapping?.tracking_id).toBe(5001);
  });

  it("fetches a missing product once and returns generated links", async () => {
    const ensureSpy = vi
      .spyOn(productIngestionService, "ensureProductRecord")
      .mockImplementation(async (input) => {
        await input.db
          .prepare(
            `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
             VALUES (6002, ?, 'Fetched Product', 'https://img.test/fetched.jpg', ?, 'active', 1)`
          )
          .bind(input.asin, input.marketplace)
          .run();

        return {
          id: 6002,
          asin: input.asin,
          title: "Fetched Product",
          image_url: "https://img.test/fetched.jpg",
          marketplace: input.marketplace,
          category: null,
          status: "active",
          description: null,
          features: null,
          review_content: null,
          product_images: null,
          aplus_images: null,
        };
      });

    const result = await syncAdminSheetRows({
      db: env.DB,
      kv: env.KV,
      publicAppUrl: "https://dealsrky.com",
      apiKey: "rapid-key",
      rows: [
        {
          rowNumber: 3,
          asin: "B0MISSING1",
          marketplace: "CA",
          trackingTag: "",
          customTitle: "Sheet title",
        },
      ],
    });

    expect(ensureSpy).toHaveBeenCalledTimes(1);
    expect(result.results[0]).toMatchObject({
      rowNumber: 3,
      status: "live",
      productTitle: "Fetched Product",
      resolvedTrackingTag: "admin-ca-20",
      bridgePageUrl: "https://dealsrky.com/adminsheet/ca/B0MISSING1",
    });
  });

  it("processes a 100-row batch independently", async () => {
    const rows: AdminSheetSyncRowInput[] = Array.from({ length: 100 }, (_, index) => ({
      rowNumber: index + 2,
      asin: index === 50 ? "INVALID" : `B${String(index).padStart(9, "0")}`,
      marketplace: "US",
      trackingTag: null,
      customTitle: null,
    }));

    vi.spyOn(productIngestionService, "ensureProductRecord").mockImplementation(async (input) => {
      const result = await input.db
        .prepare(
          `INSERT INTO products (asin, title, image_url, marketplace, status, is_active)
           VALUES (?, ?, 'https://img.test/batch.jpg', ?, 'active', 1)`
        )
        .bind(input.asin, `Product ${input.asin}`, input.marketplace)
        .run();

      return {
        id: Number(result.meta.last_row_id),
        asin: input.asin,
        title: `Product ${input.asin}`,
        image_url: "https://img.test/batch.jpg",
        marketplace: input.marketplace,
        category: null,
        status: "active",
        description: null,
        features: null,
        review_content: null,
        product_images: null,
        aplus_images: null,
      };
    });

    const result = await syncAdminSheetRows({
      db: env.DB,
      kv: env.KV,
      publicAppUrl: "https://dealsrky.com",
      rows,
    });

    expect(result.results).toHaveLength(100);
    expect(result.results.filter((row) => row.status === "failed")).toHaveLength(1);
    expect(result.results.filter((row) => row.status === "live")).toHaveLength(99);
    expect(result.results[50]).toMatchObject({
      rowNumber: 52,
      status: "failed",
      errorMessage: "Provide a valid 10-character ASIN.",
    });
  });

  it("accepts ES marketplace rows from the admin sheet", async () => {
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (6003, 'B0EXISTES1', 'Existing ES Product', 'https://img.test/es.jpg', 'ES', 'active', 1)`
    ).run();

    const ensureSpy = vi.spyOn(productIngestionService, "ensureProductRecord");

    const result = await syncAdminSheetRows({
      db: env.DB,
      kv: env.KV,
      publicAppUrl: "https://dealsrky.com",
      rows: [
        {
          rowNumber: 4,
          asin: "B0EXISTES1",
          marketplace: "es",
          trackingTag: null,
          customTitle: null,
        },
      ],
    });

    expect(ensureSpy).not.toHaveBeenCalled();
    expect(result.results[0]).toMatchObject({
      rowNumber: 4,
      marketplace: "ES",
      status: "existing",
      resolvedTrackingTag: "admin-es-21",
      bridgePageUrl: "https://dealsrky.com/adminsheet/es/B0EXISTES1",
    });
  });

  it("force refreshes an existing product when requested by the sheet", async () => {
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (6004, 'B0REFRESH1', 'Old Product', 'https://img.test/old.jpg', 'US', 'active', 1)`
    ).run();

    const refreshSpy = vi
      .spyOn(productIngestionService, "refreshProductRecord")
      .mockImplementation(async (input) => {
        await input.db
          .prepare(
            `UPDATE products
             SET title = 'Fresh Product', image_url = 'https://img.test/fresh.jpg'
             WHERE asin = ? AND marketplace = ?`
          )
          .bind(input.asin, input.marketplace)
          .run();

        return {
          id: 6004,
          asin: input.asin,
          title: "Fresh Product",
          image_url: "https://img.test/fresh.jpg",
          marketplace: input.marketplace,
          category: null,
          status: "active",
          description: null,
          features: null,
          review_content: null,
          product_images: null,
          aplus_images: null,
        };
      });

    const result = await syncAdminSheetRows({
      db: env.DB,
      kv: env.KV,
      publicAppUrl: "https://dealsrky.com",
      rows: [
        {
          rowNumber: 5,
          asin: "B0REFRESH1",
          marketplace: "US",
          trackingTag: null,
          customTitle: null,
          forceUpdateExisting: true,
        },
      ],
    });

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(result.results[0]).toMatchObject({
      rowNumber: 5,
      status: "updated",
      productTitle: "Fresh Product",
      resolvedTrackingTag: "admin-us-20",
    });
  });

  it("rejects batches larger than 100 rows", async () => {
    const rows: AdminSheetSyncRowInput[] = Array.from({ length: 101 }, (_, index) => ({
      rowNumber: index + 2,
      asin: `B${String(index).padStart(9, "0")}`,
      marketplace: "US",
      trackingTag: null,
      customTitle: null,
    }));

    await expect(
      syncAdminSheetRows({
        db: env.DB,
        kv: env.KV,
        publicAppUrl: "https://dealsrky.com",
        rows,
      })
    ).rejects.toThrow("A maximum of 100 rows can be synced per request.");
  });
});
