import { useEffect, useState } from "react";
import type { Route } from "./+types/links";
import { copyTextToClipboard } from "../../utils/clipboard";
import { getAuthToken } from "../../utils/auth-session";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "RKY Tag House" },
    { name: "application-name", content: "RKY Tag House" },
    { name: "apple-mobile-web-app-title", content: "RKY Tag House" },
  ];
}

interface PortalLink {
  agentSlug: string;
  agentName: string;
  asin: string;
  marketplace: string;
  title: string;
  imageUrl: string;
  trackingTag: string;
  bridgePageUrl: string;
  redirectUrl: string;
}

export default function PortalLinksPage() {
  const [links, setLinks] = useState<PortalLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  useEffect(() => {
    const token = getAuthToken();
    fetch("/api/portal/links", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load links");
        return response.json() as Promise<{ links: PortalLink[] }>;
      })
      .then((data) => setLinks(data.links))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load links"))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async (copyKey: string, text: string) => {
    const copied = await copyTextToClipboard(text);
    if (!copied) {
      setError("Could not copy the full link. Please try again.");
      return;
    }

    setCopiedKey(copyKey);
    window.setTimeout(() => setCopiedKey((current) => (current === copyKey ? "" : current)), 2000);
  };

  return (
    <section className="bg-[#111827] border border-white/10 rounded-2xl p-6">
      <h1 className="m-0 mb-3 text-[#f9fafb] text-xl font-bold">My Links</h1>
      <p className="m-0 mb-2 text-[#cbd5e1] leading-relaxed">Copy your unique bridge links and share them with buyers.</p>

      {loading ? <p className="m-0 mb-2 text-[#cbd5e1] leading-relaxed">Loading...</p> : null}
      {error ? <p className="text-red-300 my-3 bg-red-500/10 border border-red-500/25 rounded-xl p-3.5">{error}</p> : null}
      {!loading && !error && links.length === 0 ? <p className="m-0 mb-2 text-[#cbd5e1] leading-relaxed">No links available yet.</p> : null}

      <div className="grid gap-3 mt-4">
        {links.map((link) => (
          <div key={`${link.agentSlug}-${link.asin}`} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center border border-white/10 rounded-xl p-3">
            <img src={link.imageUrl} alt={link.title} className="w-full sm:w-[88px] h-48 sm:h-[88px] object-contain bg-white rounded-xl shrink-0" />
            <div className="flex flex-col gap-2 w-full min-w-0">
              <p className="m-0 text-[#f9fafb] font-semibold leading-relaxed truncate">{link.title}</p>
              <p className="m-0 text-[#cbd5e1] leading-relaxed text-sm truncate">{link.asin} · {link.marketplace} · {link.trackingTag}</p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                <input className="rounded-xl border border-white/10 bg-[#1f2937] text-[#f9fafb] px-4 py-2.5 w-full text-sm outline-none focus:ring-2 focus:ring-amber-500" value={link.bridgePageUrl} readOnly />
                <button
                  className="shrink-0 border-none rounded-xl bg-amber-500 text-gray-900 font-bold px-5 py-2.5 cursor-pointer hover:bg-amber-400 transition-colors w-full sm:w-auto"
                  type="button"
                  onClick={() => void handleCopy(`${link.agentSlug}-${link.asin}`, link.bridgePageUrl)}
                >
                  {copiedKey === `${link.agentSlug}-${link.asin}` ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
