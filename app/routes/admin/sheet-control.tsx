import { useEffect, useMemo, useState } from "react";
import { getAuthToken } from "../../utils/auth-session";

interface AgentOption {
  id: number;
  name: string;
  slug: string;
  is_active: number;
}

interface AgentSheetSource {
  id: number;
  agent_id: number;
  agent_name: string;
  agent_slug: string;
  sheet_url: string;
  sheet_tab_name: string | null;
  is_active: number;
  auto_approve_clean_rows: number;
  last_synced_at: string | null;
  last_sync_status: "success" | "partial" | "failed" | null;
  last_sync_message: string | null;
  created_at: string;
  updated_at: string;
  pending_rows: number;
}

interface DiscoveredTab {
  gid: number;
  title: string;
}

interface SubmissionRow {
  id: number;
  batch_id: number;
  source_id: number;
  source_sheet_url: string;
  source_sheet_tab_name: string | null;
  agent_id: number;
  agent_name: string;
  agent_slug: string;
  asin: string | null;
  marketplace: string | null;
  title: string | null;
  category: string | null;
  custom_title: string | null;
  tracking_tag: string | null;
  row_status: "active" | "inactive";
  product_status: "active" | "pending_review" | "rejected";
  validation_color: "green" | "yellow" | "red";
  validation_code: string | null;
  validation_message: string | null;
  status: "pending" | "approved" | "rejected" | "auto_approved";
  reviewed_at: string | null;
  reviewed_by_username: string | null;
  created_at: string;
}

interface OverviewData {
  sourceCount: number;
  activeSourceCount: number;
  pendingCount: number;
  approvedCount: number;
  autoApprovedCount: number;
  rejectedCount: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  recentBatches: Array<{
    id: number;
    source_id: number;
    agent_name: string;
    status: "success" | "partial" | "failed";
    total_rows: number;
    queued_rows: number;
    approved_rows: number;
    flagged_rows: number;
    rejected_rows: number;
    created_at: string;
  }>;
}

interface OverviewResponse {
  overview: OverviewData;
  sources: AgentSheetSource[];
}

type SubmissionStatusFilter = "all" | "pending" | "approved" | "rejected" | "auto_approved";
type ValidationColorFilter = "all" | "green" | "yellow" | "red";

const getToken = () => getAuthToken();

const EMPTY_OVERVIEW: OverviewData = {
  sourceCount: 0,
  activeSourceCount: 0,
  pendingCount: 0,
  approvedCount: 0,
  autoApprovedCount: 0,
  rejectedCount: 0,
  greenCount: 0,
  yellowCount: 0,
  redCount: 0,
  recentBatches: [],
};

export default function SheetControlPage() {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [sources, setSources] = useState<AgentSheetSource[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [overview, setOverview] = useState<OverviewData>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [discoveringTabs, setDiscoveringTabs] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatusFilter>("all");
  const [validationColorFilter, setValidationColorFilter] =
    useState<ValidationColorFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [form, setForm] = useState({
    agent_id: "",
    sheet_url: "",
    sheet_tab_name: "",
    is_active: true,
    auto_approve_clean_rows: true,
  });
  const [discoveredTabs, setDiscoveredTabs] = useState<DiscoveredTab[]>([]);
  const [selectedTabTitles, setSelectedTabTitles] = useState<string[]>([]);

  useEffect(() => {
    void initialLoad();
  }, []);

  useEffect(() => {
    void fetchSubmissions();
  }, [statusFilter, validationColorFilter, sourceFilter]);

  const availableAgents = useMemo(
    () => agents.filter((agent) => agent.is_active === 1),
    [agents]
  );

  async function initialLoad() {
    setLoading(true);
    setError("");

    try {
      await Promise.all([fetchAgents(), fetchOverview(), fetchSubmissions()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to load sheet control data"
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgents() {
    const response = await fetch("/api/agents", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error || "Failed to load agents");
    }

    const payload = (await response.json()) as { agents: AgentOption[] };
    setAgents(payload.agents ?? []);
  }

  async function fetchOverview() {
    const response = await fetch("/api/sheet-control/overview", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error || "Failed to load sheet overview");
    }

    const payload = (await response.json()) as OverviewResponse;
    setOverview(payload.overview);
    setSources(payload.sources);
  }

  async function fetchSubmissions() {
    setSubmissionsLoading(true);

    try {
      const query = new URLSearchParams();
      if (statusFilter !== "all") query.set("status", statusFilter);
      if (validationColorFilter !== "all") {
        query.set("validationColor", validationColorFilter);
      }
      if (sourceFilter !== "all") {
        query.set("sourceId", sourceFilter);
      }

      const response = await fetch(`/api/sheet-control/submissions?${query.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Failed to load staged submissions");
      }

      const payload = (await response.json()) as { submissions: SubmissionRow[] };
      setSubmissions(payload.submissions ?? []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load staged submissions"
      );
    } finally {
      setSubmissionsLoading(false);
    }
  }

  async function handleSaveSource(event: React.FormEvent) {
    event.preventDefault();
    if (!form.agent_id || !form.sheet_url.trim()) {
      setError("Agent and Google Sheet URL are required.");
      return;
    }
    if (!editingSourceId && selectedTabTitles.length === 0) {
      setError("Discover tabs and select at least one tab.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const method = editingSourceId ? "PUT" : "POST";
      const url = editingSourceId
        ? `/api/sheet-control/sources/${editingSourceId}`
        : "/api/sheet-control/sources";
      const payload = {
        agent_id: Number(form.agent_id),
        sheet_url: form.sheet_url.trim(),
        sheet_tab_name: form.sheet_tab_name.trim() || null,
        selected_tabs: editingSourceId
          ? undefined
          : discoveredTabs
              .filter((tab) => selectedTabTitles.includes(tab.title))
              .map((tab) => ({ gid: tab.gid, title: tab.title })),
        is_active: form.is_active,
        auto_approve_clean_rows: form.auto_approve_clean_rows,
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(result.error || result.message || "Failed to save source");
      }

      setMessage(result.message || "Sheet source saved.");
      resetForm();
      await fetchOverview();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save source");
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscoverTabs() {
    if (!form.sheet_url.trim()) {
      setError("Enter a Google Sheet URL first.");
      return;
    }

    setDiscoveringTabs(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/sheet-control/discover-tabs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          sheet_url: form.sheet_url.trim(),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        tabs?: DiscoveredTab[];
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to discover tabs");
      }

      const tabs = payload.tabs ?? [];
      setDiscoveredTabs(tabs);
      setSelectedTabTitles(tabs.map((tab) => tab.title));
      setMessage(
        tabs.length > 0
          ? `Discovered ${tabs.length} tab${tabs.length === 1 ? "" : "s"}.`
          : "No tabs found in this spreadsheet."
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to discover tabs");
    } finally {
      setDiscoveringTabs(false);
    }
  }

  async function handleSyncAll() {
    setSyncingAll(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/sheet-control/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({}),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Failed to sync sources");
      }

      setMessage(payload.message || "Sync completed.");
      await Promise.all([fetchOverview(), fetchSubmissions()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to sync sources");
    } finally {
      setSyncingAll(false);
    }
  }

  async function handleSyncSource(sourceId: number) {
    setActingId(sourceId);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/sheet-control/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ source_id: sourceId }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Failed to sync source");
      }

      setMessage(payload.message || "Source synced.");
      await Promise.all([fetchOverview(), fetchSubmissions()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to sync source");
    } finally {
      setActingId(null);
    }
  }

  async function handleToggleSource(source: AgentSheetSource, key: "is_active" | "auto_approve_clean_rows") {
    setActingId(source.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/sheet-control/sources/${source.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          [key]: key === "is_active" ? source.is_active !== 1 : source.auto_approve_clean_rows !== 1,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Failed to update source");
      }

      setMessage(payload.message || "Source updated.");
      await fetchOverview();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update source");
    } finally {
      setActingId(null);
    }
  }

  async function handleReviewAction(submissionId: number, action: "approve" | "reject") {
    setActingId(submissionId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/sheet-control/submissions/${submissionId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({}),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error || payload.message || `Failed to ${action} submission`);
      }

      setMessage(payload.message || `Submission ${action}d.`);
      await Promise.all([fetchOverview(), fetchSubmissions()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `Failed to ${action} submission`
      );
    } finally {
      setActingId(null);
    }
  }

  function startEditing(source: AgentSheetSource) {
    setEditingSourceId(source.id);
    setDiscoveredTabs([]);
    setSelectedTabTitles([]);
    setForm({
      agent_id: String(source.agent_id),
      sheet_url: source.sheet_url,
      sheet_tab_name: source.sheet_tab_name || "",
      is_active: source.is_active === 1,
      auto_approve_clean_rows: source.auto_approve_clean_rows === 1,
    });
    setMessage("");
    setError("");
  }

  function resetForm() {
    setEditingSourceId(null);
    setDiscoveredTabs([]);
    setSelectedTabTitles([]);
    setForm({
      agent_id: "",
      sheet_url: "",
      sheet_tab_name: "",
      is_active: true,
      auto_approve_clean_rows: true,
    });
  }

  function getColorClasses(color: SubmissionRow["validation_color"]) {
    if (color === "red") {
      return "border-red-500/25 bg-red-500/10 text-red-300";
    }
    if (color === "yellow") {
      return "border-amber-500/25 bg-amber-500/10 text-amber-200";
    }
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }

  function toggleTabSelection(title: string) {
    setSelectedTabTitles((current) =>
      current.includes(title)
        ? current.filter((item) => item !== title)
        : [...current, title]
    );
  }

  if (loading) {
    return <p className="text-[#a0a0b8]">Loading sheet control center...</p>;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="m-0 text-2xl font-bold text-[#f0f0f5] sm:text-3xl">Sheet Control</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#8d8da6]">
            Agent sheets feed a staged review queue. Clean rows can auto-approve,
            while conflicts stay here until admin review.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void initialLoad()}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#f0f0f5] transition-colors hover:bg-white/10"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleSyncAll()}
            disabled={syncingAll || sources.length === 0}
            className={`rounded-lg px-4 py-2.5 text-sm font-bold transition-opacity ${
              syncingAll || sources.length === 0
                ? "cursor-not-allowed bg-[#ff9900]/60 text-black/70"
                : "bg-gradient-to-br from-[#ff9900] to-[#ffad33] text-black hover:opacity-90"
            }`}
          >
            {syncingAll ? "Syncing..." : "Sync All Agent Sheets"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0">{error}</p>
            <button
              type="button"
              onClick={() => void initialLoad()}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#f0f0f5] transition-colors hover:bg-white/10"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-100">
          {message}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Sources" value={overview.sourceCount} detail={`${overview.activeSourceCount} active`} />
        <SummaryCard label="Pending" value={overview.pendingCount} detail="Needs review" />
        <SummaryCard label="Approved" value={overview.approvedCount} detail="Manual approvals" />
        <SummaryCard label="Auto Approved" value={overview.autoApprovedCount} detail="Clean rows applied" />
        <SummaryCard label="Yellow Flags" value={overview.yellowCount} detail="Missing setup or fields" />
        <SummaryCard label="Red Flags" value={overview.redCount} detail="Conflicts or duplicates" />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-white/5 bg-[#1a1a28]/90 p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-lg font-bold text-[#f0f0f5]">
                {editingSourceId ? "Edit Agent Sheet" : "Add Agent Sheet"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#8d8da6]">
                One agent, one input sheet. The website stays DB-driven.
              </p>
            </div>
            {editingSourceId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-[#f0f0f5] transition-colors hover:bg-white/10"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>

          <form onSubmit={(event) => void handleSaveSource(event)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-sm text-[#a0a0b8]">Agent</span>
                <select
                  value={form.agent_id}
                  disabled={editingSourceId !== null}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, agent_id: event.target.value }))
                  }
                  className="w-full appearance-auto rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                >
                  <option className="bg-gray-800" value="">
                    Select an agent
                  </option>
                  {availableAgents.map((agent) => (
                    <option key={agent.id} className="bg-gray-800" value={agent.id}>
                      {agent.name} ({agent.slug})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1.5 block text-sm text-[#a0a0b8]">
                  {editingSourceId ? "Sheet Tab Name" : "Discovered Tabs"}
                </span>
                {editingSourceId ? (
                  <input
                    value={form.sheet_tab_name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sheet_tab_name: event.target.value }))
                    }
                    placeholder="Products"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
                  />
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-[#d4d4e4]">
                    {discoveredTabs.length === 0
                      ? "Paste a sheet URL and discover tabs. You can then select the country tabs to save."
                      : `${selectedTabTitles.length} of ${discoveredTabs.length} tab(s) selected`}
                  </div>
                )}
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm text-[#a0a0b8]">Google Sheet URL</span>
              <input
                value={form.sheet_url}
                onChange={(event) => {
                  setForm((current) => ({ ...current, sheet_url: event.target.value }));
                  if (!editingSourceId) {
                    setDiscoveredTabs([]);
                    setSelectedTabTitles([]);
                  }
                }}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=0"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
              />
            </label>

            {!editingSourceId ? (
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={discoveringTabs || !form.sheet_url.trim()}
                  onClick={() => void handleDiscoverTabs()}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-opacity ${
                    discoveringTabs || !form.sheet_url.trim()
                      ? "cursor-not-allowed bg-white/10 text-[#8d8da6]"
                      : "bg-white/10 text-[#f0f0f5] hover:bg-white/15"
                  }`}
                >
                  {discoveringTabs ? "Discovering..." : "Discover Tabs"}
                </button>

                {discoveredTabs.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {discoveredTabs.map((tab) => {
                      const checked = selectedTabTitles.includes(tab.title);

                      return (
                        <label
                          key={`${tab.gid}:${tab.title}`}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors ${
                            checked
                              ? "border-[#ff9900]/50 bg-[#ff9900]/10 text-[#f0f0f5]"
                              : "border-white/10 bg-white/[0.03] text-[#c4c4d4]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTabSelection(tab.title)}
                            className="h-4 w-4 rounded border-white/10 bg-white/5 text-[#ff9900]"
                          />
                          <span className="font-semibold">{tab.title}</span>
                          <span className="text-xs text-[#8d8da6]">gid: {tab.gid}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-6">
              <label className="inline-flex items-center gap-2 text-sm text-[#d4d4e4]">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, is_active: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-white/10 bg-white/5 text-[#ff9900]"
                />
                Source active
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[#d4d4e4]">
                <input
                  type="checkbox"
                  checked={form.auto_approve_clean_rows}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      auto_approve_clean_rows: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-white/10 bg-white/5 text-[#ff9900]"
                />
                Auto-approve green rows
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`rounded-lg px-5 py-2.5 text-sm font-bold transition-opacity ${
                saving
                  ? "cursor-not-allowed bg-[#ff9900]/60 text-black/70"
                  : "bg-gradient-to-br from-[#ff9900] to-[#ffad33] text-black hover:opacity-90"
              }`}
            >
              {saving ? "Saving..." : editingSourceId ? "Update Sheet Source" : "Create Sheet Source"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/5 bg-[#1a1a28]/90 p-6">
          <div className="mb-4">
            <h2 className="m-0 text-lg font-bold text-[#f0f0f5]">Recent Sync Batches</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#8d8da6]">
              Latest runs across all configured sources.
            </p>
          </div>

          {overview.recentBatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-[#8d8da6]">
              No sync batches yet. Add an agent sheet and run sync.
            </div>
          ) : (
            <div className="space-y-3">
              {overview.recentBatches.map((batch) => (
                <article
                  key={batch.id}
                  className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="font-semibold text-[#f0f0f5]">{batch.agent_name}</div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                        batch.status === "success"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : batch.status === "partial"
                            ? "bg-amber-500/10 text-amber-300"
                            : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {batch.status}
                    </span>
                  </div>
                  <p className="m-0 text-xs leading-relaxed text-[#a0a0b8]">
                    {batch.total_rows} rows · queued {batch.queued_rows} · auto-approved{" "}
                    {batch.approved_rows} · flagged {batch.flagged_rows}
                  </p>
                  <p className="mt-2 text-xs text-[#6b6b85]">
                    {new Date(batch.created_at).toLocaleString()}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mb-6 rounded-2xl border border-white/5 bg-[#1a1a28]/90 p-6">
        <div className="mb-4">
          <h2 className="m-0 text-lg font-bold text-[#f0f0f5]">Configured Agent Sheets</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#8d8da6]">
            These sheets are input-only. Live site data still comes from approved D1 mappings.
          </p>
        </div>

        {sources.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-[#8d8da6]">
            No agent sheets configured yet.
          </div>
        ) : (
          <div className="space-y-4">
            {sources.map((source) => (
              <article
                key={source.id}
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-5"
              >
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="m-0 text-base font-bold text-[#f0f0f5]">
                        {source.agent_name}
                      </h3>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-[#d4d4e4]">
                        {source.agent_slug}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          source.is_active === 1
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-white/5 text-[#a0a0b8]"
                        }`}
                      >
                        {source.is_active === 1 ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="mt-3 break-all text-sm leading-relaxed text-[#8d8da6]">
                      {source.sheet_url}
                    </p>
                    <p className="mt-2 text-xs text-[#6b6b85]">
                      Tab: {source.sheet_tab_name || "Auto-detect"} · Pending rows: {source.pending_rows}
                    </p>
                    <p className="mt-1 text-xs text-[#6b6b85]">
                      Last sync:{" "}
                      {source.last_synced_at
                        ? `${new Date(source.last_synced_at).toLocaleString()}`
                        : "Never"}
                      {source.last_sync_status ? ` · ${source.last_sync_status}` : ""}
                    </p>
                    {source.last_sync_message ? (
                      <p className="mt-2 text-xs text-[#a0a0b8]">{source.last_sync_message}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEditing(source)}
                      className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-[#f0f0f5] transition-colors hover:bg-white/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={actingId === source.id}
                      onClick={() => void handleSyncSource(source.id)}
                      className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/15"
                    >
                      {actingId === source.id ? "Syncing..." : "Sync Now"}
                    </button>
                    <button
                      type="button"
                      disabled={actingId === source.id}
                      onClick={() => void handleToggleSource(source, "is_active")}
                      className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-[#f0f0f5] transition-colors hover:bg-white/10"
                    >
                      {source.is_active === 1 ? "Pause" : "Activate"}
                    </button>
                    <button
                      type="button"
                      disabled={actingId === source.id}
                      onClick={() => void handleToggleSource(source, "auto_approve_clean_rows")}
                      className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-[#f0f0f5] transition-colors hover:bg-white/10"
                    >
                      {source.auto_approve_clean_rows === 1 ? "Auto On" : "Auto Off"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/5 bg-[#1a1a28]/90 p-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="m-0 text-lg font-bold text-[#f0f0f5]">Master Review Queue</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#8d8da6]">
              Red rows are conflicts, yellow rows are incomplete, green rows are clean.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="mb-1.5 block text-xs text-[#a0a0b8]">Status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as SubmissionStatusFilter)
                }
                className="w-full appearance-auto rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option className="bg-gray-800" value="all">All statuses</option>
                <option className="bg-gray-800" value="pending">Pending</option>
                <option className="bg-gray-800" value="approved">Approved</option>
                <option className="bg-gray-800" value="auto_approved">Auto approved</option>
                <option className="bg-gray-800" value="rejected">Rejected</option>
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-xs text-[#a0a0b8]">Color</span>
              <select
                value={validationColorFilter}
                onChange={(event) =>
                  setValidationColorFilter(event.target.value as ValidationColorFilter)
                }
                className="w-full appearance-auto rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option className="bg-gray-800" value="all">All colors</option>
                <option className="bg-gray-800" value="red">Red</option>
                <option className="bg-gray-800" value="yellow">Yellow</option>
                <option className="bg-gray-800" value="green">Green</option>
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-xs text-[#a0a0b8]">Source</span>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                className="w-full appearance-auto rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option className="bg-gray-800" value="all">All sheets</option>
                {sources.map((source) => (
                  <option key={source.id} className="bg-gray-800" value={source.id}>
                    {source.agent_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {submissionsLoading ? (
          <p className="m-0 text-[#8d8da6]">Loading staged submissions...</p>
        ) : submissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
            <h3 className="m-0 text-lg font-semibold text-[#f0f0f5]">No staged rows</h3>
            <p className="mt-2 text-sm text-[#8d8da6]">
              Sync an agent sheet to populate the queue.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <article
                key={submission.id}
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-5"
              >
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${getColorClasses(
                          submission.validation_color
                        )}`}
                      >
                        {submission.validation_color}
                      </span>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-[#d4d4e4]">
                        {submission.status.replace("_", " ")}
                      </span>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-[#d4d4e4]">
                        {submission.agent_name}
                      </span>
                      {submission.marketplace ? (
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-[#d4d4e4]">
                          {submission.marketplace}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-3 text-base font-bold text-[#f0f0f5]">
                      {submission.title || submission.custom_title || "Untitled sheet row"}
                    </h3>
                    <p className="mt-2 text-sm text-[#8d8da6]">
                      ASIN: {submission.asin || "Missing"} · Tracking:{" "}
                      {submission.tracking_tag || "Default / Missing"}
                    </p>
                    <p className="mt-1 text-sm text-[#8d8da6]">
                      Row state: {submission.row_status} · Product state: {submission.product_status}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[#d4d4e4]">
                      {submission.validation_message || "No validation message."}
                    </p>
                    <p className="mt-2 text-xs text-[#6b6b85]">
                      Source #{submission.source_id}
                      {submission.source_sheet_tab_name ? ` · ${submission.source_sheet_tab_name}` : ""}
                      {" · "}
                      queued {new Date(submission.created_at).toLocaleString()}
                      {submission.reviewed_at
                        ? ` · reviewed ${new Date(submission.reviewed_at).toLocaleString()} by ${submission.reviewed_by_username || "System"}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {submission.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          disabled={actingId === submission.id}
                          onClick={() => void handleReviewAction(submission.id, "approve")}
                          className="rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-400 px-4 py-2.5 text-sm font-bold text-emerald-950 transition-opacity hover:opacity-90"
                        >
                          {actingId === submission.id ? "Working..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={actingId === submission.id}
                          onClick={() => void handleReviewAction(submission.id, "reject")}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/15"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#a0a0b8]">
                        No action needed
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard(props: { label: string; value: number; detail: string }) {
  return (
    <article className="rounded-2xl border border-white/5 bg-[#1a1a28]/90 p-4">
      <p className="m-0 text-xs uppercase tracking-[0.18em] text-[#6b6b85]">{props.label}</p>
      <div className="mt-3 text-3xl font-black text-[#f0f0f5]">{props.value}</div>
      <p className="mt-2 text-sm text-[#8d8da6]">{props.detail}</p>
    </article>
  );
}
