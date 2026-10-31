import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import ProductDetail from "../../app/routes/product-detail";

describe("product detail marked banner placements", () => {
  it("renders only one approved 320x50 banner zone, without duplicate requests", () => {
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
    expect((html.match(/data-ad-placement=/g) ?? [])).toHaveLength(1);
    expect(html).toContain('data-ad-placement="product-after-breadcrumbs"');
    expect(html).not.toContain('data-ad-placement="product-before-editorial"');
    expect(html).not.toContain('data-ad-placement="product-before-share"');
    expect(html).not.toContain('data-ad-placement="product-before-footer"');
    expect(html).toContain("www.highrevenueformat.com");
  });
});
