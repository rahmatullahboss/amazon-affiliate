import { useEffect, useState } from "react";
import type { Route } from "./+types/tracking";
import { extractApiErrorMessage } from "../../utils/api-errors";
import { getAuthToken } from "../../utils/auth-session";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "RKY Tag House" },
    { name: "application-name", content: "RKY Tag House" },
    { name: "apple-mobile-web-app-title", content: "RKY Tag House" },
  ];
}

interface TrackingIdRow {
  id: number;
  tag: string;
  label: string | null;
  marketplace: string;
  is_default: number;
  is_active: number;
  created_at: string;
  usage_count: number;
}

const MARKETPLACES = ["US", "CA", "UK", "DE", "IT", "FR", "ES"];

export default function PortalTrackingPage() {
  const [trackingIds, setTrackingIds] = useState<TrackingIdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<number | null>(null);
  const [replacementId, setReplacementId] = useState<number>(0);
  const [form, setForm] = useState({
    tag: "",
    label: "",
    marketplace: "US",
  });

  async function loadTracking() {
    const token = getAuthToken();
    const response = await fetch("/api/portal/tracking", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error("Failed to load tags");
    }

    const data = (await response.json()) as { trackingIds: TrackingIdRow[] };
    setTrackingIds(data.trackingIds);
  }

  useEffect(() => {
    loadTracking()
      .catch((requestError) =>
        setError(requestError instanceof Error ? requestError.message : "Failed to load tags")
      )
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = getAuthToken();
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
        const data = await response.json();
        throw new Error(extractApiErrorMessage(data, "Failed to save tag"));
      }

      setSuccess("Tag saved successfully");
      setForm({ tag: "", label: "", marketplace: "US" });
      await loadTracking();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save tag");
    } finally {
      setSaving(false);
    }
  };

  const getReplacementCandidates = (trackingId: TrackingIdRow) =>
    trackingIds.filter(
      (candidate) =>
        candidate.id !== trackingId.id &&
        candidate.marketplace === trackingId.marketplace &&
        candidate.is_active === 1
    );

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[minmax(320px,420px)_1fr] gap-4">
      <article className="bg-[#111827] border border-white/10 rounded-2xl p-6">
        <h1 className="m-0 mb-3 text-xl font-bold text-gray-50">Tags</h1>
        <p className="m-0 mb-2 text-slate-300 leading-relaxed">
          Add the tag the client gave you for each marketplace. Once a marketplace has a saved tag,
          you can paste an ASIN and generate your link automatically.
        </p>
        <p className="m-0 mb-4 text-slate-400 text-[0.92rem] leading-relaxed">
          You can paste just the tag or the full tag format like <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">?tag=agent-us-20</code>. The
          system will save only the clean tag automatically.
        </p>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <select
            className="w-full px-4 py-3 bg-gray-800 border border-white/10 rounded-xl text-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-auto"
            value={form.marketplace}
            onChange={(e) => setForm({ ...form, marketplace: e.target.value })}
          >
            {MARKETPLACES.map((marketplace) => (
              <option className="bg-gray-800" key={marketplace} value={marketplace}>
                {marketplace}
              </option>
            ))}
          </select>

          <input
            className="w-full px-4 py-3 bg-gray-800 border border-white/10 rounded-xl text-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-500"
            placeholder="Tag or ?tag=agent-us-20"
            value={form.tag}
            onChange={(e) => setForm({ ...form, tag: e.target.value })}
            required
          />

          <input
            className="w-full px-4 py-3 bg-gray-800 border border-white/10 rounded-xl text-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-500"
            placeholder="Label (optional)"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />

          <button type="submit" className="px-4 py-3.5 bg-amber-500 border-none rounded-xl text-gray-900 font-bold cursor-pointer hover:bg-amber-400 transition-colors disabled:opacity-70 disabled:cursor-not-allowed" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Tag" : "Save Tag"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="px-4 py-3.5 bg-transparent border border-white/20 rounded-xl text-gray-200 font-semibold cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => {
                setEditingId(null);
                setError("");
                setSuccess("");
                setForm({ tag: "", label: "", marketplace: "US" });
              }}
            >
              Cancel Edit
            </button>
          ) : null}
        </form>

        {error ? <p className="mt-3 mb-0 p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-300">{error}</p> : null}
        {success ? <p className="mt-3 mb-0 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-300">{success}</p> : null}
      </article>

      <article className="bg-[#111827] border border-white/10 rounded-2xl p-6">
        <h2 className="m-0 mb-4 text-xl font-bold text-gray-50">Saved Tags</h2>
        {loading ? <p className="m-0 mb-2 text-slate-300 leading-relaxed">Loading...</p> : null}
        {!loading && trackingIds.length === 0 ? (
          <p className="m-0 mb-2 text-slate-300 leading-relaxed">No tags saved yet.</p>
        ) : null}

        <div className="grid gap-3">
          {trackingIds.map((trackingId) => (
            <div key={trackingId.id} className="p-4 border border-white/10 rounded-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="m-0 mb-1 text-gray-50 font-semibold">{trackingId.tag}</p>
                <p className="m-0 text-slate-300 text-sm leading-relaxed">
                  {trackingId.marketplace} · {trackingId.label || "Default tag"}
                </p>
                {trackingId.usage_count > 0 ? (
                  <p className="m-0 mt-2 text-xs text-slate-400">
                    Linked to {trackingId.usage_count} product{trackingId.usage_count > 1 ? "s" : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="px-3 py-1.5 bg-transparent border border-white/20 rounded-full text-slate-50 text-xs font-semibold cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => {
                    setEditingId(trackingId.id);
                    setError("");
                    setSuccess("");
                    setForm({
                      tag: trackingId.tag,
                      label: trackingId.label || "",
                      marketplace: trackingId.marketplace,
                    });
                  }}
                >
                  Edit
                </button>
                {trackingId.usage_count === 0 ? (
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full text-red-400 text-xs font-semibold cursor-pointer hover:bg-red-500/20 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    disabled={deletingId === trackingId.id || replacingId === trackingId.id}
                    onClick={async () => {
                      if (!window.confirm("Delete this tag?")) return;

                      setDeletingId(trackingId.id);
                      setError("");
                      setSuccess("");

                      try {
                        const token = getAuthToken();
                        const response = await fetch(`/api/portal/tracking/${trackingId.id}`, {
                          method: "DELETE",
                          headers: { Authorization: `Bearer ${token}` },
                        });

                        if (!response.ok) {
                          const data = await response.json();
                          throw new Error(extractApiErrorMessage(data, "Failed to delete tag"));
                        }

                        if (editingId === trackingId.id) {
                          setEditingId(null);
                          setForm({ tag: "", label: "", marketplace: "US" });
                        }

                        setSuccess("Tag deleted successfully");
                        await loadTracking();
                      } catch (requestError) {
                        setError(requestError instanceof Error ? requestError.message : "Failed to delete tag");
                      } finally {
                        setDeletingId(null);
                      }
                    }}
                  >
                    {deletingId === trackingId.id ? "Deleting..." : "Delete"}
                  </button>
                ) : null}
                {trackingId.usage_count > 0 ? (
                  <>
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-sky-500/10 border border-sky-500/30 rounded-full text-sky-300 text-xs font-semibold cursor-pointer hover:bg-sky-500/20 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                      disabled={
                        replacingId === trackingId.id ||
                        getReplacementCandidates(trackingId).length === 0
                      }
                      onClick={() => {
                        const candidates = getReplacementCandidates(trackingId);
                        if (candidates.length === 0) return;
                        setReplaceTargetId(trackingId.id);
                        setReplacementId(candidates[0].id);
                        setError("");
                        setSuccess("");
                      }}
                    >
                      Replace & Delete
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full text-red-400 text-xs font-semibold cursor-pointer hover:bg-red-500/20 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                      disabled={deletingId === trackingId.id || replacingId === trackingId.id}
                      onClick={async () => {
                        if (!window.confirm(`Delete this tag and remove its ${trackingId.usage_count} linked product mapping${trackingId.usage_count > 1 ? "s" : ""}?`)) return;

                        setDeletingId(trackingId.id);
                        setError("");
                        setSuccess("");

                        try {
                          const token = getAuthToken();
                          const response = await fetch(`/api/portal/tracking/${trackingId.id}?cascade=1`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${token}` },
                          });

                          const data = (await response.json()) as { message?: string; error?: unknown };
                          if (!response.ok) {
                            throw new Error(extractApiErrorMessage(data, "Failed to delete tag"));
                          }

                          if (editingId === trackingId.id) {
                            setEditingId(null);
                            setForm({ tag: "", label: "", marketplace: "US" });
                          }

                          setSuccess(typeof data.message === "string" ? data.message : "Tag deleted successfully");
                          await loadTracking();
                        } catch (requestError) {
                          setError(requestError instanceof Error ? requestError.message : "Failed to delete tag");
                        } finally {
                          setDeletingId(null);
                        }
                      }}
                    >
                      {deletingId === trackingId.id ? "Deleting..." : "Delete with Links"}
                    </button>
                  </>
                ) : null}
                <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full text-amber-500 text-xs font-bold">
                  {trackingId.is_default ? "Default" : "Saved"}
                </span>
                {trackingId.usage_count > 0 ? (
                  <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-slate-300 text-xs font-semibold">
                    In Use
                  </span>
                ) : null}
              </div>
            </div>
              {replaceTargetId === trackingId.id ? (
                <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                  <p className="m-0 mb-3 text-sm text-sky-100">
                    Move this tag's linked products to another {trackingId.marketplace} tag, then delete it.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      className="w-full px-4 py-3 bg-gray-800 border border-white/10 rounded-xl text-gray-50 focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-auto"
                      value={replacementId}
                      onChange={(event) => setReplacementId(Number(event.target.value))}
                    >
                      {getReplacementCandidates(trackingId).map((candidate) => (
                          <option className="bg-gray-800" key={candidate.id} value={candidate.id}>
                            {candidate.tag} {candidate.label ? `· ${candidate.label}` : ""}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="px-4 py-3 bg-sky-500 border-none rounded-xl text-white font-semibold cursor-pointer hover:bg-sky-400 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                      disabled={replacingId === trackingId.id || replacementId === 0}
                      onClick={async () => {
                        setReplacingId(trackingId.id);
                        setError("");
                        setSuccess("");

                        try {
                          const token = getAuthToken();
                          const response = await fetch(`/api/portal/tracking/${trackingId.id}/replace-delete`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ replacement_tracking_id: replacementId }),
                          });

                          const data = (await response.json()) as { message?: string; error?: unknown };
                          if (!response.ok) {
                            throw new Error(extractApiErrorMessage(data, "Failed to replace and delete tag"));
                          }

                          if (editingId === trackingId.id) {
                            setEditingId(null);
                            setForm({ tag: "", label: "", marketplace: "US" });
                          }

                          setReplaceTargetId(null);
                          setReplacementId(0);
                          setSuccess(
                            typeof data.message === "string"
                              ? data.message
                              : "Tag replaced and deleted successfully"
                          );
                          await loadTracking();
                        } catch (requestError) {
                          setError(
                            requestError instanceof Error
                              ? requestError.message
                              : "Failed to replace and delete tag"
                          );
                        } finally {
                          setReplacingId(null);
                        }
                      }}
                    >
                      {replacingId === trackingId.id ? "Replacing..." : "Confirm Replace & Delete"}
                    </button>
                    <button
                      type="button"
                      className="px-4 py-3 bg-transparent border border-white/20 rounded-xl text-gray-200 font-semibold cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => {
                        setReplaceTargetId(null);
                        setReplacementId(0);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  {getReplacementCandidates(trackingId).length === 0 ? (
                    <p className="m-0 mt-3 text-xs text-slate-400">
                      No other active {trackingId.marketplace} tag is available yet. Save another tag first if you want to replace this one.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {trackingId.usage_count > 0 && replaceTargetId !== trackingId.id ? (
                <p className="m-0 mt-3 text-xs text-slate-400">
                  This tag is linked to live product links. Use <span className="font-semibold text-sky-300">Replace &amp; Delete</span> to move those links to another {trackingId.marketplace} tag, or use <span className="font-semibold text-red-300">Delete with Links</span> to remove both the tag and its linked products.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
