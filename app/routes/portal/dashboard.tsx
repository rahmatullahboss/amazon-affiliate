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
    return <p className="m-0 mb-2 text-[#cbd5e1] leading-relaxed">Loading dashboard...</p>;
  }

  if (error) {
    return (
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <article className="bg-[#111827] border border-white/10 rounded-2xl p-6">
          <h2 className="m-0 mb-3 text-[#f9fafb] text-xl font-bold">Portal Dashboard</h2>
          <p className="m-0 mb-2 text-[#cbd5e1] leading-relaxed">{error}</p>
          <button onClick={() => void loadDashboard()} className="px-4 py-3 bg-[#0f766e] rounded-xl text-[#f8fafc] font-semibold cursor-pointer border-none mt-2">
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
  ];

  return (
    <section className="grid gap-4">
      <div className="grid grid-cols-1 gap-4">
        <article className="bg-[#111827] border border-white/10 rounded-2xl p-6">
          <h2 className="m-0 mb-3 text-[#f9fafb] text-xl font-bold">Signed In As</h2>
          <p className="m-0 mb-2 text-[#cbd5e1]">Username: {profile?.user?.username ?? "Unknown"}</p>
          <p className="m-0 mb-2 text-[#cbd5e1]">Role: {profile?.user?.role ?? "Unknown"}</p>
          <p className="m-0 mb-2 text-[#cbd5e1]">Agent: {profile?.user?.agent_name ?? "Not linked yet"}</p>
          <p className="m-0 mb-2 text-[#cbd5e1]">Slug: {profile?.user?.agent_slug ?? "-"}</p>
        </article>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="bg-[#111827] border border-white/10 rounded-2xl p-6 text-center xl:text-left">
            <div className="text-[#94a3b8] text-sm mb-2">
              {metric.label}
            </div>
            <div className="text-2xl font-bold" style={{ color: metric.color }}>
              {typeof metric.value === "number" ? metric.value.toLocaleString() : metric.value}
            </div>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <article className="bg-[#111827] border border-white/10 rounded-2xl p-6 overflow-x-auto">
          <h2 className="m-0 mb-3 text-[#f9fafb] text-xl font-bold">Top Products</h2>
          {performance?.topProducts.length ? (
            performance.topProducts.map((product) => (
              <div key={product.asin} className="flex justify-between gap-4 py-3 border-b border-white/5">
                <div>
                  <div className="text-[#f8fafc] text-sm font-semibold mb-1">{product.title}</div>
                  <div className="text-[#94a3b8] text-xs">{product.asin}</div>
                </div>
                <div className="text-[#f59e0b] font-bold self-center">{product.clicks}</div>
              </div>
            ))
          ) : (
            <p className="m-0 mb-2 text-[#cbd5e1]">No tracked clicks yet.</p>
          )}
        </article>

        <article className="bg-[#111827] border border-white/10 rounded-2xl p-6 overflow-x-auto">
          <h2 className="m-0 mb-3 text-[#f9fafb] text-xl font-bold">Recent Clicks</h2>
          {performance?.recentClicks.length ? (
            performance.recentClicks.map((click) => (
              <div key={`${click.tracking_tag}-${click.clicked_at}`} className="flex justify-between gap-4 py-3 border-b border-white/5">
                <div>
                  <div className="text-[#f8fafc] text-sm font-semibold mb-1">{click.tracking_tag}</div>
                  <div className="text-[#94a3b8] text-xs">
                    {click.country || "Unknown country"} · {new Date(click.clicked_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="m-0 mb-2 text-[#cbd5e1]">No recent clicks yet.</p>
          )}
        </article>
      </div>
    </section>
  );
}
