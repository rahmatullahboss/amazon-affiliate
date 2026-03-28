import { useEffect, useRef, useState } from "react";

interface Product {
  id: number;
  asin: string;
  title: string;
  image_url: string;
  marketplace: string;
  category: string | null;
  status: "active" | "pending_review" | "rejected";
  is_active: number;
  agent_count: number;
  total_clicks: number;
}

interface ImportResult {
  asin: string;
  status: "created" | "exists" | "error";
  error?: string;
}

interface SheetSyncConfig {
  id: number;
  sheet_url: string | null;
  sheet_tab_name: string | null;
  default_marketplace: string;
  is_active: number;
  last_imported_at: string | null;
  last_exported_at: string | null;
}

interface SheetSyncLog {
  id: number;
  direction: "import" | "export";
  status: "success" | "failed";
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_message: string | null;
  triggered_by_username: string | null;
  created_at: string;
  finished_at: string | null;
}

interface SheetConfigResponse {
  config: SheetSyncConfig;
  logs: SheetSyncLog[];
}

interface SyncSummary {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
}

const MARKETPLACES = ["US", "CA", "UK", "DE", "IT", "FR", "ES"] as const;
const getToken = () => localStorage.getItem("auth_token") || "";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<"asin" | "manual" | "bulk">("bulk");
  const [form, setForm] = useState({
    asin: "",
    title: "",
    image_url: "",
    marketplace: "US",
    category: "",
  });
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(false);

  const [bulkAsins, setBulkAsins] = useState("");
  const [bulkMarketplace, setBulkMarketplace] = useState("US");
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    results: ImportResult[];
    summary: { total: number; created: number; already_existed: number };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sheetConfig, setSheetConfig] = useState<SheetSyncConfig | null>(null);
  const [sheetLogs, setSheetLogs] = useState<SheetSyncLog[]>([]);
  const [sheetForm, setSheetForm] = useState({
    sheet_url: "",
    sheet_tab_name: "",
    default_marketplace: "US",
    is_active: false,
  });
  const [sheetSaving, setSheetSaving] = useState(false);
  const [sheetImporting, setSheetImporting] = useState(false);
  const [sheetExporting, setSheetExporting] = useState(false);
  const [sheetMessage, setSheetMessage] = useState("");

  useEffect(() => {
    void Promise.all([fetchProducts(), fetchSheetConfig()]);
  }, []);

  async function fetchProducts() {
    try {
      const response = await fetch("/api/products", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (response.ok) {
        const data = (await response.json()) as { products: Product[] };
        setProducts(data.products);
      }
    } catch (requestError) {
      console.error(requestError);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSheetConfig() {
    try {
      const response = await fetch("/api/sheets/config", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (response.ok) {
        const data = (await response.json()) as SheetConfigResponse;
        setSheetConfig(data.config);
        setSheetLogs(data.logs);
        setSheetForm({
          sheet_url: data.config.sheet_url || "",
          sheet_tab_name: data.config.sheet_tab_name || "",
          default_marketplace: data.config.default_marketplace,
          is_active: data.config.is_active === 1,
        });
      }
    } catch (requestError) {
      console.error(requestError);
    }
  }

  async function handleFetchAsin() {
    if (!form.asin || form.asin.length !== 10) {
      setError("ASIN must be 10 characters");
      return;
    }

    setFetching(true);
    setError("");

    try {
      const response = await fetch("/api/products/fetch-asin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ asin: form.asin, marketplace: form.marketplace }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error: string };
        throw new Error(data.error);
      }

      setShowForm(false);
      setForm({ asin: "", title: "", image_url: "", marketplace: "US", category: "" });
      await fetchProducts();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to fetch ASIN");
    } finally {
      setFetching(false);
    }
  }

  async function handleManualSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error: string };
        throw new Error(data.error);
      }

      setShowForm(false);
      setForm({ asin: "", title: "", image_url: "", marketplace: "US", category: "" });
      await fetchProducts();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to add product");
    }
  }

  function parseAsins(text: string): string[] {
    return text
      .split(/[\n,\t\s]+/)
      .map((value) => value.trim().toUpperCase())
      .filter((value) => /^B[A-Z0-9]{9}$/.test(value));
  }

  function handleCsvUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const text = (loadEvent.target?.result as string) || "";
      const asins = parseAsins(text);
      setBulkAsins(asins.join("\n"));
    };
    reader.readAsText(file);
  }

  async function handleBulkImport() {
    const asins = parseAsins(bulkAsins);
    if (asins.length === 0) {
      setError("No valid ASINs found. ASINs start with 'B' and are 10 characters long.");
      return;
    }
    if (asins.length > 500) {
      setError("Max 500 ASINs per import.");
      return;
    }

    setImporting(true);
    setError("");
    setImportResults(null);

    try {
      const response = await fetch("/api/products/bulk-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          asins,
          marketplace: bulkMarketplace,
          default_title_prefix: bulkPrefix || undefined,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error: string };
        throw new Error(data.error);
      }

      const data = (await response.json()) as {
        results: ImportResult[];
        summary: { total: number; created: number; already_existed: number };
      };

      setImportResults(data);
      await fetchProducts();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    try {
      const response = await fetch("/api/products/export", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Export failed");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "dealsrky-products.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Export failed");
    }
  }

  async function handleSheetSave() {
    setSheetSaving(true);
    setSheetMessage("");

    try {
      const response = await fetch("/api/sheets/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          sheet_url: sheetForm.sheet_url || null,
          sheet_tab_name: sheetForm.sheet_tab_name || null,
          default_marketplace: sheetForm.default_marketplace,
          is_active: sheetForm.is_active,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error: string };
        throw new Error(data.error);
      }

      setSheetMessage("Sheet sync configuration saved.");
      await fetchSheetConfig();
    } catch (requestError) {
      setSheetMessage(
        requestError instanceof Error ? requestError.message : "Failed to save sheet config"
      );
    } finally {
      setSheetSaving(false);
    }
  }

  async function handleSheetImport() {
    setSheetImporting(true);
    setSheetMessage("");

    try {
      const response = await fetch("/api/sheets/sync/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      const data = (await response.json()) as {
        summary?: SyncSummary;
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || data.message || "Sheet import failed");
      }

      const summary = data.summary;
      setSheetMessage(
        `Sheet import complete. Created ${summary?.createdCount ?? 0}, updated ${summary?.updatedCount ?? 0}, skipped ${summary?.skippedCount ?? 0}.`
      );
      await Promise.all([fetchProducts(), fetchSheetConfig()]);
    } catch (requestError) {
      setSheetMessage(
        requestError instanceof Error ? requestError.message : "Sheet import failed"
      );
    } finally {
      setSheetImporting(false);
    }
  }

  async function handleSheetExport() {
    setSheetExporting(true);
    setSheetMessage("");

    try {
      const response = await fetch("/api/sheets/sync/export", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      const data = (await response.json()) as {
        summary?: SyncSummary;
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || data.message || "Sheet export failed");
      }

      setSheetMessage(
        `Sheet export complete. Wrote ${data.summary?.totalRows ?? 0} products to the configured spreadsheet.`
      );
      await fetchSheetConfig();
    } catch (requestError) {
      setSheetMessage(
        requestError instanceof Error ? requestError.message : "Sheet export failed"
      );
    } finally {
      setSheetExporting(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "rgba(26, 26, 40, 0.9)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "1rem",
    padding: "1.5rem",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.875rem",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "0.5rem",
    color: "#f0f0f5",
    fontSize: "0.875rem",
    outline: "none",
  };
  const btnPrimary: React.CSSProperties = {
    padding: "0.625rem 1.5rem",
    background: "linear-gradient(135deg, #ff9900, #ffad33)",
    border: "none",
    borderRadius: "0.5rem",
    color: "#000",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.875rem",
  };
  const btnSecondary: React.CSSProperties = {
    padding: "0.5rem 1rem",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "0.5rem",
    color: "#a0a0b8",
    fontWeight: 500,
    cursor: "pointer",
    fontSize: "0.8rem",
  };

  const tabBtn = (active: boolean, color: string): React.CSSProperties => ({
    padding: "0.375rem 0.75rem",
    borderRadius: "0.375rem",
    border: "none",
    cursor: "pointer",
    background: active ? color : "rgba(255,255,255,0.05)",
    color: active ? (color === "#ff9900" ? "#000" : "#fff") : "#a0a0b8",
    fontWeight: 600,
    fontSize: "0.8rem",
  });

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f0f0f5" }}>
          Products
        </h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => void handleExport()} style={btnSecondary}>
            📥 Export CSV
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setImportResults(null);
              setError("");
            }}
            style={btnPrimary}
          >
            {showForm ? "Cancel" : "+ Add Product"}
          </button>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            marginBottom: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ color: "#f0f0f5", fontSize: "1rem", fontWeight: 700, marginBottom: "0.35rem" }}>
              Google Sheet Sync
            </h2>
            <p style={{ color: "#8d8da6", fontSize: "0.82rem", maxWidth: "720px", lineHeight: 1.6 }}>
              Use Google Sheets as an optional product ingestion source. The database
              remains the source of truth. Import and export both run through the
              Google Sheets API using backend credentials.
            </p>
          </div>
          <div
            style={{
              padding: "0.45rem 0.8rem",
              borderRadius: "999px",
              fontSize: "0.78rem",
              fontWeight: 700,
              background: sheetForm.is_active ? "rgba(16,185,129,0.16)" : "rgba(255,255,255,0.08)",
              color: sheetForm.is_active ? "#34d399" : "#a0a0b8",
            }}
          >
            {sheetForm.is_active ? "Sync Enabled" : "Sync Disabled"}
          </div>
        </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 0.9fr 0.7fr",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
          <div>
            <label style={labelStyle}>Public Sheet URL</label>
            <input
              style={inputStyle}
              value={sheetForm.sheet_url}
              onChange={(event) =>
                setSheetForm((current) => ({ ...current, sheet_url: event.target.value }))
              }
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=0"
            />
          </div>
          <div>
            <label style={labelStyle}>Sheet Tab Name (optional)</label>
            <input
              style={inputStyle}
              value={sheetForm.sheet_tab_name}
              onChange={(event) =>
                setSheetForm((current) => ({ ...current, sheet_tab_name: event.target.value }))
              }
              placeholder="Products"
            />
          </div>
          <div>
            <label style={labelStyle}>Default Marketplace</label>
            <select
              style={{ ...inputStyle, appearance: "auto" }}
              value={sheetForm.default_marketplace}
              onChange={(event) =>
                setSheetForm((current) => ({
                  ...current,
                  default_marketplace: event.target.value,
                }))
              }
            >
              {MARKETPLACES.map((marketplace) => (
                <option key={marketplace} value={marketplace}>
                  {marketplace}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: "1rem", color: "#6b6b85", fontSize: "0.78rem", lineHeight: 1.7 }}>
          Backend credentials must have access to the sheet. Share the spreadsheet with the
          configured Google service account email, then import/export will run server-side.
        </div>

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "#a0a0b8",
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          <input
            type="checkbox"
            checked={sheetForm.is_active}
            onChange={(event) =>
              setSheetForm((current) => ({ ...current, is_active: event.target.checked }))
            }
          />
          Enable sheet import
        </label>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <button
            onClick={() => void handleSheetSave()}
            disabled={sheetSaving}
            style={{ ...btnPrimary, opacity: sheetSaving ? 0.7 : 1 }}
          >
            {sheetSaving ? "Saving..." : "Save Sheet Config"}
          </button>
          <button
            onClick={() => void handleSheetImport()}
            disabled={sheetImporting || !sheetForm.is_active}
            style={{
              ...btnSecondary,
              borderColor: "rgba(16,185,129,0.4)",
              color: sheetForm.is_active ? "#34d399" : "#6b6b85",
              cursor: sheetForm.is_active ? "pointer" : "not-allowed",
            }}
          >
            {sheetImporting ? "Importing..." : "Import From Sheet"}
          </button>
          <button
            onClick={() => void handleSheetExport()}
            disabled={sheetExporting || sheetForm.sheet_url.trim().length === 0}
            style={{
              ...btnSecondary,
              borderColor: "rgba(99,102,241,0.4)",
              color: sheetForm.sheet_url.trim().length > 0 ? "#a5b4fc" : "#6b6b85",
              cursor: sheetForm.sheet_url.trim().length > 0 ? "pointer" : "not-allowed",
            }}
          >
            {sheetExporting ? "Exporting..." : "Export DB To Sheet"}
          </button>
        </div>

        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <span style={metaStyle}>
            Last import: {sheetConfig?.last_imported_at ? new Date(sheetConfig.last_imported_at).toLocaleString() : "Never"}
          </span>
          <span style={metaStyle}>
            Last export: {sheetConfig?.last_exported_at ? new Date(sheetConfig.last_exported_at).toLocaleString() : "Never"}
          </span>
        </div>

        {sheetMessage ? (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.85rem 1rem",
              borderRadius: "0.75rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#d4d4e4",
              fontSize: "0.84rem",
            }}
          >
            {sheetMessage}
          </div>
        ) : null}

        <div>
          <h3 style={{ color: "#f0f0f5", fontSize: "0.92rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            Recent sync logs
          </h3>
          {sheetLogs.length > 0 ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {sheetLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "110px 1fr auto",
                    gap: "1rem",
                    alignItems: "center",
                    padding: "0.85rem 1rem",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "0.75rem",
                  }}
                >
                  <div>
                    <div style={{ color: "#f0f0f5", fontWeight: 700, textTransform: "capitalize" }}>
                      {log.direction}
                    </div>
                    <div style={{ color: log.status === "success" ? "#34d399" : "#f87171", fontSize: "0.78rem" }}>
                      {log.status}
                    </div>
                  </div>
                  <div style={{ color: "#a0a0b8", fontSize: "0.8rem", lineHeight: 1.6 }}>
                    {log.total_rows} rows · created {log.created_count} · updated {log.updated_count} · skipped {log.skipped_count}
                    <br />
                    {log.triggered_by_username || "System"} · {new Date(log.created_at).toLocaleString()}
                    {log.error_message ? ` · ${log.error_message}` : ""}
                  </div>
                  <div style={{ color: "#6b6b85", fontSize: "0.76rem" }}>
                    #{log.id}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#6b6b85", fontSize: "0.8rem" }}>
              No sheet sync activity yet.
            </p>
          )}
        </div>
      </div>

      {showForm ? (
        <div style={{ ...cardStyle, marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button onClick={() => setMode("bulk")} style={tabBtn(mode === "bulk", "#10b981")}>
              📋 Bulk Import
            </button>
            <button onClick={() => setMode("asin")} style={tabBtn(mode === "asin", "#ff9900")}>
              🔍 Fetch by ASIN
            </button>
            <button onClick={() => setMode("manual")} style={tabBtn(mode === "manual", "#6366f1")}>
              ✏️ Manual Entry
            </button>
          </div>

          {mode === "bulk" ? (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <label style={labelStyle}>Marketplace*</label>
                  <select
                    style={{ ...inputStyle, appearance: "auto" }}
                    value={bulkMarketplace}
                    onChange={(event) => setBulkMarketplace(event.target.value)}
                  >
                    {MARKETPLACES.map((marketplace) => (
                      <option key={marketplace} value={marketplace}>
                        {marketplace}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Title Prefix (optional)</label>
                  <input
                    style={inputStyle}
                    value={bulkPrefix}
                    onChange={(event) => setBulkPrefix(event.target.value)}
                    placeholder="e.g. Electronics"
                  />
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>
                  Paste ASINs (one per line, comma-separated, or mixed text)
                </label>
                <textarea
                  style={{
                    ...inputStyle,
                    minHeight: "160px",
                    resize: "vertical",
                    fontFamily: "monospace",
                    lineHeight: 1.6,
                  }}
                  value={bulkAsins}
                  onChange={(event) => setBulkAsins(event.target.value)}
                  placeholder={"B0DNMW96QT\nB0DZLWGSZZ\nB0DYNXCHND"}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: "0.5rem",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "#6b6b85" }}>
                    {parseAsins(bulkAsins).length} valid ASINs detected
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".csv,.txt"
                      style={{ display: "none" }}
                      onChange={handleCsvUpload}
                    />
                    <button onClick={() => fileInputRef.current?.click()} style={btnSecondary}>
                      📂 Upload CSV/TXT
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => void handleBulkImport()}
                disabled={importing || parseAsins(bulkAsins).length === 0}
                style={{
                  ...btnPrimary,
                  background: importing ? "#666" : "linear-gradient(135deg, #10b981, #34d399)",
                  width: "100%",
                  padding: "0.75rem",
                }}
              >
                {importing ? "⏳ Importing..." : `🚀 Import ${parseAsins(bulkAsins).length} ASINs`}
              </button>

              {importResults ? (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "1rem",
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    borderRadius: "0.75rem",
                  }}
                >
                  <h4 style={{ color: "#10b981", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                    ✅ Import Complete
                  </h4>
                  <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.85rem", color: "#f0f0f5" }}>
                      📊 Total: <strong>{importResults.summary.total}</strong>
                    </span>
                    <span style={{ fontSize: "0.85rem", color: "#10b981" }}>
                      ✅ Created: <strong>{importResults.summary.created}</strong>
                    </span>
                    <span style={{ fontSize: "0.85rem", color: "#f59e0b" }}>
                      ⚠️ Already existed: <strong>{importResults.summary.already_existed}</strong>
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === "asin" ? (
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>ASIN*</label>
                <input
                  style={inputStyle}
                  value={form.asin}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, asin: event.target.value.toUpperCase() }))
                  }
                  placeholder="B09V3KXJPB"
                  maxLength={10}
                />
              </div>
              <button onClick={() => void handleFetchAsin()} disabled={fetching} style={{ ...btnPrimary, opacity: fetching ? 0.6 : 1 }}>
                {fetching ? "Fetching..." : "Fetch"}
              </button>
            </div>
          ) : null}

          {mode === "manual" ? (
            <form
              onSubmit={(event) => void handleManualSubmit(event)}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}
            >
              <div>
                <label style={labelStyle}>ASIN*</label>
                <input
                  style={inputStyle}
                  value={form.asin}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, asin: event.target.value.toUpperCase() }))
                  }
                  required
                  maxLength={10}
                />
              </div>
              <div>
                <label style={labelStyle}>Title*</label>
                <input
                  style={inputStyle}
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Marketplace</label>
                <select
                  style={{ ...inputStyle, appearance: "auto" }}
                  value={form.marketplace}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, marketplace: event.target.value }))
                  }
                >
                  {MARKETPLACES.map((marketplace) => (
                    <option key={marketplace} value={marketplace}>
                      {marketplace}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <input
                  style={inputStyle}
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, category: event.target.value }))
                  }
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Image URL*</label>
                <input
                  style={inputStyle}
                  value={form.image_url}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, image_url: event.target.value }))
                  }
                  required
                  type="url"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <button type="submit" style={{ ...btnPrimary, background: "#6366f1" }}>
                  Add Product
                </button>
              </div>
            </form>
          ) : null}

          {error ? (
            <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.75rem" }}>
              ❌ {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "#6b6b85" }}>Loading...</p>
      ) : (
        <div>
          <p style={{ color: "#6b6b85", fontSize: "0.8rem", marginBottom: "1rem" }}>
            {products.length} products total
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1rem",
            }}
          >
            {products.map((product) => (
              <div
                key={product.id}
                style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "0.75rem" }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    background: "#fff",
                    borderRadius: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={product.image_url}
                    alt={product.title}
                    style={{ maxWidth: "80%", maxHeight: "80%", objectFit: "contain" }}
                  />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.45rem", flexWrap: "wrap" }}>
                    <span
                      style={{
                        padding: "0.16rem 0.55rem",
                        borderRadius: "999px",
                        background:
                          product.status === "active"
                            ? "rgba(34,197,94,0.15)"
                            : product.status === "rejected"
                              ? "rgba(239,68,68,0.15)"
                              : "rgba(245,158,11,0.15)",
                        color:
                          product.status === "active"
                            ? "#4ade80"
                            : product.status === "rejected"
                              ? "#f87171"
                              : "#fbbf24",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "capitalize",
                      }}
                    >
                      {product.status.replace("_", " ")}
                    </span>
                    {!product.is_active ? (
                      <span
                        style={{
                          padding: "0.16rem 0.55rem",
                          borderRadius: "999px",
                          background: "rgba(239,68,68,0.15)",
                          color: "#fca5a5",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                        }}
                      >
                        inactive
                      </span>
                    ) : null}
                  </div>
                  <h3
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#f0f0f5",
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {product.title}
                  </h3>
                  <p style={{ fontSize: "0.75rem", color: "#6b6b85", marginTop: "0.25rem" }}>
                    ASIN: {product.asin} · {product.marketplace} · {product.agent_count} agents ·{" "}
                    {product.total_clicks} clicks
                  </p>
                </div>
              </div>
            ))}
            {products.length === 0 ? (
              <p
                style={{
                  color: "#6b6b85",
                  textAlign: "center",
                  padding: "2rem",
                  gridColumn: "1 / -1",
                }}
              >
                No products yet. Use bulk import, portal submissions, or sheet sync to add ASINs.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  color: "#a0a0b8",
  marginBottom: "0.375rem",
};

const metaStyle: React.CSSProperties = {
  color: "#6b6b85",
  fontSize: "0.78rem",
};
