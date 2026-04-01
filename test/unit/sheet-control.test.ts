import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import * as googleSheetsService from "../../server/services/google-sheets";
import {
  createAgentSheetSources,
  listAgentSheetSources,
} from "../../server/services/sheet-control";

describe("Sheet control service", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM sheet_submission_rows").run();
    await env.DB.prepare("DELETE FROM sheet_submission_batches").run();
    await env.DB.prepare("DELETE FROM agent_sheet_sources").run();
    await env.DB.prepare("DELETE FROM agents").run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates multiple per-tab sheet sources for the same agent", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active) VALUES (301, 'tab-agent', 'Tab Agent', 1)`
    ).run();

    const sources = await createAgentSheetSources(env.DB, {
      agentId: 301,
      sheetUrl: "https://docs.google.com/spreadsheets/d/test-sheet-id/edit?gid=111",
      selections: [
        { sheetTabName: "USA", sheetGid: 111 },
        { sheetTabName: "UK", sheetGid: 222 },
      ],
      isActive: true,
      autoApproveCleanRows: true,
    });

    expect(sources).toHaveLength(2);

    const savedSources = await listAgentSheetSources(env.DB);
    expect(savedSources.map((source) => source.sheet_tab_name)).toEqual(["UK", "USA"]);
  });

  it("rejects duplicate tab sources for the same agent and spreadsheet", async () => {
    await env.DB.prepare(
      `INSERT INTO agents (id, slug, name, is_active) VALUES (302, 'dup-agent', 'Dup Agent', 1)`
    ).run();

    await createAgentSheetSources(env.DB, {
      agentId: 302,
      sheetUrl: "https://docs.google.com/spreadsheets/d/test-sheet-id/edit?gid=111",
      selections: [{ sheetTabName: "USA", sheetGid: 111 }],
      isActive: true,
      autoApproveCleanRows: true,
    });

    await expect(
      createAgentSheetSources(env.DB, {
        agentId: 302,
        sheetUrl: "https://docs.google.com/spreadsheets/d/test-sheet-id/edit?gid=111",
        selections: [{ sheetTabName: "USA", sheetGid: 111 }],
        isActive: true,
        autoApproveCleanRows: true,
      })
    ).rejects.toThrow("One or more selected tabs are already configured for this agent.");
  });

  it("discovers spreadsheet tabs from Google metadata", async () => {
    vi.spyOn(googleSheetsService, "listSpreadsheetTabs").mockResolvedValue([
      { sheetId: 111, title: "USA" },
      { sheetId: 222, title: "Canada" },
    ]);

    const tabs = await googleSheetsService.listSpreadsheetTabs({
      credentials: {
        clientEmail: "sheet@test.local",
        privateKey: "private-key",
      },
      spreadsheetId: "test-sheet-id",
    });

    expect(tabs).toEqual([
      { sheetId: 111, title: "USA" },
      { sheetId: 222, title: "Canada" },
    ]);
  });
});
