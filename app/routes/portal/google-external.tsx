import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/google-external";
import { GoogleSignInButton } from "../../components/auth/GoogleSignInButton";
import { persistAuthSession } from "../../utils/auth-session";
import {
  buildGoogleCompleteSignupPath,
  exchangeGoogleCredential,
} from "../../utils/google-auth";
import { buildNativeAuthCallbackUrl } from "../../utils/native-auth";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env as unknown as { GOOGLE_CLIENT_ID?: string };
  return {
    googleClientId: env.GOOGLE_CLIENT_ID || "",
  };
}

export default function PortalGoogleExternalPage({
  loaderData,
}: Route.ComponentProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [appReturnUrl, setAppReturnUrl] = useState("");
  const { googleClientId } = loaderData;

  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const returnToNativeApp = searchParams.get("source") === "native-app";

  const title = useMemo(
    () => (mode === "signup" ? "Continue With Google" : "Sign In With Google"),
    [mode]
  );
  const subtitle = useMemo(
    () =>
      returnToNativeApp
        ? "Complete Google authentication in your browser. You will be sent back to the app automatically."
        : "Complete Google authentication here to continue.",
    [returnToNativeApp]
  );

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setLoading(true);
      setError("");
      setAppReturnUrl("");

      try {
        const data = await exchangeGoogleCredential(
          credential,
          mode === "signup" ? "Google sign-up failed" : "Google sign-in failed"
        );

        if (data.requiresCompletion && data.signupToken) {
          const next = buildGoogleCompleteSignupPath(data.signupToken, data.profile);

          if (returnToNativeApp) {
            const callbackUrl = buildNativeAuthCallbackUrl({ next });
            setAppReturnUrl(callbackUrl);
            window.location.href = callbackUrl;
            return;
          }

          navigate(next, { replace: true });
          return;
        }

        if (data.token && data.user) {
          if (returnToNativeApp) {
            const callbackUrl = buildNativeAuthCallbackUrl({
              token: data.token,
              user: data.user,
              next: "/portal/products",
            });
            setAppReturnUrl(callbackUrl);
            window.location.href = callbackUrl;
            return;
          }

          persistAuthSession(data.token, data.user);
          navigate("/portal/products", { replace: true });
          return;
        }

        throw new Error(
          mode === "signup" ? "Google sign-up failed" : "Google sign-in failed"
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : mode === "signup"
              ? "Google sign-up failed"
              : "Google sign-in failed"
        );
      } finally {
        setLoading(false);
      }
    },
    [mode, navigate, returnToNativeApp]
  );

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.hero}>
          <p style={styles.eyebrow}>RKY Tag House</p>
          <h1 style={styles.title}>{title}</h1>
          <p style={styles.subtitle}>{subtitle}</p>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}

        <GoogleSignInButton
          clientId={googleClientId}
          text={mode === "signup" ? "signup_with" : "signin_with"}
          onCredential={(credential) => {
            void handleGoogleCredential(credential);
          }}
        />

        {loading ? <p style={styles.helper}>Finishing Google authentication...</p> : null}

        {appReturnUrl ? (
          <div style={styles.fallbackWrap}>
            <p style={styles.helper}>
              If the app does not reopen automatically, tap the button below.
            </p>
            <a href={appReturnUrl} style={styles.linkButton}>
              Return To App
            </a>
          </div>
        ) : null}

        <p style={styles.footer}>
          Need the regular portal login instead?{" "}
          <Link style={styles.link} to="/portal/login">
            Go back
          </Link>
        </p>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    background:
      "radial-gradient(circle at top, rgba(245, 158, 11, 0.18), transparent 30%), #020617",
  },
  card: {
    width: "100%",
    maxWidth: "520px",
    display: "grid",
    gap: "1.25rem",
    padding: "2rem",
    borderRadius: "1.5rem",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15, 23, 42, 0.96)",
    boxShadow: "0 24px 80px rgba(15, 23, 42, 0.45)",
  },
  hero: {
    display: "grid",
    gap: "0.75rem",
    textAlign: "center",
  },
  eyebrow: {
    margin: 0,
    color: "#fbbf24",
    fontSize: "0.8rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  title: {
    margin: 0,
    color: "#f8fafc",
    fontSize: "2rem",
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    color: "#94a3b8",
    lineHeight: 1.6,
    fontSize: "0.95rem",
  },
  error: {
    margin: 0,
    color: "#fecaca",
    background: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: "0.75rem",
    padding: "0.85rem 1rem",
    textAlign: "center",
  },
  helper: {
    margin: 0,
    color: "#cbd5e1",
    textAlign: "center",
    fontSize: "0.9rem",
  },
  fallbackWrap: {
    display: "grid",
    gap: "0.75rem",
    justifyItems: "center",
  },
  linkButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.9rem 1.2rem",
    borderRadius: "999px",
    background: "#fbbf24",
    color: "#111827",
    fontWeight: 700,
    textDecoration: "none",
  },
  footer: {
    margin: 0,
    color: "#cbd5e1",
    textAlign: "center",
    fontSize: "0.9rem",
  },
  link: {
    color: "#fbbf24",
    textDecoration: "none",
    fontWeight: 600,
  },
};
