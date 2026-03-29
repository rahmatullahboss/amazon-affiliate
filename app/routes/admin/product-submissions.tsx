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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#f0f0f5] m-0 mb-1.5">Product Reviews</h1>
          <p className="m-0 text-[#8d8da6] leading-relaxed">
            Agent-submitted ASINs stay here until an admin approves or rejects them.
          </p>
        </div>

        <label className="w-full sm:w-auto sm:min-w-[220px]">
          <span className="block text-[0.78rem] text-[#a0a0b8] mb-1.5">Status</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | SubmissionStatus)
            }
            className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[#f0f0f5] appearance-auto focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option className="bg-gray-800" value="all">All pending items</option>
            <option className="bg-gray-800" value="pending_review">Pending review</option>
            <option className="bg-gray-800" value="rejected">Rejected</option>
            <option className="bg-gray-800" value="active">Approved</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-red-500/10 border border-red-500/25 rounded-xl p-4 text-red-300">
          <p className="m-0">{error}</p>
          <button onClick={() => void fetchSubmissions()} className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-[#f0f0f5] font-semibold cursor-pointer hover:bg-white/10 transition-colors whitespace-nowrap">
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <p className="m-0 text-[#8d8da6] leading-relaxed">Loading submissions...</p> : null}

      {!loading && submissions.length === 0 ? (
        <div className="bg-[#1a1a28]/90 border border-dashed border-white/10 rounded-2xl p-8 text-center">
          <h2 className="m-0 mb-2 text-[#f0f0f5] text-xl font-semibold">No review items right now</h2>
          <p className="m-0 text-[#8d8da6]">
            New agent-submitted products waiting for approval will show up here.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {submissions.map((submission) => (
          <article key={submission.id} className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-4 bg-[#1a1a28]/90 border border-white/5 rounded-2xl p-4">
            <div className="bg-white rounded-xl flex items-center justify-center min-h-[120px] aspect-square sm:aspect-auto">
              <img
                src={submission.image_url}
                alt={submission.title}
                className="w-[80%] h-[80%] object-contain"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[0.74rem] font-bold capitalize ${
                  submission.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                  submission.status === 'rejected' ? 'bg-red-500/15 text-red-400' :
                  'bg-amber-500/15 text-amber-500'
                }`}>
                  {submission.status.replace("_", " ")}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/5 text-[#d4d4e4] text-[0.74rem] font-semibold">{submission.marketplace}</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/5 text-[#d4d4e4] text-[0.74rem] font-semibold">ASIN {submission.asin}</span>
              </div>

              <h2 className="m-0 text-[#f0f0f5] text-base font-bold leading-relaxed">{submission.title}</h2>

              <p className="m-0 text-[#8d8da6] text-[0.82rem] leading-relaxed">
                Requested by {submission.requesting_agents} agent
                {submission.requesting_agents === 1 ? "" : "s"}
                {submission.agent_names ? ` · ${submission.agent_names}` : ""}
              </p>
              <p className="m-0 text-[#8d8da6] text-[0.82rem] leading-relaxed">
                Submitted by {submission.submitted_by || "Unknown"} · Updated{" "}
                {new Date(submission.updated_at).toLocaleString()}
              </p>

              <div className="flex gap-3 flex-wrap mt-1">
                <button
                  type="button"
                  onClick={() => void handleStatusUpdate(submission.id, "active")}
                  disabled={actingId === submission.id || submission.status === "active"}
                  className={`px-4 py-2.5 bg-gradient-to-br from-emerald-500 to-emerald-400 border-none rounded-lg text-emerald-950 font-bold cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap ${
                    actingId === submission.id || submission.status === "active" ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {actingId === submission.id && submission.status !== "active"
                    ? "Updating..."
                    : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleStatusUpdate(submission.id, "rejected")}
                  disabled={actingId === submission.id || submission.status === "rejected"}
                  className={`px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 font-bold cursor-pointer hover:bg-red-500/20 transition-colors whitespace-nowrap ${
                    actingId === submission.id || submission.status === "rejected" ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
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
