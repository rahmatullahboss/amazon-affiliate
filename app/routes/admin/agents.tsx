import { useState, useEffect } from "react";
import { getAuthToken } from "../../utils/auth-session";

interface Agent {
  id: number; slug: string; name: string; email: string | null;
  phone: string | null; is_active: number; tracking_count: number;
  product_count: number; total_clicks: number;
  user_count: number;
  last_click_at: string | null;
  total_ordered_items: number;
  total_returned_items: number;
  total_revenue: number;
  total_commission: number;
}

const getToken = () => getAuthToken();

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

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#f0f0f5] m-0">Agents</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-gradient-to-br from-[#ff9900] to-[#ffad33] border-none rounded-lg text-black font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap">
          {showForm ? "Cancel" : "+ Add Agent"}
        </button>
      </div>

      {showForm && (
        <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 mb-6">
          <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Name*</label>
              <input className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Slug* (URL-safe)</label>
              <input className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]" value={form.slug} onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})} required placeholder="agent-name" />
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Email</label>
              <input className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Phone</label>
              <input className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div className="col-span-1 sm:col-span-2 mt-2">
              {error && <p className="text-red-500 text-sm m-0 mb-3">{error}</p>}
              <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-indigo-500 border-none rounded-lg text-white font-semibold cursor-pointer hover:bg-indigo-600 transition-colors">Create Agent</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className="text-[#6b6b85] m-0">Loading...</p> : (
        <div className="flex flex-col gap-3">
          {agents.map(agent => (
            <div key={agent.id} className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="min-w-0 w-full sm:w-auto">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-base font-semibold text-[#f0f0f5] truncate">{agent.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${agent.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>{agent.is_active ? "Active" : "Inactive"}</span>
                </div>
                <div className="text-sm text-[#6b6b85] truncate mt-2">
                  /{agent.slug} · {agent.tracking_count} tags · {agent.product_count} products · {agent.total_clicks} clicks
                </div>
                <div className="text-sm text-[#8d8da6] mt-2 leading-relaxed">
                  Orders: {agent.total_ordered_items} · Returns: {agent.total_returned_items} · Revenue: ${agent.total_revenue.toFixed(2)} · Commission: ${agent.total_commission.toFixed(2)}
                </div>
                <div className="text-xs text-[#6b6b85] mt-2 leading-relaxed">
                  {agent.email || "No email"} · {agent.phone || "No phone"} · {agent.user_count} login account{agent.user_count === 1 ? "" : "s"} · Last click: {agent.last_click_at ? new Date(agent.last_click_at).toLocaleString() : "Never"}
                </div>
              </div>
              <button onClick={() => void toggleActive(agent.id, agent.is_active)} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-[#a0a0b8] text-xs font-medium cursor-pointer hover:bg-white/10 transition-colors shrink-0">{agent.is_active ? "Deactivate" : "Activate"}</button>
            </div>
          ))}
          {agents.length === 0 && <p className="text-center text-[#6b6b85] p-8 m-0 border border-white/10 rounded-2xl border-dashed">No agents yet. Create your first agent above.</p>}
        </div>
      )}
    </div>
  );
}
