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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const canonicalUrl = shouldRedirectToPublicAppUrl(request.url, env);

    if (canonicalUrl && (request.method === "GET" || request.method === "HEAD")) {
      return Response.redirect(canonicalUrl, 301);
    }

    if (url.pathname === "/favicon.ico") {
      return Response.redirect(`${url.origin}/favicon.svg`, 302);
    }

    if (url.pathname === "/robots.txt") {
      return new Response(["User-agent: *", "Allow: /"].join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
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
