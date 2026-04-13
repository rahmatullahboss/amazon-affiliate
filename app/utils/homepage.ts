interface HomepagePostLike {
  id: number;
  slug: string;
}

interface HomepageProductLike {
  id: number;
  asin: string;
  category?: string | null;
  title?: string;
}

interface BuildHomePageSectionsInput<
  TPost extends HomepagePostLike,
  TProduct extends HomepageProductLike,
> {
  posts: TPost[];
  products: TProduct[];
}

export function buildHomePageSections<
  TPost extends HomepagePostLike,
  TProduct extends HomepageProductLike,
>({ posts, products }: BuildHomePageSectionsInput<TPost, TProduct>) {
  return {
    featuredPost: posts[0] ?? null,
    supportingPosts: posts.slice(1, 4),
    primaryProducts: products.slice(0, 30),
    trendingProducts: products.slice(30, 34),
    topDealProducts: products.slice(34, 44),
  };
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  electronics: [
    "Cool tech gadgets",
    "Must-have electronic gadgets",
    "Trending gadgets for everyday use",
    "Innovative gadgets you'll love",
    "Best gadgets for home and office",
    "Smart gadgets for modern living",
    "Top tech gifts for everyone",
    "Popular gadgets online",
    "Essential gadgets for daily life",
    "Editor's choice tech products",
  ],
  home: [
    "Easy home essentials",
    "Practical home upgrades",
    "Popular home finds",
    "Smart home must-haves",
    "Everyday home solutions",
    "Useful home picks you'll love",
    "Best home finds for daily use",
    "Home picks for modern living",
    "Top home favorites online",
    "Editor's choice home products",
  ],
  fitness: [
    "Trending fitness finds",
    "Smart workout essentials",
    "Must-have fitness gear",
    "Popular active lifestyle picks",
    "Practical fitness products",
    "Everyday wellness favorites",
    "Top home workout finds",
    "Fitness picks for daily use",
    "Best training essentials",
    "Editor's choice fitness products",
  ],
};

const FALLBACK_KEYWORDS = [
  "Top-rated everyday finds",
  "Smart picks for modern living",
  "Popular products worth checking",
  "Must-have finds for daily use",
  "Trending picks for daily life",
  "Useful upgrades you'll love",
  "Best-value picks for shoppers",
  "Editor's choice product finds",
  "Reliable favorites to explore",
  "Practical picks for every setup",
];

function normalizeCategory(category: string | null | undefined) {
  return (category || "").trim().toLowerCase();
}

export function getHomepageKeywordLabel(
  category: string | null | undefined,
  title: string,
  index: number
) {
  const normalizedCategory = normalizeCategory(category);
  const categoryKeywords = CATEGORY_KEYWORDS[normalizedCategory];

  if (categoryKeywords && categoryKeywords.length > 0) {
    return categoryKeywords[index % categoryKeywords.length];
  }

  const normalizedTitle = title.toLowerCase();
  if (normalizedTitle.includes("tech") || normalizedTitle.includes("gadget")) {
    return CATEGORY_KEYWORDS.electronics[index % CATEGORY_KEYWORDS.electronics.length];
  }
  if (
    normalizedTitle.includes("fitness") ||
    normalizedTitle.includes("workout") ||
    normalizedTitle.includes("tracker")
  ) {
    return CATEGORY_KEYWORDS.fitness[index % CATEGORY_KEYWORDS.fitness.length];
  }
  if (
    normalizedTitle.includes("home") ||
    normalizedTitle.includes("kitchen") ||
    normalizedTitle.includes("storage")
  ) {
    return CATEGORY_KEYWORDS.home[index % CATEGORY_KEYWORDS.home.length];
  }

  return FALLBACK_KEYWORDS[index % FALLBACK_KEYWORDS.length];
}

interface ComparisonProductLike {
  id: number;
  asin: string;
  category?: string | null;
  title?: string;
}

interface ComparisonGroup<TProduct extends ComparisonProductLike> {
  category: string;
  products: TProduct[];
}

export function buildComparisonGroups<TProduct extends ComparisonProductLike>(
  products: TProduct[]
): Array<ComparisonGroup<TProduct>> {
  const groups = new Map<string, TProduct[]>();

  for (const product of products) {
    const category = (product.category || "").trim();
    if (!category) {
      continue;
    }

    const existing = groups.get(category) ?? [];
    if (existing.length < 3) {
      existing.push(product);
      groups.set(category, existing);
    }
  }

  return Array.from(groups.entries())
    .map(([category, groupedProducts]) => ({
      category,
      products: groupedProducts,
    }))
    .filter((group) => group.products.length >= 3)
    .slice(0, 3);
}
