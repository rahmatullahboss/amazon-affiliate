import {
  ADSTERRA_BANNER_KEY,
  ADSTERRA_BANNER_SCRIPT_SRC,
  ADSTERRA_BANNER_OPTIONS,
} from "../utils/public-ads";

// One approved 320×50 publisher tag, kept under the persistent public layout.
// Do not mount this inside an isolated application iframe or duplicate the zone.
// The publisher's format:"iframe" is its own creative format, not our wrapper.
const APPROVED_PRIMARY_PLACEMENTS = new Set(["public-under-header"]);

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
