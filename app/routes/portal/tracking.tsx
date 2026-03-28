import { useEffect, useState } from "react";

interface TrackingIdRow {
  id: number;
  tag: string;
  label: string | null;
  marketplace: string;
  is_default: number;
  is_active: number;
  created_at: string;
}

const MARKETPLACES = ["US", "CA", "UK", "DE", "IT", "FR", "ES"];

export default function PortalTrackingPage() {
  const [trackingIds, setTrackingIds] = useState<TrackingIdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    tag: "",
    label: "",
    marketplace: "US",
  });

  async function loadTracking() {
    const token = localStorage.getItem("auth_token");
    const response = await fetch("/api/portal/tracking", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error("Failed to load tracking IDs");
    }

    const data = (await response.json()) as { trackingIds: TrackingIdRow[] };
    setTrackingIds(data.trackingIds);
  }

  useEffect(() => {
    loadTracking()
      .catch((requestError) =>
        setError(requestError instanceof Error ? requestError.message : "Failed to load tracking IDs")
      )
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/portal/tracking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tag: form.tag,
          label: form.label || null,
          marketplace: form.marketplace,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to save tracking ID");
      }

      setSuccess("Tracking ID saved successfully");
      setForm({ tag: "", label: "", marketplace: "US" });
      await loadTracking();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save tracking ID");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={styles.wrap}>
      <article style={styles.card}>
        <h1 style={styles.title}>Tracking IDs</h1>
        <p style={styles.copy}>
          Add the tracking ID the client gave you for each marketplace. Once a marketplace has a tracking ID,
          you can paste an ASIN and generate your link automatically.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <select
            style={styles.input}
            value={form.marketplace}
            onChange={(e) => setForm({ ...form, marketplace: e.target.value })}
          >
            {MARKETPLACES.map((marketplace) => (
              <option key={marketplace} value={marketplace}>
                {marketplace}
              </option>
            ))}
          </select>

          <input
            style={styles.input}
            placeholder="Tracking ID (example: agent-us-20)"
            value={form.tag}
            onChange={(e) => setForm({ ...form, tag: e.target.value })}
            required
          />

          <input
            style={styles.input}
            placeholder="Label (optional)"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />

          <button type="submit" style={styles.button} disabled={saving}>
            {saving ? "Saving..." : "Save Tracking ID"}
          </button>
        </form>

        {error ? <p style={styles.error}>{error}</p> : null}
        {success ? <p style={styles.success}>{success}</p> : null}
      </article>

      <article style={styles.card}>
        <h2 style={styles.title}>Saved Tracking IDs</h2>
        {loading ? <p style={styles.copy}>Loading...</p> : null}
        {!loading && trackingIds.length === 0 ? (
          <p style={styles.copy}>No tracking IDs saved yet.</p>
        ) : null}

        <div style={styles.list}>
          {trackingIds.map((trackingId) => (
            <div key={trackingId.id} style={styles.item}>
              <div>
                <p style={styles.itemTitle}>{trackingId.tag}</p>
                <p style={styles.copy}>
                  {trackingId.marketplace} · {trackingId.label || "Default tracking ID"}
                </p>
              </div>
              <span style={styles.badge}>{trackingId.is_default ? "Default" : "Saved"}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: "1rem" },
  card: {
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "1rem",
    padding: "1.5rem",
  },
  title: { margin: "0 0 0.75rem", color: "#f9fafb", fontSize: "1.25rem", fontWeight: 700 },
  copy: { margin: "0 0 0.5rem", color: "#cbd5e1", lineHeight: 1.6 },
  form: { display: "grid", gap: "0.75rem" },
  input: {
    borderRadius: "0.75rem",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#1f2937",
    color: "#f9fafb",
    padding: "0.85rem 1rem",
  },
  button: {
    border: "none",
    borderRadius: "0.75rem",
    background: "#f59e0b",
    color: "#111827",
    fontWeight: 700,
    padding: "0.9rem 1rem",
    cursor: "pointer",
  },
  error: {
    color: "#fecaca",
    margin: "0.75rem 0 0",
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: "0.75rem",
    padding: "0.85rem 1rem",
  },
  success: {
    color: "#d1fae5",
    margin: "0.75rem 0 0",
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(16,185,129,0.25)",
    borderRadius: "0.75rem",
    padding: "0.85rem 1rem",
  },
  list: { display: "grid", gap: "0.75rem" },
  item: {
    display: "flex",
    justifyContent: "space-between",
    gap: "1rem",
    alignItems: "center",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "0.85rem",
    padding: "0.85rem 1rem",
  },
  itemTitle: { margin: "0 0 0.35rem", color: "#f9fafb", fontWeight: 600 },
  badge: {
    color: "#fbbf24",
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.25)",
    borderRadius: "999px",
    padding: "0.3rem 0.7rem",
    fontSize: "0.75rem",
    fontWeight: 700,
  },
};
