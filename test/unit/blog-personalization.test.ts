import { describe, expect, it } from "vitest";
import {
  buildMarketplaceAwareDealsHref,
  filterBlogPostsForMarketplace,
  orderBlogPostsForMarketplace,
  type PersonalizedBlogSummary,
} from "../../app/utils/blog-personalization";

const basePosts: PersonalizedBlogSummary[] = [
  {
    id: 1,
    title: "Global Manual Guide",
    slug: "global-manual-guide",
    generation_source: "manual",
    generation_marketplace: null,
    is_featured: 0,
    published_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
  },
  {
    id: 2,
    title: "US Vacuum Guide",
    slug: "us-vacuum-guide",
    generation_source: "ai",
    generation_marketplace: "US",
    is_featured: 0,
    published_at: "2026-04-03T00:00:00.000Z",
    updated_at: "2026-04-03T00:00:00.000Z",
  },
  {
    id: 3,
    title: "DE Vacuum Guide",
    slug: "de-vacuum-guide",
    generation_source: "ai",
    generation_marketplace: "DE",
    is_featured: 0,
    published_at: "2026-04-02T00:00:00.000Z",
    updated_at: "2026-04-02T00:00:00.000Z",
  },
];

describe("blog personalization helpers", () => {
  it("surfaces matching marketplace posts before global fallback posts", () => {
    const ordered = orderBlogPostsForMarketplace(basePosts, "DE");

    expect(ordered[0]?.slug).toBe("de-vacuum-guide");
    expect(ordered[1]?.slug).toBe("global-manual-guide");
    expect(ordered[2]?.slug).toBe("us-vacuum-guide");
  });

  it("preserves featured priority inside the same marketplace group", () => {
    const ordered = orderBlogPostsForMarketplace(
      [
        { ...basePosts[2], slug: "de-featured", is_featured: 1, title: "DE Featured" },
        ...basePosts,
      ],
      "DE"
    );

    expect(ordered[0]?.slug).toBe("de-featured");
  });

  it("adds the visitor marketplace to the deals link when available", () => {
    expect(buildMarketplaceAwareDealsHref("/deals", "FR")).toBe("/deals?market=FR");
    expect(buildMarketplaceAwareDealsHref("/deals?source=blog", "US")).toBe(
      "/deals?source=blog&market=US"
    );
  });

  it("filters out ai posts from other marketplaces while keeping global manual posts", () => {
    const filtered = filterBlogPostsForMarketplace(basePosts, "FR");

    expect(filtered.map((post) => post.slug)).toEqual(["global-manual-guide"]);
  });
});
