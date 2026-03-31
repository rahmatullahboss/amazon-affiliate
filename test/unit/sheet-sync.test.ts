import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import * as googleSheetsService from "../../server/services/google-sheets";
import * as productIngestionService from "../../server/services/product-ingestion";
import { mirrorProductsToSheet, syncProductsFromSheet } from "../../server/services/sheet-sync";

describe("Sheet sync service", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM sheet_sync_logs").run();
    await env.DB.prepare("DELETE FROM agent_products").run();
    await env.DB.prepare("DELETE FROM tracking_ids").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM agents").run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an agent-product mapping from a sheet row", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active) VALUES (101, 'sheet-agent', 'Sheet Agent', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (1001, 101, 'sheet-agent-us-20', 'US', 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (2001, 'B0TEST0001', 'Existing Product', 'https://img.test/product.jpg', 'US', 'active', 1)`
    ).run();

    vi.spyOn(googleSheetsService, "readSheetRows").mockResolvedValue([
      ["asin", "marketplace", "agent_slug", "tracking_tag", "custom_title", "status"],
      ["B0TEST0001", "US", "sheet-agent", "sheet-agent-us-20", "Sheet Custom Title", "active"],
    ]);
    vi.spyOn(productIngestionService, "ensureProductRecord").mockResolvedValue({
      id: 2001,
      asin: "B0TEST0001",
      title: "Existing Product",
      image_url: "https://img.test/product.jpg",
      marketplace: "US",
      category: null,
      status: "active",
      description: null,
      features: null,
      review_content: null,
      product_images: null,
      aplus_images: null,
    });

    const summary = await syncProductsFromSheet({
      db: env.DB,
      kv: env.KV,
      config: {
        id: 1,
        sheet_url: "https://docs.google.com/spreadsheets/d/test-sheet-id/edit?gid=0",
        sheet_tab_name: "Products",
        default_marketplace: "US",
        is_active: 1,
        last_imported_at: null,
        last_exported_at: null,
        created_at: "",
        updated_at: "",
      },
      credentials: {
        clientEmail: "sheet@test.local",
        privateKey: "private-key",
      },
    });

    expect(summary).toEqual({
      totalRows: 1,
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
    });

    const mapping = await env.DB.prepare(
      `SELECT agent_id, product_id, tracking_id, custom_title, is_active
       FROM agent_products
       WHERE agent_id = 101 AND product_id = 2001`
    ).first<{
      agent_id: number;
      product_id: number;
      tracking_id: number;
      custom_title: string | null;
      is_active: number;
    }>();

    expect(mapping).toEqual({
      agent_id: 101,
      product_id: 2001,
      tracking_id: 1001,
      custom_title: "Sheet Custom Title",
      is_active: 1,
    });
  });

  it("updates an existing mapping to hidden from the sheet", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active) VALUES (102, 'hidden-agent', 'Hidden Agent', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (1002, 102, 'hidden-agent-us-20', 'US', 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, status, is_active)
       VALUES (2002, 'B0TEST0002', 'Hidden Product', 'https://img.test/hidden.jpg', 'US', 'active', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (102, 2002, 1002, 'Old Title', 1)`
    ).run();

    vi.spyOn(googleSheetsService, "readSheetRows").mockResolvedValue([
      ["asin", "marketplace", "agent_slug", "status", "custom_title"],
      ["B0TEST0002", "US", "hidden-agent", "hidden", "Hidden From Sheet"],
    ]);
    vi.spyOn(productIngestionService, "ensureProductRecord").mockResolvedValue({
      id: 2002,
      asin: "B0TEST0002",
      title: "Hidden Product",
      image_url: "https://img.test/hidden.jpg",
      marketplace: "US",
      category: null,
      status: "active",
      description: null,
      features: null,
      review_content: null,
      product_images: null,
      aplus_images: null,
    });

    const summary = await syncProductsFromSheet({
      db: env.DB,
      kv: env.KV,
      config: {
        id: 1,
        sheet_url: "https://docs.google.com/spreadsheets/d/test-sheet-id/edit?gid=0",
        sheet_tab_name: "Products",
        default_marketplace: "US",
        is_active: 1,
        last_imported_at: null,
        last_exported_at: null,
        created_at: "",
        updated_at: "",
      },
      credentials: {
        clientEmail: "sheet@test.local",
        privateKey: "private-key",
      },
    });

    expect(summary).toEqual({
      totalRows: 1,
      createdCount: 0,
      updatedCount: 1,
      skippedCount: 0,
    });

    const mapping = await env.DB.prepare(
      `SELECT custom_title, is_active
       FROM agent_products
       WHERE agent_id = 102 AND product_id = 2002`
    ).first<{ custom_title: string | null; is_active: number }>();

    expect(mapping).toEqual({
      custom_title: "Hidden From Sheet",
      is_active: 0,
    });
  });

  it("exports mapping-aware rows with storefront and bridge links", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active) VALUES (103, 'export-agent', 'Export Agent', 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO tracking_ids (id, agent_id, tag, marketplace, is_default, is_active)
       VALUES (1003, 103, 'export-agent-us-20', 'US', 1, 1)`
    ).run();
    await env.DB.prepare(
      `INSERT INTO products (id, asin, title, image_url, marketplace, category, status, is_active, created_at, updated_at)
       VALUES (2003, 'B0TEST0003', 'Exported Product', 'https://img.test/export.jpg', 'US', 'electronics', 'active', 1, '2026-03-01 00:00:00', '2026-03-02 00:00:00')`
    ).run();
    await env.DB.prepare(
      `INSERT INTO agent_products (agent_id, product_id, tracking_id, custom_title, is_active)
       VALUES (103, 2003, 1003, 'Export Title', 1)`
    ).run();

    const writeSpy = vi.spyOn(googleSheetsService, "writeSheetRows").mockResolvedValue();

    const summary = await mirrorProductsToSheet({
      db: env.DB,
      config: {
        id: 1,
        sheet_url: "https://docs.google.com/spreadsheets/d/test-sheet-id/edit?gid=0",
        sheet_tab_name: "Products",
        default_marketplace: "US",
        is_active: 1,
        last_imported_at: null,
        last_exported_at: null,
        created_at: "",
        updated_at: "",
      },
      credentials: {
        clientEmail: "sheet@test.local",
        privateKey: "private-key",
      },
      publicAppUrl: "https://example.com",
    });

    expect(summary.totalRows).toBe(1);
    expect(writeSpy).toHaveBeenCalledTimes(1);

    const rows = writeSpy.mock.calls[0]?.[0]?.rows;
    expect(rows?.[0]).toEqual([
      "asin",
      "marketplace",
      "agent_slug",
      "tracking_tag",
      "custom_title",
      "status",
      "product_status",
      "bridge_page_url",
      "storefront_url",
      "redirect_url",
      "title",
      "category",
      "is_active",
      "created_at",
      "updated_at",
    ]);
    expect(rows?.[1]).toEqual([
      "B0TEST0003",
      "US",
      "export-agent",
      "export-agent-us-20",
      "Export Title",
      "active",
      "active",
      "https://example.com/export-agent/B0TEST0003",
      "https://example.com/export-agent",
      "https://example.com/go/export-agent/B0TEST0003",
      "Exported Product",
      "electronics",
      "1",
      "2026-03-01 00:00:00",
      "2026-03-02 00:00:00",
    ]);
  });
});
