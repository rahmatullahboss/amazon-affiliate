import { useEffect, useState } from "react";
import type { Route } from "./+types/links";
import { copyTextToClipboard } from "../../utils/clipboard";
import { getAuthToken } from "../../utils/auth-session";
import { filterPortalLinksByMarketplace, getPortalLinkMarketplaces } from "../../utils/portal-links";

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
  bridgePageUrl: string;
  redirectUrl: string;
}

type PortalLanguage = "en" | "bn";

interface CopyLabels {
  title: string;
  intro: string;
  loading: string;
  empty: string;
  copyError: string;
  languageLabel: string;
  englishLabel: string;
  banglaLabel: string;
  copied: string;
  readyLinksTitle: string;
  readyLinksIntro: string;
  copy: string;
  marketplaceLabel: string;
  marketplacePlaceholder: string;
  marketplaceHelp: string;
  chooseMarketplaceEmpty: string;
}

const COPY_BY_LANGUAGE: Record<PortalLanguage, CopyLabels> = {
  en: {
    title: "Links",
    intro:
      "Use your normal bridge links below. If you replace both {country} and {ASIN}, DealsRky will try to create the missing bridge page on the fly.",
    loading: "Loading...",
    empty: "No links available yet.",
    copyError: "Could not copy the full link. Please try again.",
    languageLabel: "Language",
    englishLabel: "English",
    banglaLabel: "বাংলা",
    copied: "Copied",
    readyLinksTitle: "Ready Product Links",
    readyLinksIntro:
      "These bridge links are already created for products saved in your account.",
    copy: "Copy",
    marketplaceLabel: "Marketplace",
    marketplacePlaceholder: "Select a country",
    marketplaceHelp: "Choose the country you want to view. Only that marketplace's products will appear below.",
    chooseMarketplaceEmpty: "Select a country to view that marketplace's product links.",
  },
  bn: {
    title: "লিংক",
    intro:
      "নিচের normal bridge link-গুলোই ব্যবহার করুন। {country} এবং {ASIN} দুটোই replace করলে DealsRky missing bridge page on-the-fly তৈরি করার চেষ্টা করবে।",
    loading: "লোড হচ্ছে...",
    empty: "এখনও কোনো লিংক নেই।",
    copyError: "পুরো লিংক কপি করা যায়নি। আবার চেষ্টা করুন।",
    languageLabel: "ভাষা",
    englishLabel: "English",
    banglaLabel: "বাংলা",
    copied: "কপি হয়েছে",
    readyLinksTitle: "রেডি প্রোডাক্ট লিংক",
    readyLinksIntro:
      "এই bridge link-গুলো আপনার account-এর saved product-এর জন্য আগেই তৈরি করা আছে।",
    copy: "কপি",
    marketplaceLabel: "মার্কেটপ্লেস",
    marketplacePlaceholder: "দেশ সিলেক্ট করুন",
    marketplaceHelp: "যে country দেখতে চান সেটা select করুন। নিচে শুধু ওই marketplace-এর product-গুলো দেখাবে।",
    chooseMarketplaceEmpty: "প্রোডাক্ট লিংক দেখতে আগে একটি country select করুন।",
  },
};

export default function PortalLinksPage() {
  const [links, setLinks] = useState<PortalLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [language, setLanguage] = useState<PortalLanguage>("en");
  const [selectedMarketplace, setSelectedMarketplace] = useState("");

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("portal-links-language");
    if (savedLanguage === "en" || savedLanguage === "bn") {
      setLanguage(savedLanguage);
    }
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    fetch("/api/portal/links", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load links");
        }

        return response.json() as Promise<{
          links: PortalLink[];
        }>;
      })
      .then((data) => {
        setLinks(data.links);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load links"))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async (copyKey: string, text: string) => {
    const copied = await copyTextToClipboard(text);
    if (!copied) {
      setError(COPY_BY_LANGUAGE[language].copyError);
      return;
    }

    setCopiedKey(copyKey);
    window.setTimeout(() => setCopiedKey((current) => (current === copyKey ? "" : current)), 2000);
  };

  const handleLanguageChange = (nextLanguage: PortalLanguage) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem("portal-links-language", nextLanguage);
  };

  const copy = COPY_BY_LANGUAGE[language];
  const availableMarketplaces = getPortalLinkMarketplaces(links);
  const visibleLinks = filterPortalLinksByMarketplace(links, selectedMarketplace);

  return (
    <section className="bg-[#111827] border border-white/10 rounded-2xl p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <h1 className="m-0 mb-3 text-[#f9fafb] text-xl font-bold">{copy.title}</h1>
          <p className="m-0 mb-2 text-[#cbd5e1] leading-relaxed">{copy.intro}</p>
        </div>

        <div className="shrink-0 rounded-2xl border border-white/10 bg-[#0f172a] p-1.5">
          <p className="m-0 px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
            {copy.languageLabel}
          </p>
          <div className="flex gap-1">
            <button
              className={`rounded-xl border-none px-4 py-2 text-sm font-semibold transition-colors ${
                language === "en"
                  ? "bg-amber-500 text-gray-900"
                  : "bg-transparent text-[#cbd5e1] hover:bg-white/5"
              }`}
              type="button"
              onClick={() => handleLanguageChange("en")}
            >
              {copy.englishLabel}
            </button>
            <button
              className={`rounded-xl border-none px-4 py-2 text-sm font-semibold transition-colors ${
                language === "bn"
                  ? "bg-amber-500 text-gray-900"
                  : "bg-transparent text-[#cbd5e1] hover:bg-white/5"
              }`}
              type="button"
              onClick={() => handleLanguageChange("bn")}
            >
              {copy.banglaLabel}
            </button>
          </div>
        </div>
      </div>

      {loading ? <p className="m-0 mb-2 text-[#cbd5e1] leading-relaxed">{copy.loading}</p> : null}
      {error ? (
        <p className="text-red-300 my-3 bg-red-500/10 border border-red-500/25 rounded-xl p-3.5">
          {error}
        </p>
      ) : null}
      {!loading && !error && links.length === 0 ? (
        <p className="m-0 mb-2 text-[#cbd5e1] leading-relaxed">{copy.empty}</p>
      ) : null}

      <div className="grid gap-3 mt-4">
        {links.length > 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-4">
            <h2 className="m-0 text-[#f9fafb] text-lg font-bold">{copy.readyLinksTitle}</h2>
            <p className="m-0 mt-1 text-sm leading-relaxed text-[#cbd5e1]">{copy.readyLinksIntro}</p>
            <div className="mt-4 grid gap-2 sm:max-w-[240px]">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
                {copy.marketplaceLabel}
              </label>
              <select
                value={selectedMarketplace}
                onChange={(event) => setSelectedMarketplace(event.target.value)}
                className="rounded-xl border border-white/10 bg-[#111827] text-[#f9fafb] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">{copy.marketplacePlaceholder}</option>
                {availableMarketplaces.map((marketplace) => (
                  <option key={marketplace} value={marketplace}>
                    {marketplace}
                  </option>
                ))}
              </select>
              <p className="m-0 text-xs leading-relaxed text-[#94a3b8]">
                {copy.marketplaceHelp}
              </p>
            </div>
          </div>
        ) : null}
        {!loading && !error && links.length > 0 && visibleLinks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#0f172a] p-5">
            <p className="m-0 text-sm leading-relaxed text-[#cbd5e1]">
              {copy.chooseMarketplaceEmpty}
            </p>
          </div>
        ) : null}
        {visibleLinks.map((link) => (
          <div
            key={`${link.agentSlug}-${link.asin}`}
            className="flex flex-col sm:flex-row gap-4 items-start sm:items-center border border-white/10 rounded-xl p-3"
          >
            <img
              src={link.imageUrl}
              alt={link.title}
              className="w-full sm:w-[88px] h-48 sm:h-[88px] object-contain bg-white rounded-xl shrink-0"
            />
            <div className="flex flex-col gap-2 w-full min-w-0">
              <p className="m-0 text-[#f9fafb] font-semibold leading-relaxed truncate">{link.title}</p>
              <p className="m-0 text-[#cbd5e1] leading-relaxed text-sm truncate">
                {link.asin} · {link.marketplace}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                <input
                  className="rounded-xl border border-white/10 bg-[#1f2937] text-[#f9fafb] px-4 py-2.5 w-full text-sm outline-none focus:ring-2 focus:ring-amber-500"
                  value={link.bridgePageUrl}
                  readOnly
                />
                <button
                  className="shrink-0 border-none rounded-xl bg-amber-500 text-gray-900 font-bold px-5 py-2.5 cursor-pointer hover:bg-amber-400 transition-colors w-full sm:w-auto"
                  type="button"
                  onClick={() => void handleCopy(`${link.agentSlug}-${link.asin}`, link.bridgePageUrl)}
                >
                  {copiedKey === `${link.agentSlug}-${link.asin}` ? copy.copied : copy.copy}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
