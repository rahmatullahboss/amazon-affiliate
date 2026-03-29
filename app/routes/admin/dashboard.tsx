import { useState, useEffect } from "react";
import { getAuthToken } from "../../utils/auth-session";

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
  topAgentsByCommission: Array<{
    name: string;
    slug: string;
    orderedItems: number;
    revenueAmount: number;
    commissionAmount: number;
  }>;
  recentReports: Array<{
    id: number;
    marketplace: string;
    sourceFileName: string;
    importedAt: string;
    importedByUsername: string | null;
    conversionsCount: number;
  }>;
}

export default function Dashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const token = getAuthToken();
      const res = await fetch("/api/analytics/overview", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to load dashboard analytics");
      }

      setData(await res.json());
    } catch (requestError) {
      console.error("Failed to fetch dashboard data:", requestError);
      setError(requestError instanceof Error ? requestError.message : "Failed to load dashboard analytics");
    } finally { setLoading(false); }
  };

  if (loading) {
    return <div className="text-[#a0a0b8] p-8">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
        <h1 className="m-0 mb-3 text-2xl font-bold text-[#f0f0f5]">Dashboard</h1>
        <p className="m-0 text-sm text-red-200">{error}</p>
        <button
          onClick={() => void fetchData()}
          className="mt-4 px-4 py-2 rounded-lg border-none bg-red-400/20 text-red-50 font-semibold cursor-pointer hover:bg-red-400/30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
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
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#f0f0f5] m-0">
            Dashboard
          </h1>
          <p className="mt-2 mb-0 text-sm text-[#8b8ba7]">
            Admin can monitor traffic performance here. Order, revenue, and commission values come from imported Amazon reports.
          </p>
        </div>
        <button
          onClick={() => void fetchData()}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-[#d4d4e4] font-semibold text-sm cursor-pointer hover:bg-white/10 transition-colors"
        >
          Refresh Dashboard
        </button>
      </div>

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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
        <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 overflow-x-auto">
          <h2 className="text-base font-semibold text-[#f0f0f5] mb-4">Top Agents by Sales</h2>
          {(data?.topAgentsByCommission ?? []).length === 0 ? (
            <p className="text-[#6b6b85] text-sm">No imported Amazon order data yet</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data?.topAgentsByCommission.map((agent) => (
                <div key={agent.slug} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#f0f0f5]">{agent.name}</div>
                      <div className="mt-1 text-xs text-[#8b8ba7]">/{agent.slug}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[#14b8a6]">{agent.orderedItems} orders</div>
                      <div className="mt-1 text-xs text-[#8b8ba7]">
                        ${agent.revenueAmount.toFixed(2)} revenue · ${agent.commissionAmount.toFixed(2)} commission
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 overflow-x-auto">
          <h2 className="text-base font-semibold text-[#f0f0f5] mb-4">Recent Imported Reports</h2>
          {(data?.recentReports ?? []).length === 0 ? (
            <p className="text-[#6b6b85] text-sm">No Amazon reports imported yet</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data?.recentReports.map((report) => (
                <div key={report.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#f0f0f5] truncate">{report.sourceFileName}</div>
                      <div className="mt-1 text-xs text-[#8b8ba7]">
                        {report.marketplace} · {report.importedByUsername || "Unknown user"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[#ff9900]">{report.conversionsCount} rows</div>
                      <div className="mt-1 text-xs text-[#8b8ba7]">
                        {new Date(report.importedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
