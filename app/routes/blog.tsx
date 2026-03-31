import type { Route } from "./+types/blog";
import { Link } from "react-router";
import { BlogCard } from "../components/blog/BlogCard";
import { buildSeoMeta } from "../utils/seo";
import type { BlogPostSummary } from "../utils/blog";
import { buildBlogExcerpt, buildBlogImageUrl, estimateReadingMinutes } from "../../server/services/blog";

interface BlogPageData {
  featuredPost: BlogPostSummary | null;
  posts: BlogPostSummary[];
}

export function meta({}: Route.MetaArgs) {
  return buildSeoMeta({
    title: "Blog — DealsRky",
    description:
      "Read practical buying guides, product roundups, and comparison articles from the DealsRky editorial team.",
    path: "/blog",
  });
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;

  const { results } = await env.DB.prepare(
    `SELECT *
     FROM blog_posts
     WHERE is_deleted = 0 AND status = 'published'
     ORDER BY is_featured DESC, published_at DESC, updated_at DESC
     LIMIT 24`
  ).all<BlogPostSummary & { cover_image_key: string | null }>();

  const posts = (results ?? []).map((row) => ({
    ...row,
    cover_image_url: buildBlogImageUrl(env, row.cover_image_key),
    excerpt_text: buildBlogExcerpt(row.content, row.excerpt),
    reading_minutes: estimateReadingMinutes(row.content),
  }));

  return {
    featuredPost: posts[0] || null,
    posts: posts.slice(1),
  } satisfies BlogPageData;
}

export default function BlogPage({ loaderData }: Route.ComponentProps) {
  const { featuredPost, posts } = loaderData as BlogPageData;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8f8_0%,#ffffff_30%,#f4f6f6_100%)]">
      <section className="border-b border-gray-200 bg-white/85">
        <div className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-primary">
            DealsRky Blog
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-gray-950 md:text-6xl">
            Buying guides, product research, and smarter Amazon shopping advice.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-gray-600">
            We publish practical roundups, comparisons, and explanation-first articles to help shoppers understand what is worth buying and why.
          </p>
        </div>
      </section>

      {featuredPost ? (
        <section className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
          <div className="grid gap-8 overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm lg:grid-cols-[1.1fr_0.9fr]">
            <Link to={`/blog/${featuredPost.slug}`} className="block h-full bg-[#edf5f5]">
              {featuredPost.cover_image_url ? (
                <img
                  src={featuredPost.cover_image_url}
                  alt={featuredPost.cover_image_alt || featuredPost.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center bg-[linear-gradient(135deg,#103737_0%,#185757_100%)] text-white">
                  <span className="text-xs font-bold uppercase tracking-[0.35em] text-white/75">
                    Featured article
                  </span>
                </div>
              )}
            </Link>

            <div className="p-8 md:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
                Featured article
              </p>
              <h2 className="mt-4 text-3xl font-black leading-tight text-gray-950 md:text-4xl">
                <Link to={`/blog/${featuredPost.slug}`} className="transition-colors hover:text-primary">
                  {featuredPost.title}
                </Link>
              </h2>
              <p className="mt-5 text-base leading-8 text-gray-600">
                {featuredPost.excerpt_text || featuredPost.excerpt || ""}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm font-semibold text-gray-500">
                <span>{featuredPost.reading_minutes} min read</span>
                <span>•</span>
                <span>{featuredPost.published_at ? new Date(featuredPost.published_at).toLocaleDateString() : "Draft"}</span>
              </div>
              <Link
                to={`/blog/${featuredPost.slug}`}
                className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Read featured article
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 pb-16 lg:px-6">
        {posts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="rounded-[2rem] border border-dashed border-gray-300 bg-white p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900">No articles published yet</h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              The editorial team is preparing the first batch of buying guides and product research posts.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
