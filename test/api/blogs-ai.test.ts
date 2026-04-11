import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { apiApp } from "../../server/api";
import { DbFactory } from "../factories/db";
import { generateAdminToken } from "../factories/token";

interface TestAiBinding {
  run(model: string, input: unknown): Promise<unknown>;
}

describe("AI blog draft generation", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM blog_generation_runs").run();
    await env.DB.prepare("DELETE FROM blog_posts").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("DELETE FROM admin_users").run();
  });

  it("generates an AI draft and keeps it in the admin approval queue", async () => {
    const envWithAi = env as typeof env & {
      AI?: TestAiBinding;
      BLOG_AI_PRIMARY_MODEL?: string;
      BLOG_AI_NEURON_DAILY_LIMIT?: string;
      PUBLIC_APP_URL?: string;
      JWT_SECRET?: string;
      OLLAMA_CLOUD_BASE_URL?: string;
      OLLAMA_CLOUD_MODEL?: string;
    };
    envWithAi.JWT_SECRET = "test-secret";

    await DbFactory.seedAdmin(env.DB);
    const token = await generateAdminToken(envWithAi.JWT_SECRET);

    await env.DB.prepare(
      `INSERT INTO products (
         id, asin, title, image_url, marketplace, category, review_content, features, status, is_active
       ) VALUES (
         9901,
         'B0AIBLOG01',
         'Cordless Vacuum Cleaner',
         'https://example.com/vacuum.jpg',
         'US',
         'Vacuum Cleaners',
         'A practical cordless vacuum option for quick everyday cleanup.',
         '["Quiet motor","Lightweight frame","Wall mount"]',
         'active',
         1
       )`
    ).run();

    const aiResponse = {
      response: JSON.stringify({
        title: "Best Cordless Vacuum Buying Guide for Everyday Home Cleaning",
        excerpt:
          "A practical editorial guide covering what shoppers should compare before choosing a cordless vacuum for routine home cleaning.",
        content:
          "Choosing a cordless vacuum is easier when you focus on real routine needs instead of feature overload.\n\nFor most homes, the best option is the one that feels manageable for quick daily cleaning, storage, and repeat use. Weight, runtime, charging setup, and floor compatibility matter more than flashy claims.\n\nStart by looking at where the vacuum will be used most often. Apartments, family homes, and mixed flooring setups all change what matters in day-to-day use. A lighter frame can be more useful than higher advertised power if the cleaner will be used frequently across rooms.\n\nBattery behavior is another practical factor. Some shoppers need a vacuum for quick spills and touch-up cleaning, while others need enough runtime for a more complete pass through the home. Storage style and charging convenience also shape whether the product will be used regularly.\n\nIt also helps to compare maintenance needs. Dustbin design, filter access, and brush cleaning can make a large difference after the initial purchase. Products that stay easy to maintain are usually easier to keep in rotation.\n\nWhen comparing options, look for a balance between maneuverability, routine comfort, and the surfaces you actually clean most. Everyday usability is usually the deciding factor in long-term satisfaction.\n\nDealsRky readers should also compare related models in the same category before buying, especially if room size, flooring mix, or storage constraints differ from one household to another.\n\nBefore placing an order, always verify the latest Amazon price, delivery details, and the final product page information directly on Amazon.",
        seoTitle: "Best Cordless Vacuum Buying Guide for Everyday Home Cleaning | DealsRky",
        seoDescription:
          "Compare the most practical cordless vacuum buying factors for everyday home cleaning, storage, and repeat use before you buy.",
        ctaLabel: "Browse smart picks",
        ctaUrl: "https://dealsrky.com/deals",
        ctaDisclosure:
          "Affiliate Disclosure: DealsRky may earn a commission from qualifying purchases made after you visit Amazon.",
        coverImageAlt: "Cordless vacuum buying guide illustration",
      }),
      usage: {
        prompt_tokens: 410,
        completion_tokens: 620,
        total_tokens: 1030,
      },
    };

    const aiRun = vi.fn<Parameters<TestAiBinding["run"]>, ReturnType<TestAiBinding["run"]>>(
      async () => aiResponse
    );

    envWithAi.AI = { run: aiRun };
    envWithAi.BLOG_AI_PRIMARY_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    envWithAi.BLOG_AI_NEURON_DAILY_LIMIT = "10000";
    envWithAi.PUBLIC_APP_URL = "https://dealsrky.com";
    envWithAi.OLLAMA_CLOUD_BASE_URL = "";
    envWithAi.OLLAMA_CLOUD_MODEL = "";

    const response = await apiApp.fetch(
      new Request("http://localhost/api/blogs/generate-ai-draft", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      envWithAi as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(201);

    const post = await env.DB.prepare(
      `SELECT status, generation_source, generation_provider, generation_focus_asin, cover_image_key, cover_image_alt, cta_url
       FROM blog_posts
       WHERE generation_source = 'ai'
       LIMIT 1`
    ).first<{
      status: string;
      generation_source: string;
      generation_provider: string | null;
      generation_focus_asin: string | null;
      cover_image_key: string | null;
      cover_image_alt: string | null;
      cta_url: string | null;
    }>();

    expect(post).not.toBeNull();
    expect(post?.status).toBe("draft");
    expect(post?.generation_source).toBe("ai");
    expect(post?.generation_provider).toBe("workers_ai");
    expect(post?.generation_focus_asin).toBe("B0AIBLOG01");
    expect(post?.cover_image_key).toBe("https://example.com/vacuum.jpg");
    expect(post?.cover_image_alt).toBe("Cordless vacuum buying guide illustration");
    expect(post?.cta_url).toBe("https://dealsrky.com/deals/B0AIBLOG01");

    const run = await env.DB.prepare(
      `SELECT status, provider, total_tokens
       FROM blog_generation_runs
       ORDER BY id DESC
       LIMIT 1`
    ).first<{ status: string; provider: string | null; total_tokens: number | null }>();

    expect(run).not.toBeNull();
    expect(run?.status).toBe("success");
    expect(run?.provider).toBe("workers_ai");
    expect(run?.total_tokens).toBe(1030);
    expect(aiRun).toHaveBeenCalledTimes(1);
  });

  it("accepts provider responses wrapped in fenced json code blocks", async () => {
    const envWithAi = env as typeof env & {
      AI?: TestAiBinding;
      BLOG_AI_PRIMARY_MODEL?: string;
      BLOG_AI_NEURON_DAILY_LIMIT?: string;
      PUBLIC_APP_URL?: string;
      JWT_SECRET?: string;
      OLLAMA_CLOUD_BASE_URL?: string;
      OLLAMA_CLOUD_MODEL?: string;
    };
    envWithAi.JWT_SECRET = "test-secret";

    await DbFactory.seedAdmin(env.DB);
    const token = await generateAdminToken(envWithAi.JWT_SECRET);

    await env.DB.prepare(
      `INSERT INTO products (
         id, asin, title, image_url, marketplace, category, review_content, features, status, is_active
       ) VALUES (
         9902,
         'B0AIBLOG02',
         'Portable Blender',
         'https://example.com/blender.jpg',
         'US',
         'Blenders',
         'A compact blender for quick smoothies and small daily prep.',
         '["USB charging","Travel lid","Compact cup"]',
         'active',
         1
       )`
    ).run();

    const aiRun = vi.fn<Parameters<TestAiBinding["run"]>, ReturnType<TestAiBinding["run"]>>(
      async () => ({
        response: [
          "```json",
          JSON.stringify({
            title: "Portable Blender Buying Guide for Quick Daily Smoothies",
            excerpt:
              "A practical guide to choosing a portable blender for small daily drinks, easy storage, and routine convenience.",
            content:
              "Portable blenders work best when they match the way you actually prepare drinks at home, at work, or while traveling.\n\nCapacity, cleanup effort, charging convenience, and cup design usually matter more than headline claims.\n\nIf you mostly want quick shakes or simple fruit blends, a lightweight format can be more useful than a larger jar. The easier the blender is to rinse, recharge, and keep nearby, the more likely it is to stay in your routine.\n\nIt also helps to compare lid design, drinking convenience, and how stable the base feels during repeated use. Small everyday details shape whether a portable blender feels practical over time.\n\nBefore buying, compare size, charging method, and the final Amazon listing details so the product suits your routine.",
            seoTitle: "Portable Blender Buying Guide for Quick Daily Smoothies | DealsRky",
            seoDescription:
              "Compare the most practical portable blender factors for quick daily smoothies, smaller servings, and easy routine use.",
            ctaLabel: "Browse smoothie picks",
            ctaUrl: "https://dealsrky.com/deals",
            ctaDisclosure:
              "Affiliate Disclosure: DealsRky may earn a commission from qualifying purchases made after you visit Amazon.",
            coverImageAlt: "Portable blender buying guide illustration",
          }),
          "```",
        ].join("\n"),
        usage: {
          prompt_tokens: 200,
          completion_tokens: 300,
          total_tokens: 500,
        },
      })
    );

    envWithAi.AI = { run: aiRun };
    envWithAi.BLOG_AI_PRIMARY_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    envWithAi.BLOG_AI_NEURON_DAILY_LIMIT = "10000";
    envWithAi.PUBLIC_APP_URL = "https://dealsrky.com";
    envWithAi.OLLAMA_CLOUD_BASE_URL = "";
    envWithAi.OLLAMA_CLOUD_MODEL = "";

    const response = await apiApp.fetch(
      new Request("http://localhost/api/blogs/generate-ai-draft", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      envWithAi as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(201);
  });

  it("normalizes provider fields that exceed excerpt and seo length caps", async () => {
    const envWithAi = env as typeof env & {
      AI?: TestAiBinding;
      BLOG_AI_PRIMARY_MODEL?: string;
      BLOG_AI_NEURON_DAILY_LIMIT?: string;
      PUBLIC_APP_URL?: string;
      JWT_SECRET?: string;
      OLLAMA_CLOUD_BASE_URL?: string;
      OLLAMA_CLOUD_MODEL?: string;
    };
    envWithAi.JWT_SECRET = "test-secret";

    await DbFactory.seedAdmin(env.DB);
    const token = await generateAdminToken(envWithAi.JWT_SECRET);

    await env.DB.prepare(
      `INSERT INTO products (
         id, asin, title, image_url, marketplace, category, review_content, features, status, is_active
       ) VALUES (
         9903,
         'B0AIBLOG03',
         'Mini Projector',
         'https://example.com/projector.jpg',
         'US',
         'Projectors',
         'A compact projector for casual home viewing and smaller spaces.',
         '["Compact size","HD support","Simple setup"]',
         'active',
         1
       )`
    ).run();

    const aiRun = vi.fn<Parameters<TestAiBinding["run"]>, ReturnType<TestAiBinding["run"]>>(
      async () => ({
        response: JSON.stringify({
          title: "Mini Projector Buying Guide for Casual Home Viewing",
          excerpt:
            "A practical editorial guide for shoppers who want a compact projector for casual home viewing, easier setup, smaller rooms, simpler storage, flexible placement, repeat use on normal evenings, and a less complicated buying decision before they check Amazon for final details.",
          content:
            "Mini projectors are easiest to live with when they match the room size, lighting, and setup habits you already have.\n\nFor casual viewing, portability and placement flexibility often matter more than overly technical claims. Buyers usually get better results when they compare the real setup experience instead of assuming every compact projector fits the same type of room.\n\nIt helps to compare how fast the projector is to set up, how simple it is to connect, and whether the brightness expectations match the way you actually plan to use it. If the projector will mostly be used in bedrooms, smaller living rooms, or temporary spaces, convenience can matter as much as pure specification sheets.\n\nSmall design details such as cable management, remote layout, built-in audio expectations, and stability on normal surfaces can affect long-term convenience more than headline specs alone. A product that is easy to place, easy to store, and easy to reconnect after a few days often feels better in normal life than one that sounds more advanced on paper.\n\nIt is also worth thinking about what content will actually be watched. Casual streaming, family movie nights, and short-form viewing setups all change what matters in practice. Some shoppers care more about portability and quick setup, while others care about keeping cables tidy and reducing friction every time the projector comes out.\n\nBefore buying, compare the final Amazon listing details, connection options, expected room setup, and accessory requirements so the projector fits your routine.",
          seoTitle: "Mini Projector Buying Guide for Casual Home Viewing | DealsRky",
          seoDescription:
            "Compare the most practical mini projector factors for casual home viewing, simpler setup, flexible placement, smaller spaces, easier storage, and routine use before you buy from Amazon today.",
          ctaLabel: "Browse projector picks",
          ctaUrl: "https://dealsrky.com/deals",
          ctaDisclosure:
            "Affiliate Disclosure: DealsRky may earn a commission from qualifying purchases made after you visit Amazon.",
          coverImageAlt: "Mini projector buying guide illustration",
        }),
        usage: {
          prompt_tokens: 240,
          completion_tokens: 380,
          total_tokens: 620,
        },
      })
    );

    envWithAi.AI = { run: aiRun };
    envWithAi.BLOG_AI_PRIMARY_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    envWithAi.BLOG_AI_NEURON_DAILY_LIMIT = "10000";
    envWithAi.PUBLIC_APP_URL = "https://dealsrky.com";
    envWithAi.OLLAMA_CLOUD_BASE_URL = "";
    envWithAi.OLLAMA_CLOUD_MODEL = "";

    const response = await apiApp.fetch(
      new Request("http://localhost/api/blogs/generate-ai-draft", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: "http://localhost",
        },
      }),
      envWithAi as never,
      { waitUntil: () => undefined } as never
    );

    expect(response.status).toBe(201);

    const savedPost = await env.DB.prepare(
      `SELECT excerpt, seo_description
       FROM blog_posts
       WHERE generation_focus_asin = 'B0AIBLOG03'
       ORDER BY id DESC
       LIMIT 1`
    ).first<{ excerpt: string | null; seo_description: string | null }>();

    expect(savedPost).not.toBeNull();
    expect(savedPost?.excerpt?.length ?? 0).toBeLessThanOrEqual(220);
    expect(savedPost?.seo_description?.length ?? 0).toBeLessThanOrEqual(180);
  });
});
