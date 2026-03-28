import { useEffect, useState } from "react";

interface PortalLink {
  agentSlug: string;
  agentName: string;
  asin: string;
  marketplace: string;
  title: string;
  imageUrl: string;
  trackingTag: string;
  bridgePageUrl: string;
  redirectUrl: string;
}

export default function PortalLinksPage() {
  const [links, setLinks] = useState<PortalLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch("/api/portal/links", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load links");
        return response.json() as Promise<{ links: PortalLink[] }>;
      })
      .then((data) => setLinks(data.links))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load links"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section style={styles.card}>
      <h1 style={styles.title}>My Links</h1>
      <p style={styles.copy}>Copy your unique bridge links and share them with buyers.</p>

      {loading ? <p style={styles.copy}>Loading...</p> : null}
      {error ? <p style={styles.error}>{error}</p> : null}
      {!loading && !error && links.length === 0 ? <p style={styles.copy}>No links available yet.</p> : null}

      <div style={styles.list}>
        {links.map((link) => (
          <div key={`${link.agentSlug}-${link.asin}`} style={styles.item}>
            <img src={link.imageUrl} alt={link.title} style={styles.image} />
            <div style={styles.content}>
              <p style={styles.itemTitle}>{link.title}</p>
              <p style={styles.copy}>{link.asin} · {link.marketplace} · {link.trackingTag}</p>
              <div style={styles.actions}>
                <input style={styles.input} value={link.bridgePageUrl} readOnly />
                <button
                  style={styles.button}
                  onClick={() => navigator.clipboard.writeText(link.bridgePageUrl).catch(console.error)}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "1rem",
    padding: "1.5rem",
  },
  title: { margin: "0 0 0.75rem", color: "#f9fafb", fontSize: "1.25rem", fontWeight: 700 },
  copy: { margin: "0 0 0.5rem", color: "#cbd5e1", lineHeight: 1.6 },
  error: {
    color: "#fecaca",
    margin: "0.75rem 0",
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: "0.75rem",
    padding: "0.85rem 1rem",
  },
  list: { display: "grid", gap: "0.85rem", marginTop: "1rem" },
  item: {
    display: "grid",
    gridTemplateColumns: "88px 1fr",
    gap: "1rem",
    alignItems: "center",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "0.85rem",
    padding: "0.85rem",
  },
  image: { width: "88px", height: "88px", objectFit: "contain", background: "#fff", borderRadius: "0.75rem" },
  content: { display: "grid", gap: "0.5rem" },
  itemTitle: { margin: 0, color: "#f9fafb", fontWeight: 600, lineHeight: 1.5 },
  actions: { display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem" },
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
};
