import { useEffect, useState } from "react";
import type { Route } from "./+types/dashboard";
import { getAuthToken } from "../../utils/auth-session";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "RKY Tag House" },
    { name: "application-name", content: "RKY Tag House" },
    { name: "apple-mobile-web-app-title", content: "RKY Tag House" },
  ];
}

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
  returnedItems: number;
  revenueAmount: number;
  commissionAmount: number;
  topProducts: Array<{ asin: string; title: string; clicks: number }>;
  recentClicks: Array<{ tracking_tag: string; country: string | null; clicked_at: string }>;
  marketplaceOrderBreakdown: Array<{
    marketplace: string;
    clicks: number;
    ordered_items: number;
    returned_items: number;
  }>;
  tagOrderBreakdown: Array<{
    tag: string;
    marketplace: string;
    clicks: number;
    ordered_items: number;
    returned_items: number;
  }>;
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
    const token = getAuthToken();
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
    {
      label: "Total Views",
      value: performance?.totalViews ?? 0,
      color: "#38bdf8",
      accent: "Traffic reaching your pages",
    },
    {
      label: "Total Clicks",
      value: performance?.totalClicks ?? 0,
      color: "#f59e0b",
      accent: "Buy button clicks sent to Amazon",
    },
    {
      label: "CTR",
      value: `${performance?.ctr ?? "0.00"}%`,
      color: "#34d399",
      accent: "Clicks divided by views",
    },
    {
      label: "Ordered Items",
      value: performance?.orderedItems ?? 0,
      color: "#a78bfa",
      accent: "Imported from Amazon reports",
    },
    {
      label: "Returned Items",
      value: performance?.returnedItems ?? 0,
      color: "#f87171",
      accent: "Returned or not shipped items",
    },
  ];

  const topProductClickMax = Math.max(
    1,
    ...(performance?.topProducts.map((product) => product.clicks) ?? [0])
  );

  return (
    <section className="grid gap-4">
      <article className="bg-[#111827] border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.18em] text-[#60a5fa]">Agent Performance</p>
            <h1 className="m-0 mt-2 text-[#f9fafb] text-2xl font-bold">
              {profile?.user?.agent_name ?? "Agent Dashboard"}
            </h1>
            <p className="m-0 mt-2 text-sm text-[#94a3b8] leading-relaxed">
              Track your views, clicks, orders, and recent activity from one place.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="text-[0.7rem] uppercase tracking-wide text-[#8b8ba7]">Username</div>
              <div className="mt-1 text-sm font-semibold text-[#f9fafb] break-all">
                {profile?.user?.username ?? "Unknown"}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="text-[0.7rem] uppercase tracking-wide text-[#8b8ba7]">Agent Slug</div>
              <div className="mt-1 text-sm font-semibold text-[#f9fafb] break-all">
                {profile?.user?.agent_slug ?? "-"}
              </div>
            </div>
          </div>
        </div>
      </article>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {metrics.map((metric) => (
          <article key={metric.label} className="bg-[#111827] border border-white/10 rounded-2xl p-5 text-left">
            <div className="text-[#94a3b8] text-sm mb-2">{metric.label}</div>
            <div className="text-2xl font-bold" style={{ color: metric.color }}>
              {typeof metric.value === "number" ? metric.value.toLocaleString() : metric.value}
            </div>
            <div className="mt-2 text-xs leading-relaxed text-[#6b7280]">{metric.accent}</div>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <article className="bg-[#111827] border border-white/10 rounded-2xl p-6 overflow-x-auto">
          <h2 className="m-0 mb-3 text-[#f9fafb] text-xl font-bold">Orders by Country</h2>
          {performance?.marketplaceOrderBreakdown.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {performance.marketplaceOrderBreakdown.map((row) => (
                <div
                  key={row.marketplace}
                  className="rounded-xl border border-white/5 bg-white/[0.03] p-4"
                >
                  <div className="text-xs uppercase tracking-wide text-[#8b8ba7]">
                    {row.marketplace}
                  </div>
                  <div className="mt-2 text-2xl font-bold text-[#a78bfa]">
                    {row.ordered_items}
                  </div>
                  <div className="mt-2 text-xs text-[#94a3b8]">
                    {row.clicks} clicks · {row.returned_items} returned items
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 mb-2 text-[#cbd5e1]">No imported country-wise order data yet.</p>
          )}
        </article>

        <article className="bg-[#111827] border border-white/10 rounded-2xl p-6 overflow-x-auto">
          <h2 className="m-0 mb-3 text-[#f9fafb] text-xl font-bold">Orders by Tag</h2>
          {performance?.tagOrderBreakdown.length ? (
            <div className="flex flex-col gap-3">
              {performance.tagOrderBreakdown.map((row) => (
                <div
                  key={`${row.marketplace}-${row.tag}`}
                  className="rounded-xl border border-white/5 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#f8fafc] break-all">
                        {row.tag}
                      </div>
                      <div className="mt-1 text-xs text-[#8b8ba7]">{row.marketplace}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-[#34d399]">
                        {row.ordered_items}
                      </div>
                      <div className="text-[0.7rem] uppercase tracking-wide text-[#8b8ba7]">
                        Orders
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-[#94a3b8]">
                    {row.clicks} clicks · {row.returned_items} returned items
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 mb-2 text-[#cbd5e1]">No imported tag-wise order data yet.</p>
          )}
        </article>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <article className="bg-[#111827] border border-white/10 rounded-2xl p-6 overflow-x-auto">
          <h2 className="m-0 mb-3 text-[#f9fafb] text-xl font-bold">Top Products</h2>
          {performance?.topProducts.length ? (
            <div className="flex flex-col gap-3">
              {performance.topProducts.map((product, index) => (
                <div key={product.asin} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wide text-[#8b8ba7]">
                        Product #{index + 1}
                      </div>
                      <div className="mt-1 text-[#f8fafc] text-sm font-semibold leading-relaxed">
                        {product.title}
                      </div>
                      <div className="mt-1 text-[#94a3b8] text-xs">{product.asin}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[#f59e0b] font-bold text-lg">{product.clicks}</div>
                      <div className="text-[0.7rem] text-[#8b8ba7] uppercase tracking-wide">Clicks</div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
                      style={{ width: `${Math.max(10, (product.clicks / topProductClickMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 mb-2 text-[#cbd5e1]">No tracked clicks yet.</p>
          )}
        </article>

        <article className="bg-[#111827] border border-white/10 rounded-2xl p-6 overflow-x-auto">
          <h2 className="m-0 mb-3 text-[#f9fafb] text-xl font-bold">Recent Clicks</h2>
          {performance?.recentClicks.length ? (
            <div className="flex flex-col gap-3">
              {performance.recentClicks.map((click) => (
                <div key={`${click.tracking_tag}-${click.clicked_at}`} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[#f8fafc] text-sm font-semibold mb-1">{click.tracking_tag}</div>
                      <div className="text-[#94a3b8] text-xs">
                        {click.country || "Unknown country"}
                      </div>
                    </div>
                    <div className="text-right text-xs text-[#8b8ba7]">
                      {new Date(click.clicked_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 mb-2 text-[#cbd5e1]">No recent clicks yet.</p>
          )}
        </article>
      </div>
    </section>
  );
}
