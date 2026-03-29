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
    <div className="min-h-screen flex text-left items-center justify-center p-8 bg-gradient-to-b from-[#0a0a0f] to-[#12121a]">
      <form onSubmit={handleLogin} className="w-full max-w-[380px] bg-[#1a1a28]/90 border border-white/10 rounded-3xl p-10 flex flex-col gap-5 shadow-[0_20px_25px_rgba(0,0,0,0.5)]">
        <div className="flex justify-center mb-2">
          <span className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-400 rounded-xl flex items-center justify-center text-xl font-extrabold text-black shadow-[0_4px_20px_rgba(255,153,0,0.3)]">D</span>
        </div>
        <div className="text-center">
            <h1 className="m-0 text-2xl font-bold text-gray-50">Admin Login</h1>
            <p className="m-0 text-sm text-slate-400 mt-1">Sign in to manage your affiliate bridge</p>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg py-3 px-4 text-red-400 text-sm text-center">{error}</div>}

        <div className="flex flex-col gap-2">
          <label htmlFor="username" className="text-sm font-medium text-slate-400">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-50 text-base outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
            required
            autoComplete="username"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-medium text-slate-400">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-50 text-base outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
            required
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 px-4 py-3.5 bg-gradient-to-br from-amber-500 to-amber-400 text-black text-base font-bold border-none rounded-xl cursor-pointer transition-all hover:brightness-110 shadow-[0_4px_16px_rgba(255,153,0,0.2)] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
