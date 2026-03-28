import { useEffect, useState } from "react";

interface PortalMeResponse {
  user: {
    id: number;
    username: string;
    email: string | null;
    role: string;
    agent_id: number | null;
    agent_name: string | null;
    agent_slug: string | null;
  } | null;
}

export default function PortalDashboardPage() {
  const [data, setData] = useState<PortalMeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch("/api/portal/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load portal context");
        return response.json() as Promise<PortalMeResponse>;
      })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p style={styles.copy}>Loading dashboard...</p>;
  }

  return (
    <section style={styles.grid}>
      <article style={styles.card}>
        <h2 style={styles.heading}>Portal Overview</h2>
        <p style={styles.copy}>
          This portal replaces the Google Sheet workflow. Agents can now submit ASINs,
          get tracked links, and work inside the platform.
        </p>
      </article>

      <article style={styles.card}>
        <h2 style={styles.heading}>Signed In As</h2>
        <p style={styles.copy}>Username: {data?.user?.username ?? "Unknown"}</p>
        <p style={styles.copy}>Role: {data?.user?.role ?? "Unknown"}</p>
        <p style={styles.copy}>Agent: {data?.user?.agent_name ?? "Not linked yet"}</p>
        <p style={styles.copy}>Slug: {data?.user?.agent_slug ?? "-"}</p>
      </article>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" },
  card: {
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "1rem",
    padding: "1.5rem",
  },
  heading: { margin: "0 0 0.75rem", color: "#f9fafb", fontSize: "1.25rem", fontWeight: 700 },
  copy: { margin: "0 0 0.5rem", color: "#cbd5e1", lineHeight: 1.6 },
};
