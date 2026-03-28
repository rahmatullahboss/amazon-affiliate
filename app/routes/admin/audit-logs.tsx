import { useEffect, useState } from "react";

interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  username: string | null;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/audit-logs", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to load audit logs");
      }

      const data = (await response.json()) as { logs: AuditLog[] };
      setLogs(data.logs);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to load audit logs"
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p style={{ color: "#a0a0b8" }}>Loading audit logs...</p>;
  }

  if (error) {
    return (
      <div>
        <h1 style={titleStyle}>Audit Logs</h1>
        <p style={{ color: "#f87171" }}>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={titleStyle}>Audit Logs</h1>
        <button
          onClick={() => void fetchLogs()}
          style={{
            padding: "0.5rem 0.9rem",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "0.5rem",
            color: "#f0f0f5",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <p style={{ color: "#6b6b85" }}>No audit entries yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {logs.map((log) => (
            <article key={log.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: "#f0f0f5", fontWeight: 700 }}>{log.action}</div>
                  <div style={{ color: "#8d8da6", fontSize: "0.8rem" }}>
                    {log.entityType}{log.entityId ? ` · ${log.entityId}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#cbd5e1", fontSize: "0.8rem" }}>
                    {log.username || "System"}
                  </div>
                  <div style={{ color: "#6b6b85", fontSize: "0.76rem" }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: "0.85rem",
                  borderRadius: "0.75rem",
                  background: "rgba(255,255,255,0.03)",
                  color: "#a0a0b8",
                  fontSize: "0.78rem",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const titleStyle: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  color: "#f0f0f5",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(26, 26, 40, 0.9)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "1rem",
  padding: "1.25rem",
};
