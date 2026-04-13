import { z } from "zod";
import type { Bindings } from "../utils/types";
import { buildBlogExcerpt, createUniqueBlogSlug } from "./blog";

type BlogGenerationStatus = "success" | "skipped" | "failed";
type BlogGenerationProvider = "workers_ai" | "ollama_cloud";

interface GenerationProductCandidate {
  asin: string;
  title: string;
  image_url: string | null;
  marketplace: string;
  category: string | null;
  review_content: string | null;
  features: string | null;
  updated_at?: string | null;
}

interface SupportingProduct {
  asin: string;
  title: string;
  marketplace: string;
  category: string | null;
}

interface RecentPostReference {
  title: string;
  slug: string;
}

interface TopicSelection {
  focusProduct: GenerationProductCandidate;
  topicLabel: string;
  supportingProducts: SupportingProduct[];
  recentPosts: RecentPostReference[];
}

interface MarketplaceGenerationStats {
  recentCount: number;
  lastGeneratedAt: string | null;
}

interface UsageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface GeneratedDraftPayload {
  title: string;
  excerpt: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  ctaLabel: string;
  ctaUrl: string;
  ctaDisclosure: string;
  coverImageAlt: string;
}

interface GenerateDraftResult {
  status: BlogGenerationStatus;
  provider?: BlogGenerationProvider;
  model?: string;
  blogPostId?: number;
  reason?: string;
}

export async function publishDueScheduledBlogPosts(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE blog_posts
       SET status = 'published',
           published_at = COALESCE(scheduled_for, datetime('now')),
           updated_at = datetime('now')
       WHERE is_deleted = 0
         AND status = 'draft'
         AND scheduled_for IS NOT NULL
         AND datetime(scheduled_for) <= datetime('now')`
    )
    .run();

  return Number(result.meta.changes ?? 0);
}

interface WorkersAiResult {
  response?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
  prompt_eval_count?: number;
  eval_count?: number;
}

const generatedDraftSchema = z.object({
  title: z.string().min(20).max(180),
  excerpt: z.string().min(80).max(220),
  content: z.string().min(700).max(12000),
  seoTitle: z.string().min(20).max(180),
  seoDescription: z.string().min(80).max(180),
  ctaLabel: z.string().min(3).max(80),
  ctaUrl: z.string().url().max(2000),
  ctaDisclosure: z.string().min(20).max(240),
  coverImageAlt: z.string().min(8).max(180),
});

function parseJsonArray(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function compactText(value: string | null | undefined, maxLength: number): string {
  const clean = (value || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) {
    return clean;
  }

  const truncated = clean.slice(0, maxLength - 3).replace(/\s+\S*$/, "").trim();
  return `${truncated}...`;
}

function clampField(value: string, maxLength: number, preserveWhitespace = false): string {
  const clean = preserveWhitespace ? value.trim() : value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) {
    return clean;
  }

  if (preserveWhitespace) {
    return clean.slice(0, maxLength).trim();
  }

  const truncated = clean.slice(0, maxLength - 3).replace(/\s+\S*$/, "").trim();
  return `${truncated}...`;
}

function normalizeGeneratedDraftPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }

  const draft = raw as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...draft };

  if (typeof draft.title === "string") {
    normalized.title = clampField(draft.title, 180);
  }
  if (typeof draft.excerpt === "string") {
    normalized.excerpt = clampField(draft.excerpt, 220);
  }
  if (typeof draft.content === "string") {
    normalized.content = clampField(draft.content, 12000, true);
  }
  if (typeof draft.seoTitle === "string") {
    normalized.seoTitle = clampField(draft.seoTitle, 180);
  }
  if (typeof draft.seoDescription === "string") {
    normalized.seoDescription = clampField(draft.seoDescription, 180);
  }
  if (typeof draft.ctaLabel === "string") {
    normalized.ctaLabel = clampField(draft.ctaLabel, 80);
  }
  if (typeof draft.ctaUrl === "string") {
    normalized.ctaUrl = clampField(draft.ctaUrl, 2000, true);
  }
  if (typeof draft.ctaDisclosure === "string") {
    normalized.ctaDisclosure = clampField(draft.ctaDisclosure, 240);
  }
  if (typeof draft.coverImageAlt === "string") {
    normalized.coverImageAlt = clampField(draft.coverImageAlt, 180);
  }

  return normalized;
}

function buildFocusProductCtaUrl(publicAppUrl: string | undefined, focusAsin: string): string {
  const baseUrl = (publicAppUrl || "https://dealsrky.com").trim().replace(/\/+$/, "");
  return `${baseUrl}/deals/${focusAsin}`;
}

function buildTopicLabel(product: GenerationProductCandidate): string {
  const normalizedCategory = product.category?.trim();
  if (normalizedCategory) {
    return `${normalizedCategory} guide for ${product.marketplace}`;
  }

  return `Product guide for ${product.marketplace}`;
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

export function chooseFocusProductCandidate(
  candidates: GenerationProductCandidate[],
  marketplaceStats: Record<string, MarketplaceGenerationStats>
): GenerationProductCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  const groups = new Map<string, GenerationProductCandidate[]>();
  for (const candidate of candidates) {
    const marketplace = candidate.marketplace.trim().toUpperCase();
    const bucket = groups.get(marketplace) ?? [];
    bucket.push(candidate);
    groups.set(marketplace, bucket);
  }

  for (const bucket of groups.values()) {
    bucket.sort((left, right) => toTimestamp(right.updated_at) - toTimestamp(left.updated_at));
  }

  const rankedMarketplaces = [...groups.keys()].sort((left, right) => {
    const leftStats = marketplaceStats[left] ?? { recentCount: 0, lastGeneratedAt: null };
    const rightStats = marketplaceStats[right] ?? { recentCount: 0, lastGeneratedAt: null };

    if (leftStats.recentCount !== rightStats.recentCount) {
      return leftStats.recentCount - rightStats.recentCount;
    }

    return toTimestamp(leftStats.lastGeneratedAt) - toTimestamp(rightStats.lastGeneratedAt);
  });

  const selectedMarketplace = rankedMarketplaces[0];
  return selectedMarketplace ? groups.get(selectedMarketplace)?.[0] ?? null : null;
}

async function selectTopic(db: D1Database): Promise<TopicSelection | null> {
  const { results } = await db
    .prepare(
      `SELECT p.asin, p.title, p.marketplace, p.category, p.review_content, p.features,
              p.image_url,
              COALESCE(p.updated_at, p.created_at) AS updated_at
       FROM products p
       WHERE p.is_active = 1
         AND p.status = 'active'
         AND NOT EXISTS (
           SELECT 1
           FROM blog_posts bp
           WHERE bp.is_deleted = 0
             AND bp.generation_source = 'ai'
             AND bp.generation_focus_asin = p.asin
             AND COALESCE(bp.generation_marketplace, '') = p.marketplace
             AND bp.created_at >= datetime('now', '-14 days')
         )
       ORDER BY COALESCE(p.updated_at, p.created_at) DESC
       LIMIT 12`
    )
    .all<GenerationProductCandidate>();

  const fallbackProducts = results ?? [];
  const { results: marketplaceUsageRows } = await db
    .prepare(
      `SELECT generation_marketplace AS marketplace,
              COUNT(*) AS recent_count,
              MAX(created_at) AS last_generated_at
       FROM blog_posts
       WHERE is_deleted = 0
         AND generation_source = 'ai'
         AND generation_marketplace IS NOT NULL
         AND created_at >= datetime('now', '-30 days')
       GROUP BY generation_marketplace`
    )
    .all<{
      marketplace: string | null;
      recent_count: number | string;
      last_generated_at: string | null;
    }>();

  const marketplaceStats = Object.fromEntries(
    (marketplaceUsageRows ?? [])
      .filter(
        (row): row is { marketplace: string; recent_count: number | string; last_generated_at: string | null } =>
          Boolean(row.marketplace)
      )
      .map((row) => [
        row.marketplace.toUpperCase(),
        {
          recentCount: Number(row.recent_count) || 0,
          lastGeneratedAt: row.last_generated_at,
        },
      ])
  ) as Record<string, MarketplaceGenerationStats>;

  const focusProduct =
    chooseFocusProductCandidate(fallbackProducts, marketplaceStats) ||
    (await db
      .prepare(
        `SELECT asin, title, image_url, marketplace, category, review_content, features,
                COALESCE(updated_at, created_at) AS updated_at
         FROM products
         WHERE is_active = 1 AND status = 'active'
         ORDER BY COALESCE(updated_at, created_at) DESC
         LIMIT 1`
      )
      .first<GenerationProductCandidate>());

  if (!focusProduct) {
    return null;
  }

  const { results: relatedRows } = await db
    .prepare(
      `SELECT asin, title, marketplace, category
       FROM products
       WHERE is_active = 1
         AND status = 'active'
         AND marketplace = ?
         AND asin != ?
         AND (? IS NULL OR category = ?)
       ORDER BY COALESCE(updated_at, created_at) DESC
       LIMIT 4`
    )
    .bind(
      focusProduct.marketplace,
      focusProduct.asin,
      focusProduct.category,
      focusProduct.category
    )
    .all<SupportingProduct>();

  const { results: recentPosts } = await db
    .prepare(
      `SELECT title, slug
       FROM blog_posts
       WHERE is_deleted = 0 AND status = 'published'
       ORDER BY published_at DESC, updated_at DESC
       LIMIT 6`
    )
    .all<RecentPostReference>();

  return {
    focusProduct,
    topicLabel: buildTopicLabel(focusProduct),
    supportingProducts: relatedRows ?? [],
    recentPosts: recentPosts ?? [],
  };
}

function buildPrompt(topic: TopicSelection, publicAppUrl: string): { system: string; user: string } {
  const featureHighlights = parseJsonArray(topic.focusProduct.features)
    .slice(0, 4)
    .map((feature) => `- ${compactText(feature, 120)}`)
    .join("\n");
  const supportingProducts = topic.supportingProducts
    .map(
      (product) =>
        `- ${product.title} (${product.marketplace}${product.category ? `, ${product.category}` : ""}, ASIN ${product.asin})`
    )
    .join("\n");
  const recentPosts = topic.recentPosts
    .map((post) => `- ${post.title} (/blog/${post.slug})`)
    .join("\n");
  const reviewContext = compactText(topic.focusProduct.review_content, 600);

  const system = [
    "You are the DealsRky editorial automation for an affiliate site.",
    "Write a completely original buying-guide style article in English.",
    "Do not copy text from competitor sites, Amazon listings, or Amazon customer reviews.",
    "Do not quote reviews, do not invent ratings, and do not promise outcomes.",
    "Use an editorial affiliate structure: intro, who it fits, what to look for, practical buying considerations, related picks, conclusion.",
    "Keep tone practical and trustworthy, not spammy.",
    "Return strict JSON only.",
  ].join(" ");

  const user = [
    `Site URL: ${publicAppUrl}`,
    `Primary topic: ${topic.topicLabel}`,
    `Focus product: ${topic.focusProduct.title} (${topic.focusProduct.marketplace}, ASIN ${topic.focusProduct.asin})`,
    topic.focusProduct.category ? `Category: ${topic.focusProduct.category}` : null,
    reviewContext ? `Internal editorial context:\n${reviewContext}` : null,
    featureHighlights ? `Feature labels:\n${featureHighlights}` : null,
    supportingProducts ? `Related products from our catalog:\n${supportingProducts}` : null,
    recentPosts ? `Recent published posts to avoid repeating too closely:\n${recentPosts}` : null,
    "Requirements:",
    "- 900 to 1500 words.",
    "- Product-aware and category-relevant.",
    "- Original phrasing only.",
    "- Mention shoppers should verify current price, shipping, and final details on Amazon.",
    `- CTA URL must be ${publicAppUrl.replace(/\/+$/, "")}/deals/${topic.focusProduct.asin}`,
    "- The draft must be suitable for admin review before publishing.",
    "JSON fields required: title, excerpt, content, seoTitle, seoDescription, ctaLabel, ctaUrl, ctaDisclosure, coverImageAlt.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");

  return { system, user };
}

function parseProviderResponse(rawText: string): GeneratedDraftPayload {
  const clean = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = normalizeGeneratedDraftPayload(JSON.parse(clean) as unknown);
  return generatedDraftSchema.parse(parsed);
}

function getDailyNeuronLimit(env: Bindings): number {
  const parsed = Number.parseInt(env.BLOG_AI_NEURON_DAILY_LIMIT || "10000", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10000;
}

async function getUsedNeuronBudget(db: D1Database): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(total_tokens), 0) AS used_tokens
       FROM blog_generation_runs
       WHERE provider = 'workers_ai'
         AND status = 'success'
         AND date(created_at) = date('now')`
    )
    .first<{ used_tokens: number | null }>();

  return row?.used_tokens ?? 0;
}

async function insertGenerationRun(
  db: D1Database,
  input: {
    status: BlogGenerationStatus;
    provider?: string | null;
    model?: string | null;
    topicLabel?: string | null;
    focusAsin?: string | null;
    marketplace?: string | null;
    blogPostId?: number | null;
    usage?: UsageMetrics | null;
    reason?: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO blog_generation_runs (
         status, provider, model, topic_label, focus_asin, marketplace,
         blog_post_id, prompt_tokens, completion_tokens, total_tokens, reason
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.status,
      input.provider || null,
      input.model || null,
      input.topicLabel || null,
      input.focusAsin || null,
      input.marketplace || null,
      input.blogPostId || null,
      input.usage?.promptTokens ?? null,
      input.usage?.completionTokens ?? null,
      input.usage?.totalTokens ?? null,
      input.reason || null
    )
    .run();
}

async function callWorkersAi(
  env: Bindings,
  prompt: { system: string; user: string }
): Promise<{ draft: GeneratedDraftPayload; usage: UsageMetrics; model: string } | null> {
  const model = env.BLOG_AI_PRIMARY_MODEL?.trim();
  if (!model || !env.AI) {
    return null;
  }

  const raw = (await env.AI.run(model, {
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    max_tokens: 2200,
    temperature: 0.7,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "blog_draft",
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "excerpt",
            "content",
            "seoTitle",
            "seoDescription",
            "ctaLabel",
            "ctaUrl",
            "ctaDisclosure",
            "coverImageAlt",
          ],
          properties: {
            title: { type: "string" },
            excerpt: { type: "string" },
            content: { type: "string" },
            seoTitle: { type: "string" },
            seoDescription: { type: "string" },
            ctaLabel: { type: "string" },
            ctaUrl: { type: "string" },
            ctaDisclosure: { type: "string" },
            coverImageAlt: { type: "string" },
          },
        },
      },
    },
  })) as WorkersAiResult;

  if (!raw.response) {
    throw new Error("Workers AI returned no response text.");
  }

  return {
    draft: parseProviderResponse(raw.response),
    usage: {
      promptTokens: raw.usage?.prompt_tokens ?? 0,
      completionTokens: raw.usage?.completion_tokens ?? 0,
      totalTokens: raw.usage?.total_tokens ?? 0,
    },
    model,
  };
}

async function callOllamaCloud(
  env: Bindings,
  prompt: { system: string; user: string }
): Promise<{ draft: GeneratedDraftPayload; usage: UsageMetrics; model: string } | null> {
  const baseUrl = env.OLLAMA_CLOUD_BASE_URL?.trim();
  const model = env.OLLAMA_CLOUD_MODEL?.trim();
  if (!baseUrl || !model) {
    return null;
  }

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/chat`;
  const headers = new Headers({ "Content-Type": "application/json" });
  if (env.OLLAMA_CLOUD_API_KEY) {
    headers.set("Authorization", `Bearer ${env.OLLAMA_CLOUD_API_KEY}`);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      options: {
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama Cloud returned ${response.status}`);
  }

  const payload = (await response.json()) as OllamaChatResponse;
  const content = payload.message?.content?.trim();
  if (!content) {
    throw new Error("Ollama Cloud returned no message content.");
  }

  return {
    draft: parseProviderResponse(content),
    usage: {
      promptTokens: payload.prompt_eval_count ?? 0,
      completionTokens: payload.eval_count ?? 0,
      totalTokens: (payload.prompt_eval_count ?? 0) + (payload.eval_count ?? 0),
    },
    model,
  };
}

async function saveGeneratedDraft(
  db: D1Database,
  env: Bindings,
  draft: GeneratedDraftPayload,
  meta: {
    provider: BlogGenerationProvider;
    topicLabel: string;
    focusAsin: string;
    focusImageUrl: string | null;
    marketplace: string;
  }
): Promise<number> {
  const slug = await createUniqueBlogSlug(db, { title: draft.title });
  const excerpt = buildBlogExcerpt(draft.content, draft.excerpt);
  const ctaUrl = buildFocusProductCtaUrl(env.PUBLIC_APP_URL, meta.focusAsin);

  const result = await db
    .prepare(
      `INSERT INTO blog_posts (
         title, slug, excerpt, content, cover_image_key, cover_image_alt,
         cta_label, cta_url, cta_disclosure,
         seo_title, seo_description, status, generation_source, generation_provider,
         generation_topic, generation_focus_asin, generation_marketplace, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'ai', ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      draft.title.trim(),
      slug,
      excerpt,
      draft.content.trim(),
      meta.focusImageUrl,
      draft.coverImageAlt.trim(),
      draft.ctaLabel.trim(),
      ctaUrl,
      draft.ctaDisclosure.trim(),
      draft.seoTitle.trim(),
      draft.seoDescription.trim(),
      meta.provider,
      meta.topicLabel,
      meta.focusAsin,
      meta.marketplace
    )
    .run();

  return Number(result.meta.last_row_id);
}

export async function generateScheduledBlogDraft(env: Bindings): Promise<GenerateDraftResult> {
  const topic = await selectTopic(env.DB);
  if (!topic) {
    await insertGenerationRun(env.DB, {
      status: "skipped",
      reason: "No active products available for AI blog generation.",
    });
    return {
      status: "skipped",
      reason: "No active products available for AI blog generation.",
    };
  }

  const prompt = buildPrompt(topic, env.PUBLIC_APP_URL?.trim() || "https://dealsrky.com");
  const usedNeuronBudget = await getUsedNeuronBudget(env.DB);
  const dailyNeuronLimit = getDailyNeuronLimit(env);

  if (usedNeuronBudget < dailyNeuronLimit) {
    try {
      const result = await callWorkersAi(env, prompt);
      if (result) {
        const blogPostId = await saveGeneratedDraft(env.DB, env, result.draft, {
          provider: "workers_ai",
          topicLabel: topic.topicLabel,
          focusAsin: topic.focusProduct.asin,
          focusImageUrl: topic.focusProduct.image_url,
          marketplace: topic.focusProduct.marketplace,
        });
        await insertGenerationRun(env.DB, {
          status: "success",
          provider: "workers_ai",
          model: result.model,
          topicLabel: topic.topicLabel,
          focusAsin: topic.focusProduct.asin,
          marketplace: topic.focusProduct.marketplace,
          blogPostId,
          usage: result.usage,
        });

        return {
          status: "success",
          provider: "workers_ai",
          model: result.model,
          blogPostId,
        };
      }
    } catch (error) {
      await insertGenerationRun(env.DB, {
        status: "failed",
        provider: "workers_ai",
        model: env.BLOG_AI_PRIMARY_MODEL || null,
        topicLabel: topic.topicLabel,
        focusAsin: topic.focusProduct.asin,
        marketplace: topic.focusProduct.marketplace,
        reason: error instanceof Error ? error.message : "Workers AI generation failed.",
      });
    }
  }

  try {
    const result = await callOllamaCloud(env, prompt);
    if (result) {
      const blogPostId = await saveGeneratedDraft(env.DB, env, result.draft, {
        provider: "ollama_cloud",
        topicLabel: topic.topicLabel,
        focusAsin: topic.focusProduct.asin,
        focusImageUrl: topic.focusProduct.image_url,
        marketplace: topic.focusProduct.marketplace,
      });
      await insertGenerationRun(env.DB, {
        status: "success",
        provider: "ollama_cloud",
        model: result.model,
        topicLabel: topic.topicLabel,
        focusAsin: topic.focusProduct.asin,
        marketplace: topic.focusProduct.marketplace,
        blogPostId,
        usage: result.usage,
      });

      return {
        status: "success",
        provider: "ollama_cloud",
        model: result.model,
        blogPostId,
      };
    }
  } catch (error) {
    await insertGenerationRun(env.DB, {
      status: "failed",
      provider: "ollama_cloud",
      model: env.OLLAMA_CLOUD_MODEL || null,
      topicLabel: topic.topicLabel,
      focusAsin: topic.focusProduct.asin,
      marketplace: topic.focusProduct.marketplace,
      reason: error instanceof Error ? error.message : "Ollama Cloud generation failed.",
    });
    return {
      status: "failed",
      provider: "ollama_cloud",
      model: env.OLLAMA_CLOUD_MODEL || undefined,
      reason: error instanceof Error ? error.message : "Ollama Cloud generation failed.",
    };
  }

  await insertGenerationRun(env.DB, {
    status: "skipped",
    topicLabel: topic.topicLabel,
    focusAsin: topic.focusProduct.asin,
    marketplace: topic.focusProduct.marketplace,
    reason: "No configured AI provider was available for this run.",
  });
  return {
    status: "skipped",
    reason: "No configured AI provider was available for this run.",
  };
}
