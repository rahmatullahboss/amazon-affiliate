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
    return <div className="text-[#a0a0b8] p-8">Loading dashboard...</div>;
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
      <h1 className="text-2xl font-bold text-[#f0f0f5] mb-8">
        Dashboard
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{stat.icon}</span>
              <span className="text-sm text-[#6b6b85] font-medium">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: stat.color }}>
              {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 overflow-x-auto">
          <h2 className="text-base font-semibold text-[#f0f0f5] mb-4">Top Agents</h2>
          {(data?.topAgents ?? []).length === 0 ? (
            <p className="text-[#6b6b85] text-sm">No click data yet</p>
          ) : (
            data?.topAgents.map((agent, i) => (
              <div key={agent.slug} className={`flex justify-between items-center py-2.5 ${i < (data?.topAgents.length ?? 0) - 1 ? "border-b border-white/5" : ""}`}>
                <span className="text-[#a0a0b8] text-sm">{agent.name}</span>
                <span className="text-[#ff9900] font-semibold text-sm">{agent.clicks}</span>
              </div>
            ))
          )}
        </div>
        <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 overflow-x-auto">
          <h2 className="text-base font-semibold text-[#f0f0f5] mb-4">Top Products</h2>
          {(data?.topProducts ?? []).length === 0 ? (
            <p className="text-[#6b6b85] text-sm">No click data yet</p>
          ) : (
            data?.topProducts.map((product, i) => (
              <div key={product.asin} className={`flex justify-between items-center py-2.5 ${i < (data?.topProducts.length ?? 0) - 1 ? "border-b border-white/5" : ""}`}>
                <span className="text-[#a0a0b8] text-sm max-w-[200px] sm:max-w-xs truncate">{product.title}</span>
                <span className="text-[#6366f1] font-semibold text-sm">{product.clicks}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
