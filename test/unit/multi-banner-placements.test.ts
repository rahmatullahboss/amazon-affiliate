import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdBanner } from "../../app/components/AdBanner";
import {
  ADSTERRA_BANNER_KEY,
  BANNER_PLACEMENTS,
  resolveApprovedBannerZone,
  isProductDetailAdPath,
  type AdditionalBannerZone,
} from "../../app/utils/public-ads";

const approvedExtraKeys: Record<AdditionalBannerZone, string> = {
  secondary: "a".repeat(32),
  tertiary: "b".repeat(32),
  quaternary: "c".repeat(32),
};

describe("user-marked inline banner placements", () => {
  it("moves the original header ad to breadcrumb only for actual product paths", () => {
    expect(isProductDetailAdPath("/deals/B0H3JVCLTM")).toBe(true);
    expect(isProductDetailAdPath("/deals/B0H3JVCLTM/")).toBe(true);
    expect(isProductDetailAdPath("/deals")).toBe(false);
    expect(isProductDetailAdPath("/collections/trending")).toBe(false);
    expect(isProductDetailAdPath("/deals/not-an-asin")).toBe(false);
  });

  it("maps every marked slot to the right independent approved zone ordinal", () => {
    expect(BANNER_PLACEMENTS).toEqual({
      "public-under-header": "primary",
      "product-after-breadcrumbs": "primary",
      "home-after-categories": "secondary",
      "home-after-first-row": "tertiary",
      "collection-before-grid": "secondary",
      "collection-before-footer": "tertiary",
      "product-before-editorial": "secondary",
      "product-before-share": "tertiary",
      "product-before-footer": "quaternary",
    });
    for (const [name, ordinal] of Object.entries(BANNER_PLACEMENTS)) {
      const zone = resolveApprovedBannerZone(name, approvedExtraKeys);
      const expectedKey = ordinal === "primary" ? ADSTERRA_BANNER_KEY : approvedExtraKeys[ordinal];
      expect(zone?.key).toBe(expectedKey);
      expect(zone?.src).toBe(`https://www.highrevenueformat.com/${expectedKey}/invoke.js`);
      expect(zone?.options).toMatchObject({ key: expectedKey, height: 50, width: 320 });
    }
  });

  it("keeps existing banner but never inserts an empty placeholder for missing optional zone keys", () => {
    expect(renderToStaticMarkup(createElement(AdBanner, { placement: "public-under-header" })))
      .toContain(ADSTERRA_BANNER_KEY);
    for (const placement of Object.keys(BANNER_PLACEMENTS).filter(name =>
      name !== "public-under-header" && name !== "product-after-breadcrumbs")) {
      expect(renderToStaticMarkup(createElement(AdBanner, { placement }))).toBe("");
      expect(resolveApprovedBannerZone(placement)).toBeNull();
    }
  });

  it("rejects duplicate zone keys and invalid or unknown publisher codes", () => {
    const duplicates = { ...approvedExtraKeys, secondary: ADSTERRA_BANNER_KEY };
    expect(resolveApprovedBannerZone("home-after-categories", duplicates)).toBeNull();
    // Even a wrongly configured extra zone cannot disable the working primary.
    expect(resolveApprovedBannerZone("public-under-header", duplicates)?.key).toBe(ADSTERRA_BANNER_KEY);

    const duplicateExtra = { ...approvedExtraKeys, tertiary: approvedExtraKeys.secondary };
    expect(resolveApprovedBannerZone("home-after-first-row", duplicateExtra)).toBeNull();
    expect(resolveApprovedBannerZone("home-after-categories", duplicateExtra)).toBeNull();
    expect(resolveApprovedBannerZone("collection-before-grid", { ...approvedExtraKeys, secondary: "wrong" }))
      .toBeNull();
    expect(resolveApprovedBannerZone("injected-slot", approvedExtraKeys)).toBeNull();
  });
});
