import { describe, expect, it } from "vitest";
import {
  getMarketplaceCookieValue,
  inferMarketplaceFromCountry,
  resolveMarketplaceContext,
  resolvePreferredMarketplace,
} from "../../app/utils/marketplace";

describe("marketplace utils", () => {
  it("reads preferred marketplace from query first", () => {
    const marketplace = resolvePreferredMarketplace({
      searchParams: new URLSearchParams("market=DE"),
      cookieHeader: "preferred_marketplace=UK",
      countryHeader: "US",
    });

    expect(marketplace).toBe("DE");
  });

  it("falls back to cookie when query is missing", () => {
    const marketplace = resolvePreferredMarketplace({
      searchParams: new URLSearchParams("page=2"),
      cookieHeader: "foo=bar; preferred_marketplace=FR; hello=world",
      countryHeader: "US",
    });

    expect(marketplace).toBe("FR");
  });

  it("maps cloudflare country headers to supported marketplaces", () => {
    expect(inferMarketplaceFromCountry("GB")).toBe("UK");
    expect(inferMarketplaceFromCountry("DE")).toBe("DE");
    expect(inferMarketplaceFromCountry("BD")).toBe("US");
  });

  it("extracts marketplace cookie values safely", () => {
    expect(getMarketplaceCookieValue("foo=1; preferred_marketplace=IT; bar=2")).toBe("IT");
    expect(getMarketplaceCookieValue("foo=1")).toBeNull();
  });

  it("reports when the selected marketplace comes from geo detection", () => {
    const context = resolveMarketplaceContext({
      searchParams: new URLSearchParams(),
      cookieHeader: null,
      countryHeader: "GB",
    });

    expect(context).toEqual({
      marketplace: "UK",
      source: "geo",
      detectedMarketplace: "UK",
    });
  });

  it("preserves the selected marketplace source while still exposing the detected suggestion", () => {
    const context = resolveMarketplaceContext({
      searchParams: new URLSearchParams("market=DE"),
      cookieHeader: "preferred_marketplace=FR",
      countryHeader: "US",
    });

    expect(context).toEqual({
      marketplace: "DE",
      source: "query",
      detectedMarketplace: "US",
    });
  });
});
