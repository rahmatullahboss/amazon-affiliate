import { useEffect, useRef, useState } from "react";
import { ADSTERRA_BANNER_KEY } from "../utils/public-ads";

// Real first-party URL preserves the DealsRky Referer for publisher verification.
// The old about:srcdoc frames sent no Referer and received empty ad scripts.
export const BANNER_FRAME_URL = "/adsterra-banner.html";

export function AdBanner({
  placement,
  eager = false,
  className = "",
}: {
  placement: string;
  eager?: boolean;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(eager);

  useEffect(() => {
    if (isNearViewport) return;
    const node = container.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        setIsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isNearViewport]);

  return (
    <div
      ref={container}
      data-ad-placement={placement}
      data-ad-banner-key={ADSTERRA_BANNER_KEY}
      role="complementary"
      aria-label="Advertisement"
      className={`mx-auto my-4 flex h-[50px] w-[320px] max-w-full items-center justify-center overflow-hidden ${className}`}
    >
      <iframe
        title={`Advertisement — ${placement}`}
        src={isNearViewport ? BANNER_FRAME_URL : undefined}
        data-ad-ready={isNearViewport ? "true" : "false"}
        width={320}
        height={50}
        loading="eager"
        scrolling="no"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="origin"
        className="block h-[50px] w-[320px] max-w-full border-0"
      />
    </div>
  );
}
