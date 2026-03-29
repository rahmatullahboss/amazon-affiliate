import { Outlet, NavLink, useNavigate } from "react-router";
import { useEffect, useState } from "react";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const userData = localStorage.getItem("auth_user");
    if (!token || !userData) {
      navigate("/admin/login");
      return;
    }
    setUser(JSON.parse(userData));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    navigate("/admin/login");
  };

  if (!user) return null;

  const navItems = [
    { to: "/admin", label: "Dashboard", icon: "📊", end: true },
    { to: "/admin/users", label: "Users", icon: "🧑‍💼" },
    { to: "/admin/agents", label: "Agents", icon: "👥" },
    { to: "/admin/products", label: "Products", icon: "📦" },
    { to: "/admin/product-submissions", label: "Reviews", icon: "🛂" },
    { to: "/admin/tracking", label: "Tracking", icon: "🏷️" },
    { to: "/admin/mappings", label: "Mappings", icon: "🔗" },
    { to: "/admin/analytics", label: "Analytics", icon: "📈" },
    { to: "/admin/reports", label: "Reports", icon: "🧾" },
    { to: "/admin/audit-logs", label: "Audit Logs", icon: "🧾" },
  ];

  return (
    <div className="flex min-h-screen bg-[#0a0a0f] text-[#f0f0f5]">
      {/* Mobile Top Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#12121a]/95 border-b border-white/5 flex items-center justify-between px-4 z-40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff9900] to-[#ffad33] flex items-center justify-center text-black font-bold text-xs shadow-lg">D</div>
          <span className="font-bold text-lg text-[#f0f0f5]">DealsRky</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-[#a0a0b8] hover:text-white p-2"
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
      <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-[#12121a]/95 border-r border-white/5 flex flex-col transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-screen ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="hidden lg:flex items-center gap-3 px-5 py-6 border-b border-white/5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#ff9900] to-[#ffad33] flex items-center justify-center text-black font-bold text-sm shadow-lg">D</div>
          <span className="font-bold text-lg text-[#f0f0f5]">DealsRky</span>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto md:mt-0 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive 
                  ? "bg-[#ff9900]/10 text-[#ff9900] border-l-[3px] border-[#ff9900]" 
                  : "text-[#a0a0b8] border-l-[3px] border-transparent hover:bg-white/5 hover:text-white"
                }
              `}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[#f0f0f5]">{user.username}</span>
            <span className="text-xs text-[#6b6b85] capitalize">{user.role}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto w-full pt-20 lg:pt-8">
        <Outlet />
      </main>
    </div>
  );
}
