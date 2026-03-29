import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { extractApiErrorMessage } from "../../utils/api-errors";

export default function PortalCompleteSignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";
  const suggestedName = searchParams.get("name") || "";

  const initialSlug = useMemo(
    () =>
      suggestedName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-"),
    [suggestedName]
  );

  const [form, setForm] = useState({
    agent_name: suggestedName,
    agent_slug: initialSlug,
    phone: "",
    username: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/google/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          agent_name: form.agent_name,
          agent_slug: form.agent_slug,
          phone: form.phone || null,
          username: form.username,
        }),
      });

      const data = (await response.json()) as {
        token?: string;
        user?: { id: number; username: string; role: string; agentId: number | null };
        error?: unknown;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(extractApiErrorMessage(data, "Failed to complete signup"));
      }

      if (!data.token || !data.user) {
        throw new Error("Failed to complete signup");
      }

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      navigate("/portal/tracking");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to complete signup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Complete Signup</h1>
        <p style={styles.subtitle}>
          Google sign-in worked. Complete the missing account details below.
        </p>

        {error ? <p style={styles.error}>{error}</p> : null}

        <label style={styles.label}>
          Email
          <input style={styles.input} value={email} readOnly />
        </label>

        <label style={styles.label}>
          Agent name
          <input
            style={styles.input}
            value={form.agent_name}
            onChange={(event) => setForm({ ...form, agent_name: event.target.value })}
            required
          />
        </label>

        <label style={styles.label}>
          Agent slug
          <input
            style={styles.input}
            value={form.agent_slug}
            onChange={(event) =>
              setForm({
                ...form,
                agent_slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
              })
            }
            required
          />
        </label>

        <label style={styles.label}>
          Phone
          <input
            style={styles.input}
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </label>

        <label style={styles.label}>
          Username
          <input
            style={styles.input}
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            required
          />
        </label>

        <button type="submit" style={styles.button} disabled={loading || !token || !email}>
          {loading ? "Saving..." : "Complete Signup"}
        </button>

        <p style={styles.switchText}>
          Back to <Link style={styles.link} to="/portal/login">sign in</Link>
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
