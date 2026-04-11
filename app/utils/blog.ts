export interface BlogPostSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  excerpt_text?: string;
  content: string;
  cover_image_key?: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  cta_disclosure?: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: "draft" | "published";
  generation_source: "manual" | "ai";
  generation_provider: string | null;
  generation_topic: string | null;
  generation_focus_asin: string | null;
  generation_marketplace: string | null;
  is_featured: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  reading_minutes: number;
}

export function slugifyClientTitle(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatBlogDate(value: string | null): string {
  if (!value) {
    return "Draft";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function splitBlogContent(content: string): string[] {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const urlOnlyPattern = /^(https?:\/\/\S+)$/i;
  const shortCtaPattern =
    /^(check|cheak|view|see|shop|buy|browse|read|open|go)\b[\w\s-]{0,50}(amazon|price|deal|now|here)?$/i;

  const removedIndexes = new Set<number>();

  paragraphs.forEach((paragraph, index) => {
    const plainText = paragraph.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!urlOnlyPattern.test(plainText)) {
      return;
    }

    removedIndexes.add(index);

    const previous = paragraphs[index - 1];
    if (!previous) {
      return;
    }

    const previousPlainText = previous.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (previousPlainText.length <= 80 && shortCtaPattern.test(previousPlainText)) {
      removedIndexes.add(index - 1);
    }
  });

  return paragraphs.filter((_, index) => !removedIndexes.has(index));
}
