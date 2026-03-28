import { useState } from "react";
import { Link, useNavigate } from "react-router";

interface ValidationIssue {
  message?: string;
  path?: string[];
}

function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Registration failed";
  }

  const data = payload as {
    error?: string | { issues?: ValidationIssue[] };
    message?: string;
  };

  if (typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }

  if (data.error && typeof data.error === "object" && Array.isArray(data.error.issues)) {
    const firstIssue = data.error.issues[0];
    if (firstIssue?.message) {
      const field = firstIssue.path?.[0];
      return field ? `${field}: ${firstIssue.message}` : firstIssue.message;
    }
  }

  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  return "Registration failed";
}

export default function PortalRegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    agent_name: "",
    agent_slug: "",
    email: "",
    phone: "",
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          email: form.email || null,
          phone: form.phone || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(extractErrorMessage(data));
      }

      const data = (await response.json()) as {
        token: string;
        user: { id: number; username: string; role: string; agentId: number | null };
      };

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      navigate("/portal/tracking");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Create Agent Account</h1>
        <p style={styles.subtitle}>
          Create your portal account first. Then add your Amazon tracking ID and start generating links.
        </p>

        {error ? <p style={styles.error}>{error}</p> : null}

        <label style={styles.label}>
          Agent name
          <input
            style={styles.input}
            value={form.agent_name}
            onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
            required
          />
        </label>

        <label style={styles.label}>
          Agent slug
          <input
            style={styles.input}
            value={form.agent_slug}
            onChange={(e) =>
              setForm({ ...form, agent_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
            }
            placeholder="your-name"
            required
          />
        </label>

        <label style={styles.label}>
          Email
          <input
            style={styles.input}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>

        <label style={styles.label}>
          Phone
          <input
            style={styles.input}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </label>

        <label style={styles.label}>
          Username
          <input
            style={styles.input}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </label>

        <label style={styles.label}>
          Password
          <input
            style={styles.input}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </label>

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Creating..." : "Create Account"}
        </button>

        <p style={styles.switchText}>
          Already have an account? <Link style={styles.link} to="/portal/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f172a",
    padding: "2rem",
  },
  card: {
    width: "100%",
    maxWidth: "520px",
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "1rem",
    padding: "2rem",
    display: "grid",
    gap: "1rem",
  },
  title: { margin: 0, color: "#f9fafb", fontSize: "1.75rem", fontWeight: 700 },
  subtitle: { margin: 0, color: "#9ca3af", fontSize: "0.95rem", lineHeight: 1.5 },
  label: { display: "grid", gap: "0.5rem", color: "#d1d5db", fontSize: "0.9rem" },
  input: {
    borderRadius: "0.75rem",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#1f2937",
    color: "#f9fafb",
    padding: "0.85rem 1rem",
  },
  button: {
    border: "none",
    borderRadius: "0.75rem",
    background: "linear-gradient(135deg, #f59e0b, #fbbf24)",
    color: "#111827",
    fontWeight: 700,
    padding: "0.9rem 1rem",
    cursor: "pointer",
  },
  error: {
    margin: 0,
    color: "#fecaca",
    background: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: "0.75rem",
    padding: "0.8rem 1rem",
  },
  switchText: { margin: 0, color: "#cbd5e1", fontSize: "0.9rem" },
  link: { color: "#fbbf24", textDecoration: "none", fontWeight: 600 },
};
