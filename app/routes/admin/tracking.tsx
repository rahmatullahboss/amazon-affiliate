import { useState, useEffect } from "react";
import { getAuthToken } from "../../utils/auth-session";

const getToken = () => getAuthToken();

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
    if (!confirm("Delete this tag?")) return;
    await fetch(`/api/tracking/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
    fetchAll();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#f0f0f5] m-0">Tags</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-gradient-to-br from-[#ff9900] to-[#ffad33] border-none rounded-lg text-black font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap">{showForm ? "Cancel" : "+ Add Tag"}</button>
      </div>

      {showForm && (
        <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 mb-6">
          <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Agent*</label>
              <select className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] appearance-auto" value={form.agent_id} onChange={e => setForm({...form, agent_id: Number(e.target.value)})} required>
                <option className="bg-gray-800" value={0}>Select agent...</option>
                {agents.map(a => <option className="bg-gray-800" key={a.id} value={a.id}>{a.name} (/{a.slug})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Tag*</label>
              <input className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]" value={form.tag} onChange={e => setForm({...form, tag: e.target.value})} required placeholder="agent-name-20 or ?tag=agent-name-20" />
              <p className="mt-2 text-xs text-[#8b8ba7] leading-relaxed m-0">
                You can paste only the tag or the full tag format. The system stores the clean tag automatically.
              </p>
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Marketplace</label>
              <select className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] appearance-auto" value={form.marketplace} onChange={e => setForm({...form, marketplace: e.target.value})}>
                {["US","CA","UK","DE","IT","FR","ES"].map(m => <option className="bg-gray-800" key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-3 h-full mb-[0.125rem]">
              <label className="flex items-center gap-2 text-sm text-[#a0a0b8] cursor-pointer">
                <input className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[#ff9900] focus:ring-[#ff9900]" type="checkbox" checked={form.is_default} onChange={e => setForm({...form, is_default: e.target.checked})} />
                Set as default tag
              </label>
            </div>
            <div className="col-span-1 sm:col-span-2 mt-2">
              {error && <p className="text-red-500 text-sm m-0 mb-3">{error}</p>}
              <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-indigo-500 border-none rounded-lg text-white font-semibold cursor-pointer hover:bg-indigo-600 transition-colors">Add Tag</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className="text-[#6b6b85] m-0">Loading...</p> : (
        <div className="flex flex-col gap-3">
          {trackingIds.map(t => (
            <div key={t.id} className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="min-w-0 w-full sm:w-auto">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <code className="text-sm text-[#ff9900] font-semibold bg-[#ff9900]/10 px-2.5 py-1 rounded-md">{t.tag}</code>
                  {t.is_default ? <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-medium">DEFAULT</span> : null}
                  <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-[#ff9900]/15 text-[#ffad33] font-medium">{t.marketplace}</span>
                </div>
                <div className="text-sm text-[#6b6b85] truncate mt-2">
                  Agent: {t.agent_name} · {t.label || "No label"}
                </div>
              </div>
              <button onClick={() => void handleDelete(t.id)} className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 text-xs font-medium cursor-pointer hover:bg-red-500/20 transition-colors shrink-0">Delete</button>
            </div>
          ))}
          {trackingIds.length === 0 && <p className="text-center text-[#6b6b85] p-8 m-0 border border-white/10 rounded-2xl border-dashed">No tags yet.</p>}
        </div>
      )}
    </div>
  );
}
