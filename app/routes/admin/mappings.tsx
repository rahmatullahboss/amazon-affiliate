import { useState, useEffect } from "react";

const getToken = () => localStorage.getItem("auth_token") || "";

interface Mapping {
  id: number; agent_name: string; agent_slug: string; asin: string;
  product_title: string; image_url: string; tracking_tag: string; custom_title: string | null;
}
interface Agent { id: number; name: string; slug: string; }
interface Product { id: number; asin: string; title: string; }
interface TrackId { id: number; tag: string; agent_id: number; label: string | null; }

export default function MappingsPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [trackingIds, setTrackingIds] = useState<TrackId[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ agent_id: 0, product_id: 0, tracking_id: 0, custom_title: "" });
  const [error, setError] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const h = { Authorization: `Bearer ${getToken()}` };
    const [mRes, aRes, pRes, tRes] = await Promise.all([
      fetch("/api/mappings", { headers: h }),
      fetch("/api/agents", { headers: h }),
      fetch("/api/products", { headers: h }),
      fetch("/api/tracking", { headers: h }),
    ]);
    if (mRes.ok) { const d = await mRes.json() as { mappings: Mapping[] }; setMappings(d.mappings); }
    if (aRes.ok) { const d = await aRes.json() as { agents: Agent[] }; setAgents(d.agents); }
    if (pRes.ok) { const d = await pRes.json() as { products: Product[] }; setProducts(d.products); }
    if (tRes.ok) { const d = await tRes.json() as { trackingIds: TrackId[] }; setTrackingIds(d.trackingIds); }
    setLoading(false);
  };

  const filteredTracking = trackingIds.filter(t => t.agent_id === Number(form.agent_id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    try {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          agent_id: Number(form.agent_id), product_id: Number(form.product_id),
          tracking_id: Number(form.tracking_id), custom_title: form.custom_title || null,
        }),
      });
      if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
      setShowForm(false); setForm({ agent_id: 0, product_id: 0, tracking_id: 0, custom_title: "" });
      fetchAll();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this mapping?")) return;
    await fetch(`/api/mappings/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
    fetchAll();
  };

  const copyLink = (slug: string, asin: string) => {
    const link = `${window.location.origin}/${slug}/${asin}`;
    navigator.clipboard.writeText(link);
    alert(`Link copied: ${link}`);
  };

  const inputStyle: React.CSSProperties = { width: "100%", padding: "0.625rem 0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.5rem", color: "#f0f0f5", fontSize: "0.875rem" };
  const cardStyle: React.CSSProperties = { background: "rgba(26,26,40,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "1rem", padding: "1.5rem" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f0f0f5" }}>Agent ↔ Product Mappings</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "0.5rem 1rem", background: "linear-gradient(135deg, #ff9900, #ffad33)", border: "none", borderRadius: "0.5rem", color: "#000", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}>{showForm ? "Cancel" : "+ Create Mapping"}</button>
      </div>

      {showForm && (
        <div style={{ ...cardStyle, marginBottom: "1.5rem" }}>
          <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Agent*</label>
              <select style={inputStyle} value={form.agent_id} onChange={e => setForm({...form, agent_id: Number(e.target.value), tracking_id: 0})} required>
                <option value={0}>Select agent...</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Product*</label>
              <select style={inputStyle} value={form.product_id} onChange={e => setForm({...form, product_id: Number(e.target.value)})} required>
                <option value={0}>Select product...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.title} ({p.asin})</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Tracking ID*</label>
              <select style={inputStyle} value={form.tracking_id} onChange={e => setForm({...form, tracking_id: Number(e.target.value)})} required>
                <option value={0}>Select tracking tag...</option>
                {filteredTracking.map(t => <option key={t.id} value={t.id}>{t.tag} {t.label ? `(${t.label})` : ""}</option>)}
              </select>
              {form.agent_id > 0 && filteredTracking.length === 0 && (
                <p style={{ fontSize: "0.7rem", color: "#f59e0b", marginTop: "0.25rem" }}>No tracking IDs for this agent. Create one first.</p>
              )}
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Custom Title (optional)</label>
              <input style={inputStyle} value={form.custom_title} onChange={e => setForm({...form, custom_title: e.target.value})} placeholder="Override product title" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: "0.5rem" }}>{error}</p>}
              <button type="submit" style={{ padding: "0.625rem 1.5rem", background: "#6366f1", border: "none", borderRadius: "0.5rem", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Create Mapping</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p style={{ color: "#6b6b85" }}>Loading...</p> : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {mappings.map(m => (
            <div key={m.id} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <img src={m.image_url} alt="" style={{ width: "40px", height: "40px", objectFit: "contain", borderRadius: "0.375rem", background: "#fff" }} />
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f0f0f5" }}>{m.agent_name} → {m.custom_title || m.product_title}</div>
                  <div style={{ fontSize: "0.75rem", color: "#6b6b85" }}>ASIN: {m.asin} · Tag: <code style={{ color: "#ff9900" }}>{m.tracking_tag}</code></div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={() => copyLink(m.agent_slug, m.asin)} style={{ padding: "0.25rem 0.5rem", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "0.375rem", color: "#818cf8", fontSize: "0.7rem", cursor: "pointer" }}>📋 Copy Link</button>
                <button onClick={() => handleDelete(m.id)} style={{ padding: "0.25rem 0.5rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "0.375rem", color: "#ef4444", fontSize: "0.7rem", cursor: "pointer" }}>Delete</button>
              </div>
            </div>
          ))}
          {mappings.length === 0 && <p style={{ color: "#6b6b85", textAlign: "center", padding: "2rem" }}>No mappings yet. Create one to generate shareable links.</p>}
        </div>
      )}
    </div>
  );
}
