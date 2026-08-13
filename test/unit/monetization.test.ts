import { describe, expect, it } from "vitest";
import {
  buildPublicMonetizationConfig,
  isMonetizationEligiblePath,
} from "../../app/utils/monetization";

describe("monetization configuration", () => {
  it("is disabled by default", () => {
    expect(buildPublicMonetizationConfig({})).toEqual({
      enabled: false,
      provider: null,
      tagAdapter: null,
      scriptUrl: null,
      loadDelayMs: 10_000,
    });
  });

  it("selects only the configured Adsterra script", () => {
    expect(
      buildPublicMonetizationConfig({
        ADS_ENABLED: "true",
        ADS_PROVIDER: "adsterra",
        ADS_TAG_ADAPTER: "single-script-src",
        ADSTERRA_SCRIPT_URL: "https://ads.example.com/adsterra.js",
        MONETAG_SCRIPT_URL: "https://ads.example.com/monetag.js",
        ADS_LOAD_DELAY_MS: "12000",
      })
    ).toEqual({
      enabled: true,
      provider: "adsterra",
      tagAdapter: "single-script-src",
      scriptUrl: "https://ads.example.com/adsterra.js",
      loadDelayMs: 12_000,
    });
  });

  it("selects only the configured Monetag script", () => {
    expect(
      buildPublicMonetizationConfig({
        ADS_ENABLED: "1",
        ADS_PROVIDER: "monetag",
        ADS_TAG_ADAPTER: "single-script-src",
        ADSTERRA_SCRIPT_URL: "https://ads.example.com/adsterra.js",
        MONETAG_SCRIPT_URL: "https://ads.example.com/monetag.js",
      })
    ).toEqual({
      enabled: true,
      provider: "monetag",
      tagAdapter: "single-script-src",
      scriptUrl: "https://ads.example.com/monetag.js",
      loadDelayMs: 10_000,
    });
  });

  it("normalizes protocol-relative publisher script URLs to HTTPS", () => {
    expect(
      buildPublicMonetizationConfig({
        ADS_ENABLED: "true",
        ADS_PROVIDER: "adsterra",
        ADS_TAG_ADAPTER: "single-script-src",
        ADSTERRA_SCRIPT_URL: "//ads.example.com/native.js",
      }).scriptUrl
    ).toBe("https://ads.example.com/native.js");
  });

  it("refuses non-HTTPS or incomplete ad configuration", () => {
    expect(
      buildPublicMonetizationConfig({
        ADS_ENABLED: "true",
        ADS_PROVIDER: "adsterra",
        ADS_TAG_ADAPTER: "single-script-src",
        ADSTERRA_SCRIPT_URL: "http://ads.example.com/insecure.js",
      }).enabled
    ).toBe(false);

    expect(
      buildPublicMonetizationConfig({
        ADS_ENABLED: "true",
        ADS_PROVIDER: "monetag",
      }).enabled
    ).toBe(false);
  });

  it("requires an explicitly confirmed supported tag adapter before activation", () => {
    expect(
      buildPublicMonetizationConfig({
        ADS_ENABLED: "true",
        ADS_PROVIDER: "adsterra",
        ADSTERRA_SCRIPT_URL: "https://ads.example.com/adsterra.js",
      }).enabled
    ).toBe(false);

    expect(
      buildPublicMonetizationConfig({
        ADS_ENABLED: "true",
        ADS_PROVIDER: "monetag",
        ADS_TAG_ADAPTER: "inline-plus-script",
        MONETAG_SCRIPT_URL: "https://ads.example.com/monetag.js",
      }).enabled
    ).toBe(false);
  });

  it("clamps the delayed load window", () => {
    expect(
      buildPublicMonetizationConfig({ ADS_LOAD_DELAY_MS: "10" }).loadDelayMs
    ).toBe(3_000);
    expect(
      buildPublicMonetizationConfig({ ADS_LOAD_DELAY_MS: "999999" }).loadDelayMs
    ).toBe(60_000);
    expect(
      buildPublicMonetizationConfig({ ADS_LOAD_DELAY_MS: "invalid" }).loadDelayMs
    ).toBe(10_000);
  });
});

describe("monetization route safety", () => {
  it.each([
    "/",
    "/deals",
    "/deals/B012345678",
    "/category/electronics",
    "/blog",
    "/blog/best-laptops",
    "/about",
    "/some-agent",
  ])("allows public browsing route %s", (pathname) => {
    expect(isMonetizationEligiblePath(pathname)).toBe(true);
  });

  it.each([
    "/t/rky3001-20/B012345678",
    "/some-agent/us/B012345678",
    "/some-agent/B012345678",
    "/admin",
    "/admin/analytics",
    "/portal/products",
  ])("blocks conversion or private route %s", (pathname) => {
    expect(isMonetizationEligiblePath(pathname)).toBe(false);
  });
});
