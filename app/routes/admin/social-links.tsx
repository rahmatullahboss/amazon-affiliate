import { useEffect, useState } from "react";
import { getAuthToken } from "../../utils/auth-session";
import { extractApiErrorMessage } from "../../utils/api-errors";

interface SocialLinksSettings {
  id: number;
  telegram_url: string;
  telegram_enabled: number;
  whatsapp_url: string;
  whatsapp_enabled: number;
  messenger_url: string;
  messenger_enabled: number;
  created_at: string;
  updated_at: string;
}

interface SocialLinksFormState {
  telegram_url: string;
  telegram_enabled: boolean;
  whatsapp_url: string;
  whatsapp_enabled: boolean;
  messenger_url: string;
  messenger_enabled: boolean;
}

const getToken = () => getAuthToken();

function settingsToForm(settings: SocialLinksSettings): SocialLinksFormState {
  return {
    telegram_url: settings.telegram_url ?? "",
    telegram_enabled: Boolean(settings.telegram_enabled),
    whatsapp_url: settings.whatsapp_url ?? "",
    whatsapp_enabled: Boolean(settings.whatsapp_enabled),
    messenger_url: settings.messenger_url ?? "",
    messenger_enabled: Boolean(settings.messenger_enabled),
  };
}

export default function SocialLinksPage() {
  const [form, setForm] = useState<SocialLinksFormState>({
    telegram_url: "",
    telegram_enabled: false,
    whatsapp_url: "",
    whatsapp_enabled: false,
    messenger_url: "",
    messenger_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/social-links", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const payload = (await response.json()) as {
        settings?: SocialLinksSettings;
        error?: string;
      };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error || "Failed to load social link settings");
      }

      setForm(settingsToForm(payload.settings));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load social link settings"
      );
    } finally {
      setLoading(false);
    }
  }

  function validate(value: SocialLinksFormState): Record<string, string> {
    const errors: Record<string, string> = {};
    const pairs: Array<[keyof SocialLinksFormState, string]> = [
      ["telegram_url", "Telegram"],
      ["whatsapp_url", "WhatsApp"],
      ["messenger_url", "Messenger"],
    ];

    for (const [field, label] of pairs) {
      const url = value[field] as string;
      if (url && url.trim().length > 0) {
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            errors[field] = `${label} URL must start with http:// or https://`;
          }
        } catch {
          errors[field] = `${label} URL is not valid`;
        }
      }
    }
    return errors;
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    setValidationErrors({});

    const localErrors = validate(form);
    if (Object.keys(localErrors).length > 0) {
      setValidationErrors(localErrors);
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/social-links", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          telegram_url: form.telegram_url,
          telegram_enabled: form.telegram_enabled,
          whatsapp_url: form.whatsapp_url,
          whatsapp_enabled: form.whatsapp_enabled,
          messenger_url: form.messenger_url,
          messenger_enabled: form.messenger_enabled,
        }),
      });
      const payload = (await response.json()) as {
        settings?: SocialLinksSettings;
        message?: string;
        error?: string;
      };

      if (!response.ok || !payload.settings) {
        throw new Error(extractApiErrorMessage(payload, "Failed to save social link settings"));
      }

      setForm(settingsToForm(payload.settings));
      setMessage(payload.message || "Social links updated.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to save social link settings"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-[#a0a0b8]">Loading social link settings...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="m-0 text-2xl font-bold text-[#f0f0f5] sm:text-3xl">Social Links</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#8d8da6]">
          Manage the Telegram, WhatsApp, and Messenger links shown in the site header.
          Leave a field empty or disabled to hide that icon.
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
        <div className="grid gap-6">
          <SocialLinkField
            label="Telegram"
            description="Public channel, group, or chat invite link (https://t.me/...)."
            platform="telegram"
            iconBg="bg-[#229ED9]"
            iconPath="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19l-9.49 5.99-4.1-1.27c-.88-.25-.89-.86.2-1.27l16.04-6.18c.73-.33 1.43.18 1.15 1.31l-2.73 12.86c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"
            form={form}
            setForm={setForm}
            error={validationErrors.telegram_url}
          />

          <SocialLinkField
            label="WhatsApp"
            description="Phone-number or wa.me link (https://wa.me/15551234567)."
            platform="whatsapp"
            iconBg="bg-[#25D366]"
            iconPath="M19.11 17.21c-.31-.16-1.83-.9-2.11-1s-.49-.16-.7.16-.8 1-1 1.21-.37.24-.68.08a8.45 8.45 0 0 1-2.49-1.54 9.4 9.4 0 0 1-1.72-2.13c-.18-.31 0-.48.13-.63s.31-.37.47-.55.21-.32.31-.53.05-.4-.08-.55-.7-1.69-1-2.31-.52-.55-.71-.56h-.61a1.17 1.17 0 0 0-.85.4 3.55 3.55 0 0 0-1.11 2.65 6.16 6.16 0 0 0 1.29 3.27 14.14 14.14 0 0 0 5.42 4.78c.76.33 1.35.52 1.81.67a4.36 4.36 0 0 0 2 .12 3.27 3.27 0 0 0 2.14-1.51 2.65 2.65 0 0 0 .19-1.51c-.08-.14-.28-.22-.59-.37zM12 2a10 10 0 0 0-8.46 15.32L2 22l4.82-1.26A10 10 0 1 0 12 2z"
            form={form}
            setForm={setForm}
            error={validationErrors.whatsapp_url}
          />

          <SocialLinkField
            label="Messenger"
            description="Facebook Messenger link (https://m.me/yourpage)."
            platform="messenger"
            iconBg="bg-gradient-to-br from-[#00B2FF] to-[#006AFF]"
            iconPath="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.34.27.55l.05 1.79c.02.57.61.94 1.13.71l1.99-.94c.16-.08.34-.1.51-.06.91.25 1.88.38 2.91.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2z"
            form={form}
            setForm={setForm}
            error={validationErrors.messenger_url}
          />

          <button
            type="submit"
            disabled={saving}
            className={`w-fit rounded-lg px-5 py-2.5 text-sm font-bold transition-opacity ${
              saving
                ? "cursor-not-allowed bg-[#ff9900]/60 text-black/70"
                : "bg-gradient-to-br from-[#ff9900] to-[#ffad33] text-black hover:opacity-90"
            }`}
          >
            {saving ? "Saving..." : "Save Social Links"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface SocialLinkFieldProps {
  label: string;
  description: string;
  platform: "telegram" | "whatsapp" | "messenger";
  iconBg: string;
  iconPath: string;
  form: SocialLinksFormState;
  setForm: React.Dispatch<React.SetStateAction<SocialLinksFormState>>;
  error?: string;
}

function SocialLinkField({
  label,
  description,
  platform,
  iconBg,
  iconPath,
  form,
  setForm,
  error,
}: SocialLinkFieldProps) {
  const urlKey = `${platform}_url` as keyof SocialLinksFormState;
  const enabledKey = `${platform}_enabled` as keyof SocialLinksFormState;
  const url = form[urlKey] as string;
  const enabled = form[enabledKey] as boolean;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg} text-white shadow`}
            aria-hidden="true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d={iconPath} />
            </svg>
          </span>
          <div>
            <p className="m-0 text-sm font-bold text-[#f0f0f5]">{label}</p>
            <p className="m-0 text-xs text-[#8d8da6]">{description}</p>
          </div>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#a0a0b8]">
          <span>{enabled ? "Visible" : "Hidden"}</span>
          <span
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? "bg-[#ff9900]" : "bg-white/10"
            }`}
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) =>
                setForm((current) => ({ ...current, [enabledKey]: event.target.checked }))
              }
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label={`Toggle ${label} link`}
            />
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </span>
        </label>
      </div>

      <input
        value={url}
        onChange={(event) =>
          setForm((current) => ({ ...current, [urlKey]: event.target.value }))
        }
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://..."
        className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-[#f0f0f5] focus:outline-none focus:ring-2 focus:ring-[#ff9900]"
      />

      {error ? (
        <p className="mt-2 text-xs text-red-300">{error}</p>
      ) : null}

      {url && enabled ? (
        <p className="mt-2 break-all text-xs text-[#6b6b85]">
          Preview: <span className="text-[#a0a0b8]">{url}</span>
        </p>
      ) : null}
    </div>
  );
}
