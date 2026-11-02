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

  it("renders the one primary zone on the marked product breadcrumb slot", () => {
    const html = renderToStaticMarkup(createElement(AdBanner, { placement: "product-after-breadcrumbs" }));
    expect(html).toContain(ADSTERRA_BANNER_SCRIPT_SRC);
    expect(html).not.toContain("<iframe");
    expect(renderToStaticMarkup(createElement(AdBanner, { placement: "home-after-header" }))).toBe("");
  });

  it("renders all four screenshot-marked product placements with the existing inline code", () => {
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
    expect((html.match(/data-ad-placement=/g) ?? [])).toHaveLength(4);
    expect((html.match(/highrevenueformat\.com/g) ?? [])).toHaveLength(4);
    expect(html).toContain('data-ad-placement="product-after-breadcrumbs"');
    expect(html).toContain('data-ad-placement="product-before-editorial"');
    expect(html).toContain('data-ad-placement="product-before-share"');
    expect(html).toContain('data-ad-placement="product-before-footer"');
    expect(html).not.toContain("<iframe");
  });
});
