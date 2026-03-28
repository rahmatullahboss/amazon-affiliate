import { useState, useEffect } from "react";

const getToken = () => localStorage.getItem("auth_token") || "";

interface TrackingId {
  id: number; agent_id: number; tag: string; label: string | null;
  marketplace: string; is_default: number; is_active: number;
  agent_name: string; agent_slug: string;
}
interface Agent { id: number; name: string; slug: string; }

export default function TrackingPage() {
  const [trackingIds, setTrackingIds] = useState<TrackingId[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ agent_id: 0, tag: "", label: "", marketplace: "US", is_default: false });
  const [error, setError] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const h = { Authorization: `Bearer ${getToken()}` };
    const [tRes, aRes] = await Promise.all([
      fetch("/api/tracking", { headers: h }),
      fetch("/api/agents", { headers: h }),
    ]);
    if (tRes.ok) { const d = await tRes.json() as { trackingIds: TrackingId[] }; setTrackingIds(d.trackingIds); }
    if (aRes.ok) { const d = await aRes.json() as { agents: Agent[] }; setAgents(d.agents); }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ...form, agent_id: Number(form.agent_id) }),
      });
      if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
      setShowForm(false); setForm({ agent_id: 0, tag: "", label: "", marketplace: "US", is_default: false });
      fetchAll();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this tracking ID?")) return;
    await fetch(`/api/tracking/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
    fetchAll();
  };

  const inputStyle: React.CSSProperties = { width: "100%", padding: "0.625rem 0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.5rem", color: "#f0f0f5", fontSize: "0.875rem" };
  const cardStyle: React.CSSProperties = { background: "rgba(26,26,40,0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "1rem", padding: "1.5rem" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f0f0f5" }}>Tracking IDs</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "0.5rem 1rem", background: "linear-gradient(135deg, #ff9900, #ffad33)", border: "none", borderRadius: "0.5rem", color: "#000", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}>{showForm ? "Cancel" : "+ Add Tracking ID"}</button>
      </div>

      {showForm && (
        <div style={{ ...cardStyle, marginBottom: "1.5rem" }}>
          <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Agent*</label>
              <select style={inputStyle} value={form.agent_id} onChange={e => setForm({...form, agent_id: Number(e.target.value)})} required>
                <option value={0}>Select agent...</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name} (/{a.slug})</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Tag* (Amazon Tracking ID)</label>
              <input style={inputStyle} value={form.tag} onChange={e => setForm({...form, tag: e.target.value})} required placeholder="agent-name-20" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Marketplace</label>
              <select style={inputStyle} value={form.marketplace} onChange={e => setForm({...form, marketplace: e.target.value})}>
                {["US","CA","UK","DE","IT","FR","ES"].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "#a0a0b8", cursor: "pointer" }}>
                <input type="checkbox" checked={form.is_default} onChange={e => setForm({...form, is_default: e.target.checked})} />
                Set as default tag
              </label>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: "0.5rem" }}>{error}</p>}
              <button type="submit" style={{ padding: "0.625rem 1.5rem", background: "#6366f1", border: "none", borderRadius: "0.5rem", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Add Tracking ID</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p style={{ color: "#6b6b85" }}>Loading...</p> : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {trackingIds.map(t => (
            <div key={t.id} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <code style={{ fontSize: "0.9rem", color: "#ff9900", fontWeight: 600 }}>{t.tag}</code>
                  {t.is_default ? <span style={{ fontSize: "0.65rem", padding: "0.125rem 0.375rem", borderRadius: "999px", background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>DEFAULT</span> : null}
                  <span style={{ fontSize: "0.65rem", padding: "0.125rem 0.375rem", borderRadius: "999px", background: "rgba(255,153,0,0.15)", color: "#ffad33" }}>{t.marketplace}</span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#6b6b85", marginTop: "0.25rem" }}>
                  Agent: {t.agent_name} · {t.label || "No label"}
                </div>
              </div>
              <button onClick={() => handleDelete(t.id)} style={{ padding: "0.25rem 0.5rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "0.375rem", color: "#ef4444", fontSize: "0.7rem", cursor: "pointer" }}>Delete</button>
            </div>
          ))}
          {trackingIds.length === 0 && <p style={{ color: "#6b6b85", textAlign: "center", padding: "2rem" }}>No tracking IDs yet.</p>}
        </div>
      )}
    </div>
  );
}
