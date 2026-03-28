import { Outlet, NavLink, useNavigate } from "react-router";
import { useEffect, useState } from "react";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

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
    <div style={styles.layout}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.sidebarLogo}>D</span>
          <span style={styles.sidebarTitle}>DealsRky</span>
        </div>

        <nav style={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                ...styles.navLink,
                background: isActive ? "rgba(255, 153, 0, 0.1)" : "transparent",
                color: isActive ? "#ff9900" : "#a0a0b8",
                borderLeft: isActive ? "3px solid #ff9900" : "3px solid transparent",
              })}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <span style={styles.userName}>{user.username}</span>
            <span style={styles.userRole}>{user.role}</span>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </aside>

      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: { display: "flex", minHeight: "100vh", background: "#0a0a0f" },
  sidebar: {
    width: "260px", background: "rgba(18, 18, 26, 0.95)",
    borderRight: "1px solid rgba(255, 255, 255, 0.06)",
    display: "flex", flexDirection: "column", flexShrink: 0,
    position: "sticky" as const, top: 0, height: "100vh",
  },
  sidebarHeader: {
    display: "flex", alignItems: "center", gap: "0.75rem",
    padding: "1.5rem 1.25rem", borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
  },
  sidebarLogo: {
    width: "36px", height: "36px", background: "linear-gradient(135deg, #ff9900, #ffad33)",
    borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "0.875rem", fontWeight: 800, color: "#000",
  },
  sidebarTitle: { fontSize: "1.125rem", fontWeight: 700, color: "#f0f0f5" },
  nav: {
    flex: 1, padding: "1rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem",
  },
  navLink: {
    display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.625rem 1rem",
    borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 500,
    textDecoration: "none", transition: "all 0.2s ease",
  },
  sidebarFooter: {
    padding: "1rem 1.25rem", borderTop: "1px solid rgba(255, 255, 255, 0.06)",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  userInfo: { display: "flex", flexDirection: "column" },
  userName: { fontSize: "0.875rem", fontWeight: 600, color: "#f0f0f5" },
  userRole: { fontSize: "0.75rem", color: "#6b6b85", textTransform: "capitalize" as const },
  logoutBtn: {
    padding: "0.375rem 0.75rem", background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "0.375rem",
    color: "#ef4444", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer",
  },
  main: { flex: 1, padding: "2rem", overflowY: "auto" as const },
};
