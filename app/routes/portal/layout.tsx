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
    { to: "/portal/products", label: "Products" },
    { to: "/portal/links", label: "Links" },
  ];

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div>
          <h1 style={styles.brand}>Agent Portal</h1>
          <p style={styles.meta}>{user.username} · {user.role}</p>
        </div>

        <nav style={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                ...styles.navLink,
                background: isActive ? "rgba(245, 158, 11, 0.15)" : "transparent",
                borderColor: isActive ? "rgba(245, 158, 11, 0.35)" : "rgba(255,255,255,0.08)",
                color: isActive ? "#fbbf24" : "#e5e7eb",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          style={styles.logout}
          onClick={() => {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            navigate("/portal/login");
          }}
        >
          Logout
        </button>
      </aside>

      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", background: "#0b1220" },
  sidebar: {
    width: "240px",
    padding: "1.5rem",
    borderRight: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: "2rem",
  },
  brand: { margin: 0, color: "#f9fafb", fontSize: "1.5rem", fontWeight: 700 },
  meta: { margin: "0.5rem 0 0", color: "#94a3b8", fontSize: "0.9rem" },
  nav: { display: "grid", gap: "0.75rem" },
  navLink: {
    textDecoration: "none",
    border: "1px solid",
    borderRadius: "0.75rem",
    padding: "0.85rem 1rem",
    fontWeight: 600,
  },
  logout: {
    border: "1px solid rgba(239,68,68,0.35)",
    borderRadius: "0.75rem",
    background: "rgba(239,68,68,0.1)",
    color: "#fca5a5",
    padding: "0.85rem 1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  main: { flex: 1, padding: "2rem" },
};
