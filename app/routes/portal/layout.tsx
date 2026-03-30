import { Outlet, NavLink, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import type { Route } from "./+types/layout";
import { clearAuthSession, getAuthToken, restoreAuthSession } from "../../utils/auth-session";
import { extractApiErrorMessage } from "../../utils/api-errors";
import { isNativeCapacitorApp } from "../../utils/native-auth";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "RKY Tag House" },
    { name: "application-name", content: "RKY Tag House" },
    { name: "apple-mobile-web-app-title", content: "RKY Tag House" },
  ];
}

interface AuthUser {
  id: number;
  username: string;
  role: string;
  agentId: number | null;
}

interface PortalNavItem {
  to: string;
  label: string;
  end?: boolean;
}

export default function PortalLayout() {
  const navigate = useNavigate();
  const isNativeApp = isNativeCapacitorApp();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    document.title = "RKY Tag House";

    const restoredUser = restoreAuthSession();
    if (!restoredUser) {
      navigate("/portal/login");
      return;
    }

    const verifySession = async () => {
      setCheckingSession(true);
      setSessionError("");

      try {
        const response = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        });

        if (response.status === 401) {
          clearAuthSession();
          navigate("/portal/login", { replace: true });
          return;
        }

        const payload = (await response.json()) as unknown;

        if (!response.ok) {
          throw new Error(extractApiErrorMessage(payload, "Failed to verify portal session"));
        }

        const data = payload as {
          user?: AuthUser;
        };

        if (
          data.user?.role !== "agent" &&
          data.user?.role !== "admin" &&
          data.user?.role !== "super_admin"
        ) {
          clearAuthSession();
          navigate("/portal/login", { replace: true });
          return;
        }

        if (!data.user) {
          throw new Error("Failed to verify portal session");
        }

        setUser(data.user);
      } catch (error) {
        setSessionError(
          error instanceof Error ? error.message : "Failed to verify portal session"
        );
      } finally {
        setCheckingSession(false);
      }
    };

    void verifySession();
  }, [navigate]);

  if (checkingSession) {
    return <div className="min-h-screen bg-[#0b1220] p-8 text-[#94a3b8]">Checking portal session...</div>;
  }

  if (sessionError) {
    return (
      <div className="min-h-screen bg-[#0b1220] p-8 text-[#e5e7eb]">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
          <h1 className="m-0 text-2xl font-bold text-[#f9fafb]">Portal Session Error</h1>
          <p className="mt-3 text-sm text-red-200">{sessionError}</p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg border-none bg-red-400/20 px-4 py-2 font-semibold text-red-50 transition-colors hover:bg-red-400/30"
            >
              Retry
            </button>
            <button
              onClick={() => {
                clearAuthSession();
                navigate("/portal/login", { replace: true });
              }}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-semibold text-[#f0f0f5] transition-colors hover:bg-white/10"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const navItems: PortalNavItem[] = [
    { to: "/portal/products", label: "Submit ASIN" },
    { to: "/portal/dashboard", label: "Dashboard" },
    { to: "/portal/tracking", label: "Tags" },
    { to: "/portal/links", label: "Links" },
  ];

  return (
    <div className="flex min-h-screen bg-[#0b1220] text-[#e5e7eb]">
      {/* Mobile Top Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0b1220]/95 border-b border-white/5 flex items-center justify-between px-4 z-40 backdrop-blur-md">
        <h1 className="text-xl font-bold text-[#f9fafb]">Portal</h1>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-[#94a3b8] hover:text-white p-2"
        >
          {isMobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>

      {/* Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[240px] bg-[#0b1220] border-r border-white/5 flex flex-col justify-between p-6 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-screen ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div>
          <h1 className="m-0 text-[#f9fafb] text-2xl font-bold md:block hidden">RKY Tag House</h1>
          <p className="mt-2 mb-6 text-[#94a3b8] text-sm md:block hidden">{user.username} · {user.role}</p>

          <nav className="grid gap-3 mt-4 md:mt-0">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => `
                  no-underline border rounded-xl py-3 px-4 font-semibold transition-all duration-200
                  ${isActive 
                    ? "bg-amber-500/15 border-amber-500/35 text-amber-400" 
                    : "border-white/10 text-gray-200 hover:bg-white/5 hover:border-white/20"
                  }
                `}
              >
                {item.label}
              </NavLink>
            ))}
            
            {!isNativeApp ? (
              <a
                href="/api/public/downloads/agent-app.apk"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 no-underline border border-emerald-500/30 rounded-xl bg-emerald-500/10 text-emerald-400 py-3 px-4 font-semibold hover:bg-emerald-500/20 transition-all duration-200 flex items-center gap-2 justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download App
              </a>
            ) : null}
          </nav>
        </div>

        <button
          className="border border-red-500/30 rounded-xl bg-red-500/10 text-red-300 py-3 px-4 font-semibold cursor-pointer hover:bg-red-500/20 transition-colors mt-8"
          onClick={() => {
            clearAuthSession();
            navigate("/portal/login");
          }}
        >
          Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto w-full pt-20 lg:pt-8 text-base">
        <Outlet />
      </main>
    </div>
  );
}
