import { useEffect, useState } from "react";

type SubmissionStatus = "pending_review" | "rejected" | "active";

interface ProductSubmission {
  id: number;
  asin: string;
  title: string;
  image_url: string;
  marketplace: string;
  category: string | null;
  status: SubmissionStatus;
  created_at: string;
  updated_at: string;
  requesting_agents: number;
  agent_names: string | null;
  submitted_by: string | null;
}

const getToken = () => localStorage.getItem("auth_token") || "";

export default function ProductSubmissionsPage() {
  const [submissions, setSubmissions] = useState<ProductSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SubmissionStatus>("all");
  const [actingId, setActingId] = useState<number | null>(null);

  useEffect(() => {
    void fetchSubmissions();
  }, [statusFilter]);

  async function fetchSubmissions() {
    setLoading(true);
    setError("");

    try {
      const query =
        statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
      const response = await fetch(`/api/products/submissions${query}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to load product submissions");
      }

      const payload = (await response.json()) as { submissions: ProductSubmission[] };
      setSubmissions(payload.submissions);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load product submissions"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate(id: number, status: SubmissionStatus) {
    setActingId(id);
    setError("");

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to update product status");
      }

      await fetchSubmissions();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to update product status"
      );
    } finally {
      setActingId(null);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={titleStyle}>Product Reviews</h1>
          <p style={subtleStyle}>
            Agent-submitted ASINs stay here until an admin approves or rejects them.
          </p>
        </div>

        <label style={filterWrapStyle}>
          <span style={labelStyle}>Status</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | SubmissionStatus)
            }
            style={selectStyle}
          >
            <option value="all">All pending items</option>
            <option value="pending_review">Pending review</option>
            <option value="rejected">Rejected</option>
            <option value="active">Approved</option>
          </select>
        </label>
      </div>

      {error ? (
        <div style={errorCardStyle}>
          <p style={{ margin: 0 }}>{error}</p>
          <button onClick={() => void fetchSubmissions()} style={secondaryButtonStyle}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <p style={subtleStyle}>Loading submissions...</p> : null}

      {!loading && submissions.length === 0 ? (
        <div style={emptyStateStyle}>
          <h2 style={{ margin: "0 0 0.5rem", color: "#f0f0f5" }}>No review items right now</h2>
          <p style={{ margin: 0, color: "#8d8da6" }}>
            New agent-submitted products waiting for approval will show up here.
          </p>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: "1rem" }}>
        {submissions.map((submission) => (
          <article key={submission.id} style={cardStyle}>
            <div style={imageWrapStyle}>
              <img
                src={submission.image_url}
                alt={submission.title}
                style={imageStyle}
              />
            </div>

            <div style={{ display: "grid", gap: "0.7rem" }}>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <span style={statusBadgeStyle(submission.status)}>
                  {submission.status.replace("_", " ")}
                </span>
                <span style={tagStyle}>{submission.marketplace}</span>
                <span style={tagStyle}>ASIN {submission.asin}</span>
              </div>

              <h2 style={productTitleStyle}>{submission.title}</h2>

              <p style={metaTextStyle}>
                Requested by {submission.requesting_agents} agent
                {submission.requesting_agents === 1 ? "" : "s"}
                {submission.agent_names ? ` · ${submission.agent_names}` : ""}
              </p>
              <p style={metaTextStyle}>
                Submitted by {submission.submitted_by || "Unknown"} · Updated{" "}
                {new Date(submission.updated_at).toLocaleString()}
              </p>

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => void handleStatusUpdate(submission.id, "active")}
                  disabled={actingId === submission.id || submission.status === "active"}
                  style={{
                    ...primaryButtonStyle,
                    opacity:
                      actingId === submission.id || submission.status === "active" ? 0.7 : 1,
                  }}
                >
                  {actingId === submission.id && submission.status !== "active"
                    ? "Updating..."
                    : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleStatusUpdate(submission.id, "rejected")}
                  disabled={actingId === submission.id || submission.status === "rejected"}
                  style={{
                    ...dangerButtonStyle,
                    opacity:
                      actingId === submission.id || submission.status === "rejected" ? 0.7 : 1,
                  }}
                >
                  {actingId === submission.id && submission.status !== "rejected"
                    ? "Updating..."
                    : "Reject"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const titleStyle: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  color: "#f0f0f5",
  margin: "0 0 0.4rem",
};

const subtleStyle: React.CSSProperties = {
  color: "#8d8da6",
  margin: 0,
};

const cardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  gap: "1rem",
  background: "rgba(26, 26, 40, 0.9)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "1rem",
  padding: "1rem",
};

const imageWrapStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "0.85rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "120px",
};

const imageStyle: React.CSSProperties = {
  width: "80%",
  height: "80%",
  objectFit: "contain",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.78rem",
  color: "#a0a0b8",
  marginBottom: "0.35rem",
};

const filterWrapStyle: React.CSSProperties = {
  minWidth: "220px",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.9rem",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "0.6rem",
  color: "#f0f0f5",
};

const tagStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.2rem 0.6rem",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.06)",
  color: "#d4d4e4",
  fontSize: "0.74rem",
  fontWeight: 600,
};

const statusBadgeStyle = (status: SubmissionStatus): React.CSSProperties => {
  const palette =
    status === "active"
      ? { background: "rgba(34,197,94,0.16)", color: "#4ade80" }
      : status === "rejected"
        ? { background: "rgba(239,68,68,0.16)", color: "#f87171" }
        : { background: "rgba(245,158,11,0.16)", color: "#fbbf24" };

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.2rem 0.6rem",
    borderRadius: "999px",
    fontSize: "0.74rem",
    fontWeight: 700,
    textTransform: "capitalize",
    ...palette,
  };
};

const productTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#f0f0f5",
  fontSize: "1rem",
  fontWeight: 700,
  lineHeight: 1.5,
};

const metaTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#8d8da6",
  fontSize: "0.82rem",
  lineHeight: 1.6,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "0.65rem 1rem",
  background: "linear-gradient(135deg, #22c55e, #4ade80)",
  border: "none",
  borderRadius: "0.6rem",
  color: "#052e16",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "0.65rem 1rem",
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.28)",
  borderRadius: "0.6rem",
  color: "#fca5a5",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "0.65rem 1rem",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "0.6rem",
  color: "#f0f0f5",
  fontWeight: 600,
  cursor: "pointer",
};

const errorCardStyle: React.CSSProperties = {
  marginBottom: "1rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "1rem",
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.25)",
  borderRadius: "0.9rem",
  padding: "1rem",
  color: "#fecaca",
};

const emptyStateStyle: React.CSSProperties = {
  background: "rgba(26, 26, 40, 0.9)",
  border: "1px dashed rgba(255,255,255,0.12)",
  borderRadius: "1rem",
  padding: "2rem",
  textAlign: "center",
};
