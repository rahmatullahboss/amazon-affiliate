import { describe, expect, it } from "vitest";
import { getCreatorsRegionBaseUrl } from "../../server/services/creators-api";

describe("Creators API region routing", () => {
  it("routes US and CA to the North America endpoint", () => {
    expect(getCreatorsRegionBaseUrl("US")).toBe("https://creatorsapi-na.amazon.com");
    expect(getCreatorsRegionBaseUrl("CA")).toBe("https://creatorsapi-na.amazon.com");
  });

  it("routes UK, DE, IT, FR, ES to the Europe endpoint", () => {
    for (const marketplace of ["UK", "DE", "IT", "FR", "ES"] as const) {
      expect(getCreatorsRegionBaseUrl(marketplace)).toBe(
        "https://creatorsapi-eu.amazon.com"
      );
    }
  });
});
