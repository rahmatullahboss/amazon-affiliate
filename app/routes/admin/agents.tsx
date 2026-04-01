import { useEffect, useMemo, useState } from "react";
import { copyTextToClipboard } from "../../utils/clipboard";
import { getAuthToken } from "../../utils/auth-session";
import { buildAgentFormValues, isInlineEditingAgent } from "../../utils/agents";
import { buildMarketplaceReadyLinkTemplate } from "../../utils/public-links";

const MARKETPLACES = ["US", "CA", "UK", "DE", "IT", "FR", "ES"] as const;

type Marketplace = (typeof MARKETPLACES)[number];
type UserRole = "super_admin" | "admin" | "agent";

interface Agent {
  id: number;
  slug: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: number;
  tracking_count: number;
  product_count: number;
  total_clicks: number;
  user_count: number;
  last_click_at: string | null;
  total_ordered_items: number;
  total_returned_items: number;
  total_revenue: number;
  total_commission: number;
}

interface TrackingId {
  id: number;
  agent_id: number;
  tag: string;
  label: string | null;
  marketplace: Marketplace;
  is_default: number;
  is_active: number;
  is_portal_editable: number;
  agent_name: string;
  agent_slug: string;
  alias_slug?: string | null;
}

interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  role: UserRole;
  agent_id: number | null;
  is_active: number;
  agent_name?: string | null;
  agent_slug?: string | null;
}

interface AgentFormState {
  name: string;
  slug: string;
  email: string;
  phone: string;
}

interface TagFormState {
  agent_id: number;
  tag: string;
  label: string;
  marketplace: Marketplace;
  is_default: boolean;
  is_active: boolean;
  is_portal_editable: boolean;
  alias_slug: string;
}

interface UserFormState {
  username: string;
  email: string;
  password: string;
  is_active: boolean;
}

type TagFormMode =
  | { type: "create"; agentId: number }
  | { type: "edit"; agentId: number; tagId: number }
  | null;

type UserFormMode =
  | { type: "create"; agentId: number }
  | { type: "edit"; agentId: number; userId: number }
  | null;

const EMPTY_AGENT_FORM: AgentFormState = { name: "", slug: "", email: "", phone: "" };
const EMPTY_TAG_FORM: TagFormState = {
  agent_id: 0,
  tag: "",
  label: "",
  marketplace: "US",
  is_default: false,
  is_active: true,
  is_portal_editable: false,
  alias_slug: "",
};
const EMPTY_USER_FORM: UserFormState = {
  username: "",
  email: "",
  password: "",
  is_active: true,
};

const getToken = () => getAuthToken();

function sortTrackingIds(items: TrackingId[]): TrackingId[] {
  return [...items].sort((left, right) => {
    if (left.marketplace !== right.marketplace) {
      return left.marketplace.localeCompare(right.marketplace);
    }

    if (left.is_default !== right.is_default) {
      return right.is_default - left.is_default;
    }

    return left.tag.localeCompare(right.tag);
  });
}

function sortUsers(items: AdminUser[]): AdminUser[] {
  return [...items].sort((left, right) => left.username.localeCompare(right.username));
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [trackingIds, setTrackingIds] = useState<TrackingId[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  const [showCreateAgentForm, setShowCreateAgentForm] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<number | null>(null);
  const [agentForm, setAgentForm] = useState<AgentFormState>(EMPTY_AGENT_FORM);
  const [agentError, setAgentError] = useState("");

  const [tagFormMode, setTagFormMode] = useState<TagFormMode>(null);
  const [tagForm, setTagForm] = useState<TagFormState>(EMPTY_TAG_FORM);
  const [tagError, setTagError] = useState("");

  const [userFormMode, setUserFormMode] = useState<UserFormMode>(null);
  const [userForm, setUserForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [userError, setUserError] = useState("");

  async function fetchAll() {
    setPageError("");
    setLoading(true);

    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const [agentsRes, trackingRes, usersRes] = await Promise.all([
        fetch("/api/agents", { headers }),
        fetch("/api/tracking", { headers }),
        fetch("/api/users", { headers }),
      ]);

      if (!agentsRes.ok || !trackingRes.ok || !usersRes.ok) {
        throw new Error("Failed to load agent management data.");
      }

      const [agentsPayload, trackingPayload, usersPayload] = await Promise.all([
        agentsRes.json() as Promise<{ agents: Agent[] }>,
        trackingRes.json() as Promise<{ trackingIds: TrackingId[] }>,
        usersRes.json() as Promise<{ users: AdminUser[] }>,
      ]);

      setAgents(agentsPayload.agents);
      setTrackingIds(trackingPayload.trackingIds);
      setUsers(usersPayload.users);
    } catch (error) {
      console.error(error);
      setPageError(error instanceof Error ? error.message : "Failed to load agent management data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchAll();
  }, []);

  const trackingByAgent = useMemo(() => {
    const grouped = new Map<number, TrackingId[]>();

    for (const trackingId of trackingIds) {
      const existing = grouped.get(trackingId.agent_id) || [];
      existing.push(trackingId);
      grouped.set(trackingId.agent_id, existing);
    }

    return grouped;
  }, [trackingIds]);

  const usersByAgent = useMemo(() => {
    const grouped = new Map<number, AdminUser[]>();

    for (const user of users) {
      if (!user.agent_id) {
        continue;
      }

      const existing = grouped.get(user.agent_id) || [];
      existing.push(user);
      grouped.set(user.agent_id, existing);
    }

    return grouped;
  }, [users]);

  const filteredAgents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return agents;
    }

    return agents.filter((agent) => {
      const relatedTrackingIds = trackingByAgent.get(agent.id) || [];
      const relatedUsers = usersByAgent.get(agent.id) || [];

      const haystack = [
        agent.name,
        agent.slug,
        agent.email || "",
        agent.phone || "",
        ...relatedTrackingIds.flatMap((trackingId) => [
          trackingId.tag,
          trackingId.label || "",
          trackingId.marketplace,
          trackingId.alias_slug || "",
        ]),
        ...relatedUsers.flatMap((user) => [
          user.username,
          user.email || "",
          user.role,
        ]),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [agents, searchQuery, trackingByAgent, usersByAgent]);

  const summary = useMemo(() => {
    const visibleAgentIds = new Set(filteredAgents.map((agent) => agent.id));
    const visibleTags = trackingIds.filter((trackingId) => visibleAgentIds.has(trackingId.agent_id));
    const visibleUsers = users.filter((user) => user.agent_id !== null && visibleAgentIds.has(user.agent_id));

    return {
      totalAgents: filteredAgents.length,
      activeAgents: filteredAgents.filter((agent) => agent.is_active === 1).length,
      totalTags: visibleTags.length,
      totalUsers: visibleUsers.length,
    };
  }, [filteredAgents, trackingIds, users]);

  function resetAgentForm() {
    setAgentForm(EMPTY_AGENT_FORM);
    setAgentError("");
    setEditingAgentId(null);
  }

  function openCreateAgentForm() {
    setShowCreateAgentForm(true);
    resetAgentForm();
    setTagFormMode(null);
    setUserFormMode(null);
  }

  function startEditingAgent(agent: Agent) {
    setShowCreateAgentForm(false);
    setTagFormMode(null);
    setUserFormMode(null);
    setEditingAgentId(agent.id);
    setAgentError("");
    setAgentForm(buildAgentFormValues(agent));
  }

  async function handleAgentSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAgentError("");

    try {
      const response = await fetch(
        editingAgentId ? `/api/agents/${editingAgentId}` : "/api/agents",
        {
          method: editingAgentId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(agentForm),
        }
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to save agent");
      }

      setShowCreateAgentForm(false);
      resetAgentForm();
      await fetchAll();
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : "Failed to save agent");
    }
  }

  async function toggleAgentActive(agent: Agent) {
    const response = await fetch(`/api/agents/${agent.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ is_active: agent.is_active !== 1 }),
    });

    if (!response.ok) {
      setPageError("Failed to update agent status.");
      return;
    }

    await fetchAll();
  }

  function startCreatingTag(agent: Agent) {
    setTagFormMode({ type: "create", agentId: agent.id });
    setTagForm({
      ...EMPTY_TAG_FORM,
      agent_id: agent.id,
    });
    setTagError("");
  }

  function startEditingTag(trackingId: TrackingId) {
    setTagFormMode({
      type: "edit",
      agentId: trackingId.agent_id,
      tagId: trackingId.id,
    });
    setTagForm({
      agent_id: trackingId.agent_id,
      tag: trackingId.tag,
      label: trackingId.label || "",
      marketplace: trackingId.marketplace,
      is_default: trackingId.is_default === 1,
      is_active: trackingId.is_active === 1,
      is_portal_editable: trackingId.is_portal_editable === 1,
      alias_slug: trackingId.alias_slug || "",
    });
    setTagError("");
  }

  function closeTagForm() {
    setTagFormMode(null);
    setTagForm(EMPTY_TAG_FORM);
    setTagError("");
  }

  async function handleTagSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTagError("");

    try {
      const response = await fetch(
        tagFormMode?.type === "edit" ? `/api/tracking/${tagFormMode.tagId}` : "/api/tracking",
        {
          method: tagFormMode?.type === "edit" ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(
            tagFormMode?.type === "edit"
              ? {
                  label: tagForm.label || null,
                  is_default: tagForm.is_default,
                  is_active: tagForm.is_active,
                  is_portal_editable: tagForm.is_portal_editable,
                  alias_slug: tagForm.alias_slug || null,
                }
              : {
                  agent_id: tagForm.agent_id,
                  tag: tagForm.tag,
                  label: tagForm.label || null,
                  marketplace: tagForm.marketplace,
                  is_default: tagForm.is_default,
                  is_portal_editable: tagForm.is_portal_editable,
                  alias_slug: tagForm.alias_slug || null,
                }
          ),
        }
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to save tag");
      }

      closeTagForm();
      await fetchAll();
    } catch (error) {
      setTagError(error instanceof Error ? error.message : "Failed to save tag");
    }
  }

  async function handleDeleteTag(id: number) {
    if (!window.confirm("Delete this tag?")) {
      return;
    }

    const response = await fetch(`/api/tracking/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setTagError(data.error || "Failed to delete tag");
      return;
    }

    await fetchAll();
  }

  function startCreatingUser(agent: Agent) {
    setUserFormMode({ type: "create", agentId: agent.id });
    setUserForm(EMPTY_USER_FORM);
    setUserError("");
  }

  function startEditingUser(user: AdminUser) {
    setUserFormMode({
      type: "edit",
      agentId: user.agent_id ?? 0,
      userId: user.id,
    });
    setUserForm({
      username: user.username,
      email: user.email || "",
      password: "",
      is_active: user.is_active === 1,
    });
    setUserError("");
  }

  function closeUserForm() {
    setUserFormMode(null);
    setUserForm(EMPTY_USER_FORM);
    setUserError("");
  }

  async function handleUserSubmit(event: React.FormEvent) {
    event.preventDefault();
    setUserError("");

    try {
      const response = await fetch(
        userFormMode?.type === "edit" ? `/api/users/${userFormMode.userId}` : "/api/users",
        {
          method: userFormMode?.type === "edit" ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(
            userFormMode?.type === "edit"
              ? {
                  email: userForm.email || null,
                  password: userForm.password || undefined,
                  is_active: userForm.is_active,
                }
              : {
                  username: userForm.username,
                  email: userForm.email || null,
                  password: userForm.password,
                  role: "agent",
                  agent_id: userFormMode?.agentId || null,
                }
          ),
        }
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to save login");
      }

      closeUserForm();
      await fetchAll();
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Failed to save login");
    }
  }

  async function toggleUserActive(user: AdminUser) {
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ is_active: user.is_active !== 1 }),
    });

    if (!response.ok) {
      setPageError("Failed to update login status.");
      return;
    }

    await fetchAll();
  }

  async function handleCopyReadyLink(copyKey: string, value: string) {
    const copied = await copyTextToClipboard(value);

    if (!copied) {
      setPageError("Could not copy the ready link format.");
      return;
    }

    setCopiedKey(copyKey);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === copyKey ? "" : current));
    }, 2000);
  }

  function getBaseOrigin() {
    if (typeof window !== "undefined" && window.location.origin) {
      return window.location.origin;
    }

    return "https://dealsrky.com";
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="w-full sm:w-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#f0f0f5] m-0">Agent Management</h1>
          <p className="text-sm text-[#8b8ba7] mt-2 mb-0">
            Manage agent profiles, marketplace tags, public slugs, linked logins, and support actions from one place.
          </p>
        </div>
        <button
          onClick={() => {
            if (showCreateAgentForm) {
              setShowCreateAgentForm(false);
              resetAgentForm();
              return;
            }

            openCreateAgentForm();
          }}
          className="px-4 py-2 bg-gradient-to-br from-[#ff9900] to-[#ffad33] border-none rounded-lg text-black font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          {showCreateAgentForm ? "Cancel" : "+ Add Agent"}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Visible Agents", value: summary.totalAgents },
          { label: "Active Agents", value: summary.activeAgents },
          { label: "Marketplace Tags", value: summary.totalTags },
          { label: "Linked Logins", value: summary.totalUsers },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/5 bg-[#1a1a28]/90 p-4">
            <div className="text-[0.68rem] uppercase tracking-[0.18em] text-[#8b8ba7]">{item.label}</div>
            <div className="mt-2 text-2xl font-bold text-[#f0f0f5]">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-4 mb-6">
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by agent, slug, email, tag, alias, login..."
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
        />
      </div>

      {pageError ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6">
          <p className="text-red-300 text-sm m-0 mb-3">{pageError}</p>
          <button
            onClick={() => void fetchAll()}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm font-medium cursor-pointer hover:bg-white/10 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : null}

      {showCreateAgentForm ? (
        <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 mb-6">
          <form onSubmit={(event) => void handleAgentSubmit(event)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Name*</label>
              <input
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                value={agentForm.name}
                onChange={(event) => setAgentForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Slug*</label>
              <input
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                value={agentForm.slug}
                onChange={(event) =>
                  setAgentForm((current) => ({
                    ...current,
                    slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                  }))
                }
                required
                placeholder="agent-name"
              />
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Email</label>
              <input
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                type="email"
                value={agentForm.email}
                onChange={(event) => setAgentForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Phone</label>
              <input
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                value={agentForm.phone}
                onChange={(event) => setAgentForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>
            {agentError ? <p className="col-span-1 sm:col-span-2 text-red-500 text-sm m-0">{agentError}</p> : null}
            <div className="col-span-1 sm:col-span-2">
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-500 border-none rounded-lg text-white font-semibold cursor-pointer hover:bg-indigo-600 transition-colors"
              >
                Create Agent
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {loading ? (
        <p className="text-[#6b6b85] m-0">Loading agent management...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredAgents.map((agent) => {
            const agentTrackingIds = sortTrackingIds(trackingByAgent.get(agent.id) || []);
            const linkedUsers = sortUsers(usersByAgent.get(agent.id) || []);

            return (
              <section key={agent.id} className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-5">
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h2 className="m-0 text-xl font-bold text-[#f0f0f5]">{agent.name}</h2>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          agent.is_active
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {agent.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="m-0 text-sm text-[#8b8ba7]">/{agent.slug}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[0.72rem]">
                      <span className="px-2.5 py-1 rounded-full bg-white/5 text-[#d5d5e4]">
                        {agentTrackingIds.length} tag{agentTrackingIds.length === 1 ? "" : "s"}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-white/5 text-[#d5d5e4]">
                        {linkedUsers.length} login{linkedUsers.length === 1 ? "" : "s"}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-white/5 text-[#d5d5e4]">
                        {agent.product_count} products
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-white/5 text-[#d5d5e4]">
                        {agent.total_clicks} clicks
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      onClick={() => startEditingAgent(agent)}
                      className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-indigo-300 text-xs font-medium cursor-pointer hover:bg-indigo-500/20 transition-colors"
                    >
                      Edit Profile
                    </button>
                    <button
                      onClick={() => startCreatingTag(agent)}
                      className="px-3 py-1.5 bg-[#ff9900]/10 border border-[#ff9900]/20 rounded-md text-[#ffad33] text-xs font-medium cursor-pointer hover:bg-[#ff9900]/20 transition-colors"
                    >
                      Add Tag
                    </button>
                    <button
                      onClick={() => startCreatingUser(agent)}
                      className="px-3 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-md text-sky-300 text-xs font-medium cursor-pointer hover:bg-sky-500/20 transition-colors"
                    >
                      Add Login
                    </button>
                    <button
                      onClick={() => void toggleAgentActive(agent)}
                      className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-[#a0a0b8] text-xs font-medium cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      {agent.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-5">
                  <div className="rounded-2xl border border-white/5 bg-[#111827]/80 p-4">
                    <div className="text-[0.68rem] uppercase tracking-[0.16em] text-[#8b8ba7]">Support Snapshot</div>
                    <div className="mt-3 text-sm text-[#d5d5e4] leading-relaxed">
                      <div>{agent.email || "No email saved"}</div>
                      <div className="mt-1">{agent.phone || "No phone saved"}</div>
                      <div className="mt-3 text-[#8b8ba7]">
                        Last click: {agent.last_click_at ? new Date(agent.last_click_at).toLocaleString() : "Never"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-[#111827]/80 p-4">
                    <div className="text-[0.68rem] uppercase tracking-[0.16em] text-[#8b8ba7]">Orders & Earnings</div>
                    <div className="mt-3 text-sm text-[#d5d5e4] leading-relaxed">
                      <div>Ordered items: {agent.total_ordered_items}</div>
                      <div className="mt-1">Returned items: {agent.total_returned_items}</div>
                      <div className="mt-1">Revenue: ${agent.total_revenue.toFixed(2)}</div>
                      <div className="mt-1">Commission: ${agent.total_commission.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-[#111827]/80 p-4">
                    <div className="text-[0.68rem] uppercase tracking-[0.16em] text-[#8b8ba7]">Quick Help</div>
                    <div className="mt-3 text-sm text-[#d5d5e4] leading-relaxed">
                      <div>Tag issues: add or edit marketplace tags below.</div>
                      <div className="mt-1">Login issues: reset password or reactivate linked accounts below.</div>
                      <div className="mt-1">Slug issues: set alias slug per marketplace inside the tag section.</div>
                    </div>
                  </div>
                </div>

                {isInlineEditingAgent(editingAgentId, agent.id) ? (
                  <div className="w-full border-t border-white/10 pt-4 mt-5">
                    <form onSubmit={(event) => void handleAgentSubmit(event)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-[#a0a0b8] mb-1.5">Name*</label>
                        <input
                          className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                          value={agentForm.name}
                          onChange={(event) => setAgentForm((current) => ({ ...current, name: event.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-[#a0a0b8] mb-1.5">Slug*</label>
                        <input
                          className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                          value={agentForm.slug}
                          onChange={(event) =>
                            setAgentForm((current) => ({
                              ...current,
                              slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                            }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-[#a0a0b8] mb-1.5">Email</label>
                        <input
                          className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                          type="email"
                          value={agentForm.email}
                          onChange={(event) => setAgentForm((current) => ({ ...current, email: event.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-[#a0a0b8] mb-1.5">Phone</label>
                        <input
                          className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                          value={agentForm.phone}
                          onChange={(event) => setAgentForm((current) => ({ ...current, phone: event.target.value }))}
                        />
                      </div>
                      {agentError ? <p className="col-span-1 sm:col-span-2 text-red-500 text-sm m-0">{agentError}</p> : null}
                      <div className="col-span-1 sm:col-span-2 flex flex-col sm:flex-row gap-3">
                        <button
                          type="submit"
                          className="w-full sm:w-auto px-6 py-2.5 bg-indigo-500 border-none rounded-lg text-white font-semibold cursor-pointer hover:bg-indigo-600 transition-colors"
                        >
                          Update Agent
                        </button>
                        <button
                          type="button"
                          onClick={resetAgentForm}
                          className="w-full sm:w-auto px-6 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#a0a0b8] font-semibold cursor-pointer hover:bg-white/10 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 mt-5">
                  <div className="rounded-2xl border border-white/5 bg-[#0f172a]/90 p-4">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <h3 className="m-0 text-lg font-bold text-[#f0f0f5]">Marketplace Tags</h3>
                        <p className="m-0 mt-1 text-sm text-[#8b8ba7]">
                          Add tags manually, fix alias slugs, and control portal edit access.
                        </p>
                      </div>
                    </div>

                    {tagFormMode?.agentId === agent.id ? (
                      <form onSubmit={(event) => void handleTagSubmit(event)} className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-[#a0a0b8] mb-1.5">Tag{tagFormMode.type === "create" ? "*" : ""}</label>
                            <input
                              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] disabled:opacity-60"
                              value={tagForm.tag}
                              onChange={(event) => setTagForm((current) => ({ ...current, tag: event.target.value }))}
                              disabled={tagFormMode.type === "edit"}
                              required={tagFormMode.type === "create"}
                              placeholder="agent-name-20 or ?tag=agent-name-20"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-[#a0a0b8] mb-1.5">Marketplace</label>
                            <select
                              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] appearance-auto disabled:opacity-60"
                              value={tagForm.marketplace}
                              onChange={(event) =>
                                setTagForm((current) => ({
                                  ...current,
                                  marketplace: event.target.value as Marketplace,
                                }))
                              }
                              disabled={tagFormMode.type === "edit"}
                            >
                              {MARKETPLACES.map((marketplace) => (
                                <option className="bg-gray-800" key={marketplace} value={marketplace}>
                                  {marketplace}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-[#a0a0b8] mb-1.5">Label</label>
                            <input
                              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                              value={tagForm.label}
                              onChange={(event) => setTagForm((current) => ({ ...current, label: event.target.value }))}
                              placeholder="Optional internal label"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-[#a0a0b8] mb-1.5">Public Slug Alias</label>
                            <input
                              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                              value={tagForm.alias_slug}
                              onChange={(event) =>
                                setTagForm((current) => ({
                                  ...current,
                                  alias_slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                                }))
                              }
                              placeholder="agent-us"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 mt-4">
                          <label className="flex items-center gap-2 text-sm text-[#a0a0b8] cursor-pointer">
                            <input
                              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[#ff9900] focus:ring-[#ff9900]"
                              type="checkbox"
                              checked={tagForm.is_default}
                              onChange={(event) =>
                                setTagForm((current) => ({ ...current, is_default: event.target.checked }))
                              }
                            />
                            Default for this marketplace
                          </label>
                          <label className="flex items-center gap-2 text-sm text-[#a0a0b8] cursor-pointer">
                            <input
                              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[#ff9900] focus:ring-[#ff9900]"
                              type="checkbox"
                              checked={tagForm.is_portal_editable}
                              onChange={(event) =>
                                setTagForm((current) => ({
                                  ...current,
                                  is_portal_editable: event.target.checked,
                                }))
                              }
                            />
                            Agent can edit in portal
                          </label>
                          {tagFormMode.type === "edit" ? (
                            <label className="flex items-center gap-2 text-sm text-[#a0a0b8] cursor-pointer">
                              <input
                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[#ff9900] focus:ring-[#ff9900]"
                                type="checkbox"
                                checked={tagForm.is_active}
                                onChange={(event) =>
                                  setTagForm((current) => ({ ...current, is_active: event.target.checked }))
                                }
                              />
                              Tag is active
                            </label>
                          ) : null}
                        </div>
                        {tagError ? <p className="text-red-500 text-sm m-0 mt-4">{tagError}</p> : null}
                        <div className="flex flex-col sm:flex-row gap-3 mt-4">
                          <button
                            type="submit"
                            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-500 border-none rounded-lg text-white font-semibold cursor-pointer hover:bg-indigo-600 transition-colors"
                          >
                            {tagFormMode.type === "edit" ? "Update Tag" : "Add Tag"}
                          </button>
                          <button
                            type="button"
                            onClick={closeTagForm}
                            className="w-full sm:w-auto px-6 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#a0a0b8] font-semibold cursor-pointer hover:bg-white/10 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null}

                    <div className="flex flex-col gap-3">
                      {agentTrackingIds.map((trackingId) => {
                        const readyLink = buildMarketplaceReadyLinkTemplate(
                          getBaseOrigin(),
                          trackingId.alias_slug || trackingId.agent_slug,
                          trackingId.marketplace
                        );

                        return (
                          <div key={trackingId.id} className="rounded-2xl border border-white/5 bg-[#111827]/80 p-4">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <code className="text-sm text-[#ff9900] font-semibold bg-[#ff9900]/10 px-2.5 py-1 rounded-md">
                                    {trackingId.tag}
                                  </code>
                                  <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-[#ff9900]/15 text-[#ffad33] font-medium">
                                    {trackingId.marketplace}
                                  </span>
                                  {trackingId.is_default ? (
                                    <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-medium">
                                      DEFAULT
                                    </span>
                                  ) : null}
                                  <span
                                    className={`text-[0.65rem] px-2 py-0.5 rounded-full font-medium ${
                                      trackingId.is_active
                                        ? "bg-emerald-500/15 text-emerald-400"
                                        : "bg-red-500/15 text-red-300"
                                    }`}
                                  >
                                    {trackingId.is_active ? "ACTIVE" : "INACTIVE"}
                                  </span>
                                  <span
                                    className={`text-[0.65rem] px-2 py-0.5 rounded-full font-medium ${
                                      trackingId.is_portal_editable
                                        ? "bg-emerald-500/15 text-emerald-400"
                                        : "bg-sky-500/15 text-sky-300"
                                    }`}
                                  >
                                    {trackingId.is_portal_editable ? "PORTAL" : "ADMIN ONLY"}
                                  </span>
                                </div>
                                <div className="mt-2 text-sm text-[#d5d5e4]">
                                  {trackingId.label || "No label"}
                                </div>
                                <div className="mt-2 text-xs text-[#8b8ba7]">
                                  Public slug: {trackingId.alias_slug ? `/${trackingId.alias_slug}` : `/${trackingId.agent_slug} (base)`}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 shrink-0">
                                <button
                                  onClick={() => startEditingTag(trackingId)}
                                  className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-indigo-300 text-xs font-medium cursor-pointer hover:bg-indigo-500/20 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => void handleDeleteTag(trackingId.id)}
                                  className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-md text-red-300 text-xs font-medium cursor-pointer hover:bg-red-500/20 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end mt-4">
                              <div className="min-w-0">
                                <label className="block text-[0.68rem] uppercase tracking-[0.16em] text-[#8b8ba7] mb-2">
                                  Ready Link Format
                                </label>
                                <input
                                  readOnly
                                  value={readyLink}
                                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm"
                                />
                              </div>
                              <button
                                onClick={() => void handleCopyReadyLink(`ready-link-${trackingId.id}`, readyLink)}
                                className="px-4 py-2.5 bg-[#ff9900] border-none rounded-lg text-black font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity"
                              >
                                {copiedKey === `ready-link-${trackingId.id}` ? "Copied" : "Copy Link"}
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {agentTrackingIds.length === 0 ? (
                        <p className="text-center text-[#6b6b85] p-6 m-0 border border-white/10 rounded-2xl border-dashed">
                          No tags yet. Add a marketplace tag for this agent.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-[#0f172a]/90 p-4">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <h3 className="m-0 text-lg font-bold text-[#f0f0f5]">Linked Logins</h3>
                        <p className="m-0 mt-1 text-sm text-[#8b8ba7]">
                          Check login details, create accounts, reactivate access, or reset passwords.
                        </p>
                      </div>
                    </div>

                    {userFormMode?.agentId === agent.id ? (
                      <form onSubmit={(event) => void handleUserSubmit(event)} className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-[#a0a0b8] mb-1.5">Username{userFormMode.type === "create" ? "*" : ""}</label>
                            <input
                              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] disabled:opacity-60"
                              value={userForm.username}
                              onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))}
                              disabled={userFormMode.type === "edit"}
                              required={userFormMode.type === "create"}
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-[#a0a0b8] mb-1.5">Email</label>
                            <input
                              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                              type="email"
                              value={userForm.email}
                              onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-[#a0a0b8] mb-1.5">
                              {userFormMode.type === "edit" ? "New Password" : "Password*"}
                            </label>
                            <input
                              className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                              type="password"
                              value={userForm.password}
                              onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                              required={userFormMode.type === "create"}
                              placeholder={userFormMode.type === "edit" ? "Leave empty to keep current password" : ""}
                            />
                          </div>
                          {userFormMode.type === "edit" ? (
                            <div className="flex items-end">
                              <label className="flex items-center gap-2 text-sm text-[#a0a0b8] cursor-pointer">
                                <input
                                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[#ff9900] focus:ring-[#ff9900]"
                                  type="checkbox"
                                  checked={userForm.is_active}
                                  onChange={(event) =>
                                    setUserForm((current) => ({
                                      ...current,
                                      is_active: event.target.checked,
                                    }))
                                  }
                                />
                                Login is active
                              </label>
                            </div>
                          ) : null}
                        </div>
                        {userError ? <p className="text-red-500 text-sm m-0 mt-4">{userError}</p> : null}
                        <div className="flex flex-col sm:flex-row gap-3 mt-4">
                          <button
                            type="submit"
                            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-500 border-none rounded-lg text-white font-semibold cursor-pointer hover:bg-indigo-600 transition-colors"
                          >
                            {userFormMode.type === "edit" ? "Update Login" : "Create Login"}
                          </button>
                          <button
                            type="button"
                            onClick={closeUserForm}
                            className="w-full sm:w-auto px-6 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#a0a0b8] font-semibold cursor-pointer hover:bg-white/10 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null}

                    <div className="flex flex-col gap-3">
                      {linkedUsers.map((user) => (
                        <div key={user.id} className="rounded-2xl border border-white/5 bg-[#111827]/80 p-4">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-base font-semibold text-[#f0f0f5]">{user.username}</span>
                                <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 text-xs font-medium">
                                  {user.role}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    user.is_active
                                      ? "bg-emerald-500/10 text-emerald-500"
                                      : "bg-red-500/10 text-red-500"
                                  }`}
                                >
                                  {user.is_active ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <div className="text-sm text-[#8b8ba7] mt-2">
                                {user.email || "No email"} · Agent login for /{agent.slug}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 shrink-0">
                              <button
                                onClick={() => startEditingUser(user)}
                                className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-indigo-300 text-xs font-medium cursor-pointer hover:bg-indigo-500/20 transition-colors"
                              >
                                Edit / Reset
                              </button>
                              <button
                                onClick={() => void toggleUserActive(user)}
                                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-[#a0a0b8] text-xs font-medium cursor-pointer hover:bg-white/10 transition-colors"
                              >
                                {user.is_active ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {linkedUsers.length === 0 ? (
                        <p className="text-center text-[#6b6b85] p-6 m-0 border border-white/10 rounded-2xl border-dashed">
                          No linked logins yet. Create one for this agent.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}

          {agents.length === 0 ? (
            <p className="text-center text-[#6b6b85] p-8 m-0 border border-white/10 rounded-2xl border-dashed">
              No agents yet. Create your first agent above.
            </p>
          ) : null}

          {agents.length > 0 && filteredAgents.length === 0 ? (
            <p className="text-center text-[#6b6b85] p-8 m-0 border border-white/10 rounded-2xl border-dashed">
              No agents matched your search.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
