import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Route } from "./+types/login";
import { GoogleSignInButton } from "../../components/auth/GoogleSignInButton";
import { extractApiErrorMessage } from "../../utils/api-errors";
import { persistAuthSession } from "../../utils/auth-session";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env as unknown as { GOOGLE_CLIENT_ID?: string };
  return {
    googleClientId: env.GOOGLE_CLIENT_ID || "",
  };
}

export default function PortalLoginPage({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { googleClientId } = loaderData;

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
        const data = await response.json();
        throw new Error(extractApiErrorMessage(data, "Login failed"));
      }

      const data = (await response.json()) as {
        token: string;
        user: { id: number; username: string; role: string; agentId: number | null };
      };

      persistAuthSession(data.token, data.user);
      navigate("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential }),
        });

        const data = (await response.json()) as {
          token?: string;
          user?: { id: number; username: string; role: string; agentId: number | null };
          requiresCompletion?: boolean;
          signupToken?: string;
          profile?: { email?: string; name?: string | null };
          error?: unknown;
          message?: string;
        };

        if (!response.ok) {
          throw new Error(extractApiErrorMessage(data, "Google sign-in failed"));
        }

        if (data.requiresCompletion && data.signupToken) {
          const params = new URLSearchParams({
            token: data.signupToken,
            email: data.profile?.email || "",
            name: data.profile?.name || "",
          });
          navigate(`/portal/complete-signup?${params.toString()}`);
          return;
        }

        if (data.token && data.user) {
          persistAuthSession(data.token, data.user);
          navigate("/portal");
          return;
        }

        throw new Error("Google sign-in failed");
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Google sign-in failed");
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  return (
    <main className="min-h-screen flex text-left items-center justify-center p-8 bg-slate-900">
      <form onSubmit={handleLogin} className="w-full max-w-[420px] bg-slate-900/90 border border-white/10 rounded-2xl p-8 grid gap-4 shadow-xl">
        <div className="text-center mb-2">
          <h1 className="m-0 text-2xl font-bold text-gray-50">Agent Portal</h1>
          <p className="m-0 text-sm text-slate-400 mt-1 leading-relaxed">
            Log in to submit ASINs and manage your affiliate links.
          </p>
        </div>

        {error ? <p className="m-0 mb-2 py-3 px-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm text-center">{error}</p> : null}

        <label className="grid gap-2 text-sm font-medium text-slate-300">
          Username
          <input
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-gray-50 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-300">
          Password
          <input
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-gray-50 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button
          type="submit"
          className="w-full mt-2 px-4 py-3.5 bg-gradient-to-br from-amber-500 to-amber-400 text-slate-900 text-base font-bold border-none rounded-xl cursor-pointer transition-all hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div className="flex items-center gap-3 my-1">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-xs uppercase tracking-[0.25em] text-slate-500">or</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <GoogleSignInButton
          clientId={googleClientId}
          text="signin_with"
          onCredential={(credential) => {
            void handleGoogleCredential(credential);
          }}
        />

        <p className="m-0 text-sm text-slate-300 text-center mt-2">
          <Link className="text-amber-500 font-semibold no-underline hover:text-amber-400 transition-colors" to="/portal/forgot-password">Forgot password?</Link>
        </p>

        <p className="m-0 text-sm text-slate-300 text-center">
          Need an account? <Link className="text-amber-500 font-semibold no-underline hover:text-amber-400 transition-colors" to="/portal/register">Create agent account</Link>
        </p>
      </form>
    </main>
  );
}
