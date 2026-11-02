import { resolveApprovedBannerZone } from "../utils/public-ads";

// The same owner-supplied 320×50 tag is intentionally reused at marked spots.
// Adsterra advises different codes on one page for reliable CPM/statistics;
// this is an owner-requested experiment, not a publisher-recommended setup.
// No application iframe is added; Adsterra may create a creative iframe.

export function AdBanner({
  placement,
  className = "",
}: {
  placement: string;
  eager?: boolean;
  className?: string;
}) {
  const zone = resolveApprovedBannerZone(placement);
  if (!zone) return null;

  return (
    <div
      data-ad-placement={placement}
      data-ad-banner-key={zone.key}
      role="complementary"
      aria-label="Advertisement"
      className={`mx-auto my-4 flex min-h-[50px] w-[320px] max-w-full items-center justify-center overflow-hidden ${className}`}
    >
      <script
        dangerouslySetInnerHTML={{
          __html: `var atOptions = ${JSON.stringify(zone.options)};`,
        }}
      />
      <script src={zone.src} />
    </div>
  );
}
