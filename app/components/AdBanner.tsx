import { resolveApprovedBannerZone } from "../utils/public-ads";

// Each extra placement needs its own approved 320×50 zone code. Missing keys
// render nothing; the current working primary zone is preserved unchanged.
// Adsterra may create an iframe for its creative; our app adds no iframe.

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
