import { Link } from "react-router";
import type { BlogPostSummary } from "../../utils/blog";
import { formatBlogDate } from "../../utils/blog";

export function BlogCard({ post }: { post: BlogPostSummary }) {
  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_-34px_rgba(12,112,112,0.35)]">
      {post.cover_image_url ? (
        <Link to={`/blog/${post.slug}`} className="block aspect-[16/9] overflow-hidden bg-[#edf5f5]">
          <img
            src={post.cover_image_url}
            alt={post.cover_image_alt || post.title}
            className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
            loading="lazy"
          />
        </Link>
      ) : (
        <Link
          to={`/blog/${post.slug}`}
          className="flex aspect-[16/9] items-center justify-center bg-[linear-gradient(135deg,#103737_0%,#185757_100%)] text-white"
        >
          <span className="text-xs font-bold uppercase tracking-[0.35em] text-white/70">
            DealsRky Journal
          </span>
        </Link>
      )}

      <div className="p-6">
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
          <span>{formatBlogDate(post.published_at)}</span>
          <span>•</span>
          <span>{post.reading_minutes} min read</span>
        </div>

        <h2 className="mt-4 text-2xl font-black leading-tight text-gray-950">
          <Link to={`/blog/${post.slug}`} className="transition-colors hover:text-primary">
            {post.title}
          </Link>
        </h2>

        <p className="mt-3 text-sm leading-7 text-gray-600">
          {post.excerpt_text || post.excerpt || ""}
        </p>

        <Link
          to={`/blog/${post.slug}`}
          className="mt-6 inline-flex items-center text-sm font-bold text-primary transition-colors hover:text-primary-hover"
        >
          Read article
        </Link>
      </div>
    </article>
  );
}
