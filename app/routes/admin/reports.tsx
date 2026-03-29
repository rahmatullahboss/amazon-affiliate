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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#f0f0f5] m-0 mb-1.5">Amazon Reports</h1>
          <p className="m-0 text-[#8d8da6] leading-relaxed">
            Import real Amazon Associates tracking reports to reconcile ordered items,
            revenue, and commission by agent tag.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadReports(true)}
          disabled={refreshing}
          className={`px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] font-semibold cursor-pointer hover:bg-white/10 transition-colors whitespace-nowrap ${
            refreshing ? "opacity-70" : ""
          }`}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <section className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6">
        <h2 className="m-0 mb-2 text-[#f0f0f5] text-lg font-bold">Import report</h2>
        <p className="m-0 text-[#8d8da6] leading-relaxed">
          Paste CSV/TSV content or upload the exported report file directly from Amazon
          Associates.
        </p>

        <form onSubmit={handleImport} className="grid gap-4 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 text-xs text-[#a0a0b8]">Marketplace</label>
              <select
                value={form.marketplace}
                onChange={(event) =>
                  setForm((current) => ({ ...current, marketplace: event.target.value }))
                }
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-auto"
              >
                {["US", "CA", "UK", "DE", "IT", "FR", "ES"].map((marketplace) => (
                  <option className="bg-gray-800" key={marketplace} value={marketplace}>
                    {marketplace}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1.5 text-xs text-[#a0a0b8]">Report type</label>
              <input
                value={form.report_type}
                onChange={(event) =>
                  setForm((current) => ({ ...current, report_type: event.target.value }))
                }
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="tracking_summary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 text-xs text-[#a0a0b8]">Source file name</label>
              <input
                value={form.source_file_name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    source_file_name: event.target.value,
                  }))
                }
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="tracking-summary-us.csv"
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="block mb-1.5 text-xs text-[#a0a0b8]">Upload exported file</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="text-[#d4d4e4] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-[#f0f0f5] hover:file:bg-white/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 text-xs text-[#a0a0b8]">Period start (optional)</label>
              <input
                type="date"
                value={form.period_start}
                onChange={(event) =>
                  setForm((current) => ({ ...current, period_start: event.target.value }))
                }
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-indigo-500 color-scheme-dark"
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs text-[#a0a0b8]">Period end (optional)</label>
              <input
                type="date"
                value={form.period_end}
                onChange={(event) =>
                  setForm((current) => ({ ...current, period_end: event.target.value }))
                }
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-indigo-500 color-scheme-dark"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1.5 text-xs text-[#a0a0b8]">Report content</label>
            <textarea
              value={form.csv_content}
              onChange={(event) =>
                setForm((current) => ({ ...current, csv_content: event.target.value }))
              }
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[220px] resize-y font-mono text-sm"
              placeholder={"tracking id\tordered items\tshipped items\trevenue\tcommission"}
              required
            />
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            <button
              type="submit"
              disabled={importing || form.csv_content.trim().length === 0}
              className={`px-4 py-2.5 bg-gradient-to-br from-[#ff9900] to-[#ffad33] border-none rounded-lg text-[#111827] font-bold cursor-pointer hover:opacity-90 transition-opacity ${
                importing || form.csv_content.trim().length === 0 ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {importing ? "Importing..." : "Import Amazon Report"}
            </button>
            {message ? <span className="text-emerald-400 text-sm">{message}</span> : null}
            {error ? <span className="text-red-400 text-sm">{error}</span> : null}
          </div>
        </form>
      </section>

      <section className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 mt-6">
        <h2 className="m-0 mb-4 text-[#f0f0f5] text-lg font-bold">Imported report history</h2>

        {loading ? <p className="m-0 text-[#8d8da6] leading-relaxed">Loading reports...</p> : null}

        {!loading && reports.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-xl p-5 mt-4 text-center">
            <p className="m-0 text-[#8d8da6]">
              No Amazon reports imported yet.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3">
          {reports.map((report) => (
            <article key={report.id} className="border border-white/5 rounded-xl p-4">
              <div>
                <div className="flex gap-2 flex-wrap mb-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/5 text-[#d4d4e4] text-[0.74rem] font-semibold">{report.marketplace}</span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/5 text-[#d4d4e4] text-[0.74rem] font-semibold">{report.report_type}</span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/5 text-[#d4d4e4] text-[0.74rem] font-semibold">{report.conversions_count} rows</span>
                </div>
                <h3 className="m-0 mb-1.5 text-[#f0f0f5] text-base font-semibold">
                  {report.source_file_name}
                </h3>
                <p className="m-0 text-[#8d8da6] text-xs leading-relaxed">
                  Imported {new Date(report.imported_at).toLocaleString()}
                  {report.imported_by_username ? ` · by ${report.imported_by_username}` : ""}
                </p>
                {report.period_start || report.period_end ? (
                  <p className="m-0 text-[#8d8da6] text-xs leading-relaxed">
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
