import { useEffect, useState } from "react";
import { getAuthToken } from "../../utils/auth-session";

interface SiteBrandingSettings {
  og_site_name: string;
  og_description: string;
  og_image_url: string;
}

const getToken = () => getAuthToken();

export default function SiteBrandingPage() {
  const [form, setForm] = useState<SiteBrandingSettings>({
    og_site_name: "",
    og_description: "",
    og_image_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/site-branding", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const payload = (await response.json()) as {
        settings?: SiteBrandingSettings;
        error?: string;
      };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error || "Failed to load site branding settings");
      }

      setForm(payload.settings);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load site branding settings"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/site-branding", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as {
        settings?: SiteBrandingSettings;
        message?: string;
        error?: string;
      };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error || payload.message || "Failed to save branding settings");
      }

      setForm(payload.settings);
      setMessage(payload.message || "Site branding updated.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to save branding settings"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-[#a0a0b8]">Loading site branding settings...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="m-0 text-2xl font-bold text-[#f0f0f5] sm:text-3xl">Site Branding</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#8d8da6]">
          Control the main-site fallback Open Graph title, description, and image from admin.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-100">
          {message}
        </div>
      ) : null}

      <form
        onSubmit={(event) => void handleSave(event)}
        className="rounded-2xl border border-white/5 bg-[#1a1a28]/90 p-6"
      >
        <div className="grid gap-5">
          <label>
            <span className="mb-1.5 block text-sm text-[#a0a0b8]">OG Site Name</span>
            <input
              value={form.og_site_name}
              onChange={(event) =>
                setForm((current) => ({ ...current, og_site_name: event.target.value }))
              }
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
              placeholder="DealsRky Product Picks"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-sm text-[#a0a0b8]">OG Description</span>
            <textarea
              value={form.og_description}
              onChange={(event) =>
                setForm((current) => ({ ...current, og_description: event.target.value }))
              }
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
              placeholder="Browse curated product pages..."
            />
          </label>

          <label>
            <span className="mb-1.5 block text-sm text-[#a0a0b8]">OG Image URL</span>
            <input
              value={form.og_image_url}
              onChange={(event) =>
                setForm((current) => ({ ...current, og_image_url: event.target.value }))
              }
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
              placeholder="https://..."
            />
          </label>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="m-0 text-xs uppercase tracking-[0.22em] text-[#8d8da6]">Preview</p>
            <p className="mt-3 text-lg font-bold text-[#f0f0f5]">{form.og_site_name}</p>
            <p className="mt-2 text-sm leading-relaxed text-[#a0a0b8]">{form.og_description}</p>
            <p className="mt-2 break-all text-xs text-[#6b6b85]">{form.og_image_url}</p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className={`w-fit rounded-lg px-5 py-2.5 text-sm font-bold transition-opacity ${
              saving
                ? "cursor-not-allowed bg-[#ff9900]/60 text-black/70"
                : "bg-gradient-to-br from-[#ff9900] to-[#ffad33] text-black hover:opacity-90"
            }`}
          >
            {saving ? "Saving..." : "Save Branding"}
          </button>
        </div>
      </form>
    </div>
  );
}
