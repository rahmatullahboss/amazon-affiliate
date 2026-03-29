import { Outlet, NavLink, useNavigate } from "react-router";
import { useEffect, useState } from "react";

interface AuthUser {
  id: number;
  username: string;
  role: string;
  agentId: number | null;
}

export default function PortalLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const rawUser = localStorage.getItem("auth_user");

    if (!token || !rawUser) {
      navigate("/portal/login");
      return;
    }

    const parsed = JSON.parse(rawUser) as AuthUser;
    setUser(parsed);
  }, [navigate]);

  if (!user) return null;

  const navItems = [
    { to: "/portal", label: "Dashboard", end: true },
    { to: "/portal/tracking", label: "Tags" },
    { to: "/portal/products", label: "Products" },
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
          <h1 className="m-0 text-[#f9fafb] text-2xl font-bold md:block hidden">Agent Portal</h1>
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
          </nav>
        </div>

        <button
          className="border border-red-500/30 rounded-xl bg-red-500/10 text-red-300 py-3 px-4 font-semibold cursor-pointer hover:bg-red-500/20 transition-colors mt-8"
          onClick={() => {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
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
