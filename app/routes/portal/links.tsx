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

interface DynamicBridgeTemplate {
  agentSlug: string;
  agentName: string;
  bridgeTemplateUrl: string;
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
  dynamicTitle: string;
  dynamicIntro: string;
  guideTitle: string;
  guidePrimary: string;
  guideBridge: string;
  guideAsin: string;
  guideResult: string;
  templateLabel: string;
  templateHelp: string;
  replaceAsin: string;
  copyTemplate: string;
  copied: string;
  readyLinksTitle: string;
  readyLinksIntro: string;
  copy: string;
}

const COPY_BY_LANGUAGE: Record<PortalLanguage, CopyLabels> = {
  en: {
    title: "Links",
    intro:
      "Use your normal bridge links below. If you change only the ASIN part at the end, DealsRky will try to create the missing bridge page on the fly.",
    loading: "Loading...",
    empty: "No links available yet.",
    copyError: "Could not copy the full link. Please try again.",
    languageLabel: "Language",
    englishLabel: "English",
    banglaLabel: "বাংলা",
    dynamicTitle: "Dynamic ASIN Bridge Link",
    dynamicIntro:
      "This uses your existing bridge-link system. The customer lands on the bridge page first. They go to Amazon only after clicking the button on that page.",
    guideTitle: "How it works",
    guidePrimary:
      "Change only the last ASIN part of the bridge link. Do not change the rest of the link.",
    guideBridge:
      "If the ASIN already exists, the normal bridge page will open.",
    guideAsin:
      "If the ASIN is new, the system will call the API, fetch the product data, create the bridge page, and open that page on the fly.",
    guideResult:
      "After the bridge page opens, the customer will go to Amazon only when they click the button there.",
    templateLabel: "Editable Bridge Format",
    templateHelp:
      "Copy this format and replace only {ASIN}. This opens the bridge page first, not Amazon directly.",
    replaceAsin: "Replace {ASIN} with a valid Amazon ASIN.",
    copyTemplate: "Copy Dynamic Bridge Link",
    copied: "Copied",
    readyLinksTitle: "Ready Product Links",
    readyLinksIntro:
      "These bridge links are already created for products saved in your account.",
    copy: "Copy",
  },
  bn: {
    title: "লিংক",
    intro:
      "নিচের normal bridge link-গুলোই ব্যবহার করুন। একদম শেষের ASIN অংশটা শুধু change করলে DealsRky missing bridge page on-the-fly তৈরি করার চেষ্টা করবে।",
    loading: "লোড হচ্ছে...",
    empty: "এখনও কোনো লিংক নেই।",
    copyError: "পুরো লিংক কপি করা যায়নি। আবার চেষ্টা করুন।",
    languageLabel: "ভাষা",
    englishLabel: "English",
    banglaLabel: "বাংলা",
    dynamicTitle: "ডাইনামিক ASIN ব্রিজ লিংক",
    dynamicIntro:
      "এটা আপনার existing bridge-link system-ই। Customer আগে bridge page-এ land করবে। ওই page-এর button এ click করার পরেই সে Amazon-এ যাবে.",
    guideTitle: "এটা কীভাবে কাজ করে",
    guidePrimary:
      "Bridge link-এর একদম শেষের ASIN অংশটাই শুধু change করবেন। বাকি link change করবেন না।",
    guideBridge:
      "যদি ওই ASIN আগে থেকেই থাকে, তাহলে normal bridge page open হবে।",
    guideAsin:
      "যদি ASIN নতুন হয়, system API call করে product data আনবে, bridge page তৈরি করবে, এবং on-the-fly সেই page-টাই open করবে।",
    guideResult:
      "Bridge page open হওয়ার পরে customer ওই page-এর button এ click করলে তবেই Amazon-এ যাবে।",
    templateLabel: "এডিট করা যায় এমন ব্রিজ ফরম্যাট",
    templateHelp:
      "এই format কপি করে শুধু {ASIN} বদলান। এটা আগে bridge page খুলবে, direct Amazon-এ নেবে না।",
    replaceAsin: "{ASIN} এর জায়গায় একটি valid Amazon ASIN বসান।",
    copyTemplate: "ডাইনামিক ব্রিজ লিংক কপি করুন",
    copied: "কপি হয়েছে",
    readyLinksTitle: "রেডি প্রোডাক্ট লিংক",
    readyLinksIntro:
      "এই bridge link-গুলো আপনার account-এর saved product-এর জন্য আগেই তৈরি করা আছে।",
    copy: "কপি",
  },
};

export default function PortalLinksPage() {
  const [links, setLinks] = useState<PortalLink[]>([]);
  const [dynamicBridgeTemplates, setDynamicBridgeTemplates] = useState<DynamicBridgeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [language, setLanguage] = useState<PortalLanguage>("en");

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
          dynamicBridgeTemplates: DynamicBridgeTemplate[];
        }>;
      })
      .then((data) => {
        setLinks(data.links);
        setDynamicBridgeTemplates(data.dynamicBridgeTemplates);
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

      {!loading && !error && dynamicBridgeTemplates.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-[#f9fafb] text-lg font-bold">{copy.dynamicTitle}</h2>
            <p className="m-0 text-sm leading-relaxed text-[#cbd5e1]">{copy.dynamicIntro}</p>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-[#0f172a] p-4">
            <h3 className="m-0 text-sm font-bold uppercase tracking-[0.18em] text-amber-300">
              {copy.guideTitle}
            </h3>
            <div className="mt-3 grid gap-2 text-sm leading-relaxed text-[#cbd5e1]">
              <p className="m-0 font-semibold text-amber-200">{copy.guidePrimary}</p>
              <p className="m-0">{copy.guideBridge}</p>
              <p className="m-0">{copy.guideAsin}</p>
              <p className="m-0">{copy.guideResult}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {dynamicBridgeTemplates.map((template) => (
              <div key={template.agentSlug} className="rounded-xl border border-white/10 bg-[#0f172a] p-4">
                <p className="m-0 text-[#f9fafb] font-semibold">
                  {template.agentName} · {template.agentSlug}
                </p>
                <p className="m-0 mt-1 text-xs leading-relaxed text-[#94a3b8]">
                  {copy.replaceAsin.split("{ASIN}")[0]}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-[#f8fafc]">{"{ASIN}"}</code>
                  {copy.replaceAsin.split("{ASIN}")[1] || ""}
                </p>

                <div className="mt-3 grid gap-2">
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                    <p className="m-0 text-sm font-semibold text-[#f9fafb]">{copy.templateLabel}</p>
                    <p className="m-0 mt-1 text-xs leading-relaxed text-[#94a3b8]">{copy.templateHelp}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                    <input
                      className="rounded-xl border border-white/10 bg-[#1f2937] text-[#f9fafb] px-4 py-2.5 w-full text-sm outline-none focus:ring-2 focus:ring-amber-500"
                      value={template.bridgeTemplateUrl}
                      readOnly
                    />
                    <button
                      className="shrink-0 border-none rounded-xl bg-amber-500 text-gray-900 font-bold px-5 py-2.5 cursor-pointer hover:bg-amber-400 transition-colors w-full sm:w-auto"
                      type="button"
                      onClick={() =>
                        void handleCopy(`dynamic-template-${template.agentSlug}`, template.bridgeTemplateUrl)
                      }
                    >
                      {copiedKey === `dynamic-template-${template.agentSlug}` ? copy.copied : copy.copyTemplate}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 mt-4">
        {links.length > 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-4">
            <h2 className="m-0 text-[#f9fafb] text-lg font-bold">{copy.readyLinksTitle}</h2>
            <p className="m-0 mt-1 text-sm leading-relaxed text-[#cbd5e1]">{copy.readyLinksIntro}</p>
          </div>
        ) : null}
        {links.map((link) => (
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
                {link.asin} · {link.marketplace} · {link.trackingTag}
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
