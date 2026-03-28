import type { Route } from "./+types/login";
import { useState } from "react";
import { useNavigate } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Admin Login — DealsRky" }];
}

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Same-origin API call — no CORS, single worker
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || "Login failed");
      }

      const data = await res.json() as { token: string; user: unknown };
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleLogin} style={styles.form}>
        <div style={styles.logoBox}>
          <span style={styles.logo}>D</span>
        </div>
        <h1 style={styles.title}>Admin Login</h1>
        <p style={styles.subtitle}>Sign in to manage your affiliate bridge</p>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.field}>
          <label htmlFor="username" style={styles.label}>Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
            required
            autoComplete="username"
          />
        </div>

        <div style={styles.field}>
          <label htmlFor="password" style={styles.label}>Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            ...styles.button,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    padding: "2rem", background: "linear-gradient(180deg, #0a0a0f 0%, #12121a 100%)",
  },
  form: {
    width: "100%", maxWidth: "380px", background: "rgba(26, 26, 40, 0.9)",
    border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "1.5rem",
    padding: "2.5rem 2rem", display: "flex", flexDirection: "column",
    gap: "1.25rem", boxShadow: "0 20px 25px rgba(0, 0, 0, 0.5)",
  },
  logoBox: { display: "flex", justifyContent: "center", marginBottom: "0.5rem" },
  logo: {
    width: "48px", height: "48px", background: "linear-gradient(135deg, #ff9900, #ffad33)",
    borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "1.25rem", fontWeight: 800, color: "#000",
    boxShadow: "0 4px 20px rgba(255, 153, 0, 0.3)",
  },
  title: { fontSize: "1.5rem", fontWeight: 700, textAlign: "center", color: "#f0f0f5" },
  subtitle: { fontSize: "0.875rem", textAlign: "center", color: "#a0a0b8", marginTop: "-0.5rem" },
  error: {
    background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "0.5rem", padding: "0.75rem 1rem", color: "#ef4444",
    fontSize: "0.875rem", textAlign: "center",
  },
  field: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  label: { fontSize: "0.875rem", fontWeight: 500, color: "#a0a0b8" },
  input: {
    padding: "0.75rem 1rem", background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "0.75rem",
    color: "#f0f0f5", fontSize: "1rem", outline: "none", transition: "border-color 0.25s ease",
  },
  button: {
    padding: "0.875rem", background: "linear-gradient(135deg, #ff9900, #ffad33)",
    color: "#000", fontSize: "1rem", fontWeight: 700, border: "none",
    borderRadius: "0.75rem", cursor: "pointer", marginTop: "0.5rem",
    transition: "all 0.25s ease", boxShadow: "0 4px 16px rgba(255, 153, 0, 0.2)",
  },
};
