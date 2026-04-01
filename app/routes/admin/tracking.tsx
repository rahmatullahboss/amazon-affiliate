import { useEffect, useMemo, useState } from "react";
import { getAuthToken } from "../../utils/auth-session";
import { copyTextToClipboard } from "../../utils/clipboard";
import { buildMarketplaceReadyLinkTemplate } from "../../utils/public-links";

const getToken = () => getAuthToken();

interface TrackingId {
  id: number; agent_id: number; tag: string; label: string | null;
  marketplace: string; is_default: number; is_active: number; is_portal_editable: number;
  created_at?: string;
  agent_name: string; agent_slug: string; alias_slug?: string | null;
}
interface Agent { id: number; name: string; slug: string; }

export default function TrackingPage() {
  const [trackingIds, setTrackingIds] = useState<TrackingId[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ agent_id: 0, tag: "", label: "", marketplace: "US", is_default: false, is_portal_editable: false, alias_slug: "" });
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [marketplaceFilter, setMarketplaceFilter] = useState("ALL");
  const [copiedKey, setCopiedKey] = useState("");

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

  const filteredTrackingIds = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return trackingIds.filter((item) => {
      const matchesMarketplace =
        marketplaceFilter === "ALL" || item.marketplace === marketplaceFilter;

      if (!matchesMarketplace) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        item.tag,
        item.label || "",
        item.agent_name,
        item.agent_slug,
        item.marketplace,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [marketplaceFilter, searchQuery, trackingIds]);

  const groupedTrackingIds = useMemo(() => {
    const groups = new Map<number, { agent: Pick<TrackingId, "agent_id" | "agent_name" | "agent_slug">; tags: TrackingId[] }>();

    for (const item of filteredTrackingIds) {
      const existing = groups.get(item.agent_id);
      if (existing) {
        existing.tags.push(item);
        continue;
      }

      groups.set(item.agent_id, {
        agent: {
          agent_id: item.agent_id,
          agent_name: item.agent_name,
          agent_slug: item.agent_slug,
        },
        tags: [item],
      });
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        tags: group.tags.sort((left, right) => {
          if (left.marketplace !== right.marketplace) {
            return left.marketplace.localeCompare(right.marketplace);
          }

          if (left.is_default !== right.is_default) {
            return right.is_default - left.is_default;
          }

          return left.tag.localeCompare(right.tag);
        }),
      }))
      .sort((left, right) => left.agent.agent_name.localeCompare(right.agent.agent_name));
  }, [filteredTrackingIds]);

  const summary = useMemo(() => {
    const adminOnly = filteredTrackingIds.filter((item) => item.is_portal_editable !== 1).length;
    const portalEditable = filteredTrackingIds.filter((item) => item.is_portal_editable === 1).length;

    return {
      totalAgents: groupedTrackingIds.length,
      totalTags: filteredTrackingIds.length,
      adminOnly,
      portalEditable,
    };
  }, [filteredTrackingIds, groupedTrackingIds.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    try {
      const res = await fetch(editingId ? `/api/tracking/${editingId}` : "/api/tracking", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ...form, agent_id: Number(form.agent_id), alias_slug: form.alias_slug || null }),
      });
      if (!res.ok) { const d = await res.json() as { error: string }; throw new Error(d.error); }
      setShowForm(false); setEditingId(null); setForm({ agent_id: 0, tag: "", label: "", marketplace: "US", is_default: false, is_portal_editable: false, alias_slug: "" });
      fetchAll();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this tag?")) return;
    await fetch(`/api/tracking/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
    fetchAll();
  };

  async function handleCopyReadyLink(copyKey: string, text: string) {
    const copied = await copyTextToClipboard(text);
    if (!copied) {
      setError("Could not copy the ready link format.");
      return;
    }

    setCopiedKey(copyKey);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === copyKey ? "" : current));
    }, 2000);
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#f0f0f5] m-0">Tags</h1>
        <button onClick={() => {
          if (showForm) {
            setShowForm(false);
            setEditingId(null);
            setForm({ agent_id: 0, tag: "", label: "", marketplace: "US", is_default: false, is_portal_editable: false, alias_slug: "" });
            setError("");
          } else {
            setShowForm(true);
          }
        }} className="px-4 py-2 bg-gradient-to-br from-[#ff9900] to-[#ffad33] border-none rounded-lg text-black font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap">{showForm ? "Cancel" : "+ Add Tag"}</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Agents", value: summary.totalAgents },
          { label: "Visible Tags", value: summary.totalTags },
          { label: "Portal Editable", value: summary.portalEditable },
          { label: "Admin Only", value: summary.adminOnly },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/5 bg-[#1a1a28]/90 p-4">
            <div className="text-[0.68rem] uppercase tracking-[0.18em] text-[#8b8ba7]">{item.label}</div>
            <div className="mt-2 text-2xl font-bold text-[#f0f0f5]">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-4">
          <input
            className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
            placeholder="Search by tag, label, agent, or slug"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <select
            className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] appearance-auto"
            value={marketplaceFilter}
            onChange={(event) => setMarketplaceFilter(event.target.value)}
          >
            <option className="bg-gray-800" value="ALL">All Marketplaces</option>
            {["US", "CA", "UK", "DE", "IT", "FR", "ES"].map((marketplace) => (
              <option className="bg-gray-800" key={marketplace} value={marketplace}>
                {marketplace}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showForm && (
        <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 mb-6">
          <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Agent*</label>
              <select className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] appearance-auto" value={form.agent_id} onChange={e => setForm({...form, agent_id: Number(e.target.value)})} required disabled={editingId !== null}>
                <option className="bg-gray-800" value={0}>Select agent...</option>
                {agents.map(a => <option className="bg-gray-800" key={a.id} value={a.id}>{a.name} (/{a.slug})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Tag*</label>
              <input className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]" value={form.tag} onChange={e => setForm({...form, tag: e.target.value})} required placeholder="agent-name-20 or ?tag=agent-name-20" disabled={editingId !== null} />
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
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Public Slug Alias</label>
              <input
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                value={form.alias_slug}
                onChange={e => setForm({...form, alias_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")})}
                placeholder="agent-it or agent-us"
              />
              <p className="mt-2 text-xs text-[#8b8ba7] leading-relaxed m-0">
                Optional marketplace-specific public slug. If set, links use this slug instead of the base agent slug.
              </p>
            </div>
            <div className="flex items-end gap-3 h-full mb-[0.125rem]">
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-[#a0a0b8] cursor-pointer">
                  <input className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[#ff9900] focus:ring-[#ff9900]" type="checkbox" checked={form.is_default} onChange={e => setForm({...form, is_default: e.target.checked})} />
                  Set as default tag
                </label>
                <label className="flex items-center gap-2 text-sm text-[#a0a0b8] cursor-pointer">
                  <input className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[#ff9900] focus:ring-[#ff9900]" type="checkbox" checked={form.is_portal_editable} onChange={e => setForm({...form, is_portal_editable: e.target.checked})} />
                  Agent can edit in portal
                </label>
              </div>
            </div>
            <div className="col-span-1 sm:col-span-2 mt-2">
              {error && <p className="text-red-500 text-sm m-0 mb-3">{error}</p>}
              <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-indigo-500 border-none rounded-lg text-white font-semibold cursor-pointer hover:bg-indigo-600 transition-colors">{editingId ? "Update Tag" : "Add Tag"}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p className="text-[#6b6b85] m-0">Loading...</p> : (
        <div className="flex flex-col gap-4">
          {groupedTrackingIds.map((group) => (
            <section key={group.agent.agent_id} className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h2 className="m-0 text-lg font-bold text-[#f0f0f5]">{group.agent.agent_name}</h2>
                  <p className="m-0 mt-1 text-sm text-[#8b8ba7]">/{group.agent.agent_slug}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[0.65rem] px-2.5 py-1 rounded-full bg-white/5 text-[#c9c9db] font-medium">
                    {group.tags.length} tag{group.tags.length > 1 ? "s" : ""}
                  </span>
                  <span className="text-[0.65rem] px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-300 font-medium">
                    {group.tags.filter((item) => item.is_portal_editable !== 1).length} admin-only
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {group.tags.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-white/5 bg-[#0f172a]/90 p-4 flex flex-col gap-4">
                    <div className="min-w-0 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <code className="text-sm text-[#ff9900] font-semibold bg-[#ff9900]/10 px-2.5 py-1 rounded-md">{t.tag}</code>
                        {t.is_default ? <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-medium">DEFAULT</span> : null}
                        <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-[#ff9900]/15 text-[#ffad33] font-medium">{t.marketplace}</span>
                        {t.is_portal_editable ? (
                          <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">PORTAL</span>
                        ) : (
                          <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 font-medium">ADMIN ONLY</span>
                        )}
                      </div>
                      <div className="text-sm text-[#d5d5e4] truncate mt-2">
                        {t.label || "No label"}
                      </div>
                      <div className="text-xs text-[#8b8ba7] truncate mt-2">
                        Public slug: {t.alias_slug ? `/${t.alias_slug}` : `/${t.agent_slug} (base)`}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end">
                      <div className="min-w-0">
                        <label className="block text-[0.68rem] uppercase tracking-[0.16em] text-[#8b8ba7] mb-2">
                          Ready Link Format
                        </label>
                        <input
                          readOnly
                          value={buildMarketplaceReadyLinkTemplate(
                            typeof window !== "undefined" ? window.location.origin : "https://dealsrky.com",
                            t.alias_slug || t.agent_slug,
                            t.marketplace
                          )}
                          className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() =>
                            void handleCopyReadyLink(
                              `ready-link-${t.id}`,
                              buildMarketplaceReadyLinkTemplate(
                                typeof window !== "undefined" ? window.location.origin : "https://dealsrky.com",
                                t.alias_slug || t.agent_slug,
                                t.marketplace
                              )
                            )
                          }
                          className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-300 text-xs font-medium cursor-pointer hover:bg-emerald-500/20 transition-colors"
                        >
                          {copiedKey === `ready-link-${t.id}` ? "Copied" : "Copy Ready Link"}
                        </button>
                      <button
                        onClick={() => {
                          setShowForm(true);
                          setEditingId(t.id);
                          setError("");
                          setForm({
                            agent_id: t.agent_id,
                            tag: t.tag,
                            label: t.label || "",
                            marketplace: t.marketplace,
                            is_default: t.is_default === 1,
                            is_portal_editable: t.is_portal_editable === 1,
                            alias_slug: t.alias_slug || "",
                          });
                        }}
                        className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-indigo-300 text-xs font-medium cursor-pointer hover:bg-indigo-500/20 transition-colors"
                      >
                        Edit
                      </button>
                      <button onClick={() => void handleDelete(t.id)} className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 text-xs font-medium cursor-pointer hover:bg-red-500/20 transition-colors">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {groupedTrackingIds.length === 0 && <p className="text-center text-[#6b6b85] p-8 m-0 border border-white/10 rounded-2xl border-dashed">No tags found for the current filter.</p>}
        </div>
      )}
    </div>
  );
}
