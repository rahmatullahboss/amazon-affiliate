import { useEffect, useRef, useState } from "react";
import { getAuthToken } from "../../utils/auth-session";

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

interface ProductPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface ProductSummary {
  totalProducts: number;
  activeProducts: number;
  pendingReviewProducts: number;
  rejectedProducts: number;
  needsRefreshProducts: number;
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

interface ProductsResponse {
  products: Product[];
  summary: ProductSummary;
  pagination: ProductPagination;
}

interface SyncSummary {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
}

const MARKETPLACES = ["US", "CA", "UK", "DE", "IT", "FR", "ES"] as const;
const getToken = () => getAuthToken();
const PRODUCT_PAGE_SIZE = 12;

function analyzeBulkAsins(text: string) {
  const rawEntries = text
    .split(/[\n,\t\s]+/)
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const validAsins = rawEntries.filter((value) => /^B[A-Z0-9]{9}$/.test(value));
  const uniqueAsins = [...new Set(validAsins)];

  return {
    rawCount: rawEntries.length,
    validCount: validAsins.length,
    uniqueCount: uniqueAsins.length,
    invalidCount: rawEntries.length - validAsins.length,
    duplicateCount: validAsins.length - uniqueAsins.length,
    uniqueAsins,
  };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productSummary, setProductSummary] = useState<ProductSummary>({
    totalProducts: 0,
    activeProducts: 0,
    pendingReviewProducts: 0,
    rejectedProducts: 0,
    needsRefreshProducts: 0,
  });
  const [productPagination, setProductPagination] = useState<ProductPagination>({
    page: 1,
    pageSize: PRODUCT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
  });
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
  const [refreshingProductId, setRefreshingProductId] = useState<number | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);

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
    void Promise.all([fetchProducts(1), fetchSheetConfig()]);
  }, []);

  async function fetchProducts(page = productPagination.page) {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(PRODUCT_PAGE_SIZE),
      });
      const response = await fetch(`/api/products?${query.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (response.ok) {
        const data = (await response.json()) as ProductsResponse;
        setProducts(data.products);
        setProductSummary(data.summary);
        setProductPagination(data.pagination);
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
      await fetchProducts(1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to fetch ASIN");
    } finally {
      setFetching(false);
    }
  }

  async function handleProductRefresh(productId: number) {
    setRefreshingProductId(productId);
    setError("");

    try {
      const response = await fetch(`/api/products/${productId}/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Failed to refresh product");
      }

      await fetchProducts(productPagination.page);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to refresh product"
      );
    } finally {
      setRefreshingProductId(null);
    }
  }

  async function handleProductDelete(productId: number) {
    if (!window.confirm("Remove this product from active use? Existing pages will stop working for it.")) {
      return;
    }

    setDeletingProductId(productId);
    setError("");

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      const payload = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Failed to remove product");
      }

      await fetchProducts(productPagination.page);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to remove product"
      );
    } finally {
      setDeletingProductId(null);
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
      await fetchProducts(1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to add product");
    }
  }

  function parseAsins(text: string): string[] {
    return analyzeBulkAsins(text).uniqueAsins;
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
    const asins = analyzeBulkAsins(bulkAsins).uniqueAsins;
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
      await fetchProducts(1);
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
      await Promise.all([fetchProducts(1), fetchSheetConfig()]);
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

  // Styles migrated to Tailwind CSS

  return (
    <div>
      <div
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-[#f0f0f5] m-0">
          Products
        </h1>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => void handleExport()} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#a0a0b8] font-medium cursor-pointer text-sm hover:bg-white/10 transition-colors">
            📥 Export CSV
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setImportResults(null);
              setError("");
            }}
            className="px-6 py-2.5 bg-gradient-to-br from-[#ff9900] to-[#ffad33] border-none rounded-lg text-black font-semibold cursor-pointer text-sm hover:opacity-90 transition-opacity"
          >
            {showForm ? "Cancel" : "+ Add Product"}
          </button>
        </div>
      </div>

      <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 mb-6">
        <div
          className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6"
        >
          <div>
            <h2 className="text-[#f0f0f5] text-base font-bold m-0 mb-2">
              Google Sheet Sync
            </h2>
            <p className="text-[#8d8da6] text-sm max-w-[720px] leading-relaxed m-0">
              Use Google Sheets as an optional product ingestion source. The database
              remains the source of truth. Import and export both run through the
              Google Sheets API using backend credentials.
            </p>
          </div>
          <div
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${sheetForm.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-[#a0a0b8]"}`}
          >
            {sheetForm.is_active ? "Sync Enabled" : "Sync Disabled"}
          </div>
        </div>

          <div
            className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr_0.7fr] gap-4 mb-6"
          >
          <div>
            <label className="block text-sm text-[#a0a0b8] mb-1.5">Public Sheet URL</label>
            <input
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
              value={sheetForm.sheet_url}
              onChange={(event) =>
                setSheetForm((current) => ({ ...current, sheet_url: event.target.value }))
              }
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=0"
            />
          </div>
          <div>
            <label className="block text-sm text-[#a0a0b8] mb-1.5">Sheet Tab Name (optional)</label>
            <input
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
              value={sheetForm.sheet_tab_name}
              onChange={(event) =>
                setSheetForm((current) => ({ ...current, sheet_tab_name: event.target.value }))
              }
              placeholder="Products"
            />
          </div>
          <div>
            <label className="block text-sm text-[#a0a0b8] mb-1.5">Default Marketplace</label>
            <select
              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] appearance-auto"
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

        <div className="text-[#6b6b85] text-sm leading-relaxed mb-6">
          Backend credentials must have access to the sheet. Share the spreadsheet with the
          configured Google service account email, then import/export will run server-side.
        </div>

        <label
          className="inline-flex items-center gap-2 text-[#a0a0b8] text-sm mb-6 cursor-pointer"
        >
          <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-white/5 text-[#ff9900] focus:ring-[#ff9900]"
            checked={sheetForm.is_active}
            onChange={(event) =>
              setSheetForm((current) => ({ ...current, is_active: event.target.checked }))
            }
          />
          Enable sheet import
        </label>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => void handleSheetSave()}
            disabled={sheetSaving}
            className={`px-6 py-2.5 bg-gradient-to-br from-[#ff9900] to-[#ffad33] border-none rounded-lg text-black font-semibold cursor-pointer text-sm transition-opacity ${sheetSaving ? "opacity-70" : "hover:opacity-90"}`}
          >
            {sheetSaving ? "Saving..." : "Save Sheet Config"}
          </button>
          <button
            onClick={() => void handleSheetImport()}
            disabled={sheetImporting || !sheetForm.is_active}
            className={`px-4 py-2 border rounded-lg font-medium text-sm transition-colors ${sheetForm.is_active ? "border-emerald-500/40 bg-white/5 text-emerald-400 cursor-pointer hover:bg-emerald-500/10" : "border-white/10 bg-white/5 text-[#6b6b85] cursor-not-allowed"}`}
          >
            {sheetImporting ? "Importing..." : "Import From Sheet"}
          </button>
          <button
            onClick={() => void handleSheetExport()}
            disabled={sheetExporting || sheetForm.sheet_url.trim().length === 0}
            className={`px-4 py-2 border rounded-lg font-medium text-sm transition-colors ${sheetForm.sheet_url.trim().length > 0 ? "border-indigo-500/40 bg-white/5 text-indigo-300 cursor-pointer hover:bg-indigo-500/10" : "border-white/10 bg-white/5 text-[#6b6b85] cursor-not-allowed"}`}
          >
            {sheetExporting ? "Exporting..." : "Export DB To Sheet"}
          </button>
        </div>

        <div className="flex flex-wrap gap-6 mb-6">
          <span className="text-[#6b6b85] text-sm">
            Last import: {sheetConfig?.last_imported_at ? new Date(sheetConfig.last_imported_at).toLocaleString() : "Never"}
          </span>
          <span className="text-[#6b6b85] text-sm">
            Last export: {sheetConfig?.last_exported_at ? new Date(sheetConfig.last_exported_at).toLocaleString() : "Never"}
          </span>
        </div>

        {sheetMessage ? (
          <div
            className="mb-6 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[#d4d4e4] text-sm"
          >
            {sheetMessage}
          </div>
        ) : null}

        <div>
          <h3 className="text-[#f0f0f5] text-sm font-bold m-0 mb-4">
            Recent sync logs (latest 10)
          </h3>
          {sheetLogs.length > 0 ? (
            <div className="space-y-3">
              {sheetLogs.map((log) => (
                <div
                  key={log.id}
                  className="grid grid-cols-1 sm:grid-cols-[110px_1fr_auto] gap-3 sm:gap-4 items-center p-3.5 border border-white/5 rounded-xl bg-white/[0.02]"
                >
                  <div>
                    <div className="text-[#f0f0f5] font-bold capitalize">
                      {log.direction}
                    </div>
                    <div className={`text-xs ${log.status === "success" ? "text-emerald-400" : "text-red-400"}`}>
                      {log.status}
                    </div>
                  </div>
                  <div className="text-[#a0a0b8] text-xs leading-relaxed">
                    {log.total_rows} rows · created {log.created_count} · updated {log.updated_count} · skipped {log.skipped_count}
                    <br />
                    {log.triggered_by_username || "System"} · {new Date(log.created_at).toLocaleString()}
                    {log.error_message ? ` · ${log.error_message}` : ""}
                  </div>
                  <div className="text-[#6b6b85] text-xs">
                    #{log.id}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#6b6b85] text-sm m-0">
              No sheet sync activity yet.
            </p>
          )}
        </div>
      </div>

      {showForm ? (
        <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 mb-6">
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => setMode("bulk")} className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${mode === "bulk" ? "bg-emerald-500 text-black" : "bg-white/5 text-[#a0a0b8] hover:bg-white/10"}`}>
              📋 Bulk Import
            </button>
            <button onClick={() => setMode("asin")} className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${mode === "asin" ? "bg-[#ff9900] text-black" : "bg-white/5 text-[#a0a0b8] hover:bg-white/10"}`}>
              🔍 Fetch by ASIN
            </button>
            <button onClick={() => setMode("manual")} className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${mode === "manual" ? "bg-indigo-500 text-white" : "bg-white/5 text-[#a0a0b8] hover:bg-white/10"}`}>
              ✏️ Manual Entry
            </button>
          </div>

          {mode === "bulk" ? (
            <div>
              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4"
              >
                <div>
                  <label className="block text-sm text-[#a0a0b8] mb-1.5">Marketplace*</label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] appearance-auto"
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
                  <label className="block text-sm text-[#a0a0b8] mb-1.5">Title Prefix (optional)</label>
                  <input
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                    value={bulkPrefix}
                    onChange={(event) => setBulkPrefix(event.target.value)}
                    placeholder="e.g. Electronics"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm text-[#a0a0b8] mb-1.5">
                  Paste ASINs (one per line, comma-separated, or mixed text)
                </label>
                <textarea
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] min-h-[160px] resize-y font-mono leading-relaxed"
                  value={bulkAsins}
                  onChange={(event) => setBulkAsins(event.target.value)}
                  placeholder={"B0DNMW96QT\nB0DZLWGSZZ\nB0DYNXCHND"}
                />
                <div
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-2"
                >
                  <span className="text-xs text-[#6b6b85]">
                    {analyzeBulkAsins(bulkAsins).uniqueCount} unique valid ASINs detected
                  </span>
                  <div className="flex flex-wrap gap-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={handleCsvUpload}
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#a0a0b8] font-medium cursor-pointer text-sm hover:bg-white/10 transition-colors">
                      📂 Upload CSV/TXT
                    </button>
                  </div>
                </div>
                {bulkAsins.trim() ? (
                  <>
                    <div className="mt-3 grid grid-cols-2 xl:grid-cols-4 gap-2">
                      {[
                        { label: "Detected", value: analyzeBulkAsins(bulkAsins).rawCount },
                        { label: "Valid", value: analyzeBulkAsins(bulkAsins).validCount },
                        { label: "Unique", value: analyzeBulkAsins(bulkAsins).uniqueCount },
                        {
                          label: "Invalid/Duplicate",
                          value:
                            analyzeBulkAsins(bulkAsins).invalidCount +
                            analyzeBulkAsins(bulkAsins).duplicateCount,
                        },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                          <div className="text-[0.68rem] uppercase tracking-wide text-[#8b8ba7]">{item.label}</div>
                          <div className="mt-1 text-base font-semibold text-[#f0f0f5]">{item.value}</div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 mb-0 text-xs text-[#8b8ba7] leading-relaxed">
                      Only valid ASINs are imported. Duplicate ASINs in the pasted batch are merged automatically before submission.
                    </p>
                  </>
                ) : null}
              </div>

              <button
                onClick={() => void handleBulkImport()}
                disabled={importing || parseAsins(bulkAsins).length === 0}
                className={`w-full px-6 py-3 border-none rounded-lg font-bold text-sm transition-opacity ${importing ? "bg-white/20 text-white/50 cursor-not-allowed" : "bg-gradient-to-br from-emerald-500 to-emerald-400 text-black cursor-pointer hover:opacity-90"}`}
              >
                {importing ? "⏳ Importing..." : `🚀 Import ${parseAsins(bulkAsins).length} ASINs`}
              </button>

              {importResults ? (
                <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <h4 className="text-emerald-400 font-semibold mb-3 m-0">
                    ✅ Import Complete
                  </h4>
                  <div className="flex flex-wrap gap-6">
                    <span className="text-sm text-[#f0f0f5]">
                      📊 Total: <strong>{importResults.summary.total}</strong>
                    </span>
                    <span className="text-sm text-emerald-400">
                      ✅ Created: <strong>{importResults.summary.created}</strong>
                    </span>
                    <span className="text-sm text-amber-500">
                      ⚠️ Already existed: <strong>{importResults.summary.already_existed}</strong>
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === "asin" ? (
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1">
                <label className="block text-sm text-[#a0a0b8] mb-1.5">ASIN*</label>
                <input
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                  value={form.asin}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, asin: event.target.value.toUpperCase() }))
                  }
                  placeholder="B09V3KXJPB"
                  maxLength={10}
                />
              </div>
              <button onClick={() => void handleFetchAsin()} disabled={fetching} className={`px-6 py-2.5 bg-gradient-to-br from-[#ff9900] to-[#ffad33] border-none rounded-lg text-black font-semibold cursor-pointer text-sm transition-opacity ${fetching ? "opacity-60" : "hover:opacity-90"}`}>
                {fetching ? "Fetching..." : "Fetch"}
              </button>
            </div>
          ) : null}

          {mode === "manual" ? (
            <form
              onSubmit={(event) => void handleManualSubmit(event)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div>
                <label className="block text-sm text-[#a0a0b8] mb-1.5">ASIN*</label>
                <input
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                  value={form.asin}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, asin: event.target.value.toUpperCase() }))
                  }
                  required
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-sm text-[#a0a0b8] mb-1.5">Title*</label>
                <input
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-[#a0a0b8] mb-1.5">Marketplace</label>
                <select
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] appearance-auto"
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
                <label className="block text-sm text-[#a0a0b8] mb-1.5">Category</label>
                <input
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, category: event.target.value }))
                  }
                />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-sm text-[#a0a0b8] mb-1.5">Image URL*</label>
                <input
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                  value={form.image_url}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, image_url: event.target.value }))
                  }
                  required
                  type="url"
                />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <button type="submit" className="px-6 py-2.5 bg-indigo-500 border-none rounded-lg text-white font-semibold cursor-pointer text-sm hover:bg-indigo-600 transition-colors">
                  Add Product
                </button>
              </div>
            </form>
          ) : null}

          {error ? (
            <p className="text-red-500 text-sm mt-4 m-0">
              ❌ {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="text-[#6b6b85] m-0">Loading...</p>
      ) : (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
            {[
              {
                label: "Total",
                value: productSummary.totalProducts,
                tone: "text-[#f0f0f5]",
              },
              {
                label: "Active",
                value: productSummary.activeProducts,
                tone: "text-emerald-400",
              },
              {
                label: "Pending Review",
                value: productSummary.pendingReviewProducts,
                tone: "text-amber-400",
              },
              {
                label: "Rejected",
                value: productSummary.rejectedProducts,
                tone: "text-red-400",
              },
              {
                label: "Needs Refresh",
                value: productSummary.needsRefreshProducts,
                tone: "text-indigo-300",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-4"
              >
                <p className="text-[#8d8da6] text-xs uppercase tracking-[0.2em] mb-2 m-0">
                  {item.label}
                </p>
                <p className={`text-2xl font-bold m-0 ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
          <p className="text-[#6b6b85] text-sm mb-4 m-0">
            Showing {products.length} of {productPagination.totalItems} products
          </p>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 flex flex-col gap-3"
              >
                <div
                  className="w-full aspect-square bg-white rounded-xl flex items-center justify-center overflow-hidden"
                >
                  <img
                    src={product.image_url}
                    alt={product.title}
                    className="max-w-[80%] max-h-[80%] object-contain"
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${product.status === "active" ? "bg-emerald-500/15 text-emerald-400" : product.status === "rejected" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}
                    >
                      {product.status.replace("_", " ")}
                    </span>
                    {!product.is_active ? (
                      <span
                        className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 text-xs font-bold"
                      >
                        inactive
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-sm font-semibold text-[#f0f0f5] leading-snug line-clamp-2 m-0 mt-1">
                    {product.title}
                  </h3>
                  <p className="text-xs text-[#6b6b85] mt-2 m-0 leading-relaxed">
                    ASIN: {product.asin} · {product.marketplace} · {product.agent_count} agents ·{" "}
                    {product.total_clicks} clicks
                  </p>
                </div>
                <div className="mt-auto grid grid-cols-1 gap-2">
                  <button
                    onClick={() => void handleProductRefresh(product.id)}
                    disabled={refreshingProductId === product.id || deletingProductId === product.id}
                    className={`px-4 py-2 border rounded-lg font-medium text-sm transition-colors ${
                      refreshingProductId === product.id
                        ? "border-white/10 bg-white/5 text-[#6b6b85] cursor-not-allowed"
                        : "border-indigo-500/30 bg-indigo-500/10 text-indigo-200 cursor-pointer hover:bg-indigo-500/20"
                    }`}
                  >
                    {refreshingProductId === product.id ? "Refreshing..." : "Refresh Data"}
                  </button>
                  <button
                    onClick={() => void handleProductDelete(product.id)}
                    disabled={deletingProductId === product.id || refreshingProductId === product.id}
                    className={`px-4 py-2 border rounded-lg font-medium text-sm transition-colors ${
                      deletingProductId === product.id
                        ? "border-white/10 bg-white/5 text-[#6b6b85] cursor-not-allowed"
                        : "border-red-500/30 bg-red-500/10 text-red-300 cursor-pointer hover:bg-red-500/20"
                    }`}
                  >
                    {deletingProductId === product.id ? "Removing..." : "Remove Product"}
                  </button>
                </div>
              </div>
            ))}
            {products.length === 0 ? (
              <p className="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 text-center text-[#6b6b85] p-8 m-0">
                No products yet. Use bulk import, portal submissions, or sheet sync to add ASINs.
              </p>
            ) : null}
          </div>
          {productPagination.totalPages > 1 ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-6">
              <p className="text-[#6b6b85] text-sm m-0">
                Page {productPagination.page} of {productPagination.totalPages}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => void fetchProducts(productPagination.page - 1)}
                  disabled={loading || productPagination.page <= 1}
                  className={`px-4 py-2 border rounded-lg font-medium text-sm transition-colors ${
                    productPagination.page > 1
                      ? "border-white/10 bg-white/5 text-[#d4d4e4] cursor-pointer hover:bg-white/10"
                      : "border-white/10 bg-white/5 text-[#6b6b85] cursor-not-allowed"
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => void fetchProducts(productPagination.page + 1)}
                  disabled={loading || productPagination.page >= productPagination.totalPages}
                  className={`px-4 py-2 border rounded-lg font-medium text-sm transition-colors ${
                    productPagination.page < productPagination.totalPages
                      ? "border-white/10 bg-white/5 text-[#d4d4e4] cursor-pointer hover:bg-white/10"
                      : "border-white/10 bg-white/5 text-[#6b6b85] cursor-not-allowed"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
