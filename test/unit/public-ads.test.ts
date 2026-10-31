import { describe, expect, it } from "vitest";
import {
  AD_COOLDOWN_MS,
  ADSTERRA_BANNER_KEY,
  ADSTERRA_BANNER_CONTAINER_ID,
  ADSTERRA_BANNER_SCRIPT_SRC,
  ADSTERRA_BANNER_OPTIONS,
  ADSTERRA_SOCIAL_BAR_SCRIPT_SRC,
  canLoadAdAt,
  isEligiblePublicAdPath,
  getAdPageIdentity,
  shouldEnablePublicAds,
} from "../../app/utils/public-ads";

describe("Adsterra public advertising contract", () => {
  it("uses precisely the publisher-provided 320x50 iframe banner and Social Bar", () => {
    expect(ADSTERRA_BANNER_KEY).toBe("96bcee9a814ac7bb10afc9289bfc457d");
    expect(ADSTERRA_BANNER_OPTIONS).toEqual({
      key: "96bcee9a814ac7bb10afc9289bfc457d",
      format: "iframe",
      height: 50,
      width: 320,
      params: {},
    });
    expect(ADSTERRA_BANNER_SCRIPT_SRC).toBe(
      "https://www.highrevenueformat.com/96bcee9a814ac7bb10afc9289bfc457d/invoke.js"
    );
    expect(ADSTERRA_BANNER_CONTAINER_ID).toBe("dealsrky-adsterra-banner-320x50");
    expect(ADSTERRA_SOCIAL_BAR_SCRIPT_SRC).toBe(
      "https://pl30967644.profitableratecpmnetwork.com/27/9f/b2/279fb283fc6df4ba2e60428705c80920.js"
    );
  });
  it("blocks native app and redirects", () => {
    expect(shouldEnablePublicAds(true)).toBe(false);
    expect(shouldEnablePublicAds(false)).toBe(true);
    for (const path of ["/t/tag/asin", "/agent/us/asin", "/admin", "/portal", "/admin/login", "/portal/login"]) {
      expect(isEligiblePublicAdPath(path)).toBe(false);
    }
    for (const path of ["/", "/deals", "/deals/B012345678", "/category/home", "/blog/guide", "/collections/latest"]) {
      expect(isEligiblePublicAdPath(path)).toBe(true);
    }
  });
  it("does not treat query variations of the same ASIN as different pages", () => {
    expect(getAdPageIdentity("/deals/B012345678", "?market=US"))
      .toBe(getAdPageIdentity("/deals/B012345678", "?market=UK"));
    expect(getAdPageIdentity("/blog/guide", "?market=US"))
      .not.toBe(getAdPageIdentity("/blog/guide", "?market=UK"));
  });
  it("throttles new URL ad loads to once per five-minute period", () => {
    expect(AD_COOLDOWN_MS).toBe(300_000);
    expect(canLoadAdAt(1000, null)).toBe(true);
    expect(canLoadAdAt(299999, 0)).toBe(false);
    expect(canLoadAdAt(300000, 0)).toBe(true);
    expect(canLoadAdAt(1000, 2000)).toBe(false);
  });
});
