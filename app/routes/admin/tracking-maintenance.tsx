import { useEffect, useMemo, useState } from "react";
import { extractApiErrorMessage } from "../../utils/api-errors";
import { getAuthToken } from "../../utils/auth-session";

type MarketplaceFilter = "ALL" | "US" | "CA" | "UK" | "DE" | "FR" | "IT" | "ES";

interface MappingRow {
  id: number;
  agent_id: number;
  product_id: number;
  tracking_id: number;
  agent_name: string;
  agent_slug: string;
  asin: string;
  product_title: string;
  image_url: string;
  product_marketplace?: string | null;
  tracking_tag: string;
  tracking_is_active: number;
  tracking_marketplace: string;
  is_active: number;
}

interface TrackingRow {
  id: number;
  agent_id: number;
  tag: string;
  label: string | null;
  marketplace: string;
  is_active: number;
  linked_product_count?: number;
  agent_name: string;
  agent_slug: string;
}

interface ReplaceResponse {
  message?: string;
  summary?: {
    matched: number;
    updated: number;
    skippedMissingReplacement: number;
    marketplace: string;
  };
}

const MARKETPLACES: MarketplaceFilter[] = ["ALL", "US", "CA", "UK", "DE", "FR", "IT", "ES"];
const MAX_REPLACE_ROWS = 500;

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function getMappingMarketplace(mapping: MappingRow) {
  return (mapping.product_marketplace || mapping.tracking_marketplace || "").toUpperCase();
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))];
}

export default function TrackingMaintenancePage() {
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [trackingIds, setTrackingIds] = useState<TrackingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [marketplaceFilter, setMarketplaceFilter] = useState<MarketplaceFilter>("ALL");
  const [oldTrackingTag, setOldTrackingTag] = useState("");
  const [newTrackingTag, setNewTrackingTag] = useState("");
  const [selectedMappingIds, setSelectedMappingIds] = useState<number[]>([]);
  const [lastResult, setLastResult] = useState<ReplaceResponse | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${getAuthToken()}` };
      const [mappingsResponse, trackingResponse] = await Promise.all([
        fetch("/api/mappings", { headers }),
        fetch("/api/tracking", { headers }),
      ]);

      const mappingsPayload = (await mappingsResponse.json()) as unknown;
      const trackingPayload = (await trackingResponse.json()) as unknown;

      if (!mappingsResponse.ok) {
        throw new Error(extractApiErrorMessage(mappingsPayload, "Failed to load mappings"));
      }
      if (!trackingResponse.ok) {
        throw new Error(extractApiErrorMessage(trackingPayload, "Failed to load tracking tags"));
      }

      const mappingData = mappingsPayload as { mappings?: MappingRow[] };
      const trackingData = trackingPayload as { trackingIds?: TrackingRow[] };

      setMappings(mappingData.mappings || []);
      setTrackingIds(trackingData.trackingIds || []);
      setSelectedMappingIds([]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  const activeTrackingIds = useMemo(
    () => trackingIds.filter((tag) => tag.is_active === 1),
    [trackingIds]
  );

  const availableTrackingTags = useMemo(() => {
    const tags = new Set<string>();
    activeTrackingIds
      .filter((tag) => marketplaceFilter === "ALL" || tag.marketplace === marketplaceFilter)
      .forEach((tag) => tags.add(tag.tag));

    return Array.from(tags).sort((left, right) => left.localeCompare(right));
  }, [activeTrackingIds, marketplaceFilter]);

  const filteredMappings = useMemo(() => {
    const search = normalizeText(query);
    const oldTag = normalizeText(oldTrackingTag);

    return mappings.filter((mapping) => {
      const marketplace = getMappingMarketplace(mapping);
      if (marketplaceFilter !== "ALL" && marketplace !== marketplaceFilter) {
        return false;
      }

      if (oldTag && normalizeText(mapping.tracking_tag) !== oldTag) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        mapping.asin,
        mapping.product_title,
        mapping.agent_name,
        mapping.agent_slug,
        mapping.tracking_tag,
        marketplace,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [mappings, query, marketplaceFilter, oldTrackingTag]);

  const selectedRows = useMemo(
    () => filteredMappings.filter((mapping) => selectedMappingIds.includes(mapping.id)),
    [filteredMappings, selectedMappingIds]
  );

  const selectedProductIds = useMemo(
    () => uniqueNumbers(selectedRows.map((row) => row.product_id)),
    [selectedRows]
  );

  const selectedTrackingIds = useMemo(
    () => uniqueNumbers(selectedRows.map((row) => row.tracking_id)),
    [selectedRows]
  );

  const allFilteredSelected =
    filteredMappings.length > 0 && filteredMappings.every((mapping) => selectedMappingIds.includes(mapping.id));

  function toggleAllFiltered(checked: boolean) {
    setSelectedMappingIds(checked ? filteredMappings.map((mapping) => mapping.id) : []);
  }

  function toggleSelected(mappingId: number, checked: boolean) {
    setSelectedMappingIds((current) =>
      checked ? [...new Set([...current, mappingId])] : current.filter((id) => id !== mappingId)
    );
  }

  async function replaceTracking(scope: "selected" | "filtered") {
    const oldTag = oldTrackingTag.trim();
    const newTag = newTrackingTag.trim();

    if (!oldTag || !newTag) {
      setError("Old tag এবং new tag দুটোই দিতে হবে।");
      return;
    }

    if (oldTag === newTag) {
      setError("Old tag এবং new tag একই হতে পারবে না।");
      return;
    }

    const targetIds = scope === "selected" ? selectedRows.map((row) => row.id) : filteredMappings.map((row) => row.id);

    if (targetIds.length === 0) {
      setError(scope === "selected" ? "Select at least one mapping first." : "No filtered mapping found.");
      return;
    }

    if (targetIds.length > MAX_REPLACE_ROWS) {
      setError(`একবারে সর্বোচ্চ ${MAX_REPLACE_ROWS} mapping replace করা যাবে। Filter আরো narrow করুন।`);
      return;
    }

    const confirmMessage =
      scope === "selected"
        ? `Replace tracking tag for ${targetIds.length} selected mappings?`
        : `Replace tracking tag for ${targetIds.length} filtered mappings?`;

    if (!window.confirm(`${confirmMessage}\n\nOld: ${oldTag}\nNew: ${newTag}`)) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    setLastResult(null);

    try {
      const response = await fetch("/api/mappings/bulk-replace-tag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          old_tracking_tag: oldTag,
          new_tracking_tag: newTag,
          marketplace: marketplaceFilter,
          mapping_ids: targetIds,
        }),
      });

      const payload = (await response.json()) as ReplaceResponse & Record<string, unknown>;
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload, "Failed to replace tracking tags"));
      }

      setLastResult(payload);
      setMessage(payload.message || "Tracking tags replaced.");
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to replace tracking tags");
    } finally {
      setSaving(false);
    }
  }

  async function callMaintenanceAction(
    path: string,
    body: Record<string, unknown>,
    confirmMessage: string,
    fallbackMessage: string
  ) {
    if (!window.confirm(confirmMessage)) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as { message?: string } & Record<string, unknown>;
      if (!response.ok) {
        throw new Error(extractApiErrorMessage(payload, fallbackMessage));
      }

      setMessage(payload.message || fallbackMessage);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : fallbackMessage);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedMappings() {
    if (selectedMappingIds.length === 0) {
      setError("Select mapping rows first.");
      return;
    }

    await callMaintenanceAction(
      "/api/maintenance/mappings/hard-delete",
      { mappingIds: selectedMappingIds },
      `Remove ${selectedMappingIds.length} selected product tracking mapping(s)? Products will remain, but their tracking link will be removed.`,
      "Failed to delete selected mappings"
    );
  }

  async function hardDeleteSelectedProducts() {
    if (selectedProductIds.length === 0) {
      setError("Select product rows first.");
      return;
    }

    await callMaintenanceAction(
      "/api/maintenance/products/hard-delete",
      { productIds: selectedProductIds },
      `Permanently delete ${selectedProductIds.length} selected product(s)? This removes product records and their tracking mappings. This cannot be undone.`,
      "Failed to delete selected products"
    );
  }

  async function hardDeleteSelectedTrackingTags() {
    if (selectedTrackingIds.length === 0) {
      setError("Select rows using the tracking tags you want to delete first.");
      return;
    }

    await callMaintenanceAction(
      "/api/maintenance/tracking/hard-delete",
      { trackingIds: selectedTrackingIds },
      `Permanently delete ${selectedTrackingIds.length} selected tracking tag(s)? Their product mappings will also be removed. This cannot be undone.`,
      "Failed to delete selected tracking tags"
    );
  }

  async function cleanupDuplicateMappings() {
    await callMaintenanceAction(
      "/api/maintenance/cleanup-single-mapping",
      {},
      "Turn off duplicate active tracking mappings and keep only the latest active mapping per product?",
      "Failed to clean duplicate mappings"
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-[0.22em] text-[#ff9900]">
            Single Tracking Mode
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#f0f0f5] sm:text-3xl">
            Tracking Maintenance
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a0a0b8]">
            Multi-tracking বন্ধ করা হয়েছে। এক product-এ একটাই active tracking mapping থাকবে।
            এখানে selected অথবা filtered product tracking bulk replace/delete করা যাবে।
          </p>
        </div>
        <button
          onClick={() => void loadData()}
          disabled={loading || saving}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#d4d4e4] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/5 bg-[#1a1a28]/80 p-4">
          <p className="m-0 text-xs uppercase tracking-[0.2em] text-[#8d8da6]">Active mappings</p>
          <p className="mt-2 text-2xl font-bold text-[#f0f0f5]">{mappings.length}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-[#1a1a28]/80 p-4">
          <p className="m-0 text-xs uppercase tracking-[0.2em] text-[#8d8da6]">Filtered</p>
          <p className="mt-2 text-2xl font-bold text-[#f0f0f5]">{filteredMappings.length}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-[#1a1a28]/80 p-4">
          <p className="m-0 text-xs uppercase tracking-[0.2em] text-[#8d8da6]">Selected products</p>
          <p className="mt-2 text-2xl font-bold text-[#f0f0f5]">{selectedProductIds.length}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-[#1a1a28]/80 p-4">
          <p className="m-0 text-xs uppercase tracking-[0.2em] text-[#8d8da6]">Active tags</p>
          <p className="mt-2 text-2xl font-bold text-[#f0f0f5]">{activeTrackingIds.length}</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-emerald-500/15 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-100">
        <strong>Rule:</strong> এখন থেকে কোনো product-এ নতুন tracking assign করলে আগের active tracking mapping off হয়ে যাবে।
        Mark করে selected product গুলো অন্য tracking দিয়ে replace করা যাবে।
      </div>

      <div className="mb-6 rounded-2xl border border-white/5 bg-[#1a1a28]/90 p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-sm text-[#a0a0b8]">Search</label>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ASIN, product title, agent, tag..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-[#a0a0b8]">Marketplace</label>
            <select
              value={marketplaceFilter}
              onChange={(event) => setMarketplaceFilter(event.target.value as MarketplaceFilter)}
              className="w-full rounded-lg border border-white/10 bg-[#12121a] px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
            >
              {MARKETPLACES.map((marketplace) => (
                <option key={marketplace} value={marketplace}>{marketplace}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-[#a0a0b8]">Old tracking tag</label>
            <input
              value={oldTrackingTag}
              onChange={(event) => setOldTrackingTag(event.target.value)}
              list="tracking-maintenance-tags"
              placeholder="oldtag-20"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-[#a0a0b8]">New tracking tag</label>
            <input
              value={newTrackingTag}
              onChange={(event) => setNewTrackingTag(event.target.value)}
              list="tracking-maintenance-tags"
              placeholder="newtag-20"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
            />
          </div>
        </div>

        <datalist id="tracking-maintenance-tags">
          {availableTrackingTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void replaceTracking("selected")}
            disabled={saving || selectedRows.length === 0}
            className="rounded-lg bg-[#ff9900] px-4 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Working..." : `Replace Selected (${selectedRows.length})`}
          </button>
          <button
            type="button"
            onClick={() => void replaceTracking("filtered")}
            disabled={saving || filteredMappings.length === 0}
            className="rounded-lg border border-[#ff9900]/30 bg-[#ff9900]/10 px-4 py-2 text-sm font-semibold text-[#ffbf66] transition-colors hover:bg-[#ff9900]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Replace All Filtered ({filteredMappings.length})
          </button>
          <button
            type="button"
            onClick={() => void cleanupDuplicateMappings()}
            disabled={saving}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cleanup Duplicate Tracking
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOldTrackingTag("");
              setNewTrackingTag("");
              setMarketplaceFilter("ALL");
              setSelectedMappingIds([]);
              setError("");
              setMessage("");
              setLastResult(null);
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[#d4d4e4] transition-colors hover:bg-white/10"
          >
            Clear filters
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={() => void deleteSelectedMappings()}
            disabled={saving || selectedMappingIds.length === 0}
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove Selected Links ({selectedMappingIds.length})
          </button>
          <button
            type="button"
            onClick={() => void hardDeleteSelectedProducts()}
            disabled={saving || selectedProductIds.length === 0}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hard Delete Products ({selectedProductIds.length})
          </button>
          <button
            type="button"
            onClick={() => void hardDeleteSelectedTrackingTags()}
            disabled={saving || selectedTrackingIds.length === 0}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hard Delete Tags ({selectedTrackingIds.length})
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {message}
            {lastResult?.summary ? (
              <div className="mt-2 text-xs text-emerald-100/80">
                Matched: {lastResult.summary.matched} · Updated: {lastResult.summary.updated} · Missing replacement: {lastResult.summary.skippedMissingReplacement}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1a1a28]/90">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/5 text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-[#8d8da6]">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={(event) => toggleAllFiltered(event.target.checked)}
                  />
                </th>
                <th className="px-4 py-3">ASIN</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Marketplace</th>
                <th className="px-4 py-3">Tracking tag</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#a0a0b8]">Loading mappings...</td>
                </tr>
              ) : filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#a0a0b8]">No active mappings found.</td>
                </tr>
              ) : (
                filteredMappings.slice(0, 500).map((mapping) => (
                  <tr key={mapping.id} className="text-[#d4d4e4] hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedMappingIds.includes(mapping.id)}
                        onChange={(event) => toggleSelected(mapping.id, event.target.checked)}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#ffbf66]">{mapping.asin}</td>
                    <td className="max-w-md px-4 py-3">
                      <div className="line-clamp-2 text-[#f0f0f5]">{mapping.product_title}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#f0f0f5]">{mapping.agent_name}</div>
                      <div className="text-xs text-[#8d8da6]">/{mapping.agent_slug}</div>
                    </td>
                    <td className="px-4 py-3">{getMappingMarketplace(mapping)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{mapping.tracking_tag}</td>
                    <td className="px-4 py-3">
                      {mapping.is_active === 1 && mapping.tracking_is_active === 1 ? (
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">Active</span>
                      ) : (
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">Needs review</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredMappings.length > 500 ? (
          <div className="border-t border-white/5 px-4 py-3 text-xs text-amber-200">
            Showing first 500 rows. Use search/marketplace/old tag filters to narrow the result before bulk replacement or deletion.
          </div>
        ) : null}
      </div>
    </div>
  );
}
