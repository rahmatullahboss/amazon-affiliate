import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/products";
import { extractApiErrorMessage } from "../../utils/api-errors";
import { getAuthToken } from "../../utils/auth-session";
import { copyTextToClipboard } from "../../utils/clipboard";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "RKY Tag House" },
    { name: "application-name", content: "RKY Tag House" },
    { name: "apple-mobile-web-app-title", content: "RKY Tag House" },
  ];
}

interface PortalProduct {
  id: number;
  custom_title: string | null;
  product_id: number;
  asin: string;
  marketplace: string;
  title: string;
  image_url: string;
  status: string;
  tracking_tag: string;
  bridge_page_url: string;
  redirect_url: string;
}

interface SubmissionResponse {
  message: string;
  link: string;
  redirectLink: string;
  status: string;
  product: {
    asin: string;
    marketplace: string;
    title: string;
    imageUrl: string;
  };
}

interface ProductSubmissionPayload {
  asin: string;
  marketplace: string;
  custom_title: string | null;
}

export default function PortalProductsPage() {
  const [products, setProducts] = useState<PortalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asin, setAsin] = useState("");
  const [marketplace, setMarketplace] = useState("US");
  const [customTitle, setCustomTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SubmissionResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedProductKey, setCopiedProductKey] = useState("");
  const [lastPayload, setLastPayload] = useState<ProductSubmissionPayload | null>(null);

  const loadProducts = async () => {
    const token = getAuthToken();
    const response = await fetch("/api/portal/products", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error("Failed to load products");
    }

    const data = (await response.json()) as { products: PortalProduct[] };
    setProducts(data.products);
  };

  useEffect(() => {
    loadProducts()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load products"))
      .finally(() => setLoading(false));
  }, []);

  const submitProduct = async (payload: ProductSubmissionPayload) => {
    setSubmitting(true);
    setError("");
    setSuccess(null);
    setCopied(false);
    setLastPayload(payload);

    try {
      const token = getAuthToken();
      const response = await fetch("/api/portal/products/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(extractApiErrorMessage(data, "Submission failed"));
      }

      const data = (await response.json()) as SubmissionResponse;

      setAsin("");
      setMarketplace("US");
      setCustomTitle("");
      setSuccess(data);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await submitProduct({
      asin: asin.toUpperCase(),
      marketplace,
      custom_title: customTitle || null,
    });
  };

  const handleRetrySubmit = async () => {
    if (!lastPayload || submitting) {
      return;
    }

    await submitProduct(lastPayload);
  };

  const handleCopy = async () => {
    if (!success) return;

    const copyOk = await copyTextToClipboard(success.link);
    if (!copyOk) {
      setError("Could not copy the full link. Please try again.");
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleProductCopy = async (product: PortalProduct) => {
    const copiedOk = await copyTextToClipboard(product.bridge_page_url);
    if (!copiedOk) {
      setError("Could not copy the full link. Please try again.");
      return;
    }

    const copyKey = `${product.id}`;
    setCopiedProductKey(copyKey);
    window.setTimeout(() => {
      setCopiedProductKey((current) => (current === copyKey ? "" : current));
    }, 2000);
  };

  return (
    <section className="flex flex-col lg:grid lg:grid-cols-[minmax(320px,420px)_1fr] gap-4">
      <article className="bg-[#111827] border border-white/10 rounded-2xl p-6">
        <h1 className="m-0 mb-3 text-gray-50 text-xl font-bold">Submit ASIN</h1>
        <p className="m-0 mb-2 text-slate-300 leading-relaxed text-sm">Paste an ASIN or full Amazon product link. If live product data is fetched successfully, your tracked link will be ready instantly.</p>
        <p className="m-0 mb-3 text-blue-300 leading-relaxed text-sm">
          First time here? Add your marketplace tag in <Link className="text-amber-400 no-underline font-semibold hover:text-amber-300" to="/portal/tracking">Tags</Link>.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3">
          <input
            className="rounded-xl border border-white/10 bg-gray-800 text-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="ASIN or Amazon product link"
            value={asin}
            onChange={(e) => setAsin(e.target.value)}
            maxLength={1000}
            required
          />
          <select className="rounded-xl border border-white/10 bg-gray-800 text-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-auto" value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
            {["US", "CA", "UK", "DE", "IT", "FR", "ES"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <input
            className="rounded-xl border border-white/10 bg-gray-800 text-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Custom title (optional)"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
          />
          <button className="border-none rounded-xl bg-amber-500 text-gray-900 font-bold px-4 py-3.5 cursor-pointer hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit ASIN"}
          </button>
        </form>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm">
            <p className="m-0 text-red-200">{error}</p>
            {lastPayload ? (
              <button
                className="mt-3 border-none rounded-lg bg-red-400/20 px-4 py-2 text-sm font-semibold text-red-100 cursor-pointer hover:bg-red-400/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
                onClick={() => void handleRetrySubmit()}
                disabled={submitting}
              >
                {submitting ? "Retrying..." : "Retry"}
              </button>
            ) : null}
          </div>
        ) : null}
        {success ? (
          <div className="mt-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4">
            <p className="m-0 mb-2 text-emerald-100 font-bold">{success.message}</p>
            <p className="m-0 mb-2 text-slate-300 leading-relaxed text-sm">
              {success.product.asin} · {success.product.marketplace}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <input className="flex-1 rounded-xl border border-white/10 bg-gray-800 text-gray-50 px-4 py-3 focus:outline-none text-sm" readOnly value={success.link} />
              <button
                className="border-none rounded-xl bg-amber-500 text-gray-900 font-bold px-6 py-3 cursor-pointer hover:bg-amber-400 transition-colors whitespace-nowrap"
                type="button"
                onClick={() => void handleCopy()}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}
      </article>

      <article className="bg-[#111827] border border-white/10 rounded-2xl p-6">
        <h2 className="m-0 mb-3 text-gray-50 text-xl font-bold">My Products</h2>
        {loading ? <p className="m-0 mb-2 text-slate-300 leading-relaxed text-sm">Loading...</p> : null}
        {!loading && error && products.length === 0 ? (
          <button
            className="mb-3 border-none rounded-xl bg-[#0f766e] text-[#f8fafc] font-semibold px-4 py-3 cursor-pointer hover:bg-[#115e59] transition-colors"
            type="button"
            onClick={() => {
              setLoading(true);
              setError("");
              loadProducts()
                .catch((err) =>
                  setError(err instanceof Error ? err.message : "Failed to load products")
                )
                .finally(() => setLoading(false));
            }}
          >
            Retry loading products
          </button>
        ) : null}
        {!loading && products.length === 0 ? <p className="m-0 mb-2 text-slate-300 leading-relaxed text-sm">No products submitted yet.</p> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
          {products.map((product) => (
            <div key={product.id} className="grid grid-cols-[72px_1fr] sm:grid-cols-[80px_1fr] gap-3 items-center border border-white/10 rounded-xl p-3 bg-white/[0.02]">
              <img src={product.image_url} alt={product.title} className="w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] object-contain bg-white rounded-lg p-1" />
              <div className="min-w-0">
                <p className="m-0 mb-1.5 text-gray-50 font-semibold leading-tight truncate">{product.custom_title || product.title}</p>
                <p className="m-0 mb-1.5 text-slate-300 leading-relaxed text-xs">
                  {product.asin} · {product.marketplace} · {product.tracking_tag}
                </p>
                <p
                  className={`m-0 text-xs font-bold capitalize ${
                    product.status === "active"
                      ? "text-emerald-400"
                      : product.status === "rejected"
                        ? "text-red-400"
                        : "text-amber-400"
                  }`}
                >
                  Status: {product.status.replace("_", " ")}
                </p>
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    className="w-full sm:w-auto rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-gray-900 transition-colors hover:bg-amber-400"
                    onClick={() => void handleProductCopy(product)}
                  >
                    {copiedProductKey === String(product.id) ? "Copied" : "Copy Link"}
                  </button>
                  <a
                    href={product.bridge_page_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto rounded-lg border border-white/15 px-3 py-2 text-center text-sm font-semibold text-slate-200 no-underline transition-colors hover:bg-white/5"
                  >
                    Open
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

// Styles migrated to Tailwind CSS
