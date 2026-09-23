import { describe, expect, it } from "vitest";
import {
  AMZREBATE_SHEET_TABS,
  buildAmzRebateAmazonUrl,
  buildAmzRebateCopyText,
  isAmzRebateHost,
  parseAmzRebateRows,
} from "../../server/services/amzrebate";

describe("AMZ Rebate storefront", () => {
  it("recognizes only the AMZ Rebate custom domain", () => {
    expect(isAmzRebateHost("amzrebate.online")).toBe(true);
    expect(isAmzRebateHost("www.amzrebate.online")).toBe(true);
    expect(isAmzRebateHost("dealsrky.com")).toBe(false);
  });

  it("keeps the supported marketplace sheet mapping explicit", () => {
    expect(AMZREBATE_SHEET_TABS).toEqual([
      { marketplace: "US", sheetTabName: "ASINs-US" },
      { marketplace: "CA", sheetTabName: "ASINs-CA" },
      { marketplace: "UK", sheetTabName: "ASINs-UK" },
      { marketplace: "DE", sheetTabName: "ASINs-DE" },
      { marketplace: "FR", sheetTabName: "ASINs-FR" },
      { marketplace: "IT", sheetTabName: "ASINs-IT" },
      { marketplace: "ES", sheetTabName: "ASINs-ES" },
    ]);
  });

  it("parses only submitted existing ASIN rows even when the first header cell is malformed", () => {
    const rows = [
      ["9", "marketplace", "tracking_tag", "custom_title", "submit", "sync_status", "product_title"],
      [],
      [
        "B09GTRVJQM",
        "US",
        "someone-else-20",
        "",
        "YES",
        "Existing",
        "LEVOIT Air Purifier",
      ],
      [
        "B0GSF151ZB",
        "US",
        "someone-else-20",
        "",
        "YES",
        "Failed",
        "",
      ],
      [
        "B0HDNX9ZGG",
        "US",
        "someone-else-20",
        "",
        "",
        "",
        "",
      ],
    ];

    expect(parseAmzRebateRows(rows, "US")).toEqual([
      {
        asin: "B09GTRVJQM",
        marketplace: "US",
        title: "LEVOIT Air Purifier",
      },
    ]);
  });

  it("always builds the order URL with the configured affiliate tag", () => {
    expect(buildAmzRebateAmazonUrl("B09GTRVJQM", "US", "rky3001-20")).toBe(
      "https://www.amazon.com/dp/B09GTRVJQM?tag=rky3001-20"
    );
  });

  it("copies the requested details with the default associate disclosure", () => {
    expect(
      buildAmzRebateCopyText({
        asin: "B09GTRVJQM",
        marketplace: "US",
        title: "LEVOIT Air Purifier",
        storeName: "Amazon US",
        orderLink: "https://www.amazon.com/dp/B09GTRVJQM?tag=rky3001-20",
      })
    ).toBe(
      [
        "Product: LEVOIT Air Purifier",
        "Marketplace: Amazon US",
        "ASIN: B09GTRVJQM",
        "Store name: Amazon US",
        "Order Link: https://www.amazon.com/dp/B09GTRVJQM?tag=rky3001-20",
        "",
        "As an associate, I earn a small commission.",
      ].join("\n")
    );
  });
});
