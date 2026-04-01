import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken } from "../factories/token";
import * as googleSheetsService from "../../server/services/google-sheets";

describe("Sheet control API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM sheet_submission_rows").run();
    await env.DB.prepare("DELETE FROM sheet_submission_batches").run();
    await env.DB.prepare("DELETE FROM agent_sheet_sources").run();
    await env.DB.prepare("DELETE FROM agents").run();
    await env.DB.prepare("DELETE FROM admin_users").run();
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sheet@test.local";
    env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "private-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("discovers tabs from a spreadsheet URL", async () => {
    await DbFactory.seedAdmin(env.DB);
    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    vi.spyOn(googleSheetsService, "listSpreadsheetTabs").mockResolvedValue([
      { sheetId: 111, title: "USA" },
      { sheetId: 222, title: "UK" },
      { sheetId: 333, title: "Walmart" },
    ]);

    const response = await apiApp.fetch(
      new Request("http://localhost/api/sheet-control/discover-tabs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          sheet_url: "https://docs.google.com/spreadsheets/d/test-sheet-id/edit?gid=111",
        }),
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      spreadsheet_id: string;
      tabs: Array<{ gid: number; title: string }>;
    };

    expect(payload).toEqual({
      spreadsheet_id: "test-sheet-id",
      tabs: [
        { gid: 111, title: "USA" },
        { gid: 222, title: "UK" },
        { gid: 333, title: "Walmart" },
      ],
    });
  });

  it("creates one source per selected tab", async () => {
    await DbFactory.seedAdmin(env.DB);
    await DbFactory.seedAgent(env.DB, 401, "multi-tab-agent", "Multi Tab Agent");
    const token = await generateAdminToken(env.JWT_SECRET || "test-secret");

    const response = await apiApp.fetch(
      new Request("http://localhost/api/sheet-control/sources", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          agent_id: 401,
          sheet_url: "https://docs.google.com/spreadsheets/d/test-sheet-id/edit?gid=111",
          selected_tabs: [
            { gid: 111, title: "USA" },
            { gid: 222, title: "Canada" },
          ],
          is_active: true,
          auto_approve_clean_rows: true,
        }),
      }),
      env as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(201);

    const saved = await env.DB
      .prepare(
        `SELECT sheet_tab_name, sheet_gid
         FROM agent_sheet_sources
         WHERE agent_id = ?
         ORDER BY sheet_tab_name ASC`
      )
      .bind(401)
      .all<{ sheet_tab_name: string; sheet_gid: number }>();

    expect(saved.results).toEqual([
      { sheet_tab_name: "Canada", sheet_gid: 222 },
      { sheet_tab_name: "USA", sheet_gid: 111 },
    ]);
  });
});
