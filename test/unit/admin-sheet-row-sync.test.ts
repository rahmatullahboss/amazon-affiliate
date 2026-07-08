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
