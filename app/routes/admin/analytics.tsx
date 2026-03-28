import { useEffect, useState } from "react";

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

const cardStyle: React.CSSProperties = {
  background: "rgba(26, 26, 40, 0.9)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: "1rem",
  padding: "1.5rem",
};

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
    const token = localStorage.getItem("auth_token");
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
    const token = localStorage.getItem("auth_token");

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
    return <div style={{ color: "#a0a0b8", padding: "2rem" }}>Loading analytics...</div>;
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "#f0f0f5",
              marginBottom: "0.5rem",
            }}
          >
            Analytics
          </h1>
          <p style={{ color: "#a0a0b8", fontSize: "0.9rem" }}>
            Traffic and imported Amazon conversion data in one place.
          </p>
        </div>
        <button
          onClick={() => void loadAnalytics(true)}
          disabled={refreshing}
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "#f0f0f5",
            cursor: refreshing ? "not-allowed" : "pointer",
            opacity: refreshing ? 0.7 : 1,
          }}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div style={{ ...cardStyle, marginBottom: "1.5rem", color: "#fca5a5" }}>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>{error}</p>
          <button
            onClick={() => void loadAnalytics()}
            style={{
              marginTop: "1rem",
              padding: "0.625rem 0.9rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#ff9900",
              color: "#111",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {stats.map((stat) => (
          <div key={stat.label} style={cardStyle}>
            <div style={{ fontSize: "0.8rem", color: "#6b6b85", marginBottom: "0.75rem" }}>
              {stat.label}
            </div>
            <div style={{ fontSize: "1.65rem", fontWeight: 700, color: stat.color }}>
              {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <section style={cardStyle}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#f0f0f5", marginBottom: "1rem" }}>
            Import Amazon report
          </h2>
          <p style={{ color: "#8d8da6", fontSize: "0.85rem", marginBottom: "1rem", lineHeight: 1.6 }}>
            Paste a CSV or TSV export with tracking IDs, ordered items, revenue,
            and commission columns. Supported headers include tracking id, ordered
            items, shipped items revenue, earnings, and ASIN.
          </p>

          <form onSubmit={handleImport}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", color: "#a0a0b8", fontSize: "0.82rem" }}>
                Marketplace
                <select
                  value={form.marketplace}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, marketplace: event.target.value }))
                  }
                  style={inputStyle}
                >
                  {["US", "CA", "UK", "DE", "IT", "FR", "ES"].map((marketplace) => (
                    <option key={marketplace} value={marketplace}>
                      {marketplace}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", color: "#a0a0b8", fontSize: "0.82rem" }}>
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
                  style={inputStyle}
                  required
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", color: "#a0a0b8", fontSize: "0.82rem" }}>
                Report type
                <input
                  type="text"
                  value={form.report_type}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, report_type: event.target.value }))
                  }
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", color: "#a0a0b8", fontSize: "0.82rem" }}>
                Period start
                <input
                  type="date"
                  value={form.period_start}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, period_start: event.target.value }))
                  }
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", color: "#a0a0b8", fontSize: "0.82rem" }}>
                Period end
                <input
                  type="date"
                  value={form.period_end}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, period_end: event.target.value }))
                  }
                  style={inputStyle}
                />
              </label>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", color: "#a0a0b8", fontSize: "0.82rem" }}>
              CSV / TSV content
              <textarea
                value={form.csv_content}
                onChange={(event) =>
                  setForm((current) => ({ ...current, csv_content: event.target.value }))
                }
                rows={12}
                placeholder={"tracking_id,asin,ordered_items,shipped_items_revenue,earnings\nagent-us-01,B0EXAMPLE01,3,149.97,4.50"}
                style={{ ...inputStyle, resize: "vertical", minHeight: "240px" }}
                required
              />
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem" }}>
              <button
                type="submit"
                disabled={importing}
                style={{
                  padding: "0.8rem 1rem",
                  borderRadius: "0.75rem",
                  border: "none",
                  background: importing ? "rgba(255,153,0,0.5)" : "#ff9900",
                  color: "#111",
                  fontWeight: 700,
                  cursor: importing ? "not-allowed" : "pointer",
                }}
              >
                {importing ? "Importing..." : "Import report"}
              </button>
              {importMessage ? (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#a0a0b8" }}>
                  {importMessage}
                </p>
              ) : null}
            </div>
          </form>
        </section>

        <section style={cardStyle}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#f0f0f5", marginBottom: "1rem" }}>
            Top agents by commission
          </h2>
          {overview?.topAgentsByCommission.length ? (
            overview.topAgentsByCommission.map((agent, index) => (
              <div
                key={`${agent.slug}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "1rem",
                  padding: "0.85rem 0",
                  borderBottom:
                    index < overview.topAgentsByCommission.length - 1
                      ? "1px solid rgba(255,255,255,0.06)"
                      : "none",
                }}
              >
                <div>
                  <div style={{ color: "#f0f0f5", fontWeight: 600, marginBottom: "0.35rem" }}>
                    {agent.name}
                  </div>
                  <div style={{ color: "#8d8da6", fontSize: "0.8rem" }}>
                    {agent.orderedItems} ordered items · ${agent.revenueAmount.toFixed(2)} revenue
                  </div>
                </div>
                <div style={{ color: "#a855f7", fontWeight: 700 }}>
                  ${agent.commissionAmount.toFixed(2)}
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: "#8d8da6", fontSize: "0.85rem" }}>
              No imported commission data yet.
            </div>
          )}

          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "#f0f0f5",
              marginTop: "2rem",
              marginBottom: "1rem",
            }}
          >
            Traffic leaders
          </h2>
          {overview?.topAgents.length ? (
            overview.topAgents.map((agent, index) => (
              <div
                key={`${agent.slug}-${index}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  padding: "0.75rem 0",
                  borderBottom:
                    index < overview.topAgents.length - 1
                      ? "1px solid rgba(255,255,255,0.06)"
                      : "none",
                }}
              >
                <span style={{ color: "#a0a0b8", fontSize: "0.9rem" }}>{agent.name}</span>
                <span style={{ color: "#ff9900", fontWeight: 700 }}>{agent.clicks}</span>
              </div>
            ))
          ) : (
            <div style={{ color: "#8d8da6", fontSize: "0.85rem" }}>No click data yet.</div>
          )}
        </section>
      </div>

      <div style={{ ...cardStyle, marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#f0f0f5", marginBottom: "1rem" }}>
          Recent imported reports
        </h2>
        {reports.length ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {reports.map((report) => (
              <div
                key={report.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr auto",
                  gap: "1rem",
                  alignItems: "center",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "0.9rem",
                  padding: "0.9rem 1rem",
                }}
              >
                <div>
                  <div style={{ color: "#f0f0f5", fontWeight: 700 }}>{report.marketplace}</div>
                  <div style={{ color: "#8d8da6", fontSize: "0.75rem" }}>{report.report_type}</div>
                </div>
                <div>
                  <div style={{ color: "#d4d4e4", fontSize: "0.9rem", marginBottom: "0.25rem" }}>
                    {report.source_file_name}
                  </div>
                  <div style={{ color: "#8d8da6", fontSize: "0.78rem" }}>
                    {report.imported_by_username || "Unknown"} · {new Date(report.imported_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ color: "#22c55e", fontWeight: 700 }}>
                  {report.conversions_count} rows
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "#8d8da6", fontSize: "0.85rem" }}>
            No reports imported yet.
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "0.75rem",
  padding: "0.85rem 0.95rem",
  color: "#f0f0f5",
};
