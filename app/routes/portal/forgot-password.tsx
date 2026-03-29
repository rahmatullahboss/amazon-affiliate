import { useState } from "react";
import { Link } from "react-router";
import { extractApiErrorMessage } from "../../utils/api-errors";

export default function PortalForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await response.json()) as { message?: string; error?: unknown };
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(data, "Failed to send reset email"));
      }

      setSuccess(
        typeof data.message === "string"
          ? data.message
          : "If this email exists in the system, a password reset link has been sent."
      );
      setEmail("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Reset Password</h1>
        <p style={styles.subtitle}>
          Enter your email and we will send you a password reset link.
        </p>

        {error ? <p style={styles.error}>{error}</p> : null}
        {success ? <p style={styles.success}>{success}</p> : null}

        <label style={styles.label}>
          Email
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Sending..." : "Send Reset Link"}
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
  success: {
    margin: 0,
    color: "#d1fae5",
    background: "rgba(16, 185, 129, 0.12)",
    border: "1px solid rgba(16, 185, 129, 0.25)",
    borderRadius: "0.75rem",
    padding: "0.8rem 1rem",
  },
};
