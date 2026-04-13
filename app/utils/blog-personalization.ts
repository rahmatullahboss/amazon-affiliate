import { isPublicMarketplace, type PublicMarketplace } from "./marketplace";

export interface PersonalizedBlogSummary {
  id: number;
  title: string;
  slug: string;
  generation_source: "manual" | "ai";
  generation_marketplace: string | null;
  is_featured: number;
  published_at: string | null;
  updated_at: string;
}

export function filterBlogPostsForMarketplace<T extends PersonalizedBlogSummary>(
  posts: T[],
  preferredMarketplace: PublicMarketplace
): T[] {
  return posts.filter((post) => {
    const postMarketplace = post.generation_marketplace?.trim().toUpperCase();
    if (!postMarketplace) {
      return true;
    }

    if (post.generation_source === "manual") {
      return true;
    }

    return postMarketplace === preferredMarketplace;
  });
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function getMarketplacePriority(
  post: Pick<PersonalizedBlogSummary, "generation_marketplace" | "generation_source">,
  preferredMarketplace: PublicMarketplace
): number {
  const postMarketplace = post.generation_marketplace?.trim().toUpperCase();
  if (postMarketplace === preferredMarketplace) {
    return 0;
  }

  if (!postMarketplace || post.generation_source === "manual") {
    return 1;
  }

  return 2;
}

export function orderBlogPostsForMarketplace<T extends PersonalizedBlogSummary>(
  posts: T[],
  preferredMarketplace: PublicMarketplace
): T[] {
  return [...posts].sort((left, right) => {
    const priorityDelta =
      getMarketplacePriority(left, preferredMarketplace) -
      getMarketplacePriority(right, preferredMarketplace);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    if (left.is_featured !== right.is_featured) {
      return right.is_featured - left.is_featured;
    }

    return toTimestamp(right.published_at || right.updated_at) - toTimestamp(left.published_at || left.updated_at);
  });
}

export function buildMarketplaceAwareDealsHref(
  baseHref: string,
  preferredMarketplace: PublicMarketplace | null
): string {
  if (!preferredMarketplace || !isPublicMarketplace(preferredMarketplace)) {
    return baseHref;
  }

  const url = new URL(baseHref, "https://dealsrky.com");
  url.searchParams.set("market", preferredMarketplace);
  return `${url.pathname}${url.search}`;
}
