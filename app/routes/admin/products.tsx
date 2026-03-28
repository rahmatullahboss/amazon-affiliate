import { useState, useEffect, useRef } from "react";

interface Product {
  id: number; asin: string; title: string; image_url: string;
  marketplace: string; category: string | null; is_active: number;
  agent_count: number; total_clicks: number;
}

interface ImportResult {
  asin: string;
  status: "created" | "exists" | "error";
  error?: string;
}

const MARKETPLACES = ["US", "CA", "UK", "DE", "IT", "FR", "ES"] as const;
const getToken = () => localStorage.getItem("auth_token") || "";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<"asin" | "manual" | "bulk">("bulk");
  const [form, setForm] = useState({ asin: "", title: "", image_url: "", marketplace: "US", category: "" });
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(false);

  // Bulk import state
  const [bulkAsins, setBulkAsins] = useState("");
  const [bulkMarketplace, setBulkMarketplace] = useState("US");
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ results: ImportResult[]; summary: { total: number; created: number; already_existed: number } } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products", { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) { const d = await res.json() as { products: Product[] }; setProducts(d.products); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleFetchAsin = async () => {
    if (!form.asin || form.asin.length !== 10) { setError("ASIN must be 10 characters"); return; }
    setFetching(true); setError("");
    try {
      const res = await fetch("/api/products/fetch-asin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ asin: form.asin, marketplace: form.marketplace }),
      });
      if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
      setShowForm(false); setForm({ asin: "", title: "", image_url: "", marketplace: "US", category: "" });
      fetchProducts();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to fetch ASIN"); }
    finally { setFetching(false); }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
      setShowForm(false); setForm({ asin: "", title: "", image_url: "", marketplace: "US", category: "" });
      fetchProducts();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  };

  // ─── Bulk Import ────────────────────────────────────
  const parseAsins = (text: string): string[] => {
    return text
      .split(/[\n,\t\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(s => /^B[A-Z0-9]{9}$/.test(s));
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      // Extract all ASINs from CSV content
      const asins = parseAsins(text);
      setBulkAsins(asins.join("\n"));
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async () => {
    const asins = parseAsins(bulkAsins);
    if (asins.length === 0) { setError("No valid ASINs found. ASINs start with 'B' and are 10 characters long."); return; }
    if (asins.length > 500) { setError("Max 500 ASINs per import."); return; }

    setImporting(true); setError(""); setImportResults(null);
    try {
      const res = await fetch("/api/products/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          asins,
          marketplace: bulkMarketplace,
          default_title_prefix: bulkPrefix || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
      const data = await res.json() as { results: ImportResult[]; summary: { total: number; created: number; already_existed: number } };
      setImportResults(data);
      fetchProducts();
    } catch (err) { setError(err instanceof Error ? err.message : "Import failed"); }
    finally { setImporting(false); }
  };

  const handleExport = () => {
    window.open(`/api/products/export?token=${getToken()}`, "_blank");
  };

  // ─── Styles ─────────────────────────────────────────
  const cardStyle: React.CSSProperties = { background: "rgba(26, 26, 40, 0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "1rem", padding: "1.5rem" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "0.625rem 0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.5rem", color: "#f0f0f5", fontSize: "0.875rem", outline: "none" };
  const btnPrimary: React.CSSProperties = { padding: "0.625rem 1.5rem", background: "linear-gradient(135deg, #ff9900, #ffad33)", border: "none", borderRadius: "0.5rem", color: "#000", fontWeight: 600, cursor: "pointer", fontSize: "0.875rem" };
  const btnSecondary: React.CSSProperties = { padding: "0.5rem 1rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.5rem", color: "#a0a0b8", fontWeight: 500, cursor: "pointer", fontSize: "0.8rem" };

  const tabBtn = (active: boolean, color: string): React.CSSProperties => ({
    padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer",
    background: active ? color : "rgba(255,255,255,0.05)",
    color: active ? (color === "#ff9900" ? "#000" : "#fff") : "#a0a0b8",
    fontWeight: 600, fontSize: "0.8rem",
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f0f0f5" }}>Products</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={handleExport} style={btnSecondary}>📥 Export CSV</button>
          <button onClick={() => { setShowForm(!showForm); setImportResults(null); setError(""); }} style={btnPrimary}>
            {showForm ? "Cancel" : "+ Add Product"}
          </button>
        </div>
      </div>

      {/* Add Product Form */}
      {showForm && (
        <div style={{ ...cardStyle, marginBottom: "1.5rem" }}>
          {/* Mode tabs */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button onClick={() => setMode("bulk")} style={tabBtn(mode === "bulk", "#10b981")}>📋 Bulk Import</button>
            <button onClick={() => setMode("asin")} style={tabBtn(mode === "asin", "#ff9900")}>🔍 Fetch by ASIN</button>
            <button onClick={() => setMode("manual")} style={tabBtn(mode === "manual", "#6366f1")}>✏️ Manual Entry</button>
          </div>

          {/* ─── BULK IMPORT ─── */}
          {mode === "bulk" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Marketplace*</label>
                  <select
                    style={{ ...inputStyle, appearance: "auto" }}
                    value={bulkMarketplace}
                    onChange={e => setBulkMarketplace(e.target.value)}
                  >
                    {MARKETPLACES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Title Prefix (optional)</label>
                  <input
                    style={inputStyle}
                    value={bulkPrefix}
                    onChange={e => setBulkPrefix(e.target.value)}
                    placeholder="e.g. Electronics"
                  />
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>
                  Paste ASINs (one per line, comma-separated, or any format)
                </label>
                <textarea
                  style={{ ...inputStyle, minHeight: "160px", resize: "vertical", fontFamily: "monospace", lineHeight: 1.6 }}
                  value={bulkAsins}
                  onChange={e => setBulkAsins(e.target.value)}
                  placeholder={"B0DNMW96QT\nB0DZLWGSZZ\nB0DYNXCHND\nB0CRL3RV58\n..."}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem" }}>
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
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={btnSecondary}
                    >
                      📂 Upload CSV/TXT
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={handleBulkImport}
                disabled={importing || parseAsins(bulkAsins).length === 0}
                style={{ ...btnPrimary, background: importing ? "#666" : "linear-gradient(135deg, #10b981, #34d399)", width: "100%", padding: "0.75rem" }}
              >
                {importing ? "⏳ Importing..." : `🚀 Import ${parseAsins(bulkAsins).length} ASINs`}
              </button>

              {/* Import Results */}
              {importResults && (
                <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "0.75rem" }}>
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
              )}
            </div>
          )}

          {/* ─── FETCH BY ASIN ─── */}
          {mode === "asin" && (
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>ASIN*</label>
                <input style={inputStyle} value={form.asin} onChange={e => setForm({...form, asin: e.target.value.toUpperCase()})} placeholder="B09V3KXJPB" maxLength={10} />
              </div>
              <button onClick={handleFetchAsin} disabled={fetching} style={{ ...btnPrimary, opacity: fetching ? 0.6 : 1 }}>{fetching ? "Fetching..." : "Fetch"}</button>
            </div>
          )}

          {/* ─── MANUAL ENTRY ─── */}
          {mode === "manual" && (
            <form onSubmit={handleManualSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>ASIN*</label>
                <input style={inputStyle} value={form.asin} onChange={e => setForm({...form, asin: e.target.value.toUpperCase()})} required maxLength={10} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Title*</label>
                <input style={inputStyle} value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Marketplace</label>
                <select style={{ ...inputStyle, appearance: "auto" }} value={form.marketplace} onChange={e => setForm({...form, marketplace: e.target.value})}>
                  {MARKETPLACES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Category</label>
                <input style={inputStyle} value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Image URL*</label>
                <input style={inputStyle} value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} required type="url" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <button type="submit" style={{ ...btnPrimary, background: "#6366f1" }}>Add Product</button>
              </div>
            </form>
          )}

          {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.75rem" }}>❌ {error}</p>}
        </div>
      )}

      {/* Product Grid */}
      {loading ? <p style={{ color: "#6b6b85" }}>Loading...</p> : (
        <div>
          <p style={{ color: "#6b6b85", fontSize: "0.8rem", marginBottom: "1rem" }}>{products.length} products total</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
            {products.map(p => (
              <div key={p.id} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ width: "100%", aspectRatio: "1", background: "#fff", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <img src={p.image_url} alt={p.title} style={{ maxWidth: "80%", maxHeight: "80%", objectFit: "contain" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f0f0f5", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</h3>
                  <p style={{ fontSize: "0.75rem", color: "#6b6b85", marginTop: "0.25rem" }}>ASIN: {p.asin} · {p.marketplace} · {p.agent_count} agents · {p.total_clicks} clicks</p>
                </div>
              </div>
            ))}
            {products.length === 0 && <p style={{ color: "#6b6b85", textAlign: "center", padding: "2rem", gridColumn: "1 / -1" }}>No products yet. Use Bulk Import to add ASINs from your sheet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
