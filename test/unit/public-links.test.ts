import { describe, expect, it } from "vitest";
import { buildMarketplaceReadyLinkTemplate } from "../../app/utils/public-links";

describe("buildMarketplaceReadyLinkTemplate", () => {
  it("builds a country-coded ready link template with the provided slug", () => {
    expect(
      buildMarketplaceReadyLinkTemplate(
        "https://dealsrky.com/app/path?ignored=yes",
        "hasan-uk",
        "UK"
      )
    ).toBe("https://dealsrky.com/hasan-uk/uk/{ASIN}");
  });
});
