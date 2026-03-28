import { useEffect, useState } from "react";

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

const getToken = () => localStorage.getItem("auth_token") || "";

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

  const cardStyle: React.CSSProperties = {
    background: "rgba(26, 26, 40, 0.9)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "1rem",
    padding: "1.5rem",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.875rem",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "0.5rem",
    color: "#f0f0f5",
    fontSize: "0.875rem",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f0f0f5" }}>Users</h1>
        <button
          onClick={() => setShowForm((value) => !value)}
          style={{ padding: "0.5rem 1rem", background: "linear-gradient(135deg, #ff9900, #ffad33)", border: "none", borderRadius: "0.5rem", color: "#000", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}
        >
          {showForm ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {showForm ? (
        <div style={{ ...cardStyle, marginBottom: "1.5rem" }}>
          <form onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Username*</label>
              <input style={inputStyle} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Password*</label>
              <input style={inputStyle} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div>
              <label style={labelStyle}>Role*</label>
              <select style={inputStyle} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "super_admin" | "admin" | "agent" })}>
                <option value="agent">agent</option>
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Agent Link {form.role === "agent" ? "*" : "(optional)"}</label>
              <select
                style={inputStyle}
                value={form.agent_id}
                onChange={(e) => setForm({ ...form, agent_id: Number(e.target.value) })}
                required={form.role === "agent"}
                disabled={form.role !== "agent"}
              >
                <option value={0}>Select agent...</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} (/{agent.slug})
                  </option>
                ))}
              </select>
            </div>
            {error ? <p style={{ color: "#ef4444", fontSize: "0.8rem", margin: 0 }}>{error}</p> : null}
            <div style={{ gridColumn: "1 / -1" }}>
              <button type="submit" style={{ padding: "0.625rem 1.5rem", background: "#6366f1", border: "none", borderRadius: "0.5rem", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                Create User
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "#a0a0b8" }}>Loading users...</p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {users.map((user) => (
            <div key={user.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1rem", fontWeight: 600, color: "#f0f0f5" }}>{user.username}</span>
                  <span style={{ fontSize: "0.7rem", padding: "0.125rem 0.5rem", borderRadius: "9999px", background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>{user.role}</span>
                  <span style={{ fontSize: "0.7rem", padding: "0.125rem 0.5rem", borderRadius: "9999px", background: user.is_active ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: user.is_active ? "#22c55e" : "#ef4444" }}>
                    {user.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#6b6b85", marginTop: "0.25rem" }}>
                  {user.email || "No email"} · {user.agent_name ? `${user.agent_name} (/${user.agent_slug})` : "No linked agent"}
                </div>
              </div>

              <button
                onClick={() => toggleActive(user)}
                style={{ padding: "0.375rem 0.75rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.375rem", color: "#a0a0b8", fontSize: "0.75rem", cursor: "pointer" }}
              >
                {user.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
          {users.length === 0 ? <p style={{ color: "#6b6b85", textAlign: "center", padding: "2rem" }}>No users yet.</p> : null}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  color: "#a0a0b8",
  marginBottom: "0.375rem",
};
