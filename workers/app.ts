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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const canonicalUrl = shouldRedirectToPublicAppUrl(request.url, env);

    if (canonicalUrl && (request.method === "GET" || request.method === "HEAD")) {
      return Response.redirect(canonicalUrl, 301);
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
