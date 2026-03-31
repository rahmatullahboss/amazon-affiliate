import { useEffect, useMemo, useState } from "react";
import type { Route } from "./+types/blogs";
import { getAuthToken } from "../../utils/auth-session";
import { compressImageFile } from "../../utils/image-compression";
import { formatBlogDate, slugifyClientTitle, type BlogPostSummary } from "../../utils/blog";

interface BlogApiResponse {
  posts: BlogPostSummary[];
}

interface BlogFormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_key: string;
  cover_image_url: string;
  cover_image_alt: string;
  seo_title: string;
  seo_description: string;
  status: "draft" | "published";
  is_featured: boolean;
}

const emptyForm: BlogFormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  cover_image_key: "",
  cover_image_url: "",
  cover_image_alt: "",
  seo_title: "",
  seo_description: "",
  status: "draft",
  is_featured: false,
};

export function meta({}: Route.MetaArgs) {
  return [{ title: "Admin Blogs — DealsRky" }];
}

export default function AdminBlogsPage() {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | "new">("new");
  const [form, setForm] = useState<BlogFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    void fetchPosts();
  }, []);

  useEffect(() => {
    if (slugTouched) {
      return;
    }

    setForm((current) => ({
      ...current,
      slug: slugifyClientTitle(current.title),
    }));
  }, [form.title, slugTouched]);

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedId) || null,
    [posts, selectedId]
  );

  async function fetchPosts(selected?: number | "new") {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/blogs", {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });

      const data = (await response.json()) as BlogApiResponse;
      if (!response.ok) {
        throw new Error("Failed to load blog posts");
      }

      setPosts(data.posts);

      const nextSelected = selected ?? selectedId;
      if (nextSelected === "new") {
        setSelectedId("new");
        setForm(emptyForm);
        setSlugTouched(false);
        return;
      }

      const nextPost = data.posts.find((post) => post.id === nextSelected) || data.posts[0] || null;
      if (!nextPost) {
        setSelectedId("new");
        setForm(emptyForm);
        setSlugTouched(false);
        return;
      }

      populateForm(nextPost);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load blog posts");
    } finally {
      setLoading(false);
    }
  }

  function populateForm(post: BlogPostSummary) {
    setSelectedId(post.id);
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || "",
      content: post.content,
      cover_image_key: post.cover_image_key || "",
      cover_image_url: post.cover_image_url || "",
      cover_image_alt: post.cover_image_alt || "",
      seo_title: post.seo_title || "",
      seo_description: post.seo_description || "",
      status: post.status,
      is_featured: post.is_featured === 1,
    });
    setSlugTouched(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        title: form.title,
        slug: form.slug || null,
        excerpt: form.excerpt || null,
        content: form.content,
        cover_image_key: form.cover_image_key || null,
        cover_image_alt: form.cover_image_alt || null,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        status: form.status,
        is_featured: form.is_featured,
      };

      const isNew = selectedId === "new";
      const response = await fetch(isNew ? "/api/blogs" : `/api/blogs/${selectedId}`, {
        method: isNew ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { message?: string; post?: BlogPostSummary; error?: string };
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to save blog post");
      }

      setMessage(data.message || "Saved");
      await fetchPosts(data.post?.id ?? "new");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save blog post");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (selectedId === "new") {
      return;
    }

    const confirmed = window.confirm("Archive this blog post?");
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/blogs/${selectedId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to archive blog post");
      }

      setMessage(data.message || "Archived");
      await fetchPosts("new");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to archive blog post");
    } finally {
      setDeleting(false);
    }
  }

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const compressed = await compressImageFile(file);
      const formData = new FormData();
      formData.append("file", compressed);

      const response = await fetch("/api/blogs/upload-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}` },
        body: formData,
      });

      const data = (await response.json()) as { key?: string; url?: string; error?: string; message?: string };
      if (!response.ok || !data.key || !data.url) {
        throw new Error(data.error || data.message || "Failed to upload image");
      }

      setForm((current) => ({
        ...current,
        cover_image_key: data.key || "",
        cover_image_url: data.url || "",
      }));
      setMessage("Cover image uploaded");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to upload image");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ff9900]">Editorial</p>
          <h1 className="text-2xl font-bold text-[#f0f0f5]">Blog Management</h1>
          <p className="mt-1 text-sm text-[#a0a0b8]">
            Create SEO articles, publish drafts, and upload compressed cover images to R2.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedId("new");
            setForm(emptyForm);
            setSlugTouched(false);
            setMessage("");
            setError("");
          }}
          className="rounded-xl bg-[#ff9900] px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-[#ffad33]"
        >
          New Post
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-2xl border border-white/10 bg-[#111827] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#f0f0f5]">Posts</h2>
            <span className="text-xs uppercase tracking-[0.18em] text-[#6b7280]">
              {posts.length} total
            </span>
          </div>

          {loading ? (
            <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-[#a0a0b8]">
              Loading blog posts...
            </p>
          ) : posts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-[#a0a0b8]">
              No blog posts yet. Create your first draft.
            </p>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => populateForm(post)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    selectedPost?.id === post.id
                      ? "border-[#ff9900]/40 bg-[#ff9900]/10"
                      : "border-white/10 bg-white/5 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#f0f0f5]">{post.title}</p>
                      <p className="mt-1 text-xs text-[#6b7280]">/{post.slug}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                        post.status === "published"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {post.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#94a3b8]">
                    <span>{formatBlogDate(post.published_at)}</span>
                    <span>•</span>
                    <span>{post.reading_minutes} min read</span>
                    {post.is_featured === 1 ? (
                      <>
                        <span>•</span>
                        <span className="text-[#ffcc80]">Featured</span>
                      </>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-white/10 bg-[#111827] p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[#f0f0f5]">Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 text-sm text-[#f8fafc] outline-none transition focus:border-[#ff9900]/40"
                placeholder="Best air purifiers for apartments"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-[#f0f0f5]">Slug</span>
              <input
                value={form.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setForm((current) => ({ ...current, slug: slugifyClientTitle(event.target.value) }));
                }}
                className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 text-sm text-[#f8fafc] outline-none transition focus:border-[#ff9900]/40"
                placeholder="best-air-purifiers-for-apartments"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-[#f0f0f5]">Excerpt</span>
            <textarea
              value={form.excerpt}
              onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 text-sm text-[#f8fafc] outline-none transition focus:border-[#ff9900]/40"
              placeholder="Short summary shown on blog cards and search snippets"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-[#f0f0f5]">Article Content</span>
            <textarea
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
              rows={18}
              className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 text-sm leading-7 text-[#f8fafc] outline-none transition focus:border-[#ff9900]/40"
              placeholder="Write the article here. Separate paragraphs with blank lines."
            />
          </label>

          <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              <span className="text-sm font-semibold text-[#f0f0f5]">Cover Image</span>
              <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#0f172a] px-4 py-8 text-center text-sm text-[#a0a0b8] hover:border-[#ff9900]/35">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                {uploading ? "Compressing and uploading..." : "Choose image"}
              </label>
              <p className="text-xs leading-6 text-[#6b7280]">
                Images are compressed in the browser before upload and stored in R2.
              </p>
            </div>

            <div className="space-y-3">
              {form.cover_image_url ? (
                <img
                  src={form.cover_image_url}
                  alt={form.cover_image_alt || form.title || "Blog cover preview"}
                  className="aspect-[16/9] w-full rounded-2xl border border-white/10 object-cover"
                />
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center rounded-2xl border border-white/10 bg-[#0f172a] text-sm text-[#6b7280]">
                  No cover image uploaded yet
                </div>
              )}
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[#f0f0f5]">Image Alt Text</span>
                <input
                  value={form.cover_image_alt}
                  onChange={(event) => setForm((current) => ({ ...current, cover_image_alt: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 text-sm text-[#f8fafc] outline-none transition focus:border-[#ff9900]/40"
                  placeholder="Describe the cover image"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[#f0f0f5]">SEO Title</span>
              <input
                value={form.seo_title}
                onChange={(event) => setForm((current) => ({ ...current, seo_title: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 text-sm text-[#f8fafc] outline-none transition focus:border-[#ff9900]/40"
                placeholder="Optional custom title tag"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-[#f0f0f5]">SEO Description</span>
              <input
                value={form.seo_description}
                onChange={(event) => setForm((current) => ({ ...current, seo_description: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 text-sm text-[#f8fafc] outline-none transition focus:border-[#ff9900]/40"
                placeholder="Optional meta description override"
              />
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[#f0f0f5]">Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value === "published" ? "published" : "draft",
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 text-sm text-[#f8fafc] outline-none transition focus:border-[#ff9900]/40"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>

            <label className="mt-8 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0f172a] px-4 py-3 text-sm text-[#f8fafc]">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(event) =>
                  setForm((current) => ({ ...current, is_featured: event.target.checked }))
                }
              />
              Mark as featured
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving || uploading}
              className="rounded-xl bg-[#ff9900] px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-[#ffad33] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving..." : selectedId === "new" ? "Create Post" : "Update Post"}
            </button>

            {selectedId !== "new" ? (
              <button
                type="button"
                disabled={deleting || saving}
                onClick={() => void handleDelete()}
                className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deleting ? "Archiving..." : "Archive Post"}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
