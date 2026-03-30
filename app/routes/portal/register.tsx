import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Browser } from "@capacitor/browser";
import type { Route } from "./+types/register";
import { GoogleSignInButton } from "../../components/auth/GoogleSignInButton";
import {
  buildGoogleCompleteSignupPath,
  exchangeGoogleCredential,
} from "../../utils/google-auth";
import {
  buildNativeGoogleAuthUrl,
  isNativeCapacitorApp,
} from "../../utils/native-auth";
import { extractApiErrorMessage } from "../../utils/api-errors";
import { persistAuthSession } from "../../utils/auth-session";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env as unknown as { GOOGLE_CLIENT_ID?: string };
  return {
    googleClientId: env.GOOGLE_CLIENT_ID || "",
  };
}

export default function PortalRegisterPage({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const isNativeApp = isNativeCapacitorApp();
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
  const { googleClientId } = loaderData;

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
        throw new Error(extractApiErrorMessage(data, "Registration failed"));
      }

      const data = (await response.json()) as {
        token: string;
        user: { id: number; username: string; role: string; agentId: number | null };
      };

      persistAuthSession(data.token, data.user);
      navigate("/portal/tracking");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setLoading(true);
      setError("");

      try {
        const data = await exchangeGoogleCredential(credential, "Google sign-up failed");

        if (data.requiresCompletion && data.signupToken) {
          navigate(buildGoogleCompleteSignupPath(data.signupToken, data.profile));
          return;
        }

        if (data.token && data.user) {
          persistAuthSession(data.token, data.user);
          navigate("/portal");
          return;
        }

        throw new Error("Google sign-up failed");
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Google sign-up failed");
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  const handleNativeGoogleSignUp = useCallback(async () => {
    setError("");

    try {
      await Browser.open({
        url: buildNativeGoogleAuthUrl("signup"),
      });
    } catch {
      setError("Could not open Google sign-up in your browser.");
    }
  }, []);

  return (
    <main style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Create Agent Account</h1>
        <p style={styles.subtitle}>
          Create your portal account first. Then add your Amazon tag and start generating links.
        </p>

        {error ? <p style={styles.error}>{error}</p> : null}

        {isNativeApp ? (
          <div style={styles.externalGoogleWrap}>
            <button
              type="button"
              style={styles.externalGoogleButton}
              onClick={() => {
                void handleNativeGoogleSignUp();
              }}
              disabled={loading || !googleClientId}
            >
              Continue With Google In Browser
            </button>
            <p style={styles.externalGoogleHint}>
              Google sign-up opens in Chrome and returns you to the app automatically.
            </p>
          </div>
        ) : (
          <GoogleSignInButton
            clientId={googleClientId}
            text="signup_with"
            onCredential={(credential) => {
              void handleGoogleCredential(credential);
            }}
          />
        )}

        <div style={styles.dividerWrap}>
          <span style={styles.divider} />
          <span style={styles.dividerText}>or</span>
          <span style={styles.divider} />
        </div>

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
  externalGoogleWrap: {
    display: "grid",
    gap: "0.75rem",
  },
  externalGoogleButton: {
    border: "none",
    borderRadius: "999px",
    background: "#f9fafb",
    color: "#111827",
    fontWeight: 700,
    padding: "0.9rem 1rem",
    cursor: "pointer",
  },
  externalGoogleHint: {
    margin: 0,
    color: "#94a3b8",
    fontSize: "0.8rem",
    lineHeight: 1.5,
    textAlign: "center",
  },
  error: {
    margin: 0,
    color: "#fecaca",
    background: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: "0.75rem",
    padding: "0.8rem 1rem",
  },
  dividerWrap: { display: "flex", alignItems: "center", gap: "0.75rem" },
  divider: { flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" },
  dividerText: { color: "#6b7280", fontSize: "0.8rem", textTransform: "uppercase" },
  switchText: { margin: 0, color: "#cbd5e1", fontSize: "0.9rem" },
  link: { color: "#fbbf24", textDecoration: "none", fontWeight: 600 },
};
