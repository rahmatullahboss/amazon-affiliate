import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import ProductDetail from "../../app/routes/product-detail";
import { AdBanner } from "../../app/components/AdBanner";
import { ADSTERRA_BANNER_SCRIPT_SRC } from "../../app/utils/public-ads";

describe("single inline publisher banner in the shared public layout", () => {
  it("renders the approved inline body tag without an application iframe wrapper", () => {
    const html = renderToStaticMarkup(
      createElement(AdBanner, { placement: "public-under-header" })
    );
    expect(html).toContain('data-ad-placement="public-under-header"');
    expect(html).toContain('data-ad-banner-key="96bcee9a814ac7bb10afc9289bfc457d"');
    expect(html).toContain(ADSTERRA_BANNER_SCRIPT_SRC);
    expect(html).toContain("atOptions");
    expect(html).not.toContain("<iframe");
    expect((html.match(/highrevenueformat\.com/g) ?? [])).toHaveLength(1);
  });

  it("ignores legacy route-specific slots to prevent duplicate publisher requests", () => {
    expect(renderToStaticMarkup(createElement(AdBanner, { placement: "home-after-header" }))).toBe("");
    expect(renderToStaticMarkup(createElement(AdBanner, { placement: "product-after-breadcrumbs" }))).toBe("");
  });

  it("does not duplicate the banner inside the nested product detail page", () => {
    const props = {
      loaderData: {
        product: {
          id: 1, asin: "B012345678", title: "Example product",
          image_url: "https://example.com/product.jpg",
          category: "Home", marketplace: "US",
          review_content: "Product description", product_images: null, aplus_images: null,
        },
        relatedProducts: [],
        canonicalPath: "/deals/B012345678",
        availableMarketplaces: ["US"],
        amazonUrlsByMarketplace: { US: "https://www.amazon.com/dp/B012345678" },
        relatedAmazonUrls: {},
      },
    } as unknown as Parameters<typeof ProductDetail>[0];

    const html = renderToStaticMarkup(
      createElement(MemoryRouter, {}, createElement(ProductDetail, props))
    );
    expect(html).not.toContain("data-ad-placement=");
    expect(html).not.toContain("www.highrevenueformat.com");
  });
});
