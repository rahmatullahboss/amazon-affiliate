import { createRequestHandler } from "react-router";
import { apiApp } from "../server/api";

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

    // Fast-path: Redirect engine (/go/:agentSlug/:asin) — sub-ms with KV
    if (url.pathname.startsWith("/go/")) {
      return apiApp.fetch(request, env, ctx);
    }

    // API routes → Hono (/api/*) — admin panel + public endpoints
    if (url.pathname.startsWith("/api/")) {
      return apiApp.fetch(request, env, ctx);
    }

    // Everything else → React Router SSR (static assets auto-served via asset binding)
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
