import { useState } from "react";
import { buildShareLinks, normalizeShareUrl } from "../utils/share-links";

interface ShareButtonsProps {
  title: string;
  url: string;
}

export function ShareButtons({ title, url }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const shareLinks = buildShareLinks({ title, url });
  const normalizedUrl = normalizeShareUrl(url);

  async function handleCopy() {
    await navigator.clipboard.writeText(normalizedUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={shareLinks.facebook}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-gray-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-gray-700 transition hover:border-primary hover:text-primary"
      >
        Facebook
      </a>
      <a
        href={shareLinks.x}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-gray-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-gray-700 transition hover:border-primary hover:text-primary"
      >
        X
      </a>
      <a
        href={shareLinks.whatsapp}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-gray-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-gray-700 transition hover:border-primary hover:text-primary"
      >
        WhatsApp
      </a>
      <a
        href={shareLinks.telegram}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-gray-300 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-gray-700 transition hover:border-primary hover:text-primary"
      >
        Telegram
      </a>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="rounded-full bg-gray-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:bg-primary"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
