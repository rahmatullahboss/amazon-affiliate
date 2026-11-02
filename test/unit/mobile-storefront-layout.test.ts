import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { HOMEPAGE_CONTENT_GRID_CLASS } from "../../app/routes/home";
import DealsPage from "../../app/routes/deals";
import { ProductCard } from "../../app/components/home/ProductCard";

const four = Array.from({ length: 4 }, (_, index) => ({
  id: index + 1,
  asin: `B0TEST00${String(index).padStart(2, "0")}`,
  title: `Mobile four-column product ${index + 1}`,
  image_url: "https://example.com/product.jpg",
  category: "Home",
  marketplace: "US",
}));

describe("mobile storefront four-card and viewport contracts", () => {
  it("renders four compact product cards in the View all page grid at the smallest breakpoint", () => {
    const props = {
      loaderData: {
        products: four, categories: [], selectedMarketplace: "US",
        pagination: { page: 1, limit: 12, total: 4, totalPages: 1 },
      },
    } as unknown as Parameters<typeof DealsPage>[0];
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(DealsPage, props))
    );
    expect(html).toContain("grid grid-cols-4 gap-2");
    expect(html).not.toContain("grid-cols-1 sm:grid-cols-2");
    expect((html.match(/<article\b/g) || [])).toHaveLength(4);
    expect((html.match(/min-w-0 flex-col/g) || [])).toHaveLength(4);
  });

  it("uses compact mobile CTA text without changing the existing destination URL", () => {
    const item = four[0];
    const details = renderToStaticMarkup(
      createElement(MemoryRouter, null,
        createElement(ProductCard, { item, href: "/deals/B0TEST0000", variant: "homepageCompact" }))
    );
    expect(details).toContain("Details");
    expect(details).toContain("/deals/B0TEST0000");

    const amazon = renderToStaticMarkup(
      createElement(MemoryRouter, null,
        createElement(ProductCard, { item, href: "/deals/B0TEST0000",
          primaryHref: "https://www.amazon.com/dp/B0TEST0000", variant: "homepageCompact" }))
    );
    expect(amazon).toContain("Amazon");
    expect(amazon).toContain("https://www.amazon.com/dp/B0TEST0000");
  });

  it("prevents the homepage's single implicit CSS grid track from expanding to its min-content width", () => {
    expect(HOMEPAGE_CONTENT_GRID_CLASS).toContain("grid-cols-[minmax(0,1fr)] gap-8");
    expect(HOMEPAGE_CONTENT_GRID_CLASS).toContain("min-w-0");
    expect(HOMEPAGE_CONTENT_GRID_CLASS).toContain("xl:grid-cols-[minmax(0,1fr)_320px]");
  });
});
