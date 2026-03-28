import { useEffect, useState } from "react";
import { Link } from "react-router";

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

export default function PortalProductsPage() {
  const [products, setProducts] = useState<PortalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asin, setAsin] = useState("");
  const [marketplace, setMarketplace] = useState("US");
  const [customTitle, setCustomTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SubmissionResponse | null>(null);

  const loadProducts = async () => {
    const token = localStorage.getItem("auth_token");
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(null);

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/portal/products/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          asin: asin.toUpperCase(),
          marketplace,
          custom_title: customTitle || null,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Submission failed");
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

  return (
    <section style={styles.wrap}>
      <article style={styles.card}>
        <h1 style={styles.title}>Submit ASIN</h1>
        <p style={styles.copy}>Paste an ASIN or full Amazon product link. If live product data is fetched successfully, your tracked link will be ready instantly.</p>
        <p style={styles.helper}>
          First time here? Add your marketplace tracking ID in <Link style={styles.link} to="/portal/tracking">Tracking IDs</Link>.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            placeholder="ASIN or Amazon product link"
            value={asin}
            onChange={(e) => setAsin(e.target.value)}
            maxLength={1000}
            required
          />
          <select style={styles.input} value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
            {["US", "CA", "UK", "DE", "IT", "FR", "ES"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <input
            style={styles.input}
            placeholder="Custom title (optional)"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
          />
          <button style={styles.button} type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit ASIN"}
          </button>
        </form>

        {error ? <p style={styles.error}>{error}</p> : null}
        {success ? (
          <div style={styles.success}>
            <p style={styles.successTitle}>{success.message}</p>
            <p style={styles.copy}>
              {success.product.asin} · {success.product.marketplace}
            </p>
            <div style={styles.linkRow}>
              <input style={styles.input} readOnly value={success.link} />
              <button
                style={styles.button}
                type="button"
                onClick={() => navigator.clipboard.writeText(success.link).catch(console.error)}
              >
                Copy
              </button>
            </div>
          </div>
        ) : null}
      </article>

      <article style={styles.card}>
        <h2 style={styles.title}>My Products</h2>
        {loading ? <p style={styles.copy}>Loading...</p> : null}
        {!loading && products.length === 0 ? <p style={styles.copy}>No products submitted yet.</p> : null}

        <div style={styles.list}>
          {products.map((product) => (
            <div key={product.id} style={styles.item}>
              <img src={product.image_url} alt={product.title} style={styles.image} />
              <div>
                <p style={styles.itemTitle}>{product.custom_title || product.title}</p>
                <p style={styles.copy}>
                  {product.asin} · {product.marketplace} · {product.tracking_tag}
                </p>
                <p
                  style={{
                    ...styles.copy,
                    color:
                      product.status === "active"
                        ? "#4ade80"
                        : product.status === "rejected"
                          ? "#f87171"
                          : "#fbbf24",
                    marginBottom: 0,
                  }}
                >
                  Status: {product.status.replace("_", " ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: "1rem" },
  card: {
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "1rem",
    padding: "1.5rem",
  },
  title: { margin: "0 0 0.75rem", color: "#f9fafb", fontSize: "1.25rem", fontWeight: 700 },
  copy: { margin: "0 0 0.5rem", color: "#cbd5e1", lineHeight: 1.6 },
  helper: { margin: "0 0 0.75rem", color: "#93c5fd", lineHeight: 1.6 },
  link: { color: "#fbbf24", textDecoration: "none", fontWeight: 600 },
  form: { display: "grid", gap: "0.75rem" },
  input: {
    borderRadius: "0.75rem",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#1f2937",
    color: "#f9fafb",
    padding: "0.85rem 1rem",
  },
  button: {
    border: "none",
    borderRadius: "0.75rem",
    background: "#f59e0b",
    color: "#111827",
    fontWeight: 700,
    padding: "0.9rem 1rem",
    cursor: "pointer",
  },
  error: {
    color: "#fecaca",
    margin: "0.75rem 0 0",
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: "0.75rem",
    padding: "0.85rem 1rem",
  },
  success: {
    marginTop: "0.85rem",
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(16,185,129,0.25)",
    borderRadius: "0.85rem",
    padding: "1rem",
  },
  successTitle: {
    margin: "0 0 0.5rem",
    color: "#d1fae5",
    fontWeight: 700,
  },
  list: { display: "grid", gap: "0.75rem" },
  linkRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem", marginTop: "0.75rem" },
  item: {
    display: "grid",
    gridTemplateColumns: "72px 1fr",
    gap: "0.85rem",
    alignItems: "center",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "0.85rem",
    padding: "0.75rem",
  },
  image: { width: "72px", height: "72px", objectFit: "contain", background: "#fff", borderRadius: "0.75rem" },
  itemTitle: { margin: "0 0 0.4rem", color: "#f9fafb", fontWeight: 600, lineHeight: 1.5 },
};
