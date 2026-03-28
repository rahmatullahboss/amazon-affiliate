import { useState } from "react";
import { Link, useNavigate } from "react-router";

export default function PortalLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Login failed");
      }

      const data = (await response.json()) as {
        token: string;
        user: { id: number; username: string; role: string; agentId: number | null };
      };

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      navigate("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <form onSubmit={handleLogin} style={styles.card}>
        <h1 style={styles.title}>Agent Portal</h1>
        <p style={styles.subtitle}>Log in to submit ASINs and manage your affiliate links.</p>

        {error ? <p style={styles.error}>{error}</p> : null}

        <label style={styles.label}>
          Username
          <input style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>

        <label style={styles.label}>
          Password
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <p style={styles.switchText}>
          Need an account? <Link style={styles.link} to="/portal/register">Create agent account</Link>
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
    maxWidth: "420px",
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
  switchText: { margin: 0, color: "#cbd5e1", fontSize: "0.9rem" },
  link: { color: "#fbbf24", textDecoration: "none", fontWeight: 600 },
  error: {
    margin: 0,
    color: "#fecaca",
    background: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: "0.75rem",
    padding: "0.8rem 1rem",
  },
};
