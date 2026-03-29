import { useEffect, useState } from "react";
import { getAuthToken } from "../../utils/auth-session";

interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  role: "super_admin" | "admin" | "agent";
  agent_id: number | null;
  is_active: number;
  agent_name?: string | null;
  agent_slug?: string | null;
}

interface Agent {
  id: number;
  name: string;
  slug: string;
}

const getToken = () => getAuthToken();

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "agent" as "super_admin" | "admin" | "agent",
    agent_id: 0,
  });

  const fetchAll = async () => {
    const headers = { Authorization: `Bearer ${getToken()}` };
    const [usersRes, agentsRes] = await Promise.all([
      fetch("/api/users", { headers }),
      fetch("/api/agents", { headers }),
    ]);

    if (usersRes.ok) {
      const data = (await usersRes.json()) as { users: AdminUser[] };
      setUsers(data.users);
    }

    if (agentsRes.ok) {
      const data = (await agentsRes.json()) as { agents: Agent[] };
      setAgents(data.agents.filter((agent) => true));
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAll().catch((err) => {
      console.error(err);
      setError("Failed to load users");
      setLoading(false);
    });
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          username: form.username,
          email: form.email || null,
          password: form.password,
          role: form.role,
          agent_id: form.role === "agent" ? Number(form.agent_id) || null : null,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to create user");
      }

      setForm({ username: "", email: "", password: "", role: "agent", agent_id: 0 });
      setShowForm(false);
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  };

  const toggleActive = async (user: AdminUser) => {
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ is_active: user.is_active !== 1 }),
    });

    if (response.ok) {
      await fetchAll();
    }
  };

  // Styles migrated to Tailwind CSS
  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#f0f0f5] m-0">Users</h1>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="px-4 py-2 bg-gradient-to-br from-[#ff9900] to-[#ffad33] border-none rounded-lg text-black font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          {showForm ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {showForm ? (
        <div className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-6 mb-6">
          <form onSubmit={(e) => void handleCreate(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Username*</label>
              <input className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Email</label>
              <input className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Password*</label>
              <input className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900]" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Role*</label>
              <select className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] appearance-auto" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "super_admin" | "admin" | "agent" })}>
                <option className="bg-gray-800" value="agent">agent</option>
                <option className="bg-gray-800" value="admin">admin</option>
                <option className="bg-gray-800" value="super_admin">super_admin</option>
              </select>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-sm text-[#a0a0b8] mb-1.5">Agent Link {form.role === "agent" ? "*" : "(optional)"}</label>
              <select
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9900] appearance-auto disabled:opacity-50 disabled:cursor-not-allowed"
                value={form.agent_id}
                onChange={(e) => setForm({ ...form, agent_id: Number(e.target.value) })}
                required={form.role === "agent"}
                disabled={form.role !== "agent"}
              >
                <option className="bg-gray-800" value={0}>Select agent...</option>
                {agents.map((agent) => (
                  <option className="bg-gray-800" key={agent.id} value={agent.id}>
                    {agent.name} (/{agent.slug})
                  </option>
                ))}
              </select>
            </div>
            {error ? <div className="col-span-1 sm:col-span-2"><p className="text-red-500 text-sm m-0 mt-2">{error}</p></div> : null}
            <div className="col-span-1 sm:col-span-2 mt-2">
              <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-indigo-500 border-none rounded-lg text-white font-semibold cursor-pointer hover:bg-indigo-600 transition-colors">
                Create User
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {loading ? (
        <p className="text-[#a0a0b8] m-0">Loading users...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((user) => (
            <div key={user.id} className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="min-w-0 w-full sm:w-auto">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-base font-semibold text-[#f0f0f5] truncate">{user.username}</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 text-xs font-medium">{user.role}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                    {user.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="text-sm text-[#6b6b85] truncate mt-2">
                  {user.email || "No email"} · {user.agent_name ? `${user.agent_name} (/${user.agent_slug})` : "No linked agent"}
                </div>
              </div>

              <button
                onClick={() => void toggleActive(user)}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-[#a0a0b8] text-xs font-medium cursor-pointer hover:bg-white/10 transition-colors shrink-0"
              >
                {user.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
          {users.length === 0 ? <p className="text-center text-[#6b6b85] p-8 m-0 border border-white/10 rounded-2xl border-dashed">No users yet.</p> : null}
        </div>
      )}
    </div>
  );
}
