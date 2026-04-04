import { useMemo } from "react";
import { useLocation } from "react-router";
import { PUBLIC_MARKETPLACES, type PublicMarketplace } from "../utils/marketplace";

interface MarketplaceSelectorProps {
  selectedMarketplace: PublicMarketplace;
  label?: string;
}

export function MarketplaceSelector({
  selectedMarketplace,
  label = "Marketplace",
}: MarketplaceSelectorProps) {
  const location = useLocation();
  const basePath = useMemo(
    () => `${location.pathname}${location.hash || ""}`,
    [location.hash, location.pathname]
  );

  return (
    <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
      <span className="whitespace-nowrap">{label}</span>
      <select
        value={selectedMarketplace}
        onChange={(event) => {
          const nextMarketplace = event.target.value as PublicMarketplace;
          const nextUrl = new URL(window.location.href);
          nextUrl.searchParams.set("market", nextMarketplace);
          document.cookie = `preferred_marketplace=${encodeURIComponent(nextMarketplace)}; Path=/; Max-Age=31536000; SameSite=Lax`;
          window.location.assign(`${basePath}${nextUrl.search}`);
        }}
        className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 outline-none transition focus:border-primary"
      >
        {PUBLIC_MARKETPLACES.map((marketplace) => (
          <option key={marketplace} value={marketplace}>
            {marketplace}
          </option>
        ))}
      </select>
    </label>
  );
}
