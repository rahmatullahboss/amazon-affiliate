import { useEffect, useState } from "react";
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

interface ReportsResponse {
  reports: Array<{
    id: number;
    marketplace: string;
    report_type: string;
    period_start: string | null;
    period_end: string | null;
    source_file_name: string;
    imported_at: string;
    imported_by_username: string | null;
    conversions_count: number;
  }>;
}

interface ImportFormState {
  marketplace: string;
  source_file_name: string;
  report_type: string;
  period_start: string;
  period_end: string;
  csv_content: string;
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [reports, setReports] = useState<ReportsResponse["reports"]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [form, setForm] = useState<ImportFormState>({
    marketplace: "US",
    source_file_name: "",
    report_type: "tracking_summary",
    period_start: "",
    period_end: "",
    csv_content: "",
  });

  useEffect(() => {
    void loadAnalytics();
  }, []);

  async function loadAnalytics(showRefreshState = false) {
      const token = getAuthToken();
    if (!token) {
      setError("Authentication required.");
      setLoading(false);
      return;
    }

    if (showRefreshState) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const [overviewRes, reportsRes] = await Promise.all([
        fetch("/api/analytics/overview", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/analytics/reports", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!overviewRes.ok || !reportsRes.ok) {
        throw new Error("Failed to load analytics data.");
      }

      const overviewData = (await overviewRes.json()) as OverviewData;
      const reportsData = (await reportsRes.json()) as ReportsResponse;

      setOverview(overviewData);
      setReports(reportsData.reports);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load analytics data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAuthToken();

    if (!token) {
      setError("Authentication required.");
      return;
    }

    setImporting(true);
    setImportMessage(null);

    try {
      const response = await fetch("/api/analytics/reports/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          period_start: form.period_start || null,
          period_end: form.period_end || null,
        }),
      });

      const payload = (await response.json()) as {
        message?: string;
        importedRows?: number;
        skippedRows?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Import failed.");
      }

      setImportMessage(
        `Imported ${payload.importedRows ?? 0} rows. Skipped ${payload.skippedRows ?? 0} rows.`
      );
      setForm((current) => ({
        ...current,
        source_file_name: "",
        period_start: "",
        period_end: "",
        csv_content: "",
      }));
      await loadAnalytics(true);
    } catch (requestError) {
      setImportMessage(
        requestError instanceof Error ? requestError.message : "Import failed."
      );
    } finally {
      setImporting(false);
    }
  }

  const stats = [
    { label: "Total Clicks", value: overview?.totalClicks ?? 0, color: "#ff9900" },
    { label: "Total Views", value: overview?.totalViews ?? 0, color: "#6366f1" },
    { label: "Ordered Items", value: overview?.totalOrderedItems ?? 0, color: "#22c55e" },
    {
      label: "Revenue",
      value: `$${(overview?.totalRevenue ?? 0).toFixed(2)}`,
      color: "#38bdf8",
    },
    {
      label: "Commission",
      value: `$${(overview?.totalCommission ?? 0).toFixed(2)}`,
      color: "#a855f7",
    },
    { label: "Clicks This Week", value: overview?.clicksThisWeek ?? 0, color: "#f59e0b" },
  ];

  if (loading) {
    return <div className="text-[#a0a0b8] p-8">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#f0f0f5] mb-2">
            Analytics
          </h1>
          <p className="text-[#a0a0b8] text-sm m-0">
            Traffic and imported Amazon conversion data in one place.
          </p>
        </div>
        <button
          onClick={() => void loadAnalytics(true)}
          disabled={refreshing}
          className={`px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-[#f0f0f5] font-medium transition-colors hover:bg-white/10 ${refreshing ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mb-6">
          <p className="m-0 text-red-400 text-sm">{error}</p>
          <button
            onClick={() => void loadAnalytics()}
            className="mt-4 px-4 py-2.5 rounded-xl border-none bg-[#ff9900] text-[#111] font-bold cursor-pointer hover:bg-[#ff9900]/90 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6">
            <div className="text-xs text-[#6b6b85] mb-3">
              {stat.label}
            </div>
            <div className="text-2xl font-bold break-words" style={{ color: stat.color }}>
              {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 overflow-hidden">
          <h2 className="text-base font-bold text-[#f0f0f5] mb-4">
            Import Amazon report
          </h2>
          <p className="text-[#8d8da6] text-sm mb-4 leading-relaxed">
            Paste a CSV or TSV export with tags, ordered items, revenue,
            and commission columns. Supported headers include tracking id, ordered
            items, shipped items revenue, earnings, and ASIN.
          </p>

          <form onSubmit={handleImport}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <label className="flex flex-col gap-1.5 text-[#a0a0b8] text-sm">
                Marketplace
                <select
                  value={form.marketplace}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, marketplace: event.target.value }))
                  }
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900] appearance-none"
                >
                  {["US", "CA", "UK", "DE", "IT", "FR", "ES"].map((marketplace) => (
                    <option key={marketplace} value={marketplace} className="bg-[#1a1a28]">
                      {marketplace}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[#a0a0b8] text-sm">
                Source file name
                <input
                  type="text"
                  value={form.source_file_name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      source_file_name: event.target.value,
                    }))
                  }
                  placeholder="tracking-summary-us.csv"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[#f0f0f5] placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                  required
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <label className="flex flex-col gap-1.5 text-[#a0a0b8] text-sm">
                Report type
                <input
                  type="text"
                  value={form.report_type}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, report_type: event.target.value }))
                  }
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[#a0a0b8] text-sm">
                Period start
                <input
                  type="date"
                  value={form.period_start}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, period_start: event.target.value }))
                  }
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[#a0a0b8] text-sm">
                Period end
                <input
                  type="date"
                  value={form.period_end}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, period_end: event.target.value }))
                  }
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-[#a0a0b8] text-sm">
              CSV / TSV content
              <textarea
                value={form.csv_content}
                onChange={(event) =>
                  setForm((current) => ({ ...current, csv_content: event.target.value }))
                }
                rows={12}
                placeholder={"tracking_id,asin,ordered_items,shipped_items_revenue,earnings\nagent-us-01,B0EXAMPLE01,3,149.97,4.50"}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[#f0f0f5] placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#ff9900] resize-y min-h-[240px]"
                required
              />
            </label>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mt-4">
              <button
                type="submit"
                disabled={importing}
                className={`px-4 py-3 rounded-xl border-none font-bold transition-colors ${importing ? "bg-[#ff9900]/50 text-[#111]/70 cursor-not-allowed" : "bg-[#ff9900] text-[#111] hover:bg-[#ff9900]/90 cursor-pointer"}`}
              >
                {importing ? "Importing..." : "Import report"}
              </button>
              {importMessage && (
                <p className="m-0 text-sm text-[#a0a0b8]">
                  {importMessage}
                </p>
              )}
            </div>
          </form>
        </section>

        <section className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6">
          <h2 className="text-base font-bold text-[#f0f0f5] mb-4">
            Top agents by commission
          </h2>
          <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
            <div className="min-w-[300px]">
              {overview?.topAgentsByCommission.length ? (
                overview.topAgentsByCommission.map((agent, index) => (
                  <div
                    key={`${agent.slug}-${index}`}
                    className={`grid grid-cols-[1fr_auto] gap-4 py-3 ${index < overview.topAgentsByCommission.length - 1 ? 'border-b border-white/5' : ''}`}
                  >
                    <div>
                      <div className="text-[#f0f0f5] font-semibold mb-1">
                        {agent.name}
                      </div>
                      <div className="text-[#8d8da6] text-xs sm:text-sm">
                        {agent.orderedItems} ordered items · ${agent.revenueAmount.toFixed(2)} revenue
                      </div>
                    </div>
                    <div className="text-[#a855f7] font-bold">
                      ${agent.commissionAmount.toFixed(2)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[#8d8da6] text-sm">
                  No imported commission data yet.
                </div>
              )}
            </div>
          </div>

          <h2 className="text-base font-bold text-[#f0f0f5] mt-8 mb-4">
            Traffic leaders
          </h2>
          {overview?.topAgents.length ? (
            <div className="space-y-1">
              {overview.topAgents.map((agent, index) => (
                <div
                  key={`${agent.slug}-${index}`}
                  className={`flex justify-between items-center gap-4 py-3 ${index < overview.topAgents.length - 1 ? 'border-b border-white/5' : ''}`}
                >
                  <span className="text-[#a0a0b8] text-sm truncate">{agent.name}</span>
                  <span className="text-[#ff9900] font-bold">{agent.clicks}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[#8d8da6] text-sm">No click data yet.</div>
          )}
        </section>
      </div>

      <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6">
        <h2 className="text-base font-bold text-[#f0f0f5] mb-4">
          Recent imported reports
        </h2>
        {reports.length ? (
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="grid gap-3 min-w-[600px] mb-2">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="grid grid-cols-[100px_1fr_auto] gap-4 items-center border border-white/10 rounded-xl p-4 transition-colors hover:bg-white/5"
                >
                  <div>
                    <div className="text-[#f0f0f5] font-bold">{report.marketplace}</div>
                    <div className="text-[#8d8da6] text-xs">{report.report_type}</div>
                  </div>
                  <div>
                    <div className="text-[#d4d4e4] text-sm mb-1">
                      {report.source_file_name}
                    </div>
                    <div className="text-[#8d8da6] text-xs">
                      {report.imported_by_username || "Unknown"} · {new Date(report.imported_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-[#22c55e] font-bold text-sm">
                    {report.conversions_count} rows
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-[#8d8da6] text-sm">
            No reports imported yet.
          </div>
        )}
      </div>
    </div>
  );
}
