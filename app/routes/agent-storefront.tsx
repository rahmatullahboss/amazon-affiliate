import type { Route } from "./+types/agent-storefront";
import { Link } from "react-router";
import { ProductCard } from "../components/home/ProductCard";
import { buildSeoMeta } from "../utils/seo";

interface StorefrontProduct {
  id: number;
  asin: string;
  title: string;
  image_url: string;
  category: string | null;
  marketplace: string;
}

interface AgentStorefrontData {
  agent: {
    name: string;
    slug: string;
  };
  products: StorefrontProduct[];
}

export function meta({ data, params }: Route.MetaArgs) {
  const storefront = data as AgentStorefrontData | undefined;
  const agentSlug = params.agent || storefront?.agent.slug || "agent";
  const agentName = storefront?.agent.name || "Agent";

  return buildSeoMeta({
    title: `${agentName} Storefront — DealsRky`,
    description: `Browse curated Amazon products shared by ${agentName} on DealsRky.`,
    path: `/${agentSlug}`,
  });
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const agentSlug = (params.agent || "").trim();

  if (!agentSlug) {
    throw new Response("Agent not found", { status: 404 });
  }

  const agent = await env.DB.prepare(
    `SELECT id, name, slug
     FROM agents
     WHERE slug = ? AND is_active = 1
     LIMIT 1`
  )
    .bind(agentSlug)
    .first<{ id: number; name: string; slug: string }>();

  if (!agent) {
    throw new Response("Agent storefront not found", { status: 404 });
  }

  const { results } = await env.DB.prepare(
    `SELECT DISTINCT
        p.id,
        p.asin,
        COALESCE(ap.custom_title, p.title) as title,
        p.image_url,
        p.category,
        t.marketplace
     FROM agent_products ap
     JOIN products p ON p.id = ap.product_id
     JOIN tracking_ids t ON t.id = ap.tracking_id
     WHERE ap.agent_id = ?
       AND ap.is_active = 1
       AND p.is_active = 1
       AND p.status = 'active'
       AND t.is_active = 1
     ORDER BY ap.updated_at DESC, ap.id DESC`
  )
    .bind(agent.id)
    .all<StorefrontProduct>();

  return {
    agent: {
      name: agent.name,
      slug: agent.slug,
    },
    products: results || [],
  } satisfies AgentStorefrontData;
}

export default function AgentStorefrontPage({ loaderData }: Route.ComponentProps) {
  const data = loaderData as AgentStorefrontData;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="border-b border-gray-200 bg-primary/5 py-10">
        <div className="container mx-auto px-4 text-center">
          <nav className="mb-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <Link to="/" className="transition-colors hover:text-primary">
              Home
            </Link>
            <span>›</span>
            <span className="font-medium text-gray-800">{data.agent.name}</span>
          </nav>

          <h1 className="text-3xl font-black text-gray-900 md:text-5xl">
            {data.agent.name} Storefront
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-600 md:text-base">
            Browse all active products shared through this agent storefront. Open any product to view
            its tracked landing page before going to Amazon.
          </p>
          <p className="mt-4 text-sm font-medium text-primary">
            {data.products.length} product{data.products.length !== 1 ? "s" : ""} available
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-8">
        {data.products.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.products.map((product) => (
              <ProductCard
                key={`${data.agent.slug}-${product.asin}`}
                item={product}
                href={`/${data.agent.slug}/${product.asin}`}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
            <span className="mb-3 block text-4xl">📦</span>
            <h2 className="text-xl font-bold text-gray-900">No Products Yet</h2>
            <p className="mt-2 text-sm text-gray-500">
              This storefront does not have any active products yet. Please check back later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
