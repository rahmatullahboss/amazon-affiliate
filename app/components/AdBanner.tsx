import {
  ADSTERRA_BANNER_KEY,
  ADSTERRA_BANNER_OPTIONS,
  ADSTERRA_BANNER_SCRIPT_SRC,
} from "../utils/public-ads";

// A separate frame per slot avoids competing global atOptions and
// document.write calls when the same publisher tag appears multiple times.
const BANNER_DOCUMENT = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;width:320px;height:50px;overflow:hidden">
<script>var atOptions = ${JSON.stringify(ADSTERRA_BANNER_OPTIONS)};</script>
<script src="${ADSTERRA_BANNER_SCRIPT_SRC}"></script></body></html>`;

export function AdBanner({
  placement,
  eager = false,
  className = "",
}: {
  placement: string;
  eager?: boolean;
  className?: string;
}) {
  return (
    <div
      data-ad-placement={placement}
      data-ad-banner-key={ADSTERRA_BANNER_KEY}
      role="complementary"
      aria-label="Advertisement"
      className={`mx-auto my-4 flex h-[50px] w-[320px] max-w-full items-center justify-center overflow-hidden ${className}`}
    >
      <iframe
        title={`Advertisement — ${placement}`}
        srcDoc={BANNER_DOCUMENT}
        width={320}
        height={50}
        loading={eager ? "eager" : "lazy"}
        scrolling="no"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="strict-origin-when-cross-origin"
        className="block h-[50px] w-[320px] max-w-full border-0"
      />
    </div>
  );
}
