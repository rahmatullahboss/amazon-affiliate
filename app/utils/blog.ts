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
  resolved_cta_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  cta_disclosure?: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: "draft" | "scheduled" | "published";
  generation_source: "manual" | "ai";
  generation_provider: string | null;
  generation_topic: string | null;
  generation_focus_asin: string | null;
  generation_marketplace: string | null;
  is_featured: number;
  published_at: string | null;
  scheduled_for?: string | null;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function normalizeBlogText(value: string): string {
  return stripHtmlTags(value).replace(/\s+/g, " ").trim();
}

function renderInlineBlogText(value: string): string {
  const escaped = escapeHtml(value);

  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" rel="nofollow sponsored">$1</a>'
    );
}

function isAmazonUrlOnlyLine(value: string): boolean {
  return /^https?:\/\/(?:www\.)?amazon\.[^\s/]+\/\S+$/i.test(value.trim());
}

function isLegacyCtaPromptLine(value: string): boolean {
  return /^(check|cheak|view|see|shop|buy|browse|read|open|go)\b[\w\s-]{0,50}(amazon|price|deal|now|here)?$/i.test(
    value.trim()
  );
}

function stripLegacyInlineCtaLines(content: string): string {
  const lines = content.split(/\r?\n/);
  const cleaned: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index]?.trim() || "";
    const nextNonEmptyLine = lines
      .slice(index + 1)
      .map((line) => line.trim())
      .find(Boolean);

    if (isLegacyCtaPromptLine(currentLine) && nextNonEmptyLine && isAmazonUrlOnlyLine(nextNonEmptyLine)) {
      continue;
    }

    if (isAmazonUrlOnlyLine(currentLine)) {
      continue;
    }

    cleaned.push(lines[index] || "");
  }

  return cleaned.join("\n");
}

function splitColonSectionLine(line: string): { heading: string; body: string } | null {
  const match = line.match(/^([A-Z][A-Za-z0-9/&,'()\-\s]{3,80}):\s+(.+)$/);
  if (!match) {
    return null;
  }

  const heading = match[1].trim();
  const body = match[2].trim();
  if (heading.split(/\s+/).length > 10 || body.length < 20) {
    return null;
  }

  return { heading, body };
}

function renderPlainTextBlogBlocks(content: string): string {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim());

  const blocks: string[] = [];
  const listItems: string[] = [];

  const flushListItems = () => {
    if (listItems.length === 0) {
      return;
    }

    blocks.push(`<ul>${listItems.join("")}</ul>`);
    listItems.length = 0;
  };

  for (const line of lines) {
    if (!line) {
      flushListItems();
      continue;
    }

    const headingMatch = line.match(/^(#{2,4})\s+(.+)$/);
    if (headingMatch) {
      flushListItems();
      const level = Math.min(4, headingMatch[1].length);
      blocks.push(`<h${level}>${renderInlineBlogText(headingMatch[2])}</h${level}>`);
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      listItems.push(`<li>${renderInlineBlogText(bulletMatch[1])}</li>`);
      continue;
    }

    const colonSection = splitColonSectionLine(line);
    if (colonSection) {
      flushListItems();
      blocks.push(`<h3>${renderInlineBlogText(colonSection.heading)}</h3>`);
      blocks.push(`<p>${renderInlineBlogText(colonSection.body)}</p>`);
      continue;
    }

    flushListItems();
    blocks.push(`<p>${renderInlineBlogText(line)}</p>`);
  }

  flushListItems();

  return blocks.join("");
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

export function buildBlogContentHtml(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return "";
  }

  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(trimmed);
  if (!hasHtmlTags) {
    const normalizedPlainText = stripLegacyInlineCtaLines(
      trimmed
        .replace(/\\r\\n/g, "\n")
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "  ")
    );

    return renderPlainTextBlogBlocks(normalizedPlainText);
  }

  const sanitized = trimmed
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/\sstyle\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/\shref\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, "")
    .replace(
      /<(?!\/?(?:p|br|h2|h3|h4|ul|ol|li|strong|em|b|i|a|blockquote)\b)[^>]*>/gi,
      ""
    )
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/<p>\s*(https?:\/\/[^<\s]+)\s*<\/p>/gi, "")
    .replace(
      /<p>\s*(?:check|cheak|view|see|shop|buy|browse|read|open|go)\b[\w\s-]{0,50}(?:amazon|price|deal|now|here)?\s*<\/p>\s*(?=<p>\s*https?:\/\/)/gi,
      ""
    );

  return sanitized;
}

export function getBlogPlainText(content: string): string {
  return normalizeBlogText(content);
}
