import { useEffect, useState } from "react";
import { isNativeCapacitorApp } from "../utils/native-auth";
import {
  BOTTOM_SCRIPT_SRC,
  NATIVE_BANNER_CONTAINER_ID,
  NATIVE_BANNER_SCRIPT_SRC,
  shouldEnablePublicAds,
} from "../utils/public-ads";

export {
  BOTTOM_SCRIPT_SRC,
  NATIVE_BANNER_CONTAINER_ID,
  NATIVE_BANNER_SCRIPT_SRC,
  shouldEnablePublicAds,
} from "../utils/public-ads";

function usePublicAdsEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(shouldEnablePublicAds(isNativeCapacitorApp()));
  }, []);

  return enabled;
}

export function PublicAds() {
  const enabled = usePublicAdsEnabled();
  const [dismissed, setDismissed] = useState(false);

  if (!enabled || dismissed) {
    return null;
  }

  return (
    <aside
      aria-label="Advertisement"
      className="mx-auto w-full max-w-7xl px-4 pt-3 lg:px-6"
    >
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
        <button
          type="button"
          aria-label="Close advertisement"
          onClick={() => setDismissed(true)}
          className="absolute right-2 top-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-base font-bold leading-none text-gray-600 shadow-sm transition hover:text-gray-950"
        >
          ×
        </button>
        <script
          async
          data-cfasync="false"
          src={NATIVE_BANNER_SCRIPT_SRC}
        />
        <div id={NATIVE_BANNER_CONTAINER_ID} />
      </div>
    </aside>
  );
}

export function PublicAdsBodyEnd() {
  const enabled = usePublicAdsEnabled();

  if (!enabled) {
    return null;
  }

  return <script src={BOTTOM_SCRIPT_SRC} />;
}
