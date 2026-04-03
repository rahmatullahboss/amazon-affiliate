import { describe, expect, it } from "vitest";
import { parseSheetSyncRow } from "../../server/services/sheet-rows";

describe("sheet row parsing", () => {
  it("parses DealsRky bridge links from a link column", () => {
    const row = parseSheetSyncRow(
      {
        link: "https://dealsrky.com/adminsheet/us/B0GG9WXK37",
      },
      "US"
    );

    expect(row).toEqual({
      asin: "B0GG9WXK37",
      marketplace: "US",
      title: null,
      category: null,
      customTitle: null,
      agentSlug: "adminsheet",
      trackingTag: null,
      rowStatus: "active",
      productStatus: "active",
    });
  });

  it("parses DealsRky redirect shortcuts and captures the tracking tag", () => {
    const row = parseSheetSyncRow(
      {
        url: "https://dealsrky.com/go/t/feroz1001-20/B0FGHZCN4Q",
      },
      "US"
    );

    expect(row).toEqual({
      asin: "B0FGHZCN4Q",
      marketplace: "US",
      title: null,
      category: null,
      customTitle: null,
      agentSlug: null,
      trackingTag: "feroz1001-20",
      rowStatus: "active",
      productStatus: "active",
    });
  });

  it("lets explicit columns override inferred link data", () => {
    const row = parseSheetSyncRow(
      {
        link: "https://dealsrky.com/adminsheet/us/B0GG9WXK37",
        marketplace: "DE",
        agent_slug: "override-agent",
        tracking_tag: "override-tag-21",
      },
      "US"
    );

    expect(row).toEqual({
      asin: "B0GG9WXK37",
      marketplace: "DE",
      title: null,
      category: null,
      customTitle: null,
      agentSlug: "override-agent",
      trackingTag: "override-tag-21",
      rowStatus: "active",
      productStatus: "active",
    });
  });
});
