import { useEffect, useRef, useState } from "react";

interface AmazonReport {
  id: number;
  marketplace: string;
  report_type: string;
  period_start: string | null;
  period_end: string | null;
  source_file_name: string;
  imported_at: string;
  imported_by_username: string | null;
  conversions_count: number;
}

interface ImportFormState {
  marketplace: string;
  source_file_name: string;
  report_type: string;
  period_start: string;
  period_end: string;
  csv_content: string;
}

const getToken = () => localStorage.getItem("auth_token") || "";

export default function AdminReportsPage() {
  const [reports, setReports] = useState<AmazonReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ImportFormState>({
    marketplace: "US",
    source_file_name: "",
    report_type: "tracking_summary",
    period_start: "",
    period_end: "",
    csv_content: "",
  });

  useEffect(() => {
    void loadReports();
  }, []);

  async function loadReports(showRefreshing = false) {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch("/api/analytics/reports", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to load reports");
      }

      const payload = (await response.json()) as { reports: AmazonReport[] };
      setReports(payload.reports);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to load reports"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImporting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/analytics/reports/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          ...form,
          period_start: form.period_start || null,
          period_end: form.period_end || null,
        }),
      });

      const payload = (await response.json()) as {
        importedRows?: number;
        skippedRows?: number;
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Import failed");
      }

      setMessage(
        `Imported ${payload.importedRows ?? 0} rows. Skipped ${payload.skippedRows ?? 0} rows.`
      );
      setForm((current) => ({
        ...current,
        source_file_name: "",
        period_start: "",
        period_end: "",
        csv_content: "",
      }));
      await loadReports(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to import report"
      );
    } finally {
      setImporting(false);
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const content = (loadEvent.target?.result as string) || "";
      setForm((current) => ({
        ...current,
        source_file_name: file.name,
        csv_content: content,
      }));
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={titleStyle}>Amazon Reports</h1>
          <p style={subtleStyle}>
            Import real Amazon Associates tracking reports to reconcile ordered items,
            revenue, and commission by agent tracking ID.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadReports(true)}
          disabled={refreshing}
          style={{
            ...secondaryButtonStyle,
            opacity: refreshing ? 0.7 : 1,
          }}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Import report</h2>
        <p style={subtleStyle}>
          Paste CSV/TSV content or upload the exported report file directly from Amazon
          Associates.
        </p>

        <form onSubmit={handleImport} style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>Marketplace</label>
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
            </div>

            <div>
              <label style={labelStyle}>Report type</label>
              <input
                value={form.report_type}
                onChange={(event) =>
                  setForm((current) => ({ ...current, report_type: event.target.value }))
                }
                style={inputStyle}
                placeholder="tracking_summary"
              />
            </div>
          </div>

          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>Source file name</label>
              <input
                value={form.source_file_name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    source_file_name: event.target.value,
                  }))
                }
                style={inputStyle}
                placeholder="tracking-summary-us.csv"
                required
              />
            </div>

            <div style={{ display: "grid", gap: "0.5rem" }}>
              <label style={labelStyle}>Upload exported file</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                style={{ color: "#d4d4e4" }}
              />
            </div>
          </div>

          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>Period start (optional)</label>
              <input
                type="date"
                value={form.period_start}
                onChange={(event) =>
                  setForm((current) => ({ ...current, period_start: event.target.value }))
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Period end (optional)</label>
              <input
                type="date"
                value={form.period_end}
                onChange={(event) =>
                  setForm((current) => ({ ...current, period_end: event.target.value }))
                }
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Report content</label>
            <textarea
              value={form.csv_content}
              onChange={(event) =>
                setForm((current) => ({ ...current, csv_content: event.target.value }))
              }
              style={{ ...inputStyle, minHeight: "220px", resize: "vertical", fontFamily: "monospace" }}
              placeholder={"tracking id\tordered items\tshipped items\trevenue\tcommission"}
              required
            />
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="submit"
              disabled={importing || form.csv_content.trim().length === 0}
              style={{
                ...primaryButtonStyle,
                opacity: importing || form.csv_content.trim().length === 0 ? 0.7 : 1,
              }}
            >
              {importing ? "Importing..." : "Import Amazon Report"}
            </button>
            {message ? <span style={{ color: "#4ade80", fontSize: "0.85rem" }}>{message}</span> : null}
            {error ? <span style={{ color: "#fca5a5", fontSize: "0.85rem" }}>{error}</span> : null}
          </div>
        </form>
      </section>

      <section style={{ ...cardStyle, marginTop: "1.5rem" }}>
        <h2 style={sectionTitleStyle}>Imported report history</h2>

        {loading ? <p style={subtleStyle}>Loading reports...</p> : null}

        {!loading && reports.length === 0 ? (
          <div style={emptyStateStyle}>
            <p style={{ margin: 0, color: "#8d8da6" }}>
              No Amazon reports imported yet.
            </p>
          </div>
        ) : null}

        <div style={{ display: "grid", gap: "0.75rem" }}>
          {reports.map((report) => (
            <article key={report.id} style={reportCardStyle}>
              <div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
                  <span style={tagStyle}>{report.marketplace}</span>
                  <span style={tagStyle}>{report.report_type}</span>
                  <span style={tagStyle}>{report.conversions_count} rows</span>
                </div>
                <h3 style={{ margin: "0 0 0.4rem", color: "#f0f0f5", fontSize: "1rem" }}>
                  {report.source_file_name}
                </h3>
                <p style={metaStyle}>
                  Imported {new Date(report.imported_at).toLocaleString()}
                  {report.imported_by_username ? ` · by ${report.imported_by_username}` : ""}
                </p>
                {report.period_start || report.period_end ? (
                  <p style={metaStyle}>
                    Period: {report.period_start || "Unknown"} to {report.period_end || "Unknown"}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

const titleStyle: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  color: "#f0f0f5",
  margin: "0 0 0.4rem",
};

const subtleStyle: React.CSSProperties = {
  margin: 0,
  color: "#8d8da6",
  lineHeight: 1.6,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 0.5rem",
  color: "#f0f0f5",
  fontSize: "1.1rem",
  fontWeight: 700,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(26, 26, 40, 0.9)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "1rem",
  padding: "1.5rem",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "0.35rem",
  fontSize: "0.8rem",
  color: "#a0a0b8",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.7rem 0.9rem",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "0.6rem",
  color: "#f0f0f5",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "0.7rem 1rem",
  background: "linear-gradient(135deg, #ff9900, #ffad33)",
  border: "none",
  borderRadius: "0.6rem",
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "0.65rem 0.95rem",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "0.6rem",
  color: "#f0f0f5",
  fontWeight: 600,
  cursor: "pointer",
};

const reportCardStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "0.85rem",
  padding: "1rem",
};

const tagStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.2rem 0.6rem",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.06)",
  color: "#d4d4e4",
  fontSize: "0.74rem",
  fontWeight: 600,
};

const metaStyle: React.CSSProperties = {
  margin: 0,
  color: "#8d8da6",
  fontSize: "0.8rem",
  lineHeight: 1.6,
};

const emptyStateStyle: React.CSSProperties = {
  border: "1px dashed rgba(255,255,255,0.12)",
  borderRadius: "0.85rem",
  padding: "1.2rem",
  marginTop: "1rem",
};
