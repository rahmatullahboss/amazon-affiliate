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
    return <p className="text-[#a0a0b8]">Loading audit logs...</p>;
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#f0f0f5]">Audit Logs</h1>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#f0f0f5]">Audit Logs</h1>
        <button
          onClick={() => void fetchLogs()}
          className="px-3.5 py-2 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <p className="text-[#6b6b85]">No audit entries yet.</p>
      ) : (
        <div className="grid gap-3">
          {logs.map((log) => (
            <article key={log.id} className="bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-5">
              <div className="flex justify-between gap-4 mb-3 flex-wrap">
                <div>
                  <div className="text-[#f0f0f5] font-bold">{log.action}</div>
                  <div className="text-[#8d8da6] text-sm">
                    {log.entityType}{log.entityId ? ` · ${log.entityId}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-300 text-sm">
                    {log.username || "System"}
                  </div>
                  <div className="text-[#6b6b85] text-xs">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <pre className="m-0 p-3.5 rounded-xl bg-white/5 text-[#a0a0b8] text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
