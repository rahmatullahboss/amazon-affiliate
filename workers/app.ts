import { createRequestHandler } from "react-router";
import { apiApp } from "../server/api";
import { shouldRedirectToPublicAppUrl } from "../server/utils/url";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

const PUBLIC_SITE_URL = "https://dealsrky.com";
const XML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

interface SitemapEntry {
  path: string;
  lastModified?: string | null;
}

function isCommonBotProbe(pathname: string): boolean {
  return (
    pathname === "/.env" ||
    pathname === "/xmlrpc.php" ||
    pathname === "/wordpress" ||
    pathname.endsWith("/wlwmanifest.xml") ||
    pathname.includes("/wp-admin/") ||
    pathname.includes("/wp-includes/") ||
    pathname.startsWith("/wordpress/")
  );
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => XML_ESCAPE_MAP[character] ?? character);
}

function formatSitemapDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const loc = escapeXml(new URL(entry.path, PUBLIC_SITE_URL).toString());
      const lastmod = formatSitemapDate(entry.lastModified);

      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
        "  </url>",
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
  ].join("\n");
}

async function buildSitemapResponse(env: Env): Promise<Response> {
  const staticEntries: SitemapEntry[] = [
    { path: "/" },
    { path: "/deals" },
    { path: "/about" },
    { path: "/contact" },
    { path: "/disclosure" },
    { path: "/privacy" },
  ];

  const { results: categoryResults } = await env.DB.prepare(
    `SELECT slug, created_at
     FROM categories
     WHERE is_active = 1
     ORDER BY display_order ASC, id ASC`
  ).all<{ slug: string; created_at: string | null }>();

  const { results: productResults } = await env.DB.prepare(
    `SELECT asin, COALESCE(updated_at, created_at) AS last_modified
     FROM products
     WHERE is_active = 1 AND status = 'active'
     ORDER BY created_at DESC`
  ).all<{ asin: string; last_modified: string | null }>();

  const dynamicEntries: SitemapEntry[] = [
    ...(categoryResults ?? []).map((category) => ({
      path: `/category/${category.slug}`,
      lastModified: category.created_at,
    })),
    ...(productResults ?? []).map((product) => ({
      path: `/deals/${product.asin}`,
      lastModified: product.last_modified,
    })),
  ];

  return new Response(buildSitemapXml([...staticEntries, ...dynamicEntries]), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const canonicalUrl = shouldRedirectToPublicAppUrl(request.url, env);

    if (canonicalUrl && (request.method === "GET" || request.method === "HEAD")) {
      return Response.redirect(canonicalUrl, 301);
    }

    if (url.pathname === "/favicon.ico" || url.pathname === "/favicon.png") {
      return Response.redirect(`${url.origin}/favicon.svg`, 302);
    }

    if (url.pathname === "/robots.txt") {
      return new Response(
        [
          "User-agent: *",
          "Allow: /",
          "Disallow: /api/",
          "Disallow: /admin/",
          "Disallow: /portal/",
          "Disallow: /go/",
          "Disallow: /t/",
          `Sitemap: ${PUBLIC_SITE_URL}/sitemap.xml`,
        ].join("\n"),
        {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }
      );
    }

    if (url.pathname === "/sitemap.xml") {
      return buildSitemapResponse(env);
    }

    if (isCommonBotProbe(url.pathname)) {
      return new Response("Not Found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    // Fast-path: Redirect engine (/go/:agentSlug/:asin) — sub-ms with KV
    if (url.pathname.startsWith("/go/")) {
      return apiApp.fetch(request, env, ctx);
    }

    // API routes → Hono (/api/*) — admin panel + public endpoints
    if (url.pathname.startsWith("/api/")) {
      return apiApp.fetch(request, env, ctx);
    }

    // Everything else → React Router SSR (static assets auto-served via asset binding)
    const response = await requestHandler(request, {
      cloudflare: { env, ctx },
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      headers.set("X-Frame-Options", "DENY");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
      );

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
