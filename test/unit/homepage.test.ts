import { describe, expect, it } from "vitest";
import {
  buildComparisonGroups,
  buildHomePageSections,
  getHomepageKeywordLabel,
} from "../../app/utils/homepage";

describe("homepage sections", () => {
  it("builds a 30-product homepage grid and supporting sidebar slices", () => {
    const sections = buildHomePageSections({
      posts: [
        { id: 1, title: "Featured", slug: "featured" },
        { id: 2, title: "Guide 2", slug: "guide-2" },
        { id: 3, title: "Guide 3", slug: "guide-3" },
        { id: 4, title: "Guide 4", slug: "guide-4" },
      ],
      products: Array.from({ length: 36 }, (_, index) => ({
        id: index + 11,
        asin: `B0TEST${String(index + 1).padStart(4, "0")}`,
      })),
    });

    expect(sections.featuredPost?.slug).toBe("featured");
    expect(sections.supportingPosts.map((post) => post.slug)).toEqual([
      "guide-2",
      "guide-3",
      "guide-4",
    ]);
    expect(sections.primaryProducts).toHaveLength(30);
    expect(sections.primaryProducts[0]?.asin).toBe("B0TEST0001");
    expect(sections.primaryProducts[29]?.asin).toBe("B0TEST0030");
    expect(sections.trendingProducts.map((product) => product.asin)).toEqual([
      "B0TEST0031",
      "B0TEST0032",
      "B0TEST0033",
      "B0TEST0034",
    ]);
    expect(sections.topDealProducts.map((product) => product.asin)).toEqual([
      "B0TEST0035",
      "B0TEST0036",
    ]);
  });

  it("handles missing blog posts without breaking product sections", () => {
    const sections = buildHomePageSections({
      posts: [],
      products: [
        { id: 21, asin: "B0TEST1001" },
        { id: 22, asin: "B0TEST1002" },
      ],
    });

    expect(sections.featuredPost).toBeNull();
    expect(sections.supportingPosts).toEqual([]);
    expect(sections.primaryProducts.map((product) => product.asin)).toEqual([
      "B0TEST1001",
      "B0TEST1002",
    ]);
    expect(sections.trendingProducts).toEqual([]);
    expect(sections.topDealProducts).toEqual([]);
  });

  it("uses evergreen keyword variations based on product category", () => {
    expect(getHomepageKeywordLabel("electronics", "Desk Setup Light", 0)).toBe(
      "Cool tech gadgets"
    );
    expect(getHomepageKeywordLabel("home", "Storage Shelf", 1)).toBe(
      "Practical home upgrades"
    );
    expect(getHomepageKeywordLabel(null, "Fitness Tracker", 2)).toBe(
      "Must-have fitness gear"
    );
  });

  it("builds compact comparison groups when multiple products share a category", () => {
    const comparisonGroups = buildComparisonGroups([
      { id: 1, asin: "B0C1", category: "Electronics", title: "Desk Lamp" },
      { id: 2, asin: "B0C2", category: "Electronics", title: "Monitor Light" },
      { id: 3, asin: "B0C3", category: "Electronics", title: "LED Bar" },
      { id: 4, asin: "B0C4", category: "Home", title: "Shelf" },
    ]);

    expect(comparisonGroups).toHaveLength(1);
    expect(comparisonGroups[0]?.category).toBe("Electronics");
    expect(comparisonGroups[0]?.products.map((product) => product.asin)).toEqual([
      "B0C1",
      "B0C2",
      "B0C3",
    ]);
  });
});
