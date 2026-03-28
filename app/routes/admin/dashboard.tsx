import { useState, useEffect } from "react";

interface OverviewData {
  totalClicks: number;
  totalViews: number;
  clicksToday: number;
  viewsToday: number;
  clicksThisWeek: number;
  viewsThisWeek: number;
  totalOrderedItems: number;
  totalRevenue: number;
  totalCommission: number;
  topAgents: Array<{ name: string; slug: string; clicks: number }>;
  topProducts: Array<{ asin: string; title: string; clicks: number }>;
}

export default function Dashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/analytics/overview", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch (err) { console.error("Failed to fetch dashboard data:", err); }
    finally { setLoading(false); }
  };

  if (loading) {
    return <div style={{ color: "#a0a0b8", padding: "2rem" }}>Loading dashboard...</div>;
  }

  const stats = [
    { label: "Total Clicks", value: data?.totalClicks ?? 0, icon: "🖱️", color: "#ff9900" },
    { label: "Total Views", value: data?.totalViews ?? 0, icon: "👁️", color: "#6366f1" },
    { label: "Clicks Today", value: data?.clicksToday ?? 0, icon: "📊", color: "#22c55e" },
    { label: "Views Today", value: data?.viewsToday ?? 0, icon: "📈", color: "#3b82f6" },
    { label: "Clicks This Week", value: data?.clicksThisWeek ?? 0, icon: "🔥", color: "#f59e0b" },
    { label: "Views This Week", value: data?.viewsThisWeek ?? 0, icon: "📅", color: "#8b5cf6" },
    { label: "Ordered Items", value: data?.totalOrderedItems ?? 0, icon: "📦", color: "#14b8a6" },
    { label: "Revenue", value: `$${(data?.totalRevenue ?? 0).toFixed(2)}`, icon: "💰", color: "#38bdf8" },
    { label: "Commission", value: `$${(data?.totalCommission ?? 0).toFixed(2)}`, icon: "🪙", color: "#a855f7" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f0f0f5", marginBottom: "2rem" }}>
        Dashboard
      </h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2.5rem" }}>
        {stats.map((stat) => (
          <div key={stat.label} style={{ background: "rgba(26, 26, 40, 0.9)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "1rem", padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.25rem" }}>{stat.icon}</span>
              <span style={{ fontSize: "0.8rem", color: "#6b6b85", fontWeight: 500 }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: stat.color }}>
              {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <div style={{ background: "rgba(26, 26, 40, 0.9)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "1rem", padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#f0f0f5", marginBottom: "1rem" }}>Top Agents</h2>
          {(data?.topAgents ?? []).length === 0 ? (
            <p style={{ color: "#6b6b85", fontSize: "0.875rem" }}>No click data yet</p>
          ) : (
            data?.topAgents.map((agent, i) => (
              <div key={agent.slug} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 0", borderBottom: i < (data?.topAgents.length ?? 0) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <span style={{ color: "#a0a0b8", fontSize: "0.875rem" }}>{agent.name}</span>
                <span style={{ color: "#ff9900", fontWeight: 600, fontSize: "0.875rem" }}>{agent.clicks}</span>
              </div>
            ))
          )}
        </div>
        <div style={{ background: "rgba(26, 26, 40, 0.9)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "1rem", padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#f0f0f5", marginBottom: "1rem" }}>Top Products</h2>
          {(data?.topProducts ?? []).length === 0 ? (
            <p style={{ color: "#6b6b85", fontSize: "0.875rem" }}>No click data yet</p>
          ) : (
            data?.topProducts.map((product, i) => (
              <div key={product.asin} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 0", borderBottom: i < (data?.topProducts.length ?? 0) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <span style={{ color: "#a0a0b8", fontSize: "0.875rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.title}</span>
                <span style={{ color: "#6366f1", fontWeight: 600, fontSize: "0.875rem" }}>{product.clicks}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
