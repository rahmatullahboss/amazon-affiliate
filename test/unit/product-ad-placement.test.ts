import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import ProductDetail from "../../app/routes/product-detail";

describe("product detail marked banner placements", () => {
  it("renders exactly the four marked 320x50 slots around product content", () => {
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
    const slots = [
      "product-after-breadcrumbs",
      "product-before-editorial",
      "product-before-share",
      "product-before-footer",
    ];
    expect((html.match(/data-ad-placement=/g) ?? [])).toHaveLength(4);
    const indexes = slots.map(name => html.indexOf(`data-ad-placement="${name}"`));
    expect(indexes.every(index => index !== -1)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    expect(indexes[0]).toBeGreaterThan(html.indexOf("Home"));
    expect(indexes[1]).toBeGreaterThan(html.indexOf("Example product"));
    expect(indexes[2]).toBeLessThan(html.indexOf("Share this product"));
    expect(indexes[3]).toBeGreaterThan(html.indexOf("related products"));
  });
});
