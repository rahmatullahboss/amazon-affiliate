import { useState, useEffect } from "react";

interface Agent {
  id: number; slug: string; name: string; email: string | null;
  phone: string | null; is_active: number; tracking_count: number;
  product_count: number; total_clicks: number;
}

const getToken = () => localStorage.getItem("auth_token") || "";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", email: "", phone: "" });
  const [error, setError] = useState("");

  useEffect(() => { fetchAgents(); }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents", { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) { const data = await res.json() as { agents: Agent[] }; setAgents(data.agents); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
      setShowForm(false); setForm({ name: "", slug: "", email: "", phone: "" });
      fetchAgents();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  };

  const toggleActive = async (id: number, isActive: number) => {
    await fetch(`/api/agents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ is_active: !isActive }),
    });
    fetchAgents();
  };

  const cardStyle: React.CSSProperties = { background: "rgba(26, 26, 40, 0.9)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "1rem", padding: "1.5rem" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "0.625rem 0.875rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.5rem", color: "#f0f0f5", fontSize: "0.875rem" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f0f0f5" }}>Agents</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "0.5rem 1rem", background: "linear-gradient(135deg, #ff9900, #ffad33)", border: "none", borderRadius: "0.5rem", color: "#000", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}>
          {showForm ? "Cancel" : "+ Add Agent"}
        </button>
      </div>

      {showForm && (
        <div style={{ ...cardStyle, marginBottom: "1.5rem" }}>
          <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Name*</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Slug* (URL-safe)</label>
              <input style={inputStyle} value={form.slug} onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})} required placeholder="agent-name" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Email</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#a0a0b8", marginBottom: "0.375rem" }}>Phone</label>
              <input style={inputStyle} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: "0.5rem" }}>{error}</p>}
              <button type="submit" style={{ padding: "0.625rem 1.5rem", background: "#6366f1", border: "none", borderRadius: "0.5rem", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Create Agent</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p style={{ color: "#6b6b85" }}>Loading...</p> : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {agents.map(agent => (
            <div key={agent.id} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1rem", fontWeight: 600, color: "#f0f0f5" }}>{agent.name}</span>
                  <span style={{ fontSize: "0.7rem", padding: "0.125rem 0.5rem", borderRadius: "9999px", background: agent.is_active ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: agent.is_active ? "#22c55e" : "#ef4444" }}>{agent.is_active ? "Active" : "Inactive"}</span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#6b6b85", marginTop: "0.25rem" }}>
                  /{agent.slug} · {agent.tracking_count} tags · {agent.product_count} products · {agent.total_clicks} clicks
                </div>
              </div>
              <button onClick={() => toggleActive(agent.id, agent.is_active)} style={{ padding: "0.375rem 0.75rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", color: "#a0a0b8", fontSize: "0.75rem", cursor: "pointer" }}>{agent.is_active ? "Deactivate" : "Activate"}</button>
            </div>
          ))}
          {agents.length === 0 && <p style={{ color: "#6b6b85", textAlign: "center", padding: "2rem" }}>No agents yet. Create your first agent above.</p>}
        </div>
      )}
    </div>
  );
}
