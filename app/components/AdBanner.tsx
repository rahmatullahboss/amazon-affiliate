import {
  ADSTERRA_BANNER_KEY,
  ADSTERRA_BANNER_SCRIPT_SRC,
  ADSTERRA_BANNER_OPTIONS,
} from "../utils/public-ads";

// The publisher supplied ONE 320×50 zone. Adsterra explicitly requires
// separately issued codes for additional same-size placements on one page.
// Only the first screenshot-marked slot is currently activated per route.
// Other locations remain in the caller markup for future independently
// approved zone codes, but render no empty placeholder or network request.
const APPROVED_PRIMARY_PLACEMENTS = new Set([
  "home-after-header",
  "collection-after-header",
  "product-after-breadcrumbs",
]);

export function AdBanner({
  placement,
  className = "",
}: {
  placement: string;
  eager?: boolean;
  className?: string;
}) {
  if (!APPROVED_PRIMARY_PLACEMENTS.has(placement)) return null;

  return (
    <div
      data-ad-placement={placement}
      data-ad-banner-key={ADSTERRA_BANNER_KEY}
      role="complementary"
      aria-label="Advertisement"
      className={`mx-auto my-4 flex min-h-[50px] w-[320px] max-w-full items-center justify-center overflow-hidden ${className}`}
    >
      <script
        dangerouslySetInnerHTML={{
          __html: `var atOptions = ${JSON.stringify(ADSTERRA_BANNER_OPTIONS)};`,
        }}
      />
      <script src={ADSTERRA_BANNER_SCRIPT_SRC} />
    </div>
  );
}
