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

  // Styles migrated to Tailwind CSS

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#f0f0f5] m-0">Agent ↔ Product Mappings</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-gradient-to-br from-[#ff9900] to-[#ffad33] border-none rounded-lg text-black font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap">
          {showForm ? "Cancel" : "+ Create Mapping"}
        </button>
      </div>

      {showForm && (
        <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 mb-6">
          <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Agent*</label>
              <select className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] appearance-auto" value={form.agent_id} onChange={e => setForm({...form, agent_id: Number(e.target.value), tracking_id: 0})} required>
                <option className="bg-gray-800" value={0}>Select agent...</option>
                {agents.map(a => <option className="bg-gray-800" key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Product*</label>
              <select className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] appearance-auto" value={form.product_id} onChange={e => setForm({...form, product_id: Number(e.target.value)})} required>
                <option className="bg-gray-800" value={0}>Select product...</option>
                {products.map(p => <option className="bg-gray-800" key={p.id} value={p.id}>{p.title} ({p.asin})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Tag*</label>
              <select className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] appearance-auto" value={form.tracking_id} onChange={e => setForm({...form, tracking_id: Number(e.target.value)})} required>
                <option className="bg-gray-800" value={0}>Select tracking tag...</option>
                {filteredTracking.map(t => <option className="bg-gray-800" key={t.id} value={t.id}>{t.tag} {t.label ? `(${t.label})` : ""}</option>)}
              </select>
              {form.agent_id > 0 && filteredTracking.length === 0 && (
                <p className="text-[0.7rem] text-[#f59e0b] mt-1 m-0">No tags for this agent. Create one first.</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Custom Title (optional)</label>
              <input className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]" value={form.custom_title} onChange={e => setForm({...form, custom_title: e.target.value})} placeholder="Override product title" />
            </div>
            <div className="col-span-1 sm:col-span-2 mt-2">
              {error && <p className="text-red-500 text-sm mb-3 m-0">{error}</p>}
              <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-indigo-500 border-none rounded-lg text-white font-semibold cursor-pointer hover:bg-indigo-600 transition-colors">Create Mapping</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className="text-[#6b6b85] m-0">Loading...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {mappings.map(m => (
            <div key={m.id} className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl flex flex-col gap-4 p-5 justify-between">
              <div className="flex items-center gap-3">
                <img src={m.image_url} alt="" className="w-12 h-12 object-contain rounded-lg bg-white shrink-0 p-1" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#f0f0f5] truncate">{m.agent_name} → {m.custom_title || m.product_title}</div>
                  <div className="text-xs text-[#6b6b85] mt-1 truncate">ASIN: {m.asin} · Tag: <code className="text-[#ff9900] bg-white/5 px-1 rounded">{m.tracking_tag}</code></div>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-auto pt-2 border-t border-white/5">
                <button onClick={() => void copyLink(m.agent_slug, m.asin)} className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-md text-xs font-medium cursor-pointer hover:bg-indigo-500/20 transition-colors">📋 Copy Link</button>
                <button onClick={() => void handleDelete(m.id)} className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-md text-xs font-medium cursor-pointer hover:bg-red-500/20 transition-colors">Delete</button>
              </div>
            </div>
          ))}
          {mappings.length === 0 && <p className="col-span-1 md:col-span-2 xl:col-span-3 text-center text-[#6b6b85] p-8 m-0">No mappings yet. Create one to generate shareable links.</p>}
        </div>
      )}
    </div>
  );
}
