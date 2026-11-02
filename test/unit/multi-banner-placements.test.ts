import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdBanner } from "../../app/components/AdBanner";
import {
  ADSTERRA_BANNER_KEY,
  ADSTERRA_BANNER_SCRIPT_SRC,
  BANNER_PLACEMENTS,
  resolveApprovedBannerZone,
  isProductDetailAdPath,
} from "../../app/utils/public-ads";

describe("owner-requested repeated inline 320x50 banner placements", () => {
  it("keeps one primary banner on each marked part of all three page types", () => {
    expect(Object.keys(BANNER_PLACEMENTS)).toEqual([
      "public-under-header",
      "product-after-breadcrumbs",
      "home-after-categories",
      "home-after-first-row",
      "collection-before-grid",
      "collection-before-footer",
      "product-before-editorial",
      "product-before-share",
      "product-before-footer",
    ]);

    for (const placement of Object.keys(BANNER_PLACEMENTS)) {
      const zone = resolveApprovedBannerZone(placement);
      expect(zone?.key).toBe(ADSTERRA_BANNER_KEY);
      expect(zone?.src).toBe(ADSTERRA_BANNER_SCRIPT_SRC);
      expect(zone?.options).toMatchObject({ key: ADSTERRA_BANNER_KEY, height: 50, width: 320 });
      const html = renderToStaticMarkup(createElement(AdBanner, { placement }));
      expect(html).toContain(`data-ad-placement="${placement}"`);
      expect(html).toContain(ADSTERRA_BANNER_SCRIPT_SRC);
      expect(html).not.toContain("<iframe");
    }
  });

  it("does not introduce unsupported placements, new publisher keys, or an application iframe", () => {
    expect(resolveApprovedBannerZone("untrusted-slot")).toBeNull();
    expect(renderToStaticMarkup(createElement(AdBanner, { placement: "untrusted-slot" }))).toBe("");
    const html = renderToStaticMarkup(createElement("main", null,
      createElement(AdBanner, { placement: "public-under-header" }),
      createElement(AdBanner, { placement: "home-after-categories" }),
      createElement(AdBanner, { placement: "home-after-first-row" })
    ));
    expect((html.match(/data-ad-placement=/g) ?? [])).toHaveLength(3);
    expect((html.match(/highrevenueformat\.com/g) ?? [])).toHaveLength(3);
    expect(html).not.toContain("<iframe");
  });

  it("moves the original top banner below breadcrumbs only for product routes", () => {
    expect(isProductDetailAdPath("/deals/B0H3JVCLTM")).toBe(true);
    expect(isProductDetailAdPath("/deals/B0H3JVCLTM/")).toBe(true);
    expect(isProductDetailAdPath("/deals")).toBe(false);
    expect(isProductDetailAdPath("/collections/trending")).toBe(false);
    expect(isProductDetailAdPath("/deals/not-an-asin")).toBe(false);
  });
});