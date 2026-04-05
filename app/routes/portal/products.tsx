import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/products";
import { extractApiErrorMessage } from "../../utils/api-errors";
import { getAuthToken } from "../../utils/auth-session";
import { copyTextToClipboard } from "../../utils/clipboard";
import { getPortalProductLinkTargets } from "../../utils/portal-product-links";

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

interface ImportCapabilities {
  newAsinImportEnabled: boolean;
  batchAsinImportEnabled: boolean;
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
  const [copiedKey, setCopiedKey] = useState("");
  const [copiedProductKey, setCopiedProductKey] = useState("");
  const [lastPayload, setLastPayload] = useState<ProductSubmissionPayload | null>(null);
  const [importCapabilities, setImportCapabilities] = useState<ImportCapabilities>({
    newAsinImportEnabled: true,
    batchAsinImportEnabled: false,
  });
  const [canSubmit, setCanSubmit] = useState(true);

  const loadProducts = async () => {
    const token = getAuthToken();
    const response = await fetch("/api/portal/products", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error("Failed to load products");
    }

    const data = (await response.json()) as {
      products: PortalProduct[];
      importCapabilities?: ImportCapabilities;
      canSubmit?: boolean;
    };
    setProducts(data.products);
    if (data.importCapabilities) {
      setImportCapabilities(data.importCapabilities);
    }
    setCanSubmit(data.canSubmit ?? true);
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
    setCopiedKey("");
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

  const handleCopy = async (copyKey: string, text: string) => {
    const copyOk = await copyTextToClipboard(text);
    if (!copyOk) {
      setError("Could not copy the full link. Please try again.");
      return;
    }

    setCopiedKey(copyKey);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === copyKey ? "" : current));
    }, 2000);
  };

  return (
    <section className="flex flex-col lg:grid lg:grid-cols-[minmax(320px,420px)_1fr] gap-4">
      <article className="bg-[#111827] border border-white/10 rounded-2xl p-6">
        <h1 className="m-0 mb-3 text-gray-50 text-xl font-bold">{canSubmit ? "Submit ASIN" : "Products Overview"}</h1>
        <p className="m-0 mb-2 text-slate-300 leading-relaxed text-sm">
          {canSubmit
            ? "Paste an ASIN or full Amazon product link. If live product data is fetched successfully, your tracked link will be ready instantly."
            : "Admin accounts can review portal products here. ASIN submission stays restricted to linked agent accounts."}
        </p>
        {canSubmit ? (
          <p className="m-0 mb-3 text-blue-300 leading-relaxed text-sm">
            First time here? Add your marketplace tag in <Link className="text-amber-400 no-underline font-semibold hover:text-amber-300" to="/portal/tracking">Tags</Link>.
          </p>
        ) : null}
        {canSubmit && !importCapabilities.newAsinImportEnabled ? (
          <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            New ASIN import is temporarily paused. Only ASINs already saved in the system can be submitted right now.
          </div>
        ) : null}

        {canSubmit ? (
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
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
            Submission controls are hidden in admin view to avoid assigning products without a linked agent context.
          </div>
        )}

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
            <div className="mt-4 grid gap-3">
              {getPortalProductLinkTargets({
                storefrontUrl: success.link,
                redirectUrl: success.redirectLink,
              }).map((target) => (
                <div
                  key={target.key}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {target.label}
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      className="flex-1 rounded-xl border border-white/10 bg-gray-800 text-gray-50 px-4 py-3 focus:outline-none text-sm"
                      readOnly
                      value={target.url}
                    />
                    <div className="flex gap-2 sm:flex-col">
                      <button
                        className="border-none rounded-xl bg-amber-500 text-gray-900 font-bold px-4 py-3 cursor-pointer hover:bg-amber-400 transition-colors whitespace-nowrap"
                        type="button"
                        onClick={() => void handleCopy(`success-${target.key}`, target.url)}
                      >
                        {copiedKey === `success-${target.key}` ? "Copied" : target.actionLabel}
                      </button>
                      <a
                        href={target.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-slate-200 no-underline transition-colors hover:bg-white/5 whitespace-nowrap"
                      >
                        {target.openLabel}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
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
                  {product.asin} · {product.marketplace}
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
                <div className="mt-3 grid gap-2">
                  {getPortalProductLinkTargets({
                    storefrontUrl: product.bridge_page_url,
                    redirectUrl: product.redirect_url,
                  }).map((target) => (
                    <div
                      key={`${product.id}-${target.key}`}
                      className="rounded-lg border border-white/10 bg-black/10 p-2.5"
                    >
                      <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {target.label}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          className="w-full sm:w-auto rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-gray-900 transition-colors hover:bg-amber-400"
                          onClick={() =>
                            void handleCopy(`${product.id}-${target.key}`, target.url)
                          }
                        >
                          {copiedKey === `${product.id}-${target.key}`
                            ? "Copied"
                            : target.actionLabel}
                        </button>
                        <a
                          href={target.url}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full sm:w-auto rounded-lg border border-white/15 px-3 py-2 text-center text-sm font-semibold text-slate-200 no-underline transition-colors hover:bg-white/5"
                        >
                          {target.openLabel}
                        </a>
                      </div>
                    </div>
                  ))}
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
