import type { Route } from "./+types/tracking-shortcut";
import {
  ASIN_IMPORT_ENABLED,
  ASIN_IMPORT_PAUSED_DETAIL,
} from "../utils/asin-import";
import { DynamicLinkResolutionError, ensureDynamicLinkByTrackingTag } from "../../server/services/dynamic-links";
import { buildCanonicalBridgePath } from "../../server/utils/url";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Preparing Product Link — DealsRky" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const trackingTag = params.trackingTag;
  const asin = params.asin;
  const workerEnv = context.cloudflare.env as Env & { AMAZON_API_KEY_FALLBACK?: string };

  if (!trackingTag || !asin) {
    throw new Response("Invalid shortcut link.", { status: 400 });
  }

  try {
    const resolved = await ensureDynamicLinkByTrackingTag({
      db: workerEnv.DB,
      kv: workerEnv.KV,
      trackingTag,
      asin,
      apiKey: workerEnv.AMAZON_API_KEY,
      fallbackApiKeys: workerEnv.AMAZON_API_KEY_FALLBACK
        ? [workerEnv.AMAZON_API_KEY_FALLBACK]
        : [],
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: buildCanonicalBridgePath(
          resolved.agentSlug,
          resolved.asin,
          resolved.marketplace
        ),
      },
    });
  } catch (error) {
    if (error instanceof DynamicLinkResolutionError) {
      throw new Response(error.message, { status: error.status });
    }

    throw error;
  }
}

export default function TrackingShortcutPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f8f8_0%,#ffffff_25%,#f4f6f6_100%)] px-4 py-16">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="m-0 text-xs font-bold uppercase tracking-[0.25em] text-primary">
          Dynamic ASIN Link
        </p>
        <h1 className="mt-4 text-3xl font-black text-gray-950">
          Preparing your product page
        </h1>
        <p className="mt-3 text-sm leading-7 text-gray-600">
          {ASIN_IMPORT_ENABLED
            ? "DealsRky is checking the ASIN, creating the product mapping if needed, and forwarding you to the live bridge page."
            : `${ASIN_IMPORT_PAUSED_DETAIL} Saved ASIN links will continue to open normally.`}
        </p>
      </div>
    </main>
  );
}
