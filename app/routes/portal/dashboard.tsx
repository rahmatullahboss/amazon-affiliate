import { useEffect, useState } from "react";

interface PortalMeResponse {
  user: {
    id: number;
    username: string;
    email: string | null;
    role: string;
    agent_id: number | null;
    agent_name: string | null;
    agent_slug: string | null;
  } | null;
}

interface PortalPerformanceResponse {
  totalClicks: number;
  totalViews: number;
  ctr: string;
  orderedItems: number;
  revenueAmount: number;
  commissionAmount: number;
  topProducts: Array<{ asin: string; title: string; clicks: number }>;
  recentClicks: Array<{ tracking_tag: string; country: string | null; clicked_at: string }>;
}

export default function PortalDashboardPage() {
  const [profile, setProfile] = useState<PortalMeResponse | null>(null);
  const [performance, setPerformance] = useState<PortalPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setError("Authentication required.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [profileResponse, performanceResponse] = await Promise.all([
        fetch("/api/portal/me", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/portal/performance", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!profileResponse.ok || !performanceResponse.ok) {
        throw new Error("Failed to load portal dashboard.");
      }

      setProfile((await profileResponse.json()) as PortalMeResponse);
      setPerformance((await performanceResponse.json()) as PortalPerformanceResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to load portal dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p style={styles.copy}>Loading dashboard...</p>;
  }

  if (error) {
    return (
      <section style={styles.grid}>
        <article style={styles.card}>
          <h2 style={styles.heading}>Portal Dashboard</h2>
          <p style={styles.copy}>{error}</p>
          <button onClick={() => void loadDashboard()} style={styles.retryButton}>
            Retry
          </button>
        </article>
      </section>
    );
  }

  const metrics = [
    { label: "Total Views", value: performance?.totalViews ?? 0, color: "#38bdf8" },
    { label: "Total Clicks", value: performance?.totalClicks ?? 0, color: "#f59e0b" },
    { label: "CTR", value: `${performance?.ctr ?? "0.00"}%`, color: "#34d399" },
    { label: "Ordered Items", value: performance?.orderedItems ?? 0, color: "#a78bfa" },
    {
      label: "Revenue",
      value: `$${(performance?.revenueAmount ?? 0).toFixed(2)}`,
      color: "#22c55e",
    },
    {
      label: "Commission",
      value: `$${(performance?.commissionAmount ?? 0).toFixed(2)}`,
      color: "#f472b6",
    },
  ];

  return (
    <section style={styles.stack}>
      <div style={styles.grid}>
        <article style={styles.card}>
          <h2 style={styles.heading}>Portal Overview</h2>
          <p style={styles.copy}>
            Submit ASINs, copy your tracked links, and monitor traffic and imported
            sales performance from one place.
          </p>
        </article>

        <article style={styles.card}>
          <h2 style={styles.heading}>Signed In As</h2>
          <p style={styles.copy}>Username: {profile?.user?.username ?? "Unknown"}</p>
          <p style={styles.copy}>Role: {profile?.user?.role ?? "Unknown"}</p>
          <p style={styles.copy}>Agent: {profile?.user?.agent_name ?? "Not linked yet"}</p>
          <p style={styles.copy}>Slug: {profile?.user?.agent_slug ?? "-"}</p>
        </article>
      </div>

      <div style={styles.metricsGrid}>
        {metrics.map((metric) => (
          <article key={metric.label} style={styles.card}>
            <div style={{ color: "#94a3b8", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
              {metric.label}
            </div>
            <div style={{ color: metric.color, fontSize: "1.75rem", fontWeight: 700 }}>
              {typeof metric.value === "number" ? metric.value.toLocaleString() : metric.value}
            </div>
          </article>
        ))}
      </div>

      <div style={styles.grid}>
        <article style={styles.card}>
          <h2 style={styles.heading}>Top Products</h2>
          {performance?.topProducts.length ? (
            performance.topProducts.map((product) => (
              <div key={product.asin} style={styles.listRow}>
                <div>
                  <div style={styles.rowPrimary}>{product.title}</div>
                  <div style={styles.rowSecondary}>{product.asin}</div>
                </div>
                <div style={styles.rowValue}>{product.clicks}</div>
              </div>
            ))
          ) : (
            <p style={styles.copy}>No tracked clicks yet.</p>
          )}
        </article>

        <article style={styles.card}>
          <h2 style={styles.heading}>Recent Clicks</h2>
          {performance?.recentClicks.length ? (
            performance.recentClicks.map((click) => (
              <div key={`${click.tracking_tag}-${click.clicked_at}`} style={styles.listRow}>
                <div>
                  <div style={styles.rowPrimary}>{click.tracking_tag}</div>
                  <div style={styles.rowSecondary}>
                    {click.country || "Unknown country"} · {new Date(click.clicked_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p style={styles.copy}>No recent clicks yet.</p>
          )}
        </article>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  stack: { display: "grid", gap: "1rem" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "1rem",
  },
  card: {
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "1rem",
    padding: "1.5rem",
  },
  heading: { margin: "0 0 0.75rem", color: "#f9fafb", fontSize: "1.25rem", fontWeight: 700 },
  copy: { margin: "0 0 0.5rem", color: "#cbd5e1", lineHeight: 1.6 },
  retryButton: {
    padding: "0.75rem 1rem",
    background: "#0f766e",
    border: "none",
    borderRadius: "0.75rem",
    color: "#f8fafc",
    cursor: "pointer",
    fontWeight: 600,
  },
  listRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "0.75rem 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  rowPrimary: { color: "#f8fafc", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.25rem" },
  rowSecondary: { color: "#94a3b8", fontSize: "0.78rem" },
  rowValue: { color: "#f59e0b", fontWeight: 700, alignSelf: "center" },
};
